// Le widget « Patrimoine net » annonce une variation « depuis le mois dernier ».
// C'est un chiffre que l'utilisateur lit avant tous les autres et qu'il ne peut
// pas recouper : il n'a pas l'historique sous les yeux. Une erreur de signe, de
// devise ou de date de référence passerait donc inaperçue.
//
// Les assertions portent sur des invariants (from + amount === courant) plutôt
// que sur des nombres calculés à la main, qui n'encoderaient que l'arithmétique
// de l'auteur du test.
import { describe, expect, it } from "vitest";
import { entryOnOrBefore, netWorthMonthlyDelta, oneMonthBefore } from "../../src/utils/netWorthDelta.js";

// Change fictif : 1 USD = 0,5 EUR. Un facteur volontairement grossier, pour
// qu'une conversion oubliée saute aux yeux au lieu de se noyer dans l'arrondi.
const convert = (amount, from, to) => {
  if (from === to) return amount;
  if (from === "USD" && to === "EUR") return amount * 0.5;
  if (from === "EUR" && to === "USD") return amount * 2;
  return amount;
};

describe("oneMonthBefore", () => {
  it("recule d'un mois calendaire", () => {
    expect(oneMonthBefore("2026-08-15")).toBe("2026-07-15");
  });

  it("franchit le passage à l'année", () => {
    expect(oneMonthBefore("2026-01-09")).toBe("2025-12-09");
  });

  it("ne déborde pas sur le mois suivant quand le jour n'existe pas", () => {
    // Le 31 mars moins un mois n'est pas le 3 mars : on borne au dernier jour
    // de février, sinon la comparaison porterait sur la mauvaise période.
    expect(oneMonthBefore("2026-03-31")).toBe("2026-02-28");
    expect(oneMonthBefore("2024-03-31")).toBe("2024-02-29"); // année bissextile
  });

  it("renvoie null sur une date illisible", () => {
    expect(oneMonthBefore("pas-une-date")).toBeNull();
  });
});

describe("entryOnOrBefore", () => {
  const history = [
    { date: "2026-06-01", value: 100 },
    { date: "2026-07-01", value: 200 },
    { date: "2026-07-20", value: 300 },
  ];

  it("prend le point le plus récent antérieur ou égal à la borne", () => {
    expect(entryOnOrBefore(history, "2026-07-10")?.value).toBe(200);
    expect(entryOnOrBefore(history, "2026-07-01")?.value).toBe(200);
  });

  it("ne remonte jamais dans le futur de la borne", () => {
    expect(entryOnOrBefore(history, "2026-05-31")).toBeNull();
  });

  it("tolère un historique absent ou troué", () => {
    expect(entryOnOrBefore(undefined, "2026-07-10")).toBeNull();
    expect(entryOnOrBefore([{ value: 5 }], "2026-07-10")).toBeNull();
  });
});

describe("netWorthMonthlyDelta", () => {
  it("décompose le total actuel en base + variation", () => {
    const history = [{ date: "2026-07-01", value: 180_000, currency: "EUR" }];
    const d = netWorthMonthlyDelta(history, 184_920, "EUR", convert, "2026-08-01");
    // L'invariant qui compte : la variation annoncée ramène bien la base au
    // total affiché à côté d'elle.
    expect(d.from + d.amount).toBe(184_920);
    expect(d.amount).toBeGreaterThan(0);
    expect(d.pct).toBeCloseTo((d.amount / d.from) * 100, 10);
  });

  it("convertit la base historique dans la devise d'affichage", () => {
    // Même patrimoine, historique stocké en USD : sans conversion la variation
    // serait deux fois trop grande et du mauvais côté de zéro.
    const history = [{ date: "2026-07-01", value: 360_000, currency: "USD" }];
    const d = netWorthMonthlyDelta(history, 184_920, "EUR", convert, "2026-08-01");
    expect(d.from).toBe(180_000);
    expect(d.from + d.amount).toBe(184_920);
  });

  it("rend une variation négative quand le patrimoine a reculé", () => {
    const history = [{ date: "2026-07-01", value: 200_000, currency: "EUR" }];
    const d = netWorthMonthlyDelta(history, 184_920, "EUR", convert, "2026-08-01");
    expect(d.amount).toBeLessThan(0);
    expect(d.pct).toBeLessThan(0);
    expect(d.from + d.amount).toBe(184_920);
  });

  it("distingue « pas d'historique » de « aucune variation »", () => {
    // Un historique qui ne remonte pas à un mois ne permet aucune comparaison :
    // afficher « +0 € » laisserait croire à une stagnation.
    const history = [{ date: "2026-07-28", value: 180_000, currency: "EUR" }];
    expect(netWorthMonthlyDelta(history, 184_920, "EUR", convert, "2026-08-01")).toBeNull();
    expect(netWorthMonthlyDelta([], 184_920, "EUR", convert, "2026-08-01")).toBeNull();
  });

  it("renvoie un montant sans pourcentage quand la base est nulle ou négative", () => {
    const history = [{ date: "2026-07-01", value: 0, currency: "EUR" }];
    const d = netWorthMonthlyDelta(history, 4_920, "EUR", convert, "2026-08-01");
    expect(d.amount).toBe(4_920);
    expect(d.pct).toBeNull();
  });

  it("ignore un patrimoine courant non calculable", () => {
    const history = [{ date: "2026-07-01", value: 180_000, currency: "EUR" }];
    expect(netWorthMonthlyDelta(history, NaN, "EUR", convert, "2026-08-01")).toBeNull();
  });
});
