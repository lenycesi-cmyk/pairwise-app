// Retrouver le CHEMIN de stockage d'un reçu à partir de son URL de
// téléchargement.
//
// Pourquoi c'est nécessaire : les transactions ne conservaient que `receiptURL`,
// une URL à jeton. Or on ne supprime pas un objet par son URL — il faut son
// chemin. Les nouvelles transactions enregistrent donc `receiptPath`, mais
// toutes celles déjà en base ne l'ont pas, et ce sont précisément leurs reçus
// qui traînent aujourd'hui.
//
// La dérivation coûte quelques lignes et rattrape tout l'existant SANS reprise
// de données : au moment où l'utilisateur supprime une vieille transaction, on
// sait de nouveau quoi supprimer.
//
// Forme d'une URL Firebase Storage :
//   https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{chemin%2Fencodé}?alt=media&token=…
// Le chemin est le segment après `/o/`, encodé une fois.

/**
 * Chemin de stockage porté par une URL de téléchargement Firebase, ou `null`
 * si l'URL n'en est pas une (URL externe, chaîne vide, format inattendu).
 */
export function storagePathFromDownloadURL(url) {
  if (typeof url !== "string" || url.length === 0) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)firebasestorage\.googleapis\.com$/.test(parsed.hostname)) return null;

  const marker = "/o/";
  const at = parsed.pathname.indexOf(marker);
  if (at === -1) return null;

  const encoded = parsed.pathname.slice(at + marker.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded) || null;
  } catch {
    return null;
  }
}

/**
 * Chemin à purger pour une transaction : celui enregistré à l'envoi, sinon
 * celui déduit de l'URL. `null` quand il n'y a rien à supprimer.
 */
export function receiptPathOf(tx) {
  if (!tx) return null;
  if (typeof tx.receiptPath === "string" && tx.receiptPath) return tx.receiptPath;
  return storagePathFromDownloadURL(tx.receiptURL);
}
