---
phase: 08-direct-coverage
plan: 01
subsystem: testing
tags: [coverage, lcov, node-test, pre-commit, mdformat, gate-scripts]

requires:
  - phase: 07-gate-integrity
    provides: "`pairForPath`'s `selectedProjectRoot` parameter (c0241c82), the negative harness the new control joins, and `assertReportComplete`"
provides:
  - "A whole-tree direct-coverage report that runs to completion over all 230 enumerated pairs"
  - "A planted control inside `npm run check` that refuses the pair-lookup arity state"
  - "A green `pre-commit run --all-files`, which is what CI's Lint job runs"
  - "The measured enumeration baseline: 7 named shortfall modules with their exact reading strings"
affects: [08-02, 08-03, 08-04, 08-05, 08-07, 08-08, 08-09]

actuals:
  tokens: 7659
  tasks: 3
  commits: 3
  plan_head_before: 635c85eb196aa22f8c220bb1d4a3bd7d49763b4d

tech-stack:
  added: []
  patterns:
    - "A root-taking exported function is never passed as a bare array-iteration callback; the callback wraps it and passes only the element"
    - "A formatter exclusion is widened on both sides of a pinned-bytes pair, with the second half of the reason stated in the comment"

key-files:
  created: []
  modified:
    - scripts/test-coverage-direct.report.mjs
    - scripts/test-coverage-direct.negative.mjs
    - .pre-commit-config.yaml

key-decisions:
  - "The new negative control plants the arity state against the exported `pairForPath`, not against the report's own loop, so it proves the failure mode is refused rather than pinning the repaired line"
  - "Widening the dash exclusion was necessary but NOT sufficient for a green `--all-files`: three more hooks rewrote six committed files, and those writes were taken as the hooks produce them"
  - "`trufflehog` cannot run in a linked worktree (it reads `<root>/.git/index`, which is a file-based gitdir here); every `--all-files` claim below is with `SKIP=trufflehog`, and no other hook fails"

patterns-established:
  - "Measure the whole instrument before trusting any single-hook reproduction: a throwaway-repo reproduction of one hook said nothing about the other 30"

# This plan advances RCOV-01 and RCOV-03 but closes neither, so neither is marked complete:
# RCOV-01 asks for the regenerated baseline artifacts, which plan 08 writes from the SECOND
# sweep (D-08-08); RCOV-03 asks for the pre-commit and CI gate wiring, which plan 09 adds.
# The per-deliverable `requirement:` links below carry the traceability.
requirements-completed: []

coverage:
  - id: D1
    description: "`npm run test:coverage:direct:report` runs to completion over every enumerated pair and prints both its row-count line and its `Verdicts:` tally"
    requirement: RCOV-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct:report (230 rows, 479.8s, exit 0)"
        status: pass
      - kind: other
        ref: "row count equals productionPaths().length (230) read back out of coverage/all-pairs-report.ndjson"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pair-lookup arity state is refused by a control that runs inside `npm run check`"
    requirement: RCOV-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct:negative (exit 0; final summary line names the report pair-enumeration control)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`pre-commit run --all-files` completes with no hook reporting `files were modified by this hook`"
    requirement: RCOV-03
    verification:
      - kind: other
        ref: "SKIP=trufflehog pre-commit run --all-files (exit 0)"
        status: pass
      - kind: other
        ref: "pre-commit run --all-files (exit 1; trufflehog only, on a worktree gitdir read error, no file modified)"
        status: pass
    human_judgment: true
    rationale: "The green run excludes `trufflehog`, which fails here on a linked-worktree gitdir rather than on repository content. An operator should confirm that the skip is the sanctioned worktree escape CLAUDE.md already prescribes and that CI's full clone runs the hook for real."
  - id: D4
    description: "The measured enumeration baseline — verdict tally plus every refused row with its exact reading string and a named disposition"
    requirement: RCOV-01
    verification:
      - kind: other
        ref: "this SUMMARY's 'The measured enumeration' section, read off coverage/all-pairs-report.ndjson"
        status: pass
    human_judgment: true
    rationale: "The disposition column routes plans 02-08. Whether each named decision still fits its measured reading is a judgment the operator should confirm before those plans act on it."

