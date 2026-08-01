// Part d'un membre dans une ligne du patrimoine — actif comme crédit.
//
// Les deux côtés du bilan suivent la même règle et doivent la suivre depuis le
// même endroit : si les actifs comptaient un bien partagé à 70/30 pendant que
// les crédits le comptaient à 50/50, le total « Actifs − Passifs » d'un membre
// serait faux sans qu'aucun écran ne signale quoi que ce soit.

/**
 * @param {number} value      valeur de la ligne, en devise d'affichage
 * @param {string} ownership  clé du membre propriétaire, "shared", ou null
 * @param {number} [sharePct] part du PREMIER membre quand c'est partagé (défaut 50)
 * @param {string} memberKey  membre dont on veut la part
 * @param {string} firstMemberKey  clé du premier membre du couple — c'est à lui
 *        que `sharePct` se rapporte ; l'autre reçoit le complément.
 */
export function shareForMember(value, ownership, sharePct, memberKey, firstMemberKey) {
  if (!Number.isFinite(value)) return 0;
  if (ownership === memberKey) return value;
  if (ownership === "shared") {
    // `sharePct` est la part du premier membre. Les crédits ne portent pas ce
    // champ aujourd'hui : à défaut, un bien partagé se partage en deux.
    const pct = memberKey === firstMemberKey ? (sharePct ?? 50) : 100 - (sharePct ?? 50);
    return value * (pct / 100);
  }
  // Ligne appartenant à l'autre membre, ou sans propriétaire renseigné : elle ne
  // pèse pas dans le total de ce membre.
  return 0;
}
