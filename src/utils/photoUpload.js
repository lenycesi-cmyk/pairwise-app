import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase";

/**
 * Compresse une image côté client avant upload, pour économiser bande passante
 * et espace de stockage (utile pour les photos de reçus prises au téléphone).
 */
function compressImage(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = reject;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("compression_failed"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;

    reader.readAsDataURL(file);
  });
}

/**
 * Upload une photo vers Firebase Storage et retourne son URL publique.
 * @param {File} file - le fichier image sélectionné/pris par l'utilisateur
 * @param {string} path - chemin de stockage (ex: "profiles/uid.jpg", "receipts/coupleId/txId.jpg")
 */
export async function uploadPhoto(file, path) {
  const compressed = await compressImage(file);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, compressed);
  const url = await getDownloadURL(storageRef);
  return url;
}

/**
 * Supprime une photo de Firebase Storage à partir de son chemin.
 */
export async function deletePhoto(path) {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (err) {
    // Si le fichier n'existe déjà plus, on ignore l'erreur
    console.warn("Suppression photo échouée (peut-être déjà supprimée):", err.message);
  }
}
