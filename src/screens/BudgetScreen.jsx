import { useTranslation } from "../hooks/useTranslation";

export default function BudgetScreen() {
  const t = useTranslation();
  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>{t("budget_title")}</h1>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "2rem 1.25rem",
          textAlign: "center",
        }}
      >
        <i className="ti ti-wallet" style={{ fontSize: 32, color: "var(--ink-3)" }} aria-hidden="true" />
        <p style={{ fontSize: 14, fontWeight: 500, marginTop: 12 }}>{t("budget_coming_soon")}</p>
        <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{t("budget_coming_soon_hint")}</p>
      </div>
    </div>
  );
}
