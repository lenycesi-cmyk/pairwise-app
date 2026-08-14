import { RELEASE_NOTES, LATEST_RELEASE } from "../data/releaseNotes";

// Dernière version de notes VUE, gardée sur l'appareil.
//
// Une mise à jour est propre à une installation, pas à un compte : ouvrir l'app
// sur un second téléphone, c'est bien une nouveauté pour ce téléphone-là. Le
// corollaire est assumé — le/la partenaire verra la feuille de son côté,
// indépendamment.
const KEY = "pw:lastSeenRelease";

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    // Navigation privée : on préfère ne rien montrer plutôt que de rejouer la
    // feuille à chaque ouverture.
    return LATEST_RELEASE;
  }
}

export function markReleasesSeen() {
  try {
    if (LATEST_RELEASE) localStorage.setItem(KEY, LATEST_RELEASE);
  } catch {
    /* stockage indisponible : la feuille se refermera quand même */
  }
}

// Les notes publiées DEPUIS la dernière visite, de la plus récente à la plus
// ancienne. On renvoie tout ce qui a été manqué, pas seulement la dernière
// version : revenir après trois semaines, c'est avoir sauté plusieurs lots, et
// n'en montrer qu'un cacherait le reste sans le dire.
// Dépend de `seedReleasesIfFirstRun`, appelé juste avant côté App : une VRAIE
// première ouverture y a déjà été estampillée, donc arriver ici sans clé
// signifie une installation en place qui n'a encore rien vu — on lui montre
// tout. Renvoyer une liste vide ici, comme le faisait la première version,
// privait de la toute première note ceux qui utilisaient déjà l'app.
export function unseenReleases() {
  const seen = read();
  if (!seen) return RELEASE_NOTES;
  return RELEASE_NOTES.filter((r) => r.version > seen);
}

// L'app a-t-elle DÉJÀ servi sur cet appareil ? On le déduit de la présence
// d'une autre clé PairWise : thème mémorisé au boot, onglets, masquage des
// montants, brouillon d'inscription.
//
// Sans cette question, « pas de clé de version vue » se confondait avec
// « première ouverture » — or c'est le cas de TOUTE installation existante le
// jour où la fonctionnalité paraît. Chaque utilisateur en place perdait donc
// silencieusement la première note, la seule qui annonçait la fonctionnalité.
function hasUsedAppBefore() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== KEY && (k.startsWith("pw:") || k.startsWith("pw_"))) return true;
    }
  } catch {
    /* stockage indisponible : on ne peut rien affirmer */
  }
  return false;
}

// Première ouverture sur cet appareil : on enregistre la version courante SANS
// rien afficher. Dérouler l'historique à quelqu'un qui découvre l'app n'aurait
// aucun sens, tout y est nouveau.
//
// Une installation déjà utilisée n'est PAS une première ouverture, même sans
// clé de version : elle doit voir les notes.
//
// Renvoie true si c'était bien une première ouverture.
export function seedReleasesIfFirstRun() {
  if (read()) return false;
  if (hasUsedAppBefore()) return false;
  markReleasesSeen();
  return true;
}
