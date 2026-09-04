---
phase: 115-composition-orchestrators
plan: 03
subsystem: testing
tags: [node-test, barrel, dead-code, type-level-proof, import-orchestrator]

requires:
  - phase: 115-composition-orchestrators
    plan: 01
    provides: "The measured environment facts this plan relied on: hooks absent, scoped pre-commit, filesystem trufflehog route, pre-existing format:check noise"
provides:
  - "orchestrators/import/index.ts reachable from production through edge/handlers/plugin/import.ts"
  - "A pruned, suppression-free import barrel whose export set is pinned at compile time"
  - "The sole mirrored owner tests/orchestrators/import/index.test.ts"
  - "One fewer correspondence-gate violation (18 -> 17); missing-test on the barrel is closed"
affects: [115-02]

actuals:
  tokens: 1562
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Runtime namespace import of a barrel so an @ts-expect-error on an absent member flips to unused the moment the re-export returns"
    - "Self-identity Same<T, T> in type position as the flipping negative for an absent TYPE member, where value-position access cannot fire"

key-files:
  created:
    - tests/orchestrators/import/index.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/index.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts

key-decisions:
  - "Delivered both tasks in one commit: DEL-01 makes the commit, not the task, the pair-atomic unit"
  - "Proved the prune contract by planting the violation rather than asserting the shape: re-added two pruned re-exports and measured typecheck exit 2"
  - "Used a runtime namespace import, not a type-only one, because a type-only namespace cannot carry a value-position negative that flips"
  - "Used Same<T, T> for the EnabledPluginRef negative because Same<T, never> keeps erroring after a re-add and would never flip"

patterns-established:
  - "A barrel negative must be verified to FLIP, not merely to compile: run typecheck with the pruned symbol restored and require a non-zero exit"

requirements-completed: [MOD-08]

coverage:
  - id: D1
    description: "The barrel re-exports the defining importClaudeSettings binding, proved by reference identity"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/index.test.ts (1 case, 1 describe)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/import/index.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both re-exported types are identical to their definitions in execute.ts and the runtime export set is exactly one name"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/index.test.ts:19-21 (Same<> satisfies checks under npm run typecheck)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Re-adding any pruned re-export fails npm run typecheck"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "planted violation: buildClaudeImportPlan + EnabledPluginRef restored, tsc exit 2 on three lines; restored barrel, tsc exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The barrel has a production importer and carries no dead-code suppression"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "fallow dead-code --fail-on-issues: No issues found; rg fallow-ignore on the barrel: no match"
        status: pass
    human_judgment: false
  - id: D5
    description: "The plugin import command behaves identically"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/edge/handlers/import.test.ts 5/5 pass, git diff --quiet clean on that file"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-09-01
status: complete
---

# Phase 115 Plan 03: Import Barrel Summary

**`orchestrators/import/index.ts` went from an unreachable, eight-suppression re-export sheet to a two-line published surface that production actually imports, pinned by a type-level export-set proof that was measured to fail typecheck when a pruned re-export is put back.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-01T23:20:00Z
- **Completed:** 2026-09-01T23:41:17Z
- **Tasks:** 2 of 2
- **Files modified:** 3 (2 production, 1 new test)

## Caller Trace (DEL-02)

Run before any edit, with `codegraph explore` over the `.codegraph/` index and
confirmed by `rg` over `extensions/` and `tests/`.

**Importers of the barrel — exactly one, and it is a test:**

```
tests/orchestrators/import/execute.test.ts:17
```

No production file imported `orchestrators/import/index.ts`. This is the finding
D-115-01 was written against, and it held. That single importer is P115-02's repoint
under D-115-02 and was deliberately left alone; the `wrong-import` violation on it is
still open and still expected.

**Consumers of each pruned symbol, by defining module:**

