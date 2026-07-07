import { useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "./useExchangeRates";
import { useBudgetProgress } from "./useBudgetProgress";
import { groupForCategory } from "../data/budgetGroups";
import { getMemberKey } from "../utils/members";

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

// `memberUid` (optionnel) restreint le score à un seul membre : chaque
// transaction/actif/récurrence est compté au prorata de sa part (50/50,
// splitDetails, propriété partagée d'un actif...). null = couple entier.
export function useHealthScore(displayCurrency, memberUid = null) {
  const { transactions, defaultCurrency, assets, recurringTx, members } = useFinance();
  const base = displayCurrency || defaultCurrency;
  const { convert } = useExchangeRates(base);
  const { progress: budgetProgress } = useBudgetProgress();
  const now = new Date().getTime();

  const memberKeys = members.map(getMemberKey);
  const isFirst = memberUid !== null && memberKeys[0] === memberUid;

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === base) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, base);
  }

  // Part du membre sélectionné dans une transaction (1 si vue couple).
  function txShare(tx) {
    if (!memberUid) return 1;
    if (tx.splitDetails) {
      const d = tx.splitDetails;
      const total = d.unit === "percent" ? 100 : (d.a + d.b) || 1;
      return (isFirst ? d.a : d.b) / total;
    }
    if (tx.split === "50/50") return 0.5;
    // split = uid : la dépense est "pour" ce membre, peu importe qui a payé.
    if (tx.split && memberKeys.includes(tx.split)) return tx.split === memberUid ? 1 : 0;
    return tx.paidBy === memberUid ? 1 : 0;
  }

  function assetShare(a) {
    if (!memberUid) return 1;
    if (a.ownership === memberUid) return 1;
    if (a.ownership === "shared") {
      const pct = a.sharePct ?? 50;
      return (isFirst ? pct : 100 - pct) / 100;
    }
    return 0;
  }

  function recurringShare(r) {
    if (!memberUid) return 1;
    if (r.split === "50/50") return 0.5;
    return r.paidBy === memberUid ? 1 : 0;
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
      const val = toBase(tx) * txShare(tx);
      if (val === 0) continue;
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
    // En vue membre, seuls ses budgets personnels sont pris en compte.
    const memberBudgets = memberUid
      ? budgetProgress.filter((b) => b.budget.memberUid === memberUid)
      : budgetProgress;
    if (memberBudgets.length > 0) {
      const scores = memberBudgets.map((b) =>
        b.pct <= 100 ? 100 : linScore(b.pct, 150, 100)
      );
      const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
      const overCount = memberBudgets.filter((b) => b.pct >= 100).length;
      pillars.push({
        key: "budgets",
        weight: 25,
        score: avg,
        detail: { count: memberBudgets.length, overCount },
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
      .reduce((s, a) => s + convert(a.value ?? 0, a.currency || base, base) * assetShare(a), 0);
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
        recurringMonthly += amt * factor * recurringShare(r);
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
  }, [transactions, assets, recurringTx, budgetProgress, base, convert, memberUid, members]);
}
