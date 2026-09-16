// La règle des hooks ne s'applique pas ici : on appelle DÉLIBÉRÉMENT
// `useDebtCalculation` hors de React, avec `useMemo` neutralisé (voir plus bas).
// C'est ce qui permet de tester le calcul monétaire sans moteur de rendu.
/* eslint-disable react-hooks/rules-of-hooks */
import { describe, it, expect } from "vitest";
import { useDebtCalculation } from "../../src/hooks/useDebtCalculation.js";

// `useDebtCalculation` n'utilise que `useMemo`, dont le contrat est de renvoyer
// la valeur calculée. On peut donc l'exercer hors de React en neutralisant ce
// hook — ce qui permet de tester le CALCUL, qui est la partie monétaire, sans
// monter de moteur de rendu (le dépôt n'en a pas).
import { vi } from "vitest";
vi.mock("react", () => ({ useMemo: (fn) => fn() }));

const MEMBERS = [
  { memberId: "u-nico", uid: "u-nico", name: "Nicolas" },
  { memberId: "u-jess", uid: "u-jess", name: "Jessica" },
];
// Pas de conversion : les montants sont déjà dans la devise demandée.
const convert = (v) => v;

// Nicolas (a) paie 100 pour les deux en juin → Jessica (b) lui doit 50.
// Jessica (b) paie 40 pour les deux en juillet → Nicolas (a) lui doit 20.
// Solde total : Jessica doit 30 à Nicolas.
const TX = [
  {
    id: "t-juin", type: "expense", date: "2026-06-10T12:00:00.000Z",
    amount: 100, currency: "EUR", paidBy: "u-nico", split: "50/50", description: "Juin",
  },
  {
    id: "t-juillet", type: "expense", date: "2026-07-10T12:00:00.000Z",
    amount: 40, currency: "EUR", paidBy: "u-jess", split: "50/50", description: "Juillet",
  },
];

const JUNE = { startDate: "2026-06-01T00:00:00.000Z", endDate: "2026-06-30T23:59:59.000Z" };
const JULY = { startDate: "2026-07-01T00:00:00.000Z", endDate: "2026-07-31T23:59:59.000Z" };

const calc = (opts = {}) => useDebtCalculation(TX, MEMBERS, "EUR", convert, opts);

// Un règlement tel que l'écrit `addDebtSettlementEntry` : un virement porté par
// `debtTransfers`, avec le drapeau `settlement`.
const settlement = (date, amount, fromKey, toKey) => ({
  id: `settle_${date}`, date, amount, currency: "EUR", fromKey, toKey,
  settlement: true, periodLabel: "test",
});

describe("état de départ", () => {
  it("chiffre la dette de chaque période et le total", () => {
    expect(calc(JUNE).owesAmount).toBe(50);
    expect(calc(JUNE).owesFromName).toBe("Jessica");
    expect(calc(JULY).owesAmount).toBe(20);
    expect(calc(JULY).owesFromName).toBe("Nicolas");
    expect(calc().owesAmount).toBe(30);
    expect(calc().owesFromName).toBe("Jessica");
  });
});

describe("règlement d'une période", () => {
  // Le cœur de la demande : régler juin ne doit pas toucher juillet.
  const transfers = [settlement("2026-06-30T23:00:00.000Z", 50, "u-jess", "u-nico")];

  it("ramène à zéro la période réglée", () => {
    expect(calc({ ...JUNE, transfers }).owesAmount).toBe(0);
  });

  it("laisse les autres périodes intactes", () => {
    expect(calc({ ...JULY, transfers }).owesAmount).toBe(20);
    expect(calc({ ...JULY, transfers }).owesFromName).toBe("Nicolas");
  });

  it("réduit le total du montant réglé, sans l'annuler", () => {
    // 30 dus par Jessica, moins 50 qu'elle a réglés → Nicolas lui doit 20.
    const total = calc({ transfers });
    expect(total.owesAmount).toBe(20);
    expect(total.owesFromName).toBe("Nicolas");
  });

  it("apparaît dans l'activité avec son propre type", () => {
    const row = calc({ ...JUNE, transfers }).activity.find((x) => x.kind === "settlement");
    expect(row).toBeDefined();
    expect(row.periodLabel).toBe("test");
  });
});

describe("fenêtre temporelle du règlement", () => {
  // C'est la décision de conception à ne pas défaire : une écriture datée hors
  // de la période affichée n'y est pas comptée, et le mois « réglé » afficherait
  // encore son solde. D'où la date en fin de période côté écran.
  it("ne compte pas un règlement daté hors de la période", () => {
    const transfers = [settlement("2026-08-19T12:00:00.000Z", 50, "u-jess", "u-nico")];
    expect(calc({ ...JUNE, transfers }).owesAmount).toBe(50);
  });

  it("compte ce même règlement dans le total, qui n'a pas de fenêtre", () => {
    const transfers = [settlement("2026-08-19T12:00:00.000Z", 50, "u-jess", "u-nico")];
    expect(calc({ transfers }).owesAmount).toBe(20);
  });
});

