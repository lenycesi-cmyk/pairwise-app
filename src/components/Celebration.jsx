import { useEffect, useState, useRef } from "react";
import { haptic } from "../utils/haptics";

// Moment de "délice" plein écran : une salve de confettis + une pastille
// checkmark à ressort, sans aucune dépendance externe (tout en CSS, voir
// index.css). Déclenché n'importe où dans l'app via :
//   window.dispatchEvent(new CustomEvent("pw-celebrate", { detail: { label } }))
// ou l'assistant `celebrate(label)` exporté plus bas.
//
// Monté une seule fois (globalement) dans App.jsx. Sous prefers-reduced-motion
// on montre juste la pastille en fondu, sans confettis qui volent.

const COLORS = ["#f56346", "#ff7458", "#ffb347", "#4ecdc4", "#5b8def", "#c58bff"];
const PIECE_COUNT = 28;

// Confettis générés une fois par salve : position horizontale, dérive, couleur,
// délai et durée aléatoires pour un rendu naturel.
function makePieces() {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    drift: (Math.random() - 0.5) * 160,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 120,
    duration: 900 + Math.random() * 700,
    rotate: Math.random() * 360,
    size: 7 + Math.random() * 6,
  }));
}

export default function Celebration() {
  const [burst, setBurst] = useState(null); // { label, pieces } | null
  const timerRef = useRef(null);

  useEffect(() => {
    function onCelebrate(e) {
      haptic("success");
      setBurst({ label: e.detail?.label || "", pieces: makePieces() });
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBurst(null), 2200);
    }
    window.addEventListener("pw-celebrate", onCelebrate);
    return () => {
      window.removeEventListener("pw-celebrate", onCelebrate);
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!burst) return null;

  return (
    <div className="pw-celebration" role="status" aria-live="polite">
      <div className="pw-celebration-confetti" aria-hidden="true">
        {burst.pieces.map((p) => (
          <span
            key={p.id}
            className="pw-confetti"
            style={{
              left: `${p.left}%`,
              background: p.color,
              width: `${p.size}px`,
              height: `${p.size * 0.6}px`,
              "--pw-drift": `${p.drift}px`,
              "--pw-rot": `${p.rotate}deg`,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
            }}
          />
        ))}
      </div>
      <div className="pw-celebration-badge pw-pop-spring">
        <i className="ti ti-check" aria-hidden="true" />
        {burst.label && <span>{burst.label}</span>}
      </div>
    </div>
  );
}
