import { describe, it, expect } from "vitest";
import { typeOfCategoryId, categoriesForType, txType } from "../../src/utils/txTypes.js";
import { ALL_CATEGORIES } from "../../src/data/categories.js";

// Ce module a été extrait de QUATRE copies identiques de la même règle
// (AddTransactionScreen, RecurringScreen, parseNaturalTransaction,
// CategoriesScreen). Les tests portent donc d'abord sur l'INVARIANT qui leur
// donnait le même sens — la partition du catalogue — plutôt que sur des listes
// d'identifiants recopiées à la main, qui ne feraient que redire le code.

describe("typeOfCategoryId", () => {
  it("range les revenus, les investissements et l'épargne", () => {
    expect(typeOfCategoryId("income")).toBe("income");
    expect(typeOfCategoryId("investment")).toBe("investment");
    expect(typeOfCategoryId("savings")).toBe("investment");
  });

  it("traite tout le reste comme une dépense, y compris l'inconnu", () => {
    expect(typeOfCategoryId("housing")).toBe("expense");
    expect(typeOfCategoryId("une-categorie-perso")).toBe("expense");
    expect(typeOfCategoryId(undefined)).toBe("expense");
  });
});

describe("categoriesForType", () => {
  it("partitionne le catalogue : chaque catégorie dans un type et un seul", () => {
    const parts = ["income", "expense", "investment"].map((t) =>
      categoriesForType(ALL_CATEGORIES, t).map((c) => c.id)
    );
    const union = parts.flat();
    expect(union.slice().sort()).toEqual(ALL_CATEGORIES.map((c) => c.id).sort());
    expect(new Set(union).size).toBe(union.length);
  });

  it("donne aux investissements les DEUX catégories qui les composent", () => {
    // C'est ce qu'aucun filtre par catégorie ne sait exprimer, et la raison
    // d'être du filtre par type dans l'historique.
    expect(categoriesForType(ALL_CATEGORIES, "investment").map((c) => c.id))
      .toEqual(["investment", "savings"]);
  });

  it("conserve l'ordre du catalogue", () => {
    const ids = categoriesForType(ALL_CATEGORIES, "expense").map((c) => c.id);
    const expected = ALL_CATEGORIES.map((c) => c.id).filter((id) => ids.includes(id));
    expect(ids).toEqual(expected);
  });

  it("tolère une liste absente", () => {
    expect(categoriesForType(undefined, "expense")).toEqual([]);
    expect(categoriesForType(null, "income")).toEqual([]);
  });
});

describe("txType", () => {
  it("lit le champ `type` quand il est là", () => {
    expect(txType({ type: "income", categoryId: "housing" })).toBe("income");
    expect(txType({ type: "investment", categoryId: "misc" })).toBe("investment");
  });

  it("retombe sur la catégorie quand `type` manque", () => {
    // Sans ce repli, une transaction sans type sortirait de TOUS les filtres à
    // la fois — « Dépenses » compris —, donc disparaîtrait de l'historique sans
    // que rien ne le signale.
    expect(txType({ categoryId: "income" })).toBe("income");
    expect(txType({ categoryId: "savings" })).toBe("investment");
    expect(txType({ categoryId: "transport" })).toBe("expense");
  });

  it("ne renvoie jamais rien d'inclassable", () => {
    for (const tx of [{}, null, undefined, { type: "" }, { categoryId: null }]) {
      expect(["income", "expense", "investment"]).toContain(txType(tx));
    }
  });
});
