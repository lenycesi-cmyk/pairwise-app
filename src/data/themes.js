// Thèmes PairWise dérivés du kit de marque (v0) : palette Cream/Ink/Coral/
// Ocean/Amber/Mint/Pink, déclinée en clair et sombre. Les variables CSS
// correspondantes vivent dans src/index.css (blocs [data-theme="..."]).
export const THEMES = [
  { key: "pairwise", name: "PairWise", bg: "#fdf4ec", accent: "#f56346", dark: false },
  { key: "pairwise-dark", name: "PairWise Nuit", bg: "#0a1520", accent: "#ff7458", dark: true },
];

let themeFadeTimer = null;

export function applyTheme(themeKey) {
  const root = document.documentElement;
  const previous = root.getAttribute("data-theme");
  const next = themeKey || "pairwise";

  // Cross-fade uniquement sur un vrai changement (pas au tout premier rendu) :
  // on pose une classe transitoire qui anime fond/bordure/texte, retirée une
  // fois le fondu terminé pour ne pas ralentir les autres interactions.
  if (previous && previous !== next) {
    root.classList.add("pw-theme-fade");
    clearTimeout(themeFadeTimer);
    themeFadeTimer = setTimeout(() => root.classList.remove("pw-theme-fade"), 450);
  }

  root.setAttribute("data-theme", next);
}
