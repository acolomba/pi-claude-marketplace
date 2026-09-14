---
phase: 05-production-export-ownership
plan: "07"
subsystem: testing
tags: [typescript, node-test, fallow, dependency-injection, bridges]

# Dependency graph
requires:
  - phase: 05-production-export-ownership
    provides: "Wave 4 hook callback/constant/facade privatization and the thirteen strengthened barrel absence proofs (05-05, 05-11)"
provides:
  - "Hook config writing composed at bridges/hooks/index.ts from the production-consumed createWriteHookConfig factory"
  - "Skill tree removal composed at bridges/skills/index.ts from the production-consumed createUnstagePluginSkills factory"
  - "hookConfigPathFor privatized inside bridges/hooks/stage.ts"
  - "Public-contract owner tests for both bridge compositions against real temporary trees"
  - "Measured production finding delta 42 -> 39, exactly three removals, zero additions, for the parent wave reconciliation"
affects: [05-12, 05-24, 05-28, wave-5-reconciliation]

# Actuals (#2632)
actuals:
  tasks: 2
  commits: 2
  plan_head_before: 2c67f3915091e3a2573f419ea3235d259d29669b
  # tokens: deliberately omitted. Actual token telemetry is unavailable in this
  # environment and the user decision on record forbids reporting diff
  # characters divided by four as an actual. See 05-CONTEXT.md / handoff.

tech-stack:
  added: []
  patterns:
    - "Concrete Node adapter construction lives in the public bridge barrel; the semantic factory and its injected port contract stay in the implementation owner"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts
    - extensions/pi-claude-marketplace/bridges/skills/unstage.ts
    - extensions/pi-claude-marketplace/bridges/skills/index.ts
    - tests/bridges/hooks/stage.test.ts
    - tests/bridges/hooks/index.test.ts
    - tests/bridges/skills/unstage.test.ts
    - tests/bridges/skills/index.test.ts

key-decisions:
  - "Retire the stage/unstage default convenience bindings rather than keep a compatibility alias: no production consumer imported them directly, so an alias would have re-created the test-only surface the plan removes."
  - "Keep createWriteHookConfig and createUnstagePluginSkills exported from their implementation owners and give each a single real production caller (the bridge barrel), rather than moving the factory or adding a new module."
  - "Leave the shared census pin in tests/architecture/gate-targets.ts untouched. The plan assigns the single pin edit to the parent wave reconciliation, so the two pin-equality gates fail by design until all Wave 5 plans land."
  - "Treat both tdd=\"true\" tasks as behavior-preserving refactors instead of RED/GREEN cycles: the moved bindings add no behavior, so a RED attempt would be an unexpected green. Behavior preservation was proved by running the new owner tests against the pre-change production first."

patterns-established:
  - "Composition move proof: apply the owner test changes alone, run them green against the OLD production, then apply the production move and re-run. A green pre-move run is the evidence that no behavior changed."
  - "Finding disposition evidence is the repository's own census gate diff, not a clean count. The gate names the exact three removed identities and reports zero additions."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "bridges/hooks/index.ts owns the concrete NODE_HOOKS_TREE_INSPECTOR binding and constructs writeHookConfig from createWriteHookConfig; stage.ts keeps the write/validate/remove implementation and hookConfigPathFor becomes private."
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/index.test.ts#writeHookConfig / writes complete hook bytes repeatedly through the Node tree inspector"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/index.test.ts#writeHookConfig / refuses an escaping source symlink before replacing staged or external bytes"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/hooks/stage.test.ts tests/bridges/hooks/index.test.ts (25 tests, 25 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/stage.ts (branches 34/34, functions 9/9, lines 287/287)"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/index.ts (branches 5/5, functions 4/4, lines 41/41)"
        status: pass
    human_judgment: false
  - id: D2
    description: "bridges/skills/index.ts owns the concrete NODE_SKILLS_UNSTAGE_REMOVER binding and constructs unstagePluginSkills from createUnstagePluginSkills; unstage.ts keeps the factory and the whole validated removal concern."
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/index.test.ts#unstagePluginSkills / removes only recorded trees and retries missing names through the Node remover"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/skills/unstage.test.ts tests/bridges/skills/index.test.ts (15 tests, 15 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/skills/unstage.ts (branches 11/11, functions 2/2, lines 67/67)"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/skills/index.ts (branches 2/2, functions 1/1, lines 36/36)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No production consumer regressed: the real callers of both bridge operations (install-outcome, update-swap, reinstall-replace, marketplace/shared) stay green."
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/**/*.test.ts (2113 tests, 2113 pass, 0 fail)"
        status: pass
      - kind: unit
        ref: "node --test tests/bridges/**/*.test.ts tests/architecture/**/*.test.ts (1424 tests, 1422 pass, 2 fail - both the parent-owned census pin gates)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Production finding census moves 42 -> 39 with exactly three removals and zero additions; the single pin edit is deferred to the parent wave reconciliation."
    requirement: "EXPORT-01"
    verification:
      - kind: other
        ref: "npx fallow dead-code --production --format json --no-cache -> total_issues 39; identity set equals the prepared expectation with zero differences"
        status: pass
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts (7 tests, 5 pass, 2 fail - each failing on exactly the three expected identities, zero additions)"
        status: fail
    human_judgment: true
    rationale: "The pin edit is explicitly parent-owned ('do not edit the shared census pin from this plan'). The two failing gates are the designed hand-off signal, so the parent must review the delta and update tests/architecture/gate-targets.ts once for the whole wave."

