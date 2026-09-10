---
phase: 07-gate-integrity
plan: 03
subsystem: tooling
tags: [gate-scripts, git, fail-closed, base-selection, negative-harness, mkdtemp]

requires:
  - phase: 07-gate-integrity
    plan: 01
    provides: the mkdtemp fixture-root discipline and the planted-offender rule the new git fixtures follow
provides:
  - "selectBase(root) — the ordered origin/main -> main -> upstream -> HEAD~1 chain, returning the selected candidate, its commit, and the attempted candidates with per-candidate rejection reasons (D-07-13)"
  - "a discriminated gitLines that reads git's exit status and stderr, so no failure class collapses into an empty array (D-07-14)"
  - "changedPaths(root) / pairsForChangedPaths(root) returning { ok, paths, skipped, base } or { ok: false, reason }, distinguishing a resolved-but-empty change set from a failed one"
  - "a printed base-candidate line and a zero-pair report naming every skipped path and why"
  - "a git fixture builder in the negative harness plus four planted states: chain head, chain tail, resolved-but-empty, failed selection"
affects: [07-08, gate-integrity, direct-coverage]

actuals:
  tokens: 5411
  tasks: 3
  commits: 3
  plan_head_before: f25c8b5fc6bb5e186a687645200feb2aea99b2d2

tech-stack:
  added: []
  patterns:
    - "Discriminated git result: every invocation returns { ok: true, lines } or { ok: false, reason } carrying the subcommand, exit status, and stderr"
    - "Injected root on a gate script: selectedProjectRoot = projectRoot, so a harness drives the selector against a fixture repository with no subprocess"
    - "Real git fixture repositories built under the harness's existing mkdtemp root, with repository-local identity, disposed by the existing top-level finally"

key-files:
  created: []
  modified:
    - scripts/test-coverage-direct.mjs
    - scripts/test-coverage-direct.negative.mjs

key-decisions:
  - "attempted is carried on the SUCCESS result too, not only on failure. The plan's Task 1 action listed three keys for the ok arm, but the Task 2 behavior block requires asserting that a successful selection of `main` still records `origin/main` as tried first. A selection that reports only its winner cannot be audited against the chain it walked, so the behavior block's reading won."
  - "The base is diffed as `<commit>...HEAD` using the resolved candidate commit, which git normalizes to the merge base — measured byte-identical to the previous `merge-base HEAD origin/main` two-step against this branch's change set."
  - "The `export` keyword on selectBase / changedPaths / pairsForChangedPaths landed in the Task 2 commit alongside its first consumer, because `fallow dead-code` reports an export with no consumer and `npm-fallow` is a pre-commit hook matching `scripts/.*\\.mjs`."
  - "isPairablePath now delegates to a `pairabilityRefusal` that returns the reason rather than a boolean, so the zero-pair report and the pairable filter read the same branch logic instead of two copies."

patterns-established:
  - "Pattern: a gate that can answer 'nothing to do' must also answer 'why nothing', and the two must be different exit codes"
  - "Pattern: a fixture repository sets user.email, user.name, and commit.gpgsign on itself immediately after git init"
  - "Pattern: prove the head and the tail of a fallback chain in separate fixtures — a depth-1 clone resolves origin/main, so one fixture asked to prove both ends proves neither"

requirements-completed: [GGAT-01]

