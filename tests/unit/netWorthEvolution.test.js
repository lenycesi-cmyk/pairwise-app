// Deux règles de ce module se codent à l'envers une fois sur deux, et aucune ne
// se voit à l'œil sur un écran :
//
//  1. Une dette qui DIMINUE enrichit le foyer — un prêt qui passe de 5 400 à
//     5 000 apporte +400, pas −400.
//  2. « Pas de comparaison possible » n'est pas « aucun changement ». Un mois
//     sans antécédent rend null, jamais 0.
//
// Les assertions portent sur des invariants (la somme des mouvements reconstitue
// la variation du patrimoine net) plutôt que sur des nombres recopiés à la main.
import { describe, expect, it } from "vitest";
import {
  buildMonthlyTable,
  lastSnapshotPerMonth,
  loansPortionOf,
  monthKeyOf,
  movementsBetween,
} from "../../src/utils/netWorthEvolution.js";

const LIAB = new Set(["debt"]);

// Instantané minimal : les totaux sont calculés pour rester cohérents entre eux,
// comme le fait la fonction planifiée.
function snap(date, entries, { loans = 0, currency = "EUR" } = {}) {
  const byType = {};
  for (const e of entries) byType[e.typeId] = (byType[e.typeId] || 0) + e.value;
  let totalAssets = 0;
  let totalLiabilities = loans;
  for (const [typeId, v] of Object.entries(byType)) {
    if (LIAB.has(typeId)) totalLiabilities += Math.abs(v);
    else totalAssets += v;
  }
  return {
    date, currency, byType, entries,
    totalAssets, totalLiabilities, value: totalAssets - totalLiabilities,
  };
}

const e = (assetId, typeId, value, label = assetId) => ({ assetId, typeId, label, value });

describe("monthKeyOf / lastSnapshotPerMonth", () => {
  it("garde le DERNIER instantané du mois, pas une moyenne", () => {
    // Un patrimoine est une valeur instantanée : moyenner n'aurait aucun sens.
    const byMonth = lastSnapshotPerMonth([
      snap("2026-07-03", [e("a", "account", 100)]),
      snap("2026-07-28", [e("a", "account", 300)]),
      snap("2026-08-01", [e("a", "account", 500)]),
    ]);
    expect(byMonth.get("2026-07").value).toBe(300);
    expect(byMonth.get("2026-08").value).toBe(500);
  });

  it("ignore les dates illisibles", () => {
    expect(monthKeyOf("2026-08-01")).toBe("2026-08");
    expect(monthKeyOf("nope")).toBeNull();
    expect(lastSnapshotPerMonth([{ date: null }]).size).toBe(0);
  });
});

describe("loansPortionOf", () => {
  it("isole le capital des crédits, absent de byType", () => {
    const s = snap("2026-08-01", [e("d", "debt", 2000)], { loans: 5000 });
    expect(loansPortionOf(s, LIAB)).toBe(5000);
  });

  it("ne rend pas un résidu d'arrondi négatif", () => {
    const s = snap("2026-08-01", [e("d", "debt", 2000)]);
    expect(loansPortionOf(s, LIAB)).toBe(0);
  });
});

