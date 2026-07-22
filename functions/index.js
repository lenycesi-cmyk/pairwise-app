const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("node:crypto");
const { KeyManagementServiceClient } = require("@google-cloud/kms");
const { PlaidApi, PlaidEnvironments, Configuration } = require("plaid");
const eb = require("./enableBanking");

admin.initializeApp();
const db = admin.firestore();

// ── Chiffrement des access_token Plaid au repos (Cloud KMS) ──────────────────
// Les access_token vivent dans la sous-collection bankConnections (jamais
// accessible côté client). Pour une défense en profondeur (accès admin/console,
// exports, fuite d'une sauvegarde), on les chiffre avec une clé symétrique
// Cloud KMS avant de les écrire, et on les déchiffre à la volée côté serveur.
//
// Activation opt-in : tant que KMS_KEY_NAME n'est pas positionné (clé non
// provisionnée), les tokens sont stockés en clair — comportement historique,
// pour ne rien casser au déploiement. Les lectures gèrent les deux formats, si
// bien que d'anciennes connexions en clair continuent de fonctionner même une
// fois KMS activé ; elles basculent en chiffré au prochain ré-échange.
// Provisionnement : voir CLAUDE.md (keyring/clé + rôle
// roles/cloudkms.cryptoKeyEncrypterDecrypter sur le SA + variable KMS_KEY_NAME).
const KMS_KEY_NAME = process.env.KMS_KEY_NAME || "";
let kmsClient = null;
function getKms() {
  if (!kmsClient) kmsClient = new KeyManagementServiceClient();
  return kmsClient;
}

// Renvoie les champs à fusionner dans le doc bankConnections pour stocker le
// token : { accessTokenEnc } si KMS est actif, sinon { accessToken } en clair.
async function encryptToken(plaintext) {
  if (!KMS_KEY_NAME) return { accessToken: plaintext, accessTokenEnc: null };
  const [res] = await getKms().encrypt({
    name: KMS_KEY_NAME,
    plaintext: Buffer.from(plaintext, "utf8"),
  });
  // On efface l'éventuel champ en clair historique en le passant à null.
  return { accessTokenEnc: res.ciphertext.toString("base64"), accessToken: null };
}

// Déchiffre le token d'un doc bankConnections, quel que soit son format.
async function decryptToken(data) {
  if (data.accessTokenEnc) {
    const [res] = await getKms().decrypt({
      name: KMS_KEY_NAME,
      ciphertext: Buffer.from(data.accessTokenEnc, "base64"),
    });
    return res.plaintext.toString("utf8");
  }
  return data.accessToken; // ancien format en clair
}

// Secrets (set via: firebase functions:secrets:set PLAID_CLIENT_ID etc.)
const PLAID_CLIENT_ID = defineSecret("PLAID_CLIENT_ID");
const PLAID_SECRET = defineSecret("PLAID_SECRET");
const PLAID_ENV = defineSecret("PLAID_ENV"); // "sandbox" | "production"

// Secrets réellement injectés par le pipeline de déploiement (scripts/
// deploy-functions.js). On garde ici les 3 secrets Plaid : le provider Enable
// Banking est opt-in et lu séparément via process.env (voir ebCreds), pour
// n'ajouter aucune dépendance à un secret inexistant tant qu'il n'est pas
// provisionné — sinon le déploiement échouerait.
const BANK_SECRETS = [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV];

// URL de redirection enregistrée dans l'app Enable Banking (le front doit gérer
// ce retour ?code=…&state=… — lot frontend à venir).
const ENABLE_BANKING_REDIRECT_URL =
  process.env.ENABLE_BANKING_REDIRECT_URL || "https://pairwise.finance/bank-callback";

// Credentials Enable Banking depuis l'environnement (ou null si non configuré →
// provider indisponible, comportement Plaid inchangé). ENABLE_BANKING_KEY = clé
// privée RSA (PEM) de l'application. Injectés une fois ajoutés à
// deploy-functions.js, voir CLAUDE.md.
function ebCreds() {
  const appId = process.env.ENABLE_BANKING_APP_ID;
  const privateKey = process.env.ENABLE_BANKING_KEY;
  if (!appId || !privateKey) return null;
  return { appId, privateKey };
}

// URL publique du webhook Plaid (alias cloudfunctions.net de la fonction v2
// plaidWebhook, en europe-west1). Passée à Plaid dans createLinkToken pour
// qu'il notifie ce endpoint des événements d'item (re-auth, révocation, MAJ).
const PLAID_WEBHOOK_URL =
  "https://europe-west1-pairwise-12df2.cloudfunctions.net/plaidWebhook";

