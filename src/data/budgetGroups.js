// Classification par défaut des catégories de dépense pour la règle 50/30/20
// (50% essentiel / 30% plaisirs / 20% investissement). Modifiable par
// l'utilisateur via le formulaire manuel après la création initiale.
export const BUDGET_GROUPS = {
  essential: [
    "housing", "food", "transport", "health", "education", "children",
    "taxes", "banking", "professional",
  ],
  fun: [
    "leisure", "subscriptions", "travel", "beauty", "sport", "clothing",
    "pets", "gifts", "misc",
  ],
  investment: ["investment", "savings"],
};

export const BUDGET_GROUP_KEYS = ["essential", "fun", "investment"];

export function groupForCategory(categoryId) {
  for (const key of BUDGET_GROUP_KEYS) {
    if (BUDGET_GROUPS[key].includes(categoryId)) return key;
  }
  return "essential";
}
