---
quick_id: 260913-ttl
slug: close-the-remaining-sonarqube-branch-cov
date: 2026-09-13
status: planned
---

# Quick Task 260913-ttl

Close the remaining SonarQube branch-coverage gap to reach 100% line and 100% branch coverage.

## Recommendation

**Do it — but not the way the request assumes.** The request's premise is that 134 branch
conditions are untested and need 134 new test cases. I measured the three freshly generated lcov
reports this session. That premise is wrong.

**The unit suite alone already reaches 100.00% line and 99.99% branch coverage of
`extensions/`.** There is exactly **one** genuinely uncovered branch in the whole tree. The other
~133 Sonar conditions are an artifact of feeding SonarCloud three lcov reports whose V8 block
segmentation disagrees, then merging them by line number.

So the work is two surgical changes, not 134 tests:

1. Retire the one real branch (it is a documented compiler-forced arm, so it is retired by a
   production narrowing, not by a test).
2. Stop handing Sonar the two partial-surface reports that manufacture the phantom conditions.

Both land at 100.0% line and 100.0% branch, honestly measured, with no `sonar.coverage.exclusions`,
no `/* node:coverage ignore */`, and no code hidden from analysis.

## Problem

SonarCloud reports 100.0% line coverage and 98.6% branch coverage: 134 uncovered conditions across
74 files. The snapshot in `sonar-uncovered-branches.md` shows most of them landing on **comments,
`import` lines, and closing braces** — line 26 of `state-io.ts` is `import { readFile } from
"node:fs/promises";`, line 419-422 are four lines of a doc comment. No branch exists there.

## Verified during planning — do not re-derive

All of this was measured this session against `coverage/{unit,integration,e2e}.lcov` generated from
the tip of `features/100-coverage` (which is exactly `main`). Take it as given.

**1. The unit suite alone is already at 100%/~100%.** Parsing `DA:`/`BRDA:` records for
`extensions/**` out of `coverage/unit.lcov` only:

```
UNIT-ALONE extensions/: lines 63185/63185 = 100.00%, branches 9092/9093 = 99.99%
unit-alone uncovered branch lines: [ 'bridges/commands/discover.ts:178 0/1' ]
```

One branch. That is the entire real gap.

**2. Sonar's merge rule is reproducible, and it is a per-line max.** Taking, for each
`(file, line)`, the maximum `total` and maximum `covered` across the three reports and summing
`total - covered` yields **138 uncovered conditions across 74 files** — against Sonar's 134 across
**74** files, with the per-file counts matching the snapshot almost row for row (`state-io.ts` 14
vs 13, `errors.ts` 13 vs 13, `path-safety.ts` 9 vs 9, `event-router.ts` 5 vs 5). The small delta is
run-to-run jitter, which is itself the point: V8 block segmentation is not stable between runs, so
a metric built on merging it by line number is not stable either.

**3. The phantoms come from `e2e.lcov`, at lines no other report even mentions.** Attribution of
those 138:

| Origin | Conditions |
| --- | --- |
| present **only** in `e2e.lcov` | 130 |
| present **only** in `integration.lcov` | 3 |
| a report disagrees with `unit.lcov` on the condition count at a line unit already covers | 4 |
| other | 1 |

Worked example, `persistence/state-io.ts`:

```
  line 26:  unit=-  integration=-  e2e=0/1
  line 419: unit=-  integration=-  e2e=0/3
  line 484: unit=-  integration=-  e2e=0/1
```

`unit=-` means **no BRDA record at that line at all**. The mechanism: Node's
`--experimental-test-coverage` lcov reporter emits one BRDA record per *uncovered V8 block range*,
keyed by the line its start offset maps to. When the e2e suite loads `state-io.ts` but never calls
a given function, V8 reports that whole function as one uncovered range whose start offset lands on
the preceding doc comment or import. In the unit run the same function *is* called, so no uncovered
range exists and no record is emitted. Sonar sees a line only one report mentions, with zero
covered conditions, and has nothing to max it against.

No test can close these. They are not branches.

**4. The one real branch is a pinned, compiler-forced arm.**
`bridges/commands/discover.ts:178` is `TOLERATED_WALK_ERRNOS.has(err.code ?? "")`, and
`scripts/test-coverage-direct.pin.json` already records it under finding `BC-019`:

> `isErrnoException` (shared/errors.ts) already requires `typeof err.code === "string"`, so the
> right arm of the `??` can never be taken, while `NodeJS.ErrnoException` declares `code?: string`
> and forces it to exist.

