import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function formatTick(v) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${Math.round(v / 100) / 10}k`;
  return `${v}`;
}

export default function IncomeExpenseTrendChart({ data, currencySymbol }) {
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
        <p style={{ marginBottom: 2 }}>{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.dataKey === "income" ? "var(--sage)" : "var(--tang)" }}>
            {Math.round(p.value).toLocaleString("fr-FR")} {currencySymbol}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 180 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--ink-3)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatTick}
            width={38}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="income" fill="var(--sage)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="var(--tang)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
