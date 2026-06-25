import { useFinance } from "../context/FinanceContext";
import { THEMES } from "../data/themes";

export default function ThemeScreen({ onClose }) {
  const { theme, updateTheme } = useFinance();

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none" }}>
          <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
        </button>
        <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>Thème</h1>
        <div style={{ width: 20 }} />
      </div>

      <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.5 }}>
        Choisissez l'ambiance visuelle de l'application. Le changement s'applique
        immédiatement et est synchronisé entre vos deux appareils.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {THEMES.map((t) => (
          <button
            key={t.key}
            onClick={() => updateTheme(t.key)}
            style={{
              borderRadius: "var(--radius-lg)",
              border: theme === t.key ? "2px solid var(--sky)" : "0.5px solid var(--rule)",
              padding: "1rem",
              background: t.bg,
              cursor: "pointer",
              textAlign: "left",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: t.accent }} />
              <div
                style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: t.dark ? "#444" : "#fff",
                  border: "1px solid rgba(0,0,0,0.1)",
                }}
              />
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: t.dark ? "#fff" : "#1a1a1a" }}>
              {t.name}
            </p>
            {theme === t.key && (
              <i
                className="ti ti-check"
                style={{
                  position: "absolute", top: 10, right: 10,
                  fontSize: 16, color: "var(--sky)",
                }}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
