import { useState, useEffect } from "react";

const CACHE_KEY_PREFIX = "pairwise_fx_rates_v3_";
const CACHE_DURATION = 1000 * 60 * 60 * 12;

// Taux de secours approximatifs (base EUR), utilisés UNIQUEMENT si l'API
// et le cache local échouent tous les deux. Mis à jour manuellement de temps en temps.
const FALLBACK_RATES_EUR_BASE = {
  EUR: 1,
  USD: 1.08,
  VND: 27500,
  GBP: 0.84,
  JPY: 163,
  THB: 38.5,
  CHF: 0.94,
};

function buildFallbackRates(baseCurrency) {
  const eurToBase = FALLBACK_RATES_EUR_BASE[baseCurrency] || 1;
  const result = {};
  for (const [code, eurToTarget] of Object.entries(FALLBACK_RATES_EUR_BASE)) {
    // rates[code] doit représenter : combien de `code` pour 1 `baseCurrency`
    result[code] = eurToTarget / eurToBase;
  }
  return result;
}

export function useExchangeRates(baseCurrency = "EUR") {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // On réinitialise immédiatement à chaque changement de devise, pour
    // empêcher tout calcul avec les anciens taux pendant le rechargement.
    setRates(null);
    setLoading(true);
    setError(null);

    async function loadRates() {
      try {
        const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${baseCurrency}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          const age = Date.now() - parsed.timestamp;
          if (age < CACHE_DURATION && parsed.base === baseCurrency) {
            if (!cancelled) {
              setRates(parsed.rates);
              setLoading(false);
            }
            return;
          }
        }

        const res = await fetch(
          `https://open.er-api.com/v6/latest/${baseCurrency}`
        );
        if (!res.ok) throw new Error("fx_fetch_failed");
        const json = await res.json();
        if (json.result !== "success" || !json.rates) {
          throw new Error("fx_invalid_response");
        }

        if (!cancelled) {
          setRates(json.rates);
          setLoading(false);
          localStorage.setItem(
            `${CACHE_KEY_PREFIX}${baseCurrency}`,
            JSON.stringify({
              base: baseCurrency,
              rates: json.rates,
              timestamp: Date.now(),
            })
          );
        }
      } catch (err) {
        if (!cancelled) {
          const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${baseCurrency}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            setRates(parsed.rates);
          } else {
            // Dernier recours : taux approximatifs hardcodés, pour ne jamais
            // afficher un montant non converti comme s'il l'était.
            console.warn("FX API indisponible, utilisation des taux de secours.");
            setRates(buildFallbackRates(baseCurrency));
            setError("using_fallback_rates");
          }
          setLoading(false);
        }
      }
    }

    loadRates();
    return () => {
      cancelled = true;
    };
  }, [baseCurrency]);

  function convert(amount, fromCurrency, toCurrency = baseCurrency) {
    if (!rates) return amount;
    if (fromCurrency === toCurrency) return amount;

    if (fromCurrency === baseCurrency) {
      return amount * (rates[toCurrency] || 1);
    }
    if (toCurrency === baseCurrency) {
      return amount / (rates[fromCurrency] || 1);
    }
    const inBase = amount / (rates[fromCurrency] || 1);
    return inBase * (rates[toCurrency] || 1);
  }

  return { rates, loading, error, convert };
}
