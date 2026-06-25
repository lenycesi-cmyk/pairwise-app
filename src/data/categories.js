// 21 catégories de dépenses, pensées pour couvrir le plus large public possible
// tout en restant lisibles. Personnalisables par l'utilisateur (ajout/suppression
// de catégories et sous-catégories directement dans l'app).
export const DEFAULT_CATEGORIES = [
  {
    id: "housing",
    name: "Logement",
    icon: "ti-home",
    color: "sky",
    subcategories: [
      "Loyer", "Crédit immobilier", "Charges de copropriété", "Électricité",
      "Gaz", "Eau", "Internet", "Entretien & réparations", "Taxe foncière",
      "Assurance habitation", "Mobilier & électroménager", "Décoration",
      "Jardinage", "Bricolage", "Travaux / rénovation",
    ],
  },
  {
    id: "food",
    name: "Alimentation",
    icon: "ti-tools-kitchen-2",
    color: "tang",
    subcategories: [
      "Courses", "Take away", "Livraison de repas", "Snacks",
      "Café à emporter", "Boulangerie / pâtisserie", "Petit-déjeuner",
    ],
  },
  {
    id: "transport",
    name: "Transport",
    icon: "ti-car",
    color: "lavi",
    subcategories: [
      "Essence", "Parking", "Entretien véhicule", "Assurance auto",
      "Crédit auto", "VTC / taxi", "Transports en commun", "Péage",
    ],
  },
  {
    id: "health",
    name: "Santé",
    icon: "ti-heart",
    color: "sage",
    subcategories: [
      "Médecin généraliste", "Spécialiste", "Pharmacie", "Assurance santé",
      "Optique", "Analyses / examens", "Hôpital", "Vitamines & suppléments",
    ],
  },
  {
    id: "leisure",
    name: "Loisirs & sorties",
    icon: "ti-movie",
    color: "lavi",
    subcategories: [
      "Restaurants", "Bars", "Cinéma", "Concerts / spectacles", "Musées / expos",
      "Jeux vidéo", "Livres", "Hobbies / loisirs créatifs", "Événements sportifs",
      "Parcs d'attractions",
    ],
  },
  {
    id: "subscriptions",
    name: "Abonnements & médias",
    icon: "ti-device-tv",
    color: "amber",
    subcategories: [
      "Streaming vidéo", "Streaming musical", "Presse / magazines", "Logiciels / apps",
      "Cloud storage", "Box mensuelles", "VPN", "Jeux en ligne", "Autres abonnements",
    ],
  },
  {
    id: "travel",
    name: "Voyages",
    icon: "ti-plane",
    color: "sky",
    subcategories: [
      "Billets d'avion", "Hôtels", "Location de voiture", "Activités sur place",
      "Restauration en voyage", "Visa / documents", "Assurance voyage", "Train",
    ],
  },
  {
    id: "education",
    name: "Éducation & formation",
    icon: "ti-school",
    color: "mint",
    subcategories: [
      "Frais de scolarité", "Formations en ligne", "Cours particuliers",
      "Livres scolaires", "Certifications",
    ],
  },
  {
    id: "children",
    name: "Enfants",
    icon: "ti-baby-carriage",
    color: "mint",
    subcategories: [
      "Frais de scolarité", "Assurance santé", "Activités extrascolaires",
      "Vêtements enfants", "Jouets", "Frais médicaux enfants", "Fournitures scolaires",
    ],
  },
  {
    id: "beauty",
    name: "Beauté & bien-être",
    icon: "ti-sparkles",
    color: "blush",
    subcategories: [
      "Coiffeur", "Cosmétiques", "Soins esthétiques", "Spa / massage",
      "Manucure / pédicure", "Parfums", "Produits de soin", "Épilation",
      "Maquillage", "Bien-être mental",
    ],
  },
  {
    id: "sport",
    name: "Sport",
    icon: "ti-run",
    color: "sage",
    subcategories: [
      "Abonnement salle", "Équipement sportif", "Vêtements de sport",
      "Nutrition sportive", "Cours collectifs", "Coach sportif",
    ],
  },
  {
    id: "clothing",
    name: "Vêtements",
    icon: "ti-shirt",
    color: "blush",
    subcategories: [
      "Vêtements du quotidien", "Chaussures", "Accessoires", "Sous-vêtements",
      "Vêtements de travail", "Tenues spéciales", "Retouches / couture",
      "Bijoux", "Sacs / maroquinerie",
    ],
  },
  {
    id: "pets",
    name: "Animaux",
    icon: "ti-paw",
    color: "amber",
    subcategories: [
      "Nourriture", "Vétérinaire", "Toilettage", "Accessoires", "Pension / garde",
      "Assurance animale", "Litière", "Jouets pour animaux", "Dressage", "Médicaments",
    ],
  },
  {
    id: "gifts",
    name: "Cadeaux & dons",
    icon: "ti-gift",
    color: "blush",
    subcategories: [
      "Anniversaires", "Noël / fêtes", "Mariages", "Naissances",
      "Dons ponctuels (ONG, associations)", "Pourboires", "Cadeaux de remerciement",
      "Cartes cadeaux", "Cagnottes", "Parrainage",
    ],
  },
  {
    id: "taxes",
    name: "Impôts & taxes",
    icon: "ti-receipt-tax",
    color: "tang",
    subcategories: [
      "Impôt sur le revenu", "Taxe d'habitation", "Taxe foncière", "CSG / CRDS",
      "Régularisations fiscales", "Amendes", "Frais de notaire", "Droits de succession",
    ],
  },
  {
    id: "banking",
    name: "Banque & assurances",
    icon: "ti-building-bank",
    color: "sky",
    subcategories: [
      "Frais de tenue de compte", "Commissions carte", "Frais de change", "Agios",
      "Assurance habitation", "Assurance auto", "Assurance vie", "Crédit conso",
      "Remboursement prêt perso", "Découvert autorisé",
    ],
  },
  {
    id: "professional",
    name: "Frais professionnels",
    icon: "ti-briefcase",
    color: "mint",
    subcategories: [
      "Matériel de bureau", "Déplacements pro", "Repas d'affaires",
      "Formation professionnelle", "Cotisations ordre / syndicat",
      "Équipement télétravail", "Vêtements professionnels", "Abonnements pro",
      "Frais de représentation", "Cotisation URSSAF / RSI",
    ],
  },
  {
    id: "misc",
    name: "Divers / Shopping",
    icon: "ti-shopping-bag",
    color: "amber",
    subcategories: [
      "Non catégorisé", "Shopping en ligne", "Technologie & électronique",
      "Smartphone / ordinateur", "Pertes & vols", "Amendes diverses",
      "Frais imprévus", "Frais administratifs",
    ],
  },
];