duration: 39min
completed: 2026-09-11
status: complete
---

# Phase 8 Plan 01: Repair the Instrument and Measure Once Summary

**The whole-tree direct-coverage report now runs end to end — 230 rows in 479.8 s — after its pair-enumeration callback stopped handing the array index to `pairForPath`'s repository-root parameter; the measured tally is `accepted-shortfall 7, complete 216, type-only 7`.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-09-11T01:29:13Z
- **Completed:** 2026-09-11T02:08:14Z
- **Tasks:** 3
- **Files modified:** 9 (3 in scope, 6 pre-existing formatter debt — see Deviations)

## Accomplishments

- Repaired `scripts/test-coverage-direct.report.mjs`'s enumeration loop. The report had never completed once since it was written.
- Planted the arity state in `scripts/test-coverage-direct.negative.mjs`, which `npm run check` runs, so the failure mode is now refused by something the check chain executes.
- Turned `pre-commit run --all-files` green, which took four hooks rather than the one the plan and the research named.
- Ran one complete sweep in this checkout and recorded the seven shortfall modules with their exact reading strings, as the classification input for plans 02, 03, 05, and 07.

## Task Commits

1. **Task 1: repair the report's pair enumeration and plant its regression** — `184b0016` (fix)
2. **Task 2: widen the `fix-unicode-dashes` exclusion** — `c20397c6` (chore)
3. **Deviation: apply the other three text fixers** — `5d5c4c29` (style)
4. **Task 3: run the enumeration sweep and record it** — this SUMMARY (no production change; the report output is gitignored)

## The reproduction, before the fix

Reproduced in this checkout before any edit:

```
$ npm run test:coverage:direct:report
The "paths[0]" argument must be of type string. Received type number (0)
$ echo $?          # via PIPESTATUS, not a piped exit code
1
$ wc -c coverage/all-pairs-report.ndjson
0
```

Root cause, with the stack:

```
TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received type number (0)
    at Object.resolve (node:path:1257:7)
    at toProjectPath (scripts/test-coverage-direct.mjs:21:29)
    at pairForPath (scripts/test-coverage-direct.mjs:71:23)
```

`scripts/test-coverage-direct.report.mjs:112` read `modulePaths.map(pairForPath)`. `Array.prototype.map`
invokes its callback as `(element, index, array)`, so the element index landed in the
`selectedProjectRoot` parameter and `path.resolve` was asked to resolve against a number. The
report file was written empty and the run ended having measured nothing — 0.6 s, exit 1.
`D-08-A01` is confirmed exactly as written.

The fix mirrors the form the gate's own all-pair arm already uses at
`scripts/test-coverage-direct.mjs:590`:

```js
for (const pair of modulePaths.map((modulePath) => pairForPath(modulePath))) {
```

A repository-wide sweep for the same hazard (`.map`/`.forEach`/`.filter` over `pairForPath`,
`assertCompleteCoverage`, `pairsForChangedPaths`, `toProjectPath`) under `scripts/` returns nothing
after the fix.

**What the new control does and does not guard.** The control plants the arity state against the
exported `pairForPath` — one `assert.doesNotThrow` with the path alone, one `assert.throws` with a
numeric second argument — so `npm run check` now refuses the *failure mode*. It does not read
`report.mjs`'s loop, so it would not catch a future reintroduction of a bare callback there. That is
the shape `D-08-A09` and this plan's acceptance criteria specify, and it is stated here rather than
overclaimed. The refusal matches on a pattern because the message belongs to Node's `path.resolve`;
a deliberately wrong pattern was confirmed to fail the assertion, so the match is load-bearing.

## The measured enumeration

Reproduction:

```
$ node -e 'import("./scripts/test-coverage-direct.mjs").then(m => console.log(m.productionPaths().length))'
230
$ npm run test:coverage:direct:report
```

Run in this repository checkout on 2026-09-11, Node `v26.8.2`. Last two stdout lines, verbatim:

