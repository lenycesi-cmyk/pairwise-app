// Curated shortlist of the most universally common recurring expenses, used
// in the onboarding "recurring expenses" step so people can tick what
// applies to them instead of hunting through the full category tree.
// categoryId/subcategory must match entries in DEFAULT_CATEGORIES exactly.
export const COMMON_RECURRING = [
  { categoryId: "housing", subcategory: "Loyer" },
  { categoryId: "housing", subcategory: "Crédit immobilier" },
  { categoryId: "housing", subcategory: "Internet" },
  { categoryId: "housing", subcategory: "Assurance habitation" },
  { categoryId: "transport", subcategory: "Assurance auto" },
  { categoryId: "transport", subcategory: "Crédit auto" },
  { categoryId: "transport", subcategory: "Transports en commun" },
  { categoryId: "health", subcategory: "Assurance santé" },
  { categoryId: "subscriptions", subcategory: "Streaming vidéo" },
  { categoryId: "subscriptions", subcategory: "Streaming musical" },
  { categoryId: "subscriptions", subcategory: "Logiciels / apps" },
  { categoryId: "sport", subcategory: "Abonnement salle" },
  { categoryId: "banking", subcategory: "Crédit conso" },
];
// Note: "Assurance vie" (banking category, i.e. term/death insurance premium)
// is deliberately excluded here — in French the same phrase overwhelmingly
// means the investment product (INVESTMENT_CATEGORY's "Versement
// assurance-vie"), so surfacing the expense-side one as a bare chip in this
// quick-pick list reads as mislabeling an investment as an expense. It's
// still selectable from the full category picker in Recurring/Transactions.
