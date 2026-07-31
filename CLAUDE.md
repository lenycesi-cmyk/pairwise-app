# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

Spell out every acronym in parentheses the first time it appears in a reply — e.g. "CMS (Content
Management System)", "CSP (Content Security Policy)", "FCM (Firebase Cloud Messaging)". This applies
to chat replies, not to code or commit messages.

Address the user informally in French — use "tu", never "vous".

## Commands

```bash
npm run dev       # Vite dev server with HMR
npm run build     # Production build to dist/ (uses rolldown, vite 8)
npm run lint      # ESLint
npm run preview   # Serve the dist/ build locally
```

```bash
npm test          # tout : logique métier puis règles de sécurité
npm run test:unit # logique pure seulement — rapide, sans émulateur ni Java
npm run test:watch
npm run test:rules # règles contre les émulateurs Firestore + Storage
```

**Security rules and money-critical logic are tested; screens and hooks are not.** `tests/rules/*.test.js` exercise
`firestore.rules` and `storage.rules` against the real rules engine via
`@firebase/rules-unit-testing` + `firebase emulators:exec`, and the suite is a **blocking step in
`deploy.yml` before any deploy**. This exists because a rules file can deploy with no error at all and
still deny everything at evaluation — cross-service function names are not resolved at compile time.
`storage.rules.test.js` keeps a deliberately broken rule (`firestore.exists`) as a regression guard for
exactly that failure. In `deploy.yml` the two suites are **separate steps with different triggers**:
`test:unit` runs on every push (250 ms, no gate — a suite that runs only sometimes is how regressions
slip through), while `test:rules` (~2 min, JVM startup dominates) is gated on a change to
`*.rules`, `tests/rules/`, `firebase.json` or the lockfile. The `tests/rules/` part of that condition is
deliberate: gating on the rules files alone would mean a badly written test never executes. Emulators need Java, which `ubuntu-latest` provides; note `firebase deploy` is
still unusable on the dev machine (Node 24), but `firebase emulators:exec` is fine.

`tests/unit/` covers the money-critical pure logic (82 tests total with the rules suite). Two
deliberate choices there: assertions lean on **invariants** (`principalRepaid + balance === principal`,
`totalCost === principal + totalInterest`) rather than hand-computed magic numbers, which would only
encode the author's own arithmetic; and `fxFallback.test.js` compares the **two** `FALLBACK_RATES_EUR_BASE`
tables (`utils/currencyConversion.js` and `hooks/useExchangeRates.js`) character for character, since a
silent drift between them makes the same amount render differently on different screens.

Still untested: `useBudgetProgress` and the other hooks (they need a React renderer),
`recurrence.js`, and every screen.

### Pull requests

After completing any code task on this repo, always open a pull request to `main` when done — don't ask first. Once opened, merge it automatically (no need to ask) as long as it's a normal code change with no failing checks or unresolved review comments. Always subscribe to the PR's activity afterward so CI failures and review comments get handled automatically.

### Token / context hygiene (agent workflow)

To keep token usage low, future sessions MUST follow these rules:

- **Do not poll deployment status** after merging. Merge and stop. Only check a deploy if the user
  explicitly asks. When a check is genuinely needed, use `get_workflow_run` (light) — never
  `actions_list` on `deploy.yml`, whose response is ~400k characters and floods the context.
- **Delegate bulky reads** (workflow/build logs, screenshots, large JSON) to a sub-agent so the raw
  content stays out of the main context; only pull back the conclusion.
- Group related changes into one batch rather than one PR per micro-change.

### Deploying

