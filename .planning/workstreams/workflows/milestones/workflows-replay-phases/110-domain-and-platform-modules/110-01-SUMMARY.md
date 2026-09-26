---
phase: 110-domain-and-platform-modules
plan: 01
subsystem: infra
tags: [port, workflows, storage-root, project-key, sha256, node-test, coverage]

# Dependency graph
requires:
  - phase: 109-kind-inversion
    provides: "`workflows` as a supported component kind, so the port's modules land against a resolver that agrees with them"
provides:
  - "`workflowHomeDir()` in `platform/workflow-home.ts` — the sole import site of the host engine's storage root, seam-free"
  - "`workflowProjectKey(cwd)` in `domain/workflow-project-key.ts` — the engine's per-project storage key as `<slug>-<12 hex>`"
  - "`tests/platform/workflow-home.test.ts` — the WPTH-02 home-derivation pin and the no-caching pin"
  - "`tests/domain/workflow-project-key.test.ts` — thirteen transcribed literal keys plus a normalization pair and a cwd-pinned relative case"
  - "the proven phase mechanism: path-scoped checkout + blast-radius assertion + owner-test-as-only-consumer + 100% direct coverage + green whole-tree gate"
affects: [110-02, 110-03, 111-workflows-bridge]

actuals:
  tokens: 3509
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Owner test relocates a process global by saving, registering `t.after()`, and only then mutating"
    - "Measured-literal parity table: every expected value transcribed, none recomputed by the test"
    - "Path-scoped `git checkout <branch> -- <one file>` with a blast-radius assertion at every commit boundary"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/workflow-home.ts
    - tests/platform/workflow-home.test.ts
    - extensions/pi-claude-marketplace/domain/workflow-project-key.ts
    - tests/domain/workflow-project-key.test.ts
  modified: []

key-decisions:
  - "The relocation seam was deleted outright rather than reshaped into a parameter — `HOME` is a working replacement because `os.homedir()` re-reads it on every call, and the header sentence that defended the seam on concurrency grounds was replaced rather than left to argue for a mechanism that no longer exists."
  - "The relative-path case pins the working directory with `process.chdir(\"/\")` instead of taking the spike's split pin, so its expectation is a transcribed literal on any machine rather than an equivalence computed with production code."
  - "WPTH-02 is recorded as carried forward, not completed: Phase 110 can only prove the home-derivation negative, and the `never written` guarantee belongs to the Phase 111 modules that write."

patterns-established:
  - "Tracer red on the thing the plan authors: when a port makes behavior-first TDD unavailable, open red on the edit itself (the seam-deletion source assertion), not on ported behavior."
  - "An owner test that imports every export by name is the sanctioned answer to `fallow dead-code` on a module with no production consumer yet — no suppression marker."

requirements-completed: []

