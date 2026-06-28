#!/usr/bin/env node
// Génère ~1 an de transactions fictives pour un couple de test (Paul & Sophie),
// calibrées sur le niveau de vie réel observé en juin (export CSV), avec les
// éléments additionnels demandés (salaires, enfant, assurances, voyages,
// investissements). Écrit directement dans Firestore via l'API REST, en
// réutilisant le même contournement que scripts/deploy.js (firebase-tools ne
// fonctionne pas sur cette machine).
//
// Pré-requis avant de lancer ce script :
//   1. Crée le couple fictif dans l'app (2 comptes: Paul et Sophie, couple lié).
//   2. Renseigne COUPLE_ID, PAUL_UID, SOPHIE_UID ci-dessous (Firebase Console
//      > Authentication pour les UID, ou Firestore > couples/{id}.members).
//   3. Le compte de service utilisé pour scripts/deploy.js n'a aujourd'hui que
//      les rôles "Firebase Hosting Admin" et "Firebase Rules Admin" — il faut
//      lui ajouter le rôle IAM "Cloud Datastore User" (roles/datastore.user)
//      dans la console GCP pour qu'il puisse écrire des transactions Firestore.
//
// Lancement : node scripts/seedFakeCouple.mjs
//   (GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_APPLICATION_CREDENTIALS_JSON comme deploy.js)

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const PROJECT_ID = "pairwise-12df2";
const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "C:\\Users\\Chenipe\\Documents\\Projet Pairwise\\Keys\\pairwise-12df2-97a5d677db9b.json";

// --- À renseigner avant de lancer le script ---
const COUPLE_ID = process.env.COUPLE_ID || "REPLACE_ME_COUPLE_ID";
const PAUL_UID = process.env.PAUL_UID || "REPLACE_ME_PAUL_UID";
const SOPHIE_UID = process.env.SOPHIE_UID || "REPLACE_ME_SOPHIE_UID";
// ------------------------------------------------

const DEFAULT_CURRENCY = "VND";
// Mêmes taux de secours que src/utils/currencyConversion.js (base EUR), pour
// figer convertedAmount sans appeler l'API de taux de change en live.
const EUR_BASE_RATES = { EUR: 1, USD: 1.08, VND: 27500 };

function rate(from, to) {
  if (from === to) return 1;
  return EUR_BASE_RATES[to] / EUR_BASE_RATES[from];
}