export const INCOME_CATEGORY = {
  id: "income",
  name: "Revenus",
  icon: "ti-coin",
  color: "sage",
  subcategories: [
    "Salaire", "Freelance", "Primes", "Remboursements", "Loyers perçus",
    "Dividendes", "Allocations", "Pension / retraite", "Vente d'occasion",
    "Cadeaux reçus",
  ],
};

export const INVESTMENT_CATEGORY = {
  id: "investment",
  name: "Investissements",
  icon: "ti-chart-line",
  color: "lavi",
  subcategories: [
    "Versement PEA", "Versement CTO", "Achat crypto", "Versement assurance-vie",
    "Frais de courtage", "SCPI", "Achat immobilier locatif", "Versement PER",
    "Private equity", "Or / métaux précieux",
  ],
};

export const SAVINGS_CATEGORY = {
  id: "savings",
  name: "Épargne",
  icon: "ti-pig-money",
  color: "mint",
  subcategories: [
    "Livret A", "LDDS", "LEP", "Compte à terme", "Épargne logement (PEL/CEL)",
    "Épargne projet", "Fonds d'urgence", "Épargne automatique",
  ],
};

export const ALL_CATEGORIES = [
  INCOME_CATEGORY,
  ...DEFAULT_CATEGORIES,
  INVESTMENT_CATEGORY,
  SAVINGS_CATEGORY,
];

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
