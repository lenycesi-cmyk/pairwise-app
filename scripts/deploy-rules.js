#!/usr/bin/env node
// Déploie firestore.rules via l'API REST firebaserules.googleapis.com, en
// contournant firebase-tools (incompatible Node 24 sur cette machine, cf.
// deploy.js / CLAUDE.md). Le service account de déploiement a le rôle
// `Firebase Rules Admin`. Deux appels : création d'un ruleset, puis mise à jour
// de la release `cloud.firestore` pour pointer dessus.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ID = "pairwise-12df2";
const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "C:\\Users\\Chenipe\\Documents\\Projet Pairwise\\Keys\\pairwise-12df2-97a5d677db9b.json";
const RULES_PATH = join(import.meta.dirname, "..", "firestore.rules");
const RELEASE_NAME = `projects/${PROJECT_ID}/releases/cloud.firestore`;

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
      scope: "https://www.googleapis.com/auth/cloud-platform",
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

async function api(token, method, url, body, { allow404 = false } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (allow404 && res.status === 404) return { _notFound: true };
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log("Auth...");
  const token = await getAccessToken();

  const source = readFileSync(RULES_PATH, "utf8");
  console.log("Création du ruleset...");
  const ruleset = await api(
    token,
    "POST",
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets`,
    { source: { files: [{ name: "firestore.rules", content: source }] } }
  );
  console.log("Ruleset:", ruleset.name);

  // On tente de mettre à jour la release existante ; si elle n'existe pas
  // encore (premier déploiement), on la crée.
  console.log("Mise à jour de la release cloud.firestore...");
  const patch = await api(
    token,
    "PATCH",
    `https://firebaserules.googleapis.com/v1/${RELEASE_NAME}`,
    // Corps de type UpdateReleaseRequest : la Release est imbriquée sous
    // `release` (un `rulesetName` au premier niveau est rejeté en 400).
    { release: { name: RELEASE_NAME, rulesetName: ruleset.name }, updateMask: "rulesetName" },
    { allow404: true }
  );
  if (patch && patch._notFound) {
    console.log("Release absente → création...");
    await api(
      token,
      "POST",
      `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases`,
      { name: RELEASE_NAME, rulesetName: ruleset.name }
    );
  }

  console.log("Règles Firestore déployées ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
