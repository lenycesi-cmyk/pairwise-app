// Enregistrement quotidien du patrimoine, à heure fixe et côté serveur.
//
// Pourquoi côté serveur : `recordNetWorthSnapshot` (navigateur) n'écrit que
// lorsque l'utilisateur ouvre l'onglet Patrimoine. Un foyer qui le consulte deux
// fois par mois a deux points par mois, et un tableau d'évolution « mensuel »
// affiche alors la valeur du dernier jour de connexion, pas celle du 31. Cette
// fonction comble les trous sans rien demander à personne.
//
// Le principe de coût : on collecte l'union des symboles de TOUS les couples, on
// cote chaque symbole UNE FOIS, puis on ventile. Bitcoin coûte un appel, qu'un
// couple ou mille en détiennent — le coût suit le nombre de valeurs suivies, pas
// le nombre d'utilisateurs.
//
// La valorisation elle-même n'est pas réimplémentée ici : elle vient de
// `shared/assetValuation.mjs`, le module que l'onglet Patrimoine utilise aussi.
// Deux implémentations finiraient par se contredire, et l'écart s'écrirait dans
// un historique que rien ne recalcule.

const fetch = require("node-fetch");

// CoinGecko accepte plusieurs ids par requête ; 100 est confortable sans risquer
// une URL trop longue.
const COINGECKO_BATCH = 100;
// Twelve Data (palier gratuit) plafonne à 8 requêtes par minute. On respecte la
// cadence plutôt que de se faire limiter en cours de route : une salve refusée
// laisserait des actifs sans cours et fausserait l'instantané.
const TWELVE_DATA_PER_MINUTE = 8;
const TWELVE_DATA_PAUSE_MS = 62_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Charge les modules partagés. `functions/` est en CommonJS et les modules du
// front en ESM, d'où l'import dynamique — voir SHARED_MODULES dans
// scripts/deploy-functions.js, qui les dépose dans shared/ à l'empaquetage.
async function loadShared() {
  const [valuation, targets, types, loans, archive] = await Promise.all([
    import("./shared/assetValuation.mjs"),
    import("./shared/priceTargets.mjs"),
    import("./shared/assetTypes.mjs"),
    import("./shared/loanMath.mjs"),
    import("./shared/archive.mjs"),
  ]);
  return {
    ...valuation,
    ...targets,
    ASSET_TYPES: types.ASSET_TYPES,
    loanState: loans.loanState,
    activeItems: archive.activeItems,
  };
}

// ── Cours ───────────────────────────────────────────────────────────────────

async function fetchCryptoPrices(ids, vsCurrency, chunk) {
  const prices = {};
  for (const batch of chunk(ids, COINGECKO_BATCH)) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${batch.join(",")}&vs_currencies=${vsCurrency}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`coingecko_${res.status}`);
      const json = await res.json();
      for (const id of batch) {
        const p = json?.[id]?.[vsCurrency];
        // Un cours nul ou absent n'est PAS enregistré : l'actif retombera sur son
        // prix manuel ou sa valeur stockée, ce qui vaut mieux qu'un zéro affirmé.
        if (Number.isFinite(p) && p > 0) prices[id] = p;
      }
    } catch (err) {
      console.error(`Cours crypto indisponibles pour ${batch.length} id(s) :`, err.message);
    }
  }
  return prices;
}

async function fetchStockPrices(symbols, apiKey) {
  const prices = {};
  if (!apiKey) {
    // La clé « demo » ne cote qu'AAPL : sans vraie clé, mieux vaut ne rien coter
    // que d'écrire un instantané où tous les titres valent leur prix manuel sans
    // qu'on sache pourquoi.
    if (symbols.length > 0) console.warn("TWELVE_DATA_KEY absente : titres non cotés.");
    return prices;
  }
  for (let i = 0; i < symbols.length; i++) {
    if (i > 0 && i % TWELVE_DATA_PER_MINUTE === 0) await sleep(TWELVE_DATA_PAUSE_MS);
    const symbol = symbols[i];
    try {
      const res = await fetch(`https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${apiKey}`);
      if (!res.ok) throw new Error(`twelvedata_${res.status}`);
      const json = await res.json();
      const price = parseFloat(json?.close);
      if (Number.isFinite(price) && price > 0) prices[symbol] = price;
    } catch (err) {
      console.error(`Cours indisponible pour ${symbol} :`, err.message);
    }
  }
  return prices;
}