```
All-pair report written: 230 rows in 479.8s on v26.8.2 to coverage/all-pairs-report.ndjson
Verdicts: accepted-shortfall 7, complete 216, type-only 7
```

230 rows, equal to `productionPaths().length`. The sweep cost 8.0 min of summed per-pair time; the
slowest pairs are `scripts/revalidation.mjs` 20.0 s, `reinstall-flow.ts` 11.5 s, `update-swap.ts`
9.3 s, `update-flow.ts` 8.9 s, `install-flow.ts` 8.5 s.

The 230th pair — `scripts/revalidation.mjs` ↔ `tests/architecture/revalidation.test.ts` — measured
`complete` (`branches 789/789, functions 202/202, lines 2660/2660`). `D-08-A10` is why: in a tree
without `.planning/` that pair throws a focused-test failure, and `verdictFor` rethrows it instead of
recording it, so the run aborts on the final row. Measured here it passes, which is the whole
difference between this 230-row tally and the research's 229-row one (`complete 215` + this row =
216).

### Refused rows (`accepted-shortfall`), with their exact reading strings

The reading string is reproduced byte for byte as `assertCompleteCoverage` formatted it, because the
pin plan 04 builds compares that string exactly.

| module (under `extensions/pi-claude-marketplace/`) | exact reading | disposition | decision |
| --- | --- | --- | --- |
| `bridges/commands/discover.ts` | `branches 55/57, lines 412/414` | **pin candidate** — two unreachable sites (`CommandNameError` narrowing arm, and the `err.code ?? ""` arm) | `D-08-03`, `D-08-A05` |
| `bridges/hooks/event-router.ts` | `branches 107/111, lines 959/967` | **tests** — all four guard sites reachable through the injected `HooksRuntime` | `D-08-A04` |
| `edge/args.ts` | `branches 28/29, lines 86/89` | **rewrite** — dense-index guard yields to `for...of` | `D-08-09`, `D-08-A03` |
| `edge/handlers/plugin/pending.ts` | `branches 9/10` | **rewrite** — third dense-index guard, the one `D-08-09` does not name | `D-08-A03` |
| `edge/handlers/shared.ts` | `branches 14/15, lines 83/85` | **rewrite** — dense-index guard yields to `for...of` | `D-08-09`, `D-08-A03` |
| `orchestrators/plugin/install-outcome.ts` | `branches 60/83, functions 22/27, lines 956/1031` | **owner tests, after the removal port** — explicitly not pin-eligible | `D-08-A06` |
| `orchestrators/plugin/update-preflight.ts` | `functions 20/21, lines 589/593` | **test** — `isUpdatePreflightOutcome` is exported, pure, and never called by its owner suite | `08-RESEARCH.md` §5 |

**Every refused row carries a named disposition. No row is unclassified**, so `D-08-09a`'s
"unclassified, needs a disposition" escalation has no members this run. The one open-ended item,
`install-outcome.ts`, carries `D-08-A06`'s own escalation path rather than a pin row; its size is
bounded only once the removal port lands.

### `type-only` rows, by path

All seven are under `extensions/pi-claude-marketplace/`:

`bridges/agents/types.ts`, `bridges/commands/types.ts`, `bridges/mcp/types.ts`,
`bridges/skills/types.ts`, `edge/types.ts`, `orchestrators/import/types.ts`,
`orchestrators/types.ts`.

### On the count

Seven modules fall short. That is the same number the roadmap and `CONTRIBUTING.md` print, and it is
a coincidence: four of `CONTRIBUTING.md`'s rows now read **complete** and two modules it never named
fall short. Measured here, for plan 08 to strike:

| module | `CONTRIBUTING.md` reading | measured here |
| --- | --- | --- |
| `edge/completions/data.ts` | `branches 109/110` | `branches 109/109, functions 36/36, lines 631/631` |
| `edge/completions/provider.ts` | `branches 79/80` | `branches 78/78, functions 19/19, lines 340/340` |
| `edge/handlers/marketplace/update.ts` | `branches 11/12` | `branches 11/11, functions 3/3, lines 73/73` |
| `edge/handlers/plugin/import.ts` | `branches 11/12` | `branches 11/11, functions 2/2, lines 75/75` |

