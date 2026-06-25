export const THEMES = [
  { key: "classic", name: "Pairwise Classic", bg: "#f5f3ee", accent: "#ff6b35", dark: false },
  { key: "midnight", name: "Midnight", bg: "#121214", accent: "#7c9eff", dark: true },
  { key: "sage-garden", name: "Sage Garden", bg: "#f2f4ed", accent: "#5b8c5a", dark: false },
  { key: "terracotta", name: "Terracotta", bg: "#fbf1e8", accent: "#c1693c", dark: false },
  { key: "ocean-mist", name: "Ocean Mist", bg: "#eef4f7", accent: "#3b7a9e", dark: false },
  { key: "plum-luxe", name: "Plum Luxe", bg: "#f7f1f5", accent: "#7b3f61", dark: false },
  { key: "mono-ink", name: "Mono Ink", bg: "#fafafa", accent: "#1a1a1a", dark: false },
  { key: "sunset-coral", name: "Sunset Coral", bg: "#fff4f0", accent: "#ff5c7a", dark: false },
  { key: "forest-dark", name: "Forest Dark", bg: "#16201a", accent: "#8fbc8f", dark: true },
  { key: "butter-cream", name: "Butter Cream", bg: "#fcf8ef", accent: "#d4a24c", dark: false },
];

export function applyTheme(themeKey) {
  document.documentElement.setAttribute("data-theme", themeKey || "classic");
}