async function fetchRates(base) {
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!res.ok) throw new Error(`fx_${res.status}`);
  const json = await res.json();
  if (!json?.rates || !Number.isFinite(json.rates[base])) throw new Error("fx_payload_invalid");
  return json.rates;
}

// ── Écriture ────────────────────────────────────────────────────────────────

/**
 * Instantané d'un couple. Renvoie `null` quand rien d'exploitable n'est
 * calculable — on préfère un trou dans l'historique à une valeur fabriquée.
 */
function buildCoupleSnapshot(data, shared, { rates, cryptoPrices, stockPrices, rateBase }) {
  const { buildSnapshotEntries, sumEntriesByType, makeConverter, ASSET_TYPES, loanState, activeItems } = shared;
  // Les actifs ARCHIVÉS (vendus / clôturés) sortent ici, avec la même règle
  // qu'au navigateur — le module vient du même fichier. Sans ce filtre, un actif
  // vendu resterait coté chaque nuit et continuerait de peser dans l'instantané
  // du lendemain, ce qu'aucun rechargement ne corrigerait : un instantané est
  // figé pour toujours.
  const assets = activeItems(data.assets);
  if (assets.length === 0) return null;

  // Devise de l'instantané : celle du patrimoine si elle est réglée, sinon la
  // devise par défaut du couple. C'est la même règle que l'écran.
  const currency = data.wealthDisplayCurrency || data.defaultCurrency || rateBase;
  const convert = makeConverter(rates, rateBase);

  // Les cours arrivent dans la devise de base ; on les ramène dans celle de
  // l'instantané, et on les indexe par id d'actif comme l'attend valueOfAsset.
  const livePrices = {};
  for (const asset of assets) {
    if (!asset?.apiId) continue;
    const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
    if (!type?.hasApiPrice) continue;
    const unit =
      type.priceSource === "crypto"
        ? cryptoPrices[String(asset.apiId).toLowerCase()]
        : stockPrices[String(asset.apiId).toUpperCase()];
    if (!(unit > 0)) continue;
    // Les cryptos sont cotées dans la devise demandée à l'API, les titres en USD.
    const from = type.priceSource === "crypto" ? rateBase : "USD";
    const converted = convert(unit * (asset.quantity || 1), from, currency);
    if (Number.isFinite(converted) && converted > 0) livePrices[asset.id] = converted;
  }

  const entries = buildSnapshotEntries(assets, { livePrices, convert, displayCurrency: currency });
  // Une conversion impossible (devise absente de la table) remonte en NaN et sort
  // par valueOfAsset avec un 0. Si TOUT est à zéro alors qu'il y a des actifs,
  // c'est le signe d'un problème de taux : on n'écrit rien.
  if (entries.length === 0 || entries.every((e) => e.value === 0)) return null;

  const byType = sumEntriesByType(entries);
  const liabilityIds = new Set(ASSET_TYPES.filter((t) => t.isLiability).map((t) => t.id));
  let totalAssets = 0;
  let totalLiabilities = 0;
  for (const [typeId, sum] of Object.entries(byType)) {
    if (liabilityIds.has(typeId)) totalLiabilities += Math.abs(sum);
    else totalAssets += sum;
  }
  // Capital restant dû des crédits, compté comme passif exactement comme
  // l'onglet Patrimoine. Un prêt ne STOCKE pas son solde : il se recalcule depuis
  // le capital, le taux, la durée et les versements exceptionnels — d'où
  // `loanState`, partagé lui aussi plutôt que réécrit ici.
  for (const loan of data.loans || []) {
    const state = loanState(loan);
    if (state.isPaidOff || !(state.balance > 0)) continue;
    const balance = convert(state.balance, loan?.currency || currency, currency);
    if (Number.isFinite(balance) && balance > 0) totalLiabilities += balance;
  }

  return {
    entries,
    byType,
    totalAssets,
    totalLiabilities,
    value: totalAssets - totalLiabilities,
    currency,
  };
}

