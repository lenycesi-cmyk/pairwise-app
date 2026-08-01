// Le widget Patrimoine net affiche « Total Nicolas » / « Total Jessica » quand
// le filtre membre est actif. Ce total additionne des actifs et retranche des
// crédits : si les deux côtés ne partageaient pas la même règle de répartition,
// le résultat serait faux sans qu'aucun écran ne le signale.
import { describe, expect, it } from "vitest";
import { shareForMember } from "../../src/utils/memberShare.js";

const A = "membre-a"; // premier membre du couple — c'est à lui que sharePct se rapporte
const B = "membre-b";

describe("shareForMember", () => {
  it("attribue tout au propriétaire exclusif", () => {
    expect(shareForMember(1000, A, undefined, A, A)).toBe(1000);
    expect(shareForMember(1000, A, undefined, B, A)).toBe(0);
  });

  it("partage à parts égales par défaut", () => {
    expect(shareForMember(1000, "shared", undefined, A, A)).toBe(500);
    expect(shareForMember(1000, "shared", undefined, B, A)).toBe(500);
  });

  it("rapporte sharePct au premier membre et donne le complément à l'autre", () => {
    expect(shareForMember(1000, "shared", 70, A, A)).toBe(700);
    expect(shareForMember(1000, "shared", 70, B, A)).toBe(300);
  });

  it("répartit la totalité d'une ligne partagée, quel que soit le découpage", () => {
    // L'invariant qui compte : rien ne se perd et rien ne se crée entre les deux
    // membres. Une erreur de complément (100 − pct) le casserait immédiatement.
    for (const pct of [0, 12.5, 33, 50, 99, 100]) {
      const a = shareForMember(880, "shared", pct, A, A);
      const b = shareForMember(880, "shared", pct, B, A);
      expect(a + b).toBeCloseTo(880, 10);
    }
  });

  it("ignore une ligne sans propriétaire renseigné", () => {
    expect(shareForMember(1000, null, undefined, A, A)).toBe(0);
    expect(shareForMember(1000, undefined, undefined, A, A)).toBe(0);
  });

  it("ne propage pas une valeur non calculable", () => {
    // Un actif coté dont le cours a échoué vaut NaN : il doit peser 0, pas
    // contaminer le total du membre.
    expect(shareForMember(NaN, A, undefined, A, A)).toBe(0);
    expect(shareForMember(undefined, "shared", undefined, A, A)).toBe(0);
  });

  it("suit le signe de la valeur, pour qu'un crédit reste un passif", () => {
    expect(shareForMember(-4000, "shared", undefined, A, A)).toBe(-2000);
  });
});
