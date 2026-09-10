---
phase: 07-gate-integrity
plan: 01
subsystem: testing
tags: [architecture-gates, node-test, fallow, mkdtemp, source-scan, nfr-5]

requires:
  - phase: 06-assertion-and-module-refinement
    provides: the planted-offender rule for architecture gates, and the ban on configuration-existence assertions
  - phase: 04-hermetic-test-infrastructure
    provides: the case-owned temporary filesystem constraint the temp-root controls honour
provides:
  - "tests/architecture/gate-targets.ts — the literal repo-relative target registry (D-07-05), holding NETWORK_FREE_TARGETS (23 entries), NETWORK_FREE_CONTROL_TARGET, and MISSING_TARGET_PROBES"
  - "tests/architecture/temp-root-control.ts — the single owner of the mkdtemp / copy / mutate / dispose sequence (D-07-01, D-07-04), exporting withTempRoot, materializeTargets, plantOffender, plantBenignNearMiss"
  - "assertNoForbiddenSurface's promoted scan root (opts.root) and its ScanReport return value carrying visited and waived (D-07-01, D-07-03)"
  - "the NFR-5 orchestrator-network gate rewired onto all four mechanisms, with offender, benign, and near-miss controls"
  - "a dynamic-import forbidden pattern closing OPEF-F01"
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07, gate-integrity, architecture-gates]

actuals:
  tokens: 13000
  tasks: 3
  commits: 2
  plan_head_before: bc34d335

tech-stack:
  added: []
  patterns:
    - "Temp-root offender derived from the real target: copy the real files, mutate one copy, run the real scan against an injected root"
    - "Visitation reporting: a scan returns the paths it opened, and the gate deep-compares them against its declared registry group"
    - "Literal target registry: gates import their production paths, composing none locally"

key-files:
  created:
    - tests/architecture/gate-targets.ts
    - tests/architecture/temp-root-control.ts
  modified:
    - tests/architecture/source-scan.ts
    - tests/architecture/source-scan.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts

key-decisions:
  - "The scan root was promoted, not added alongside: opts.root ?? REPO_ROOT is read once and used at the only readFile join, so no code path can read REPO_ROOT while a caller believes it injected a root."
  - "NETWORK_FREE_CONTROL_TARGET was added to the registry beyond the plan's named exports, typed as (typeof NETWORK_FREE_TARGETS)[number] so the compiler enforces its membership. This keeps the production path the temp-root controls mutate inside the registry instead of spelling it in the gate."
  - "EXTENSION_ROOT_REL, ORCHESTRATORS_REL, and ARCHITECTURE_DIR_REL were deferred to the plan that first consumes them: fallow dead-code fails on an exported symbol with no consumer, and npm run fallow runs as a pre-commit hook, so an unconsumed export cannot be committed."
  - "compat-01's delegation clause now scrapes gate-targets.ts rather than the gate file, because the target literals it looks for moved into the registry."

patterns-established:
  - "Pattern: withTempRoot(prefix, body) owns the mkdtemp / rm lifecycle; rm takes the mkdtemp return value directly and runs in a finally"
  - "Pattern: a gate proves visitation with assert.ok(group.length > 0) plus assert.deepEqual(report.visited, [...group])"
  - "Pattern: each gate carries three controls — planted offender rejects, unmutated copies pass, forbidden token in a comment passes"

requirements-completed: [GGAT-01]

