// La collecte des cours décide du coût de l'enregistrement quotidien : si elle
// laisse passer un doublon, on paie deux fois le même appel — et à l'échelle, la
// facture suit le nombre d'utilisateurs au lieu du nombre de valeurs suivies.
//
// `makeConverter` est testé pour la raison inverse : ce qu'il renvoie s'écrit
// dans un instantané. Un taux approximatif affiché à l'écran se corrige au
// rechargement ; le même taux figé dans l'historique ne se corrige jamais.
import { describe, expect, it } from "vitest";
import { chunk, collectPriceTargets, makeConverter } from "../../src/utils/priceTargets.js";

const TYPES = [
  { id: "account" },
  { id: "cash" },
  { id: "stocks", hasApiPrice: true, priceSource: "stocks" },
  { id: "crypto", hasApiPrice: true, priceSource: "crypto" },
];

describe("collectPriceTargets", () => {
  it("ne compte qu'une fois un symbole détenu par plusieurs couples", () => {
    // Le point de tout l'exercice : dix foyers avec du Bitcoin, un seul appel.
    const assets = Array.from({ length: 10 }, (_, i) => ({
      id: `a${i}`, typeId: "crypto", apiId: "bitcoin",
    }));
    expect(collectPriceTargets(assets, TYPES).crypto).toEqual(["bitcoin"]);
  });

  it("sépare les cryptos des titres", () => {
    const assets = [
      { typeId: "crypto", apiId: "ethereum" },
      { typeId: "stocks", apiId: "AAPL" },
    ];
    expect(collectPriceTargets(assets, TYPES)).toEqual({ crypto: ["ethereum"], stocks: ["AAPL"] });
  });

  it("normalise la casse pour ne pas payer deux fois le même symbole", () => {
    const assets = [
      { typeId: "stocks", apiId: "aapl" },
      { typeId: "stocks", apiId: "AAPL" },
      { typeId: "crypto", apiId: "Bitcoin" },
      { typeId: "crypto", apiId: "bitcoin" },
    ];
    const out = collectPriceTargets(assets, TYPES);
    expect(out.stocks).toEqual(["AAPL"]);
    expect(out.crypto).toEqual(["bitcoin"]);
  });

  it("ignore les actifs sans cotation ou sans identifiant d'API", () => {
    const assets = [
      { typeId: "account", apiId: "LIVRET" }, // type non coté
      { typeId: "crypto" },                    // pas d'apiId
      { typeId: "crypto", apiId: "" },
      null,
    ];
    expect(collectPriceTargets(assets, TYPES)).toEqual({ crypto: [], stocks: [] });
  });

  it("rend un ordre déterministe", () => {
    const a = collectPriceTargets([
      { typeId: "crypto", apiId: "solana" }, { typeId: "crypto", apiId: "bitcoin" },
    ], TYPES);
    const b = collectPriceTargets([
      { typeId: "crypto", apiId: "bitcoin" }, { typeId: "crypto", apiId: "solana" },
    ], TYPES);
    expect(a.crypto).toEqual(b.crypto);
  });

  it("tolère des entrées absentes", () => {
    expect(collectPriceTargets(undefined, undefined)).toEqual({ crypto: [], stocks: [] });
  });
});

describe("chunk", () => {
  it("découpe sans rien perdre ni dupliquer", () => {
    const list = Array.from({ length: 250 }, (_, i) => i);
    const parts = chunk(list, 100);
    expect(parts.map((p) => p.length)).toEqual([100, 100, 50]);
    expect(parts.flat()).toEqual(list);
  });

  it("rend une liste vide plutôt que de boucler sans fin sur une taille nulle", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([]);
    expect(chunk(null, 10)).toEqual([]);
  });
});

describe("makeConverter", () => {
  // Table à base EUR, comme la réponse d'open.er-api.com.
  const convert = makeConverter({ EUR: 1, USD: 2, GBP: 0.5 }, "EUR");

  it("laisse une somme inchangée dans sa propre devise", () => {
    expect(convert(100, "EUR", "EUR")).toBe(100);
    expect(convert(100, "USD", "USD")).toBe(100);
  });

  it("convertit depuis et vers la devise de base", () => {
    expect(convert(100, "USD", "EUR")).toBe(50);
    expect(convert(100, "EUR", "USD")).toBe(200);
  });

  it("convertit entre deux devises tierces en passant par la base", () => {
    // 100 USD = 50 EUR = 25 GBP.
    expect(convert(100, "USD", "GBP")).toBe(25);
  });

  it("revient au point de départ sur un aller-retour", () => {
    // L'invariant : convertir puis reconvertir ne doit rien créer ni perdre.
    for (const [a, b] of [["USD", "GBP"], ["EUR", "USD"], ["GBP", "EUR"]]) {
      expect(convert(convert(880, a, b), b, a)).toBeCloseTo(880, 10);
    }
  });

  it("renvoie NaN sur une devise inconnue au lieu d'inventer un taux", () => {
    // C'est le comportement voulu : l'appelant doit abandonner l'enregistrement
    // du jour plutôt qu'écrire une valeur fabriquée dans l'historique.
    expect(convert(100, "XYZ", "EUR")).toBeNaN();
    expect(convert(100, "EUR", "XYZ")).toBeNaN();
    expect(makeConverter(null, "EUR")(100, "USD", "EUR")).toBeNaN();
  });

  it("ne propage pas un montant non calculable", () => {
    expect(convert(NaN, "USD", "EUR")).toBeNaN();
  });
});
