import { useState, useEffect } from "react";

// Largeur courante de la fenêtre, suivie en direct (rotation, redimensionnement).
// Sert à mettre l'en-tête de l'Accueil à l'échelle de l'appareil : la barre
// [menu | période | actions] est dessinée à une largeur de référence fixe puis
// réduite proportionnellement (boutons ET police) sur les téléphones plus
// étroits, au lieu de déborder — voir DashboardScreen.
export function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return width;
}