`firebase-tools` does not work on this machine (incompatible with Node v24's HTTP stack — `firebase deploy` fails with `Premature close`). Deploys go through a custom script instead:

```bash
npm run build && node scripts/deploy.js
```

`scripts/deploy.js` authenticates with the service account key at
`C:\Users\Chenipe\Documents\Projet Pairwise\Keys\pairwise-12df2-97a5d677db9b.json`
(or `$GOOGLE_APPLICATION_CREDENTIALS`) and pushes `dist/` straight to Firebase Hosting via the REST API
(`firebasehosting.googleapis.com`), bypassing the CLI entirely. The service account
(`pairwise-deploy@pairwise-12df2.iam.gserviceaccount.com`) has `Firebase Hosting Admin` and
`Firebase Rules Admin`. **Firestore rules** are deployed by `scripts/deploy-rules.js` (REST API
`firebaserules.googleapis.com`, same service-account auth as `deploy.js`), wired into `deploy.yml`
(runs only when `firestore.rules` changed, or on manual `workflow_dispatch`). **Storage rules** go
through the same script with `--target=storage`, which points at the per-bucket release
`projects/{p}/releases/firebase.storage/{bucket}`; it has its own change-detection step in
`deploy.yml`.

**`firebase.json` does NOT drive hosting deploys.** `scripts/deploy.js` sends its own `config` (rewrites
+ cache headers) through the REST API and never reads `firebase.json`; the two are kept in sync by hand,
so change **both**. There is deliberately **no `**` catch-all rewrite** — the app has no router, its only
URL is `/`, and a catch-all made every non-existent path answer HTTP 200 with the app (a *soft 404*
Google penalises). Hosting now serves `public/404.html` instead. The single deep path that is rewritten
is `/bank-callback` (see [BankCallbackHandler](src/components/BankCallbackHandler.jsx)). Consequence for
the service worker: its navigation handler must only cache **`res.ok`** responses, otherwise a 404 page
gets stored as the offline app shell.

**Preview channels.** `scripts/deploy.js` also publishes to a Firebase Hosting *preview channel* —
an ephemeral, separate URL that leaves the live site untouched:

```bash
npm run deploy            # live (production)
npm run deploy:preview    # channel "preview", 7-day TTL (Time To Live)
node scripts/deploy.js --channel=demo --ttl=30   # custom channel, 30-day TTL (30 = Firebase max)
```

`--site=<id>` (or `FIREBASE_HOSTING_SITE`) targets another Hosting site in the same project — the
project is meant to hold two: the app on `app.pairwise.finance`, and later a marketing site on the
apex `pairwise.finance`. Default stays the historical `pairwise-12df2` site, which is the app.

Redeploying to an existing channel extends its TTL rather than failing. **A preview channel is not a
staging environment**: it belongs to the same Firebase project, so it hits the *production* Firestore,
accounts and Cloud Functions. Real staging would need a second Firebase project and the currently
hardcoded `projectId` in [src/firebase.js](src/firebase.js) moved to a build-time env var.

### Bank aggregator provider abstraction (Plaid / Enable Banking)

Bank linking is provider-agnostic behind a `provider` field. The callables (`createLinkToken`,
`exchangeToken`, `syncBalance`, `disconnectBank`, and the `syncAssetBalance`/`purgeBankConnections`
paths) dispatch on `provider` (default `"plaid"`, so nothing changed for existing connections).
Each `bankConnections/{assetId}` doc carries `provider`; Plaid docs hold `accessToken(Enc)`/`itemId`,
Enable Banking docs hold `sessionId`/`accountUid`.

- **Plaid** — unchanged: Link SDK popup → `public_token` → `exchangeToken` exchanges for an
  `access_token`, webhook-driven re-auth, KMS-encrypted at rest.
- **Enable Banking** ([functions/enableBanking.js](functions/enableBanking.js)) — a **redirect** flow
  (no popup): `createLinkToken({provider:"enableBanking", aspspName, aspspCountry})` returns a bank
  auth `url`; the user consents at their bank; the bank redirects to `ENABLE_BANKING_REDIRECT_URL?code=…&state=…`;
  the frontend then calls `exchangeToken({provider:"enableBanking", code})` which creates a session and
  stores it. Auth is a JWT RS256 signed with the app's private key (`kid` = App ID). No webhook — the
  consent has a time-bound validity (~90 days) after which the user re-links.

**Opt-in / activation (Enable Banking is dormant until configured):** `ebCreds()` reads
`ENABLE_BANKING_APP_ID` + `ENABLE_BANKING_KEY` (RSA private key PEM) from `process.env`; unset ⇒ the
provider throws `failed-precondition` and Plaid stays the default. To activate:

1. Create the two secrets in Secret Manager (`ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_KEY`).
2. Add them to the `secretEnvironmentVariables` list in [scripts/deploy-functions.js](scripts/deploy-functions.js)
   (the custom REST deploy injects only what's listed there — the `defineSecret`/onCall `secrets` array
   is bypassed by this pipeline).
3. Register `ENABLE_BANKING_REDIRECT_URL` (`https://app.pairwise.finance/bank-callback`) in the Enable
   Banking app dashboard, and build the **frontend redirect lot** (handle the `?code=…&state=…` return
   and call `exchangeToken`). Until that lot lands, the backend seam is in place but no UI drives it.

### Plaid access_token encryption at rest (Cloud KMS)

Plaid `access_token`s live in the `couples/{id}/bankConnections/{assetId}` subcollection (locked to
`if false` in the rules — server-only). For defense in depth they're additionally encrypted at rest
with a **Cloud KMS symmetric key**: `encryptToken`/`decryptToken` in [functions/index.js](functions/index.js)
wrap every write/read. Storage format is `accessTokenEnc` (base64 KMS ciphertext) when KMS is active,
else legacy plaintext `accessToken` — reads transparently handle both, so old connections keep working
and re-encrypt on next token exchange.

**Opt-in via `KMS_KEY_NAME`**: unset ⇒ tokens stored in cleartext (the historical default, so merging
the code changes nothing until you provision the key). To activate:

```bash
gcloud services enable cloudkms.googleapis.com
gcloud kms keyrings create pairwise --location=europe-west1
gcloud kms keys create plaid-tokens --location=europe-west1 --keyring=pairwise --purpose=encryption
# grant the DEPLOY service account encrypt/decrypt on the key
gcloud kms keys add-iam-policy-binding plaid-tokens --location=europe-west1 --keyring=pairwise \
  --member="serviceAccount:pairwise-deploy@pairwise-12df2.iam.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
```

Then set the **GitHub Actions repo variable** (Settings → Variables, not a secret — it's just a resource
name) `KMS_KEY_NAME` to
`projects/pairwise-12df2/locations/europe-west1/keyRings/pairwise/cryptoKeys/plaid-tokens`. `deploy.yml`
passes it to `scripts/deploy-functions.js`, which injects it as a runtime env var on every function. The
functions' **runtime** service account (same deploy SA here) needs the same
`cryptoKeyEncrypterDecrypter` role — the binding above covers it.

### Push notifications (FCM)

Push notifications go through Firebase Cloud Messaging. The pieces:

- **Service Worker** [public/firebase-messaging-sw.js](public/firebase-messaging-sw.js) receives data-only
  messages and renders the system notification when the app is closed.
- **Device registration** [src/hooks/usePushNotifications.js](src/hooks/usePushNotifications.js): permission →
  FCM token (needs `VITE_FIREBASE_VAPID_KEY`, injected at build from the `FIREBASE_VAPID_KEY` repo secret) →
  stored on the couple doc as `fcmTokens.{memberKey}.{token} = timestamp`.
- **Sending** is a callable Cloud Function `sendPush` (in [functions/index.js](functions/index.js)), invoked
  fire-and-forget by the sender's app via [src/utils/sendPush.js](src/utils/sendPush.js). Scheduled pushes
  (`sendRecurringReminders`, `monthlySummary`) are `onSchedule` functions whose Cloud Scheduler jobs are
  upserted by `scripts/deploy-functions.js`.
- **Per-member preferences** live in `pushPrefs.{memberKey}` on the couple doc (everything on unless
  explicitly `false`); edited in `SettingsScreen`.

**IMPORTANT — required IAM role:** the deploy service account
(`pairwise-deploy@pairwise-12df2.iam.gserviceaccount.com`) must have the **`Firebase Cloud Messaging API Admin`**
role (`roles/firebasemessaging.admin`) or every send fails with a 403 `cloudmessaging.messages.create denied`.
Do NOT confuse it with the similarly named `Firebase Cloud Messaging Admin` (`roles/firebasecloudmessaging.admin`),
which does NOT grant send. Before wiring up or debugging any FCM/GCP feature, verify the service account's IAM
roles first — the `debug-push` GitHub workflow (`scripts/debug-push.js`) checks the whole chain (send permission,
stored tokens, recent logs) without sending anything.

## Architecture

React 19 + Vite 8 + Firebase (Auth + Firestore + Storage), no router — navigation is plain `useState` tab/modal
toggling in [src/App.jsx](src/App.jsx).

**Data model is couple-centric, not user-centric.** Every signed-in user belongs to one `coupleId`
(`users/{uid}.coupleId`), and essentially all app data lives on a single Firestore document:
`couples/{coupleId}`. Members, categories, currency settings, recurring rules, assets, budgets,
income↔account links, and net-worth history are all fields on that one doc (merged via
`setDoc(..., { merge: true })`), while transactions are a subcollection
(`couples/{coupleId}/transactions`) since they grow unbounded. Both are subscribed in real time via
`onSnapshot` in [FinanceContext](src/context/FinanceContext.jsx). This means most writes
read-modify-merge the whole couple doc client-side (e.g. `addRecurring`, `addAsset`, `addBudget`,
`updateMemberName`) rather than touching individual fields — keep that pattern when adding new
couple-level state.

**Budgets** (`budgets` array field) follow the same shape/CRUD pattern as `recurringTx`/`assets`
(`addBudget`/`updateBudget`/`removeBudget` in FinanceContext). Each budget has `scope`
(`"global"` or `"category"`), `categoryIds`, `amount`/`currency`, and `alertThreshold` (% of amount,
default 80). Spend-vs-budget math for the *current calendar month* lives in one shared hook,
[useBudgetProgress](src/hooks/useBudgetProgress.js), consumed by `BudgetScreen`, the Dashboard
progress widget, and `useBudgetAlerts`. `useBudgetAlerts` fires browser `Notification`s when a
budget crosses its threshold, deduped per `budgetId`+month via `localStorage` — it's mounted
globally as an always-on "runner" component in App.jsx (`BudgetAlertsRunner`, same pattern as
`RecurringGeneratorRunner`) so alerts fire regardless of which tab is active. Notifications only
work while the tab/app is open (no Service Worker/push).

**Income subcategories can be linked to a Wealth account** via the `incomeAccountLinks` map
(`{ subcategoryName: assetId }`, set whole via `setIncomeAccountLinks`, edited in
`CategoriesScreen`). When `addTransaction` creates an `income` transaction whose subcategory has a
link, it credits the linked asset's `value` directly (converting through `getExchangeRate`) — this
only affects new transactions, never retroactively, consistent with the frozen-conversion rule
below.

**Two contexts, layered:** `AuthProvider` (top-level, owns `user`/`coupleId`/auth methods) wraps
`FinanceProvider` (mounted only once a couple exists, owns everything else: transactions, categories,
members, currencies, assets, theme, language). `FinanceProvider` depends on `useAuth()` internally, so it
must stay nested under `AuthProvider`.

**Currency conversion is frozen at write time, not recalculated.** When a transaction is created or its
amount/currency is edited, `addTransaction`/`updateTransaction` (in FinanceContext) fetch the current FX
rate and store `convertedAmount` + `exchangeRate` + `exchangeRateIsFallback` on the transaction itself.
Historical transactions are never re-converted when the default currency or rates change later — only the
display currency selectors (`dashboardDisplayCurrency`, `wealthDisplayCurrency`) affect already-converted
totals via on-the-fly reconversion in the screens. There are two parallel FX implementations: 
`utils/currencyConversion.js` (`getExchangeRate`, used for the frozen-at-creation conversion, 6h cache) and
`hooks/useExchangeRates.js` (live `convert()` for display-time conversion, 12h cache). Both hit
`open.er-api.com` and fall back to the same hardcoded `FALLBACK_RATES_EUR_BASE` table if the API and cache
both fail — keep that table in sync if you touch one file.

**Screens are split into "always mounted" vs lazy.** Dashboard/Transactions/Settings load eagerly;
everything else (Wealth, Budget, Reports, AddTransaction, Recurring, Categories, Debt, AddAsset,
MemberBreakdown, InvestmentCalculator, Theme, Language) is `React.lazy` + `Suspense` in App.jsx
specifically to keep `recharts` and `@dnd-kit` out of the initial bundle — see the `manualChunks`
function in [vite.config.js](vite.config.js), which only works as a function (object form) under
Vite 8's rolldown bundler. Adding a new heavy dependency should follow the same lazy-screen +
manualChunks split.

**Always-mounted side-effect hooks use a "runner" component.** Logic that must run regardless of
the active tab (e.g. generating due recurring transactions, firing budget-threshold notifications)
is wrapped in a tiny component that calls the hook and renders `null`, then mounted unconditionally
inside `<FinanceProvider>` in App.jsx (`RecurringGeneratorRunner`, `BudgetAlertsRunner`). Follow this
pattern for new cross-tab background effects instead of embedding them in a specific screen.

**i18n is a flat key lookup**, not a library: `data/translations.js` holds FR/EN strings, `useTranslation()`
reads `language` off FinanceContext and returns a `t(key)` function.

**Security rules are membership-scoped.** [firestore.rules](firestore.rules) keys access off
`memberUids` on the couple doc — only members read/write a couple's data, and a doc *without* that
field is now denied to everyone (`allow create` makes it impossible to produce one). Joining is
handled **only** by the `joinCouple` Cloud Function; the client-side self-add clause that used to sit
in `allow update` is gone — it let anyone who guessed a couple id overwrite `memberUids` and lock the
real owners out.

The couple id doubles as the 6-character invite code, so it can never be rotated. What protects it is
`inviteExpiresAt` on the couple doc: set 7 days at creation, reset to `0` by `joinCouple` the moment a
member joins, reopenable for 7 days from Settings. Outside that window no code works, which is what
makes enumeration impractical. A doc with the field *absent* is treated as open (pre-dates the
protection) and is still covered by the 2-member `couple-full` check. Codes come from
[utils/coupleCode.js](src/utils/coupleCode.js) — `crypto.getRandomValues`, never `Math.random`.

**Cross-service rules gotchas** (they cost a long debugging session): in **Storage** rules,
`firestore.get` is the only cross-service function — `firestore.exists` does **not** exist there, and
the ruleset still deploys clean because those names aren't resolved at compile time. The failure only
shows up at evaluation, where it aborts the whole rule and denies everything. They also need an IAM
binding the REST deploy never creates: `service-{projectNumber}@firebase-rules.iam.gserviceaccount.com`
must hold `roles/firebaserules.firestoreServiceAgent` (create the agent with
`gcloud beta services identity create --service=firebaserules.googleapis.com`). Use
`scripts/diagnose-rules.js` to simulate a request against the deployed ruleset rather than guessing
from a browser-side `storage/unauthorized`.

[storage.rules](storage.rules) is stricter: profile photos are writable only by their owner
(`profiles/{uid}.jpg`), and receipts live under `receipts/{coupleId}/{txId}.jpg` with membership
checked via `firestore.get`. It does **not** tolerate a missing `memberUids`. Receipts written before
that layout sit at the flat `receipts/{txId}.jpg` path, which has no rule at all (so the SDK denies
it); they still display because the app renders `receiptURL`, a tokenized download URL that bypasses
rules entirely — and for the same reason those old objects stay readable to anyone holding the URL.
