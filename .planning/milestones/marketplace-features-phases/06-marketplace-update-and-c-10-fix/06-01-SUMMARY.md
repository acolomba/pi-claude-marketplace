---
phase: 06-marketplace-update-and-c-10-fix
plan: "01"
subsystem: marketplace
tags: [marketplace-update, file-source, source-identity, persistence, cucumber]

requires:
  - phase: 05-marketplace-info
    plan: "03"
    provides: Marketplace info output and scope-selection contracts
provides:
  - Exact registered-file refresh for local marketplace sources
  - Durable complete parsed-manifest comparison baseline
  - Exact local file-or-directory source identity in marketplace info
  - Retry, legacy-state, repeated-update, and concurrent-removal coverage
affects: [marketplace-update, marketplace-add, marketplace-info, state, behavioral-tests]

actuals:
  tasks: 3
  commits: 6
plan_head_before: ca298016
plan_head_after: c417495f696a0e27349326b21da2fca641701494

tech-stack:
  added: []
  patterns:
    - One validated manifest load yields both normalized resolver data and complete comparison JSON
    - Local refresh reads the exact persisted manifest path
    - Successful add and refresh persist comparison metadata atomically with marketplace state

key-files:
  created:
    - .planning/phases/06-marketplace-update-and-c-10-fix/06-01-RED.json
    - features/marketplace/file-source-update.feature
    - features/step_definitions/marketplace/update.steps.ts
  modified:
    - extensions/pi-claude-marketplace/domain/manifest.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - features/lib/path-marketplace.ts
    - features/lib/published-marketplace.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/marketplace/info.feature
    - tests/domain/manifest.test.ts
    - tests/persistence/state-io.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/marketplace/info.test.ts
    - tests/edge/register.test.ts
    - tests/integration/reserved-record-keys.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "Persist JSON.stringify of the complete parsed document before dependency normalization; the value is comparison metadata, never a source or fallback manifest."
  - "A legacy local record with no baseline reports its first successful refresh as changed, then persists the baseline so later identical refreshes are up to date."
  - "Resolve local info sources from source.logical and addedFromCwd so a registered file remains a file and a registered directory remains a directory."
  - "Retain the existing lock contract: refresh reloads state under the scope lock and does not recreate a marketplace removed before that reload."

patterns-established:
  - "Manifest document: resolver consumers keep the normalized cached manifest while add/update can also consume complete comparisonJson from the same read."
  - "Behavioral file source: fixtures retain the exact manifest path independently from the marketplace/plugin root."

requirements-completed: [FIX-01]

coverage:
  - id: D1
    description: "An external manifest rewritten in place refreshes from its exact registered file and exposes the changed description."
    requirement: FIX-01
    verification:
      - kind: e2e
        ref: "features/marketplace/file-source-update.feature#An external manifest is refreshed from its original file"
        status: pass
      - kind: other
        ref: ".planning/phases/06-marketplace-update-and-c-10-fix/06-01-RED.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "Conventional files, external files, relative and tilde paths, and directories retain their exact source identity in info."
    requirement: FIX-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts"
        status: pass
      - kind: e2e
        ref: "features/marketplace/info.feature#A conventional manifest keeps its file identity"
        status: pass
    human_judgment: false
  - id: D3
    description: "The complete parsed baseline survives reload, advances only after a validated saved refresh, and makes repeated refreshes up to date."
    requirement: FIX-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts"
        status: pass
      - kind: e2e
        ref: "features/marketplace/file-source-update.feature#A repeated external manifest update is up to date"
        status: pass
    human_judgment: false
  - id: D4
    description: "All changed source-test pairs retain 100% direct coverage and the combined repository gate passes."
    verification:
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 32 min
completed: 2026-10-18
status: complete
---

# Phase 6 Plan 01: Marketplace File Refresh Summary

**Local marketplace refresh now rereads the exact registered manifest file, persists a validated semantic baseline, and preserves exact file-or-directory identity in info.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-10-18T19:41:27-04:00
- **Completed:** 2026-10-18T20:13:01-04:00
- **Tasks:** 3
- **Files changed:** 21

## Accomplishments

- Added a real-Pi regression proving an external non-conventional manifest is rewritten and refreshed from its registered path; the pre-fix run failed with source missing and the corrected run reports updated content.
- Added `MarketplaceManifestDocument` so one cached parse supplies normalized resolver data and a complete pre-normalization comparison snapshot.
- Persisted optional `lastSuccessfulManifest` metadata on successful add/refresh, including explicit legacy, failed-save retry, fresh-session idempotency, and concurrent-removal coverage.
- Corrected marketplace info to show the resolved original local file or directory without changing state.
- Preserved 100% direct coverage and aligned integration/owner snapshots with the additive state contract.

## Task Commits

Each planned task was committed atomically:

1. **Task 1: Refresh a rewritten external manifest through real Pi** - `a8a57548` (fix)
2. **Task 2: Show the exact original local source in info** - `7d1846d2` (fix)
3. **Task 3: Pin baseline recovery, retry, and lock behavior** - `f1ebdec8` (test)

Verification-driven fixture corrections:

