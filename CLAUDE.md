# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

Spell out every acronym in parentheses the first time it appears in a reply — e.g. "CMS (Content
Management System)", "CSP (Content Security Policy)", "FCM (Firebase Cloud Messaging)". This applies
to chat replies, not to code or commit messages.

Address the user informally in French — use "tu", never "vous".

## Design work: mock up before coding

**Any change to what the user sees goes through a mockup first — published as an Artifact, approved by
the user — before a single line of app code is written and before any pull request is opened.** This
covers new widgets, screen restructuring, layout or information-hierarchy changes. It does not cover
copy fixes, bug fixes, or refactors with no visual outcome.

Mock up at the app's real dimensions (390 px of usable width inside the 480 px shell — see
`--app-shell-width`) and with the real tokens from `src/index.css`, so the mockup is judged as the
thing itself rather than as an illustration of it. Where a design has a genuine fork, show the
variants side by side and recommend one instead of asking an open question.

Read the code the change would touch *before* drawing. The Wealth-tab redesign is the case in point:
the requested monthly breakdown table turned out to be unbuildable from `netWorthHistory`, which
stores only `{ date, value, currency }` — one aggregate per day, with no per-asset detail and no way
to reconstruct it after the fact (asset values are manual entries that overwrite each other). That
constraint changed the whole plan, and it would have surfaced as rework rather than as a design
decision had the mockup come first.

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
deliberate: gating on the rules files alone would mean a badly written test never executes. Emulators
need Java **21 or above**, installed explicitly by a `setup-java` step rather than inherited from the
runner image — `ubuntu-latest`'s default JDK dropped below what `firebase-tools` requires, the
emulators stopped starting, and since the step is blocking it took the whole deploy down with it
(`netWorthSnapshots` sat unreadable in production for days while its rule was correct on `main`).
Note `firebase deploy` is
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

### Historique du patrimoine : deux niveaux, un seul module de valorisation

L'historique existe sous **deux formes complémentaires**, et il faut savoir laquelle lire :

- `couples/{id}.netWorthHistory` — un tableau `{ date, value, currency }`, **le total seul**. C'est le
  résumé : graphique d'évolution, `ReportsScreen`, `useInsights` et `netWorthDelta` le lisent, en une
  seule lecture de document. Ne pas l'enrichir : il est réécrit en entier à chaque instantané.
- `couples/{id}/netWorthSnapshots/{YYYY-MM-DD}` — **un document par jour**, avec la ventilation
  `entries` (une ligne PAR ACTIF, `typeId` et libellé recopiés dedans) plus `byType`, `totalAssets`,
  `totalLiabilities`. C'est ce qui alimente le tableau d'évolution mensuel et toute sélection de
  période, par requête sur une plage de dates. Lecture réservée aux membres, **écriture interdite au
  client** (`firestore.rules`) : un instantané est un chiffre que rien ne recalcule, laisser le client
  y toucher rendrait l'historique invérifiable.

Le stockage est **par actif et non par type** parce que le type se déduit toujours de l'actif, jamais
l'inverse ; agréger est un problème de lecture, tandis que ce qui n'est pas écrit ne se reconstitue
jamais. Le libellé est recopié pour qu'un actif supprimé plus tard ne rende pas son historique illisible.

**Deux écrivains, une seule règle de valorisation.** L'onglet Patrimoine écrit quand on l'ouvre
(`recordNetWorthSnapshot`, total seul) ; la fonction planifiée `recordNetWorthSnapshots`
([functions/netWorthSnapshots.js](functions/netWorthSnapshots.js)) écrit tous les jours à 23 h Paris.
Pour qu'ils ne se contredisent jamais, la valorisation vit dans **un seul module**,
[src/utils/assetValuation.js](src/utils/assetValuation.js), *copié à l'empaquetage* dans le zip des
fonctions — voir `SHARED_MODULES` dans [scripts/deploy-functions.js](scripts/deploy-functions.js).
Aucune duplication n'est commitée, donc rien ne peut diverger. Y ajouter un module : une ligne dans
`SHARED_MODULES`, extension `.mjs` (functions est en CommonJS, le front en ESM → `await import()`).

**Le coût suit les symboles, pas les utilisateurs.** La fonction collecte l'union des `apiId` de *tous*
les couples (`collectPriceTargets`), cote chaque symbole **une fois**, puis ventile. CoinGecko est
groupé par 100 ids/requête ; Twelve Data est étalé à 8 requêtes/minute (limite du palier gratuit).

