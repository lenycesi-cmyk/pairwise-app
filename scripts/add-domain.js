#!/usr/bin/env node
// Ajoute (ou liste) un domaine personnalisé sur Firebase Hosting via l'API REST.
//
// Pourquoi ce script : la console Firebase appelle `ListCustomDomains` /
// `CreateCustomDomain` (nouvelle API `sites.customDomains`) et reçoit un 501 sur
// ce projet — l'ajout de domaine est donc impossible depuis l'interface. On passe
// par l'ANCIENNE API `sites/{site}/domains`, celle qui a servi à créer
// pairwise.finance et www.pairwise.finance, et qui répond toujours.
//
// Usage :
//   node scripts/add-domain.js --list
//   node scripts/add-domain.js --domain=app.pairwise.finance
//   node scripts/add-domain.js --domain=app.pairwise.finance --site=pairwise-12df2
//
// L'ajout ne fait que déclarer le domaine côté Firebase. Il reste à créer les
// enregistrements DNS que le script affiche, chez le registrar, pour que la
// validation et le certificat TLS aboutissent.
import { getAccessToken, api, HOSTING_API } from "./lib/firebaseApi.js";

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const SITE_ID = argValue("site") || process.env.FIREBASE_HOSTING_SITE || "pairwise-12df2";
const DOMAIN = argValue("domain");
const LIST_ONLY = process.argv.slice(2).includes("--list");

function domainsUrl() {
  return `${HOSTING_API}/sites/${SITE_ID}/domains`;
}

// Les enregistrements à créer chez le registrar sont dispersés dans la réponse :
// `provisioning` porte le défi de certificat, `expectedIps` les A à poser.
function printDnsInstructions(domain) {
  const p = domain.provisioning || {};
  console.log("\n── DNS à configurer chez le registrar ──");

  if (p.expectedIps?.length) {
    console.log(`\nEnregistrements A pour ${domain.domainName} :`);
    for (const ip of p.expectedIps) console.log(`  A    ${domain.domainName}    ${ip}`);
  }

  const dnsChallenge = p.certChallengeDns;
  if (dnsChallenge?.domainName) {
    console.log(`\nDéfi de certificat (TXT) :`);
    console.log(`  TXT  ${dnsChallenge.domainName}    ${dnsChallenge.token || ""}`);
  }

  const httpChallenge = p.certChallengeHttp;
  if (httpChallenge?.path) {
    console.log(`\nDéfi de certificat (HTTP) — servi automatiquement par Hosting :`);
    console.log(`  ${httpChallenge.path}`);
  }

  if (!p.expectedIps?.length && !dnsChallenge && !httpChallenge) {
    console.log("  (aucune instruction renvoyée — relancez --list dans quelques minutes)");
  }
}

function printDomain(d) {
  const status = d.status || "?";
  const cert = d.provisioning?.certStatus || "?";
  console.log(`  ${d.domainName.padEnd(32)} status=${status}  cert=${cert}`);
}

async function main() {
  if (!LIST_ONLY && !DOMAIN) {
    throw new Error("Précisez --domain=<domaine> ou --list");
  }
  if (DOMAIN && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(DOMAIN)) {
    throw new Error(`Domaine invalide: "${DOMAIN}"`);
  }

  console.log("Auth...");
  const token = await getAccessToken();

  // On liste d'abord dans tous les cas : ça valide que l'ancienne API répond
  // (contrairement à la console) et ça évite un POST inutile si le domaine est
  // déjà déclaré.
  console.log(`Domaines déclarés sur le site "${SITE_ID}" :`);
  const existing = await api(token, "GET", domainsUrl());
  const domains = existing?.domains || [];
  if (domains.length === 0) console.log("  (aucun)");
  else domains.forEach(printDomain);

  if (LIST_ONLY) return;

  const already = domains.find((d) => d.domainName === DOMAIN);
  if (already) {
    console.log(`\n"${DOMAIN}" est déjà déclaré. Instructions DNS :`);
    printDnsInstructions(already);
    return;
  }

  console.log(`\nAjout de "${DOMAIN}"...`);
  // `site` attend l'identifiant nu, pas le chemin `sites/{id}` : l'API rejette
  // ce dernier avec « Mismatched sites in request ». C'est bien la forme que
  // renvoie le GET ci-dessus (`"site": "pairwise-12df2"`).
  const created = await api(token, "POST", domainsUrl(), {
    site: SITE_ID,
    domainName: DOMAIN,
  });
  console.log("Domaine créé.");
  printDnsInstructions(created);

  console.log(
    "\nUne fois le DNS en place, suivez l'avancement avec :\n" +
      `  node scripts/add-domain.js --list${SITE_ID !== "pairwise-12df2" ? ` --site=${SITE_ID}` : ""}`
  );
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  if (err.status === 501) {
    console.error(
      "\n501 sur l'ancienne API également : le projet ne peut plus gérer ses\n" +
        "domaines par cette voie. Il faut passer par le support Firebase."
    );
  }
  process.exit(1);
});
