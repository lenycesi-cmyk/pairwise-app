// Parse une phrase en langage naturel ("15€ resto hier", "reçu 2000 salaire
// lundi") en une transaction pré-remplie. 100% client-side, heuristique et
// instantané — aucun appel réseau, aucune donnée envoyée. Réutilise l'index
// de descriptions apprises pour deviner la catégorie quand aucun mot-clé de
// catégorie n'est reconnu.
import { normalizeText, buildSuggestionIndex, getSuggestions } from "./descriptionSuggestions";

const CURRENCY_HINTS = [
  { code: "EUR", tokens: ["€", "eur", "euro", "euros"] },
  { code: "USD", tokens: ["$", "usd", "dollar", "dollars"] },
  { code: "GBP", tokens: ["£", "gbp", "livre", "livres", "pound", "pounds"] },
  { code: "CHF", tokens: ["chf", "franc", "francs"] },
  { code: "JPY", tokens: ["¥", "jpy", "yen", "yens"] },
];

const INCOME_WORDS = ["recu", "recus", "salaire", "revenu", "revenus", "paie", "paye", "prime", "dividende", "dividendes", "remboursement", "rembourse", "income", "salary", "received", "paycheck", "refund", "bonus"];
const INVEST_WORDS = ["investi", "investissement", "epargne", "epargne", "placement", "pea", "versement", "invest", "invested", "savings"];

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
function detectCurrency(norm, fallback) {
  for (const { code, tokens } of CURRENCY_HINTS) {
    for (const tk of tokens) {
      if (norm.includes(tk)) return code;
    }
  }
  return fallback;
}

function detectDate(norm) {
  const now = new Date();
  const at = (d) => { d.setHours(12, 0, 0, 0); return d; };
  if (/\b(aujourd|today|ce soir|tonight)/.test(norm)) return at(new Date());
  if (/\bavant[\s-]?hier\b/.test(norm)) return at(new Date(now.getTime() - 2 * 86400000));
  if (/\bhier\b|\byesterday\b/.test(norm)) return at(new Date(now.getTime() - 86400000));
  const ago = norm.match(/il y a (\d{1,3}) jours?|(\d{1,3}) days? ago/);
  if (ago) return at(new Date(now.getTime() - (parseInt(ago[1] || ago[2]) || 0) * 86400000));
  // "3 juin" / "june 3" / "le 3 juin"
  const dm = norm.match(/(\d{1,2})\s+([a-z]+)|([a-z]+)\s+(\d{1,2})/);
  if (dm) {
    const day = parseInt(dm[1] || dm[4]);
    const monthWord = dm[2] || dm[3];
    if (monthWord in MONTHS && day >= 1 && day <= 31) {
      let year = now.getFullYear();
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
      if (n.length >= 3 && norm.includes(n)) return { categoryId: c.id, subcategory: sub };
    }
  }
  for (const c of pool) {
    const n = normalizeText(c.name);
    if (n.length >= 3 && norm.includes(n)) return { categoryId: c.id, subcategory: (c.subcategories || [])[0] || null };
  }
  return null;
}

export function parseNaturalTransaction(text, { categories = [], transactions = [], defaultCurrency = "EUR" } = {}) {
  if (!text || !text.trim()) return null;
  const norm = normalizeText(text);

  // Type
  let type = "expense";
  if (INCOME_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(norm))) type = "income";
  else if (INVEST_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(norm))) type = "investment";

  // Montant : premier nombre plausible du texte
  const amountMatch = text.match(/\d[\d\s]*(?:[.,]\d{1,2})?/);
  const amount = amountMatch ? parseAmount(amountMatch[0]) : null;

  const currency = detectCurrency(norm, defaultCurrency);
  const date = detectDate(norm).toISOString();

  // Catégorie : mots-clés explicites, sinon index appris sur la description
  let cat = matchCategory(norm, categories, type);

  // Description = texte nettoyé (retire montant, symboles devise, mots de date)
  let desc = text
    .replace(/\d[\d\s]*(?:[.,]\d{1,2})?/, " ")
    .replace(/[€$£¥]/g, " ")
    .replace(/\b(euros?|dollars?|eur|usd|gbp|chf|jpy|aujourd'?hui|today|avant[\s-]?hier|hier|yesterday|il y a \d+ jours?|\d+ days? ago|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|january|february|march|april|june|july|august|september|october|november|december)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cat && desc) {
    const idx = buildSuggestionIndex(transactions, type);
    const best = getSuggestions(idx, desc, 1)[0] || (idx.get(normalizeText(desc)) ?? null);
    if (best) cat = { categoryId: best.categoryId, subcategory: best.subcategory };
  }

  // Capitalise la description
  if (desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);

  return {
    type,
    amount,
    currency,
    date,
    categoryId: cat?.categoryId || null,
    subcategory: cat?.subcategory || null,
    description: desc || null,
  };
}
