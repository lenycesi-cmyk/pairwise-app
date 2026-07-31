// Authentification par compte de service + petit client REST, partagés par les
// scripts de déploiement. `firebase-tools` étant inutilisable sur cette machine
// (incompatible avec la pile HTTP de Node 24), tout passe par les API REST.
//
// NOTE : deploy-functions.js, deploy-rules.js et debug-push.js embarquent
// encore leur propre copie de cette logique. Les migrer serait souhaitable,
// mais ce sont des chemins critiques — à faire dans un lot dédié.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

export const HOSTING_API = "https://firebasehosting.googleapis.com/v1beta1";

const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "C:\\Users\\Chenipe\\Documents\\Projet Pairwise\\Keys\\pairwise-12df2-97a5d677db9b.json";

function loadServiceAccountKey() {
  // En CI/cloud il n'y a pas de système de fichiers persistant pour y déposer la clé:
  // on accepte aussi le JSON brut de la clé via une variable d'environnement.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
  return JSON.parse(readFileSync(KEY_PATH, "utf8"));
}

export async function getAccessToken() {
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

export async function api(token, method, url, body) {
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
    // Exposé à part : les appelants distinguent un 409 (ressource déjà là, cas
    // normal) ou un 501 (endpoint absent) d'une vraie panne.
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}
