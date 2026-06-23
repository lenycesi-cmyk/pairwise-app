import { useState, useEffect } from "react";

const CACHE_KEY = "pairwise_fx_rates";
const CACHE_DURATION = 1000 * 60 * 60 * 12;

export function useExchangeRates(baseCurrency = "EUR") {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRates() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
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
          `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
        );
        if (!res.ok) throw new Error("fx_fetch_failed");
        const json = await res.json();

        if (!cancelled) {
          setRates(json.rates);
          setLoading(false);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              base: baseCurrency,
              rates: json.rates,
              timestamp: Date.now(),
            })
          );
        }
      } catch (err) {
        if (!cancelled) {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            setRates(parsed.rates);
          } else {
            setError(err.message);
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
