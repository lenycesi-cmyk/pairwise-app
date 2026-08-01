// Remplit `couples/{id}/netWorthSnapshots` avec un historique SYNTHÉTIQUE, pour
// voir les widgets d'évolution avant d'avoir attendu deux vrais mois.
//
// ⚠️  CES DONNÉES SONT INVENTÉES. Les instantanés écrits par la fonction
// planifiée sont exacts ; ceux-ci ne le sont pas. Ils portent donc
// `source: "seed"`, ce qui permet de les retrouver et de les supprimer d'un
// coup — voir `--purge` plus bas. À ne jamais lancer sur des données dont on
// tient à l'exactitude historique.
//
// Ce que fait le script : il part de la répartition ACTUELLE du patrimoine
// (`assets` sur le document du couple), puis remonte le temps en appliquant une
// dérive mensuelle par type. Les montants sont donc plausibles et cohérents
// entre eux — le total est toujours la somme de ses lignes — sans prétendre
// refléter ce qui s'est réellement passé.
//
//   node scripts/seed-networth-snapshots.js            # 6 mois d'historique
//   node scripts/seed-networth-snapshots.js --months=12
//   node scripts/seed-networth-snapshots.js --purge    # supprime les seeds
//
// Authentification : même clé de compte de service que scripts/deploy.js
// (GOOGLE_APPLICATION_CREDENTIALS).

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildSnapshotEntries, sumEntriesByType } from "../src/utils/assetValuation.js";
import { ASSET_TYPES } from "../src/data/assetTypes.js";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const PROJECT_ID = "pairwise-12df2";
const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "C:\\Users\\Chenipe\\Documents\\Projet Pairwise\\Keys\\pairwise-12df2-97a5d677db9b.json";

const args = process.argv.slice(2);
const PURGE = args.includes("--purge");
const MONTHS = Number(args.find((a) => a.startsWith("--months="))?.split("=")[1]) || 6;

// Dérive mensuelle indicative par type : la crypto bouge beaucoup, l'immobilier
// presque pas, un prêt se rembourse. Purement décoratif — c'est ce qui rend
// l'historique inventé lisible plutôt que plat.
const MONTHLY_DRIFT = {
  crypto: 0.09,
  stocks: 0.025,
  bonds: 0.004,
  life_insurance: 0.006,
  retirement: 0.008,
  account: 0.012,
  cash: 0,
  real_estate: 0.002,
  vehicle: -0.01,
  other_assets: 0,
  debt: -0.02,
};

function seededRandom(seed) {
  // Générateur déterministe : relancer le script deux fois produit le même
  // historique, au lieu d'un nouveau jeu de chiffres à chaque exécution.
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function monthEndDates(count) {
  const dates = [];
  const now = new Date();
  for (let i = count; i >= 1; i--) {
    // Dernier jour du mois, i mois en arrière.
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0));
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(readFileSync(KEY_PATH, "utf8"))),
    projectId: PROJECT_ID,
  });
  const db = admin.firestore();

  const couples = await db.collection("couples").get();
  const liabilityIds = new Set(ASSET_TYPES.filter((t) => t.isLiability).map((t) => t.id));

  for (const coupleDoc of couples.docs) {
    const data = coupleDoc.data();
    const col = coupleDoc.ref.collection("netWorthSnapshots");

    if (PURGE) {
      // On ne supprime QUE les instantanés synthétiques : ceux écrits par la
      // fonction planifiée sont de vraies mesures et doivent survivre.
      const seeds = await col.where("source", "==", "seed").get();
      for (const d of seeds.docs) await d.ref.delete();
      console.log(`${coupleDoc.id} : ${seeds.size} instantané(s) synthétique(s) supprimé(s).`);
      continue;
    }

    const assets = data.assets || [];
    if (assets.length === 0) {
      console.log(`${coupleDoc.id} : aucun actif, ignoré.`);
      continue;
    }

    const currency = data.wealthDisplayCurrency || data.defaultCurrency || "EUR";
    // Pas de conversion ici : on part des valeurs telles qu'elles sont stockées.
    // L'historique est inventé de toute façon ; y mêler de vrais taux donnerait
    // une fausse impression d'exactitude.
    const identity = (amount) => (Number.isFinite(amount) ? amount : 0);
    const ctx = { livePrices: {}, convert: identity, displayCurrency: currency };
    const today = buildSnapshotEntries(assets, ctx);

    const dates = monthEndDates(MONTHS);
    const rand = seededRandom(coupleDoc.id.split("").reduce((s, c) => s + c.charCodeAt(0), 7));

    for (let i = 0; i < dates.length; i++) {
      // `back` = nombre de mois avant aujourd'hui. On remonte la dérive : un
      // actif qui a monté de 9 %/mois valait donc moins avant.
      const back = dates.length - i;
      const entries = today.map((entry) => {
        const drift = MONTHLY_DRIFT[entry.typeId] ?? 0.005;
        // Bruit ±30 % de la dérive, pour que la courbe ne soit pas une droite.
        const noise = 1 + (rand() - 0.5) * 0.6 * Math.abs(drift || 0.01);
        const factor = Math.pow(1 + drift, -back) * noise;
        return { ...entry, value: Math.round(entry.value * factor * 100) / 100 };
      });

      const byType = sumEntriesByType(entries);
      let totalAssets = 0;
      let totalLiabilities = 0;
      for (const [typeId, sum] of Object.entries(byType)) {
        if (liabilityIds.has(typeId)) totalLiabilities += Math.abs(sum);
        else totalAssets += sum;
      }

      await col.doc(dates[i]).set({
        date: dates[i],
        currency,
        value: totalAssets - totalLiabilities,
        totalAssets,
        totalLiabilities,
        byType,
        entries,
        // Le marqueur qui rend ces données révocables d'un seul `--purge`.
        source: "seed",
        recordedAt: Date.now(),
      });
    }
    console.log(`${coupleDoc.id} : ${dates.length} instantané(s) synthétique(s) écrits (${dates[0]} → ${dates.at(-1)}).`);
  }

  console.log(
    PURGE
      ? "\nPurge terminée."
      : `\n⚠️  Historique INVENTÉ. Relancer avec --purge pour tout retirer.`
  );
}

main().catch((err) => {
  console.error("\n❌ Erreur :", err.message);
  process.exit(1);
});