function getPlaidClient(clientId, secret, env) {
  const config = new Configuration({
    basePath: PlaidEnvironments[env] || PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(config);
}

/**
 * Step 1 — Create a Plaid link_token for the frontend to open Plaid Link.
 * Called with: { coupleId, assetId, language }
 */
exports.createLinkToken = onCall(
  { secrets: BANK_SECRETS },
  async (request) => {
    const { coupleId, assetId, language = "fr", update = false, provider = "plaid" } = request.data;
    if (!coupleId || !assetId) throw new HttpsError("invalid-argument", "coupleId and assetId required");
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");

    // ── Provider Enable Banking : flux REDIRECT ────────────────────────────
    // Pas de link_token ni de popup : on renvoie une URL vers la banque. Le
    // front redirige l'utilisateur, puis rappelle `exchangeToken` avec le `code`.
    if (provider === "enableBanking") {
      const creds = ebCreds();
      if (!creds) throw new HttpsError("failed-precondition", "Enable Banking not configured");
      const { aspspName, aspspCountry = "FR" } = request.data;
      if (!aspspName) throw new HttpsError("invalid-argument", "aspspName required");
      // `state` encode couple+asset pour retrouver la connexion au retour.
      const state = `${coupleId}:${assetId}:${request.auth.uid}`;
      const { url, authorizationId } = await eb.startAuth(creds, {
        redirectUrl: ENABLE_BANKING_REDIRECT_URL,
        aspspName, aspspCountry, state,
      });
      return { provider: "enableBanking", mode: "redirect", url, authorizationId, state };
    }

    const plaid = getPlaidClient(
      PLAID_CLIENT_ID.value(),
      PLAID_SECRET.value(),
      PLAID_ENV.value()
    );

    const params = {
      user: { client_user_id: request.auth.uid },
      client_name: "Pairwise",
      country_codes: ["FR", "BE", "CH", "LU", "CA", "US", "GB", "DE", "ES", "NL"],
      language,
      webhook: PLAID_WEBHOOK_URL,
    };

    if (update) {
      // Mode "update" (re-authentification d'un item existant après une
      // ITEM_LOGIN_REQUIRED / expiration) : on fournit l'access_token existant et
      // on omet `products` — Plaid rouvre Link sur la même connexion.
      const connDoc = await db
        .collection("couples").doc(coupleId)
        .collection("bankConnections").doc(assetId)
        .get();
      if (!connDoc.exists) throw new HttpsError("not-found", "No bank connection for this asset");
      params.access_token = await decryptToken(connDoc.data());
    } else {
      params.products = ["transactions", "auth"];
    }

    const response = await plaid.linkTokenCreate(params);

    return { linkToken: response.data.link_token };
  }
);

/**
 * Step 2 — Exchange the public_token returned by Plaid Link for an access_token.
 * Stores the connection in Firestore and does an initial balance sync.
 * Called with: { coupleId, assetId, publicToken, accountId, institutionName }
 */
exports.exchangeToken = onCall(
  { secrets: BANK_SECRETS },
  async (request) => {
    const { coupleId, assetId, publicToken, accountId, institutionName, provider = "plaid" } = request.data;
    if (!coupleId || !assetId) throw new HttpsError("invalid-argument", "coupleId and assetId required");
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");

    // ── Provider Enable Banking : crée la session depuis le `code` de retour ──
    if (provider === "enableBanking") {
      const creds = ebCreds();
      if (!creds) throw new HttpsError("failed-precondition", "Enable Banking not configured");
      const { code, accountUid } = request.data;
      if (!code) throw new HttpsError("invalid-argument", "code required");
      const session = await eb.createSession(creds, code);
      const account = accountUid
        ? session.accounts.find((a) => a.uid === accountUid)
        : session.accounts[0];
      if (!account) throw new HttpsError("not-found", "Account not found");
      const { balance, currency } = await eb.getBalance(creds, account.uid);
      const instName = institutionName || session.aspsp?.name || "Bank";

      await db.collection("couples").doc(coupleId).collection("bankConnections").doc(assetId).set({
        provider: "enableBanking",
        sessionId: session.sessionId,
        accountUid: account.uid,
        institutionName: instName,
        assetId,
        coupleId,
        status: "active",
        lastSync: admin.firestore.FieldValue.serverTimestamp(),
      });

      const coupleDoc = await db.collection("couples").doc(coupleId).get();
      const assets = coupleDoc.data()?.assets || [];
      const updatedAssets = assets.map((a) =>
        a.id === assetId
          ? { ...a, value: balance, currency, bankConnected: true, bankInstitution: instName, lastBankSync: Date.now() }
          : a
      );
      await db.collection("couples").doc(coupleId).set({ assets: updatedAssets }, { merge: true });
      return { success: true, balance, currency, accountName: account.name || instName };
    }

    if (!publicToken) throw new HttpsError("invalid-argument", "publicToken required");

    const plaid = getPlaidClient(
      PLAID_CLIENT_ID.value(),
      PLAID_SECRET.value(),
      PLAID_ENV.value()
    );

    // Exchange public_token → access_token
    const exchangeRes = await plaid.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token: accessToken, item_id: itemId } = exchangeRes.data;

    // Fetch accounts to get the selected account info
    const accountsRes = await plaid.accountsGet({ access_token: accessToken });
    const accounts = accountsRes.data.accounts;
    const selectedAccount = accountId
      ? accounts.find((a) => a.account_id === accountId)
      : accounts[0];

    if (!selectedAccount) throw new HttpsError("not-found", "Account not found");

    const balance = selectedAccount.balances.current ?? selectedAccount.balances.available ?? 0;
    const isoCurrency = selectedAccount.balances.iso_currency_code || "EUR";

    // Store connection securely in a server-side-only subcollection
    await db
      .collection("couples")
      .doc(coupleId)
      .collection("bankConnections")
      .doc(assetId)
      .set({
        provider: "plaid",
        // Token stocké côté serveur uniquement, chiffré au repos si KMS est
        // actif (accessTokenEnc) sinon en clair (accessToken) — cf. encryptToken.
        ...(await encryptToken(accessToken)),
        itemId,
        plaidAccountId: selectedAccount.account_id,
        institutionName: institutionName || selectedAccount.name,
        accountMask: selectedAccount.mask,
        assetId,
        coupleId,
        status: "active",
        lastSync: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Correspondance item_id → couple/asset, pour que le webhook (qui ne reçoit
    // qu'un item_id) retrouve la connexion directement, sans requête
    // collectionGroup (qui exigerait un index dédié).
    await db.collection("plaidItems").doc(itemId).set({ coupleId, assetId });

    // Update the asset value with the fetched balance
    const coupleDoc = await db.collection("couples").doc(coupleId).get();
    const assets = coupleDoc.data()?.assets || [];
    const updatedAssets = assets.map((a) =>
      a.id === assetId
        ? {
            ...a,
            value: balance,
            currency: isoCurrency,
            bankConnected: true,
            bankInstitution: institutionName || selectedAccount.official_name || selectedAccount.name,
            bankMask: selectedAccount.mask,
            lastBankSync: Date.now(),
          }
        : a
    );
    await db.collection("couples").doc(coupleId).set({ assets: updatedAssets }, { merge: true });

    return {
      success: true,
      balance,
      currency: isoCurrency,
      accountName: selectedAccount.name,
      mask: selectedAccount.mask,
    };
  }
);

/**
 * Step 3 — Sync balances for one specific asset (called on-demand from the UI).
 * Called with: { coupleId, assetId }
 */
exports.syncBalance = onCall(
  { secrets: BANK_SECRETS },
  async (request) => {
    const { coupleId, assetId } = request.data;
    if (!coupleId || !assetId) throw new HttpsError("invalid-argument", "coupleId and assetId required");
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");

    const result = await syncAssetBalance(coupleId, assetId);
    return result;
  }
);

/**
 * Disconnect a bank connection.
 * Called with: { coupleId, assetId }
 */
exports.disconnectBank = onCall(
  { secrets: BANK_SECRETS },
  async (request) => {
    const { coupleId, assetId } = request.data;
    if (!coupleId || !assetId) throw new HttpsError("invalid-argument", "Missing params");
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");

    const connDoc = await db
      .collection("couples").doc(coupleId)
      .collection("bankConnections").doc(assetId)
      .get();

    if (connDoc.exists) {
      const data = connDoc.data();
      if (data.provider === "enableBanking") {
        const creds = ebCreds();
        if (creds) await eb.endSession(creds, data.sessionId);
      } else {
        const { itemId } = data;
        const accessToken = await decryptToken(data);
        const plaid = getPlaidClient(
          PLAID_CLIENT_ID.value(),
          PLAID_SECRET.value(),
          PLAID_ENV.value()
        );
        try {
          await plaid.itemRemove({ access_token: accessToken });
        } catch (_) {
          // ignore Plaid errors on removal
        }
        if (itemId) await db.collection("plaidItems").doc(itemId).delete().catch(() => {});
      }
      await connDoc.ref.delete();
    }

    // Remove bank connection metadata from the asset
    const coupleDoc = await db.collection("couples").doc(coupleId).get();
    const assets = coupleDoc.data()?.assets || [];
    const updatedAssets = assets.map((a) =>
      a.id === assetId
        ? { ...a, bankConnected: false, bankInstitution: null, bankMask: null, lastBankSync: null }
        : a
    );
    await db.collection("couples").doc(coupleId).set({ assets: updatedAssets }, { merge: true });

    return { success: true };
  }
);

/**
 * Scheduled job — sync all bank balances every hour.
 */
exports.syncAllBalances = onSchedule(
  { schedule: "every 60 minutes", secrets: BANK_SECRETS },
  async () => {
    const couplesSnap = await db.collection("couples").get();
    for (const coupleDoc of couplesSnap.docs) {
      const connectionsSnap = await coupleDoc.ref.collection("bankConnections").get();
      for (const connDoc of connectionsSnap.docs) {
        const { assetId, coupleId } = connDoc.data();
        try {
          await syncAssetBalance(coupleId, assetId);
        } catch (err) {
          console.error(`Sync failed for ${coupleId}/${assetId}:`, err.message);
        }
      }
    }
  }
);

// ── Internal helper ──────────────────────────────────────────────────────────

async function syncAssetBalance(coupleId, assetId) {
  const connRef = db.collection("couples").doc(coupleId).collection("bankConnections").doc(assetId);
  const connDoc = await connRef.get();
  if (!connDoc.exists) throw new HttpsError("not-found", "No bank connection for this asset");

  const data = connDoc.data();
  let balance, isoCurrency;

  if (data.provider === "enableBanking") {
    const creds = ebCreds();
    if (!creds) throw new HttpsError("failed-precondition", "Enable Banking not configured");
    ({ balance, currency: isoCurrency } = await eb.getBalance(creds, data.accountUid));
  } else {
    const { plaidAccountId } = data;
    const accessToken = await decryptToken(data);
    const env = process.env.PLAID_ENV || "sandbox";
    const plaid = getPlaidClient(
      process.env.PLAID_CLIENT_ID || PLAID_CLIENT_ID.value(),
      process.env.PLAID_SECRET || PLAID_SECRET.value(),
      env
    );

    const accountsRes = await plaid.accountsGet({ access_token: accessToken });
    const account = accountsRes.data.accounts.find((a) => a.account_id === plaidAccountId)
      || accountsRes.data.accounts[0];

    if (!account) throw new HttpsError("not-found", "Plaid account not found");

    balance = account.balances.current ?? account.balances.available ?? 0;
    isoCurrency = account.balances.iso_currency_code || "EUR";
  }

  // Update asset in couple doc
  const coupleDoc = await db.collection("couples").doc(coupleId).get();
  const assets = coupleDoc.data()?.assets || [];
  const updatedAssets = assets.map((a) =>
    a.id === assetId
      ? { ...a, value: balance, currency: isoCurrency, lastBankSync: Date.now() }
      : a
  );
  await db.collection("couples").doc(coupleId).set({ assets: updatedAssets }, { merge: true });
  await connRef.update({ lastSync: admin.firestore.FieldValue.serverTimestamp(), status: "active" });

  return { success: true, balance, currency: isoCurrency };
}

// ── Couple membership (server-side join) ─────────────────────────────────────

/**
 * Join a couple by its invite code. Runs server-side (admin) because the
 * Firestore rules now restrict couple reads/writes to existing members — a
 * not-yet-member cannot inspect or edit the couple doc from the client.
 *
 * Called with: { code, claimMemberId?, name? }
 * Returns:
 *   { status: "joined" }                         — caller is now a member
 *   { status: "needs_identity", placeholder }    — a placeholder must be claimed
 *
 * The invite code (the couple doc id) is the shared secret that authorises the
 * join, mirroring the previous client behaviour but without exposing the doc.
 */
exports.joinCouple = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const { code, claimMemberId, name } = request.data || {};
  if (!code) throw new HttpsError("invalid-argument", "code required");

  const uid = request.auth.uid;
  const ref = db.collection("couples").doc(code);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "couple-not-found");

  const members = snap.data().members || [];

  // Already a member (e.g. re-joining after a refresh) — no-op.
  if (members.find((m) => m.uid === uid)) return { status: "joined" };

  const placeholder = members.find((m) => m.uid === null);

  // A placeholder exists but the caller hasn't confirmed which identity to
  // claim yet — ask the client to show the confirm-identity step first.
  if (placeholder && !claimMemberId) {
    return {
      status: "needs_identity",
      placeholder: { memberId: placeholder.memberId, name: placeholder.name },
    };
  }

  let updated;
  if (claimMemberId) {
    const target = members.find((m) => m.memberId === claimMemberId && m.uid === null);
    if (!target) throw new HttpsError("failed-precondition", "placeholder-unavailable");
    updated = members.map((m) =>
      m.memberId === claimMemberId ? { ...m, uid, name: (name || m.name) } : m
    );
  } else {
    const realCount = members.filter((m) => m.uid !== null).length;
    if (realCount >= 2) throw new HttpsError("failed-precondition", "couple-full");
    updated = [...members, { uid, memberId: uid, name: name || "Moi" }];
  }

  await ref.set(
    { members: updated, memberUids: updated.map((m) => m.uid).filter(Boolean) },
    { merge: true }
  );
  return { status: "joined" };
});

/**
 * Purge every bank connection of a couple: revokes each Plaid item and deletes
 * the docs. Called client-side right before deleting the last member's couple
 * (the bankConnections subcollection is no longer client-accessible, so this
 * cleanup — which also holds the Plaid access_tokens — must run as admin).
 *
 * Called with: { coupleId }
 */
exports.purgeBankConnections = onCall(
  { secrets: BANK_SECRETS },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
    const { coupleId } = request.data || {};
    if (!coupleId) throw new HttpsError("invalid-argument", "coupleId required");

    const coupleSnap = await db.collection("couples").doc(coupleId).get();
    const memberUids = coupleSnap.data()?.memberUids || [];
    if (!memberUids.includes(request.auth.uid)) {
      throw new HttpsError("permission-denied", "Not a member of this couple");
    }

    const connSnap = await db
      .collection("couples").doc(coupleId)
      .collection("bankConnections").get();
    if (connSnap.empty) return { success: true, removed: 0 };

    const plaid = getPlaidClient(
      PLAID_CLIENT_ID.value(),
      PLAID_SECRET.value(),
      PLAID_ENV.value()
    );
    for (const connDoc of connSnap.docs) {
      const data = connDoc.data();
      if (data.provider === "enableBanking") {
        const creds = ebCreds();
        if (creds) await eb.endSession(creds, data.sessionId);
      } else {
        const { itemId } = data;
        const accessToken = await decryptToken(data);
        if (accessToken) {
          try {
            await plaid.itemRemove({ access_token: accessToken });
          } catch (_) {
            // best-effort: ignore Plaid errors, still delete the local doc
          }
        }
        if (itemId) await db.collection("plaidItems").doc(itemId).delete().catch(() => {});
      }
      await connDoc.ref.delete();
    }
    return { success: true, removed: connSnap.size };
  }
);

