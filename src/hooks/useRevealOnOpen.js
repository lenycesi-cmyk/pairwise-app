import { useEffect, useRef } from "react";

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
  // Un panneau DÉJÀ ouvert au montage n'est pas un panneau « qui vient de
  // s'ouvrir » : rien ne s'est ouvert, l'écran vient d'apparaître. Le révéler
  // faisait défiler l'écran vers le bas dès son ouverture, avant la moindre
  // action — visible sur la saisie de transaction dès que le formulaire
  // s'initialise sur un partage avancé (pré-rempli d'après la dernière
  // transaction, ou à l'édition d'une transaction qui en porte un), et sur les
  // écrans dont un panneau est ouvert par défaut (récurrence « mensuelle »,
  // période « mensuelle » d'un budget). On ignore donc le premier passage.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!open || !ref.current) return;
    const el = ref.current;

    // Deux images : la première laisse React poser le panneau, la seconde laisse
    // le navigateur en calculer la hauteur. Mesurer avant, c'est mesurer un
    // élément qui n'a pas encore de taille.
    revealElement(el);
  }, [open, ref]);
}

// Décalage au FOCUS : quasiment le bord haut. L'enjeu n'est pas de montrer le
// champ — le doigt vient de le toucher — mais de dégager tout ce qui suit.
const FOCUS_OFFSET = 8;

// Ajoute au conteneur JUSTE la place qui manque pour que `target` puisse
// atteindre le haut.
//
// C'est la pièce sans laquelle aucun décalage ne suffit : un champ situé vers la
// fin du formulaire ne peut pas remonter, faute de contenu en dessous pour
// défiler. Le navigateur bute sur le bas et le champ reste au milieu de l'écran.
//
// La place est fournie par une CALE ajoutée en fin de conteneur, et non par une
// marge posée sur le conteneur lui-même : ce conteneur reçoit son `style` de
// React, qui peut le réécrire au premier rendu venu — et la frappe au clavier
// en provoque à chaque caractère. Une cale est un nœud à part, que React ne
// gère pas et ne peut donc pas effacer.
const ROOM_ATTR = "data-pw-room";

function roomSpacer(scroller) {
  let spacer = scroller.querySelector(`:scope > [${ROOM_ATTR}]`);
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.setAttribute(ROOM_ATTR, "");
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.flexShrink = "0"; // le corps est une colonne flex : sans ça, la cale s'écrase
    scroller.appendChild(spacer);
  }
  return spacer;
}

function ensureRoomBelow(scroller, target, offset) {
  // Pas de cale dans la page elle-même : le conteneur visé est la modale.
  if (scroller === document.scrollingElement || scroller === document.documentElement) return;

  const delta = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset;
  const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  const spacer = scroller.querySelector(`:scope > [${ROOM_ATTR}]`);
  const current = spacer ? parseFloat(spacer.style.height) || 0 : 0;
  // `remaining` inclut déjà la cale posée au passage précédent : on raisonne sur
  // la hauteur TOTALE nécessaire, sinon deux mesures successives l'empileraient.
  const needed = Math.max(current + delta - remaining, 0);
  if (needed <= 0) {
    if (spacer) spacer.style.height = "0px";
    return;
  }
  roomSpacer(scroller).style.height = `${needed}px`;
}

function releaseRoom(scroller) {
  const spacer = scroller?.querySelector?.(`:scope > [${ROOM_ATTR}]`);
  if (spacer) spacer.remove();
}

// Révèle le champ qui prend le focus dans un conteneur. Le focus n'est pas un
// panneau qui s'ouvre : aucun booléen ne bascule, et câbler chaque champ un par
// un aurait été aussi long qu'oubliable. Un seul écouteur sur le conteneur
// couvre donc tous les champs, présents et à venir.
export function useRevealOnFocus(containerRef, offset = FOCUS_OFFSET) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let releaseTimer = null;
    let padded = null;
    // Minuteries en vol, à annuler au démontage : sans ça, un `place()` tardif
    // ferait défiler une modale déjà fermée.
    let pending = [];

    function place(target) {
      const scroller = findScroller(target);
      if (!scroller) return;
      padded = scroller;
      ensureRoomBelow(scroller, target, offset);
      revealElement(target, offset);
    }

    function onFocusIn(e) {
      const field = e.target;
      if (!field?.matches?.("input, textarea, select")) return;
      // On positionne la CARTE de section, pas le champ nu : sinon son titre
      // (« Description », « Montant investi »…) passe au-dessus du bord et l'on
      // ne sait plus ce qu'on remplit. `.pw-lift` est la carte de section,
      // partagée par les formulaires de transaction et d'actif.
      const target = field.closest?.(".pw-lift") || field;
      clearTimeout(releaseTimer);
      pending.forEach(clearTimeout);
      pending = [];
      place(target);

      // Le clavier réduit la zone visible APRÈS le focus, et le moment où il le
      // fait n'est pas garanti : selon le navigateur, `visualViewport` émet un
      // `resize`, plusieurs, ou aucun. Un rendez-vous unique laissait donc le
      // champ à mi-hauteur quand il tombait au mauvais moment.
      //
      // On rejoue donc le placement quelques fois sur ~400 ms. C'est sans effet
      // visible une fois la position atteinte : en deçà de MIN_SHIFT, rien ne
      // bouge.
      const timers = [
        setTimeout(() => place(target), 150),
        setTimeout(() => place(target), 400),
      ];
      const vv = window.visualViewport;
      const replay = () => place(target);
      vv?.addEventListener("resize", replay);
      timers.push(setTimeout(() => vv?.removeEventListener("resize", replay), 1000));
      pending.push(...timers);
    }

    // Le délai évite de rendre puis reprendre la place en passant d'un champ à
    // l'autre : `focusout` précède le `focusin` suivant.
    function onFocusOut() {
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => releaseRoom(padded), 150);
    }

    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);
    return () => {
      clearTimeout(releaseTimer);
      pending.forEach(clearTimeout);
      releaseRoom(padded);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
    };
  }, [containerRef, offset]);
}