coverage:
  - id: D1
    description: "Base selection walks origin/main -> main -> upstream -> HEAD~1, reports the candidate it selected, and exits non-zero only when every candidate fails"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — chain-head state: selectBase in a two-commit repository with no remote returns candidate `main` with attempted == ['origin/main']"
        status: pass
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — fall-through state: a `work`-branch repository with no remote returns candidate `HEAD~1`"
        status: pass
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — exhausted state: a depth-1 clone with its remote removed returns ok:false with all four candidates and a non-empty reason each"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs prints `Changed-pair base: origin/main` before any pair runs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A shallow clone resolves origin/main; HEAD~1 is the candidate a depth-1 clone breaks"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — chain-tail state: selectBase on a `--depth 1 --no-local file://` clone returns candidate `origin/main`, and `git rev-parse --verify HEAD~1` in that same clone exits non-zero"
        status: pass
      - kind: other
        ref: "control measured this session: a NON-shallow clone of the same fixture DOES resolve HEAD~1, so the shallow assertion is not vacuous"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero selected pairs distinguishes its two causes: a resolved-but-empty change set exits 0 naming its skipped paths, a failed git invocation exits non-zero naming the command and its stderr"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — docs-only state: changedPaths returns ok:true, base `main`, paths ['docs/guide.md'], skipped [{path, reason}], and pairsForChangedPaths returns zero pairs"
        status: pass
      - kind: other
        ref: "scripts/test-coverage-direct.negative.mjs — not-a-repository state: changedPaths returns ok:false with a reason matching /rev-parse/ and /not a git repository/"
        status: pass
      - kind: other
        ref: "regression check: with a gitLines that folds a non-zero git exit into an empty result, the not-a-repository state stops refusing on stderr content and reports `resolved to no commit` instead"
        status: pass
    human_judgment: false
  - id: D4
    description: "The change is additive — every pre-existing refusal in the direct-coverage gate still fires and the non-zero-argument branches are untouched"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct:negative && npm run test:corresponding && npm run test:corresponding:negative — all exit 0"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/markers.ts — exit 0, branches 1/1, functions 0/0, lines 24/24"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run fallow — all exit 0"
        status: pass
    human_judgment: false

duration: 65 min
completed: 2026-09-10
status: complete
---

# Phase 7 Plan 03: Fail-Closed Changed-Pair Base Selection Summary

**The changed-pair gate now names the base it chose, refuses when git fails, and passes when the change set is genuinely unpairable — three outcomes that used to be one silent exit 0.**

## Performance

- **Duration:** 65 min
- **Started:** 2026-09-10T18:35:00Z
- **Completed:** 2026-09-10T19:40:00Z
- **Tasks:** 3 of 3
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- Replaced `gitLines`'s `stdio: ["ignore", "pipe", "ignore"]` plus bare `catch { return []; }` with a `spawnSync` call that reads `status` and `stderr` and returns a discriminated `{ ok: true, lines }` / `{ ok: false, reason }`. The reason names the full argument list, the numeric exit status, and git's trimmed stderr, so exit 128 and "this command produced no lines" are no longer the same value.
- Added `selectBase(root)`, walking `origin/main`, `main`, the upstream tracking ref, then `HEAD~1`. It returns the selected candidate, its commit, and the `attempted` list; when all four fail it returns `ok: false` with a per-candidate rejection reason. The upstream candidate — the only one whose name comes from git output rather than a literal — is rejected outright if the resolved name carries any character outside `A-Za-z0-9._/-`, and that rejection is reported as its reason rather than swallowed (`T-07-07`).
- Made `changedPaths` and `pairsForChangedPaths` discriminated and root-injectable. A zero-pair run now writes the selected base candidate and every changed path it passed over with the reason it was passed over; a failed selection writes the failing invocation to stderr and sets a non-zero exit code (`D-07-14`).
- Built the negative harness's first git fixture machinery: `fixtureGit` (checks `status` on every call), `buildFixtureRepository` (repository-local `user.email`, `user.name`, and `commit.gpgsign`), and `cloneShallow` (`--depth 1 --no-local` over `file://`). Five repositories and one non-repository directory, all under the harness's existing `mkdtemp` root, all disposed by its existing top-level `finally`.
- Planted the four states: the chain head (no `origin/main` still selects `main`), the chain tail (a depth-1 clone selects `origin/main` and cannot resolve `HEAD~1`; a fall-through repository reaches `HEAD~1`; an exhausted chain refuses), the resolved-but-empty docs-only change set, and the failed selection against a directory that is not a repository.

## Task Commits

1. **Task 1: Promote the selector root and make every git invocation report its own failure** — `0e146152` (fix)
2. **Task 2: Plant the three git fixture repositories in the negative harness** — `24ab4a00` (test)
3. **Task 3: Prove the selector change did not disturb the coverage gate it lives in** — no commit; the task is a verification sweep and found nothing to fix (see Issues Encountered).

## Before and After Counts

