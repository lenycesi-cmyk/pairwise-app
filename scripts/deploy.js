#!/usr/bin/env node
// Déploie dist/ sur Firebase Hosting via l'API REST, en contournant firebase-tools
// (incompatible avec Node 24 sur cette machine — voir conversation du 2026-06-27).
//
// Usage :
//   node scripts/deploy.js                          → déploiement live (production)
//   node scripts/deploy.js --channel=ma-preview      → canal de prévisualisation, TTL 7 j
//   node scripts/deploy.js --channel=demo --ttl=30   → canal de prévisualisation, TTL 30 j
//   node scripts/deploy.js --site=pairwise-www        → autre site Hosting du même projet
//   node scripts/deploy.js --marketing --site=<id>    → publie marketing/ (site de l'apex)
//
// Un canal de prévisualisation sert le même build sur une URL éphémère et
// distincte, sans toucher au site live. ATTENTION : ce n'est PAS une
// préproduction. Le canal appartient au même projet Firebase, donc il tape la
// MÊME base Firestore, les MÊMES comptes et les MÊMES Cloud Functions que la
// production. Tout ce qu'on y écrit est écrit pour de vrai. Une vraie
// préproduction demanderait un second projet Firebase.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { getAccessToken, api, HOSTING_API } from "./lib/firebaseApi.js";

// Site Hosting visé. Un projet Firebase peut en héberger plusieurs (l'app d'un
// côté, le site marketing de l'autre) ; `--site=` permet de choisir sans
// toucher au script. `argValue` est une déclaration de fonction, donc hissée.
// `--marketing` bascule la source sur le dossier marketing/ (site statique de
// l'apex pairwise.finance) et une config d'hébergement dédiée (URLs propres,
// vrai 404). On EXIGE alors un --site explicite : publier le marketing sur le
// site de l'app par défaut écraserait l'app — d'où le garde-fou dans validateArgs.
const IS_MARKETING = process.argv.slice(2).includes("--marketing");
const EXPLICIT_SITE = argValue("site") || process.env.FIREBASE_HOSTING_SITE || null;
const SITE_ID = EXPLICIT_SITE || "pairwise-12df2";
const SOURCE_DIR = join(import.meta.dirname, "..", IS_MARKETING ? "marketing" : "dist");

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

// Config d'hébergement envoyée à l'API REST (elle prime sur firebase.json, qui
// est ignoré ici). Deux profils : l'app (SPA, pas de catch-all) et le site
// marketing (pages statiques à URLs propres).
function hostingConfig() {
  if (IS_MARKETING) {
    return {
      // `cleanUrls` sert `/fonctionnalites/x` depuis `x.html` sans extension.
      // Pas de catch-all `**` : les chemins inconnus tombent sur 404.html avec
      // un vrai code 404 (même principe anti-soft-404 que l'app).
      cleanUrls: true,
      headers: [
        // HTML jamais mis en cache : un correctif de contenu est visible tout
        // de suite. Les assets (site.css…) ne sont pas hashés → cache court.
        { glob: "**/*.html", headers: { "Cache-Control": "no-cache" } },
        { glob: "/assets/**", headers: { "Cache-Control": "public, max-age=3600" } },
      ],
    };
  }
  return {
    // ATTENTION : c'est CETTE configuration qui est déployée, pas la section
    // `hosting` de firebase.json — le déploiement passe par l'API REST et ignore
    // ce fichier. Les deux sont gardées en phase à la main.
    //
    // Pas de réécriture « ** » : l'app n'a pas de routeur, sa seule URL est `/`.
    // Tout renvoyer vers index.html ferait répondre 200 à n'importe quelle
    // adresse inexistante — un « soft 404 » que Google pénalise. Sans catch-all,
    // Hosting sert 404.html avec un vrai code 404.
    //
    // Seule exception : le retour de consentement bancaire, seul chemin profond
    // réellement utilisé (cf. components/BankCallbackHandler.jsx, qui lit
    // `?code=…&state=…` puis remet l'URL à `/`).
    rewrites: [{ glob: "/bank-callback", path: "/index.html" }],
    // Cache : index.html / SW / manifest jamais mis en cache (pour que chaque
    // déploiement soit visible immédiatement), assets hashés par Vite mis en
    // cache un an (immuables, le hash change à chaque build).
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
  };
}

// `--channel=live` ou pas de `--channel` ⇒ déploiement live. « live » est le nom
// réservé du canal de production côté Firebase, on le normalise donc en null.
const rawChannel = argValue("channel");
const CHANNEL_ID = rawChannel && rawChannel !== "live" ? rawChannel : null;

// Firebase plafonne la durée de vie d'un canal de prévisualisation à 30 jours.
const TTL_DAYS = Number(argValue("ttl") ?? 7);

function validateArgs() {
  if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(SITE_ID)) {
    throw new Error(`--site invalide: "${SITE_ID}" (minuscules, chiffres et -, 30 caractères max)`);
  }
  if (IS_MARKETING && !EXPLICIT_SITE) {
    throw new Error(
      "--marketing exige --site=<id-du-site-marketing> : sans lui on déploierait le site " +
        "marketing sur le site de l'app par défaut (pairwise-12df2), écrasant l'application."
    );
  }
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

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
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
    { config: hostingConfig() }
  );
  const versionName = version.name;
  console.log("Version:", versionName);

  const files = walk(SOURCE_DIR);
  const hashToGz = new Map();
  const pathToHash = {};
  for (const f of files) {
    const gz = gzipSync(readFileSync(f));
    const hash = createHash("sha256").update(gz).digest("hex");
    const urlPath = "/" + relative(SOURCE_DIR, f).split("\\").join("/");
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
    console.log(`Déployé (${IS_MARKETING ? "marketing" : "app"}): https://${SITE_ID}.web.app`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
