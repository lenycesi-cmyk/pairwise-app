import { useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "./useExchangeRates";

// Calcule, pour chaque budget actif, le montant dépensé sur la période de
// référence et le % consommé — même logique de conversion que DashboardScreen
// (convertedAmount figé à la création en priorité, fallback sur conversion
// dynamique). `viewMonth`/`viewYear` permettent de calculer la progression
// pour le mois affiché sur Accueil/Rapports plutôt que toujours le mois
// calendaire réel — sans quoi le widget Budget d'Accueil dérivait du mois
// consulté (ex: on regarde juin, le widget montre les dépenses de juillet).
export function useBudgetProgress(viewMonth, viewYear, displayCurrency) {
  const { transactions, budgets, defaultCurrency } = useFinance();
  // Devise d'affichage (sélecteur de l'écran Budget) ; à défaut, devise par
  // défaut du couple — les appelants historiques (widget Accueil) ne passent
  // rien et gardent donc le comportement d'origine.
  const base = displayCurrency || defaultCurrency;
  const { convert, loading: ratesLoading } = useExchangeRates(base);

  const now = new Date();
  const month = viewMonth ?? now.getMonth();
  const year = viewYear ?? now.getFullYear();

  const monthTx = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === "expense" && d.getMonth() === month && d.getFullYear() === year;
    });
  }, [transactions, month, year]);

  // Budgets à période "yearly" (dépenses annuelles irrégulières — cadeaux,
  // voyages, impôts...) se calculent sur l'année civile complète plutôt que
  // le mois affiché.
  const yearTx = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === "expense" && d.getFullYear() === year;
    });
  }, [transactions, year]);

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === base) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, base);
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
    // Budget "tag" : la transaction compte si elle porte au moins un des tags
    // ciblés (ex. budget "vacances" transversal aux catégories).
    if (b.scope === "tag") {
      return (b.tagKeys || []).some((tag) => (tx.tags || []).includes(tag));
    }
    if (b.categoryIds?.includes(tx.categoryId)) return true;
    if (b.subcategoryKeys?.includes(`${tx.categoryId}::${tx.subcategory}`)) return true;
    return false;
  }

  const progress = useMemo(() => {
    return budgets
      .filter((b) => b.active)
      .map((b) => {
        const periodTx = b.period === "yearly" ? yearTx : monthTx;
        const scopedTx = periodTx.filter((tx) => txMatchesBudget(tx, b));
        const spent =
          b.memberUid && b.memberUid !== "couple"
            ? scopedTx.reduce((sum, tx) => sum + memberShare(tx, b.memberUid), 0)
            : scopedTx.reduce((sum, tx) => sum + toBase(tx), 0);
        const amountInBase = convert(b.amount, b.currency, base);
        const pct = amountInBase > 0 ? (spent / amountInBase) * 100 : 0;

        // Projection fin de période "à ce rythme" — uniquement pour la
        // période en cours (projeter un mois passé n'a pas de sens) et
        // après quelques jours (sinon le 1er du mois multiplie n'importe
        // quelle dépense par 30).
        let projected = null;
        const today = new Date();
        const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
        if (b.period === "yearly") {
          const dayOfYear = Math.ceil((today - new Date(year, 0, 1)) / 86400000);
          const daysInYear = (new Date(year, 11, 31) - new Date(year, 0, 0)) / 86400000;
          if (year === today.getFullYear() && dayOfYear >= 14) {
            projected = (spent / dayOfYear) * daysInYear;
          }
        } else if (isCurrentMonth && today.getDate() >= 5) {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          projected = (spent / today.getDate()) * daysInMonth;
        }
        const projectedOver = projected !== null && amountInBase > 0 && projected > amountInBase;

        return { budget: b, spent, amountInBase, pct, scopedTx, projected, projectedOver };
      });
  }, [budgets, monthTx, yearTx, base, convert, month, year]);

  return { progress, loading: ratesLoading };
}
