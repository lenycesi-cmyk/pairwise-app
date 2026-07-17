// Réglages d'animation partagés pour tous les graphiques Recharts, afin que le
// tracé des courbes/barres suive la même signature que le reste de l'app
// (décélération douce, durée modérée) plutôt que le défaut Recharts (1500ms).
// À étaler sur chaque <Line>/<Bar>/<Pie> : {...CHART_ANIM}.
export const CHART_ANIM = {
  isAnimationActive: true,
  animationDuration: 800,
  animationEasing: "ease-out",
};

// Le tooltip se déplace/apparaît en fondu court plutôt que d'un coup.
export const TOOLTIP_ANIM = {
  animationDuration: 180,
  animationEasing: "ease-out",
  wrapperStyle: { transition: "opacity .18s ease-out" },
};
