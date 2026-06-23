// Palette de couleurs distinctes pour les badges d'initiales de membres
const MEMBER_COLORS = [
  { text: "var(--sky)", bg: "var(--sky-light)" },
  { text: "var(--blush)", bg: "var(--blush-light)" },
  { text: "var(--sage)", bg: "var(--sage-light)" },
  { text: "var(--lavi)", bg: "var(--lavi-light)" },
  { text: "var(--amber)", bg: "var(--amber-light)" },
  { text: "var(--tang)", bg: "var(--tang-light)" },
];

/**
 * Retourne une fonction qui mappe un uid de membre vers une couleur stable,
 * garantissant que deux membres avec la même initiale ont des couleurs différentes.
 */
export function buildMemberColorMap(members) {
  const map = {};
  members.forEach((m, i) => {
    map[m.uid] = MEMBER_COLORS[i % MEMBER_COLORS.length];
  });
  return map;
}

export function getInitial(name) {
  return name?.[0]?.toUpperCase() || "?";
}
