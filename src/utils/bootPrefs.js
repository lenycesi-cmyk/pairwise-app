// Cache local des préférences d'AFFICHAGE nécessaires dès la première frame.
//
// Le thème et les 4 onglets de la barre du bas sont stockés PAR MEMBRE dans le
// document du couple (`themePrefs.{memberKey}`, `navTabs.{memberKey}`). Au
// démarrage ce document n'est pas encore arrivé : sans cache, l'app peint
// d'abord le thème clair et les onglets par défaut, puis se corrige une seconde
// plus tard — le clignotement signalé.
//
// On mémorise donc la valeur **déjà résolue** (et non la map indexée par
// membre : au boot on ne connaît pas encore sa propre clé, qui vient du même
// instantané). Firestore reste la source de vérité — ce cache ne fait
// qu'avancer l'affichage, et la valeur réelle le remplace dès son arrivée.
//
// Tout est enveloppé : `localStorage` lève en navigation privée sur certains
// navigateurs, et une préférence d'affichage ne doit jamais casser le démarrage.

const THEME_KEY = "pw:boot:theme";
const NAV_TABS_KEY = "pw:boot:navTabs";

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : on se contente du défaut au prochain démarrage */
  }
}

export function readBootTheme() {
  return read(THEME_KEY);
}

export function writeBootTheme(themeKey) {
  if (themeKey) write(THEME_KEY, themeKey);
}

export function readBootNavTabs() {
  const raw = read(NAV_TABS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeBootNavTabs(tabs) {
  if (Array.isArray(tabs) && tabs.length > 0) write(NAV_TABS_KEY, JSON.stringify(tabs));
}