| Measure | Before | After |
|---|---|---|
| Planted states in `test-coverage-direct.negative.mjs` | 20 (7 `assertCompleteCoverage`, 2 subprocess refusals, 6 `assertReportComplete`, 5 `verdictFor`) | 24 (the same 20, plus 4 base-selection states) |
| `grep -c "assert\."` in the negative harness | 22 | 48 |
| `grep -c "\.status"` in the negative harness | 2 | 4 |
| `Object.keys(package.json.scripts).length` | 21 | 21 |
| `grep -c "user.email"` in the negative harness | 0 | 1 |

The npm script count is unchanged, as the plan requires: the new cases run inside `npm run check` through the existing `test:coverage:direct:negative` entry, with no new wiring. `RCOV-03`'s pre-commit and CI wiring stays out of scope (`D-07-16`).

The `git init` invocation is written as `["init", "-q", "-b", branch]` with `"main"` passed by the caller, rather than as a `git init -q -b main` literal. Parameterizing the branch is what lets the fall-through fixture initialize on `work` — which is the only way to make `main` fail as a candidate without deleting a ref.

## Negative Controls Observed

**1. The bare-`catch` regression, required by the plan.** The current `gitLines` failure arm was temporarily replaced with `return { ok: true, lines: [] };` — the semantic shape of the original `catch { return []; }` against the current call sites — and the not-a-repository state was measured in isolation.

- With the swallowing `gitLines`: `changedPaths(<non-repo>)` returned reason `No base candidate resolved -- origin/main: resolved to no commit; main: resolved to no commit; @{upstream}: git named no upstream ref; HEAD~1: resolved to no commit`. State four **refused**, on its `/rev-parse/` and `/not a git repository/` assertions.
- With the shipped `gitLines`: the same call returned a reason carrying `git rev-parse --verify origin/main^{commit} exited 128: fatal: not a git repository ...` for every candidate. State four **passed**.
- The file was restored from a pristine copy and verified byte-identical by `md5sum`; the harness re-ran green.

**A finding worth recording, because it sharpens what state four actually proves.** The `ok: false` half of state four is NOT by itself discriminating: a swallowing selector also returns `ok: false`, because the chain simply exhausts when every candidate "resolves to no commit". All of state four's discriminating power lives in the reason naming the failing subcommand and carrying git's stderr — which is exactly why the plan required both assertions and not just the exit shape. A state four that asserted only `ok === false` would have shipped unplanted.

**2. The shallow fixture is not vacuous.** A non-shallow clone of the same fixture repository was built this session and `git rev-parse --verify HEAD~1` succeeded there, so the shallow state's `assert.notEqual(..., 0)` is measuring shallowness rather than a property every clone has.

**3. The regression fires at the head of the chain too.** Running the full harness under the swallowing `gitLines` aborted at the chain-head state (`origin/main`'s rejection reason no longer names git's stderr) before reaching state four. That is why state four had to be isolated to observe it specifically.

## Verification Results

