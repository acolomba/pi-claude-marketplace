---
phase: 04-install-provenance
plan: 04
subsystem: orchestrators
tags: [reconcile, provenance, uninstall-bucket, dependency-cascade, node-test, tdd]

# Dependency graph
requires:
  - phase: 04-install-provenance
    provides: plan 04-01's required `provenance` field on every install record and plan 04-03's `pluginRecord` builder option in `tests/orchestrators/reconcile/plan.test.ts`
provides:
  - "`buildUninstallBucket` keeps a recorded plugin whose `provenance` is `\"dependency\"` out of the uninstall bucket (D-04-05) -- one bound variable and one inline `continue`, no new function, no new import"
  - "The D-04-05 pair in `tests/orchestrators/reconcile/plan.test.ts`: a positive case (undeclared dependency kept, undeclared direct install swept) and a negative control (undeclared direct install swept beside a declared dependency), both whole-plan `deepStrictEqual` over one shared hand-built state"
  - "`npm run check` exit 0 on `2452a595`: 6379/6379 unit, 32/32 integration; `reconcile-planner-purity.test.ts` green unamended"
affects: [04-05, 04-06, 05-prune]

# Actuals (#2632) -- chars/4 over the realized diff, never a harness token count
actuals:
  tokens: 930
  tasks: 2
  commits: 2
plan_head_before: ffa6be6e49736dcbb6cf6be1562f3ece3c60a4dd

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Positive case and negative control over ONE shared state builder, varying only the merged config: a pure planner cannot give two whole-result assertions over identical inputs a red/green split, so the control declares the dependency and stays green across the transition while still going red under an over-broad guard"
    - "Over-broad-guard plant: temporarily widen the new `continue` to every undeclared record, observe the orphan uninstall go missing in both halves, restore byte for byte"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - tests/orchestrators/reconcile/plan.test.ts

key-decisions:
  - "The negative control shares the state and varies the config (dependency declared) rather than using a second state: the exemption is about undeclared records, and declaring the dependency is exactly today's pre-04-05 reality, so the control pins the orphan sweep independently of whether the exemption exists"
  - "Task 1's red dependency half was not committed on its own: `npm-coverage-direct` runs the focused pair and fails on any red case, and CLAUDE.md forbids committing through a hook failure, so the test commit carries the builder plus the green negative control and the positive case rides in the feat commit (see Deviations)"
  - "Inline condition, not a helper, as the plan prescribes; the function count of `plan.ts` is 12 before and after"

patterns-established:
  - "D-04-08 anchoring: the new comment cites `D-04-05` and `D-04-02`; the test titles cite `D-04-05`; no bare requirement-family ID and no process reference appears in source"

