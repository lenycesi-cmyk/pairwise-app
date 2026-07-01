import { useState, useMemo, useRef } from "react";
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
import DebtSummaryCard from "../components/DebtSummaryCard";
import Avatar from "../components/Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { CURRENCIES } from "../data/categories";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";

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
export default function DashboardScreen({ onOpenDebt, onOpenBreakdown, onOpenTransactions, onEditTransaction, sharedMonth, onSharedMonthChange }) {
  const t = useTranslation();
  const { catName } = useCategoryName();
  const {
    transactions, categories, members, assets, recurringTx,
    defaultCurrency, dashboardDisplayCurrency, updateDashboardDisplayCurrency, loading,
  } = useFinance();
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const { convert, loading: ratesLoading, error: ratesError } = useExchangeRates(displayCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const { widgets, saveWidgets } = useDashboardPrefs();
  const [localWidgets, setLocalWidgets] = useState(null);
  const activeWidgets = localWidgets ?? widgets;

  const debt = useDebtCalculation(transactions, members, displayCurrency, convert);
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

  const memberTotals = useMemo(() => {
    const result = {};
    for (const m of members) result[m.uid] = { name: m.name, income: 0, expense: 0, invested: 0 };
    for (const tx of monthTx) {
      const val = toBase(tx);
      const payers = tx.split === "50/50"
        ? members.map((m) => ({ uid: m.uid, share: 0.5 }))
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
  const { netWorth, netWorthByMember } = useNetWorth(displayCurrency);

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
    net_balance: t("widget_net_balance"),
    available_savings: t("widget_available_savings"),
    budget_tracking: t("widget_budget_tracking"),
    member_breakdown: t("widget_member_breakdown"),
    spending_by_category: t("widget_spending_by_category"),
    transaction_history: t("widget_transaction_history"),
    net_worth: t("widget_net_worth"),
    debt_tracker: t("widget_debt_tracker"),
    recurring: t("widget_recurring"),
  };

  // ── Widget renderers ───────────────────────────────────────────────────────
  function renderWidgetContent(id) {
    switch (id) {
      case "net_balance":
        return (
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("widget_net_balance")}</p>
            <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("dashboard_net_balance")}</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: totals.net >= 0 ? "var(--sage)" : "var(--tang)" }}>
                  {totals.net >= 0 ? "+" : ""}{formatAmount(totals.net)} {currencySymbol}
                </p>
              </div>
              <BreakdownRow color="var(--sage)" label={t("dashboard_income")} value={`${formatAmount(totals.income)} ${currencySymbol}`} valueColor="var(--sage)" />
              <BreakdownRow color="var(--tang)" label={t("dashboard_expenses")} value={`${formatAmount(totals.expense)} ${currencySymbol}`} valueColor="var(--tang)" />
              <BreakdownRow color="var(--lavi)" label={t("dashboard_invested")} value={`${formatAmount(totals.invested)} ${currencySymbol}`} last />
            </div>
          </div>
        );

      case "available_savings":
        return (
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("widget_available_savings_label")}</p>
            {bankAccounts.length === 0 ? (
              <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "1rem 1.25rem" }}>
                <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>{t("widget_no_bank_accounts")}</p>
              </div>
            ) : (
              <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1.25rem" }}>
                {bankAccounts.map((a, i) => (
                  <BreakdownRow key={a.id} color="var(--sage)" label={a.name} value={`${formatAmount(convert(a.value, a.currency, displayCurrency))} ${currencySymbol}`} last={i === bankAccounts.length - 1} />
                ))}
                <div style={{ borderTop: "0.5px solid var(--rule)", marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Total</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--sage)" }}>{formatAmount(availableSavings)} {currencySymbol}</span>
                </div>
              </div>
            )}
          </div>
        );

      case "budget_tracking":
        if (topBudgets.length === 0) return null;
        return (
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("dashboard_budget_progress")}</p>
            <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1.25rem" }}>
              {topBudgets.map(({ budget, pct }, i) => {
                const over = pct >= 100;
                const warn = pct >= (budget.alertThreshold ?? 80);
                const barColor = over ? "var(--red)" : warn ? "var(--amber)" : "var(--sky)";
                const label = budget.name || (budget.scope === "global"
                  ? t("budget_scope_global")
                  : (budget.categoryIds || []).map((cid) => { const c = categories.find((c) => c.id === cid); return c ? catName(c) : null; }).filter(Boolean).join(", "));
                const memberLabel = !budget.memberUid || budget.memberUid === "couple"
                  ? null
                  : members.find((m) => m.uid === budget.memberUid)?.name;
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
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "member_breakdown":
        if (members.length === 0) return null;
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 500 }}>{t("dashboard_member_summary")}</p>
              {!editMode && (
                <button onClick={onOpenBreakdown} style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                  {t("dashboard_detail")} <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {members.map((m) => {
                const mt = memberTotals[m.uid] || { income: 0, expense: 0, invested: 0 };
                return (
                  <div key={m.uid} style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Avatar member={m} colorMap={memberColorMap} size={26} />
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</p>
                    </div>
                    <MiniRow label={t("dashboard_income")} value={mt.income} formatAmount={formatAmount} color="var(--sage)" symbol={currencySymbol} />
                    <MiniRow label={t("dashboard_expenses")} value={mt.expense} formatAmount={formatAmount} color="var(--tang)" symbol={currencySymbol} />
                    <MiniRow label={t("dashboard_invested")} value={mt.invested} formatAmount={formatAmount} symbol={currencySymbol} />
                    <div style={{ borderTop: "0.5px solid var(--rule)", marginTop: 6, paddingTop: 6 }}>
                      <MiniRow label={t("dashboard_balance")} value={mt.income - mt.expense - mt.invested} formatAmount={formatAmount} color={(mt.income - mt.expense - mt.invested) >= 0 ? "var(--sage)" : "var(--tang)"} symbol={currencySymbol} bold />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "spending_by_category":
        return (
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("dashboard_spending_by_category")}</p>
            <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.5rem 1.25rem" }}>
              {Object.keys(categoryTotals).length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.5rem 0" }}>{t("dashboard_no_expenses")}</p>
              ) : (
                Object.values(categoryTotals)
                  .sort((a, b) => b.total - a.total)
                  .map(({ category, total, subtotals }) => (
                    <CategoryRow key={category.id} category={category} total={total} maxTotal={maxCatTotal} subtotals={subtotals} formatAmount={formatAmount} totalExpenses={totals.expense} currencySymbol={currencySymbol} />
                  ))
              )}
            </div>
            {Object.keys(categoryTotals).length > 0 && !editMode && (
              <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", marginTop: 10 }}>{t("dashboard_tap_category")}</p>
            )}
          </div>
        );

      case "transaction_history":
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 500 }}>{t("dashboard_recent_transactions")}</p>
              {!editMode && (
                <button onClick={onOpenTransactions} style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                  {t("dashboard_see_all")} <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
                </button>
              )}
            </div>
            <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", overflow: "hidden" }}>
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
                      <p style={{ fontSize: 13, fontWeight: 500, color: isIncome ? "var(--sage)" : "var(--ink)" }}>
                        {isIncome ? "+" : "−"}{Math.round(tx.amount).toLocaleString("fr-FR")} {tx.currency}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );

      case "net_worth":
        return (
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("widget_net_worth_total")}</p>
            <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: members.length > 0 ? 12 : 0 }}>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("wealth_net_worth")}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: netWorth >= 0 ? "var(--sage)" : "var(--tang)" }}>
                  {netWorth >= 0 ? "+" : ""}{formatAmount(netWorth)} {currencySymbol}
                </span>
              </div>
              {members.length > 0 && (
                <div style={{ borderTop: "0.5px solid var(--rule)", paddingTop: 10, display: "flex", gap: 12 }}>
                  {members.map((m) => (
                    <div key={m.uid} style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        <Avatar member={m} colorMap={memberColorMap} size={16} />
                        <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{m.name}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: (netWorthByMember[m.uid] || 0) >= 0 ? "var(--sage)" : "var(--tang)" }}>
                        {formatAmount(netWorthByMember[m.uid] || 0)} {currencySymbol}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "debt_tracker":
        if (!debt) return null;
        return (
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("widget_debt_tracker")}</p>
            <DebtSummaryCard debt={debt} defaultCurrency={displayCurrency} onClick={!editMode ? onOpenDebt : undefined} />
          </div>
        );

      case "recurring": {
        const upcoming = [...recurringTx]
          .filter((r) => r.active !== false)
          .sort((a, b) => (a.nextDate || "").localeCompare(b.nextDate || ""))
          .slice(0, 3);
        return (
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("widget_recurring_upcoming")}</p>
            <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", overflow: "hidden" }}>
              {upcoming.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.5rem 0" }}>{t("widget_recurring_empty")}</p>
              ) : (
                upcoming.map((r, i) => {
                  const cat = categories.find((c) => c.id === r.categoryId);
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i === upcoming.length - 1 ? "none" : "0.5px solid var(--rule)" }}>
                      <i className={`ti ${cat?.icon || "ti-refresh"}`} style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description || cat?.name}</p>
                        {r.nextDate && <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{new Date(r.nextDate).toLocaleDateString("fr-FR")}</p>}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{Math.round(r.amount).toLocaleString("fr-FR")} {r.currency}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      }

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

  const displayList = activeWidgets;
  const visibleIds = displayList.filter((w) => w.visible || editMode).map((w) => w.id);

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: 16 }}>
        <div />
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

      {/* Edit mode hint */}
      {editMode && (
        <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 14, textAlign: "center" }}>
          {t("dashboard_edit_hint")}
        </p>
      )}

      {/* Currency picker */}
      {showCurrencyPicker && !editMode && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem" }}>
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

      {/* Widgets — sortable in edit mode */}
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
                  <div style={{ marginBottom: 20, position: "relative" }}>
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

function MiniRow({ label, value, formatAmount, color = "var(--ink)", symbol = "", bold = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: bold ? 12 : 11, color: bold ? "var(--ink)" : "var(--ink-2)", fontWeight: bold ? 500 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 700 : 500, color }}>{formatAmount(value)} {symbol}</span>
    </div>
  );
}

const navBtnStyle = {
  width: 30, height: 30, borderRadius: "50%", background: "var(--bg-card)",
  border: "0.5px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "center",
};
