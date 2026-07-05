// Tags (hashtags) sur les transactions — permettent d'étiqueter une dépense
// (ex. #inutile, #imprévu) transversalement aux catégories, puis d'obtenir un
// report par tag sur une période. Stockés en tableau `tags: []` sur la
// transaction, sous forme normalisée (minuscules, sans #, espaces → tirets).

// Normalise un tag saisi : retire le(s) #, trim, minuscules, remplace les
// espaces par des tirets, supprime les caractères parasites. Renvoie "" si
// rien d'exploitable (à filtrer par l'appelant).
export function normalizeTag(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/^#+/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 30);
}

// Extrait les #hashtags présents dans un texte libre (ex. une description
// "Resto sushi #inutile #yolo") sous forme normalisée.
export function extractTagsFromText(text) {
  if (!text) return [];
  const matches = String(text).match(/#[\p{L}\p{N}_-]+/gu) || [];
  return dedupeTags(matches.map(normalizeTag).filter(Boolean));
}

// Fusionne / dédoublonne une liste de tags en conservant l'ordre.
export function dedupeTags(tags) {
  const seen = new Set();
  const out = [];
  for (const raw of tags || []) {
    const t = normalizeTag(raw);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

// Couleur d'affichage stable d'un tag (hash → palette du thème), pour que le
// même tag garde toujours la même teinte dans les chips et le report.
const TAG_COLORS = ["tang", "sage", "lavi", "sky", "amber", "mint", "blush"];
export function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 997;
  return TAG_COLORS[h % TAG_COLORS.length];
}

// Recense tous les tags déjà utilisés dans l'historique, triés par fréquence
// décroissante — sert de suggestions "récemment utilisés".
export function usedTags(transactions) {
  const counts = new Map();
  for (const tx of transactions || []) {
    for (const t of tx.tags || []) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
