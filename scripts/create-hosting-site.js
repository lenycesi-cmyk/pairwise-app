#!/usr/bin/env node
// Crée un nouveau site Firebase Hosting dans le projet, via l'API REST (comme
// deploy.js / deploy-rules.js), parce que firebase-tools est inutilisable sur
// cette machine (Node 24). Sert à provisionner le site marketing de l'apex
// pairwise.finance, distinct du site de l'app (pairwise-12df2).
//
// Usage :
//   node scripts/create-hosting-site.js pairwise-www
//
// Le compte de service de déploiement (Firebase Hosting Admin) a le droit
// `firebasehosting.sites.create`. Après création, le site est vide et joignable
// sur https://<id>.web.app ; on y déploie avec :
//   node scripts/deploy.js --marketing --site=<id>
import { getAccessToken, api, HOSTING_API } from "./lib/firebaseApi.js";

const PROJECT = process.env.FIREBASE_PROJECT || "pairwise-12df2";
const siteId = process.argv[2];

if (!siteId) {
  console.error("Usage: node scripts/create-hosting-site.js <site-id>");
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(siteId)) {
  console.error(`Id invalide: "${siteId}" (minuscules, chiffres et -, 30 caractères max)`);
  process.exit(1);
}

async function main() {
  console.log("Auth...");
  const token = await getAccessToken();

  console.log(`Création du site "${siteId}" dans le projet ${PROJECT}...`);
  try {
    const site = await api(
      token,
      "POST",
      `${HOSTING_API}/projects/${PROJECT}/sites?siteId=${encodeURIComponent(siteId)}`,
      {}
    );
    console.log("Site créé :", site.name || siteId);
    console.log(`URL par défaut : https://${siteId}.web.app`);
    console.log(`\nÉtape suivante : node scripts/deploy.js --marketing --site=${siteId}`);
  } catch (err) {
    if (err.status === 409) {
      console.log(`Le site "${siteId}" existe déjà — rien à faire.`);
      console.log(`Déploie avec : node scripts/deploy.js --marketing --site=${siteId}`);
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
