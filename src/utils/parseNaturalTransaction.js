// Parse une phrase en langage naturel ("15€ resto hier", "reçu 2000 salaire
// lundi") en une transaction pré-remplie. 100% client-side, heuristique et
// instantané — aucun appel réseau, aucune donnée envoyée. Réutilise l'index
// de descriptions apprises pour deviner la catégorie quand aucun mot-clé de
// catégorie n'est reconnu.
import { normalizeText, buildSuggestionIndex, getSuggestions } from "./descriptionSuggestions";
import { MERCHANT_SYNONYMS } from "../data/merchantSynonyms";
import { SUGGESTED_TAGS } from "../data/suggestedTags";
import { getMemberKey } from "./members";

// Mots-clés parlés (FR/EN) → tag préréglé. À l'oral personne ne dit « hashtag »,
// donc on reconnaît les tournures courantes et on retombe sur le tag normalisé.
// La clé = key d'un tag de SUGGESTED_TAGS ; les valeurs = variantes à détecter.
const TAG_SPEECH = {
  inutile: ["inutile", "inutiles", "useless", "waste", "gaspillage"],
  impulsif: ["impulsif", "impulsive", "impulsion", "impulse", "coup de tete", "coup de coeur"],
  regret: ["regret", "regrette", "je regrette", "regrettable"],
  yolo: ["yolo", "assume", "assumee", "no regret"],
  plaisir: ["plaisir", "petit plaisir", "treat", "guilty pleasure"],
  urgence: ["urgence", "urgent", "urgente", "emergency"],
  sante: ["sante", "medical", "medicale", "health", "docteur", "medecin"],
  remboursable: ["remboursable", "a rembourser", "reimbursable", "expensable"],
  pro: ["pro", "professionnel", "professionnelle", "boulot", "travail", "business", "work"],
  cadeau: ["cadeau", "cadeaux", "gift", "present"],
  vacances: ["vacances", "vacation", "holiday", "holidays", "voyage", "trip"],
};

// Tournures qui désignent le PAYEUR. Un verbe de paiement est exigé : « par »
// tout seul est trop courant en français (« par avion », « par mois ») pour
// valoir attribution.
const PAID_BY_MARKERS = ["paye par", "payee par", "payer par", "regle par", "reglee par", "avance par", "avancee par", "paid by", "paid for by"];

// Tournures qui désignent le ou les BÉNÉFICIAIRES.
const FOR_MARKERS = ["pour", "for"];

// Bénéficiaire « tout le monde » → partage 50/50, sans nommer personne.
const SHARED_WORDS = ["partage", "partagee", "nous", "nous deux", "les deux", "tous les deux", "couple", "commun", "shared", "both", "us", "the two of us"];

const CURRENCY_HINTS = [
  { code: "EUR", tokens: ["€", "eur", "euro", "euros"] },
  { code: "USD", tokens: ["$", "usd", "dollar", "dollars"] },
  { code: "GBP", tokens: ["£", "gbp", "livre", "livres", "pound", "pounds"] },
  { code: "CHF", tokens: ["chf", "franc", "francs"] },
  { code: "JPY", tokens: ["¥", "jpy", "yen", "yens"] },
  { code: "VND", tokens: ["₫", "vnd", "dong", "dongs"] },
  { code: "THB", tokens: ["฿", "thb", "baht", "bahts"] },
  { code: "AUD", tokens: ["aud"] },
  { code: "CAD", tokens: ["cad"] },
  { code: "CNY", tokens: ["cny", "rmb", "yuan", "yuans", "renminbi"] },
  { code: "SGD", tokens: ["sgd"] },
  { code: "HKD", tokens: ["hkd"] },
  { code: "INR", tokens: ["inr", "₹", "roupie", "roupies"] },
  { code: "KRW", tokens: ["krw", "₩", "won"] },
  { code: "AED", tokens: ["aed", "dirham", "dirhams"] },
];