// ── Plaid webhook ────────────────────────────────────────────────────────────

// Cache des clés de vérification Plaid par key_id (elles tournent rarement).
const plaidKeyCache = new Map();

/**
 * Vérifie l'authenticité d'un webhook Plaid (JWT ES256 dans l'en-tête
 * `plaid-verification`) : signature valide avec la clé publique fournie par
 * Plaid, hash SHA-256 du corps brut conforme au claim, et émission récente.
 * Cf. https://plaid.com/docs/api/webhooks/webhook-verification/
 */
async function verifyPlaidWebhook(req, plaid) {
  const token = req.headers["plaid-verification"];
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  let header;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (header.alg !== "ES256" || !header.kid) return false;

  // Récupère (et cache) la clé publique JWK correspondant au kid.
  let jwk = plaidKeyCache.get(header.kid);
  if (!jwk) {
    const res = await plaid.webhookVerificationKeyGet({ key_id: header.kid });
    jwk = res.data.key;
    if (!jwk || jwk.expired_at) return false;
    plaidKeyCache.set(header.kid, jwk);
  }

  // Vérifie la signature ES256 (r||s brut → dsaEncoding ieee-p1363).
  let publicKey;
  try {
    // JWK épuré aux seuls champs EC standard (Plaid ajoute kid/use/alg/…).
    const ec = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
    publicKey = crypto.createPublicKey({ key: ec, format: "jwk" });
  } catch {
    return false;
  }
  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(parts[2], "base64url");
  const sigOk = crypto.verify(
    "sha256",
    Buffer.from(signingInput),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    signature
  );
  if (!sigOk) return false;

  // Corps : le hash du corps brut doit correspondre au claim, et le JWT doit
  // être récent (fenêtre 5 min) pour limiter les rejeux.
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (typeof claims.iat === "number" && Date.now() / 1000 - claims.iat > 300) return false;

  const bodyHash = crypto.createHash("sha256").update(req.rawBody || Buffer.from("")).digest("hex");
  if (claims.request_body_sha256 && claims.request_body_sha256 !== bodyHash) return false;

  return true;
}