// PRNG déterministe (mulberry32) pour des montants "naturels" mais reproductibles.
let seed = 42;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randInt(min, max) {
  return Math.floor(min + rnd() * (max - min + 1));
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function roundTo(n, step) {
  return Math.round(n / step) * step;
}

const tx = [];

function addTx({ date, type, amount, currency, categoryId, subcategory, description, paidBy, split }) {
  const r = rate(currency, DEFAULT_CURRENCY);
  tx.push({
    date: new Date(date).toISOString(),
    type,
    amount,
    currency,
    categoryId,
    subcategory,
    description,
    paidBy,
    split,
    splitDetails: null,
    convertedAmount: amount * r,
    convertedCurrency: DEFAULT_CURRENCY,
    exchangeRate: r,
    exchangeRateIsFallback: false,
    memberUids: [PAUL_UID, SOPHIE_UID],
    createdAt: Date.now(),
    createdBy: PAUL_UID,
  });
}

// --- Fenêtres de voyage : pas de dépenses de "vie quotidienne" au Vietnam pendant ces périodes ---
const TRIPS = [
  { start: "2025-07-07", end: "2025-08-04" }, // France
  { start: "2025-10-21", end: "2025-10-30" }, // Krabi
  { start: "2026-04-20", end: "2026-04-30" }, // Bali
];
function inTrip(dateStr) {
  const d = new Date(dateStr).getTime();
  return TRIPS.some((t) => d >= new Date(t.start).getTime() && d <= new Date(t.end).getTime());
}

// --- 12 mois, juillet 2025 -> juin 2026 ---
const MONTHS = [];
for (let i = 0; i < 12; i++) {
  const d = new Date(2025, 6 + i, 1); // juillet = index 6
  MONTHS.push({ year: d.getFullYear(), month: d.getMonth() }); // month: 0-11
}

function dstr(year, month, day) {
  return new Date(year, month, day).toISOString().slice(0, 10);
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

for (const { year, month } of MONTHS) {
  const calMonth = month + 1; // 1-12
  const nDays = daysInMonth(year, month);

  // --- Salaires ---
  addTx({
    date: dstr(year, month, 28) + "T09:00:00",
    type: "income", amount: 2200, currency: "USD",
    categoryId: "income", subcategory: "Salaire",
    description: "Salaire Paul", paidBy: PAUL_UID, split: "100",
  });
  addTx({
    date: dstr(year, month, 28) + "T09:05:00",
    type: "income", amount: 2600, currency: "USD",
    categoryId: "income", subcategory: "Salaire",
    description: "Salaire Sophie", paidBy: SOPHIE_UID, split: "100",
  });

  // --- Logement (fixe) ---
  addTx({
    date: dstr(year, month, 1) + "T08:00:00",
    type: "expense", amount: 22000000, currency: "VND",
    categoryId: "housing", subcategory: "Loyer",
    description: "Loyer", paidBy: pick([PAUL_UID, SOPHIE_UID]), split: "50/50",
  });
  addTx({
    date: dstr(year, month, 2) + "T08:00:00",
    type: "expense", amount: roundTo(randInt(900000, 1200000), 1000), currency: "VND",
    categoryId: "housing", subcategory: "Électricité",
    description: "Facture électricité", paidBy: pick([PAUL_UID, SOPHIE_UID]), split: "50/50",
  });
  addTx({
    date: dstr(year, month, 15) + "T08:00:00",
    type: "expense", amount: roundTo(randInt(1300000, 1400000), 1000), currency: "VND",
    categoryId: "housing", subcategory: "Charges de copropriété",
    description: "Frais de gestion", paidBy: pick([PAUL_UID, SOPHIE_UID]), split: "50/50",
  });
  // Ménage x2/mois, sauf pendant le mois en France
  if (!(calMonth === 7)) {
    for (const day of [9, 23]) {
      if (day <= nDays) {
        addTx({
          date: dstr(year, month, day) + "T10:00:00",
          type: "expense", amount: 250000, currency: "VND",
          categoryId: "housing", subcategory: "Ménage",
          description: "Ménage", paidBy: pick([PAUL_UID, SOPHIE_UID]), split: "50/50",
        });
      }
    }
  }

  // --- Assurances santé ---
  addTx({
    date: dstr(year, month, 5) + "T09:00:00",
    type: "expense", amount: 66, currency: "USD",
    categoryId: "health", subcategory: "Assurance santé",
    description: "Assurance santé Paul", paidBy: PAUL_UID, split: PAUL_UID,
  });
  addTx({
    date: dstr(year, month, 5) + "T09:10:00",
    type: "expense", amount: 97, currency: "EUR",
    categoryId: "health", subcategory: "Assurance santé",
    description: "Assurance santé CFE Sophie", paidBy: SOPHIE_UID, split: SOPHIE_UID,
  });
  addTx({
    date: dstr(year, month, 5) + "T09:20:00",
    type: "expense", amount: 4600000, currency: "VND",
    categoryId: "children", subcategory: "Assurance santé",
    description: "Assurance April enfant", paidBy: pick([PAUL_UID, SOPHIE_UID]), split: "50/50",
  });

  // --- Scolarité (septembre -> juin) ---
  if (calMonth >= 9 || calMonth <= 6) {
    addTx({
      date: dstr(year, month, 3) + "T08:30:00",
      type: "expense", amount: 250, currency: "USD",
      categoryId: "children", subcategory: "Frais de scolarité",
      description: "Frais de scolarité enfant", paidBy: pick([PAUL_UID, SOPHIE_UID]), split: "50/50",
    });
  }

  // --- Abonnements ---
  addTx({
    date: dstr(year, month, 9) + "T20:00:00",
    type: "expense", amount: 70000, currency: "VND",
    categoryId: "subscriptions", subcategory: "Streaming musical",
    description: "Spotify", paidBy: SOPHIE_UID, split: SOPHIE_UID,
  });
  addTx({
    date: dstr(year, month, 12) + "T18:00:00",
    type: "expense", amount: roundTo(randInt(80000, 100000), 1000), currency: "VND",
    categoryId: "subscriptions", subcategory: "Téléphone",
    description: "Mobifone Sophie", paidBy: SOPHIE_UID, split: SOPHIE_UID,
  });
  addTx({
    date: dstr(year, month, 22) + "T18:00:00",
    type: "expense", amount: roundTo(randInt(80000, 100000), 1000), currency: "VND",
    categoryId: "subscriptions", subcategory: "Téléphone",
    description: "Mobifone Paul", paidBy: PAUL_UID, split: PAUL_UID,
  });
  addTx({
    date: dstr(year, month, 22) + "T08:00:00",
    type: "expense", amount: 22.5, currency: "USD",
    categoryId: "subscriptions", subcategory: "Logiciels / apps",
    description: "Abonnement Claude", paidBy: PAUL_UID, split: PAUL_UID,
  });

  // --- Investissements mensuels (PEA x2 + assurance vie) ---
  addTx({
    date: dstr(year, month, 4) + "T08:00:00",
    type: "investment", amount: 500, currency: "EUR",
    categoryId: "investment", subcategory: "Versement PEA",
    description: "PEA Paul", paidBy: PAUL_UID, split: "100",
  });
  addTx({
    date: dstr(year, month, 4) + "T08:05:00",
    type: "investment", amount: 500, currency: "EUR",
    categoryId: "investment", subcategory: "Versement PEA",
    description: "PEA Sophie", paidBy: SOPHIE_UID, split: "100",
  });
  addTx({
    date: dstr(year, month, 4) + "T08:10:00",
    type: "investment", amount: 200, currency: "EUR",
    categoryId: "investment", subcategory: "Versement assurance-vie",
    description: "Assurance vie études enfant", paidBy: SOPHIE_UID, split: "100",
  });

  // --- DCA Bitcoin quotidien (2x/jour, 5 EUR chacun = 150 EUR/mois/personne) ---
  for (let day = 1; day <= nDays; day++) {
    addTx({
      date: dstr(year, month, day) + "T07:00:00",
      type: "investment", amount: 5, currency: "EUR",
      categoryId: "investment", subcategory: "Achat crypto",
      description: "DCA Bitcoin Paul", paidBy: PAUL_UID, split: "100",
    });
    addTx({
      date: dstr(year, month, day) + "T07:01:00",
      type: "investment", amount: 5, currency: "EUR",
      categoryId: "investment", subcategory: "Achat crypto",
      description: "DCA Bitcoin Sophie", paidBy: SOPHIE_UID, split: "100",
    });
  }

  // --- Animaux (croquettes) ---
  addTx({
    date: dstr(year, month, 6) + "T11:00:00",
    type: "expense", amount: roundTo(randInt(950000, 1100000), 10000), currency: "VND",
    categoryId: "pets", subcategory: "Nourriture",
    description: "Croquettes", paidBy: pick([PAUL_UID, SOPHIE_UID]), split: "50/50",
  });

  // --- Vie quotidienne : courses, café, restos, transport, sport, beauté, santé, divers ---
  // Sauf pendant les voyages (France / Krabi / Bali).
  for (let day = 1; day <= nDays; day++) {
    const date = dstr(year, month, day);
    if (inTrip(date)) continue;
    const dow = new Date(year, month, day).getDay();

    // Courses ~3x/semaine
    if ([1, 4, 6].includes(dow)) {
      addTx({
        date: date + "T17:00:00",
        type: "expense", amount: roundTo(randInt(120000, 1150000), 1000), currency: "VND",
        categoryId: "food", subcategory: "Courses",
        description: pick(["Top Market", "Happy Tree", "Courses Shopee", "Tidou"]),
        paidBy: pick([PAUL_UID, SOPHIE_UID]), split: "50/50",
      });
    }
    // Café quasi quotidien
    if (rnd() < 0.7) {
      const payer = pick([PAUL_UID, SOPHIE_UID]);
      addTx({
        date: date + "T08:30:00",
        type: "expense", amount: roundTo(randInt(45000, 100000), 1000), currency: "VND",
        categoryId: "leisure", subcategory: "Café et Jus",
        description: pick(["Coffee", "Hong Cafe", "Smoothie"]),
        paidBy: payer, split: payer,
      });
    }
    // Restos / bars ~2x/semaine
    if ([3, 5].includes(dow)) {
      addTx({
        date: date + "T19:30:00",
        type: "expense", amount: roundTo(randInt(150000, 700000), 1000), currency: "VND",
        categoryId: "leisure", subcategory: pick(["Restaurants", "Restaurants", "Bars"]),
        description: pick(["Soma", "CS", "Nouveau spot"]),
        paidBy: pick([PAUL_UID, SOPHIE_UID]), split: "50/50",
      });
    }
    // Snacks / take away occasionnel
    if (rnd() < 0.3) {
      const payer = pick([PAUL_UID, SOPHIE_UID]);
      addTx({
        date: date + "T12:30:00",
        type: "expense", amount: roundTo(randInt(25000, 115000), 1000), currency: "VND",
        categoryId: "food", subcategory: pick(["Take away", "Snacks"]),
        description: pick(["Banh Mi", "Com Tam", "Pain"]),
        paidBy: payer, split: payer,
      });
    }
    // Essence hebdomadaire
    if (dow === 2) {
      const payer = pick([PAUL_UID, SOPHIE_UID]);
      addTx({
        date: date + "T08:00:00",
        type: "expense", amount: 100000, currency: "VND",
        categoryId: "transport", subcategory: "Essence",
        description: "Essence", paidBy: payer, split: "50/50",
      });
    }
    // VTC occasionnel
    if (rnd() < 0.15) {
      const payer = pick([PAUL_UID, SOPHIE_UID]);
      addTx({
        date: date + "T21:00:00",
        type: "expense", amount: roundTo(randInt(14000, 80000), 1000), currency: "VND",
        categoryId: "transport", subcategory: "VTC / taxi",
        description: "Grab", paidBy: payer, split: payer,
      });
    }
  }

  // Sport mensuel fixe
  addTx({
    date: dstr(year, month, 3) + "T07:00:00",
    type: "expense", amount: 2500000, currency: "VND",
    categoryId: "sport", subcategory: "Abonnement salle",
    description: "Abonnement salle Paul", paidBy: PAUL_UID, split: PAUL_UID,
  });
  for (const day of [7, 21]) {
    if (day <= nDays && !inTrip(dstr(year, month, day))) {
      addTx({
        date: dstr(year, month, day) + "T18:00:00",
        type: "expense", amount: 300000, currency: "VND",
        categoryId: "sport", subcategory: "Cours collectifs",
        description: "Yoga Sophie", paidBy: SOPHIE_UID, split: SOPHIE_UID,
      });
    }
  }

  // Beauté occasionnel (1x/mois)
  if (rnd() < 0.6) {
    const payer = pick([PAUL_UID, SOPHIE_UID]);
    addTx({
      date: dstr(year, month, randInt(8, 20)) + "T15:00:00",
      type: "expense", amount: roundTo(randInt(50000, 800000), 10000), currency: "VND",
      categoryId: "beauty", subcategory: "Coiffeur",
      description: "Coiffeur", paidBy: payer, split: payer,
    });
  }

  // Santé occasionnel
  if (rnd() < 0.4) {
    const payer = pick([PAUL_UID, SOPHIE_UID]);
    addTx({
      date: dstr(year, month, randInt(10, 25)) + "T14:00:00",
      type: "expense", amount: roundTo(randInt(300000, 800000), 10000), currency: "VND",
      categoryId: "health", subcategory: pick(["Vitamines & suppléments", "Spécialiste", "Pharmacie"]),
      description: pick(["Vitamines", "Physio", "Pharmacie"]), paidBy: payer, split: "50/50",
    });
  }

  // Divers / shopping occasionnel
  if (rnd() < 0.3) {
    const payer = pick([PAUL_UID, SOPHIE_UID]);
    addTx({
      date: dstr(year, month, randInt(10, 28)) + "T16:00:00",
      type: "expense", amount: roundTo(randInt(300000, 1000000), 10000), currency: "VND",
      categoryId: "misc", subcategory: "Technologie & électronique",
      description: pick(["Accessoire électronique", "Shopping en ligne"]), paidBy: payer, split: "50/50",
    });
  }
}

// --- Voyage Krabi (fin octobre 2025, 10 jours, ~1500 EUR) ---
addTx({ date: "2025-09-20T10:00:00", type: "expense", amount: 700, currency: "EUR", categoryId: "travel", subcategory: "Billets d'avion", description: "Vols Krabi", paidBy: PAUL_UID, split: "50/50" });
addTx({ date: "2025-10-21T14:00:00", type: "expense", amount: 500, currency: "EUR", categoryId: "travel", subcategory: "Hôtels", description: "Hôtel Krabi", paidBy: SOPHIE_UID, split: "50/50" });
addTx({ date: "2025-10-23T09:00:00", type: "expense", amount: 100, currency: "EUR", categoryId: "travel", subcategory: "Location de voiture", description: "Transport Krabi", paidBy: PAUL_UID, split: "50/50" });
addTx({ date: "2025-10-26T11:00:00", type: "expense", amount: 200, currency: "EUR", categoryId: "travel", subcategory: "Activités sur place", description: "Activités Krabi", paidBy: SOPHIE_UID, split: "50/50" });

// --- Voyage Bali (fin avril 2026, 11 jours, ~1600 EUR) ---
addTx({ date: "2026-03-18T10:00:00", type: "expense", amount: 750, currency: "EUR", categoryId: "travel", subcategory: "Billets d'avion", description: "Vols Bali", paidBy: SOPHIE_UID, split: "50/50" });
addTx({ date: "2026-04-20T14:00:00", type: "expense", amount: 550, currency: "EUR", categoryId: "travel", subcategory: "Hôtels", description: "Hôtel Bali", paidBy: PAUL_UID, split: "50/50" });
addTx({ date: "2026-04-22T09:00:00", type: "expense", amount: 120, currency: "EUR", categoryId: "travel", subcategory: "Location de voiture", description: "Transport Bali", paidBy: SOPHIE_UID, split: "50/50" });
addTx({ date: "2026-04-25T11:00:00", type: "expense", amount: 180, currency: "EUR", categoryId: "travel", subcategory: "Activités sur place", description: "Activités Bali", paidBy: PAUL_UID, split: "50/50" });

// --- Mois en France (juillet -> début août 2025, ~4000 EUR) ---
addTx({ date: "2025-06-15T10:00:00", type: "expense", amount: 2200, currency: "EUR", categoryId: "travel", subcategory: "Billets d'avion", description: "Vols France (famille)", paidBy: PAUL_UID, split: "50/50" });
addTx({ date: "2025-07-08T09:00:00", type: "expense", amount: 600, currency: "EUR", categoryId: "travel", subcategory: "Location de voiture", description: "Location voiture France", paidBy: SOPHIE_UID, split: "50/50" });
addTx({ date: "2025-07-18T19:00:00", type: "expense", amount: 800, currency: "EUR", categoryId: "travel", subcategory: "Restauration en voyage", description: "Sorties / repas France", paidBy: PAUL_UID, split: "50/50" });
addTx({ date: "2025-07-25T16:00:00", type: "expense", amount: 400, currency: "EUR", categoryId: "travel", subcategory: "Activités sur place", description: "Activités France", paidBy: SOPHIE_UID, split: "50/50" });

console.log(`Transactions générées : ${tx.length}`);

// --- Écriture Firestore ---

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
  const claim = Buffer.from(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  ).toString("base64url");
  const sig = createSign("RSA-SHA256").update(`${header}.${claim}`).sign(key.private_key, "base64url");
  const jwt = `${header}.${claim}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Auth failed: " + JSON.stringify(data));
  return data.access_token;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  throw new Error("Unsupported value type: " + typeof v);
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return fields;
}

async function batchWriteChunk(token, chunk) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`;
  const writes = chunk.map((t) => ({
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/couples/${COUPLE_ID}/transactions/${randomId()}`,
      fields: toFirestoreFields(t),
    },
  }));
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ writes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("batchWrite failed: " + JSON.stringify(data));
  return data;
}

function randomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 20; i++) id += chars[randInt(0, chars.length - 1)];
  return id;
}

async function main() {
  if (COUPLE_ID.startsWith("REPLACE_ME") || PAUL_UID.startsWith("REPLACE_ME") || SOPHIE_UID.startsWith("REPLACE_ME")) {
    console.error("Renseigne COUPLE_ID, PAUL_UID et SOPHIE_UID (en haut du fichier ou via variables d'env) avant de lancer le script.");
    process.exit(1);
  }
  const token = await getAccessToken();
  const CHUNK = 450; // limite Firestore batchWrite = 500
  for (let i = 0; i < tx.length; i += CHUNK) {
    const chunk = tx.slice(i, i + CHUNK);
    await batchWriteChunk(token, chunk);
    console.log(`Écrit ${Math.min(i + CHUNK, tx.length)} / ${tx.length}`);
  }
  console.log("Terminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
