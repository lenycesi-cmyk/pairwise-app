import { findCachedRate, writeTable } from "./fxCache";

// Ancienne clé : une seule paire par entrée (`pairwise_fx_rate_EUR_USD`). Le
// cache est désormais la TABLE entière, partagée avec le chemin d'affichage via
// utils/fxCache. On continue de lire l'ancien format en dernier recours, le
// temps que les caches existants expirent d'eux-mêmes.
const LEGACY_PAIR_KEY_PREFIX = "pairwise_fx_rate_";
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
 *
 * Ordre de repli, du meilleur au pire :
 *   1. table en cache de moins de 6 h        → taux réel, non signalé
 *   2. appel réseau                          → taux réel, non signalé
 *   3. table en cache PÉRIMÉE, quel que soit son âge  ⚠️ signalé
 *   4. ancienne entrée par paire (format hérité)      ⚠️ signalé
 *   5. table gravée en dur (7 devises)                ⚠️ signalé
 *   6. rien                                  → rate: null, aucune conversion
 *
 * Les étapes 3 et 4 sont l'apport principal : un taux réel vieux de trois jours
 * vaut mieux qu'un taux gravé en 2026, et infiniment mieux qu'un refus de
 * convertir. Elles portent `isFallback: true`, ce qui déclenche l'avertissement
 * « taux approximatifs » déjà présent dans l'interface.
 */
export async function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return { rate: 1, isFallback: false };
  }

  const cached = findCachedRate(fromCurrency, toCurrency, CACHE_DURATION);
  if (cached) return { rate: cached.rate, isFallback: false };

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
    if (!res.ok) throw new Error("fx_fetch_failed");
    const json = await res.json();
    if (json.result !== "success" || !json.rates || !json.rates[toCurrency]) {
      throw new Error("fx_invalid_response");
    }

    // On conserve la TABLE ENTIÈRE et non la seule paire demandée : la réponse
    // est déjà payée, et elle couvre tout le catalogue pour le prochain appel,
    // y compris hors connexion.
    writeTable(fromCurrency, json.rates);

    return { rate: json.rates[toCurrency], isFallback: false };
  } catch {
    const stale = findCachedRate(fromCurrency, toCurrency);
    if (stale) {
      console.warn(
        `Taux de change indisponible pour ${fromCurrency}->${toCurrency}, utilisation du dernier taux connu.`
      );
      return { rate: stale.rate, isFallback: true };
    }

    const legacy = readLegacyPairRate(fromCurrency, toCurrency);
    if (legacy !== null) {
      return { rate: legacy, isFallback: true };
    }

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

// Lecture de l'ancien format « une entrée par paire », sans limite d'âge : on
// n'y arrive que hors connexion, où tout taux réel vaut mieux que la table
// gravée. Plus rien ne l'écrit ; ces entrées disparaîtront d'elles-mêmes.
function readLegacyPairRate(fromCurrency, toCurrency) {
  try {
    const raw = localStorage.getItem(
      `${LEGACY_PAIR_KEY_PREFIX}${fromCurrency}_${toCurrency}`
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.rate === "number" && parsed.rate > 0 ? parsed.rate : null;
  } catch {
    return null;
  }
}