// Met à jour l'état d'une connexion bancaire (bankConnections + champ miroir
// sur l'asset, lisible côté client pour afficher un bandeau).
async function setConnectionStatus(coupleId, assetId, status) {
  await db.collection("couples").doc(coupleId).collection("bankConnections").doc(assetId)
    .set({ status, statusAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  const coupleDoc = await db.collection("couples").doc(coupleId).get();
  const assets = coupleDoc.data()?.assets || [];
  const updated = assets.map((a) => (a.id === assetId ? { ...a, bankStatus: status } : a));
  await db.collection("couples").doc(coupleId).set({ assets: updated }, { merge: true });
}

/**
 * Endpoint HTTP appelé par Plaid (non authentifié → on vérifie la signature).
 * Route les événements d'item : re-auth requise, expiration proche, révocation,
 * et rafraîchit le solde quand de nouvelles données sont disponibles.
 */
exports.plaidWebhook = onRequest(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const plaid = getPlaidClient(
      PLAID_CLIENT_ID.value(),
      PLAID_SECRET.value(),
      PLAID_ENV.value()
    );

    // On accuse réception vite ; un échec de vérif renvoie 401.
    let verified = false;
    try {
      verified = await verifyPlaidWebhook(req, plaid);
    } catch (err) {
      console.error("Plaid webhook verification error:", err.message);
    }
    if (!verified) {
      res.status(401).send("Invalid signature");
      return;
    }

    const { webhook_type: type, webhook_code: code, item_id: itemId, error } = req.body || {};
    if (!itemId) {
      res.status(200).send("ok");
      return;
    }

    // item_id → couple/asset
    const mapDoc = await db.collection("plaidItems").doc(itemId).get();
    if (!mapDoc.exists) {
      res.status(200).send("ok"); // item inconnu (déjà déconnecté) — rien à faire
      return;
    }
    const { coupleId, assetId } = mapDoc.data();

    try {
      if (type === "TRANSACTIONS" || (type === "ITEM" && code === "NEW_ACCOUNTS_AVAILABLE")) {
        // De nouvelles données sont dispo → on resynchronise le solde.
        await syncAssetBalance(coupleId, assetId).catch(() => {});
        if (code) await setConnectionStatus(coupleId, assetId, "active");
      } else if (type === "ITEM") {
        if (code === "ERROR" && error?.error_code === "ITEM_LOGIN_REQUIRED") {
          await setConnectionStatus(coupleId, assetId, "reauth_required");
        } else if (code === "PENDING_EXPIRATION") {
          await setConnectionStatus(coupleId, assetId, "pending_expiration");
        } else if (code === "USER_PERMISSION_REVOKED" || code === "USER_ACCOUNT_REVOKED") {
          await setConnectionStatus(coupleId, assetId, "revoked");
        } else if (code === "LOGIN_REPAIRED") {
          await setConnectionStatus(coupleId, assetId, "active");
          await syncAssetBalance(coupleId, assetId).catch(() => {});
        }
      }
    } catch (err) {
      console.error(`Plaid webhook handling failed (${type}/${code}):`, err.message);
    }

    res.status(200).send("ok");
  }
);

// ── Push notifications ───────────────────────────────────────────────────────

// Un token FCM dont le timestamp (mis à jour à chaque ouverture de l'app par
// registerDevice) date de plus de 270 jours est considéré périmé : FCM lui-même
// invalide les tokens inactifs autour de ce seuil. On les purge en amont plutôt
// que d'attendre un échec d'envoi.
const STALE_TOKEN_MS = 270 * 86400000;

/**
 * Envoie un push FCM (message data-only : le Service Worker garde la main
 * sur l'affichage) à tous les appareils des membres ciblés, et purge les
 * tokens invalides/expirés du doc couple.
 */
async function sendPushToMembers(coupleId, coupleData, targetMemberKeys, notification) {
  const fcmTokens = coupleData.fcmTokens || {};
  const now = Date.now();
  const tokens = [];
  const stale = [];
  for (const key of targetMemberKeys) {
    for (const [token, ts] of Object.entries(fcmTokens[key] || {})) {
      // ts = timestamp de dernière inscription (Date.now()) ; peut être absent
      // sur d'anciens enregistrements → on ne le considère pas périmé.
      if (typeof ts === "number" && now - ts > STALE_TOKEN_MS) stale.push(token);
      else tokens.push(token);
    }
  }
  if (tokens.length === 0) {
    console.log(`[sendPush] couple=${coupleId} targets=[${targetMemberKeys.join(",")}] aucun token frais (périmés=${stale.length}) → rien envoyé`);
    if (stale.length > 0) await purgeTokens(coupleId, fcmTokens, stale);
    return;
  }

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    data: {
      title: notification.title,
      body: notification.body,
      tag: notification.tag || "",
      url: notification.url || "/",
    },
  });
  console.log(`[sendPush] couple=${coupleId} tag=${notification.tag || "-"} targets=[${targetMemberKeys.join(",")}] tokens=${tokens.length} ok=${res.successCount} ko=${res.failureCount} périmés=${stale.length}`);

  // Purge des tokens morts (appareil désinstallé, token expiré) + périmés
  const dead = [...stale];
  res.responses.forEach((r, i) => {
    const code = r.error?.code || "";
    if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
      dead.push(tokens[i]);
    }
  });
  if (dead.length > 0) await purgeTokens(coupleId, fcmTokens, dead);
}

