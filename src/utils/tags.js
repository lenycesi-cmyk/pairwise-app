// Tags (hashtags) sur les transactions — permettent d'étiqueter une dépense
// (ex. #inutile, #imprévu) transversalement aux catégories, puis d'obtenir un
// report par tag sur une période. Stockés en tableau `tags: []` sur la
// transaction, sous forme normalisée (minuscules, sans #, espaces → tirets).

// Emoji éventuel en tête d'un tag : pictogramme + ses sélecteurs de variante /
// modificateurs de teinte / séquences ZWJ (ex. ❤️‍🩹, 👍🏽). Réutilisé pour
// normaliser (le préserver) et pour l'affichage (le détacher du libellé).
const LEADING_EMOJI = /^(\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic}️?)*)/u;

// Normalise un tag saisi : retire le(s) #, trim, minuscules, remplace les
// espaces par des tirets, supprime les caractères parasites. Un emoji en tête
// est conservé (comme les tags préréglés) puis suivi du libellé normalisé.
// Renvoie "" si rien d'exploitable (à filtrer par l'appelant).
export function normalizeTag(raw) {
  if (!raw) return "";
  let s = String(raw).replace(/^#+/, "").trim();
  const m = s.match(LEADING_EMOJI);
  let emoji = "";
  if (m) {
    emoji = m[1];
    s = s.slice(m[0].length).trim();
  }
  const text = s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return emoji + text;
}

// Sépare un tag stocké en { emoji, text } — emoji "" si le tag n'en a pas.
// Utilisé par TagChip pour afficher l'emoji comme les tags préréglés.
export function splitTag(tag) {
  const raw = String(tag || "");
  const m = raw.match(LEADING_EMOJI);
  if (m) return { emoji: m[1], text: raw.slice(m[0].length) };
  return { emoji: "", text: raw };
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