describe("buildMonthlyTable", () => {
  const snaps = [
    snap("2026-06-30", [e("a", "account", 1000), e("c", "crypto", 500)], { loans: 6000 }),
    snap("2026-07-31", [e("a", "account", 1200), e("c", "crypto", 800)], { loans: 5500 }),
    snap("2026-08-31", [e("a", "account", 1100), e("c", "crypto", 1400)], { loans: 5000 }),
  ];

  it("aligne une colonne par mois, dans l'ordre", () => {
    const t = buildMonthlyTable(snaps, LIAB);
    expect(t.months).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("laisse la variation du premier mois à null, pas à zéro", () => {
    // C'est la règle 2 : rien avant lui à quoi le comparer.
    const t = buildMonthlyTable(snaps, LIAB);
    expect(t.totals.change[0]).toBeNull();
    expect(t.totals.change[1]).not.toBeNull();
  });

  it("fait correspondre les variations aux écarts de patrimoine net", () => {
    const t = buildMonthlyTable(snaps, LIAB);
    for (let i = 1; i < t.months.length; i++) {
      expect(t.totals.change[i]).toBeCloseTo(t.totals.net[i] - t.totals.net[i - 1], 10);
    }
  });

  it("sort les crédits en ligne propre puisqu'ils ne sont pas un type d'actif", () => {
    const t = buildMonthlyTable(snaps, LIAB);
    const loansRow = t.liabilityRows.find((r) => r.isLoans);
    expect(loansRow.values).toEqual([6000, 5500, 5000]);
  });

  it("rend null pour un poste absent d'un mois, pas zéro", () => {
    const t = buildMonthlyTable([
      snap("2026-07-31", [e("a", "account", 1000)]),
      snap("2026-08-31", [e("a", "account", 1000), e("c", "crypto", 400)]),
    ], LIAB);
    const crypto = t.assetRows.find((r) => r.typeId === "crypto");
    expect(crypto.values).toEqual([null, 400]);
  });

  it("limite au nombre de mois demandé, en gardant les plus récents", () => {
    const t = buildMonthlyTable(snaps, LIAB, { limit: 2 });
    expect(t.months).toEqual(["2026-07", "2026-08"]);
  });

  it("tolère un historique vide", () => {
    const t = buildMonthlyTable([], LIAB);
    expect(t.months).toEqual([]);
    expect(t.assetRows).toEqual([]);
  });
});

describe("movementsBetween", () => {
  it("compte une dette qui BAISSE comme un gain", () => {
    // La règle 1, isolée. Un prêt de 5 400 → 5 000, c'est +400 pour le foyer.
    const prev = snap("2026-07-31", [e("d", "debt", 5400)]);
    const curr = snap("2026-08-31", [e("d", "debt", 5000)]);
    const m = movementsBetween(prev, curr, LIAB);
    expect(m.byType.find((g) => g.typeId === "debt").delta).toBe(400);
  });

  it("compte une dette qui MONTE comme une perte", () => {
    const prev = snap("2026-07-31", [e("d", "debt", 5000)]);
    const curr = snap("2026-08-31", [e("d", "debt", 5400)]);
    expect(movementsBetween(prev, curr, LIAB).byType[0].delta).toBe(-400);
  });

  it("applique la même règle au capital des crédits", () => {
    const prev = snap("2026-07-31", [e("a", "account", 100)], { loans: 5400 });
    const curr = snap("2026-08-31", [e("a", "account", 100)], { loans: 5000 });
    const m = movementsBetween(prev, curr, LIAB);
    expect(m.byType.find((g) => g.isLoans).delta).toBe(400);
  });

  it("reconstitue exactement la variation du patrimoine net", () => {
    // L'invariant central : la somme des mouvements EST la variation annoncée en
    // tête d'écran. S'ils divergent, un poste est compté à l'envers ou oublié.
    const prev = snap("2026-07-31", [
      e("a", "account", 1200), e("c", "crypto", 800), e("d", "debt", 900),
    ], { loans: 5500 });
    const curr = snap("2026-08-31", [
      e("a", "account", 1100), e("c", "crypto", 1400), e("d", "debt", 700),
    ], { loans: 5000 });
    const m = movementsBetween(prev, curr, LIAB);
    const sum = m.byType.reduce((s, g) => s + g.delta, 0);
    expect(sum).toBeCloseTo(m.total, 10);
    expect(m.total).toBeCloseTo(curr.value - prev.value, 10);
  });

  it("marque un actif apparu dans le mois sans lui inventer de variation", () => {
    const prev = snap("2026-07-31", [e("a", "account", 1000)]);
    const curr = snap("2026-08-31", [e("a", "account", 1000), e("n", "crypto", 700, "Nouveau")]);
    const m = movementsBetween(prev, curr, LIAB);
    const asset = m.byType.flatMap((g) => g.assets).find((x) => x.assetId === "n");
    expect(asset.isNew).toBe(true);
    expect(asset.delta).toBeNull();
  });

  it("descend jusqu'à l'actif à l'intérieur d'un type", () => {
    const prev = snap("2026-07-31", [e("b", "crypto", 500, "Bitcoin"), e("x", "crypto", 300, "Ethereum")]);
    const curr = snap("2026-08-31", [e("b", "crypto", 900, "Bitcoin"), e("x", "crypto", 250, "Ethereum")]);
    const g = movementsBetween(prev, curr, LIAB).byType[0];
    expect(g.assets.find((a) => a.label === "Bitcoin").delta).toBe(400);
    expect(g.assets.find((a) => a.label === "Ethereum").delta).toBe(-50);
    // Le total du type reste la somme de ses actifs.
    expect(g.delta).toBe(350);
  });

  it("sépare les postes inchangés des mouvements", () => {
    const prev = snap("2026-07-31", [e("a", "account", 1000), e("h", "real_estate", 200000)]);
    const curr = snap("2026-08-31", [e("a", "account", 1200), e("h", "real_estate", 200000)]);
    const m = movementsBetween(prev, curr, LIAB);
    expect(m.byType.map((g) => g.typeId)).toEqual(["account"]);
    expect(m.unchanged.map((g) => g.typeId)).toEqual(["real_estate"]);
  });

  it("rend null sans point de comparaison", () => {
    // Règle 2 : le premier mois enregistré n'a pas de « ce qui a bougé ».
    expect(movementsBetween(null, snap("2026-08-31", [e("a", "account", 1)]), LIAB)).toBeNull();
    expect(movementsBetween(snap("2026-07-31", [e("a", "account", 1)]), null, LIAB)).toBeNull();
  });
});
