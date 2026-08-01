// La valorisation d'un actif tourne à DEUX endroits : dans le navigateur pour
// l'onglet Patrimoine, et dans une Cloud Function pour l'enregistrement quotidien.
// Le module est partagé pour qu'ils ne puissent pas diverger, mais le partage ne
// dit rien de la justesse de la règle — d'où ces tests.
//
// L'enjeu est particulier ici : une erreur côté navigateur s'efface au
// rechargement, alors qu'une erreur côté serveur s'ÉCRIT dans l'historique et y
// reste. Les cas limites (cours manquant, devise exotique, valeur nulle) comptent
// donc autant que le cas nominal.
import { describe, expect, it } from "vitest";
import { buildSnapshotEntries, sumEntriesByType, valueOfAsset } from "../../src/utils/assetValuation.js";

// Change fictif volontairement grossier : 1 USD = 0,5 EUR. Une conversion oubliée
// saute aux yeux au lieu de se noyer dans l'arrondi.
const convert = (amount, from, to) => {
  if (!Number.isFinite(amount)) return NaN;
  if (from === to) return amount;
  if (from === "USD" && to === "EUR") return amount * 0.5;
  if (from === "EUR" && to === "USD") return amount * 2;
  return amount;
};
const ctx = (livePrices = {}) => ({ livePrices, convert, displayCurrency: "EUR" });

describe("valueOfAsset — ordre des sources", () => {
  it("préfère le cours en direct au prix manuel et à la valeur stockée", () => {
    const asset = { id: "a1", manualPrice: 100, quantity: 2, value: 999, currency: "EUR" };
    expect(valueOfAsset(asset, ctx({ a1: 4200 }))).toBe(4200);
  });

  it("retombe sur le prix manuel quand le cours est nul ou invalide", () => {
    // Une clé API limitée renvoie 0 : ce 0 ne doit PAS écraser le prix manuel,
    // sinon l'historique enregistre un actif disparu pour la journée.
    const asset = { id: "a1", manualPrice: 100, quantity: 3, currency: "EUR" };
    expect(valueOfAsset(asset, ctx({ a1: 0 }))).toBe(300);
    expect(valueOfAsset(asset, ctx({ a1: -5 }))).toBe(300);
    expect(valueOfAsset(asset, ctx({}))).toBe(300);
  });

  it("retombe sur la valeur stockée sans cours ni prix manuel", () => {
    expect(valueOfAsset({ id: "a1", value: 1500, currency: "EUR" }, ctx())).toBe(1500);
  });

  it("compte une quantité absente comme une unité", () => {
    expect(valueOfAsset({ id: "a1", manualPrice: 250, currency: "EUR" }, ctx())).toBe(250);
  });
});

describe("valueOfAsset — devises", () => {
  it("convertit le prix manuel depuis SA devise, pas celle de l'actif", () => {
    // Un titre coté en USD, détenu sur un compte en EUR : 10 × 40 USD = 400 USD
    // = 200 EUR. Prendre la devise de l'actif donnerait 400 — le double.
    const asset = { id: "a1", manualPrice: 40, manualPriceCurrency: "USD", quantity: 10, currency: "EUR" };
    expect(valueOfAsset(asset, ctx())).toBe(200);
  });

  it("retombe sur la devise de l'actif quand le prix manuel n'en précise pas", () => {
    const asset = { id: "a1", manualPrice: 40, quantity: 10, currency: "USD" };
    expect(valueOfAsset(asset, ctx())).toBe(200);
  });

  it("convertit la valeur stockée depuis la devise de l'actif", () => {
    expect(valueOfAsset({ id: "a1", value: 1000, currency: "USD" }, ctx())).toBe(500);
  });

  it("suppose la devise d'affichage quand l'actif n'en porte aucune", () => {
    expect(valueOfAsset({ id: "a1", value: 1000 }, ctx())).toBe(1000);
  });
});

describe("valueOfAsset — rien d'exploitable", () => {
  it("renvoie 0 plutôt que NaN quand la conversion échoue", () => {
    // Un actif coté sans cours ni valeur : le NaN doit s'arrêter ici, sinon il
    // contamine le total du foyer et l'instantané du jour.
    expect(valueOfAsset({ id: "a1", apiId: "bitcoin", quantity: 2 }, ctx())).toBe(0);
    expect(valueOfAsset({ id: "a1", value: NaN, currency: "EUR" }, ctx())).toBe(0);
  });

  it("tolère l'absence d'actif", () => {
    expect(valueOfAsset(null, ctx())).toBe(0);
    expect(valueOfAsset(undefined, ctx())).toBe(0);
  });
});

describe("buildSnapshotEntries", () => {
  const assets = [
    { id: "a1", typeId: "account", name: "Livret A", value: 8000, currency: "EUR" },
    { id: "a2", typeId: "stocks", name: "PEA", value: 2000, currency: "USD" },
  ];

  it("recopie le type et le libellé dans chaque ligne", () => {
    // Un instantané doit rester lisible seul : un actif supprimé plus tard ne
    // doit pas rendre son historique indéchiffrable.
    const [first] = buildSnapshotEntries(assets, ctx());
    expect(first).toEqual({ assetId: "a1", typeId: "account", label: "Livret A", value: 8000 });
  });

  it("valorise chaque ligne dans la devise d'affichage", () => {
    const entries = buildSnapshotEntries(assets, ctx());
    expect(entries.map((e) => e.value)).toEqual([8000, 1000]);
  });

  it("écarte les entrées sans identifiant plutôt que d'écrire une ligne anonyme", () => {
    expect(buildSnapshotEntries([{ typeId: "cash", value: 50 }, null], ctx())).toEqual([]);
  });

  it("range un actif sans type dans « autres » au lieu de le perdre", () => {
    const [e] = buildSnapshotEntries([{ id: "x", value: 10, currency: "EUR" }], ctx());
    expect(e.typeId).toBe("other_assets");
  });

  it("tolère une liste absente", () => {
    expect(buildSnapshotEntries(undefined, ctx())).toEqual([]);
  });
});

describe("sumEntriesByType", () => {
  it("regroupe les lignes par type", () => {
    const entries = [
      { assetId: "a", typeId: "account", value: 100 },
      { assetId: "b", typeId: "account", value: 50 },
      { assetId: "c", typeId: "stocks", value: 300 },
    ];
    expect(sumEntriesByType(entries)).toEqual({ account: 150, stocks: 300 });
  });

  it("conserve le total général quel que soit le regroupement", () => {
    // L'invariant qui compte : agréger ne crée ni ne perd de valeur.
    const entries = [
      { assetId: "a", typeId: "account", value: 1234.5 },
      { assetId: "b", typeId: "crypto", value: 987.25 },
      { assetId: "c", typeId: "crypto", value: 12.25 },
    ];
    const total = entries.reduce((s, e) => s + e.value, 0);
    const byType = sumEntriesByType(entries);
    expect(Object.values(byType).reduce((s, v) => s + v, 0)).toBeCloseTo(total, 10);
  });

  it("ignore une ligne non calculable au lieu de propager NaN", () => {
    const byType = sumEntriesByType([
      { assetId: "a", typeId: "account", value: 100 },
      { assetId: "b", typeId: "account", value: NaN },
    ]);
    expect(byType.account).toBe(100);
  });
});
