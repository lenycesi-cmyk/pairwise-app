// Format canonique d'export/import — lot 0 du mode Local.
//
// C'est le pivot de toute la réversibilité : les deux modes de stockage
// produisent et relisent CE document, si bien qu'une migration se ramène à
// « exporter d'un côté, importer de l'autre ». Un seul morceau de code sert donc
// les deux sens, et se trouve exercé deux fois plus par l'usage normal.
//
// Il vaut aussi pour lui-même, sans mode Local : pouvoir emporter ses données
// est ce que réclament réellement la plupart des utilisateurs quand ils parlent
// de « cloud privé ».

export const EXPORT_FORMAT = "pairwise-export";
export const EXPORT_VERSION = 1;

// Liste BLANCHE des champs du document couple. Le sens de la liste est
// délibéré : avec une liste noire, tout champ ajouté plus tard se retrouverait
// exporté par défaut — c'est ainsi qu'on publie un secret sans s'en rendre
// compte. Ici, un champ non listé n'existe pas pour l'export.
export const COUPLE_FIELDS = [
  "coupleName",
  "members",
  "categories",
  "customTags",
  "defaultCurrency",
  "currencyMode",
  "enabledCurrencies",
  "financeMode",
  "language",
  "recurringTx",
  "recurringLastGen",
  "budgets",
  "budgetHistory",
  "goals",
  "loans",
  "assets",
  "assetContributions",
  "assetContributionsApplied",
  "targetAllocation",
  "incomeAccountLinks",
  "netWorthHistory",
  "debtSettlements",
  "debtTransfers",
];

// Volontairement ABSENTS, et pourquoi :
//   memberUids      identifiants Firebase, liés au compte et non aux données
//   fcmTokens       jetons d'appareil, sans valeur ailleurs et à ne pas promener
//   inviteExpiresAt état transitoire du code d'invitation
//   themePrefs/navTabs/pushPrefs  préférences d'affichage, propres à l'appareil
//   bankConnections sous-collection SERVEUR (jetons bancaires) : jamais côté
//                   client, donc jamais dans un export — même par accident.

// Collections fusionnées par `id` à l'import. Les autres champs sont remplacés
// en bloc : un tableau sans identifiant ne se fusionne pas sans inventer une
// règle, et inventer une règle sur des données d'argent est le début des ennuis.
const MERGE_BY_ID = [
  "members",
  "categories",
  "assets",
  "budgets",
  "goals",
  "loans",
  "recurringTx",
];

/**
 * Construit le document d'export.
 *
 * `transactions` et `couple.assets` sont ceux que le membre courant PEUT VOIR :
 * les éléments marqués `privateTo` du partenaire en sont absents, comme partout
 * ailleurs dans l'app. `omittedPrivate` en garde le compte, pour que l'import
 * puisse rester non destructif en connaissance de cause.
 */
export function buildExportDocument({ couple, transactions, memberKey, omittedPrivate = 0 }) {
  const picked = {};
  for (const field of COUPLE_FIELDS) {
    if (couple?.[field] !== undefined) picked[field] = couple[field];
  }
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    scope: { memberKey: memberKey ?? null, omittedPrivate },
    couple: picked,
    transactions: Array.isArray(transactions) ? transactions : [],
  };
}

/**
 * Relit et valide un document d'export. Lève une Error au message lisible —
 * l'appelant l'affiche tel quel : « fichier invalide » sans explication oblige
 * l'utilisateur à deviner ce qui cloche dans un fichier qu'il ne peut pas lire.
 */
