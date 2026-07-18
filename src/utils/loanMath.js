// Calculs d'amortissement de prêt (crédit immobilier, auto, conso…).
// Formules standard à mensualités constantes (« amortissement français »).
//
// Un prêt PairWise (champ `loans[]` sur le doc couple) :
//   { id, name, type, principal, rateAnnual, termMonths, startDate,
//     monthlyPayment?, currency, linkedSubcategory?, extraPayments?, ownership }
// `monthlyPayment` est optionnel : s'il est absent on le déduit du capital, du
// taux et de la durée. Les versements exceptionnels (`extraPayments`) seront
// intégrés dans un second temps (UI dédiée) ; le MVP raisonne sans eux.

// Mensualité (part capital + intérêts) pour un prêt à taux fixe.
// r = taux mensuel ; si r = 0 (prêt à taux nul), simple division.
export function monthlyPayment(principal, rateAnnual, termMonths) {
  const P = Number(principal) || 0;
  const n = Number(termMonths) || 0;
  if (P <= 0 || n <= 0) return 0;
  const r = (Number(rateAnnual) || 0) / 100 / 12;
  if (r === 0) return P / n;
  return (P * r) / (1 - Math.pow(1 + r, -n));
}

// Nombre d'échéances déjà réglées entre la date de début et `now`
// (nombre de mois entiers écoulés), borné à la durée du prêt.
export function paymentsMade(startDate, termMonths, now = new Date()) {
  const n = Number(termMonths) || 0;
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1; // l'échéance du mois n'est pas encore passée
  return Math.max(0, Math.min(n, months));
}

// Ajoute `count` mois à une date (gère le débordement d'année).
export function addMonths(date, count) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return d;
}

