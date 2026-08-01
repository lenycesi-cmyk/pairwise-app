// Lecture des instantanés quotidiens : tableau mensuel et « ce qui a bougé ».
//
// Deux règles gouvernent tout ce fichier, et ce sont elles qui se codent à
// l'envers si on n'y prend pas garde :
//
//  1. **Une dette qui diminue enrichit le foyer.** Un prêt qui passe de 5 400 à
//     5 000 apporte +400 au patrimoine net. Le signe d'un poste de passif est
//     donc l'INVERSE de la variation de sa valeur.
//  2. **« Pas de comparaison possible » n'est pas « aucun changement ».** Un mois
//     antérieur au premier instantané, ou un actif créé en cours de mois, rend
//     `null` et non `0` — afficher un zéro ferait croire à une stagnation.
//
// Module pur : aucune dépendance à React ni à Firestore. Les instantanés entrent
// sous la forme écrite par la fonction planifiée
// (`{ date, currency, value, totalAssets, totalLiabilities, byType, entries }`).

/** Clé de mois « YYYY-MM » d'un instantané. */
export function monthKeyOf(date) {
  return typeof date === "string" && date.length >= 7 ? date.slice(0, 7) : null;
}

/**
 * Dernier instantané de chaque mois, par clé « YYYY-MM ».
 *
 * On garde le DERNIER et non une moyenne : un patrimoine est une valeur
 * instantanée, pas une somme. C'est la même règle que celle déjà appliquée par
 * l'écran Rapports pour le graphique d'évolution.
 */
export function lastSnapshotPerMonth(snapshots) {
  const byMonth = new Map();
  for (const snap of snapshots || []) {
    const key = monthKeyOf(snap?.date);
    if (!key) continue;
    const kept = byMonth.get(key);
    if (!kept || snap.date > kept.date) byMonth.set(key, snap);
  }
  return byMonth;
}

/** Total des passifs d'un instantané qui NE vient PAS des types d'actifs :
 *  c'est-à-dire le capital restant dû des crédits, absent de `byType`. */
export function loansPortionOf(snapshot, liabilityTypeIds) {
  const fromTypes = Object.entries(snapshot?.byType || {})
    .filter(([id]) => liabilityTypeIds.has(id))
    .reduce((s, [, v]) => s + Math.abs(v), 0);
  const rest = (snapshot?.totalLiabilities || 0) - fromTypes;
  // Un arrondi peut donner un résidu négatif minuscule : on ne le montre pas.
  return rest > 0.005 ? rest : 0;
}

/**
 * Tableau mensuel : une ligne par poste, une colonne par mois.
 *
 * @returns {{ months: string[], assetRows, liabilityRows, totals }}
 *          Chaque ligne : `{ key, typeId, values: (number|null)[] }`.
 *          `null` = le poste n'existait pas ce mois-là, à distinguer d'un zéro.
 */
export function buildMonthlyTable(snapshots, liabilityTypeIds, { limit } = {}) {
  const byMonth = lastSnapshotPerMonth(snapshots);
  let months = [...byMonth.keys()].sort();
  if (limit > 0) months = months.slice(-limit);

  const assetTypeIds = new Set();
  const liabTypeIds = new Set();
  let anyLoans = false;
  for (const m of months) {
    const snap = byMonth.get(m);
    for (const id of Object.keys(snap.byType || {})) {
      (liabilityTypeIds.has(id) ? liabTypeIds : assetTypeIds).add(id);
    }
    if (loansPortionOf(snap, liabilityTypeIds) > 0) anyLoans = true;
  }

  const valueAt = (m, typeId) => {
    const snap = byMonth.get(m);
    const v = snap?.byType?.[typeId];
    // Absent du mois = le poste n'existait pas : `null`, jamais 0.
    return Number.isFinite(v) ? Math.abs(v) : null;
  };

  const rowsFor = (ids) =>
    [...ids]
      .map((typeId) => ({ key: typeId, typeId, values: months.map((m) => valueAt(m, typeId)) }))
      // Du poste le plus lourd au plus léger, sur le dernier mois connu.
      .sort((a, b) => (b.values.at(-1) ?? 0) - (a.values.at(-1) ?? 0));

  const liabilityRows = rowsFor(liabTypeIds);
  if (anyLoans) {
    liabilityRows.push({
      key: "__loans",
      typeId: null,
      isLoans: true,
      values: months.map((m) => loansPortionOf(byMonth.get(m), liabilityTypeIds)),
    });
    liabilityRows.sort((a, b) => (b.values.at(-1) ?? 0) - (a.values.at(-1) ?? 0));
  }

  const totalAssets = months.map((m) => byMonth.get(m)?.totalAssets ?? null);
  const totalLiabilities = months.map((m) => byMonth.get(m)?.totalLiabilities ?? null);
  const net = months.map((m) => byMonth.get(m)?.value ?? null);
  // La variation du premier mois affiché est `null` : il n'y a rien avant lui à
  // quoi le comparer, et un « 0 » se lirait comme une stagnation.
  const change = net.map((v, i) =>
    i === 0 || !Number.isFinite(v) || !Number.isFinite(net[i - 1]) ? null : v - net[i - 1]
  );

  return {
    months,
    assetRows: rowsFor(assetTypeIds),
    liabilityRows,
    totals: { totalAssets, totalLiabilities, net, change },
    currency: byMonth.get(months.at(-1))?.currency || null,
  };
}