# Metrics
duration: 22 min
completed: 2026-09-14
status: complete
---

# Phase 05 Plan 07: Bridge Composition Ownership Summary

**Hook writing and skill removal are now constructed at their public bridge barrels from production-consumed factories, retiring three test-only exports (42 -> 39 findings) with zero behavior change and 40/40 focused tests green.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-14T17:22:00Z
- **Completed:** 2026-09-14T17:44:18Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `bridges/hooks/index.ts` now imports `createWriteHookConfig` from `stage.ts`, holds the concrete `NODE_HOOKS_TREE_INSPECTOR`, and exports the constructed `writeHookConfig`. `stage.ts` keeps the coherent write/validate/remove implementation plus its injected `HooksTreeInspector` contract, and `hookConfigPathFor` is now a private path composer used by the writer and the remover.
- `bridges/skills/index.ts` now imports `createUnstagePluginSkills` from `unstage.ts`, holds the concrete `NODE_SKILLS_UNSTAGE_REMOVER`, and exports the constructed `unstagePluginSkills`. `unstage.ts` keeps the factory and the whole validated removal concern.
- Both bridge owner tests now exercise the real Node adapters against real temporary trees: exact JSON bytes, repeat-write idempotence, absence of atomic-write leftovers, source-tree preservation, the full structured `SymlinkRefusedError` for an escaping source symlink, and ordered/frozen removal results with foreign bytes preserved.
- Measured finding delta 42 -> 39: exactly `hookConfigPathFor`, `createWriteHookConfig` and `createUnstagePluginSkills` removed, zero identities added.
- No new module, runtime default, artificial factory reader, private-state reader, or test-only export was introduced.

## Task Commits

1. **Task 1 (tracer): Bind the hook writer in the existing hook bridge** - `614e7cad` (refactor)
2. **Task 2: Bind skill removal in the existing skills bridge** - `6a381012` (refactor)

Measured commit count for this plan: `git rev-list --count 2c67f3915091e3a2573f419ea3235d259d29669b..HEAD` = **2** (before this metadata commit).

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` - drops the Node inspector binding and the default `writeHookConfig`; `hookConfigPathFor` becomes private.
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` - owns `NODE_HOOKS_TREE_INSPECTOR` and constructs `writeHookConfig`.
- `extensions/pi-claude-marketplace/bridges/skills/unstage.ts` - drops the Node remover binding and the default `unstagePluginSkills`.
- `extensions/pi-claude-marketplace/bridges/skills/index.ts` - owns `NODE_SKILLS_UNSTAGE_REMOVER` and constructs `unstagePluginSkills`.
- `tests/bridges/hooks/stage.test.ts` - builds its subject from the production-consumed factory; the standalone path-composer assertion is retired.
- `tests/bridges/hooks/index.test.ts` - two real composition cases replace the identity re-export assertion.
- `tests/bridges/skills/unstage.test.ts` - builds its subject from the factory; all seven removal bodies unchanged.
- `tests/bridges/skills/index.test.ts` - one real removal case replaces the identity re-export assertion.

