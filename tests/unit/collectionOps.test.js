// Opérations élémentaires sur les collections du document couple. Elles étaient
// jusqu'ici recopiées à la main dans quinze fonctions de FinanceContext — donc
// quinze occasions de diverger, et rien de vérifiable. Les invariants testés ici
// sont ceux que l'adaptateur du mode Local devra reproduire à l'identique.
import { describe, expect, it } from "vitest";
import { upsertIn, patchIn, removeFrom, findIn } from "../../src/utils/collectionOps";

const LISTE = [
  { id: "a", nom: "Courses", montant: 500 },
  { id: "b", nom: "Loisirs", montant: 150 },
];

describe("upsertIn", () => {
  it("ajoute à la fin un élément inconnu", () => {
    const next = upsertIn(LISTE, { id: "c", nom: "Voyage" });
    expect(next).toHaveLength(3);
    expect(next[2].id).toBe("c");
  });

  it("remplace SUR PLACE un élément connu — l'ordre est celui de l'utilisateur", () => {
    const next = upsertIn(LISTE, { id: "a", nom: "Alimentation" });
    expect(next).toHaveLength(2);
    expect(next[0].nom).toBe("Alimentation");
    expect(next[1].id).toBe("b");
  });

  it("ne duplique jamais un identifiant", () => {
    const next = upsertIn(upsertIn(LISTE, { id: "c" }), { id: "c" });
    expect(next.filter((x) => x.id === "c")).toHaveLength(1);
  });

  it("ne modifie pas la liste d'origine", () => {
    const copie = JSON.parse(JSON.stringify(LISTE));
    upsertIn(LISTE, { id: "a", nom: "Autre" });
    expect(LISTE).toEqual(copie);
  });

  it("part d'une liste vide quand l'entrée est absente", () => {
    expect(upsertIn(undefined, { id: "a" })).toEqual([{ id: "a" }]);
  });
});

describe("patchIn", () => {
  it("fusionne sans effacer les champs absents de la mise à jour", () => {
    const next = patchIn(LISTE, "a", { montant: 600 });
    expect(next[0]).toEqual({ id: "a", nom: "Courses", montant: 600 });
  });

  it("laisse la liste inchangée pour un identifiant inconnu — pas d'élément fantôme", () => {
    const next = patchIn(LISTE, "zzz", { montant: 1 });
    expect(next).toEqual(LISTE);
  });

  it("ne touche qu'un seul élément", () => {
    const next = patchIn(LISTE, "a", { montant: 600 });
    expect(next[1]).toEqual(LISTE[1]);
  });

  it("ne modifie pas la liste d'origine", () => {
    const copie = JSON.parse(JSON.stringify(LISTE));
    patchIn(LISTE, "a", { montant: 999 });
    expect(LISTE).toEqual(copie);
  });
});

describe("removeFrom", () => {
  it("retire l'élément visé et lui seul", () => {
    const next = removeFrom(LISTE, "a");
    expect(next).toEqual([LISTE[1]]);
  });

  it("laisse la liste inchangée pour un identifiant inconnu", () => {
    expect(removeFrom(LISTE, "zzz")).toEqual(LISTE);
  });

  it("tolère une liste absente", () => {
    expect(removeFrom(undefined, "a")).toEqual([]);
  });
});

describe("cohérence entre les opérations", () => {
  it("ajouter puis retirer ramène à l'état initial", () => {
    const next = removeFrom(upsertIn(LISTE, { id: "c" }), "c");
    expect(next).toEqual(LISTE);
  });

  it("ce qu'on vient d'ajouter est retrouvable", () => {
    const next = upsertIn(LISTE, { id: "c", nom: "Voyage" });
    expect(findIn(next, "c").nom).toBe("Voyage");
  });

  it("ce qu'on vient de retirer ne l'est plus", () => {
    expect(findIn(removeFrom(LISTE, "a"), "a")).toBeNull();
  });

  it("modifier deux fois équivaut à modifier une fois avec la somme des champs", () => {
    const enDeuxFois = patchIn(patchIn(LISTE, "a", { montant: 600 }), "a", { nom: "X" });
    const enUneFois = patchIn(LISTE, "a", { montant: 600, nom: "X" });
    expect(enDeuxFois).toEqual(enUneFois);
  });
});
