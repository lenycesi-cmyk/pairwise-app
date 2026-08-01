// Teste firestore.rules contre l'émulateur : le vrai moteur de règles, pas une
// approximation. C'est ce qui manquait le 31/07, où une règle Storage
// syntaxiquement valide s'est déployée sans erreur puis a tout refusé à
// l'évaluation.
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from "firebase/firestore";

const ALICE = "uid_alice";
const BOB = "uid_bob";
const MALLORY = "uid_mallory";
const COUPLE = "ABC123";

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "pairwise-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

afterAll(() => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  // Semis hors règles : on prépare l'état, on ne teste pas l'écriture ici.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "couples", COUPLE), {
      members: [
        { uid: ALICE, memberId: ALICE, name: "Alice" },
        { uid: BOB, memberId: BOB, name: "Bob" },
      ],
      memberUids: [ALICE, BOB],
      defaultCurrency: "EUR",
    });
    await setDoc(doc(db, "couples", COUPLE, "transactions", "tx1"), { amount: 10 });
    // Espace hérité, sans memberUids : le cas que la tolérance ouvrait à tous.
    await setDoc(doc(db, "couples", "LEGACY"), { members: [{ uid: ALICE }] });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe("couples/{coupleId}", () => {
  it("un membre lit son espace", async () => {
    await assertSucceeds(getDoc(doc(as(ALICE), "couples", COUPLE)));
  });

  it("un non-membre ne lit pas", async () => {
    await assertFails(getDoc(doc(as(MALLORY), "couples", COUPLE)));
  });

  it("un anonyme ne lit pas", async () => {
    await assertFails(getDoc(doc(anon(), "couples", COUPLE)));
  });

  it("un membre écrit", async () => {
    await assertSucceeds(updateDoc(doc(as(ALICE), "couples", COUPLE), { coupleName: "Nous" }));
  });

  // LA régression à empêcher : la clause retirée dans la PR #345 laissait un
  // inconnu s'ajouter lui-même, ce qui lui donnait l'accès ET verrouillait les
  // propriétaires dehors.
  it("un inconnu ne peut PAS s'ajouter à memberUids", async () => {
    await assertFails(
      updateDoc(doc(as(MALLORY), "couples", COUPLE), { memberUids: [ALICE, BOB, MALLORY] })
    );
  });

  it("un inconnu ne peut PAS écraser memberUids par le sien", async () => {
    await assertFails(
      updateDoc(doc(as(MALLORY), "couples", COUPLE), { memberUids: [MALLORY] })
    );
  });

  // Régression de la PR #346 : sans memberUids, tout compte authentifié était
  // considéré membre.
  it("un doc sans memberUids est refusé à tout le monde", async () => {
    await assertFails(getDoc(doc(as(MALLORY), "couples", "LEGACY")));
    await assertFails(getDoc(doc(as(ALICE), "couples", "LEGACY")));
  });

  it("on ne peut pas créer un couple sans s'y inclure", async () => {
    await assertFails(
      setDoc(doc(as(MALLORY), "couples", "NEW1"), { memberUids: [ALICE] })
    );
  });

  it("on peut créer un couple en s'y incluant", async () => {
    await assertSucceeds(
      setDoc(doc(as(MALLORY), "couples", "NEW2"), { memberUids: [MALLORY] })
    );
  });
});

describe("couples/{id}/transactions", () => {
  it("un membre lit et écrit", async () => {
    await assertSucceeds(getDoc(doc(as(BOB), "couples", COUPLE, "transactions", "tx1")));
    await assertSucceeds(
      addDoc(collection(as(BOB), "couples", COUPLE, "transactions"), { amount: 5 })
    );
  });

  it("un non-membre ne lit pas", async () => {
    await assertFails(getDoc(doc(as(MALLORY), "couples", COUPLE, "transactions", "tx1")));
  });
});

describe("couples/{id}/netWorthSnapshots", () => {
  it("un membre lit l'historique détaillé", async () => {
    await assertSucceeds(getDoc(doc(as(BOB), "couples", COUPLE, "netWorthSnapshots", "2026-08-01")));
  });

  it("un non-membre ne lit pas", async () => {
    await assertFails(getDoc(doc(as(MALLORY), "couples", COUPLE, "netWorthSnapshots", "2026-08-01")));
  });

  it("même un membre ne peut PAS écrire un instantané", async () => {
    // Un instantané est un chiffre historique que rien ne recalcule. Laisser le
    // client en écrire, ce serait lui permettre de réécrire son propre passé et
    // rendre le tableau d'évolution invérifiable. Seule la fonction planifiée
    // écrit ici, via l'admin SDK qui contourne ces règles.
    await assertFails(
      setDoc(doc(as(ALICE), "couples", COUPLE, "netWorthSnapshots", "2026-08-01"), { value: 1 })
    );
  });
});

describe("données sensibles verrouillées côté serveur", () => {
  it("bankConnections est inaccessible au client, même membre", async () => {
    await assertFails(getDoc(doc(as(ALICE), "couples", COUPLE, "bankConnections", "a1")));
    await assertFails(
      setDoc(doc(as(ALICE), "couples", COUPLE, "bankConnections", "a1"), { accessToken: "x" })
    );
  });

  it("plaidItems est inaccessible au client", async () => {
    await assertFails(getDoc(doc(as(ALICE), "plaidItems", "item1")));
  });
});

describe("users/{uid}", () => {
  it("chacun lit et écrit son profil", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), "users", ALICE), { coupleId: COUPLE }));
  });

  it("personne ne lit le profil d'un autre", async () => {
    await assertFails(getDoc(doc(as(MALLORY), "users", ALICE)));
  });
});