/** Handler de la fonction planifiée. Exporté pour rester testable isolément. */
async function runDailySnapshots(db, { today, apiKey, rateBase = "EUR" } = {}) {
  const shared = await loadShared();
  const date = today || new Date().toISOString().slice(0, 10);

  const couplesSnap = await db.collection("couples").get();
  const couples = couplesSnap.docs.filter((d) => shared.activeItems(d.data().assets).length > 0);
  if (couples.length === 0) {
    console.log("Aucun couple avec des actifs — rien à enregistrer.");
    return { written: 0, skipped: 0 };
  }

  // Union des symboles de TOUS les couples : chaque cours n'est demandé qu'une
  // fois, quel que soit le nombre de foyers qui détiennent la valeur.
  // Union des actifs ENCORE DÉTENUS : un actif archivé ne doit pas déclencher
  // une requête de cotation, qui se paie sur le quota de l'API pour rien.
  const allAssets = couples.flatMap((d) => shared.activeItems(d.data().assets));
  const targets = shared.collectPriceTargets(allAssets, shared.ASSET_TYPES);
  console.log(
    `${couples.length} couple(s), ${allAssets.length} actif(s) → ` +
    `${targets.crypto.length} crypto + ${targets.stocks.length} titre(s) à coter.`
  );

  // Les taux d'abord : sans eux, rien n'est convertible et il ne faut RIEN
  // écrire. Un taux inventé dans un instantané est un chiffre faux et définitif,
  // alors qu'une journée manquante se comble d'elle-même le lendemain.
  let rates;
  try {
    rates = await fetchRates(rateBase);
  } catch (err) {
    console.error("Taux de change indisponibles — enregistrement annulé :", err.message);
    return { written: 0, skipped: couples.length, reason: "fx_unavailable" };
  }

  const [cryptoPrices, stockPrices] = [
    await fetchCryptoPrices(targets.crypto, rateBase.toLowerCase(), shared.chunk),
    await fetchStockPrices(targets.stocks, apiKey),
  ];

  let written = 0;
  let skipped = 0;
  for (const coupleDoc of couples) {
    try {
      const snap = buildCoupleSnapshot(coupleDoc.data(), shared, {
        rates, cryptoPrices, stockPrices, rateBase,
      });
      if (!snap) { skipped++; continue; }

      // Un document par jour : l'identifiant EST la date, donc une seconde
      // exécution le même jour remplace au lieu de dupliquer.
      await coupleDoc.ref.collection("netWorthSnapshots").doc(date).set({
        date,
        currency: snap.currency,
        value: snap.value,
        totalAssets: snap.totalAssets,
        totalLiabilities: snap.totalLiabilities,
        byType: snap.byType,
        entries: snap.entries,
        source: "scheduled",
        recordedAt: Date.now(),
      });

      // Le résumé reste sur le document du couple : le graphique d'évolution,
      // l'écran Rapports et useInsights le lisent déjà et n'ont pas à changer.
      const history = coupleDoc.data().netWorthHistory || [];
      const merged = [...history.filter((h) => h.date !== date), {
        date, value: snap.value, currency: snap.currency,
      }].sort((a, b) => (a.date < b.date ? -1 : 1));
      await coupleDoc.ref.set({ netWorthHistory: merged }, { merge: true });

      written++;
    } catch (err) {
      console.error(`Instantané impossible pour ${coupleDoc.id} :`, err.message);
      skipped++;
    }
  }

  console.log(`Instantanés du ${date} : ${written} écrit(s), ${skipped} ignoré(s).`);
  return { written, skipped };
}

module.exports = { runDailySnapshots, buildCoupleSnapshot, fetchRates };