## Finding Dispositions

A clean count is not a disposition. Each identity below has explicit caller or privatization evidence.

| Category | Path | Identity | Disposition | Evidence |
| --- | --- | --- | --- | --- |
| unused_exports | `bridges/hooks/stage.ts` | `hookConfigPathFor` | Privatized (no longer exported) | Still called by `createWriteHookConfig`'s returned writer and by `removeHookConfig`'s sibling path shape inside the same module. The exact composed path is asserted through the full writer result and the on-disk bytes in both owners. `bridges/hooks/index.ts` already documented it as a non-re-exported private helper. |
| unused_exports | `bridges/hooks/stage.ts` | `createWriteHookConfig` | Retained export, now has a real production caller | `extensions/pi-claude-marketplace/bridges/hooks/index.ts` imports and calls it with the four Node callbacks. |
| unused_exports | `bridges/skills/unstage.ts` | `createUnstagePluginSkills` | Retained export, now has a real production caller | `extensions/pi-claude-marketplace/bridges/skills/index.ts` imports and calls it with the Node recursive/force remover. |

Production consumers of the two public operations are unchanged and still reach them through the barrels:

| Operation | Real production consumers | Import path (unchanged) |
| --- | --- | --- |
| `writeHookConfig` | `orchestrators/plugin/install-outcome.ts`, `orchestrators/plugin/update-swap.ts`, `orchestrators/plugin/reinstall-replace.ts` | `bridges/hooks/index.ts` |
| `unstagePluginSkills` | `orchestrators/plugin/install-outcome.ts`, `orchestrators/marketplace/shared.ts` | `bridges/skills/index.ts` |

## Assertion Ledger

Test bodies: 40 before, 40 after. 37 retained bodies are byte-identical by SHA-256 (verified through the chain baseline hashes -> prepared payloads -> applied files, all three matched exactly). Exactly 3 cases removed, exactly 3 added.

| Removed original assertion | Replacement public observation | Evidence |
| --- | --- | --- |
| `tests/bridges/hooks/stage.test.ts` - "composes the staged hook config path": `assert.strictEqual(hookConfigPathFor(locations, PLUGIN), path.join(locations.hooksDir, PLUGIN, "hooks.json"))` | The unchanged full-write owner already compares the whole `{ written: true, path }` result and the exact file bytes. The new bridge success/repeat case independently rebuilds `path.join(locations.hooksDir, "acme", "hooks.json")`, compares both returned values whole, and reads the exact bytes at that path twice. | `stage.ts` direct coverage 34/34 branches, 9/9 functions, 287/287 lines. |
| `tests/bridges/hooks/index.test.ts` - "writeHookConfig / re-exports the defining binding": strict identity against the now-retired stage convenience | Two real composition cases against the barrel only: (a) complete success and repeat results, exact pretty-JSON bytes with trailing newline, target listing exactly `["hooks.json"]` (detects atomic tmp leftovers), preserved nested/shared script bytes and symlink state; (b) an escaping source symlink yields `SymlinkRefusedError` with name, exact message, `parent`, `child`, `linkPath`, `linkTarget` and `cause` all compared, while previously staged bytes stay `{"retained":true}\n` and external bytes stay `external bytes\n`. | All four concrete inspector callbacks (`lstat`, `readdir`, `realpath`, `readlink`) are reached. `index.ts` direct coverage 5/5 branches, 4/4 functions, 41/41 lines. |
| `tests/bridges/skills/index.test.ts` - "unstagePluginSkills / re-exports the defining binding": strict identity against the now-retired unstage convenience | One real removal case against the barrel only: two real nested trees plus a missing name, whole first result `{ removedNames: ["acme-second", "acme-first"], warnings: [] }`, repeat result `{ removedNames: [], warnings: [] }`, all four result arrays frozen, final listing exactly `["foreign-keep"]`, foreign bytes unchanged. | Real Node `removeTree` reached. `index.ts` direct coverage 2/2 branches, 1/1 functions, 36/36 lines. |

