export const ASSET_TYPES = [
  {
    id: "cash",
    name: "Liquidités",
    icon: "ti-cash",
    color: "sage",
    hasApiPrice: false,
    description: "Compte courant, livret A, LDDS...",
  },
  {
    id: "stocks",
    name: "Actions & ETF",
    icon: "ti-chart-candle",
    color: "sky",
    hasApiPrice: true,
    priceSource: "stocks",
    description: "PEA, CTO, actions individuelles",
  },
  {
    id: "crypto",
    name: "Cryptomonnaies",
    icon: "ti-currency-bitcoin",
    color: "amber",
    hasApiPrice: true,
    priceSource: "crypto",
    description: "Bitcoin, Ethereum, etc.",
  },
  {
    id: "life_insurance",
    name: "Assurance-vie",
    icon: "ti-shield-check",
    color: "lavi",
    hasApiPrice: false,
    description: "Fonds euros, unités de compte",
  },
  {
    id: "real_estate",
    name: "Immobilier",
    icon: "ti-building",
    color: "tang",
    hasApiPrice: false,
    description: "Résidence principale, locatif",
  },
  {
    id: "retirement",
    name: "Épargne retraite",
    icon: "ti-hourglass",
    color: "mint",
    hasApiPrice: false,
    description: "PER, PERP",
  },
  {
    id: "other_assets",
    name: "Autres actifs",
    icon: "ti-diamond",
    color: "blush",
    hasApiPrice: false,
    description: "Métaux précieux, art, parts d'entreprise",
  },
  {
    id: "debt",
    name: "Dettes & crédits",
    icon: "ti-trending-down",
    color: "red",
    hasApiPrice: false,
    description: "Prêt immobilier, prêt auto (négatif)",
    isLiability: true,
  },
];

export function getAssetType(typeId) {
  return ASSET_TYPES.find((t) => t.id === typeId) || ASSET_TYPES[0];
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
