---
phase: 09-reload-installs-missing-dependencies
plan: 04
subsystem: reconcile
tags: [dependency-management, reload, catalog-uat, type-member-gate, docs]

# Dependency graph
requires:
  - phase: 09-01
    provides: the "dependency installed" closed-set reason and the `reconcile-dependency-installed` catalog state
  - phase: 09-03
    provides: the apply-level MISS-02 closure-failure case whose notification bytes this plan's catalog state must match, and the `reason: event.reason` thread that made a type-member contract redundant
provides:
  - the `reconcile-dependency-install-failed` catalog state and its byte-exact fixture (D-09-10)
  - the reload paragraph in docs/dependency-resolution.md's "The load-time check" section
  - the provenance-independent lift sentence in docs/plugin-enablement.md
  - the corrected CHANGELOG.md PR #198 entry (the `/reload` sub-bullet, the LOAD-03-accurate uninstall sub-bullet)
  - two BACKLOG.md carriers for the phase's deferred ideas (MISS-MPADD-01, RECON-REPLAN-01)
  - a remapped `scripts/check-unused-type-members.contracts.json` (line-pinned entries for apply.ts/install-flow.ts/index.ts, one stale entry removed, one missing entry added)
affects: []

# Actuals (#2632)
actuals:
  tokens: 5706
  tasks: 3
  commits: 3
  plan_head_before: 47f2991188b23defb078ffc9b39c3a8469642666

tech-stack:
  added: []
  patterns:
    - "Catalog fenced bytes are produced by running the real notify() dispatcher over the fixture message and cross-checked against the apply test's own assertion, never hand-typed (08-03 / 09-01 precedent)."
    - "Type-member pin remap by difflib SequenceMatcher equal-block mapping between the pre-wave-2 revision and the working tree, changing only line:col coordinates for entries whose owner/key/category/purpose are unchanged."

key-files:
  created:
    - .planning/phases/09-reload-installs-missing-dependencies/deferred-items.md
  modified:
    - docs/output-catalog.md
    - docs/dependency-resolution.md
    - docs/plugin-enablement.md
    - CHANGELOG.md
    - .planning/BACKLOG.md
    - scripts/check-unused-type-members.contracts.json
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/architecture/catalog-uat/fixtures/reconcile-applied.ts

key-decisions:
  - "The `reconcile-dependency-install-failed` fixture message was rendered through the real `notify()` dispatcher (a scratch script importing `notification-dispatch.ts` + `mock-pi.ts`) before being pasted into the fixture and the doc; its output matched the `apply.test.ts` MISS-02 closure-failure case's asserted bytes exactly on the first render, confirming the fixture's structural shape (failed row reasons/cause/severity/needsReload; disabled row reasons/cause/severity/needsReload) is correct."
  - "Two `check-unused-type-members.contracts.json` entries needed more than a coordinate remap, both traced to plan 09-03's own changes and neither a 09-04 addition: the `ResourcesDiscoverEvent.reason` `external-input` entry became genuinely redundant once 09-03 added `reason: event.reason` to the `applyReconcile` call (the gate itself reports `is already read at index.ts:126:25; remove the contract`), so it was removed; `assertOrchestratedFailedOutcome.status` is a brand-new evidence-backed narrowing function 09-03 introduced on the file's own `assertPromotedLedgerInstalled` precedent but never registered, so one `type-selection` entry was added mirroring that precedent's shape. Net effect: one entry removed, one added, `grep -c '\"id\"'` unchanged at 133 before and after."
  - "The ESLint `@typescript-eslint/require-await` violation `npm run lint` reports on `tests/orchestrators/plugin/install-flow.test.ts:11732` (introduced by plan 09-03's commit `71dcea21`) is left unfixed, per Task 3's own explicit instruction (\"a red step here is a defect of an earlier plan and goes back to it, never a pin or an exception added here\") and the executor scope-boundary rule (only auto-fix issues the CURRENT task's changes caused). Recorded in `deferred-items.md` and the WINDOWS.md ledger (entry 60) rather than fixed."

requirements-completed: [MISS-01, MISS-02]

