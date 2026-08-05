const CACHE_KEY_PREFIX = "pairwise_fx_rate_";
const CACHE_DURATION = 1000 * 60 * 60 * 6; // 6h

// Taux de secours approximatifs (base EUR), utilisés UNIQUEMENT si l'API échoue.
// Exporté pour que les outils hors navigateur (scripts/) convertissent avec la
// MÊME table plutôt que d'en recopier une troisième — cf. fxFallback.test.js,
// qui vérifie que les copies existantes ne divergent pas.
export const FALLBACK_RATES_EUR_BASE = {
  EUR: 1,
  USD: 1.08,
  VND: 27500,
  GBP: 0.84,
  JPY: 163,
  THB: 38.5,
  CHF: 0.94,
};

// Renvoie `null` si l'une des deux devises n'est PAS dans la table.
//
// Auparavant les codes absents valaient 1, ce qui produisait silencieusement un
// taux de 1 : 500 MXN devenaient 500 € au lieu d'environ 25 €. Or la conversion
// est FIGÉE à l'écriture de la transaction — ce chiffre faux ne se corrigeait
// jamais. Le catalogue compte désormais 161 devises pour 7 taux de repli, donc
// ce cas serait devenu la règle plutôt que l'exception. Mieux vaut refuser de
// convertir : l'appelant omet alors la conversion figée, et l'affichage
// reconvertit à la lecture (ce qui se corrige tout seul au rechargement).
function buildFallbackRate(fromCurrency, toCurrency) {
  const eurToFrom = FALLBACK_RATES_EUR_BASE[fromCurrency];
  const eurToTarget = FALLBACK_RATES_EUR_BASE[toCurrency];
  if (!eurToFrom || !eurToTarget) return null;
  // Combien de `toCurrency` pour 1 `fromCurrency`
  return eurToTarget / eurToFrom;
}

/**
 * Récupère le taux de change actuel entre deux devises, avec cache court (6h)
 * pour éviter de spammer l'API si plusieurs transactions sont créées d'affilée.
 *
 * Retourne { rate, isFallback } — rate = combien de toCurrency pour 1 fromCurrency.
 *
 * `rate` vaut **null** quand aucun taux n'a pu être obtenu : ni l'API, ni le
 * cache, ni la table de repli (qui ne couvre qu'une poignée de devises). Les
 * appelants DOIVENT tester ce cas et s'abstenir d'écrire une conversion plutôt
 * que d'en fabriquer une — un montant converti est figé pour toujours dans la
 * transaction.
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
    const fallback = buildFallbackRate(fromCurrency, toCurrency);
    if (fallback === null) {
      console.warn(
        `Taux de change indisponible pour ${fromCurrency}->${toCurrency} et absent de la table de repli : aucune conversion.`
      );
      return { rate: null, isFallback: true };
    }
    console.warn(
      `Taux de change indisponible pour ${fromCurrency}->${toCurrency}, utilisation du taux de secours.`
    );
    return { rate: fallback, isFallback: true };
  }
}
