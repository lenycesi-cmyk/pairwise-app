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

  // Part d'une transaction attribuable à un membre donné, selon le champ `split`
  // (même logique que MemberBreakdownScreen) : 50/50 → moitié chacun, split === uid
  // → entièrement à ce membre, sinon 0 (attribué à l'autre membre).
  function memberShare(tx, memberUid) {
    const val = toBase(tx);
    if (tx.split === "50/50") return val / 2;
    if (tx.split === memberUid) return val;
    return 0;
  }

  // Une transaction matche un budget "category" si sa catégorie entière est
  // sélectionnée, OU si sa combinaison catégorie+sous-catégorie précise l'est
  // (budgets à granularité sous-catégorie).
  function txMatchesBudget(tx, b) {
    if (b.scope === "global") return true;
    if (b.categoryIds?.includes(tx.categoryId)) return true;
    if (b.subcategoryKeys?.includes(`${tx.categoryId}::${tx.subcategory}`)) return true;
    return false;
  }

  const progress = useMemo(() => {
    return budgets
      .filter((b) => b.active)
      .map((b) => {
        const scopedTx = monthTx.filter((tx) => txMatchesBudget(tx, b));
        const spent =
          b.memberUid && b.memberUid !== "couple"
            ? scopedTx.reduce((sum, tx) => sum + memberShare(tx, b.memberUid), 0)
            : scopedTx.reduce((sum, tx) => sum + toBase(tx), 0);
        const amountInBase = convert(b.amount, b.currency, defaultCurrency);
        const pct = amountInBase > 0 ? (spent / amountInBase) * 100 : 0;
        return { budget: b, spent, amountInBase, pct };
      });
  }, [budgets, monthTx, defaultCurrency, convert]);

  return { progress, loading: ratesLoading };
}
