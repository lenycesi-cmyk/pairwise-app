#!/usr/bin/env node
// Déploie les règles de sécurité via l'API REST firebaserules.googleapis.com,
// en contournant firebase-tools (incompatible Node 24 sur cette machine, cf.
// deploy.js / CLAUDE.md). Le compte de service de déploiement a le rôle
// `Firebase Rules Admin`. Deux appels : création d'un ruleset, puis mise à jour
// de la release qui pointe dessus.
//
// Usage :
//   node scripts/deploy-rules.js                  → firestore.rules (défaut)
//   node scripts/deploy-rules.js --target=storage → storage.rules
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAccessToken, api } from "./lib/firebaseApi.js";

const PROJECT_ID = "pairwise-12df2";
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "pairwise-12df2.firebasestorage.app";

// Chaque produit a sa propre release. Firestore en a une seule pour le projet ;
// Storage en a une par bucket, d'où le suffixe.
const TARGETS = {
  firestore: {
    file: "firestore.rules",
    release: `projects/${PROJECT_ID}/releases/cloud.firestore`,
  },
  storage: {
    file: "storage.rules",
    release: `projects/${PROJECT_ID}/releases/firebase.storage/${STORAGE_BUCKET}`,
  },
};

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const TARGET_NAME = argValue("target") || "firestore";

async function main() {
  const target = TARGETS[TARGET_NAME];
  if (!target) {
    throw new Error(
      `--target inconnu: "${TARGET_NAME}" (attendu: ${Object.keys(TARGETS).join(" ou ")})`
    );
  }

  console.log("Auth...");
  const token = await getAccessToken();

  const source = readFileSync(join(import.meta.dirname, "..", target.file), "utf8");
  console.log(`Création du ruleset (${target.file})...`);
  const ruleset = await api(
    token,
    "POST",
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets`,
    { source: { files: [{ name: target.file, content: source }] } }
  );
  console.log("Ruleset:", ruleset.name);

  // On tente de mettre à jour la release existante ; si elle n'existe pas
  // encore (premier déploiement), on la crée.
  console.log(`Mise à jour de la release ${target.release}...`);
  try {
    await api(
      token,
      "PATCH",
      `https://firebaserules.googleapis.com/v1/${target.release}`,
      // Corps de type UpdateReleaseRequest : la Release est imbriquée sous
      // `release` (un `rulesetName` au premier niveau est rejeté en 400).
      { release: { name: target.release, rulesetName: ruleset.name }, updateMask: "rulesetName" }
    );
  } catch (err) {
    if (err.status !== 404) throw err;
    console.log("Release absente → création...");
    await api(
      token,
      "POST",
      `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases`,
      { name: target.release, rulesetName: ruleset.name }
    );
  }

  console.log(`Règles ${TARGET_NAME} déployées ✓`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
