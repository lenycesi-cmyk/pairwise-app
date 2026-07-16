import { useState, useMemo, useEffect, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useReportsPrefs } from "../hooks/useDashboardPrefs";
import CategoryRow from "../components/CategoryRow";
import WidgetCard from "../components/WidgetCard";
import WidgetCanvas from "../components/WidgetCanvas";
import Avatar from "../components/Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { ALL_CURRENCIES } from "../data/categories";
import CurrencyPicker from "../components/CurrencyPicker";
import { useTranslation } from "../hooks/useTranslation";
import SpotlightHint from "../components/SpotlightHint";
import GreetingHeader from "../components/GreetingHeader";
import HeaderMenuButton from "../components/HeaderMenuButton";
import { getMemberKey, memberShareFraction } from "../utils/members";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { tagColor } from "../utils/tags";
import TagChip from "../components/TagChip";
import ScopeFilter from "../components/ScopeFilter";

const PERIOD_TYPES = ["week", "month", "quarter", "year", "last12", "custom"];

// Un mouvement correspond-il au poste sélectionné (catégorie / sous-catégorie /
// tag) du widget « Tendance par poste » ?
function trendMatches(tx, dim, val) {
  if (dim === "category") return tx.categoryId === val;
  if (dim === "subcategory") return tx.subcategory === val;
  return (tx.tags || []).includes(val);
}

