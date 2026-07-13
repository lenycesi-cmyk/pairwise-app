import { useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "./useExchangeRates";

// Ramène chaque fréquence à son équivalent mensuel (moyenné sur l'année).
const MONTHLY_FACTOR = { monthly: 1, weekly: 52 / 12, yearly: 1 / 12 };

// Total mensuel des charges fixes = somme des règles récurrentes de type
// "expense" actives, chacune convertie dans la devise d'affichage et ramenée à
// un montant mensuel. Sert au widget « Il te faut X/mois » de l'onglet Flux
// (et réutilisable ailleurs). `displayCurrency` optionnel → devise par défaut.
export function useFixedExpenses(displayCurrency) {
  const { recurringTx, defaultCurrency } = useFinance();
  const base = displayCurrency || defaultCurrency;
  const { convert } = useExchangeRates(base);

  return useMemo(() => {
    const items = recurringTx
      .filter((r) => r.type === "expense" && r.active !== false)
      .map((r) => {
        const factor = MONTHLY_FACTOR[r.frequency] ?? 1;
        const monthly = convert(r.amount, r.currency, base) * factor;
        return { rule: r, monthly };
      });
    const monthlyTotal = items.reduce((s, it) => s + it.monthly, 0);
    return { monthlyTotal, count: items.length, items, currency: base };
  }, [recurringTx, base, convert]);
}
