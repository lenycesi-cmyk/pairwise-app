// Composants d'UI partagés par les écrans d'onboarding (option A).
// Les constantes de style vivent dans onboardingStyles.js (react-refresh).
import { screenWrap } from "./onboardingStyles";

// Petit en-tête logo réutilisé sur l'accueil.
export function BrandRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          background: "var(--tang)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 800,
          fontSize: 15,
        }}
      >
        P
      </div>
      <span style={{ fontWeight: 700, fontSize: 15 }}>Pairwise</span>
    </div>
  );
}

// Écran d'attente pendant la création de l'espace / la migration du brouillon.
export function Splash({ text }) {
  return (
    <div style={{ ...screenWrap, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
      <i className="ti ti-loader-2 pw-spin" style={{ fontSize: 30, color: "var(--tang)" }} />
      <span style={{ fontSize: 14, color: "var(--ink-3)", textAlign: "center" }}>{text}</span>
    </div>
  );
}

// Jauge de mise en route "jamais à 0 %" (goal-gradient). Bandeau collé en haut.
export function SetupGauge({ pct, label }) {
  return (
    <div
      style={{
        flex: "none",
        padding: "12px 22px 13px",
        background: "var(--bg-card)",
        borderBottom: "0.5px solid var(--rule)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 7,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10.5,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--ink-3)",
          }}
        >
          <i className="ti ti-flag" style={{ fontSize: 13, color: "var(--tang)" }} />
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--tang)" }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: "var(--rule)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--tang), var(--amber))",
            borderRadius: 99,
            transition: "width .5s ease",
          }}
        />
      </div>
    </div>
  );
}

// Carte sélectionnable (solo/couple, mode de partage).
export function ChoiceCard({ icon, iconColor, title, body, selected, badge, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        width: "100%",
        border: `1.5px solid ${selected ? `var(${iconColor})` : "var(--rule)"}`,
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        padding: 17,
        marginBottom: 14,
        cursor: "pointer",
        boxShadow: selected ? "var(--shadow)" : "none",
        fontFamily: "inherit",
        color: "var(--ink)",
        display: "block",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `var(${iconColor}-light)`,
            color: `var(${iconColor})`,
          }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: 23 }} />
        </div>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16.5 }}>{title}</div>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: `var(${iconColor})`,
              background: `var(${iconColor}-light)`,
              borderRadius: 6,
              padding: "3px 7px",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)", margin: "12px 0 0" }}>
        {body}
      </p>
      {children}
    </button>
  );
}
