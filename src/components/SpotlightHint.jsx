import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";

// First-visit overlay tip: dims the whole screen except a cutout around
// `targetRef`'s element, with a callout pointing at it and a "Got it"
// button. Shown once per tab (per user, via users/{uid}.seenHints), then
// never again. Replaces the earlier plain dismissible banner, which user
// testing found too easy to miss — the spotlight makes the highlighted
// element genuinely stand out instead of blending into the page.
export default function SpotlightHint({ tabKey, targetRef, text }) {
  const t = useTranslation();
  const { seenHints, markHintSeen } = useAuth();
  const [rect, setRect] = useState(null);
  const seen = !!seenHints[tabKey];

  useEffect(() => {
    if (seen) return;
    function updateRect() {
      if (targetRef.current) {
        setRect(targetRef.current.getBoundingClientRect());
      }
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [seen, targetRef]);

  if (seen || !rect) return null;

  const pad = 6;
  const spotTop = rect.top - pad;
  const spotLeft = rect.left - pad;
  const spotWidth = rect.width + pad * 2;
  const spotHeight = rect.height + pad * 2;

  const spaceBelow = window.innerHeight - (spotTop + spotHeight);
  const showBelow = spaceBelow > 140;
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
        <p style={{ fontSize: 13, color: "var(--ink)", marginBottom: 12, lineHeight: 1.45 }}>{text}</p>
        <button
          onClick={() => markHintSeen(tabKey)}
          style={{
            width: "100%",
            padding: "9px 0",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "var(--sky)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {t("hint_got_it")}
        </button>
      </div>
    </>
  );
}