coverage:
  - id: D1
    description: "The NFR-5 orchestrator-network gate reads its 23 targets from the registry and reports every path it opened"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate fires on a gitOps surface planted into a temp-root copy of a real target, and stays green on both benign controls"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5: the gate fires on a gitOps surface planted in a copy of a real target"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5: unmutated copies of the same real targets pass and report every path opened"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5: a forbidden token inside a line comment passes, so the gate still strips comments"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gate covers orchestrators/marketplace/autoupdate.ts, list.ts, and remove.ts (OMR-F01, OMRR-F004)"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "node -e over gate-targets.ts: 23 entries, one match each for marketplace/autoupdate, marketplace/list.ts, marketplace/remove.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pattern list fires on a dynamic import of platform/git and stays silent on the existing legitimate dynamic import (OPEF-F01)"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "node -e regex probe: true for await import(\"../../platform/git.ts\"), false for await import(\"../../domain/plugin-resolver.ts\")"
        status: pass
    human_judgment: false
  - id: D5
    description: "assertNoForbiddenSurface honours an injected root, reports visited in declared order, and separates waived targets from visited ones"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/source-scan.test.ts#an injected root replaces the repository root for every read the scan performs"
        status: pass
      - kind: unit
        ref: "tests/architecture/source-scan.test.ts#a scan with no injected root reads the repository and reports its targets in declared order"
        status: pass
      - kind: unit
        ref: "tests/architecture/source-scan.test.ts#a waived target is reported as waived and is absent from the visited paths"
        status: pass
      - kind: unit
        ref: "tests/architecture/source-scan.test.ts#an empty target list resolves with nothing visited and nothing waived"
        status: pass
    human_judgment: false
  - id: D6
    description: "The slice holds under both complexity ceilings, all three Fallow sub-gates, ESLint, Prettier, and both structural test-tree gates"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:negative && npm test"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-10
status: complete
---

# Phase 7 Plan 01: Gate Integrity Tracer Summary

**The NFR-5 network gate now answers both "what did you read?" and "what would make you fail?" — 23 registry-owned targets, a deep-compared visitation report, and an offender derived from a real file inside a hermetic temp root.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-10T14:56:00Z
- **Completed:** 2026-09-10T15:26:00Z
- **Tasks:** 3 of 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- Built the target registry (`tests/architecture/gate-targets.ts`) holding full literal repo-relative paths and nothing composed, and moved the network gate's 20-entry array into it verbatim with its per-entry rationale intact.
- Closed the three live target omissions: `orchestrators/marketplace/autoupdate.ts`, `list.ts`, and `remove.ts` are now gated, each with its own network-free-by-contract rationale naming `orchestrators/plugin/clone-cache.ts` as the seam a future git need must route through. `remove.ts` carried no such header of its own, so the registry entry is where the claim is now recorded.
- Closed the pattern-form blind spot (`OPEF-F01`) with a fifth forbidden pattern matching a dynamic `import()` of `platform/git`. Measured: it matches `await import("../../platform/git.ts")` and does not match the tree's one real dynamic import, `await import("../../domain/plugin-resolver.ts")`.
- Promoted `assertNoForbiddenSurface`'s scan root into the `opts` bag and changed its return type to `ScanReport { visited, waived }`. All six pre-existing call sites compile unchanged.
- Built the shared temp-root mechanic in one module, so the mkdtemp / copy / mutate / dispose sequence exists in exactly one place ahead of the twelve gates that will reuse it.

## Task Commits

1. **Task 1: End-to-end "the NFR-5 gate proves what it read and what makes it fail"** — `f0285784` (test)
2. **Task 2: Gate the gate — injected root, visited/waived report, promoted-root invariant** — `998c2b04` (test)
3. **Task 3: Prove the slice holds under both complexity ceilings and the full lint gate** — no commit; the task is a verification sweep and reported nothing to fix (see Issues Encountered).

## Files Created/Modified

- `tests/architecture/gate-targets.ts` — created. The literal repo-relative target registry: `NETWORK_FREE_TARGETS` (23), `NETWORK_FREE_CONTROL_TARGET`, `MISSING_TARGET_PROBES` (4).
- `tests/architecture/temp-root-control.ts` — created. `withTempRoot`, `materializeTargets`, `plantOffender`, `plantBenignNearMiss`, plus a private `appendToCopy` the last two share.
- `tests/architecture/source-scan.ts` — `opts.root` added to the existing bag, `ScanReport` exported, `visited` / `waived` accumulated, ENOENT-versus-rethrow split preserved unchanged.
- `tests/architecture/no-orchestrator-network.test.ts` — local target array deleted, registry imported, fifth pattern added, message builder extracted, three temp-root control cases added.
- `tests/architecture/source-scan.test.ts` — four new cases; the four existing case titles unchanged, their probe paths now imported from the registry.
- `tests/architecture/compat-01-no-expansion.test.ts` — delegation clause repointed at the registry module (deviation 1).

## Negative Controls Observed

Both required manual checks were performed and reverted:

1. **Planted line removed.** Deleting the `plantOffender(root, NETWORK_FREE_CONTROL_TARGET, "const gitOps = DEFAULT_GIT_OPS;")` call and running that case alone produced `AssertionError [ERR_ASSERTION]: Missing expected rejection` with `expected: /gitOps surface detected in network-free module\(s\)/`. The file was restored and the four cases re-run green.
2. **`{ root }` removed.** Deleting the injected root from the promoted-root case's rejecting call produced the same `Missing expected rejection` failure — the scan fell back to the real tree, which carries no planted surface. The file was restored and all eight cases re-run green.

## Final Counts

- `NETWORK_FREE_TARGETS`: **23** entries, all unique, all resolving on disk.
- `MISSING_TARGET_PROBES`: 4 entries, none resolving, by design.
- `tests/architecture/no-orchestrator-network.test.ts`: 4 passing cases, 0 failing.
- `tests/architecture/source-scan.test.ts`: 8 passing cases, 0 failing.
- Full unit suite: 5892 passing, 0 failing.

## Decisions Made

- **Promote, do not add alongside.** `opts.root ?? REPO_ROOT` is read once into `scanRoot` and used at the single `readFile` join. There is no second path that reads `REPO_ROOT` inside the loop, which is what makes the Task 2 invariant case meaningful: a half-promoted root would resolve both halves without ever opening the mutated copy.
- **`NETWORK_FREE_CONTROL_TARGET` names the mutated target inside the registry.** The controls need to name one production path. Spelling it in the gate would put a production path outside the registry, which is exactly what the forthcoming meta-gate (`D-07-06`) will treat as an offender. Typing the constant as `(typeof NETWORK_FREE_TARGETS)[number]` makes the compiler enforce that it points into the group, so the second reference cannot drift.
- **`plantOffender` and `plantBenignNearMiss` share a private `appendToCopy`.** Two near-identical write bodies would have been the first two occurrences of a clone that a third gate would complete, and `duplicates.threshold: 3` is the reason this module exists at all.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] `compat-01-no-expansion.test.ts` scraped the network gate's source text for the two info paths**

