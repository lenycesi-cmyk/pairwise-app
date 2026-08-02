import { describe, it, expect } from "vitest";
import { deriveInsight, draftEntryView, kindColorOf } from "../../src/utils/onboardingDraft";
import { parseNaturalTransaction } from "../../src/utils/parseNaturalTransaction";
import { onboardingT } from "../../src/data/onboardingCopy";
import { ALL_CATEGORIES } from "../../src/data/categories";

// L'insight de l'onboarding est la première chose que l'app affirme à un
// visiteur, avant tout compte : un chiffre faux ici coûte plus cher qu'ailleurs.
//
// Le modèle retenu, et ce que ces tests verrouillent :
//  · Solde = revenus − dépenses − placements. Un placement quitte le compte
//    courant, même s'il ne quitte pas le patrimoine.
//  · La répartition ventile TOUT ce qui est sorti, placements compris.
//  · « surtout en {cat} » ne parle que des dépenses : le poste le plus lourd de
//    la répartition peut être un placement, mais « 60 € dépensés, surtout en
//    Investissements » ne voudrait rien dire.

const t = onboardingT("fr");
const tEn = onboardingT("en");

let seq = 0;
const entry = (type, amount, categoryId, extra = {}) => ({
  id: `e${seq++}`,
  type,
  amount,
  currency: "EUR",
  categoryId,
  subcategory: null,
  description: null,
  date: new Date().toISOString(),
  ...extra,
});

describe("deriveInsight — les placements", () => {
  it("le solde soustrait les placements comme les dépenses", () => {
    const r = deriveInsight(
      [entry("income", 2400, "income"), entry("investment", 550, "investment"), entry("expense", 60, "food")],
      "fr",
      t
    );
    expect(r.income).toBe(2400);
    expect(r.invested).toBe(550);
    expect(r.expense).toBe(60);
    expect(r.balance).toBe(2400 - 60 - 550);
  });

  it("les placements ne sont pas comptés comme des dépenses", () => {
    const r = deriveInsight([entry("investment", 250, "investment")], "fr", t);
    expect(r.expense).toBe(0);
    expect(r.invested).toBe(250);
  });

  it("la répartition inclut les placements", () => {
    const r = deriveInsight(
      [entry("investment", 550, "investment"), entry("expense", 60, "food")],
      "fr",
      t
    );
    expect(r.breakdown.map((c) => c.categoryId)).toEqual(["investment", "food"]);
  });

  it("les pourcentages se rapportent à tout ce qui est sorti", () => {
    const r = deriveInsight(
      [entry("investment", 750, "investment"), entry("expense", 250, "food")],
      "fr",
      t
    );
    expect(r.breakdown.find((c) => c.categoryId === "investment").pct).toBe(75);
    expect(r.breakdown.find((c) => c.categoryId === "food").pct).toBe(25);
    // Sans placements au dénominateur, la première barre aurait dépassé 100 %.
    expect(r.breakdown.reduce((s, c) => s + c.pct, 0)).toBe(100);
  });

  it("« surtout en » ne nomme jamais un placement", () => {
    // Le placement est de loin le premier poste de la répartition, mais la
    // clause qu'il précède parle de dépenses.
    const r = deriveInsight(
      [entry("income", 3000, "income"), entry("investment", 900, "investment"), entry("expense", 60, "food")],
      "fr",
      t
    );
    expect(r.insight).toContain("900 € investis");
    expect(r.insight).toContain("surtout en Alimentation");
    expect(r.insight).not.toContain("surtout en Investissements");
  });

  it("la phrase enchaîne solde, placements puis dépenses", () => {
    const r = deriveInsight(
      [entry("income", 2400, "income"), entry("investment", 550, "investment"), entry("expense", 60, "food")],
      "fr",
      t
    );
    expect(r.insight).toBe("Solde +1 790 € cette semaine — 550 € investis — 60 € dépensés, surtout en Alimentation.");
  });

  it("même enchaînement en anglais", () => {
    const r = deriveInsight(
      [entry("income", 2400, "income"), entry("investment", 550, "investment"), entry("expense", 60, "food")],
      "en",
      tEn
    );
    expect(r.insight).toBe("Balance +1,790 € this week — 550 € invested — 60 € spent, mostly on Food & Groceries.");
  });

  it("sans placement, la phrase ne mentionne rien de plus qu'avant", () => {
    const r = deriveInsight([entry("income", 2400, "income"), entry("expense", 610, "misc")], "fr", t);
    expect(r.insight).toBe("Solde +1 790 € cette semaine — 610 € dépensés, surtout en Divers / Shopping.");
    expect(r.insight).not.toContain("investis");
  });

  it("des placements seuls donnent leur propre phrase", () => {
    const r = deriveInsight([entry("investment", 250, "investment")], "fr", t);
    expect(r.insight).toBe("Tu as investi 250 € cette semaine.");
  });

  it("placements et dépenses sans revenu : pas de solde inventé", () => {
    const r = deriveInsight(
      [entry("investment", 250, "investment"), entry("expense", 60, "food")],
      "fr",
      t
    );
    expect(r.insight).not.toContain("Solde");
    expect(r.insight).toContain("investi 250 €");
    expect(r.insight).toContain("60 € dépensés");
  });
});

