---
phase: 07-gate-integrity
plan: 15
subsystem: architecture-gates
tags: [unowned-exports, fallow, pinned-census, ggat-04, d-07-19, d-07-17]
status: complete

requires:
  - phase: 07-gate-integrity
    provides: "tests/architecture/gate-targets.ts — the literal target registry (07-01)"
  - phase: 07-gate-integrity
    provides: "the registry meta-gate that stats every array-valued export (07-01)"
  - phase: 07-gate-integrity
    provides: "the closed findings 07-01, 07-07, 07-08, 07-09 and 07-11 established, which this plan records with fresh evidence"
provides:
  - "MARKETPLACE_VALIDATOR and surfacePostCommitWarnings are module-private, with both owner tests complete through the public surface"
  - "UNOWNED_EXPORT_CENSUS — the 100-entry production-unowned-export pin, keyed by publishing file"
  - "tests/architecture/unowned-exports-census.test.ts — deep-equality census gate plus the entry-point blind-spot control"
  - "a gated dispositions record for every finding routed to this phase"
  - "orchestrators/reconcile/apply.ts reaches complete direct coverage for the first time since its split"
affects: [07-16, gate-integrity, dead-code-analysis]

actuals:
  tokens: 57000
  tasks: 3
  commits: 3
  plan_head_before: 8b8ce2e2efd0969f3a1131436aae5368e71fe98e
  commits_note: >-
    `git rev-list --count 8b8ce2e2..HEAD` returns 3 at SUMMARY-write time —
    188da750, 504194a7, f2561477 — one per task. The SUMMARY commit follows and
    is not in that count. `tokens` is chars/4 over the seven files this plan
    changed (228238 chars), on the same scale the plan's 105000 estimate used.

tech-stack:
  added: []
  patterns:
    - "A pinned SET compared with deepStrictEqual, not a length pin: an equal-length swap must fail, and it was planted to prove it does"
    - "The pin is committed data and the gate re-measures — the gate never generates the value it compares against"
    - "A benign control taken from the same tool one flag apart, so the control measures the blind spot rather than merely passing"
    - "A record of already-closed findings is itself gated, because an ungated record drifts out of step with its ledger exactly as a stale gate does"

key-files:
  created:
    - tests/architecture/unowned-exports-census.test.ts
    - .planning/phases/07-gate-integrity/07-FINDING-DISPOSITIONS.md
  modified:
    - extensions/pi-claude-marketplace/domain/manifest.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/domain/manifest.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/architecture/gate-targets.ts

key-decisions:
  - "The census is a path-keyed record, not a sorted array of {path, exportName} objects. The registry meta-gate treats EVERY array-valued export of gate-targets.ts as a list of paths that must stat, so an array of objects fails it with 100 `[object Object]` rows. Keying by path keeps every path a bare string literal — which is what the literal-match scan over the registry needs — and moves the ordering obligation onto the per-file name arrays, where deep equality still enforces it."
  - "The pin was verified by an independently-written import-graph instrument, not transcribed from the tool that the gate runs. All 11 apparent disagreements were explained and none was a real one."
  - "The pre-existing apply.ts coverage gap was closed rather than recorded. The plan's own acceptance criterion demands exit 0 from the direct-coverage run, and that run was already red at wave start."
  - "The three direct-call `surfacePostCommitWarnings` cases were deleted outright, not rewritten. Measurement showed the public reconcile path already covers every branch of the helper, so rewriting them would have added redundant cases rather than replacing lost coverage."

patterns-established:
  - "Pattern: prove a deep-equality pin with THREE controls — an addition, a removal, and an equal-length swap. The swap is the one a length pin absorbs, so it is the one that justifies the shape."
  - "Pattern: when an owner test reaches a symbol you are unexporting, delete the direct cases and MEASURE what coverage was lost before writing replacements. Replacements written on assumption are redundancy, not coverage."

requirements-completed: [GGAT-04]