| Pruned symbol | Defining module | Consumers besides the barrel |
|---|---|---|
| `buildClaudeImportPlan` | `marketplaces.ts` | `import/execute.ts` (production), `marketplaces.test.ts`, `execute.test.ts` |
| `planMarketplaceSourcesForRefs` | `marketplaces.ts` | `marketplaces.ts` itself, `marketplaces.test.ts` |
| `extractEnabledPluginRefs` | `refs.ts` | `marketplaces.ts` (production), `refs.test.ts` |
| `parseEnabledPluginRef` | `refs.ts` | `refs.ts` itself, `refs.test.ts` |
| `loadMergedClaudeSettingsForScope` | `settings.ts` | `import/execute.ts` (production), `settings.test.ts` |
| `mergeClaudeSettings` | `settings.ts` | `settings.ts` itself, `settings.test.ts` |
| `resolveClaudeSettingsPaths` | `settings.ts` | `settings.ts` itself, `settings.test.ts` |
| `EnabledPluginRef` (type) | `types.ts` | `refs.ts`, `marketplaces.ts` (production), `types.test.ts` |

Every one keeps at least its own Phase 113 owner test on its defining module, and four
of the eight keep a real production consumer there as well. Nothing lost a consumer when
the barrel stopped re-exporting it — which is why the dead-code gate stayed clean.

### DEL-03 note: why the one-line handler edit is in scope

`edge/handlers/plugin/import.ts` belongs to a pair Phase 116 has not started, so
DEL-03 would normally keep this plan out of it. Three things make the edit in scope:

1. **D-115-01 mandates it by name.** The barrel cannot become production-reachable
   without a production file importing it, and this handler is the only production
   caller of `importClaudeSettings`.
2. **It changes no behavior.** The edit is the module specifier alone — same four
   names, same `type` modifiers, same order — and the barrel forwards to the identical
   binding, which the new owner asserts by reference identity. The handler's own suite
   passes unmodified (`git diff --quiet` clean on it).
3. **It does not consume the handler's pair.** No case, seam, or export of the handler
   changed, so Phase 116 inherits it whole.

## Task Commits

Both tasks landed in one commit. DEL-01 says "each executable plan and **implementation
commit** owns exactly one production source-test pair" — the commit, not the task, is
the atomic unit. Splitting them would have published a pruned barrel with no owner and a
live `missing-test` violation in between, which is the exact state pair-atomicity
forbids.

1. **Task 1 + Task 2: own the import barrel and make it production-reachable** — `f732f0de` (test)

**Plan metadata:** not committed — the orchestrator owns planning artifacts.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/import/index.ts` — 18 lines to 2. One
  runtime re-export plus one `export type` re-export of the two handler types. Zero
  suppressions.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` — one line: the
  module specifier moved from `../../../orchestrators/import/execute.ts` to
  `../../../orchestrators/import/index.ts`.
- `tests/orchestrators/import/index.test.ts` — new, 73 lines. One `describe` with one
  runtime case, plus module-scope type evidence.

## Measured Results

Every number below was observed, not estimated.

**`npm run fallow` immediately after the prune, before any test existed** — this was the
plan's gate and the one assumption research could not falsify without performing the
edit. Real exit code, not a piped one:

```
NPM_FALLOW_EXIT=0
  492 entry points detected (486 plugin, 5 package.json, 1 manual entry)
✓ No issues found (0.64s)          <- fallow dead-code
✗ 0 above threshold · 10934 analyzed · maintainability 92.2 (good)   <- fallow health
✗ 915 lines (1.4%) duplicated across 38 files                        <- fallow dupes
```

No new unused export appeared. No suppression was re-added and no re-export was
restored. The `✗` glyphs on the health and dupes summary lines are informational
totals, not failures — the chained `&&` command exited 0, which is the only signal that
counts.

**Focused run** — `node --test tests/orchestrators/import/index.test.ts`:

```
ℹ tests 1
ℹ suites 1
ℹ pass 1
ℹ fail 0
ℹ skipped 0
ℹ todo 0
```

**Direct coverage** — `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/import/index.ts`, verdict line verbatim:

```
Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/import/index.ts (branches 1/1, functions 0/0, lines 2/2)
```

Real exit code 0. 100 percent branches, functions, and lines. No coverage exception,
pragma, or production seam was added.

**The prune contract was proved by planting the violation, not by reading the barrel.**
Two pruned re-exports were temporarily restored and `tsc` was re-run:

