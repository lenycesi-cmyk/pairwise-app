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

// Indicateur d'étape "Étape n/total" + pastilles (n remplies, reste vides).
// Remplace la jauge en % : repère de progression plus clair sur un parcours
// court. Bandeau collé en haut, centré.
export function StepDots({ current, total, label, onBack }) {
  return (
    <div
      style={{
        position: "relative",
        flex: "none",
        padding: "13px 22px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Retour"
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", display: "flex", color: "var(--ink-3)", cursor: "pointer", padding: 4 }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 22 }} />
        </button>
      )}
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-3)",
        }}
      >
        {label}{" "}
        <span style={{ color: "var(--tang)" }}>
          {current}/{total}
        </span>
      </span>
      <div style={{ display: "flex", gap: 7 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            style={{
              width: i < current ? 22 : 8,
              height: 8,
              borderRadius: 99,
              transition: "width .3s ease, background .3s ease",
              background: i < current ? "var(--tang)" : "transparent",
              border: i < current ? "none" : "1.5px solid var(--rule)",
            }}
          />
        ))}
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