coverage:
  - id: D1
    description: "`workflowHomeDir()` returns `<homedir>/.pi/workflows` and holds no mutable module-level state"
    verification:
      - kind: unit
        ref: "tests/platform/workflow-home.test.ts#joins `.pi/workflows` onto the home directory"
        status: pass
      - kind: unit
        ref: "tests/platform/workflow-home.test.ts#reads the home directory again on every call instead of caching one root"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/workflow-home.ts (branches 2/2, functions 1/1, lines 32/32)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The storage root is home-derived: it reads no `cwd` and no environment override of its own (WPTH-02's provable half)"
    requirement: "WPTH-02"
    verification:
      - kind: unit
        ref: "tests/platform/workflow-home.test.ts#WPTH-02 roots storage under the home directory and never under the working directory"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*[/*]' extensions/pi-claude-marketplace/platform/workflow-home.ts | grep -cE 'process\\.env|PI_CODING_AGENT_DIR' == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "No test-only relocation seam survives in `platform/workflow-home.ts` (ROADMAP criterion 4)"
    verification:
      - kind: other
        ref: "grep -v '^\\s*[/*]' extensions/pi-claude-marketplace/platform/workflow-home.ts | grep -cE 'ForTesting|__test_|let override' == 0 (was 2 before the deletion)"
        status: pass
      - kind: other
        ref: "grep -cE '^export ' extensions/pi-claude-marketplace/platform/workflow-home.ts == 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "`workflowProjectKey` reproduces the engine's derivation across the Spike 025 case set, mutation-sensitively (ROADMAP criterion 6)"
    verification:
      - kind: unit
        ref: "tests/domain/workflow-project-key.test.ts (13 literal rows + normalization pair + cwd-pinned relative case, 15 cases)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/workflow-project-key.ts (branches 5/5, functions 2/2, lines 71/71)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase 109's five inverted files are untouched by the path-scoped checkouts"
    verification:
      - kind: other
        ref: "git status --porcelain over the five files == 0 lines, at both commit boundaries; git diff 0c951c6b..HEAD over the five files is empty"
        status: pass
    human_judgment: false
  - id: D6
    description: "Both new modules pass the whole-tree gate with no dead-code suppression, despite having no production consumer until Phase 111"
    verification:
      - kind: other
        ref: "npm run fallow (dead-code: No issues found), npm run typecheck (0 errors), npm run lint (exit 0), npm run format:check, test:corresponding, test:corresponding:negative, test:coverage:direct:negative"
        status: pass
      - kind: integration
        ref: "npm test (5215 pass / 0 fail) and npm run test:integration (32 pass / 0 fail)"
        status: pass
    human_judgment: false

duration: 21 min
completed: 2026-09-05
status: complete
---

# Phase 110 Plan 01: Domain and platform modules Summary

**`workflowHomeDir()` landed as a pure function of `os.homedir()` with its relocation seam deleted, and `workflowProjectKey()` landed unedited behind a thirteen-row parity table of transcribed literal keys.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-05T04:21:23Z
- **Completed:** 2026-09-05T04:42:19Z
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments

- The phase's tracer mechanism ran end to end on the smallest module and held: a path-scoped one-file checkout, a blast-radius assertion proving Phase 109 untouched, an owner test that is simultaneously the module's only consumer, 100% direct coverage, and a green whole-tree gate at each commit boundary.
- `setWorkflowHomeDirForTesting` and its module-global `override` are gone. The replacement relocation mechanism (`HOME` + `t.after()`) is exercised by three cases, one of which pins that the module caches nothing.
- The project-key parity table reproduced every one of the engine's thirteen measured keys on its first run, including the `"a".repeat(47) + "-b"` row whose doubled dash is the only witness that the dash strip runs before the 48-character slice.

## Task Commits

1. **Task 1: the storage root, seam-free** — `df7b9be8` (feat)
2. **Task 2: the project key with a literal parity table** — `ed756b8f` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/workflow-home.ts` — `workflowHomeDir()`, the sole import site of the host engine's `~/.pi/workflows` storage root
- `tests/platform/workflow-home.test.ts` — three top-level cases and a local `hermeticHome(t, label)` helper
- `extensions/pi-claude-marketplace/domain/workflow-project-key.ts` — `workflowProjectKey(cwd)`, ported verbatim and unedited
- `tests/domain/workflow-project-key.test.ts` — a `KeyCase` table of thirteen literal rows, a normalization pair, and a cwd-pinned relative case

## Decisions Made

### The tracer's observed red

Before the seam deletion, the criterion-4 source assertion

```
grep -v '^\s*[/*]' extensions/pi-claude-marketplace/platform/workflow-home.ts \
  | grep -cE 'ForTesting|__test_|let override'
```

printed **2** — the `let override: string | undefined;` binding and the
`export function setWorkflowHomeDirForTesting(...)` declaration. The docblock
above the setter is filtered out by the comment screen, which is why the count
is 2 rather than 3. After the deletion the same command prints `0`. That
observed 2 is the tracer's red: the plan authors exactly one production edit,
and this is the assertion that witnesses it.

### The header sentence that replaced the seam's defence

The ported header asserted:

> This is the SOLE import site for that root, mirroring the position
> `getAgentDir` occupies in `pi-api.ts` for `scopeRoot`. A test relocates
> storage by calling the setter rather than by mutating process-global
> environment state that concurrently-running suites also read.

That second sentence argued for a mechanism that no longer exists, from a
premise the research measured false. It now reads:

> This is the SOLE import site for that root, mirroring the position
> `getAgentDir` occupies in `pi-api.ts` for `scopeRoot`. The root is a pure
> function of `os.homedir()` and this module holds no mutable module-level
> state, so a test relocates storage by assigning `HOME` after registering the
> restore with `t.after()`: `os.homedir()` re-reads the variable on every call
> and caches nothing.

The WPTH-04 paragraph, the sole-import-site claim and the peer-import note are
verbatim. One paragraph was added, citing the engine's own rooting rule at
`@quintinshaw/pi-dynamic-workflows@3.10.1 dist/workflow-paths.js`
(`WORKFLOW_HOME_RELATIVE_DIR = ".pi/workflows"` joined onto `homedir()`), so a
future reader can diff it against an upgraded release.

### The relative-path case takes the `chdir` route, not the split pin

`process.chdir("/")` with restoration registered first makes
`workflowProjectKey("home/acolomba/some-project")` resolve onto row 1's
absolute path, so its expectation is the same transcribed literal
`some-project-e4c31526a114` rather than a value computed with production code.
The case carries a comment telling a later reader not to remove the `chdir`.

### Direct-coverage line counts differ from the research's figure, and that is not a shortfall

The plan quoted `FN 1/1 · BR 2/2 · LN 8/8` for the seam-free module. The
measured result here is `branches 2/2, functions 1/1, lines 32/32`. The gate is
`hit === found` on all three axes, which holds; the line total differs only
because this module keeps a longer header than the research's minimal probe
shape. `workflow-project-key.ts` matched its quoted target exactly:
`FN 2/2 · BR 5/5 · LN 71/71`.

## Deviations from Plan

None — plan executed exactly as written. No deviation rule fired: no bug, no
missing critical functionality, no blocker, and no architectural question
arose.

## Issues Encountered

- `pre-commit run --files` reported the documented structural `TruffleHog`
  failure on both commits (`failed to read index file: ... .git/index: not a
  directory`, because `.git` is a file in this worktree). Handled per
  `CLAUDE.md` §Git: a filesystem-mode scan over the same paths reported
  `verified_secrets: 0, unverified_secrets: 0` and exit 0 both times, and each
  commit carried the `SKIP=trufflehog` prefix and nothing else. No
  `--no-verify`, no `--amend`.
- `prettier` reformatted `tests/platform/workflow-home.test.ts` once (a
  `test(...)` call that fit on one line after all). Fixed before staging with
  `npx prettier --write`, then `format:check` was clean. No post-commit drift
  on either commit.

## WPTH-02 carry-forward

**WPTH-02 is not marked complete by this plan, and `requirements-completed` is
deliberately empty.**

WPTH-02 reads: *"The deprecated `<cwd>/.pi/workflows/saved/` legacy project
path is never written."* That is a whole-system negative about writing, and
this plan writes nothing. What it can and does prove is the *negative property*
that `platform/workflow-home.ts` — the sole import site of the engine storage
root — derives that root from `os.homedir()` alone, reads no `cwd`, and reads
no environment override. The owner test pins that with `HOME` relocated to one
temp directory and the process cwd pointed at a *different* one, asserting the
root is under the home, does not start with the cwd, and is not the legacy
`saved` path.

The actual "never written" guarantee is a Phase 111 property of
`persistence/locations.ts` and `bridges/workflows/stage.ts`, the modules that
write. **If WPTH-02 was meant to close inside Phase 110, it does not** — it
should be re-scoped or split rather than marked satisfied. Note that the
archived milestone's `workflows-REQUIREMENTS.md:66` already carries WPTH-02 as
`[x]` against Phase 103 on `features/workflows-spike`; the replay's own
`REQUIREMENTS.md:101` carries it only as the aggregate `Phase 110 | Pending
(re-land)` traceability row, which closes with the phase.

## Note for Phase 111: the storage-root-versus-HOME split

The spike's `tests/helpers/workflow-home.ts` exported a
`withRelocatedWorkflowHome` built on the deleted setter. It relocated the
storage root **without** touching `HOME`, so a bridge case could assert that
`<tmp>/.pi/workflows` stays absent while storage actually sat at
`<tmp>/workflow-home`. Under `HOME`-only relocation those two paths coincide,
so that particular split is not available any more.

Phase 111 recovers the same isolation the way
`tests/integration/workflow-kind-inversion.test.ts` already does today, and the
way `tests/platform/workflow-home.test.ts` does now: give the project cwd a
**second** temp directory distinct from the temp `HOME`, and assert against the
two independently. Do not reintroduce a relocation seam to get the old split
back.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `110-02` (`domain/name.ts` and `shared/errors.ts` with their owner tests
  extended) is unblocked and can start. It carries the red-first WNAM parity
  work for `assertSafeSavedWorkflowName`.
- The phase mechanism this tracer proved is reusable verbatim by `110-02` and
  `110-03`: path-scoped checkout naming individual files, the five-file
  blast-radius assertion immediately after, owner test imports every export by
  name, and the full gate chain before each commit.
- `110-03` additionally lands `acorn`; per the research it must land in **one**
  commit with `domain/workflow-script.ts` and its owner test, or
  `fallow dead-code` reports an unused dependency.
- No `EXTENSION_VERSION` bump was made and none is owed until Phase 111 (A-03).

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/platform/workflow-home.ts` — FOUND
- `tests/platform/workflow-home.test.ts` — FOUND
- `extensions/pi-claude-marketplace/domain/workflow-project-key.ts` — FOUND
- `tests/domain/workflow-project-key.test.ts` — FOUND
- commit `df7b9be8` — FOUND
- commit `ed756b8f` — FOUND
- every task `<acceptance_criteria>` re-run and green; plan-level
  `<verification>` re-run and green (`typecheck` 0 errors, `fallow` exit 0 with
  no Unused/Dependencies section, `format:check` clean, `lint` exit 0, both
  corresponding-test gates pass, `test:coverage:direct:negative` passes,
  `npm test` 5215/0, `npm run test:integration` 32/0)
- each commit contains exactly its own two paths and nothing else

---
*Phase: 110-domain-and-platform-modules*
*Completed: 2026-09-05*
