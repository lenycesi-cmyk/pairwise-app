const CACHE_KEY_PREFIX = "pairwise_fx_rate_";
const CACHE_DURATION = 1000 * 60 * 60 * 6; // 6h

// Taux de secours approximatifs (base EUR), utilisés UNIQUEMENT si l'API échoue
const FALLBACK_RATES_EUR_BASE = {
  EUR: 1,
  USD: 1.08,
  VND: 27500,
  GBP: 0.84,
  JPY: 163,
  THB: 38.5,
  CHF: 0.94,
};

function buildFallbackRate(fromCurrency, toCurrency) {
  const eurToFrom = FALLBACK_RATES_EUR_BASE[fromCurrency] || 1;
  const eurToTarget = FALLBACK_RATES_EUR_BASE[toCurrency] || 1;
  // Combien de `toCurrency` pour 1 `fromCurrency`
  return eurToTarget / eurToFrom;
}

/**
 * Récupère le taux de change actuel entre deux devises, avec cache court (6h)
 * pour éviter de spammer l'API si plusieurs transactions sont créées d'affilée.
 * Retourne { rate, isFallback } — rate = combien de toCurrency pour 1 fromCurrency.
 */
export async function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return { rate: 1, isFallback: false };
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${fromCurrency}_${toCurrency}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return { rate: parsed.rate, isFallback: false };
      }
    }
  } catch (e) {
    // cache illisible, on continue vers l'API
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
    if (!res.ok) throw new Error("fx_fetch_failed");
    const json = await res.json();
    if (json.result !== "success" || !json.rates || !json.rates[toCurrency]) {
      throw new Error("fx_invalid_response");
    }
    const rate = json.rates[toCurrency];

    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ rate, timestamp: Date.now() })
      );
    } catch (e) {
      // localStorage plein ou indisponible, pas bloquant
    }

    return { rate, isFallback: false };
  } catch (err) {
    console.warn(
      `Taux de change indisponible pour ${fromCurrency}->${toCurrency}, utilisation du taux de secours.`
    );
    return { rate: buildFallbackRate(fromCurrency, toCurrency), isFallback: true };
  }
}
