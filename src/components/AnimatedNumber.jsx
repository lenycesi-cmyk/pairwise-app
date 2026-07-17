import { useEffect, useRef, useState } from "react";

// Chiffre-clé qui « compte » de sa valeur précédente jusqu'à la nouvelle en un
// court roulement (effet fintech premium : solde, patrimoine, totaux). Anime au
// montage (0 → valeur) puis à chaque changement de `value`. Respecte
// `prefers-reduced-motion` (affichage direct, sans animation).
//
// Props :
//   value    : nombre cible.
//   format   : (n) => string, appliqué à la valeur courante à chaque frame.
//   duration : ms (défaut 650).
// Le reste des props (className, style, …) est transmis au <span> hôte.
const prefersReduced =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function AnimatedNumber({ value = 0, format = (n) => Math.round(n).toLocaleString("fr-FR"), duration = 650, ...rest }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (prefersReduced || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    const start = performance.now();
    // easeOutCubic : rapide au début, se pose en douceur — cohérent avec --ease-out.
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setDisplay(from + (to - from) * ease(p));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span {...rest}>{format(display)}</span>;
}
