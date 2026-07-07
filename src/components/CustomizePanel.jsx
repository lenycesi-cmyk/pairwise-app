import { useTranslation } from "../hooks/useTranslation";

// Panneau "personnaliser" partagé par Rapports / Patrimoine / Budget : liste
// les widgets de l'onglet avec un toggle œil affiché/masqué, dans le même
// langage visuel que le sélecteur de devise (chips dans une carte).
export default function CustomizePanel({ widgets, isVisible, toggle, style }) {
  const t = useTranslation();
  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16,
        background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        border: "0.5px solid var(--rule)", padding: "0.75rem 1rem",
        ...style,
      }}
    >
      {widgets.map((w) => {
        const on = isVisible(w.id);
        return (
          <button
            key={w.id}
            onClick={() => toggle(w.id)}
            style={{
              padding: "6px 10px", borderRadius: "var(--radius-md)",
              border: on ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
              background: on ? "var(--sky-light)" : "var(--bg)",
              color: on ? "var(--sky)" : "var(--ink-3)", fontSize: 12,
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <i className={`ti ${on ? "ti-eye" : "ti-eye-off"}`} style={{ fontSize: 13 }} aria-hidden="true" />
            {t(w.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

// Bouton crayon rond assorti aux boutons de navigation d'en-tête.
export function CustomizeButton({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 30, height: 30, borderRadius: "50%", background: "var(--bg-card)",
        border: "0.5px solid var(--rule)", display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0,
      }}
    >
      <i className="ti ti-pencil" style={{ fontSize: 14 }} aria-hidden="true" />
    </button>
  );
}
