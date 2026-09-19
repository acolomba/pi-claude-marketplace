---
phase: 05-production-export-ownership
plan: "28"
subsystem: infra
tags: [fallow, dead-code, production-mode, census, eslint, sonar, coverage]

requires:
  - phase: 05-production-export-ownership
    provides: "The exact production finding census and its offender/benign controls (05-01)"
  - phase: 05-production-export-ownership
    provides: "The RingBuffer.read exception proven but deliberately deferred (05-05)"
  - phase: 05-production-export-ownership
    provides: "The measurement that index.ts|default cannot be retired by composition (05-20)"
  - phase: 05-production-export-ownership
    provides: "The Wave 10 stable snapshot with exactly three findings left (05-21)"
provides:
  - "The shipping dead-code command analyzes production reachability and returns an empty complete report"
  - "Health and duplication keep whole-tree scope, proven from their own reports"
  - "Two exact adjacent exceptions, each naming its real loader or callers, and nothing broader"
  - "The production finding census is empty in every category, measured not pinned"
  - "The historical hub-ledger census verifier and its exclusive paired test are retired"
  - "FLOW-09 closed with measured evidence"
affects: [phase-06-unused-type-member-gate, phase-07-reliable-coverage-metrics, phase-08-final-verification]

actuals:
  tasks: 3
  commits: 4
  plan_head_before: 2c4c6d72c8afc95a71b42f2a6e749006662b94b9
  # tokens: deliberately omitted. Actual telemetry is unavailable in this
  # runtime, and diff characters divided by four is not a token measurement.

tech-stack:
  added: []
  patterns:
    - "Atomic mode-and-exception activation: an annotation that reads as stale under the current analysis mode lands in the SAME commit as the mode that makes it live, proven by measuring both ways first"
    - "Control harness consumes the shipping config verbatim, overriding only fixture paths, so a regression in the setting under test fails the controls instead of being masked by a local restatement of it"
    - "An empty census is a measurement in its strongest state, not a disabled gate: the analyzer still runs, the envelope is still validated, and exact equality still fails on the first addition"

key-files:
  created: []
  modified:
    - .fallowrc.json
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts
    - tests/index.test.ts
    - tests/architecture/fallow-production-mode.test.ts
    - tests/architecture/unowned-exports-census.test.ts
    - tests/architecture/gate-targets.ts
    - tests/architecture/partial-vocabulary-guard.test.ts
    - eslint.config.js
    - .planning/BACKLOG.md
  deleted:
    - scripts/check-phase-06-hub-ledger.mjs
    - tests/scripts/check-phase-06-hub-ledger.test.ts

key-decisions:
  - "Set production per analysis to dead code only; health and duplication keep the whole tree, and includeEntryExports stays on so the entry default is answered rather than hidden"
  - "Land the production-mode flip and both exceptions in one commit, because each exception reports as a stale suppression under whole-tree reachability"
  - "Drop the vacated scripts root from POLICED_TEST_ROOTS rather than keep a reached-assertion for a directory that no longer exists"
  - "Omit the actuals token field: diff characters over four is not telemetry"

patterns-established:
  - "Exception scoping proof: each adjacent annotation is accompanied by controls showing it does not cover a sibling export, an unrelated default, or the same member name on another class"
  - "Same-commit census reconciliation: a change that alters what the analyzer measures updates the pin in the same commit, so no commit in the sequence carries a stale record"

requirements-completed: ["EXPORT-01", "EXPORT-02"]

