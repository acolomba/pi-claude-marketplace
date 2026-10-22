---
phase: 06-marketplace-update-and-c-10-fix
verified: 2026-10-21T00:00:00Z
status: passed
score: 5/5 roadmap success criteria verified (13/13 requirement IDs accounted for)
covered_files:
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-01-PLAN.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-01-SUMMARY.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-02-PLAN.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-02-SUMMARY.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-03-PLAN.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-03-SUMMARY.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-04-PLAN.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-04-SUMMARY.md
  - extensions/pi-claude-marketplace/domain/manifest.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/file-source-update.feature
  - features/marketplace/info.feature
  - features/marketplace/update.feature
  - features/step_definitions/command.steps.ts
  - features/step_definitions/marketplace/update.steps.ts
  - tests/orchestrators/marketplace/update.test.ts
covered_digest: "v3:sha256:0d1c2eeba98a0bfa48feb59cf8292fbb055a82432100e59b41189af5d761cfe3"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory_findings:
  - "WR-02 (06-REVIEW.md) is disposed 'skipped': a legacy path record written by the pre-fix code, with a relative or decoy-repointed manifestPath, is not repaired. It does not affect a marketplace added with the current code."
  - "IN-01 to IN-04 (06-REVIEW.md) are info findings still 'open' in 06-REVIEW-DISPOSITION.md. None changes a requirement outcome."
---

# Phase 6: Marketplace Update and C-10 Fix Verification Report

**Phase Goal:** `marketplace update` has scenarios for single and bare updates, with and without autoupdate, and for path-source failures, and `update` re-reads a manifest the user added from outside `.claude-plugin/` (C-10).
**Verified:** 2026-10-21
**Status:** passed
**Re-verification:** Yes. The previous report (2026-10-19) was stale because later phases changed covered files. Every truth was re-checked against HEAD.

## What changed since the previous report

Phase 7 to 10 work extended the covered files. The relevant changes, read from `git diff 567e64c0 HEAD`:

- `update.ts`: the `validateManifestAtRoot` helper is gone. `refreshRecord` now fetches (github and url) and then always reads `recordedManifestPath(record)`. Path sources are unchanged in behavior: they read the recorded manifest, never `<root>/.claude-plugin/marketplace.json`. New: `StoredCredentialRejectedError` and `lacksStoredCredential` (phase 10, UPD-12 remedy line), `hostHttpFailureFrame` (phase 9, UPD-11), `MarketplaceBaselineUnreadableError` for a corrupt saved baseline (review fix WR-01), and `refreshFailureReasons`. The old `?? ["network unreachable"]` default for an unclassified failure is replaced by classification that gives no false reason.
- `shared.ts`: `recordedManifestPath(record)` returns `record.manifestPath`. `info.ts` and `add.ts` use it, so `info`, `add` and `update` name one file.
- `update.feature` and `file-source-update.feature`: the `@url` and `@github` example blocks are no longer excluded. `cucumber.json` carries no tag filter, so those rows now run in the gate.
- Review fixes landed: CR-01 and 12 of 14 warnings are `fixed` in `06-REVIEW-DISPOSITION.md`.

None of these removes or weakens a phase 6 truth. The C-10 fix survived the later phases.

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An unchanged manifest is skipped as `up-to-date`. A changed manifest reports `updated` with no plugin rows while autoupdate is off. Rows exist for dir, `@url` and `@github`, and the local rows pass. | VERIFIED | `update.feature` outlines "An unchanged marketplace is up to date" (l.254) and "A changed marketplace refreshes without plugin rows" (l.285). Each has `dir`/`file` examples plus `@url` and `@github` example blocks. These now run, since `cucumber.json` has no exclusion. Change detection is `refreshRecord`: `isDeepStrictEqual(baseline, JSON.parse(document.comparisonJson))`, with the baseline from `lastSuccessfulManifest`. Cosmetic, key-order, unknown-field and array-order scenarios (l.320-484) remain. |
| 2 | With autoupdate off, installed plugins keep their version. With autoupdate on, the update moves them to the offered version and a new session offers it. An unchanged marketplace is `up-to-date`. A newly offered plugin is not installed. A dropped plugin is skipped as `not in manifest` with warning severity. | VERIFIED | Outlines at l.488 (off keeps versions), l.555 (new session offers the version), l.623 (repeat does not reinstall), l.676 (unchanged autoupdate), l.724 (new plugin: result has only `existing@tools`, `list` shows `new@tools` as `available`, so UPD-06), l.778 (dropped plugin: `skipped`, `not in manifest`, severity `warning`, still `installed`), l.832 (ordered continuation). The cascade runs after the lock releases (`snapshotAfterRefresh` saves inside `withLockedStateTransaction`, then `cascadeAutoupdates`). |
| 3 | A bare `update` refreshes every marketplace of both scopes, one result per marketplace, project first, and reports no marketplaces when none is added. Updating a name the scope lacks fails as `marketplace not added`, with and without `--scope`. | VERIFIED | First scenario (l.7) pins project-before-user order, insertion order and adjacent `mcp-config-notices` payloads in one table. Repeat (l.52), continue-after-failure (l.111), only-populated-scope (l.150), empty bare update (l.185) and its repeat (l.195). Misses: the 4-row outline (l.212, `marketplace not added` and `... to <scope> scope`), the no-scope miss (l.232) and the Unicode name (l.244). |
| 4 | A path marketplace whose manifest became invalid fails with an `invalid manifest` row. One whose directory vanished fails as `source missing`. | VERIFIED | Outline l.884 covers dir and file kinds, both scopes, malformed JSON and schema errors, with reason `invalid manifest`, full cause chain, retained config and installed skills. l.923 pins recovery after repair (dir, file, url, github). l.957 pins `source missing` with the ENOENT cause chain and the intact registration. The reason mapping is still `reasonsFromCascadeError` for `InvalidMarketplaceManifestError` and errno codes. |
| 5 | A marketplace added from a `marketplace.json` outside `.claude-plugin/` updates by re-reading that file, and `info` shows its path. The scenario failed on the code before the fix. | VERIFIED | `file-source-update.feature` scenario 1 uses the `catalog/marketplace.json` fixture and asserts `updated`, then `info` with `source abs path {home}/marketplaces/tools/catalog/marketplace.json` and the refreshed description. I ran the whole file with `--parallel 1`: 4 scenarios, 39 steps, all pass. `06-01-RED.json` is intact: exit code 1, failing before the fix commits. In HEAD, `recordedManifestPath(record)` returns `record.manifestPath`, and `info.ts` projects the recorded manifest or root. The decoy scenario (l.91) pins that a missing original does not fall back to `.claude-plugin/`. |