describe("cohabitation avec les anciens règlements-butoir", () => {
  // Un règlement historique ne porte pas de montant : il déplace la ligne de
  // départ. Les deux mécanismes doivent coexister sans se compter deux fois.
  const settlements = [{ id: "s1", date: "2026-07-01T00:00:00.000Z" }];

  it("la butoir écarte toujours ce qui la précède, sur le total", () => {
    // Juin est écarté, seul juillet compte : Nicolas doit 20 à Jessica.
    const r = calc({ settlements });
    expect(r.owesAmount).toBe(20);
    expect(r.owesFromName).toBe("Nicolas");
  });

  it("une écriture postérieure à la butoir s'y ajoute sans double comptage", () => {
    const transfers = [settlement("2026-07-31T23:00:00.000Z", 20, "u-nico", "u-jess")];
    expect(calc({ settlements, transfers }).owesAmount).toBe(0);
  });

  it("la butoir reste ignorée dès qu'une période explicite est demandée", () => {
    // C'est précisément ce qui rendait l'ancien bouton inopérant hors du Total.
    expect(calc({ ...JUNE, settlements }).owesAmount).toBe(50);
  });
});

describe("remboursement d'une dépense partagée", () => {
  // Le cas concret : Jessica avance la facture de 300, partagée, puis encaisse
  // le remboursement de l'assurance en revenu commun.
  //
  // La règle qui gouverne tout ce bloc : le remboursement se compte comme
  // l'argent qu'il est, du côté de qui l'encaisse. Il n'annule PAS la dépense
  // qu'il rembourse — il ne la connaît même pas. Quand la même personne avance
  // et encaisse, les deux se compensent exactement ; quand ce n'est pas la même,
  // la dette double au lieu de s'annuler, et c'est juste : l'un a sorti
  // l'argent, l'autre l'a reçu.
  const BILL = {
    id: "t-facture", type: "expense", date: "2026-06-05T12:00:00.000Z",
    amount: 300, currency: "EUR", paidBy: "u-jess", split: "50/50", description: "Facture",
  };
  const refund = (extra = {}) => ({
    id: "t-remb", type: "income", date: "2026-06-20T12:00:00.000Z",
    amount: 300, currency: "EUR", paidBy: "u-jess", split: "50/50",
    description: "Remboursement", refundsShared: true, ...extra,
  });
  const run = (txs, opts = {}) => useDebtCalculation(txs, MEMBERS, "EUR", convert, opts);

  it("un revenu NON coché ne touche à rien", () => {
    // La garantie qui protège l'historique : tous les revenus déjà enregistrés
    // en commun — salaires compris — restent hors du calcul.
    const r = run([BILL, refund({ refundsShared: false })]);
    expect(r.owesAmount).toBe(150);
    expect(r.owesFromName).toBe("Nicolas");
  });

  it("coché, il défait exactement la part qu'il rembourse", () => {
    const r = run([BILL, refund()]);
    expect(r.owesAmount).toBe(0);
  });

  it("dépasser la dépense inverse le sens, sans cas particulier", () => {
    // Nicolas devait 150 ; Jessica encaisse 400 en commun, donc lui en rend
    // 200. Le solde bascule : c'est elle qui doit 50.
    const r = run([BILL, refund({ amount: 400 })]);
    expect(r.owesAmount).toBe(50);
    expect(r.owesFromName).toBe("Jessica");
  });

  it("un remboursement entièrement « pour » l'autre lui revient en entier", () => {
    const r = run([refund({ split: "u-nico" })]);
    expect(r.owesAmount).toBe(300);
    expect(r.owesFromName).toBe("Jessica");
  });

  it("suit le partage avancé comme une dépense", () => {
    const r = run([refund({ splitDetails: { unit: "percent", a: 70, b: 30 } })]);
    // Reçu par Jessica (b), 70 % revient à Nicolas (a).
    expect(r.owesAmount).toBe(210);
    expect(r.owesFromName).toBe("Jessica");
  });

  it("payé et encaissé par deux personnes différentes, il CREUSE la dette", () => {
    // Nicolas sort 300 de sa poche, Jessica encaisse les 300 : la dépense n'a
    // rien coûté au couple, donc Jessica lui rend tout. Le remboursement ne
    // s'annule avec la facture que si la même personne fait les deux.
    const paidByNico = { ...BILL, paidBy: "u-nico" };
    const r = run([paidByNico, refund()]);
    expect(r.owesAmount).toBe(300);
    expect(r.owesFromName).toBe("Jessica");
  });

  it("porte son propre type dans l'activité, avec un montant positif", () => {
    const row = run([BILL, refund()]).activity.find((x) => x.kind === "refund");
    expect(row.share).toBe(150);
    expect(row.paidByName).toBe("Jessica");
    expect(row.forName).toBe("Nicolas");
  });

  it("antérieur au dernier règlement, il ne compte plus", () => {
    // Même fenêtre que les dépenses : un règlement efface ce qui le précède.
    const settlements = [{ id: "s1", date: "2026-07-01T00:00:00.000Z" }];
    expect(run([BILL, refund()], { settlements }).owesAmount).toBe(0);
    expect(run([BILL], { settlements }).owesAmount).toBe(0);
  });
});
