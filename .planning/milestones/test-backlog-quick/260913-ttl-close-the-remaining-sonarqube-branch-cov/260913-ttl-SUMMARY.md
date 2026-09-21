---
quick_id: 260913-ttl
slug: close-the-remaining-sonarqube-branch-cov
date: 2026-09-13
status: complete
tasks: 3
commits: 3
branch: features/100-coverage
---

# Quick Task 260913-ttl Summary

Closed the SonarQube branch-coverage gap by retiring the one genuinely uncovered branch
and removing the two partial-surface lcov reports that were manufacturing the other ~136
conditions — no suppressions, no coverage exclusions, no `node:coverage ignore` pragmas.

## Diagnosis

The request assumed 134 untested branch conditions needing 134 new test cases. That premise
was wrong. Measured against freshly generated reports:

- The **unit suite alone** already reached 100.00% line and 99.99% branch coverage of
  `extensions/`. Exactly **one** real uncovered branch existed in the whole tree:
  `bridges/commands/discover.ts:178`, the `?? ""` arm of
  `TOLERATED_WALK_ERRNOS.has(err.code ?? "")`.
- The other ~137 conditions were **phantoms of the lcov merge**. Node's
  `--experimental-test-coverage` lcov reporter emits one `BRDA` record per *uncovered V8
  block range*, keyed by the line its start offset maps to. `integration.lcov` and
  `e2e.lcov` are partial-surface runs — they load most of the tree but execute a fraction
  of it — so an unentered function becomes one uncovered range whose start offset lands on
  the preceding doc comment, blank line, or `import` statement. Sonar merges lcov per
  `(file, line)` with a per-line maximum, so a line only one report mentions, with zero
  covered conditions, survives the merge unopposed. That is why the Sonar snapshot showed
  conditions on `import { readFile } from "node:fs/promises";` and on four lines of a doc
  comment. No test can close those; they are not branches.

The merge model was reproduced locally and matched Sonar's own numbers almost row for row
(138 vs 134 conditions, **74 vs 74 files**; `state-io.ts` 14 vs 13, `errors.ts` 13 vs 13,
`path-safety.ts` 9 vs 9, `event-router.ts` 5 vs 5). The small delta is run-to-run jitter,
which is itself the point: V8 block segmentation is not stable between runs, so a metric
built on merging it by line number is not stable either.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 1 | `d2ef20fa` | `test: reproduce the SonarQube lcov merge locally` |
| 2 | `32491371` | `refactor: narrow isErrnoException to a guaranteed code` |
| 3 | `46815bd6` | `ci: feed SonarQube only the complete coverage report` |

### Task 1 — reproducer

Added `.planning/quick/260913-ttl-close-the-remaining-sonarqube-branch-cov/lcov-sonar-conditions.mjs`,
a standalone Node ESM script that parses the lcov reports, keeps only `extensions/` records,
merges per `(file, line)` with the per-line maximum, and prints the total, the per-file
breakdown, and a per-report attribution row for every offending line. It exits non-zero when
the total is non-zero, so it doubles as a gate. It lives under `.planning/` deliberately — a
planning instrument, not product code, so no ESLint, fallow, prettier, or `test:corresponding`
gate applies to it.

Readings at Task 1: three-report merge **138 conditions across 74 files**; `unit.lcov` alone
**1 condition** (`bridges/commands/discover.ts:178`). No unit-alone gap beyond that one
branch, so no new test cases were required.

### Task 2 — retire the one real branch

`isErrnoException` in `shared/errors.ts` was narrowed from `err is NodeJS.ErrnoException` to
`err is NodeJS.ErrnoException & { code: string }` — the intersection written inline in the
signature, no exported named type (fallow would report it unused). The body was already
correct: it proves `typeof err.code === "string"` and the old signature simply threw that
proof away. With the fact stated in the type, the `?? ""` at `discover.ts:178` lost its
reason to exist and was dropped, so the call now reads `TOLERATED_WALK_ERRNOS.has(err.code)`.

This is a real fix, not a suppression: the branch disappears because the type now states a
fact the code already guaranteed. The other eight call sites of the predicate were walked by
`npm run typecheck && npm run lint` rather than edited on suspicion; none needed changes.

`scripts/test-coverage-direct.pin.json` moved in the same commit (the pin fails on an
addition, removal, swap, or changed reading): the `178 (branch 178)` entry was dropped from
the `discover.ts` row's `reasons`, keeping `288-290` and the `BC-019` finding id, and the
`reading` field was replaced with the string the gate itself reported —
`branches 55/56, lines 412/414`. The `install-outcome.ts` row did not move.

After Task 2, `unit.lcov` alone read **0 uncovered conditions**.

### Task 3 — remove the phantoms at their source

`sonar-project.properties` now reads `sonar.javascript.lcov.reportPaths=coverage/unit.lcov`,
with a long-form comment above it in the same style the file already uses for
`sonar.cpd.exclusions`. The comment states the mechanism (BRDA-per-uncovered-range keyed by
start-offset line), the merge failure mode, the measured attribution with its jitter noted,
and why nothing is lost.