Per `D-08-02` and `D-08-10` this is stated as a set of named modules. No count from the roadmap,
`CONTRIBUTING.md`, or `08-CONTEXT.md` was carried into this plan, and nothing outside this SUMMARY
was rewritten — plan 08 regenerates those artifacts from the second sweep, which reflects the final
tree.

## The dash hook, before and after

`tests/architecture/revalidation.test.ts` is the only dash offender in the tree. Re-measured
independently here over `git ls-files`, applying both pre-commit's global exclusion and the hook's
own: **one** file, 16 em-dashes. `D-08-A12` holds.

Before the widening:

```
Fix Unicode dash characters..............................................Failed
- hook id: fix-unicode-dashes
- files were modified by this hook
  tests/architecture/revalidation.test.ts       (16 insertions, 16 deletions)
```

The rewritten file was restored with a path-scoped `git checkout --` before any commit. After the
widening the same invocation reports `Passed`, and no `rev:` pin or other hook `exclude:` changed.

## Decisions Made

- **The control plants against `pairForPath`, not against `report.mjs`.** Per the plan's acceptance
  criteria. Recorded above with its limits, so no later reader mistakes it for a guard on the
  repaired line.
- **Took the hooks' own output for the pre-existing formatter debt** rather than hand-editing the six
  files to satisfy them. The three `.planning/` verification records lose trailing two-space hard
  breaks, which is a rendering change; the alternative was editing committed verification records,
  which is worse. `mdformat` restyled thematic breaks in two `docs/` files it owns.
- **`trufflehog` is skipped, and the skip is named.** It fails in this linked worktree with
  `failed to read index file: open <root>/.git/index: not a directory` — in a linked worktree `.git`
  is a file, so there is no `<root>/.git/index` to read. `CLAUDE.md` already prescribes
  `SKIP=trufflehog` for worktree commits, and CI runs on a full clone where the hook works.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widening the dash exclusion did not make `pre-commit run --all-files` green**

- **Found during:** Task 2 (dash-hook widening), on running the task's own second `<verify>`
- **Issue:** The plan's objective and `D-08-A12` both hold that `fix-unicode-dashes` over
  `tests/architecture/revalidation.test.ts` is what makes `--all-files` red. Measured on a real
  `--all-files` run in this checkout, three more hooks also rewrote committed files:
  `trailing-whitespace` over three verification records, `end-of-file-fixer` over one summary, and
  `mdformat` over two `docs/` files. The research's reproduction ran in a throwaway repository
  holding only the one offending file, so it could not have seen them. With the dash hook green the
  run was still red, and the task's `<done>` — a run clean enough for plan 09 to verify a new hook
  inside — was unmet.
- **Fix:** Took each hook's own output for the six files it rewrites. No file was hand-edited.
- **Files modified:** `.planning/phases/01-live-evidence-revalidation/01-VERIFICATION.md`,
  `.planning/phases/03-production-defect-corrections/03-VERIFICATION.md`,
  `.planning/phases/04-hermetic-test-infrastructure/04-VERIFICATION.md`,
  `.planning/phases/06-assertion-and-module-refinement/06-31-SUMMARY.md`, `docs/output-catalog.md`,
  `docs/prd/pi-claude-marketplace-prd.md`
- **Verification:** `mdformat` rewrites `---` thematic breaks in two docs, and
  `tests/architecture/catalog-uat/` parses `docs/output-catalog.md` — the same formatter-versus-pinned-bytes
  hazard the dash hook presents. Ran it: all 190 documented tuples still parse, 16/16 cases pass. The
  whole `tests/architecture/` suite is green (429/429), and so is `npm test` (5952/5952, 0 skipped).
  `SKIP=trufflehog pre-commit run --all-files` then exits 0 with no hook reporting a modification.
- **Committed in:** `5d5c4c29` (separate from the task commit, so the deviation stays legible)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** In-kind with the task's stated goal — the task exists to clear a red
`--all-files`, and clearing it took four hooks rather than one. It touched six files the plan does
not list; all six changes are formatter output on committed markdown, and CI's Lint job runs
`--all-files` verbatim, so they were already red there. No production code and no test logic changed.