```
tests/orchestrators/import/index.test.ts(21,12): error TS1360: Type 'true' does not satisfy the expected type 'false'.
tests/orchestrators/import/index.test.ts(43,1):  error TS2578: Unused '@ts-expect-error' directive.
tests/orchestrators/import/index.test.ts(59,1):  error TS2578: Unused '@ts-expect-error' directive.
EXIT_WITH_READDED=2
EXIT_RESTORED=0
```

All three axes fired: the runtime export-set pin broke, the value-position negative for
`buildClaudeImportPlan` went unused, and the type-position negative for
`EnabledPluginRef` went unused. Restoring the barrel returned exit 0.

**Repository gates:**

| Gate | Result |
|------|--------|
| `npm run typecheck` | pass (exit 0) |
| `npm exec -- eslint` on both production files and the test | pass, no output |
| `npm exec -- prettier --check` on all three | `All matched files use Prettier code style!` |
| `npm run fallow` (dead-code, health, dupes) | exit 0; dead-code `✓ No issues found` |
| `npm test` | `tests 4755 · pass 4755 · fail 0` |
| `npm run test:integration` | `tests 28 · pass 28 · fail 0` |
| `node --test tests/edge/handlers/import.test.ts` | `tests 5 · pass 5 · fail 0`, file unmodified |
| correspondence gate | `17 violation(s)`, down from 18; `missing-test: tests/orchestrators/import/index.test.ts` gone (grep count 0) |
| prohibited-pattern `rg` scan | no match (exit 1) |
| `git diff --check` | clean |
| `rg fallow-ignore` on the barrel | no match |
| trufflehog `filesystem` scan of the three paths | `verified_secrets: 0, unverified_secrets: 0`, exit 0 |

**`npm run check`** stops at `format:check` with the documented pre-existing failure and
nothing else:

```
[warn] .mcp.json
[warn] .planning/research/.cache/*.json   (7 files)
[warn] Code style issues found in 8 files.
```

All 8 are untracked files this plan did not create or touch. No file under `tests/` or
`extensions/` appears. `typecheck`, `lint`, and `fallow` all ran green ahead of it in
the same chain; `test` and `test:integration`, which the failure blocked, were run
individually and are recorded above.

## Decisions Made

1. **The namespace import is a runtime import, not `import type * as`.** The analog uses
   a type-only namespace because its pruned symbols are types. Seven of mine are runtime
   functions, and a type-only namespace cannot appear in value position — the reference
   would error for the wrong reason and keep erroring after a re-add, so the negative
   would never flip. A runtime namespace also supplies `keyof typeof importBarrel` for
   the export-set pin, so it replaces the `import("...")` type form the analog used.
2. **The `EnabledPluginRef` negative compares the type with itself.** The obvious form,
   `Same<importBarrel.EnabledPluginRef, never>`, does not flip: after a re-add the type
   resolves, `Same<T, never>` is `false`, and `true satisfies false` still errors, so
   the suppression stays consumed and typecheck stays green. `Same<T, T>` resolves to
   `true` the moment the member exists, leaving the suppression unused. The measured
   TS2578 at line 59 is the proof.
3. **The multi-line negative literal became a single line.** A `satisfies` failure on a
   multi-line object literal is reported at the closing `} satisfies ...` line, not at
   the opening `void ({`, so a leading `@ts-expect-error` was reported unused while the
   real error escaped. The one-line form the pattern map shows puts the error on the
   suppressed line.
4. **One commit, not two.** Recorded above under Task Commits.

## Deviations from Plan

### 1. [Rule 3 - Blocking] `pre-commit run --all-files` not run

- **Found during:** Task 2, pre-commit stage.
- **Issue:** The plan's verification block asks for `pre-commit run --all-files`. That
  run adds `mdformat`, `markdownlint-cli2`, and the texthooks fixers over every tracked
  Markdown and YAML file. Those hooks write, so it would rewrite operator and planning
  files that a TypeScript-only change cannot have affected.
