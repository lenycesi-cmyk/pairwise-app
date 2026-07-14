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

// Refonte 1B : la jauge prend la couleur SÉMANTIQUE de la bande (plate, comme la
// maquette) — great = good, good = sky, watch = warn (ambre), fragile = over.
const BAND_SEM = {
  great: "var(--good)",
  good: "var(--sky)",
  watch: "var(--warn)",
  fragile: "var(--over)",
};

// Point sur un demi-arc (0 = gauche, 100 = droite), y vers le bas en SVG.
function pointOnArc(cx, cy, r, value) {
  const theta = Math.PI - (value / 100) * Math.PI;
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

function arcPath(cx, cy, r, from, to) {
  const a = pointOnArc(cx, cy, r, from);
  const b = pointOnArc(cx, cy, r, to);
  // Sur un demi-cercle (0→100 = 180°), l'arc entre deux valeurs ne dépasse
  // jamais 180°, donc on prend toujours le PETIT arc (largeArc = 0). Un seuil
  // basé sur (to - from) faisait basculer sur le grand arc dès score > 50, ce
  // qui faisait « déborder » le remplissage par l'extérieur.
  const largeArc = to - from > 100 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${largeArc} 1 ${b.x} ${b.y}`;
}

export default function HealthScoreWidget({ displayCurrency }) {
  const t = useTranslation();
  const { members } = useFinance();
  // null = vue couple ; sinon uid du membre sélectionné.
  const [scopeUid, setScopeUid] = useState(null);
  const { score, band, pillars, hasData } = useHealthScore(displayCurrency, scopeUid);
  const [open, setOpen] = useState(false);

  // Carte en colonne flex : en-tête + éventuel pied (filtres) figés, corps
  // défilant au milieu — cohérent avec le plafonnement de hauteur du Dashboard.
  const cardStyle = {
    background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)",
    overflow: "hidden", display: "flex", flexDirection: "column", height: "100%",
  };

  // En-tête refonte 1B : pastille ambre + titre + lien « Détail » (déplie le
  // décompte par pilier).
  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 0", flexShrink: 0 }}>
      <span className="pw-chip" style={{ width: 32, height: 32, borderRadius: 10, background: "var(--amber-light)", "--pw-chip": "var(--amber)", flexShrink: 0 }}>
        <i className="ti ti-activity-heartbeat" style={{ fontSize: 16, color: "var(--amber)" }} aria-hidden="true" />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-display)", flex: 1 }}>{t("health_title")}</span>
      {hasData && (
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}
        >
          {t("dashboard_detail")} <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-right"}`} style={{ fontSize: 14 }} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  // Filtres couple / membre en BAS, centrés (chip actif discret) — visibles dès
  // qu'il y a au moins 2 membres.
  const scopePicker = members.length > 1 && (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "12px 18px 16px", flexShrink: 0 }}>
      {[{ uid: null, label: t("health_scope_couple") }, ...members.map((m) => ({ uid: getMemberKey(m), label: m.name }))].map((s) => {
        const on = scopeUid === s.uid;
        return (
          <button
            key={s.uid ?? "couple"}
            onClick={() => setScopeUid(s.uid)}
            style={{
              padding: "3px 10px", borderRadius: 99, fontSize: 11.5, border: "none",
              background: on ? "color-mix(in srgb, var(--ink) 6%, transparent)" : "transparent",
              color: on ? "var(--ink-2)" : "var(--ink-3)", fontWeight: on ? 600 : 400,
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );

  if (!hasData) {
    return (
      <div className="pw-card pw-chip-host" data-accent="amber" style={cardStyle}>
        {header}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 18px 16px" }}>
          <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "0.5rem 0" }}>{t("health_empty")}</p>
        </div>
        {scopePicker}
      </div>
    );
  }

  const gaugeColor = BAND_SEM[band] || "var(--warn)";
  const W = 220, H = 116, cx = W / 2, cy = 108, r = 92;

  return (
    <div className="pw-card pw-chip-host" data-accent="amber" style={cardStyle}>
      {header}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 18px 6px" }}>
        {/* Jauge demi-arc plate en couleur de bande, chiffre + libellé au centre. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 200 }} role="img" aria-label={`${score}/100`}>
            <path d={arcPath(cx, cy, r, 0, 100)} fill="none" stroke="var(--rule)" strokeWidth={14} strokeLinecap="round" />
            {score > 0 && (
              <path d={arcPath(cx, cy, r, 0, Math.min(Math.max(score, 1.5), 100))} fill="none" stroke={gaugeColor} strokeWidth={14} strokeLinecap="round" />
            )}
            <text x={cx} y={cy - 22} textAnchor="middle" fontSize={34} fontWeight="700" fill={gaugeColor} fontFamily="var(--font-display)">{score}</text>
          </svg>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: -6 }}>
            / 100 · <span style={{ color: gaugeColor, fontWeight: 600 }}>{t(`health_band_${band}`)}</span>
          </div>
        </div>

        {open && (
          <div style={{ marginTop: 14, borderTop: "0.5px solid var(--rule)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {pillars.map((p) => (
              <PillarRow key={p.key} pillar={p} t={t} />
            ))}
          </div>
        )}
      </div>
      {scopePicker}
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
