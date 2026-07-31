// L'app a DEUX implémentations de change, par conception :
//   - utils/currencyConversion.js  → taux figé à l'écriture d'une transaction
//   - hooks/useExchangeRates.js    → conversion à l'affichage
// Chacune embarque sa propre table de repli, utilisée quand l'API et le cache
// échouent tous les deux. Si elles divergent, une même somme s'affiche
// différemment selon l'écran, sans le moindre message d'erreur — le pire mode
// de défaillance pour une app de finances.
//
// CLAUDE.md demande de les garder en phase « à la main ». Ce test remplace la
// discipline par une vérification.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCES = {
  "utils/currencyConversion.js": "src/utils/currencyConversion.js",
  "hooks/useExchangeRates.js": "src/hooks/useExchangeRates.js",
};

// Extrait le littéral `const FALLBACK_RATES_EUR_BASE = { ... };` et le lit en
// paires clé/valeur. Volontairement textuel : importer le module exécuterait du
// code React et des accès navigateur dont on n'a pas besoin ici.
function readFallbackTable(path) {
  const src = readFileSync(path, "utf8");
  const match = src.match(/const FALLBACK_RATES_EUR_BASE = \{([^}]*)\}/);
  if (!match) throw new Error(`Table de repli introuvable dans ${path}`);
  const table = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^\s*([A-Z]{3})\s*:\s*([\d.]+)\s*,?\s*$/);
    if (pair) table[pair[1]] = Number(pair[2]);
  }
  return table;
}

describe("tables de change de repli", () => {
  const tables = Object.fromEntries(
    Object.entries(SOURCES).map(([label, path]) => [label, readFallbackTable(path)])
  );

  it("chaque fichier expose bien une table non vide", () => {
    for (const [label, table] of Object.entries(tables)) {
      expect(Object.keys(table).length, label).toBeGreaterThan(0);
    }
  });

  it("les deux tables sont rigoureusement identiques", () => {
    const [a, b] = Object.values(tables);
    expect(a).toEqual(b);
  });

  it("l'euro est la base, donc vaut exactement 1", () => {
    for (const [label, table] of Object.entries(tables)) {
      expect(table.EUR, label).toBe(1);
    }
  });

  it("aucun taux nul ou négatif — une division par zéro produirait un Infinity affiché", () => {
    for (const [label, table] of Object.entries(tables)) {
      for (const [code, rate] of Object.entries(table)) {
        expect(rate, `${label} → ${code}`).toBeGreaterThan(0);
      }
    }
  });
});
