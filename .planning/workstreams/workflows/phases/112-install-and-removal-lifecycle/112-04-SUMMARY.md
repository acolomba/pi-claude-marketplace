---
phase: 112-install-and-removal-lifecycle
plan: 04
subsystem: infra
tags: [workflows, garbage-collection, staging, path-containment, hygiene]

requires:
  - phase: 111-workflows-bridge
    provides: the `<workflowsStagingDir>/<uuid>/` staging root and the `workflowsHomeDir` containment anchor
  - phase: 112-install-and-removal-lifecycle
    provides: the sixth ledger phase (112-01), the sixth cascade slot (112-02) and reinstall re-materialization (112-03)
provides:
  - "`garbageCollectWorkflowsStaging(locations)` — an age-bounded sweep of orphaned workflow staging trees"
  - "`WORKFLOWS_STAGING_MAX_AGE_MS` — the 24-hour bound as one exported constant"
  - an install-side sweep call in the post-commit hygiene block
  - a removal-side sweep call beside the clone collector
  - corrected ledger-count and kind-count statements in four sources, one test and one document
affects: [113-update-enable-disable-reconcile, 114-degradation-and-documentation]

actuals:
  tokens: 8762
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "age-bounded sweep: when no persisted identifier exists, directory mtime is the whole liveness signal"
    - "containment anchored one level above the swept directory so the replaceable segment is lstat'd"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts
    - tests/orchestrators/plugin/workflows-staging-gc.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - docs/output-catalog.md

key-decisions:
  - "The age bound is 24 hours as one exported constant; nothing persists a staging identifier and the staging directory is scope-independent, so the bound is the entire liveness mechanism rather than a refinement of the clone collector's persisted-record one."
  - "The sweep returns per-directory removal-failure leak strings, not removed names — the contract `garbageCollectPluginClones` actually has, whose four call sites all discard it. The CONTEXT's original wording was wrong and the research corrected it."
  - "Containment is anchored on `workflowsHomeDir`, one level above the staging directory, so the staging segment itself is walked; anchoring at the staging root would skip an lstat of the one segment an attacker could replace."
  - "The containment assertion is resolved outside the swallowing try, so a refusal propagates instead of being recorded as a removal leak."
  - "Both an install-side and a removal-side hygiene block call the sweep: installing is what creates an orphan, so a machine that never uninstalls would never sweep if only the removal side called it."
  - "`5-phase` becomes `7-phase`: the ledger literal array holds seven `Phase<InstallCtx>` entries (six bridges plus the state phase). The old label was already stale by one before this phase."

patterns-established:
  - "Age-bounded sweep: `mtime` older than an exported constant is the abandonment test when no registry can exist. Both directions are pinned — an aged tree is removed AND a fresh one survives — because a case proving only the first half would let the sweeper eat a live transaction."
  - "Read-but-not-search (`chmod 0o444`) is the deterministic vehicle for a per-entry `lstat` failure; a no-write subdirectory (`chmod 0o555`) is the deterministic vehicle for a per-entry `rm` failure."

requirements-completed: [WLIF-01]

coverage:
  - id: D1
    description: "An abandoned staging tree older than 24 hours is removed from disk."
    requirement: WLIF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#removes a staging tree left behind longer than the maximum age"
        status: pass
    human_judgment: false
  - id: D2
    description: "A staging tree inside the bound is left where it is, so a concurrent installation's in-flight envelopes survive."
    requirement: WLIF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#keeps a staging tree still inside the maximum age"
        status: pass
    human_judgment: false
  - id: D3
    description: "An absent staging directory is a no-op returning an empty list; any other enumeration error propagates."
    requirement: WLIF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#returns an empty leak list when the staging directory is absent"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#rethrows a non-ENOENT staging read failure without changing the path"
        status: pass
    human_judgment: false
  - id: D4
    description: "A per-entry inspection or removal failure becomes one leak string and the sweep continues; a non-directory entry is skipped rather than removed."
    requirement: WLIF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#continues past a staging tree it cannot remove and names it once"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#records a leak for a staging entry it cannot inspect"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#skips an aged staging entry that is not a directory"
        status: pass
    human_judgment: false
  - id: D5
    description: "A containment refusal on an aged entry propagates out of the sweep rather than becoming a leak string (T-112-17)."
    requirement: WLIF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/workflows-staging-gc.test.ts#rejects when the staging segment itself is a symbolic link"
        status: pass
    human_judgment: false
  - id: D6
    description: "The install side sweeps silently, and a sweep failure never becomes the install's outcome (T-112-19, T-112-20)."
    requirement: WLIF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WLIF-01: installing removes an abandoned staging tree and spares a live one"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WLIF-01: an install succeeds unchanged when the staging sweep throws"
        status: pass
    human_judgment: false
  - id: D7
    description: "The removal side sweeps silently, and a sweep failure never becomes the uninstall's outcome (T-112-19, T-112-20)."
    requirement: WLIF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#WLIF-01: uninstalling removes an abandoned staging tree and spares a live one"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#WLIF-01: an uninstall succeeds unchanged when the staging sweep throws"
        status: pass
    human_judgment: false
  - id: D8
    description: "No comment or document in the extension, the tests or the docs states the superseded ledger count."
    verification:
      - kind: other
        ref: "grep -rn '5-phase' extensions/ tests/ docs/ | wc -l  ->  0"
        status: pass
      - kind: other
        ref: "grep -rniE 'all five bridges|FIVE bridges|five kinds' extensions/ | wc -l  ->  0"
        status: pass
    human_judgment: false

