// Variation du patrimoine net sur un mois glissant, lue depuis `netWorthHistory`
// (un point par jour, `{ date, value, currency }`).
//
// L'historique ne stocke qu'un agrégat quotidien : c'est exactement ce qu'il
// faut ici (le total net), et c'est aussi tout ce qu'on peut en tirer — aucune
// ventilation par actif n'y est enregistrée et elle ne se reconstitue pas après
// coup. La comparaison se fait donc au niveau du total, jamais par poste.

// Date de référence « il y a un mois », en ISO court (YYYY-MM-DD).
// Un 31 mars − 1 mois donne le 28/29 février plutôt qu'un débordement sur mars :
// `setMonth` reporterait sur le 2 ou 3 mars, ce qui rendrait la comparaison
// fausse d'un ou deux jours une fois par an.
export function oneMonthBefore(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const targetYear = m === 1 ? y - 1 : y;
  const targetMonth = m === 1 ? 12 : m - 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Point d'historique le plus récent dont la date est <= `cutoff`.
// On ne prend jamais un point postérieur : mieux vaut ne rien afficher qu'une
// variation calculée sur une base plus récente que le mois annoncé.
export function entryOnOrBefore(history, cutoff) {
  let best = null;
  for (const h of history || []) {
    if (!h?.date || h.date > cutoff) continue;
    if (!best || h.date > best.date) best = h;
  }
  return best;
}

/**
 * Variation du patrimoine net entre aujourd'hui et il y a un mois.
 *
 * @param {Array}  history        `netWorthHistory` — [{ date, value, currency }]
 * @param {number} currentValue   patrimoine net actuel, en devise d'affichage
 * @param {string} displayCurrency devise d'affichage
 * @param {Function} convert      (montant, from, to) => montant converti
 * @param {string} [today]        date de référence ISO (par défaut : aujourd'hui)
 * @returns {{ amount: number, pct: number, from: number } | null}
 *          `null` quand l'historique ne remonte pas à un mois — dans ce cas il
 *          n'y a pas de variation à montrer, ce qui n'est pas la même chose
 *          qu'une variation nulle.
 */
export function netWorthMonthlyDelta(history, currentValue, displayCurrency, convert, today) {
  if (!Number.isFinite(currentValue)) return null;
  const ref = today || new Date().toISOString().slice(0, 10);
  const cutoff = oneMonthBefore(ref);
  if (!cutoff) return null;

  const past = entryOnOrBefore(history, cutoff);
  if (!past || !Number.isFinite(past.value)) return null;

  const from = convert(past.value, past.currency || displayCurrency, displayCurrency);
  if (!Number.isFinite(from)) return null;

  const amount = currentValue - from;
  // Un patrimoine parti de zéro (ou négatif) n'a pas de pourcentage lisible :
  // on renvoie le montant seul plutôt qu'un ratio absurde.
  const pct = from > 0 ? (amount / from) * 100 : null;
  return { amount, pct, from };
}
