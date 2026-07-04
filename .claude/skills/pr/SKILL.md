---
name: pr
description: Ship the current working changes as a squash-merged PR to main, following this repo's established build → commit → rebase → PR → merge → deploy flow. Use when the user says /pr, "ship it", "ouvre la PR", or asks to open/merge a pull request for the current changes.
---

# /pr — ship current changes as a merged PR

Run the repo's standard delivery pipeline for whatever is currently modified in the
working tree. This codifies the flow already used throughout this project — follow it
exactly, in order. Stop and report if any step fails; never force past a real failure.

## Steps

1. **Verify the build.** Run `npm run build`. If it fails, stop and report — do not commit.
2. **Lint the changed files** (`npx eslint <changed files>`). Pre-existing errors unrelated
   to the current diff are fine to note and move past; new errors introduced by the diff
   must be fixed first.
3. **For Cloud Functions or scripts changes**, also run `node --check` on the touched
   `.js` files under `functions/` and `scripts/`.
4. **Commit** all changes with a Conventional-Commit-style subject and a short body
   explaining the *why*. End the message with exactly:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_0151vC9TwPyJq1HBpa9LQSgS
   ```
   (Do NOT put the model identifier anywhere else — chat only, never in code/PRs.)
5. **Sync with main:** `git fetch origin main` then `git rebase origin/main`
   (resolve trivial rebase noise; if there are real conflicts, resolve them, re-run the
   build, then continue). Development stays on branch
   `claude/pairwise-cross-device-access-z6qldl`.
6. **Push:** `git push -u origin claude/pairwise-cross-device-access-z6qldl --force-with-lease`.
   Retry up to 4× with exponential backoff (2s/4s/8s/16s) only on network errors.
7. **Open the PR** to `main` via the GitHub MCP `create_pull_request`. Title = the commit
   subject. Body = a short "## Changes" bullet list of what changed and why, ending with:
   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```
8. **Merge** it via `merge_pull_request` with `merge_method: "squash"` — this repo's
   CLAUDE.md authorizes auto-merging normal code changes with no failing checks.
9. **Watch the deploy.** A push to `main` triggers the `deploy.yml` workflow (Firebase
   Hosting + Cloud Functions). Poll the latest `deploy.yml` run until it completes and
   report success/failure. Deploys are serialized (concurrency group) so back-to-back
   merges queue rather than race.

## Notes

- The PR **is** the record of what shipped — keep the body factual and scoped to the diff.
  Skip any template section asking for credentials/secrets/hostnames.
- If the branch's prior PR was already merged, this is fresh work: a new PR is a new PR,
  never a reopen of the merged one.
- Don't narrate every git command back to the user; report the outcome (PR link, merge
  status, deploy result).
