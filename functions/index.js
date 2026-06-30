const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { PlaidApi, PlaidEnvironments, Configuration } = require("plaid");

admin.initializeApp();
const db = admin.firestore();

// Secrets (set via: firebase functions:secrets:set PLAID_CLIENT_ID etc.)
const PLAID_CLIENT_ID = defineSecret("PLAID_CLIENT_ID");
const PLAID_SECRET = defineSecret("PLAID_SECRET");
const PLAID_ENV = defineSecret("PLAID_ENV"); // "sandbox" | "production"

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
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV] },
  async (request) => {
    const { coupleId, assetId, language = "fr" } = request.data;
    if (!coupleId || !assetId) throw new HttpsError("invalid-argument", "coupleId and assetId required");
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");

    const plaid = getPlaidClient(
      PLAID_CLIENT_ID.value(),
      PLAID_SECRET.value(),
      PLAID_ENV.value()
    );

    const response = await plaid.linkTokenCreate({
      user: { client_user_id: request.auth.uid },
      client_name: "Pairwise",
      products: ["transactions", "auth"],
      country_codes: ["FR", "BE", "CH", "LU", "CA", "US", "GB", "DE", "ES", "NL"],
      language,
    });

    return { linkToken: response.data.link_token };
  }
);

/**
 * Step 2 — Exchange the public_token returned by Plaid Link for an access_token.
 * Stores the connection in Firestore and does an initial balance sync.
 * Called with: { coupleId, assetId, publicToken, accountId, institutionName }
 */
exports.exchangeToken = onCall(
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV] },
  async (request) => {
    const { coupleId, assetId, publicToken, accountId, institutionName } = request.data;
    if (!coupleId || !assetId || !publicToken) {
      throw new HttpsError("invalid-argument", "coupleId, assetId and publicToken required");
    }
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");

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
        accessToken, // stored server-side only
        itemId,
        plaidAccountId: selectedAccount.account_id,
        institutionName: institutionName || selectedAccount.name,
        accountMask: selectedAccount.mask,
        assetId,
        coupleId,
        status: "active",
        lastSync: admin.firestore.FieldValue.serverTimestamp(),
      });

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
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV] },
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
  { secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV] },
  async (request) => {
    const { coupleId, assetId } = request.data;
    if (!coupleId || !assetId) throw new HttpsError("invalid-argument", "Missing params");
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");

    const connDoc = await db
      .collection("couples").doc(coupleId)
      .collection("bankConnections").doc(assetId)
      .get();

    if (connDoc.exists) {
      const { accessToken } = connDoc.data();
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
  { schedule: "every 60 minutes", secrets: [PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV] },
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

  const { accessToken, plaidAccountId } = connDoc.data();
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

  const balance = account.balances.current ?? account.balances.available ?? 0;
  const isoCurrency = account.balances.iso_currency_code || "EUR";

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
