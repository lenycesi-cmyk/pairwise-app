---
name: code-reviewer
description: Review the current working diff (or a named set of files) against the failure modes that have actually shipped bugs in this repo — duplicated valuation logic, numeric-zero truthiness, modals under transformed ancestors, whole-array couple-doc writes, poisoned localStorage caches. Use when the user says /code-reviewer, "relis mon code", "review my changes", or asks for a code review of the working tree. For a GitHub PR use /review; for security use /security-review.
---

# /code-reviewer — review the working diff

Review what changed, not the whole codebase. Read the diff first
(`git diff origin/main...HEAD` plus `git diff` for uncommitted work), then read
enough surrounding code to judge each change in context.

This repo has **no test suite**. Correctness claims must therefore be earned by
reading, and pure logic should be exercised with a throwaway Node script in the
scratchpad rather than asserted.

## Order of work

1. `git status` + `git diff` — establish the real scope.
2. `npm run build` — a broken build outranks every other finding.
3. `npx eslint <changed files>` — then **separate your errors from the repo's
   baseline**. Known pre-existing errors live in `FinanceContext.jsx` (unused
   `getDoc`, setState-in-effect, react-refresh export), `WealthScreen.jsx`
   (`refreshPrices` in an effect, refs during render), `AddAssetScreen.jsx`
   (search debounce), `assetPrices.js` (unused `catch (e)`),
   `GoalsScreen.jsx:28`, and the service worker's `self` redeclare. Never report
   these as new; never claim "lint clean" when they are still there.
4. Walk the checklist below for the areas the diff touches.
5. Report findings, most severe first.

## Repo-specific failure modes

These are ranked by how often they have actually caused a user-visible bug here.

### 1. Duplicated logic that must stay in lockstep

The single largest source of regressions. A fix applied to one copy and not the
other reads as "the bug persists":

- **Asset valuation** — `getAssetValue` exists twice: `src/screens/WealthScreen.jsx`
  and `src/hooks/useNetWorth.js`. The Wealth tab uses the first; the Dashboard
  net-worth widget and `useGoalProgress` use the second. Same for the
  price-refresh loop.
- **FX conversion** — `utils/currencyConversion.js` (`getExchangeRate`, frozen at
  write time, 6 h cache) and `hooks/useExchangeRates.js` (`convert`, display-time,
  12 h cache). Both carry their own `FALLBACK_RATES_EUR_BASE` table; touching one
  table without the other silently desynchronises them.

**Flag any change to one copy that does not touch the other.**

### 2. Numeric zero treated as "absent" — or as "present"

An entire family of bugs (an asset displaying `0 $` for weeks) came from this:

- `livePrices[id] !== undefined` is **true** for a stored `0`, so a zero price
  shadowed the manual-price fallback. Prefer `> 0` for anything that is a price,
  quantity or amount.
- `Number.isFinite(value)` is **true** for `0`, so a stored `value: 0` made the
  app print a confident `0 $` instead of "price unavailable". Prefer `value > 0`
  when zero means "no data".
- `parseFloat(x) || null` collapses a legitimate `0` to `null`. Fine for prices,
  wrong for a percentage or a count.
- `isNaN(parseFloat("0"))` is `false` — a zero passes any NaN-only guard.

### 3. localStorage caches outlive the fix

Prices (30 min), FX rates (6 h / 12 h), budget-alert dedup keys, goal-celebration
markers and `pw_nav_offset` all persist client-side. A validity guard added only
on the **write** path leaves poisoned values being served for the whole TTL after
deploy. Any new guard must also apply when **reading** the cache.

Related: never re-arm or reset a persisted marker from a value computed before
its inputs have loaded — that is what made the goal-reached animation replay on
every app update. Gate such effects on a readiness flag (`pricesReady`).

### 4. Modals and overlays

`.pw-card:hover` applies a `transform`, and `WidgetCard` sets `overflow: hidden`.
A transformed ancestor becomes the containing block for `position: fixed`, so a
modal rendered inside a widget is clipped to the card and flickers as the hover
state toggles. **Any overlay opened from inside a `WidgetCard` must use
`createPortal(…, document.body)`** — see `BankPickerModal` and
`AllocationTargetModal`. Overlays mounted at a screen root do not need it.

### 5. Couple-document writes

Almost all state lives on the single `couples/{coupleId}` doc, and writes
read-modify-**merge the whole array** client-side (`addAsset`, `updateAsset`,
`addRecurring`, `addBudget`…). Consequences to check:

- A filter applied to `assets`/`transactions` **at the source** would make a
  partner's write erase the filtered-out items. The gift-mode privacy filter is
  applied **only at exposure** (`visibleAssets` / `visibleTransactions`) for
  exactly this reason — keep it that way.
- New couple-level state must follow the same read-modify-merge shape rather
  than writing individual fields.

### 6. Backward compatibility of stored documents

Existing docs will not have your new field. Every addition needs a fallback that
reproduces the old behaviour: `manualPriceCurrency || asset.currency`,
`migrateLegacyTargets` folding old type-keyed allocations into risk classes,
`pushPrefs` treated as on unless explicitly `false`. **Flag any new field read
without a fallback**, and any silent rewrite of stored data on read.

### 7. Frozen currency conversion

`convertedAmount` / `exchangeRate` / `exchangeRateIsFallback` are frozen on the
transaction at write time and must never be recomputed for historical rows. Only
the display-currency selectors reconvert, on the fly. Flag anything that
back-fills or recalculates these.

### 8. Widgets, layout and bundle

- A new widget id must be added to both `DEFAULT_*_WIDGETS` and `FIXED_*_WIDGETS`
  in `useDashboardPrefs.js`, or it never appears for existing users.
- `WidgetCard`'s prop is `action`, not `extra`. Accents are limited to the
  `WIDGET_ACCENTS` map; a new accent also needs its three `data-accent` rules in
  `index.css` (top rule, hover border, focus border). `coral` is reserved for
  actionable UI — an informative card in coral reads as a button.
- Tabler icon names must already exist in the codebase or be verified; a typo
  renders an invisible glyph with no error.
- A new heavy dependency needs the lazy-screen + `manualChunks` treatment in
  `vite.config.js` (function form only, under Vite 8's rolldown bundler).

### 9. i18n

`data/translations.js` is a flat key lookup with **no interpolation** — compose
sentences with numbers in JSX, not in the key. Every new key must be added to
**both** the FR and EN blocks. Flag a key added to only one.

### 10. Cloud Functions and deployment

A new scheduled function must be added in three places in
`scripts/deploy-functions.js`: `FUNCTIONS_TO_DEPLOY`, the `scheduled` list, and an
`upsertSchedulerJob` call. New secrets must be listed in
`secretEnvironmentVariables` — the `defineSecret` / onCall `secrets` array is
bypassed by this custom REST pipeline.

### 11. Honesty about security

Firestore rules are deliberately permissive: any authenticated user can read any
couple's data. Features that hide data from a partner are **surprise guarantees,
not security**. Flag any comment, copy or PR text that describes them as private,
protected or encrypted.

## Reporting

Report findings ranked most severe first, each with:

- the file and line,
- one sentence stating the defect,
- a concrete failure scenario — inputs or state → wrong output. If you cannot
  write that scenario, you have a suspicion, not a finding: say so or drop it.

Separate **new** issues from the pre-existing baseline. Say plainly when the diff
is clean; do not manufacture findings to look thorough. Style preferences,
renames and reformatting are out of scope unless they change behaviour — quality
cleanups belong to `/simplify`.

Do not fix anything unless asked. This skill reviews.
