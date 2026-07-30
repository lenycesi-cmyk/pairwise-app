// Allocations cibles « standards » telles que pratiquées par les gérants et
// conseillers en gestion de patrimoine.
//
// Deux idées structurent ce fichier :
//
//  1. On raisonne en CLASSES DE RISQUE, pas en types d'actifs. Une enveloppe ne
//     dit rien de son sous-jacent : un PER ou une assurance-vie en unités de
//     compte est de l'action, un fonds monétaire est de la liquidité. Les
//     profils du métier (prudent / équilibré / dynamique / offensif) se
//     définissent toujours sur 5 poches, jamais sur des enveloppes fiscales.
//
//  2. L'allocation se calcule sur les ACTIFS INVESTISSABLES. La résidence
//     principale et les véhicules comptent dans le patrimoine net mais sont
//     exclus de la répartition : illiquides, liés au train de vie, pas
//     arbitrables. C'est la définition standard (et celle des « investable
//     assets » réglementaires côté US).
//
// Sources des pondérations : modèles Vanguard (conservative 40/60, moderate
// 60/40, aggressive 80/20), grilles prudent/équilibré/dynamique de la gestion
// privée française, et les bornes crypto publiées par les grands gérants
// (BlackRock 1–2 %, BofA 1–4 %, Fidelity 2–5 %).

// Bande de tolérance avant de conseiller un arbitrage, en POINTS de %.
// La recherche Vanguard sur le rééquilibrage conclut qu'un suivi annuel avec
// des bandes de ±5 pts capte l'essentiel du bénéfice en évitant les frais d'un
// rééquilibrage permanent — d'où ce seuil plutôt qu'un « dès que ça bouge ».
export const REBALANCE_BAND = 5;

export const ASSET_CLASSES = [
  { id: "liquidity", fr: "Liquidités & monétaire", en: "Cash & money market", color: "sage", icon: "ti-wallet" },
  { id: "bonds", fr: "Taux & obligations", en: "Bonds & fixed income", color: "lavi", icon: "ti-percentage" },
  { id: "equities", fr: "Actions & ETF", en: "Equities & ETFs", color: "sky", icon: "ti-chart-candle" },
  { id: "realestate", fr: "Immobilier de rendement", en: "Income real estate", color: "tang", icon: "ti-building" },
  { id: "alternatives", fr: "Alternatifs", en: "Alternatives", color: "amber", icon: "ti-diamond" },
];

export function getAssetClass(classId) {
  return ASSET_CLASSES.find((c) => c.id === classId) || null;
}

export function className(classId, lang) {
  const c = getAssetClass(classId);
  if (!c) return classId;
  return lang === "en" ? c.en : c.fr;
}

// Classe par défaut d'un type d'actif (quand aucun sous-type ne précise mieux).
// `null` = hors allocation.
export const CLASS_OF_TYPE = {
  account: "liquidity",
  cash: "liquidity",
  bonds: "bonds",
  life_insurance: "bonds", // un contrat sans précision est majoritairement fonds euros
  stocks: "equities",
  retirement: "equities", // enveloppe longue durée : sous-jacent actions par défaut
  real_estate: "realestate",
  crypto: "alternatives",
  other_assets: "alternatives",
  vehicle: null, // bien de consommation qui se déprécie
  debt: null, // passif
};

// Sous-types qui reclassent l'actif, parce que l'enveloppe seule induirait en
// erreur.
const CLASS_OF_SUBTYPE = {
  money_market: "liquidity", // fonds monétaire : du cash, pas de l'obligataire
  uc: "equities", // assurance-vie en unités de compte
  fonds_euros: "bonds",
  primary: null, // résidence principale : hors actifs investissables
};

export function classOfAsset(asset) {
  if (!asset) return null;
  if (asset.subtype && Object.prototype.hasOwnProperty.call(CLASS_OF_SUBTYPE, asset.subtype)) {
    return CLASS_OF_SUBTYPE[asset.subtype];
  }
  return CLASS_OF_TYPE[asset.typeId] ?? null;
}

// Types d'actifs qui alimentent une classe — sert à expliquer la grille dans la
// modale (« Alimenté par : Actions & ETF, Épargne retraite… »).
export function typeIdsForClass(classId) {
  return Object.keys(CLASS_OF_TYPE).filter((typeId) => CLASS_OF_TYPE[typeId] === classId);
}

// Part « croissance » (actifs risqués) d'une grille : c'est la grandeur que les
// règles d'âge du métier pilotent.
export function growthShare(weights) {
  return (weights?.equities || 0) + (weights?.realestate || 0) + (weights?.alternatives || 0);
}

