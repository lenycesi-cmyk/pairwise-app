#!/usr/bin/env node
// Déploie dist/ sur Firebase Hosting via l'API REST, en contournant firebase-tools
// (incompatible avec Node 24 sur cette machine — voir conversation du 2026-06-27).
//
// Usage :
//   node scripts/deploy.js                          → déploiement live (production)
//   node scripts/deploy.js --channel=ma-preview      → canal de prévisualisation, TTL 7 j
//   node scripts/deploy.js --channel=demo --ttl=30   → canal de prévisualisation, TTL 30 j
//
// Un canal de prévisualisation sert le même build sur une URL éphémère et
// distincte, sans toucher au site live. ATTENTION : ce n'est PAS une
// préproduction. Le canal appartient au même projet Firebase, donc il tape la
// MÊME base Firestore, les MÊMES comptes et les MÊMES Cloud Functions que la
// production. Tout ce qu'on y écrit est écrit pour de vrai. Une vraie
// préproduction demanderait un second projet Firebase.
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
const HOSTING_API = "https://firebasehosting.googleapis.com/v1beta1";

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

// `--channel=live` ou pas de `--channel` ⇒ déploiement live. « live » est le nom
// réservé du canal de production côté Firebase, on le normalise donc en null.
const rawChannel = argValue("channel");
const CHANNEL_ID = rawChannel && rawChannel !== "live" ? rawChannel : null;

// Firebase plafonne la durée de vie d'un canal de prévisualisation à 30 jours.
const TTL_DAYS = Number(argValue("ttl") ?? 7);

function validateArgs() {
  if (!CHANNEL_ID) return;
  // Le nom du canal se retrouve dans l'URL générée (`{site}--{canal}-{hash}.web.app`) :
  // Firebase rejette tout ce qui n'est pas un slug minuscule.
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(CHANNEL_ID)) {
    throw new Error(
      `Nom de canal invalide: "${CHANNEL_ID}" (minuscules, chiffres, - et _, 63 caractères max)`
    );
  }
  if (!Number.isFinite(TTL_DAYS) || TTL_DAYS <= 0 || TTL_DAYS > 30) {
    throw new Error(`--ttl doit être un nombre de jours entre 1 et 30 (reçu: "${argValue("ttl")}")`);
  }
}

function loadServiceAccountKey() {
  // En CI/cloud il n'y a pas de système de fichiers persistant pour y déposer la clé:
  // on accepte aussi le JSON brut de la clé via une variable d'environnement.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
  return JSON.parse(readFileSync(KEY_PATH, "utf8"));
}

async function getAccessToken() {
  const key = loadServiceAccountKey();
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
  if (!res.ok) {
    const err = new Error(`${method} ${url} -> ${res.status}: ${text}`);
    // Exposé à part : `ensureChannel` distingue un 409 (canal déjà créé, cas
    // normal quand on redéploie sur le même canal) d'une vraie erreur.
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

// Crée le canal de prévisualisation, ou repousse sa date d'expiration s'il
// existe déjà — un redéploiement ne doit pas hériter du TTL d'origine, sinon le
// canal expirerait pendant qu'on s'en sert encore.
async function ensureChannel(token, channelId, ttlDays) {
  const ttl = `${Math.round(ttlDays * 86400)}s`;
  const base = `${HOSTING_API}/sites/${SITE_ID}/channels`;
  try {
    return await api(token, "POST", `${base}?channelId=${encodeURIComponent(channelId)}`, { ttl });
  } catch (err) {
    if (err.status !== 409) throw err;
    console.log("Canal existant, prolongation du TTL...");
    return await api(token, "PATCH", `${base}/${channelId}?updateMask=ttl`, { ttl });
  }
}

async function main() {
  validateArgs();

  console.log("Auth...");
  const token = await getAccessToken();

  // Le canal est créé AVANT l'upload : si le nom est refusé, autant échouer
  // tout de suite plutôt qu'après avoir poussé tous les fichiers.
  let channel = null;
  if (CHANNEL_ID) {
    console.log(`Canal de prévisualisation "${CHANNEL_ID}" (TTL ${TTL_DAYS} j)...`);
    channel = await ensureChannel(token, CHANNEL_ID, TTL_DAYS);
  }

  console.log("Création de la version...");
  const version = await api(
    token,
    "POST",
    `${HOSTING_API}/sites/${SITE_ID}/versions`,
    {
      config: {
        rewrites: [{ glob: "**", path: "/index.html" }],
        // Cache : index.html / SW / manifest jamais mis en cache (pour que
        // chaque déploiement soit visible immédiatement), assets hashés par
        // Vite mis en cache un an (immuables, le hash change à chaque build).
        headers: [
          {
            glob: "/index.html",
            headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
          },
          {
            glob: "/firebase-messaging-sw.js",
            headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
          },
          {
            glob: "/manifest.json",
            headers: { "Cache-Control": "no-cache" },
          },
          {
            glob: "/assets/**",
            headers: { "Cache-Control": "public, max-age=31536000, immutable" },
          },
        ],
      },
    }
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
    `${HOSTING_API}/${versionName}:populateFiles`,
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
    `${HOSTING_API}/${versionName}?updateMask=status`,
    { status: "FINALIZED" }
  );

  console.log("Création de la release...");
  // `sites/{site}/releases` est l'alias du canal « live » : on ne le vise que
  // pour un déploiement de production, sinon on publie sur le canal demandé.
  const releasesUrl = CHANNEL_ID
    ? `${HOSTING_API}/sites/${SITE_ID}/channels/${CHANNEL_ID}/releases`
    : `${HOSTING_API}/sites/${SITE_ID}/releases`;
  await api(token, "POST", `${releasesUrl}?versionName=${versionName}`, {});

  if (CHANNEL_ID) {
    console.log(`Déployé (prévisualisation): ${channel.url}`);
    console.log(`Expire le ${new Date(channel.expireTime).toLocaleString("fr-FR")}`);
    console.log("Rappel: ce canal utilise la base Firestore de PRODUCTION.");
  } else {
    console.log(`Déployé: https://${SITE_ID}.web.app`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