- `73196a83` - seed a genuine no-op update baseline
- `fd6ad158` - align registration/bootstrap owner fixtures
- `c417495f` - expect the persisted baseline in reconcile state

**Plan metadata:** this commit (docs)

## Tracer Sizing Exception

The orchestrator approved Task 1 exceeding five files. The product-level regression required the manifest read seam, state metadata, add/update consumers, mirrored owner tests, and Cucumber fixture support to land as one green vertical slice. Splitting it would have left either the regression or its persisted comparison contract incomplete.

## Baseline Compatibility Rule

- A fresh add records the complete validated parsed manifest as `lastSuccessfulManifest`.
- A legacy local record without that field treats its first successful refresh as changed and establishes the baseline.
- Later semantically identical refreshes are up to date, including after a new Pi session.
- Invalid manifests and failed state saves do not advance the durable baseline or begin the plugin cascade.
- The baseline is comparison metadata only; source resolution always uses the registered source and manifest path.

## Concurrency Contract

Marketplace update retains the existing scoped state transaction. It reloads fresh state while holding the scope lock, writes the refreshed baseline with that state, and begins the plugin cascade only after the save succeeds. If another operation removed the selected marketplace before the locked reload, update emits nothing further and does not recreate it. This does not claim command-wide serialization beyond the existing transaction boundary.

## Verification

- Recorded pre-fix Cucumber red evidence in `06-01-RED.json`: update reconstructed `.claude-plugin/marketplace.json` instead of reading the registered `catalog/marketplace.json`.
- Focused real-Pi external-file refresh scenario - passed.
- Focused real-Pi repeated-refresh scenario - passed, 1 scenario and 12 steps.
- `npm run test:cucumber -- features/marketplace/info.feature` - passed, 10 scenarios and 76 steps.
- Owner suites for manifest, state I/O, marketplace add/update/info, registration, bootstrap, reconcile, and reserved record keys - passed.
- Direct coverage for the five changed production pairs - 100% line, function, and branch coverage.
- `npm run check:features` - passed.
- Required Fallow audits before each execution commit - passed with no findings.
- `npm run check` on Node v26.11.1 at `c417495f696a0e27349326b21da2fca641701494` - passed, including 149 scenarios, 1,566 steps, and 280 direct-coverage records.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Seeded the reserved-record integration case with its intended no-op baseline**

- **Found during:** Combined-tree gate after Task 3
- **Issue:** The test expected an up-to-date marketplace result after replacing its fixture manifest, but its persisted comparison baseline still described the prior bytes.
- **Fix:** Seeded the current complete manifest as the successful baseline before the no-op refresh.
- **File modified:** `tests/integration/reserved-record-keys.test.ts`
- **Verification:** The targeted integration test and full gate passed.
- **Committed in:** `73196a83`

**2. [Rule 3 - Blocking] Aligned registration and bootstrap owner fixtures with the additive baseline contract**

- **Found during:** First full direct-coverage pass
- **Issue:** Three exact state snapshots omitted `lastSuccessfulManifest`, and one registration update fixture replaced its recorded manifest with a nonexistent conventional-path sentinel that conflicts with exact-file refresh.
- **Fix:** Added exact comparison strings to successful-add snapshots and kept the update fixture on its registered manifest path.
- **Files modified:** `tests/edge/register.test.ts`, `tests/orchestrators/plugin/bootstrap.test.ts`
- **Verification:** Both owner pairs and their direct-coverage runs passed.
- **Committed in:** `fd6ad158`

**3. [Rule 3 - Blocking] Aligned the two-scope reconcile snapshot with successful add state**

- **Found during:** Second full direct-coverage pass
- **Issue:** The reconcile owner expected newly added marketplace records without their persisted comparison baselines.
- **Fix:** Added the exact project and user manifest baselines to the expected states.
- **File modified:** `tests/orchestrators/reconcile/apply.test.ts`
- **Verification:** The reconcile owner pair, direct coverage, and final full gate passed.
- **Committed in:** `c417495f`

---

**Total deviations:** 3 auto-fixed blocking test-fixture issues.
**Impact on plan:** All changes were test-only alignments required by the additive state and exact-source contracts. No extra production behavior or dependencies were introduced.

## Issues Encountered

- The isolated executor transport exited repeatedly after preserving partial work. The user-authorized retry was recovered inline in the same isolated worktree; every task still used atomic commits and the normal repository gates.
- A targeted integration command initially named an unavailable `tsx` loader. Node 26 runs the TypeScript test directly, and the corrected repository-native command passed.

## User Setup Required

None - no dependency or external service configuration is required.

## Next Phase Readiness

The external-file path, durable comparison baseline, exact source identity, retry behavior, and lock backstop are established. Plan 06-02 can extend semantic-change classification without reopening file selection or persistence mechanics.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All six execution commits are descendants of `ca298016` and the plan worktree is clean apart from this summary.
- The recorded red evidence, changed production files, behavioral assets, and verification-driven owner fixtures are listed above.
- The final combined repository gate passed on the exact recorded plan head.
- `STATE.md` and `ROADMAP.md` remain under orchestrator ownership.

---

*Phase: 06-marketplace-update-and-c-10-fix*
*Completed: 2026-10-18*
