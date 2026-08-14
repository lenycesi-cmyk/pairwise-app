import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";

// Feuille « Quoi de neuf ». Affichée au démarrage quand des notes ont été
// publiées depuis la dernière visite sur cet appareil, et rouvrable depuis les
// Réglages avec tout l'historique — sans cette seconde porte, une feuille
// refermée par réflexe serait perdue pour toujours.
export default function ReleaseNotesSheet({ releases, onClose, showAll = false }) {
  const t = useTranslation();
  const { language } = useFinance();
  const locale = language === "en" ? "en-US" : "fr-FR";

  if (!releases || releases.length === 0) return null;

  return (
    <div
      className="app-modal"
      style={{ display: "flex", flexDirection: "column", background: "color-mix(in srgb, var(--ink) 45%, transparent)" }}
      onClick={onClose}
    >
      <div style={{ margin: "auto", padding: "24px 20px", width: "100%", maxWidth: "var(--app-shell-width)" }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--bg-card)", border: "0.5px solid var(--rule)",
            borderRadius: "var(--radius-xl)", overflow: "hidden",
            maxHeight: "80dvh", display: "flex", flexDirection: "column",
          }}
        >
          <div style={{ padding: "20px 20px 4px", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
            <span
              style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                display: "grid", placeItems: "center", fontSize: 19,
                background: "color-mix(in srgb, var(--amber) 16%, transparent)",
              }}
              aria-hidden="true"
            >
              ✨
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, margin: 0, color: "var(--ink)" }}>
                {t("release_title")}
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
                {showAll ? t("release_all_subtitle") : t("release_subtitle")}
              </p>
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {releases.map((rel, i) => (
              <div
                key={rel.version}
                style={{
                  padding: i === 0 ? "16px 20px 0" : "16px 20px 0",
                  borderTop: i === 0 ? "none" : "0.5px solid var(--rule)",
                  marginTop: i === 0 ? 0 : 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>
                    {new Date(rel.date).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.05em",
                      padding: "2px 7px", borderRadius: 99,
                      background: "color-mix(in srgb, var(--sky) 14%, transparent)", color: "var(--sky)",
                    }}
                  >
                    {rel.version}
                  </span>
                </div>

                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 11 }}>
                  {rel.items.map((item, k) => {
                    const copy = item[language === "en" ? "en" : "fr"] || item.fr;
                    return (
                      <li key={k} style={{ display: "flex", gap: 9 }}>
                        <span style={{ flexShrink: 0, fontSize: 14, width: 18, textAlign: "center" }} aria-hidden="true">
                          {item.icon}
                        </span>
                        <span style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.45 }}>
                          <b style={{ color: "var(--ink)", fontWeight: 700 }}>{copy.title}</b>
                          {" — "}
                          {copy.body}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div style={{ height: 18 }} />
          </div>

          <div style={{ padding: "16px 20px 20px", flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{
                width: "100%", height: 46, borderRadius: "var(--radius-md)",
                background: "var(--ink)", color: "var(--bg)", border: "none",
                fontSize: 14.5, fontWeight: 600, fontFamily: "var(--font-display)", cursor: "pointer",
              }}
            >
              {t("release_dismiss")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
