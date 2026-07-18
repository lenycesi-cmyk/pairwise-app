/**
 * Recherche des cryptomonnaies via l'API CoinGecko (gratuite, sans clé).
 * Retourne une liste de { id, symbol, name } correspondant à la requête.
 */
export async function searchCrypto(query) {
  if (!query || query.trim().length < 1) return [];
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
    );
    if (!res.ok) throw new Error("crypto_search_failed");
    const json = await res.json();
    return (json.coins || []).slice(0, 8).map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      thumb: c.thumb,
    }));
  } catch (err) {
    console.warn("Recherche crypto échouée:", err.message);
    return [];
  }
}

/**
 * Recherche des actions/ETF via l'API Twelve Data (clé "demo" en mode limité,
 * fonctionne pour une recherche occasionnelle).
 * Retourne une liste de { symbol, name, exchange }.
 */
export async function searchStocks(query, apiKey = "") {
  if (!query || query.trim().length < 1) return [];
  try {
    const keyParam = apiKey ? `&apikey=${apiKey}` : "&apikey=demo";
    const res = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}${keyParam}`
    );
    if (!res.ok) throw new Error("stock_search_failed");
    const json = await res.json();
    if (!json.data) return [];
    // Un même symbole est souvent listé sur plusieurs places (NYSE + bourses
    // internationales) → doublons identiques à l'écran. On dédoublonne par
    // symbole (première occurrence, généralement la place principale).
    const seen = new Set();
    const deduped = [];
    for (const s of json.data) {
      if (seen.has(s.symbol)) continue;
      seen.add(s.symbol);
      deduped.push({ symbol: s.symbol, name: s.instrument_name, exchange: s.exchange, currency: s.currency });
      if (deduped.length >= 8) break;
    }
    return deduped;
  } catch (err) {
    console.warn("Recherche actions échouée:", err.message);
    return [];
  }
}
