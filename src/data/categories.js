// Returns the localized name of a category or subcategory (falls back to stored name if no translation)
export function getCategoryName(cat, lang) {
  if (lang === "en" && cat.nameEn) return cat.nameEn;
  return cat.name;
}

export function getSubcategoryName(subName, catId, lang) {
  if (lang !== "en") return subName;
  return SUBCATEGORY_EN[catId]?.[subName] || subName;
}

// 21 catégories de dépenses, pensées pour couvrir le plus large public possible
// tout en restant lisibles. Personnalisables par l'utilisateur (ajout/suppression
// de catégories et sous-catégories directement dans l'app).
export const DEFAULT_CATEGORIES = [
  {
    id: "housing",
    name: "Logement",
    nameEn: "Housing",
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
    nameEn: "Food & Groceries",
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
    nameEn: "Transport",
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
    nameEn: "Health",
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
    nameEn: "Leisure & Entertainment",
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
    nameEn: "Subscriptions & Media",
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
    nameEn: "Travel",
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
    nameEn: "Education & Training",
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
    nameEn: "Children",
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
    nameEn: "Beauty & Wellness",
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
    nameEn: "Sport & Fitness",
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
    nameEn: "Clothing",
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
    nameEn: "Pets",
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
    nameEn: "Gifts & Donations",
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
    nameEn: "Taxes & Duties",
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
    nameEn: "Banking & Insurance",
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
    nameEn: "Professional Expenses",
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
    nameEn: "Misc & Shopping",
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
  nameEn: "Income",
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
  nameEn: "Investments",
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
  nameEn: "Savings",
  icon: "ti-pig-money",
  color: "mint",
  subcategories: [
    "Livret A", "LDDS", "LEP", "Compte à terme", "Épargne logement (PEL/CEL)",
    "Épargne projet", "Fonds d'urgence", "Épargne automatique",
  ],
};

// EN translations for default subcategories, keyed by category id then FR name
export const SUBCATEGORY_EN = {
  housing: {
    "Loyer": "Rent", "Crédit immobilier": "Mortgage", "Charges de copropriété": "HOA fees",
    "Électricité": "Electricity", "Gaz": "Gas", "Eau": "Water", "Internet": "Internet",
    "Entretien & réparations": "Maintenance & repairs", "Taxe foncière": "Property tax",
    "Assurance habitation": "Home insurance", "Mobilier & électroménager": "Furniture & appliances",
    "Décoration": "Decoration", "Jardinage": "Gardening", "Bricolage": "DIY",
    "Travaux / rénovation": "Works / renovation",
  },
  food: {
    "Courses": "Groceries", "Take away": "Takeaway", "Livraison de repas": "Food delivery",
    "Snacks": "Snacks", "Café à emporter": "Coffee to go", "Boulangerie / pâtisserie": "Bakery",
    "Petit-déjeuner": "Breakfast",
  },
  transport: {
    "Essence": "Fuel", "Parking": "Parking", "Entretien véhicule": "Vehicle maintenance",
    "Assurance auto": "Car insurance", "Crédit auto": "Car loan", "VTC / taxi": "Taxi / rideshare",
    "Transports en commun": "Public transport", "Péage": "Tolls",
  },
  health: {
    "Médecin généraliste": "GP / Doctor", "Spécialiste": "Specialist", "Pharmacie": "Pharmacy",
    "Assurance santé": "Health insurance", "Optique": "Optician", "Analyses / examens": "Tests & exams",
    "Hôpital": "Hospital", "Vitamines & suppléments": "Vitamins & supplements",
  },
  leisure: {
    "Restaurants": "Restaurants", "Bars": "Bars", "Cinéma": "Cinema",
    "Concerts / spectacles": "Concerts / shows", "Musées / expos": "Museums / exhibitions",
    "Jeux vidéo": "Video games", "Livres": "Books", "Hobbies / loisirs créatifs": "Hobbies",
    "Événements sportifs": "Sporting events", "Parcs d'attractions": "Theme parks",
  },
  subscriptions: {
    "Streaming vidéo": "Video streaming", "Streaming musical": "Music streaming",
    "Presse / magazines": "Press / magazines", "Logiciels / apps": "Software / apps",
    "Cloud storage": "Cloud storage", "Box mensuelles": "Monthly boxes", "VPN": "VPN",
    "Jeux en ligne": "Online gaming", "Autres abonnements": "Other subscriptions",
  },
  travel: {
    "Billets d'avion": "Flights", "Hôtels": "Hotels", "Location de voiture": "Car rental",
    "Activités sur place": "Activities", "Restauration en voyage": "Food while travelling",
    "Visa / documents": "Visa / documents", "Assurance voyage": "Travel insurance", "Train": "Train",
  },
  education: {
    "Frais de scolarité": "Tuition fees", "Formations en ligne": "Online courses",
    "Cours particuliers": "Private lessons", "Livres scolaires": "School books",
    "Certifications": "Certifications",
  },
  children: {
    "Frais de scolarité": "School fees", "Assurance santé": "Health insurance",
    "Activités extrascolaires": "Extracurricular", "Vêtements enfants": "Children's clothing",
    "Jouets": "Toys", "Frais médicaux enfants": "Children's medical", "Fournitures scolaires": "School supplies",
  },
  beauty: {
    "Coiffeur": "Hairdresser", "Cosmétiques": "Cosmetics", "Soins esthétiques": "Beauty treatments",
    "Spa / massage": "Spa / massage", "Manucure / pédicure": "Manicure / pedicure",
    "Parfums": "Perfumes", "Produits de soin": "Skincare", "Épilation": "Waxing / hair removal",
    "Maquillage": "Makeup", "Bien-être mental": "Mental wellness",
  },
  sport: {
    "Abonnement salle": "Gym membership", "Équipement sportif": "Sports equipment",
    "Vêtements de sport": "Sportswear", "Nutrition sportive": "Sports nutrition",
    "Cours collectifs": "Group classes", "Coach sportif": "Personal trainer",
  },
  clothing: {
    "Vêtements du quotidien": "Everyday clothing", "Chaussures": "Shoes",
    "Accessoires": "Accessories", "Sous-vêtements": "Underwear",
    "Vêtements de travail": "Work clothing", "Tenues spéciales": "Special outfits",
    "Retouches / couture": "Alterations / tailoring", "Bijoux": "Jewellery",
    "Sacs / maroquinerie": "Bags / leather goods",
  },
  pets: {
    "Nourriture": "Food", "Vétérinaire": "Vet", "Toilettage": "Grooming",
    "Accessoires": "Accessories", "Pension / garde": "Boarding / pet-sitting",
    "Assurance animale": "Pet insurance", "Litière": "Litter", "Jouets pour animaux": "Pet toys",
    "Dressage": "Training", "Médicaments": "Medication",
  },
  gifts: {
    "Anniversaires": "Birthdays", "Noël / fêtes": "Christmas / holidays",
    "Mariages": "Weddings", "Naissances": "Baby gifts",
    "Dons ponctuels (ONG, associations)": "Donations (NGOs)", "Pourboires": "Tips",
    "Cadeaux de remerciement": "Thank-you gifts", "Cartes cadeaux": "Gift cards",
    "Cagnottes": "Crowdfunding", "Parrainage": "Sponsorship",
  },
  taxes: {
    "Impôt sur le revenu": "Income tax", "Taxe d'habitation": "Council tax",
    "Taxe foncière": "Property tax", "CSG / CRDS": "Social levies",
    "Régularisations fiscales": "Tax adjustments", "Amendes": "Fines",
    "Frais de notaire": "Notary fees", "Droits de succession": "Inheritance tax",
  },
  banking: {
    "Frais de tenue de compte": "Account fees", "Commissions carte": "Card fees",
    "Frais de change": "FX fees", "Agios": "Overdraft interest",
    "Assurance habitation": "Home insurance", "Assurance auto": "Car insurance",
    "Assurance vie": "Life insurance", "Crédit conso": "Consumer loan",
    "Remboursement prêt perso": "Personal loan repayment", "Découvert autorisé": "Authorised overdraft",
  },
  professional: {
    "Matériel de bureau": "Office supplies", "Déplacements pro": "Business travel",
    "Repas d'affaires": "Business meals", "Formation professionnelle": "Professional training",
    "Cotisations ordre / syndicat": "Union / professional dues",
    "Équipement télétravail": "Remote work equipment", "Vêtements professionnels": "Work clothing",
    "Abonnements pro": "Pro subscriptions", "Frais de représentation": "Representation expenses",
    "Cotisation URSSAF / RSI": "Self-employment contributions",
  },
  misc: {
    "Non catégorisé": "Uncategorized", "Shopping en ligne": "Online shopping",
    "Technologie & électronique": "Tech & electronics", "Smartphone / ordinateur": "Phone / computer",
    "Pertes & vols": "Losses & theft", "Amendes diverses": "Various fines",
    "Frais imprévus": "Unexpected expenses", "Frais administratifs": "Admin fees",
  },
  income: {
    "Salaire": "Salary", "Freelance": "Freelance", "Primes": "Bonuses",
    "Remboursements": "Reimbursements", "Loyers perçus": "Rental income",
    "Dividendes": "Dividends", "Allocations": "Benefits / allowances",
    "Pension / retraite": "Pension / retirement", "Vente d'occasion": "Second-hand sales",
    "Cadeaux reçus": "Gifts received",
  },
  investment: {
    "Versement PEA": "PEA contribution", "Versement CTO": "CTO contribution",
    "Achat crypto": "Crypto purchase", "Versement assurance-vie": "Life insurance contribution",
    "Frais de courtage": "Brokerage fees", "SCPI": "REIT", "Achat immobilier locatif": "Rental property",
    "Versement PER": "PER contribution", "Private equity": "Private equity",
    "Or / métaux précieux": "Gold / precious metals",
  },
  savings: {
    "Livret A": "Livret A (savings)", "LDDS": "LDDS (savings)", "LEP": "LEP (savings)",
    "Compte à terme": "Term deposit", "Épargne logement (PEL/CEL)": "Housing savings",
    "Épargne projet": "Project savings", "Fonds d'urgence": "Emergency fund",
    "Épargne automatique": "Automatic savings",
  },
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
