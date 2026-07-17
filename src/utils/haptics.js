// Feedback haptique centralisé pour la PWA mobile. `navigator.vibrate` n'existe
// que sur Android/Chrome (iOS Safari ne l'expose pas) : l'appel est donc
// strictement additif — s'il n'est pas supporté, on ne fait rien et rien ne
// casse. Respecte aussi `prefers-reduced-motion` (certains utilisateurs
// trouvent l'haptique désagréable) : une seule porte d'entrée pour tout couper.
//
// Grammaire des motifs (durées en ms) — voir la palette de "délice" :
//   tap     : accusé de réception discret (ajout, envoi, validation)
//   toggle  : le plus léger possible (switch, bascule)
//   success : petite montée festive (objectif atteint) — couplée aux confettis
//   error   : double buzz plus lourd (action refusée)
const PATTERNS = {
  tap: 15,
  toggle: 10,
  success: [20, 40, 60],
  error: [50, 30, 50],
};

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// haptic('tap' | 'toggle' | 'success' | 'error'). No-op silencieux si non
// supporté, si reduced-motion, ou si la clé est inconnue.
export function haptic(kind = "tap") {
  if (reducedMotion()) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const pattern = PATTERNS[kind];
  if (pattern == null) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Certains navigateurs lèvent si l'appel n'est pas issu d'un geste
    // utilisateur — on ignore, l'haptique reste purement accessoire.
  }
}