coverage:
  - id: D1
    description: "MARKETPLACE_VALIDATOR and surfacePostCommitWarnings are module-private, and both owner tests reach complete coverage through their module's public surface"
    requirement: GGAT-04
    verification:
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest.ts → exit 0 (branches 10/10, functions 3/3, lines 100/100)"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts → exit 0 (branches 119/119, functions 23/23, lines 961/961)"
        status: pass
      - kind: command
        ref: "grep -c 'export const MARKETPLACE_VALIDATOR' … → 0; grep -c 'export function surfacePostCommitWarnings' … → 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The production-unowned-export census is pinned as a set and fails on an addition, a removal, and an equal-length swap"
    requirement: GGAT-04
    verification:
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#D-07-19 / GGAT-04: the production-unowned-export census equals its committed pin"
        status: pass
      - kind: other
        ref: "control 1 (addition): `export const CENSUS_DRIFT_PROBE` appended to shared/markers.ts → gate failed naming shared/markers.ts#CENSUS_DRIFT_PROBE; reverted"
        status: pass
      - kind: other
        ref: "control 2 (removal): the shared/markers.ts pin row deleted → gate failed naming shared/markers.ts#STATE_LOCK_HELD_PREFIX; restored"
        status: pass
      - kind: other
        ref: "control 3 (equal-length swap): the pinned name renamed to STATE_LOCK_RENAMED_PREFIX, 100 entries either side → gate failed naming one appeared and one vanished; restored"
        status: pass
    human_judgment: false
  - id: D3
    description: "The census is measured by a per-invocation flag with the repository's Fallow configuration untouched, and the benign control shows the blind spot it isolates"
    requirement: GGAT-04
    verification:
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#D-07-20: the same question over the committed entry points reports nothing, which is the blind spot"
        status: pass
      - kind: command
        ref: "git diff --exit-code .fallowrc.json → exit 0"
        status: pass
      - kind: command
        ref: "measured entry points: 582 committed vs 9 production (1 manual + 8 package.json)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every finding routed to this phase has a recorded disposition backed by a command run this cycle, and the record itself is gated"
    requirement: GGAT-04
    verification:
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#D-07-17: the dispositions record answers for every routed finding"
        status: pass
      - kind: other
        ref: "control 4: HHD-028 renamed out of the record → the clause failed naming HHD-028; restored"
        status: pass
    human_judgment: false

duration: 1h 5m
completed: 2026-09-10
---

# Phase 7 Plan 15: Unowned-Export Census Summary

Two exports whose only readers were tests became module-private with their owner
suites complete through the public surface, and the whole class is now held by a
100-entry pinned census that fails on an addition, a removal, and an equal-length
swap.

## What shipped

**The two named instances are closed.** `MARKETPLACE_VALIDATOR`
(`domain/manifest.ts:40`) and `surfacePostCommitWarnings`
(`orchestrators/reconcile/apply.ts:921`) lost their `export` keyword. Neither
declaration moved and neither behaves differently — this was a visibility change,
not a refactor. `DCORE-030` and `ORA-F32`'s instance are one defect with two
occurrences, and both closed in the same commit.

**The class is pinned, not remediated.** `UNOWNED_EXPORT_CENSUS` in
`tests/architecture/gate-targets.ts` records all 100 exports that no production
consumer reads, keyed by the file that publishes them, with each file's names
sorted. `tests/architecture/unowned-exports-census.test.ts` re-measures the same
question with a fixed argument vector and compares for exact equality.

**The dispositions record is gated.** Every finding routed to this phase now has
a row in `07-FINDING-DISPOSITIONS.md` carrying its status at phase start, its
status now, the plan that closed it, and a command run this cycle. A third case
in the census gate fails when the record drops a finding.

## The census: 102 → 100, fully attributed

Measured at wave start and again after Task 1, with
`fallow dead-code --production --unused-exports --format json`:

| | total | `extensions/` | `scripts/` |
| --- | --- | --- | --- |
| Research baseline | 102 | 91 | 11 |
| Measured at plan start | 102 | 91 | 11 |
| Measured after Task 1 | **100** | **89** | 11 |

The arc is exactly the forecast 102 → 100, and the two removed entries are the
two this plan closed:

```
MARKETPLACE_VALIDATOR present: false
surfacePostCommitWarnings present: false
```

