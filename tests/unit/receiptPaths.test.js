// Retrouver le chemin de stockage d'un reçu conditionne toute la purge : un
// chemin manqué, c'est une image financière qui survit à la suppression de sa
// transaction ET qui reste atteignable par son URL à jeton, que les règles de
// sécurité ne savent pas révoquer. Un chemin FAUX serait pire encore — on
// supprimerait le fichier de quelqu'un d'autre.
import { describe, expect, it } from "vitest";
import { storagePathFromDownloadURL, receiptPathOf } from "../../src/utils/receiptPaths";

const BUCKET = "https://firebasestorage.googleapis.com/v0/b/pairwise-12df2.firebasestorage.app/o";
const CHEMIN = "receipts/uid123/tx456.jpg";
const URL_RECU = `${BUCKET}/${encodeURIComponent(CHEMIN)}?alt=media&token=abcd-1234`;

describe("storagePathFromDownloadURL", () => {
  it("retrouve le chemin encodé d'une URL de téléchargement", () => {
    expect(storagePathFromDownloadURL(URL_RECU)).toBe(CHEMIN);
  });

  it("décode bien les barres obliques encodées", () => {
    expect(storagePathFromDownloadURL(URL_RECU)).toContain("/");
  });

  it("fonctionne sans jeton dans l'URL", () => {
    expect(storagePathFromDownloadURL(`${BUCKET}/${encodeURIComponent(CHEMIN)}`)).toBe(CHEMIN);
  });

  it("gère l'ancien emplacement à plat", () => {
    const plat = "receipts/tx456.jpg";
    expect(storagePathFromDownloadURL(`${BUCKET}/${encodeURIComponent(plat)}?alt=media`)).toBe(plat);
  });

  it("refuse une URL d'un autre domaine — on ne supprime que chez nous", () => {
    expect(
      storagePathFromDownloadURL("https://exemple.com/v0/b/x/o/receipts%2Fuid%2Ftx.jpg")
    ).toBeNull();
  });

  it("refuse ce qui n'est pas une URL", () => {
    for (const mauvais of ["", null, undefined, 42, "pas une url", {}]) {
      expect(storagePathFromDownloadURL(mauvais)).toBeNull();
    }
  });

  it("refuse une URL du bon domaine mais sans segment d'objet", () => {
    expect(storagePathFromDownloadURL("https://firebasestorage.googleapis.com/v0/b/x/o/")).toBeNull();
    expect(storagePathFromDownloadURL("https://firebasestorage.googleapis.com/")).toBeNull();
  });
});

describe("receiptPathOf", () => {
  it("préfère le chemin enregistré à l'envoi", () => {
    expect(receiptPathOf({ receiptPath: "receipts/a/b.jpg", receiptURL: URL_RECU })).toBe(
      "receipts/a/b.jpg"
    );
  });

  it("retombe sur l'URL pour les transactions d'avant — sans reprise de données", () => {
    expect(receiptPathOf({ receiptURL: URL_RECU })).toBe(CHEMIN);
  });

  it("ne renvoie rien quand il n'y a pas de reçu", () => {
    expect(receiptPathOf({})).toBeNull();
    expect(receiptPathOf(null)).toBeNull();
    expect(receiptPathOf({ receiptURL: null })).toBeNull();
  });

  it("ignore un chemin vide au profit de l'URL", () => {
    expect(receiptPathOf({ receiptPath: "", receiptURL: URL_RECU })).toBe(CHEMIN);
  });
});
