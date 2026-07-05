// Thèmes PairWise dérivés du kit de marque (v0) : palette Cream/Ink/Coral/
// Ocean/Amber/Mint/Pink, déclinée en clair et sombre. Les variables CSS
// correspondantes vivent dans src/index.css (blocs [data-theme="..."]).
export const THEMES = [
  { key: "pairwise", name: "PairWise", bg: "#fdf4ec", accent: "#f56346", dark: false },
  { key: "pairwise-dark", name: "PairWise Nuit", bg: "#0a1520", accent: "#ff7458", dark: true },
];

export function applyTheme(themeKey) {
  document.documentElement.setAttribute("data-theme", themeKey || "pairwise");
}
