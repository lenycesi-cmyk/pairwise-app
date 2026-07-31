import { describe, expect, it } from "vitest";
import {
  ASSET_CLASSES,
  RISK_PROFILES,
  REBALANCE_BAND,
  classOfAsset,
  growthShare,
  suggestProfileForAge,
  matchProfile,
  migrateLegacyTargets,
  computeClassTotals,
  computeDrift,
} from "../../src/data/allocationModels.js";

const byValue = (a) => a.value ?? 0;

describe("cohérence des profils de risque", () => {
  // Une grille qui ne somme pas à 100 fausserait tous les écarts affichés.
  it("chaque profil somme à 100 %", () => {
    for (const p of RISK_PROFILES) {
      const total = ASSET_CLASSES.reduce((s, c) => s + (p.weights[c.id] || 0), 0);
      expect(total, `profil ${p.id}`).toBe(100);
    }
  });

  it("chaque profil pondère toutes les classes connues", () => {
    for (const p of RISK_PROFILES) {
      expect(Object.keys(p.weights).sort()).toEqual(ASSET_CLASSES.map((c) => c.id).sort());
    }
  });

  it("la part de croissance augmente avec l'agressivité", () => {
    const shares = RISK_PROFILES.map((p) => growthShare(p.weights));
    for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeGreaterThan(shares[i - 1]);
  });
});

describe("classOfAsset", () => {
  it("classe par type d'actif", () => {
    expect(classOfAsset({ typeId: "account" })).toBe("liquidity");
    expect(classOfAsset({ typeId: "stocks" })).toBe("equities");
    expect(classOfAsset({ typeId: "crypto" })).toBe("alternatives");
  });

  it("le sous-type prime sur le type", () => {
    expect(classOfAsset({ typeId: "life_insurance" })).toBe("bonds");
    expect(classOfAsset({ typeId: "life_insurance", subtype: "uc" })).toBe("equities");
    expect(classOfAsset({ typeId: "bonds", subtype: "money_market" })).toBe("liquidity");
  });

  it("exclut la résidence principale, les véhicules et les dettes", () => {
    expect(classOfAsset({ typeId: "real_estate", subtype: "primary" })).toBeNull();
    expect(classOfAsset({ typeId: "vehicle" })).toBeNull();
    expect(classOfAsset({ typeId: "debt" })).toBeNull();
  });

  it("ne plante pas sur un actif absent ou inconnu", () => {
    expect(classOfAsset(null)).toBeNull();
    expect(classOfAsset({ typeId: "inexistant" })).toBeNull();
  });
});

describe("suggestProfileForAge", () => {
  it("applique la règle des 110 − âge", () => {
    expect(suggestProfileForAge(30).growthTarget).toBe(80);
    expect(suggestProfileForAge(60).growthTarget).toBe(50);
  });

  it("borne la cible entre 20 et 90", () => {
    expect(suggestProfileForAge(5).growthTarget).toBe(90);
    expect(suggestProfileForAge(95).growthTarget).toBe(20);
  });

  it("retient le profil dont la part de croissance est la plus proche", () => {
    // 30 ans → cible 80 : dynamique (77) est plus proche qu'offensif (90).
    expect(suggestProfileForAge(30).profile.id).toBe("dynamique");
    // 95 ans → cible 20 : prudent (35) est le moins éloigné.
    expect(suggestProfileForAge(95).profile.id).toBe("prudent");
  });

  it("renvoie null sur un âge absurde", () => {
    expect(suggestProfileForAge(0)).toBeNull();
    expect(suggestProfileForAge(-3)).toBeNull();
    expect(suggestProfileForAge(undefined)).toBeNull();
  });
});

describe("matchProfile", () => {
  it("reconnaît une grille standard", () => {
    expect(matchProfile(RISK_PROFILES[1].weights).id).toBe("equilibre");
  });

  it("tolère un écart d'un point", () => {
    const w = { ...RISK_PROFILES[1].weights, equities: 41, liquidity: 11 };
    expect(matchProfile(w)?.id).toBe("equilibre");
  });

  it("ne reconnaît pas une grille personnalisée", () => {
    expect(matchProfile({ liquidity: 50, bonds: 10, equities: 30, realestate: 5, alternatives: 5 })).toBeNull();
    expect(matchProfile(null)).toBeNull();
  });
});

describe("migrateLegacyTargets", () => {
  it("replie les anciennes clés par type sur les classes de risque", () => {
    const out = migrateLegacyTargets({ account: 20, stocks: 50, crypto: 30 });
    expect(out.liquidity).toBe(20);
    expect(out.equities).toBe(50);
    expect(out.alternatives).toBe(30);
  });

  it("additionne deux types tombant dans la même classe", () => {
    const out = migrateLegacyTargets({ account: 10, cash: 15 });
    expect(out.liquidity).toBe(25);
  });

  it("laisse intacte une map déjà exprimée en classes", () => {
    const already = { liquidity: 10, bonds: 20, equities: 50, realestate: 15, alternatives: 5 };
    expect(migrateLegacyTargets(already)).toBe(already);
  });

  it("ne plante pas sur une map vide", () => {
    expect(migrateLegacyTargets(null)).toEqual({});
  });
});