duration: 42 min
completed: 2026-09-05
status: complete
---

# Phase 112 Plan 04: Orphan staging sweep and stale count corrections Summary

**A 24-hour age-bounded sweep of orphaned `<workflowsStagingDir>/<uuid>/` trees, called silently from both the install-side and removal-side hygiene blocks, with containment anchored one level above the staging directory.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-05T18:38:00Z
- **Completed:** 2026-09-05T19:20:00Z
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `garbageCollectWorkflowsStaging` sweeps abandoned workflow staging trees. They hold verbatim third-party executable JavaScript under the home directory and outside every scope root, so nothing else in the codebase reaches them.
- The bound is `WORKFLOWS_STAGING_MAX_AGE_MS`, one exported constant of 24 hours built as a product of named time units. Because nothing persists a staging identifier and `workflowsStagingDir` is scope-independent, the bound is the entire liveness mechanism, not a refinement of the clone collector's persisted-record one.
- Containment is anchored on `workflowsHomeDir` and resolved outside the swallowing try, so a replaced staging segment refuses and the refusal propagates rather than being recorded as a removal leak.
- Both `collectPostCommitWarnings` and `runPostUninstallCleanup` call it, silently, discarding the leak strings.
- Eight stale ledger-count and kind-count statements corrected across four sources, one test and one published document.

## Task Commits

1. **Task 1: the age-bounded sweeper and its owner test** — `27af6664` (feat)
2. **Task 2: the install-side and removal-side call sites** — `b2c2b4af` (feat)
3. **Task 3: the stale count corrections** — `85b0692b` (docs)

The module and its mirrored owner test landed in the SAME commit, as the corresponding-test gate requires. The test was written first and observed failing (`ERR_MODULE_NOT_FOUND`) before the module existed.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts` — the sweeper and the exported age constant
- `tests/orchestrators/plugin/workflows-staging-gc.test.ts` — eight cases covering every documented behavior
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — the install-side sweep call, plus three corrected ledger-count comments
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` — the removal-side sweep call beside the clone collector
- `tests/orchestrators/plugin/install.test.ts` — two call-site cases, plus two corrected ledger-count comments
- `tests/orchestrators/plugin/uninstall.test.ts` — two call-site cases
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` — the artifact-removal symmetry comment
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — the disable-transform doc comment
- `docs/output-catalog.md` — the ledger-sequence prose

## The stale count sites, located by content

The research measured nine sites plus two comments in the install owner test. Located by content rather than by line number, the actual set was **eight edits across six files, plus one site already corrected and three out of scope**:

| Site | Old text | New text |
|---|---|---|
| `install.ts` (module header) | `// D-01 5-phase ledger` | `// D-01 7-phase ledger` |
| `install.ts` (`InstallCtx` doc) | `Local context type for the 5-phase ledger` | `... 7-phase ledger` |
| `install.ts` (`runInstallLedgerBody` doc) | `+ 5-phase ledger` | `+ 7-phase ledger` |
| `install.test.ts` (section header) | `PI-9: 5-phase ordering + rollback` | `PI-9: 7-phase ordering + rollback` |
| `install.test.ts` (case header) | `PI-9 -- 5-phase order` | `PI-9 -- 7-phase order` |
| `enable-disable.ts` | `COMPONENT_KINDS 5-tuple ... all five kinds ... skills, commands, agents and mcp` | `all six kinds ... hooks via removeHookConfig and workflows via unstagePluginWorkflows alongside skills, commands, agents and mcp` |
| `state-io.ts` | `every artifact of all five kinds` | `every artifact of all six kinds` |
| `docs/output-catalog.md` | `the install ledger's 5-phase sequence` | `... 7-phase sequence` |

