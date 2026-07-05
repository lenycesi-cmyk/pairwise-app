import { useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "./useExchangeRates";
import { useBudgetProgress } from "./useBudgetProgress";
import { groupForCategory } from "../data/budgetGroups";

// ── Score de santé financière (Health / Healthy spending factor) ─────────────
// Moyenne pondérée de 5 piliers, chacun noté 0–100. Les piliers non
// applicables (pas de budget, pas d'actif, pas de revenu...) sont exclus et
// les poids renormalisés sur ceux qui restent. Calculé sur une fenêtre glissante
// de 90 jours pour lisser les mois partiels.
//
// Piliers : épargne (30%), budgets (25%), équilibre 50/30/20 (20%),
// fonds d'urgence (15%), charge récurrente (10%).

const LIQUID_TYPES = ["account", "cash"];
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

// Note un ratio linéairement : atGood → 100, atBad → 0.
function linScore(value, atBad, atGood) {
  if (atGood === atBad) return 0;
  return clamp(((value - atBad) / (atGood - atBad)) * 100);
}

function band(score) {
  if (score >= 80) return "great";
  if (score >= 60) return "good";
  if (score >= 40) return "watch";
  return "fragile";
}

export function useHealthScore(displayCurrency) {
  const { transactions, defaultCurrency, assets, recurringTx } = useFinance();
  const base = displayCurrency || defaultCurrency;
  const { convert } = useExchangeRates(base);
  const { progress: budgetProgress } = useBudgetProgress();
  const now = new Date().getTime();

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === base) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, base);
  }

  return useMemo(() => {
    const windowStart = now - 90 * 86400000;
    const MONTHS = 3; // fenêtre de 90 jours ≈ 3 mois

    // Sommes sur la fenêtre glissante
    let income = 0, expense = 0, investment = 0;
    const groupSpend = { essential: 0, fun: 0, investment: 0 };
    for (const tx of transactions) {
      const d = new Date(tx.date).getTime();
      if (d < windowStart || d > now) continue;
      const val = toBase(tx);
      if (tx.type === "income") income += val;
      else if (tx.type === "expense") {
        expense += val;
        groupSpend[groupForCategory(tx.categoryId)] += val;
      } else if (tx.type === "investment") {
        investment += val;
        groupSpend.investment += val;
      }
    }
    const monthlyIncome = income / MONTHS;
    const monthlyExpense = expense / MONTHS;

    const pillars = [];

    // 1. Taux d'épargne (30%) — (revenus − dépenses − investissements) / revenus
    if (income > 0) {
      const savingsRate = (income - expense - investment) / income;
      pillars.push({
        key: "savings",
        weight: 30,
        score: linScore(savingsRate, 0, 0.25),
        detail: { savingsRate },
      });
    }

    // 2. Respect des budgets (25%) — moyenne des budgets actifs (mois en cours)
    if (budgetProgress.length > 0) {
      const scores = budgetProgress.map((b) =>
        b.pct <= 100 ? 100 : linScore(b.pct, 150, 100)
      );
      const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
      const overCount = budgetProgress.filter((b) => b.pct >= 100).length;
      pillars.push({
        key: "budgets",
        weight: 25,
        score: avg,
        detail: { count: budgetProgress.length, overCount },
      });
    }

    // 3. Équilibre 50/30/20 (20%) — distance à la cible sur les sorties
    const outflow = groupSpend.essential + groupSpend.fun + groupSpend.investment;
    if (outflow > 0) {
      const shares = {
        essential: groupSpend.essential / outflow,
        fun: groupSpend.fun / outflow,
        investment: groupSpend.investment / outflow,
      };
      const dev =
        Math.abs(shares.essential - 0.5) +
        Math.abs(shares.fun - 0.3) +
        Math.abs(shares.investment - 0.2);
      // Écart max ≈ 1.6 (tout dans le plus petit poste), on normalise dessus.
      pillars.push({
        key: "balance",
        weight: 20,
        score: clamp(100 * (1 - dev / 1.6)),
        detail: { shares },
      });
    }

    // 4. Fonds d'urgence (15%) — mois de dépenses couverts par le liquide
    const liquid = assets
      .filter((a) => LIQUID_TYPES.includes(a.typeId))
      .reduce((s, a) => s + convert(a.value ?? 0, a.currency || base, base), 0);
    if (monthlyExpense > 0) {
      const months = liquid / monthlyExpense;
      pillars.push({
        key: "emergency",
        weight: 15,
        score: linScore(months, 0, 6),
        detail: { months, liquid },
      });
    }

    // 5. Charge récurrente (10%) — poids des charges fixes sur les revenus
    if (monthlyIncome > 0) {
      let recurringMonthly = 0;
      for (const r of recurringTx) {
        if (r.active === false || r.type !== "expense") continue;
        const amt = convert(r.amount ?? 0, r.currency || base, base);
        const factor = r.frequency === "weekly" ? 4.33 : r.frequency === "yearly" ? 1 / 12 : 1;
        recurringMonthly += amt * factor;
      }
      const ratio = recurringMonthly / monthlyIncome;
      pillars.push({
        key: "recurring",
        weight: 10,
        score: linScore(ratio, 0.7, 0.3),
        detail: { ratio, recurringMonthly },
      });
    }

    if (pillars.length === 0) {
      return { score: null, band: null, pillars: [], hasData: false };
    }

    const totalWeight = pillars.reduce((s, p) => s + p.weight, 0);
    const score = Math.round(
      pillars.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight
    );
    // Poids effectif (renormalisé) pour l'affichage
    for (const p of pillars) {
      p.effectiveWeight = Math.round((p.weight / totalWeight) * 100);
      p.band = band(p.score);
    }

    return { score, band: band(score), pillars, hasData: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, assets, recurringTx, budgetProgress, base, convert]);
}
