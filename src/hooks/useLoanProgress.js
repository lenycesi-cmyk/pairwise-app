import { useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "./useExchangeRates";
import { loanState, aggregateLoans } from "../utils/loanMath";

// Calcul partagé « prêts vs amortissement », consommé par l'onglet Crédits, le
// widget de synthèse de l'Accueil et la carte Dettes du Patrimoine. Pour chaque
// prêt on renvoie son état d'amortissement (utils/loanMath) dans sa devise
// d'origine (`state`) ET converti dans la devise d'affichage (`conv`), plus un
// agrégat global déjà converti.
export function useLoanProgress(displayCurrency) {
  const { loans } = useFinance();
  const { convert } = useExchangeRates(displayCurrency);

  return useMemo(() => {
    const now = new Date();
    const items = (loans || []).map((loan) => {
      const state = loanState(loan, now);
      const cv = (v) => convert(v, loan.currency || displayCurrency, displayCurrency);
      const conv = {
        balance: cv(state.balance),
        monthly: cv(state.monthly),
        interestRemaining: cv(state.interestRemaining),
        interestPaid: cv(state.interestPaid),
        totalInterest: cv(state.totalInterest),
        totalCost: cv(state.totalCost),
        principalRepaid: cv(state.principalRepaid),
      };
      return { loan, state, conv };
    });
    // Prêts actifs (non soldés) triés par capital restant décroissant.
    const active = items.filter((i) => !i.state.isPaidOff);
    const aggregate = aggregateLoans(active.map((i) => i.conv));
    aggregate.count = active.length;
    aggregate.progress =
      aggregate.originalPrincipal > 0
        ? aggregate.principalRepaid / aggregate.originalPrincipal
        : 0;
    // Date de fin du prêt le plus lointain (pour la vue d'ensemble).
    aggregate.lastPayoff = active.reduce((max, i) => {
      const d = i.state.payoffDate ? new Date(i.state.payoffDate) : null;
      return d && (!max || d > max) ? d : max;
    }, null);

    const sorted = [...items].sort((a, b) => b.conv.balance - a.conv.balance);
    return { items: sorted, aggregate };
  }, [loans, displayCurrency, convert]);
}