// Same k-notation as the dashboard's IncomeExpenseTrendChart, so the
// mobile Reports chart and the desktop widget read identically.
function formatAxisTick(v) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${Math.round(v / 100) / 10}k`;
  return `${v}`;
}

function getRange(periodType, anchor, customRange, locale) {
  const y = anchor.getFullYear();
  const isEn = locale.startsWith("en");
  if (periodType === "week") {
    // Fenêtre de 7 jours se terminant sur l'ancre (incluse).
    const start = new Date(y, anchor.getMonth(), anchor.getDate() - 6);
    const end = new Date(y, anchor.getMonth(), anchor.getDate() + 1);
    return {
      start,
      end,
      label: `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${anchor.toLocaleDateString(locale, { day: "numeric", month: "short" })}`,
    };
  }
  if (periodType === "month") {
    const m = anchor.getMonth();
    return {
      start: new Date(y, m, 1),
      end: new Date(y, m + 1, 1),
      label: anchor.toLocaleDateString(locale, { month: "long", year: "numeric" }),
    };
  }
  if (periodType === "quarter") {
    const q = Math.floor(anchor.getMonth() / 3);
    return {
      start: new Date(y, q * 3, 1),
      end: new Date(y, q * 3 + 3, 1),
      label: `${isEn ? "Q" : "T"}${q + 1} ${y}`,
    };
  }
  if (periodType === "last12") {
    const end = new Date(y, anchor.getMonth() + 1, 1);
    const start = new Date(y, anchor.getMonth() - 11, 1);
    return {
      start,
      end,
      label: `${start.toLocaleDateString(locale, { month: "short", year: "numeric" })} – ${anchor.toLocaleDateString(locale, { month: "short", year: "numeric" })}`,
    };
  }
  if (periodType === "custom") {
    const start = customRange?.start ? new Date(customRange.start) : new Date(y, 0, 1);
    const end = customRange?.end
      ? new Date(new Date(customRange.end).getTime() + 24 * 60 * 60 * 1000)
      : new Date(y + 1, 0, 1);
    return {
      start,
      end,
      label: `${start.toLocaleDateString(locale)} – ${new Date(end.getTime() - 1).toLocaleDateString(locale)}`,
    };
  }
  return {
    start: new Date(y, 0, 1),
    end: new Date(y + 1, 0, 1),
    label: `${y}`,
  };
}

// Énumère tous les buckets (intervalles) d'une plage, dans l'ordre, selon le
// type de période : un par jour en semaine/mois, un par mois sinon. Sert à
// tracer un axe continu qui laisse en blanc les périodes sans donnée (au lieu
// de sauter les buckets vides, ce qui écrasait un trimestre à un seul point).
function enumerateBuckets(range, periodType, locale) {
  const out = [];
  const byDay = periodType === "month" || periodType === "week";
  const cur = new Date(range.start);
  cur.setHours(0, 0, 0, 0);
  if (byDay) {
    while (cur < range.end) {
      out.push({ key: cur.getDate(), label: cur.getDate().toString() });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    cur.setDate(1);
    while (cur < range.end) {
      out.push({ key: `${cur.getFullYear()}-${cur.getMonth()}`, label: cur.toLocaleDateString(locale, { month: "short" }) });
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return out;
}

// Clé de bucket d'une date, cohérente avec enumerateBuckets.
function bucketKeyOf(d, periodType) {
  return periodType === "month" || periodType === "week"
    ? d.getDate()
    : `${d.getFullYear()}-${d.getMonth()}`;
}

// Retire les buckets vides en tête (le graphe commence au plus ancien point
// disposant d'une donnée) ; les trous internes et de fin restent en blanc.
function trimLeadingEmpty(series) {
  const first = series.findIndex((p) => p.value != null);
  return first === -1 ? [] : series.slice(first);
}

// Nombre de périodes précédentes servant de référence (« moyenne N périodes »)
// pour le widget « À surveiller ».
const WATCH_BASELINE_N = 3;

// Renvoie les N plages précédant `range` (même type/longueur de période). Pour
// week/month/quarter/year on décale l'ancre ; pour last12/custom on recule d'un
// multiple de la durée de la plage courante (comme prevRange).
function previousRanges(periodType, anchor, customRange, range, locale, n) {
  const out = [];
  if (periodType === "last12" || periodType === "custom") {
    const span = range.end.getTime() - range.start.getTime();
    for (let i = 1; i <= n; i++) {
      out.push({ start: new Date(range.start.getTime() - span * i), end: new Date(range.end.getTime() - span * i) });
    }
  } else {
    for (let i = 1; i <= n; i++) {
      out.push(getRange(periodType, shiftAnchor(periodType, anchor, -i), customRange, locale));
    }
  }
  return out;
}

function shiftAnchor(periodType, anchor, delta) {
  const d = new Date(anchor);
  if (periodType === "week") d.setDate(d.getDate() + delta * 7);
  else if (periodType === "month") d.setMonth(d.getMonth() + delta);
  else if (periodType === "quarter") d.setMonth(d.getMonth() + delta * 3);
  else d.setFullYear(d.getFullYear() + delta);
  return d;
}

export default function ReportsScreen({ onOpenBreakdown, sharedMonth, onSharedMonthChange, onOpenMenu }) {
  const t = useTranslation();
  const { transactions, categories, members, defaultCurrency, dashboardDisplayCurrency, updateDashboardDisplayCurrency, netWorthHistory, language } = useFinance();
  const locale = language === "en" ? "en-US" : "fr-FR";
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const { convert, loading: ratesLoading } = useExchangeRates(displayCurrency);
  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const periodRowRef = useRef(null);
  const customizeButtonRef = useRef(null);

  const [periodType, setPeriodType] = useState("month");
  // Initialize from the month shared with Home so arriving here keeps whatever
  // was last selected there. Only the "month" period type stays in sync both
  // ways — quarter/year/last12/custom are report-specific and stay local.
  const [anchor, setAnchorRaw] = useState(() =>
    sharedMonth ? new Date(sharedMonth.year, sharedMonth.month, 1) : new Date()
  );
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  // Widget « Tendance par poste » : dimension (catégorie/sous-cat/tag) + poste choisi.
  const [trendDim, setTrendDim] = useState("category");
  const [trendValue, setTrendValue] = useState(null);
  const [showTrendPicker, setShowTrendPicker] = useState(false);
  // Widget « À surveiller » : filtre membre (null = Famille).
  const [watchScope, setWatchScope] = useState(null);
  // Widget « Dépenses par tag » : tags dépliés (transactions du tag sur la période),
  // même comportement que les lignes de « Dépenses par catégorie ».
  const [expandedTags, setExpandedTags] = useState(() => new Set());

  // ── Personnalisation (ordre + afficher/cacher par carte), comme sur Home ──
  // WidgetCanvas gère le glisser-déposer et l'afficher/masquer via saveWidgets.
  const [editMode, setEditMode] = useState(false);
  const { widgets, saveWidgets } = useReportsPrefs();

  function setAnchor(newAnchor) {
    setAnchorRaw(newAnchor);
    if (periodType === "month" && onSharedMonthChange) {
      onSharedMonthChange({ month: newAnchor.getMonth(), year: newAnchor.getFullYear() });
    }
  }

  // Pick up month changes made on Home while this screen wasn't mounted.
  useEffect(() => {
    if (periodType === "month" && sharedMonth) {
      setAnchorRaw((prev) =>
        prev.getMonth() === sharedMonth.month && prev.getFullYear() === sharedMonth.year
          ? prev
          : new Date(sharedMonth.year, sharedMonth.month, 1)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedMonth?.month, sharedMonth?.year]);

  const range = useMemo(
    () => getRange(periodType, anchor, customRange, locale),
    [periodType, anchor, customRange, locale]
  );
  const prevRange = useMemo(() => {
    if (periodType === "last12" || periodType === "custom") {
      const span = range.end.getTime() - range.start.getTime();
      return { start: new Date(range.start.getTime() - span), end: range.start };
    }
    return getRange(periodType, shiftAnchor(periodType, anchor, -1), customRange, locale);
  }, [periodType, anchor, range, customRange, locale]);

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === displayCurrency) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, displayCurrency);
  }

  function inRange(tx, r) {
    const d = new Date(tx.date);
    return d >= r.start && d < r.end;
  }

  const periodTx = useMemo(
    () => transactions.filter((tx) => inRange(tx, range)),
    [transactions, range]
  );
  const prevPeriodTx = useMemo(
    () => transactions.filter((tx) => inRange(tx, prevRange)),
    [transactions, prevRange]
  );

  const totalExpense = useMemo(
    () => periodTx.filter((tx) => tx.type === "expense").reduce((s, tx) => s + toBase(tx), 0),
    [periodTx, displayCurrency, convert]
  );
  const totalIncome = useMemo(
    () => periodTx.filter((tx) => tx.type === "income").reduce((s, tx) => s + toBase(tx), 0),
    [periodTx, displayCurrency, convert]
  );
  const prevTotalExpense = useMemo(
    () => prevPeriodTx.filter((tx) => tx.type === "expense").reduce((s, tx) => s + toBase(tx), 0),
    [prevPeriodTx, displayCurrency, convert]
  );
  const prevTotalIncome = useMemo(
    () => prevPeriodTx.filter((tx) => tx.type === "income").reduce((s, tx) => s + toBase(tx), 0),
    [prevPeriodTx, displayCurrency, convert]
  );
  const expenseDiffPct =
    prevTotalExpense > 0 ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100 : null;
  const incomeDiffPct =
    prevTotalIncome > 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100 : null;

  const netWorthChartData = useMemo(() => {
    // Calé sur le sélecteur de période. Snapshots { date, value, currency }
    // (voir recordNetWorthSnapshot) — reconvertis depuis la devise du snapshot.
    // Le patrimoine net est une valeur instantanée (pas une somme) : on garde
    // le DERNIER snapshot de chaque bucket. On projette ensuite sur tous les
    // buckets de la période (blanc = pas de donnée).
    const valueByKey = new Map();
    const timeByKey = new Map();
    for (const h of netWorthHistory) {
      const d = new Date(h.date);
      if (d < range.start || d >= range.end) continue;
      const key = bucketKeyOf(d, periodType);
      if (!timeByKey.has(key) || d.getTime() > timeByKey.get(key)) {
        timeByKey.set(key, d.getTime());
        valueByKey.set(
          key,
          h.currency && h.currency !== displayCurrency
            ? convert(h.value ?? 0, h.currency, displayCurrency)
            : (h.value ?? 0)
        );
      }
    }
    const series = enumerateBuckets(range, periodType, locale).map((b) => ({
      label: b.label,
      value: valueByKey.has(b.key) ? valueByKey.get(b.key) : null,
    }));
    return trimLeadingEmpty(series);
  }, [netWorthHistory, range, periodType, convert, displayCurrency, locale]);

  const categoryTotals = useMemo(() => {
    const result = {};
    for (const cat of categories) {
      if (cat.id === "income") continue;
      let total = 0;
      const subtotals = {};
      for (const tx of periodTx) {
        if (tx.type === "expense" && tx.categoryId === cat.id) {
          const val = toBase(tx);
          total += val;
          subtotals[tx.subcategory] = (subtotals[tx.subcategory] || 0) + val;
        }
      }
      if (total > 0) result[cat.id] = { category: cat, total, subtotals };
    }
    return result;
  }, [periodTx, categories, displayCurrency, convert]);

  const maxCatTotal = Math.max(1, ...Object.values(categoryTotals).map((c) => c.total));

  // Dépenses par tag sur la période — une transaction peut porter plusieurs
  // tags, son montant est compté pour chacun (les totaux par tag peuvent donc
  // dépasser le total des dépenses, c'est attendu).
  const tagTotals = useMemo(() => {
    const totals = new Map();
    for (const tx of periodTx) {
      if (tx.type !== "expense") continue;
      for (const tag of tx.tags || []) {
        totals.set(tag, (totals.get(tag) || 0) + toBase(tx));
      }
    }
    return [...totals.entries()]
      .map(([tag, total]) => ({ tag, total }))
      .sort((a, b) => b.total - a.total);
  }, [periodTx, displayCurrency, convert]);

  const maxTagTotal = Math.max(1, ...tagTotals.map((t) => t.total));

  // ── Tendance par poste ─────────────────────────────────────────────────
  // Options disponibles pour la dimension courante, triées par dépense décroissante
  // sur la période (le libellé d'une catégorie vient de `categories`, sinon c'est
  // la valeur brute — nom de sous-catégorie ou tag).
  const trendOptions = useMemo(() => {
    const totals = new Map();
    for (const tx of periodTx) {
      if (tx.type !== "expense") continue;
      let keys;
      if (trendDim === "category") keys = [tx.categoryId];
      else if (trendDim === "subcategory") keys = tx.subcategory ? [tx.subcategory] : [];
      else keys = tx.tags || [];
      for (const k of keys) totals.set(k, (totals.get(k) || 0) + toBase(tx));
    }
    const labelOf = (val) =>
      trendDim === "category" ? categories.find((c) => c.id === val)?.name ?? val : val;
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, total]) => ({ value, total, label: labelOf(value) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodTx, trendDim, categories, displayCurrency, convert]);

  // Poste actif : on garde le choix de l'utilisateur tant qu'il existe encore,
  // sinon on retombe sur le plus gros poste de la dimension courante.
  const activeTrendValue =
    trendValue != null && trendOptions.some((o) => o.value === trendValue)
      ? trendValue
      : trendOptions[0]?.value ?? null;

  const trendSeries = useMemo(() => {
    if (activeTrendValue == null) return [];
    const sumByKey = new Map();
    for (const tx of periodTx) {
      if (tx.type !== "expense" || !trendMatches(tx, trendDim, activeTrendValue)) continue;
      const key = bucketKeyOf(new Date(tx.date), periodType);
      sumByKey.set(key, (sumByKey.get(key) || 0) + toBase(tx));
    }
    const series = enumerateBuckets(range, periodType, locale).map((b) => ({
      label: b.label,
      value: sumByKey.has(b.key) ? sumByKey.get(b.key) : null,
    }));
    return trimLeadingEmpty(series);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodTx, trendDim, activeTrendValue, range, periodType, displayCurrency, convert, locale]);

  const trendTotal = useMemo(() => {
    if (activeTrendValue == null) return 0;
    return periodTx
      .filter((tx) => tx.type === "expense" && trendMatches(tx, trendDim, activeTrendValue))
      .reduce((s, tx) => s + toBase(tx), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodTx, trendDim, activeTrendValue, displayCurrency, convert]);

  const trendPrevTotal = useMemo(() => {
    if (activeTrendValue == null) return 0;
    return prevPeriodTx
      .filter((tx) => tx.type === "expense" && trendMatches(tx, trendDim, activeTrendValue))
      .reduce((s, tx) => s + toBase(tx), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevPeriodTx, trendDim, activeTrendValue, displayCurrency, convert]);

  const trendDiffPct =
    trendPrevTotal > 0 ? ((trendTotal - trendPrevTotal) / trendPrevTotal) * 100 : null;

  const evolutionData = useMemo(() => {
    // Somme des dépenses par bucket, projetée sur tous les buckets de la
    // période. Un bucket sans dépense reste à null (blanc) plutôt que 0, pour
    // laisser en blanc les intervalles sans donnée (cf. vue trimestre en début
    // d'historique). Le graphe démarre au plus ancien bucket avec donnée.
    const sumByKey = new Map();
    for (const tx of periodTx) {
      if (tx.type !== "expense") continue;
      const key = bucketKeyOf(new Date(tx.date), periodType);
      sumByKey.set(key, (sumByKey.get(key) || 0) + toBase(tx));
    }
    const series = enumerateBuckets(range, periodType, locale).map((b) => ({
      label: b.label,
      value: sumByKey.has(b.key) ? sumByKey.get(b.key) : null,
    }));
    return trimLeadingEmpty(series);
  }, [periodTx, range, periodType, displayCurrency, convert, locale]);

  const incomeExpenseData = useMemo(() => {
    const buckets = new Map();
    let bucketKey, bucketLabel;
    if (periodType === "month" || periodType === "week") {
      bucketKey = (d) => d.getDate();
      bucketLabel = (d) => d.getDate().toString();
    } else {
      bucketKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;
      bucketLabel = (d) => d.toLocaleDateString(locale, { month: "short" });
    }
    for (const tx of periodTx) {
      if (tx.type !== "expense" && tx.type !== "income") continue;
      const d = new Date(tx.date);
      const key = bucketKey(d);
      const existing = buckets.get(key) || { label: bucketLabel(d), income: 0, expense: 0, sortKey: d.getTime() };
      if (tx.type === "income") existing.income += toBase(tx);
      else existing.expense += toBase(tx);
      buckets.set(key, existing);
    }
    return [...buckets.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [periodTx, periodType, displayCurrency, convert, locale]);

  const memberComparison = useMemo(() => {
    const result = {};
    for (const m of members) result[getMemberKey(m)] = { expense: 0, income: 0 };
    for (const tx of periodTx) {
      const payers =
        tx.split === "50/50"
          ? members.map((m) => ({ uid: getMemberKey(m), share: 0.5 }))
          : [{ uid: tx.paidBy, share: 1 }];
      const val = toBase(tx);
      for (const p of payers) {
        if (!result[p.uid]) continue;
        const amt = val * p.share;
        if (tx.type === "expense") result[p.uid].expense += amt;
        else if (tx.type === "income") result[p.uid].income += amt;
      }
    }
    return result;
  }, [periodTx, members, displayCurrency, convert]);

  function formatAmount(n) {
    return Math.round(n).toLocaleString(locale);
  }

  // Ouvre une catégorie dans le widget « Tendance par poste » (depuis « À
  // surveiller ») et fait défiler jusqu'à lui s'il est visible.
  function openInTrend(cid) {
    setTrendDim("category");
    setTrendValue(cid);
    setShowTrendPicker(false);
    requestAnimationFrame(() => {
      document.getElementById("pw-poste-trend")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const currencySymbol =
    ALL_CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency;

  // ── Insights « À surveiller » ──────────────────────────────────────────
  // Cartes générées automatiquement à partir des dépenses de la période :
  // plus gros poste, plus fortes hausses vs période précédente, nouveau poste,
  // et une baisse (renforcement positif). 4 cartes max, sans doublon de catégorie.
  // Placé après `currencySymbol`/`formatAmount` car il les référence.
  const watchInsights = useMemo(() => {
    // Part « pour qui » du mouvement selon le filtre membre (1 = Famille).
    const wfrac = (tx) => (watchScope === null ? 1 : memberShareFraction(tx, watchScope, members));
    const cur = {};
    let curTotal = 0;
    for (const tx of periodTx) {
      if (tx.type !== "expense") continue;
      const v = toBase(tx) * wfrac(tx);
      if (!v) continue;
      cur[tx.categoryId] = (cur[tx.categoryId] || 0) + v;
      curTotal += v;
    }
    // Référence = moyenne des N périodes précédentes (même type/longueur), plus
    // stable qu'une seule période précédente (un mois atypique fausse moins).
    const baseRanges = previousRanges(periodType, anchor, customRange, range, locale, WATCH_BASELINE_N);
    const prevSum = {};
    for (const tx of transactions) {
      if (tx.type !== "expense") continue;
      const d = new Date(tx.date);
      if (!baseRanges.some((r) => d >= r.start && d < r.end)) continue;
      const v = toBase(tx) * wfrac(tx);
      if (!v) continue;
      prevSum[tx.categoryId] = (prevSum[tx.categoryId] || 0) + v;
    }
    const prev = {};
    for (const cid in prevSum) prev[cid] = prevSum[cid] / WATCH_BASELINE_N;
    const nameOf = (cid) => categories.find((c) => c.id === cid)?.name ?? cid;
    const iconOf = (cid) => categories.find((c) => c.id === cid)?.icon ?? "ti-receipt";

    const curEntries = Object.entries(cur).filter(([, v]) => v > 0);
    if (curEntries.length === 0) return [];

    // Seuil anti-bruit : une variation n'est retenue que si son montant absolu est
    // significatif (évite les « +136 % » sur un poste à quelques euros). ~2 % des
    // dépenses de la période, borné entre 15 et 100 (unités de la devise d'affichage).
    const minDelta = Math.min(100, Math.max(15, curTotal * 0.02));

    const insights = [];
    const used = new Set();
    const pctOf = (cid, v) => ((v - prev[cid]) / prev[cid]) * 100;

    // 1. Plus gros poste.
    const [bigId, bigVal] = [...curEntries].sort((a, b) => b[1] - a[1])[0];
    insights.push({
      key: "biggest", cid: bigId, tone: "neutral", icon: iconOf(bigId), amount: bigVal, delta: null,
      text: t("reports_watch_biggest")
        .replace("{name}", nameOf(bigId))
        .replace("{pct}", (curTotal > 0 ? (bigVal / curTotal) * 100 : 0).toFixed(0)),
    });
    used.add(bigId);

    // 2. Plus fortes hausses vs période précédente (montant en hausse ≥ seuil).
    const increases = curEntries
      .filter(([cid, v]) => (prev[cid] || 0) > 0 && pctOf(cid, v) >= 15 && v - prev[cid] >= minDelta)
      .map(([cid, v]) => ({ cid, v, pct: pctOf(cid, v) }))
      .sort((a, b) => b.pct - a.pct);
    for (const inc of increases) {
      if (insights.length >= 4) break;
      if (used.has(inc.cid)) continue;
      insights.push({
        key: `up-${inc.cid}`, cid: inc.cid, tone: "warn", icon: iconOf(inc.cid), amount: inc.v, delta: inc.v - prev[inc.cid],
        text: t("reports_watch_increase").replace("{name}", nameOf(inc.cid)).replace("{pct}", inc.pct.toFixed(0)),
      });
      used.add(inc.cid);
    }

    // 3. Nouveau poste (dépense cette période ≥ seuil, rien la précédente).
    if (insights.length < 4) {
      const news = curEntries
        .filter(([cid, v]) => !(prev[cid] > 0) && v >= minDelta && !used.has(cid))
        .sort((a, b) => b[1] - a[1]);
      if (news.length) {
        const [nid, nval] = news[0];
        insights.push({
          key: `new-${nid}`, cid: nid, tone: "warn", icon: iconOf(nid), amount: nval, delta: null,
          text: t("reports_watch_new").replace("{name}", nameOf(nid)),
        });
        used.add(nid);
      }
    }

    // 4. Plus forte baisse (renforcement positif, baisse en montant ≥ seuil).
    if (insights.length < 4) {
      const decreases = curEntries
        .filter(([cid, v]) => (prev[cid] || 0) > 0 && pctOf(cid, v) <= -15 && prev[cid] - v >= minDelta && !used.has(cid))
        .map(([cid, v]) => ({ cid, v, pct: pctOf(cid, v) }))
        .sort((a, b) => a.pct - b.pct);
      if (decreases.length) {
        const dec = decreases[0];
        insights.push({
          key: `down-${dec.cid}`, cid: dec.cid, tone: "good", icon: iconOf(dec.cid), amount: dec.v, delta: dec.v - prev[dec.cid],
          text: t("reports_watch_saving").replace("{name}", nameOf(dec.cid)).replace("{pct}", Math.abs(dec.pct).toFixed(0)),
        });
      }
    }

    return insights;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodTx, transactions, categories, watchScope, members, periodType, anchor, customRange, range, locale, displayCurrency, convert, language]);

  // Libellé de période : sur mobile, le mois (type "month") est abrégé à 4
  // lettres s'il dépasse (Juillet → Juil), comme le sélecteur de l'accueil.
  const periodLabel =
    !isDesktop && periodType === "month"
      ? `${(() => {
          const m = anchor.toLocaleDateString(locale, { month: "long" });
          return m.length > 4 ? m.slice(0, 4) : m;
        })()} ${anchor.getFullYear()}`
      : range.label;

  // Navigation de période (‹ libellé ›) — réutilisée dans la ligne 1 du header
  // sur mobile et sous les filtres sur desktop.
  const periodNav = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {periodType !== "last12" && periodType !== "custom" && (
        <button onClick={() => setAnchor(shiftAnchor(periodType, anchor, -1))} aria-label="Période précédente" style={navBtnStyle}>
          <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>
      )}
      <p style={{ fontSize: 15, fontWeight: 500, textTransform: "capitalize", textAlign: "center", whiteSpace: "nowrap" }}>{periodLabel}</p>
      {periodType !== "last12" && periodType !== "custom" && (
        <button onClick={() => setAnchor(shiftAnchor(periodType, anchor, 1))} aria-label="Période suivante" style={navBtnStyle}>
          <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: "var(--ink)",
          color: "var(--bg)",
          padding: "6px 10px",
          borderRadius: "var(--radius-sm)",
          fontSize: 12,
        }}
      >
        {label}: {formatAmount(payload[0].value)} {currencySymbol}
      </div>
    );
  }

  // Titres des cartes (pour le placeholder en mode édition).
  const WIDGET_LABELS = {
    totals: t("reports_totals_title"),
    watch: t("reports_watch_title"),
    net_worth: t("reports_net_worth_evolution"),
    spending_evolution: t("reports_evolution"),
    income_vs_expense: t("reports_income_vs_expense"),
    member_comparison: t("reports_member_comparison"),
    poste_trend: t("reports_poste_trend"),
    by_tag: t("reports_by_tag"),
    by_category: t("reports_by_category"),
  };

  // Rendu d'une carte par id ; retourne null quand il n'y a aucune donnée
  // pertinente (la carte est alors masquée hors mode édition).
  function renderWidgetContent(id) {
    switch (id) {
      case "totals":
        return (
          <WidgetCard icon="ti-scale" accent="coral" title={t("reports_totals_title")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{t("dashboard_income")}</span>
              <span className="pw-num" style={{ fontSize: 19, color: "var(--sage)" }}>{formatAmount(totalIncome)} {currencySymbol}</span>
            </div>
            {incomeDiffPct !== null && (
              <p style={{ fontSize: 11, marginTop: 2, textAlign: "right", color: incomeDiffPct >= 0 ? "var(--sage)" : "var(--tang)" }}>
                {incomeDiffPct >= 0 ? "+" : ""}{incomeDiffPct.toFixed(1)}% <span style={{ color: "var(--ink-3)" }}>{t("reports_vs_previous")}</span>
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--rule)" }}>
              <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{t("dashboard_expenses")}</span>
              <span className="pw-num" style={{ fontSize: 19, color: "var(--tang)" }}>{formatAmount(totalExpense)} {currencySymbol}</span>
            </div>
            {expenseDiffPct !== null && (
              <p style={{ fontSize: 11, marginTop: 2, textAlign: "right", color: expenseDiffPct <= 0 ? "var(--sage)" : "var(--tang)" }}>
                {expenseDiffPct >= 0 ? "+" : ""}{expenseDiffPct.toFixed(1)}% <span style={{ color: "var(--ink-3)" }}>{t("reports_vs_previous")}</span>
              </p>
            )}
          </WidgetCard>
        );
      case "net_worth":
        if (netWorthChartData.length === 0) return null;
        return (
          <WidgetCard icon="ti-diamond" accent="ocean" title={t("reports_net_worth_evolution")}>
            <div style={{ width: "100%", height: 140 }}>
              <ResponsiveContainer>
                <BarChart data={netWorthChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={{ stroke: "var(--rule)" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} tickFormatter={formatAxisTick} width={38} domain={["auto", "auto"]} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div style={{ background: "var(--ink)", color: "var(--bg)", padding: "6px 10px", borderRadius: "var(--radius-sm)", fontSize: 12 }}>
                      {label}: {formatAmount(payload[0].value)} {currencySymbol}
                    </div>
                  ) : null} />
                  <Bar dataKey="value" fill="var(--lavi)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </WidgetCard>
        );
      case "spending_evolution":
        return (
          <WidgetCard icon="ti-trending-down" accent="coral" title={t("reports_evolution")}>
            {evolutionData.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>
                {t("reports_no_expenses")}
              </p>
            ) : (
              <div style={{ width: "100%", height: 140 }}>
                <ResponsiveContainer>
                  <LineChart data={evolutionData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={{ stroke: "var(--rule)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} tickFormatter={formatAxisTick} width={38} domain={[0, "auto"]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke="var(--tang)" strokeWidth={2} dot={{ r: 2, fill: "var(--tang)" }} activeDot={{ r: 4 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </WidgetCard>
        );
      case "income_vs_expense":
        return (
          <WidgetCard icon="ti-chart-bar" accent="ocean" title={t("reports_income_vs_expense")}>
            {incomeExpenseData.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>
                {t("reports_no_expenses")}
              </p>
            ) : (
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={incomeExpenseData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={{ stroke: "var(--rule)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} tickFormatter={formatAxisTick} width={38} />
                    <Tooltip formatter={(value, name) => [`${formatAmount(value)} ${currencySymbol}`, name]} labelStyle={{ color: "var(--ink)" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="income" name={t("dashboard_income")} fill="var(--sage)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expense" name={t("dashboard_expenses")} fill="var(--tang)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </WidgetCard>
        );
      case "member_comparison":
        if (members.length === 0) return null;
        return (
          <WidgetCard
            icon="ti-users"
            accent="ocean"
            title={t("reports_member_comparison")}
            action={!editMode && onOpenBreakdown && (
              <button
                onClick={onOpenBreakdown}
                style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}
              >
                {t("dashboard_detail")} <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
            )}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              {members.map((m) => {
                const mt = memberComparison[getMemberKey(m)] || { expense: 0, income: 0 };
                return (
                  <div key={getMemberKey(m)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                      <Avatar member={m} colorMap={memberColorMap} size={30} />
                      <p style={{ fontSize: 15, fontWeight: 600 }}>{m.name}</p>
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 2 }}>{t("dashboard_expenses")}</p>
                    <p className="pw-num" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--tang)" }}>
                      {formatAmount(mt.expense)} {currencySymbol}
                    </p>
                  </div>
                );
              })}
            </div>
          </WidgetCard>
        );
      case "watch": {
        const toneColor = { neutral: "var(--lavi)", warn: "var(--tang)", good: "var(--sage)" };
        const toneBg = { neutral: "var(--lavi-light)", warn: "var(--tang-light)", good: "var(--sage-light)" };
        return (
          <WidgetCard icon="ti-eye" accent="amber" title={t("reports_watch_title")}>
            {members.length > 1 && (
              <ScopeFilter members={members} scope={watchScope} onChange={setWatchScope} style={{ marginBottom: 6 }} />
            )}
            {watchInsights.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.25rem 0" }}>
                {t("reports_no_expenses")}
              </p>
            ) : (
              watchInsights.map((ins, i) => (
                <div
                  key={ins.key}
                  onClick={() => openInTrend(ins.cid)}
                  role="button"
                  style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: i === watchInsights.length - 1 ? "none" : "0.5px solid var(--rule)", cursor: "pointer" }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: toneBg[ins.tone], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className={`ti ${ins.icon}`} style={{ fontSize: 15, color: toneColor[ins.tone] }} aria-hidden="true" />
                  </span>
                  <p style={{ fontSize: 12.5, lineHeight: 1.4, color: "var(--ink-2)", flex: 1, minWidth: 0 }}>{ins.text}</p>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p className="pw-num" style={{ fontSize: 13, fontWeight: 700 }}>{formatAmount(ins.amount)} {currencySymbol}</p>
                    {ins.delta != null && (
                      <p style={{ fontSize: 10.5, fontWeight: 600, color: toneColor[ins.tone] }}>
                        {ins.delta >= 0 ? "+" : "−"}{formatAmount(Math.abs(ins.delta))} {currencySymbol}
                      </p>
                    )}
                  </div>
                  <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--ink-3)", flexShrink: 0 }} aria-hidden="true" />
                </div>
              ))
            )}
          </WidgetCard>
        );
      }
      case "poste_trend": {
        const dims = ["category", "subcategory", "tag"];
        return (
          <WidgetCard id="pw-poste-trend" icon="ti-chart-dots" accent="ocean" title={t("reports_poste_trend")}>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {dims.map((d) => {
                const active = trendDim === d;
                return (
                  <button
                    key={d}
                    onClick={() => { setTrendDim(d); setTrendValue(null); setShowTrendPicker(false); }}
                    style={{
                      flex: 1, padding: "6px 4px", borderRadius: 99, border: "none",
                      background: active ? "var(--lavi-light)" : "color-mix(in srgb, var(--ink) 5%, transparent)",
                      color: active ? "var(--lavi)" : "var(--ink-3)",
                      fontSize: 12, fontWeight: active ? 600 : 400,
                    }}
                  >
                    {t(`reports_trend_dim_${d}`)}
                  </button>
                );
              })}
            </div>
            {trendOptions.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.25rem 0" }}>
                {t("reports_trend_no_data")}
              </p>
            ) : (
              <>
                {(() => {
                  // Même UI que le sélecteur de catégorie de la modale Transaction :
                  // un champ « trigger » teinté + une grille 2 colonnes dépliable.
                  const active = trendOptions.find((o) => o.value === activeTrendValue);
                  const iconFor = (val) =>
                    trendDim === "category"
                      ? categories.find((c) => c.id === val)?.icon || "ti-category"
                      : trendDim === "tag"
                        ? "ti-hash"
                        : "ti-list";
                  return (
                    <>
                      <div
                        onClick={() => setShowTrendPicker((v) => !v)}
                        style={{
                          display: "flex", alignItems: "center", gap: 9, height: 44, padding: "0 13px",
                          borderRadius: "var(--radius-md)", cursor: "pointer", marginBottom: 8,
                          background: "color-mix(in srgb, var(--lavi) 12%, transparent)",
                          border: "0.5px solid var(--lavi)",
                        }}
                      >
                        <i className={`ti ${iconFor(activeTrendValue)}`} style={{ fontSize: 17, color: "var(--lavi)", flexShrink: 0 }} aria-hidden="true" />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--lavi)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {active?.label ?? t("reports_trend_pick")}
                        </span>
                        <i className={`ti ti-chevron-${showTrendPicker ? "up" : "down"}`} style={{ fontSize: 16, color: "var(--lavi)", flexShrink: 0 }} aria-hidden="true" />
                      </div>
                      {showTrendPicker && (
                        <div style={{ marginBottom: 10, border: "0.5px solid var(--rule)", borderRadius: "var(--radius-md)", padding: 6, background: "var(--bg-card)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, maxHeight: 240, overflowY: "auto" }}>
                            {trendOptions.map((o) => {
                              const sel = o.value === activeTrendValue;
                              return (
                                <div
                                  key={o.value}
                                  onClick={() => { setTrendValue(o.value); setShowTrendPicker(false); }}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 9, height: 40, padding: "0 11px", cursor: "pointer",
                                    borderRadius: 8, minWidth: 0,
                                    background: sel ? "color-mix(in srgb, var(--lavi) 12%, transparent)" : "transparent",
                                  }}
                                >
                                  <i className={`ti ${iconFor(o.value)}`} style={{ fontSize: 15, flexShrink: 0, color: sel ? "var(--lavi)" : "var(--ink-3)" }} aria-hidden="true" />
                                  <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: sel ? "var(--lavi)" : "var(--ink-2)", fontWeight: sel ? 600 : 400 }}>
                                    {o.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                  <span className="pw-num" style={{ fontSize: 19, fontWeight: 700 }}>
                    {formatAmount(trendTotal)} {currencySymbol}
                  </span>
                  {trendDiffPct !== null && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: trendDiffPct <= 0 ? "var(--sage)" : "var(--tang)", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                      <i className={`ti ti-arrow-${trendDiffPct >= 0 ? "up-right" : "down-right"}`} style={{ fontSize: 13 }} aria-hidden="true" />
                      {trendDiffPct >= 0 ? "+" : ""}{trendDiffPct.toFixed(0)}%
                      <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>{t("reports_vs_previous")}</span>
                    </span>
                  )}
                </div>
                {trendSeries.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>
                    {t("reports_no_expenses")}
                  </p>
                ) : (
                  <div style={{ width: "100%", height: 140 }}>
                    <ResponsiveContainer>
                      <LineChart data={trendSeries} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={{ stroke: "var(--rule)" }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} tickFormatter={formatAxisTick} width={38} domain={[0, "auto"]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="value" stroke="var(--lavi)" strokeWidth={2} dot={{ r: 2, fill: "var(--lavi)" }} activeDot={{ r: 4 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </WidgetCard>
        );
      }
      case "by_tag": {
        if (tagTotals.length === 0) return null;
        const toggleTag = (tag) =>
          setExpandedTags((prev) => {
            const next = new Set(prev);
            if (next.has(tag)) next.delete(tag);
            else next.add(tag);
            return next;
          });
        return (
          <WidgetCard icon="ti-tags" accent="pink" title={t("reports_by_tag")}>
            {tagTotals.map(({ tag, total }) => {
              const color = tagColor(tag);
              const expanded = expandedTags.has(tag);
              const barPct = Math.round((total / maxTagTotal) * 100);
              const sharePct = totalExpense > 0 ? (total / totalExpense) * 100 : 0;
              const tagTx = expanded
                ? periodTx
                    .filter((tx) => tx.type === "expense" && (tx.tags || []).includes(tag))
                    .sort((a, b) => toBase(b) - toBase(a))
                : [];
              return (
                <div key={tag} style={{ borderBottom: "0.5px solid var(--rule)" }}>
                  <div
                    onClick={() => toggleTag(tag)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", cursor: "pointer" }}
                  >
                    <TagChip tag={tag} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }} />
                    <div style={{ width: 50, height: 5, background: "var(--rule)", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                      <div style={{ width: `${barPct}%`, height: 5, background: `var(--${color})`, transition: "width 0.3s ease" }} />
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 78 }}>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{formatAmount(total)} {currencySymbol}</p>
                      <p style={{ fontSize: 10, color: "var(--ink-3)" }}>{sharePct.toFixed(1)}%</p>
                    </div>
                    <i
                      className="ti ti-chevron-right"
                      style={{ fontSize: 14, color: "var(--ink-3)", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}
                      aria-hidden="true"
                    />
                  </div>
                  {expanded && (
                    <div style={{ padding: "0 0 10px 28px" }}>
                      {tagTx.map((tx) => {
                        const cat = categories.find((c) => c.id === tx.categoryId);
                        return (
                          <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                            <i className={`ti ${cat?.icon || "ti-receipt"}`} style={{ fontSize: 13, color: "var(--ink-3)", flexShrink: 0 }} aria-hidden="true" />
                            <span style={{ fontSize: 12, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink-2)" }}>
                              {tx.description || cat?.name}
                            </span>
                            <span style={{ fontSize: 10.5, color: "var(--ink-3)", flexShrink: 0 }}>{new Date(tx.date).toLocaleDateString(locale)}</span>
                            <span className="pw-num" style={{ fontSize: 12, fontWeight: 500, flexShrink: 0 }}>{formatAmount(toBase(tx))} {currencySymbol}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </WidgetCard>
        );
      }
      case "by_category":
        return (
          <WidgetCard icon="ti-chart-pie" accent="coral" title={t("reports_by_category")}>
            {Object.keys(categoryTotals).length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.5rem 0" }}>
                {t("reports_no_expenses")}
              </p>
            ) : (
              Object.values(categoryTotals)
                .sort((a, b) => b.total - a.total)
                .map(({ category, total, subtotals }) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    total={total}
                    maxTotal={maxCatTotal}
                    subtotals={subtotals}
                    formatAmount={formatAmount}
                    totalExpenses={totalExpense}
                    currencySymbol={currencySymbol}
                  />
                ))
            )}
          </WidgetCard>
        );
      default:
        return null;
    }
  }

  if (ratesLoading) {
    return (
      <div style={{ padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      {/* En-tête collant : titre + filtres temporels, alignés à gauche. */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", marginLeft: "-1.25rem", marginRight: "-1.25rem", padding: "0.5rem 1.25rem 0.6rem", marginBottom: 12 }}>
        {(() => {
          const actions = (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {editMode ? (
                <button
                  onClick={() => setEditMode(false)}
                  style={{
                    background: "var(--ink)", color: "var(--bg)", border: "none",
                    borderRadius: "var(--radius-md)", padding: "5px 14px", fontSize: 13, fontWeight: 500,
                  }}
                >
                  {t("dashboard_done")}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                    style={{
                      height: 30, padding: "0 10px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)",
                      background: "var(--bg-card)", fontSize: 12, fontWeight: 500,
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    {currencySymbol} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
                  </button>
                  <button
                    ref={customizeButtonRef}
                    onClick={() => { setEditMode(true); setShowCurrencyPicker(false); }}
                    aria-label={t("dashboard_customize")}
                    style={{
                      width: 30, height: 30, borderRadius: "50%", background: "var(--bg-card)",
                      border: "0.5px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <i className="ti ti-pencil" style={{ fontSize: 14 }} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          );
          const greeting = <GreetingHeader subtitleKey="reports_subtitle" marginLeft={0} />;
          if (isDesktop) {
            return (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                {greeting}
                {actions}
              </div>
            );
          }
          return (
            <>
              {/* Ligne 1 : [Réglages | nav période centrée | devise/personnaliser],
                  colonnes latérales égales (1fr) pour centrer la période, comme l'accueil. */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ justifySelf: "start" }}><HeaderMenuButton onClick={onOpenMenu} /></div>
                {editMode ? <span /> : periodNav}
                <div style={{ justifySelf: "end" }}>{actions}</div>
              </div>
              {greeting}
            </>
          );
        })()}
        <div ref={periodRowRef} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {PERIOD_TYPES.map((p) => (
          <button
            key={p}
            onClick={() => { setPeriodType(p); if (p === "week") setAnchorRaw(new Date()); }}
            style={{
              padding: "6px 12px",
              borderRadius: 99,
              border: periodType === p ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
              background: periodType === p ? "var(--sky-light)" : "var(--bg-card)",
              color: periodType === p ? "var(--sky)" : "var(--ink)",
              fontSize: 12,
              fontWeight: periodType === p ? 500 : 400,
            }}
          >
            {t(`reports_period_${p}`)}
          </button>
        ))}
        </div>
      </div>

      {!editMode && <SpotlightHint tabKey="reports" targetRef={periodRowRef} text={t("hint_reports")} />}

      {editMode && (
        <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, marginBottom: 12, textAlign: "center" }}>
          {t("dashboard_edit_hint")}
        </p>
      )}

      {showCurrencyPicker && !editMode && (
        <div style={{ marginBottom: 16, background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem" }}>
          <CurrencyPicker
            value={displayCurrency}
            onSelect={(code) => { updateDashboardDisplayCurrency(code); setShowCurrencyPicker(false); }}
          />
        </div>
      )}

      {periodType === "custom" && !editMode && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="date"
            value={customRange.start}
            onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
            style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", background: "var(--bg-card)", fontSize: 13, color: "var(--ink)" }}
          />
          <input
            type="date"
            value={customRange.end}
            onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
            style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", background: "var(--bg-card)", fontSize: 13, color: "var(--ink)" }}
          />
        </div>
      )}

      {/* Navigation de période — sur desktop uniquement (sur mobile elle est
          remontée dans la ligne 1 du header). */}
      {isDesktop && <div style={{ marginBottom: 16 }}>{periodNav}</div>}

      {/* Cartes — même moteur que l'Accueil/Flux/Patrimoine : grille bento
          personnalisable sur desktop, empilement 1 colonne sur mobile. */}
      <WidgetCanvas
        widgets={widgets}
        onSave={saveWidgets}
        editMode={editMode}
        onEnterEditMode={() => setEditMode(true)}
        renderContent={renderWidgetContent}
        labels={WIDGET_LABELS}
        isDesktop={isDesktop}
        bento
      />
    </div>
  );
}

const navBtnStyle = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "var(--bg-card)",
  border: "0.5px solid var(--rule)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