// Retire une liste de tokens du champ fcmTokens du doc couple, sans toucher au
// reste du document (update ciblé ; un set sans merge écraserait tout).
async function purgeTokens(coupleId, fcmTokens, tokensToRemove) {
  const remove = new Set(tokensToRemove);
  const cleaned = {};
  for (const [memberKey, byToken] of Object.entries(fcmTokens)) {
    cleaned[memberKey] = Object.fromEntries(
      Object.entries(byToken).filter(([token]) => !remove.has(token))
    );
  }
  console.log(`[sendPush] couple=${coupleId} purge de ${remove.size} token(s) morts/périmés`);
  await db.collection("couples").doc(coupleId).update({ fcmTokens: cleaned });
}

// memberId d'un membre (memberId découplé du uid — voir src/utils/members.js)
function memberKeyOf(member) {
  return member.memberId || member.uid;
}

/**
 * Préférence push d'un membre pour un type donné. Tout est activé par
 * défaut : pushPrefs.{memberKey}.{type} === false pour désactiver.
 * Types : "newTransaction" | "editedTransaction" | "comments" | "recurringReminders"
 */
function prefEnabled(coupleData, memberKey, type) {
  return coupleData.pushPrefs?.[memberKey]?.[type] !== false;
}

/**
 * Envoi de push à la demande, appelé par l'app de l'expéditeur au moment de
 * l'action (nouvelle transaction, modification, commentaire). Choisi plutôt
 * qu'un trigger Firestore/Eventarc car le pipeline de déploiement custom
 * (scripts/deploy-functions.js) ne gère que des fonctions HTTP/callable.
 * Appelé avec : { coupleId, kind, description, amount?, currency?, text?, gifUrl? }
 */