// Nombre de mois entiers entre deux dates (a → b), borné à 0.
function monthsBetween(a, b) {
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

// État complet d'amortissement d'un prêt à l'instant `now`, versements
// exceptionnels compris. Simulation mensuelle (mensualité constante) : passe 1
// jusqu'à aujourd'hui pour le capital restant, passe 2 pour l'échéancier restant.
// Toutes les valeurs monétaires sont dans la devise du prêt (`loan.currency`).
export function loanState(loan, now = new Date()) {
  const P = Number(loan?.principal) || 0;
  const n = Number(loan?.termMonths) || 0;
  const rateAnnual = Number(loan?.rateAnnual) || 0;
  const r = rateAnnual / 100 / 12;
  const M = Number(loan?.monthlyPayment) > 0
    ? Number(loan.monthlyPayment)
    : monthlyPayment(P, rateAnnual, n);
  const start = loan?.startDate ? new Date(loan.startDate) : null;
  const kNow = paymentsMade(loan?.startDate, n, now);

  // Versements exceptionnels rattachés à leur mois d'échéance (index depuis le début).
  const extras = (loan?.extraPayments || []).map((e) => ({
    amount: Number(e.amount) || 0,
    date: e.date ? new Date(e.date) : now,
    monthIndex: start && e.date ? monthsBetween(start, new Date(e.date)) : 0,
  }));
  const extrasElapsedInMonth = (m) =>
    extras.reduce((s, e) => s + (e.monthIndex === m && e.date <= now ? e.amount : 0), 0);

  const CAP = n + 1200; // garde-fou anti-boucle infinie

  // ── Passe 1 : mois déjà écoulés → capital restant + payé à ce jour ──────
  let bal = P;
  let interestPaid = 0;
  let principalRepaid = 0;
  for (let m = 0; m < kNow && bal > 0.005; m++) {
    const interest = bal * r;
    let principal = Math.min(bal, Math.max(0, M - interest));
    bal -= principal;
    const ex = Math.min(bal, extrasElapsedInMonth(m));
    bal -= ex;
    interestPaid += interest;
    principalRepaid += principal + ex;
  }
  // Versements exceptionnels datés d'aujourd'hui (ou dont le mois ≥ kNow) déjà encaissés.
  const extraNow = extras
    .filter((e) => e.date <= now && e.monthIndex >= kNow)
    .reduce((s, e) => s + e.amount, 0);
  const exNowApplied = Math.min(bal, extraNow);
  bal -= exNowApplied;
  principalRepaid += exNowApplied;
  const balance = Math.max(0, bal);

  // ── Passe 2 : échéancier restant à partir du capital courant ────────────
  let paymentsLeft = 0;
  let interestRemaining = 0;
  let b = balance;
  for (let i = 0; b > 0.005 && i < CAP; i++) {
    const interest = b * r;
    const principal = M - interest;
    if (principal <= 0) { paymentsLeft = Math.max(0, n - kNow); break; } // ne s'amortit pas
    b -= Math.min(b, principal);
    interestRemaining += interest;
    paymentsLeft++;
  }

  const totalInterest = interestPaid + interestRemaining;
  const totalCost = P + totalInterest;
  const progress = P > 0 ? principalRepaid / P : 0;

  return {
    monthly: M,
    balance,
    principalRepaid,
    interestPaid,
    interestRemaining,
    totalInterest,
    totalCost,
    paymentsMade: kNow,
    paymentsLeft,
    termMonths: n,
    progress,
    extraPaymentsTotal: extras.reduce((s, e) => s + (e.date <= now ? e.amount : 0), 0),
    payoffDate: addMonths(now, paymentsLeft),
    isPaidOff: balance <= 0.005,
  };
}

// Impact d'un versement exceptionnel `amount` appliqué maintenant, à mensualité
// constante (on réduit la durée). Renvoie mois gagnés et intérêts économisés.
export function extraPaymentImpact(loan, amount, now = new Date()) {
  const amt = Number(amount) || 0;
  const before = loanState(loan, now);
  if (amt <= 0 || before.isPaidOff) {
    return { monthsSaved: 0, interestSaved: 0, newBalance: before.balance, newPayoffDate: before.payoffDate };
  }
  const r = (Number(loan?.rateAnnual) || 0) / 100 / 12;
  const M = before.monthly;
  const newBalance = Math.max(0, before.balance - amt);

  // Nombre d'échéances restantes après le versement (mensualité inchangée).
  let monthsLeftAfter;
  if (newBalance <= 0) monthsLeftAfter = 0;
  else if (r === 0) monthsLeftAfter = Math.ceil(newBalance / M);
  else if (M <= newBalance * r) monthsLeftAfter = before.paymentsLeft; // mensualité ne couvre pas les intérêts
  else monthsLeftAfter = Math.ceil(-Math.log(1 - (newBalance * r) / M) / Math.log(1 + r));

  const monthsSaved = Math.max(0, before.paymentsLeft - monthsLeftAfter);
  // Intérêts restants après versement.
  const interestRemainingAfter = Math.max(0, monthsLeftAfter * M - newBalance);
  const interestSaved = Math.max(0, before.interestRemaining - interestRemainingAfter);

  return {
    monthsSaved,
    interestSaved,
    newBalance,
    newPayoffDate: now ? addMonths(now, monthsLeftAfter) : null,
  };
}

// Agrège plusieurs prêts (déjà convertis dans une devise commune par l'appelant
// via un mapping id → facteur, ou en passant des prêts déjà en devise cible).
export function aggregateLoans(states) {
  return states.reduce(
    (acc, s) => ({
      balance: acc.balance + s.balance,
      monthly: acc.monthly + s.monthly,
      interestRemaining: acc.interestRemaining + s.interestRemaining,
      principalRepaid: acc.principalRepaid + s.principalRepaid,
      originalPrincipal: acc.originalPrincipal + (s.principalRepaid + s.balance),
    }),
    { balance: 0, monthly: 0, interestRemaining: 0, principalRepaid: 0, originalPrincipal: 0 }
  );
}
