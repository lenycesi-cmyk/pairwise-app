import { buildMemberColorMap } from "../utils/memberColors";
import Avatar from "./Avatar";

export default function DebtSummaryCard({ debt, defaultCurrency, onClick }) {
  if (!debt) return null;

  const colorMap = buildMemberColorMap([debt.a, debt.b]);

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        border: "0.5px solid var(--rule)",
        padding: "0.875rem 1.25rem",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex" }}>
        <div style={{ marginRight: -8, border: "2px solid var(--bg-card)", borderRadius: "50%" }}>
          <Avatar member={debt.a} colorMap={colorMap} size={32} />
        </div>
        <div style={{ border: "2px solid var(--bg-card)", borderRadius: "50%" }}>
          <Avatar member={debt.b} colorMap={colorMap} size={32} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: "var(--ink-2)" }}>{debt.owesText}</p>
        <p style={{ fontSize: 18, fontWeight: 500, color: "var(--sky)" }}>
          {Math.round(debt.owesAmount).toLocaleString("fr-FR")} {defaultCurrency}
        </p>
      </div>
      {onClick && (
        <i className="ti ti-chevron-right" style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />
      )}
    </div>
  );
}
