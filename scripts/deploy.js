#!/usr/bin/env node
// Déploie dist/ sur Firebase Hosting via l'API REST, en contournant firebase-tools
// (incompatible avec Node 24 sur cette machine — voir conversation du 2026-06-27).
import { createSign } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const PROJECT_ID = "pairwise-12df2";
const SITE_ID = "pairwise-12df2";
const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "C:\\Users\\Chenipe\\Documents\\Projet Pairwise\\Keys\\pairwise-12df2-97a5d677db9b.json";
const DIST_DIR = join(import.meta.dirname, "..", "dist");

async function getAccessToken() {
  const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url"
  );
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

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
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

async function main() {
  console.log("Auth...");
  const token = await getAccessToken();

  console.log("Création de la version...");
  const version = await api(
    token,
    "POST",
    `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/versions`,
    { config: { rewrites: [{ glob: "**", path: "/index.html" }] } }
  );
  const versionName = version.name;
  console.log("Version:", versionName);

  const files = walk(DIST_DIR);
  const hashToGz = new Map();
  const pathToHash = {};
  for (const f of files) {
    const gz = gzipSync(readFileSync(f));
    const hash = createHash("sha256").update(gz).digest("hex");
    const urlPath = "/" + relative(DIST_DIR, f).split("\\").join("/");
    pathToHash[urlPath] = hash;
    hashToGz.set(hash, gz);
  }

  console.log(`Populate (${files.length} fichiers)...`);
  const pop = await api(
    token,
    "POST",
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`,
    { files: pathToHash }
  );

  const uploadUrl = pop.uploadUrl;
  for (const hash of pop.uploadRequiredHashes || []) {
    const gz = hashToGz.get(hash);
    const res = await fetch(`${uploadUrl}/${hash}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: gz,
    });
    if (!res.ok) throw new Error(`Upload ${hash} failed: ${res.status} ${await res.text()}`);
  }
  console.log(`${(pop.uploadRequiredHashes || []).length} fichiers uploadés.`);

  console.log("Finalisation...");
  await api(
    token,
    "PATCH",
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}?updateMask=status`,
    { status: "FINALIZED" }
  );

  console.log("Création de la release...");
  await api(
    token,
    "POST",
    `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/releases?versionName=${versionName}`,
    {}
  );

  console.log(`Déployé: https://${SITE_ID}.web.app`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
