import { useEffect, useRef } from "react";

// Fait en sorte que le bouton "retour" du téléphone (Android / geste iOS)
// ferme l'écran/modal courant au lieu de quitter l'application.
//
// L'app est une SPA sans router : sans intervention, un appui "retour" fait
// sortir de la PWA car aucune entrée d'historique n'a été empilée. Ici, chaque
// overlay actif empile UNE entrée d'historique à son ouverture ; un appui
// "retour" (événement popstate) déclenche le `onBack` de l'overlay le plus
// haut de la pile plutôt que de naviguer hors de l'app.
//
// Pile partagée entre toutes les instances du hook : le dernier overlay ouvert
// est le premier refermé (LIFO), ce qui gère aussi les modals imbriqués
// (ex. Réglages → Catégories).

const stack = [];
let ignoreNextPop = false;
let attached = false;

function handlePop() {
  // Entrée d'historique qu'on a nous-même consommée pour rééquilibrer après
  // une fermeture via l'UI — à ignorer.
  if (ignoreNextPop) {
    ignoreNextPop = false;
    return;
  }
  const top = stack[stack.length - 1];
  if (top) {
    // Sentinelle persistante (écran racine) : on ré-empile une entrée pour que
    // le "retour" ne quitte JAMAIS l'app depuis l'accueil, puis on notifie sans
    // dépiler la sentinelle.
    if (top.persistent) {
      window.history.pushState({ pwGuard: true }, "");
      top.onBack();
      return;
    }
    top.fromPop = true; // marque : fermé par le "retour", pas besoin de rééquilibrer
    top.onBack();
  }
}

export function useBackGuard(active, onBack, { persistent = false } = {}) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return;

    if (!attached) {
      window.addEventListener("popstate", handlePop);
      attached = true;
    }

    const entry = { onBack: () => onBackRef.current(), fromPop: false, persistent };
    stack.push(entry);
    window.history.pushState({ pwGuard: true }, "");

    return () => {
      const idx = stack.indexOf(entry);
      if (idx !== -1) stack.splice(idx, 1);
      // Fermé via l'UI (bouton X, etc.) : l'entrée d'historique qu'on avait
      // empilée est encore là, on la retire pour garder l'historique équilibré
      // (et on ignore le popstate que ça génère). Si la fermeture vient déjà
      // du "retour" (fromPop), l'entrée a déjà été consommée par le navigateur.
      if (!entry.fromPop) {
        ignoreNextPop = true;
        window.history.back();
      }
    };
  }, [active, persistent]);
}