coverage:
  - id: D1
    description: "The catalog documents both D-09-09's success row (reconcile-dependency-installed, from 09-01) and D-09-10's two-row failure form (reconcile-dependency-install-failed, new here), each matched by a fixture the real dispatcher renders byte-for-byte and cross-checked against the apply test's own pinned bytes."
    requirement: MISS-02
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 222 exact documented states"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-parser.test.ts#loadCatalogExamples parses all 222 independent catalog tuples"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/dependency-resolution.md, docs/plugin-enablement.md and CHANGELOG.md describe the reload behavior the tests prove: what a /reload installs, that startup installs nothing, the disabled-dependency limit, the retry posture, and what LOAD-03 changed for uninstall."
    requirement: MISS-01
    verification:
      - kind: unit
        ref: "tests/architecture/dependency-doc-agreement.test.ts (7 cases)"
        status: pass
      - kind: other
        ref: "pre-commit run --files CHANGELOG.md docs/dependency-resolution.md docs/plugin-enablement.md .planning/BACKLOG.md (mdformat, markdownlint-cli2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two deferred ideas (marketplace add/post-install activation running the step; re-planning the toggles after any mutating bucket) have BACKLOG carriers."
    verification:
      - kind: other
        ref: "grep -n '^## MISS-MPADD-01|^## RECON-REPLAN-01' .planning/BACKLOG.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every type-member pin this phase's production changes shifted is remapped; npm run lint:type-members and the real-gate architecture test are green."
    verification:
      - kind: unit
        ref: "npm run lint:type-members"
        status: pass
      - kind: unit
        ref: "node --test tests/architecture/unused-type-member-gate.test.ts (12/12, including the previously-red 'a new unread member outside the recorded decisions fails the real gate' case)"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run check is green on the final tree except two documented exceptions, neither caused by this plan: the pre-existing .planning/config.json prettier debt, and an ESLint require-await violation in a 09-03 test file this task's own instruction forbids fixing."
    verification:
      - kind: integration
        ref: "typecheck, lint:workflows(:negative), fallow, test:corresponding(:negative), test:coverage:direct:negative, test:coverage:unit (7485/7485, 100% coverage), test:integration (38/38), lint:type-members(:negative) all pass; npm run lint and npm run format:check are the two named exceptions"
        status: pass
    human_judgment: true
    rationale: "A human should confirm the two named exceptions are acceptable to ship with (both pre-existing/out-of-scope, both documented in deferred-items.md and WINDOWS.md entry 60) rather than blocking the phase on them."

# Metrics
duration: 80min
completed: 2026-09-22
status: complete
---

# Phase 9 Plan 4: Catalog two-row failure form, doc/changelog/backlog updates, and the type-member pin remap Summary

**The `reconcile-dependency-install-failed` catalog state (rendered through the real `notify()` dispatcher and byte-matched against plan 09-03's own apply test), the reload paragraphs in `docs/dependency-resolution.md` and `docs/plugin-enablement.md`, the corrected CHANGELOG.md and two new BACKLOG.md entries, and a `check-unused-type-members.contracts.json` remap that also removes one contract 09-03's own change made redundant and adds one it never registered.**

## Performance

- **Duration:** 80 min (approx.)
- **Started:** 2026-09-22T06:55:00Z (approx.)
- **Completed:** 2026-09-22T07:48:00Z
- **Tasks:** 3
- **Files modified:** 10 (9 modified, 1 created)

## Accomplishments
- `docs/output-catalog.md` gains `### Reload could not install a missing declared dependency (MISS-02)` under `reconcile-applied-cascade`, with the `reconcile-dependency-install-failed` anchor. Its fenced bytes were produced by rendering the fixture message through the real `notify()` dispatcher (`notification-dispatch.ts`), which matched `tests/orchestrators/reconcile/apply.test.ts`'s MISS-02 closure-failure case's asserted notification text exactly.
- `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts` gains the matching `reconcile-dependency-install-failed` fixture entry: a `failed` row for `secrets-vault` (`{dependency failed}`, cause naming `crypto-core@mp`) followed by a `disabled` row for `deploy-kit` (`{dependency unsatisfied}`, the install remedy) -- the same two-row shape the RESV-06 and LOAD-01 precedents already establish.
- `EXPECTED_STATE_COUNT` moves 221 -> 222 and `EXPECTED_UTF8_BYTES` 30,206 -> 30,538 in `catalog-contract.test.ts`; `catalog-parser.test.ts`'s title and assertion move to 222.
- `docs/dependency-resolution.md` § "The load-time check" gains a reload paragraph run: what a `/reload` installs (through the install cascade, from the declaration's marketplace, at a version inside every declarer's range, recorded for a dependency), that session start installs nothing, that a disabled dependency stays disabled, and that a failed install retries every `/reload` -- with the one-row success example and the two-row failure example byte-copied from the catalog.
- `docs/plugin-enablement.md`'s "Standalone and reconcile-driven enablement diverge on a disabled dependency" section is corrected: the reconcile pass now lifts the disable it applied itself for a dependency record the configuration does not name (D-09-08), and the `/reload`-installs-missing-but-not-disabled distinction (D-09-04) is stated with a link to the dependency-resolution doc.
- `CHANGELOG.md`'s `[Unreleased]` PR #198 entry gains a `/reload` sub-bullet and the `uninstall` sub-bullet is corrected to describe what LOAD-03 actually ships (proceeds while other plugins still need the target, names them, the next `/reload` disables them with the remedy) instead of the retired refusal.
- `.planning/BACKLOG.md` gains `MISS-MPADD-01` (marketplace add / post-install activation do not resolve missing dependencies, D-09-15) and `RECON-REPLAN-01` (the toggles re-plan only after a dependency install, D-09-07), both in the file's established `## ID: title` + prose + "Scope when picked up" shape.
- `scripts/check-unused-type-members.contracts.json` is remapped for wave 2's line drift (`apply.ts:692`->`839`, `install-flow.ts:549`->`565`, `install-flow.ts:977`->`993`, and the `ResourcesDiscoverResult` origin/boundary pair at `index.ts:169/168/170`->`180/179/181`), with one entry removed (`ResourcesDiscoverEvent.reason`, now genuinely read via 09-03's `reason: event.reason` thread) and one added (`assertOrchestratedFailedOutcome.status`, a 09-03 narrowing function that was never registered) -- net entry count unchanged (133).
- `.planning/phases/09-reload-installs-missing-dependencies/deferred-items.md` records the one `npm run check` failure this plan deliberately does not fix (an ESLint `require-await` violation in a 09-03 test file), and `.planning/WINDOWS.md` gets the matching ledger entry (#60).

## Task Commits

Each task was committed atomically:

1. **Task 1: The failure form, end to end from the fixture to the catalog bytes** - `0a6de1a1` (docs)
2. **Task 2: The docs, the changelog and the backlog say what the reload does** - `954de055` (docs)
3. **Task 3: Remap the type-member pins once and run the full gate** - `3d095182` (chore)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS + WINDOWS.md)