**`orchestrators/marketplace/shared.ts` needed no edit.** The research measured `all FIVE bridges` at `:270` and `all five bridges` at `:273`; plan 112-02 already corrected both to `SIX` / `six` while widening the cascade. The file is named in this plan's `files_modified` but is unchanged by it.

**Why `7-phase` and not `6-phase`.** The literal array is `[skillsPhase, commandsPhase, agentsPhase, hooksPhase, mcpPhase, workflowsPhase, statePhase]` — seven `Phase<InstallCtx>` entries. `runPhases` runs all seven. The old `5-phase` label was already stale by one before this phase: adding the hooks slot under D-63-01 made the array six entries and the label was never updated. No comment narrates that history; each states only the current fact.

**The `COMPONENT_KINDS 5-tuple` citation was dropped from the `enable-disable.ts` comment.** `SUPPORTED_COMPONENT_KINDS` is genuinely a 5-tuple (`skills, commands, agents, hooks, workflows` — it does not contain `mcpServers`), so citing it as the basis for the cascade's kind count was wrong in a way the numeral hid. The comment now names the mechanism instead. `ENBL-13` and `D-100-04` — the only decision and requirement identifiers in that comment — both survive, as do every identifier in each other corrected comment.

## Duplication gate

`fallow dupes` never named `workflows-staging-gc.ts` against `clone-gc.ts`. Verified directly: the JSON report contains no occurrence of the string `workflows-staging-gc` in any clone group, clone family or mirrored-directory entry. The shared structure (`readdir` with an ENOENT no-op, a per-entry swallow, `return leaks`) is interleaved with different liveness logic and stayed under the `threshold: 3` window.

## Decisions Made

- **`7-phase`, not a count-free rewording.** The plan asked for the new count. A phrasing with no numeral would not rot again, but it would also stop the next reader from noticing when the array grows.
- **The `lstat` try/catch is inline, not a helper.** A first draft extracted it into an `inspectEntry` helper that rewrapped the error into a fresh `Error`, which destroyed the errno and forced a `Stats | undefined` return that could never be `undefined`. Inlining it keeps the original error and keeps every branch reachable.
- **Permission-based test vehicles.** There is no non-permission way to make `readdir` succeed while the per-entry `lstat` fails. The repository already uses the read-but-not-search `chmod 0o444` trick for exactly this in `tests/bridges/workflows/discover.test.ts`, so this test follows it. The paired `rm`-failure case uses a no-write subdirectory (`chmod 0o555`) inside one of two aged trees, and asserts the other tree was still removed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The chmod-restore hook ran after the scope's own removal hook**

- **Found during:** Task 1 (the removal-failure case)
- **Issue:** `node:test` runs `t.after` hooks in registration order. The hermetic-scope helper registers its `rm(home, ...)` hook first, so a chmod restore registered later in the case body ran *after* the removal had already failed on the still-unwritable subtree. The case failed with an uncaught `EACCES` from teardown, not from the assertion under test.
- **Fix:** restore the mode inline immediately after the act step and before the assertions, so a failing assertion cannot strand an unwritable tree either. The `t.after` restore stays as a belt-and-braces net.
- **Files modified:** `tests/orchestrators/plugin/workflows-staging-gc.test.ts`
- **Verification:** all 8 cases pass; the temp tree is removed cleanly.
- **Committed in:** `27af6664`

**2. [Rule 1 - Bug] The install-side "unchanged notification" case asserted the wrong glyph**

- **Found during:** Task 2
- **Issue:** the case asserted the rendered row contained `◉ hello`. A fully-installed plugin renders `●`, not `◉` (which is the partially-installed glyph), so the assertion failed against a correct install.
- **Fix:** replaced the substring probe with byte-equality on the whole notification — a stronger assertion that pins the exact message the swallow must leave untouched.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Verification:** `node --test tests/orchestrators/plugin/install.test.ts` → 148 pass / 0 fail.
- **Committed in:** `b2c2b4af`

### Acceptance criterion corrected by direct verification

Task 1's criterion `grep -c 'assertPathInside' <module>` **prints exactly 1** is arithmetically impossible for an imported function that is also called: the import line and the call line are two matching lines. The measured count is `2`. The criterion's *intent* — that the containment assertion is present and appears before the removal call — was verified directly instead:

