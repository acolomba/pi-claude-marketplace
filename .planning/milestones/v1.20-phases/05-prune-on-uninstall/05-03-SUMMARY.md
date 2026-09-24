---
phase: 05-prune-on-uninstall
plan: 03
subsystem: testing
tags: [uninstall, prune, dependencies, docs, edge, phase-gate, prune-05]

# Dependency graph
requires:
  - phase: 05-prune-on-uninstall
    provides: "05-01: the dependents guard, buildScopeDeclarationIndex, `dependents remain`; 05-02: PRUNE_FLAG on the catalog surface, pruneOrphans, the sweep, `dependency pruned`"
provides:
  - "Two FLAG-01 / D-05-10 end-to-end cases in `tests/edge/handlers/plugin/uninstall.test.ts` proving a typed `--prune` crosses the handler-to-orchestrator seam by effect, with `seedOrphanedDependency` (a `dependency`-provenance record beside `demo` under a real `alpha` manifest)"
  - "`## Removing a plugin other plugins need` and `## Pruning dependencies nothing needs` in `docs/dependency-resolution.md`, outside the gated failure table"
  - "`--keep-data` / `--prune` examples and the refusal pointer in README's uninstall block"
  - "`PRUNE-GUARD-MR-01` in `.planning/BACKLOG.md`: `marketplace remove` bypasses the dependents guard (a recorded decision)"
  - "The phase gate measured on the finished tree: `npm run check` exit 0 (6461 unit / 32 integration, 0 failures), `pre-commit run --all-files` exit 0"
affects: [phase verification, milestone ship (changelog is written at ship time)]

# Actuals (#2632) -- estimateTokens scale (chars/4 over the realized diff), not a harness count.
actuals:
  tokens: 3313
  tasks: 3
  commits: 2
plan_head_before: 93442a6e15e708ddbe4c6fda09095f5fec649389

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Edge forwarding proof by effect: an option the edge handler maps from a catalog-owned flag is proven to reach the orchestrator by seeding a state the option alone changes (an orphaned dependency) and asserting the changed state plus the row brace that only that option produces, with the flag-less command on the same seed as the control"
    - "Mutation probe in place of a fabricated RED: when a regression pin is written over shipped behavior, the test's discriminating power is shown by removing the production mapping in a scratch edit, observing the target case fail, and restoring the file before any commit"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/uninstall.test.ts
    - docs/dependency-resolution.md
    - README.md
    - .planning/BACKLOG.md

key-decisions:
  - "The D-05-10 pair asserts the whole notification array and both scopes' records: the `{dependency pruned}` brace on the `dep` row is the one byte that proves `prune: true` crossed the seam, and the flag-less control keeps `dep`"
  - "`seedInstalledPlugin` gained a `withOrphanedDependency` boolean rather than a sibling helper; `seedOrphanedDependency` composes it with the manifest write, because the guard fails closed on a record its marketplace does not list (D-05-07) and the sweep reads the same declarations"
  - "The guard section states the two-stale-records consequence plainly and names `marketplace remove` as the exit BECAUSE it runs no guard; the backlog entry for guarding `marketplace remove` records that any future guard must keep that exit open"
  - "The prune prose says a promoted dependency counts as installed by name, and that a refused or failed uninstall prunes nothing (D-05-03), so a reader cannot use `--prune` as a back door to a standalone prune"

patterns-established:
  - "Docs sections that name closed-set tokens live OUTSIDE `## Why a dependency can fail`; the doc-agreement gate parses only that section and both new sections were placed before it and verified against the gate"

requirements-completed: [PRUNE-01, PRUNE-04, PRUNE-05, FLAG-01]

