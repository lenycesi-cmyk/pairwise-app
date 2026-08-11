// Cycle de vie des pièces jointes (reçus, photos de profil).
//
// Le problème corrigé ici : `deleteTransaction` ne supprimait que le document
// Firestore. L'image restait dans Storage indéfiniment — et surtout restait
// ACCESSIBLE, l'app affichant les reçus via `receiptURL`, une URL à jeton qui
// court-circuite les règles de sécurité. Une URL à jeton ne se révoque pas par
// les règles : seule la suppression de l'objet reprend la main. Un utilisateur
// qui supprimait une dépense croyait donc avoir effacé la pièce jointe.
//
// Pourquoi côté serveur plutôt que dans le navigateur : `storage.rules` range
// les reçus par AUTEUR DU DÉPÔT (`receipts/{uid}/…`) et n'autorise chacun que
// dans son propre dossier. Le/la partenaire ne peut donc pas supprimer un reçu
// qu'il/elle n'a pas envoyé, alors qu'il/elle peut parfaitement supprimer la
// transaction correspondante. Le SDK admin n'a pas cette limite.
//
// Pourquoi des fonctions APPELABLES et non un déclencheur Firestore, qui serait
// plus élégant : `scripts/deploy-functions.js` ne pose aucun `eventTrigger`.
// Une fonction `onDocumentDeleted` s'y déploierait en fonction HTTP et ne se
// déclencherait jamais — en silence. Le jour où le pipeline saura poser un
// Eventarc, ce module se convertira sans changer de logique.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const REGION = "europe-west1";

/** Membres du couple, après vérification que l'appelant en fait partie. */
async function assertMember(coupleId, uid) {
  if (!coupleId) throw new HttpsError("invalid-argument", "coupleId required");
  const snap = await admin.firestore().collection("couples").doc(coupleId).get();
  const memberUids = snap.data()?.memberUids || [];
  if (!memberUids.includes(uid)) {
    throw new HttpsError("permission-denied", "Not a member of this couple");
  }
  return memberUids;
}

// Un chemin n'est purgeable que s'il appartient à un membre DU COUPLE de
// l'appelant. Sans ce contrôle, un membre légitime pourrait faire supprimer les
// reçus de n'importe qui en forgeant un chemin : l'appartenance au couple
// autoriserait alors une suppression hors du couple.
function pathBelongsToMembers(path, memberUids) {
  if (typeof path !== "string" || path.includes("..")) return false;
  for (const uid of memberUids) {
    if (path.startsWith(`receipts/${uid}/`) || path === `profiles/${uid}.jpg`) return true;
  }
  return false;
}

async function deleteQuietly(bucket, path) {
  try {
    await bucket.file(path).delete();
    return true;
  } catch (err) {
    // 404 = déjà supprimé : c'est le résultat voulu, pas une erreur.
    if (err?.code === 404) return true;
    console.warn(`purge: échec sur ${path}:`, err?.message);
    return false;
  }
}

/**
 * Supprime des pièces jointes précises — appelé quand une transaction est
 * supprimée, ou quand son reçu est retiré à l'édition.
 */
exports.purgeReceipts = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const { coupleId, paths } = request.data || {};
  if (!Array.isArray(paths) || paths.length === 0) return { deleted: 0 };

  const memberUids = await assertMember(coupleId, request.auth.uid);
  const bucket = admin.storage().bucket();

  let deleted = 0;
  for (const path of paths.slice(0, 50)) {
    if (!pathBelongsToMembers(path, memberUids)) continue;
    if (await deleteQuietly(bucket, path)) deleted += 1;
  }
  return { deleted };
});

/**
 * Purge TOUTES les pièces jointes du couple — reçus de chaque membre et photos
 * de profil. Appelé à la suppression du DERNIER compte du couple, au moment où
 * le document couple et ses transactions disparaissent.
 *
 * Tant qu'un partenaire reste, rien n'est supprimé : l'historique partagé lui
 * appartient aussi, et ses reçus lui restent utiles.
 */
exports.purgeCoupleStorage = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const { coupleId } = request.data || {};

  const memberUids = await assertMember(coupleId, request.auth.uid);
  const bucket = admin.storage().bucket();

  let deleted = 0;
  for (const uid of memberUids) {
    // Les reçus sont listés plutôt qu'énumérés depuis les transactions : c'est
    // ce qui rattrape aussi les objets déjà orphelins d'une suppression passée.
    const [files] = await bucket.getFiles({ prefix: `receipts/${uid}/` });
    for (const file of files) {
      if (await deleteQuietly(bucket, file.name)) deleted += 1;
    }
    if (await deleteQuietly(bucket, `profiles/${uid}.jpg`)) deleted += 1;
  }
  return { deleted };
});
