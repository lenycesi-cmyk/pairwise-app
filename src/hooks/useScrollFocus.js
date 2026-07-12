import { useEffect } from "react";

// Équivalent tactile du survol : sur les appareils sans curseur, on met en
// évidence la carte (.pw-card) qui traverse le centre vertical de l'écran
// pendant le scroll, en lui posant la classe .pw-card--focus (stylée en CSS
// comme le :hover desktop). Un IntersectionObserver avec une « bande centrale »
// fine (rootMargin ~-48% en haut et en bas) ne signale comme intersectant que
// la carte au milieu ; un MutationObserver rattache les cartes montées ensuite
// (changement d'onglet, chargement des données).
export function useScrollFocus() {
  useEffect(() => {
    // Uniquement sans vrai pointeur (mobile/tactile) — sur desktop le :hover fait
    // déjà le travail.
    if (window.matchMedia("(hover: hover)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          e.target.classList.toggle("pw-card--focus", e.isIntersecting);
        }
      },
      { rootMargin: "-48% 0px -48% 0px", threshold: 0 }
    );

    const scan = () => {
      // observe() est un no-op sur une cible déjà observée : pas besoin de
      // dédupliquer nous-mêmes.
      document.querySelectorAll(".pw-card").forEach((el) => io.observe(el));
    };
    scan();

    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}
