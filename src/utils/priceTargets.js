// Quels cours faut-il aller chercher, et une seule fois chacun.
//
// C'est le cœur économique de l'enregistrement quotidien. Une boucle naïve
// « pour chaque couple, pour chaque actif, appeler l'API » paie le même Bitcoin
// autant de fois qu'il y a de foyers qui en détiennent. En collectant d'abord
// l'ensemble des symboles DISTINCTS de toute la base, le coût cesse de dépendre
// du nombre d'utilisateurs et ne dépend plus que du nombre de valeurs suivies.
//
// Module pur, partagé tel quel avec les Cloud Functions : aucune dépendance à
// React, Firebase ou au réseau. La liste des types entre en paramètre plutôt
// que par import, pour que le fichier reste autonome une fois copié dans le
// paquet des fonctions.

/**
 * Symboles distincts à coter, regroupés par source de prix.
 *
 * @param {Array<{typeId?: string, apiId?: string}>} assets  actifs de TOUS les couples, à plat
 * @param {Array<{id: string, hasApiPrice?: boolean, priceSource?: string}>} assetTypes
 * @returns {{ crypto: string[], stocks: string[] }} listes triées et dédoublonnées
 */
export function collectPriceTargets(assets, assetTypes) {
  const sourceByType = new Map();
  for (const type of assetTypes || []) {
    if (type?.hasApiPrice && type.priceSource) sourceByType.set(type.id, type.priceSource);
  }

  const crypto = new Set();
  const stocks = new Set();
  for (const asset of assets || []) {
    if (!asset?.apiId) continue;
    const source = sourceByType.get(asset.typeId);
    // Les symboles boursiers se comparent en majuscules et les ids CoinGecko en
    // minuscules. Sans cette normalisation, « AAPL » et « aapl » compteraient
    // pour deux appels facturés au lieu d'un.
    if (source === "crypto") crypto.add(String(asset.apiId).toLowerCase());
    else if (source === "stocks") stocks.add(String(asset.apiId).toUpperCase());
  }

  // Tri : rend l'ordre des appels déterministe, donc les journaux et les tests
  // lisibles, et évite qu'un même run varie d'une exécution à l'autre.
  return { crypto: [...crypto].sort(), stocks: [...stocks].sort() };
}

/**
 * Découpe une liste en paquets — CoinGecko accepte plusieurs ids par requête,
 * ce qui ramène toute la crypto de la base à une poignée d'appels.
 */
export function chunk(list, size) {
  if (!Array.isArray(list) || size < 1) return [];
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Convertisseur bâti sur une table de taux à base unique (ex. EUR).
 *
 * Il n'y a délibérément AUCUNE table de repli ici, contrairement au navigateur.
 * Un taux approximatif affiché à l'écran se corrige au rechargement suivant ;
 * le même taux écrit dans un instantané quotidien devient un chiffre faux et
 * définitif. En l'absence de taux, ce convertisseur renvoie NaN et l'appelant
 * doit abandonner l'enregistrement du jour plutôt que d'inventer une valeur.
 *
 * @param {Record<string, number>} rates  taux depuis `base` (rates[base] === 1)
 * @param {string} base
 */
export function makeConverter(rates, base) {
  return (amount, from, to) => {
    if (!Number.isFinite(amount)) return NaN;
    if (from === to) return amount;
    const rateFrom = from === base ? 1 : rates?.[from];
    const rateTo = to === base ? 1 : rates?.[to];
    if (!Number.isFinite(rateFrom) || !Number.isFinite(rateTo) || rateFrom === 0) return NaN;
    // amount / rateFrom ramène à la devise de base, × rateTo va vers la cible.
    return (amount / rateFrom) * rateTo;
  };
}