export const RISK_PROFILES = [
  {
    id: "prudent",
    fr: "Prudent",
    en: "Conservative",
    icon: "ti-shield-check",
    frDesc: "Préserver le capital avant tout. Horizon court (moins de 3 ans) ou faible tolérance aux baisses.",
    enDesc: "Capital preservation first. Short horizon (under 3 years) or low tolerance for drawdowns.",
    ret: "2–3",
    weights: { liquidity: 20, bonds: 45, equities: 25, realestate: 8, alternatives: 2 },
  },
  {
    id: "equilibre",
    fr: "Équilibré",
    en: "Balanced",
    icon: "ti-scale",
    frDesc: "Le compromis de référence, proche du 60/40. Horizon 5 à 10 ans, baisses temporaires acceptées.",
    enDesc: "The reference compromise, close to a 60/40 mix. 5–10 year horizon, temporary drawdowns accepted.",
    ret: "3,5–5",
    weights: { liquidity: 12, bonds: 28, equities: 40, realestate: 15, alternatives: 5 },
  },
  {
    id: "dynamique",
    fr: "Dynamique",
    en: "Growth",
    icon: "ti-trending-up",
    frDesc: "Croissance prioritaire. Horizon supérieur à 10 ans, volatilité assumée.",
    enDesc: "Growth first. Horizon beyond 10 years, volatility accepted.",
    ret: "5–7",
    weights: { liquidity: 8, bonds: 15, equities: 55, realestate: 15, alternatives: 7 },
  },
  {
    id: "offensif",
    fr: "Offensif",
    en: "Aggressive",
    icon: "ti-rocket",
    frDesc: "Maximiser la performance longue durée. Horizon très long, capacité à encaisser de fortes baisses.",
    enDesc: "Maximise long-run performance. Very long horizon, able to stomach deep drawdowns.",
    ret: "6–8",
    weights: { liquidity: 5, bonds: 5, equities: 70, realestate: 10, alternatives: 10 },
  },
];

export function getRiskProfile(profileId) {
  return RISK_PROFILES.find((p) => p.id === profileId) || null;
}

export function profileName(profile, lang) {
  if (!profile) return null;
  return lang === "en" ? profile.en : profile.fr;
}

export function profileDesc(profile, lang) {
  if (!profile) return null;
  return lang === "en" ? profile.enDesc : profile.frDesc;
}

// Règle des 110 : part d'actifs de croissance ≈ 110 − âge. Version modernisée
// du « 100 − âge » historique, remontée à 110/120 par la profession pour tenir
// compte de l'allongement de l'espérance de vie. On renvoie la cible brute et
// le profil standard le plus proche.
export function suggestProfileForAge(age) {
  if (!Number.isFinite(age) || age <= 0) return null;
  const growthTarget = Math.max(20, Math.min(90, 110 - age));
  let best = RISK_PROFILES[0];
  for (const p of RISK_PROFILES) {
    const closer = Math.abs(growthShare(p.weights) - growthTarget) < Math.abs(growthShare(best.weights) - growthTarget);
    if (closer) best = p;
  }
  return { growthTarget, profile: best };
}

// Reconnaît la grille d'un profil standard (à 1 pt près) pour pouvoir afficher
// son nom même quand seule la map de pondérations a été enregistrée.
export function matchProfile(weights) {
  if (!weights) return null;
  return (
    RISK_PROFILES.find((p) =>
      ASSET_CLASSES.every((c) => Math.abs((weights[c.id] || 0) - (p.weights[c.id] || 0)) <= 1)
    ) || null
  );
}

// Les cibles étaient d'abord stockées par type d'actif ; elles le sont
// maintenant par classe de risque. On replie les anciennes clés pour ne pas
// perdre le réglage des utilisateurs existants.
export function migrateLegacyTargets(map) {
  if (!map) return {};
  const classIds = new Set(ASSET_CLASSES.map((c) => c.id));
  const legacyKeys = Object.keys(map).filter((k) => !classIds.has(k) && k in CLASS_OF_TYPE);
  if (legacyKeys.length === 0) return map;

  const out = {};
  for (const c of ASSET_CLASSES) out[c.id] = 0;
  for (const [key, pct] of Object.entries(map)) {
    const value = Number(pct) || 0;
    if (value <= 0) continue;
    const target = classIds.has(key) ? key : CLASS_OF_TYPE[key];
    if (target) out[target] += value;
  }
  return out;
}

// Répartition actuelle du patrimoine investissable par classe de risque.
// `excluded` remonte ce qui a été volontairement écarté (résidence principale,
// véhicules) afin de pouvoir l'expliquer à l'utilisateur.
export function computeClassTotals(assets, getAssetValue) {
  const totals = {};
  for (const c of ASSET_CLASSES) totals[c.id] = 0;
  let investable = 0;
  let excluded = 0;

  for (const asset of assets || []) {
    const value = getAssetValue(asset);
    if (!Number.isFinite(value) || value === 0) continue;
    const classId = classOfAsset(asset);
    if (!classId) {
      if (asset.typeId !== "debt") excluded += value;
      continue;
    }
    totals[classId] += value;
    investable += value;
  }

  return { totals, investable, excluded };
}

// Écarts à la cible, classés du plus urgent au moins urgent. `delta` est en
// montant (+ = investir, − = alléger), `driftPts` en points de pourcentage.
export function computeDrift(totals, investable, weights) {
  const rows = ASSET_CLASSES.map((c) => {
    const currentAmount = totals[c.id] || 0;
    const currentPct = investable > 0 ? (currentAmount / investable) * 100 : 0;
    const targetPct = weights?.[c.id] || 0;
    const targetAmount = (investable * targetPct) / 100;
    const driftPts = currentPct - targetPct;
    return {
      class: c,
      currentAmount,
      currentPct,
      targetPct,
      targetAmount,
      delta: targetAmount - currentAmount,
      driftPts,
      outOfBand: Math.abs(driftPts) > REBALANCE_BAND,
    };
  });

  const maxDrift = rows.reduce((m, r) => Math.max(m, Math.abs(r.driftPts)), 0);
  return {
    rows,
    maxDrift,
    balanced: maxDrift <= REBALANCE_BAND,
    actions: rows.filter((r) => r.outOfBand).sort((a, b) => Math.abs(b.driftPts) - Math.abs(a.driftPts)),
  };
}
