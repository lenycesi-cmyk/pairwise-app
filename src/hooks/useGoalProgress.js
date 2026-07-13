import { useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useNetWorth } from "./useNetWorth";
import { useExchangeRates } from "./useExchangeRates";

// Progression de chaque objectif, calculée à la lecture (jamais stockée) :
//   current = somme des assets liés (getAssetValue → prix live inclus, déjà
//             converti dans la devise d'affichage)
//   target  = targetAmount converti dans la devise d'affichage
// + rythme mensuel requis (si deadline) et date d'atteinte projetée (si
// contribution mensuelle définie). Devise d'affichage unique pour comparer des
// objectifs de devises différentes.
export function useGoalProgress(displayCurrency) {
  const { goals, assets, defaultCurrency } = useFinance();
  const base = displayCurrency || defaultCurrency;
  const { getAssetValue } = useNetWorth(base);
  const { convert } = useExchangeRates(base);

  return useMemo(() => {
    const now = new Date();
    const assetById = new Map(assets.map((a) => [a.id, a]));

    return goals.map((goal) => {
      const current = (goal.linkedAssetIds || [])
        .map((id) => assetById.get(id))
        .filter(Boolean)
        .reduce((sum, asset) => sum + getAssetValue(asset), 0);

      const target = convert(goal.targetAmount || 0, goal.currency || base, base);
      const remaining = Math.max(target - current, 0);
      const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
      const reached = target > 0 && current >= target;

      // Rythme mensuel requis pour tenir la deadline.
      let monthlyNeeded = null;
      if (goal.deadline && remaining > 0) {
        const d = new Date(goal.deadline);
        const monthsLeft = Math.max(
          (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()),
          1
        );
        monthlyNeeded = remaining / monthsLeft;
      }

      // Date d'atteinte projetée à partir de la contribution mensuelle saisie.
      let projectedDate = null;
      if (goal.monthlyContribution > 0 && remaining > 0) {
        const months = Math.ceil(remaining / goal.monthlyContribution);
        projectedDate = new Date(now.getFullYear(), now.getMonth() + months, 1);
      }

      const onTrack =
        reached ||
        (monthlyNeeded != null && goal.monthlyContribution > 0
          ? goal.monthlyContribution >= monthlyNeeded
          : null);

      return { goal, current, target, remaining, pct, reached, monthlyNeeded, projectedDate, onTrack, base };
    });
  }, [goals, assets, base, getAssetValue, convert]);
}