coverage:
  - id: D1
    description: "A typed `/claude:plugin uninstall demo@alpha --prune` through the real edge handler removes a seeded orphaned dependency in the same scope and renders its `{dependency pruned}` row; the same command without `--prune` keeps it; the user scope is untouched in both cases (FLAG-01 -> PRUNE-01 end to end, D-05-10)"
    requirement: FLAG-01
    verification:
      - kind: unit
        ref: "tests/edge/handlers/plugin/uninstall.test.ts#FLAG-01 / D-05-10: a typed --prune reaches the sweep and removes the orphaned dependency beside the named plugin"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/uninstall.test.ts#FLAG-01 / D-05-10: the same command without --prune keeps the orphaned dependency"
        status: pass
    human_judgment: false
  - id: D2
    description: "The user docs state what `--prune` removes and never removes, that a reload never prunes, what the dependents refusal means and how to clear it, and the two-stale-records consequence with its remedy, without adding a token row to the gated failure table (PRUNE-04 / PRUNE-05 in prose)"
    requirement: PRUNE-04
    verification:
      - kind: unit
        ref: "tests/architecture/dependency-doc-agreement.test.ts#RESV-06 the failure table names every reason the cascade stamps, and no others"
        status: pass
      - kind: other
        ref: "grep -c '^## ' docs/dependency-resolution.md == 13; the acceptance greps for `never removes a plugin you installed by name`, `{dependency pruned, data kept}`, `A reload never prunes`, `{dependents remain}`, `marketplace remove`, `marketplace update` all hit; `Phase [0-9]` grep is empty"
        status: pass
    human_judgment: false
  - id: D3
    description: "The refusal row and the pruned row read sensibly to a person in a live Pi session; the dev-tree provenance residue declines correctly; the two-stale-records scenario clears through `marketplace remove` (the three Manual-Only Verifications of 05-VALIDATION.md)"
    requirement: PRUNE-05
    verification: []
    human_judgment: true
    rationale: "The catalog pins the bytes and the edge suite pins the effect; whether the rows read well, and whether D-05-07's fail-closed cost stands or is relaxed after seeing the two-stale-records refusal, are operator judgments on a running system"
  - id: D4
    description: "The phase gate is green on the finished tree and its measurements are in one place for the verifier"
    requirement: PRUNE-01
    verification:
      - kind: other
        ref: "npm run check (exit 0: typecheck, ESLint, workflow lint, fallow dead-code/health/dupes, prettier, corresponding-tests, direct-coverage negative, 6461 unit, 32 integration)"
        status: pass
      - kind: other
        ref: "SKIP=trufflehog pre-commit run --all-files (exit 0, 31 hooks Passed, no rewrites)"
        status: pass
    human_judgment: false

# Metrics
duration: 19min
completed: 2026-09-17
status: complete
---

# Phase 05 Plan 03: Edge-to-sweep proof, user docs, phase gate Summary

**A typed `uninstall demo@alpha --prune` through the real edge handler removes a seeded orphaned dependency that the flag-less command keeps, the docs tell a user what `--prune` removes and why an uninstall was refused before they run either, and the whole gate is green on the finished tree.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-16T23:53:26Z
- **Completed:** 2026-09-17T00:12:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- The handler-to-orchestrator seam is proven by effect: with `demo` (explicit) and `dep` (dependency provenance, declared by nothing) seeded under a real `alpha` manifest, `uninstallHandler("demo@alpha --prune", ctx)` leaves the project state empty and renders `○ dep v1.0.0 (uninstalled) {dependency pruned}` beneath the `demo` row; `uninstallHandler("demo@alpha", ctx)` leaves `["dep"]` and the plain row. The user scope keeps `demo` in both.
- `docs/dependency-resolution.md` gained two sections in the Plain register: the refusal (`{dependents remain}`, the cause line, both remedies, the reload behavior, the fail-closed rule with `marketplace update` / `marketplace remove`, and the two-stale-records consequence) and the sweep (whole-scope, fixpoint, never by-name / never held / never other-scope / never without a completed primary removal, the row shapes, `--keep-data`, nothing-to-prune, reload never prunes, partial failure). Both sit before `## Why a dependency can fail`; the doc-agreement gate is green.
- README's uninstall block shows `--keep-data` and `--prune` with one example each and points at the refusal; `PRUNE-GUARD-MR-01` records the `marketplace remove` bypass as a decision.
- Gate: `npm run check` exit 0 with 6461 unit tests (6459 before this plan; 6382 before the phase) and 32 integration tests, 0 failures; `SKIP=trufflehog pre-commit run --all-files` exit 0 with no hook rewrite.

## Task Commits

1. **Task 1: the flag reaches the sweep** - `33bf7964` (test)
2. **Task 2: the user-facing prose and the deferred decision** - `4041f3ea` (docs)
3. **Task 3: the phase gate** - no commit (verification only, by design)

## Files Created/Modified

