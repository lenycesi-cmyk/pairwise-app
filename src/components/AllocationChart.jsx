import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_ANIM, TOOLTIP_ANIM } from "../utils/chartAnim";
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

  // En mode `fill` (refonte 1B) : donut plus grand avec la 1re catégorie affichée
  // au centre du trou, et légende sur 2 colonnes. Sinon rendu compact d'origine.
  const donut = fill ? 150 : 110;
  const top = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: fill ? 22 : 16, height: fill ? "100%" : undefined }}>
      <div style={{ width: donut, height: donut, flexShrink: 0, position: "relative" }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={fill ? 46 : 32}
              outerRadius={fill ? 72 : 52}
              paddingAngle={2}
              stroke="none"
              {...CHART_ANIM}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} {...TOOLTIP_ANIM} />
          </PieChart>
        </ResponsiveContainer>
        {fill && top && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ fontSize: 10, color: "var(--ink-3)", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top.name}</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, color: "var(--ink)" }}>{top.pct}%</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: fill ? "grid" : "flex", gridTemplateColumns: fill ? "minmax(0,1fr) minmax(0,1fr)" : undefined, flexDirection: fill ? undefined : "column", gap: fill ? "9px 14px" : 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--ink-2)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
            <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
