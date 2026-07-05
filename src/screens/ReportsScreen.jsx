import { useState, useMemo, useEffect, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import CategoryRow from "../components/CategoryRow";
import Avatar from "../components/Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { CURRENCIES } from "../data/categories";
import { useTranslation } from "../hooks/useTranslation";
import SpotlightHint from "../components/SpotlightHint";
import { getMemberKey } from "../utils/members";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { tagColor } from "../utils/tags";
import TagChip from "../components/TagChip";

const PERIOD_TYPES = ["month", "quarter", "year", "last12", "custom"];

// Same k-notation as the dashboard's IncomeExpenseTrendChart, so the
// mobile Reports chart and the desktop widget read identically.
function formatAxisTick(v) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${Math.round(v / 100) / 10}k`;
  return `${v}`;
}

function getRange(periodType, anchor, customRange) {
  const y = anchor.getFullYear();
  if (periodType === "month") {
    const m = anchor.getMonth();
    return {
      start: new Date(y, m, 1),
      end: new Date(y, m + 1, 1),
      label: anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    };
  }
  if (periodType === "quarter") {
    const q = Math.floor(anchor.getMonth() / 3);
    return {
      start: new Date(y, q * 3, 1),
      end: new Date(y, q * 3 + 3, 1),
      label: `T${q + 1} ${y}`,
    };
  }
  if (periodType === "last12") {
    const end = new Date(y, anchor.getMonth() + 1, 1);
    const start = new Date(y, anchor.getMonth() - 11, 1);
    return {
      start,
      end,
      label: `${start.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })} – ${anchor.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}`,
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
      label: `${start.toLocaleDateString("fr-FR")} – ${new Date(end.getTime() - 1).toLocaleDateString("fr-FR")}`,
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
  if (periodType === "month") d.setMonth(d.getMonth() + delta);
  else if (periodType === "quarter") d.setMonth(d.getMonth() + delta * 3);
  else d.setFullYear(d.getFullYear() + delta);
  return d;
}

export default function ReportsScreen({ onOpenBreakdown, sharedMonth, onSharedMonthChange }) {
  const t = useTranslation();
  const { transactions, categories, members, defaultCurrency, dashboardDisplayCurrency, netWorthHistory } = useFinance();
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const { convert, loading: ratesLoading } = useExchangeRates(displayCurrency);
  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const periodRowRef = useRef(null);

  const [periodType, setPeriodType] = useState("month");
  // Initialize from the month shared with Home so arriving here keeps whatever
  // was last selected there. Only the "month" period type stays in sync both
  // ways — quarter/year/last12/custom are report-specific and stay local.
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
    () => getRange(periodType, anchor, customRange),
    [periodType, anchor, customRange]
  );
  const prevRange = useMemo(() => {
    if (periodType === "last12" || periodType === "custom") {
      const span = range.end.getTime() - range.start.getTime();
      return { start: new Date(range.start.getTime() - span), end: range.start };
    }
    return getRange(periodType, shiftAnchor(periodType, anchor, -1));
  }, [periodType, anchor, range]);

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
        label: new Date(h.date).toLocaleDateString("fr-FR", { month: "short" }),
        value: convert(h.netWorth ?? 0, defaultCurrency, displayCurrency),
      }));
  }, [netWorthHistory, convert, displayCurrency, defaultCurrency]);

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
    if (periodType === "month") {
      bucketKey = (d) => d.getDate();
      bucketLabel = (d) => d.getDate().toString();
    } else {
      bucketKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;
      bucketLabel = (d) => d.toLocaleDateString("fr-FR", { month: "short" });
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
  }, [periodTx, periodType, displayCurrency, convert]);

  const incomeExpenseData = useMemo(() => {
    const buckets = new Map();
    let bucketKey, bucketLabel;
    if (periodType === "month") {
      bucketKey = (d) => d.getDate();
      bucketLabel = (d) => d.getDate().toString();
    } else {
      bucketKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;
      bucketLabel = (d) => d.toLocaleDateString("fr-FR", { month: "short" });
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
  }, [periodTx, periodType, displayCurrency, convert]);

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
    return Math.round(n).toLocaleString("fr-FR");
  }

  const currencySymbol =
    CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency;

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
      <h1 style={{ fontSize: 20, marginBottom: 16, marginLeft: 44 }}>{t("reports_title")}</h1>

      <SpotlightHint tabKey="reports" targetRef={periodRowRef} text={t("hint_reports")} />

      <div ref={periodRowRef} style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {PERIOD_TYPES.map((p) => (
          <button
            key={p}
            onClick={() => setPeriodType(p)}
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

      {periodType === "custom" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="date"
            value={customRange.start}
            onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              background: "var(--bg-card)",
              fontSize: 13,
              color: "var(--ink)",
            }}
          />
          <input
            type="date"
            value={customRange.end}
            onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              background: "var(--bg-card)",
              fontSize: 13,
              color: "var(--ink)",
            }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        {periodType !== "last12" && periodType !== "custom" ? (
          <button
            onClick={() => setAnchor(shiftAnchor(periodType, anchor, -1))}
            aria-label="Période précédente"
            style={navBtnStyle}
          >
            <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        ) : (
          <div style={{ width: 30 }} />
        )}
        <p style={{ fontSize: 15, fontWeight: 500, textTransform: "capitalize" }}>{range.label}</p>
        {periodType !== "last12" && periodType !== "custom" ? (
          <button
            onClick={() => setAnchor(shiftAnchor(periodType, anchor, 1))}
            aria-label="Période suivante"
            style={navBtnStyle}
          >
            <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        ) : (
          <div style={{ width: 30 }} />
        )}
      </div>

      {/* Summary card — kept full-width above the masonry columns below,
          same reasoning as WealthScreen's net worth card. */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "1rem 1.25rem",
          marginBottom: 20,
        }}
      >
        <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 4 }}>
          {t("dashboard_expenses")}
        </p>
        <p style={{ fontSize: 26, fontWeight: 500, color: "var(--tang)" }}>
          {formatAmount(totalExpense)} {currencySymbol}
        </p>
        {expenseDiffPct !== null && (
          <p
            style={{
              fontSize: 12,
              marginTop: 4,
              color: expenseDiffPct <= 0 ? "var(--sage)" : "var(--tang)",
            }}
          >
            {expenseDiffPct >= 0 ? "+" : ""}
            {expenseDiffPct.toFixed(1)}% <span style={{ color: "var(--ink-3)" }}>{t("reports_vs_previous")}</span>
          </p>
        )}
      </div>

      <div className={isDesktop ? "card-columns" : ""}>

      {/* This period vs previous period comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { label: t("dashboard_income"), current: totalIncome, prev: prevTotalIncome, diff: incomeDiffPct, color: "var(--sage)" },
          { label: t("dashboard_expenses"), current: totalExpense, prev: prevTotalExpense, diff: expenseDiffPct, color: "var(--tang)", invert: true },
        ].map(({ label, current, prev, diff, color, invert }) => (
          <div key={label} style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "12px 14px" }}>
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 16, fontWeight: 500, color }}>{formatAmount(current)} {currencySymbol}</p>
            {diff !== null && (
              <p style={{ fontSize: 11, marginTop: 3, color: (invert ? diff <= 0 : diff >= 0) ? "var(--sage)" : "var(--tang)" }}>
                {diff >= 0 ? "+" : ""}{diff.toFixed(1)}% <span style={{ color: "var(--ink-3)" }}>{t("reports_vs_previous")}</span>
              </p>
            )}
            {prev > 0 && (
              <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                {t("reports_previous")}: {formatAmount(prev)} {currencySymbol}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Net worth evolution */}
      {netWorthChartData.length >= 2 && (
        <>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("reports_net_worth_evolution")}</p>
          <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "1rem 1.25rem", marginBottom: 20 }}>
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
          </div>
        </>
      )}

      <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("reports_evolution")}</p>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "1rem 1.25rem",
          marginBottom: 20,
        }}
      >
        {evolutionData.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>
            {t("reports_no_expenses")}
          </p>
        ) : (
          <div style={{ width: "100%", height: 140 }}>
            <ResponsiveContainer>
              <LineChart data={evolutionData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                  axisLine={{ stroke: "var(--rule)" }}
                  tickLine={false}
                />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--tang)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("reports_income_vs_expense")}</p>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "1rem 1.25rem",
          marginBottom: 20,
        }}
      >
        {incomeExpenseData.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>
            {t("reports_no_expenses")}
          </p>
        ) : (
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer>
              <BarChart data={incomeExpenseData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                  axisLine={{ stroke: "var(--rule)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxisTick}
                  width={38}
                />
                <Tooltip
                  formatter={(value, name) => [`${formatAmount(value)} ${currencySymbol}`, name]}
                  labelStyle={{ color: "var(--ink)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name={t("dashboard_income")} fill="var(--sage)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name={t("dashboard_expenses")} fill="var(--tang)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {members.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 500 }}>
              {t("reports_member_comparison")}
            </p>
            {onOpenBreakdown && (
              <button
                onClick={onOpenBreakdown}
                style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}
              >
                {t("dashboard_detail")} <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {members.map((m) => {
              const mt = memberComparison[getMemberKey(m)] || { expense: 0, income: 0 };
              return (
                <div
                  key={getMemberKey(m)}
                  style={{
                    background: "var(--bg-card)",
                    borderRadius: "var(--radius-lg)",
                    border: "0.5px solid var(--rule)",
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Avatar member={m} colorMap={memberColorMap} size={24} />
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</p>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("dashboard_expenses")}</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--tang)" }}>
                    {formatAmount(mt.expense)} {currencySymbol}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tagTotals.length > 0 && (
        <>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("reports_by_tag")}</p>
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              border: "0.5px solid var(--rule)",
              padding: "0.75rem 1.25rem",
              marginBottom: 20,
            }}
          >
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
        </>
      )}

      <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("reports_by_category")}</p>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "0.5rem 1.25rem",
        }}
      >
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
      </div>
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
