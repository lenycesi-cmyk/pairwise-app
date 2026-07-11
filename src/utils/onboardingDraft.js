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
export function draftEntryView(entry, language, t) {
  const meta = catMeta(entry.categoryId, language);
  const income = entry.type === "income";
  return {
    ...entry,
    catName: entry.description || entry.subcategory || meta.name,
    icon: income ? "ti-cash" : meta.icon,
    color: income ? "--sage" : meta.color,
    dateLabel: isYesterday(entry.date) ? t("yest") : t("tod"),
    amountColor: income ? "var(--sage)" : "var(--tang)",
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

// Insight + répartition dérivés du brouillon (revenus exclus de la répartition).
export function deriveInsight(draft, language, t) {
  const cur = dominantCurrency(draft);
  let income = 0;
  let expense = 0;
  const byCat = new Map();
  for (const e of draft) {
    if (e.type === "income") {
      income += e.amount;
    } else {
      expense += e.amount;
      byCat.set(e.categoryId, (byCat.get(e.categoryId) || 0) + e.amount);
    }
  }
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
        pct: expense > 0 ? Math.round((amount / expense) * 100) : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const balance = income - expense;
  const topCat = breakdown[0]?.name || "";
  const fMoney = (v) => formatMoney(v, cur, language);
  let insight;
  const hasIncome = income > 0;
  const hasExpense = expense > 0;
  if (hasIncome && hasExpense) {
    insight = t(balance >= 0 ? "balance_pos" : "balance_neg", {
      bal: fMoney(Math.abs(balance)),
      exp: fMoney(expense),
      mostly: t("mostly"),
      cat: topCat,
    });
  } else if (hasIncome) {
    insight = t("income_only", { inc: fMoney(income) });
  } else {
    insight = t("expense_only", { exp: fMoney(expense), cat: topCat });
  }

  return {
    currency: cur,
    income,
    expense,
    balance,
    hasIncome,
    incomeDisp: fMoney(income),
    expenseDisp: fMoney(expense),
    breakdown,
    insight,
  };
}