No non-redundant behavior assertion was discarded. Every injected-remover case in `tests/bridges/skills/unstage.test.ts` (ENOENT-after-delete, other-error propagation, interaction order, unsafe-name rejection, symlink refusal) is retained byte-identical; only the module the subject is built from changed.

## Verification Commands and Results

| Command | Result |
| --- | --- |
| `node --test tests/bridges/hooks/stage.test.ts tests/bridges/hooks/index.test.ts` (task 1 `<verify>`) | tests 25, pass 25, fail 0 |
| `node --test tests/bridges/skills/unstage.test.ts tests/bridges/skills/index.test.ts` (task 2 `<verify>`) | tests 15, pass 15, fail 0 |
| All four focused owners together | tests 40, pass 40, fail 0 |
| `npm run typecheck` | clean |
| `npx eslint` over both bridge dirs and both test dirs | exit 0, no findings |
| `npx prettier --check` over the eight files | all match |
| `node scripts/test-coverage-direct.mjs` x4 | hooks/stage 34/34 B, 9/9 F, 287/287 L; hooks/index 5/5, 4/4, 41/41; skills/unstage 11/11, 2/2, 67/67; skills/index 2/2, 1/1, 36/36 - every pair hit == found |
| `SKIP=trufflehog pre-commit run --files <4 files>` x2 (once per task, before each commit) | all hooks Passed, including `npm fallow`, `npm lint`, `npm typecheck`, `npm format check` and `npm direct coverage (changed pairs)` |
| `node --test tests/orchestrators/**/*.test.ts` | tests 2113, pass 2113, fail 0 |
| `node --test tests/bridges/**/*.test.ts tests/architecture/**/*.test.ts` | tests 1424, pass 1422, fail 2 - both the parent-owned census pin gates, nothing else |
| `npx fallow dead-code --production --format json --no-cache` | `total_issues` 39; identity set differs from the prepared expectation by zero entries |

Behavior-preservation proof (run before each production move): the rewritten owner tests were applied alone and executed against the pre-change production. Hooks 25/25 and skills 15/15 passed at that point, so the new public assertions describe behavior that already existed; the production move then re-ran identically green.

## Measured Finding Delta

Measured twice, by two independent instruments, in the live checkout:

1. `npx fallow dead-code --production --format json --no-cache` -> `total_issues` 39 (fallow 3.22.0, schema 9), against the 42 recorded for the Wave 4 baseline. Per-symbol comparison against the reviewed baseline report: 3 removed, 0 added.
2. `tests/architecture/unowned-exports-census.test.ts` re-measures the same question inside the repository and fails with exactly:

```
- 'unused_exports|.../bridges/hooks/stage.ts|createWriteHookConfig'
- 'unused_exports|.../bridges/hooks/stage.ts|hookConfigPathFor'
- 'unused_exports|.../bridges/skills/unstage.ts|createUnstagePluginSkills'
```

with no `+` lines. The `RingBuffer.read` entry and the `translate` duplicate group are untouched, as required.

## Deviations from Plan

### 1. [Rule 3 - Blocking, by plan instruction] Census pin left failing for the parent

- **Found during:** Task 1 verification sweep.
- **Issue:** `tests/architecture/gate-targets.ts` pins both `UNOWNED_EXPORT_CENSUS` and `PRODUCTION_FINDING_CENSUS` to the three now-removed identities, so two gates in `tests/architecture/unowned-exports-census.test.ts` fail.
- **Fix:** None applied, deliberately. Both tasks state "do not edit the shared census pin from this plan" and the plan's `<verification>` assigns the single pin edit to the parent wave reconciliation. Editing it here would race plans 05-12 and 05-24 for the same lines.
- **Files modified:** none.
- **Verification:** `gate-targets.test.ts` is 15/15 green, so the census entries' own path and name resolution is intact; only the two equality gates fail, on exactly the three expected identities.
- **Committed in:** n/a.

### 2. [Documented] tdd="true" tasks executed as behavior-preserving refactors