coverage:
  - id: D1
    description: "The shipping dead-code command uses production reachability and returns an empty complete report"
    requirement: "EXPORT-02"
    verification:
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#D-07-20: the shipping report is complete and entirely clean"
        status: pass
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#D-07-20: the shipping command and the explicit production command agree"
        status: pass
      - kind: other
        ref: "node node_modules/fallow/bin/fallow dead-code --fail-on-issues --format human (11 entry points, no issues, exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Health and duplication retain their existing test-inclusive scope, and entry-export detection remains enabled"
    requirement: "EXPORT-02"
    verification:
      - kind: unit
        ref: "tests/architecture/fallow-production-mode.test.ts#D-05: health analysis keeps its test-inclusive scope"
        status: pass
      - kind: unit
        ref: "tests/architecture/fallow-production-mode.test.ts#D-05: duplication analysis keeps its test-inclusive scope"
        status: pass
      - kind: unit
        ref: "tests/architecture/fallow-production-mode.test.ts#Fallow production mode: entry annotation exact default"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each adjacent exception is scoped to the one declaration it is proven for"
    requirement: "EXPORT-02"
    verification:
      - kind: unit
        ref: "tests/architecture/fallow-production-mode.test.ts#Fallow production mode: entry annotation leaves sibling named export"
        status: pass
      - kind: unit
        ref: "tests/architecture/fallow-production-mode.test.ts#Fallow production mode: entry annotation leaves unrelated default"
        status: pass
      - kind: unit
        ref: "tests/architecture/fallow-production-mode.test.ts#Fallow production mode: member annotation remains local"
        status: pass
    human_judgment: false
  - id: D4
    description: "The entry module publishes exactly its default export"
    requirement: "EXPORT-02"
    verification:
      - kind: unit
        ref: "tests/index.test.ts#EXPORT-02: the entry module publishes exactly its default and nothing else"
        status: pass
    human_judgment: false
  - id: D5
    description: "The historical hub-ledger census verifier and its exclusive paired test are retired with no caller left behind"
    requirement: "EXPORT-01"
    verification:
      - kind: other
        ref: "npm run test:corresponding (exit 0)"
        status: pass
      - kind: other
        ref: "grep over package.json, .github/workflows and extensions for check-phase-06-hub-ledger (no hit)"
        status: pass
    human_judgment: false
  - id: D6
    description: "All live controls and quality checks pass with 100% aggregate production unit coverage and unchanged direct-pair requirements"
    requirement: "EXPORT-01"
    verification:
      - kind: other
        ref: "npm run check (exit 0, 6263 unit, 32 integration)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:unit then LF=LH, FNF=FNH, BRF=BRH over coverage/unit.lcov production records"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:all (236 pairs, 2 pinned shortfalls matched exactly)"
        status: pass
    human_judgment: false

duration: 46 min
completed: 2026-09-15
status: complete
---

# Phase 5 Plan 28: Production Export Ownership Summary

**Fallow dead-code now analyzes production reachability and reports nothing: the census closed 57 to 0 across the phase, with exactly two one-line adjacent exceptions, each naming a real loader or real callers, landed atomically with the mode that makes them live.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-09-15T03:55:02Z
- **Completed:** 2026-09-15T04:41:21Z
- **Tasks:** 3
- **Files modified:** 10 modified, 2 deleted

## Accomplishments

- `.fallowrc.json` sets `production` per analysis to `{deadCode: true, health: false, dupes: false}`, keeping `includeEntryExports` and every existing boundary, rule, health and duplication setting. `health.thresholdOverrides` remains absent — there are still zero approved overrides.
- `npm run fallow` — the command the quality gate runs, with no production flag of its own — discovers 11 production entry points and reports zero issues.
- The production finding census is empty in every category. `PRODUCTION_FINDING_CENSUS` and `UNOWNED_EXPORT_CENSUS` are both empty because the tree measures empty, not because anything was pinned around.
- Two declarations carry an exception, each one line, each adjacent to its own declaration: the entry default that `pi.extensions` loads from the package manifest, and `RingBuffer.read`, which the async-rewake registry's exit handler calls through `entry.stderrBuffer.read()` and `entry.stdoutBuffer.read()` at `registry.ts:445-446`.
- The control harness now consumes the shipping production and rule settings verbatim, overriding only the fixture entry, and invokes the same no-production-flag command the quality gate does.
- The historical hub-ledger census verifier and its exclusive paired test are retired together, archives preserved.
- FLOW-09 is closed in `.planning/BACKLOG.md` with the measured evidence, not with a clean count.

## Task Commits

1. **Task 1: Retire the historical hub-ledger command and reconcile FLOW-09** — `fc6a6d5a` (chore)
2. **Task 2: Activate the shipping production mode with only proven local exceptions** — `fa81a02e` (feat)
3. **Task 3: Require an empty complete report and all retained quality evidence** — `f2c0308d` (test)

**Plan metadata:** `4609a514` (docs: complete plan)

Measured commit count for this plan: `git rev-list --count 2c4c6d72..HEAD` = **4**.

## The atomicity requirement, measured

The plan's defining constraint was that the production-mode flip and the `RingBuffer.read` exception had to land in one commit. That was not an assumption — it was measured before any edit, with both annotations planted in the working tree and then reverted:

| Configuration | `stale_suppressions` | dead-code findings |
|---|---|---|
| Whole-tree reachability (`production: false`) + both annotations | 2 — `ring-buffer.ts:127` and `index.ts:36` | the two annotations themselves |
| Production reachability + both annotations | 0 | 1 (the hub-ledger file, not yet deleted) |

