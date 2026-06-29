import { useEffect } from "react";
import { useBudgetProgress } from "./useBudgetProgress";

function monthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

export function useBudgetAlerts() {
  const { progress } = useBudgetProgress();

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    for (const { budget, pct } of progress) {
      const threshold = budget.alertThreshold ?? 80;
      if (pct < threshold) continue;

      const storageKey = `budgetAlert_${budget.id}_${monthKey()}`;
      if (localStorage.getItem(storageKey)) continue;

      const label = budget.scope === "global" ? "Budget global" : "Budget catégorie";
      new Notification("Budget dépassé", {
        body: `${label} : ${Math.round(pct)}% du budget atteint.`,
        tag: storageKey,
      });
      localStorage.setItem(storageKey, "1");
    }
  }, [progress]);
}