// « percu » couvre « loyer perçu », qui est un revenu, sans faire basculer
// « loyer » tout court — ce dernier désigne bien plus souvent le loyer qu'on
// paie, et le classer en revenu casserait le cas le plus courant de l'app.
const INCOME_WORDS = ["recu", "recus", "percu", "percue", "percus", "encaisse", "salaire", "revenu", "revenus", "paie", "paye", "prime", "dividende", "dividendes", "remboursement", "rembourse", "income", "salary", "received", "collected", "paycheck", "refund", "bonus"];
// Les enveloppes et supports nommés valent mot-clé : personne n'écrit
// « investissement ETF », on écrit « ETF 250 € ». « assurance vie » ne figure
// qu'en toutes lettres — « assurance » seule reste une dépense (banque/assurance).
const INVEST_WORDS = ["investi", "investissement", "epargne", "placement", "pea", "versement", "etf", "etfs", "scpi", "cto", "crypto", "bourse", "obligations", "assurance vie", "assurance-vie", "invest", "invested", "savings", "life insurance"];

const WEEKDAYS = {
  dimanche: 0, sunday: 0, lundi: 1, monday: 1, mardi: 2, tuesday: 2,
  mercredi: 3, wednesday: 3, jeudi: 4, thursday: 4, vendredi: 5, friday: 5,
  samedi: 6, saturday: 6,
};
const MONTHS = {
  janvier: 0, january: 0, fevrier: 1, february: 1, mars: 2, march: 2,
  avril: 3, april: 3, mai: 4, may: 4, juin: 5, june: 5, juillet: 6, july: 6,
  aout: 7, august: 7, septembre: 8, september: 8, octobre: 9, october: 9,
  novembre: 10, november: 10, decembre: 11, december: 11,
};

