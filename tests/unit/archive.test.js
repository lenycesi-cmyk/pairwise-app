import { describe, it, expect } from "vitest";
import { isArchived, activeItems, partitionArchived, mergeReorder, archivedTags } from "../../src/utils/archive.js";

describe("activeItems", () => {
  // C'est la fonction que la fonction planifiée importe (copiée dans le paquet
  // des Cloud Functions). Le serveur et le navigateur doivent trancher
  // exactement pareil, sans quoi un actif vendu resterait coté chaque nuit et
  // pèserait dans un instantané que rien ne recalcule ensuite.
  it("ne garde que les éléments non archivés", () => {
    const list = [{ id: "a" }, { id: "b", archivedAt: 1 }, { id: "c", archivedAt: null }];
    expect(activeItems(list).map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("tolère une liste absente — le serveur lit un champ qui peut ne pas exister", () => {
    expect(activeItems(undefined)).toEqual([]);
    expect(activeItems(null)).toEqual([]);
  });

  it("s'accorde avec partitionArchived sur la même liste", () => {
    const list = [{ id: "a" }, { id: "b", archivedAt: 5 }, { id: "c" }];
    expect(activeItems(list)).toEqual(partitionArchived(list).active);
  });
});

describe("isArchived", () => {
  it("ne considère archivé que ce qui porte un archivedAt exploitable", () => {
    expect(isArchived({ id: "a", archivedAt: 1700000000000 })).toBe(true);
    expect(isArchived({ id: "a" })).toBe(false);
    // Le désarchivage écrit `null` (patchItem ne sait pas supprimer un champ) :
    // un élément réactivé ne doit pas rester dans l'archive.
    expect(isArchived({ id: "a", archivedAt: null })).toBe(false);
    expect(isArchived(null)).toBe(false);
  });
});

describe("partitionArchived", () => {
  it("garde l'ordre d'origine des actifs et trie les archivés du plus récent au plus ancien", () => {
    const list = [
      { id: "a" },
      { id: "b", archivedAt: 100 },
      { id: "c" },
      { id: "d", archivedAt: 300 },
      { id: "e", archivedAt: 200 },
    ];
    const { active, archived } = partitionArchived(list);
    expect(active.map((x) => x.id)).toEqual(["a", "c"]);
    expect(archived.map((x) => x.id)).toEqual(["d", "e", "b"]);
  });

  it("ne perd aucun élément : actifs + archivés reconstituent la liste", () => {
    const list = [{ id: "a" }, { id: "b", archivedAt: 1 }, { id: "c", archivedAt: 2 }];
    const { active, archived } = partitionArchived(list);
    expect(active.length + archived.length).toBe(list.length);
  });

  it("tolère une liste absente", () => {
    expect(partitionArchived(undefined)).toEqual({ active: [], archived: [] });
  });
});

describe("mergeReorder", () => {
  // C'est LA régression à empêcher : l'écran ne connaît que les actifs, et le
  // glisser-déposer réécrit le tableau entier. Sans ce recollage, réordonner
  // deux budgets viderait l'archive.
  it("réinjecte les archivés absents de l'ordre reçu", () => {
    const full = [
      { id: "a" },
      { id: "b", archivedAt: 100 },
      { id: "c" },
    ];
    const merged = mergeReorder([{ id: "c" }, { id: "a" }], full);
    expect(merged.map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(merged.filter((x) => x.archivedAt)).toHaveLength(1);
  });

  it("n'ajoute rien quand il n'y a aucun archivé", () => {
    const full = [{ id: "a" }, { id: "b" }];
    expect(mergeReorder([{ id: "b" }, { id: "a" }], full).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("archivedTags", () => {
  const TX = [
    { tags: ["formation", "impulsif"] },
    { tags: ["formation"] },
    { tags: ["mariage", "formation"] },
    { tags: [] },
    {},
  ];

  it("ne renvoie que les tags portés par des transactions ET absents de la liste", () => {
    const res = archivedTags(["impulsif"], TX);
    expect(res.map((x) => x.tag)).toEqual(["formation", "mariage"]);
  });

  it("compte les transactions qui portent chaque tag", () => {
    const res = archivedTags(["impulsif"], TX);
    expect(res.find((x) => x.tag === "formation").count).toBe(3);
    expect(res.find((x) => x.tag === "mariage").count).toBe(1);
  });

  it("trie du plus utilisé au moins utilisé, puis par ordre alphabétique", () => {
    const res = archivedTags([], [
      { tags: ["b"] },
      { tags: ["a"] },
      { tags: ["c", "c2"] },
      { tags: ["c"] },
    ]);
    expect(res.map((x) => x.tag)).toEqual(["c", "a", "b", "c2"]);
  });

  it("ignore un tag retiré que plus aucune transaction ne porte", () => {
    // Il ne laisse aucune trace nulle part : il n'y a rien à retrouver, donc
    // rien à afficher dans une archive.
    expect(archivedTags([], [{ tags: ["formation"] }]).map((x) => x.tag)).toEqual(["formation"]);
    expect(archivedTags([], [])).toEqual([]);
  });

  it("ne renvoie rien quand tous les tags utilisés sont encore listés", () => {
    expect(archivedTags(["formation", "impulsif", "mariage"], TX)).toEqual([]);
  });

  it("tolère des entrées absentes", () => {
    expect(archivedTags(undefined, undefined)).toEqual([]);
  });
});
