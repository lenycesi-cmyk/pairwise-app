// Code d'invitation d'un espace couple.
//
// Le code EST l'identifiant du document Firestore (`couples/{code}`), il ne
// peut donc jamais changer. Ce n'est pas sa longueur qui le protège, c'est la
// fenêtre pendant laquelle il est acceptable : hors de cette fenêtre,
// `joinCouple` refuse, quel que soit le code fourni.

// Alphabet sans ambiguïté visuelle — ni O/0, ni I/1 — pour qu'un code se lise
// et se dicte à voix haute sans erreur. Exactement 32 caractères, ce qui divise
// 2^32 : le modulo ci-dessous est donc sans biais.
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

// Durée de validité d'une invitation fraîchement ouverte.
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateCoupleCode() {
  // `crypto.getRandomValues` et non `Math.random()` : ce code est un secret
  // d'invitation, et le générateur de `Math.random` est prédictible — quelques
  // tirages observés suffisent à reconstituer son état, donc à prédire les
  // codes suivants.
  const values = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(values);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CHARS[values[i] % CHARS.length];
  return code;
}

// Horodatage de fin de validité, à écrire sur le doc couple à la création ou
// lors d'une réouverture depuis les Réglages.
export function newInviteExpiry() {
  return Date.now() + INVITE_TTL_MS;
}
