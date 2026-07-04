# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server with HMR
npm run build     # Production build to dist/ (uses rolldown, vite 8)
npm run lint      # ESLint
npm run preview   # Serve the dist/ build locally
```

There is no test suite configured.

### Pull requests

After completing any code task on this repo, always open a pull request to `main` when done — don't ask first. Once opened, merge it automatically (no need to ask) as long as it's a normal code change with no failing checks or unresolved review comments. Always subscribe to the PR's activity afterward so CI failures and review comments get handled automatically.

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
`Firebase Rules Admin` — Firestore/Storage rules deploys could be scripted the same way but aren't yet automated.

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

**Firestore rules are deliberately permissive** ([firestore.rules](firestore.rules)): any authenticated
user can read/write any couple's data. This is intentional for now (private two-person usage, not
sensitive third-party data) and should be tightened if the app grows beyond that.