_Note: `tdd` was not carried by this plan (`type: execute`, no `tdd="true"` on any task) and the executor prompt carried no `TDD_MODE=true`, so the RED/GREEN/REFACTOR gate does not apply._

## Files Created/Modified
- `docs/output-catalog.md` - the `reconcile-dependency-install-failed` state
- `docs/dependency-resolution.md` - the reload paragraph under "The load-time check"
- `docs/plugin-enablement.md` - the D-09-08/D-09-04 correction to the disabled-dependency-divergence section
- `CHANGELOG.md` - the `/reload` sub-bullet, the corrected `uninstall` sub-bullet
- `.planning/BACKLOG.md` - `MISS-MPADD-01`, `RECON-REPLAN-01`
- `scripts/check-unused-type-members.contracts.json` - the wave-2 remap, one entry removed, one added
- `tests/architecture/catalog-uat/catalog-contract.test.ts` - 221 -> 222 state/byte pins
- `tests/architecture/catalog-uat/catalog-parser.test.ts` - 221 -> 222 title/assertion
- `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts` - the new fixture entry
- `.planning/phases/09-reload-installs-missing-dependencies/deferred-items.md` - the deferred ESLint defect (new file)

## Decisions Made
See `key-decisions` in the frontmatter for the fixture-rendering method, the two contracts.json entries that needed more than a coordinate remap and why, and the reasoning for leaving the ESLint violation unfixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts` failed `npm run format:check` after Task 1's commit**
- **Found during:** Task 3, running the full `npm run check` gate
- **Issue:** Prettier wanted the new fixture's multi-line `new Error(...)` call collapsed onto one line; Task 1's commit had it wrapped across three lines.
- **Fix:** `npx prettier --write tests/architecture/catalog-uat/fixtures/reconcile-applied.ts`.
- **Files modified:** `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts`
- **Verification:** `npx prettier --check` clean; `catalog-contract.test.ts` and `catalog-parser.test.ts` still 16/16 green.
- **Committed in:** `3d095182` (Task 3 commit)

**2. [Rule 3 - Blocking] `check-unused-type-members.contracts.json`'s `ResourcesDiscoverEvent.reason` entry became a hard gate failure, not a coordinate drift**
- **Found during:** Task 3, `npm run lint:type-members` after the first three coordinate remaps
- **Issue:** The gate reported `platform/pi-api.ts:100:3 is already read at index.ts:126:25; remove the contract`. Plan 09-03's `reason: event.reason` thread (D-09-13) made this member genuinely read, so the pre-existing `external-input`/`necessity` contract (which exists only to excuse an UNREAD, structurally-required member) became self-contradicting -- the gate's own `assertNotRedundant` check refuses any contract for a member it finds a real read-witness for, unconditionally of category.
- **Fix:** Removed the one entry. No coordinate could fix this; the tool's own message names removal as the only correct resolution.
- **Files modified:** `scripts/check-unused-type-members.contracts.json`
- **Verification:** `npm run lint:type-members` proceeded past this entry to the next finding.
- **Committed in:** `3d095182` (Task 3 commit)

**3. [Rule 3 - Blocking] `assertOrchestratedFailedOutcome.status` was a genuine new unread finding, not a drifted pin**
- **Found during:** Task 3, `npm run lint:type-members` after the redundant entry above was removed
- **Issue:** The gate reported `unread: install-flow.ts:2030:56 assertOrchestratedFailedOutcome.status`. This function is new in plan 09-03 (commit `595132d6`), an evidence-backed type-narrowing-only assertion built explicitly on the file's own `assertPromotedLedgerInstalled` precedent (its own JSDoc says so), but 09-03 never added the matching contract entry -- unlike `assertPromotedLedgerInstalled`'s own narrowing, which is excused via the `InstalledLedgerResult` type-alias's registered `type-selection` entry.
- **Fix:** Added one `type-selection` entry mirroring the precedent's exact shape (owner `assertOrchestratedFailedOutcome`, key `status`, `id`/`filter` pointing at the `readonly`/`Extract` positions the gate itself named), changing no other entry.
- **Files modified:** `scripts/check-unused-type-members.contracts.json`
- **Verification:** `npm run lint:type-members` exits 0; `grep -c '"id"'` is 133 both before and after this plan's net change (one entry removed above, one added here).
- **Committed in:** `3d095182` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 formatting, 2 blocking type-member-gate corrections). **Impact:** All three were necessary to reach a green `npm run lint:type-members` and a clean `npm run format:check` on this plan's own files; none touched production behavior or expanded scope beyond what Task 3's own gate demanded.

## Issues Encountered

- **`npm run check` is NOT fully green.** Two exceptions, both pre-existing and outside this plan's scope:
  1. `.planning/config.json`'s prettier debt (documented by every prior Phase 9 plan's SUMMARY; this executor is explicitly forbidden from touching it).
  2. `npm run lint` (ESLint) reports one error, `@typescript-eslint/require-await` on `tests/orchestrators/plugin/install-flow.test.ts:11732`'s `marketplaceTagProbe: async () => ({...})` fixture callback -- introduced by plan 09-03's commit `71dcea21`, in a file outside this plan's `files_modified` list. Task 3's own instruction is explicit: "a red step here is a defect of an earlier plan and goes back to it, never a pin or an exception added here." Recorded in `.planning/phases/09-reload-installs-missing-dependencies/deferred-items.md` and `.planning/WINDOWS.md` (entry 60, kind `deviation`, status `open`).
  - Every other stage of `npm run check` is confirmed green: `typecheck`, `lint:workflows`, `lint:workflows:negative`, `fallow`, `test:corresponding`, `test:corresponding:negative`, `test:coverage:direct:negative`, `test:coverage:unit` (7485/7485 tests, 100.00/100.00/100.00 line/function/branch coverage), `test:integration` (38/38), `lint:type-members`, `lint:type-members:negative` (7/7 negative controls).
- **`tests/architecture/unused-type-member-gate.test.ts`'s `"a new unread member outside the recorded decisions fails the real gate"` case, red under the full `npm test` sweep per plan 09-03's SUMMARY, is now green** -- it was a downstream symptom of the same `contracts.json` drift this plan's Task 3 remaps, not a separate defect.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MISS-01 and MISS-02 are the last requirements this phase declares; both are marked `Complete` in `REQUIREMENTS.md` as of this plan (the shared-ID gate's last declaring plan).
- Phase 9 is fully executed (4/4 plans). One deferred, out-of-scope defect remains open in `.planning/WINDOWS.md` (entry 60) for a future quick-fix or the next phase touching `install-flow.test.ts`.
- No blockers to the milestone's next phase (10, constraint-aware `update`).

## Self-Check: PASSED

All key files (`docs/output-catalog.md`, `docs/dependency-resolution.md`, `docs/plugin-enablement.md`, `CHANGELOG.md`, `.planning/BACKLOG.md`, `scripts/check-unused-type-members.contracts.json`, `tests/architecture/catalog-uat/catalog-contract.test.ts`, `tests/architecture/catalog-uat/catalog-parser.test.ts`, `tests/architecture/catalog-uat/fixtures/reconcile-applied.ts`, `.planning/phases/09-reload-installs-missing-dependencies/deferred-items.md`, this SUMMARY) confirmed present on disk. All three task commits (`0a6de1a1`, `954de055`, `3d095182`) confirmed present in `git log --oneline --all`.

---
*Phase: 09-reload-installs-missing-dependencies*
*Completed: 2026-09-22*
