#!/usr/bin/env node
// Simule une requête contre les règles Storage EN PRODUCTION, via l'API
// firebaserules (`:test`), pour savoir quelle expression refuse — au lieu de
// deviner à partir d'un `storage/unauthorized` côté navigateur.
//
// Dans Cloud Shell, aucune clé n'est nécessaire : le module d'auth partagé
// retombe sur `gcloud auth print-access-token`.
//
// Usage :
//   node scripts/diagnose-rules.js --couple=75YUC9 --uid=eFGy4qiy…
//   node scripts/diagnose-rules.js --couple=… --uid=… --method=get
//   node scripts/diagnose-rules.js --couple=… --uid=… --source        (affiche les règles en ligne)
//
// Note d'honnêteté : la forme exacte d'un cas de test Storage pour cette API
// est peu documentée. Le script imprime donc TOUJOURS la réponse brute — si la
// requête est mal formée, la réponse le dira, et c'est déjà une information.
import { getAccessToken, api } from "./lib/firebaseApi.js";

const PROJECT_ID = "pairwise-12df2";
const RULES_API = "https://firebaserules.googleapis.com/v1";
const BUCKET = argValue("bucket") || "pairwise-12df2.firebasestorage.app";
const RELEASE = `projects/${PROJECT_ID}/releases/firebase.storage/${BUCKET}`;

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}
const hasFlag = (name) => process.argv.slice(2).includes(`--${name}`);

const COUPLE_ID = argValue("couple");
const UID = argValue("uid");
const METHOD = argValue("method") || "create";
const FILE = argValue("file") || "diagnostic.jpg";

async function main() {
  console.log("Auth...");
  const token = await getAccessToken();

  // 1. Quel ruleset est réellement servi ? C'est la seule source de vérité —
  //    le contenu du dépôt peut être en avance sur ce qui est déployé.
  const release = await api(token, "GET", `${RULES_API}/${RELEASE}`);
  console.log(`\nRuleset en production : ${release.rulesetName}`);
  console.log(`Publié le             : ${release.updateTime}`);

  if (hasFlag("source")) {
    const ruleset = await api(token, "GET", `${RULES_API}/${release.rulesetName}`);
    console.log("\n─── Règles en ligne ───\n");
    console.log(ruleset.source.files[0].content);
    return;
  }

  if (!COUPLE_ID || !UID) {
    throw new Error(
      "Précisez --couple=<coupleId> et --uid=<uid>, ou --source pour afficher les règles."
    );
  }

  // 2. Simuler la requête. `expressionReportLevel: FULL` est l'intérêt de
  //    l'exercice : la réponse détaille chaque sous-expression et sa valeur,
  //    donc on voit laquelle vaut false au lieu de le déduire.
  const objectPath = `receipts/${COUPLE_ID}/${FILE}`;
  console.log(`\nSimulation : ${METHOD} sur ${objectPath}`);
  console.log(`  uid = ${UID}`);

  const testCase = {
    expectation: "ALLOW",
    expressionReportLevel: "FULL",
    request: {
      auth: { uid: UID, token: { firebase: { sign_in_provider: "password" } } },
      path: `/b/${BUCKET}/o/${objectPath}`,
      method: METHOD,
      time: new Date().toISOString(),
      resource: {
        name: objectPath,
        bucket: BUCKET,
        size: 120000,
        contentType: "image/jpeg",
      },
    },
  };

  const result = await api(token, "POST", `${RULES_API}/${release.rulesetName}:test`, {
    testSuite: { testCases: [testCase] },
  });

  const tr = result?.testResults?.[0];
  console.log(`\nVerdict : ${tr?.state || "(aucun)"}`);

  // Les messages de debug pointent la ligne/colonne du refus.
  for (const m of tr?.debugMessages || []) console.log(`  ${m}`);

  // Le rapport d'expressions est ce qui répond vraiment à « pourquoi ».
  const exprs = tr?.expressionReports || [];
  if (exprs.length) {
    console.log("\n─── Expressions évaluées ───");
    walk(exprs, 0);
  }

  console.log("\n─── Réponse brute ───");
  console.log(JSON.stringify(result, null, 2));
}

// Le rapport est un arbre : on l'aplatit en gardant l'indentation, pour lire
// d'un coup d'œil quelle branche casse.
function walk(reports, depth) {
  for (const r of reports) {
    const where = r.sourcePosition
      ? `L${r.sourcePosition.line}:${r.sourcePosition.column}`
      : "?";
    console.log(`${"  ".repeat(depth)}${where}  ${JSON.stringify(r.value)}`);
    if (r.children?.length) walk(r.children, depth + 1);
  }
}

main().catch((err) => {
  console.error(`\n${err.message || err}`);
  if (err.status === 403) {
    console.error(
      "\n403 : le compte utilisé n'a pas la permission `firebaserules.rulesets.test`.\n" +
        "Dans Cloud Shell avec un compte propriétaire, cela ne devrait pas arriver."
    );
  }
  process.exit(1);
});