- `tests/edge/handlers/plugin/uninstall.test.ts` - `alphaManifestPath`, `EMPTY_RESOURCES`, `seedInstalledPlugin(..., withOrphanedDependency)`, `seedOrphanedDependency` (writes `<cwd>/alpha-src/.claude-plugin/marketplace.json` listing `demo` and `dep` with `source: "./plugins/<name>"`), `PROJECT_UNINSTALLED_DEPENDENCY_PRUNED`, `PROJECT_RECORD_REMOVED_ORPHAN_KEPT`, the two `FLAG-01 / D-05-10` cases.
- `docs/dependency-resolution.md` - `## Removing a plugin other plugins need`, `## Pruning dependencies nothing needs` (11 -> 13 `##` headings).
- `README.md` - the uninstall block's `--keep-data` and `--prune` sentences, examples and pointer.
- `.planning/BACKLOG.md` - `## PRUNE-GUARD-MR-01`.

## Measured gate

**`npm run check`:** exit 0. Chain: typecheck, lint, lint:workflows (+ negative), fallow (dead-code, health, dupes), format:check, test:corresponding (+ negative), test:coverage:direct:negative, `npm test` (6461 pass / 0 fail), `npm run test:integration` (32 pass / 0 fail). The two pi-subagents integration tests passed on this machine's global peer.

**`SKIP=trufflehog pre-commit run --all-files`:** exit 0, 31 hooks `Passed`, the rest `Skipped` for no matching files; `git status --porcelain` afterwards lists only the operator's pre-existing unrelated edits (no hook rewrite).

**Closed set and catalog:** `REASONS.length` 56, tail `dependency pruned`; `EXPECTED_STATE_COUNT` 212; `EXPECTED_UTF8_BYTES` 28_548; `grep -c 'catalog-state:' docs/output-catalog.md` 217. Unchanged by this plan, as planned.

**Planning-reference grep:** `grep -rn "Phase [0-9]\|Pitfall [0-9]" extensions tests docs --include=*.ts --include=*.md | grep -v "^docs/competitive-analysis"` returns only pre-existing hits in `extensions/pi-claude-marketplace/bridges/README.md`, `domain/README.md` (early scaffolding checklists) and `bridges/agents/stage.ts:312` (`Phase 2:` of the two-phase commit, domain language); `git log cf01963e..HEAD` touches none of the three. The phase wrote nothing that matches.

**Complexity (fallow cyclomatic/cognitive), consolidated for the phase.** Ceilings 20 / 15; ESLint `sonarjs/cognitive-complexity` ceiling 15. Measured with `fallow health --complexity --max-cyclomatic 1 --max-cognitive 1 --format json` on the finished tree (fallow 3.22.0); "before" is the pre-phase value from the 05-01 table, `-` for a function the phase created.

| Function | Before the phase | After the phase |
|---|---|---|
| `uninstallPluginWithTransaction` | 15/14 (ESLint 12) | 15/14 (ESLint 12) |
| its lock closure (`<arrow>` at `uninstall.ts:978`) | 6/5 | 7/6 |
| `narrowCascadeFailure` | 7/5 | 8/6 |
| `assertNoDependents` | - | 3/2 |
| `foldPartialCascadeFailure` | 3/2 | 2/1 |
| `cascadeFailureCause` | - | 2/1 |
| `removeDependencyMember` | - | 3/2 |
| `sweepOrphans` | - | 2/1 |
| `finalizePrunedMembers` | - | 4/5 |
| `buildMemberFailedRow` | - | 1/0 |
| `buildScopeDeclarationIndex` | - | 5/9 |
| `readRecordDeclarations` | - | 6/5 |
| `findDependents` | - | 3/3 |
| `pruneOrphans` | - | 4/5 |
| `isHeldBy` | - | 4/4 |
| `composePrunedRow` | - | 2/1 |
| `composeRemovalBlocks` | - | 3/4 |
| `applyPluginOutcomeToBlock` | 14/5 | 14/5 |
| `failedRowCause` | - | 3/2 |
| `applyPluginUninstalls` | 6/9 | 7/10 |
| edge handler closure (`edge/handlers/plugin/uninstall.ts:39`) | 7/6 | 7/6 |

No function is above either ceiling; no `health.thresholdOverrides` entry was added.

**Fixtures the phase needed a manifest for (restated):** two in `tests/orchestrators/plugin/uninstall.test.ts` (the shared-clone case via `seedGitPlugin`, the retry-proof hand seed), none in the integration suite (05-01); `seedDeclaringScope` for the two-marketplace prune cases (05-02); `seedOrphanedDependency` for the edge pair (this plan).

