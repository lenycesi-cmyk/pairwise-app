import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import CategoryRow from "../components/CategoryRow";
import Avatar from "../components/Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { CURRENCIES } from "../data/categories";
import { useTranslation } from "../hooks/useTranslation";

const PERIOD_TYPES = ["month", "quarter", "year"];

function getRange(periodType, anchor) {
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

export default function ReportsScreen() {
  const t = useTranslation();
  const { transactions, categories, members, defaultCurrency, dashboardDisplayCurrency } = useFinance();
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const { convert, loading: ratesLoading } = useExchangeRates(displayCurrency);
  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);

  const [periodType, setPeriodType] = useState("month");
  const [anchor, setAnchor] = useState(new Date());

  const range = useMemo(() => getRange(periodType, anchor), [periodType, anchor]);
  const prevRange = useMemo(
    () => getRange(periodType, shiftAnchor(periodType, anchor, -1)),
    [periodType, anchor]
  );

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
  const prevTotalExpense = useMemo(
    () => prevPeriodTx.filter((tx) => tx.type === "expense").reduce((s, tx) => s + toBase(tx), 0),
    [prevPeriodTx, displayCurrency, convert]
  );
  const expenseDiffPct =
    prevTotalExpense > 0 ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100 : null;

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

  const memberComparison = useMemo(() => {
    const result = {};
    for (const m of members) result[m.uid] = { expense: 0, income: 0 };
    for (const tx of periodTx) {
      const payers =
        tx.split === "50/50"
          ? members.map((m) => ({ uid: m.uid, share: 0.5 }))
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

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => setAnchor(shiftAnchor(periodType, anchor, -1))}
          aria-label="Période précédente"
          style={navBtnStyle}
        >
          <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>
        <p style={{ fontSize: 15, fontWeight: 500, textTransform: "capitalize" }}>{range.label}</p>
        <button
          onClick={() => setAnchor(shiftAnchor(periodType, anchor, 1))}
          aria-label="Période suivante"
          style={navBtnStyle}
        >
          <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>
      </div>

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

      {members.length > 0 && (
        <>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
            {t("reports_member_comparison")}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {members.map((m) => {
              const mt = memberComparison[m.uid] || { expense: 0, income: 0 };
              return (
                <div
                  key={m.uid}
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
