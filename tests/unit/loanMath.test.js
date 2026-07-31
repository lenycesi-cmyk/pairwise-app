// Amortissement de prêt : les calculs les plus lourds de conséquence de l'app.
//
// Parti pris : peu de valeurs magiques, beaucoup d'invariants. Une valeur
// attendue calculée à la main encode surtout MON arithmétique — si je me
// trompe, le test valide l'erreur. Les invariants (le capital remboursé plus le
// restant dû égale l'emprunt, le coût total égale capital plus intérêts) sont
// vrais indépendamment de l'implémentation, donc ils cassent quand elle dévie.
import { describe, expect, it } from "vitest";
import {
  monthlyPayment,
  paymentsMade,
  addMonths,
  loanState,
  extraPaymentImpact,
  aggregateLoans,
} from "../../src/utils/loanMath.js";

describe("monthlyPayment", () => {
  // Référence de manuel : 100 000 à 6 % sur 30 ans → 599,55/mois.
  it("retrouve la valeur de référence", () => {
    expect(monthlyPayment(100000, 6, 360)).toBeCloseTo(599.55, 1);
  });

  it("à taux nul, divise simplement le capital par la durée", () => {
    expect(monthlyPayment(12000, 0, 12)).toBe(1000);
  });

  it("croît avec le taux et décroît avec la durée", () => {
    expect(monthlyPayment(100000, 6, 360)).toBeGreaterThan(monthlyPayment(100000, 3, 360));
    expect(monthlyPayment(100000, 3, 120)).toBeGreaterThan(monthlyPayment(100000, 3, 360));
  });

  it("renvoie 0 sur des entrées vides plutôt que NaN", () => {
    expect(monthlyPayment(0, 3, 240)).toBe(0);
    expect(monthlyPayment(100000, 3, 0)).toBe(0);
    expect(monthlyPayment(undefined, undefined, undefined)).toBe(0);
  });
});

describe("paymentsMade", () => {
  const start = "2020-01-15";

  it("compte les mois entiers écoulés", () => {
    expect(paymentsMade(start, 240, new Date("2021-01-15"))).toBe(12);
  });

  it("ne compte pas l'échéance du mois en cours si le jour n'est pas atteint", () => {
    expect(paymentsMade(start, 240, new Date("2021-01-14"))).toBe(11);
  });

  it("plafonne à la durée du prêt", () => {
    expect(paymentsMade(start, 12, new Date("2030-01-15"))).toBe(12);
  });

  it("ne descend jamais sous zéro pour un prêt futur", () => {
    expect(paymentsMade(start, 240, new Date("2019-01-01"))).toBe(0);
  });

  it("renvoie 0 sans date de début ou sur une date invalide", () => {
    expect(paymentsMade(null, 240)).toBe(0);
    expect(paymentsMade("pas-une-date", 240)).toBe(0);
  });
});

describe("addMonths", () => {
  it("passe l'année", () => {
    expect(addMonths(new Date("2024-11-10"), 3).toISOString().slice(0, 7)).toBe("2025-02");
  });
});