describe("deriveInsight — les tuiles", () => {
  it("une tuile par nature présente, dans l'ordre entrée / placé / sorti", () => {
    const r = deriveInsight(
      [entry("income", 2400, "income"), entry("investment", 550, "investment"), entry("expense", 60, "food")],
      "fr",
      t
    );
    expect(r.tiles.map((x) => x.key)).toEqual(["income", "invested", "expense"]);
    expect(r.tiles.map((x) => x.color)).toEqual(["var(--sage)", "var(--lavi)", "var(--tang)"]);
  });

  it("aucune tuile pour une nature absente", () => {
    const r = deriveInsight([entry("income", 2400, "income"), entry("expense", 60, "food")], "fr", t);
    expect(r.tiles.map((x) => x.key)).toEqual(["income", "expense"]);
  });

  it("une seule nature ne produit pas de rangée", () => {
    // Une tuile isolée ne ferait que répéter la phrase juste au-dessus.
    const r = deriveInsight([entry("expense", 60, "food")], "fr", t);
    expect(r.tiles.length).toBe(1);
  });
});

describe("couleur par nature", () => {
  it("sage ce qui entre, lavande ce qui est placé, corail ce qui sort", () => {
    expect(kindColorOf("income")).toBe("--sage");
    expect(kindColorOf("investment")).toBe("--lavi");
    expect(kindColorOf("expense")).toBe("--tang");
  });

  it("le montant d'un placement s'affiche en lavande", () => {
    const v = draftEntryView(entry("investment", 250, "investment"), "fr", () => "");
    expect(v.amountColor).toBe("var(--lavi)");
    expect(v.color).toBe("--lavi");
  });

  it("un revenu garde son signe et sa teinte", () => {
    const v = draftEntryView(entry("income", 2400, "income"), "fr", () => "");
    expect(v.amountColor).toBe("var(--sage)");
    expect(v.amountDisp.startsWith("+")).toBe(true);
  });
});

describe("catégorie par défaut de l'analyseur", () => {
  const parse = (text) =>
    parseNaturalTransaction(text, { categories: ALL_CATEGORIES, transactions: [], defaultCurrency: "EUR" });

  it("un placement non reconnu tombe dans Investissements, pas dans Divers", () => {
    // La cause exacte du bug : « ETF » ne figure dans aucune sous-catégorie, la
    // catégorie ressortait nulle et l'onboarding rangeait la ligne dans « misc ».
    expect(parse("ETF 250 €").categoryId).toBe("investment");
    expect(parse("300 € Assurance Vie").categoryId).toBe("investment");
  });

  it("un revenu non reconnu tombe dans Revenus", () => {
    expect(parse("2400 reçu").categoryId).toBe("income");
  });

  it("une dépense non reconnue reste sans catégorie", () => {
    // Le repli des dépenses appartient à l'appelant, qui a ses propres règles.
    expect(parse("42 xyzzy").categoryId).toBeNull();
  });

  it("aucun repli vers une catégorie que le couple a supprimée", () => {
    const withoutInvestment = ALL_CATEGORIES.filter((c) => c.id !== "investment");
    const parsed = parseNaturalTransaction("ETF 250 €", {
      categories: withoutInvestment,
      transactions: [],
      defaultCurrency: "EUR",
    });
    expect(parsed.categoryId).toBeNull();
  });
});
