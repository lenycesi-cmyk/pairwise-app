// Types d'actifs.
//
// Deux champs gouvernent ce que la modale d'actif propose, plutôt qu'une pile de
// conditions dans l'écran — même principe que `hasApiPrice`, qui fonctionne déjà
// ainsi :
//
//   - `incomeKinds` : natures de revenu que le type peut réellement produire.
//     Un tableau VIDE masque toute la section « Revenus générés » : une voiture
//     ne verse pas de dividende, une résidence principale ne rapporte pas
//     d'intérêts. « Autres actifs » les garde toutes — c'est la catégorie
//     fourre-tout, y restreindre le choix reviendrait à interdire ce qu'on n'a
//     pas su nommer.
//   - Les versements suivent `hasApiPrice` : un actif coté tire sa valeur du
//     cours, qui écraserait tout versement crédité à la main.
export const ASSET_TYPES = [
  {
    id: "account",
    incomeKinds: ["interest"],
    name: "Compte en banque",
    nameEn: "Bank Account",
    icon: "ti-building-bank",
    color: "sage",
    hasApiPrice: false,
    description: "Compte courant, livret A, LDDS...",
    descriptionEn: "Checking, savings account...",
  },
  {
    id: "cash",
    incomeKinds: [],
    name: "Liquidités",
    nameEn: "Cash",
    icon: "ti-cash",
    color: "mint",
    hasApiPrice: false,
    description: "Espèces, petite caisse",
    descriptionEn: "Physical cash, petty cash",
  },
  {
    id: "stocks",
    incomeKinds: ["dividend"],
    name: "Actions & ETF",
    nameEn: "Stocks & ETFs",
    icon: "ti-chart-candle",
    color: "sky",
    hasApiPrice: true,
    priceSource: "stocks",
    description: "PEA, CTO, actions individuelles",
    descriptionEn: "Individual stocks, ETFs, index funds",
  },
  {
    id: "crypto",
    incomeKinds: ["interest"],
    name: "Cryptomonnaies",
    nameEn: "Cryptocurrencies",
    icon: "ti-currency-bitcoin",
    color: "amber",
    hasApiPrice: true,
    priceSource: "crypto",
    description: "Bitcoin, Ethereum, etc.",
    descriptionEn: "Bitcoin, Ethereum, etc.",
  },
  {
    id: "life_insurance",
    incomeKinds: ["interest", "dividend"],
    name: "Assurance-vie",
    nameEn: "Life Insurance",
    icon: "ti-shield-check",
    color: "lavi",
    hasApiPrice: false,
    description: "Fonds euros, unités de compte",
    descriptionEn: "Euro funds, unit-linked contracts",
  },
  {
    id: "bonds",
    incomeKinds: ["interest"],
    name: "Obligations & taux",
    nameEn: "Bonds & fixed income",
    icon: "ti-percentage",
    color: "lavi",
    hasApiPrice: false,
    description: "Obligations, fonds obligataires, fonds monétaires",
    descriptionEn: "Bonds, bond funds, money market funds",
  },
  {
    id: "real_estate",
    incomeKinds: ["rent"],
    name: "Immobilier",
    nameEn: "Real Estate",
    icon: "ti-building",
    color: "tang",
    hasApiPrice: false,
    description: "Résidence principale, locatif",
    descriptionEn: "Primary residence, rental property",
  },
  {
    id: "vehicle",
    incomeKinds: [],
    name: "Véhicule",
    nameEn: "Vehicle",
    icon: "ti-car",
    color: "amber",
    hasApiPrice: false,
    description: "Voiture, moto (valeur qui se déprécie)",
    descriptionEn: "Car, motorcycle (a depreciating asset)",
  },
  {
    id: "retirement",
    incomeKinds: [],
    name: "Épargne retraite",
    nameEn: "Retirement Savings",
    icon: "ti-hourglass",
    color: "mint",
    hasApiPrice: false,
    description: "PER, PERP",
    descriptionEn: "Pension, 401k, IRA",
  },
  {
    id: "other_assets",
    incomeKinds: ["rent", "dividend", "interest", "other"],
    name: "Autres actifs",
    nameEn: "Other Assets",
    icon: "ti-diamond",
    color: "blush",
    hasApiPrice: false,
    description: "Métaux précieux, art, parts d'entreprise",
    descriptionEn: "Precious metals, art, business stakes",
  },
  {
    id: "debt",
    incomeKinds: [],
    name: "Dettes & crédits",
    nameEn: "Debts & Loans",
    icon: "ti-trending-down",
    color: "red",
    hasApiPrice: false,
    description: "Prêt immobilier, prêt auto (négatif)",
    descriptionEn: "Mortgage, car loan (negative value)",
    isLiability: true,
  },
];

