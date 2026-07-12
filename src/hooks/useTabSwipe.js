import { useEffect, useRef } from "react";

// Navigation entre onglets par glissement horizontal (mobile). Un swipe vers la
// gauche avance dans `order`, vers la droite recule. Ne se déclenche que si le
// mouvement est nettement horizontal (pour ne pas gêner le défilement vertical
// ni les contenus scrollables horizontalement), assez ample et assez rapide, et
// seulement sur petit écran (le desktop a la sidebar). `enabledRef` permet de
// couper la navigation quand un overlay/modale est ouvert sans réattacher les
// écouteurs à chaque rendu.
export function useTabSwipe({ order, active, onChange, enabledRef }) {
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let x0 = null, y0 = null, t0 = 0;

    const onStart = (e) => {
      if (e.touches.length !== 1) { x0 = null; return; }
      const tch = e.touches[0];
      x0 = tch.clientX; y0 = tch.clientY; t0 = Date.now();
    };
    const onEnd = (e) => {
      if (x0 == null) return;
      const tch = e.changedTouches[0];
      const dx = tch.clientX - x0;
      const dy = tch.clientY - y0;
      const dt = Date.now() - t0;
      x0 = null;

      if (window.innerWidth >= 1024) return;
      if (enabledRef && !enabledRef.current) return;
      if (dt > 600) return;
      // Horizontal franc : amplitude suffisante et clairement plus horizontal
      // que vertical.
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;

      const i = order.indexOf(activeRef.current);
      if (i < 0) return;
      const next = dx < 0 ? i + 1 : i - 1;
      if (next < 0 || next >= order.length) return;
      onChange(order[next]);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
    // order/onChange stables ; on n'a pas besoin de réattacher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
