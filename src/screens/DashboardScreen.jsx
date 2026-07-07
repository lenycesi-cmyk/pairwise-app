import { useState, useMemo, useRef, lazy, Suspense, Fragment } from "react";
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useDebtCalculation } from "../hooks/useDebtCalculation";
import { useBudgetProgress } from "../hooks/useBudgetProgress";
import { useDashboardPrefs } from "../hooks/useDashboardPrefs";
import { useNetWorth } from "../hooks/useNetWorth";
import CategoryRow from "../components/CategoryRow";
import WidgetCard from "../components/WidgetCard";
import Avatar from "../components/Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { CURRENCIES } from "../data/categories";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";
import SpotlightHint from "../components/SpotlightHint";
import { getMemberKey } from "../utils/members";
import { nextOccurrence, daysUntil } from "../utils/recurrence";
import { useSubscriptionSuggestion } from "../hooks/useSubscriptionSuggestion";
import { useMediaQuery } from "../hooks/useMediaQuery";

// Desktop-only widgets pull in recharts, which is deliberately kept out of
// the eager bundle (Dashboard itself loads eagerly — see CLAUDE.md/
// vite.config.js manualChunks) — lazy-loaded here so mobile users, who
// never see these widgets, never pay for the recharts chunk either.
const AllocationChart = lazy(() => import("../components/AllocationChart"));
const IncomeExpenseTrendChart = lazy(() => import("../components/IncomeExpenseTrendChart"));
const HealthScoreWidget = lazy(() => import("../components/HealthScoreWidget"));

// Widgets that only make sense with more screen room — hidden entirely on
// mobile (not offered in the customize picker there either), shown by
// default on desktop.
const DESKTOP_ONLY_WIDGETS = ["wealth_allocation", "reports_trend"];

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const LONG_PRESS_DELAY = 500;

