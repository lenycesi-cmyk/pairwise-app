import { useState, useEffect } from "react";
import { findCachedTable, writeTable } from "../utils/fxCache";

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
        // `findCachedTable` accepte de REBASER une table d'une autre devise :
        // une table EUR déjà téléchargée sert un affichage en USD sans nouvel
        // appel. Le cache est partagé avec la conversion figée à l'écriture.
        const cached = findCachedTable(baseCurrency, CACHE_DURATION);
        if (cached) {
          if (!cancelled) {
            setRates(cached.rates);
            setLoading(false);
          }
          return;
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
          writeTable(baseCurrency, json.rates);
        }
      } catch (err) {
        if (!cancelled) {
          // Table périmée, quel que soit son âge : un taux réel d'avant-hier
          // reste bien meilleur que la table gravée à 7 devises. On le signale
          // comme approximatif, ce que l'ancien code ne faisait pas — l'écran
          // affichait des taux vieux de plusieurs jours sans le moindre
          // avertissement.
          const stale = findCachedTable(baseCurrency);
          if (stale) {
            setRates(stale.rates);
            setError("using_fallback_rates");
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