export function getAssetType(typeId) {
  return ASSET_TYPES.find((t) => t.id === typeId) || ASSET_TYPES[0];
}

// Sous-types / enveloppes fiscales par type d'actif (optionnel). Permet de
// préciser PEA vs CTO, fonds euros vs UC, 401(k) vs Roth IRA, locatif vs SCPI…
// sans multiplier les types principaux. `fr`/`en` = libellés d'affichage.
export const ASSET_SUBTYPES = {
  account: [
    { id: "current", fr: "Compte courant", en: "Checking" },
    { id: "livret_a", fr: "Livret A", en: "Livret A" },
    { id: "ldds", fr: "LDDS", en: "LDDS" },
    { id: "pel", fr: "PEL", en: "PEL" },
    { id: "cel", fr: "CEL", en: "CEL" },
    { id: "savings", fr: "Épargne", en: "Savings" },
  ],
  stocks: [
    { id: "pea", fr: "PEA", en: "PEA" },
    { id: "pea_pme", fr: "PEA-PME", en: "PEA-PME" },
    { id: "cto", fr: "CTO", en: "Brokerage" },
  ],
  life_insurance: [
    { id: "fonds_euros", fr: "Fonds euros", en: "Euro fund" },
    { id: "uc", fr: "Unités de compte", en: "Unit-linked" },
  ],
  retirement: [
    { id: "per", fr: "PER", en: "PER" },
    { id: "perp", fr: "PERP", en: "PERP" },
    { id: "pee", fr: "PEE / PERCO", en: "PEE / PERCO" },
    { id: "401k", fr: "401(k)", en: "401(k)" },
    { id: "ira", fr: "IRA", en: "Traditional IRA" },
    { id: "roth_ira", fr: "Roth IRA", en: "Roth IRA" },
    { id: "hsa", fr: "HSA", en: "HSA" },
    { id: "rrsp", fr: "RRSP", en: "RRSP" },
    { id: "tfsa", fr: "TFSA", en: "TFSA" },
  ],
  real_estate: [
    { id: "primary", fr: "Résidence principale", en: "Primary residence" },
    { id: "rental", fr: "Locatif", en: "Rental" },
    { id: "scpi", fr: "SCPI / pierre-papier", en: "REIT / SCPI" },
  ],
  bonds: [
    { id: "gov", fr: "Obligations d'État", en: "Government bonds" },
    { id: "corp", fr: "Obligations d'entreprise", en: "Corporate bonds" },
    { id: "fund", fr: "Fonds obligataire", en: "Bond fund" },
    { id: "money_market", fr: "Fonds monétaire", en: "Money market" },
  ],
};

export function getAssetSubtypes(typeId) {
  return ASSET_SUBTYPES[typeId] || [];
}

export function getSubtypeLabel(typeId, subtypeId, lang) {
  if (!subtypeId) return null;
  const s = (ASSET_SUBTYPES[typeId] || []).find((x) => x.id === subtypeId);
  return s ? (lang === "en" ? s.en : s.fr) : null;
}

// Quelques cryptos courantes pour faciliter la saisie (CoinGecko IDs)
export const COMMON_CRYPTOS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot" },
];

// Quelques tickers actions/ETF courants pour faciliter la saisie
export const COMMON_STOCKS = [
  { symbol: "CW8.PA", name: "Amundi MSCI World (PEA)" },
  { symbol: "ESE.PA", name: "BNP S&P 500 (PEA)" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "VWCE.DE", name: "Vanguard FTSE All-World" },
];