const PUSH_KINDS = {
  newTransaction: "newTransaction",
  editedTransaction: "editedTransaction",
  comment: "comments",
  budgetAlert: "budgetAlerts",
  newBudget: "newBudget",
  newAsset: "newAsset",
  debtSettled: "debtSettled",
};

exports.sendPush = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const { coupleId, kind, description = "", amount, currency, text, gifUrl } = request.data || {};
  const prefType = PUSH_KINDS[kind];
  if (!coupleId || !prefType) throw new HttpsError("invalid-argument", "coupleId and valid kind required");

  const coupleDoc = await db.collection("couples").doc(coupleId).get();
  if (!coupleDoc.exists) throw new HttpsError("not-found", "Couple not found");
  const coupleData = coupleDoc.data();
  const members = coupleData.members || [];

  // L'appelant doit être membre du couple ; les push partent vers les autres.
  const me = members.find((m) => m.uid === request.auth.uid);
  if (!me) throw new HttpsError("permission-denied", "Not a member of this couple");
  const actorKey = memberKeyOf(me);
  // Cible par défaut : tous les autres membres. Pour les alertes budget,
  // le client restreint aux membres concernés par le budget (targetKeys) —
  // un budget personnel ne notifie jamais le/la partenaire.
  const { targetKeys } = request.data || {};
  const targets = members
    .map(memberKeyOf)
    .filter((key) => key && key !== actorKey && prefEnabled(coupleData, key, prefType))
    .filter((key) => !Array.isArray(targetKeys) || targetKeys.includes(key));
  if (targets.length === 0 || !coupleData.fcmTokens) return { sent: 0 };

  const lang = coupleData.language === "en" ? "en" : "fr";
  const amountLabel =
    amount !== undefined && currency
      ? ` — ${Math.round(amount).toLocaleString("fr-FR")} ${currency}`
      : "";

  // Titres courts (prénom + action) pour rester lisibles sur l'écran de
  // verrouillage où le titre est vite tronqué ; le contexte (description,
  // montant) va dans le corps, qui a plus de place.
  const amountOnly =
    amount !== undefined && currency
      ? `${Math.round(amount).toLocaleString("fr-FR")} ${currency}`
      : "";
  const withAmount = (s) => (amountOnly ? `${s} — ${amountOnly}` : s);

  let title, body, tag;
  if (kind === "comment") {
    title = lang === "en" ? `💬 ${me.name}` : `💬 ${me.name}`;
    body = description
      ? `${description}\n${gifUrl ? "GIF 🎬" : text || ""}`
      : (gifUrl ? "GIF 🎬" : text || "");
    tag = `comment_${coupleId}`;
  } else if (kind === "newTransaction") {
    title = lang === "en" ? `${me.name} · new transaction` : `${me.name} · nouvelle transaction`;
    body = withAmount(description || "");
    tag = "tx_new";
  } else if (kind === "editedTransaction") {
    title = lang === "en" ? `${me.name} · edited transaction` : `${me.name} · transaction modifiée`;
    body = withAmount(description || "");
    tag = "tx_edit";
  } else if (kind === "budgetAlert") {
    const { pct } = request.data;
    title = lang === "en" ? "⚠️ Budget alert" : "⚠️ Alerte budget";
    body = lang === "en"
      ? `${description}: ${Math.round(pct)}% of budget reached`
      : `${description} : ${Math.round(pct)}% du budget atteint`;
    tag = `budget_alert_${description}`;
  } else if (kind === "newBudget") {
    title = lang === "en" ? `${me.name} · new budget` : `${me.name} · nouveau budget`;
    body = withAmount(description || "");
    tag = "budget_new";
  } else if (kind === "newAsset") {
    title = lang === "en" ? `${me.name} · new asset` : `${me.name} · nouvel actif`;
    body = withAmount(description || "");
    tag = "asset_new";
  } else {
    title = lang === "en" ? `${me.name} · settled up 💸` : `${me.name} · comptes soldés 💸`;
    body = amountOnly
      ? (lang === "en" ? `Settled balance: ${amountOnly}` : `Solde réglé : ${amountOnly}`)
      : description;
    tag = "debt_settled";
  }

  await sendPushToMembers(coupleId, coupleData, targets, { title, body, tag });
  return { sent: targets.length };
});