So adding either annotation before the flip breaks the gate it exists to satisfy, and flipping before the annotations leaves two findings. The commit `fa81a02e` carries both.

The instrument reports this loudly rather than silently: `tests/architecture/fallow-report.ts` asserts `Object.hasOwn(findings, category) || count === 0` for every summary category, so a non-zero `stale_suppressions` raises `Unnormalized finding category: stale_suppressions` instead of being ignored. No parser was weakened and no stale warning was suppressed globally.

## Finding ledger: the three remaining identities

| Old finding identity | Disposition | Evidence |
|---|---|---|
| `unused_files\|scripts/check-phase-06-hub-ledger.mjs` | Retired | Paired test ran 7/7 green immediately before deletion. No `package.json` script, no `.github/workflows` reference, no production module names it. The surviving references are archived milestone summaries and plans, which are historical records of completed work. Script and exclusive paired test deleted together in `fc6a6d5a`. |
| `unused_exports\|extensions/pi-claude-marketplace/index.ts\|default` | Exact adjacent annotation | The only consumer is the `pi.extensions` entry in `package.json`, read by Pi's loader at runtime. 05-20 measured three times that no composition change retires it. Annotation added in `fa81a02e`, with `tests/index.test.ts` asserting the module publishes exactly `["default"]`. |
| `unused_class_members\|…/async-rewake/ring-buffer.ts\|RingBuffer\|read\|class_method` | Exact adjacent annotation | Two real production readers confirmed in the live checkout: `registry.ts:445` `entry.stderrBuffer.read()` and `registry.ts:446` `entry.stdoutBuffer.read()`. Annotation added in `fa81a02e`, scoped to the one member. |

Phase arithmetic: the executable baseline after the preceding phases was 57. Twenty-seven owner plans took it to 3 with zero net additions at any step; this plan takes 3 to 0.

## Assertion ledger: what was retired and what replaced it

| Retired assertion | Replacement public assertion | Focused/direct result |
|---|---|---|
| `tests/scripts/check-phase-06-hub-ledger.test.ts` — 7 cases over the MF-DEC-01 census, PRE-EDIT ledger and closure inventory of a completed decision pass | None. The subject was retired, not relocated: the work the verifier checked is complete, and its accepted/fail-closed contracts have no remaining production or workflow consumer. Recorded 7/7 green immediately before deletion as the factual disposition. | `npm run test:corresponding` exit 0 — `tests/scripts` is a declared non-corresponding root, so no pairing obligation is left open. Unit count moves 6266 → 6259 for this deletion. |
| `D-07-20: shipping and production reports measure the entry-point transition` — a transitional clause that tolerated a difference between the two reports and only required cleanliness on the branch where entry counts differed | Two clauses. `D-07-20: the shipping command and the explicit production command agree` requires `deepStrictEqual` over the whole report. `D-07-20: the shipping report is complete and entirely clean` requires a positive entry-point count, `totalIssues: 0`, `exitStatus: 0`, and an empty collection in each of the five categories by name. | Both pass; both proven to fire (below). Unit count +1. |
| The control harness's local `production: { deadCode: true, health: false, dupes: false }` override | The shipping `.fallowrc.json` read verbatim, with only `entry` replaced by the fixture path. The setting under test now arrives from the committed config. | `tests/architecture/fallow-production-mode.test.ts` 23 cases pass; reverting the config to `production: false` fails two of them. |
| Nothing retired — new coverage | `D-05: health analysis keeps its test-inclusive scope` and `D-05: duplication analysis keeps its test-inclusive scope` read the real `health` and `dupes` reports and require each to name a `tests/` path and a production path. Actual report evidence, not a re-reading of the config that requests it. | Both pass. Unit count +2. |
| Nothing retired — new coverage | `EXPORT-02: the entry module publishes exactly its default and nothing else` asserts `Object.keys` of the entry namespace equals `["default"]` and that the namespace default is the imported factory. | Passes. Unit count +1. |

Unit test count reconciles exactly: 6266 − 7 + 4 = **6263**, which is what `npm run check` reports.

## Gates proved to fire

Every gate this plan touched was reddened by a planted violation, then restored and hash-verified.

