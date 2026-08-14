import { useEffect } from "react";

// Fait défiler juste ce qu'il faut pour qu'un panneau qui vient de s'ouvrir soit
// visible — les tiroirs « Catégorie » et « Sous-catégorie » de la saisie de
// transaction s'ouvraient sous le bord de l'écran, obligeant à faire défiler
// soi-même pour voir ce qu'on venait de demander.
//
// Trois règles, qui expliquent pourquoi ce n'est pas un simple
// `scrollIntoView` :
//
//   - Le pied « Enregistrer » est COLLANT : il recouvre le bas de la zone de
//     défilement. Aligner le tiroir sur ce bas le cacherait derrière le bouton,
//     d'où la marge de sécurité.
//   - On ne fait JAMAIS sortir le haut du tiroir de l'écran. Un tiroir plus haut
//     que la place disponible est révélé partiellement, par le haut : c'est là
//     que commencent les choix.
//   - Déjà visible ⇒ on ne bouge pas. Un défilement gratuit à chaque ouverture
//     serait plus désorientant que l'absence de défilement.

// Hauteur du pied collant « Enregistrer », plus une respiration.
const STICKY_FOOTER_SAFE = 88;

function findScroller(el) {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

export function useRevealOnOpen(open, ref) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Deux images : la première laisse React poser le tiroir, la seconde laisse
    // le navigateur en calculer la hauteur. Mesurer avant, c'est mesurer un
    // élément qui n'a pas encore de taille.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      const scroller = findScroller(el);
      if (!scroller) return;

      const elRect = el.getBoundingClientRect();
      const isPage = scroller === document.scrollingElement || scroller === document.documentElement;
      const top = isPage ? 0 : scroller.getBoundingClientRect().top;
      const bottom = isPage ? window.innerHeight : scroller.getBoundingClientRect().bottom;

      const hidden = elRect.bottom - (bottom - STICKY_FOOTER_SAFE);
      if (hidden <= 0) return; // déjà visible

      // Plafond : ce qui sépare le tiroir du haut de la zone visible, moins une
      // marge — au-delà, son en-tête sortirait par le haut.
      const room = Math.max(elRect.top - top - 12, 0);
      const delta = Math.min(hidden, room);
      if (delta <= 0) return;

      scroller.scrollBy({ top: delta, behavior: reduceMotion ? "auto" : "smooth" });
    }));

    return () => cancelAnimationFrame(id);
  }, [open, ref]);
}
