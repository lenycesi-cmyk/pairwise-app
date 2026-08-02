// Remplit `couples/{id}/netWorthSnapshots` avec un historique SYNTHÉTIQUE, pour
// voir les widgets d'évolution avant d'avoir attendu deux vrais mois.
//
// ⚠️  CES DONNÉES SONT INVENTÉES. Les instantanés écrits par la fonction
// planifiée sont exacts ; ceux-ci ne le sont pas. Ils portent donc
// `source: "seed"`, ce qui permet de les retrouver et de les supprimer d'un
// coup — voir `--purge`. À ne jamais lancer sur des données dont on tient à
// l'exactitude historique.
//
// Ce que fait le script : il part de la répartition ACTUELLE du patrimoine
// (`assets` sur le document du couple), puis remonte le temps en appliquant une
// dérive mensuelle par type. Les montants sont plausibles et cohérents entre eux
// — le total est toujours la somme de ses lignes — sans prétendre refléter ce qui
// s'est réellement passé.
//
// Le couple CIBLE est OBLIGATOIRE. La première version parcourait tous les
// couples de la base, par mimétisme avec la fonction planifiée — qui a de bonnes
// raisons de le faire, elle. Pour des données inventées c'est exactement
// l'inverse qu'il faut : elles ont atterri chez de vrais utilisateurs, qui ont vu
// un historique fabriqué dans leur propre patrimoine. D'où cette obligation.
//
// À lancer DEPUIS LA RACINE DU DÉPÔT :
//   node scripts/seed-networth-snapshots.js --couple=ABC123
//   node scripts/seed-networth-snapshots.js --couple=ABC123 --months=12
//   node scripts/seed-networth-snapshots.js --couple=ABC123 --purge
//   node scripts/seed-networth-snapshots.js --purge --all   # purge TOUTE la base
//
// Comme scripts/deploy.js, il passe par l'API REST Firestore et signe un JWT
// avec la clé du compte de service — PAS par firebase-admin, qui n'est pas une
// dépendance de ce dépôt (elle ne vit que dans functions/).

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { ASSET_TYPES } from "../src/data/assetTypes.js";
import { buildSnapshotEntries, sumEntriesByType } from "../src/utils/assetValuation.js";
import { makeConverter } from "../src/utils/priceTargets.js";
import { FALLBACK_RATES_EUR_BASE } from "../src/utils/currencyConversion.js";

const PROJECT_ID = "pairwise-12df2";
const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "C:\\Users\\Chenipe\\Documents\\Projet Pairwise\\Keys\\pairwise-12df2-97a5d677db9b.json";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const args = process.argv.slice(2);
const PURGE = args.includes("--purge");
const ALL = args.includes("--all");
const COUPLE = args.find((a) => a.startsWith("--couple="))?.split("=")[1] || null;
const MONTHS = Number(args.find((a) => a.startsWith("--months="))?.split("=")[1]) || 6;

// `--all` n'est autorisé qu'avec `--purge` : nettoyer largement est sans danger,
// écrire largement ne l'est pas.
if (!COUPLE && !(PURGE && ALL)) {
  console.error(
    "\n❌ Cible manquante.\n\n" +
    "   Ce script écrit des données INVENTÉES : il refuse de le faire sans couple explicite.\n\n" +
    "   node scripts/seed-networth-snapshots.js --couple=ABC123\n" +
    "   node scripts/seed-networth-snapshots.js --couple=ABC123 --purge\n" +
    "   node scripts/seed-networth-snapshots.js --purge --all   (nettoyage global)\n"
  );
  process.exit(1);
}

// Dérive mensuelle indicative par type : la crypto bouge beaucoup, l'immobilier
// presque pas, un prêt se rembourse. Purement décoratif — c'est ce qui rend
// l'historique inventé lisible plutôt que plat.
const MONTHLY_DRIFT = {
  crypto: 0.09, stocks: 0.025, bonds: 0.004, life_insurance: 0.006,
  retirement: 0.008, account: 0.012, cash: 0, real_estate: 0.002,
  vehicle: -0.01, other_assets: 0, debt: -0.02,
};

// ── Authentification (identique à scripts/deploy.js) ────────────────────────

function loadServiceAccountKey() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
  return JSON.parse(readFileSync(KEY_PATH, "utf8"));
}

