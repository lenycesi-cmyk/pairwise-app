// Tags suggérés par défaut, regroupés par intention. L'utilisateur peut en
// taper d'autres librement — ceux-ci ne sont que des raccourcis proposés dans
// le sélecteur. `key` = tag normalisé (stocké tel quel) ; `emoji` illustre ;
// `labelKey` pointe vers translations.js pour le libellé lisible.
export const SUGGESTED_TAGS = [
  // Prise de conscience
  { key: "inutile", emoji: "🙈", labelKey: "tag_unnecessary" },
  { key: "impulsif", emoji: "⚡", labelKey: "tag_impulse" },
  { key: "regret", emoji: "😔", labelKey: "tag_regret" },
  // Assumé / positif
  { key: "yolo", emoji: "😎", labelKey: "tag_yolo" },
  { key: "plaisir", emoji: "🎁", labelKey: "tag_treat" },
  // Nécessaire mais subi
  { key: "urgence", emoji: "🚨", labelKey: "tag_emergency" },
  { key: "sante", emoji: "❤️‍🩹", labelKey: "tag_health" },
  // Administratif
  { key: "remboursable", emoji: "↩️", labelKey: "tag_reimbursable" },
  { key: "pro", emoji: "💼", labelKey: "tag_pro" },
  { key: "cadeau", emoji: "🎀", labelKey: "tag_gift" },
  // Projet / événement
  { key: "vacances", emoji: "🏖️", labelKey: "tag_vacation" },
];

export function suggestedTagMeta(key) {
  return SUGGESTED_TAGS.find((t) => t.key === key) || null;
}
