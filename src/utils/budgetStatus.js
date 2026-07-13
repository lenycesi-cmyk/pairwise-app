// Statut sémantique d'un budget — partagé par BudgetCard, BudgetScreen (vue
// d'ensemble) et le widget du Dashboard. Les couleurs sont DISTINCTES de la
// couleur de marque (--tang) : vert = tranquille, ambre = à surveiller,
// rouge = dépassement.
export const STATUS_COLOR = { good: "var(--sage)", warn: "var(--amber)", over: "var(--red)" };
export const STATUS_TINT = {
  good: "color-mix(in srgb, var(--sage) 13%, transparent)",
  warn: "color-mix(in srgb, var(--amber) 15%, transparent)",
  over: "color-mix(in srgb, var(--red) 13%, transparent)",
};
export const STATUS_ICON = { good: "ti-mood-smile", warn: "ti-alert-triangle", over: "ti-trending-up" };

// Statut = pire cas entre le réel et le projeté : une projection trop rapide
// peut déclasser un budget dont le % actuel est encore bas.
export function budgetLevel(p) {
  const denom = p.effectiveAmount > 0 ? p.effectiveAmount : p.amountInBase;
  const threshold = p.budget.alertThreshold ?? 80;
  const projPct = p.projected != null && denom > 0 ? (p.projected / denom) * 100 : p.pct;
  if (p.pct >= 100 || projPct >= 110) return "over";
  if (p.pct >= threshold || projPct >= 100) return "warn";
  return "good";
}