**Règle d'abandon plutôt que de repli.** Contrairement au navigateur, il n'y a **aucune table de taux
de repli** côté serveur : si `open.er-api.com` est injoignable, la fonction n'écrit **rien**. Un taux
approximatif affiché se corrige au rechargement ; le même taux figé dans un instantané est faux pour
toujours, alors qu'une journée manquante se comble d'elle-même.

**Opt-in `TWELVE_DATA_KEY`** (Secret Manager, déjà listé dans `deploy-functions.js`) : absente, les
titres ne sont pas cotés et retombent sur leur prix manuel ; la crypto et le reste continuent.

**Étape manuelle à ne pas oublier** — Firestore indexe automatiquement chaque champ, y compris ceux des
objets d'un tableau. Sans exemption, les index de `entries` pèseront plus que les données et
alourdiront chaque écriture. Le pipeline REST ne déploie pas les index, donc à faire une fois :

```bash
gcloud firestore indexes fields update entries \
  --collection-group=netWorthSnapshots --disable-indexes \
  --project=pairwise-12df2
```

Les instantanés ne se requêtent que par **id de document** (la date), jamais par le contenu de
`entries` — désactiver ces index ne coûte donc aucune fonctionnalité.

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
**passent toutes par [context/coupleAdapter.js](src/context/coupleAdapter.js)** — la couture de
persistance introduite au lot 1 du mode Local. Plus aucun `setDoc` sur `couples/{id}` en dehors de
cet adaptateur : c'est ce qui permettra d'en brancher une seconde implémentation (journal
d'opérations + IndexedDB) sans toucher un seul écran.

Son interface est **élémentaire** — `addItem`, `patchItem`, `removeItem`, `replaceList`,
`setFields` — et non plus « réécris le tableau entier ». Les opérations de liste vivent dans
[utils/collectionOps.js](src/utils/collectionOps.js), pures et testées.

Un point de correction, pas seulement de style : `addItem` utilise **`arrayUnion`**. Le motif
historique relisait le tableau depuis l'ÉTAT LOCAL puis le réécrivait en entier, ce qui perd
l'ajout concurrent du partenaire — si Jessica ajoute un budget et que l'instantané n'est pas encore
arrivé chez Nicolas, celui de Jessica disparaît dès que Nicolas en ajoute un. `arrayUnion` est une
transformation appliquée par le serveur : les deux ajouts survivent, et elle reste compatible hors
connexion.

Modifications et suppressions réécrivent toujours le tableau (`arrayRemove` exige un élément
identique au caractère près, rien ne cible par `id`), avec la fenêtre de concurrence résiduelle que
cela suppose. `runTransaction` la fermerait mais **échoue hors connexion** : troquer le hors-ligne
contre une collision rare serait un mauvais échange. La fermeture définitive viendra du journal
d'opérations du mode Local.

**Export/import canonique** ([utils/canonicalData.js](src/utils/canonicalData.js), branché via
`exportAllData`/`importAllData` dans FinanceContext, exposé dans `SettingsScreen`). C'est le lot 0
du mode Local (voir [docs/conception-mode-local.md](docs/conception-mode-local.md)) : les deux modes
de stockage produisent et relisent LE MÊME document, si bien qu'une migration se ramène à
« exporter d'un côté, importer de l'autre » — un seul code, exercé dans les deux sens.

Trois propriétés à préserver si on y touche :

- **Liste blanche, jamais liste noire.** `COUPLE_FIELDS` énumère ce qui sort ; un champ ajouté au
  doc couple n'est donc pas exporté par défaut. C'est ainsi qu'on évite de publier un secret par
  distraction (`fcmTokens`, `memberUids`, et la sous-collection serveur `bankConnections`).
- **`members` est exporté mais JAMAIS importé** (`IMPORT_SKIP_FIELDS`). La liste des membres est
  resynchronisée vers `memberUids`, sur lequel `firestore.rules` fonde tout accès : laisser un
  fichier y ajouter quelqu'un rouvrirait la faille refermée en retirant l'auto-ajout côté client.
- **L'import n'efface rien.** L'export ne contient que ce que le membre courant peut voir (filtre
  `privateTo`), donc s'en servir pour remplacer effacerait le privé du partenaire. Union par `id`
  pour les collections identifiées, remplacement pour les champs simples. Les transactions
  importées se voient réécrire `memberUids` à partir des membres réels du couple.

