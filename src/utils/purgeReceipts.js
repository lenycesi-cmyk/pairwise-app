// Appel de la fonction serveur qui supprime des pièces jointes.
//
// Passe par le serveur et non par le SDK Storage parce que `storage.rules`
// range les reçus par auteur du dépôt : le/la partenaire peut supprimer une
// transaction, mais pas le reçu qu'il/elle n'a pas envoyé. Le SDK admin, si.
//
// Toujours BEST-EFFORT : la suppression demandée par l'utilisateur ne doit
// jamais échouer parce que le nettoyage a échoué. Un objet non supprimé se
// rattrape (purge complète à la fermeture du compte) ; une suppression bloquée
// se voit tout de suite et laisse l'utilisateur sans recours.

const REGION = "europe-west1";

export async function purgeReceiptPaths(coupleId, paths) {
  const clean = (paths || []).filter(Boolean);
  if (!coupleId || clean.length === 0) return;
  try {
    // Import dynamique : garde `firebase/functions` hors du paquet initial.
    const { getFunctions, httpsCallable } = await import("firebase/functions");
    await httpsCallable(getFunctions(undefined, REGION), "purgeReceipts")({
      coupleId,
      paths: clean,
    });
  } catch (err) {
    console.warn("Purge du reçu échouée (sans conséquence) :", err?.message);
  }
}