| Command | Result |
|---|---|
| `npm run test:coverage:direct:negative` | exit 0 — both summary lines printed, all 24 states observed |
| `npm run test:corresponding` | exit 0 |
| `npm run test:corresponding:negative` | exit 0 |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/markers.ts` | exit 0 — `branches 1/1, functions 0/0, lines 24/24` |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 — dead-code clean, health `0 above threshold · 12704 analyzed`, dupes `879 lines (1.1%) across 38 files` (under `threshold: 3`) |
| `npx prettier --check "scripts/**/*.mjs"` | exit 0 |

**Argument branches confirmed untouched.** `node scripts/test-coverage-direct.mjs a b` still refuses with the usage message and exit 1. `node scripts/test-coverage-direct.mjs --all --report <path>` dispatches, enumerates pairs, and writes report rows — it was exercised this session and wrote 9 rows before stopping at the pre-existing `bridges/commands/discover.ts` shortfall described below. The only diff line in this plan that mentions `runAllPairs`, `--all`, or `--report` is the usage-error string, whose text is unchanged; `runAllPairs` itself has no changed bytes.

**`scripts/check-phase-06-hub-ledger.mjs` keeps its own path census by design.** Measured: `grep -c "gate-targets" scripts/check-phase-06-hub-ledger.mjs` returns `0`. It still validates `OWNER_PAIRS` against its own `EXTENSION_ROOT` constant and does not read `tests/architecture/gate-targets.ts`. That is expected — `D-07-07` puts `.mjs` scripts outside the registry's scope, because a plain-JavaScript script cannot import a `.ts` module. Recording it here stops a later reader assuming one registry covers both.

## Decisions Made

- **`attempted` is present on both outcomes.** Task 1's action listed `{ ok: true, candidate, commit }` for the success arm, but Task 2's behavior block requires asserting that a successful selection of `main` still records `origin/main` as tried first. A selection that reports only its winner cannot be audited against the chain it walked, so the behavior block's reading governs. This is the one place the two halves of the plan disagreed.
- **Diff against the resolved candidate commit with `...`, not against a separate `merge-base` call.** `git diff <commit>...HEAD` already normalizes to the merge base, so the two-step is redundant. Measured on this branch: `git diff --name-only --diff-filter=ACMR $(git merge-base HEAD origin/main)...HEAD` and the same command with `$(git rev-parse origin/main^{commit})` produce byte-identical output.
- **`isPairablePath` delegates rather than duplicating.** The zero-pair report needs the reason a path was rejected and the pair filter needs the boolean. Writing both would be two copies of the same five-branch decision, and the second copy would be free to drift. `pairabilityRefusal` returns the reason and `isPairablePath` asks whether it is `undefined`.
- **The upstream candidate is validated before use, not after.** `rev-parse --abbrev-ref @{upstream}` is the only candidate name that comes from git output. It is character-class checked before it is ever placed in an argument array, and a rejected name becomes that candidate's recorded reason (`T-07-07`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] The three new exports had no consumer in the Task 1 commit**

- **Found during:** Task 1
- **Issue:** `fallow dead-code --fail-on-issues` reported `scripts/test-coverage-direct.mjs :170 selectBase, :213 changedPaths, :321 pairsForChangedPaths` as unused exports and exited 1. `npm-fallow` is a pre-commit hook whose `files:` pattern includes `scripts/.*\.mjs`, so the Task 1 commit could not be made with those exports present and unconsumed. This is the same constraint Wave 1 recorded for `tests/architecture/`, now measured for `scripts/`.
- **Fix:** The three functions ship in the Task 1 commit with their root parameters and their new behaviour, and the `export` keyword is added in the Task 2 commit alongside `scripts/test-coverage-direct.negative.mjs`, which imports all three. No behaviour, signature, or assertion changed as a result — only which of two adjacent commits carries three keywords.
- **Files modified:** `scripts/test-coverage-direct.mjs`
- **Verification:** `npx fallow dead-code --fail-on-issues --format human` exits 0 after both commits; `SKIP=trufflehog pre-commit run --files ...` reports `npm fallow ... Passed` for each.
- **Committed in:** `0e146152` (deferral) and `24ab4a00` (exports)

**2. [Rule 1 - Bug] `selectBase` did not carry `attempted` on a successful selection**

- **Found during:** Task 2
- **Issue:** Task 1's action text specified `{ ok: true, candidate, commit }`, so the first implementation dropped the rejection record on success. Task 2's `<behavior>` requires the chain-head state to assert "its `attempted` reasoning records that `origin/main` was tried first", which is unassertable against that shape.
- **Fix:** `attempted` is returned on the success arm as well, and its doc block states that it is present on both outcomes. The chain-head state asserts `attempted.map(entry => entry.candidate)` deep-equals `["origin/main"]` and that the recorded reason names `origin/main`.
- **Files modified:** `scripts/test-coverage-direct.mjs` (declared in this plan's `files_modified`)
- **Verification:** `npm run test:coverage:direct:negative` exits 0 with the chain-head state observed.
- **Committed in:** `24ab4a00`

---

**Total deviations:** 2 auto-fixed (1 × Rule 3 - blocking issue, 1 × Rule 1 - bug).
**Impact on plan:** No scope creep. Deviation 1 moves three keywords between two adjacent commits to satisfy a repository gate the plan itself requires to stay green. Deviation 2 reconciles two halves of the plan that specified different return shapes, in favour of the half that states the observable behaviour.

## Issues Encountered

**A pre-existing direct-coverage shortfall makes the zero-argument gate red on this branch, independently of this plan.** `node scripts/test-coverage-direct.mjs` with no arguments exits 1 on `Incomplete direct coverage for extensions/pi-claude-marketplace/bridges/commands/discover.ts: branches 55/57, lines 412/414`. Measured as pre-existing and out of this plan's scope:

- The same shortfall is reported by the **single-path** branch (`npm run test:coverage:direct -- extensions/.../bridges/commands/discover.ts`), which this plan did not touch at all.
- `bridges/commands/discover.ts` and `tests/bridges/commands/discover.test.ts` were last changed by `41f23c09 feat(06-05): extract resolver type owner`, which removed 112 lines from the test.
- The change set the gate selects is byte-identical before and after this plan: `git diff --name-only --diff-filter=ACMR $(git merge-base HEAD origin/main)...HEAD` and the new `$(git rev-parse origin/main^{commit})...HEAD` form produce the same list, verified by `diff`.

Task 1's `<verify>` for `node scripts/test-coverage-direct.mjs` therefore cannot exit 0 on this branch until that shortfall is closed. The half of that criterion this plan owns — "the output names no selected base candidate" — is satisfied: the run prints `Changed-pair base: origin/main` as its first line. The shortfall is a Phase 6 split artifact and belongs to whichever plan owns `tests/bridges/commands/discover.test.ts`; it is not fixed here.

**`npm lint` and `npm format check` reported "files were modified by this hook" on every pre-commit run.** Five sibling executors were committing to this same working tree throughout. Triaged per run: `npm run lint` and `npx prettier --check "scripts/**/*.mjs"` both exit 0 standalone, and both of this plan's files were `md5sum`-verified byte-identical before and after each hook run. The hook failure is pre-commit's whole-tree change detection firing on sibling writes, not a finding against anything this plan owns.

**Fallow's duplication total rose from 873 to 879 lines across the same 38 files, and one reported clone names this plan's file.** The group is `scripts/test-coverage-direct.mjs:668-678` paired with `scripts/test-coverage-direct.report.mjs:141-151` — the module-invocation epilogue (`invokedPath` / `main().catch`). Measured: the last nine lines of `test-coverage-direct.mjs` are byte-identical to their form before this plan, and no diff line in this plan touches `invokedPath` or `main().catch`; only the line numbers moved. `fallow dupes --fail-on-issues` exits 0. No clone group was introduced by the fixture builder.

**The `WINDOWS.md` ledger could not be appended to.** `gsd-tools windows append` still refuses with the table-versus-JSON desync Wave 1 recorded for rows 30 and 9. That predates this plan; ledger population is best-effort and does not block execution, so the two deviations and the `discover.ts` shortfall are recorded in this SUMMARY only.

## Known Stubs

None. Every function this plan added has a caller and a planted state; no path returns a placeholder value.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The gate is fail-closed, so the wiring `RCOV-03` adds in the Direct Coverage phase now has something honest to wire:

- **Exit codes are meaningful.** `0` with `Changed-pair base: <candidate>` and a skipped-path list means the change set resolved and held no pairs. Non-zero with `Changed-pair selection failed: <reason>` means a git invocation failed and names which one. A CI job can now treat a red run as a real signal.
- **The selected base is printed on every run**, so a CI log records which of the four candidates the answer rested on — the thing a shallow checkout would otherwise change invisibly.
- **The fixture builder is reusable.** `buildFixtureRepository(name, branch, commits)` and `cloneShallow(source, name)` live in the negative harness and take a branch name, so a later plan needing a git state can plant one without re-deriving the `init` / `config` / `commit` sequence.

Open and not attempted here: the `bridges/commands/discover.ts` coverage shortfall above keeps the zero-argument gate red on this branch, so `RCOV-03` cannot turn the gate on in pre-commit or CI until it is closed. That is a coverage debt in a Phase 6 split, not a defect in the selector.

---
*Phase: 07-gate-integrity*
*Completed: 2026-09-10*

## Self-Check: PASSED

- `scripts/test-coverage-direct.mjs` — present on disk.
- `scripts/test-coverage-direct.negative.mjs` — present on disk.
- `.planning/phases/07-gate-integrity/07-03-SUMMARY.md` — present on disk.
- `0e146152`, `24ab4a00`, `b6f0acbc` — all reachable in `git log --oneline --all`.
- `.planning/STATE.md` and `.planning/ROADMAP.md` — no diff against `f25c8b5f` and no working-tree change; the orchestrator owns those writes.
- Only this plan's two declared files and this SUMMARY appear in its three commits.