**Budgets** (`budgets` array field) follow the same shape/CRUD pattern as `recurringTx`/`assets`
(`addBudget`/`updateBudget`/`removeBudget` in FinanceContext). A budget is defined on three
independent axes, and all three matter when touching this code:

- **`scope`** — `"global"`, `"category"` (with `categoryIds`, possibly several) or **`"tag"`**
  (with `tagKeys`). The tag scope is what lets someone cap `impulsif` spending, which no
  category can express.
- **`period`** — `"monthly"` (calendar, or **anchored** on `anchorDay` > 1, e.g. the 25th → the
  period runs 25→24 so it tracks payday rather than the calendar), `"weekly"` (Mon→Sun),
  `"quarterly"`, `"yearly"`, `"rolling"` (last `rollingDays`, default 30) or `"event"` (a fixed
  envelope between `startDate` and `endDate`). All range math lives in
  [utils/budgetPeriods.js](src/utils/budgetPeriods.js), shared by the progress hook and the
  history runner — do not recompute ranges anywhere else.
- **`memberUid`** — `"couple"` or a member key. A personal budget counts only that member's
  **share** of each expense (`memberShareFraction`, which handles 50/50 and custom splits) and
  never notifies the partner.

Plus `amount`/`currency` (converted from other currencies), `alertThreshold` (% of amount,
default 80) and optional **`rollover`**: the previous period's leftover is added to the current
one — one period back only, and it can be *negative* so an overspend carries too. Rollover is
disabled for `rolling` and `event`, which have no discrete previous period.

Spend-vs-budget math lives in one shared hook, [useBudgetProgress](src/hooks/useBudgetProgress.js)
(consumed by `BudgetScreen`, the Dashboard widget and `useBudgetAlerts`), which also computes a
**pace projection** once more than 15 % of the period has elapsed, and a per-member breakdown.
`useBudgetAlerts` fires at **two** levels — the threshold, then 100 % overspend — sending a local
notification to the current user and a **push** (`sendPush`, kind `budgetAlert` with
`targetKeys`) to the other concerned members, so alerts land even with the app closed. Dedup is
per budget + month + level in `localStorage`. It's mounted as an always-on "runner" in App.jsx
(`BudgetAlertsRunner`, same pattern as `RecurringGeneratorRunner`).
[useBudgetSnapshots](src/hooks/useBudgetSnapshots.js) freezes each **closed** period into
`budgetHistory` on the couple doc — idempotent, never rewritten, and skipping rolling windows
(no discrete period to close).

**Archivage : ranger sans supprimer** ([utils/archive.js](src/utils/archive.js)). Un budget ou un
objectif archivé porte un `archivedAt` et **ne bouge pas de son tableau** ; c'est la LECTURE qui le met
de côté. Le détail reste donc intégralement consultable avec le code de son écran d'origine — d'où la
section « Archivés » repliée EN BAS de l'écran concerné plutôt qu'un écran d'historique central, qui
aurait dû tenir une seconde implémentation de chaque vue de détail.

Trois points à ne pas défaire :

- **Le filtre vit dans `FinanceContext`, à un seul endroit.** `budgets`/`goals` exposés par le contexte
  sont les ACTIFS (`archivedBudgets`/`archivedGoals` à côté), tandis que l'ÉTAT interne garde le tableau
  complet — les écritures font un read-modify-write dessus et doivent voir les archivés. Filtrer chez les
  consommateurs aurait voulu dire le refaire dans `useBudgetProgress`, `useBudgetSnapshots`,
  `useGoalProgress` et les widgets, et en oublier un.
- **Le glisser-déposer doit recoller les archivés** (`mergeReorder`). L'écran ne connaît que les actifs
  et `reorderBudgets` réécrit le tableau entier : sans ça, réordonner deux budgets viderait l'archive.