| Planted violation | Gate that fired | Restore verified |
|---|---|---|
| Delete `scripts/check-phase-06-hub-ledger.mjs` with the pin left stale | `The complete production finding census equals its committed identities` — diff named the vanished `unused_files` identity | Pin updated in the same commit |
| Remove `tests/bridges/hooks/exec-result.test.ts` from the ESLint type-only exemption list | `sonar-test-rules.test.ts` — 1 of 15 failed, naming that owner | `eslint.config.js` restored, sha256 `0b48d03a…` matched, 15/15 |
| Revert `.fallowrc.json` to `production: false` | `fallow-production-mode.test.ts` — 2 of 23 failed (`test-only export`, `production export consumer`); `unowned-exports-census.test.ts` — both D-07-20 clauses failed on `Unnormalized finding category: stale_suppressions` | `.fallowrc.json` restored, sha256 `d71024bc…` matched |
| Remove the `RingBuffer.read` annotation | Census equality failed, naming the returning `unused_class_members` identity | `ring-buffer.ts` restored, sha256 `a614cc5a…` matched |
| Remove the entry default annotation | `D-07-19` pin clause failed with `now unowned but not pinned (1): …/index.ts#default` | `index.ts` restored, sha256 `7b28440c…` matched |
| Add `export const PROBE_UNOWNED = 1;` to a production module | Three clauses failed, including `D-07-20: the shipping report is complete and entirely clean` | Reverted, sha256 `a614cc5a…` matched |
| Add a `never-existed` root to `POLICED_TEST_ROOTS` | `D-75-01 guard: the recursive unit-test walk reached every policed root` failed naming it | Restored, sha256 `697951fd…` matched both sides |

## Files Created/Modified

