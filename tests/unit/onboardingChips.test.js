import { describe, it, expect } from "vitest";
import { CHIPS, PLACEHOLDERS, KIND_COLOR } from "../../src/data/onboardingChips";
import { parseNaturalTransaction } from "../../src/utils/parseNaturalTransaction";
import { ALL_CATEGORIES } from "../../src/data/categories";

// Une pastille colorée est une PROMESSE : sa teinte annonce la nature de
// l'écriture avant le clic. Si « ETF 250 € » est lavande et que le clic produit
// une dépense, la démonstration se contredit dès le premier geste — l'inverse
// exact de ce que cet écran existe pour prouver.
//
// Ces tests ne vérifient donc pas le rendu (aucun composant n'est monté), mais
// l'ACCORD entre le `kind` déclaré dans la liste et ce que l'analyseur produit
// réellement à partir du seul texte. Ils cassent aussi bien quand on retouche un
// libellé que quand on touche à INCOME_WORDS / INVEST_WORDS.

const parse = (text) =>
  parseNaturalTransaction(text, {
    categories: ALL_CATEGORIES,
    transactions: [],
    defaultCurrency: "EUR",
  });

describe("suggestions de l'onboarding", () => {
  for (const lang of ["fr", "en"]) {
    describe(lang, () => {
      for (const chip of CHIPS[lang]) {
        it(`« ${chip.text} » est analysé en ${chip.kind}`, () => {
          const parsed = parse(chip.text);
          expect(parsed).not.toBeNull();
          expect(parsed.type).toBe(chip.kind);
        });

        it(`« ${chip.text} » porte un montant exploitable`, () => {
          expect(parse(chip.text).amount).toBeGreaterThan(0);
        });
      }

      it("chaque suggestion a un symbole et une couleur connue", () => {
        for (const chip of CHIPS[lang]) {
          expect(chip.em.length).toBeGreaterThan(0);
          expect(KIND_COLOR[chip.kind]).toBeTruthy();
        }
      });

      it("les exemples défilants viennent des suggestions", () => {
        for (const ph of PLACEHOLDERS[lang]) {
          expect(CHIPS[lang]).toContain(ph);
        }
      });

      it("la rotation montre les trois natures d'écriture", () => {
        const kinds = new Set(PLACEHOLDERS[lang].map((p) => p.kind));
        expect(kinds).toEqual(new Set(["income", "expense", "investment"]));
      });
    });
  }

  // Le vocabulaire ajouté pour les pastilles sert aussi l'app réelle. Ces deux
  // cas gardent la frontière la plus fine : un mot seul ne doit pas emporter le
  // sens de la phrase entière.
  it("« loyer » seul reste une dépense", () => {
    // Payer son loyer est le cas de très loin le plus courant : le classer en
    // revenu pour faire fonctionner une pastille casserait l'usage quotidien.
    expect(parse("loyer 800€").type).toBe("expense");
  });

  it("« assurance » seule reste une dépense", () => {
    // Seule « assurance vie » en toutes lettres est un placement ; l'assurance
    // auto ou habitation est une charge.
    expect(parse("120€ assurance auto").type).toBe("expense");
  });
});
