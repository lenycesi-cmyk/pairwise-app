// Client Enable Banking (agrégateur PSD2 européen), volontairement PUR : aucune
// dépendance Firebase, il ne fait que parler à l'API. Le câblage (Firestore,
// secrets, dispatch par provider) vit dans index.js.
//
// Modèle Enable Banking (≠ Plaid) :
//  1. Auth : un JWT RS256 signé avec la clé privée de l'application (kid = App ID)
//     sert de Bearer pour tous les appels.
//  2. Lien : POST /auth → renvoie une URL vers la banque (flux REDIRECT, pas de
//     SDK popup). L'utilisateur consent, la banque redirige vers redirect_url?code=…
//  3. Session : POST /sessions { code } → { session_id, accounts:[{uid}], … }.
//  4. Données : GET /accounts/{uid}/balances.
//  5. Fin : DELETE /sessions/{session_id}.
//
// Docs : https://enablebanking.com/docs/api/reference/
const crypto = require("node:crypto");

const EB_BASE = "https://api.enablebanking.com";

// JWT RS256 signé avec la clé privée de l'app (valide 1h) — sert de Bearer.
function signJwt(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 3600,
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${b64(header)}.${b64(payload)}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signingInput)
    .sign(privateKeyPem, "base64url");
  return `${signingInput}.${signature}`;
}

async function ebFetch({ appId, privateKey }, method, path, body) {
  const res = await fetch(`${EB_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${signJwt(appId, privateKey)}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Enable Banking ${method} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// Démarre une autorisation : renvoie l'URL vers la banque + l'id d'autorisation.
// `validUntilDays` = durée de validité du consentement (max ~90j selon la banque).
async function startAuth(creds, { redirectUrl, aspspName, aspspCountry, state, validUntilDays = 90 }) {
  const validUntil = new Date(Date.now() + validUntilDays * 86400_000).toISOString();
  const data = await ebFetch(creds, "POST", "/auth", {
    access: { valid_until: validUntil },
    aspsp: { name: aspspName, country: aspspCountry },
    state,
    redirect_url: redirectUrl,
    psu_type: "personal",
  });
  return { url: data.url, authorizationId: data.authorization_id };
}

// Échange le `code` (reçu sur la redirect_url) contre une session + les comptes.
async function createSession(creds, code) {
  const data = await ebFetch(creds, "POST", "/sessions", { code });
  return {
    sessionId: data.session_id,
    accounts: data.accounts || [], // [{ uid, name, ... }]
    aspsp: data.aspsp, // { name, country }
  };
}

// Choisit un solde pertinent parmi les types renvoyés (dispo courant en priorité).
function pickBalance(balances) {
  if (!balances || !balances.length) return null;
  const order = ["ITAV", "XPCD", "CLBD", "PRCD"]; // interim available → expected → closing booked
  for (const type of order) {
    const b = balances.find((x) => x.balance_type === type);
    if (b) return b;
  }
  return balances[0];
}

// Récupère le solde d'un compte (par son uid de session).
async function getBalance(creds, accountUid) {
  const data = await ebFetch(creds, "GET", `/accounts/${accountUid}/balances`, null);
  const b = pickBalance(data.balances);
  if (!b) return { balance: 0, currency: "EUR" };
  return {
    balance: Number(b.balance_amount?.amount ?? 0),
    currency: b.balance_amount?.currency || "EUR",
  };
}

// Termine une session (déconnexion). Best-effort : ne jette pas.
async function endSession(creds, sessionId) {
  if (!sessionId) return;
  await ebFetch(creds, "DELETE", `/sessions/${sessionId}`, null).catch(() => {});
}

module.exports = { startAuth, createSession, getBalance, endSession };
