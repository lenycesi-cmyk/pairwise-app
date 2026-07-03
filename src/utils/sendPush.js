// Demande à la Cloud Function `sendPush` de notifier le partenaire.
// Fire-and-forget : un échec de push ne doit jamais faire échouer l'action
// elle-même (la transaction/le commentaire est déjà écrit dans Firestore).
// Le SDK functions est importé dynamiquement (hors bundle initial).
export function sendPushNotification(payload) {
  return import("firebase/functions")
    .then(({ getFunctions, httpsCallable }) =>
      httpsCallable(getFunctions(undefined, "europe-west1"), "sendPush")(payload)
    )
    .catch((err) => {
      console.warn("Push send failed:", err.message);
    });
}