## Issues Encountered

- **The report's own `Verdicts:` tally was never printed before today.** The report stops recording
  after a shortfall rather than halting, so the run visibly walked the whole tree, printing each of
  the seven refusals as it passed them. That behavior is what `D-08-08` depends on and it works.
- **Scoped pre-commit runs hide whole-tree violations.** Six files were red for `--all-files` while
  every scoped `pre-commit run --files` stayed green, and all six were last touched between
  2026-09-06 and 2026-09-09, inside this milestone. Running `--all-files` before a push remains the
  only way to see what CI sees.
- **`trufflehog` cannot run here.** Environment limitation in a linked worktree, not a content
  finding. Every `--all-files` green claim in this SUMMARY is with `SKIP=trufflehog`; `trufflehog` is
  the only hook that reports `Failed`, and it modifies nothing.
- **`gsd-tools query state.update-progress` regressed `completed_phases` from 3 to 1** (and `percent`
  from 33 to 11) on every invocation; the operator's values were restored by hand both times. The two
  records also disagree on the definition: `.planning/state.json` marks phases 2-7 `complete` (6 of
  9), while `STATE.md` counts only the three whose verification passed. `state.json` was left exactly
  as the verbs wrote it — including a `next.reason` label that still reads `11%` — because it is
  tool-owned derived state regenerated on the next `/gsd:progress`. Worth an operator decision on
  which definition the milestone uses.

## Requirement status

Neither `RCOV-01` nor `RCOV-03` was marked complete in `.planning/REQUIREMENTS.md`, and that is
deliberate rather than an omission. `RCOV-01` asks for a regenerated baseline whose artifacts carry
no stale counts; plan 08 writes those from the **second** sweep, which is the one that reflects the
final tree (`D-08-08`). `RCOV-03` asks for the gate to run in scoped local pre-commit and a dedicated
CI job; plan 09 adds both. Checking either box here would put exactly the kind of premature claim
into a planning artifact that this phase exists to remove. Both stay `Pending` until the plan that
closes them says otherwise.

## Blockers and escalations

1. **For the operator, low urgency:** the `trufflehog` pre-commit hook cannot run in any linked
   worktree of this repository, so the local gate has a permanent hole that only CI closes. Plan 09
   adds a local hook to the same file and will be verified with the same skip.
2. **For the operator, blocks a GSD verb:** `.planning/WINDOWS.md`'s rendered table disagrees with its
   fenced JSON (the sole source of truth) for row ids 9 and 30, so every `gsd-tools windows` command
   refuses. The deviation below could not be appended to the ledger and lives only in this SUMMARY.
   Reconciling the two requires deciding which side is authoritative for those rows, which is not this
   plan's call — and regenerating the table would destroy whichever prose was hand-written.
3. **Carried, not new:** `orchestrators/plugin/install-outcome.ts` reads
   `branches 60/83, functions 22/27, lines 956/1031` — 75 uncovered lines across disjoint runs, with
   no single recorded reason. `D-08-A06` forbids a pin row for it and names an operator escalation if
   the owner-test work cannot finish inside the phase. This run confirms the reading; it does not
   change the disposition.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `npm run test:coverage:direct:report` works, so `D-08-08`'s second sweep (plan 08) has a working
  instrument.
- The seven shortfall modules and their exact reading strings are recorded above. Plans 02, 03, 05,
  and 07 can classify against this record instead of against `CONTRIBUTING.md`.
- `pre-commit run --all-files` is green (with the named `trufflehog` skip), so plan 09 can add the
  `npm-coverage-direct` hook and see its own result rather than someone else's failure.
- `coverage/all-pairs-report.ndjson` holds all 230 rows but is gitignored, which is why the
  classification input lives in this SUMMARY.

## Self-Check: PASSED

All three modified files, this SUMMARY, and the 230-row report exist on disk; all three task commits
(`184b0016`, `c20397c6`, `5d5c4c29`) are reachable from `git log`.

---
*Phase: 08-direct-coverage*
*Completed: 2026-09-11*