**No unattributed delta.** The total was unchanged from research's baseline at
plan start, so nothing from waves 1–4 needed reconciling. The line-number shifts
recorded at the wave boundary (`reinstall-replace.ts` ×4 from `07-10`,
`reinstall-flow.ts` from `07-10` + `07-12`, `fetch.ts` from `07-11`'s static
import, `shared/markers.ts` from `07-11`'s comment repair) are position changes
inside the same set, not membership changes, and the pin stores no line numbers
so none of them can reach it.

### The pin is independently authored, not the tool comparing itself

The self-referential-pin hazard has hit four times in this phase, and this plan
is the most exposed to it. Two things keep the pin honest:

1. **The gate never generates the value it compares against.** The pin is a
   committed literal in `gate-targets.ts`; the gate re-measures the tree and
   compares the measurement to that frozen literal. Nothing in the gate reads the
   analyzer twice and compares the two results.
2. **Every entry was verified with a second, hand-written instrument.** A
   from-scratch import-graph walk over `extensions/**` and `scripts/**` parsed
   every `import`/`export … from` clause and asked, per entry, whether any other
   production file names that export. It flagged 11 apparent disagreements, and
   every one was explained rather than waved through:

| Apparent disagreement | Explanation |
| --- | --- |
| `marker.ts#GENERATED_AGENT_MARKER_LEGACY`, `mcp/parse.ts#resolvePluginMcpServers`, `hooks/schema.ts#HOOKS_CONFIG_SCHEMA` | The importer is a barrel whose own re-export is itself a census member. The whole chain is unread by production; the analyzer is right and the naive instrument counts a dead link as a consumer. |
| `platform/git.ts#listBranches`, `#listRemotes`, `#buildAuthCallbacks` | `orchestrators/marketplace/shared.ts:37` does `import * as defaultGit` but accesses only seven members (`clone`, `fetch`, `forceUpdateRef`, `checkout`, `resolveRef`, `currentBranch`, `resolveRemoteRef`). These three are not among them. |
| five `scripts/revalidation.mjs` exports | The only importer is `revalidation.negative.mjs`, which is not a production entry point, so its imports do not confer ownership. |

**This corrects a belief carried into the wave.** A namespace import does *not*
blanket-satisfy the analyzer for every export of the imported module — member
access through a namespace import is tracked individually. The `platform/git.ts`
rows are the counter-example, and the correction is recorded in
`07-FINDING-DISPOSITIONS.md` so it does not have to be rediscovered.

## Both directions observed, and the swap too

The plan asked for two controls. Three were run, because the third is the one
that justifies the shape.

**Control 1 — an addition.** `export const CENSUS_DRIFT_PROBE = "probe";`
appended to `shared/markers.ts`:

```
D-07-19: the production-unowned-export census no longer matches UNOWNED_EXPORT_CENSUS
  now unowned but not pinned (1): extensions/pi-claude-marketplace/shared/markers.ts#CENSUS_DRIFT_PROBE
  pinned but no longer unowned (0): none
```

**Control 2 — a removal.** The `shared/markers.ts` row deleted from the pin:

```
  now unowned but not pinned (1): extensions/pi-claude-marketplace/shared/markers.ts#STATE_LOCK_HELD_PREFIX
  pinned but no longer unowned (0): none
```

**Control 3 — an equal-length swap.** The pinned export name changed to
`STATE_LOCK_RENAMED_PREFIX`, so the pin and the measurement both hold 100
entries and a length assertion would see nothing:

```
  now unowned but not pinned (1): extensions/pi-claude-marketplace/shared/markers.ts#STATE_LOCK_HELD_PREFIX
  pinned but no longer unowned (1): extensions/pi-claude-marketplace/shared/markers.ts#STATE_LOCK_RENAMED_PREFIX
```

**Control 4 — the dispositions record drops a finding.** `HHD-028` renamed out
of the record:

```
D-07-17: .planning/phases/07-gate-integrity/07-FINDING-DISPOSITIONS.md names no
disposition for HHD-028. A finding routed here is answered with a status and a
command run this cycle, or it is not answered at all …
```

Every control was reverted and the gate re-run green afterwards.

## The benign control the tool gives for free

The same command without `--production`, over the same tree, reports nothing:

| | exit | entry points | findings |
| --- | --- | --- | --- |
| `dead-code --production --unused-exports` | 1 | 9 (1 manual + 8 `package.json`) | 100 |
| `dead-code --unused-exports` | 0 | 582 | 0 |

That difference IS the blind spot `DCORE-030` and `ORA-F32` describe: under the
committed configuration every test file is an entry point, so a test import
counts as a consumer and an export read only by its own test looks alive. The
gate asserts both halves — the clean control report and the strict inequality
between the two entry-point counts — so the contrast cannot quietly disappear.

`.fallowrc.json` is byte-identical: `git diff --exit-code .fallowrc.json` exits
0, and no `fallow-ignore` marker was added anywhere.

## Coverage after the two removals

Neither owner suite lost an assertion.

| Module | Before | After |
| --- | --- | --- |
| `domain/manifest.ts` | 100% (branches 9/9, functions 3/3, lines 100/100) | 100% (branches **10/10**, functions 3/3, lines 100/100) |
| `orchestrators/reconcile/apply.ts` | **branches 118/119, lines 959/961** — exit 1 | 100% (branches 119/119, functions 23/23, lines 961/961) — exit 0 |

| Suite | Runtime cases | `assert.` calls |
| --- | --- | --- |
| `tests/domain/manifest.test.ts` | 21 → 21 | 30 → 30 |
| `tests/orchestrators/reconcile/apply.test.ts` | 52 → 50 | 191 → 191 |

**`manifest.test.ts`.** The 15 direct `MARKETPLACE_VALIDATOR.Check` cases became
15 cases driving `loadMarketplaceManifest` against a manifest written to a
case-owned directory. They got *stronger*: the 12 rejection rows previously
asserted only `Check() === false`, and each now pins the exact defect the loader
reports (`/plugins/0: must have required properties source`,
`/owner/name: must be string`, and so on), which is why the branch count rose from
9 to 10 — the `error.instancePath || "<root>"` fallback is now exercised both
ways.

**`apply.test.ts`.** The three direct `surfacePostCommitWarnings` cases were
deleted rather than rewritten, because measurement said rewriting them would add
redundancy rather than replace coverage. With the block deleted and nothing else
changed, `apply.ts` measured branches 118/119 and lines 959/961 — **byte-identical
to the reading before the deletion.** The public reconcile path already drives
the singular header (`:1756`), the plural header (`:1926`), the `plugin-disabled`
arm (`:2963`), and the `lines.length === 0` silence, all through real installs.
Path redaction has no branch inside the helper; it belongs to
`shared/redact-absolute-paths.ts`, which has its own owner.

**No branch was found unreachable through a public surface.** No coverage
directive was added:
`git grep -ci -e "coverage-ignore" -e "istanbul ignore" -e "c8 ignore" -- extensions tests`
prints nothing.

## Deviations from Plan

### 1. [Rule 3 — Blocker] The `apply.ts` direct-coverage run was already red

- **Found during:** Task 1, measuring the baseline before touching anything.
- **Issue:** `npm run test:coverage:direct -- …/reconcile/apply.ts` exited **1**
  at wave start with lines 363–364 uncovered — the `WR-06` converged-uninstall
  `continue`. `git log` puts the gap in phase 06's split
  (`8394ba21 refactor(06-36)`), not in this phase. The plan's acceptance
  criterion requires exit 0, so this blocked the task.
- **Fix:** Added one case driving the converge through the public surface. It
  uses the suite's existing `applyAfterSelectedStateRace` helper: the injected
  reader hands the planner a snapshot containing a recorded plugin and then
  writes a competing state without it, so `uninstallPlugin`'s locked re-read finds
  nothing and returns `converged`. That is the exact race the `WR-06` comment
  describes, and the reconcile stays silent because no outcome accumulates.
- **Files modified:** `tests/orchestrators/reconcile/apply.test.ts`
- **Verification:** branches 119/119, functions 23/23, lines 961/961, exit 0.
- **Commit:** `188da750`

### 2. [Recorded, not fixed] `git grep -c "MARKETPLACE_VALIDATOR" tests/` is not 0

- **Found during:** Task 1 acceptance checks.
- **Issue:** The criterion asks for zero. Zero *code* references remain — the
  import is gone and no test calls the symbol. Four **prose** references survive
  in files this plan does not own:
  `tests/orchestrators/marketplace/_fixtures/README.md:7`,
  `tests/orchestrators/marketplace/update.test.ts:1266`,
  `tests/orchestrators/plugin/list-flow.test.ts:2933`, and four comment lines in
  `tests/orchestrators/plugin/update-flow.test.ts`.
- **Why not fixed:** Editing four undeclared test files would breach this wave's
  "commit only your plan's declared files" instruction. The comments are also not
  stale — `MARKETPLACE_VALIDATOR` still exists inside `domain/manifest.ts` and
  still validates what they say it validates; only its visibility changed.
- **Suggested follow-up:** a later plan can rephrase them to name
  `loadMarketplaceManifest`'s schema validation instead. Low value, zero risk.
- **`surfacePostCommitWarnings` has no such residue:**
  `git grep -c "surfacePostCommitWarnings" tests/` → 0.

### 3. [Rule 3 — Blocker] The census had to be a keyed record, not a sorted array

- **Found during:** Task 3, running `tests/architecture/gate-targets.test.ts`.
- **Issue:** The registry meta-gate collects **every array-valued export** of
  `gate-targets.ts` and `stat`s each entry as a repo-relative path. A sorted
  `readonly UnownedExport[]` of `{path, exportName}` objects therefore failed it
  with 100 `UNOWNED_EXPORT_CENSUS: [object Object]` unresolved rows.
- **Fix:** The census is a `Readonly<Record<string, readonly string[]>>` keyed by
  publishing file, with each file's export names sorted. Every path stays a bare
  string literal, which is what the literal-match scan over the registry needs,
  and the deterministic-order obligation moves onto the per-file name arrays where
  `deepStrictEqual` still enforces it. The alternative — teaching the meta-gate to
  skip non-string arrays — would have meant editing `gate-targets.test.ts`, which
  this plan does not declare.
- **Consequence to note:** census paths are not covered by the meta-gate's
  resolution clause, because that clause only reaches array-valued exports. The
  census gate's own deep comparison covers them instead: a path that stopped
  existing would stop being reported by the analyzer and fail as a removal.
- **Commit:** `f2561477`

### 4. [Recorded] The plan's `npm run check` fail condition is unmeetable as written

- **Issue:** Task 3's `<fails_when>` says "any fallow sub-run prints a line
  starting with `✗`". `fallow dupes` prints
  `✗ 879 lines (1.1%) duplicated across 38 files` as its **summary** line and
  exits **0**; the glyph is a report marker, not a failure marker. This is
  pre-existing repository state and unrelated to anything here.
- **Resolution:** treated the exit code as the signal. `npm run check` exits 0,
  and `npx fallow dupes --fail-on-issues` exits 0.

**Total deviations:** 2 auto-fixed (Rule 3), 2 recorded without action.
**Impact:** the two Rule 3 fixes each unblocked an acceptance criterion the plan
states; neither changed production behaviour. `apply.ts` reaching complete direct
coverage is a net improvement the plan did not ask for and the tree needed.

## Findings recorded, not re-fixed

`D-07-17` allows a finding closed by earlier work to be recorded rather than
re-fixed — but only against evidence measured this cycle. All three were
re-measured:

- **`OPLU-B-F15` — closed.** `git grep -c "resetCompletionCache" -- extensions tests`
  returns no matching lines; `shared/completion-cache.ts:374` exports
  `createCompletionCache()`, which owns its plugin-index memory privately.
- **`SHC-F046` — closed, residue pinned.** The three named test-owned exports went
  with `resetCompletionCache`. The two remaining typebox schema constants are
  census members at `gate-targets.ts:801` and `:805` — pinned, not excused.
- **`OPLU-A-F07` — closed, residue named.** `availableRowMessage` has a real
  production consumer (`list-flow.ts:69` imports it, `:366` calls it). Its
  `CandidateRow` residue is an unowned **type** export, and
  `--unused-exports` selects one issue class: the same run with every class
  enabled reports `unused_exports 100 · unused_types 11 · unused_files 3 ·
  unused_class_members 1 · duplicate_exports 4`. The pin holds the 100 value
  exports; the eleven type exports are outside its scope. That boundary is named
  in the dispositions record rather than left to be discovered.

**`GGAT-03`'s Fallow half** is recorded as no action with the measurement behind
it: `git grep -rln 'readFile(.*fallowrc\|\.fallowrc\.json"' -- tests scripts`
returns no matching lines. No gate reads `.fallowrc.json`; the one Fallow-facing
gate reads the npm script string with a token allow-list
(`import-boundaries.test.ts:166-180`), which has no first-match weakness to
close. Adding a Fallow-config gate would be a new gate for a claim with no
terminal finding, which `D-22` forbids.

**`ORA-F32`'s split disposition** is recorded explicitly: the finding keeps its
deferred-backlog identity while its instance closed here, so a reader who meets
it on the backlog later knows the instance is gone without concluding it was
mis-triaged.

## Carried forward

- `07-11` recorded — and deliberately did not act on — the observation that the
  three agents-bridge marker pins retained in
  `tests/architecture/markers-snapshot.test.ts` are the same duplication class
  `SHC-F047` describes, one module over. Dropping three user-contract pins is an
  operator decision. It is repeated in `07-FINDING-DISPOSITIONS.md` so it stays
  visible after that summary scrolls out of view.
- `tests/architecture/gate-targets.ts` gained exactly two groups beyond the
  census — `EVIDENCE_RECORD_TARGETS` and its `FINDING_DISPOSITIONS_REL` alias —
  both required by this plan's own gate. No registry additions deferred by
  earlier plans were adopted; those belong to `07-16`.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | **exit 0** (typecheck, lint, fallow, format, both correspondence gates, the direct-coverage negative gate, unit suite, integration suite) |
| `npm run test:coverage:direct -- …/domain/manifest.ts` | exit 0 — branches 10/10, functions 3/3, lines 100/100 |
| `npm run test:coverage:direct -- …/reconcile/apply.ts` | exit 0 — branches 119/119, functions 23/23, lines 961/961 |
| `node --test tests/architecture/unowned-exports-census.test.ts` | 3 pass, 0 fail |
| `node --test tests/architecture/gate-targets.test.ts` | 6 pass, 0 fail |
| `node --test tests/domain/manifest.test.ts` | 21 pass, 0 fail |
| `node --test tests/orchestrators/reconcile/apply.test.ts` | 50 pass, 0 fail |
| `git diff --exit-code .fallowrc.json` | exit 0 |
| `grep -c '\.length ===' tests/architecture/unowned-exports-census.test.ts` | 0 |
| `grep -c 'deepEqual\|deepStrictEqual' …census.test.ts` | 2 (before the dispositions clause; 3 in the shipped file) |
| `grep -c 'shell: true\|execSync(' …census.test.ts` | 0 |
| `git grep -ci -e coverage-ignore -e "istanbul ignore" -e "c8 ignore" -- extensions tests` | no output |
| `SKIP=trufflehog pre-commit run --files …` | clean before each of the three commits |

## Task Commits

| Task | Commit | Files |
| --- | --- | --- |
| 1 — unexport the two named instances | `188da750` | `domain/manifest.ts`, `orchestrators/reconcile/apply.ts`, `tests/domain/manifest.test.ts`, `tests/orchestrators/reconcile/apply.test.ts` |
| 2 — measure and pin the census | `504194a7` | `tests/architecture/gate-targets.ts`, `tests/architecture/unowned-exports-census.test.ts` |
| 3 — record every routed disposition | `f2561477` | `tests/architecture/gate-targets.ts`, `tests/architecture/unowned-exports-census.test.ts`, `.planning/phases/07-gate-integrity/07-FINDING-DISPOSITIONS.md` |

## Next

Ready for `07-16`, the last plan in the phase. It owns the self-hosting registry
meta-gate, and two things here bear on it: the census is already in
`gate-targets.ts` so it will not read as an off-registry list of production
paths, and the meta-gate's existing resolution clause only reaches array-valued
exports — worth knowing before it grows a scan that assumes otherwise.

## Self-Check: PASSED

All created files exist on disk (`tests/architecture/unowned-exports-census.test.ts`,
`07-FINDING-DISPOSITIONS.md`, this summary). All four commits resolve
(`188da750`, `504194a7`, `f2561477`, `7b0f5a34`). `.fallowrc.json` is unchanged
and `git diff 8b8ce2e2..HEAD -- .planning/STATE.md .planning/ROADMAP.md` lists no
files, so neither state document was touched.
