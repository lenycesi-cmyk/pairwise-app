export const DEFAULT_CATEGORIES = [
  {
    id: "food",
    name: "Alimentation",
    icon: "ti-tools-kitchen-2",
    color: "tang",
    subcategories: ["Courses", "Restaurants", "Café & snacks"],
  },
  {
    id: "housing",
    name: "Logement",
    icon: "ti-home",
    color: "sky",
    subcategories: ["Loyer", "Électricité", "Eau", "Internet", "Téléphone", "Entretien"],
  },
  {
    id: "transport",
    name: "Transport",
    icon: "ti-car",
    color: "lavi",
    subcategories: ["Essence", "Taxi / VTC", "Transports en commun", "Entretien véhicule"],
  },
  {
    id: "health",
    name: "Santé",
    icon: "ti-heart",
    color: "sage",
    subcategories: ["Médecin", "Pharmacie", "Assurance santé", "Sport"],
  },
  {
    id: "personal",
    name: "Personnel",
    icon: "ti-user",
    color: "blush",
    subcategories: ["Vêtements", "Coiffeur", "Soins"],
  },
  {
    id: "leisure",
    name: "Loisirs",
    icon: "ti-movie",
    color: "lavi",
    subcategories: ["Sorties", "Voyages", "Abonnements", "Livres & culture"],
  },
  {
    id: "children",
    name: "Enfants",
    icon: "ti-baby-carriage",
    color: "mint",
    subcategories: ["Frais de scolarité", "Activités", "Fournitures", "Vêtements", "Jouets", "Santé"],
  },
  {
    id: "gifts",
    name: "Cadeaux & dons",
    icon: "ti-gift",
    color: "blush",
    subcategories: ["Cadeaux", "Dons"],
  },
  {
    id: "misc",
    name: "Divers",
    icon: "ti-dots",
    color: "amber",
    subcategories: ["Banque & frais", "Animaux", "Autre"],
  },
];

export const INCOME_CATEGORY = {
  id: "income",
  name: "Revenus",
  icon: "ti-coin",
  color: "sage",
  subcategories: ["Salaire", "Freelance", "Cadeau reçu", "Remboursement", "Autre revenu"],
};

export const INVESTMENT_CATEGORY = {
  id: "investment",
  name: "Investissement",
  icon: "ti-chart-line",
  color: "lavi",
  subcategories: ["Bourse", "Crypto", "Épargne", "Immobilier", "Autre"],
};

export const ALL_CATEGORIES = [INCOME_CATEGORY, ...DEFAULT_CATEGORIES, INVESTMENT_CATEGORY];

export const CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "Dollar US" },
  { code: "VND", symbol: "₫", name: "Dong vietnamien" },
  { code: "GBP", symbol: "£", name: "Livre sterling" },
  { code: "JPY", symbol: "¥", name: "Yen japonais" },
  { code: "THB", symbol: "฿", name: "Baht thaïlandais" },
  { code: "CHF", symbol: "Fr", name: "Franc suisse" },
];

export const SPLIT_OPTIONS = ["A", "B", "50/50"];