- **Fix:** Ran `pre-commit run --files` with the three explicit paths. The four hooks
  that gate TypeScript (`npm lint`, `npm format check`, `npm typecheck`, `npm fallow`)
  invoke whole-repository npm scripts regardless of the file list, so the scoped run
  exercises them at full scope. Results: `npm lint` Passed, `npm typecheck` Passed,
  `npm fallow` Passed, `prettier` Passed, all texthooks Passed; `npm format check`
  Failed on the 8 untracked files described above and nothing else.
- **Verification:** Hook output read line by line; no failure names a file this plan
  touched. This matches the environment fact 115-01 established and the orchestrator
  confirmed.

### 2. [Rule 3 - Blocking] trufflehog scanned by the filesystem route

- **Found during:** Task 2, pre-commit stage.
- **Issue:** This checkout is a linked worktree, so `.git` is a file and the hook's
  git-mode scan aborts structurally:
  `failed to read index file: open .../.git/index: not a directory`.
- **Fix:** Ran the filesystem scan CLAUDE.md documents, over the three paths being
  committed, with `--results=verified,unknown --fail`. Result:
  `chunks: 3, bytes: 6246, verified_secrets: 0, unverified_secrets: 0`, exit 0. The
  commit then used `SKIP=trufflehog` and no other skip.

---

**Total deviations:** 2 auto-fixed, both Rule 3 and both environmental. Neither touched
the deliverable. No scope creep: the only production changes are the two D-115-01
authorizes.

## Issues Encountered

**A barrel negative that compiles is not a barrel negative that works.** The two
type-level constructs that looked correct by inspection — a multi-line `satisfies`
negative and `Same<T, never>` for an absent type — both compiled clean while proving
nothing, because the `@ts-expect-error` stayed consumed for a reason unrelated to the
prune. Neither would have been caught by any gate in the plan's verify block: typecheck
was green, coverage was 100 percent, the correspondence gate was satisfied. Only
re-adding the pruned re-exports and measuring a non-zero `tsc` exit exposed them. The
repository already records this lesson for architecture gates ("a gate wants a test that
plants the violation, not one that reads the config"); it applies verbatim to
compile-time contracts. **Any later pair that writes an `@ts-expect-error` negative
should restore the symbol once and confirm typecheck goes red.**

**The estimate over-projected by roughly 12x.** The plan estimated 18,000 tokens; the
realized change measures 1,562 on the same `chars/4` scale (6,246 characters across the
three files). The plan's own risk framing — "the riskiest change in wave 1, it touches
production" — is about blast radius, not size, and the two production edits turned out
to be 1 line and 16 deleted lines. Barrel pairs are small even when they are risky.

**`fallow` prints `✗` on green.** The `health` and `dupes` summary lines both start with
`✗` while the chained command exits 0. A reader tailing the output would call this run
failed. Check the exit code of `npm run fallow` itself, never the glyph and never a
piped tail.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or schema was
introduced; the diff removes published surface rather than adding it.

## User Setup Required

None.

## Next Phase Readiness

**115-02 is unblocked and its precondition is confirmed.** The barrel now exports
`importClaudeSettings` plus the two handler types and nothing else. When 115-02 repoints
`tests/orchestrators/import/execute.test.ts:17` from the barrel to `./execute.ts` under
D-115-02, the barrel keeps its production importer through the edge handler, so no
suppression or re-export needs to come back. The `wrong-import` violation on that file
is still open by design.

Three carry-forwards:

1. **Prove every `@ts-expect-error` flips.** Restore the symbol, run `npm run typecheck`,
   require a non-zero exit, then restore the file. See Issues Encountered.
2. **`format:check` is red locally** on 8 untracked files no plan in this phase created.
   Unchanged from 115-01.
3. **One commit per pair**, covering source and test together, per DEL-01.

---
*Phase: 115-composition-orchestrators*
*Completed: 2026-09-01*

## Self-Check: PASSED

- `tests/orchestrators/import/index.test.ts` — present, committed in `f732f0de`.
- `extensions/pi-claude-marketplace/orchestrators/import/index.ts` — present, pruned to
  2 lines, committed in `f732f0de`.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` — present, repointed,
  committed in `f732f0de`.
- `f732f0de` — present in `git log`.
- `git status --short -- extensions tests` — clean; no uncommitted or untracked residue
  from this plan.
