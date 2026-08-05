// Catalogue de devises + refus de convertir sans taux réel.
//
// Deux sujets liés. Le catalogue est passé de 31 à 161 devises : la conversion
// étant générique (l'API accepte n'importe quel code ISO), le restreindre
// n'apportait rien sinon empêcher l'utilisateur de choisir sa devise. Mais la
// table de repli hors-ligne, elle, ne couvre qu'une poignée de devises — et
// l'ancien code y remplaçait tout code absent par 1, produisant silencieusement
// « 1 MXN = 1 EUR ». Comme la conversion est FIGÉE à l'écriture, ce chiffre
// faux ne se corrigeait jamais. D'où la règle testée ici : sans taux réel, on
// ne convertit pas.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ALL_CURRENCIES, CURRENCIES, findCurrency, currencySymbolOf } from "../../src/data/currencies.js";
import { FALLBACK_RATES_EUR_BASE, getExchangeRate } from "../../src/utils/currencyConversion.js";

describe("catalogue de devises", () => {
  it("les devises par défaut sont toutes dans le catalogue complet", () => {
    for (const c of CURRENCIES) {
      expect(findCurrency(c.code), c.code).not.toBeNull();
    }
  });

  it("aucun code en double", () => {
    const codes = ALL_CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("chaque entrée a un code ISO à 3 lettres, un symbole et un nom", () => {
    for (const c of ALL_CURRENCIES) {
      expect(c.code, JSON.stringify(c)).toMatch(/^[A-Z]{3}$/);
      expect(c.symbol, c.code).toBeTruthy();
      expect(c.name, c.code).toBeTruthy();
    }
  });

  it("couvre largement au-delà des seules devises de repli", () => {
    // Le but de l'élargissement : ne plus être limité par la table de repli.
    expect(ALL_CURRENCIES.length).toBeGreaterThan(Object.keys(FALLBACK_RATES_EUR_BASE).length * 10);
  });

  it("contient les devises courantes qui manquaient", () => {
    for (const code of ["MAD", "COP", "PEN", "EGP", "ILS", "SAR", "RON", "HUF", "UAH", "KES", "NGN", "XOF"]) {
      expect(findCurrency(code), code).not.toBeNull();
    }
  });

  it("les devises par défaut restent en tête du catalogue", () => {
    // Elles doivent apparaître en premier dans le sélecteur.
    expect(ALL_CURRENCIES.slice(0, CURRENCIES.length).map((c) => c.code)).toEqual(
      CURRENCIES.map((c) => c.code)
    );
  });

  it("currencySymbolOf retombe sur le code pour une devise inconnue", () => {
    // Une donnée héritée ne doit jamais s'afficher sans unité.
    expect(currencySymbolOf("EUR")).toBe("€");
    expect(currencySymbolOf("ZZZ")).toBe("ZZZ");
  });
});

describe("getExchangeRate — refus de convertir plutôt que taux inventé", () => {
  beforeEach(() => {
    // Ni cache, ni réseau : on force le chemin « repli ».
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {},
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("hors ligne"))));
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renvoie 1 sans appel réseau quand les deux devises sont identiques", async () => {
    const { rate, isFallback } = await getExchangeRate("EUR", "EUR");
    expect(rate).toBe(1);
    expect(isFallback).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("utilise la table de repli quand les DEUX devises y figurent", async () => {
    const { rate, isFallback } = await getExchangeRate("EUR", "USD");
    expect(isFallback).toBe(true);
    expect(rate).toBeCloseTo(FALLBACK_RATES_EUR_BASE.USD, 10);
  });

  it("renvoie null — et surtout PAS 1 — si la devise source est hors table", async () => {
    const { rate, isFallback } = await getExchangeRate("MXN", "EUR");
    expect(rate).toBeNull();
    expect(isFallback).toBe(true);
  });

  it("renvoie null si la devise cible est hors table", async () => {
    const { rate } = await getExchangeRate("EUR", "MXN");
    expect(rate).toBeNull();
  });

  it("renvoie null si aucune des deux devises n'est dans la table", async () => {
    const { rate } = await getExchangeRate("MXN", "COP");
    expect(rate).toBeNull();
  });

  it("un taux de repli, quand il existe, reste cohérent dans les deux sens", async () => {
    const { rate: eurToUsd } = await getExchangeRate("EUR", "USD");
    const { rate: usdToEur } = await getExchangeRate("USD", "EUR");
    expect(eurToUsd * usdToEur).toBeCloseTo(1, 10);
  });
});