requirements-completed: [PROV-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "An undeclared record whose provenance is `dependency` produces no uninstall entry while an undeclared direct install in the same marketplace still does"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#D-04-05: keeps an undeclared record whose provenance is dependency"
        status: pass
    human_judgment: false
  - id: D2
    description: "A genuine orphan is still swept: an undeclared direct install beside a DECLARED dependency is planned for uninstall and nothing else moves (the negative control, green before and after the exemption, red under an over-broad guard)"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#D-04-05: still sweeps an undeclared direct install beside a declared dependency"
        status: pass
      - kind: other
        ref: "over-broad plant (`continue` on every undeclared record): node --test --test-name-pattern D-04-05 -> 2 tests, 0 pass, 2 fail, both diffs `+ pluginsToUninstall: []` / `- plugin: 'orphan'`; restored, 18/18"
        status: pass
    human_judgment: false
  - id: D3
    description: "`plan.ts` stays pure and under both complexity ceilings; the whole gate chain is green"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/architecture/reconcile-planner-purity.test.ts (unamended) -> pass"
        status: pass
      - kind: other
        ref: "npm run check -> exit 0 (typecheck, lint, lint:workflows x2, fallow, format:check, test:corresponding x2, test:coverage:direct:negative, test 6379/6379, test:integration 32/32)"
        status: pass
    human_judgment: false

# Metrics
duration: 19min
completed: 2026-09-16
status: complete
---

# Phase 4 Plan 04: The reconcile exemption for dependency provenance Summary

**`buildUninstallBucket` now binds each plugin record and skips the one whose `provenance` is `"dependency"`, proven in both directions from a single hand-built state, with `npm run check` green end to end.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-16T13:17:56Z
- **Completed:** 2026-09-16T13:37:20Z
- **Tasks:** 2
- **Files modified:** 2

## The exemption is INERT at this point

Nothing reaches the new clause yet. Every cascade-installed dependency is still written into `claude-plugins.json` by `install-flow.ts`, so on the next `resources_discover` such a record is DECLARED and never reaches the provenance guard; `classifyDeclaredPlugin` puts its key in `declaredPluginKeys` first. Plan 04-05 (D-04-04 step 3) removes that config write, and from that commit on this `continue` is the only thing standing between a cascade-installed dependency and an uninstall on reload. That is the point of D-04-04's order: the exemption exists and is proven both ways here, before the write it replaces is retired.

## Accomplishments

- **The single exemption** (`plan.ts:497-504`): the inner loop iterates `Object.entries(mpRecord.plugins)` so the record is bound alongside its name, matching the outer loop, and a third `continue` guard in the same shape as the two marketplace guards skips a record whose `provenance === "dependency"`. Three `continue`s in the function, no new function (12 before and after), no new import; the purity gate runs unamended.
- **The pair**, over one shared state builder `provenanceState()` (retained marketplace `keep` holding `steady`, `dependency` with the dependency value, `orphan` with the direct-install value):
  - positive: config declares only `steady`; expected plan has `orphan` in `pluginsToUninstall` and `dependency` absent;
  - negative control: config declares `steady` and `dependency`; expected plan has `orphan` in `pluginsToUninstall` and nothing else.
  Both assert the whole `ReconcilePlan` with `deepStrictEqual` against an independently written literal.
- **Both directions observed:** red then green for the positive case; the over-broad widening observed red in both halves.

## Task Commits

1. **Task 1: the pair** -- `6c0a33e5` (test) -- `provenanceState()` builder and the negative control (the green half); the positive case was observed red at this point and is committed in Task 2 (see Deviations)
2. **Task 2: the exemption** -- `2452a595` (feat) -- `plan.ts` plus the positive case

**Plan metadata:** the `docs(04-04)` commit that adds this file.

## TDD Gate Compliance (Task 2, `tdd="true"`)

- **RED gate:** `git log --grep '^test(04-04):'` -> `6c0a33e5`. **GREEN gate:** `git log --grep '^feat(04-04):'` -> `2452a595`. No REFACTOR commit (nothing to clean up).
- **RED observation** (the plan's Task 1 `<verify>`), against the un-exempted planner, `node --test --test-reporter=tap --test-name-pattern "D-04-05" tests/orchestrators/reconcile/plan.test.ts` -> exit 1, `# tests 2`, `# pass 1`, `# fail 1`:

  ```text
  not ok 1 - D-04-05: keeps an undeclared record whose provenance is dependency
    failureType: 'testCodeFailure'
    error: |-
      Expected values to be strictly deep-equal:
      + actual - expected
      ...
              marketplace: 'keep',
      +       plugin: 'dependency',
      +       scope: 'project'
      +     },
      +     {
      +       marketplace: 'keep',
              plugin: 'orphan',
              scope: 'project'
    code: 'ERR_ASSERTION'
    operator: 'deepStrictEqual'
  ok 2 - D-04-05: still sweeps an undeclared direct install beside a declared dependency
  ```

  Exactly one failure, the dependency half, on the planned assertion: the actual plan sweeps `dependency` too.
- **RED evidence record:** `gsd_run check tdd-red-evidence` on the raw TAP returns `INVALID_RED (no_target_test_failure)` with `failing_tests: ["planReconcile"]` -- the checker's `tapFailedTestNames` anchors `not ok` at column 0 and this suite nests every case under `describe("planReconcile")`, so it sees only the wrapper. The same run with the four-space subtest indentation removed from the `ok`/`not ok` lines (no other change) returns `RED_EVIDENCE_OK (target_test_failed)`, `failing_tests: ["D-04-05: keeps an undeclared record whose provenance is dependency", "planReconcile"]`. Recorded here rather than smoothed over.
- **GREEN:** after the exemption, `node --test tests/orchestrators/reconcile/plan.test.ts tests/architecture/reconcile-planner-purity.test.ts` -> 19 tests, 19 pass, 0 fail.
- **Over-broad widening** (Task 2 acceptance criterion): the guard temporarily changed to `if (!declaredPluginKeys.has(\`${pluginName}@${mpName}\`)) { continue; }` -- skip every undeclared record -- and the pair re-run:

  ```text
  not ok 1 - D-04-05: keeps an undeclared record whose provenance is dependency
      +   pluginsToUninstall: [],
      -   pluginsToUninstall: [
      -       plugin: 'orphan',
  not ok 2 - D-04-05: still sweeps an undeclared direct install beside a declared dependency
      +   pluginsToUninstall: [],
      -   pluginsToUninstall: [
      -       plugin: 'orphan',
  # tests 2
  # pass 0
  # fail 2
  ```

  Both halves go red on the missing `orphan` uninstall. `plan.ts` restored from a byte copy taken before the plant; `grep -c 'record.provenance === "dependency"'` -> 1; the file 18/18.

## Measured gate

| Check | Result |
|---|---|
| `npm run check` on `2452a595` | **exit 0** |
| `npm test` | 6379 tests, 6379 pass, 0 fail (6377 at the end of 04-03 + the 2 new cases) |
| `npm run test:integration` | 32 pass, 0 fail |
| `npm run fallow` | dead-code `No issues found`; health `0 above threshold` (13317 functions); dupes exit 0 |
| `tests/architecture/reconcile-planner-purity.test.ts` | pass, unamended |
| `SKIP=trufflehog pre-commit run --files <changed>` before each commit | every hook passed, nothing rewritten; TruffleHog skipped for the worktree `.git`-file reason |

**Complexity, measured rather than estimated.** ESLint `sonarjs/cognitive-complexity` for `buildUninstallBucket` (probe: `--rule 'sonarjs/cognitive-complexity: ["error", 0]'` on the before and after files) reads **10 -> 13** against the ceiling of 15, not the 10 -> 11 the plan and PATTERNS § 4 projected: the new `if` sits inside the inner `for` inside the outer `for`, so Sonar charges +1 plus a nesting increment of +2. Two points of headroom remain on that axis, not four. Fallow's own health gate reports the function under both its ceilings (0 above threshold; it prints no per-function score for compliant functions). Both gates are green; the number is recorded for whoever next touches this function.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` -- `buildUninstallBucket`: inner loop over `Object.entries`, one inline `continue` on `record.provenance === "dependency"` with a `D-04-05 / D-04-02` comment stating the present-tense rule
- `tests/orchestrators/reconcile/plan.test.ts` -- `provenanceState()` builder (fresh state per call) and the two `D-04-05` cases; the result variable is named `plan` after its production role

## Decisions Made

See `key-decisions` in the frontmatter. The first deserves the mechanism: `planReconcile` is pure, so two whole-result `deepStrictEqual` cases over byte-identical `(merged, state)` inputs cannot have one red and one green against the un-exempted planner. The plan's red/green split therefore requires the halves to differ in the one input the exemption is not about -- the merged config. The control declares the dependency, which is what today's config write does anyway, so it proves "an undeclared direct install is swept" no matter what the exemption does, and it detects the over-broad guard through the same missing `orphan` entry. The shared state is what the plan asked for; the varied config is what makes the split possible.

## Deviations from Plan

### CLAUDE.md-driven adjustment

**1. [Rule 2 - CLAUDE.md precedence] The red positive case was not committed on its own**
- **Found during:** Task 1, before its commit
- **Issue:** the plan's Task 1 commit would carry a failing test. The `npm-coverage-direct` pre-commit hook (`scripts/test-coverage-direct.mjs:625`, `throw new Error("Focused test failed")`) runs the changed pair and fails on any red case, and CLAUDE.md requires every hook green before a commit and forbids committing through a failure. The orchestrator's prompt states the same ("the planned red state ended with 04-03").
- **Fix:** Task 1's commit `6c0a33e5` carries the shared builder and the negative control (green by the plan's own design, 17/17 with every hook passed); the positive case was held in the working tree after its red observation and committed with the exemption in `2452a595` (18/18 plus the purity gate, every hook passed). The RED observation is the recorded run quoted above, not a commit.
- **Files modified:** `tests/orchestrators/reconcile/plan.test.ts` (split across the two commits)
- **Verification:** `git show --stat 6c0a33e5` -> 1 file, +38; `git show --stat 2452a595` -> 2 files, +30/-1; both `test(04-04)` and `feat(04-04)` commits present for the TDD gate grep.

**2. [Tool constraint, not a fix] `check tdd-red-evidence` cannot see nested `describe` subtests**
- Documented under TDD Gate Compliance; no file changed. The de-indented record is a reporting transformation of the same run and is labelled as such.

---

**Total deviations:** 1 CLAUDE.md-driven commit-shape adjustment, 1 documented tool constraint. **Impact:** no production or test content differs from the plan; only which commit the positive case landed in.

## Issues Encountered

- This checkout is a linked worktree (`.git` is a file) on the developer's `features/manifest` branch, dispatched in sequential mode; plans 04-01..03 committed here the same way, so the per-agent `agent-*` branch allow-list for isolated worktrees does not apply. STATE.md and ROADMAP.md were not touched, as instructed.
- No git pre-commit hook is installed; `pre-commit run --files` was run by hand before each commit.

## Threat register notes

- **T-04-09 (mitigated):** the over-broad plant observed red in both halves (quoted above), restored byte for byte before the commit.
- **T-04-10 (mitigated):** `reconcile-planner-purity.test.ts` green with no amendment; `git diff ffa6be6e..HEAD -- tests/architecture/` is empty.
- **T-04-01, T-04-SC:** accepted per the plan; nothing to record.

## Next Phase Readiness

- Plan 04-05 (D-04-02 / D-04-04 step 3) can remove the config write: the clause that replaces it exists and is proven in both directions on a green tree at `2452a595`.
- Note for 04-05's CR-01 reload proof: the negative control here declares the dependency, so it stays green after the write is removed; the positive case is the one that models the post-04-05 world (dependency undeclared, kept).

---
*Phase: 04-install-provenance*
*Completed: 2026-09-16*

## Self-Check: PASSED

- `[ -f ]` on `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` and `tests/orchestrators/reconcile/plan.test.ts`: FOUND
- Commits `6c0a33e5`, `2452a595` present in `git log`: FOUND
- `commits: 2` measured from `plan_head_before` `ffa6be6e..HEAD`