The pin also notes retiring it "widens the blast radius to every consumer of that predicate." There
are **nine** call sites, listed in Task 2. The widening is a *narrowing* of a type predicate, so
every consumer still type-checks; the risk is `no-unnecessary-condition` firing on a consumer whose
own `code === undefined` guard becomes redundant. That is a typecheck/lint finding, discoverable in
one command, not a research project.

**5. `unit.lcov` is complete over the analyzed surface.** It carries 227 of the 234 `.ts` files
under `extensions/`. The seven absentees are all `types.ts` — type-only modules that emit no JS, so
they appear in *no* coverage report and carry no executable lines. Dropping the other two reports
cannot lower line coverage.

## The two changes

### Change A — retire the one real branch

Tighten `isErrnoException`'s return type from `err is NodeJS.ErrnoException` to
`err is NodeJS.ErrnoException & { code: string }`. That is what the function body already proves
(`typeof (err as { code?: unknown }).code === "string"`); the current signature simply throws the
proof away. Then `err.code ?? ""` at `discover.ts:178` loses its reason to exist and the arm goes
with it.

This is a real fix, not a suppression: the branch disappears because the type now states a fact the
code already guaranteed.

### Change B — stop merging incompatible reports

`sonar-project.properties` currently reads:

```
sonar.javascript.lcov.reportPaths=coverage/unit.lcov,coverage/integration.lcov,coverage/e2e.lcov
```

`integration.lcov` and `e2e.lcov` are **partial-surface** reports. They exercise a fraction of the
tree, so nearly every one of their BRDA records is an uncovered-range artifact at a line the
complete report does not share. Line-keyed merging of independently-segmented V8 block coverage is
not a defined operation; the only sound merge is at the range level, which the lcov format has
already discarded by the time Sonar reads it.

Feed Sonar the one report whose segmentation is coherent and whose surface is complete:

```
sonar.javascript.lcov.reportPaths=coverage/unit.lcov
```

Measured consequence: uncovered conditions drop from 138 to **1** (`discover.ts:178`), which
Change A then retires — **0**. Line coverage stays 63185/63185.

This is not a coverage exclusion. No file, line, or rule is hidden from analysis;
`sonar.sources` is untouched and every source file is still measured. What is removed is a
*measurement input that manufactures conditions which do not exist in the source*.

**If the reviewer rejects Change B on principle**, the only other honest fix is to collect raw V8
coverage from all three suites into one `NODE_V8_COVERAGE` directory and emit a single lcov from
the union (a range-level merge). That needs a new converter dependency (`c8` or `v8-to-istanbul`),
re-baselines every coverage number in the repo, and would break the `test:coverage:direct` pin
machinery. It is the gold-plated version of the same answer and is out of scope here.

## Tasks

Three tasks, each independently executable and committable from a fresh context.

### Task 1 — Build the local Sonar-merge reproducer and confirm the diagnosis

**files:** `.planning/quick/260913-ttl-close-the-remaining-sonarqube-branch-cov/lcov-sonar-conditions.mjs` (new)

**action:**

Generate fresh reports first if `coverage/{unit,integration,e2e}.lcov` are absent or stale:
`npm run test:coverage`. It is slow; reuse what is on disk if it is from this branch tip.

Write a standalone Node ESM script at the path above. It lives under `.planning/` deliberately: it
is a planning instrument, not product code, so no ESLint, fallow, prettier, or `test:corresponding`
gate applies to it. Do **not** put it under `scripts/`, `extensions/`, or `tests/`.

It takes zero required arguments and reads the three reports from `coverage/`, accepting an
optional list of report paths so it can be pointed at a subset. For each report it parses the lcov
blocks (`SF:` … `end_of_record`), keeping only records whose `SF:` starts with `extensions/`, and
builds, per file and per line, the count of `BRDA:` records and how many have a non-zero, non-`-`
take. It then merges across reports with the per-line maximum of both counts — this is the model
verified above against Sonar's own numbers. It prints: the total uncovered conditions, the file
count, a per-file breakdown with each offending line as `line:covered/total`, and for every
offending line a per-report attribution row (`unit=covered/total`, `-` when the report has no
record at that line). It exits non-zero when the total is non-zero, so Task 3 can use it as a gate.
Keep it under 120 lines.

Then run it two ways and confirm the diagnosis holds at execution time:

- all three reports — expect a total near 138 across 74 files, with the `-` attribution pattern on
  the comment and import lines;
- `coverage/unit.lcov` alone — expect a total of **1**, namely `bridges/commands/discover.ts:178`.

