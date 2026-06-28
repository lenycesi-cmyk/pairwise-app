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

After completing any code task on this repo, always open a pull request to `main` when done — don't ask first. Always subscribe to the PR's activity afterward so CI failures and review comments get handled automatically.

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

## Architecture

React 19 + Vite 8 + Firebase (Auth + Firestore + Storage), no router — navigation is plain `useState` tab/modal
toggling in [src/App.jsx](src/App.jsx).

**Data model is couple-centric, not user-centric.** Every signed-in user belongs to one `coupleId`
(`users/{uid}.coupleId`), and essentially all app data lives on a single Firestore document:
`couples/{coupleId}`. Members, categories, currency settings, recurring rules, assets, and net-worth
history are all fields on that one doc (merged via `setDoc(..., { merge: true })`), while transactions
are a subcollection (`couples/{coupleId}/transactions`) since they grow unbounded. Both are subscribed
in real time via `onSnapshot` in [FinanceContext](src/context/FinanceContext.jsx). This means most writes
read-modify-merge the whole couple doc client-side (e.g. `addRecurring`, `addAsset`, `updateMemberName`)
rather than touching individual fields — keep that pattern when adding new couple-level state.

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
everything else (Wealth, AddTransaction, Recurring, Categories, Debt, AddAsset, MemberBreakdown,
InvestmentCalculator, Theme, Language) is `React.lazy` + `Suspense` in App.jsx specifically to keep
`recharts` and `@dnd-kit` out of the initial bundle — see the `manualChunks` function in
[vite.config.js](vite.config.js), which only works as a function (object form) under Vite 8's rolldown
bundler. Adding a new heavy dependency should follow the same lazy-screen + manualChunks split.

**i18n is a flat key lookup**, not a library: `data/translations.js` holds FR/EN strings, `useTranslation()`
reads `language` off FinanceContext and returns a `t(key)` function.

**Firestore rules are deliberately permissive** ([firestore.rules](firestore.rules)): any authenticated
user can read/write any couple's data. This is intentional for now (private two-person usage, not
sensitive third-party data) and should be tightened if the app grows beyond that.
