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
  // body complet pour JSON.parse ; preview tronquée pour l'affichage
  return { status: res.status, body: text, preview: text.slice(0, 600) };
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
  console.log(`   HTTP ${fcm.status} ${fcm.status === 200 ? "✓ le SA peut envoyer du FCM" : "✗ PROBLÈME → " + fcm.preview}\n`);

  // ── 2. Lecture Firestore + présence de tokens ────────────────────────────
  console.log("2) Firestore read + fcmTokens…");
  const allTokens = []; // { couple, member, token } pour l'étape 4
  const fs = await call(token, "GET",
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/couples?pageSize=10&mask.fieldPaths=fcmTokens&mask.fieldPaths=pushPrefs&mask.fieldPaths=members`);
  if (fs.status !== 200) {
    console.log(`   HTTP ${fs.status} ✗ lecture impossible → ${fs.preview}\n`);
  } else {
    const docs = JSON.parse(fs.body).documents || [];
    console.log(`   HTTP 200 ✓ — ${docs.length} couple(s)`);
    for (const d of docs) {
      const id = d.name.split("/").pop();
      const tokenField = d.fields?.fcmTokens?.mapValue?.fields || {};
      const summary = Object.entries(tokenField).map(([member, v]) => {
        const tokens = Object.keys(v.mapValue?.fields || {});
        for (const tk of tokens) allTokens.push({ couple: id, member, token: tk });
        return `${member.slice(0, 12)}…: ${tokens.length} token(s)`;
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
    console.log(`   HTTP ${logs.status} ✗ logs illisibles → ${logs.preview}`);
  } else {
    const entries = JSON.parse(logs.body).entries || [];
    if (entries.length === 0) console.log("   Aucune entrée → la fonction n'a jamais été invoquée ✗ (ou logs vides)");
    for (const e of entries.slice(0, 15)) {
      const msg = e.textPayload || JSON.stringify(e.jsonPayload || e.httpRequest || {}).slice(0, 200);
      console.log(`   [${e.severity || "?"}] ${e.timestamp} ${msg}`);
    }
  }

  // ── 4. Envoi RÉEL, token par token (uniquement si SEND_TEST=1) ────────────
  // Chaque token reçoit une vraie notif de test ; on rapporte vivant/mort avec
  // le code d'erreur FCM exact. C'est le seul moyen fiable de distinguer
  // « tokens morts » d'un problème de rendu/livraison. Data-only pour que le
  // Service Worker affiche la notif comme en production.
  if (process.env.SEND_TEST === "1") {
    console.log("\n4) Envoi RÉEL de test, token par token…");
    if (allTokens.length === 0) {
      console.log("   Aucun token stocké → rien à tester (les appareils doivent se réenregistrer) ✗");
    }
    let alive = 0, dead = 0;
    for (const { couple, member, token: tk } of allTokens) {
      const r = await call(token, "POST",
        `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
        { message: { token: tk, data: {
          title: "Pairwise — test",
          body: "Notification de diagnostic. Tu peux l'ignorer.",
          tag: "debug_test",
          url: "/",
        } } });
      const label = `${couple}/${member.slice(0, 8)}… ${tk.slice(0, 12)}…`;
      if (r.status === 200) {
        alive++;
        console.log(`   ✓ VIVANT  ${label}`);
      } else {
        dead++;
        let err = r.preview;
        try {
          const j = JSON.parse(r.body);
          err = j.error?.details?.[0]?.errorCode || j.error?.status || j.error?.message || err;
        } catch { /* garde le preview brut */ }
        console.log(`   ✗ MORT    ${label} → HTTP ${r.status} ${err}`);
      }
    }
    console.log(`\n   Bilan : ${alive} vivant(s), ${dead} mort(s) sur ${allTokens.length} token(s).`);
  } else {
    console.log("\n4) Envoi réel désactivé (SEND_TEST≠1) — aucun push envoyé.");
  }
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