## Manual verification carried into phase UAT

Recorded in `05-VALIDATION.md` § Manual-Only Verifications; restated here so `/gsd-verify-work` finds them.

1. **Live session (PRUNE-04, PRUNE-05).** On a scratch scope: install a plugin that declares a dependency; run `uninstall <dependency>@<mp>` and confirm the refusal row names the dependent on its `cause:` line; run `uninstall <root>@<mp> --prune` and confirm the dependency's `{dependency pruned}` row and that `list` shows neither afterwards.
2. **Dev-tree provenance residue (PRUNE-02).** On the operator's own dev tree, records written before the provenance field were back-filled as direct installs, so `--prune` correctly DECLINES them. The remedy is to uninstall and reinstall those plugins; this is not a prune defect (04-06-SUMMARY item 1).
3. **Two stale records (PRUNE-05, D-05-07's cost).** Two records in one scope both absent from their marketplace manifests refuse each other's uninstall with mutual `{not in manifest}` rows naming each other; `marketplace remove` clears it. The operator decides at UAT whether D-05-07 stands or is relaxed.

## TDD Gate Compliance

`workflow.tdd_mode` is `false` for this project. Task 1 is `tdd="true"` over production code Plans 05-01 and 05-02 already shipped, so the two D-05-10 cases passed on their first run (2/2, exit 0): this is the plan's anticipated "unexpected GREEN" regression-pin case, and no RED was fabricated.

- **Discrimination probe (not a RED gate):** with the handler's `...(localFlag.consumedFlags.has(PRUNE_FLAG) && { prune: true })` line replaced by a comment in a scratch edit, `node --test --test-reporter=tap --test-name-pattern "D-05-10"` exited 1 with the `--prune` case failing on the notification assertion (the plain row rendered instead of the pruned pair) and the control case passing; the handler was restored from a scratchpad copy and `git status` showed no diff under `extensions/` before the commit. `gsd_run check tdd-red-evidence` was not run: there was no RED to record, and the probe is a mutation check on a pin, not a red-to-green cycle.
- **GREEN / commit:** `33bf7964` (`test(05-03)`), the honest single-commit shape for a regression pin.
- **REFACTOR:** none.

## Decisions Made

- The D-05-10 pair's `readInstalledPlugins` assertion is stated twice per case (inside `readObservedEffects` and standalone) so the plan's acceptance grep for `[]` / `["dep"]` reads the load-bearing assertion directly.
- The guard prose does not claim upstream permits uninstalling a still-required plugin (A-14): it says Claude Code documents the refusal for `disable` and this extension applies it to `uninstall`.
- The prune prose cites `D-05-01 / D-05-02`, `D-05-03`, `D-05-13` and the guard prose `D-05-06`, `D-05-07` inline where a reader needs the why; no phase, plan or wave number appears.

## Deviations from Plan

None - plan executed exactly as written. (The one wording adjustment beyond the plan's sketch: the guard section says `--prune` on the dependent sweeps the target only "if the plugin arrived as a dependency", because PRUNE-02 keeps a by-name record; the plan's sketch "then the plugin goes as an orphan" would have overstated it.)

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-05-13: every claim in the prune section maps to a pinned case (PRUNE-02, PRUNE-03, D-05-03, D-05-08, D-05-09, D-05-12, D-05-13) or a catalog state, and the three load-bearing phrases are present. T-05-14: both new sections sit before `## Why a dependency can fail`, and the section under that heading contains neither `dependency pruned` nor `dependents remain` (grep 0); the doc-agreement gate passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 is fully executed: all three plans have SUMMARYs; PRUNE-01..05 and FLAG-01 are complete on the requirement ledger.
- The verifier's UAT carries the three manual items above; item 3 is the one open decision (D-05-07 stands or is relaxed).
- The changelog for `--prune` and the dependents guard is written at ship time for the whole milestone, not in this phase.

## Self-Check: PASSED

- `tests/edge/handlers/plugin/uninstall.test.ts` FOUND
- `docs/dependency-resolution.md` FOUND
- `README.md` FOUND
- `.planning/BACKLOG.md` FOUND
- commit `33bf7964` FOUND
- commit `4041f3ea` FOUND

---
*Phase: 05-prune-on-uninstall*
*Completed: 2026-09-17*
