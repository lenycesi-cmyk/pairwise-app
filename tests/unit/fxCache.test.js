// Le cache de taux est sur le chemin de l'ARGENT : la conversion est figée à
// l'écriture d'une transaction, donc un taux servi ici s'inscrit pour toujours.
// Les assertions portent sur des INVARIANTS (un aller-retour vaut 1, une table
// rebasée donne les mêmes taux croisés) plutôt que sur des nombres calculés à
// la main, qui n'encoderaient que l'arithmétique de l'auteur.
import { beforeEach, describe, expect, it } from "vitest";
import {
  crossRate,
  rebaseTable,
  findCachedRate,
  findCachedTable,
  writeTable,
  FX_TABLE_KEY_PREFIX,
} from "../../src/utils/fxCache";

// Table de base EUR, façon open.er-api.com : « combien de X pour 1 EUR ».
const EUR_TABLE = {
  base: "EUR",
  timestamp: 1_000,
  rates: { EUR: 1, USD: 1.08, GBP: 0.84, JPY: 163, THB: 38.5, MXN: 19.7 },
};

describe("crossRate", () => {
  it("une devise vers elle-même vaut exactement 1", () => {
    expect(crossRate(EUR_TABLE, "MXN", "MXN")).toBe(1);
  });

  it("convertir puis reconvertir ramène au point de départ", () => {
    const aller = crossRate(EUR_TABLE, "MXN", "THB");
    const retour = crossRate(EUR_TABLE, "THB", "MXN");
    expect(aller * retour).toBeCloseTo(1, 12);
  });

  it("le taux est transitif : A→B→C équivaut à A→C", () => {
    const ab = crossRate(EUR_TABLE, "USD", "GBP");
    const bc = crossRate(EUR_TABLE, "GBP", "JPY");
    const ac = crossRate(EUR_TABLE, "USD", "JPY");
    expect(ab * bc).toBeCloseTo(ac, 10);
  });

  it("la devise de base est utilisable même absente de ses propres taux", () => {
    const sansEur = { base: "EUR", timestamp: 0, rates: { USD: 1.08 } };
    expect(crossRate(sansEur, "EUR", "USD")).toBeCloseTo(1.08, 12);
    expect(crossRate(sansEur, "USD", "EUR")).toBeCloseTo(1 / 1.08, 12);
  });

  it("renvoie null pour une devise inconnue — jamais 1, jamais un taux inventé", () => {
    expect(crossRate(EUR_TABLE, "VND", "EUR")).toBeNull();
    expect(crossRate(EUR_TABLE, "EUR", "VND")).toBeNull();
  });
});

describe("rebaseTable", () => {
  it("rebaser vers sa propre base ne change rien", () => {
    expect(rebaseTable(EUR_TABLE, "EUR")).toBe(EUR_TABLE);
  });

  it("la nouvelle base vaut 1 chez elle", () => {
    const usd = rebaseTable(EUR_TABLE, "USD");
    expect(usd.base).toBe("USD");
    expect(usd.rates.USD).toBeCloseTo(1, 12);
  });

  it("rebaser ne change AUCUN taux croisé — c'est le même contenu, exprimé autrement", () => {
    const usd = rebaseTable(EUR_TABLE, "USD");
    for (const [from, to] of [["MXN", "THB"], ["GBP", "JPY"], ["EUR", "THB"]]) {
      expect(crossRate(usd, from, to)).toBeCloseTo(crossRate(EUR_TABLE, from, to), 10);
    }
  });

  it("l'ancienne base reste convertible après rebasage", () => {
    const usd = rebaseTable(EUR_TABLE, "USD");
    expect(crossRate(usd, "USD", "EUR")).toBeCloseTo(1 / EUR_TABLE.rates.USD, 12);
  });

  it("renvoie null si la nouvelle base est absente de la table", () => {
    expect(rebaseTable(EUR_TABLE, "VND")).toBeNull();
  });
});

// ── Accès au stockage ──────────────────────────────────────────────────────

function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    get length() {
      return store.size;
    },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

// Écrit une table avec un horodatage choisi (writeTable pose Date.now()).
function seedTable(base, rates, ageMs) {
  localStorage.setItem(
    `${FX_TABLE_KEY_PREFIX}${base}`,
    JSON.stringify({ base, rates, timestamp: Date.now() - ageMs })
  );
}

const HEURE = 1000 * 60 * 60;

describe("findCachedRate", () => {
  beforeEach(() => installLocalStorage());

  it("trouve un taux croisé dans une table d'une AUTRE base", () => {
    seedTable("EUR", EUR_TABLE.rates, 0);
    // Le peso vers le baht n'a jamais été demandé tel quel : il se déduit.
    const found = findCachedRate("MXN", "THB", 6 * HEURE);
    expect(found.rate).toBeCloseTo(crossRate(EUR_TABLE, "MXN", "THB"), 10);
  });

  it("ignore une table plus vieille que la limite demandée", () => {
    seedTable("EUR", EUR_TABLE.rates, 8 * HEURE);
    expect(findCachedRate("MXN", "THB", 6 * HEURE)).toBeNull();
  });

  it("accepte n'importe quel âge quand aucune limite n'est donnée — c'est le dernier recours", () => {
    seedTable("EUR", EUR_TABLE.rates, 30 * 24 * HEURE);
    expect(findCachedRate("MXN", "THB")).not.toBeNull();
  });

  it("préfère la table la plus fraîche quand plusieurs conviennent", () => {
    seedTable("EUR", { ...EUR_TABLE.rates, USD: 1.0 }, 5 * HEURE);
    seedTable("GBP", { EUR: 1 / 0.84, USD: 2.0 }, 1 * HEURE);
    expect(findCachedRate("GBP", "USD", 6 * HEURE).rate).toBeCloseTo(2.0, 10);
  });

  it("renvoie null pour une paire qu'aucune table ne couvre", () => {
    seedTable("EUR", EUR_TABLE.rates, 0);
    expect(findCachedRate("VND", "EUR", 6 * HEURE)).toBeNull();
  });

  it("survit à une entrée corrompue sans faire tomber la lecture", () => {
    localStorage.setItem(`${FX_TABLE_KEY_PREFIX}KO`, "{ pas du json");
    seedTable("EUR", EUR_TABLE.rates, 0);
    expect(findCachedRate("EUR", "USD", 6 * HEURE).rate).toBeCloseTo(1.08, 12);
  });
});

describe("findCachedTable", () => {
  beforeEach(() => installLocalStorage());

  it("sert une base jamais téléchargée en rebasant une table existante", () => {
    seedTable("EUR", EUR_TABLE.rates, 0);
    const usd = findCachedTable("USD", 6 * HEURE);
    expect(usd.base).toBe("USD");
    expect(usd.rates.USD).toBeCloseTo(1, 12);
  });

  it("écrire puis relire redonne les mêmes taux", () => {
    writeTable("EUR", EUR_TABLE.rates);
    const back = findCachedTable("EUR", HEURE);
    expect(back.rates).toEqual(EUR_TABLE.rates);
  });

  it("renvoie null quand rien n'est en cache", () => {
    expect(findCachedTable("EUR", 6 * HEURE)).toBeNull();
  });
});