// ── Sortable widget wrapper ──────────────────────────────────────────────────
function SortableWidget({ id, editMode, onLongPress, children }) {
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
export default function DashboardScreen({ onOpenDebt, onOpenBreakdown, onOpenTransactions, onEditTransaction, sharedMonth, onSharedMonthChange, addButtonRef, settingsButtonRef, onOpenRecurring }) {
  const t = useTranslation();
  const { catName } = useCategoryName();
  const {
    transactions, categories, members, assets, recurringTx, coupleName, debtSettlements,
    defaultCurrency, dashboardDisplayCurrency, updateDashboardDisplayCurrency, loading,
  } = useFinance();
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const { convert, loading: ratesLoading, error: ratesError } = useExchangeRates(displayCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const customizeButtonRef = useRef(null);
  const currencyButtonRef = useRef(null);
  const [detailBudgetId, setDetailBudgetId] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState(6);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const summaryLabel = coupleName
    ? `${coupleName} ${t("widget_summary_word")}`
    : t("widget_couple_summary_default");

  const { widgets, saveWidgets } = useDashboardPrefs();
  const [localWidgets, setLocalWidgets] = useState(null);
  const activeWidgets = localWidgets ?? widgets;

  const debt = useDebtCalculation(transactions, members, displayCurrency, convert, { settlements: debtSettlements });
  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);

  const now = new Date();
  // Controlled by the shared month state in App.jsx when provided (keeps Home
  // in sync with Reports so switching tabs doesn't reset the selected period);
  // falls back to local state so this component still works standalone.
  const [localMonth, setLocalMonth] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const { month: viewMonth, year: viewYear } = sharedMonth ?? localMonth;
  const setViewMonthYear = onSharedMonthChange ?? setLocalMonth;

  // Budget progress must follow the currently viewed month, not always the
  // real calendar month — otherwise the widget silently shows next/prev
  // month's spend while the rest of the screen is browsing a different one.
  const { progress: budgetProgress } = useBudgetProgress(viewMonth, viewYear);
  const { suggestion: subscriptionSuggestion, accept: acceptSubscription, dismiss: dismissSubscription } = useSubscriptionSuggestion();
  const topBudgets = useMemo(
    () => [...budgetProgress].sort((a, b) => b.pct - a.pct).slice(0, 3),
    [budgetProgress]
  );

  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonthYear({ month: m, year: y });
  }

  const monthTx = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });
  }, [transactions, viewMonth, viewYear]);

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
      buckets.push({ month: m, year: y, label: MONTHS[m].slice(0, 3), income: 0, expense: 0 });
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
  const availableSavings = useMemo(
    () => bankAccounts.reduce((sum, a) => sum + convert(a.value ?? 0, a.currency, displayCurrency), 0),
    [bankAccounts, convert, displayCurrency]
  );
  const { netWorth, netWorthByMember, totalsByType, totalAssets } = useNetWorth(displayCurrency);

  function formatAmount(n) {
    return Math.round(n).toLocaleString("fr-FR");
  }
  const currencySymbol = CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency;

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
      case "net_balance":
        return (
          <WidgetCard icon="ti-wallet" accent="mint" title={summaryLabel}>
            {/* Hero : le solde net est LE chiffre de l'écran — gros, en display. */}
            <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 2 }}>{t("dashboard_net_balance")}</p>
            <p className="pw-num" style={{ fontSize: 32, marginBottom: 12, color: totals.net >= 0 ? "var(--sage)" : "var(--tang)" }}>
              {totals.net >= 0 ? "+" : ""}{formatAmount(totals.net)} {currencySymbol}
            </p>
            <BreakdownRow color="var(--sage)" label={t("dashboard_income")} value={`${formatAmount(totals.income)} ${currencySymbol}`} valueColor="var(--sage)" />
            <BreakdownRow color="var(--tang)" label={t("dashboard_expenses")} value={`${formatAmount(totals.expense)} ${currencySymbol}`} valueColor="var(--tang)" />
            <BreakdownRow color="var(--lavi)" label={t("dashboard_invested")} value={`${formatAmount(totals.invested)} ${currencySymbol}`} last />
          </WidgetCard>
        );

      case "health_score":
        return (
          <Suspense fallback={<div className="skeleton" style={{ height: 220 }} />}>
            <HealthScoreWidget displayCurrency={displayCurrency} />
          </Suspense>
        );

      case "available_savings":
        return (
          <WidgetCard icon="ti-building-bank" accent="mint" title={t("widget_available_savings_label")}>
            {bankAccounts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "0.5rem 0" }}>{t("widget_no_bank_accounts")}</p>
            ) : (
              <>
                {/* Hero : le total en gros chiffre en tête, détail des comptes dessous. */}
                <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 2 }}>Total</p>
                <p className="pw-num" style={{ fontSize: 32, marginBottom: 12, color: "var(--sage)" }}>
                  {formatAmount(availableSavings)} {currencySymbol}
                </p>
                {bankAccounts.map((a, i) => (
                  <BreakdownRow key={a.id} color="var(--sage)" label={a.name} value={`${formatAmount(convert(a.value, a.currency, displayCurrency))} ${currencySymbol}`} last={i === bankAccounts.length - 1} />
                ))}
              </>
            )}
          </WidgetCard>
        );

      case "budget_tracking":
        return (
          <WidgetCard icon="ti-target" accent="amber" title={t("dashboard_budget_progress")}>
            <div>
              {topBudgets.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "0.75rem 0" }}>{t("widget_budget_empty")}</p>
              ) : topBudgets.map(({ budget, pct, scopedTx, amountInBase, projected, projectedOver }, i) => {
                const over = pct >= 100;
                const warn = pct >= (budget.alertThreshold ?? 80);
                const barColor = over ? "var(--red)" : warn ? "var(--amber)" : "var(--sky)";
                const label = budget.name || (budget.scope === "global"
                  ? t("budget_scope_global")
                  : (budget.categoryIds || []).map((cid) => { const c = categories.find((c) => c.id === cid); return c ? catName(c) : null; }).filter(Boolean).join(", "));
                const memberLabel = !budget.memberUid || budget.memberUid === "couple"
                  ? null
                  : members.find((m) => getMemberKey(m) === budget.memberUid)?.name;
                const isOpen = detailBudgetId === budget.id;
                return (
                  <div key={budget.id} style={{ marginBottom: i === topBudgets.length - 1 ? 0 : 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12 }}>
                        {label}
                        {memberLabel && <span style={{ color: "var(--sky)" }}> · {memberLabel}</span>}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: barColor }}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--rule)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 3 }} />
                    </div>
                    {projected !== null && pct < 100 && (
                      <p style={{ fontSize: 10.5, color: projectedOver ? "var(--amber)" : "var(--ink-3)", marginTop: 4 }}>
                        {t("budget_projection")
                          .replace("{amount}", `${Math.round(projected).toLocaleString("fr-FR")} ${defaultCurrency}`)}
                        {projectedOver &&
                          ` (${t("budget_projection_over").replace("{over}", `${Math.round(projected - amountInBase).toLocaleString("fr-FR")} ${defaultCurrency}`)})`}
                      </p>
                    )}
                    {!editMode && (
                      <button
                        onClick={() => setDetailBudgetId(isOpen ? null : budget.id)}
                        style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 11, padding: "4px 0 0", display: "flex", alignItems: "center", gap: 3 }}
                      >
                        {isOpen ? t("dashboard_hide_details") : t("dashboard_show_details")}
                        <i className={`ti ${isOpen ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 11 }} aria-hidden="true" />
                      </button>
                    )}
                    {isOpen && (
                      <div style={{ marginTop: 6, borderTop: "0.5px solid var(--rule)", paddingTop: 6 }}>
                        {scopedTx.length === 0 ? (
                          <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", padding: "6px 0" }}>{t("dashboard_no_expenses")}</p>
                        ) : (
                          [...scopedTx].sort((a, b) => new Date(b.date) - new Date(a.date)).map((tx) => (
                            <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0" }}>
                              <span style={{ fontSize: 11, color: "var(--ink-2)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {tx.description}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 500 }}>{Math.round(tx.amount).toLocaleString("fr-FR")} {tx.currency}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
                        <span key={getMemberKey(m)} style={{ ...colStyle(i), fontSize: 14, fontWeight: 700, color: bal >= 0 ? "var(--sage)" : "var(--red)" }}>
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
            action={Object.keys(categoryTotals).length > 0 && !editMode && (
              <p style={{ fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>{t("dashboard_tap_category")}</p>
            )}
          >
            {Object.keys(categoryTotals).length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>{t("dashboard_no_expenses")}</p>
            ) : (
              Object.values(categoryTotals)
                .sort((a, b) => b.total - a.total)
                .map(({ category, total, subtotals }) => (
                  <CategoryRow key={category.id} category={category} total={total} maxTotal={maxCatTotal} subtotals={subtotals} formatAmount={formatAmount} totalExpenses={totals.expense} currencySymbol={currencySymbol} />
                ))
            )}
          </WidgetCard>
        );

      case "transaction_history":
        return (
          <WidgetCard
            icon="ti-receipt-2"
            accent="sky"
            title={<>{t("dashboard_transactions")} <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· {monthTx.length}</span></>}
            flush
            action={!editMode && (
              <button onClick={onOpenTransactions} style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                {t("dashboard_see_all")} <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
            )}
          >
            <div>
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
                        <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, color: "var(--sky)", flexShrink: 0 }}>
                          <i className="ti ti-message-circle" style={{ fontSize: 13 }} aria-hidden="true" />
                          {tx.comments.length}
                        </span>
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

      case "net_worth":
        return (
          <WidgetCard icon="ti-diamond" accent="ocean" title={t("widget_net_worth_total")}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: members.length > 0 ? 12 : 0 }}>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("wealth_net_worth")}</span>
                <span className="pw-num" style={{ fontSize: 19, color: netWorth >= 0 ? "var(--sage)" : "var(--tang)" }}>
                  {netWorth >= 0 ? "+" : ""}{formatAmount(netWorth)} {currencySymbol}
                </span>
              </div>
              {members.length > 0 && (
                <div style={{ borderTop: "0.5px solid var(--rule)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {members.map((m) => (
                    <div key={getMemberKey(m)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Avatar member={m} colorMap={memberColorMap} size={16} />
                        <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{m.name}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: (netWorthByMember[getMemberKey(m)] || 0) >= 0 ? "var(--sage)" : "var(--tang)" }}>
                        {formatAmount(netWorthByMember[getMemberKey(m)] || 0)} {currencySymbol}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </WidgetCard>
        );

      case "debt_tracker":
        if (!debt) return null;
        return (
          <WidgetCard icon="ti-arrows-exchange" accent="pink" title={t("widget_debt_tracker")}>
            {/* Contenu inline (DebtSummaryCard embarque son propre cadre — on
                évite la carte dans la carte). */}
            <div
              onClick={!editMode ? onOpenDebt : undefined}
              style={{ display: "flex", alignItems: "center", gap: 12, cursor: editMode ? "default" : "pointer" }}
            >
              <div style={{ display: "flex" }}>
                <div style={{ marginRight: -8, border: "2px solid var(--bg-card)", borderRadius: "50%" }}>
                  <Avatar member={debt.a} colorMap={memberColorMap} size={32} />
                </div>
                <div style={{ border: "2px solid var(--bg-card)", borderRadius: "50%" }}>
                  <Avatar member={debt.b} colorMap={memberColorMap} size={32} />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: "var(--ink-2)" }}>{debt.owesText}</p>
                <p className="pw-num" style={{ fontSize: 18, color: "var(--sky)" }}>
                  {Math.round(debt.owesAmount).toLocaleString("fr-FR")} {displayCurrency}
                </p>
              </div>
              {!editMode && <i className="ti ti-chevron-right" style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />}
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

      case "wealth_allocation":
        if (totalAssets <= 0) return null;
        return (
          <WidgetCard icon="ti-chart-donut" accent="amber" title={t("widget_wealth_allocation")}>
            <Suspense fallback={<div className="skeleton" style={{ height: 110 }} />}>
              <AllocationChart totalsByType={totalsByType} totalAssets={totalAssets} />
            </Suspense>
          </WidgetCard>
        );

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

  const displayList = isDesktop
    ? activeWidgets
    : activeWidgets.filter((w) => !DESKTOP_ONLY_WIDGETS.includes(w.id));
  const visibleIds = displayList.filter((w) => w.visible || editMode).map((w) => w.id);

  return (
    <div style={{ paddingBottom: "6rem" }}>
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
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        {/* Titre d'onglet, aligné avec la colonne gauche — cohérent avec
            Rapports / Patrimoine / Budget. Sur mobile, laisse la place au
            bouton de menu en haut à gauche (même retrait de 44px). */}
        <h1 style={{ fontSize: 20, marginLeft: isDesktop ? 0 : 44, whiteSpace: "nowrap" }}>{t("home_title")}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifySelf: "center" }}>
          <button onClick={() => changeMonth(-1)} aria-label="Mois précédent" style={navBtnStyle}>
            <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
          <p style={{ fontSize: 15, fontWeight: 500 }}>
            {MONTHS[viewMonth]} {viewYear}
            {ratesError === "using_fallback_rates" && (
              <i className="ti ti-alert-triangle" title="Taux de change approximatifs" style={{ fontSize: 12, color: "var(--amber)", marginLeft: 6 }} aria-hidden="true" />
            )}
          </p>
          <button onClick={() => changeMonth(1)} aria-label="Mois suivant" style={navBtnStyle}>
            <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        </div>
        <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 6 }}>
          {editMode ? (
            <button
              onClick={exitEditMode}
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
                ref={currencyButtonRef}
                onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                style={{
                  padding: "4px 10px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)",
                  background: "var(--bg-card)", fontSize: 12, fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {displayCurrency} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
              </button>
              <button
                ref={customizeButtonRef}
                onClick={enterEditMode}
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
      </div>

      {!editMode && (
        <SpotlightHint
          tabKey="dashboard"
          steps={[
            addButtonRef && { ref: addButtonRef, text: t("hint_dashboard_add") },
            { ref: currencyButtonRef, text: t("hint_dashboard_currency") },
            settingsButtonRef && { ref: settingsButtonRef, text: t("hint_dashboard_settings") },
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem" }}>
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => { updateDashboardDisplayCurrency(c.code); setShowCurrencyPicker(false); }}
              style={{
                padding: "6px 10px", borderRadius: "var(--radius-md)",
                border: displayCurrency === c.code ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                background: displayCurrency === c.code ? "var(--sky-light)" : "var(--bg)",
                color: displayCurrency === c.code ? "var(--sky)" : "var(--ink)", fontSize: 12,
              }}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Widgets — sortable in edit mode. On desktop, laid out as a masonry
          column layout when not actively reordering — dnd-kit's drag math
          here still assumes a single vertical list
          (verticalListSortingStrategy), so edit mode temporarily falls back
          to one column while dragging to keep reordering correct; the
          masonry layout resumes right after. */}
      <div
        className={isDesktop && !editMode ? "card-columns" : ""}
        style={{ padding: "0 1.25rem" }}
      >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          {displayList
            .filter((w) => w.visible || editMode)
            .map((w) => {
              const content = renderWidgetContent(w.id);
              if (!content && !editMode) return null;
              return (
                <SortableWidget
                  key={w.id}
                  id={w.id}
                  editMode={editMode}
                  onLongPress={enterEditMode}
                >
                  <div style={{ marginBottom: 28, position: "relative" }}>
                    {/* Toggle button overlay in edit mode — kept at full opacity/contrast
                        regardless of widget visibility, so it stays obviously tappable
                        even when the widget below it is faded out. */}
                    {editMode && (
                      <button
                        onClick={() => toggleWidget(w.id)}
                        aria-label={w.visible ? t("dashboard_widget_hide") : t("dashboard_widget_show")}
                        style={{
                          position: "absolute", top: 8, right: 8, zIndex: 3,
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "3px 8px 3px 3px",
                          borderRadius: 13,
                          border: w.visible ? "0.5px solid var(--sky)" : "1px solid var(--ink-3)",
                          background: w.visible ? "var(--sky)" : "var(--bg-card)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                        }}
                      >
                        <span
                          style={{
                            width: 16, height: 16, borderRadius: "50%",
                            background: w.visible ? "var(--bg)" : "var(--ink-3)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className={`ti ${w.visible ? "ti-eye" : "ti-eye-off"}`}
                            style={{ fontSize: 10, color: w.visible ? "var(--sky)" : "var(--bg-card)" }}
                            aria-hidden="true"
                          />
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: w.visible ? "var(--bg)" : "var(--ink-2)" }}>
                          {w.visible ? t("dashboard_widget_shown") : t("dashboard_widget_hidden")}
                        </span>
                      </button>
                    )}
                    <div
                      style={{
                        opacity: editMode && !w.visible ? 0.4 : 1,
                        paddingLeft: editMode ? 36 : 0,
                        transition: "opacity 0.2s, padding 0.2s",
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
