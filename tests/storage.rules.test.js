// Teste storage.rules contre l'émulateur.
//
// Le test « refuse une fonction inter-services inexistante » est le cœur de ce
// fichier : le 31/07, une règle contenant `firestore.exists` — qui n'existe pas
// dans les règles Storage — s'est déployée SANS erreur, puis a fait échouer
// toute la règle à l'évaluation, refusant chaque envoi de reçu. Le déploiement
// ne résout pas les noms de fonctions inter-services ; l'émulateur, si.
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes } from "firebase/storage";

const ALICE = "uid_alice";
const MALLORY = "uid_mallory";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
const meta = { contentType: "image/jpeg" };

const STORAGE = { host: "127.0.0.1", port: 9199 };

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "pairwise-rules-test",
    storage: { rules: readFileSync("storage.rules", "utf8"), ...STORAGE },
  });
});

afterAll(() => env?.cleanup());

const as = (uid) => env.authenticatedContext(uid).storage();
const anon = () => env.unauthenticatedContext().storage();

describe("receipts/{uid}/{file}", () => {
  it("chacun dépose dans son propre dossier", async () => {
    await assertSucceeds(uploadBytes(ref(as(ALICE), `receipts/${ALICE}/tx1.jpg`), JPEG, meta));
  });

  it("personne ne dépose dans le dossier d'un autre", async () => {
    await assertFails(uploadBytes(ref(as(MALLORY), `receipts/${ALICE}/tx1.jpg`), JPEG, meta));
  });

  it("personne ne lit le reçu d'un autre", async () => {
    await assertFails(getBytes(ref(as(MALLORY), `receipts/${ALICE}/tx1.jpg`)));
  });

  it("un anonyme ne dépose rien", async () => {
    await assertFails(uploadBytes(ref(anon(), `receipts/${ALICE}/tx1.jpg`), JPEG, meta));
  });

  it("un fichier non-image est refusé", async () => {
    await assertFails(
      uploadBytes(ref(as(ALICE), `receipts/${ALICE}/tx2.pdf`), JPEG, {
        contentType: "application/pdf",
      })
    );
  });

  it("l'ancien chemin à plat n'a aucune règle, donc est refusé", async () => {
    await assertFails(uploadBytes(ref(as(ALICE), "receipts/tx1.jpg"), JPEG, meta));
  });
});

describe("profiles/{uid}.jpg", () => {
  it("chacun écrit sa propre photo", async () => {
    await assertSucceeds(uploadBytes(ref(as(ALICE), `profiles/${ALICE}.jpg`), JPEG, meta));
  });

  it("personne n'écrase la photo d'un autre", async () => {
    await assertFails(uploadBytes(ref(as(MALLORY), `profiles/${ALICE}.jpg`), JPEG, meta));
  });
});

// Le garde-fou qui aurait fait gagner une demi-journée. On charge une règle
// délibérément fautive et on vérifie que l'émulateur la rejette à l'évaluation
// — ce que le déploiement, lui, accepte sans broncher.
describe("garde-fou : fonctions inter-services", () => {
  it("`firestore.exists` fait échouer la règle (indisponible dans Storage)", async () => {
    const broken = `
      rules_version = '2';
      service firebase.storage {
        match /b/{bucket}/o {
          match /receipts/{uid}/{file} {
            allow read, write: if request.auth != null
              && firestore.exists(/databases/(default)/documents/couples/x);
          }
        }
      }`;
    const brokenEnv = await initializeTestEnvironment({
      projectId: "pairwise-rules-broken",
      storage: { rules: broken, ...STORAGE },
    });
    try {
      // Même l'auteur légitime est refusé : l'erreur d'évaluation fait échouer
      // TOUTE la règle, elle ne se contente pas de rendre faux le prédicat.
      await assertFails(
        uploadBytes(ref(brokenEnv.authenticatedContext(ALICE).storage(), `receipts/${ALICE}/a.jpg`), JPEG, meta)
      );
    } finally {
      await brokenEnv.cleanup();
    }
  });
});