export function parseExportDocument(raw) {
  let doc = raw;
  if (typeof raw === "string") {
    try {
      doc = JSON.parse(raw);
    } catch {
      throw new Error("import_error_not_json");
    }
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("import_error_not_json");
  }
  if (doc.format !== EXPORT_FORMAT) {
    throw new Error("import_error_wrong_format");
  }
  if (!Number.isInteger(doc.version) || doc.version < 1) {
    throw new Error("import_error_wrong_format");
  }
  // Un fichier plus récent que l'app peut contenir des champs qu'on ne saurait
  // ni lire ni conserver : on refuse plutôt que d'importer à moitié.
  if (doc.version > EXPORT_VERSION) {
    throw new Error("import_error_version_too_new");
  }
  if (!doc.couple || typeof doc.couple !== "object" || Array.isArray(doc.couple)) {
    throw new Error("import_error_no_couple");
  }
  if (!Array.isArray(doc.transactions)) {
    throw new Error("import_error_no_transactions");
  }

  // Refiltrage par la liste blanche : un fichier bricolé à la main ne doit pas
  // pouvoir écrire un champ que l'export n'aurait jamais produit.
  const couple = {};
  for (const field of COUPLE_FIELDS) {
    if (doc.couple[field] !== undefined) couple[field] = doc.couple[field];
  }

  const transactions = doc.transactions.filter(
    (tx) => tx && typeof tx === "object" && typeof tx.id === "string" && tx.id.length > 0
  );

  return {
    version: doc.version,
    exportedAt: doc.exportedAt ?? null,
    scope: doc.scope ?? { memberKey: null, omittedPrivate: 0 },
    couple,
    transactions,
  };
}

/**
 * Union de deux listes par `id`, l'entrant l'emportant sur l'existant.
 * Retourne `null` si la fusion n'est pas sûre (un élément sans `id`), ce qui
 * fait retomber l'appelant sur un remplacement en bloc.
 */
export function mergeById(existing, incoming) {
  if (!Array.isArray(incoming)) return null;
  const all = [...(Array.isArray(existing) ? existing : []), ...incoming];
  if (all.some((item) => !item || typeof item !== "object" || !item.id)) return null;

  const byId = new Map();
  for (const item of all) byId.set(item.id, item); // l'entrant passe en second
  return [...byId.values()];
}

// Champs présents dans l'export mais JAMAIS réécrits par un import.
//
// `members` est une question de SÉCURITÉ, pas de confort. La liste des membres
// est resynchronisée vers `memberUids` par FinanceContext, et `memberUids` est
// ce sur quoi firestore.rules fonde tous les accès. Laisser un fichier ajouter
// un membre reviendrait donc à laisser un fichier s'octroyer l'accès à un
// couple — exactement la faille refermée en retirant l'auto-ajout côté client
// (cf. CLAUDE.md). Le champ reste exporté : il rend le fichier lisible et
// servira à recréer un couple depuis zéro, chemin qui aura ses propres gardes.
export const IMPORT_SKIP_FIELDS = ["members"];

/**
 * Calcule le contenu à écrire sur le document couple.
 *
 * L'import du lot 0 est **non destructif** : il ajoute et met à jour, il ne
 * supprime jamais. C'est une conséquence directe du filtrage par visibilité —
 * un export ne contient pas forcément le privé du partenaire, donc l'utiliser
 * pour remplacer effacerait des données que l'auteur du fichier n'a jamais vues.
 */
export function buildCouplePatch(currentCouple, importedCouple) {
  const patch = {};
  for (const [field, value] of Object.entries(importedCouple)) {
    if (IMPORT_SKIP_FIELDS.includes(field)) continue;
    if (MERGE_BY_ID.includes(field)) {
      const merged = mergeById(currentCouple?.[field], value);
      patch[field] = merged ?? value;
    } else {
      patch[field] = value;
    }
  }
  return patch;
}

/** Résumé chiffré pour l'écran de confirmation, avant toute écriture. */
export function summarizeImport(doc) {
  const counts = { transactions: doc.transactions.length };
  for (const field of MERGE_BY_ID) {
    if (IMPORT_SKIP_FIELDS.includes(field)) continue;
    const value = doc.couple[field];
    if (Array.isArray(value) && value.length > 0) counts[field] = value.length;
  }
  return counts;
}