- **Found during:** Task 1
- **Issue:** The COMPAT-01 delegation clause proves the two info surfaces are still gated by reading `tests/architecture/no-orchestrator-network.test.ts` and looking for the quoted path literals. Moving the target array into the registry emptied that file of those literals, so the clause failed with `actual: [ '…/plugin/info.ts', '…/marketplace/info.ts' ]`.
- **Fix:** Repointed `NETWORK_GATE_REL` at `tests/architecture/gate-targets.ts` and updated the clause's comment to name `D-07-05`. The clause's mechanism and assertion are otherwise unchanged.
- **Files modified:** `tests/architecture/compat-01-no-expansion.test.ts` (outside this plan's `files_modified`)
- **Verification:** `node --test tests/architecture/compat-01-no-expansion.test.ts` — 14 passing, 0 failing.
- **Committed in:** `f0285784`

**2. [Rule 3 - Blocker] `EXTENSION_ROOT_REL`, `ORCHESTRATORS_REL`, and `ARCHITECTURE_DIR_REL` deferred to their first consumer**

- **Found during:** Task 1
- **Issue:** The plan asks the registry to export three directory-root constants. No task in this plan consumes any of them, and `fallow dead-code` fails on an exported symbol with no consumer. Measured with a throwaway probe: a single unconsumed `export const` in `tests/architecture/` produced `● Unused exports (1)` and `✗ 1 export`, exit 1. `npm run fallow` is a pre-commit hook (`.pre-commit-config.yaml`, `npm-fallow`, matching `tests/.*\.ts`), so an unconsumed export cannot be committed at all — and Task 3 exists specifically to hold the slice to that gate.
- **Fix:** The three constants are not created in this plan. The plan that first composes a directory walk from one of them creates it there. No registry group or gate behaviour is affected: every path this plan guards is a full literal entry in `NETWORK_FREE_TARGETS` or `MISSING_TARGET_PROBES`, which is the `D-07-05` obligation.
- **Files modified:** `tests/architecture/gate-targets.ts`
- **Verification:** `npm run fallow` exits 0 with all three sub-runs green.
- **Committed in:** `f0285784`

**3. [Rule 3 - Blocker] `MISSING_TARGET_PROBES` moved from the Task 1 commit to the Task 2 commit**

- **Found during:** Task 1
- **Issue:** Same cause as deviation 2. `MISSING_TARGET_PROBES` has one consumer — `source-scan.test.ts`, which Task 2 writes. Declaring it in the Task 1 commit made `fallow dead-code` report `tests/architecture/gate-targets.ts:152 MISSING_TARGET_PROBES` as an unused export and would have blocked that commit's `npm-fallow` hook.
- **Fix:** The constant ships in `998c2b04` alongside the case that imports it. The plan's content is unchanged; only which of two adjacent commits carries it moved.
- **Files modified:** `tests/architecture/gate-targets.ts`
- **Verification:** `SKIP=trufflehog pre-commit run --files …` passed all hooks for both commits, including `npm fallow`.
- **Committed in:** `998c2b04`

---

**Total deviations:** 3 auto-fixed (3 × Rule 3 - blocking issue).
**Impact on plan:** No scope creep. Deviation 1 repairs a gate this plan's own change broke and touches one line plus a comment. Deviations 2 and 3 are commit-ordering and deferral consequences of a repository gate the plan itself names in Task 3; no assertion, target, or control was weakened, added, or removed because of them.

## Issues Encountered

**Task 3's `mkdtemp` locality criterion reads narrower than the tree allows.** The criterion is `grep -l "mkdtemp" tests/architecture/*.ts` returning only `temp-root-control.ts`; it actually returns six files. The other five (`hooks-async-rewake`, `hooks-lifecycle`, `integration-materialization-gate`, `config-state-consistency`, `revalidation`) are pre-existing gates that build synthetic fixture trees; none of them names `copyFile` or `REPO_ROOT`, so none copies or mutates a real target. The criterion's stated substance — "the mkdtemp-copy-mutate sequence appears in exactly one file" — holds: `grep -rl "copyFile" tests/architecture/*.ts` returns `tests/architecture/temp-root-control.ts` and nothing else. `fallow dupes` reports the same 873 duplicated lines across 38 files as before this plan, so the new module introduced no clone group. Migrating the five pre-existing gates onto the shared control is out of this plan's scope and belongs with whichever later plan touches them.

**Task 3 produced no commit.** The task is a verification sweep with an explicit "fix anything they report" instruction. Nothing was reported: typecheck, ESLint (both the five-file invocation and the whole `tests/architecture` directory), all three Fallow sub-gates, Prettier, the corresponding-test gate and its negative harness, the direct-coverage negative harness, the unit-suite glob gate, and the full 5892-case unit suite all exit 0. There was therefore nothing to commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The four mechanisms this phase reuses are proved together on one real gate:

- **Registry** — `gate-targets.ts` exists and holds literal paths only. Later plans add one group per migrated gate beside `NETWORK_FREE_TARGETS`.
- **Temp-root control** — `temp-root-control.ts` is the single owner. Later gates call `withTempRoot` / `materializeTargets` / `plantOffender` / `plantBenignNearMiss` rather than writing the sequence.
- **Injected root** — `assertNoForbiddenSurface(targets, patterns, describe, { root })` works and is proved to govern every read.
- **Visitation report** — the `assert.ok(group.length > 0)` plus `assert.deepEqual(report.visited, [...group])` pair is the shape every migrated gate copies.

One thing the next plans must know: an exported symbol with no consumer turns `npm run fallow` red and blocks the commit. Add a registry group in the same commit as the gate that imports it.

Not attempted here and still open for later plans in this phase: the self-hosting meta-gate (`D-07-06`), which is what will make the "no production path outside the registry" rule enforceable rather than conventional. Until it lands, `compat-01-no-expansion.test.ts` and `source-scan.test.ts` still name production and test paths locally.

---
*Phase: 07-gate-integrity*
*Completed: 2026-09-10*