**Score:** 5/5 roadmap criteria verified. `behavior_unverified: 0`.

## Plan must-haves (spot re-check against HEAD)

| Plan truth | Status | Evidence |
|------------|--------|----------|
| Baseline survives state reload. Add initializes it. Only a validated, saved refresh advances it. | VERIFIED | `lastSuccessfulManifest: Type.Optional(Type.String())` at `state-io.ts:316`. Set in `add.ts` l.1168 and l.1293. `refreshRecord` writes it only after a successful read and compare. |
| One cached read yields the resolver view and the comparison snapshot. | VERIFIED | `loadMarketplaceManifestDocument` at `manifest.ts:168`. `loadMarketplaceManifest` delegates to it (l.164). |
| Concurrency and idempotency backstops. | VERIFIED | Save inside `withLockedStateTransaction`, cascade outside it, deterministic concurrent-removal owner tests, plus the repeat scenarios listed above. No multi-process race test exists, and none is claimed. |
| An ordinary marketplace failure does not stop later marketplaces or scopes. | VERIFIED | Outline "A bare update continues after a marketplace fails" (l.111). |

## Requirements Coverage

Plan frontmatter IDs: 06-01 FIX-01; 06-02 UPD-01, UPD-02, UPD-10, UPD-14; 06-03 UPD-03, UPD-04, UPD-05, UPD-06, UPD-13; 06-04 UPD-07, UPD-08, UPD-09. That is 13 IDs, equal to the ROADMAP phase line. No orphans: UPD-11 maps to Phase 9 and UPD-12 to Phase 10 in REQUIREMENTS.md.

| Requirement | Status | Evidence |
|-------------|--------|----------|
| UPD-01 | SATISFIED | l.254, now with url and github rows running. |
| UPD-02 | SATISFIED | l.285. |
| UPD-03 | SATISFIED | l.488. |
| UPD-04 | SATISFIED | l.555. |
| UPD-05 | SATISFIED | l.676. |
| UPD-06 | SATISFIED | l.724. |
| UPD-07 | SATISFIED | l.7. |
| UPD-08 | SATISFIED | l.185. |
| UPD-09 | SATISFIED | l.212, l.232, l.244. |
| UPD-10 | SATISFIED | l.884, l.923. |
| UPD-13 | SATISFIED | l.778. |
| UPD-14 | SATISFIED | l.957. |
| FIX-01 | SATISFIED | `file-source-update.feature` plus `06-01-RED.json` and the `recordedManifestPath` wiring. REQUIREMENTS.md now shows it `[x]` / Complete, and every UPD-01..10, 13, 14 row is Complete. |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full gate | Not re-run. Evidence: `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-cucumber-behavioral-tests/e37b84b9-da30-433b-a2eb-65b65d26c976/scratchpad/regression-gate.log`, `npm run check` at 0110a355: all static gates passed, 16 hooks, 433/433 scenarios, 4050/4050 steps, direct coverage merged. Only planning Markdown changed since. | exit green | ACCEPTED |
| Phase 6 feature files parse with every step defined | `npx cucumber-js --dry-run features/marketplace/{update,file-source-update,info}.feature` | 107 scenarios, 1234 steps, none undefined | PASS |
| C-10 scenarios | `npx cucumber-js features/marketplace/file-source-update.feature --parallel 1` | 4/4 scenarios, 39/39 steps pass | PASS |
| Owner tests | `node --test tests/orchestrators/marketplace/{update,info,add}.test.ts tests/domain/manifest.test.ts tests/persistence/state-io.test.ts` | 346 tests, 346 pass, 0 fail | PASS |

## Anti-Patterns

No `TBD`, `FIXME`, `XXX` or `TODO` markers in the covered source, feature and step files. No stub or hollow-prop pattern. The scenarios compare whole results and cause chains.

## Code review findings

CR-01 (the one critical finding, a weak unit test) is `fixed`: the owner test is now "autoupdate ignores a newly declared plugin that has no installed record". Twelve of 14 warnings are `fixed`. WR-02 is `skipped`: a legacy path record with a stale or decoy manifest path is not repaired. This sits outside the phase goal, which covers a manifest the user adds. IN-01 to IN-04 are info findings, still `open`.

## Human Verification Required

None.

## Gaps Summary

No gaps. Every roadmap success criterion and all 13 requirement IDs hold at HEAD. The later phases extended `update.ts` without changing the phase 6 behavior, and they turned the `@url` and `@github` rows of criterion 1 and the other outlines on, which strengthens the evidence.

---

_Verified: 2026-10-21_
_Verifier: Claude (gsd-verifier)_
