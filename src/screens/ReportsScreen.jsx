import { useState, useMemo, useEffect, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useReportsPrefs } from "../hooks/useDashboardPrefs";
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
import { useMediaQuery } from "../hooks/useMediaQuery";
import { tagColor } from "../utils/tags";
import TagChip from "../components/TagChip";

const PERIOD_TYPES = ["week", "month", "quarter", "year", "last12", "custom"];

const LONG_PRESS_DELAY = 500;

// ── Sortable widget wrapper (même motif que DashboardScreen) ──────────────────
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

function shiftAnchor(periodType, anchor, delta) {
  const d = new Date(anchor);
  if (periodType === "week") d.setDate(d.getDate() + delta * 7);
  else if (periodType === "month") d.setMonth(d.getMonth() + delta);
  else if (periodType === "quarter") d.setMonth(d.getMonth() + delta * 3);
  else d.setFullYear(d.getFullYear() + delta);
  return d;
}

export default function ReportsScreen({ onOpenBreakdown, sharedMonth, onSharedMonthChange }) {
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

  // ── Personnalisation (ordre + afficher/cacher par carte), comme sur Home ──
  const [editMode, setEditMode] = useState(false);
  const { widgets, saveWidgets } = useReportsPrefs();
  const [localWidgets, setLocalWidgets] = useState(null);
  const activeWidgets = localWidgets ?? widgets;

  function enterEditMode() {
    setLocalWidgets([...activeWidgets]);
    setShowCurrencyPicker(false);
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
    return [...netWorthHistory]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map((h) => ({
        label: new Date(h.date).toLocaleDateString(locale, { month: "short" }),
        value: convert(h.netWorth ?? 0, defaultCurrency, displayCurrency),
      }));
  }, [netWorthHistory, convert, displayCurrency, defaultCurrency, locale]);

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

  const evolutionData = useMemo(() => {
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
      if (tx.type !== "expense") continue;
      const d = new Date(tx.date);
      const key = bucketKey(d);
      const existing = buckets.get(key) || { label: bucketLabel(d), value: 0, sortKey: d.getTime() };
      existing.value += toBase(tx);
      buckets.set(key, existing);
    }
    return [...buckets.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [periodTx, periodType, displayCurrency, convert, locale]);

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

  const currencySymbol =
    ALL_CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency;

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
    net_worth: t("reports_net_worth_evolution"),
    spending_evolution: t("reports_evolution"),
    income_vs_expense: t("reports_income_vs_expense"),
    member_comparison: t("reports_member_comparison"),
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
        if (netWorthChartData.length < 2) return null;
        return (
          <WidgetCard icon="ti-diamond" accent="ocean" title={t("reports_net_worth_evolution")}>
            <div style={{ width: "100%", height: 140 }}>
              <ResponsiveContainer>
                <BarChart data={netWorthChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={{ stroke: "var(--rule)" }} tickLine={false} />
                  <YAxis hide domain={["auto", "auto"]} />
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
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke="var(--tang)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Avatar member={m} colorMap={memberColorMap} size={24} />
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</p>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("dashboard_expenses")}</p>
                    <p className="pw-num" style={{ fontSize: 15, color: "var(--tang)" }}>
                      {formatAmount(mt.expense)} {currencySymbol}
                    </p>
                  </div>
                );
              })}
            </div>
          </WidgetCard>
        );
      case "by_tag":
        if (tagTotals.length === 0) return null;
        return (
          <WidgetCard icon="ti-tags" accent="pink" title={t("reports_by_tag")}>
            <div>
              {tagTotals.map(({ tag, total }, i) => {
                const color = tagColor(tag);
                return (
                  <div key={tag} style={{ marginBottom: i === tagTotals.length - 1 ? 0 : 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <TagChip tag={tag} size="sm" />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{formatAmount(total)} {currencySymbol}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--rule)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(total / maxTagTotal) * 100}%`, background: `var(--${color})`, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </WidgetCard>
        );
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

  const visibleIds = activeWidgets.filter((w) => w.visible || editMode).map((w) => w.id);

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      {/* En-tête collant : titre + filtres temporels, alignés à gauche. */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", marginLeft: "-1.25rem", marginRight: "-1.25rem", padding: "0.5rem 1.25rem 0.6rem", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <GreetingHeader subtitleKey="reports_subtitle" marginLeft={isDesktop ? 0 : 44} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
        <div ref={periodRowRef} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: isDesktop ? 0 : 44 }}>
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

      {/* Navigation de période compacte (flèches rapprochées, centrées). */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
        {periodType !== "last12" && periodType !== "custom" && (
          <button onClick={() => setAnchor(shiftAnchor(periodType, anchor, -1))} aria-label="Période précédente" style={navBtnStyle}>
            <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        )}
        <p style={{ fontSize: 15, fontWeight: 500, textTransform: "capitalize", textAlign: "center", minWidth: 120 }}>{range.label}</p>
        {periodType !== "last12" && periodType !== "custom" && (
          <button onClick={() => setAnchor(shiftAnchor(periodType, anchor, 1))} aria-label="Période suivante" style={navBtnStyle}>
            <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Cartes — réorganisables et masquables en mode édition, comme sur Home.
          Layout masonry desktop sauf pendant l'édition (le drag suppose une
          seule colonne verticale). */}
      <div
        className={isDesktop && !editMode ? "card-columns" : ""}
        style={isDesktop && editMode ? { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 20, alignItems: "start" } : undefined}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
            {activeWidgets
              .filter((w) => w.visible || editMode)
              .map((w) => {
                const content = renderWidgetContent(w.id);
                if (!content && !editMode) return null;
                return (
                  <SortableWidget key={w.id} id={w.id} editMode={editMode} onLongPress={enterEditMode}>
                    <div style={{ marginBottom: 20, position: "relative" }}>
                      {editMode && (
                        <button
                          onClick={() => toggleWidget(w.id)}
                          aria-label={w.visible ? t("dashboard_widget_hide") : t("dashboard_widget_show")}
                          style={{
                            position: "absolute", top: 8, right: 8, zIndex: 3,
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "3px 8px 3px 3px", borderRadius: 13,
                            border: w.visible ? "0.5px solid var(--sky)" : "1px solid var(--ink-3)",
                            background: w.visible ? "var(--sky)" : "var(--bg-card)",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                          }}
                        >
                          <span style={{ width: 16, height: 16, borderRadius: "50%", background: w.visible ? "var(--bg)" : "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <i className={`ti ${w.visible ? "ti-eye" : "ti-eye-off"}`} style={{ fontSize: 10, color: w.visible ? "var(--sky)" : "var(--bg-card)" }} aria-hidden="true" />
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: w.visible ? "var(--bg)" : "var(--ink-2)" }}>
                            {w.visible ? t("dashboard_widget_shown") : t("dashboard_widget_hidden")}
                          </span>
                        </button>
                      )}
                      <div style={{ opacity: editMode && !w.visible ? 0.4 : 1, paddingLeft: editMode ? 36 : 0, transition: "opacity 0.2s, padding 0.2s" }}>
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
