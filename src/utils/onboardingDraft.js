// Brouillon d'onboarding "valeur d'abord" : les 2–3 premières dépenses/revenus
// saisies AVANT toute inscription vivent en localStorage, puis sont migrées
// vers Firestore au moment du sign-up (voir OnboardingFlowPostCouple).
// Aucune donnée ne quitte l'appareil tant que le compte n'existe pas.
import { parseNaturalTransaction } from "./parseNaturalTransaction";
import {
  ALL_CATEGORIES,
  ALL_CURRENCIES,
  getCategoryName,
} from "../data/categories";

const DRAFT_KEY = "pw_onb_draft";
const META_KEY = "pw_onb_meta"; // { accountType, shareMode, partnerName }
const LANG_KEY = "pw_onb_lang";

// ── Persistance ──────────────────────────────────────────────────────────
export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export function saveDraft(entries) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(entries));
  } catch {
    /* quota — non bloquant */
  }
}
export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ ...loadMeta(), ...meta }));
  } catch {
    /* ignore */
  }
}
export function clearMeta() {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
}

export function loadOnbLang() {
  try {
    return localStorage.getItem(LANG_KEY) || null;
  } catch {
    return null;
  }
}
export function saveOnbLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}

// ── Parsing d'une saisie en une entrée de brouillon ──────────────────────
// Réutilise le parser langage naturel de l'app avec le jeu de catégories par
// défaut (pas encore de couple, donc pas de catégories personnalisées).
export function parseDraftEntry(text, language, defaultCurrency = "EUR") {
  const parsed = parseNaturalTransaction(text, {
    categories: ALL_CATEGORIES,
    transactions: [],
    defaultCurrency,
  });
  if (!parsed || parsed.amount == null) return null;
  return {
    id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency || defaultCurrency,
    categoryId: parsed.categoryId || "misc",
    subcategory: parsed.subcategory || null,
    description: parsed.description || null,
    date: parsed.date,
    tags: parsed.tags || [],
  };
}

// Devise par défaut déduite de la locale (repli EUR).
export function guessDefaultCurrency() {
  try {
    const loc = (navigator.language || "").toLowerCase();
    if (loc.includes("us")) return "USD";
    if (loc.includes("gb")) return "GBP";
    if (loc.includes("ch")) return "CHF";
    if (loc.includes("jp")) return "JPY";
    if (loc.includes("vn")) return "VND";
    if (loc.includes("th")) return "THB";
  } catch {
    /* ignore */
  }
  return "EUR";
}

// ── Dérivés d'affichage (insight, répartition) ───────────────────────────
export function currencySymbol(code) {
  return ALL_CURRENCIES.find((c) => c.code === code)?.symbol || code;
}

