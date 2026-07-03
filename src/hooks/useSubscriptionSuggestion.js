import { useMemo, useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { normalizeText } from "../utils/descriptionSuggestions";

const DISMISS_PREFIX = "subscriptionDismissed_";

// Détecte les abonnements probables dans les dépenses saisies à la main :
// même description (normalisée), montant stable à ±5 %, écart de 25 à 35
// jours entre occurrences — et aucune règle récurrente existante pour cette
// description. Retourne UNE suggestion à la fois (la plus récente), avec
// accept() qui crée la récurrence et dismiss() qui mémorise le refus en
// localStorage pour ne plus jamais la proposer.
export function useSubscriptionSuggestion() {
  const { transactions, recurringTx, addRecurring } = useFinance();
  const [dismissedVersion, setDismissedVersion] = useState(0);

  const suggestion = useMemo(() => {
    const recurringKeys = new Set(
      recurringTx.map((r) => normalizeText(r.description)).filter(Boolean)
    );

    const groups = new Map();
    for (const tx of transactions) {
      if (tx.type !== "expense" || !tx.description) continue;
      const key = normalizeText(tx.description);
      if (!key || recurringKeys.has(key)) continue;
      if (localStorage.getItem(DISMISS_PREFIX + key)) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tx);
    }

    const candidates = [];
    for (const [key, txs] of groups) {
      if (txs.length < 2) continue;
      const sorted = [...txs].sort((a, b) => new Date(a.date) - new Date(b.date));
      // Montants stables : chaque montant à ±5 % du premier (même devise).
      const ref = sorted[0];
      const sameAmount = sorted.every(
        (tx) => tx.currency === ref.currency && Math.abs(tx.amount - ref.amount) <= ref.amount * 0.05
      );
      if (!sameAmount) continue;
      // Cadence mensuelle : chaque écart consécutif entre 25 et 35 jours.
      let monthly = true;
      for (let i = 1; i < sorted.length; i++) {
        const gap = (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000;
        if (gap < 25 || gap > 35) { monthly = false; break; }
      }
      if (!monthly) continue;
      const last = sorted[sorted.length - 1];
      candidates.push({ key, count: sorted.length, last });
    }

    if (candidates.length === 0) return null;
    // La plus récemment vue en premier — une seule carte à la fois.
    candidates.sort((a, b) => new Date(b.last.date) - new Date(a.last.date));
    const c = candidates[0];
    return {
      key: c.key,
      description: c.last.description,
      amount: c.last.amount,
      currency: c.last.currency,
      count: c.count,
      tx: c.last,
    };
    // dismissedVersion force le recalcul après un "Ignorer" (localStorage
    // n'est pas réactif).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, recurringTx, dismissedVersion]);

  async function accept() {
    if (!suggestion) return;
    const { tx } = suggestion;
    const lastDate = new Date(tx.date);
    await addRecurring({
      type: "expense",
      amount: tx.amount,
      currency: tx.currency,
      categoryId: tx.categoryId,
      subcategory: tx.subcategory || null,
      description: tx.description,
      frequency: "monthly",
      dayOfMonth: lastDate.getDate(),
      paidBy: tx.paidBy,
      split: tx.split || "50/50",
      active: true,
      // La dernière occurrence saisie à la main compte comme déjà générée,
      // sinon le générateur dupliquerait la dépense du mois en cours.
      lastGenerated: tx.date,
    });
  }

  function dismiss() {
    if (!suggestion) return;
    localStorage.setItem(DISMISS_PREFIX + suggestion.key, "1");
    setDismissedVersion((v) => v + 1);
  }

  return { suggestion, accept, dismiss };
}
