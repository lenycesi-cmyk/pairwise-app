import { describe, it, expect } from "vitest";
import { parseNaturalTransaction } from "../../src/utils/parseNaturalTransaction.js";

// Deux membres nommés comme dans le couple réel, plus un cas de préfixe
// commun ("Ana"/"Anaïs") qui a sa propre exigence d'ordre.
const MEMBERS = [
  { memberId: "u-nico", uid: "u-nico", name: "Nicolas" },
  { memberId: "u-jess", uid: "u-jess", name: "Jessica" },
];

const CATEGORIES = [
  { id: "food", name: "Alimentation", subcategories: ["Restaurant", "Courses"] },
  { id: "transport", name: "Transport", subcategories: ["Taxi"] },
  { id: "income", name: "Revenus", subcategories: ["Salaire"] },
];

const parse = (text, opts = {}) =>
  parseNaturalTransaction(text, { categories: CATEGORIES, members: MEMBERS, ...opts });

describe("détection du payeur", () => {
  it("reconnaît « payé par <membre> »", () => {
    expect(parse("20€ resto payé par Nicolas").paidBy).toBe("u-nico");
  });

  it("accepte les variantes de verbe et l'anglais", () => {
    expect(parse("20 resto réglé par Jessica").paidBy).toBe("u-jess");
    expect(parse("20 lunch paid by Nicolas").paidBy).toBe("u-nico");
  });

  // « par » seul est trop courant en français pour valoir attribution : sans
  // verbe de paiement, « par avion » ou « par mois » désignerait un membre.
  it("n'attribue rien sur un « par » sans verbe de paiement", () => {
    expect(parse("20 colis envoyé par avion").paidBy).toBe(null);
  });

  it("ne prend pas le préfixe d'un nom plus long pour un autre membre", () => {
    const members = [
      { memberId: "u-a", name: "Ana" },
      { memberId: "u-b", name: "Anaïs" },
    ];
    expect(parse("30 resto payé par Anaïs", { members }).paidBy).toBe("u-b");
  });
});

describe("détection du bénéficiaire", () => {
  it("reconnaît « pour <membre> » et le traduit en partage à 100 %", () => {
    expect(parse("40 cadeau pour Jessica").split).toBe("u-jess");
  });

  it("reconnaît un partage explicite sans nommer personne", () => {
    expect(parse("40 courses pour nous deux").split).toBe("50/50");
    expect(parse("40 courses pour les deux").split).toBe("50/50");
  });

  // « nous deux » doit être consommé en entier : « nous » seul laisserait
  // « deux » traîner dans la description.
  it("préfère l'expression la plus longue", () => {
    expect(parse("40 courses pour nous deux").description).toBe("Courses");
  });

  it("combine payeur et bénéficiaire dans la même phrase", () => {
    const r = parse("60 resto payé par Nicolas pour Jessica");
    expect(r.paidBy).toBe("u-nico");
    expect(r.split).toBe("u-jess");
  });
});

describe("nettoyage de la description", () => {
  it("retire les tags reconnus à l'oral", () => {
    // C'est le défaut signalé : le mot du tag restait dans la description.
    const r = parse("30 shopping impulsif");
    expect(r.tags.some((t) => t.includes("impulsif"))).toBe(true);
    expect(r.description).not.toMatch(/impulsif/i);
  });

  it("retire les tags déjà utilisés dans l'historique", () => {
    const r = parse("30 resto vinted", { usedTags: ["vinted"] });
    expect(r.tags).toContain("vinted");
    expect(r.description).not.toMatch(/vinted/i);
  });

  it("retire l'expression d'attribution en entier, marqueur compris", () => {
    const d = parse("20 resto payé par Nicolas").description || "";
    expect(d).not.toMatch(/nicolas/i);
    expect(d).not.toMatch(/pay/i);
    expect(d).not.toMatch(/\bpar\b/i);
  });

  it("retire le nom de catégorie quand il reste autre chose", () => {
    const d = parse("25 courses alimentation bio").description || "";
    expect(d).not.toMatch(/alimentation/i);
    expect(d).toMatch(/bio/i);
  });

  // Le garde-fou central : sur « 15€ resto hier », le mot de catégorie EST
  // toute la description. Un champ vide serait pire que la redondance.
  it("garde le mot de catégorie s'il constitue toute la description", () => {
    expect(parse("15€ restaurant hier").description).toBe("Restaurant");
  });

  it("ne retire jamais un marchand ou un mot-clé courant", () => {
    expect(parse("12 McDo").description).toMatch(/mcdo/i);
    expect(parse("900 loyer").description).toMatch(/loyer/i);
  });
});

describe("compatibilité", () => {
  it("n'attribue rien quand aucun membre n'est fourni", () => {
    const r = parseNaturalTransaction("20 resto payé par Nicolas", { categories: CATEGORIES });
    expect(r.paidBy).toBe(null);
    expect(r.split).toBe(null);
  });

  it("laisse intacts le montant, la devise et le type", () => {
    const r = parse("reçu 2000 salaire payé par Jessica");
    expect(r.amount).toBe(2000);
    expect(r.type).toBe("income");
    expect(r.paidBy).toBe("u-jess");
  });
});
