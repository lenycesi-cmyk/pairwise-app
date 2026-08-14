import { useEffect } from "react";

// Amène en haut de l'écran le panneau qui vient de s'ouvrir, dans la saisie de
// transaction — tiroirs Catégorie / Sous-catégorie, options de récurrence,
// partage avancé entre membres, tags, devises.
//
// L'objectif est explicite : ne plus avoir à faire défiler pour compléter une
// transaction. La première version ne révélait que le strict nécessaire, ce qui
// laissait le panneau collé au bas de l'écran, sans place pour ce qui suit. On
// le POSITIONNE donc désormais, plutôt que de le « rendre visible ».
//
// Trois choix qui expliquent le code :
//
//   - La cible n'est pas le bord supérieur mais 72 px en dessous : de quoi
//     laisser au-dessus la ligne qui a ouvert le panneau (« Choisir une
//     catégorie »), qui rappelle ce qu'on est en train de choisir.
//   - Le déplacement est appliqué même quand le panneau est DÉJÀ visible. Un
//     positionnement constant est plus prévisible qu'une règle qui agit parfois,
//     et c'est ce qui garantit la place en dessous.
//   - En deçà de 8 px, on ne bouge pas : à cette échelle, le mouvement se lit
//     comme un tremblement plutôt que comme une intention.

// Distance entre le haut de la zone visible et le haut du panneau.
const TOP_OFFSET = 72;

// En deçà, le déplacement ne vaut pas d'être joué.
const MIN_SHIFT = 8;

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

// Positionne un élément à `offset` px du haut de la zone visible. Exporté à part
// du hook parce que tous les déclencheurs ne sont pas des ouvertures de panneau :
// choisir un membre dans « Payé par / Pour » est un CLIC, pas un booléen qui
// bascule, et il doit pourtant dégager ce qui suit dans le formulaire.
export function revealElement(el, offset = TOP_OFFSET) {
  if (!el) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const scroller = findScroller(el);
    if (!scroller) return;
    const isPage = scroller === document.scrollingElement || scroller === document.documentElement;
    const viewportTop = isPage ? 0 : scroller.getBoundingClientRect().top;
    const delta = el.getBoundingClientRect().top - viewportTop - offset;
    if (Math.abs(delta) < MIN_SHIFT) return;
    scroller.scrollBy({ top: delta, behavior: reduceMotion ? "auto" : "smooth" });
  }));
}

export function useRevealOnOpen(open, ref) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;

    // Deux images : la première laisse React poser le panneau, la seconde laisse
    // le navigateur en calculer la hauteur. Mesurer avant, c'est mesurer un
    // élément qui n'a pas encore de taille.
    revealElement(el);
  }, [open, ref]);
}

// Décalage au FOCUS : plus serré que celui des panneaux, parce qu'ici l'enjeu
// n'est pas de montrer le champ — le doigt vient de le toucher — mais de
// dégager tout ce qui suit dans le formulaire.
const FOCUS_OFFSET = 16;

// Révèle le champ qui prend le focus dans un conteneur. Le focus n'est pas un
// panneau qui s'ouvre : aucun booléen ne bascule, et câbler chaque champ un par
// un aurait été aussi long qu'oubliable. Un seul écouteur sur le conteneur
// couvre donc tous les champs, présents et à venir.
export function useRevealOnFocus(containerRef, offset = FOCUS_OFFSET) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onFocusIn(e) {
      const target = e.target;
      if (!target?.matches?.("input, textarea, select")) return;
      revealElement(target, offset);

      // Le clavier réduit la zone visible APRÈS le focus : mesurer maintenant,
      // c'est mesurer un écran qui n'a pas encore rétréci. On rejoue donc une
      // fois qu'il est en place, puis on se désabonne — sans quoi le moindre
      // changement de hauteur ferait ensuite sauter la page.
      const vv = window.visualViewport;
      if (!vv) return;
      const replay = () => {
        revealElement(target, offset);
        vv.removeEventListener("resize", replay);
      };
      vv.addEventListener("resize", replay);
      // Garde-fou : si le clavier ne s'ouvre pas (souris, clavier physique),
      // l'écouteur ne doit pas rester en attente indéfiniment.
      setTimeout(() => vv.removeEventListener("resize", replay), 1000);
    }

    container.addEventListener("focusin", onFocusIn);
    return () => container.removeEventListener("focusin", onFocusIn);
  }, [containerRef, offset]);
}