/**
 * Cron quotidien — rappels des récurrences à venir (J-3), envoyés en push
 * aux deux membres. Reprend la logique de dérivation de src/utils/
 * recurrence.js (les règles ne stockent pas de date d'échéance explicite).
 * Dédup par règle+échéance via le champ recurringRemindersSent du doc
 * couple, purgé des entrées passées à chaque passage.
 */
const REMINDER_DAYS_AHEAD = 3;

function nextOccurrenceOf(rule, now) {
  if (rule.frequency === "monthly") {
    const day = rule.dayOfMonth || 1;
    let year = now.getFullYear();
    let month = now.getMonth();
    if (now.getDate() > day) { month += 1; if (month > 11) { month = 0; year += 1; } }
    const clampedDay = Math.min(day, new Date(year, month + 1, 0).getDate());
    return new Date(year, month, clampedDay);
  }
  if (rule.frequency === "weekly") {
    if (rule.lastGenerated) {
      const d = new Date(rule.lastGenerated);
      d.setDate(d.getDate() + 7);
      return d;
    }
    return now;
  }
  if (rule.frequency === "yearly") {
    if (rule.lastGenerated) {
      const d = new Date(rule.lastGenerated);
      d.setFullYear(d.getFullYear() + 1);
      return d;
    }
    return null;
  }
  return null;
}

