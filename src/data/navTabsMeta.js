// Métadonnées partagées des onglets navigables, pour que la barre du bas
// (BottomTabBar), le sélecteur (NavTabsPicker) et le tiroir restent cohérents.
// `labelKey` est une clé i18n résolue via t() côté composant.
export const NAV_TABS_META = [
  { key: "dashboard", icon: "ti-home", labelKey: "nav_home" },
  { key: "flux", icon: "ti-arrows-exchange", labelKey: "nav_flux" },
  { key: "budget", icon: "ti-wallet", labelKey: "nav_budget" },
  { key: "goals", icon: "ti-target", labelKey: "nav_goals" },
  { key: "wealth", icon: "ti-chart-pie", labelKey: "nav_wealth" },
  { key: "credits", icon: "ti-building-bank", labelKey: "nav_credits" },
  { key: "reports", icon: "ti-chart-bar", labelKey: "nav_reports" },
];

export const NAV_TABS_COUNT = 4;

// Sélection par défaut de la barre du bas (si le membre n'a rien personnalisé).
export const DEFAULT_NAV_TABS = ["dashboard", "wealth", "budget", "reports"];

// Renvoie les 4 clés d'onglets valides pour un membre, en repliant sur la valeur
// par défaut si la config est absente ou corrompue.
export function resolveNavTabs(stored) {
  const valid = (stored || []).filter((k) => NAV_TABS_META.some((m) => m.key === k));
  const unique = [...new Set(valid)];
  if (unique.length === NAV_TABS_COUNT) return unique;
  // Complète avec les défauts manquants pour toujours avoir 4 onglets.
  for (const k of DEFAULT_NAV_TABS) {
    if (unique.length >= NAV_TABS_COUNT) break;
    if (!unique.includes(k)) unique.push(k);
  }
  return unique.slice(0, NAV_TABS_COUNT);
}
