// Archivage — « ranger » plutôt que supprimer.
//
// Un élément archivé porte un `archivedAt` (timestamp ms). Rien n'est déplacé :
// il reste dans le MÊME tableau, sur le même document couple, et c'est la
// LECTURE qui le met de côté. C'est ce qui garde son détail intégralement
// consultable — il n'a pas bougé, donc aucune vue de repli à réimplémenter et
// aucune reprise de données à faire.
//
// Le filtre vit dans FinanceContext, à un seul endroit : `budgets` et `goals`
// exposés par le contexte sont les ACTIFS, et les écrans qui veulent l'archive
// lisent `archivedBudgets` / `archivedGoals`. Filtrer chez les consommateurs
// aurait voulu dire le refaire dans useBudgetProgress, useBudgetSnapshots,
// useGoalProgress et les widgets — et en oublier un.

export function isArchived(item) {
  return Boolean(item && item.archivedAt);
}

// Sépare une liste en { active, archived }. `active` GARDE l'ordre d'origine
// (celui du glisser-déposer), `archived` est trié du plus récemment archivé au
// plus ancien : dans une archive, ce qu'on vient de ranger est ce qu'on cherche.
export function partitionArchived(list) {
  const active = [];
  const archived = [];
  for (const item of list || []) {
    (isArchived(item) ? archived : active).push(item);
  }
  archived.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  return { active, archived };
}

// Réapplique un ordre décidé sur les seuls éléments ACTIFS au tableau complet.
//
// Sans ça, le glisser-déposer effacerait l'archive : l'écran ne connaît plus que
// les actifs, et `replaceList` réécrit le tableau entier. On replace donc les
// archivés à la fin, dans leur ordre de stockage.
export function mergeReorder(orderedActive, fullList) {
  const archived = (fullList || []).filter(isArchived);
  return [...orderedActive, ...archived];
}

// Tags archivés — un cas à part, et volontairement SANS stockage.
//
// `customTags` n'est qu'une liste ordonnée de chaînes ; la vérité vit sur les
// transactions (`tx.tags`). Retirer un tag de la liste ne supprime donc rien du
// tout : les transactions le portent toujours et le rapport par tag continue de
// l'afficher. « L'archive » est exactement cette différence — les tags encore
// portés, absents de la liste — donc une lecture calculée, que rien ne peut
// désynchroniser.
//
// Un tag retiré que PLUS AUCUNE transaction ne porte n'apparaît pas : il ne
// laisse aucune trace nulle part, il n'y a rien à retrouver.
//
// @returns {Array<{tag: string, count: number}>} du plus utilisé au moins utilisé
export function archivedTags(customTags, transactions) {
  const listed = new Set(customTags || []);
  const counts = new Map();
  for (const tx of transactions || []) {
    for (const tag of tx.tags || []) {
      if (listed.has(tag)) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
