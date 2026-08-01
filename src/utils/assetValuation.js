// Valorisation d'un actif — source de vérité UNIQUE, partagée entre le
// navigateur et les Cloud Functions.
//
// Ce module existe pour une raison précise : l'enregistrement quotidien du
// patrimoine se fait côté serveur, tandis que l'onglet Patrimoine valorise les
// mêmes actifs côté navigateur. Deux implémentations de la même règle finiraient
// par diverger, et l'écart s'écrirait alors dans l'historique — un chiffre faux,
// figé, qu'aucun rechargement ne corrige. Le fichier est donc copié tel quel dans
// le paquet des fonctions au déploiement (voir scripts/deploy-functions.js)
// plutôt que recopié à la main.
//
// Volontairement PUR : aucune dépendance à React, à Firebase ou au DOM. Tout ce
// qui varie — cours en direct, taux de change, devise d'affichage — entre par le
// contexte.

/**
 * Valeur d'un actif dans la devise d'affichage.
 *
 * Trois sources, dans cet ordre :
 *   1. un cours en direct (actions/crypto) ;
 *   2. un prix unitaire saisi à la main × la quantité ;
 *   3. la valeur stockée (comptes, immobilier, assurance-vie…).
 *
 * @param {object} asset
 * @param {object} ctx
 * @param {Record<string, number>} [ctx.livePrices] cours par id d'actif, déjà en devise d'affichage
 * @param {(amount: number, from: string, to: string) => number} ctx.convert
 * @param {string} ctx.displayCurrency
 * @returns {number} 0 plutôt que NaN quand rien n'est exploitable
 */
export function valueOfAsset(asset, { livePrices = {}, convert, displayCurrency }) {
  if (!asset) return 0;

  // Le test porte sur « > 0 » et non sur « défini » : un cours nul ou invalide
  // renvoyé par une clé API limitée ne doit pas masquer le prix manuel.
  if (livePrices[asset.id] > 0) return livePrices[asset.id];

  if (asset.manualPrice > 0) {
    // Un titre peut être coté dans une devise et acheté dans une autre, d'où la
    // devise propre au prix manuel quand elle est renseignée.
    const priceCur = asset.manualPriceCurrency || asset.currency || displayCurrency;
    const converted = convert(asset.manualPrice * (asset.quantity || 1), priceCur, displayCurrency);
    return Number.isFinite(converted) ? converted : 0;
  }

  // Les actifs cotés ne stockent pas de `value` — seulement quantité + apiId. Si
  // la récupération du cours a échoué, il n'y a rien à convertir : on renvoie 0
  // pour qu'aucun NaN ne se propage dans les totaux.
  const converted = convert(asset.value, asset.currency || displayCurrency, displayCurrency);
  return Number.isFinite(converted) ? converted : 0;
}

/**
 * Lignes d'un instantané quotidien, une par actif.
 *
 * Le `typeId` ET le libellé sont RECOPIÉS dans chaque ligne au lieu d'être
 * référencés : un actif supprimé six mois plus tard laisserait sinon un
 * historique pointant vers un identifiant qui ne résout plus rien. Un instantané
 * doit rester lisible sans le reste de la base.
 *
 * Stocker par actif plutôt que par type est délibéré : le type se déduit toujours
 * de l'actif, jamais l'inverse. Agréger est un problème de lecture ; ce qui n'est
 * pas écrit ici ne se reconstitue jamais.
 */
export function buildSnapshotEntries(assets, ctx) {
  return (assets || [])
    .filter((a) => a && a.id)
    .map((a) => ({
      assetId: a.id,
      typeId: a.typeId || "other_assets",
      label: a.name || "",
      value: valueOfAsset(a, ctx),
    }));
}

/**
 * Total des lignes d'un instantané, par type d'actif.
 * `liabilityTypeIds` reste à la charge de l'appelant : le module de valorisation
 * n'a pas à connaître le catalogue des types.
 */
export function sumEntriesByType(entries) {
  const byType = {};
  for (const e of entries || []) {
    if (!Number.isFinite(e?.value)) continue;
    byType[e.typeId] = (byType[e.typeId] || 0) + e.value;
  }
  return byType;
}
