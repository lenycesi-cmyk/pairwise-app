const PRICE_CACHE_PREFIX = "pairwise_asset_price_";
const PRICE_CACHE_DURATION = 1000 * 60 * 30; // 30 min

/**
 * Récupère le prix actuel d'une cryptomonnaie via CoinGecko (gratuit, sans clé API).
 * @param {string} coinId - ID CoinGecko (ex: "bitcoin", "ethereum")
 * @param {string} vsCurrency - devise cible (ex: "eur", "usd")
 */
export async function getCryptoPrice(coinId, vsCurrency = "eur") {
  const cacheKey = `${PRICE_CACHE_PREFIX}crypto_${coinId}_${vsCurrency}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < PRICE_CACHE_DURATION) {
        return { price: parsed.price, success: true };
      }
    }
  } catch (e) {
    // cache illisible, on continue
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}`
    );
    if (!res.ok) throw new Error("crypto_fetch_failed");
    const json = await res.json();
    const price = json[coinId]?.[vsCurrency];
    if (price === undefined) throw new Error("crypto_price_not_found");

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ price, timestamp: Date.now() }));
    } catch (e) {
      // pas bloquant
    }

    return { price, success: true };
  } catch (err) {
    console.warn(`Impossible de récupérer le prix de ${coinId}:`, err.message);
    return { price: null, success: false };
  }
}

/**
 * Récupère le prix actuel d'une action/ETF via Twelve Data (gratuit, clé API requise
 * pour un usage régulier, mais fonctionne en mode démo limité sans clé pour test).
 * NOTE : sans clé API personnelle, le quota est très limité (8 req/min, 800/jour).
 * L'utilisateur peut ajouter sa propre clé gratuite dans les Réglages pour plus de fiabilité.
 */
export async function getStockPrice(symbol, apiKey = "") {
  const cacheKey = `${PRICE_CACHE_PREFIX}stock_${symbol}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < PRICE_CACHE_DURATION) {
        return { price: parsed.price, success: true };
      }
    }
  } catch (e) {
    // cache illisible
  }

  try {
    const keyParam = apiKey ? `&apikey=${apiKey}` : "&apikey=demo";
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${symbol}${keyParam}`
    );
    if (!res.ok) throw new Error("stock_fetch_failed");
    const json = await res.json();
    const price = parseFloat(json.price);
    if (isNaN(price)) throw new Error("stock_price_invalid");

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ price, timestamp: Date.now() }));
    } catch (e) {
      // pas bloquant
    }

    return { price, success: true };
  } catch (err) {
    console.warn(`Impossible de récupérer le prix de ${symbol}:`, err.message);
    return { price: null, success: false };
  }
}

/**
 * Récupère le prix historique d'une cryptomonnaie à une date donnée (pour le calculateur).
 * @param {string} coinId
 * @param {Date} date
 * @param {string} vsCurrency
 */
export async function getCryptoPriceAtDate(coinId, date, vsCurrency = "eur") {
  const dateStr = `${String(date.getDate()).padStart(2, "0")}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${date.getFullYear()}`;

  const cacheKey = `${PRICE_CACHE_PREFIX}crypto_hist_${coinId}_${dateStr}_${vsCurrency}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return { price: JSON.parse(cached).price, success: true };
    }
  } catch (e) {}

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${dateStr}`
    );
    if (!res.ok) throw new Error("crypto_hist_fetch_failed");
    const json = await res.json();
    const price = json.market_data?.current_price?.[vsCurrency];
    if (price === undefined) throw new Error("crypto_hist_price_not_found");

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ price }));
    } catch (e) {}

    return { price, success: true };
  } catch (err) {
    console.warn(`Prix historique indisponible pour ${coinId} à ${dateStr}:`, err.message);
    return { price: null, success: false };
  }
}
