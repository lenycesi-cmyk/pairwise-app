import { useState, useMemo, useRef, useEffect, lazy, Suspense, Fragment } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useDebtCalculation } from "../hooks/useDebtCalculation";
import { useBudgetProgress } from "../hooks/useBudgetProgress";
import BudgetCard from "../components/BudgetCard";
import ScopeFilter from "../components/ScopeFilter";
import PeriodSelector from "../components/PeriodSelector";
import CommentBubble from "../components/CommentBubble";
import AnimatedNumber from "../components/AnimatedNumber";
import CommentsModal from "../components/CommentsModal";
import TransactionComments from "../components/TransactionComments";
import { getRange } from "../utils/periodRange";
import { useInsights } from "../hooks/useInsights";
import { useDashboardPrefs, useBudgetHiddenIds } from "../hooks/useDashboardPrefs";
import { useNetWorth } from "../hooks/useNetWorth";
import CategoryRow from "../components/CategoryRow";
import WidgetCard from "../components/WidgetCard";
import Avatar from "../components/Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { ALL_CURRENCIES } from "../data/categories";
import CurrencyPicker from "../components/CurrencyPicker";
import { useTranslation } from "../hooks/useTranslation";
import SpotlightHint from "../components/SpotlightHint";
import GreetingHeader from "../components/GreetingHeader";
import { getMemberKey } from "../utils/members";
import { nextOccurrence, daysUntil } from "../utils/recurrence";
import { useSubscriptionSuggestion } from "../hooks/useSubscriptionSuggestion";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { slotSpan12, BENTO_MAX_HEIGHT } from "../utils/bentoLayout";

// Grille bento desktop (12 colonnes, taille selon la position) — factorisée dans
// utils/bentoLayout pour être partagée avec les autres onglets (Patrimoine…).

// Palette cyclique des pastilles de compte (Liquidités) — comme la maquette 1B,
// chaque banque a une couleur distincte plutôt qu'un vert uniforme.
const BANK_DOT_COLORS = ["var(--sage)", "var(--sky)", "var(--lavi)", "var(--amber)", "var(--mint)", "var(--blush)"];

// Sens (tonalité insight) → couleur sémantique de la refonte.
const INSIGHT_TONE_COLOR = {
  positive: "var(--good)",
  celebrate: "var(--good)",
  warning: "var(--warn)",
  neutral: "var(--sky)",
};

// Recharts-backed widgets are deliberately kept out of the eager bundle
// (Dashboard itself loads eagerly — see CLAUDE.md/vite.config.js manualChunks)
// and lazy-loaded here. They now render on mobile too (same widgets as desktop),
// but stay lazy so the recharts chunk only loads once such a widget is shown.
const AllocationChart = lazy(() => import("../components/AllocationChart"));
const IncomeExpenseTrendChart = lazy(() => import("../components/IncomeExpenseTrendChart"));
const HealthScoreWidget = lazy(() => import("../components/HealthScoreWidget"));

const LONG_PRESS_DELAY = 500;