- **L'archive des tags ne stocke RIEN** (`archivedTags`). `customTags` n'est qu'une liste ordonnée de
  chaînes, la vérité vit sur les transactions : retirer un tag de la liste ne supprime rien, et le rapport
  par tag continue de l'afficher. L'archive est exactement cette différence — tags encore portés, absents
  de la liste — donc une lecture calculée que rien ne peut désynchroniser. `showArchived` gouverne
  **ensemble la section ET le geste d'archivage** : les deux vont toujours de pair, dans l'écran Tags
  comme dans le panneau replié de la saisie de transaction. C'est la seule règle à tenir ici — le geste
  avait un temps été offert là où la section ne l'était pas, si bien qu'un tag disparaissait sans que
  rien ne montre où. Corollaire du calcul plutôt que du stockage : archiver un tag que **plus aucune
  transaction ne porte** revient à le supprimer (il ne peut pas figurer dans une archive déduite des
  transactions), d'où la confirmation explicite dans ce cas.
- **Un glissement vers une cible hors liste exige un `DragOverlay`** (`renderDragOverlay` de
  `SortableList`). Sans lui, l'élément traîné cesse d'être positionné par la stratégie de tri dès qu'il
  quitte la liste et semble s'évanouir en approchant de la zone : on ne sait plus si le geste marche.
  Le calque n'est monté que quand une zone de dépôt existe, donc les autres listes triables gardent le
  comportement d'avant.

Ce qui motive l'archivage plutôt que la suppression, côté budgets : `budgetHistory` est indexé par id de
budget, donc **supprimer un budget orpheline ses périodes clôturées** — invisibles et irrécupérables.

**L'archivage du patrimoine n'est PAS symétrique des deux autres** : archiver un actif *change le
patrimoine net*, là où archiver un budget est cosmétique. D'où quatre différences, toutes délibérées :

- **Le geste s'appelle « Vendu / Clôturé »**, pas « Archiver » (`asset_archive_button`, dans
  `AddAssetScreen`). Le libellé nomme l'effet sur le chiffre plutôt que de le laisser découvrir après coup.
