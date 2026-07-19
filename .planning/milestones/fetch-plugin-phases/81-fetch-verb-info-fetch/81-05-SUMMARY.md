---
phase: 81-fetch-verb-info-fetch
plan: 05
subsystem: docs-and-catalog
tags: [fetch, catalog, catalog-uat, docs, gc, self-heal]
requires:
  - "81-02 (fetch orchestrator + FETCH_CONTEXT render vocabulary)"
provides:
  - "docs/output-catalog.md ## /claude:plugin fetch section (byte-normative rows)"
  - "catalog-UAT fixtures byte-locking the fetch rows"
  - "README + style-guide fetch-as-pi-only-extension prose"
  - "FTCH-05 fetched-uninstalled GC self-heal regression"
affects:
  - "docs/output-catalog.md"
  - "docs/messaging-style-guide.md"
  - "README.md"
  - "tests/architecture/catalog-uat.test.ts"
  - "tests/orchestrators/plugin/clone-gc.test.ts"
tech-stack:
  added: []
  patterns:
    - "catalog byte-lock: <!-- catalog-state: STATE --> annotations paired byte-equal with notify() fixtures"
    - "derive-not-persist self-heal: GC live-key derivation excludes fetched-uninstalled clones"
key-files:
  created: []
  modified:
    - "docs/output-catalog.md"
    - "docs/messaging-style-guide.md"
    - "README.md"
    - "tests/architecture/catalog-uat.test.ts"
    - "tests/orchestrators/plugin/clone-gc.test.ts"
decisions:
  - "D-81-01: fetch cardinality is the invocation form (plugin=single no-tally; marketplace/all=plural tally)"
  - "D-81-02: no-op fetch renders (skipped) {up-to-date} at info; existing closed-set reason, no growth"
  - "FTCH-01: fetch documented as a pi-only extension (upstream /plugin has no fetch verb, verified 2026-07-13)"
  - "FTCH-05: proven verify-don't-build via regression; no clone-gc.ts code change"
metrics:
  duration: ~55m
  completed: 2026-07-14T17:13:27Z
  tasks: 2
  files: 5
  commits: 2
status: complete
---

# Phase 81 Plan 05: fetch documentation lockstep + FTCH-05 self-heal Summary

Documented the pi-only `fetch` verb with a byte-normative `## /claude:plugin fetch` catalog section (byte-locked by catalog-UAT fixtures), referenced fetch in the messaging style guide and README as a pi-only extension, and proved the FTCH-05 derive-not-persist self-heal with a GC regression that needed no `clone-gc.ts` code change.

## What Landed

### Task 1 -- FTCH-05 GC self-heal regression (`9945b5a9`)

Added a regression to `tests/orchestrators/plugin/clone-gc.test.ts` that materializes a git-source url plugin clone (URL-keyed mirror) WITHOUT an install record -- exactly the fetched-but-uninstalled state -- then:

- (a) asserts the mirror dir exists and the warm entry classifies `available` (not `remote`) before GC;
- (b) runs `garbageCollectPluginClones` and asserts the mirror dir is swept and no leaks;
- (c) asserts the next `probeManifestEntry` self-heals to `remote` -- the cold-source classification derived fresh with no persisted fetch state.

This is verify-don't-build: the existing live-key derivation already excludes a record-less clone, so no `clone-gc.ts` change was needed (confirmed: `git diff` against the base shows `clone-gc.ts` unchanged). The test reuses the existing `freshLocations` / `seedState({})` helpers and materializes a real `isomorphic-git` mirror network-free, mirroring the `git-source-probe.test.ts` warm-mirror pattern.

### Task 2 -- fetch catalog section + fixtures + style-guide + README (`34a1700d`)

- **`docs/output-catalog.md`**: new `## /claude:plugin fetch` H2 modeled on the `update` section. Four byte-normative catalog-state blocks: `single-available` (`○ gp v1.0.0 (available)`), `single-partially-available` (`⊖ gp v1.0.0 (partially-available) {lsp}`), `single-noop-skipped` (`⊘ gp (skipped) {up-to-date}`), and `bulk-mixed` (failed + available rows with the default `Plugin fetch: 1 failure, 1 success` tally). Documented as a pi-only extension; each row uses only existing tokens/glyphs/reasons.
- **`tests/architecture/catalog-uat.test.ts`**: one fixture per `(fetch section, catalog-state)` tuple, keyed under `"/claude:plugin fetch"`, byte-locking the new rows against `notify()`. The inverse-walk subtest confirms no orphan/stale fixtures.
- **`docs/messaging-style-guide.md`**: a `fetch` grammar paragraph in the Output Grammar Summary (prose only -- no new closed-set frontmatter; v2.0 retired it).
- **`README.md`**: fetch documented under the plugin command surface as a pi-only extension alongside install/update/uninstall.

## Key Byte-Contract Facts

- fetch uses the always-marketplace-header cascade form with a DERIVED post-fetch status row (`(available)`/`(partially-available)`/`(unavailable)`) -- the same tokens `list`/`info` render -- because the fetch is followed by a fresh probe, never an install cascade.
- The `available`/`partially-available`/`unavailable` rows are bare: no `[scope]` bracket (MSG-PL-6 / SNM-11 carve-out).
- fetch has NO tally-verb override, so the plural sweep carries the DEFAULT `Plugin fetch: N success(es)` tally (info rows counted as successes, failure category folded ahead).
- fetch installs nothing, so no row is a reload-trigger and the `/reload to pick up changes` trailer never fires.

## Deviations from Plan

None -- plan executed exactly as written. No new status token, glyph, or REASONS member was introduced; the FETCH_STATUSES set and shared closed sets are unchanged.

## Verification

- `node --test tests/orchestrators/plugin/clone-gc.test.ts` -- 12/12 pass (adds the FTCH-05 case).
- `node --test tests/architecture/catalog-uat.test.ts` -- 6/6 pass (byte-equal walk + inverse orphan walk green with the fetch fixtures).
- `npm run typecheck` -- clean (`tsc --noEmit`).
- `npx eslint` on both test files -- clean.
- Pre-commit on all changed files -- pass (prettier, mdformat, markdownlint); trufflehog fails only on the known worktree-sandbox `.git/index` path issue (scan itself is clean), so commits used `SKIP=trufflehog` per project policy.
- `pi-only` grep returns 1 in each of README.md and docs/output-catalog.md.
- `clone-gc.ts` unchanged (verify-don't-build confirmed).

## Self-Check: PASSED

- FOUND: docs/output-catalog.md `## /claude:plugin fetch` section
- FOUND: tests/architecture/catalog-uat.test.ts `"/claude:plugin fetch"` fixtures
- FOUND: docs/messaging-style-guide.md fetch grammar prose
- FOUND: README.md fetch pi-only note
- FOUND: tests/orchestrators/plugin/clone-gc.test.ts FTCH-05 regression
- FOUND: commit 9945b5a9 (test), 34a1700d (docs)