`npm run test:coverage` was left alone. It still generates all three reports; the integration
and e2e ones remain useful in their own lanes, and trimming the CI job is a separate concern.

**The user approved this change (plan Change B) explicitly before Task 3 was executed.**

## Measured before / after

| Reading | Before | After |
| --- | --- | --- |
| SonarCloud line coverage | 100.0% | 100.0% (unchanged) |
| SonarCloud branch coverage | 98.6% | expected 100.0% |
| Uncovered conditions Sonar consumed | 134 across 74 files | 0 |
| Local three-report merge | 138 across 74 files | 137 across 74 files |
| Local `unit.lcov` alone | 1 condition | **0 conditions across 0 files** |
| `extensions/` lines (`unit.lcov`) | 63185/63185 = 100.00% | **63189/63189 = 100.00%** |
| `extensions/` branches (`unit.lcov`) | 9092/9093 = 99.99% | **9092/9092 = 100.00%** |

Fresh attribution of the 137 conditions the old three-report configuration would still have
produced, measured this session from the regenerated reports:

| Origin | Conditions |
| --- | --- |
| present **only** in `e2e.lcov` | 130 |
| present **only** in `integration.lcov` | 3 |
| a report disagrees with `unit.lcov` at a line unit already covers | 4 |

This matches the planning-time attribution exactly, which is the confirmation that the
diagnosis was mechanical rather than incidental.

The SonarCloud branch-coverage figure itself will only be observable on the next scan; the
local proof is that the single report Sonar now consumes contains zero uncovered conditions
and zero unhit lines over `extensions/`.

## Residue

**None.** The reproducer against the fresh `coverage/unit.lcov` reports
`TOTAL: 0 uncovered conditions across 0 files` and exits 0. No condition survived, so there
is nothing to list, and no suppression of any kind was used.

## Verification

| Command | Outcome |
| --- | --- |
| `npm run test:coverage` | exit 0 — unit 5993/5993 pass, integration 32/32 pass, e2e pass |
| `lcov-sonar-conditions.mjs coverage/unit.lcov` | `TOTAL: 0 uncovered conditions across 0 files`, exit 0 |
| `lcov-sonar-conditions.mjs` (all three) | 137 across 74 files, exit 1 — the phantoms the change removes from Sonar's input |
| `npm run typecheck`, `lint`, `lint:workflows`, `lint:workflows:negative`, `fallow` | all green |
| `npm run format:check` | **fails on `.mcp.json` only** — see deferral below |
| `npm run test:corresponding`, `test:corresponding:negative`, `test:coverage:direct:negative`, `npm test`, `npm run test:integration` | all green, run individually after `check` short-circuited |
| `SKIP=trufflehog pre-commit run --files sonar-project.properties` | all hooks Passed or Skipped, no rewrites |
| `SKIP=trufflehog pre-commit run --all-files` | one hook failed: `npm format check`, on `.mcp.json` only. Every other hook Passed or Skipped. No rewrites — `git status --porcelain` unchanged |

## Pre-existing deferral — `.mcp.json`

`npm run format:check` fails on `.mcp.json`, an **operator-owned, untracked** file already
recorded in `STATE.md` deferred items. It is not part of this task and was not touched.
Because `check` runs its members with `&&`, that failure short-circuits the chain, so the
five members after `format:check` were run individually and are all green.

To prove `.mcp.json` is the *sole* formatting failure:

```
npx prettier --check "**/*.{js,json,ts}" "scripts/**/*.mjs" \
  --ignore-path .gitignore --ignore-path .prettierignore --ignore-path <(echo ".mcp.json")
→ All matched files use Prettier code style!
```

No ignore entry was added for it and the file was not modified.

## Out of scope (per plan, unchanged)

- **Writing 134 new test cases.** 136 of them would have had nothing to assert.
- **Range-level V8 coverage merging** (`NODE_V8_COVERAGE` + `c8`/`v8-to-istanbul`). The
  technically ideal fix, but it adds a dependency, re-baselines every coverage number in the
  repo, and breaks the `test:coverage:direct` pin machinery.
- **Trimming `npm run test:coverage` or the SonarCloud CI job** to skip the now-unconsumed
  integration and e2e lcov generation. Real cleanup, separate change.
- **The other pinned unreachable branches** (`discover.ts:288-290`, `install-outcome.ts:422`,
  `install-outcome.ts:827`). All three are covered in the aggregate unit run and contribute
  nothing to the Sonar reading; `288-290` additionally still performs the narrowing that types
  the `unknown` catch binding, and removing it needs a restructure. They stay pinned.
- **`sonar.coverage.exclusions`, `sonar.cpd.exclusions` changes, and any
  `/* node:coverage ignore */` pragma.** Explicitly refused throughout.

## Deviations

None. All three tasks executed as written.

## Self-Check: PASSED

- `sonar-project.properties` present, `sonar.javascript.lcov.reportPaths=coverage/unit.lcov` — FOUND
- `.planning/quick/260913-ttl-close-the-remaining-sonarqube-branch-cov/lcov-sonar-conditions.mjs` — FOUND
- Commits `d2ef20fa`, `32491371`, `46815bd6` — all FOUND in `git log`
