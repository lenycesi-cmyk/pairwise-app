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
  { categoryId: "banking", subcategory: "Assurance vie" },
  { categoryId: "banking", subcategory: "Crédit conso" },
];
