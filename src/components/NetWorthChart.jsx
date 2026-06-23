import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function NetWorthChart({ history, currencySymbol }) {
  const data = history.map((h) => ({
    date: new Date(h.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    value: h.value,
  }));

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
  );
}