- `.fallowrc.json` — `production` becomes a per-analysis object enabling dead-code only; everything else byte-identical.
- `extensions/pi-claude-marketplace/index.ts` — one-line `unused-export` annotation above the default, with the loader reason stated in the adjacent block.
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts` — one-line `unused-class-member` annotation above `read`, with the two real callers named in its doc comment.
- `tests/index.test.ts` — namespace import plus the exact-export assertion.
- `tests/architecture/fallow-production-mode.test.ts` — harness reads shipping settings verbatim; two health/dupes scope cases and a file-descriptor report reader added.
- `tests/architecture/unowned-exports-census.test.ts` — transitional clause replaced by an agreement clause and a complete-cleanliness clause.
- `tests/architecture/gate-targets.ts` — both census records emptied, each with a header explaining that empty is a measurement.
- `tests/architecture/partial-vocabulary-guard.test.ts` — vacated `scripts` root dropped from `POLICED_TEST_ROOTS` (deviation, below).
- `eslint.config.js` — type-only owner count corrected from eight to nine, with the reason.
- `.planning/BACKLOG.md` — FLOW-09 closed.
- Deleted: `scripts/check-phase-06-hub-ledger.mjs`, `tests/scripts/check-phase-06-hub-ledger.test.ts`.

## Decisions Made

- **Production scope is per analysis, not global.** Only `deadCode` moves. Health and duplication keep the whole tree, so the complexity and clone ceilings still govern test code, and both facts are now asserted from their own reports rather than from the config that requests them.
- **`includeEntryExports` stays on.** Disabling it would have made the entry default disappear rather than be answered. The exact one-line annotation is the stronger instrument, and the research recommendation to disable entry-export analysis is correctly rejected.
- **The census pin is emptied, never widened.** Every one of the three remaining identities was answered by a retirement or an annotation whose real consumer is named. No identity was added to any pin.
- **Actual token telemetry is omitted.** Diff characters divided by four is not a token measurement, and reporting it as one would corrupt later estimates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The vocabulary guard's policed-root list named a directory this plan deleted**

- **Found during:** Task 3 verification (`npm run check`, first run)
- **Issue:** `tests/architecture/partial-vocabulary-guard.test.ts` asserts every root in `POLICED_TEST_ROOTS` contributed at least one file. Task 1 deleted the only file under `tests/scripts/`, so the directory ceased to exist and the clause failed: `the walk read 332 test sources of 570 guarded files but reached none under these roots: scripts`. The focused gates run during Task 1 did not include this file; only the full suite caught it.
- **Fix:** Removed `"scripts"` from `POLICED_TEST_ROOTS` and documented why the list only carries roots that must have contributed. This loses no coverage: the guard's walk is all of `tests/` minus the two separately-scripted roots, so a file landing under `tests/scripts/` later is still read and still policed — it simply has no standing claim that the root was reached.
- **Files modified:** `tests/architecture/partial-vocabulary-guard.test.ts`
- **Verification:** 58/58 pass. A planted `never-existed` root still reddens the clause, so the deviation did not disarm it.
- **Committed in:** `f2c0308d`

**2. [Rule 3 - Blocking] Census pin updates moved into the commits that change the measurement**

- **Found during:** Tasks 1 and 2
- **Issue:** `tests/architecture/gate-targets.ts` is nominally Task 3's file, but Task 1 deletes a file the census measures and Task 2 annotates two declarations the census measures. Deferring the pin edits to Task 3 would have left two commits in the sequence carrying a census that disagreed with the tree.
- **Fix:** Each census edit lands in the commit that changes what the analyzer measures — which is the doctrine `gate-targets.ts` states about itself ("forces whoever changes the export surface of the tree to change this record in the same commit"). Task 3 still owns the gate's clause rewrite.
- **Files modified:** `tests/architecture/gate-targets.ts`
- **Verification:** Every commit in the sequence has a green census gate; the pin was never used to forgive an identity.
- **Committed in:** `fc6a6d5a`, `fa81a02e`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both are consequences of this plan's own changes, not scope creep. Deviation 1 touches one file outside the declared owner set, by one list entry and one comment, and the gate is proven to still fire. Deviation 2 stays inside the declared owner set and only moves edits earlier in the same plan.

## Verification Results

All commands run in the foreground on the final source snapshot.

| Command | Exit | Result |
|---|---|---|
| `npm run check` | 0 | 6263/6263 unit, 32/32 integration; typecheck, lint, workflow lint (+negative), fallow, format, corresponding (+negative), direct-negative all green |
| `npm run test:coverage:unit` | 0 | 6263/6263 |
| `npm run test:coverage:direct:all` | 0 | 236 pairs; "2 pinned shortfall(s) matched `scripts/test-coverage-direct.pin.json` exactly" |
| `node node_modules/fallow/bin/fallow dead-code --fail-on-issues --format human` | 0 | 11 entry points detected (10 package.json, 1 manual entry); no issues found |
| `node --test` over the seven touched gate files | 0 | 148/148 |

### Production aggregate unit coverage, from `coverage/unit.lcov`

| Metric | Found | Hit | Equal |
|---|---|---|---|
| Lines | 62,889 | 62,889 | yes |
| Functions | 1,834 | 1,834 | yes |
| Branches | 9,050 | 9,050 | yes |

227 production records, **zero** of them below 100%. The production file inventory reconciles completely: 236 `.ts` files under `extensions/pi-claude-marketplace/`, 227 with LCOV records, and the 9 without are exactly the type-only owners (`bridges/{agents,commands,mcp,skills}/types.ts`, `bridges/hooks/exec-result.ts`, `domain/resolver-types.ts`, `edge/types.ts`, `orchestrators/types.ts`, `orchestrators/import/types.ts`) — they emit no JS, so they are accounted for rather than missing. That set is one-for-one the nine ESLint type-only test owners.

No coverage threshold was reduced, no exclusion added, no assertion weakened, and no fake production reader introduced.

## Issues Encountered

- The first full `npm run check` failed on the vocabulary guard's policed-root clause. This is the plan's most useful result: focused per-task gate runs were green while the full suite was not, which is exactly the "green run that verified nothing" failure the phase warned about. Fixed as deviation 1 and re-verified with a second full run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 5 is source-complete: all 28 plans have landed and the production finding census is empty. Phase verification has not run and is the next step; the ROADMAP phase checkbox is deliberately unticked.
- Phase 6 (unused type member gate) inherits a clean production dead-code baseline and the two exceptions documented above, both of which a member-observation gate should treat as known, justified declarations rather than rediscover.
- Two planning records still state the older seven-owner type-only count; logged in `deferred-items.md` with the suggested repair. Nothing is ungoverned — `eslint.config.js` and `sonar-test-rules.test.ts` both carry the correct nine.
- The uncommitted user work listed in the handoff (settings, config, `AGENTS.md`, `scripts/init.sh`, `.codegraph/`, `.mcp.json`, the `260914-dz1` STATE row) is untouched and still uncommitted.

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-15*

## Self-Check: PASSED

- All 11 files named in `key-files.modified` and the created SUMMARY exist on disk.
- Both files named in `key-files.deleted` are absent from the working tree and recorded as deletions in `fc6a6d5a`.
- All four commits resolve: `fc6a6d5a`, `fa81a02e`, `f2c0308d`, `4609a514`.
- Commit count measured, not narrated: `git rev-list --count 2c4c6d72c8afc95a71b42f2a6e749006662b94b9..HEAD` = 4.
- Plan-level verification re-run after the last source edit: `npm run check` exit 0, `npm run test:coverage:unit` exit 0, `npm run test:coverage:direct:all` exit 0, shipping `fallow dead-code --fail-on-issues` exit 0 with zero findings.
