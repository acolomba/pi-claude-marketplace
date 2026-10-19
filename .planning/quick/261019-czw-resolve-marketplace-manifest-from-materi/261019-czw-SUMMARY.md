---
phase: quick-261019-czw
plan: "01"
status: complete
subsystem: orchestrators/marketplace
tags: [marketplace-update, marketplace-info, notification-reasons, attr-10, upd-11, wr-02, in-02]
requires: []
provides:
  - "network error: the 77th closed-set Reason, with catalog state update-host-http-error"
  - "recordedManifestPath: the one manifest locator for a recorded marketplace"
  - "refresh-only failure classification in marketplace update"
affects:
  - orchestrators/marketplace/update.ts
  - orchestrators/marketplace/info.ts
  - orchestrators/marketplace/add.ts
  - schema/claude-plugin.schema.json
tech-stack:
  added: []
  patterns:
    - "Status-and-URL detail rides the first frame of the cause line, not a reason token"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - schema/claude-plugin.schema.json
    - docs/output-catalog.md
    - docs/json-output.md
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/marketplace/info.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/shared/notification-types.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/catalog-uat/fixtures/marketplace-update.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/architecture/catalog-uat/catalog-wire.test.ts
    - .planning/phases/06-marketplace-update-and-c-10-fix/06-REVIEW-FIX.md
    - .planning/HANDOFF.json
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - "Status-and-URL channel (OD-17): a host HTTP failure's MarketplaceUpdateError message is '{status} on {url}', the first frame of the cause line; the URL is gitHubWireUrl(networkCloneUrl(source)) and serializeCauseChain redacts its userinfo"
  - "PD-4: recordedManifestPath returns record.manifestPath; the ~17 other plugin and reconcile readers keep reading the field directly"
  - "PD-6: ROADMAP Phase 9 success criterion 3 update clause aligned with the new UPD-11; the add clause is unchanged"
  - "Observation, out of scope: marketplace add still maps a 5xx, 408, or 429 answer to network unreachable through classifyGitSourceAccessFailure"
metrics:
  duration: "17m"
  completed: 2026-10-19
actuals:
  tokens: 21000
  tasks: 3
  commits: 4
plan_head_before: 4f3a93e5c5c62dfbe1c5fb248c1dabf98a11783d
plan_head_after: fc342f86657f24429f3bdf2ceb3263fc69105701
---

# Phase quick-261019-czw Plan 01: Marketplace failure reasons and one manifest locator Summary

`marketplace update` classifies only refresh failures. A failed save shows no reason, a held lock shows `{lock held}`, and a host HTTP answer shows the new `{network error}` with `{status} on {url}` as the first cause frame. `add`, `info`, and `update` all locate the manifest through `recordedManifestPath`.

## Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 (vocabulary) | ea3bfed1 | feat(output): add the network error reason |
| 1 (fix) | 31ee314d | fix(marketplace): report update failures without a false reason |
| 2 | 04d1b35d | fix(marketplace): read every recorded manifest through one helper |
| 3 | fc342f86 | docs(planning): record the marketplace path and failure-reason decisions |

## What changed

- **Grammar gate (OD-12):** `composeReasons` returns `""` for an empty list, `joinTokens` drops empty tokens, and the install-flow case for a failed row with no brace passed. Execution continued.
- **Vocabulary (OD-18):** `network error` sits at the tail of `Reason`, in `FailureReason` after `network unreachable`, and in the wire `REASONS` map. It is enrolled in every closed-set pin (77 entries). The catalog has the new `update-host-http-error` state and its fixture (289 states, 46_382 bytes, 299 presented), and `docs/json-output.md` lists it.
- **Classifier (OD-7 to OD-11, OD-17, OD-19 to OD-21):** `refreshFailureReasons` in update.ts applies these rules in order: `StateLockHeldError` gives `lock held`; any other error that is not a `MarketplaceUpdateError` gives `[]` (errors from load, save, or lock release; no errno mapping); then `reasonsFromCascadeError`; then `hostHttpStatus(err.cause)` gives `network error`; otherwise `[]`. The fallback default is gone. update.ts no longer contains the token `network unreachable`, and the shared classifier still owns it for connection errno codes.
- **Locator (OD-1 to OD-6):** shared.ts exports `recordedManifestPath`. The `info` path line comes from the record: the recorded manifest when the typed source's basename matches the manifest's basename (PD-2), and otherwise the recorded root. info.ts no longer imports `node:os` or reads `addedFromCwd`. `resolvesToRecord` in add.ts compares the typed path directly with the recorded root and manifest. `update` reads the recorded manifest for every kind. `validateManifestAtRoot` and its legacy-only case are deleted (PD-3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated the committed wire schema**
- **Found during:** Task 1 vocabulary commit (the hook failed on `tests/architecture/wire-schema.test.ts`)
- **Issue:** `schema/claude-plugin.schema.json` is generated from the Reason union, and the plan's file list left it out.
- **Fix:** `npm run schema:generate`. The new reason now appears in the schema's reason enums. It went into the same commit.
- **Files modified:** schema/claude-plugin.schema.json
- **Commit:** ea3bfed1

**2. [Rule 1 - Test fixture] Gave the url offline case a real errno code**
- **Found during:** Task 1 green run
- **Issue:** 'CR-05 / MU-5: url-source pre-fetch failure ... does NOT append Retry the command.' threw a plain Error whose message mentions ENETUNREACH but carries no code. Its `{network unreachable}` came only from the removed fallback. No other update case covered a coded network errno, although the plan assumed one did.
- **Fix:** The fetch error now carries `code: "ENETUNREACH"`, so the case keeps `{network unreachable}` through the shared classifier and now proves OD-19. The expected notification is unchanged.
- **Files modified:** tests/orchestrators/marketplace/update.test.ts
- **Commit:** 31ee314d

**3. [Rule 1 - Test fixture, OD-4] Dropped a stale-path seed from the cache-drop case**
- **Found during:** Task 2
- **Issue:** 'drops a changed target after persistence and before its plugin cascade' repointed `record.manifestPath` to a missing `before-update.json` and relied on the removed repair to rewrite it. The case is about cache invalidation, not legacy records.
- **Fix:** Removed the one line that repointed the manifest path. The expected state already had the recorded clone manifest.
- **Files modified:** tests/orchestrators/marketplace/update.test.ts
- **Commit:** 04d1b35d

The plan expected the update.ts grep for `recordedManifestPath(record)` to return at least 2. It returns 4: two code sites and the two header flow lines.

## Verification

- Every verify command in Tasks 1 to 3 passed: the grammar gate, the vocabulary tests (122 pass), the owner tests for update and edge-update (124 pass) and for Task 2 (380 pass), direct coverage for both sets of pairs (exit 0), cucumber `update.feature` and `file-source-update.feature` (63 scenarios), and cucumber `info.feature` and `file-source-update.feature` (14 scenarios). Every grep baseline check also passed.
- Red first: all ten Task 1 cases failed on the base code for the reason the plan predicted. The network reason showed in a, d, e, f, and g; permission denied or source missing showed in b, which proves OD-11; the network reason showed in c. All six D-01 rows failed before the info change.
- **Full gate:** `npm run check` exited 0 on HEAD fc342f86 with Node v26.11.1, on the full tree. Static checks passed, plus 208 scenarios / 2258 steps and 280 direct-coverage records.
- `git diff 4f3a93e5..HEAD -- package.json package-lock.json features/` is empty.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts exports recordedManifestPath
- FOUND: catalog-state update-host-http-error in docs/output-catalog.md
- FOUND: commits ea3bfed1, 31ee314d, 04d1b35d, fc342f86 on HEAD
