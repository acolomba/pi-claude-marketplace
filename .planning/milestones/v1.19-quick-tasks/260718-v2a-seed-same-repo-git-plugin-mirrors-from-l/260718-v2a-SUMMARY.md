---
phase: quick-260718-v2a
plan: "01"
subsystem: plugin-clone-cache
tags: [seeding, git-source, marketplace-add, clone-cache, NFR-5, NFR-1]
status: complete
requires:
  - v0.9.0 git-source clone-cache seam (clone-cache.ts, git-source-probe.ts, clone-key.ts)
provides:
  - seedSameRepoPluginMirrors seam entrypoint
  - best-effort post-commit seeding hook on marketplace add
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
tech-stack:
  added: []
  patterns:
    - fs-only .git/config origin read (no git subprocess, NFR-5)
    - tree copy + atomic same-FS rename into the plugin-clone cache (NFR-1)
    - origin preserved by construction via .git copy (SEED-05)
key-files:
  created:
    - tests/orchestrators/plugin/clone-cache-seed.test.ts
    - tests/orchestrators/marketplace/add-seed-mirrors.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - CHANGELOG.md
decisions:
  - D-SEED-01 seeding moment = marketplace add, post-commit, best-effort
  - D-SEED-02 Case-B git-metadata read = fs-only .git/config origin, silent-degrade
  - D-SEED-03 seed mechanism = tree copy + atomic rename, origin preserved, pinned gated by checkout
requirements: [SEED-01, SEED-02, SEED-03, SEED-04, SEED-05, SEED-06]
metrics:
  duration: ~55m
  completed: 2026-07-18
commits:
  - 9deef127 chore: merge origin/main skill-dir discovery fix (#88) [Task 1 fast-forward]
  - 5c3efae5 feat(clone-cache): seed same-repo plugin mirrors on add [Task 2]
  - 012daffc test(add): cover same-repo mirror seeding end-to-end [Task 3]
---

# Phase quick-260718-v2a Plan 01: Seed Same-Repo Git Plugin Mirrors Summary

Same-repo git plugin sources are now seeded from the local marketplace checkout at
`marketplace add` time (tree copy + atomic rename) instead of re-cloned over the
network, so they stop rendering `(remote)` immediately after add — network-free,
recoverable, and swept by ordinary GC.

## What shipped

- **`seedSameRepoPluginMirrors({ locations, marketplaceName, gitOps? })`** in the
  git-surface-allowed `clone-cache.ts` seam. For a just-added marketplace it derives
  the repository's canonical clone URL, then for each manifest plugin whose canonical
  clone URL equals that URL it copies the marketplace checkout tree (including `.git`)
  into a staging dir and atomically renames it into `plugin-clones/<key>/`.
  - **Case A (github / url marketplace)** — the marketplace source record is run
    through the existing `canonicalCloneUrl` (SEED-01).
  - **Case B (path marketplace)** — the URL is read fs-only from the checkout's
    `<root>/.git/config` `[remote "origin"]` url (a private helper mirroring
    `readMirrorHeadSha`'s fs-only `.git`-reading idiom — no `git` subprocess, no
    network, NFR-5), then reparsed through the same `parsePluginSource` +
    `canonicalCloneUrl` (SEED-02).
  - **Different-repo (SEED-03)** — a plugin whose canonical URL differs is skipped;
    it keeps its normal `(remote)` → network-clone behavior.
  - **Pinned (SEED-04)** — an unpinned source seeds the URL-keyed mirror
    (`pluginMirrorKey`); a pinned source seeds the per-sha clone (`pluginCloneKey`)
    only after `gitOps.checkout(sha)` succeeds against the copied history. An
    unreachable pin (CommitNotFetchedError / any throw) cleans staging and skips,
    falling back to the network path — never fabricating a per-sha entry from
    non-matching content.
  - **Origin (SEED-05)** — copying `.git` preserves the real remote URL as the
    seeded mirror's origin by construction (asserted by test), so a later
    `update` / `marketplace update` refreshes from the network.
  - Best-effort throughout: per-entry `try/catch` swallows, the whole sweep never
    throws.

- **Write-path hook** in `marketplace add`: a best-effort call to
  `seedSameRepoPluginMirrors` placed after the post-commit completion-cache
  invalidation and before the orchestrated return, in the same swallowing tier, so a
  seeding failure can never roll back the already-committed add (D-SEED-01 / NFR-3).
  It runs in both standalone and orchestrated (reconcile-driven) add paths.

- **CHANGELOG** — a new `## [Unreleased]` heading with one user-facing bullet
  describing the seeding (no version bump; non-release branch).

## Verification

- `node --test tests/orchestrators/plugin/clone-cache-seed.test.ts` — 10/10 pass
  (Case A, Case B origin-derivation + no-origin + non-git misses, different-repo,
  warm short-circuit, pinned reachable/unreachable, origin contract, absent-mp no-op).
- `node --test tests/orchestrators/marketplace/add-seed-mirrors.test.ts` — 6/6 pass
  (end-to-end acceptance for SEED-01..06, including the one-clone-total and
  zero-network-on-path-add assertions).
- `node --test tests/architecture/no-orchestrator-network.test.ts` — green; no git
  token entered a gated read orchestrator (the seam lives in `clone-cache.ts`;
  `add.ts` already holds `gitOps`).
- `npm run check` — green (typecheck + ESLint + Prettier + full unit + integration).
- Comment-policy grep on the changed files returns nothing.

## Deviations from Plan

None — plan executed as written. Two mechanical adjustments during test authoring,
both surfaced by the quality gate and neither a behavior change:

1. Test-file `import type` ordering corrected (`import-x/order`).
2. Test assertions cast `git.getConfig(...)`'s `any` return to `string | undefined`
   and used `makeMockCredentialOps().credOps` (the helper returns a handle), to keep
   `npm run typecheck`/ESLint green.

## Notes

- Task 1 was a git fast-forward merge of `releases/v0.9.0` into this branch to bring
  the v0.9.0 git-source seam into the working tree (HEAD was a strict ancestor — a
  clean fast-forward, no history rewrite). No code change; no separate commit.
- The presence probe (`git-source-probe.ts`) and `clone-gc.ts` are unchanged: the
  read-only probe finds the warm mirror naturally, and the seeded mirror lands at a
  standard `pluginMirrorKey`/`pluginCloneKey` dir so the existing live-key GC sweeps
  it with no special-casing.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts (seedSameRepoPluginMirrors exported)
- FOUND: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts (best-effort hook)
- FOUND: tests/orchestrators/plugin/clone-cache-seed.test.ts
- FOUND: tests/orchestrators/marketplace/add-seed-mirrors.test.ts
- FOUND: CHANGELOG.md `## [Unreleased]` entry
- FOUND commit: 5c3efae5 (Task 2)
- FOUND commit: 012daffc (Task 3)