function parseAmount(token) {
  let s = token.replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Détecte la devise : symbole/mot le plus proche d'un montant, sinon défaut.
// `detected` distingue une vraie détection (un indice présent dans le texte)
// d'un simple repli sur la devise par défaut — utile pour ne pas écraser la
// devise choisie quand la saisie n'en mentionne aucune.
function detectCurrency(norm, fallback) {
  for (const { code, tokens } of CURRENCY_HINTS) {
    for (const tk of tokens) {
      if (norm.includes(tk)) return { code, detected: true };
    }
  }
  return { code: fallback, detected: false };
}

function detectDate(norm) {
  const now = new Date();
  const at = (d) => { d.setHours(12, 0, 0, 0); return d; };
  if (/\b(aujourd|today|ce soir|tonight)/.test(norm)) return at(new Date());
  if (/\bavant[\s-]?hier\b/.test(norm)) return at(new Date(now.getTime() - 2 * 86400000));
  if (/\bhier\b|\byesterday\b/.test(norm)) return at(new Date(now.getTime() - 86400000));
  const ago = norm.match(/il y a (\d{1,3}) jours?|(\d{1,3}) days? ago/);
  if (ago) return at(new Date(now.getTime() - (parseInt(ago[1] || ago[2]) || 0) * 86400000));
  // "3 juin" / "june 3" / "le 3 juin" — on parcourt TOUTES les paires
  // nombre+mot (et mot+nombre) et on retient la première dont le mot est un
  // vrai mois. Sans ça, "25 euros ... le 8 juillet" s'arrêtait sur "25 euros".
  const pairs = [
    ...norm.matchAll(/(\d{1,2})\s+([a-zéûô]+)/g),
    ...norm.matchAll(/([a-zéûô]+)\s+(\d{1,2})/g),
  ];
  for (const m of pairs) {
    const day = parseInt(/^\d/.test(m[1]) ? m[1] : m[2]);
    const monthWord = /^\d/.test(m[1]) ? m[2] : m[1];
    if (monthWord in MONTHS && day >= 1 && day <= 31) {
      const year = now.getFullYear();
      const d = new Date(year, MONTHS[monthWord], day);
      if (d > now) d.setFullYear(year - 1); // date future → année précédente
      return at(d);
    }
  }
  // Jour de la semaine → occurrence passée la plus récente
  for (const [word, dow] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${word}\\b`).test(norm)) {
      const d = new Date(now);
      let diff = (now.getDay() - dow + 7) % 7;
      d.setDate(now.getDate() - diff);
      return at(d);
    }
  }
  return at(new Date());
}

// Cherche une catégorie/sous-catégorie dont le nom apparaît dans le texte.
function matchCategory(norm, categories, type) {
  const pool = categories.filter((c) =>
    type === "income" ? c.id === "income" :
    type === "investment" ? (c.id === "investment" || c.id === "savings") :
    c.id !== "income" && c.id !== "investment" && c.id !== "savings"
  );
  // Sous-catégories d'abord (plus précis)
  for (const c of pool) {
    for (const sub of c.subcategories || []) {
      const n = normalizeText(sub);
      if (n.length >= 3 && norm.includes(n)) return { categoryId: c.id, subcategory: sub, matched: n };
    }
  }
  for (const c of pool) {
    const n = normalizeText(c.name);
    if (n.length >= 3 && norm.includes(n)) return { categoryId: c.id, subcategory: (c.subcategories || [])[0] || null, matched: n };
  }
  return null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Cherche un marchand/synonyme courant (McDo, Uber, Netflix…) dans le texte et
// renvoie la catégorie par défaut correspondante — uniquement pour les dépenses,
// et seulement si cette catégorie existe encore chez le couple. La sous-catégorie
// est validée (repli sur la première si elle a été supprimée/renommée).
function matchSynonym(norm, categories) {
  for (const entry of MERCHANT_SYNONYMS) {
    for (const kw of entry.kw) {
      if (new RegExp(`\\b${escapeRegExp(kw)}\\b`).test(norm)) {
        const c = categories.find((x) => x.id === entry.categoryId);
        if (!c) continue;
        const subs = c.subcategories || [];
        const sub = subs.includes(entry.subcategory) ? entry.subcategory : subs[0] || null;
        return { categoryId: c.id, subcategory: sub };
      }
    }
  }
  return null;
}

// Détecte des tags parlés dans le texte : variantes des tags préréglés, puis
// tags déjà utilisés dans l'historique (matchés par mot entier). Renvoie une
// liste normalisée dédoublonnée.
function detectTags(norm, usedTags) {
  const found = [];
  const push = (key) => { if (key && !found.includes(key)) found.push(key); };
  const preset = new Map(SUGGESTED_TAGS.map((t) => [t.key, t.emoji]));
  for (const [key, variants] of Object.entries(TAG_SPEECH)) {
    for (const v of variants) {
      if (new RegExp(`\\b${escapeRegExp(normalizeText(v))}\\b`).test(norm)) {
        const emoji = preset.get(key);
        push(emoji ? emoji + key : key);
        break;
      }
    }
  }
  for (const raw of usedTags || []) {
    const bare = normalizeText(String(raw).replace(/^[^\p{L}\p{N}]+/u, ""));
    if (bare.length >= 3 && new RegExp(`\\b${escapeRegExp(bare)}\\b`).test(norm)) push(raw);
  }
  return found;
}

// Mots-clés courants (FR/EN, sans accents car le texte est normalisé) → id de
// catégorie de dépense. Filet de sécurité quand ni le nom de catégorie ni un
// marchand ne matchent : évite que "lunch"/"loyer" tombent dans "Divers".
// Ordre = priorité (spécifique avant générique).
const KEYWORD_CATEGORIES = [
  { id: "housing", kw: ["loyer", "rent", "edf", "electricite", "electric", "internet", "box", "gaz", "eau", "water", "charges", "copropriete"] },
  { id: "food", kw: ["dejeuner", "lunch", "diner", "dinner", "breakfast", "petit-dejeuner", "brunch", "repas", "restaurant", "resto", "courses", "cafe", "coffee", "groceries", "supermarche", "epicerie", "pizza", "burger", "sushi", "kebab", "tacos", "boulangerie", "snack", "gouter"] },
  { id: "transport", kw: ["taxi", "uber", "essence", "gas", "fuel", "petrol", "train", "bus", "metro", "tram", "parking", "peage", "velo", "trottinette", "sncf", "carburant"] },
  { id: "sport", kw: ["sport", "gym", "fitness", "muscu", "musculation", "yoga", "piscine", "crossfit", "tennis", "foot", "coach"] },
  { id: "health", kw: ["pharmacie", "pharmacy", "medecin", "docteur", "doctor", "dentiste", "dentist", "osteo", "kine", "opticien"] },
  { id: "leisure", kw: ["cinema", "cine", "movie", "film", "bar", "sortie", "concert", "musee", "theatre", "bowling", "expo", "spectacle"] },
  { id: "subscriptions", kw: ["netflix", "spotify", "abonnement", "subscription", "disney", "canal", "prime", "icloud", "youtube", "telephone", "phone", "forfait", "mobile", "sfr", "orange", "bouygues", "free"] },
  { id: "travel", kw: ["hotel", "avion", "flight", "vol", "airbnb", "voyage", "trip", "booking", "sejour"] },
  { id: "beauty", kw: ["coiffeur", "coiffure", "manucure", "spa", "massage", "esthetique", "cosmetique"] },
  { id: "clothing", kw: ["vetement", "vetements", "chaussures", "shoes", "clothes", "zara", "uniqlo"] },
];

function matchKeyword(norm, categories) {
  for (const entry of KEYWORD_CATEGORIES) {
    for (const kw of entry.kw) {
      if (new RegExp(`\\b${escapeRegExp(kw)}\\b`).test(norm)) {
        const c = categories.find((x) => x.id === entry.id);
        if (c) return { categoryId: c.id, subcategory: null };
      }
    }
  }
  return null;
}

// Retire d'une description les EXPRESSIONS déjà comprises par ailleurs.
//
// Le besoin : ce que l'app a su interpréter devient un champ (un tag, un
// membre, une catégorie) et n'a donc plus rien à faire dans la description —
// « resto 20€ #impulsif payé par Nicolas » doit laisser « Resto », pas
// « Resto impulsif payé par Nicolas ».
//
// Le retrait se fait MOT À MOT plutôt que par expression régulière sur le
// texte brut : la description a déjà été nettoyée de ses montants et de ses
// mots de date, donc les positions du texte d'origine n'y correspondent plus.
// On compare des suites de mots normalisés, ce qui reste juste quelle que soit
// la ponctuation ou la casse d'origine.
function stripPhrases(desc, phrases) {
  if (!desc) return desc;
  const words = desc.split(/\s+/).filter(Boolean);
  const norms = words.map((w) => normalizeText(w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")));
  const dropped = new Array(words.length).fill(false);

  // Les expressions longues d'abord : « nous deux » doit être consommé en
  // entier, sinon « nous » seul le couperait en deux et laisserait « deux ».
  const ordered = [...new Set(phrases.filter(Boolean).map((p) => normalizeText(p)))]
    .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);

  for (const phrase of ordered) {
    const parts = phrase.split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    for (let i = 0; i + parts.length <= norms.length; i++) {
      if (dropped[i]) continue;
      let ok = true;
      for (let j = 0; j < parts.length; j++) {
        if (norms[i + j] !== parts[j] || dropped[i + j]) { ok = false; break; }
      }
      if (ok) for (let j = 0; j < parts.length; j++) dropped[i + j] = true;
    }
  }
  return words.filter((_, i) => !dropped[i]).join(" ").replace(/\s+/g, " ").trim();
}

// Détecte « payé par X » et « pour X / pour nous deux » dans le texte.
//
// Renvoie aussi les EXPRESSIONS consommées : c'est le seul moyen de les
// retirer de la description sans deviner après coup ce qui avait été compris.
// Le marqueur en fait partie — retirer « Nicolas » en laissant « payé par »
// serait pire que de ne rien retirer.
function detectMembers(norm, members) {
  const named = (members || [])
    .map((m) => ({ key: getMemberKey(m), name: normalizeText(m?.name || "") }))
    .filter((m) => m.key && m.name.length >= 2)
    // Nom le plus long d'abord : si un couple compte « Ana » et « Anaïs »,
    // chercher « ana » en premier attribuerait les deux à la même personne.
    .sort((a, b) => b.name.length - a.name.length);
  if (!named.length) return { paidBy: null, split: null, consumed: [] };

  const consumed = [];
  let paidBy = null;
  let split = null;

  for (const marker of PAID_BY_MARKERS) {
    if (paidBy) break;
    for (const m of named) {
      const phrase = `${marker} ${m.name}`;
      if (new RegExp(`\\b${escapeRegExp(phrase)}\\b`).test(norm)) {
        paidBy = m.key;
        consumed.push(phrase);
        break;
      }
    }
  }

  for (const marker of FOR_MARKERS) {
    if (split) break;
    // Le partage explicite est testé avant les noms : « pour nous deux » ne
    // désigne personne en particulier.
    // Du plus long au plus court : « nous » figure avant « nous deux » dans la
    // liste, et le tester d'abord laisserait « deux » dans la description.
    for (const w of [...SHARED_WORDS].sort((a, b) => b.length - a.length)) {
      const phrase = `${marker} ${w}`;
      if (new RegExp(`\\b${escapeRegExp(phrase)}\\b`).test(norm)) {
        split = "50/50";
        consumed.push(phrase);
        break;
      }
    }
    if (split) break;
    for (const m of named) {
      const phrase = `${marker} ${m.name}`;
      if (new RegExp(`\\b${escapeRegExp(phrase)}\\b`).test(norm)) {
        split = m.key;
        consumed.push(phrase);
        break;
      }
    }
  }

  return { paidBy, split, consumed };
}

// Variantes de tags réellement présentes dans le texte, pour pouvoir les en
// retirer. `detectTags` renvoie la CLÉ du tag (parfois précédée d'un emoji),
// qui ne ressemble pas forcément au mot prononcé : « coup de tête » donne le
// tag « impulsif », introuvable tel quel dans la phrase.
function consumedTagPhrases(norm, usedTags) {
  const out = [];
  for (const variants of Object.values(TAG_SPEECH)) {
    for (const v of variants) {
      const n = normalizeText(v);
      if (new RegExp(`\\b${escapeRegExp(n)}\\b`).test(norm)) out.push(n);
    }
  }
  for (const raw of usedTags || []) {
    const bare = normalizeText(String(raw).replace(/^[^\p{L}\p{N}]+/u, ""));
    if (bare.length >= 3 && new RegExp(`\\b${escapeRegExp(bare)}\\b`).test(norm)) out.push(bare);
  }
  return out;
}

export function parseNaturalTransaction(text, { categories = [], transactions = [], defaultCurrency = "EUR", usedTags = [], members = [] } = {}) {
  if (!text || !text.trim()) return null;
  const norm = normalizeText(text);

  // Type
  let type = "expense";
  if (INCOME_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(norm))) type = "income";
  else if (INVEST_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(norm))) type = "investment";

  // Montant : premier nombre plausible du texte
  const amountMatch = text.match(/\d[\d\s]*(?:[.,]\d{1,2})?/);
  const amount = amountMatch ? parseAmount(amountMatch[0]) : null;

  const { code: currency, detected: currencyDetected } = detectCurrency(norm, defaultCurrency);
  const date = detectDate(norm).toISOString();

  // Catégorie : nom de catégorie explicite, sinon marchand/synonyme courant
  // (dépenses uniquement), sinon index appris sur la description.
  let cat = matchCategory(norm, categories, type);
  if (!cat && type === "expense") cat = matchSynonym(norm, categories);
  if (!cat && type === "expense") cat = matchKeyword(norm, categories);

  // Description = texte nettoyé (retire montant, symboles devise, mots de date)
  let desc = text
    .replace(/\d[\d\s]*(?:[.,]\d{1,2})?/g, " ")
    .replace(/[€$£¥]/g, " ")
    .replace(/\b(euros?|dollars?|eur|usd|gbp|chf|jpy|vnd|dongs?|thb|bahts?|aud|cad|cny|rmb|renminbi|yuans?|sgd|hkd|inr|roupies?|krw|won|aed|dirhams?|aujourd'?hui|today|avant[\s-]?hier|hier|yesterday|il y a \d+ jours?|\d+ days? ago|le|on|the|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|january|february|march|april|june|july|august|september|october|november|december)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Retrait de ce qui a été compris ailleurs. Deux passes, parce que les deux
  // n'ont pas la même valeur :
  //
  //   1. Tags et membres : toujours retirés. « payé par Nicolas » n'est jamais
  //      une description, et un tag a désormais sa propre pastille.
  //   2. Nom de catégorie : retiré SEULEMENT s'il reste quelque chose. Sur
  //      « 15€ resto hier », « resto » est à la fois la catégorie ET toute la
  //      description ; le supprimer laisserait un champ vide, ce qui est pire
  //      que la redondance qu'on cherche à éviter. Les marchands et mots-clés
  //      (« McDo », « loyer ») ne sont jamais retirés pour la même raison :
  //      c'est précisément ce que l'utilisateur voulait écrire.
  const { paidBy, split, consumed: memberPhrases } = detectMembers(norm, members);
  desc = stripPhrases(desc, [...consumedTagPhrases(norm, usedTags), ...memberPhrases]);
  if (cat?.matched) {
    // Le nom de la catégorie PARENTE aussi : « courses alimentation bio »
    // n'a été reconnu que par « courses », mais « alimentation » y est tout
    // autant redondant une fois la catégorie choisie.
    const parentName = categories.find((c) => c.id === cat.categoryId)?.name;
    const withoutCat = stripPhrases(desc, [cat.matched, parentName && normalizeText(parentName)]);
    if (withoutCat) desc = withoutCat;
  }

  if (!cat && desc) {
    const idx = buildSuggestionIndex(transactions, type);
    const best = getSuggestions(idx, desc, 1)[0] || (idx.get(normalizeText(desc)) ?? null);
    if (best) cat = { categoryId: best.categoryId, subcategory: best.subcategory };
  }

  // Capitalise la description
  if (desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);

  // Repli par NATURE. Un revenu ou un placement dont aucune sous-catégorie n'est
  // reconnue appartient tout de même à sa catégorie : « ETF 250 € » est un
  // investissement même si « ETF » ne figure dans aucune sous-catégorie. Sans ce
  // repli, la catégorie ressortait nulle et l'appelant rangeait le placement
  // dans « Divers » — d'où un ETF affiché en corail sous « Divers & Shopping ».
  // Les dépenses gardent `null` : leur catégorie par défaut appartient à
  // l'appelant, qui a déjà ses propres règles.
  const byNature = { income: "income", investment: "investment" }[type];
  // Vérifié dans `categories` : un couple peut avoir supprimé la catégorie, et
  // inventer un identifiant qui n'existe plus rendrait la ligne inaffichable.
  const fallbackCat = byNature && categories.some((c) => c.id === byNature) ? byNature : null;

  return {
    type,
    amount,
    currency,
    currencyDetected,
    date,
    categoryId: cat?.categoryId || fallbackCat,
    subcategory: cat?.subcategory || null,
    description: desc || null,
    tags: detectTags(norm, usedTags),
    paidBy,
    split,
  };
}
