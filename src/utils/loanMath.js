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

// État complet d'amortissement d'un prêt à l'instant `now`. Toutes les valeurs
// monétaires sont dans la devise du prêt (`loan.currency`).
export function loanState(loan, now = new Date()) {
  const P = Number(loan?.principal) || 0;
  const n = Number(loan?.termMonths) || 0;
  const rateAnnual = Number(loan?.rateAnnual) || 0;
  const r = rateAnnual / 100 / 12;
  const M = Number(loan?.monthlyPayment) > 0
    ? Number(loan.monthlyPayment)
    : monthlyPayment(P, rateAnnual, n);

  const k = paymentsMade(loan?.startDate, n, now);
  const paymentsLeft = Math.max(0, n - k);

  // Capital restant dû après k échéances.
  let balance;
  if (r === 0) balance = Math.max(0, P - M * k);
  else balance = P * Math.pow(1 + r, k) - M * ((Math.pow(1 + r, k) - 1) / r);
  balance = Math.max(0, balance);

  const totalCost = M * n; // total remboursé sur toute la durée
  const totalInterest = Math.max(0, totalCost - P);
  const principalRepaid = Math.max(0, P - balance);
  // Intérêts restants ≈ ce qu'il reste à verser − le capital restant.
  const interestRemaining = Math.max(0, paymentsLeft * M - balance);
  const interestPaid = Math.max(0, totalInterest - interestRemaining);
  const progress = P > 0 ? principalRepaid / P : 0; // 0..1

  return {
    monthly: M,
    balance,
    principalRepaid,
    interestPaid,
    interestRemaining,
    totalInterest,
    totalCost,
    paymentsMade: k,
    paymentsLeft,
    termMonths: n,
    progress,
    payoffDate: loan?.startDate ? addMonths(loan.startDate, n) : null,
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