describe("computeClassTotals", () => {
  const assets = [
    { typeId: "account", value: 10000 },
    { typeId: "stocks", value: 40000 },
    { typeId: "crypto", value: 10000 },
    { typeId: "real_estate", subtype: "primary", value: 300000 }, // exclu
    { typeId: "vehicle", value: 15000 }, // exclu
    { typeId: "debt", value: 50000 }, // ni investissable ni « exclu »
  ];

  it("ne compte que l'investissable", () => {
    const { totals, investable } = computeClassTotals(assets, byValue);
    expect(investable).toBe(60000);
    expect(totals.liquidity).toBe(10000);
    expect(totals.equities).toBe(40000);
    expect(totals.alternatives).toBe(10000);
  });

  it("remonte séparément ce qui est volontairement écarté", () => {
    const { excluded } = computeClassTotals(assets, byValue);
    expect(excluded).toBe(315000); // résidence principale + véhicule, sans la dette
  });

  it("ignore les valeurs nulles ou non finies", () => {
    const { investable } = computeClassTotals(
      [{ typeId: "account", value: 0 }, { typeId: "stocks", value: NaN }],
      byValue
    );
    expect(investable).toBe(0);
  });

  it("ne plante pas sans actifs", () => {
    const { totals, investable } = computeClassTotals(null, byValue);
    expect(investable).toBe(0);
    for (const c of ASSET_CLASSES) expect(totals[c.id]).toBe(0);
  });
});

describe("computeDrift", () => {
  const weights = { liquidity: 10, bonds: 20, equities: 50, realestate: 15, alternatives: 5 };

  it("un patrimoine conforme à la cible est équilibré", () => {
    const totals = { liquidity: 10000, bonds: 20000, equities: 50000, realestate: 15000, alternatives: 5000 };
    const { balanced, maxDrift, actions } = computeDrift(totals, 100000, weights);
    expect(maxDrift).toBeCloseTo(0, 6);
    expect(balanced).toBe(true);
    expect(actions).toHaveLength(0);
  });

  it("le delta indique le montant à investir ou à alléger", () => {
    // Tout en actions : 100 000 au lieu des 50 000 visés → alléger de 50 000.
    const totals = { liquidity: 0, bonds: 0, equities: 100000, realestate: 0, alternatives: 0 };
    const { rows } = computeDrift(totals, 100000, weights);
    const equities = rows.find((r) => r.class.id === "equities");
    expect(equities.currentPct).toBe(100);
    expect(equities.targetAmount).toBe(50000);
    expect(equities.delta).toBe(-50000);
    const bonds = rows.find((r) => r.class.id === "bonds");
    expect(bonds.delta).toBe(20000); // à investir
  });

  it("la somme des deltas est nulle : on rééquilibre, on n'ajoute rien", () => {
    const totals = { liquidity: 30000, bonds: 5000, equities: 60000, realestate: 5000, alternatives: 0 };
    const { rows } = computeDrift(totals, 100000, weights);
    expect(rows.reduce((s, r) => s + r.delta, 0)).toBeCloseTo(0, 6);
  });

  it("ne signale que les classes hors de la bande de tolérance", () => {
    const totals = {
      liquidity: 10000 + REBALANCE_BAND * 1000, // pile sur la bande → tolérée
      bonds: 20000,
      equities: 50000 - REBALANCE_BAND * 1000,
      realestate: 15000,
      alternatives: 5000,
    };
    const { actions, balanced } = computeDrift(totals, 100000, weights);
    expect(balanced).toBe(true);
    expect(actions).toHaveLength(0);
  });

  it("classe les actions de la plus urgente à la moins urgente", () => {
    const totals = { liquidity: 40000, bonds: 0, equities: 55000, realestate: 5000, alternatives: 0 };
    const { actions } = computeDrift(totals, 100000, weights);
    expect(actions.length).toBeGreaterThan(1);
    for (let i = 1; i < actions.length; i++) {
      expect(Math.abs(actions[i - 1].driftPts)).toBeGreaterThanOrEqual(Math.abs(actions[i].driftPts));
    }
  });

  it("ne divise pas par zéro sur un patrimoine vide", () => {
    const totals = { liquidity: 0, bonds: 0, equities: 0, realestate: 0, alternatives: 0 };
    const { rows } = computeDrift(totals, 0, weights);
    for (const r of rows) {
      expect(Number.isFinite(r.currentPct)).toBe(true);
      expect(Number.isFinite(r.delta)).toBe(true);
    }
  });
});