describe("loanState", () => {
  const loan = {
    principal: 200000,
    rateAnnual: 3,
    termMonths: 240,
    startDate: "2020-01-10",
    currency: "EUR",
  };
  const now = new Date("2025-01-10"); // 60 échéances

  it("le capital remboursé et le restant dû reconstituent l'emprunt", () => {
    const s = loanState(loan, now);
    expect(s.principalRepaid + s.balance).toBeCloseTo(loan.principal, 2);
  });

  it("le coût total est le capital plus les intérêts", () => {
    const s = loanState(loan, now);
    expect(s.totalCost).toBeCloseTo(loan.principal + s.totalInterest, 2);
    expect(s.totalInterest).toBeCloseTo(s.interestPaid + s.interestRemaining, 2);
  });

  it("l'avancement suit le capital remboursé et reste borné", () => {
    const s = loanState(loan, now);
    expect(s.progress).toBeCloseTo(s.principalRepaid / loan.principal, 6);
    expect(s.progress).toBeGreaterThan(0);
    expect(s.progress).toBeLessThan(1);
  });

  it("le restant dû décroît avec le temps", () => {
    const a = loanState(loan, new Date("2022-01-10"));
    const b = loanState(loan, new Date("2028-01-10"));
    expect(b.balance).toBeLessThan(a.balance);
  });

  it("est soldé au terme", () => {
    const s = loanState(loan, new Date("2040-01-10"));
    expect(s.isPaidOff).toBe(true);
    expect(s.balance).toBeCloseTo(0, 2);
    expect(s.paymentsLeft).toBe(0);
  });

  it("n'a encore rien remboursé le jour du départ", () => {
    const s = loanState(loan, new Date("2020-01-10"));
    expect(s.paymentsMade).toBe(0);
    expect(s.balance).toBeCloseTo(loan.principal, 2);
    expect(s.progress).toBe(0);
  });

  it("un prêt à taux nul ne génère aucun intérêt", () => {
    const s = loanState({ ...loan, rateAnnual: 0 }, now);
    expect(s.totalInterest).toBeCloseTo(0, 6);
    expect(s.totalCost).toBeCloseTo(loan.principal, 2);
  });

  it("une mensualité imposée prime sur celle déduite du taux", () => {
    const s = loanState({ ...loan, monthlyPayment: 1500 }, now);
    expect(s.monthly).toBe(1500);
  });

  it("un versement exceptionnel réduit le restant dû", () => {
    const withExtra = loanState(
      { ...loan, extraPayments: [{ amount: 10000, date: "2022-06-10" }] },
      now
    );
    expect(withExtra.balance).toBeLessThan(loanState(loan, now).balance);
    expect(withExtra.extraPaymentsTotal).toBe(10000);
  });

  it("ignore un versement exceptionnel encore à venir", () => {
    const future = loanState(
      { ...loan, extraPayments: [{ amount: 10000, date: "2030-06-10" }] },
      now
    );
    expect(future.balance).toBeCloseTo(loanState(loan, now).balance, 2);
    expect(future.extraPaymentsTotal).toBe(0);
  });

  it("ne plante pas sur un prêt vide", () => {
    const s = loanState({}, now);
    expect(Number.isFinite(s.balance)).toBe(true);
    expect(Number.isFinite(s.totalCost)).toBe(true);
  });
});

describe("extraPaymentImpact", () => {
  const loan = {
    principal: 200000,
    rateAnnual: 3,
    termMonths: 240,
    startDate: "2020-01-10",
  };
  const now = new Date("2025-01-10");

  it("raccourcit la durée et fait économiser des intérêts", () => {
    const impact = extraPaymentImpact(loan, 20000, now);
    expect(impact.monthsSaved).toBeGreaterThan(0);
    expect(impact.interestSaved).toBeGreaterThan(0);
  });

  it("un versement plus gros économise davantage", () => {
    const petit = extraPaymentImpact(loan, 5000, now);
    const gros = extraPaymentImpact(loan, 40000, now);
    expect(gros.interestSaved).toBeGreaterThan(petit.interestSaved);
    expect(gros.monthsSaved).toBeGreaterThanOrEqual(petit.monthsSaved);
  });

  it("un versement nul ne change rien", () => {
    const impact = extraPaymentImpact(loan, 0, now);
    expect(impact.monthsSaved).toBe(0);
    expect(impact.interestSaved).toBeCloseTo(0, 2);
  });
});

describe("aggregateLoans", () => {
  it("somme les états et reste cohérent avec ses composantes", () => {
    const a = loanState(
      { principal: 100000, rateAnnual: 2, termMonths: 120, startDate: "2021-01-10" },
      new Date("2025-01-10")
    );
    const b = loanState(
      { principal: 50000, rateAnnual: 4, termMonths: 60, startDate: "2022-01-10" },
      new Date("2025-01-10")
    );
    const agg = aggregateLoans([a, b]);
    expect(agg.balance).toBeCloseTo(a.balance + b.balance, 2);
    expect(agg.monthly).toBeCloseTo(a.monthly + b.monthly, 2);
    expect(agg.interestRemaining).toBeCloseTo(a.interestRemaining + b.interestRemaining, 2);
    // `originalPrincipal` est reconstitué depuis les états, pas repris des
    // prêts : c'est lui qui sert de dénominateur d'avancement côté consommateur
    // (useLoanProgress). Il doit valoir la somme des capitaux empruntés.
    expect(agg.originalPrincipal).toBeCloseTo(150000, 2);
    expect(agg.principalRepaid / agg.originalPrincipal).toBeGreaterThan(0);
    expect(agg.principalRepaid / agg.originalPrincipal).toBeLessThan(1);
  });

  it("renvoie des zéros sur une liste vide", () => {
    const agg = aggregateLoans([]);
    expect(agg.balance).toBe(0);
    expect(agg.monthly).toBe(0);
    expect(agg.originalPrincipal).toBe(0);
    // Le ratio d'avancement vaudrait NaN ici (0/0) : c'est au consommateur de
    // garder sa garde `originalPrincipal > 0` (useLoanProgress.js).
    expect(Number.isNaN(agg.principalRepaid / agg.originalPrincipal)).toBe(true);
  });
});