- **Le filtre est AUSSI côté serveur.** `functions/netWorthSnapshots.js` relit les actifs depuis le doc
  couple : sans filtre, un actif vendu resterait coté chaque nuit (quota d'API dépensé pour rien) et
  pèserait dans l'instantané du lendemain — figé pour toujours. Pour que les deux côtés ne divergent
  jamais, `utils/archive.js` est **copié à l'empaquetage** dans le zip des fonctions (`SHARED_MODULES`),
  comme `assetValuation.js` ; `activeItems` existe pour ça.
- **Le lien `incomeAccountLinks` est rompu à l'archivage**, sinon les revenus de la sous-catégorie
  continueraient de créditer un compte que plus personne ne voit. Il n'est **pas rétabli** au
  désarchivage : rien ne dit qu'on le veut, et le remettre en silence enverrait de l'argent quelque part
  sans que personne l'ait demandé.
- **On prévient avant, jamais après** : un objectif adossé à l'actif verrait sa progression retomber, et
  ni cette chute ni le lien rompu ne se voient une fois le geste fait.

`archivedValue` fige la dernière valeur connue au moment d'archiver — un actif archivé n'étant plus coté,
plus rien ne saurait dire ensuite ce qu'il valait. L'historique, lui, n'a demandé aucun travail : les
instantanés sont figés date par date et jamais recalculés, donc la courbe montre l'actif tant qu'il était
détenu, puis la marche à la vente.

**Le lien revenu → compte du Patrimoine a été RETIRÉ** (éditeur dans `CategoriesScreen` + crédit
automatique dans `addTransaction`). Retirer l'éditeur seul aurait laissé l'automatisme actif sans plus
rien pour l'éteindre : de l'argent serait apparu sur un compte sans cause visible. Le champ
`incomeAccountLinks` reste stocké sur le doc couple, **dormant** — rien ne l'applique, et un retour en
arrière n'aurait donc aucune donnée à reconstituer. Même raisonnement pour le décalage manuel de la
barre d'onglets : réglage retiré, `applyNavOffset` supprimé, clé localStorage laissée en place.

**Masquage des montants** ([utils/hideAmounts.js](src/utils/hideAmounts.js)) — `hideAmounts` /
`toggleHideAmounts` sur `FinanceContext`, bascule par l'œil dans l'en-tête du Patrimoine. Trois
décisions : c'est un réglage **d'appareil** (localStorage), pas du couple — masquer chez soi ne masque
rien chez le/la partenaire ; le masque est **des points, jamais un zéro**, qui se lirait comme un
montant ; et il vaut pour **toute l'app**, sinon un aller-retour vers l'Accueil (qui affiche aussi le
patrimoine net) annulerait l'intérêt. Concrètement il passe par le `formatAmount` de chaque écran
(Accueil, Patrimoine, Rapports, Répartition, Calculateur) plus les composants de graphique, dont les
axes perdent leur échelle en gardant leur forme. **Il n'y a pas de garantie d'exhaustivité** : les
montants sont formatés écran par écran, un nouveau montant affiché ailleurs ne sera pas masqué tout
seul.

**Ce que la modale d'actif propose découle du TYPE** ([data/assetTypes.js](src/data/assetTypes.js)) :
`incomeKinds` liste les natures de revenu qu'un type peut produire, tableau vide ⇒ la section « Revenus
générés » ne s'affiche pas (une voiture ne verse pas de dividende). Les versements suivent
`hasApiPrice` — un actif coté tire sa valeur du cours, qui écraserait un versement crédité à la main.
La capacité est une **donnée**, pas une pile de conditions dans l'écran ; ajouter un type demain, c'est
remplir un champ. `other_assets` garde les quatre natures : y restreindre le choix reviendrait à
interdire ce qu'on n'a pas su nommer.

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

**No rate ⇒ no conversion (write path).** The currency catalogue is
[data/currencies.js](src/data/currencies.js): **161 currencies** (every circulating one `open.er-api.com`
covers), of which 7 are offered by default; a couple's whitelist is `enabledCurrencies`. Nothing in the
conversion logic was ever restricted to a list — it queries `latest/{code}` and reads `rates[target]` — so
the old 31-entry catalogue only stopped users from picking their own currency. But the **fallback table
still covers 7 currencies**, and it used to substitute `1` for any missing code, silently yielding
"1 MXN = 1 EUR". Since the write-path conversion is *frozen*, that wrong figure never corrected itself.
So `buildFallbackRate` now returns `null` for an uncovered pair and `getExchangeRate` returns
`{ rate: null }`. **Every caller must handle `rate === null`**: `addTransaction` omits the conversion
fields entirely (absent `convertedAmount` ⇒ screens fall back to display-time conversion, which self-heals
on reload — writing `null` would break them, since they test `!== undefined`), `updateTransaction`
`deleteField()`s the stale ones, and asset credits are skipped rather than applied with an invented rate.
Recurring asset contributions `continue` *without* marking the period applied, so they retry.
The display path (`useExchangeRates.convert`) still does `rates[x] || 1`; it is self-correcting on reload,
but tightening it means auditing ~10 call sites that do arithmetic on its result.

**Screens are split into "always mounted" vs lazy.** Dashboard/Transactions/Settings load eagerly;
everything else (Wealth, Budget, Reports, AddTransaction, Recurring, Categories, Debt, AddAsset,
MemberBreakdown, InvestmentCalculator, Theme, Language) is `React.lazy` + `Suspense` in App.jsx
specifically to keep `recharts` and `@dnd-kit` out of the initial bundle — see the `manualChunks`
function in [vite.config.js](vite.config.js), which only works as a function (object form) under
Vite 8's rolldown bundler. Adding a new heavy dependency should follow the same lazy-screen +
manualChunks split.

**Espace solo : `isSolo` (un seul membre) masque tout ce qui suppose deux personnes.** Exposé par
`FinanceContext`, ce prédicat gouverne le suivi des dettes, la ventilation par membre, la carte
« Payé par / Pour », le propriétaire d'un actif, la comparaison entre membres et le filtre par
membre. Deux règles à ne pas défaire :

- **Un partenaire invité mais pas encore inscrit COMPTE comme membre** (`uid: null`, `memberId` réel).
  On l'ajoute précisément pour partager des dépenses avant qu'il n'installe l'app ; l'exclure
  viderait la fonctionnalité de son sens.
- **Masquer un champ ne dispense pas de l'écrire.** `split` valait `"50/50"` par défaut sur toute
  transaction, y compris en solo — et `memberShareFraction` n'attribuait donc que la MOITIÉ de ses
  dépenses au membre unique, ce qui divisait par deux la consommation de tout budget personnel, sans
  signe visible. Corrigé aux deux bouts : les utils rendent 1 dès qu'il y a moins de deux membres
  (ce qui répare aussi l'historique, sans reprise de données), et les écrans de saisie écrivent la
  clé du membre unique. Ce second point n'est pas cosmétique : un `"50/50"` dormant partagerait
  RÉTROACTIVEMENT avec un partenaire qui rejoint des dépenses faites avant son arrivée.

Le widget « Résumé par membre » n'existe plus : il est devenu le second étage du widget « Résumé »
(`net_balance`), sur la MÊME grille que les trois cellules Revenus/Dépenses/Investi
(`repeat(members.length + 1, 1fr)` + `HERO_GAP`) — c'est ce qui fait coïncider les bords des deux
étages. Un widget retiré du produit doit aussi être filtré à la LECTURE des préférences
(`useWidgetPrefs` ne garde que les ids encore présents dans les défauts), sinon il survit dans les
prefs de chaque utilisateur qui l'a un jour réordonné et occupe une case vide.

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

[storage.rules](storage.rules) is stricter, and **not** couple-scoped — c'est un point où ce
fichier a longtemps décrit une version qui n'existe plus. Le cloisonnement par couple via
`firestore.get` a été retiré : l'appel inter-services échouait à l'évaluation, ce qui faisait
échouer TOUTE la règle et refusait tout, sans la moindre erreur au déploiement. Le rangement se
fait donc par **auteur du dépôt** : `profiles/{uid}.jpg` et `receipts/{uid}/{fileName}`, chacun
n'accédant qu'aux siens (voir `AddTransactionScreen.jsx`, qui écrit bien `receipts/${uid}/`).

Ce n'est pas une régression : **rien dans l'app ne lit un reçu par son chemin**. Les écrans
affichent `receiptURL`, une URL de téléchargement à jeton qui court-circuite ces règles — y
compris pour le/la partenaire. Aucun accès SDK en lecture n'est donc nécessaire.

Corollaire qui gouverne toute question de confidentialité ici : **une URL à jeton ne se révoque
pas par les règles**. Seule la suppression de l'objet reprend la main — d'où le cycle de vie
ci-dessous.

**Cycle de vie des pièces jointes** ([functions/receipts.js](functions/receipts.js),
[utils/receiptPaths.js](src/utils/receiptPaths.js)). Supprimer une transaction, ou retirer son
reçu à l'édition, supprime désormais l'objet Storage ; fermer le dernier compte du couple purge
reçus et photos de profil. Quatre points à ne pas défaire :

- **La purge passe par le SERVEUR** (`purgeReceipts`, `purgeCoupleStorage`). `storage.rules`
  range les reçus par auteur du dépôt, donc le/la partenaire peut supprimer une transaction sans
  pouvoir supprimer le reçu qu'il/elle n'a pas envoyé. Le SDK admin n'a pas cette limite. Les
  deux fonctions vérifient l'appartenance au couple **et** que chaque chemin appartient à un
  membre de ce couple — sans quoi un membre légitime pourrait faire supprimer les fichiers d'un
  autre couple en forgeant un chemin.
- **Un déclencheur Firestore serait plus élégant, mais ne marcherait pas** :
  `scripts/deploy-functions.js` ne pose aucun `eventTrigger`, donc un `onDocumentDeleted` se
  déploierait en fonction HTTP et ne se déclencherait jamais — en silence.
- **On purge AVANT de supprimer le document** : après, plus rien ne dit quel objet lui
  appartenait. La purge est best-effort, un échec ne bloque jamais la suppression demandée.
- **Le chemin se retrouve même sans `receiptPath`** : les nouvelles transactions l'enregistrent,
  les anciennes le laissent déduire de `receiptURL` (`storagePathFromDownloadURL`). Aucune
  reprise de données n'a donc été nécessaire.

Ce qui reste hors de portée, faute de reprise de données : les objets **déjà** orphelins
(transactions supprimées avant ce lot). Il faudrait un script d'administration listant le bucket
et le croisant avec Firestore — écarté volontairement, seul le futur est traité.

**Suppression de compte : rien ne part tant que les deux membres n'ont pas fermé leur compte.**
Un membre qui part est retiré de `members`/`memberUids`, mais transactions, reçus et patrimoine
restent — l'historique partagé appartient aussi au partenaire. La purge complète (banques,
transactions, document couple, Storage) n'a lieu qu'au départ du **dernier membre réel** ; un
partenaire fantôme (invité jamais inscrit, `uid: null`) ne compte pas comme membre restant.
