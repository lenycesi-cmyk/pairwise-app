// Opérations ÉLÉMENTAIRES sur les collections identifiées du document couple
// (budgets, assets, goals, loans, recurringTx, assetContributions).
//
// Lot 1 du mode Local. Jusqu'ici, chaque fonction de FinanceContext refaisait à
// la main son `[...budgets, nouveau]` ou son `.map(b => b.id === id ? … : b)`
// avant de réécrire le tableau entier. Quinze copies du même geste, donc quinze
// occasions de le faire subtilement différemment — et rien de testable.
//
// Ces fonctions sont PURES : elles ne mutent jamais l'entrée et ne connaissent
// ni Firestore ni React. C'est ce qui permettra à l'adaptateur local (journal
// d'opérations) de rejouer exactement la même sémantique que l'adaptateur
// Firestore, plutôt qu'une approximation.

/** Remplace l'élément de même `id` s'il existe, sinon ajoute à la fin. */
export function upsertIn(list, item) {
  const current = Array.isArray(list) ? list : [];
  if (!item?.id) return [...current, item];
  const index = current.findIndex((x) => x?.id === item.id);
  if (index === -1) return [...current, item];
  const next = [...current];
  next[index] = item;
  return next;
}

/**
 * Fusionne `updates` dans l'élément d'identifiant `id`.
 * Un identifiant inconnu laisse la liste inchangée : il vaut mieux ne rien
 * faire que créer un élément fantôme à partir d'un fragment de champs.
 */
export function patchIn(list, id, updates) {
  const current = Array.isArray(list) ? list : [];
  return current.map((x) => (x?.id === id ? { ...x, ...updates } : x));
}

/** Retire l'élément d'identifiant `id`. Inconnu ⇒ liste inchangée. */
export function removeFrom(list, id) {
  const current = Array.isArray(list) ? list : [];
  return current.filter((x) => x?.id !== id);
}

/** L'élément d'identifiant `id`, ou null. */
export function findIn(list, id) {
  return (Array.isArray(list) ? list : []).find((x) => x?.id === id) || null;
}
