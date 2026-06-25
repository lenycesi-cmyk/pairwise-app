import { useFinance } from "../context/FinanceContext";

const LANGUAGES = [
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "en", name: "English", flag: "🇬🇧" },
];

export default function LanguageScreen({ onClose }) {
  const { language, updateLanguage } = useFinance();

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none" }}>
          <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
        </button>
        <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>Langue</h1>
        <div style={{ width: 20 }} />
      </div>

      <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.5 }}>
        D'autres langues seront ajoutées prochainement.
      </p>

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          overflow: "hidden",
        }}
      >
        {LANGUAGES.map((l, i) => (
          <button
            key={l.code}
            onClick={() => updateLanguage(l.code)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: "none",
              border: "none",
              borderBottom: i < LANGUAGES.length - 1 ? "0.5px solid var(--rule)" : "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 20 }}>{l.flag}</span>
            <span style={{ fontSize: 14, flex: 1, textAlign: "left", color: "var(--ink)" }}>
              {l.name}
            </span>
            {language === l.code && (
              <i className="ti ti-check" style={{ fontSize: 16, color: "var(--sky)" }} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
