import { useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "./useExchangeRates";

// Calcule, pour chaque budget actif, le montant dépensé ce mois-ci et le %
// consommé — même logique de conversion que DashboardScreen (convertedAmount
// figé à la création en priorité, fallback sur conversion dynamique).
export function useBudgetProgress() {
  const { transactions, budgets, defaultCurrency } = useFinance();
  const { convert, loading: ratesLoading } = useExchangeRates(defaultCurrency);

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const monthTx = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === "expense" && d.getMonth() === month && d.getFullYear() === year;
    });
  }, [transactions, month, year]);

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === defaultCurrency) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, defaultCurrency);
  }

  const progress = useMemo(() => {
    return budgets
      .filter((b) => b.active)
      .map((b) => {
        const spent = monthTx
          .filter((tx) => b.scope === "global" || b.categoryIds?.includes(tx.categoryId))
          .reduce((sum, tx) => sum + toBase(tx), 0);
        const amountInBase = convert(b.amount, b.currency, defaultCurrency);
        const pct = amountInBase > 0 ? (spent / amountInBase) * 100 : 0;
        return { budget: b, spent, amountInBase, pct };
      });
  }, [budgets, monthTx, defaultCurrency, convert]);

  return { progress, loading: ratesLoading };
}
