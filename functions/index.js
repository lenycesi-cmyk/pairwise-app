const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
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

// ── Push notifications ───────────────────────────────────────────────────────

/**
 * Envoie un push FCM (message data-only : le Service Worker garde la main
 * sur l'affichage) à tous les appareils des membres ciblés, et purge les
 * tokens invalides/expirés du doc couple.
 */
async function sendPushToMembers(coupleId, coupleData, targetMemberKeys, notification) {
  const fcmTokens = coupleData.fcmTokens || {};
  const tokens = [];
  for (const key of targetMemberKeys) {
    tokens.push(...Object.keys(fcmTokens[key] || {}));
  }
  if (tokens.length === 0) return;

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    data: {
      title: notification.title,
      body: notification.body,
      tag: notification.tag || "",
      url: notification.url || "/",
    },
  });

  // Purge des tokens morts (appareil désinstallé, token expiré)
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code || "";
    if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
      dead.push(tokens[i]);
    }
  });
  if (dead.length > 0) {
    const cleaned = {};
    for (const [memberKey, byToken] of Object.entries(fcmTokens)) {
      cleaned[memberKey] = Object.fromEntries(
        Object.entries(byToken).filter(([token]) => !dead.includes(token))
      );
    }
    // update() ciblé : remplace le champ fcmTokens entier sans toucher au
    // reste du doc couple (set sans merge écraserait tout le document).
    await db.collection("couples").doc(coupleId).update({ fcmTokens: cleaned });
  }
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

  let title, body, tag;
  if (kind === "comment") {
    title = `${me.name || "💬"} — ${description}`;
    body = gifUrl ? "GIF 🎬" : text || "";
    tag = `comment_${coupleId}`;
  } else if (kind === "newTransaction") {
    title = lang === "en" ? `${me.name} added a transaction` : `${me.name} a ajouté une transaction`;
    body = `${description}${amountLabel}`;
    tag = "tx_new";
  } else if (kind === "editedTransaction") {
    title = lang === "en" ? `${me.name} edited a transaction` : `${me.name} a modifié une transaction`;
    body = `${description}${amountLabel}`;
    tag = "tx_edit";
  } else if (kind === "budgetAlert") {
    const { pct } = request.data;
    title = lang === "en" ? "Budget alert" : "Alerte budget";
    body = lang === "en"
      ? `${description}: ${Math.round(pct)}% of budget reached`
      : `${description} : ${Math.round(pct)}% du budget atteint`;
    tag = `budget_alert_${description}`;
  } else if (kind === "newBudget") {
    title = lang === "en" ? `${me.name} created a budget` : `${me.name} a créé un budget`;
    body = `${description}${amountLabel}`;
    tag = "budget_new";
  } else {
    title = lang === "en" ? `${me.name} added an asset` : `${me.name} a ajouté un actif`;
    body = `${description}${amountLabel}`;
    tag = "asset_new";
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
