// Décalage bas MANUEL de la barre d'onglets, propre à l'appareil (localStorage,
// non synchronisé entre partenaires) : certains Android en PWA n'exposent pas
// safe-area-inset-bottom ET laissent le contenu passer sous la barre système →
// la barre d'onglets se retrouve derrière. Ce cas n'étant pas détectable de
// façon fiable en JS (l'inset renvoie 0 comme sur les appareils sans souci), on
// laisse l'utilisateur concerné remonter la barre depuis les Réglages.
const KEY = "pw_nav_offset";
const OFFSET_PX = 48;

export function getNavOffset() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function applyNavOffset() {
  document.documentElement.style.setProperty("--nav-fallback", getNavOffset() ? `${OFFSET_PX}px` : "0px");
}

export function setNavOffset(on) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* stockage indisponible : on applique quand même pour la session */
  }
  applyNavOffset();
}
