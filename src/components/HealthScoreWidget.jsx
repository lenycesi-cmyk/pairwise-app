import { useState } from "react";
import { useHealthScore } from "../hooks/useHealthScore";
import { useTranslation } from "../hooks/useTranslation";
import { useFinance } from "../context/FinanceContext";
import { getMemberKey } from "../utils/members";

const BAND_COLOR = {
  great: "var(--sage)",
  good: "var(--sky)",
  watch: "var(--amber)",
  fragile: "var(--red)",
};

const PILLAR_EMOJI = {
  savings: "💰",
  budgets: "🎯",
  balance: "⚖️",
  emergency: "🛟",
  recurring: "🔁",
};

// Point sur un demi-arc (0 = gauche, 100 = droite), y vers le bas en SVG.
function pointOnArc(cx, cy, r, value) {
  const theta = Math.PI - (value / 100) * Math.PI;
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

function arcPath(cx, cy, r, from, to) {
  const a = pointOnArc(cx, cy, r, from);
  const b = pointOnArc(cx, cy, r, to);
  const largeArc = to - from > 50 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${largeArc} 1 ${b.x} ${b.y}`;
}

export default function HealthScoreWidget({ displayCurrency }) {
  const t = useTranslation();
  const { members } = useFinance();
  // null = vue couple ; sinon uid du membre sélectionné.
  const [scopeUid, setScopeUid] = useState(null);
  const { score, band, pillars, hasData } = useHealthScore(displayCurrency, scopeUid);
  const [open, setOpen] = useState(false);

  // Titre DANS la carte, précédé d'une pastille d'icône teintée (même motif
  // que les WidgetCard du Dashboard).
  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <span className="pw-chip" style={{ width: 32, height: 32, borderRadius: 10, background: "var(--tang-light)", "--pw-chip": "var(--tang)", flexShrink: 0 }}>
        <i className="ti ti-activity-heartbeat" style={{ fontSize: 16, color: "var(--tang)" }} aria-hidden="true" />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-display)", flex: 1 }}>{t("health_title")}</span>
    </div>
  );

  // Sélecteur couple / membre — visible dès qu'il y a au moins 2 membres.
  const scopePicker = members.length > 1 && (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
      {[{ uid: null, label: t("health_scope_couple") }, ...members.map((m) => ({ uid: getMemberKey(m), label: m.name }))].map((s) => (
        <button
          key={s.uid ?? "couple"}
          onClick={() => setScopeUid(s.uid)}
          style={{
            padding: "4px 12px", borderRadius: 99, fontSize: 11.5,
            border: scopeUid === s.uid ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
            background: scopeUid === s.uid ? "var(--sky-light)" : "var(--bg)",
            color: scopeUid === s.uid ? "var(--sky)" : "var(--ink-2)",
            fontWeight: scopeUid === s.uid ? 500 : 400,
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  if (!hasData) {
    return (
      <div className="pw-card pw-chip-host" data-accent="coral" style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "1rem 1.25rem" }}>
        {header}
        {scopePicker}
        <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "0.5rem 0" }}>{t("health_empty")}</p>
      </div>
    );
  }

  const color = BAND_COLOR[band];
  const W = 220, H = 124, cx = W / 2, cy = 112, r = 92;

  return (
    <div className="pw-card pw-chip-host" data-accent="coral" style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "1rem 1.25rem" }}>
      {header}
      {scopePicker}
      <div>
        {/* Jauge demi-arc : l'arc se remplit avec un gradient rouge → vert
            proportionnel au score ; le chiffre seul reste au centre (plus
            d'aiguille ni de repères parasites). */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${score}/100`}>
            <defs>
              {/* Gradient fixé sur toute la largeur de l'arc : la pointe de
                  l'arc rempli prend donc la couleur correspondant au score. */}
              <linearGradient id="healthGaugeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--red)" />
                <stop offset="50%" stopColor="var(--amber)" />
                <stop offset="100%" stopColor="var(--sage)" />
              </linearGradient>
            </defs>
            <path d={arcPath(cx, cy, r, 0, 100)} fill="none" stroke="var(--rule)" strokeWidth={12} strokeLinecap="round" />
            <path
              d={arcPath(cx, cy, r, 0, Math.max(score, 2))}
              fill="none"
              stroke="url(#healthGaugeGradient)"
              strokeWidth={12}
              strokeLinecap="round"
            />
            <text x={cx} y={cy - 28} textAnchor="middle" fontSize={38} fontWeight="700" fill={color} fontFamily="var(--font-display)">{score}</text>
          </svg>
        </div>
        <p style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color, marginTop: -4 }}>
          {t(`health_band_${band}`)}
        </p>

        {/* Mini-pastilles par pilier */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 12 }}>
          {pillars.map((p) => (
            <span
              key={p.key}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 9px", borderRadius: 99, fontSize: 11.5,
                background: "var(--bg)", border: `0.5px solid ${BAND_COLOR[p.band]}`,
                color: BAND_COLOR[p.band],
              }}
            >
              {PILLAR_EMOJI[p.key]} {Math.round(p.score)}
            </span>
          ))}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 4, margin: "12px auto 0", background: "none", border: "none", color: "var(--sky)", fontSize: 12 }}
        >
          {open ? t("health_hide") : t("health_why")}
          <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 12 }} aria-hidden="true" />
        </button>

        {open && (
          <div style={{ marginTop: 10, borderTop: "0.5px solid var(--rule)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
            {pillars.map((p) => (
              <PillarRow key={p.key} pillar={p} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

function PillarRow({ pillar, t }) {
  const { key, score, band, detail, effectiveWeight } = pillar;
  const color = BAND_COLOR[band];

  let explain = "";
  let action = "";
  if (key === "savings") {
    explain = t("health_savings_explain").replace("{rate}", pct(detail.savingsRate));
    if (score < 70) action = t("health_savings_action");
  } else if (key === "budgets") {
    explain = detail.overCount === 0
      ? t("health_budgets_explain_ok")
      : t("health_budgets_explain").replace("{over}", detail.overCount).replace("{count}", detail.count);
    if (score < 70) action = t("health_budgets_action");
  } else if (key === "balance") {
    explain = t("health_balance_explain")
      .replace("{essential}", pct(detail.shares.essential))
      .replace("{fun}", pct(detail.shares.fun))
      .replace("{investment}", pct(detail.shares.investment));
    if (score < 70) action = t("health_balance_action");
  } else if (key === "emergency") {
    const months = t("health_months").replace("{n}", detail.months.toFixed(1));
    explain = t("health_emergency_explain").replace("{months}", months);
    if (score < 70) action = t("health_emergency_action");
  } else if (key === "recurring") {
    explain = t("health_recurring_explain").replace("{ratio}", pct(detail.ratio));
    if (score < 70) action = t("health_recurring_action");
  }

  return (
    <div style={{ display: "flex", gap: 10 }}>
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: "20px" }}>{PILLAR_EMOJI[key]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{t(`health_pillar_${key}`)}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color }}>{Math.round(score)}<span style={{ color: "var(--ink-3)", fontWeight: 400 }}> · {effectiveWeight}%</span></span>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>{explain}</p>
        {action && (
          <p style={{ fontSize: 11.5, color: "var(--sky)", marginTop: 3, display: "flex", alignItems: "flex-start", gap: 4 }}>
            <i className="ti ti-bulb" style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            {action}
          </p>
        )}
      </div>
    </div>
  );
}
