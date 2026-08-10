// Cache PARTAGÉ des tables de taux de change.
//
// `open.er-api.com/v6/latest/{base}` renvoie les ~161 taux d'un coup. Les deux
// implémentations de change (conversion figée à l'écriture, conversion à
// l'affichage) appelaient chacune ce point d'entrée puis en jetaient la quasi-
// totalité : celle de l'écriture ne gardait qu'UNE paire (`EUR_USD`). Résultat,
// hors connexion, une devise pourtant téléchargée la veille était traitée comme
// inconnue et la transaction s'écrivait sans conversion.
//
// Ce module garde la table entière, sous une clé unique partagée par les deux
// chemins. Trois conséquences :
//
//   1. Toute paire du catalogue reste convertible hors connexion dès qu'on a
//      été en ligne une fois avec cette devise de base.
//   2. Une table de base EUR sert aussi à convertir MXN→THB (taux croisé) et
//      peut être rebasée vers une autre devise — un seul téléchargement couvre
//      donc tous les usages.
//   3. La table gravée en dur à 7 devises redevient ce qu'elle aurait toujours
//      dû être : le recours d'une installation qui n'a jamais vu le réseau.
//
// La FRAÎCHEUR n'est pas une propriété du cache mais une politique de lecture :
// le chemin d'affichage tolère 12 h, celui de l'écriture 6 h, et tous deux
// acceptent une table périmée en dernier recours — un vrai taux d'avant-hier
// valant infiniment mieux qu'un taux inventé. Les appelants passent donc leur
// propre `maxAgeMs`.

// Clé historique de useExchangeRates, reprise telle quelle : les caches déjà
// présents chez les utilisateurs restent lisibles, personne ne retélécharge.
export const FX_TABLE_KEY_PREFIX = "pairwise_fx_rates_v3_";

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// ── Fonctions PURES (testables sans navigateur) ────────────────────────────

/**
 * Taux croisé depuis une table de base quelconque.
 * `table.rates[X]` = combien de X pour 1 `table.base`.
 * Retourne combien de `to` pour 1 `from`, ou null si l'une des deux manque.
 */
export function crossRate(table, from, to) {
  if (from === to) return 1;
  if (!table?.rates) return null;
  const perFrom = from === table.base ? 1 : table.rates[from];
  const perTo = to === table.base ? 1 : table.rates[to];
  if (!perFrom || !perTo) return null;
  return perTo / perFrom;
}

/**
 * Réexprime une table dans une autre devise de base. Permet de servir un
 * affichage en USD à partir de la table EUR déjà téléchargée.
 * Retourne null si la nouvelle base est absente de la table.
 */
export function rebaseTable(table, base) {
  if (!table?.rates) return null;
  if (table.base === base) return table;
  const perBase = table.rates[base];
  if (!perBase) return null;
  const rates = {};
  for (const [code, perUnit] of Object.entries(table.rates)) {
    rates[code] = perUnit / perBase;
  }
  // L'ancienne base n'était pas forcément listée dans ses propres taux.
  rates[table.base] = 1 / perBase;
  return { base, rates, timestamp: table.timestamp };
}

// ── Accès au stockage ──────────────────────────────────────────────────────

export function writeTable(base, rates) {
  try {
    localStorage.setItem(
      `${FX_TABLE_KEY_PREFIX}${base}`,
      JSON.stringify({ base, rates, timestamp: Date.now() })
    );
  } catch {
    // Stockage plein ou indisponible : jamais bloquant, on perd juste le cache.
  }
}

function parseTable(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.rates || !parsed.base) return null;
    return { base: parsed.base, rates: parsed.rates, timestamp: parsed.timestamp || 0 };
  } catch {
    return null;
  }
}

// Toutes les tables en cache, la plus fraîche d'abord.
function allTables() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(FX_TABLE_KEY_PREFIX)) continue;
      const table = parseTable(safeGet(key));
      if (table) out.push(table);
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.timestamp - a.timestamp);
}

function fresh(table, maxAgeMs) {
  if (!table) return false;
  if (maxAgeMs == null) return true;
  return Date.now() - table.timestamp <= maxAgeMs;
}

/**
 * Cherche un taux `from`→`to` dans TOUTES les tables en cache, la plus fraîche
 * d'abord. `maxAgeMs` omis ⇒ on accepte n'importe quel âge (dernier recours).
 * Retourne { rate, timestamp } ou null.
 */
export function findCachedRate(from, to, maxAgeMs) {
  for (const table of allTables()) {
    if (!fresh(table, maxAgeMs)) continue;
    const rate = crossRate(table, from, to);
    if (rate != null) return { rate, timestamp: table.timestamp };
  }
  return null;
}

/**
 * Table complète exprimée dans `base`, en rebasant une table d'une autre devise
 * si besoin. Retourne { base, rates, timestamp } ou null.
 */
export function findCachedTable(base, maxAgeMs) {
  for (const table of allTables()) {
    if (!fresh(table, maxAgeMs)) continue;
    const rebased = rebaseTable(table, base);
    if (rebased) return rebased;
  }
  return null;
}
