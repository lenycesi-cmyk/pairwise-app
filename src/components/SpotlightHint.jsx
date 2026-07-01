import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";

// First-visit overlay tour: dims the whole screen except a cutout around the
// current step's target element, with a callout and Précédent/Suivant/Got it
// controls. `steps` is an ordered list of { ref, text }; the tour advances
// through them and only marks the tab as seen (users/{uid}.seenHints) once
// the last step is dismissed. Also accepts the legacy single `targetRef`+
// `text` props for single-step tabs.
export default function SpotlightHint({ tabKey, steps, targetRef, text }) {
  const t = useTranslation();
  const { seenHints, markHintSeen } = useAuth();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const seen = !!seenHints[tabKey];

  const allSteps = steps || (targetRef ? [{ ref: targetRef, text }] : []);
  const current = allSteps[index];

  useEffect(() => {
    if (seen || !current) return;
    function updateRect() {
      if (current.ref.current) setRect(current.ref.current.getBoundingClientRect());
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [seen, current]);

  if (seen || !current || !rect) return null;

  const isLast = index === allSteps.length - 1;
  const pad = 6;
  const spotTop = rect.top - pad;
  const spotLeft = rect.left - pad;
  const spotWidth = rect.width + pad * 2;
  const spotHeight = rect.height + pad * 2;

  const spaceBelow = window.innerHeight - (spotTop + spotHeight);
  const showBelow = spaceBelow > 160;
  const tooltipWidth = 260;
  const tooltipLeft = Math.max(16, Math.min(spotLeft, window.innerWidth - tooltipWidth - 16));

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: spotTop,
          left: spotLeft,
          width: spotWidth,
          height: spotHeight,
          borderRadius: 14,
          boxShadow: "0 0 0 9999px rgba(10, 10, 20, 0.72)",
          border: "2px solid var(--sky)",
          zIndex: 500,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: showBelow ? spotTop + spotHeight + 12 : undefined,
          bottom: showBelow ? undefined : window.innerHeight - spotTop + 12,
          left: tooltipLeft,
          width: tooltipWidth,
          zIndex: 501,
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 16px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        {allSteps.length > 1 && (
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>
            {index + 1} / {allSteps.length}
          </p>
        )}
        <p style={{ fontSize: 13, color: "var(--ink)", marginBottom: 12, lineHeight: 1.45 }}>{current.text}</p>
        <div style={{ display: "flex", gap: 8 }}>
          {index > 0 && (
            <button
              onClick={() => setIndex((i) => i - 1)}
              aria-label={t("hint_previous")}
              style={{
                width: 38, padding: "9px 0", borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)", background: "var(--bg)", color: "var(--ink)",
              }}
            >
              <i className="ti ti-chevron-left" style={{ fontSize: 14 }} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={() => (isLast ? markHintSeen(tabKey) : setIndex((i) => i + 1))}
            style={{
              flex: 1, padding: "9px 0", borderRadius: "var(--radius-md)",
              border: "none", background: "var(--sky)", color: "#fff", fontSize: 13, fontWeight: 500,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}
          >
            {isLast ? t("hint_got_it") : (
              <>
                {t("hint_next")} <i className="ti ti-chevron-right" style={{ fontSize: 14 }} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
