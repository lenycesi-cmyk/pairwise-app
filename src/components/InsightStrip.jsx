import { useInsights } from "../hooks/useInsights";
import { useTranslation } from "../hooks/useTranslation";
import { useMediaQuery } from "../hooks/useMediaQuery";

// Couleur sémantique par tonalité (distincte de la couleur de marque).
const TONE = {
  positive: { color: "var(--sage)", tint: "color-mix(in srgb, var(--sage) 12%, transparent)" },
  neutral: { color: "var(--sky)", tint: "color-mix(in srgb, var(--sky) 12%, transparent)" },
  warning: { color: "var(--amber)", tint: "color-mix(in srgb, var(--amber) 14%, transparent)" },
  celebrate: { color: "var(--tang)", tint: "color-mix(in srgb, var(--tang) 12%, transparent)" },
};

// Bande « Pour toi » : insights dérivés des données du couple, sous le
// GreetingHeader. Cartes défilables horizontalement (façon stories), chacune
// masquable pour la semaine. Ne rend rien s'il n'y a aucun insight.
export default function InsightStrip({ displayCurrency }) {
  const t = useTranslation();
  const { insights, dismiss } = useInsights(displayCurrency);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (insights.length === 0) return null;
  const visible = insights.slice(0, isDesktop ? 4 : 3);

  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 8px" }}>
        {t("insight_strip_title")}
      </p>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          paddingBottom: 4,
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {visible.map((i) => {
          const tone = TONE[i.tone] || TONE.neutral;
          return (
            <div
              key={i.id}
              style={{
                position: "relative",
                flex: isDesktop ? "1 1 0" : "0 0 82%",
                minWidth: isDesktop ? 0 : "82%",
                scrollSnapAlign: "start",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                background: "var(--bg-card)",
                border: "0.5px solid var(--rule)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                padding: "12px 34px 12px 12px",
              }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: tone.tint }}>
                <i className={`ti ${i.icon}`} style={{ fontSize: 17, color: tone.color }} aria-hidden="true" />
              </span>
              <p style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.4, margin: 0, alignSelf: "center" }}>{i.text}</p>
              <button
                onClick={() => dismiss(i.id)}
                aria-label={t("insight_dismiss")}
                style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "var(--ink-3)", display: "flex", padding: 2 }}
              >
                <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