// Format monétaire léger, cohérent avec le ton de la maquette. On ne convertit
// pas les devises ici (pas de FX avant le compte) : on additionne numériquement
// et on affiche avec le symbole de la devise dominante du brouillon.
export function formatMoney(amount, code, language) {
  const sym = currencySymbol(code);
  const n = Math.round(amount * 100) / 100;
  const str = n.toLocaleString(language === "en" ? "en-US" : "fr-FR", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const symBefore = ["$", "£", "¥", "₫", "₹", "₩", "฿"].includes(sym);
  return symBefore ? `${sym}${str}` : `${str} ${sym}`;
}

function catMeta(categoryId, language) {
  const cat = ALL_CATEGORIES.find((c) => c.id === categoryId) || null;
  return {
    name: cat ? getCategoryName(cat, language) : categoryId,
    icon: cat?.icon || "ti-shopping-bag",
    color: cat ? `--${cat.color}` : "--amber",
  };
}

// Métadonnées d'affichage d'une ligne de brouillon (icône, couleur, libellé,
// date lisible, montant signé/coloré).
// Teinte d'une NATURE d'écriture — sage ce qui entre, lavande ce qui est placé,
// corail ce qui sort. C'est le même code couleur que les pastilles de
// suggestion : un exemple cliqué en lavande doit produire un aperçu lavande,
// sinon l'écran se contredit au premier geste.
export function kindColorOf(type) {
  if (type === "income") return "--sage";
  if (type === "investment") return "--lavi";
  return "--tang";
}

export function draftEntryView(entry, language, t) {
  const meta = catMeta(entry.categoryId, language);
  const income = entry.type === "income";
  const kindColor = kindColorOf(entry.type);
  return {
    ...entry,
    catName: entry.description || entry.subcategory || meta.name,
    icon: income ? "ti-cash" : meta.icon,
    // La pastille de catégorie garde la couleur de SA catégorie (lavande pour
    // Investissements, puisque c'est la sienne) ; seul le montant porte la
    // couleur de la nature.
    color: income ? "--sage" : meta.color,
    kindColor,
    dateLabel: isYesterday(entry.date) ? t("yest") : t("tod"),
    amountColor: `var(${kindColor})`,
    amountDisp:
      (income ? "+" : "") + formatMoney(entry.amount, entry.currency, language),
  };
}

function isYesterday(iso) {
  try {
    const d = new Date(iso);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return d.toDateString() === y.toDateString();
  } catch {
    return false;
  }
}

// Devise dominante du brouillon (la plus fréquente) pour les totaux affichés.
function dominantCurrency(draft) {
  const counts = {};
  for (const e of draft) counts[e.currency] = (counts[e.currency] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "EUR";
}

// Insight + répartition dérivés du brouillon.
//
// Trois natures, trois traitements distincts :
//  · les REVENUS n'entrent pas dans la répartition — ce n'est pas une sortie ;
//  · les PLACEMENTS y entrent, au même titre que les dépenses : ils quittent bel
//    et bien le compte courant, et le solde les soustrait ;
//  · seules les DÉPENSES nourrissent le « surtout en {cat} » de la phrase. Le
//    poste le plus lourd de la répartition peut être un placement, mais dire
//    « 60 € dépensés, surtout en Investissements » n'aurait aucun sens.
export function deriveInsight(draft, language, t) {
  const cur = dominantCurrency(draft);
  let income = 0;
  let expense = 0;
  let invested = 0;
  const byCat = new Map();
  for (const e of draft) {
    if (e.type === "income") {
      income += e.amount;
      continue;
    }
    if (e.type === "investment") invested += e.amount;
    else expense += e.amount;
    byCat.set(e.categoryId, (byCat.get(e.categoryId) || 0) + e.amount);
  }
  // Les pourcentages se rapportent à tout ce qui est sorti, placements compris —
  // sinon les barres dépasseraient 100 % dès le premier investissement.
  const outflow = expense + invested;
  const breakdown = [...byCat.entries()]
    .map(([categoryId, amount]) => {
      const meta = catMeta(categoryId, language);
      return {
        categoryId,
        name: meta.name,
        icon: meta.icon,
        color: meta.color,
        amount,
        amountFmt: formatMoney(amount, cur, language),
        pct: outflow > 0 ? Math.round((amount / outflow) * 100) : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const balance = income - expense - invested;
  const fMoney = (v) => formatMoney(v, cur, language);
  const hasIncome = income > 0;
  const hasExpense = expense > 0;
  const hasInvested = invested > 0;
  // Trié par montant : le premier poste non-placement EST le premier poste de
  // dépense.
  const topCat =
    breakdown.find((c) => c.categoryId !== "investment" && c.categoryId !== "savings")?.name || "";

  let insight;
  if (hasIncome && !hasExpense && !hasInvested) {
    insight = t("income_only", { inc: fMoney(income) });
  } else if (hasExpense && !hasIncome && !hasInvested) {
    insight = t("expense_only", { exp: fMoney(expense), cat: topCat });
  } else if (hasInvested && !hasIncome && !hasExpense) {
    insight = t("invest_only", { inv: fMoney(invested) });
  } else {
    const parts = [];
    if (hasIncome) {
      parts.push(t(balance >= 0 ? "ins_balance_pos" : "ins_balance_neg", { bal: fMoney(Math.abs(balance)) }));
    }
    if (hasInvested) {
      parts.push(t(hasIncome ? "ins_invested" : "ins_invested_week", { inv: fMoney(invested) }));
    }
    if (hasExpense) {
      parts.push(
        topCat
          ? t("ins_spent", { exp: fMoney(expense), mostly: t("mostly"), cat: topCat })
          : t("ins_spent_nocat", { exp: fMoney(expense) })
      );
    }
    insight = `${parts.join(" — ")}.`;
  }

  // Une tuile par nature RÉELLEMENT présente : afficher « Dépenses 0 € » ne dit
  // rien. La rangée ne s'affiche qu'à partir de deux, une tuile seule ne faisant
  // que répéter la phrase juste au-dessus.
  const tiles = [
    hasIncome && { key: "income", label: t("revLabel"), value: fMoney(income), color: "var(--sage)" },
    hasInvested && { key: "invested", label: t("invLabel"), value: fMoney(invested), color: "var(--lavi)" },
    hasExpense && { key: "expense", label: t("expLabel"), value: fMoney(expense), color: "var(--tang)" },
  ].filter(Boolean);

  return {
    currency: cur,
    income,
    expense,
    invested,
    balance,
    hasIncome,
    hasInvested,
    incomeDisp: fMoney(income),
    expenseDisp: fMoney(expense),
    investedDisp: fMoney(invested),
    tiles,
    breakdown,
    insight,
  };
}
