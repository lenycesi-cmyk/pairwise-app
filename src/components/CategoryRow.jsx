import { useState } from "react";

const COLOR_MAP = {
  tang: { text: "var(--tang)", bg: "var(--tang-light)" },
  sage: { text: "var(--sage)", bg: "var(--sage-light)" },
  lavi: { text: "var(--lavi)", bg: "var(--lavi-light)" },
  sky: { text: "var(--sky)", bg: "var(--sky-light)" },
  amber: { text: "var(--amber)", bg: "var(--amber-light)" },
  mint: { text: "var(--mint)", bg: "var(--mint-light)" },
  blush: { text: "var(--blush)", bg: "var(--blush-light)" },
};

export default function CategoryRow({ category, total, maxTotal, subtotals, formatAmount }) {
  const [expanded, setExpanded] = useState(false);
  const colors = COLOR_MAP[category.color] || COLOR_MAP.tang;
  const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
  const hasSubs = subtotals && Object.keys(subtotals).length > 0;

  return (
    <div style={{ borderBottom: "0.5px solid var(--rule)" }}>
      <div
        onClick={() => hasSubs && setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 0",
          cursor: hasSubs ? "pointer" : "default",
        }}
      >
        <i
          className={`ti ${category.icon}`}
          style={{ fontSize: 18, color: colors.text, flexShrink: 0 }}
          aria-hidden="true"
        />
        <p style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{category.name}</p>
        <div
          style={{
            width: 50,
            height: 5,
            background: "var(--rule)",
            borderRadius: 4,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: 5,
              background: colors.text,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            minWidth: 64,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {formatAmount(total)}
        </p>
        {hasSubs && (
          <i
            className="ti ti-chevron-right"
            style={{
              fontSize: 14,
              color: "var(--ink-3)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
        )}
      </div>

      {expanded && hasSubs && (
        <div style={{ padding: "0 0 10px 28px" }}>
          {Object.entries(subtotals)
            .sort((a, b) => b[1] - a[1])
            .map(([subName, subTotal]) => (
              <div
                key={subName}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                  {subName}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {formatAmount(subTotal)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
