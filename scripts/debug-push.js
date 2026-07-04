#!/usr/bin/env node
/**
 * Diagnostic des notifications push — exécuté via le workflow debug-push
 * (workflow_dispatch) avec la clé du compte de service. Vérifie chaque
 * maillon de la chaîne et imprime un rapport :
 *   1. le compte de service peut-il envoyer du FCM ? (validate_only)
 *   2. peut-il lire Firestore ? des tokens fcmTokens existent-ils ?
 *   3. les logs récents de sendPush contiennent-ils des erreurs ?
 * Aucune notification réelle n'est envoyée, aucune donnée n'est modifiée.
 */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const PROJECT_ID = "pairwise-12df2";

function loadKey() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
  return JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
}

async function getAccessToken() {
  const key = loadKey();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore",
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
  if (!data.access_token) throw new Error("Auth failed: " + JSON.stringify(data));
  return data.access_token;
}

async function call(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 800) };
}

async function main() {
  const key = loadKey();
  console.log(`Service account: ${key.client_email}\n`);
  const token = await getAccessToken();

  // ── 1. Droit d'envoi FCM (validate_only : rien n'est envoyé) ─────────────
  console.log("1) FCM send permission (validate_only)…");
  const fcm = await call(token, "POST",
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    { validate_only: true, message: { topic: "debug-validate", data: { ping: "1" } } });
  console.log(`   HTTP ${fcm.status} ${fcm.status === 200 ? "✓ le SA peut envoyer du FCM" : "✗ PROBLÈME → " + fcm.body}\n`);

  // ── 2. Lecture Firestore + présence de tokens ────────────────────────────
  console.log("2) Firestore read + fcmTokens…");
  const fs = await call(token, "GET",
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/couples?pageSize=10&mask.fieldPaths=fcmTokens&mask.fieldPaths=pushPrefs&mask.fieldPaths=members`);
  if (fs.status !== 200) {
    console.log(`   HTTP ${fs.status} ✗ lecture impossible → ${fs.body}\n`);
  } else {
    const docs = JSON.parse(fs.body).documents || [];
    console.log(`   HTTP 200 ✓ — ${docs.length} couple(s)`);
    for (const d of docs) {
      const id = d.name.split("/").pop();
      const tokenField = d.fields?.fcmTokens?.mapValue?.fields || {};
      const summary = Object.entries(tokenField).map(([member, v]) => {
        const n = Object.keys(v.mapValue?.fields || {}).length;
        return `${member.slice(0, 12)}…: ${n} token(s)`;
      });
      console.log(`   couple ${id}: fcmTokens { ${summary.join(", ") || "VIDE ✗"} }`);
    }
    console.log("");
  }

  // ── 3. Logs récents de sendPush ──────────────────────────────────────────
  console.log("3) Recent sendPush logs (48h)…");
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const logs = await call(token, "POST",
    "https://logging.googleapis.com/v2/entries:list",
    {
      resourceNames: [`projects/${PROJECT_ID}`],
      filter: `resource.type="cloud_run_revision" resource.labels.service_name="sendpush" timestamp>="${since}"`,
      orderBy: "timestamp desc",
      pageSize: 30,
    });
  if (logs.status !== 200) {
    console.log(`   HTTP ${logs.status} ✗ logs illisibles → ${logs.body}`);
  } else {
    const entries = JSON.parse(logs.body).entries || [];
    if (entries.length === 0) console.log("   Aucune entrée → la fonction n'a jamais été invoquée ✗ (ou logs vides)");
    for (const e of entries.slice(0, 15)) {
      const msg = e.textPayload || JSON.stringify(e.jsonPayload || e.httpRequest || {}).slice(0, 200);
      console.log(`   [${e.severity || "?"}] ${e.timestamp} ${msg}`);
    }
  }
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
