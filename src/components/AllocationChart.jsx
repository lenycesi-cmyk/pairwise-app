import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ASSET_TYPES } from "../data/assetTypes";
import { useFinance } from "../context/FinanceContext";

const COLOR_HEX = {
  tang: "#FF6B35",
  sage: "#6EAA5E",
  lavi: "#9B87F5",
  sky: "#4CB8D4",
  amber: "#F4B942",
  mint: "#5BBFAA",
  blush: "#F4879C",
  red: "#E24B4A",
};

export default function AllocationChart({ totalsByType, totalAssets, fill = false }) {
  const { language } = useFinance();
  const data = ASSET_TYPES.filter((t) => !t.isLiability && (totalsByType[t.id] || 0) > 0).map(
    (t) => ({
      name: language === "en" && t.nameEn ? t.nameEn : t.name,
      value: totalsByType[t.id],
      pct: totalAssets > 0 ? ((totalsByType[t.id] / totalAssets) * 100).toFixed(1) : 0,
      color: COLOR_HEX[t.color] || "#999",
    })
  );

  function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
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
        {d.name} · {d.pct}%
      </div>
    );
  }

  if (data.length === 0) return null;

  // En mode `fill` (box bento à hauteur fixe), on centre verticalement et on
  // agrandit le donut pour occuper l'espace disponible.
  const donut = fill ? 150 : 110;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, height: fill ? "100%" : undefined }}>
      <div style={{ width: donut, height: donut, flexShrink: 0 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={fill ? 44 : 32}
              outerRadius={fill ? 72 : 52}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--ink-2)", flex: 1 }}>{d.name}</span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