// ── Sortable widget wrapper ──────────────────────────────────────────────────
function SortableWidget({ id, editMode, onLongPress, outerStyle, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editMode });

  const longPressTimer = useRef(null);

  function startLongPress() {
    if (editMode) return;
    longPressTimer.current = setTimeout(() => onLongPress?.(), LONG_PRESS_DELAY);
  }
  function cancelLongPress() {
    clearTimeout(longPressTimer.current);
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        ...outerStyle,
      }}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      {editMode && (
        <div
          style={{
            position: "absolute", inset: 0,
            border: "1.5px dashed var(--sky)",
            borderRadius: "var(--radius-lg)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          aria-label="Réorganiser"
          style={{
            position: "absolute", top: 8, left: 8,
            zIndex: 3, background: "var(--bg-card)", border: "0.5px solid var(--rule)",
            borderRadius: "var(--radius-sm)", width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "grab", touchAction: "none",
          }}
        >
          <i className="ti ti-grip-vertical" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </button>
      )}
      {children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function DashboardScreen({ onOpenDebt, onOpenBreakdown, onOpenTransactions, onEditTransaction, sharedMonth, onSharedMonthChange, addButtonRef, settingsButtonRef, onOpenMenu, onOpenRecurring, onOpenBudget }) {
  const t = useTranslation();
  const {
    transactions, categories, members, assets, recurringTx, coupleName, debtSettlements,
    defaultCurrency, dashboardDisplayCurrency, updateDashboardDisplayCurrency, loading, language, financeMode,
    updateBudget,
  } = useFinance();
  // Noms de mois localisés selon la langue des réglages (l'ancien tableau
  // MONTHS était figé en français).
  const locale = language === "en" ? "en-US" : "fr-FR";
  const monthName = (m) => {
    const s = new Date(2000, m, 1).toLocaleDateString(locale, { month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const { convert, loading: ratesLoading, error: ratesError } = useExchangeRates(displayCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [commentsTx, setCommentsTx] = useState(null);
  // Filtre du widget Liquidités : null = couple ; sinon memberKey (comptes de ce
  // membre + comptes partagés).
  const [liquidScope, setLiquidScope] = useState(null);
  // Filtre membre du widget « Répartition du patrimoine » (part de propriété).
  const [allocationScope, setAllocationScope] = useState(null);
  const customizeButtonRef = useRef(null);
  const currencyButtonRef = useRef(null);
  const [trendPeriod, setTrendPeriod] = useState(6);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const summaryLabel = coupleName
    ? `${coupleName} ${t("widget_summary_word")}`
    : t("widget_couple_summary_default");

  const { widgets, saveWidgets } = useDashboardPrefs();
  const [localWidgets, setLocalWidgets] = useState(null);
  const activeWidgets = localWidgets ?? widgets;

  // Grille bento desktop (édition comprise, pour que le drag & drop reflète les
  // vrais emplacements) : vraie grille à 15 colonnes où la largeur de chaque
  // widget découle de sa position (slotSize). Rangées nettes et alignées
  // (align-items: stretch + .pw-card height:100%), pas de masonry.
  const bentoEnabled = isDesktop;

  const debt = useDebtCalculation(transactions, members, displayCurrency, convert, { settlements: debtSettlements });
  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);

  // Sélecteur de période partagé avec Rapports/Flux. Le type "month" reste
  // synchronisé avec les autres onglets via sharedMonth (l'ancre = 1er du mois) ;
  // les autres types (3/12 derniers mois, année, perso) sont locaux à l'Accueil.
  const [periodType, setPeriodType] = useState("month");
  const [anchor, setAnchorRaw] = useState(() =>
    sharedMonth ? new Date(sharedMonth.year, sharedMonth.month, 1) : new Date()
  );
  const [customRange, setCustomRange] = useState({ start: "", end: "" });

  function setAnchor(newAnchor) {
    setAnchorRaw(newAnchor);
    if (periodType === "month" && onSharedMonthChange) {
      onSharedMonthChange({ month: newAnchor.getMonth(), year: newAnchor.getFullYear() });
    }
  }

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
  const inRange = (tx) => {
    const d = new Date(tx.date);
    return d >= range.start && d < range.end;
  };
  // Mois de référence (ancre) — utilisé par les widgets restés MENSUELS (budget,
  // tendance N mois) même quand une période plus large est sélectionnée.
  const viewMonth = anchor.getMonth();
  const viewYear = anchor.getFullYear();

  // Budget progress reste MENSUEL (une enveloppe budget est mensuelle) : il suit
  // le mois de l'ancre, pas la plage complète. C'est le compromis assumé de
  // l'onglet Accueil (cf. docs) — les budgets ne se recalculent pas sur un an.
  const { progress: budgetProgress } = useBudgetProgress(viewMonth, viewYear, displayCurrency);
  const { suggestion: subscriptionSuggestion, accept: acceptSubscription, dismiss: dismissSubscription } = useSubscriptionSuggestion();

  // Refonte 1B : les insights « Pour toi » ne sont plus un bandeau en haut mais
  // des encarts fermables POSÉS DANS le widget concerné. On route par catégorie
  // d'insight vers le widget cible ; `insightFor` renvoie le 1er insight live
  // d'une des catégories données (déjà filtré des masqués + trié par le moteur).
  const { insights, dismiss: dismissInsight } = useInsights(displayCurrency);
  const insightFor = (cats) => insights.find((i) => cats.includes(i.category));
  // Les 3 premiers budgets dans l'ordre défini par l'utilisateur (drag & drop
  // dans l'onglet Budget) — l'ordre du tableau, plus trié par % consommé.
  const hiddenBudgetIds = useBudgetHiddenIds();
  // Exclut les budgets que CET utilisateur a masqués (partagés mais cachés de
  // ses vues) avant de prendre les 2 premiers pour le widget.
  const topBudgets = useMemo(
    () => budgetProgress.filter((p) => !hiddenBudgetIds.has(p.budget.id)).slice(0, 2),
    [budgetProgress, hiddenBudgetIds]
  );

  // Transactions de la PÉRIODE sélectionnée : alimente les widgets « scopés »
  // (résumé du couple, dépenses par catégorie, dernières transactions, résumé
  // par membre). Les widgets patrimoine/liquidité (instantanés) et le budget
  // (mensuel) ne s'appuient pas dessus.
  const monthTx = useMemo(
    () => transactions.filter(inRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, range]
  );

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === displayCurrency) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, displayCurrency);
  }

  const totals = useMemo(() => {
    let income = 0, expense = 0, invested = 0;
    for (const tx of monthTx) {
      const val = toBase(tx);
      if (tx.type === "income") income += val;
      else if (tx.type === "expense") expense += val;
      else if (tx.type === "investment") invested += val;
    }
    return { income, expense, invested, net: income - expense - invested };
  }, [monthTx, displayCurrency, convert]);

  // Desktop-only "reports_trend" widget: income vs expense for the N
  // months (trendMonths, switchable via the widget's own period buttons)
  // ending on the currently viewed month — same shape of data as Reports'
  // own income/expense chart, just always following the last N months
  // rather than Reports' arbitrary period picker.
  const trendData = useMemo(() => {
    // "week" → buckets journaliers sur les 7 derniers jours (vue granulaire
    // pour les profils dont revenus/dépenses sont étalés). Sinon buckets
    // MENSUELS — jamais par jour sur un mois, car dominé par le jour de
    // salaire/loyer (barres géantes) qui écrase tout le reste.
    if (trendPeriod === "week") {
      const today = new Date();
      const buckets = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        buckets.push({ key: d.toDateString(), label: d.toLocaleDateString("fr-FR", { weekday: "short" }), income: 0, expense: 0 });
      }
      for (const tx of transactions) {
        if (tx.type !== "income" && tx.type !== "expense") continue;
        const bucket = buckets.find((b) => b.key === new Date(tx.date).toDateString());
        if (!bucket) continue;
        const val = toBase(tx);
        if (tx.type === "income") bucket.income += val;
        else bucket.expense += val;
      }
      return buckets;
    }
    const buckets = [];
    for (let i = trendPeriod - 1; i >= 0; i--) {
      let m = viewMonth - i;
      let y = viewYear;
      while (m < 0) { m += 12; y -= 1; }
      buckets.push({ month: m, year: y, label: monthName(m).slice(0, 3), income: 0, expense: 0 });
    }
    for (const tx of transactions) {
      const d = new Date(tx.date);
      const bucket = buckets.find((b) => b.month === d.getMonth() && b.year === d.getFullYear());
      if (!bucket) continue;
      const val = toBase(tx);
      if (tx.type === "income") bucket.income += val;
      else if (tx.type === "expense") bucket.expense += val;
    }
    return buckets;
  }, [transactions, viewMonth, viewYear, trendPeriod, displayCurrency, convert]);

  const memberTotals = useMemo(() => {
    const result = {};
    for (const m of members) result[getMemberKey(m)] = { name: m.name, income: 0, expense: 0, invested: 0 };
    for (const tx of monthTx) {
      const val = toBase(tx);
      const payers = tx.split === "50/50"
        ? members.map((m) => ({ uid: getMemberKey(m), share: 0.5 }))
        : [{ uid: tx.paidBy, share: 1 }];
      for (const p of payers) {
        if (!result[p.uid]) continue;
        const amt = val * p.share;
        if (tx.type === "income") result[p.uid].income += amt;
        else if (tx.type === "expense") result[p.uid].expense += amt;
        else if (tx.type === "investment") result[p.uid].invested += amt;
      }
    }
    return result;
  }, [monthTx, members, displayCurrency, convert]);

  const categoryTotals = useMemo(() => {
    const result = {};
    for (const cat of categories) {
      if (cat.id === "income") continue;
      let total = 0;
      const subtotals = {};
      for (const tx of monthTx) {
        if (tx.type === "expense" && tx.categoryId === cat.id) {
          const val = toBase(tx);
          total += val;
          subtotals[tx.subcategory] = (subtotals[tx.subcategory] || 0) + val;
        }
      }
      if (total > 0) result[cat.id] = { category: cat, total, subtotals };
    }
    return result;
  }, [monthTx, categories, displayCurrency, convert]);

  const maxCatTotal = Math.max(1, ...Object.values(categoryTotals).map((c) => c.total));

  const recentTx = useMemo(
    () => [...monthTx].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    [monthTx]
  );

  const bankAccounts = useMemo(() => assets.filter((a) => a.typeId === "account"), [assets]);
  const { netWorth, netWorthByMember, totalAssets, totalsByTypeFor } = useNetWorth(displayCurrency);

  function formatAmount(n) {
    return Math.round(n).toLocaleString("fr-FR");
  }
  const currencySymbol = ALL_CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency;

  // ── Edit mode ──────────────────────────────────────────────────────────────

  function enterEditMode() {
    setLocalWidgets([...activeWidgets]);
    setEditMode(true);
  }

  function exitEditMode() {
    saveWidgets(localWidgets ?? activeWidgets);
    setEditMode(false);
  }

  function toggleWidget(id) {
    setLocalWidgets((prev) =>
      (prev ?? activeWidgets).map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  }

  // dnd-kit sensors: in edit mode only
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    setLocalWidgets((prev) => {
      const list = prev ?? activeWidgets;
      const oldIdx = list.findIndex((w) => w.id === active.id);
      const newIdx = list.findIndex((w) => w.id === over.id);
      return arrayMove(list, oldIdx, newIdx);
    });
  }

  // ── Widget labels ──────────────────────────────────────────────────────────
  const WIDGET_LABELS = {
    net_balance: summaryLabel,
    health_score: t("health_title"),
    available_savings: t("widget_available_savings"),
    budget_tracking: t("widget_budget_tracking"),
    member_breakdown: t("widget_member_breakdown"),
    spending_by_category: t("widget_spending_by_category"),
    transaction_history: t("widget_transaction_history"),
    net_worth: t("widget_net_worth"),
    debt_tracker: t("widget_debt_tracker"),
    recurring: t("widget_recurring"),
    wealth_allocation: t("widget_wealth_allocation"),
    reports_trend: t("widget_reports_trend"),
  };

  // ── Widget renderers ───────────────────────────────────────────────────────
  function renderWidgetContent(id) {
    switch (id) {
      case "net_balance": {
        // Héros « Solde du mois » (refonte 1B) : lavis corail, chiffre géant en
        // sémantique good/over, 3 cellules Revenus/Dépenses/Investi, puis insight.
        const heroInsight = insightFor(["savings", "balance", "emergency", "recurring"]);
        return (
          <WidgetCard
            icon="ti-heart"
            accent="coral"
            title={summaryLabel}
          >
            <p className="pw-num" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 46, lineHeight: 1, letterSpacing: "-0.02em", marginTop: 4, color: totals.net >= 0 ? "var(--good)" : "var(--over)" }}>
              {totals.net >= 0 ? "+" : "−"}
              <AnimatedNumber value={Math.abs(totals.net)} format={formatAmount} /> {currencySymbol}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <HeroStat dot="var(--good)" label={t("dashboard_income")} value={`${formatAmount(totals.income)} ${currencySymbol}`} />
              <HeroStat dot="var(--tang)" label={t("dashboard_expenses")} value={`${formatAmount(totals.expense)} ${currencySymbol}`} />
              <HeroStat dot="var(--sky)" label={t("dashboard_invested")} value={`${formatAmount(totals.invested)} ${currencySymbol}`} />
            </div>
            {!editMode && <InsightInline insight={heroInsight} onClose={() => heroInsight && dismissInsight(heroInsight.id)} dismissLabel={t("insight_dismiss")} />}
          </WidgetCard>
        );
      }

      case "health_score":
        return (
          <Suspense fallback={<div className="skeleton" style={{ height: 220 }} />}>
            <HealthScoreWidget displayCurrency={displayCurrency} />
          </Suspense>
        );

      case "available_savings": {
        // Filtre par membre : couple = tous ; membre = ses comptes + les partagés.
        const scopedAccounts = liquidScope == null
          ? bankAccounts
          : bankAccounts.filter((a) => a.ownership === liquidScope || a.ownership === "shared" || a.ownership == null);
        const scopedTotal = scopedAccounts.reduce((s, a) => s + convert(a.value ?? 0, a.currency, displayCurrency), 0);
        return (
          <WidgetCard
            icon="ti-building-bank"
            accent="mint"
            title={t("widget_available_savings_label")}
          >
            {bankAccounts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "0.5rem 0" }}>{t("widget_no_bank_accounts")}</p>
            ) : (
              <>
                {/* Filtre membre en haut, centré (UI unifiée). */}
                {!editMode && members.length > 1 && (
                  <ScopeFilter members={members} value={liquidScope} onChange={setLiquidScope} coupleLabel={t("health_scope_couple")} />
                )}
                {/* Hero : le total en gros chiffre en tête, détail des comptes dessous. */}
                <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 2 }}>{t("dashboard_total")}</p>
                <p className="pw-num" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em", marginBottom: 14, color: "var(--good)" }}>
                  {formatAmount(scopedTotal)} {currencySymbol}
                </p>
                {scopedAccounts.map((a, i) => (
                  <BreakdownRow key={a.id} color={BANK_DOT_COLORS[i % BANK_DOT_COLORS.length]} label={a.name} value={`${formatAmount(convert(a.value, a.currency, displayCurrency))} ${currencySymbol}`} last={i === scopedAccounts.length - 1} />
                ))}
                {scopedAccounts.length === 0 && (
                  <p style={{ fontSize: 12.5, color: "var(--ink-3)", textAlign: "center", padding: "0.5rem 0" }}>{t("widget_no_bank_accounts")}</p>
                )}
              </>
            )}
          </WidgetCard>
        );
      }

      case "budget_tracking":
        return (
          <WidgetCard
            icon="ti-target"
            accent="amber"
            title={t("dashboard_budget_progress")}
            action={!editMode && topBudgets.length > 0 && (
              <button onClick={onOpenBudget} style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                {t("dashboard_see_all")} <i className="ti ti-chevron-right" style={{ fontSize: 14 }} aria-hidden="true" />
              </button>
            )}
          >
            <div>
              {topBudgets.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "0.75rem 0" }}>{t("widget_budget_empty")}</p>
              ) : topBudgets.map((p, i) => {
                const isLast = i === topBudgets.length - 1;
                return (
                  <div key={p.budget.id} style={{ paddingBottom: isLast ? 0 : 14, marginBottom: isLast ? 0 : 14, borderBottom: isLast ? "none" : "0.5px solid var(--rule)" }}>
                    <BudgetCard
                      p={p}
                      displayCurrency={displayCurrency}
                      variant="embedded"
                      onEdit={editMode ? undefined : () => onOpenBudget()}
                      onToggleActive={(b) => updateBudget(b.id, { active: b.active === false ? true : false })}
                    />
                  </div>
                );
              })}
            </div>
            {!editMode && (() => {
              const bi = insightFor(["budget"]);
              return <InsightInline insight={bi} onClose={() => bi && dismissInsight(bi.id)} dismissLabel={t("insight_dismiss")} />;
            })()}
          </WidgetCard>
        );

      case "member_breakdown":
        if (members.length === 0) return null;
        return (
          <WidgetCard
            icon="ti-users"
            accent="ocean"
            title={t("dashboard_member_summary")}
            action={!editMode && (
              <button onClick={onOpenBreakdown} style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                {t("dashboard_detail")} <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
            )}
          >
            {/* Tableau comparatif : une colonne par membre, séparateur
                vertical, montants au code couleur sémantique. */}
            <div>
              {(() => {
                const mts = members.map((m) => ({
                  m,
                  mt: memberTotals[getMemberKey(m)] || { income: 0, expense: 0, invested: 0 },
                }));
                // Colonnes des valeurs : libellé fluide + une colonne par membre.
                const gridCols = `1fr ${members.map(() => "minmax(84px, auto)").join(" ")}`;
                // La colonne de chaque membre après la première porte le
                // séparateur vertical + l'espacement inter-membres.
                const colStyle = (i) =>
                  i === 0
                    ? { textAlign: "right" }
                    : { textAlign: "right", borderLeft: "0.5px solid var(--rule)", paddingLeft: 18, marginLeft: 6 };
                const rows = [
                  { label: t("dashboard_income"), color: "var(--sage)", get: (mt) => mt.income },
                  { label: t("dashboard_expenses"), color: "var(--tang)", get: (mt) => mt.expense },
                  { label: t("dashboard_invested"), color: "var(--lavi)", get: (mt) => mt.invested },
                ];
                return (
                  <div style={{ display: "grid", gridTemplateColumns: gridCols, rowGap: 10, alignItems: "center" }}>
                    <span />
                    {mts.map(({ m }, i) => (
                      <div key={getMemberKey(m)} style={{ ...colStyle(i), display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        <Avatar member={m} colorMap={memberColorMap} size={22} />
                        <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                      </div>
                    ))}
                    {rows.map((row) => (
                      <Fragment key={row.label}>
                        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{row.label}</span>
                        {mts.map(({ m, mt }, i) => (
                          <span key={getMemberKey(m)} style={{ ...colStyle(i), fontSize: 13, fontWeight: 500, color: row.color }}>
                            {formatAmount(row.get(mt))} {currencySymbol}
                          </span>
                        ))}
                      </Fragment>
                    ))}
                    <div style={{ gridColumn: "1 / -1", height: 0.5, background: "var(--rule)", margin: "2px 0" }} />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{t("dashboard_balance")}</span>
                    {mts.map(({ m, mt }, i) => {
                      const bal = mt.income - mt.expense - mt.invested;
                      return (
                        <span key={getMemberKey(m)} style={{ ...colStyle(i), fontSize: 14, fontWeight: 700, color: bal >= 0 ? "var(--good)" : "var(--over)" }}>
                          {formatAmount(bal)} {currencySymbol}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </WidgetCard>
        );

      case "spending_by_category":
        return (
          <WidgetCard
            icon="ti-chart-pie"
            accent="coral"
            title={t("dashboard_spending_by_category")}
          >
            {Object.keys(categoryTotals).length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>{t("dashboard_no_expenses")}</p>
            ) : (
              <>
              {/* Indice sous l'icône/titre du widget. */}
              {!editMode && <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8 }}>{t("dashboard_tap_category")}</p>}
              {Object.values(categoryTotals)
                .sort((a, b) => b.total - a.total)
                .map(({ category, total, subtotals }) => (
                  <CategoryRow key={category.id} category={category} total={total} maxTotal={maxCatTotal} subtotals={subtotals} formatAmount={formatAmount} totalExpenses={totals.expense} currencySymbol={currencySymbol} />
                ))}
              </>
            )}
          </WidgetCard>
        );

      case "transaction_history":
        return (
          <WidgetCard
            icon="ti-receipt-2"
            accent="sky"
            title={<>{t("dashboard_transactions")} <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· <AnimatedNumber value={monthTx.length} duration={450} format={(n) => String(Math.round(n))} /></span></>}
            flush
            action={!editMode && recentTx.length > 0 && (
              <button onClick={onOpenTransactions} style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                {t("dashboard_see_all")} <i className="ti ti-chevron-right" style={{ fontSize: 14 }} aria-hidden="true" />
              </button>
            )}
          >
            <div className={recentTx.length > 0 ? "pw-stagger" : undefined}>
              {recentTx.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.5rem 0" }}>{t("tx_no_transactions")}</p>
              ) : (
                recentTx.map((tx, i) => {
                  const cat = categories.find((c) => c.id === tx.categoryId) || categories[0];
                  const isIncome = tx.type === "income";
                  return (
                    <div key={tx.id} onClick={() => !editMode && onEditTransaction?.(tx)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i === recentTx.length - 1 ? "none" : "0.5px solid var(--rule)", cursor: editMode ? "default" : "pointer" }}>
                      <i className={`ti ${cat.icon}`} style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />
                      <p style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</p>
                      {tx.comments?.length > 0 && (
                        <CommentBubble count={tx.comments.length} onClick={() => setCommentsTx(tx)} />
                      )}
                      <p style={{ fontSize: 13, fontWeight: 500, color: isIncome ? "var(--sage)" : "var(--ink)" }}>
                        {isIncome ? "+" : "−"}{Math.round(tx.amount).toLocaleString("fr-FR")} {tx.currency}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </WidgetCard>
        );

      case "net_worth": {
        const patriInsight = insightFor(["networth", "networth_record"]);
        return (
          <WidgetCard icon="ti-diamond" accent="mint" title={t("widget_net_worth_total")}>
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div>
                <span className="pw-num" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em", color: netWorth >= 0 ? "var(--good)" : "var(--over)" }}>
                  {netWorth >= 0 ? "+" : "−"}<AnimatedNumber value={Math.abs(netWorth)} format={formatAmount} /> {currencySymbol}
                </span>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{t("dashboard_networth_couple")}</div>
              </div>
              {members.length > 0 && (
                <div style={{ marginTop: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: 12 }}>
                  {members.map((m) => (
                    <div key={getMemberKey(m)} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Avatar member={m} colorMap={memberColorMap} size={20} />
                      <span style={{ flex: 1, fontSize: 13, color: "var(--ink-2)" }}>{m.name}</span>
                      <span className="pw-num" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                        {formatAmount(netWorthByMember[getMemberKey(m)] || 0)} {currencySymbol}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!editMode && <InsightInline insight={patriInsight} onClose={() => patriInsight && dismissInsight(patriInsight.id)} dismissLabel={t("insight_dismiss")} />}
            </div>
          </WidgetCard>
        );
      }

      case "debt_tracker":
        // Pas de dette entre partenaires en compte commun.
        if (!debt || financeMode === "common") return null;
        return (
          <WidgetCard icon="ti-arrows-exchange" accent="pink" title={t("widget_debt_tracker")}>
            {/* Contenu inline (DebtSummaryCard embarque son propre cadre — on
                évite la carte dans la carte). */}
            <div
              onClick={!editMode ? onOpenDebt : undefined}
              style={{ display: "flex", alignItems: "center", gap: 14, cursor: editMode ? "default" : "pointer", height: "100%" }}
            >
              <div style={{ display: "flex" }}>
                <div style={{ marginRight: -10, border: "2px solid var(--bg-card)", borderRadius: "50%" }}>
                  <Avatar member={debt.a} colorMap={memberColorMap} size={44} />
                </div>
                <div style={{ border: "2px solid var(--bg-card)", borderRadius: "50%" }}>
                  <Avatar member={debt.b} colorMap={memberColorMap} size={44} />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>
                  {t("debt_owes").replace("{from}", debt.owesFromName).replace("{to}", debt.owesToName)}
                </p>
                <p className="pw-num" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 26, color: "var(--tang)" }}>
                  {Math.round(debt.owesAmount).toLocaleString("fr-FR")} {currencySymbol}
                </p>
              </div>
              {!editMode && <i className="ti ti-chevron-right" style={{ fontSize: 18, color: "var(--ink-3)" }} aria-hidden="true" />}
            </div>
          </WidgetCard>
        );

      case "recurring": {
        const now = new Date();
        const upcoming = recurringTx
          .filter((r) => r.active !== false)
          .map((r) => ({ ...r, nextDate: nextOccurrence(r, now) }))
          .sort((a, b) => (a.nextDate?.getTime() ?? Infinity) - (b.nextDate?.getTime() ?? Infinity))
          .slice(0, 3);
        return (
          <WidgetCard
            icon="ti-repeat"
            accent="pink"
            title={t("widget_recurring_upcoming")}
            flush
            action={!editMode && (
              <button
                onClick={() => onOpenRecurring?.()}
                style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}
              >
                {t("dashboard_see_all")} <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
            )}
          >
            {subscriptionSuggestion && !editMode && (
              <div
                style={{
                  background: "var(--lavi-light)",
                  border: "0.5px solid var(--lavi)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  margin: "0 14px 8px",
                }}
              >
                <p style={{ fontSize: 12, color: "var(--ink)", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <i className="ti ti-sparkles" style={{ fontSize: 14, color: "var(--lavi)", flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                  <span>
                    {t("subscription_suggestion")
                      .replace("{description}", subscriptionSuggestion.description)
                      .replace("{count}", subscriptionSuggestion.count)
                      .replace("{amount}", `${Math.round(subscriptionSuggestion.amount).toLocaleString("fr-FR")} ${subscriptionSuggestion.currency}`)}
                  </span>
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={acceptSubscription}
                    style={{ flex: 1, padding: "7px 0", borderRadius: "var(--radius-md)", border: "none", background: "var(--lavi)", color: "#fff", fontSize: 12, fontWeight: 500 }}
                  >
                    {t("subscription_accept")}
                  </button>
                  <button
                    onClick={dismissSubscription}
                    style={{ flex: 1, padding: "7px 0", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", background: "var(--bg-card)", color: "var(--ink-2)", fontSize: 12 }}
                  >
                    {t("subscription_dismiss")}
                  </button>
                </div>
              </div>
            )}
            <div>
              {upcoming.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.5rem 0" }}>{t("widget_recurring_empty")}</p>
              ) : (
                upcoming.map((r, i) => {
                  const cat = categories.find((c) => c.id === r.categoryId);
                  return (
                    <div
                      key={r.id}
                      onClick={() => !editMode && onOpenRecurring?.(r.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i === upcoming.length - 1 ? "none" : "0.5px solid var(--rule)", cursor: editMode ? "default" : "pointer" }}
                    >
                      <i className={`ti ${cat?.icon || "ti-refresh"}`} style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description || cat?.name}</p>
                        {r.nextDate && (() => {
                          const days = daysUntil(r.nextDate, now);
                          const soon = days >= 0 && days <= 3;
                          return (
                            <p style={{ fontSize: 11, color: soon ? "var(--tang)" : "var(--ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
                              {r.nextDate.toLocaleDateString("fr-FR")}
                              {soon && (
                                <span style={{ fontSize: 9, fontWeight: 600, color: "var(--tang)", background: "var(--tang-light)", borderRadius: 8, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                  {days === 0 ? t("recurring_badge_today") : t("recurring_badge_soon")}
                                </span>
                              )}
                            </p>
                          );
                        })()}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{Math.round(r.amount).toLocaleString("fr-FR")} {r.currency}</p>
                    </div>
                  );
                })
              )}
            </div>
          </WidgetCard>
        );
      }

      case "wealth_allocation": {
        if (totalAssets <= 0) return null;
        const { totalsByType: tbtScoped, totalAssets: taScoped } = totalsByTypeFor(allocationScope);
        return (
          <WidgetCard icon="ti-chart-donut" accent="amber" title={t("widget_wealth_allocation")} bodyStyle={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {members.length > 1 && <ScopeFilter members={members} value={allocationScope} onChange={setAllocationScope} coupleLabel={t("health_scope_couple")} />}
            <Suspense fallback={<div className="skeleton" style={{ height: 110 }} />}>
              <AllocationChart totalsByType={tbtScoped} totalAssets={taScoped} fill />
            </Suspense>
          </WidgetCard>
        );
      }

      case "reports_trend":
        return (
          <WidgetCard
            icon="ti-chart-bar"
            accent="ocean"
            title={t("widget_reports_trend")}
            action={!editMode && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {[{ k: "week", l: t("widget_trend_this_week") }, { k: 3, l: "3M" }, { k: 6, l: "6M" }, { k: 12, l: "12M" }].map((opt) => (
                    <button
                      key={opt.k}
                      onClick={() => setTrendPeriod(opt.k)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 99,
                        border: trendPeriod === opt.k ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                        background: trendPeriod === opt.k ? "var(--sky-light)" : "var(--bg)",
                        color: trendPeriod === opt.k ? "var(--sky)" : "var(--ink-3)",
                        fontSize: 11,
                        fontWeight: trendPeriod === opt.k ? 500 : 400,
                      }}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
            )}
          >
            <Suspense fallback={<div className="skeleton" style={{ height: 180 }} />}>
              <IncomeExpenseTrendChart data={trendData} currencySymbol={currencySymbol} />
            </Suspense>
          </WidgetCard>
        );

      default:
        return null;
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || ratesLoading) {
    return (
      <div style={{ padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  // Parité mobile/desktop : mêmes widgets partout (mobile inclus). Le layout
  // reste un empilement 1 colonne sur mobile (pas de bento — cf. bentoEnabled),
  // mais l'Accueil montre désormais exactement les mêmes cartes que le desktop,
  // y compris Répartition du patrimoine et Tendance (anciennement desktop-only).
  const displayList = activeWidgets;
  // Seuls les widgets visibles occupent la grille (et donc un emplacement dont
  // la taille dépend du rang) ; les masqués passent dans le tiroir d'édition.
  const gridWidgets = displayList.filter((w) => w.visible);
  const gridWidgetIds = gridWidgets.map((w) => w.id);
  const hiddenWidgets = displayList.filter((w) => !w.visible);

  return (
    <div style={{ paddingBottom: "6rem" }}>
      {commentsTx && (
        <CommentsModal title={commentsTx.description || t("tx_comments")} onClose={() => setCommentsTx(null)}>
          <TransactionComments txId={commentsTx.id} bare />
        </CommentsModal>
      )}
      {/* Sticky header — stays visible while scrolling widgets below, with an
          opaque background matching the page so content scrolls under it
          rather than through it. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "var(--bg)",
          padding: "1rem 1.25rem",
        }}
      >
      {/* Header. Desktop : une ligne [accueil | mois | actions]. Mobile :
          ligne 1 [mois + actions] (le bouton Réglages flottant occupe le coin
          gauche), ligne 2 le bloc « Bonjour … » sur toute la largeur. */}
      {(() => {
        const monthNav = (
          <div style={{ justifySelf: "center", display: "flex", alignItems: "center", gap: 6 }}>
            <PeriodSelector
              periodType={periodType}
              setPeriodType={setPeriodType}
              anchor={anchor}
              setAnchor={setAnchor}
              setAnchorNow={() => setAnchorRaw(new Date())}
              rangeLabel={range.label}
              customRange={customRange}
              setCustomRange={setCustomRange}
            />
            {ratesError === "using_fallback_rates" && (
              <i className="ti ti-alert-triangle" title="Taux de change approximatifs" style={{ fontSize: 12, color: "var(--amber)" }} aria-hidden="true" />
            )}
          </div>
        );
        const actions = (
          <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 8 }}>
            {editMode ? (
              <button
                onClick={exitEditMode}
                style={{
                  height: 34, padding: "0 16px", background: "var(--ink)", color: "var(--bg)",
                  border: "none", borderRadius: 99, fontSize: 13, fontWeight: 600,
                }}
              >
                {t("dashboard_done")}
              </button>
            ) : (
              <>
                <button
                  ref={currencyButtonRef}
                  onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                  style={{
                    height: 34, padding: "0 12px", borderRadius: 99, border: "0.5px solid var(--rule)",
                    background: "var(--bg-card)", fontSize: 13, fontWeight: 600, color: "var(--ink)",
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}
                >
                  {ALL_CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency} <i className="ti ti-chevron-down" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
                </button>
                <button
                  ref={customizeButtonRef}
                  onClick={enterEditMode}
                  aria-label={t("dashboard_customize")}
                  style={{
                    height: 34, padding: isDesktop ? "0 14px" : "0 11px", borderRadius: 99,
                    background: "var(--tang)", border: "0.5px solid var(--tang)", color: "#fff",
                    fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <i className="ti ti-pencil" style={{ fontSize: 15 }} aria-hidden="true" />
                  {isDesktop && t("dashboard_edit_btn")}
                </button>
              </>
            )}
          </div>
        );
        const greeting = (
          <GreetingHeader
            subtitleKey="home_subtitle"
            marginLeft={0}
            month={range.label.charAt(0).toUpperCase() + range.label.slice(1)}
          />
        );
        if (isDesktop) {
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
              {greeting}
              {monthNav}
              {actions}
            </div>
          );
        }
        return (
          <>
            {/* Ligne 1 : [Réglages] [période centrée] [devise/actions], alignés
                sur une même ligne (Réglages intégré ici, plus de FAB flottant
                sur l'accueil). */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <button
                ref={settingsButtonRef}
                onClick={onOpenMenu}
                aria-label={t("nav_menu")}
                className="nav-menu-btn"
                style={navBtnStyle}
              >
                <i className="ti ti-menu-2" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
              {monthNav}
              {actions}
            </div>
            {/* Ligne 2 : Bonjour + sous-titre. */}
            {greeting}
          </>
        );
      })()}

      {!editMode && (
        <SpotlightHint
          tabKey="dashboard"
          steps={[
            addButtonRef && { ref: addButtonRef, text: t("hint_dashboard_add") },
            { ref: currencyButtonRef, text: t("hint_dashboard_currency") },
            !isDesktop && settingsButtonRef && { ref: settingsButtonRef, text: t("hint_dashboard_settings") },
            { ref: customizeButtonRef, text: t("hint_dashboard_customize") },
          ].filter(Boolean)}
        />
      )}

      {/* Edit mode hint */}
      {editMode && (
        <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 12, marginBottom: 4, textAlign: "center" }}>
          {t("dashboard_edit_hint")}
        </p>
      )}

      {/* Currency picker */}
      {showCurrencyPicker && !editMode && (
        <div style={{ marginTop: 12, background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem" }}>
          <CurrencyPicker
            value={displayCurrency}
            onSelect={(code) => { updateDashboardDisplayCurrency(code); setShowCurrencyPicker(false); }}
          />
        </div>
      )}
      </div>

      {/* Refonte 1B : plus de bande « Pour toi » ici — les insights sont posés
          dans leur widget cible (Solde, Budget, Patrimoine) via <InsightInline>. */}

      {/* Widgets — LAYOUT FIXE. Seuls les widgets VISIBLES occupent la grille ;
          leur taille découle de leur position (slotSize). Sur desktop c'est la
          grille bento à 15 colonnes (édition comprise, pour que le drag reflète
          les vrais emplacements) ; sur mobile, empilement pleine largeur.
          rectSortingStrategy gère la réorganisation. Les widgets masqués vivent
          dans un tiroir sous la grille en mode édition. */}
      <div
        className={bentoEnabled ? "bento-grid" : ""}
        style={{ padding: "0 1.25rem" }}
      >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={gridWidgetIds} strategy={rectSortingStrategy}>
          {gridWidgets.map((w, idx) => {
            const content = renderWidgetContent(w.id);
            if (!content && !editMode) return null;
            return (
              <SortableWidget
                key={w.id}
                id={w.id}
                editMode={editMode}
                onLongPress={enterEditMode}
                outerStyle={bentoEnabled ? { gridColumn: `span ${slotSpan12(idx)}`, maxHeight: BENTO_MAX_HEIGHT } : undefined}
              >
                <div style={{ marginBottom: bentoEnabled ? 0 : 28, position: "relative", height: bentoEnabled ? "100%" : undefined }}>
                  {/* Bouton masquer en mode édition. */}
                  {editMode && (
                    <button
                      onClick={() => toggleWidget(w.id)}
                      aria-label={t("dashboard_widget_hide")}
                      style={{
                        position: "absolute", top: 8, right: 8, zIndex: 3,
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "3px 10px 3px 8px",
                        borderRadius: 13,
                        border: "0.5px solid var(--rule)",
                        background: "var(--bg-card)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                      }}
                    >
                      <i className="ti ti-eye-off" style={{ fontSize: 12, color: "var(--ink-3)" }} aria-hidden="true" />
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-2)" }}>
                        {t("dashboard_widget_hide_short")}
                      </span>
                    </button>
                  )}
                  <div
                    style={{
                      paddingLeft: editMode ? 36 : 0,
                      transition: "padding 0.2s",
                      height: bentoEnabled ? "100%" : undefined,
                    }}
                  >
                    {content || (
                      <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px dashed var(--rule)", padding: "0.75rem 1.25rem" }}>
                        <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>{WIDGET_LABELS[w.id]}</p>
                      </div>
                    )}
                  </div>
                </div>
              </SortableWidget>
            );
          })}
        </SortableContext>
      </DndContext>
      </div>

      {/* Tiroir des widgets masqués (mode édition) — cliquer sur une pastille
          ré-affiche le widget, qui reprend une place dans la grille selon son
          rang. */}
      {editMode && hiddenWidgets.length > 0 && (
        <div style={{ padding: "1.25rem 1.25rem 0" }}>
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>{t("dashboard_hidden_widgets")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {hiddenWidgets.map((w) => (
              <button
                key={w.id}
                onClick={() => toggleWidget(w.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 99,
                  border: "0.5px dashed var(--rule)", background: "var(--bg-card)",
                  fontSize: 12, color: "var(--ink-2)",
                }}
              >
                <i className="ti ti-plus" style={{ fontSize: 13, color: "var(--sky)" }} aria-hidden="true" />
                {WIDGET_LABELS[w.id]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Encart insight posé DANS un widget (refonte 1B), fermable (persistance gérée
// par useInsights via localStorage). Couleur = tonalité de l'insight.
function InsightInline({ insight, onClose, dismissLabel }) {
  if (!insight) return null;
  const color = INSIGHT_TONE_COLOR[insight.tone] || "var(--sky)";
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 9, marginTop: 14,
        padding: "10px 12px", borderRadius: "var(--radius-md)",
        background: `color-mix(in srgb, ${color} 11%, transparent)`,
        border: `0.5px solid color-mix(in srgb, ${color} 26%, transparent)`,
      }}
    >
      <i className={`ti ${insight.icon}`} style={{ fontSize: 16, color, flex: "none", marginTop: 1 }} aria-hidden="true" />
      <span style={{ flex: "1 1 auto", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.35 }}>{insight.text}</span>
      <button
        onClick={onClose}
        aria-label={dismissLabel}
        style={{ flex: "none", cursor: "pointer", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 99, background: "none", border: "none", color: "var(--ink-3)" }}
      >
        <i className="ti ti-x" style={{ fontSize: 13 }} aria-hidden="true" />
      </button>
    </div>
  );
}

// Cellule stat du héros (refonte 1B) : pastille de couleur + libellé + valeur,
// sur un fond très léger neutre.
function HeroStat({ dot, label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "color-mix(in srgb, var(--ink) 5%, transparent)", borderRadius: "var(--radius-md)", padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-3)" }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: dot, flexShrink: 0 }} />
        {label}
      </div>
      <div className="pw-num" style={{ marginTop: 5, fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function BreakdownRow({ color, label, value, valueColor = "var(--ink)", last = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: last ? "none" : "0.5px solid var(--rule)" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "var(--ink-2)", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: valueColor }}>{value}</span>
    </div>
  );
}

const navBtnStyle = {
  width: 30, height: 30, borderRadius: "50%", background: "var(--bg-card)",
  border: "0.5px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "center",
};