async function getAccessToken() {
  const key = loadServiceAccountKey();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");
  const sig = createSign("RSA-SHA256").update(`${header}.${claim}`).sign(key.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${sig}`,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Authentification échouée : " + JSON.stringify(data));
  return data.access_token;
}

async function api(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${res.status} : ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// ── Conversion depuis/vers le format « valeurs typées » de l'API REST ───────

function fromValue(v) {
  if (v == null) return null;
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("integerValue" in v) return Number(v.integerValue);
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}

function fromFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "number") return { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}

function toFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));
}

// ── Historique synthétique ──────────────────────────────────────────────────

function seededRandom(seed) {
  // Déterministe : relancer le script produit le même historique, au lieu d'un
  // nouveau jeu de chiffres à chaque exécution.
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
  console.log("1. Authentification...");
  const token = await getAccessToken();
  console.log("   OK");

  const liabilityIds = new Set(ASSET_TYPES.filter((t) => t.isLiability).map((t) => t.id));
  let couples = (await api(token, "GET", `${BASE}/couples?pageSize=300`))?.documents || [];
  if (COUPLE) {
    couples = couples.filter((d) => d.name.split("/").pop() === COUPLE);
    if (couples.length === 0) throw new Error(`Couple « ${COUPLE} » introuvable.`);
  }
  console.log(`2. ${couples.length} couple(s) ciblé(s)${COUPLE ? ` (${COUPLE})` : " — TOUTE LA BASE"}.`);

  for (const doc of couples) {
    const coupleId = doc.name.split("/").pop();
    const data = fromFields(doc.fields || {});
    const col = `${BASE}/couples/${coupleId}/netWorthSnapshots`;

    if (PURGE) {
      // On ne supprime QUE les instantanés synthétiques : ceux écrits par la
      // fonction planifiée sont de vraies mesures et doivent survivre.
      const existing = (await api(token, "GET", `${col}?pageSize=500`))?.documents || [];
      let removed = 0;
      for (const s of existing) {
        if (fromFields(s.fields || {}).source !== "seed") continue;
        await api(token, "DELETE", `https://firestore.googleapis.com/v1/${s.name}`);
        removed++;
      }
      console.log(`   ${coupleId} : ${removed} instantané(s) synthétique(s) supprimé(s).`);
      continue;
    }

    const assets = data.assets || [];
    if (assets.length === 0) {
      console.log(`   ${coupleId} : aucun actif, ignoré.`);
      continue;
    }

    const currency = data.wealthDisplayCurrency || data.defaultCurrency || "EUR";
    const unknownCurrencies = new Set();
    // Les VARIATIONS sont inventées, les DEVISES non. Une première version
    // passait ici une identité, au motif que l'historique est fabriqué de toute
    // façon : un compte en VND était donc recopié à sa valeur faciale dans un
    // instantané libellé en dollars, et le patrimoine total affichait des
    // centaines de millions. Inventer une trajectoire reste lisible ; ignorer le
    // change rend le total incohérent avec ce que l'app montre ailleurs.
    //
    // On convertit donc avec la table de repli du dépôt — déterministe, sans
    // appel réseau, et la même que celle du navigateur hors ligne.
    const convert = makeConverter(FALLBACK_RATES_EUR_BASE, "EUR");
    const safeConvert = (amount, from, to) => {
      // `makeConverter` rend NaN dans DEUX cas qu'il ne distingue pas : montant
      // non numérique, et devise absente de la table. Une première version les
      // traitait ensemble et signalait « devise sans taux de repli : USD, VND »
      // alors que les deux y figurent — le vrai motif étant qu'une crypto ou une
      // action ne stocke pas de `value` (seulement quantité + apiId), cas que
      // `valueOfAsset` gère déjà en renvoyant 0. On ne signale donc que ce qui
      // mérite de l'être.
      if (!Number.isFinite(amount)) return 0;
      if (!(from in FALLBACK_RATES_EUR_BASE) || !(to in FALLBACK_RATES_EUR_BASE)) {
        unknownCurrencies.add(from in FALLBACK_RATES_EUR_BASE ? to : from);
        return amount;
      }
      return convert(amount, from, to);
    };
    const today = buildSnapshotEntries(assets, {
      livePrices: {}, convert: safeConvert, displayCurrency: currency,
    });
    if (unknownCurrencies.size > 0) {
      console.warn(`   ⚠️  devise(s) sans taux de repli, montants non convertis : ${[...unknownCurrencies].join(", ")}`);
    }

    const dates = monthEndDates(MONTHS);
    const rand = seededRandom(coupleId.split("").reduce((s, c) => s + c.charCodeAt(0), 7));

    for (let i = 0; i < dates.length; i++) {
      // `back` = nombre de mois avant aujourd'hui. On remonte la dérive : un
      // actif qui a monté de 9 %/mois valait donc moins avant.
      const back = dates.length - i;
      const entries = today.map((entry) => {
        const drift = MONTHLY_DRIFT[entry.typeId] ?? 0.005;
        // Bruit proportionnel à la dérive, pour que la courbe ne soit pas droite.
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

      // PATCH sur un id précis = créer ou remplacer : relancer le script ne
      // duplique donc rien.
      await api(token, "PATCH", `${col}/${dates[i]}`, {
        fields: toFields({
          date: dates[i],
          currency,
          value: totalAssets - totalLiabilities,
          totalAssets,
          totalLiabilities,
          byType,
          entries,
          // Le marqueur qui rend ces données révocables d'un seul --purge.
          source: "seed",
          recordedAt: Date.now(),
        }),
      });
    }
    console.log(`   ${coupleId} : ${dates.length} instantané(s) écrits (${dates[0]} → ${dates.at(-1)}).`);
  }

  console.log(PURGE
    ? "\n✅ Purge terminée."
    : "\n⚠️  Historique INVENTÉ écrit. Relancer avec --purge pour tout retirer.");
}

main().catch((err) => {
  console.error("\n❌ Erreur :", err.message);
  process.exit(1);
});