- **Found during:** Task 1 planning.
- **Issue:** Both tasks carry `tdd="true"`, but the change adds no behavior - it relocates two concrete adapter bindings. A RED attempt would be an unexpected green, which the TDD fail-fast rules say to stop on rather than fake.
- **Fix:** Substituted an equivalent, stronger discipline: apply the owner test changes alone, prove them green against the OLD production, then apply the production move and re-run. Commits are `refactor(...)` rather than `test(...)` -> `feat(...)`.
- **Files modified:** n/a.
- **Verification:** Pre-move runs hooks 25/25 and skills 15/15; post-move runs identical.
- **Committed in:** `614e7cad`, `6a381012`.

### 3. [Documented] Commit subjects omit the `(phase-plan)` scope

- **Found during:** Task 1 commit.
- **Issue:** The GSD commit protocol asks for `{type}({phase}-{plan}): ...`, but this repository's `CLAUDE.md` forbids phase, plan, milestone and wave identifiers in commit messages.
- **Fix:** Applied the `CLAUDE.md` rule, which takes precedence. Subjects are plain Conventional Commits within the 5-72 character limit and body lines stay under 80 characters, matching the surrounding history.
- **Files modified:** n/a.
- **Verification:** `git log --oneline` shows the same shape as the preceding phase commits.
- **Committed in:** `614e7cad`, `6a381012`.

---

**Total deviations:** 3 (1 plan-mandated deferral, 2 documented method/format adaptations). None changed the delivered source.
**Impact on plan:** No scope creep. The eight declared files are the only source files touched.

## TDD Gate Compliance

`workflow.tdd_mode` is not enabled in `.planning/config.json` and the plan frontmatter is `type: execute`, so the RED/GREEN/REFACTOR gate sequence is not enforced for this plan. No `test(...)` or `feat(...)` gate commits exist by design; see deviation 2 for the substituted evidence.

## Issues Encountered

None beyond the deliberate census-pin deferral described above. The prepared bundle at `/tmp/bridge-composition-prep` re-verified clean: 8 of 8 baseline file hashes matched HEAD `2c67f391`, and every applied file is byte-identical to the prepared payload.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO, FIXME, or unwired component was introduced.

## Threat Flags

None. No network endpoint, auth path, file access pattern, or schema at a trust boundary was added. The threat register's `mitigate` dispositions are satisfied:

- **T-05-07-01 (Tampering, hooks/stage.ts):** every validation, error, state and byte assertion is preserved or strengthened; callers were traced with CodeGraph plus a direct-import grep before any export was removed.
- **T-05-07-02 (Repudiation, finding census):** exact identities are recorded above and the pin edit is left to the parent's stable-wave snapshot.
- **T-05-07-03 (Information disclosure, test filesystem):** all new cases use `mkdtemp` roots with `t.after` cleanup; no live credential, external service or fixed shared path is used.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for the parent Wave 5 reconciliation. Blocking item for the parent, not for this plan: update `tests/architecture/gate-targets.ts` once, removing `createWriteHookConfig` and `hookConfigPathFor` from the `bridges/hooks/stage.ts` entry and the whole `bridges/skills/unstage.ts` entry in `UNOWNED_EXPORT_CENSUS`, and the three matching rows from `PRODUCTION_FINDING_CENSUS`, after 05-12 and 05-24 have also landed.
- Combined Wave 5 expectation stays 42 -> 32 once all three plans land; this plan contributes 3 of the 10 removals.
- `EXPORT-01` is declared by many Phase 5 plans and stays Pending until the last declaring plan finishes; it is listed in `requirements-completed` per the template's verbatim-copy rule, not as a claim that the requirement is closed.
- `.fallowrc.json` `production` mode and the `RingBuffer.read` adjacency exception remain untouched and stay plan 05-28's atomic job.

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-14*

## Self-Check: PASSED

- All eight declared source files and the SUMMARY exist on disk (`[ -f ]` verified).
- All three plan commits resolve in `git log`: `614e7cad`, `6a381012`, `0dd3864e`.
- Both task `<verify>` commands re-run green after the final commit (25/25 and 15/15).
- The only failing gates in the tree are the two parent-owned census pin equality checks, failing on exactly the three expected identities with zero additions.