```
23:import { assertPathInside } from "../../shared/path-safety.ts";
115:    await assertPathInside(locations.workflowsHomeDir, candidate, ...);
122:      await rm(candidate, { recursive: true, force: true });
```

Line 115 precedes line 122, and the assertion sits outside the `try` that begins at 117. The criterion likely transcribed the model file's shape: `clone-gc.ts` mentions `assertPathInside` only in comments, because it routes through `locations.pluginCloneDir(key)` rather than calling the chokepoint itself. This plan deliberately does not add a bundle accessor, so it calls the chokepoint directly.

---

**Total deviations:** 2 auto-fixed (2 test bugs), 1 acceptance criterion satisfied by direct verification.
**Impact on plan:** none on scope. Both fixes were in test code written by this plan; the criterion correction changed no production code.

## Issues Encountered

None. Every gate was green at each task boundary.

## Out-of-scope stale counts observed, not fixed

Task 3's verify fails if the commit touches a path outside the six files it names, so these were left alone and are recorded here rather than silently widened into (CLAUDE.md surgical-changes rule). None is matched by this task's own acceptance greps:

| Site | Text |
|---|---|
| `tests/orchestrators/plugin/enable-disable.test.ts:869` | `five kinds -- cascadeUnstagePlugin still unstages hooks via removeHookConfig,` — this **mirrors** the `enable-disable.ts` comment `85b0692b` corrected, so the pair now disagrees. The closest one to fix. |
| `tests/live-uat/README.md:31` | `reconstructs the component inventory across all five kinds` |
| `docs/competitive-analysis/pi-plugins.md:14` | `We support five kinds` |
| `docs/competitive-analysis/pi-claude-plugins.md:258` | `Our five-phase ledger` |
| `docs/competitive-analysis/zmarketplace.md:249` | `translate five component kinds ... a five-phase transactional ledger` |
| `extensions/pi-claude-marketplace/bridges/README.md:5` | `Phase 3 lands all four bridges` (pre-existing, unrelated to this phase's change) |

## Final full-chain result

`npm run check` exits **0** across all nine steps:

- `typecheck` — 0 errors
- `lint`, `fallow` (dead-code / health / dupes), `format:check` — clean
- `test:corresponding` + both negative controls — the gate names no missing test
- `npm test` — **5504 pass / 0 fail**
- `npm run test:integration` — **32 pass / 0 fail**

`pre-commit run --all-files` passes every hook and **rewrote nothing**. The only failure is `TruffleHog`, which aborts structurally in this worktree (`.git` is a file, so the git-mode scan cannot read `.git/index`); a filesystem-mode scan over every path in each commit returned `verified_secrets: 0, unverified_secrets: 0` at exit 0 before each commit, and each commit used `SKIP=trufflehog` for that hook only.

Direct coverage is `hit === found` on branches, functions and lines for all three files:

| File | Branches | Functions | Lines |
|---|---|---|---|
| `workflows-staging-gc.ts` | 16/16 | 1/1 | 131/131 |
| `install.ts` | 254/254 | 55/55 | 2561/2561 |
| `uninstall.ts` | 82/82 | 11/11 | 783/783 |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 112 is complete: all four plans executed, `npm run check` green, and every touched file at 100% direct coverage. The phase is ready for `/gsd-verify-work 112`.

What Phase 113 inherits:

- **The sweep is install-side and removal-side only.** `update`, `enable`, `reinstall` and `reconcile` also create staging roots. They are covered transitively — every one of them is normally followed by another install or uninstall on the same machine — but if Phase 113 adds a verb that can crash without either side ever running again, it should add a third call site rather than widen the bound.
- **`WORKFLOWS_STAGING_MAX_AGE_MS` is exported precisely so a later phase can tune it.** Both call-site tests and the owner test import it by name rather than transcribing a copy, so changing it does not silently turn an "aged" fixture fresh.
- **`CASCADEAX-01` stays open** (carried from 112-02): both partial-cascade folds still read `dropped` structurally, and the hand-rolled one in `remove.ts` still omits the `hooks` axis. A seventh axis would be dropped in silence again.
- **The `enable-disable.test.ts:869` comment now contradicts the source comment it mirrors.** Fixing it costs one line in a file Phase 113 already has to open.

---
*Phase: 112-install-and-removal-lifecycle*
*Completed: 2026-09-05*
