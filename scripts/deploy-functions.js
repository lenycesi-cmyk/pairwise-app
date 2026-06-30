#!/usr/bin/env node
/**
 * Déploie les Cloud Functions via l'API REST Google Cloud,
 * en contournant firebase-tools (incompatible avec Node 24).
 *
 * Usage: node scripts/deploy-functions.js
 *
 * Prérequis: le compte de service doit avoir les rôles
 *   - roles/cloudfunctions.developer
 *   - roles/storage.admin (pour l'upload du code source)
 *   - roles/iam.serviceAccountUser
 *
 * Secrets Plaid à configurer au préalable:
 *   gcloud secrets create PLAID_CLIENT_ID --data-file=- <<< "your_id"
 *   gcloud secrets create PLAID_SECRET --data-file=- <<< "your_secret"
 *   gcloud secrets create PLAID_ENV --data-file=- <<< "sandbox"
 *   (ou via console.cloud.google.com > Secret Manager)
 */
import { createSign } from "node:crypto";
import { readFileSync, createReadStream, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";

const PROJECT_ID = "pairwise-12df2";
const REGION = "europe-west1";
const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "C:\\Users\\Chenipe\\Documents\\Projet Pairwise\\Keys\\pairwise-12df2-97a5d677db9b.json";
const FUNCTIONS_DIR = join(import.meta.dirname, "..", "functions");

const FUNCTIONS_TO_DEPLOY = [
  "createLinkToken",
  "exchangeToken",
  "syncBalance",
  "disconnectBank",
  "syncAllBalances",
];

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
  const sig = createSign("RSA-SHA256")
    .update(`${header}.${claim}`)
    .sign(key.private_key, "base64url");
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

async function api(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function zipFunctions() {
  const zipPath = join(tmpdir(), "pairwise-functions.zip");
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve(zipPath));
    archive.on("error", reject);
    archive.pipe(output);
    // Include all files except node_modules and .env
    archive.glob("**", {
      cwd: FUNCTIONS_DIR,
      ignore: ["node_modules/**", ".env", ".env.example", "*.zip"],
    });
    archive.finalize();
  });
}

async function uploadSource(token, zipPath) {
  // Get upload URL from Cloud Functions API
  const uploadRes = await api(
    token,
    "POST",
    `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/functions:generateUploadUrl`,
    {}
  );
  const { uploadUrl, storageSource } = uploadRes;

  // Upload zip
  const zipBuffer = readFileSync(zipPath);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/zip" },
    body: zipBuffer,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  console.log("  Code source uploadé.");
  return storageSource;
}

async function deployFunction(token, name, storageSource, isScheduled = false) {
  const parent = `projects/${PROJECT_ID}/locations/${REGION}`;
  const functionName = `${parent}/functions/${name}`;
  const serviceAccountEmail = loadServiceAccountKey().client_email;

  const body = {
    name: functionName,
    buildConfig: {
      runtime: "nodejs22",
      entryPoint: name,
      source: { storageSource },
      environmentVariables: {},
    },
    serviceConfig: {
      availableMemory: "256M",
      timeoutSeconds: 60,
      minInstanceCount: 0,
      maxInstanceCount: 10,
      serviceAccountEmail,
      secretEnvironmentVariables: [
        { key: "PLAID_CLIENT_ID", projectId: PROJECT_ID, secret: "PLAID_CLIENT_ID", version: "latest" },
        { key: "PLAID_SECRET", projectId: PROJECT_ID, secret: "PLAID_SECRET", version: "latest" },
        { key: "PLAID_ENV", projectId: PROJECT_ID, secret: "PLAID_ENV", version: "latest" },
      ],
    },
    ...(isScheduled ? {} : {}), // schedule handled by Cloud Scheduler separately
  };

  // Try update first, then create
  try {
    const result = await api(
      token,
      "PATCH",
      `https://cloudfunctions.googleapis.com/v2/${functionName}`,
      body
    );
    return result;
  } catch (e) {
    if (e.message.includes("404") || e.message.includes("NOT_FOUND")) {
      const result = await api(
        token,
        "POST",
        `https://cloudfunctions.googleapis.com/v2/${parent}/functions?functionId=${name}`,
        body
      );
      return result;
    }
    throw e;
  }
}

async function waitForOperation(token, operationName) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 10000)); // wait 10s
    const op = await api(token, "GET", `https://cloudfunctions.googleapis.com/v2/${operationName}`, null);
    if (op.done) {
      if (op.error) throw new Error(`Operation failed: ${JSON.stringify(op.error)}`);
      return op;
    }
    process.stdout.write(".");
  }
  throw new Error("Operation timed out");
}

async function main() {
  console.log("=== Déploiement des Cloud Functions Pairwise ===\n");

  console.log("1. Authentification...");
  const token = await getAccessToken();
  console.log("   OK");

  console.log("2. Compression du code source...");
  const zipPath = await zipFunctions();
  console.log(`   OK (${zipPath})`);

  console.log("3. Upload du code source...");
  const storageSource = await uploadSource(token, zipPath);

  const scheduled = ["syncAllBalances"];

  console.log("4. Déploiement des fonctions...");
  for (const name of FUNCTIONS_TO_DEPLOY) {
    process.stdout.write(`   → ${name} `);
    const op = await deployFunction(token, name, storageSource, scheduled.includes(name));
    if (op.name) {
      await waitForOperation(token, op.name.replace("projects/", "projects/"));
    }
    console.log(" ✓");
  }

  console.log("\n✅ Déploiement terminé !");
  console.log(`   Cloud Functions: https://console.cloud.google.com/functions/list?project=${PROJECT_ID}`);
}

main().catch((err) => {
  console.error("\n❌ Erreur:", err.message);
  process.exit(1);
});
