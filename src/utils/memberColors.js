// Palette de couleurs proposées pour personnaliser son icône
export const AVATAR_COLOR_PALETTE = [
  { key: "sky", text: "var(--sky)", bg: "var(--sky-light)" },
  { key: "blush", text: "var(--blush)", bg: "var(--blush-light)" },
  { key: "sage", text: "var(--sage)", bg: "var(--sage-light)" },
  { key: "lavi", text: "var(--lavi)", bg: "var(--lavi-light)" },
  { key: "amber", text: "var(--amber)", bg: "var(--amber-light)" },
  { key: "tang", text: "var(--tang)", bg: "var(--tang-light)" },
  { key: "mint", text: "var(--mint)", bg: "var(--mint-light)" },
];

const DEFAULT_ORDER = ["sky", "blush", "sage", "lavi", "amber", "tang", "mint"];

function colorByKey(key) {
  return AVATAR_COLOR_PALETTE.find((c) => c.key === key);
}

/**
 * Retourne une fonction qui mappe un uid de membre vers une couleur.
 * Utilise la couleur personnalisée du membre (m.avatarColor) si définie,
 * sinon assigne une couleur par défaut selon sa position, en garantissant
 * que deux membres n'ont jamais la même couleur par défaut.
 */
export function buildMemberColorMap(members) {
  const map = {};
  let fallbackIndex = 0;
  members.forEach((m) => {
    if (m.avatarColor) {
      map[m.uid] = colorByKey(m.avatarColor) || colorByKey(DEFAULT_ORDER[0]);
    } else {
      map[m.uid] = colorByKey(DEFAULT_ORDER[fallbackIndex % DEFAULT_ORDER.length]);
      fallbackIndex++;
    }
  });
  return map;
}

export function getInitial(name) {
  return name?.[0]?.toUpperCase() || "?";
}