**MUTABLE-SCOPE AUTHORITY.** The fresh local lcov is the worklist, not the snapshot in
`sonar-uncovered-branches.md`. If the unit-alone run reports **more** than that one branch, those
extras are genuine coverage gaps: record them in the commit message and close each with a real test
case appended to the existing paired test file (`tests/<mirrored path>.test.ts`), matching that
file's local structure, naming, and assertion idioms, per
`.agents/skills/typescript-unit-testing-review/SKILL.md`. Do not create new test files and do not
test a module from another module's test.

Commit the script with the planning artifacts.

**verify:**

```
node .planning/quick/260913-ttl-close-the-remaining-sonarqube-branch-cov/lcov-sonar-conditions.mjs
node .planning/quick/260913-ttl-close-the-remaining-sonarqube-branch-cov/lcov-sonar-conditions.mjs coverage/unit.lcov
```

The first prints a three-digit total with per-report attribution showing `unit=-` on the comment
and import lines. The second prints `1` and names `bridges/commands/discover.ts:178`.

**done:** The reproducer is committed and runnable, both readings are recorded in the commit
message, and any unit-alone gap beyond `discover.ts:178` is either closed with a test or written
down.

### Task 2 — Retire the one genuinely uncovered branch

**files:**
`extensions/pi-claude-marketplace/shared/errors.ts`,
`extensions/pi-claude-marketplace/bridges/commands/discover.ts`,
`scripts/test-coverage-direct.pin.json`,
`tests/shared/errors.test.ts`,
`tests/bridges/commands/discover.test.ts`
(the last two only if the change moves what they assert)

**action:**

In `shared/errors.ts:15`, change `isErrnoException`'s return type to
`err is NodeJS.ErrnoException & { code: string }`. Write the intersection inline in the signature —
do not introduce an exported named type, which fallow would report as an unused type. The body is
already correct and does not change. No `!` and no `as` narrowing anywhere: neither is available in
`extensions/`.

In `bridges/commands/discover.ts:178`, drop the now-redundant `?? ""` so the call reads
`TOLERATED_WALK_ERRNOS.has(err.code)`.

Then walk the other eight call sites, because a narrowed predicate can make a downstream guard
redundant and `@typescript-eslint/no-unnecessary-condition` (active under `strictTypeChecked`) will
say so:
`bridges/commands/stage.ts:157`, `orchestrators/marketplace/shared.ts:637`,
`orchestrators/plugin/enable-disable.messaging.ts:182,187,204`,
`orchestrators/plugin/info.ts:632`, `orchestrators/plugin/uninstall.ts:207`.
Let `npm run typecheck && npm run lint` find them rather than editing on suspicion; fix only what
those two commands report, and fix it by deleting the redundancy, never by re-widening the type.

Update `scripts/test-coverage-direct.pin.json`. The pin fails on an addition, a removal, a swap, or
a changed reading, so it must move in this same commit. Drop the `178 (branch 178)` entry from the
`discover.ts` row's `reasons` array, keeping the `288-290` entry and the `BC-019` finding id. For
the `reading` field, **run the gate and paste the string it reports** — do not compute or guess it:

```
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/discover.ts
```

If the `install-outcome.ts` row's reading also moved, that is a surprise; stop and report it rather
than editing it to match.

If either paired test asserts the old signature or the `?? ""` behavior, update it in place in the
existing file. Any new case gets `// arrange` / `// act` / `// assert` phase comments, a title
stating public behavior, whole-value `assert.deepStrictEqual()` where a whole value is the promise,
and errors asserted by class and structured field — never by message substring. Cite a durable
spec ID (`BC-019`) in the title only if neighboring titles in that file already cite IDs.

**verify:**

```
npm run typecheck && npm run lint && npm run fallow && npm run format:check
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/discover.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/errors.ts
npm run test:corresponding && npm run test:coverage:direct:negative
node --test tests/bridges/commands/discover.test.ts tests/shared/errors.test.ts
npm run test:coverage:unit
node .planning/quick/260913-ttl-close-the-remaining-sonarqube-branch-cov/lcov-sonar-conditions.mjs coverage/unit.lcov
```

All green, and the last command reports **0 uncovered conditions**.

**done:** `isErrnoException` states the fact its body proves, `discover.ts:178` has no `??` arm, the
pin records the newly measured reading with the `178` reason removed, every consumer type-checks
and lints clean, and the unit-alone reading is 0 uncovered conditions.

### Task 3 — Remove the phantom conditions at their source and prove the result