/**
 * Ce qui a bougé entre deux instantanés, par type puis par actif.
 *
 * @returns {{ total, byType: Array, unchanged: Array } | null}
 *          `null` quand il n'y a pas de point de comparaison.
 */
export function movementsBetween(prev, curr, liabilityTypeIds) {
  if (!curr) return null;
  if (!prev) return null;

  const prevByAsset = new Map((prev.entries || []).map((e) => [e.assetId, e]));
  const currByAsset = new Map((curr.entries || []).map((e) => [e.assetId, e]));
  const groups = new Map();

  // On parcourt l'UNION des deux instantanés, pas seulement le plus récent. Un
  // actif SUPPRIMÉ n'apparaît que dans `prev` : ne lire que `curr` le rendait
  // invisible, alors que sa disparition fait bel et bien baisser le patrimoine.
  // L'écran affichait donc une chute sans aucune ligne pour l'expliquer — le
  // contraire de ce que ce widget existe pour faire.
  const allIds = new Set([...prevByAsset.keys(), ...currByAsset.keys()]);

  for (const assetId of allIds) {
    const before = prevByAsset.get(assetId);
    const after = currByAsset.get(assetId);
    // Le libellé et le type viennent de l'instantané le plus récent qui les
    // porte : pour un actif supprimé, c'est celui d'avant. Ils y ont été recopiés
    // à l'écriture, donc une suppression reste lisible.
    const ref = after || before;
    const isLiability = liabilityTypeIds.has(ref.typeId);
    const isNew = !before;
    const isRemoved = !after;

    let delta;
    if (isNew) {
      // Rien à quoi comparer une création : null, et surtout pas sa valeur
      // entière, qui ferait passer un ajout pour un gain.
      delta = null;
    } else if (isRemoved) {
      // Sortie du patrimoine : on perd sa valeur. Sauf s'il s'agit d'une dette,
      // dont la disparition enrichit — règle 1, encore.
      delta = isLiability ? Math.abs(before.value) : -before.value;
    } else {
      delta = isLiability
        ? Math.abs(before.value) - Math.abs(after.value)
        : after.value - before.value;
    }

    if (!groups.has(ref.typeId)) {
      groups.set(ref.typeId, { typeId: ref.typeId, isLiability, delta: 0, assets: [] });
    }
    const g = groups.get(ref.typeId);
    g.assets.push({
      assetId, label: ref.label, value: after ? after.value : 0,
      delta, isNew, isRemoved,
    });
    if (Number.isFinite(delta)) g.delta += delta;
  }

  // Les crédits ne sont pas des actifs : ils vivent hors de `entries`, dans
  // l'écart entre totalLiabilities et la somme des types de passif.
  const loansBefore = loansPortionOf(prev, liabilityTypeIds);
  const loansNow = loansPortionOf(curr, liabilityTypeIds);
  if (loansBefore > 0 || loansNow > 0) {
    groups.set("__loans", {
      typeId: "__loans", isLiability: true, isLoans: true,
      delta: loansBefore - loansNow, assets: [],
    });
  }

  const all = [...groups.values()];
  // Un poste dont la valeur n'a pas bougé d'un centime n'est pas un mouvement :
  // il est listé à part plutôt que de gonfler la liste des contributions.
  //
  // Exception : un type qui contient un actif APPARU ou RETIRÉ ce mois-ci reste
  // dans les mouvements même si sa variation chiffrée est nulle. Une création ne
  // produit aucun delta (rien à quoi la comparer) mais c'est bien quelque chose
  // qui s'est passé — la ranger dans « inchangé » la ferait disparaître.
  const notable = (g) => g.assets.some((a) => a.isNew || a.isRemoved);
  const moved = all.filter((g) => Math.abs(g.delta) >= 0.005 || notable(g));
  const unchanged = all.filter((g) => Math.abs(g.delta) < 0.005 && !notable(g));

  return {
    total: Number.isFinite(curr.value) && Number.isFinite(prev.value) ? curr.value - prev.value : null,
    byType: moved.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    unchanged,
    currency: curr.currency || null,
  };
}
