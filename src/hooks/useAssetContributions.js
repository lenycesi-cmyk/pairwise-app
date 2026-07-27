import { useEffect } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";

// Clé de période déterministe d'un versement récurrent, pour l'idempotence :
// on n'applique qu'une fois par période (jour / semaine ISO / mois).
function periodKey(contribution, now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  if (contribution.frequency === "daily") {
    return `${y}-${m}-${String(now.getDate()).padStart(2, "0")}`;
  }
  if (contribution.frequency === "weekly") {
    // Numéro de semaine ISO-8601.
    const d = new Date(Date.UTC(y, now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  // mensuel (défaut)
  return `${y}-${m}`;
}

// Runner « toujours monté » (comme useRecurringGenerator) : applique les
// versements récurrents dus vers des actifs. Le versement ponctuel ne passe pas
// par ici (crédit immédiat côté formulaire). Idempotent : un versement déjà
// appliqué pour la période courante est ignoré (assetContributionsApplied).
export function useAssetContributions() {
  const { user } = useAuth();
  const {
    coupleId,
    assets,
    assetContributions,
    assetContributionsApplied,
    applyAssetContributions,
  } = useFinance();

  useEffect(() => {
    if (!coupleId || !user || !assetContributions?.length) return;
    const now = new Date();
    const due = [];
    for (const c of assetContributions) {
      if (c.active === false) continue;
      if (!assets.some((a) => a.id === c.assetId)) continue;
      const pk = periodKey(c, now);
      if (assetContributionsApplied?.[c.id] === pk) continue;
      due.push({ contribution: c, periodKey: pk });
    }
    if (due.length === 0) return;
    applyAssetContributions(due);
  }, [coupleId, user, assets, assetContributions, assetContributionsApplied, applyAssetContributions]);
}