**files:** `sonar-project.properties`

**action:**

Set `sonar.javascript.lcov.reportPaths=coverage/unit.lcov`.

Above the line, add a comment in the style this file already uses for `sonar.cpd.exclusions` —
long-form, stating the reasoning rather than the change. It must say: `integration.lcov` and
`e2e.lcov` are partial-surface reports; Node's `--experimental-test-coverage` lcov reporter emits
one BRDA record per uncovered V8 block range, keyed by the line its start offset maps to, so a
module a run loads but barely executes produces records on doc comments and imports; merging those
by line number against a complete report manufactures conditions that do not exist in the source;
the measured effect was ~130 of ~138 phantom conditions originating in `e2e.lcov` alone at lines no
other report mentions; `unit.lcov` is complete over the analyzed surface (227 of 234 files, the
seven absentees being type-only `types.ts` modules that emit no JS anywhere), so nothing is lost.
State the count as measured, with the run-to-run jitter noted — do not present it as exact.

Leave `npm run test:coverage` alone. It still generates all three reports; they remain useful
locally and in the `test:e2e`/`test:integration` lanes, and trimming the CI job is a separate
concern.

Then run the full proof.

**verify:**

```
npm run test:coverage
node .planning/quick/260913-ttl-close-the-remaining-sonarqube-branch-cov/lcov-sonar-conditions.mjs coverage/unit.lcov
npm run check
SKIP=trufflehog pre-commit run --all-files
git status --porcelain
```

- The reproducer against `coverage/unit.lcov` reports **0 uncovered conditions across 0 files** and
  exits 0.
- `npm run check` is green end to end (typecheck, lint, workflow lints, fallow dead-code/health/
  dupes, format:check, `test:corresponding` both arms, `test:coverage:direct:negative`, full unit
  suite, integration suite).
- `pre-commit run --all-files` is clean. It **writes** — re-check `git status` after it, restage,
  and re-run until clean. Never `--no-verify`.

Also record, from the same `npm run test:coverage` output, the unit-alone `DA:` totals for
`extensions/**` as the line-coverage proof (expect 63185/63185, or whatever the tree measures at
that point — the bar is *all* lines hit, not the specific figure).

**If any condition survives**, do not drop it silently and do not reach for
`sonar.coverage.exclusions` or a `node:coverage ignore` pragma. Write the residue into the task
SUMMARY as an explicit list — file, line, source text, per-report attribution, and why it could not
be closed — and surface it in the return.

**done:** `sonar-project.properties` names one report path with the reasoning recorded beside it,
the local reproducer proves 0 uncovered conditions and 100% line coverage, `npm run check` and
`pre-commit run --all-files` are green, and any residue is written down rather than hidden.

## Commit discipline

Applies to every task.

- One atomic commit per task, Conventional Commits, title 5-72 chars, body lines ≤ 80. No GSD
  milestone or phase references.
- `pre-commit run --files <changed files>` **before** `git commit`, fixing and restaging until
  clean. No hook is installed locally, so it does not run itself. Never `--no-verify`.
- Stage explicit paths. Never `git add -A`: the operator edits files in this same checkout
  concurrently.
- We are on `features/100-coverage`. Never commit to `main`. Never rebase.
- Suggested titles: `test: reproduce the SonarQube lcov merge locally`,
  `refactor: narrow isErrnoException to a guaranteed code`,
  `ci: feed SonarQube only the complete coverage report`.

## Out of scope

- **Writing 134 new test cases.** Measured this session: 133 of them would have nothing to assert.
- **Range-level V8 coverage merging** (`NODE_V8_COVERAGE` + `c8`/`v8-to-istanbul`). The
  technically ideal fix, but it adds a dependency, re-baselines every coverage number, and breaks
  the `test:coverage:direct` pin machinery.
- **Trimming `npm run test:coverage` or the SonarCloud CI job** to skip the now-unconsumed
  integration and e2e lcov generation. Real cleanup, separate change.
- **The other pinned unreachable branches** (`discover.ts:288-290`,
  `install-outcome.ts:422`, `install-outcome.ts:827`). All three are covered in the aggregate unit
  run and so contribute nothing to the Sonar reading; `288-290` additionally still performs the
  narrowing that types the `unknown` catch binding, and removing it needs a restructure. They stay
  pinned.
- **`sonar.coverage.exclusions`, `sonar.cpd.exclusions` changes, and any
  `/* node:coverage ignore */` pragma.** Explicitly refused. The goal is a real reading.
