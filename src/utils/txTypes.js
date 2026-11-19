// Le TYPE d'une transaction — "income", "expense" ou "investment" — et les
// catégories qui vont avec.
//
// Cette règle vivait en DEUX exemplaires identiques, dans AddTransactionScreen
// et RecurringScreen ; le filtre par type de l'historique en aurait fait un
// troisième. Elle vit ici, une seule fois : trois copies d'une même règle, ce
// sont trois endroits où la corriger et deux où l'oublier.
//
// Le rangement va de la CATÉGORIE vers le type, jamais l'inverse : le type se
// déduit toujours de la catégorie, alors qu'un type ne désigne pas une
// catégorie — les investissements s'étalent sur DEUX catégories, `investment`
// et `savings`. C'est précisément ce qu'aucun filtre par catégorie ne sait
// exprimer, et ce que le filtre par type règle.

export const INCOME_CATEGORY_IDS = ["income"];
export const INVESTMENT_CATEGORY_IDS = ["investment", "savings"];

/** Le type auquel appartient une catégorie. Tout le reste est une dépense. */
export function typeOfCategoryId(categoryId) {
  if (INCOME_CATEGORY_IDS.includes(categoryId)) return "income";
  if (INVESTMENT_CATEGORY_IDS.includes(categoryId)) return "investment";
  return "expense";
}

/** Les catégories qu'un type autorise, dans l'ordre du catalogue. */
export function categoriesForType(categories, type) {
  return (categories || []).filter((c) => typeOfCategoryId(c.id) === type);
}

// Le type EFFECTIF d'une transaction. `type` est écrit à la création par les
// deux écrans de saisie, donc il est présent partout ; on retombe quand même
// sur la catégorie s'il venait à manquer. Sans ce repli, une transaction sans
// type sortirait de TOUS les filtres à la fois — y compris « Dépenses » —,
// c'est-à-dire disparaîtrait de l'historique sans que rien ne le signale,
// alors que sa catégorie suffit à la ranger.
export function txType(tx) {
  if (tx?.type) return tx.type;
  return typeOfCategoryId(tx?.categoryId);
}
