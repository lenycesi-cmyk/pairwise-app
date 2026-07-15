import { useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "./useExchangeRates";
import { periodRange, previousPeriodRange, inRange } from "../utils/budgetPeriods";
import { getMemberKey, memberShareFraction } from "../utils/members";

// Calcule, pour chaque budget actif, le montant dépensé sur sa période de
// référence et le % consommé — même logique de conversion que DashboardScreen
// (convertedAmount figé à la création en priorité, fallback sur conversion
// dynamique). La période dépend désormais de la fréquence du budget (mensuel,
// mois ancré, hebdo, trimestriel, annuel, glissant, enveloppe d'événement) via
// utils/budgetPeriods. `viewMonth`/`viewYear` positionnent la période pour les
// fréquences calendaires (Accueil/Rapports navigables) ; hebdo/glissant/
// événement se basent sur maintenant / leurs dates fixes.
export function useBudgetProgress(viewMonth, viewYear, displayCurrency) {
  const { transactions, budgets, members, defaultCurrency } = useFinance();
  const base = displayCurrency || defaultCurrency;
  const { convert, loading: ratesLoading } = useExchangeRates(base);

  const now = new Date();
  const month = viewMonth ?? now.getMonth();
  const year = viewYear ?? now.getFullYear();

  const expenseTx = useMemo(
    () => transactions.filter((tx) => tx.type === "expense"),
    [transactions]
  );

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === base) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, base);
  }

  // Part « pour qui » d'une transaction attribuable à un membre (fraction ×
  // montant), via le helper partagé (gère 50/50, part membre, partage avancé).
  function memberShare(tx, memberUid) {
    return toBase(tx) * memberShareFraction(tx, memberUid, members);
  }

  function txMatchesBudget(tx, b) {
    if (b.scope === "global") return true;
    if (b.scope === "tag") {
      return (b.tagKeys || []).some((tag) => (tx.tags || []).includes(tag));
    }
    if (b.categoryIds?.includes(tx.categoryId)) return true;
    if (b.subcategoryKeys?.includes(`${tx.categoryId}::${tx.subcategory}`)) return true;
    return false;
  }

  // Dépense d'un budget sur une plage donnée (respecte scope + membre).
  function spendOver(b, range) {
    let sum = 0;
    for (const tx of expenseTx) {
      const ms = new Date(tx.date).getTime();
      if (!inRange(ms, range)) continue;
      if (!txMatchesBudget(tx, b)) continue;
      sum += b.memberUid && b.memberUid !== "couple" ? memberShare(tx, b.memberUid) : toBase(tx);
    }
    return sum;
  }

  const progress = useMemo(() => {
    // Date de référence au milieu du mois consulté : pour un mois ancré, cela
    // sélectionne sans ambiguïté la période qui contient ce mois.
    const refDate = new Date(year, month, 15);
    return budgets
      .filter((b) => b.active)
      .map((b) => {
        const range = periodRange(b, refDate);
        const scopedTx = expenseTx.filter(
          (tx) => inRange(new Date(tx.date).getTime(), range) && txMatchesBudget(tx, b)
        );
        const spent =
          b.memberUid && b.memberUid !== "couple"
            ? scopedTx.reduce((s, tx) => s + memberShare(tx, b.memberUid), 0)
            : scopedTx.reduce((s, tx) => s + toBase(tx), 0);

        const amountInBase = convert(b.amount, b.currency, base);

        // Report du reliquat (YNAB), optionnel : on ajoute au budget courant le
        // reliquat de la période PRÉCÉDENTE (budget − dépensé), une seule
        // période en arrière. Peut être négatif (dépassement reporté).
        let carried = 0;
        if (b.rollover) {
          const prev = previousPeriodRange(b, refDate);
          if (prev && prev.end.getTime() < range.start.getTime()) {
            carried = amountInBase - spendOver(b, prev);
          }
        }
        const effectiveAmount = amountInBase + carried;
        const denom = effectiveAmount > 0 ? effectiveAmount : amountInBase;
        const pct = denom > 0 ? (spent / denom) * 100 : 0;

        // Projection "à ce rythme" — généralisée à toute période dont on est en
        // cours (aujourd'hui dans la plage) et suffisamment avancée (>15%).
        let projected = null;
        const startMs = range.start.getTime();
        const endMs = range.end.getTime();
        const nowMs = now.getTime();
        if (nowMs >= startMs && nowMs <= endMs) {
          const elapsed = (nowMs - startMs) / (endMs - startMs);
          if (elapsed >= 0.15) projected = spent / elapsed;
        }
        const projectedOver = projected !== null && denom > 0 && projected > denom;

        // Dépense re-scopée par membre (part « pour qui ») pour le filtre membre
        // des widgets Budget. Clé = memberKey ; « Famille » = `spent` global.
        const spentByMember = {};
        for (const m of members) {
          const key = getMemberKey(m);
          spentByMember[key] = scopedTx.reduce((s, tx) => s + memberShare(tx, key), 0);
        }

        return { budget: b, spent, spentByMember, amountInBase, effectiveAmount, carried, pct, scopedTx, range, projected, projectedOver };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, expenseTx, base, convert, year, month, members]);

  return { progress, loading: ratesLoading };
}
