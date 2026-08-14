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
export function unseenReleases() {
  const seen = read();
  if (!seen) return []; // première installation — voir seedReleasesIfFirstRun
  return RELEASE_NOTES.filter((r) => r.version > seen);
}

// Première ouverture sur cet appareil : on enregistre la version courante SANS
// rien afficher. Dérouler l'historique à quelqu'un qui découvre l'app n'aurait
// aucun sens, tout y est nouveau.
//
// Renvoie true si c'était bien une première ouverture.
export function seedReleasesIfFirstRun() {
  if (read()) return false;
  markReleasesSeen();
  return true;
}
