// Auto-categorization "rules" learned from past entries: past transaction
// descriptions are indexed by normalized text, and typing in the Add
// Transaction description field surfaces the closest past descriptions.
// Picking one fills description + category + subcategory in one tap.
// Purely client-side and derived on the fly from the transactions already
// in memory — nothing new is stored on Firestore.

export function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Builds one entry per distinct normalized description, keeping the most
// recent category/subcategory used with it plus a usage count for ranking.
export function buildSuggestionIndex(transactions, type) {
  const index = new Map();
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    if (!tx.description) continue;
    const key = normalizeText(tx.description);
    if (!key) continue;
    const existing = index.get(key);
    const date = new Date(tx.date).getTime() || 0;
    if (!existing) {
      index.set(key, {
        description: tx.description,
        categoryId: tx.categoryId,
        subcategory: tx.subcategory || null,
        count: 1,
        lastDate: date,
      });
    } else {
      existing.count += 1;
      if (date > existing.lastDate) {
        existing.lastDate = date;
        existing.description = tx.description;
        existing.categoryId = tx.categoryId;
        existing.subcategory = tx.subcategory || null;
      }
    }
  }
  return index;
}

// Word-start matching: "petit" matches "petit déj Hong Cafe", and "hong"
// matches it too (any word boundary), so the user doesn't have to remember
// how the description starts.
export function getSuggestions(index, input, limit = 3) {
  const q = normalizeText(input);
  if (q.length < 2) return [];
  const results = [];
  for (const entry of index.values()) {
    const key = normalizeText(entry.description);
    if (key === q) continue; // already fully typed — nothing to suggest
    if (key.startsWith(q) || key.includes(` ${q}`)) results.push(entry);
  }
  return results
    .sort((a, b) => b.count - a.count || b.lastDate - a.lastDate)
    .slice(0, limit);
}

// Exact (normalized) match, used to silently auto-fill the category when
// the user types a known description in full without tapping a suggestion.
export function findExactMatch(index, input) {
  return index.get(normalizeText(input)) || null;
}