exports.sendRecurringReminders = onSchedule(
  { schedule: "every day 08:00", timeZone: "Europe/Paris" },
  async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const couplesSnap = await db.collection("couples").get();

    for (const coupleDoc of couplesSnap.docs) {
      const data = coupleDoc.data();
      const rules = (data.recurringTx || []).filter((r) => r.active !== false);
      if (rules.length === 0 || !data.fcmTokens) continue;

      const sent = data.recurringRemindersSent || {};
      const due = [];
      for (const rule of rules) {
        const next = nextOccurrenceOf(rule, now);
        if (!next) continue;
        const days = Math.round((new Date(next.getFullYear(), next.getMonth(), next.getDate()) - startOfToday) / 86400000);
        if (days < 0 || days > REMINDER_DAYS_AHEAD) continue;
        const dedupeKey = `${rule.id}_${next.toISOString().slice(0, 10)}`;
        if (sent[dedupeKey]) continue;
        due.push({ rule, days, dedupeKey });
      }
      if (due.length === 0) continue;

      const lang = data.language === "en" ? "en" : "fr";
      const whenLabel = (days) =>
        lang === "en"
          ? days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`
          : days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} jours`;
      const lines = due.map(({ rule, days }) =>
        `${rule.description} — ${Math.round(rule.amount).toLocaleString("fr-FR")} ${rule.currency} (${whenLabel(days)})`
      );
      const title =
        lang === "en"
          ? due.length === 1 ? "Upcoming recurring transaction" : `${due.length} upcoming recurring transactions`
          : due.length === 1 ? "Récurrence à venir" : `${due.length} récurrences à venir`;

      const allMembers = (data.members || [])
        .map(memberKeyOf)
        .filter((key) => key && (data.pushPrefs?.[key]?.recurringReminders !== false));
      try {
        await sendPushToMembers(coupleDoc.id, data, allMembers, {
          title,
          body: lines.join("\n"),
          tag: "recurring_reminders",
        });
      } catch (err) {
        console.error(`Reminder push failed for ${coupleDoc.id}:`, err.message);
        continue;
      }

      // Marque comme envoyés et purge les entrées dont l'échéance est passée
      const updatedSent = { ...sent };
      for (const { dedupeKey } of due) updatedSent[dedupeKey] = Date.now();
      for (const key of Object.keys(updatedSent)) {
        const dateStr = key.slice(key.lastIndexOf("_") + 1);
        if (new Date(dateStr) < startOfToday) delete updatedSent[key];
      }
      await coupleDoc.ref.update({ recurringRemindersSent: updatedSent });
    }
  }
);

/**
 * Cron mensuel — résumé du mois écoulé, poussé à chaque membre le 1er du
 * mois à 8h (Europe/Paris) : total dépensé, revenus, évolution vs le mois
 * précédent. Les montants utilisent convertedAmount (figé à la création)
 * quand il est dans la devise par défaut du couple, sinon le montant brut
 * (approximation acceptable pour un résumé).
 */
exports.monthlySummary = onSchedule(
  { schedule: "0 8 1 * *", timeZone: "Europe/Paris" },
  async () => {
    const now = new Date();
    const monthStart = (offset) => new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const lastStart = monthStart(-1);
    const lastEnd = monthStart(0);
    const prevStart = monthStart(-2);

    const couplesSnap = await db.collection("couples").get();
    for (const coupleDoc of couplesSnap.docs) {
      const data = coupleDoc.data();
      if (!data.fcmTokens) continue;

      try {
        const txSnap = await coupleDoc.ref
          .collection("transactions")
          .where("date", ">=", prevStart.toISOString())
          .where("date", "<", lastEnd.toISOString())
          .get();

        const sums = { last: { expense: 0, income: 0 }, prev: { expense: 0 } };
        for (const d of txSnap.docs) {
          const tx = d.data();
          const val =
            tx.convertedAmount !== undefined && tx.convertedCurrency === data.defaultCurrency
              ? tx.convertedAmount
              : tx.amount;
          const inLast = tx.date >= lastStart.toISOString();
          if (tx.type === "expense") {
            if (inLast) sums.last.expense += val;
            else sums.prev.expense += val;
          } else if (tx.type === "income" && inLast) {
            sums.last.income += val;
          }
        }
        if (sums.last.expense === 0 && sums.last.income === 0) continue;

        const lang = data.language === "en" ? "en" : "fr";
        const cur = data.defaultCurrency || "EUR";
        const monthName = lastStart.toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", { month: "long" });
        const fmt = (v) => Math.round(v).toLocaleString("fr-FR");
        const deltaPct = sums.prev.expense > 0
          ? Math.round(((sums.last.expense - sums.prev.expense) / sums.prev.expense) * 100)
          : null;
        const deltaLabel = deltaPct === null ? "" : ` (${deltaPct >= 0 ? "+" : ""}${deltaPct}% ${lang === "en" ? "vs previous month" : "vs mois précédent"})`;

        const title = lang === "en"
          ? `Your ${monthName} summary 📊`
          : `Votre résumé de ${monthName} 📊`;
        const body = lang === "en"
          ? `Spent: ${fmt(sums.last.expense)} ${cur}${deltaLabel}\nIncome: ${fmt(sums.last.income)} ${cur}`
          : `Dépenses : ${fmt(sums.last.expense)} ${cur}${deltaLabel}\nRevenus : ${fmt(sums.last.income)} ${cur}`;

        const targets = (data.members || [])
          .map(memberKeyOf)
          .filter((key) => key && prefEnabled(data, key, "monthlySummary"));
        if (targets.length === 0) continue;

        await sendPushToMembers(coupleDoc.id, data, targets, {
          title,
          body,
          tag: "monthly_summary",
        });
      } catch (err) {
        console.error(`Monthly summary failed for ${coupleDoc.id}:`, err.message);
      }
    }
  }
);
