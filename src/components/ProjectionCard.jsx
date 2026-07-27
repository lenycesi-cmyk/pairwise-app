import { useState, useMemo } from "react";
import { useTranslation } from "../hooks/useTranslation";
import WidgetCard from "./WidgetCard";

// Carte « Projection » : projette le patrimoine investi actuel + les versements
// programmés (lot 3) sur un horizon donné, à un rendement annuel supposé
// (intérêts composés mensuels). Purement indicatif — les inputs ne sont pas
// persistés (outil de simulation).
export default function ProjectionCard({ base, monthlyContribution, currencySymbol, formatAmount }) {
  const t = useTranslation();
  const [rate, setRate] = useState("5");
  const [years, setYears] = useState("20");

  const proj = useMemo(() => {
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = Math.max(0, Math.round((parseFloat(years) || 0) * 12));
    const pmt = monthlyContribution || 0;
    const growthFactor = Math.pow(1 + r, n);
    const fvBase = base * growthFactor;
    const fvContrib = r > 0 ? pmt * ((growthFactor - 1) / r) : pmt * n;
    const fv = fvBase + fvContrib;
    const contributed = pmt * n;
    const growth = fv - base - contributed;
    return { fv, contributed, growth };
  }, [base, monthlyContribution, rate, years]);

  const numInput = (value, onChange, suffix) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 52, textAlign: "right", padding: "5px 6px",
          border: "0.5px solid var(--rule)", borderRadius: "var(--radius-sm)",
          background: "var(--bg)", color: "var(--ink)", fontSize: 13,
        }}
      />
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{suffix}</span>
    </div>
  );

  return (
    <WidgetCard icon="ti-chart-arrows-vertical" accent="mint" title={t("projection_title")}>
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("projection_rate")}</span>
          {numInput(rate, setRate, "%")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("projection_horizon")}</span>
          {numInput(years, setYears, t("projection_years"))}
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 2 }}>
        {t("projection_projected")}
      </p>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, letterSpacing: "-0.01em", color: "var(--sage)" }}>
        {formatAmount(proj.fv)} {currencySymbol}
      </p>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "0.5px solid var(--rule)", display: "flex", flexDirection: "column", gap: 6 }}>
        <Row label={t("projection_start")} value={`${formatAmount(base)} ${currencySymbol}`} />
        <Row label={t("projection_contributed")} value={`${formatAmount(proj.contributed)} ${currencySymbol}`} />
        <Row label={t("projection_growth")} value={`+${formatAmount(proj.growth)} ${currencySymbol}`} valueColor="var(--sage)" />
        {monthlyContribution > 0 && (
          <p style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>
            {t("projection_monthly")} {formatAmount(monthlyContribution)} {currencySymbol}
          </p>
        )}
      </div>
      <p style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 8, lineHeight: 1.4 }}>{t("projection_hint")}</p>
    </WidgetCard>
  );
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: valueColor || "var(--ink)" }}>{value}</span>
    </div>
  );
}
