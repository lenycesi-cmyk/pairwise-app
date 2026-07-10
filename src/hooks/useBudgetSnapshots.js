import { useEffect } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "./useExchangeRates";
import { periodRange, previousPeriodRange, inRange } from "../utils/budgetPeriods";

// Runner d'historique (approche "snapshot à la clôture") : à chaque changement
// de données / ouverture de l'app, on fige un instantané de la période
// PRÉCÉDENTE clôturée de chaque budget (et de l'enveloppe d'événement terminée)
// dans `budgetHistory` sur le doc couple. Idempotent : une période déjà
// snapshottée n'est jamais réécrite. On ne capture pas les périodes antérieures
// à la création du budget, ni les fenêtres glissantes (pas de période discrète).
export function useBudgetSnapshots() {
  const { budgets, transactions, defaultCurrency, budgetHistory, saveBudgetSnapshots } = useFinance();
  const { convert, loading: ratesLoading } = useExchangeRates(defaultCurrency);

  useEffect(() => {
    if (ratesLoading || !budgets || budgets.length === 0) return;
    const now = Date.now();

    function toBase(tx) {
      if (tx.convertedAmount !== undefined && tx.convertedCurrency === defaultCurrency) return tx.convertedAmount;
      return convert(tx.amount, tx.currency, defaultCurrency);
    }
    function matches(tx, b) {
      if (b.scope === "global") return true;
      if (b.scope === "tag") return (b.tagKeys || []).some((t) => (tx.tags || []).includes(t));
      if (b.categoryIds?.includes(tx.categoryId)) return true;
      if (b.subcategoryKeys?.includes(`${tx.categoryId}::${tx.subcategory}`)) return true;
      return false;
    }
    function memberShare(tx, uid) {
      const val = toBase(tx);
      if (tx.split === "50/50") return val / 2;
      if (tx.split === uid) return val;
      return 0;
    }
    function spendOver(b, range) {
      let sum = 0;
      for (const tx of transactions) {
        if (tx.type !== "expense") continue;
        if (!inRange(new Date(tx.date).getTime(), range)) continue;
        if (!matches(tx, b)) continue;
        sum += b.memberUid && b.memberUid !== "couple" ? memberShare(tx, b.memberUid) : toBase(tx);
      }
      return sum;
    }
    function snapshot(b, range, key) {
      return {
        budgetId: b.id,
        key,
        data: {
          budgeted: Math.round(convert(b.amount, b.currency, defaultCurrency)),
          spent: Math.round(spendOver(b, range)),
          currency: defaultCurrency,
          start: range.start.toISOString(),
          end: range.end.toISOString(),
          at: now,
        },
      };
    }

    const pending = [];
    for (const b of budgets) {
      const p = b.period || "monthly";
      if (p === "rolling") continue;
      if (p === "event") {
        const range = periodRange(b);
        if (range.end.getTime() < now && !budgetHistory?.[b.id]?.event) {
          pending.push(snapshot(b, range, "event"));
        }
        continue;
      }
      const prev = previousPeriodRange(b, new Date());
      if (!prev || !prev.key) continue;
      // La période doit être clôturée ET postérieure à la création du budget.
      if (prev.end.getTime() >= now) continue;
      if (b.createdAt && b.createdAt > prev.start.getTime()) continue;
      if (budgetHistory?.[b.id]?.[prev.key]) continue;
      pending.push(snapshot(b, prev, prev.key));
    }

    if (pending.length) saveBudgetSnapshots(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, transactions, budgetHistory, ratesLoading, defaultCurrency]);
}
