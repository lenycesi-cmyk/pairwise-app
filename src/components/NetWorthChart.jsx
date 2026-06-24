import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const PERIODS = [
  { key: "1m", label: "1 mois", days: 30 },
  { key: "3m", label: "3 mois", days: 90 },
  { key: "6m", label: "6 mois", days: 180 },
  { key: "1y", label: "1 an", days: 365 },
  { key: "all", label: "Tout", days: null },
];

export default function NetWorthChart({ history, currencySymbol, displayCurrency, convert }) {
  const [period, setPeriod] = useState("3m");

  const selectedPeriod = PERIODS.find((p) => p.key === period);

  const filteredHistory = useMemo(() => {
    if (!selectedPeriod.days) return history;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedPeriod.days);
    return history.filter((h) => new Date(h.date) >= cutoff);
  }, [history, period]);

  // Chaque point de l'historique a été enregistré dans la devise active au
  // moment de sa création (h.currency). On le reconvertit systématiquement
  // vers la devise d'affichage actuelle, sinon un changement de devise donne
  // l'illusion d'une chute ou d'une hausse brutale du patrimoine.
  const data = filteredHistory.map((h) => ({
    date: new Date(h.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    value: h.currency && h.currency !== displayCurrency
      ? convert(h.value, h.currency, displayCurrency)
      : h.value,
  }));

  // Performance sur la période affichée
  const performance = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0].value;
    const last = data[data.length - 1].value;
    if (first === 0) return null;
    const diff = last - first;
    const pct = (diff / Math.abs(first)) * 100;
    return { diff, pct };
  }, [data]);

  function CustomTooltip({ active, payload }) {
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
        {Math.round(payload[0].value).toLocaleString("fr-FR")} {currencySymbol}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              padding: "4px 9px",
              borderRadius: "var(--radius-sm)",
              border: period === p.key ? "0.5px solid var(--sage)" : "0.5px solid var(--rule)",
              background: period === p.key ? "var(--sage-light)" : "transparent",
              color: period === p.key ? "var(--sage)" : "var(--ink-3)",
              fontSize: 11,
              fontWeight: period === p.key ? 500 : 400,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {performance && (
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 8,
            color: performance.diff >= 0 ? "var(--sage)" : "var(--tang)",
          }}
        >
          {performance.diff >= 0 ? "+" : ""}
          {Math.round(performance.diff).toLocaleString("fr-FR")} {currencySymbol}
          {" "}({performance.pct >= 0 ? "+" : ""}{performance.pct.toFixed(1)}%)
          <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> sur {selectedPeriod.label.toLowerCase()}</span>
        </p>
      )}

      <div style={{ width: "100%", height: 140 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--ink-3)" }}
              axisLine={{ stroke: "var(--rule)" }}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--sage)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
