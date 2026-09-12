---
gsd_state_version: "1.0"
milestone: refine-unit-tests
milestone_name: Refine Unit Tests
current_phase: 09
current_phase_name: Final Quality and Backlog Closure
status: phase_complete
stopped_at: Window ledger disposed (0 open) and IN-02 closed; PR not yet opened
last_updated: "2026-09-12T17:11:22.957Z"
last_activity: 2026-09-12
last_activity_desc: window ledger disposed to 0 open, then IN-02 closed by renaming HooksHydrationReader to HooksHydrationDeps
state_head: 63de8980c31cd7b7d230cde1c99b97f081606a3d
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 211
  completed_plans: 211
  percent: 56
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-07 after refine-unit-tests Phase 4)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 09 — Final Quality and Backlog Closure

## Current Position

Phase: 09 (Final Quality and Backlog Closure) — COMPLETE, verified `passed` 10/10
Next: Milestone lifecycle — audit, complete, cleanup
Plan: 6 of 6 complete

### What closed after plan 09-06

The code-review gate ran after the last plan and found 0 critical, 3 warning, 4 info. All three
warnings are fixed (`1228b178`, `064398e5`, `0ac328a0`) and recorded in `09-REVIEW-FIX.md`. Two
fixes departed from the reviewer's proposed remedy with measurement behind them: the `WR-03`
presence check would have added an uncoverable branch to `scripts/revalidation.mjs`, a
`specialPairs` entry measuring 789/789 with no pin row, so the lookup was made total by
construction instead (`SEALED_REQUIREMENT_IDS` now derives from `Object.keys(SEALED_REQUIREMENT_ROUTES)`);
and `WR-02`'s two options were not equivalent, because wiring `hookConfigPathFor` would have
forced an edit to the exact-equality `UNOWNED_EXPORT_CENSUS` pin.

Because those three commits landed after plan 09-06's measurement — and one touched a module the
coverage gate measures — both measurements were retaken on the shipped tree at `53b7e83f`:
`npm run check` exit 0 in 246s (unit 6009/6009, integration 32/32) and
`npm run test:coverage:direct:all` exit 0 over 230 pairs in 485.9s, both pinned shortfalls
matching exactly. The closure ledger's `CLOSE-01` row now cites that run; the superseded one is
kept and labelled rather than deleted. The verifier raised this as `IN-V1` and re-checked the
correction after it was made.

`09-VERIFICATION.md` reads `status: passed`, 10/10, with the `CLOSE-01` ordering computed from
commit timestamps rather than inferred: the suite was measured 21:17:25Z→21:21:34Z, strictly
between seal change A (`da08a749`, 21:17:06Z) and change B (`d391d058`, 21:26:29Z).

**Expect this verification to read `stale` again** once the milestone-close step writes
`STATE.md` and `ROADMAP.md` — both are in its `covered_files`. That is a timestamp verdict, not
an outcome verdict, and it is the same pattern already recorded below for phases 03, 04 and 05.
Its `re_verification` block says so.

### The main merge (2026-09-12, after the phase verified)

`origin/main` was 16 commits ahead and was merged in (`059a3199`) ahead of opening a PR — the
branch was behind and carried two real conflicts, so GitHub would have marked it CONFLICTING and
run zero checks.

Conflicts resolved: `eslint.config.js` keeps main's Sonar-way rule block and drops the
fixtures-ignore block `bff4ee82` retired along with the fixtures it guarded; `STATE.md` takes
this branch's milestone state over main's archived v1.19 bookkeeping.

Adaptations, because "it merged clean" would overstate it — main's tests predate this branch's
injection work, and main's lint profile post-dates this branch's code:

1. main's stage tests now pass the injected `RemovalOps` port instead of calling with one argument
2. `reconcile/plan.ts` uses the `localeCompare` comparator the discover modules document
3. the unowned-export census gained main's four PowerShell exports, symmetric with the Bash ones
4. `tests/index.test.ts` reads `EXTENSION_VERSION` instead of a hardcoded literal
5. `DispatchableEvent` keeps a documented suppression under Sonar's redundant-alias rule

**`RCOV-01` was re-sealed 230 → 233.** Main added three production modules, so the enumeration
moved and the clause stopped describing the tree it governs — while the gate stayed green, since
it validates route/status contracts and clause signatures, not the numbers inside the prose. Re-signed
across all three carriers by 08-08's method and proved still fail-closed by planting a wrong count.
`RCOV-02`'s two named readings were checked and are unchanged.

Post-merge measurement: `npm run check` exit 0 (6109 unit, 32 integration);
`npm run test:coverage:direct:all` exit 0 over 233 pairs; `Scope impact valid: 40 records.`;
`revalidation.test.ts` 138/138. Version is `0.18.3`, bumped by main — no bump was made here.

**The PR is not open.** That is the next action.

### Known process debts carried out of this phase

1. Three commits in wave 4 used phase-scoped messages (`fix(09-04)`, `docs(09-04)`) against
   `CLAUDE.md`'s "avoid GSD milestone/phases mentions". History stands; waves 5 and 6 and the
   fix pass used semantic scopes.
2. `gsd-tools query phase.complete 9` refuses in this checkout: it sees `.planning/workstreams/`
   and demands `--ws`, but this milestone's ROADMAP/STATE are the ROOT files and no workstream is
   named `refine-unit-tests`. ROADMAP and STATE were hand-edited instead, which is what this
   file already prescribes for the state verbs.
3. ~~The reviewer's `IN-02` is unactioned by choice~~ — **closed 2026-09-12** (`63de8980`).
   `HooksHydrationReader` is now `HooksHydrationDeps`; `HooksFileReader` and the `extends`
   relation are unchanged. The deferral rested on "~171 call sites across 31 test files," which
   was a miscount: that figure counts `readHooksJson` MEMBER usages, which a type rename never
   touches. Measured, the rename was **23 type-level references across 5 files**, and four of
   the five recorded gate constraints do not fire on an in-place rename at all (the census
   contains neither name; the construction-string pins are built from member names; the
   corresponding-tests pairing only fires on a module move). `IN-01`, `IN-03` and `IN-04` remain
   open by choice — of those, `IN-03` carries real risk, since NFR-10 containment now rests on
   an injected collaborator honoring a prose-only contract.
Status: the requirement seal is closed — all eight IDs read `Complete` in the checkbox, the
traceability row and `SEALED_REQUIREMENT_ROUTES`, and `node scripts/revalidation.mjs scope-impact
--check` prints `Scope impact valid: 40 records.` `npm run check` was measured on this tree, not
inherited: exit 0 in 249s at `da08a749`, unit `pass 6007 / fail 0`, integration `pass 32 / fail 0`.
The earlier note that 09-04 would take that measurement is superseded — 09-03 took it, because
D-09-02 requires it between the two flips.

The backlog is now closed in place. `TESTQ-01`, `FLOW-09`, `REASON-01` and `FLOW-07` carry
`implemented` verdicts in the struck-through house format with their requirement routes named;
`COV-01` is `superseded`, `AGCOL-01` is `evidence-only`, `GAUTH-01`'s named prescription is
`deferred`, and the unused-type-member todo is `deferred` to v1.19 — each with the explicit
negative and none with a struck-through heading. One research expectation was corrected by
measurement: `REASON-01`'s `{malformed <feature>}` family has exactly three members
(`malformed mcp`, `malformed skill`, `malformed command`) and **neither** of the two cases the
item named by hand was rerouted into it. Inline malformed `mcpServers` still reaches
`{unsupported source}` by a deliberate full-prefix match in `classifyResolverNote`, and malformed
`hooks.json` still reaches `{unsupported hooks}` because no `malformed hooks` member exists. The
entry carries that grep verbatim and a `NOT closed by the same change:` paragraph.
Resume file: `.planning/phases/09-final-quality-and-backlog-closure/09-CONTEXT.md`
Last activity: 2026-09-11 — 09-03 flipped the seal in two commits. `da08a749` moved GGAT-01,
GGAT-03, GGAT-04, RCOV-01, RCOV-02 and RCOV-03; `npm run check` was then measured green on that
committed tree; `d391d058` moved CLOSE-01 and CLOSE-02. Each commit carried all four carriers,
including the planted literal in `tests/architecture/revalidation.test.ts` its own flip
invalidated, so the gate exits 0 and the control suite reads 136/136 after both. No clause
signature was recomputed: `01-REVALIDATION.json` is still blob
`66218013acf1a69bd28b2380fdcf0c531556dff0`.

### Two handoff claims the Phase 9 discussion corrected

1. **Eight sealed IDs read `Pending`, not three.** The blocker note below names `RCOV-01`,
   `RCOV-02` and `RCOV-03`. `SEALED_REQUIREMENT_ROUTES` (`scripts/revalidation.mjs:93`) also
   pins `GGAT-01`, `GGAT-03` and `GGAT-04` at `Phase 7 / Pending`, plus `CLOSE-01` and
   `CLOSE-02` at `Phase 9 / Pending`. The three `GGAT` IDs are pinned, not unfinished:
   `07-VERIFICATION.md` reads `status: passed`, 7/7, with all three rows `SATISFIED`.
2. **The `WINDOWS.md` rows 9/30 desync is not prose-only — REPAIRED in 09-04.** Row 30's
   rendered table status read `fixed` while its fenced JSON read `open` — a status
   disagreement, not only the description drift `08-direct-coverage/deferred-items.md`
   recorded. Both rows' authoritative text was ported into the JSON before any regeneration,
   so nothing was lost; the table and JSON now agree field for field across all 31 entries.
   One research premise was wrong: entry 30's `resolved_at` CANNOT be populated by hand,
   because it is a rendered column and a timestamp the table's cell lacks re-creates the
   drift (measured both ways). It stays null; its description carries the date.

### What the 08-01 sweep measured

Seven modules fall short. The count matching the roadmap's "seven" is a coincidence — four of
`CONTRIBUTING.md`'s rows now read complete and two modules it never named fall short. Named, with
their exact reading strings: `bridges/commands/discover.ts` (`branches 55/57, lines 412/414`, pin
candidate), `bridges/hooks/event-router.ts` (`branches 107/111, lines 959/967`, tests),
`edge/args.ts` (`branches 28/29, lines 86/89`, rewrite), `edge/handlers/plugin/pending.ts`
(`branches 9/10`, rewrite), `edge/handlers/shared.ts` (`branches 14/15, lines 83/85`, rewrite),
`orchestrators/plugin/install-outcome.ts`
(`branches 60/83, functions 22/27, lines 956/1031`, owner tests after the removal port, never a pin),
`orchestrators/plugin/update-preflight.ts` (`functions 20/21, lines 589/593`, one test). No row is
unclassified.

Two measured corrections to the phase's own premises. First, `D-08-A12` is right that
`tests/architecture/revalidation.test.ts` is the only dash offender, but wrong that widening the
exclusion turns `--all-files` green: `trailing-whitespace`, `end-of-file-fixer` and `mdformat` also
rewrote six committed files, all last touched inside this milestone. The research reproduced the dash
hook in a throwaway repository holding one file, so it could not have seen them. Second,
`trufflehog` cannot run in a linked worktree at all — it reads `<root>/.git/index`, which does not
exist when `.git` is a file — so the local gate has a permanent hole only CI closes.

### What Phase 8 discussion measured

The roadmap plans Phase 8 against "204 source-test pairs" and "seven terminal shortfalls."
Neither number survived contact with the tree. `productionPaths()` returns **230**.
`bridges/commands/discover.ts` reads `branches 55/57, lines 412/414` and
`bridges/hooks/event-router.ts` reads `branches 107/111, lines 959/967` — a ninth and, on
present evidence, not necessarily the last. The retained `coverage/all-pairs.jsonl` holds
**83 of 230** rows and stops at its first refusal, which is exactly why no count in
circulation can be trusted: both gate arms halt there. `D-08-02` therefore makes the
shortfall set an **output** of the phase and forbids any plan from carrying a number into
it; `D-08-08` runs the full report twice, once to enumerate before classification and once
after the work lands to generate the committed pin.

### What Phase 7 found (retained)

The phase predicted gates that report success without scanning. It found **six of them, live**:
three in `no-credential-leak.test.ts` (two cases returning early with
`assert.ok(true, "... not yet authored")`, two loops doing `if (!exists) continue;` — a rename of
`platform/git-credential.ts` would have greened the AUTH-09 gate over zero inspected bytes), one in
`integration-materialization-gate.test.ts` (asserting nothing was materialized without checking
anything was ever offered), one in `hooks-async-rewake.test.ts` (asserting a child raised nothing
with no proof a child spawned), and a **sixth found by code review inside the phase's own
remediation of the fifth** — `fullTemplateLiteralsAfter` was written to close a bypass the file
itself called proven, then wired into two of six scans.

**The remediation introduces its own hazard, five times over.** Centralising target lists into a
registry makes any pin that compared a gate literal against an independent source collapse into
comparing a value to itself: green forever, pinning nothing. Found and fixed in
`config-state-write-seams.test.ts`, `no-shell-out.test.ts`, and `import-boundaries.test.ts`;
anticipated and refused in `compat-01-no-expansion.test.ts`; one more during the fix pass. Any later
phase that centralises a source must re-ask whether its pins still compare two independent things.

**Two measurements corrected the plans they came from.** A meta-gate keyed on `path.join` would fire
on `source-scan.ts`, the scan mechanic every gate runs on — 350 sites match the token, fewer than 20
assemble a production path. And a namespace import does NOT blanket-satisfy `fallow dead-code`;
member access through `import * as` is tracked individually.

### Three Phase 6 splits dropped coverage

`bridges/commands/discover.ts` (`branches 55/57, lines 412/414`, `41f23c09`) and
`bridges/hooks/event-router.ts` (`branches 107/111, lines 959/967`, uncovered at 553-554,
587-588, 615-616, 872-873) both remain open and reach Phase 8. `reconcile/apply.ts`
(`8394ba21`) was closed during Phase 7. Same class as the assertion loss Phase 6 recorded:
end-state assertions survive a split, sequence and coverage do not.

Phase 8's discussion re-measured both on 2026-09-10 and took different dispositions:
`discover.ts` is compiler-forced under `BC-019` and gets pinned; `event-router.ts` is left
**unclassified** (`D-08-03a`) because four uncovered sites carrying lines as well as
branches is not the single-narrowing-arm signature and no ledger finding authorizes an
accepted reading. Neither blocks `RCOV-03` any longer — `D-08-05`'s bidirectional pin is
what lets the gate be fail-closed in pre-commit and CI while genuinely unreachable arms
stay recorded rather than excused.

## Performance Metrics

**Velocity:**

- Total plans completed: 244
- Average recorded duration: 12.4 min
- Total recorded execution time: 35 hr 10 min

**By Phase:**

| Phase                           | Plans | Total            | Avg/Plan          |
| ------------------------------- | ----: | ---------------- | ----------------- |
| 108. Domain and Platform        |    23 | 10h 58m          | 28.6 min          |
| 109. Shared Contracts           |    19 | 3h 19m           | 10.5 min          |
| 110                             |    12 | -                | -                 |
| 111. Non-Hook Component Bridges |    31 | -                | -                 |
| 112. Hook Runtime               |    31 | 7h 58m           | 15.4 min          |
| 113. Orchestrator Support       |    35 | 7h 46m recorded  | 16.6 min recorded |
| 01. Live Evidence Revalidation  |    69 | 15h 18m recorded | 13.3 min recorded |
| 02                              |     3 | -                | -                 |
| 03                              |    14 | -                | -                 |
| 04                              |     7 | -                | -                 |

**Recent Trend:** Phase 04 closed four hermeticity, auth-fidelity, and typed-collaborator requirements in seven plans; independent verification passed 4/4 and the complete gate passed 5,397 unit plus 32 integration tests.
**Per-Plan Metrics:**

| Plan                                    | Duration | Tasks   | Files    |
| --------------------------------------- | -------- | ------- | -------- |
| Phase 116 P19                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P15                           | 40 min   | 1 tasks | 1 files  |
| Phase 116 P14                           | 45 min   | 1 tasks | 1 files  |
| Phase 108 P01                           | 10 min   | 2 tasks | 1 files  |
| Phase 108 P06                           | 18 min   | 3 tasks | 7 files  |
| Phase 108 P08                           | 13 min   | 2 tasks | 1 files  |
| Phase 108 P09                           | 15 min   | 2 tasks | 1 files  |
| Phase 108 P10                           | 12 min   | 2 tasks | 1 files  |
| Phase 108 P11                           | 14 min   | 2 tasks | 1 files  |
| Phase 108 P13                           | 14 min   | 2 tasks | 1 files  |
| Phase 108 P14                           | 10 min   | 2 tasks | 1 files  |
| Phase 108 P15                           | 10 min   | 2 tasks | 1 files  |
| Phase 108 P16                           | 16 min   | 2 tasks | 1 files  |
| Phase 108 P17                           | 26 min   | 2 tasks | 1 files  |
| Phase 108 P19                           | 28 min   | 3 tasks | 5 files  |
| Phase 108 P20                           | 12 min   | 2 tasks | 1 files  |
| Phase 108 P18                           | 43 min   | 3 tasks | 8 files  |
| Phase 108 P21                           | 3h 40m   | 3 tasks | 9 files  |
| Phase 108 P12                           | 27 min   | 3 tasks | 5 files  |
| Phase 108 P22                           | 42 min   | 3 tasks | 8 files  |
| Phase 108 P02                           | 20 min   | 3 tasks | 7 files  |
| Phase 108 P03                           | 19 min   | 3 tasks | 8 files  |
| Phase 108 P04                           | 22 min   | 3 tasks | 5 files  |
| Phase 108 P05                           | 20 min   | 3 tasks | 8 files  |
| Phase 108 P07                           | 27 min   | 3 tasks | 9 files  |
| Phase 108 P23                           | 20 min   | 3 tasks | 5 files  |
| Phase 109 P01                           | 7 min    | 2 tasks | 1 files  |
| Phase 109 P02                           | 10 min   | 2 tasks | 1 files  |
| Phase 109 P03                           | 12 min   | 2 tasks | 1 files  |
| Phase 109 P04                           | 7 min    | 2 tasks | 1 files  |
| Phase 109 P05                           | 5 min    | 2 tasks | 1 files  |
| Phase 109 P06                           | 7 min    | 2 tasks | 1 files  |
| Phase 109 P07                           | 16min    | 2 tasks | 1 files  |
| Phase 109 P08                           | 6min     | 2 tasks | 1 files  |
| Phase 109 P09                           | 19 min   | 2 tasks | 2 files  |
| Phase 109 P10                           | 9 min    | 2 tasks | 1 files  |
| Phase 109 P11                           | 6 min    | 2 tasks | 1 files  |
| Phase 109 P12                           | 12 min   | 2 tasks | 1 files  |
| Phase 109 P13                           | 6 min    | 2 tasks | 1 files  |
| Phase 109 P14                           | 40 min   | 3 tasks | 9 files  |
| Phase 109 P15                           | 6 min    | 2 tasks | 1 files  |
| Phase 109 P16                           | 9 min    | 2 tasks | 1 files  |
| Phase 109 P17                           | 11 min   | 2 tasks | 1 files  |
| Phase 109 P18                           | 4 min    | 2 tasks | 1 files  |
| Phase 109 P19                           | 7 min    | 2 tasks | 1 files  |
| Phase 110 P02                           | 11 min   | 2 tasks | 1 files  |
| Phase 110 P06                           | 7 min    | 2 tasks | 1 files  |
| Phase 110 P11                           | 7 min    | 2 tasks | 1 files  |
| Phase 110 P01                           | 8min     | 2 tasks | 1 files  |
| Phase 110 P03                           | 11 min   | 2 tasks | 1 files  |
| Phase 110 P05                           | 10 min   | 2 tasks | 1 files  |
| Phase 110 P08                           | 10min    | 2 tasks | 2 files  |
| Phase 110 P10                           | 9 min    | 2 tasks | 1 files  |
| Phase 110 P04                           | 11 min   | 2 tasks | 1 files  |
| Phase 110 P07                           | 16 min   | 2 tasks | 2 files  |
| Phase 110 P09                           | 19 min   | 2 tasks | 3 files  |
| Phase 110 P12                           | 17 min   | 2 tasks | 1 files  |
| Phase 111 P01                           | 14 min   | 2 tasks | 2 files  |
| Phase 111 P02                           | 10 min   | 2 tasks | 1 files  |
| Phase 112 P01                           | 14 min   | 2 tasks | 1 files  |
| Phase 112 P03                           | 9 min    | 2 tasks | 1 files  |
| Phase 112 P08                           | 8 min    | 2 tasks | 1 files  |
| Phase 112 P09                           | 9 min    | 2 tasks | 1 files  |
| Phase 112 P10                           | 14 min   | 2 tasks | 1 files  |
| Phase 112 P12                           | 12 min   | 2 tasks | 1 files  |
| Phase 112 P15                           | 6 min    | 2 tasks | 1 files  |
| Phase 112 P16                           | 7 min    | 2 tasks | 1 files  |
| Phase 112 P17                           | 7 min    | 2 tasks | 1 files  |
| Phase 112 P18                           | 3 min    | 2 tasks | 1 files  |
| Phase 112 P19                           | 5 min    | 2 tasks | 1 files  |
| Phase 112 P20                           | 5 min    | 2 tasks | 1 files  |
| Phase 112 P21                           | 8 min    | 2 tasks | 1 files  |
| Phase 112 P22                           | 20 min   | 2 tasks | 1 files  |
| Phase 112 P23                           | 10 min   | 2 tasks | 1 files  |
| Phase 112 P24                           | 10 min   | 2 tasks | 1 files  |
| Phase 112 P27                           | 19 min   | 2 tasks | 1 files  |
| Phase 112 P28                           | 28 min   | 2 tasks | 3 files  |
| Phase 112 P29                           | 13 min   | 2 tasks | 1 files  |
| Phase 112 P30                           | 17 min   | 2 tasks | 1 files  |
| Phase 112 P31                           | 17 min   | 2 tasks | 1 files  |
| Phase 112 P11                           | 14 min   | 2 tasks | 2 files  |
| Phase 112 P13                           | 20 min   | 2 tasks | 2 files  |
| Phase 112 P25                           | 12 min   | 2 tasks | 1 files  |
| Phase 112 P02                           | 45 min   | 2 tasks | 3 files  |
| Phase 112 P06                           | 26 min   | 2 tasks | 3 files  |
| Phase 112 P04                           | 33 min   | 2 tasks | 3 files  |
| Phase 112 P05                           | 18 min   | 2 tasks | 2 files  |
| Phase 112 P26                           | 19 min   | 2 tasks | 2 files  |
| Phase 112 P07                           | 34 min   | 2 tasks | 3 files  |
| Phase 112 P14                           | 16 min   | 2 tasks | 1 file   |
| Phase 115 P02                           | 96 min   | 3 tasks | 2 files  |
| Phase 115 P05                           | 90min    | 3 tasks | 5 files  |
| Phase 116 P00                           | 35 min   | 2 tasks | 5 files  |
| Phase 116 P01                           | 25 min   | 1 tasks | 1 files  |
| Phase 116 P02                           | 20 min   | 1 tasks | 1 files  |
| Phase 116 P04                           | 25 min   | 1 tasks | 1 files  |
| Phase 116 P06                           | 65 min   | 1 tasks | 3 files  |
| Phase 116 P30                           | 40 min   | 1 tasks | 1 files  |
| Phase 116 P12                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P23                           | 50 min   | 1 tasks | 1 files  |
| Phase 116 P26                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P27                           | 70 min   | 2 tasks | 2 files  |
| Phase 116 P29                           | 20 min   | 1 tasks | 1 files  |
| Phase 116 P03                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P10                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P13                           | 50 min   | 1 tasks | 1 files  |
| Phase 116 P07                           | 35 min   | 1 tasks | 1 files  |
| Phase 116 P11                           | 35 min   | 1 tasks | 1 files  |
| Phase 116 P05                           | 30 min   | 1 tasks | 1 files  |
| Phase 116 P17                           | 40 min   | 2 tasks | 1 files  |
| Phase 116 P28                           | 30 min   | 1 tasks | 1 files  |
| Phase 117 P01                           | 11 min   | 1 tasks | 1 files  |
| Phase 117 P02                           | 15 min   | 2 tasks | 10 files |
| Phase 117 P03                           | 16 min   | 1 tasks | 27 files |
| Phase 117 P04                           | 22 min   | 2 tasks | 2 files  |
| Phase 117 P05                           | 9 min    | 1 tasks | 2 files  |
| Phase 117 P06                           | 13 min   | 1 tasks | 2 files  |
| Phase 117 P07                           | 28 min   | 2 tasks | 17 files |
| Phase 117 P08                           | 22 min   | 2 tasks | 4 files  |
| Phase 117 P09                           | 13 min   | 1 tasks | 2 files  |
| Phase 117 P10                           | 12 min   | 1 tasks | 1 files  |
| Phase 117 P11                           | 50 min   | 1 tasks | 4 files  |
| Phase 117 P11                           | 2h 20m   | 2 tasks | 16 files |
| Phase 01 P01                            | 28 min   | 3 tasks | 7 files  |
| Phase 01 P02                            | 10 min   | 2 tasks | 2 files  |
| Phase 01 P03                            | 18min    | 3 tasks | 2 files  |
| Phase 01 P04                            | 4min     | 2 tasks | 2 files  |
| Phase 01 P05                            | 5min     | 1 tasks | 2 files  |
| Phase 01 P06                            | 10min    | 2 tasks | 2 files  |
| Phase 01 P07                            | 6min     | 1 tasks | 2 files  |
| Phase 01 P08                            | 12min    | 2 tasks | 1 files  |
| Phase 01 P09                            | 15min    | 2 tasks | 2 files  |
| Phase 01 P10                            | 6min     | 2 tasks | 1 files  |
| Phase 01 P11                            | 8min     | 1 tasks | 1 files  |
| Phase 01 P12                            | 12min    | 2 tasks | 1 files  |
| Phase 01 P13                            | 12min    | 1 tasks | 1 files  |
| Phase 01 P14                            | 17min    | 2 tasks | 1 files  |
| Phase 01 P15                            | 8min     | 1 tasks | 1 files  |
| Phase 01 P16                            | 15min    | 2 tasks | 2 files  |
| Phase 01 P17                            | 10min    | 2 tasks | 1 files  |
| Phase 01 P18                            | 5min     | 2 tasks | 1 files  |
| Phase 01 P19                            | 12min    | 1 tasks | 1 files  |
| Phase 01 P20                            | 6min     | 2 tasks | 1 files  |
| Phase 01 P21                            | 8min     | 2 tasks | 1 files  |
| Phase 01 P22                            | 7min     | 1 tasks | 1 files  |
| Phase 01 P23                            | 5min     | 2 tasks | 1 files  |
| Phase 01 P24                            | 6min     | 2 tasks | 2 files  |
| Phase 01 P25                            | 5min     | 1 tasks | 2 files  |
| Phase 01 P26                            | 27min    | 2 tasks | 2 files  |
| Phase 01 P27                            | 18min    | 2 tasks | 1 files  |
| Phase 01 P28                            | 25min    | 2 tasks | 1 files  |
| Phase 01 P29                            | 8min     | 2 tasks | 2 files  |
| Phase 01 P30                            | 8min     | 2 tasks | 1 files  |
| Phase 01 P31                            | 12min    | 2 tasks | 1 files  |
| Phase 01 P32                            | 14min    | 1 tasks | 1 files  |
| Phase 01 P33                            | 10min    | 2 tasks | 1 files  |
| Phase 01 P34                            | 10min    | 2 tasks | 2 files  |
| Phase 01 P35                            | 14min    | 2 tasks | 2 files  |
| Phase 01 P36                            | 5min     | 1 tasks | 2 files  |
| Phase 01-live-evidence-revalidation P37 | 10min    | 2 tasks | 1 files  |
| Phase 01-live-evidence-revalidation P38 | 12min    | 2 tasks | 1 files  |
| Phase 01-live-evidence-revalidation P39 | 15min    | 1 tasks | 1 files  |
| Phase 01-live-evidence-revalidation P40 | 18min    | 3 tasks | 2 files  |
| Phase 01 P41                            | 12min    | 3 tasks | 5 files  |
| Phase 01 P42                            | 8min     | 3 tasks | 5 files  |
| Phase 01 P43                            | 8min     | 3 tasks | 5 files  |
| Phase 01 P44                            | 7min     | 3 tasks | 5 files  |
| Phase 01 P45                            | 10min    | 3 tasks | 5 files  |
| Phase 01 P46                            | 11min    | 3 tasks | 5 files  |
| Phase 01 P47                            | 16min    | 3 tasks | 5 files  |
| Phase 01 P48                            | 11min    | 3 tasks | 5 files  |
| Phase 01 P49                            | 16min    | 3 tasks | 5 files  |
| Phase 01 P51                            | 11min    | 3 tasks | 5 files  |
| Phase 01 P52                            | 7min     | 3 tasks | 5 files  |
| Phase 01 P53                            | 8min     | 3 tasks | 5 files  |
| Phase 01 P54                            | 10min    | 2 tasks | 5 files  |
| Phase 01 P55                            | 18min    | 3 tasks | 21 files |
| Phase 01 P56                            | 12min    | 1 tasks | 3 files  |
| Phase 01 P57                            | 1h 43m   | 1 tasks | 3 files  |
| Phase 01 P58                            | 58min    | 1 tasks | 5 files  |
| Phase 01 P59                            | 3min     | 1 tasks | 3 files  |
| Phase 01 P60                            | 18min    | 1 tasks | 3 files  |
| Phase 01 P61                            | 17min    | 1 tasks | 3 files  |
| Phase 01 P62                            | 24min    | 1 tasks | 3 files  |
| Phase 01 P63                            | 16min    | 1 tasks | 3 files  |
| Phase 01 P64                            | 1h 17m   | 1 tasks | 3 files  |
| Phase 01 P65                            | 19min    | 1 tasks | 3 files  |
| Phase 01 P66                            | 23min    | 1 tasks | 3 files  |
| Phase 01 P67                            | 14min    | 1 tasks | 3 files  |
| Phase 01 P68                            | 9min     | 1 tasks | 4 files  |
| Phase 01 P69                            | 31min    | 1 tasks | 27 files |
| Phase 02 P01                            | 18min    | 2 tasks | 6 files  |
| Phase 02 P02                            | 17min    | 2 tasks | 5 files  |
| Phase 02 P03                            | 13min    | 2 tasks | 2 files  |
| Phase 01 P70                            | 19min    | 2 tasks | 3 files  |
| Phase 03 P01                            | 183min   | 2 tasks | 4 files  |
| Phase 03 P02                            | 13min    | 2 tasks | 8 files  |
| Phase 03 P04                            | 3min     | 2 tasks | 6 files  |
| Phase 03 P05                            | 2min     | 2 tasks | 6 files  |
| Phase 03 P08                            | 7min     | 2 tasks | 8 files  |
| Phase 03 P13                            | 10min    | 3 tasks | 6 files  |
| Phase 03 P03                            | 13min    | 3 tasks | 11 files |
| Phase 03 P06                            | 6min     | 2 tasks | 2 files  |
| Phase 03 P12                            | 8min     | 2 tasks | 4 files  |
| Phase 03 P14                            | 9min     | 2 tasks | 3 files  |
| Phase 03 P07                            | 34min    | 3 tasks | 9 files  |
| Phase 03 P10                            | 9min     | 2 tasks | 10 files |
| Phase 03 P09                            | 12min    | 2 tasks | 11 files |
| Phase 03 P11                            | 34min    | 2 tasks | 11 files |
| Phase 05 P01                            | 28min    | 2 tasks | 4 files  |
| Phase 05 P02                            | 33min    | 2 tasks | 8 files  |
| Phase 05 P03                            | 24min    | 2 tasks | 4 files  |
| Phase 05 P04                            | 21min    | 2 tasks | 2 files  |
| Phase 05 P05                            | 32min    | 2 tasks | 8 files  |
| Phase 05 P06                            | 31min    | 2 tasks | 4 files  |
| Phase 05 P07                            | 33min    | 2 tasks | 9 files  |
| Phase 05 P08                            | 25min    | 2 tasks | 7 files  |
| Phase 05 P09                            | 33min    | 2 tasks | 7 files  |
| Phase 05 P09                            | 37min    | 2 tasks | 7 files  |
| Phase 05 P10                            | 43 min   | 2 tasks | 8 files  |
| Phase 05 P11                            | 23 min   | 2 tasks | 10 files |
| Phase 05 P12                            | 30 min   | 2 tasks | 12 files |
| Phase 05 P13                            | 31 min   | 2 tasks | 20 files |
| Phase 05 P14                            | 30 min   | 2 tasks | 5 files  |
| Phase 05 P15                            | 20 min   | 2 tasks | 7 files  |
| Phase 05 P16                            | 28 min   | 2 tasks | 6 files  |
| Phase 05 P17                            | 33 min   | 2 tasks | 12 files |
| Phase 05 P18                            | 24 min   | 2 tasks | 10 files |
| Phase 05 P19                            | 42 min   | 2 tasks | 26 files |
| Phase 05 P20                            | 25 min   | 2 tasks | 9 files  |
| Phase 05 P21                            | 24 min   | 2 tasks | 7 files  |
| Phase 05 P22                            | 35 min   | 2 tasks | 15 files |
| Phase 05 P23                            | 25 min   | 2 tasks | 11 files |
| Phase 05 P24                            | 27 min   | 2 tasks | 10 files |
| Phase 05 P25                            | 24 min   | 2 tasks | 10 files |
| Phase 05 P26                            | 39 min   | 2 tasks | 5 files  |
| Phase 05 P27                            | 21 min   | 2 tasks | 5 files  |
| Phase 05 P28                            | 30 min   | 2 tasks | 8 files  |
| Phase 05 P29                            | 20 min   | 2 tasks | 4 files  |
| Phase 05 P30                            | 37 min   | 2 tasks | 6 files  |
| Phase 05 P31                            | 8h 35min | 2 tasks | 11 files |
| Phase 05 P32                            | 22min    | 2 tasks | 2 files  |
| Phase 05 P34                            | 26min    | 3 tasks | 1 files  |
| Phase 06 P01 | 13min | 2 tasks | 6 files |
| Phase 06 P02 | 30min | 3 tasks | 8 files |
| Phase 06 P03 | 30min | 2 tasks | 5 files |
| Phase 06 P04 | 12min | 2 tasks | 5 files |
| Phase 06 P05 | 21min | 2 tasks | 38 files |
| Phase 06 P06 | 17 min | 2 tasks | 8 files |
| Phase 06 P07 | 27min | 2 tasks | 18 files |
| Phase 06 P08 | 8min | 2 tasks | 2 files |
| Phase 06 P09 | 6 min | 2 tasks | 7 files |
| Phase 06 P10 | 7 min | 2 tasks | 4 files |
| Phase 06 P11 | 12min | 3 tasks | 7 files |
| Phase 06 P12 | 29min | 2 tasks | 65 files |
| Phase 06 P13 | 33min | 2 tasks | 30 files |
| Phase 06 P14 | 31min | 2 tasks | 48 files |
| Phase 06 P15 | 9min | 2 tasks | 3 files |
| Phase 06 P16 | 9min | 2 tasks | 0 files |
| Phase 06 P17 | 9min | 2 tasks | 0 files |
| Phase 06 P19 | 12min | 2 tasks | 4 files |
| Phase 06 P21 | 12min | 2 tasks | 3 files |
| Phase 06 P18 | 8min | 2 tasks | 0 files |
| Phase 06 P20 | 14min | 2 tasks | 5 files |
| Phase 06 P22 | 7min | 2 tasks | 2 files |
| Phase 06 P23 | 14min | 2 tasks | 7 files |
| Phase 06 P24 | 9min | 2 tasks | 2 files |
| Phase 06 P25 | 9min | 2 tasks | 3 files |
| Phase 06 P26 | 7 min | 2 tasks | 1 files |
| Phase 06 P27 | 13min | 3 tasks | 12 files |
| Phase 06 P28 | 16 min | 2 tasks | 5 files |
| Phase 06 P29 | 12min | 2 tasks | 5 files |
| Phase 06 P30 | 10min | 2 tasks | 5 files |
| Phase 06 P33 | 20min | 3 tasks | 13 files |
| Phase 06 P36 | 36min | 2 tasks | 21 files |
| Phase 06 P37 | 3min | 2 tasks | 1 files |
| Phase 06 P38 | 18min | 3 tasks | 34 files |
| Phase 06 P39 | 36 min | 2 tasks | 11 files |
| Phase 06 P40 | 24min | 2 tasks | 27 files |
| Phase 06 P41 | 7min | 2 tasks | 1 files |
| Phase 06 P42 | 7min | 2 tasks | 0 files |
| Phase 06 P43 | 16min | 3 tasks | 15 files |
| Phase 06 P44 | 28 min | 2 tasks | 10 files |
| Phase 06 P45 | 30 min | 2 tasks | 8 files |
| Phase 06 P46 | 19min | 2 tasks | 15 files |
| Phase 06 P47 | 12min | 2 tasks | 3 files |
| Phase 06 P48 | 23min | 3 tasks | 14 files |
| Phase 06 P49 | 28min | 2 tasks | 14 files |
| Phase 06 P50 | 9min | 2 tasks | 12 files |
| Phase 06 P51 | 10min | 3 tasks | 12 files |
| Phase 06 P52 | 42min | 2 tasks | 6 files |
| Phase 08 P01 | 39min | 3 tasks | 9 files |
| Phase 08 P02 | 20min | 3 tasks | 5 files |
| Phase 08 P03 | 19min | 2 tasks | 2 files |
| Phase 08 P05 | 57min | 3 tasks | 19 files |
| Phase 08 P06 | 84min | 3 tasks | 5 files |
| Phase 09 P01 | 30 min | 2 tasks | 39 files |

## Accumulated Context

### Decisions

Decisions are logged in the PROJECT.md Key Decisions table.

- Each executable plan and implementation commit owns one source-test pair.
- Runtime tests use separate lowercase `// arrange`, `// act`, and `// assert` phases.
- Lowercase `// act & assert` is reserved for one `assert.throws()` or `assert.rejects()` expression.
- Type-only evidence stays module-scoped and uses `satisfies` or `@ts-expect-error` without fake runtime phases.
- Retained commits and HEAD triage labels do not close a pair.
- [Phase 8]: One gate implementation serves two scopes at one strictness through an explicitly
  named base; the scope difference lives in the argument, never in a second copy of the gate.
- [Phase 8]: A CI step that pipes a gate into a logging command sets `pipefail` explicitly --
  GitHub's default shell is `bash -e`, which does not.
- [Phase 8]: A pre-commit `files:` pattern for a pairing gate is deliberately wider than the
  gate's correspondence rule: over-matching costs a pass-over, under-matching reads as a pass.
- [Phase 8]: `RCOV-01`, `RCOV-02` and `RCOV-03` are sealed at `Phase 8` / `Pending`, so they
  can only be completed by one coordinated change that `CLOSE-01` owns.
- [Phase 110]: Kept agents-index-schema.ts byte-identical because its compiled validators expose the complete public contract.
- [Phase 110]: Agents-index schema evidence uses independent literals plus module-scope satisfies and targeted @ts-expect-error checks.
- [Phase 110]: Kept locations.ts byte-identical because its public seams expose the complete contract.
- [Phase 110]: Locations evidence uses complete bundles and adjacent safe-path probes with platform-aware separators.
- [Phase 110]: Kept rollback.ts byte-identical because its public formatter exposes every bypass and wrapping branch.
- [Phase 110]: Rollback evidence compares whole structured results before pinning original cause and raw partial identities.
- [Phase 110]: Kept agents-index-io.ts byte-identical because its public load and save functions expose every real branch.
- [Phase 110]: Agents-index I/O evidence uses case-owned literal documents, complete loaded values, structured failures, and exact stored bytes.
- [Phase 110]: Kept config-io.ts byte-identical because its public loader, validator, predicate, and saver expose every real branch.
- [Phase 110]: Config I/O evidence uses independent literal documents, complete load results, and unchanged bytes across validation and containment failures.
- [Phase 110]: Kept config-write-back.ts byte-identical because its five public operations expose every real write-back branch.
- [Phase 110]: Config write-back evidence uses independent complete JSON bytes for patches, deletes, cascades, omitted batch arms, and absent-entry creation.
- [Phase 110]: Refined MigrationResult.marketplaces to object-valued rows while preserving migration runtime logic and exports.
- [Phase 110]: Kept invalid plugin rows unfilled so the downstream state schema remains the rejection boundary instead of silently coercing corrupt values.
- [Phase 110]: Migration evidence uses complete independent results, exact fixed-point replay, and complete warning and filesystem effects.
- [Phase 110]: Kept phase-ledger.ts byte-identical because runPhases exposes every compensation and error branch through its public contract.
- [Phase 110]: Phase-ledger evidence uses the literal skills, commands, agents, hooks, mcp, state order with complete logs, results, causes, leaks, and final context.
- [Phase 110]: Kept config-merge.ts byte-identical because its two public functions expose every real merge and load branch.
- [Phase 110]: Used independent complete reducer values and all nine base/local status pairs to keep provenance and fallback behavior explicit.
- [Phase 110]: Narrowed buildConfigFromState with an inline intersection return type so existing exports stay unchanged while marketplace and plugin records become statically present.
- [Phase 110]: Removed only the redundant entry-count fallbacks and left migration runtime ordering, stored bytes, and result arms unchanged.
- [Phase 110]: Used independent complete state and config values plus exact bytes and metadata to prove first-run replay without sleeps or shared fixtures.
- [Phase 110]: Removed the redundant post-migration marketplace guard and assertion because Plan 110-08 guarantees object-valued MigrationResult rows.
- [Phase 110]: State migration persistence uses a pre-registered case-local filesystem watcher and exact file metadata to prove no-write replay without sleeps or polling.
- [Phase 110]: Kept with-state-guard.ts byte-identical because its public state operations and lockfile collaborator expose every real lifecycle branch.
- [Phase 110]: Used entered and release promises to prove real lock contention without sleeps, polling, elapsed-time checks, or platform skips.
- [Phase 110]: Used the existing loadState and saveState dependency seam for deterministic persistence failures and case-local proper-lockfile method restoration for acquisition and release failures.
- [Phase 111]: Every mirrored owner uses complete case-local inputs and independent expected outcomes; shared fixtures were removed after their last legitimate consumer.
- [Phase 111]: Supplemental suites remain only for genuine cross-module behavior, and all 31 direct owner gates pass at complete line, branch, and function coverage.
- [Phase 111]: MCP provenance markers require own outer and identity properties, rejecting inherited marker, plugin, and marketplace values.
- [Phase 111]: Two provably unreachable private skills-stage fallbacks were removed without adding a test-only seam, export, pragma, or behavior change.
- [Phase 112]: Kept pid-table.ts byte-for-byte unchanged and covered every branch through its public filesystem contract.
- [Phase 112]: Used a case-owned _shared regular-file boundary for deterministic filesystem failures without a test seam.
- [Phase 112]: Kept ring-buffer.ts byte-for-byte unchanged and proved every byte boundary through its public API.
- [Phase 112]: RingBuffer evidence uses fresh case-local byte inputs and independent complete text/truncation outcomes.
- [Phase 112]: Kept exec-result.ts byte-for-byte unchanged because its exported type and assertNever function expose the complete contract.
- [Phase 112]: Kept all HookExecResult positive and negative type evidence at module scope, with runtime execution only for assertNever.
- [Phase 112]: Proved allow, deny, and ask inline without introducing a new permission type export.
- [Phase 112]: Kept exec-timer.ts byte-for-byte unchanged because its public timer ladder exposes every scheduling branch.
- [Phase 112]: Observed exact handles, unref calls, clears, and pending state through the current TestContext fake timers only.
- [Phase 112]: Kept hook-env.ts byte-for-byte unchanged because prepareHookEnv exposes every environment branch through its public contract.
- [Phase 112]: Hook environment evidence preserves inherited-key non-interference while proving case-local remote-key absence and exact process restoration.
- [Phase 112]: Kept glob.ts byte-for-byte unchanged because its public compiled Bash and path objects expose every matching and defensive branch.
- [Phase 112]: Glob owner evidence uses complete independent metadata and named outcome maps for command boundaries, six anchors, normalization, containment, and globstar behavior.
- [Phase 112]: Covered defensive sparse and unknown compiled metadata through exported objects with Reflect, without casts, test seams, or production surface changes.
- [Phase 112]: Kept post-compact.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced the incomplete double assertion with complete SessionCompactEvent values checked by satisfies.
- [Phase 112]: Treated empty strings as valid context values and did not fabricate an out-of-contract null case.
- [Phase 112]: Kept post-tool-use-failure.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: PostToolUseFailure owner evidence uses complete ToolResultEvent values, independent whole envelopes, and nested identity and non-mutation assertions.
- [Phase 112]: Kept malformed process output in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept post-tool-use.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced PostToolUse double assertions and shared context with complete case-local values checked by satisfies.
- [Phase 112]: Kept malformed PostToolUse process output in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept pre-compact.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced the PreCompact double assertion and shared context with complete case-local values checked by satisfies.
- [Phase 112]: Treated empty strings as valid PreCompact context values and did not add an unsupported null context case.
- [Phase 112]: Kept pre-tool-use.ts byte-for-byte unchanged because translate exposes the complete payload contract.
- [Phase 112]: PreToolUse evidence uses independent built-in and custom six-key envelopes with nested identity and non-mutation checks.
- [Phase 112]: Kept malformed PreToolUse input in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept session-end.ts byte-for-byte unchanged because translate exposes the complete SessionEnd payload contract through its public signature.
- [Phase 112]: Used one explicit case per shutdown reason plus a dedicated empty-context case, with input-only target session files omitted from exact five-key envelopes.
- [Phase 112]: Kept malformed SessionEnd input in Plan 112-04 and left the supplemental translator suite unchanged.
- [Phase 112]: Kept session-start.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: SessionStart evidence uses independent whole envelopes for every source branch and accepted empty context values.
- [Phase 112]: Kept stop-failure.ts byte-for-byte unchanged because its public translator and classifier expose the complete contract.
- [Phase 112]: Used explicit sibling cases for classifier precedence and status partitions instead of a shared table or test seam.
- [Phase 112]: Kept object and cause wrapping in Plan 112-27 instead of expanding the StopFailure owner scope.
- [Phase 112]: Kept stop.ts byte-for-byte unchanged because its public translator exposes the complete contract.
- [Phase 112]: Used separate case-local values and whole six-key expectations for active, inactive, and empty-text Stop partitions.
- [Phase 112]: Kept Stop re-entry and observer behavior in Plan 112-26 instead of widening the direct payload owner.
- [Phase 112]: Kept user-prompt-submit.ts byte-for-byte unchanged because its public translator exposes the complete contract.
- [Phase 112]: UserPromptSubmit evidence uses separate case-local values and whole five-key expectations for ordinary, multi-line, empty, and multi-byte prompts.
- [Phase 112]: Kept malformed process-output behavior in Plan 112-04 instead of widening the direct payload owner.
- [Phase 112]: Preserved spawn planning while the security gate strengthened oversized serialization to a strict final 256 KiB UTF-8 bound.
- [Phase 112]: Treated defined args, including an empty array, as exec form with shell disabled; absent args retain shell-form behavior.
- [Phase 112]: Made the truncation marker authoritative without mutating object, primitive, or array inputs and bounded the final UTF-8 output, including metadata, to 256 KiB.
- [Phase 112]: Removed only the private stage stack-pop undefined guard after live CodeGraph proof established that its guarded state is unreachable.
- [Phase 112]: Retained readSymlinkTargetSafe as a reachable TOCTOU defense and proved it through restored Node filesystem bindings without a production seam.
- [Phase 112]: Absorbed the symlink supplemental's unique containment evidence into the stage owner before deleting the duplicate carrier.
- [Phase 112]: Kept timeout.ts byte-for-byte unchanged because resolveTimeoutSeconds exposes every validation, default, and diagnostic branch through its public contract.
- [Phase 112]: Preserved every finite positive value exactly, including fractional and large values, while rejecting zero, negative, nonnumeric, and nonfinite declarations.
- [Phase 112]: Kept scheduling, timer clamping, cancellation, and races in Plan 112-09 instead of widening this pure validation owner.
- [Phase 112]: Kept translation-context.ts byte-for-byte unchanged because buildTranslationContext exposes the complete snapshot and fallback contract through its public result.
- [Phase 112]: Used real case-owned file-backed and in-memory SessionManager instances with independently authored whole-context expectations.
- [Phase 112]: Kept translation-context readonly evidence at module scope and preserved its internal-only barrel scope.
- [Phase 112]: Kept wire-protocol.ts byte-for-byte unchanged because parseHookStdout exposes every live exit, JSON-shape, precedence, mutation, and no-op branch through its public result.
- [Phase 112]: Proved semantic diagnostics by category, hook destination, relevant detail, and outcome while separately asserting that reporting never throws.
- [Phase 112]: Kept every wire case independent and explicit instead of generalizing the mutation contract through a table or shared oracle.
- [Phase 112]: Restored documented stable first-seen Bash candidate deduplication with only a Set spread after direct evidence exposed the missing behavior. — The Rule 1 fix satisfies the public contract without adding an export, symbol, seam, helper, or parser restructuring.
- [Phase 112]: Bash if-field evidence uses complete literal commands and independently authored ordered results without invoking a shell. — Direct parser and matcher calls prove syntax, wrapper, recursion, fail-open, and specificity behavior without executing untrusted command text.
- [Phase 112]: Left the hooks-if-field supplemental file unchanged so Plan 112-13 remains its only final carrier. — The Bash owner absorbs the unique leaf evidence while avoiding a competing shared-file edit.
- [Phase 112]: Kept if-field/index.ts byte-for-byte unchanged because its public composition exports expose every required compile and evaluation partition.
- [Phase 112]: Retained only the unique parseHooksConfig side-map-to-RoutingEntry chain, including exact predicate object identity and declaration order.
- [Phase 112]: Kept the exact five predicate arms and all re-export evidence module-scoped without widening production metadata or adding a test seam.
- [Phase 112]: Kept routing-state.ts byte-for-byte unchanged because its public operations expose every required state transition and reset effect.
- [Phase 112]: Used only public lifecycle operations for routing-state setup, observation, and cleanup, without a private-state reader or test-only reset export.
- [Phase 112]: Left the additional-context supplemental unchanged because Plan 112-07 is its sole deletion carrier and Plan 112-13 owns the unique parser chain.
- [Phase 112]: Removed the two CodeGraph-confirmed registry test readers and obsolete promise-tracking cell without adding another observer or test seam.
- [Phase 112]: Retained fire-and-forget PID persistence on async child exit and error, observing rewrites through public filesystem and shutdown effects.
- [Phase 112]: Restricted the async-rewake supplemental to two cross-lane environment-parity cases and one routing-epoch reload case.
- [Phase 112]: Proved default orphan probes behind a mocked process.kill signal-0 boundary and used injected probes for all orphan safety partitions.
- [Phase 112]: Removed the legacy adaptObservationResult export after CodeGraph and historical call-site proof found no production caller.
- [Phase 112]: Consolidated every direct adapter contract and the duplicate architecture suite into the mirrored event-adapters owner.
- [Phase 112]: Left the mixed SessionStart additional-context supplemental unchanged for Plan 112-07 to remove after dependent evidence is absorbed.
- [Phase 112]: Kept dispatch-exec.ts byte-for-byte unchanged because dispatchHookExec exposes the complete process, stream, stdin, timer, parse, and delegation contract.
- [Phase 112]: Used synchronous child stdin and direct stdout/stderr descriptor writes to remove the portable fixture fast-exit race without sleeps or production changes.
- [Phase 112]: Consolidated all single-module execution evidence in the dispatch-exec owner and deleted hooks-exec.test.ts.
- [Phase 112]: Retained only translator-module completeness and shared built-in/custom tool-name mapping in hooks-translators.test.ts.
- [Phase 112]: Used a live failing diagnostic sink to prove the outer async delegation catch while preserving never-throw noop behavior.
- [Phase 112]: Kept dispatch.ts byte-for-byte unchanged because its public collection and composite-handler exports expose every reducer and adaptation partition through an injected executor.
- [Phase 112]: Consolidated all single-module reducer evidence in the mirrored dispatch owner, then deleted hooks-reducer.test.ts.
- [Phase 112]: Kept hooks-dispatch.test.ts byte-for-byte unchanged as the locked repository-wide static carrier for Plan 112-07.
- [Phase 112]: Used only public routing lifecycle operations for case-local state setup and cleanup, without a private state reader, reset seam, or shared oracle.
- [Phase 112]: Removed settleCacheSnapshot and loopProtectionState after live CodeGraph proof showed no production callers, without adding a replacement introspection seam.
- [Phase 112]: Proved settle state only through public lifecycle handlers, executor events, sent messages, notifications, and fresh follow-up calls.
- [Phase 112]: Kept StopFailure observation-only: matching noop, block, mutate, and stop results run in declaration order and are all discarded.
- [Phase 112]: Alphabetized inventories and presentation expectations while preserving exact production declaration and registration order where order is contractual.
- [Phase 112]: Kept event-router.ts byte-for-byte unchanged because its public cache, hydration, rebuild, handler, and registration operations expose the complete lifecycle contract.
- [Phase 112]: Split in-memory and persisted child fixtures across user and project cleanup surfaces so exit persistence cannot race the orphan tracer.
- [Phase 112]: Alphabetized the hook-barrel runtime identity and compiler-negative inventories while leaving production export declarations unchanged.
- [Phase 113]: Completed all 35 mirrored owners; 33 executable sources reached 971/971 branches, 216/216 functions, and 7,941/7,941 lines, while both type-only owners passed compiler contracts.
- [Phase 113]: Kept runtime tests on separate lowercase `// arrange`, `// act`, and `// assert` phases and kept presentation-only inventories alphabetical.
- [Phase 113]: Preserved caller, scope, reason, and lifecycle order wherever sequence carries behavior.
- [Phase 113]: Proved presenter structure and exact rendered bytes, including severity, dependency, omission, tally, trailer, and reload partitions.
- [Phase 113]: Proved classifiers, discovery, clone helpers, probes, scope fan-out, import planning, and reconcile planning through complete case-local values.
- [Phase 113]: Kept read-only support paths offline through fail-fast fakes and architecture prohibitions; all mutable state and collaborators are case-owned.
- [Phase 113]: Absorbed single-module evidence into mirrored owners and removed seven redundant supplemental suites without losing their unique contracts.
- [Phase 113]: Removed one unreachable closed-union presenter default instead of fabricating an impossible test value.
- [Phase 113]: Restored shipped barrel and interface exports after review showed aggregate dead-code cleanup had narrowed public contracts.
- [Phase 113]: Replaced passive-value mocks and every broad `anyTimes()` expectation with fresh typed data and exact, explicitly verified interaction doubles.
- [Phase 115]: Removed five structurally unreachable arms from the import cascade after a caller trace, narrowing two private types so a wrong token is a compile error rather than a runtime signal.
- [Phase 115]: Deleted the last c8 ignore in the extensions tree by running the entrypoint twice with no dependency bundle, so the production default state loader's own answer is what changes the second outcome.
- [Phase 115]: A defensive guard can be reached and still not be discriminating; the repair builder's undeclared-source guard is redundant with the already-declared merge check and is reported rather than removed.
- [Phase 115]: D-115-10 delivered: the three reconcile producers carry the mode-discriminated overload, so a dropped cascade row is a gate failure rather than a silent continue.
- [Phase 115]: Removed the marketplace-add, plugin-install and plugin-toggle catch clauses as unreachable; kept and proved the removal and uninstall clauses with a competing-writer race.
- [Phase 115]: Deleted all eight source-text pins outright; none encoded a rule that is not already gated by its own owner, so nothing was re-homed under tests/architecture/.
- [Phase 116]: strong-mock times(0) is inert, so the notification boundary omits the expectation entirely when a count is 0
- [Phase 116]: The args-schema owner records onError with a plain closure asserted as a whole array, never as an interaction mock — The module promise is its return value; a declared callback parameter is not a port, so its call count proves nothing the result does not
- [Phase 116]: The tokenizer-failure cases declare a required positional the input satisfies, so an undefined result can only mean the early return fired — It proves the short-circuit through the public result instead of observing an internal call, and a plant that removed the short-circuit turned all three cases RED
- [Phase 116]: The direct-coverage branch denominator is a property of the suite, not of the source: edge/args.ts measures branches 28/29 under its rewritten owner where it measured 25/26 under the old one, with the same single uncovered branch — V8 emits a block range only when that block's execution count diverges from the enclosing range, so a guard whose false arm is never taken is collapsed and never enters the lcov denominator at all. Covering the false arm raises BRH and BRF together. Diffing BRDA records between the two suites over the same source shows three new ranges (args.ts:46, :75, :84) and no lost ones. Consequence: a full-line coverage verdict pin cannot be authored before the rewrite that strengthens the suite. D-116-01a's recorded number for edge/args.ts is superseded by measurement and the three other claimants (116-26, 116-21, 116-17) carry the same exposure. Operator ratification required; nothing was edited.
- [Phase 116]: 116-06: deleted the unreachable optional-description branch in completionFlagEntries by making FlagEntry.description required, rather than adding a coverage exception; the exported return type is unchanged
- [Phase 116]: 116-06: where an architecture gate already pins a data table exactly, the mirrored owner proves the derivation shape (filter, order, key presence, exclusion) and asserts nothing about the table contents
- [Phase 116]: 116-30: the type-only owner pins EdgeDeps required-versus-optional split only; enumerating the member set or asserting the export surface would restate what the compiler and fallow dead-code already enforce
- [Phase 116]: 116-30: a clean tsc is itself proof that every ts-expect-error in a file binds, because an unattached directive raises TS2578; the moved-marker plant showed the multi-line satisfies diagnostic landing on the closing line
- [Phase 116]: The closed-over-API case builds two distinct Pi values instead of one shared value: a same-instance case only repeats the delegation case and cannot discriminate.
- [Phase 116]: 116-23: a double for a generic export derives from an instantiation-expression type query (Parameters<typeof fn<Chosen>>[N]); the uninstantiated form collapses the type parameter to unknown and loses the exact-argument match
- [Phase 116]: 116-23: input tokens that the module under test derives from another module are hand-authored literals, not read back from that module; feeding the derivation back in is tautological and cannot fail
- [Phase 116]: 116-26: a whitespace row set must separate the two claims it looks like one of — dropping empty tokens and splitting on a whitespace CLASS are independent, and a spaces-only row pins neither because /\s+/ is greedy
- [Phase 116]: 116-26: a D-116-01a pair pins the shortfall identity (one uncovered branch, the exact uncovered line set) and records the measured branch numbers as an observation; the denominator tracks suite strength, so a number pin cannot be authored before the rewrite it gates
- [Phase 116]: 116-27: all four tools.ts switches are gated — three by TS2366 because their return type excludes undefined, and the version reader by TS7030 because noImplicitReturns makes the end of a default-less switch reachable once an arm goes missing; research's "compiles clean" premise is disproved
- [Phase 116]: 116-27: an unreachable switch arm is removed by giving the function its producer's row union, derived from the producer's return type rather than named or hand-excluded; re-adding a removed arm raises TS2678, which is the control that proves the removal was forced
- [Phase 116]: 116-27: a defensive narrowing copied from a shared helper is a branch the local pair can never reach; calling the helper removes it without a cast, a behavior change, or a coverage exception
- [Phase 116]: 116-27: a mock for a generic method restates that member as a property, because reading a method as a value is an unbound-method lint error; the shared notification boundary cannot serve a registerTool capture for that reason
- [Phase 116]: 116-29: the two subcommand vocabularies deliberately overlap on list, ls, info and update, so "no marketplace name is also handled by the top level" is false; the anti-shadowing promise is carried instead by proving the shared token reaches a different handler member per dispatch
- [Phase 116]: 116-29: alias identity is one case with one expectation at a definite count of 2, driven once by the alias and once by the canonical name; two separate cases prove two dispatches, not one identity
- [Phase 116]: 116-29: a "no duplicate entries" claim cannot be written by deduplicating the exported constant and comparing it back — that is an expectation transformed from an actual; comparing the export against the hand-authored row table that serves it catches the same defect
- [Phase 116]: 116-24: a destructive seamless verb is owned through its FOOTPRINT — every case, rejections included, compares the surviving install records of both scope roots as one whole value beside the notification; a notification-only proof of an uninstall passes while proving nothing about whether state changed
- [Phase 116]: 116-24: `parseCommandArgs` with ONE REQUIRED positional rejects zero but DROPS a surplus, because it iterates the schema rather than the input; the arity truth's lower half holds and its surplus half does not
- [Phase 116]: 116-24: `uninstallPlugin` reads `opts.local` only to pick the CFG-03 precondition target and then sweeps BOTH config layers unconditionally, so the scope-target flag is invisible in the message AND in the footprint on a healthy workspace; the discriminating fixture is an override layer that FAILS SCHEMA VALIDATION, where supplying the flag aborts the command and omitting it completes it
- [Phase 116]: 116-24: one Group-C plant can yield three distinct frames on a single module when the scope selection is what reaches `locationsFor` — a user-scope call never calls `path.join`, so it runs to completion and is caught by the emission count instead of by an ERR_INVALID_ARG_TYPE
- [Phase 116]: 116-24: an offline zero needs BOTH reachability questions answered; where the module can reach no transport at all, the zero is an NFR-5 regression guard with neither a positive control nor a reachable input, and must be labelled as one rather than presented as a measurement
- [Phase 116]: 116-03: the `--partial` option is not an install/update-only narrowing — it SHIFTS the install candidate set (drops `remote`, admits `partially-available`) and narrows uninstall, reinstall, enable and disable identically to update, because it is threaded into the same shared installed-inventory helper
- [Phase 116]: 116-03: `tests/architecture/scope-order-drift.test.ts` walks `extensions/` only, so a hand-authored scope literal in a test file is not gated; four existing test files already carry one
- [Phase 116]: 116-03: a counter exposed on a returned interface must be declared `readonly f: () => number`, not `f(): number` — a method signature makes every destructuring site an unbound-method lint error even though the value is a closure
- [Phase 116]: 116-03: `data.ts:188`'s `allTokens.at(-1) ?? ""` fallback is a fifth D-116-01a-class unreachable branch, outside the four-claimant list; proved unreachable by construction, by a 65,536-code-point probe, and by a plant that stayed green, and left at 109/110 rather than pinned or excepted
- [Phase 116]: 116-10: an EMPTY positional schema does not reject a surplus token — `parseCommandArgs` iterates the SCHEMA, not the input, so every extra token is dropped and the handler still delegates; the phase-wide `must_haves` truth that both out-of-range arities are "rejected with a usage error" is false for a zero-positional handler
- [Phase 116]: 116-10: `marketplace/list.ts` never calls `extractLocalFlag`, so the scope-target flag reaches the tokenizer as a positional and is swallowed; supplying it beside `--scope` is accepted, not rejected, and the phase-wide mutually-exclusive-selectors truth has no target on this handler
- [Phase 116]: 116-10: the Group-C negative fires on the FIRST unstated boundary read, not on the emission count — a handler that forwards `ctx.cwd` dies in `path.join` on strong-mock's pending-call proxy before it can emit, so the G5 excerpt's stated "second `ctx.ui` access past its `times(1)` count" mechanism is only the fallback for handlers that read no `cwd`
- [Phase 116]: 116-10: a Group-C rejecting case seeds BOTH scopes so the workflow it must not reach would have rows to emit; an unseeded tree makes the negative weaker because the unreached workflow would emit only the empty-state sentinel
- [Phase 116]: The marketplace update handler's usage-string collapse arm is unreachable through its exports, so the pair stands at branches 11/12 and the shortfall is reported, not pinned or excepted — parseCommandArgs passes the usage string to the callback only for a REQUIRED positional; this schema declares its sole positional optional. Proven by construction, by a 170-shape brute force, by a plant that stayed GREEN, and by an inverted-condition plant that went RED. 116-13 is not a D-116-01a claimant and both production licences are spent, so the reversible default applies. Identity: BRDA:41,11,0,0 in the pair's own lcov.
- [Phase 116]: An injected port forwarded from two call sites needs one plant per site; a single-site plant leaves the sibling arm's claim unproven — Removing the all-marketplaces arm's pluginUpdate forward left both named-marketplace rows GREEN; removing the single-marketplace arm's forward left the bare and scope-narrowed cases GREEN. Applies to 116-07, 116-14 and 116-17, the remaining injected-port owners.
- [Phase 116]: 116-07: the marketplace add owner proves the injected git port by driving a url source on a provider-less host and comparing the whole clone recorder, with the randomUUID staging leaf replaced by a token only under the expected scope root
- [Phase 116]: 116-07: scope and the scope-target flag are proven as an on-disk footprint (which scope root holds state.json, and whether the write-back landed in claude-plugins.json or claude-plugins.local.json) because the edge tier has no injection point against the options bag
- [Phase 116]: 116-14: a RECORDER-based port-forward proof is weaker than a structural exact-argument `when()` — a re-boxed port AND a port with one member wrapped around a delegating call both stay GREEN under a recorder, while 116-17's `when()` goes RED on the wrapped member; only replacing the implementation goes RED under both, so the claim states that the operation is carried out by the injected implementation
- [Phase 116]: 116-14: a guard order is only pinnable with an input that satisfies TWO guards at once — the plan's unrecognised-scope-with-no-positional input passes under any order, while `--scope user --local` proves the positional guard precedes the scope guard and `extra --scope nope` proves the parse failure precedes both
- [Phase 116]: 116-14: `plugin/bootstrap.ts` calls `parseArgs`, the second handler measured to do so, and answers all three inherited questions like `plugin/import.ts` rather than like the marketplace tier — a surplus positional IS rejected, there is no arity below the accepted zero, and `--local` lands on positional
- [Phase 116]: 116-14: a github-source workflow cannot be driven through a bare `createGitOpsFake` — the GitHub provider attaches a credential bundle whose functions are not structured-clonable and the fake's recorder clones every call, so the port must drop that downstream-owned bundle while still delegating every operation to the fake
- [Phase 117]: The unit-suite glob control lands before the amendment it guards, so the later glob change must turn it RED and back GREEN rather than tune it to agree
- [Phase 117]: 117-02: a support-module relocation ships as ONE commit carrying the `git mv` and its consumer import rewrites — a pure-move commit leaves the consumers importing a path that no longer exists, so it cannot typecheck, and git still reports the rename at 96 to 98 percent
- [Phase 117]: 117-02: ESLint and Prettier disagree on the shape of a shortened import — `eslint --fix` split the two integration children's import onto four lines and `prettier --check` then failed, because the shorter sibling specifier let the statement fit one 94-character line; run both, never either alone
- [Phase 117]: 117-03: shortening an import specifier re-sorts it INSIDE the parent group, not only across groups — the boundary move reddened `import-x/order` in six suites where the plan predicted two, so the ordering must be read off ESLint rather than reasoned about
- [Phase 117]: 117-03: a 100 percent rename reading is only evidence once the consumer edits are confirmed staged — the identical number was false in 117-02, produced by an aborted `git add`, so cross-check it against `md5sum` and `git log --follow`
- [Phase 117]: D-117-04a: both orphan supplements relocate to tests/architecture/ rather than fold into a mirrored owner, because each spans several production modules and none of them owns it — The correspondence gate exempts the architecture root structurally (nonCorrespondingRoots), so the relocation needed no gate change and no exemption entry -- which is what keeps the SUITE-04 ban on name-keyed opt-outs intact
- [Phase 117]: D-117-04b: each move is one commit carrying the move plus its specifier fix, not a move commit and a rewrite commit — A pure-move commit would leave the reason-parity suite importing a path one level too deep, so it would not typecheck; git still recorded the rename at 95 percent, and the materialization-gate move at 100 percent
- [Phase 117]: The device-flow prompt supplement folds into tests/domain/github-auth.test.ts as one case, not two: its ordering case restated the owner existing reports-denied-authorization row, so the surviving case pins the catalog byte form on the denied poll and carries both claims at once.
- [Phase 117]: The folded case builds its transport with createDeviceFlowFake while the credential and notify ports stay strong-mocks, because the house role table makes notifying a mock and a third copy of the owner mock-DeviceFlowHttp arrange block would have risked the fallow dupes threshold of 3.
- [Phase 117]: 117-06: plant at the granularity the case claims — deleting the whole production step fails the case on its returned outcome, so it cannot prove an on-disk read is load-bearing — The plan's literal plant removed the cascade's hooks slot and the merged case failed on dropped.hooks, not on the readdir; deleting only the rm inside removeHookConfig left the outcome correct and failed exactly one case in the suite, on the disk read
- [Phase 117]: The seed's own three production specifiers gained a climb because its new home is one directory deeper; no consumer rewrite reveals that, only reading the module does.
- [Phase 117]: The helpers glob alternative was removed for honesty, not function: both globs match the same 248 paths with and without it, and the 117-01 completeness control is the independent proof.
- [Phase 117]: Shortening an import specifier re-sorts it inside the parent group with no predictable direction: 13 handler suites moved a line, the mirror image of 117-03's effect.
- [Phase 117]: The extension entry pair asserts two notifications for an unreadable install state, not one: the reconcile renders its own failure cascade for the same file before the plugin-PATH warning, and the legacy filtered assertion concealed it. — Measured on this tree; the whole two-element notification list is now compared.
- [Phase 117]: Both entry-pair fixtures use a schema violation rather than a syntax error, because the reconcile renders the runtime JSON parser text into a user-visible message and that text is not part of any contract. — Keeps the whole-value cascade comparisons stable across Node versions; this tree runs v26.7.0 while CI pins 24.
- [Phase 117]: Barrel-proxy ownership is named as its own gate verdict, proxy-owned, split from wrong-import and decided from the import graph the gate already builds. — D-117-21 gives the verdict its spelling; the split needs no name list, registry or exemption entry, and both sides are planted in the control.
- [Phase 117]: D-117-20 amended to 190 + 7 + 7: 190 complete numeric records, 7 accepted D-116-01a shortfalls, 7 type-only — Operator decision after plan 117-11 measured it; the gate is deliberately unchanged, no ledger-keyed verdict and no production licence, because a ledger-keyed pass would be the coverage-exception pragma D-116-01a bans
- [Phase 117]: Concurrency is NOT added to the all-pair run, decided against a measured 533.2 s for all 204 rows — Under nine minutes at a phase boundary does not justify D-117-11's obligation of a second planting control proving a failing pair is still detected under interleaving
- [Phase 117]: An errno path and errno message text are runtime-owned, not contractual; assertions pin name, code and syscall, and read the runtime's wording back where production composes around it — A package upgrade changed the EISDIR wording mid-phase and reddened 11 assertions with no behaviour change; the ten hardened suites are now identical on v22.22.2 and v26.8.1
- [Phase 01]: Keep canonical revalidation state in normalized JSON and render Markdown deterministically from it.
- [Phase 01]: Seed every corpus file and operator decision unresolved so shards cannot inherit false completion.
- [Phase 01]: [Phase 01-02]: Preserve meta-report rows as namespaced source claims linked to canonical cross-cutting findings.
- [Phase 01]: [Phase 01-02]: Treat the missing historical coverage report as an explicit evidence gap rather than current proof.
- [Phase 01]: Administrative review instructions are explicit zero-claim controls, not current production findings.
- [Phase 01]: The MCP home escape and retained coverage report are stale, while seven focused coverage shortfalls remain live.
- [Phase 01]: Treat the first-pass reviewer instruction brief as an explicit zero-claim control document rather than converting operational directions into product findings.
- [Phase 01]: Preserve the clean-list repair's historical method and counts while confirming its current result from the retained reports.
- [Phase 01]: [Phase 01-05]: Keep architecture scan weaknesses live until visited-file and planted-violation controls exist.
- [Phase 01]: [Phase 01-05]: Preserve positive gate evidence separately from current weaknesses.
- [Phase 01]: Route catalog UAT live weaknesses to Phase 2 while retaining measured key-parity and whole-byte strengths as evidence-only closure.
- [Phase 01]: Keep the catalog test split as an operator-sequenced decision after selecting a production section-emitter interface.
- [Phase 01]: Preserve 48 independently traceable architecture-hooks claims rather than collapsing refinements or corrections.
- [Phase 01]: Keep the HOOKS_CONFIG_SCHEMA test-only-export question routed to operator decision while routing the inert-gate repair to Phase 2.
- [Phase 01]: Preserve each architecture-gate report bullet as an independent namespaced claim, including clean and correction evidence.
- [Phase 01]: Keep evidence status independent from remediation routing for the 01-08 shard.
- [Phase 01]: Keep multi-directory agents discovery versus single-directory production wiring as an operator decision.
- [Phase 01]: Classify artificial coverage as dead defensive code, compiler-forced narrowing, or reachable behavior with an unsuitable seam.
- [Phase 01]: Route the pid-table pre-await snapshot defect to Phase 2 because current control flow contradicts its defensive-copy contract.
- [Phase 01]: Keep unreachable async-rewake fallback and CR-01 element-validation policy claims as operator decisions.
- [Phase 01]: Preserve hooks-dispatch corpus overlaps as explicit duplicate findings rather than deleting historical claim identities.
- [Phase 01]: Close the hooks event-router duplicate-import claim as stale only after current replacement inspection and focused rerun.
- [Phase 01]: Keep unquoted compound command-substitution semantics as an operator decision because upstream parity is not established by repository evidence.
- [Phase 01]: Treat dead defensive compiler catches as an operator choice between deletion and explicitly accepted uncovered lines.
- [Phase 01]: Route the surviving compaction reason-to-trigger contract through an operator decision before implementation.
- [Phase 01]: Preserve refuted hooks-payload prescriptions as stale evidence-only closures.
- [Phase 01]: [Phase 01-14]: Keep MCP shared-predicate and test-only-export ownership as operator decisions while routing live null/scalar defects to Phase 2.
- [Phase 01]: [Phase 01-14]: Treat compiler-forced skills prototype surgery and parser-message ownership as operator decisions.
- [Phase 01]: Treat direct 100% coverage and mutation strength as independent evidence for hooks components.
- [Phase 01]: Close the unconditional-if deletion claim as stale because the current reject row kills that mutation.
- [Phase 01]: Retain defensive dispatch-guard, debug seam, clock seam, result-shape, and validator-export questions as operator decisions.
- [Phase 01]: Route reproduced domain correctness and security gaps before structural test cleanup.
- [Phase 01]: [Phase 01-17]: Route inconsistent resolver I/O taxonomy and module splitting through operator decisions.
- [Phase 01]: [Phase 01-17]: Close the partial-gate over-narrowing claim as stale because current typecheck rejects the mutation.
- [Phase 01]: [Phase 01-18]: Keep dormant completion-cache removal and required-description narrowing routed through operator decisions because both cross ownership boundaries.
- [Phase 01]: [Phase 01-18]: Treat marketplace unknown-long-flag behavior as an operator policy decision while routing missing-await and duplicated handler ownership findings to Phase 2.
- [Phase 01]: Keep handler-to-orchestrator ownership fixes routed to Phase 2 while preserving full-value assertions until narrow injection seams exist.
- [Phase 01]: Retain the update omitted-scope observation and workspace-helper consolidation in the deferred backlog because they cross this shard's handler ownership boundary.
- [Phase 01]: Route the two closable D-116-01a index-loop shortfalls to operator decision because current iterable rewrites contradict their compiler-forced premises.
- [Phase 01]: Keep callback-recorder policy and speculative flag visibility as operator decisions rather than mechanical edits.
- [Phase 01]: Preserve all 55 import and marketplace-add claims individually while routing 52 live findings to Phase 2.
- [Phase 01]: Close three overstated historical claims as stale evidence rather than scheduling their original remedies.
- [Phase 01]: Route the write-only MarketplaceUpdateError.retryHint contract to an operator decision because its producer mutation survives and no current consumer observes the field.
- [Phase 01]: Retain the fs.watch TOCTOU case as a deferred determinism concern rather than treating its race as a lying test.
- [Phase 01]: Preserve the stale fetch git-import suspicion separately from the confirmed dynamic-import architecture-gate blind spot.
- [Phase 01]: Route unreachable source-kind and required-version branches to operator decisions instead of adding dishonest tests.
- [Phase 01]: Keep disabled-row unparseable-hooks handling as an operator decision because current code and rationale disagree.
- [Phase 01]: Separate green baseline evidence from surviving mutations that confirm plugin-info test-strength gaps.
- [Phase 01]: Keep healthy direct coverage separate from surviving mutations that prove assertion-strength gaps.
- [Phase 01]: Route the unused authMemo option through an operator decision because deletion changes a public option interface.
- [Phase 01]: Plan 01-26: plugin-data-directory assertion gap is stale because the current equivalent mutation is killed by the owner suite.
- [Phase 01]: Plan 01-26: exact assignment validity requires the two corpus records to share one artifact commit.
- [Phase 01]: Plan 01-27 keeps evidence status independent from remediation routing for every preserved historical claim.
- [Phase 01]: Plan 01-27 closes claims only with positive current replacement or removal proof and routes surviving findings by concern.
- [Phase 01]: Plan 01-28 keeps direct owner-pair gaps live when related edge-handler coverage does not kill the focused mutation.
- [Phase 01]: Plan 01-28 routes the cross-suite filesystem injection seam to an operator decision and localized defects to their owning remediation phases.
- [Phase 01]: Preserve each actionable plugin-reinstall review statement as its own namespaced claim even when claims concern the same underlying defect.
- [Phase 01]: Route still-live plugin-reinstall findings to Phase 2 independently of evidence status.
- [Phase 01]: Keep D-11 test-strength claims inconclusive when no isolated surviving mutation was run.
- [Phase 01]: Plan 01-31 keeps D-11 test-strength claims inconclusive until an isolated surviving mutation supplies terminal proof.
- [Phase 01]: Plan 01-32 routes source-claimed marketplace plugin behavior, exhaustiveness fallbacks, the test-only export, and the state-read seam through operator decisions.
- [Phase 01]: Plan 01-32 preserves positive behavioral-test patterns separately from live remediation findings.
- [Phase 01]: [Phase 01-33]: Keep fourteen test-strength claims inconclusive because no isolated surviving mutation was run.
- [Phase 01]: [Phase 01-33]: Preserve structural, stale, clean-evidence, and cross-cutting corpus claims as separate identities.
- [Phase 01]: [Phase 01-34]: Keep persistence and platform test-strength claims inconclusive without isolated surviving mutations.
- [Phase 01]: [Phase 01-34]: Preserve structural, positive, and cross-cutting evidence separately from remediation routing.
- [Phase 01]: [Phase 01-35]: Use isolated surviving mutations to terminally confirm assertion-strength gaps despite green direct coverage.
- [Phase 01]: [Phase 01-35]: Keep evidence status independent from remediation routing for root-index and shared-concern claims.
- [Phase 01]: Treat green owner tests as executability evidence only, never as confirmation of named mutation strength.
- [Phase 01]: Keep mutation-dependent claims inconclusive when no isolated mutation was run, while confirming structural claims from current live evidence.
- [Phase 01]: Preserve shared-notify report-local claims in one exclusive validated shard with isolated mutation evidence.
- [Phase 01]: Preserve first-pass architecture-gate strengths as duplicate evidence without erasing later adversarial refinements.
- [Phase 01]: Retain the fallow planted-cycle limitation as deferred gate-integrity work because the current case proves only package-script shape.
- [Phase 01]: Route unsafe notification doubles, misplaced paired coverage, the ineffective hooks schema scan, and hidden clock/home dependencies to Phase 2.
- [Phase 01]: Keep structural readability, redundancy, naming, and module-size issues in the deferred backlog while retaining sound gate behavior as evidence-only closure.
- [Phase 01]: Route live configSource and manifest-read gate-strength gaps to Phase 2 and retain the command rollback-pair gap under its Phase 3 canonical finding.
- [Phase 01]: Close historical agents no-op and force/foreign blockers as stale only after positive current-suite proof.
- [Phase 01]: Keep structural cleanup and language-operator branch decisions separate from evidence status while retaining sound gates as evidence-only closures.
- [Phase 01]: Preserve all 55 first-pass hook-bridge claims while linking 39 overlaps directly to earlier canonical adversarial findings.
- [Phase 01]: Route the reproduced PID-table pre-await snapshot defect to Phase 2 while retaining shared-state, double, and structure work in Phase 3 or the deferred backlog.
- [Phase 01]: Keep the routing-state reset-export question under the existing operator decision and close only historical run-status or review-boundary claims with positive current evidence.
- [Phase 01]: Preserve all 60 hook execution, if-field, and payload claims while linking 39 overlaps directly to canonical adversarial findings.
- [Phase 01]: Use isolated surviving mutations to confirm the hook-environment restoration tautology, truncation maximality gap, and missing if-field runtime re-export proof.
- [Phase 01]: Keep evidence status independent from remediation route: 27 claims close as evidence and 33 remain in the deferred backlog.
- [Phase 01]: Preserve all 68 first-pass MCP, skills, and hook-component claims while linking 50 overlaps to canonical adversarial findings.
- [Phase 01]: Keep broad clean and no-blocker classifications traceable as superseded evidence instead of letting them override claim-level current findings.
- [Phase 01]: Use failing public MCP null-shape probes and surviving test-strength mutations only in a removable repository-local isolated copy.
- [Phase 01]: Preserve all 52 domain-component, core-domain, and resolver first-pass claims while linking 45 overlaps to canonical adversarial findings.
- [Phase 01]: Keep broad clean and purity statements traceable while allowing later claim-level evidence to qualify or supersede them.
- [Phase 01]: Reuse canonical operator-decision routes for the debug seam, Device Flow clock and readonly contracts, and resolver split.
- [Phase 01]: Preserve all 58 first-pass completion and handler claims while linking overlaps to already-revalidated canonical findings.
- [Phase 01]: Treat focused green suites as an executability baseline only; structural and assertion-strength routes remain governed by their current evidence.
- [Phase 01]: Keep cache ownership as an operator decision and route direct handler workflow seams to Phase 2 without weakening current whole-value assertions.
- [Phase 01]: Preserve all 49 edge-handler, edge-root, and import first-pass claims while linking exact overlaps to canonical adversarial findings.
- [Phase 01]: Treat both corrupt-state tool rejections as one behavioral production defect while retaining the host-catch question only as a severity caveat.
- [Phase 01]: Keep D-102-03 mutation-backed behavior independent from its recorder-style and missing-traceability routes.
- [Phase 01]: Preserve all 82 marketplace and plugin first-pass claims while linking exact overlaps to already-revalidated adversarial findings.
- [Phase 01]: Treat node:assert/strict aliases as positive stale proof against historical loose-comparison claims while keeping spellings as optional cleanup.
- [Phase 01]: Keep evidence status independent from route across Phase 2, Phase 4, Phase 7, backlog, closure, and operator-decision outcomes.
- [Phase 01]: Preserve all 83 plugin-orchestrator first-pass claims while allowing narrow mutation evidence to override broad clean-suite praise.
- [Phase 01]: Keep list and install module splits as operator decisions while routing assertion defects independently to Phase 2.
- [Phase 01]: Treat the shared strict output literal and centralized network gate as valid test design, not defects.
- [Phase 01]: Preserve all 61 orchestrator-root, persistence, and platform first-pass claims while linking overlaps to their existing canonical adversarial findings.
- [Phase 01]: Treat the isolated GitOps fake auth DataCloneError as current behavioral proof for PLT-F020 while keeping green owner suites as executability evidence only.
- [Phase 01]: Preserve all 58 entrypoint and shared first-pass claims while linking exact overlaps to existing canonical adversarial findings.
- [Phase 01]: Treat focused green suites as executability evidence only and retain mutation-dependent clock and unlink claims under their existing inconclusive canonical records.
- [Phase 01]: Preserve all 60 first-pass notify and transaction claims while linking exact overlaps to existing canonical adversarial findings.
- [Phase 01]: Treat complete direct coverage as positive stale proof for the historical isLockHeldError branch gap without weakening separate assertion-strength findings.
- [Phase 01]: Keep the synchronous String.prototype patch as deferred shared-process cleanup because current execution proves no leak but a non-global seam is preferable.
- [Phase 01]: Keep incomplete-file, inconclusive-finding, and pending-decision allowances independent; pending decisions are allowed only when their IDs are exactly MF-DEC-01 through MF-DEC-09.
- [Phase 01]: Preserve retired or test-only evidence as explicit N/A trace records when no live one-to-one owner exists, rather than inventing a replacement or deleting history.
- [Phase 01]: Defer every semantic duplicate/conflict adjudication and operator evidence choice to plans 01-56 and 01-57.
- [Phase 01]: Point every source claim and duplicate directly to its terminal canonical finding while retaining duplicate-local claim IDs and evidence records.
- [Phase 01]: Use existing surviving-mutation or behavioral-probe evidence when it is stronger than a canonical root's static proof; preserve method-specific local evidence on duplicate records.
- [Phase 01]: Leave 109 genuinely unresolved findings inconclusive for plan 01-57 and leave MF-DEC-01 through MF-DEC-09 pending without making operator decisions.
- [Phase 01]: Resolve every one of the 109 remaining evidence gaps with bounded case-owned-copy probes or stronger current proof, without altering live production or test source.
- [Phase 01]: Classify the 109 gaps strictly from proof as 103 confirmed, four duplicate, and two stale; never treat a green baseline alone as terminal test-strength evidence.
- [Phase 01]: Preserve exactly MF-DEC-01 through MF-DEC-09 as pending and validate the terminal ledger with only the pending-decision allowance.
- [Phase 01]: Select trace-preserving removal for MF-DEC-01: remove dead or no-producer branches and dishonest cases, preserve only compiler-required or genuinely safety-critical checks with current evidence, and replace reachable surgery with case-owned behavior.
- [Phase 01]: Route MF-DEC-01 through PDEF-01/PDEF-07, TREF-03, TREF-06, TREF-08, and RCOV-02; pid-table source context authorizes no change without a dedicated terminal finding.
- [Phase 01]: Close MF-DEC-04 without an operator choice because its sole specific premise SNC-F001 is stale and current install/update/reinstall cascade paths disprove the historical 18-of-19 census.
- [Phase 01]: MF-DEC-04 authorizes no global renderer change; preserve SNA-F010, SNC-F002, OPM-F04, and SNC-F019 in Phase 2 and OPM-F05 in Phase 6 under their existing destinations.
- [Phase 01]: Resolve declared plugin marketplace aliases through a one-to-one source-claim map while preserving manifest-derived canonical state identity; fail closed on a missing or ambiguous mapping.
- [Phase 01]: Route MF-DEC-05 implementation through Phase 3 PDEF-08 and its distinct alias/tools fixed-point regression through PDEF-01; preserve ORA-F04, ORA-F07, and ORA-F13 independently.
- [Phase 01]: Enforce structural single/plural cardinality at every notifyWithContext producer and honor plural tallies without inferring cardinality from rendered row count.
- [Phase 01]: Route MF-DEC-06 through Phase 3 PDEF-01 and Phase 6 TREF-07; named autoupdate is single, a bare sweep is plural, and plural list bare headers still produce no tally.
- [Phase 01]: Execute the complete resolver, notify, install, update, reinstall, list, and catalog split program only after its correctness and test-strength prerequisites; file size alone never authorizes extraction.
- [Phase 01]: Route approved splits through Phase 6 TREF-09 with mirrored owner tests, one end-to-end proof per flow, no test-only exports, direct-pair coverage, and mandatory gate, documentation, ownership, and completeness repointing; keep info deferred and uninstall unsplit.
- [Phase 01]: Preserve applyReconcile and bootstrapClaudePlugin as the only two demonstrated behavioral-composition exceptions instead of adding production dependency seams solely for interaction tests.
- [Phase 01]: Phase 5 TREF-04 must exempt only those observed flows while preserving their public-result, full state/configuration/tree, and exact-notification assertions; add no test-only exports or injection seams for them.
- [Phase 01]: Classify each builtin-patching use and eliminate process-global mutation, using case-owned temporary filesystem behavior by default and narrow production-owned ports only for irreproducible faults, timing, schedules, or rollback control.
- [Phase 01]: Coordinate MF-DEC-07 through Phase 5 TREF-04, Phase 6 TREF-08, and the TREF-09 split sequence without test-only exports, __deps additions, unused defaults, dead seams, or weakened observable assertions.
- [Phase 01]: Adopt production-role names for the 16 traced makeMockGitOps, makeMockCredentialOps, and makeMockDeviceFlowHttp factories across 10 files while preserving their typed, hermetic, fail-closed behavior.
- [Phase 01]: Route MF-DEC-08 through Phase 4 TREF-02 and TREF-03, align project conventions and production comments, and require separate terminal trace before renaming makeMockPi or unrelated *Fake families.
- [Phase 01]: Enforce the strict changed-pair direct-coverage gate through both a scoped local pre-commit hook and a dedicated CI job with shared fail-closed selection.
- [Phase 01]: Route MF-DEC-09 through GGAT-01, RCOV-01, RCOV-02, RCOV-03, and CLOSE-01. Keep all-pair reports honest and keep assertion-strength evidence independent from numeric coverage.
- [Phase 01]: Cover all 32 current requirement IDs and all eight stable Phase 2-9 routes exactly once in the terminal evidence-backed scope-impact crosswalk.
- [Phase 01]: Narrow or split mixed scope in place, move unsupported AGCOL-01 and superseded standalone COV-01 work to evidence, and preserve every stable requirement ID and later phase number.
- [Phase 01]: Do not activate the folded unused-type-member todo or named GAUTH-01 wiring without a dedicated terminal canonical finding inside the unit-test-quality boundary.
- [Phase 01]: Keep 30 active or complete requirements mapped exactly once and retain GGAT-02 and RCOV-04 as explicit evidence/history identities rather than executable work.
- [Phase 01]: Preserve Phase 2-9 numbering with active requirement counts 3/5/4/3/3/3/3/2 and round-trip every planning edit through one of 40 canonical before/after anchor pairs.
- [Phase 01]: Keep the unused-type-member todo and named GAUTH-01 prescription historical until a dedicated terminal finding authorizes in-boundary work.
- [Phase 01]: Seal the final ledger at 110 complete files, 2,897 linked claims, 2,437 terminal findings, nine resolved decisions, and 40 validated scope rows before Phase 02 planning.
- [Phase 01]: Treat the Plan 01-69 Prettier repair as formatting-only because normalized parsed-JSON digests remained equal for all 26 files.
- [Phase 02]: Stage owns the shared MCP classifier and typed error so unstage can reuse the policy without an import cycle.
- [Phase 02]: Existing MCP callers propagate malformed-field failures without new lifecycle result arms or translations.
- [Phase 02]: Own-property absence remains a no-op while every present non-record JSON value fails closed.
- [Phase 02]: Reject a raw child component exactly equal to .. before resolution or filesystem inspection; normalize only refused diagnostics.
- [Phase 02]: Use one normalized parent-child pair for every accepted-path containment decision, error, relative segment, and lstat walk.
- [Phase 02]: Keep production consumers byte-identical because all live callers inherit the repaired shared pre-I/O assertion.
- [Phase 02]: Catch only aggregateDiscoveredResources and its result projection at the registered host callback; keep reconciliation, PATH recompute, and the aggregator unchanged.
- [Phase 02]: Prove transient aggregate failure with one exact-path, explicitly non-concurrent built-in mock; restore and re-synchronize it before invoking the same registered callback again and in teardown.
- [Phase 02]: Retain the per-warning try/catch and prove both user and project warning attempts under a notifier that throws on every call.
- [Phase 01]: Parse requirement definitions separately from traceability dispositions so moved evidence-only IDs remain stable without authorizing active work. — Preserves D-19 and D-21.
- [Phase 01]: Validate Phase 2-9 membership against traceability and require qualified after anchors. — Enforces D-20 and D-23.
- [Phase 03]: Resolve every marketplace source claim before building mutation buckets so declaration order cannot select a canonical identity. — A complete claim graph makes zero, unique, ambiguous, and multiply claimed cases explicit and deterministic.
- [Phase 03]: Represent alias ambiguity with the existing source-mismatch plan result. — The existing result is structured and report-only, so no new public error surface is needed.
- [Phase 03]: Retain conflicted canonical candidates and suppress dependent plugin actions. — Fail-closed reconciliation must report ambiguity without choosing, adding, removing, installing, or uninstalling involved state.
- [Phase 03]: Resolver order is authoritative for multi-directory agent discovery; later duplicate names warn and never replace the first artifact.
- [Phase 03]: Install preview and live staging share the same ordered agentsDirs list so conflict detection and materialization cannot drift.
- [Phase 03]: The singular agent source compatibility union is temporary and will be deleted after update/reinstall migrate in Plan 03-03.
- [Phase 03]: Compact payloads map manual to manual and both threshold and overflow to auto through typed reason discriminants.
- [Phase 03]: PreCompact and PostCompact matcher supportability publishes exactly the manual and auto values emitted by translation.
- [Phase 03]: Open hook selector strings resolve through readonly maps built from exhaustive typed records, so inherited object keys are never accepted.
- [Phase 03]: Synchronous dispatch indexes the total admitted-event translator table directly; only its cast-created no-producer fallback was removed.
- [Phase 03]: Derive marketplace autoupdate and list cardinality from invocation structure before result collection. — Named autoupdate is single; no-name autoupdate and list are plural even with zero or one rows.
- [Phase 03]: Render zero successes for an otherwise empty default plural tally. — A structural plural operation must remain visibly plural when it produces no rows; explicit tally overrides keep their prior behavior.
- [Phase 03]: Stamp statusless marketplace-list inventory rows as informational operations. — The rows must count in the list tally without changing their rendered bytes or UI severity.
- [Phase 03]: Marketplace add, remove, and named update are single; all-target update is plural before result discovery. — Invocation structure owns tally semantics, so empty, one-result, and many-result executions remain consistent.
- [Phase 03]: All-target marketplace update preserves one notification per target while threading plural cardinality to each. — The notification metadata correction must not change transaction or sequencing behavior.
- [Phase 03]: Marketplace mutation catalog fixtures cover D-28 exact output alongside owner tests. — New aggregate tally bytes are part of the public notification contract.
- [Phase 03]: Update and reinstall reuse discovery's ordered agentsDirs list for preview, staging, and rollback. — One resolver-owned representation prevents preview and mutation from observing different directory subsets.
- [Phase 03]: The singular agentsSourceDir compatibility member, helper, and bridge input union are removed. — All production consumers now accept the promoted ordered-list contract.
- [Phase 03]: Multi-directory test fixture branches were extracted instead of suppressed. — Fallow identified two new cognitive-complexity breaches, and small helpers restored the health gate.
- [Phase 03]: Install delegates rollback error identity, containment suppression, and partial wrapping to transaction/rollback.ts. — The failed ledger boundary now has one production rule before notification projection.
- [Phase 03]: The existing transaction rollback matrix was retained without duplicate cases. — It already proves ordinary and containment identity plus one, multiple, and repeated partial-row behavior.
- [Phase 03]: Remove the value-dead dispatchable tuple with its runtime guard; retain DispatchableEvent as an exact BucketAEvent compatibility alias. — Both producer unions are equal, exhaustive translator records enforce totality, and keeping duplicate metadata required an unused-value lint exemption.
- [Phase 03]: Reconcile pending tallies count actionable plugin leaves or standalone failed marketplace blocks; neutral marketplace headers remain structural context. — This preserves the central cascade tally contract while making the producer-owned plural cardinality explicit.
- [Phase 03]: Known uninstall, update, and marketplace reasons derive from typed identities and stable errno codes, never message keywords.
- [Phase 03]: Update cleanup failures remain immutable secondary context; the original operational Error stays primary and successful cleanup stays silent.
- [Phase 03]: Plugin notification cardinality derives from parsed invocation shape before result enumeration; named targets are single and list or container-wide targets are plural.
- [Phase 03]: Shared plugin emitters require caller-owned cardinality instead of inferring it from the number of result rows.
- [Phase 03]: Lifecycle cardinality follows parsed target structure before rows exist. — Result count cannot distinguish a named target from a bulk invocation that produced one or zero rows.
- [Phase 03]: Empty bulk update retains its fixed no-op headline. — The update no-op contract is independent from realized-transition tally arithmetic.
- [Phase 03]: Structural cardinality is mandatory at notifyWithContext — Producer invocation shape, not rendered row count, determines whether a tally is required.
- [Phase 03]: Scope-narrowed fan-out commands remain plural — Filtering a plural command to one result must still render its operation tally, while named singular commands remain tally-free.
- [Phase 03]: Plugin-list projections validate their exact aggregate trailer — Reduced row comparisons must not hide a missing or inaccurate user-visible tally.
- [Phase 04]: Hermetic user-scope fixtures control `HOME` and `PI_CODING_AGENT_DIR` beneath one case-owned root and restore both variables by original property presence.
- [Phase 04]: Shared Git fake snapshots preserve function-bearing authentication bundles and callback identity while copying only mutable data fields.
- [Phase 04]: Production consumers declare narrow Pi ports; local configurable doubles use role-only names while reusable concern-owned abstractions retain `create*Fake` names.
- [Phase 05]: Create exactly one HooksRuntime in the extension root and require it together with the state reader for hook hydration.
- [Phase 05]: Guard all retained Pi callbacks by runtime generation before any callback argument or mutable state is touched.
- [Phase 05]: Keep Node-backed compatibility exports while live runtime callbacks bridge owned routes into the legacy dispatch boundary.
- [Phase 05]: Ratify the reviewed 13-file/85-call and 9-file/9-call Phase 6 patch manifests with exact historical attribution. — Fresh independent verification confirmed the current inventory is intentional Phase 5 port and lifecycle evidence, not forbidden early Phase 6 work.
- [Phase 05]: Treat the in-place .mcp.json format stop as a workspace obstruction only after clean tracked HEAD passes canonical checks. — The user-owned untracked file remained byte-identical while the clean detached worktree passed npm run check end to end.
- [Phase 05]: Preserve the exact sole Fallow complexity suppression until the planned Phase 01-71 refactor. — Fallow reports zero above threshold and Phase 5 added no suppression or implementation repair.
- [Phase 06]: Structural invocation form remains authoritative when identical row counts require different single/plural output.
- [Phase 06]: Lifecycle output contracts compare complete ordered notification arrays and severity behind explicitly sized strict doubles.
- [Phase 06]: The MF-DEC-01 census is bound to exactly 24 resolved finding IDs and explicit current routes; ER-F19 remains reserved for Phase 8.
- [Phase 06]: Bridge lifecycle proofs use case-owned state plus existing readers, executors, runtimes, and public results; no test-only production export is added.
- [Phase 06]: Irreproducible builtin timing cases are removed only where an existing production port or direct owner retains the same public failure or convergence contract.
- [Phase 06]: Install schedule evidence observes a case-owned InstallTransaction phase ledger instead of Node's shared filesystem module.
- [Phase 06]: Reinstall lifecycle faults use existing persistence, cache, data, and routing ports or real case-owned filesystem state.
- [Phase 06]: Index and import tests use case-owned path/state outcomes instead of shared builtin mutation. — Public registration, persisted bytes, notifications, and recovery remain exact without primitive interception.
- [Phase 06]: Scope inventory captures a direct readdir import before protected owner mocks are armed. — The helper remains independent without createRequire while protected stage and uninstall exclusions stay unchanged.
- [Phase 06]: Raw patch census counts executable source sites, not validator fixture literals. — Runtime fixture assembly preserves the closure test while making the required 2/18 and 2/2 census deterministic.
- [Phase 06]: All resolver type consumers import resolver-types.ts directly; resolver.ts exposes no compatibility type or schema facade.
- [Phase 06]: Unsupported-component discovery receives StatKindReader directly, keeping filesystem implementation ownership in the resolver while the closed policy remains a leaf.
- [Phase 06]: Exact tuple and row-precedence assertions moved to the unsupported-components owner; resolver tests retain only composed resolver behavior.
- [Phase 06]: component-paths.ts owns relative-path validation and symlink-aware root containment; resolver.ts only supplies filesystem collaborators and composes the result.
- [Phase 06]: mcp-resolution.ts consumes the component-path containment owner and existing MCP validator directly, preserving domain-to-bridge dependency direction.
- [Phase 06]: Strict MCP referenced-file reads stay outside the JSON parse catch so real I/O failures retain outer probe classification.
- [Phase 06]: hooks-resolution.ts owns hook parsing, dropped-hook ordering, and orphan-rewake classification behind narrow filesystem collaborators.
- [Phase 06]: plugin-resolver.ts is a genuine composition owner; remaining legacy resolver callers migrate directly in Plans 06-08 through 06-11.
- [Phase 06]: Exported resolver leaves inline narrow parameter shapes rather than exporting implementation-only interfaces.
- [Phase 06]: Plan 06-08 preserved fetch's lazy resolver load while moving the module path directly to plugin-resolver.ts.
- [Phase 06]: Plan 06-08 kept info behavior and public APIs unchanged while moving only resolveStrict ownership.
- [Phase 06]: Plan 06-09: resolver runtime callers import directly from plugin-resolver.ts; already-direct resolver-types.ts consumers stay unchanged.
- [Phase 06]: Plan 06-10: resolver runtime behavior references map to plugin-resolver.ts while resolver result vocabulary remains owned by resolver-types.ts.
- [Phase 06]: Plan 06-10: already-direct bridge test imports are verified in place without empty process-only commits.
- [Phase 06]: Authorized resolver deletion only after fresh CodeGraph evidence and a complete READY PRE-EDIT ledger.
- [Phase 06]: Removed the duplicate resolver hub without a compatibility facade; plugin-resolver remains the sole composition owner.
- [Phase 06]: Preserved already-correct scoped caller tests byte-for-byte, including the protected skills stage test.
- [Phase 06]: 06-12: Moved every live consumer to direct notification-type and redactor owner imports; notify.ts keeps no compatibility re-export.
- [Phase 06]: 06-12: Preserved absolute-path redaction bytes and the defensive no-separator branch in the security leaf.
- [Phase 06]: Kept notification-info rendering inside notification-grammar.ts to preserve the locked 30-module inventory.
- [Phase 06]: Moved every grammar and comparator consumer to a direct named-owner import with no compatibility export.
- [Phase 06]: Summary composition returns an exact notification tuple; only notification-dispatch.ts consumes it at the Pi boundary.
- [Phase 06]: Structural notification cardinality is producer-selected and never recomputed from rendered row count.
- [Phase 06]: All live dispatch consumers were repointed atomically without a compatibility facade.
- [Phase 06]: Keep every 06-14 direct dispatch import unchanged; do not create churn in already-correct callers.
- [Phase 06]: Point authentication callback documentation to makeRawNotifyFn and error rendering documentation to notification-grammar.ts.
- [Phase 06]: Leave all eight 06-16 handlers byte-for-byte unchanged because Plan 06-14 already migrated every notification call to the genuine notification-dispatch owner.
- [Phase 06]: Treat notify and notifyUsageError as genuine dispatch-owner implementations, not compatibility seams; both render or dispatch directly to the Pi notification context.
- [Phase 06]: Leave all seven 06-17 consumers byte-for-byte unchanged because Plan 06-14 already migrated every notification symbol to its genuine named owner. — Avoids no-op import churn while retaining complete ownership and behavior proof.
- [Phase 06]: Keep tools on notification-types.ts and root raw notifications on notification-dispatch.ts. — Each consumer imports only the genuine owner of the symbol it uses.
- [Phase 06]: Keep all seven already-direct notification import graphs unchanged; only four stale documentation references required repointing.
- [Phase 06]: Treat notify-context.ts as the genuine command-context composition owner whose dispatch tail imports notification-dispatch.ts directly, not as a compatibility facade.
- [Phase 06]: Keep all seven already-direct notification import graphs unchanged; only six stale documentation references required repointing. — Avoid import churn after Plan 06-14 completed the atomic caller migration.
- [Phase 06]: Preserve uninstall as a cohesive transaction; its only 06-21 change is one stale-path prose correction in uninstall.messaging.ts. — Honor the user-authorized uninstall exception and keep all observable behavior unchanged.
- [Phase 06]: Leave all eight scoped consumers byte-for-byte unchanged because Plan 06-14 already migrated every notification symbol to its genuine named owner. — Avoids no-op import churn while preserving direct ownership evidence.
- [Phase 06]: Retain notify-context.ts as the genuine command rendering and dispatch composition owner. — It calls notification-dispatch.ts directly and exposes no shared/notify.ts compatibility facade.
- [Phase 06]: Keep all eight already-direct notification import graphs unchanged; repoint only seven stale owner comments.
- [Phase 06]: Keep info.ts cohesive and byte-for-byte unchanged because its notification imports already name direct owners.
- [Phase 06]: Keep all eight already-direct notification import graphs unchanged; only three explicit legacy-hub prose references required repointing.
- [Phase 06]: Retain notify-context.ts as the genuine command rendering and dispatch composition owner because it calls notification-dispatch.ts directly and exposes no compatibility facade.
- [Phase 06]: Keep all seven already-direct runtime import graphs unchanged; Plan 06-14 had completed the executable migration, leaving only stale ownership prose.
- [Phase 06]: Attribute each structured notification concern to its narrow owner: notification-types.ts, notification-grammar.ts, notify-context.ts, or notification-dispatch.ts.
- [Phase 06]: Keep all eight already-direct architecture import and scan graphs intact; only stale owner prose required repointing.
- [Phase 06]: Attribute catalog rendering bytes and the closed glyph export census to notification-grammar.ts, while notification-dispatch.ts remains the sole Pi output owner.
- [Phase 06]: 06-25: Attribute reload policy and its independently mirrored trailer literal to notification-summary.ts while retaining notification-dispatch.ts as the sole observable output owner.
- [Phase 06]: 06-25: Keep the four already-direct scoped files byte-identical and avoid empty process-only commits.
- [Phase 06]: Keep the seven already-direct executable tests byte-identical, including captured arrays and protected uninstall fixtures/assertions.
- [Phase 06]: Retire the process-only notify marker case without duplicating it in a genuine direct-owner test.
- [Phase 06]: Retain the content-free legacy test until Plan 06-27 atomically deletes it with notify.ts; accept one documented correspondence transient.
- [Phase 06]: Retire notify.ts without a compatibility facade only after a fresh CodeGraph trace and a complete READY PREEDIT ledger.
- [Phase 06]: Assign notification responsibilities to exactly six genuine owners with mirrored direct tests.
- [Phase 06]: Rotate the generic PREEDIT checker fixture to the catalog UAT hub retained through Plan 06-32 and deleted by Plan 06-33.
- [Phase 06]: Recognize exactly the existing 20 catalog surfaces while leaving documented out-of-band annotations outside the catalog-driver contract.
- [Phase 06]: Reject malformed catalog tuple boundaries with stable line-numbered diagnostics instead of silently skipping or overwriting state.
- [Phase 06]: Keep catalog parsing, fixture contracts, and strict Pi helpers test-only and independent from producer owner tests.
- [Phase 06]: Plan 06-29 gives each extracted catalog fixture module exactly one typed command-section map. — Single-section ownership keeps the five Wave 21 slices disjoint and makes inverse completeness explicit.
- [Phase 06]: Plan 06-29 keeps list and update command-specific emit seams local to their fixture owners. — Those seams exercise real command rendering for states the generic notification dispatcher does not own.
- [Phase 06]: Plan 06-29 leaves the shared catalog driver unchanged for Plan 06-33. — The downstream serialized plan owns atomic driver repointing and hub deletion across all 20 fixture slices.
- [Phase 06]: Plan 06-30 gives each fetch/import/bootstrap/marketplace-list/marketplace-add fixture module one typed command-section map. — Single-section ownership makes the Wave 21 slices disjoint and inverse completeness explicit.
- [Phase 06]: Plan 06-30 leaves the shared catalog driver and 06-29 fixture maps unchanged for Plan 06-33. — The serialized downstream plan owns atomic driver repointing and final hub deletion.
- [Phase 06]: Plan 06-30 keeps all ten Wave 21 unused fixture exports unsuppressed. — Plan 06-33 is their designated consumer; suppressions would hide an incomplete caller migration.
- [Phase 06]: Plan 06-33 uses the live 23,732-byte catalog total because 17,455 omitted Plan 06-31's verified 6,277-byte slice.
- [Phase 06]: Plan 06-33 rotates the generic PREEDIT lifecycle fixture to the exact Plan 06-34 plugin install hub and owner test.
- [Phase 06]: Plan 06-33 deletes the catalog UAT hub only after a fresh acyclic READY ledger and complete direct repointing.
- [Phase 06]: install-flow.ts exclusively owns the public install transaction types and factories; install.ts retains only the guard-free ledger.
- [Phase 06]: install-outcome.ts projects complete readonly ledger facts so the flow never consumes mutable ledger internals.
- [Phase 06]: Plan 36 already completed every 06-37 caller and gate migration that required a change; Plan 37 verified it without redundant edits.
- [Phase 06]: The manifest and no-network gates retain install.ts coverage because the live ledger still owns those responsibilities.
- [Phase 06]: The install ledger executor and mutable context are private to install-outcome.ts behind runInstallLedger.
- [Phase 06]: The single complete install flow and Plan 06-01 exact notification arrays remain in install-flow.test.ts without duplicated cases.
- [Phase 06]: The generic lifecycle PRE-EDIT fixture advances to the update.ts/update.test.ts pair.
- [Phase 06]: preparePluginUpdate owns update membership, candidate, clone-probe, version, and disabled-refresh decisions.
- [Phase 06]: swapPluginUpdate consumes PreparedPluginUpdate and owns bridge staging, rollback, intent marking, finalization, and cleanup.
- [Phase 06]: UpdatePluginsFn lives with UpdatePluginsOptions in update-preflight.ts; handler and register use the owner directly.
- [Phase 06]: composeUpdateCascade owns UpdateHooksRouting and the exact update result fold.
- [Phase 06]: update-flow.ts owns public update operation construction and directly binds preflight, swap, and cascade.
- [Phase 06]: update.ts remains a genuine enumeration/failure owner and generic hub-ledger pair until scheduled retirement.
- [Phase 06]: Plan 06-41: Repoint only genuinely stale update-hub references; retain update.ts references that still describe behavior-bearing enumeration, failure projection, lifecycle guarding, or the generic hub ledger.
- [Phase 06]: Plan 06-41: Accept verified Plan 39/40 caller and scanner migrations as pre-completed work without duplicate churn.
- [Phase 06]: Plan 06-42 accepted the seven consumer migrations in 2f0126cb as pre-completed and verified them without duplicate churn.
- [Phase 06]: Plan 06-42 retained valid update.ts and update.test.ts references for behavior-bearing enumeration and the generic hub ledger until Plan 43.
- [Phase 06]: Move behavior-bearing update orchestration into update-flow.ts as private implementation details while preserving the established public flow API.
- [Phase 06]: Rotate the generic hub-ledger fixture to reinstall.ts/reinstall.test.ts before retiring update.ts/update.test.ts.
- [Phase 06]: Keep ReinstallPluginsOptions and flow factories in reinstall.ts until the locked flow-owner plan; move only target selection and clone probing now.
- [Phase 06]: Preserve bare-scope parallel reads plus a confirmation read so target ordering and concurrent-removal attribution remain exact.
- [Phase 06]: Make probeReinstallClone own the optional production materialization seam and consume the recorded sha without remote ref resolution.
- [Phase 06]: Keep reinstall flow factories and register wiring in reinstall.ts until locked Plan 46 so the hub remains genuine.
- [Phase 06]: Use an opaque replacement compensation token so rollback and finalize retain the physical operation owner that performed replacement.
- [Phase 06]: Make skipped and failed reinstall record outcomes non-mutating; only the reinstalled arm writes persisted state.
- [Phase 06]: Make reinstall-flow.ts the exclusive owner of public reinstall options, dependency contracts, function types, and factory exports.
- [Phase 06]: Expose a typed ReinstallFlowOwners bundle and real sequencing functions from reinstall.ts instead of a compatibility re-export or forwarding facade.
- [Phase 06]: Migrate every live public factory and type caller atomically with the owner move.
- [Phase 06]: Gate both reinstall-flow.ts and the retained reinstall.ts sequencer during the ownership transition so no temporary coverage gap exists.
- [Phase 06]: Keep the manifest raw-lookup exemption on reinstall.ts until the lookup itself moves; unused exemptions weaken the scanner and fail its stale-entry proof.
- [Phase 06]: 06-48: Delete reinstall.ts and reinstall.test.ts only after a fresh CodeGraph-backed READY ledger maps every owner and dependency without a cycle.
- [Phase 06]: 06-48: Make reinstall-flow.ts the sole public and behavior-bearing owner; retain no forwarding facade or compatibility re-export.
- [Phase 06]: 06-48: Rotate the generic lifecycle checker to the live list hub/test pair before removing its reinstall fixture.
- [Phase 06]: Plan 06-49: Keep composeInstalledListRow as the sole installed-inventory projector over validated record, lookup, scope, and filesystem facts.
- [Phase 06]: Plan 06-49: Move availableRowMessage with its public name into list-candidate-row.ts while the list hub retains filtering, folding, ordering, and dispatch.
- [Phase 06]: Keep clone identity, installed-inventory fold selection, and canonical name/scope ordering in the pure list-orphan-fold owner.
- [Phase 06]: Move the complete existing list owner corpus to list-flow.test.ts so every flow branch remains directly covered without weakening exact output assertions.
- [Phase 06]: Vacate the legacy list.ts pair without a forwarding export; Plan 51 remains responsible for its fail-closed repointing ledger and deletion.
- [Phase 06]: Retain list behavior in four direct owners; delete the vacated legacy hub and test with no compatibility facade.
- [Phase 06]: Use neutral PRE-EDIT checker fixtures while production closure enforces the exact seven retired hub paths.
- [Phase 08]: 08-01: the report's pair-enumeration control plants the arity state against exported pairForPath, proving the failure mode is refused inside npm run check rather than pinning the repaired line
- [Phase 08]: 08-01: a green pre-commit --all-files took four hooks, not one; the six files trailing-whitespace, end-of-file-fixer and mdformat rewrite were committed as the hooks produce them
- [Phase 08]: 08-01: trufflehog cannot run in a linked worktree (no <root>/.git/index), so every --all-files green claim carries SKIP=trufflehog and CI closes the gap
- [Phase 08]: 08-02: the three dense-index guards rewrite to typed iteration plus an explicit skip flag — entries() only where a loop reads a neighbour by index, bare for...of otherwise; no ! and no as, and no pin row for any of the three
- [Phase 08]: 08-02: two of the four requested preservation cases already existed and were not duplicated; the property the shared.ts case pins was stated in the owner header instead, replacing a D-116-01a paragraph the rewrite made false
- [Phase 08]: bridges/hooks/event-router.ts gets tests, not a pin: all four generationIsCurrent guards reached through injected collaborators (D-08-A04 discharged by measurement)
- [Phase 08]: Site 614-616 is the one guard with no named trigger: nothing injected runs between the containment guard and the hooks.json-read guard, so its case keys the advance on the third guard consultation after the injected state read and asserts the consequence
- [Phase 08]: Sites 586-588 and 552-554 need the factory-time hydrate, not hydrateProjectScopeForCwd: only hydrateCacheFromDisk lacks a guard between the state read and hydrateScopeFromState
- [Phase 08]: RemovalOps is the only required *Ops in the tree: no optional marker, no DEFAULT_REMOVAL_OPS, composition roots supply it (D-08-12)
- [Phase 08]: clone-cache.ts and marketplace/add.ts construct the removal port locally rather than taking it on their public args, which would have broken five files outside the plan's blast radius
- [Phase 08]: ReinstallReplacement retains removalOps so compensation cleans up through the collaborator the forward pass used
- [Phase 08]: The leaked-residue partition is read from real disk through a delegating removal collaborator; the in-memory fake removes nothing, so the unfaulted half is unstatable through it
- [Phase 08]: A restore whose source path is minted by an unported forward call is faulted on its rename DESTINATION, the one key the case can know before the act
- [Phase 09]: D-09-08 shape: a one-member HooksFileReader, with HooksHydrationReader extending it — Rejected the merged HooksReader that hands createHooksRouting a loadState it never calls; extends keeps one read port, one member set, and no unused member at either factory
- [Phase 09]: readHooksJson lives in bridges/hooks/stage.ts — stage.ts already owns the hooks file primitives and an injected read-only fs port; a new reader.ts would add a 231st source-test pair for one function
- [Phase 09]: Tests pass the production readHooksJson at every pre-existing call site — Those sites read the real file today, so the port must change no behavior; only the staleness case substitutes a reader, and it delegates to the production one

### Pending Todos

None for roadmap creation.

### Blockers/Concerns

- `gsd-tools query phase.complete` cannot write root planning files while the
  three archived workstream directories remain. The active `refine-unit-tests`
  milestone is root-scoped, so the Phase 2 through Phase 4 canonical transitions
  were simulated in isolated flat copies, inspected, and applied by hand. Later
  phase transitions will require the same guarded procedure unless workstream
  routing is repaired.
- RESOLVED by 117-12: D-117-20 in `117-CONTEXT.md` now reads 190 complete numeric records + 7 accepted D-116-01a shortfalls + 7 type-only, matching the operator decision taken in plan 117-11 and the retained all-pair artifact. The superseded 197 + 7 wording is gone.
- WINDOWS.md entries 19, 21 and 22 still read open after 08-02 removed the arms they describe: gsd-tools windows fixed refuses because the rendered table disagrees with the fenced JSON on unrelated rows 9 and 30, a desync predating phase 08. Logged in .planning/phases/08-direct-coverage/deferred-items.md; 08-08 is the natural owner since it also holds the stale CONTRIBUTING.md rows for the same three modules.

## Deferred Items

| Category       | Item                                                                                                                                                                                          | Status          | Deferred At          | Milestone |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------- | --------- |
| Tooling        | Detect unused code and unused type members — no gate reports a type member nothing reads (measured: typecheck, lint, and fallow all pass with one planted)                                    | Pending         | Phase 116 discussion | v1.19     |
| quick_tasks    | 260720-d8i-move-agent-provenance-from-body-comment-                                                                                                                                           | unknown         | 2026-09-04           | v1.19     |
| todos          | 2026-09-02-detect-unused-code-and-type-members.md                                                                                                                                             | (presence-only) | 2026-09-04           | v1.19     |
| uat_gaps       | 89/89-UAT.md (archived v1.16)                                                                                                                                                                 | passed          | 2026-09-04           | v1.19     |
| uat_gaps       | 63/63-UAT.md (archived v1.13)                                                                                                                                                                 | passed          | 2026-09-04           | v1.19     |
| uat_gaps       | 56/56-UAT-FIX-2.md (archived v1.12)                                                                                                                                                           | all_fixed       | 2026-09-04           | v1.19     |
| uat_gaps       | 56/56-UAT-FIX.md (archived v1.12)                                                                                                                                                             | all_fixed       | 2026-09-04           | v1.19     |
| deferred_items | 112/deferred-items.md: Phase 112 deferred items - `npm run check` reaches `format:check` but reports pre-existing format differences in user-owned, untracked `.mcp.json` and                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 1. Stale test path in an `install.messaging.ts` doc comment - **Found during:** 117-04 Task 1 - **File:** `extensions/pi-claude-marketplace/orchestrat                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 2. Stale byte-form-lock path in the output catalog - **Found during:** 117-05 Task 1 - **File:** `docs/output-catalog.md` (the `### Device Flow user-c                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 3. Stale `tests/helpers/` references throughout the codebase map - **Found during:** 117-07 Task 1 - **File:** `.planning/codebase/TESTING.md` (lines                  | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 4. RESOLVED - `--all` cannot complete: the seven D-116-01a shortfalls are accepted - **Found during:** 117-11 Task 2 - **File:** `scripts/test-coverag                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 5. RESOLVED - The PATH interpreter was upgraded mid-phase and reddened 11 tests - **Found during:** 117-11 Task 2 - **File:** ten test suites, led by                  | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 6. RESOLVED - The direct-coverage sweeps still have no automated control **Resolved 2026-09-04 by operator decision.** Two parts, closed differently:                  | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 90/deferred-items.md (archived v1.17): 90-03 execution - **Pre-existing environment failure (pi-subagents global peer):** two integration tests in `tests/integration/skill-path-resolution.t | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 86/deferred-items.md (archived v1.15): Pre-existing integration test failures (NOT introduced by Plan 03) Two `tests/integration/*` cases fail on the current branch. They fail IDENTICALLY w | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 85/deferred-items.md (archived v1.14): Pre-existing integration-test failures (unrelated to this phase) `npm run test:integration` reports 2 failures that also fail on the base commit `2aa2 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 50/deferred-items.md (archived v1.11): Pre-existing test failure: reinstall README documentation gap - **Test:** `tests/architecture/reinstall-docs.test.ts` -- "PRL-01/03/04/05/13/14/15/16: | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 25/deferred-items.md (archived v1.4.1): `tests/e2e/import-command.test.ts` 3 failures (`import imports enabled Claude settings across both scopes`, `import --scope project narrows writes to | acknowledged    | 2026-09-04           | v1.19     |

**One item could NOT be suppressed by the tool** - `deferred_items` phase 25 (archived
v1.4.1). Its deferred items live in a markdown TABLE, not a bullet list: the scanner
synthesizes that row's `text` by joining cells with a spaced hyphen while the file stores
them with a spaced vertical bar, so the acknowledge writer's literal-text search can never match and it refuses with
`no deferred item matched --text`. The other 17 were suppressed normally. This one is
disclosed here instead and WILL resurface at the next milestone close - it was not silently
discarded, and the archived file was deliberately left byte-identical rather than
restructured to satisfy a scanner. Its content is a pre-existing
`tests/e2e/import-command.test.ts` failure already disclosed when v1.4.1 closed, and
`tests/e2e/**` is excluded from `npm run check`.

## Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
| --- | --- | --- | --- | --- | --- |
| 260912-fp0 | Correct the cwd-lifetime comments in extensions/pi-claude-marketplace/edge/register.ts (comments at :18-20 and :104-106 claim the cwd is read once at command registration, but process.cwd() is evaluated inside the getArgumentCompletions arrow at :107-108, so it is read on every completion invocation and nothing is closed over) — fix the comments to match the behavior, do not change the code; closes WINDOWS.md entry 20 | 2026-09-12 | b6f1e037a01875867fa05a1d1f3cca6e9ce2744a | — | .planning/quick/260912-fp0-correct-the-cwd-lifetime-comments-in-ext |
| 260912-fp1 | Repoint two stale test-path references in extension source comments: the isHooksResolverNote doc comment in extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts cites tests/orchestrators/plugin/cross-surface-reason-parity.test.ts which now lives under tests/architecture/, and the comment justifying the SessionStart gate on ensureSharedDataDir in extensions/pi-claude-marketplace/bridges/hooks/event-router.ts names the deleted tests/edge/index-handler.test.ts as the WR-05 pin whose surviving assertion is in tests/index.test.ts — keep the WR-05 id as a traceability anchor; closes WINDOWS.md entries 23 and 26 | 2026-09-12 | 2673a589 | — | .planning/quick/260912-fp1-repoint-two-stale-test-path-references-i |
| 260912-fp2 | Correct three stale documentation references: docs/output-catalog.md names the deleted tests/shared/device-flow-prompt.test.ts as the AUTH-03 byte-form lock which now lives in tests/domain/github-auth.test.ts, .planning/codebase/TESTING.md describes tests/helpers/ as live and names four modules by pre-move paths although the directory and both glob alternatives are gone, and .planning/codebase/CONVENTIONS.md around line 151 claims an aggregate bridges/index.ts exists when only the five per-kind barrels do — verify each claim against the live tree first and if a passage already reads correctly report the ledger as stale rather than inventing an edit; closes WINDOWS.md entries 24, 25 and 29 | 2026-09-12 | beacfe7a | — | .planning/quick/260912-fp2-correct-three-stale-documentation-refere |
| 260912-fp3 | Dispose every remaining open entry in the .planning/WINDOWS.md ledger so no entry reads open: mark ids 20, 23, 24, 25, 26 and 29 fixed once their corrections have landed, and waive ids 1, 2, 3, 7, 8, 9, 10, 13, 14, 15, 16, 17 and 18 with the measured reason recorded for each in the disposition spec — use the gsd-tools windows fixed and windows waive verbs only, never hand-edit the rendered table, and confirm with windows status that zero entries read open | 2026-09-12 | 408ae717 | — | .planning/quick/260912-fp3-dispose-every-remaining-open-entry-in-th |
| 260912-hqq | Rename the published bridge interface HooksHydrationReader to HooksHydrationDeps; closes code-review finding IN-02 | 2026-09-12 | 63de8980 | — | [260912-hqq-rename-the-published-bridge-interface-ho](./quick/260912-hqq-rename-the-published-bridge-interface-ho/) |

## Session Continuity

**Stopped at:** All 9 phases complete and verified; `origin/main` merged and adapted;
the window ledger is fully disposed (0 open); PR not opened by request.

Every phase of `refine-unit-tests` is executed and verified. Phase 9 closed with
`09-VERIFICATION.md` reading `status: passed`, 10/10. The code-review gate ran after the
last plan (0 critical, 3 warning, 4 info) and all three warnings are fixed. `origin/main`
was then merged in (`059a3199`) and its incoming work adapted to this branch's conventions;
`RCOV-01` was re-sealed 230 to 233 pairs because the merge added three production modules.

Measured on the current tree: `npm run check` exit 0 (6109 unit, 32 integration),
`npm run test:coverage:direct:all` exit 0 over 233 pairs,
`node scripts/revalidation.mjs scope-impact --check` prints `Scope impact valid: 40 records.`
The branch is 0 behind `origin/main` and merges clean.

### The window pass (2026-09-12, after the phase verified)

All 19 open ledger entries are disposed: `windows status` reads
**`open 0 / waived 13 / fixed 18 / total 31`**, so the `/gsd-ship` window gate no longer
blocks. `npm run check` exit 0 on the resulting tree (6109 unit, 32 integration).

Five entries were closed by real source edits and one was not:

- **20** (`edge/register.ts`, `b6f1e037`) — the comments claimed the cwd was read once at
  command registration; `process.cwd()` is evaluated inside the `getArgumentCompletions`
  arrow, so it is read per completion lookup. Comments corrected, behavior untouched
  (0 changed non-comment lines).
- **23, 26** (`2673a589`) — both cited test paths were genuinely absent. The `WR-05` anchor
  was kept and repointed at the surviving assertion in `tests/index.test.ts`.
- **24** (`c10cf7f3`) — AUTH-03 byte-form lock repointed to `tests/domain/github-auth.test.ts`.
- **25** (`beacfe7a`) — **wider than the entry recorded.** Two of the four named modules were
  retired outright rather than moved, and the file's "no mocking library" claim had gone false
  (`strong-mock@^9.2.2`, 31 suites). Two further claims the plan supplied as established were
  measured wrong and NOT written: `withHermeticHome` is 13 local definitions rather than a
  shared helper (the shared module is `tests/platform/hermetic-environment.ts`), and the fakes
  are no longer unconditionally in-memory (`boundary` is declared in the options bag and
  enforced by a runtime throw).
- **29** — **the ledger row was the stale artifact, not the document.**
  `.planning/codebase/CONVENTIONS.md` was already correct: `a64d00a4` (2026-09-09) replaced the
  exact wording the entry quotes, six days after it was recorded. Marked `fixed`, no edit made.

The 13 waives (`1, 2, 3, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18`) carry their measured reasons,
derived mechanically rather than transcribed. Entry **9** remains the operator-accepted
`reconcile/apply.ts` exposure signed off 2026-09-02 — waived as a durable record of residual
risk, not as a pending action. Entries **2** and **3** are stubs whose substance belongs to
unshipped `STOP-07` / `SFAIL-03` feature work.

**Resume file:** `.planning/HANDOFF-refine-unit-tests-open-items.md` — **both sections are now
HISTORICAL.** Section 1 (the 19 open windows) was disposed 2026-09-12; section 2 (`IN-02`) was
closed the same day by `63de8980`. Keep the file for the reasoning it records, not as a task
list. The file is untracked by design.

No operator decision is now outstanding. `IN-01`, `IN-03` and `IN-04` stay recorded in
`09-REVIEW.md` as deliberate non-actions; `IN-03` is the one worth revisiting, because NFR-10
containment depends on an injected collaborator honoring a contract nothing type-enforces.

**Read beside it:** `.planning/phases/09-final-quality-and-backlog-closure/09-CLOSURE-LEDGER.md`
(24 rows, one vocabulary, the milestone's audit trail), `09-REVIEW.md` + `09-REVIEW-FIX.md`,
`.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`.

Last session: 2026-09-12 — resumed, then ran the window pass to completion.

**Next:** Open the PR (not done — deliberate), then milestone audit, complete, cleanup.

One snag remains in that sequence; the window-gate snag is now cleared:

1. ~~`/gsd-ship` blocks while any window reads `open`~~ — **cleared 2026-09-12**, 0 open.
2. `gsd-tools query phase.complete` refuses here: it sees `.planning/workstreams/` and demands
   `--ws`, but this milestone's ROADMAP/STATE are the ROOT files and no workstream is named
   `refine-unit-tests`. Hand-edit and verify by diff, as this file already prescribes for the
   state verbs.
3. `quick-batch complete` also refused until a `## Quick Tasks Completed` section was created
   in this file — it is the sole writer of an item's `complete` status, so the section's absence
   silently blocks every quick-batch item from advancing. The section now exists with the
   canonical `with-status` schema (`#`, `Description`, `Date`, `Commit`, `Status`, `Directory`).

## Deferred Verification

| Phase | State                       | Resume                      |
| ----- | --------------------------- | --------------------------- |
| 01    | verification_deferred_gaps  | `$gsd-plan-phase 01 --gaps` |
| 03    | verification_deferred_human | `$gsd-verify-work 03`       |
| 04    | verification_deferred_human | `$gsd-verify-work 04`       |
| 05    | verification_deferred_human | `$gsd-verify-work 05`       |

Phases 03, 04, and 05 are listed here to keep an autonomous re-entry from diverting into them, not
because their work is unfinished. All three are implemented with every plan summarised, and each
`VERIFICATION.md` reads `status: passed` with a full score — 5/5, 4/4, and 6/6. They report `stale`
only because their `covered_files` include `.planning/REQUIREMENTS.md`, `ROADMAP.md`, and `STATE.md`,
which every later plan rewrites. Re-verifying them re-stales them as soon as the next phase writes
STATE.md, so the loop never converges; that is why the autonomous queue must skip them and why
`stale` here is a timestamp verdict rather than an outcome verdict. Settle them once at milestone
audit, or clear them deliberately with the resume commands above.

## Autonomous Run Parameters

Resume with `/gsd-autonomous --from 9 --interactive`.

Queue is **9 only**. Phases 01 and 03-05 stay skipped via the Deferred Verification table above;
02, 06, 07 and 08 are complete. Phase 8 verified `passed` 8/8 on 2026-09-11.

The run paused after Phase 8 on context budget, not on a blocker. Phase 9 is `CLOSE-01` +
`CLOSE-02` and wants a fresh context, because its central task is a coordinated multi-file
seal update that fails closed if done piecemeal.

### The one hard blocker Phase 9 must solve first

`SEALED_REQUIREMENT_ROUTES` in `scripts/revalidation.mjs` pins `RCOV-01`, `RCOV-02` and
`RCOV-03` at `Phase 8` / `Pending`. **They cannot be completed one at a time.** Proved by
planting in 08-09: setting `- [x] **RCOV-03**` plus a `Complete` traceability row makes
`node scripts/revalidation.mjs scope-impact --check` exit 1 with
`requirement-route-contract: RCOV-03: traceability route/status differs from sealed
requirement contract`; reverting restores `Scope impact valid: 40 records.`

One atomic change must land: the three checkboxes, their traceability rows, the sealed route
entries, and any disturbed clause signature. The same seal spans `.planning/REQUIREMENTS.md`,
`scripts/revalidation.mjs` and
`.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — three files that must
agree, as 08-08 found when `RCOV-04`'s evidence clause also had to be re-sealed.

### Open decisions Phase 9 inherits

1. **WR-04 — a production-design call, not a test edit.** The `event-router` staleness case
   (`tests/bridges/hooks/event-router.test.ts`) still triggers on a counted
   `currentGeneration()` consultation, which `D-08-A04` forbids by name. 08-03 built and
   measured every alternative; nothing injected runs between the containment check and the
   `readFile`. The only remaining route is a `readHooksJson` member on
   `HooksHydrationReader`, which would port ONE of that module's two `readFile` sites and
   leave the other — a port shaped by one test's reach, the shape `D-08-13` refused for the
   removal port and `D-08-A14` records 08-07 declining for `install-outcome.ts`. A sibling
   control was added so the empty assertion now means "a hydration that was stopped" rather
   than "a fixture that never hydrates", and both cases record that
   `getRoutingBucket("PreToolUse")` is vacuous for this entrypoint.

2. **The pin's standing caveat, recorded by 08-04 as deliverable D5.** The comparator is
   proved by planting and every reading is measured, but each row's `reasons` is a CLAIM
   about why an arm cannot be reached. If a reason is wrong, the pin is an allow-list with
   good manners, and no gate in this repository can tell the difference. Two human-checkable
   claims carry that weight: the `CommandNameError` narrowing arm in
   `bridges/commands/discover.ts`, and the two defense-in-depth re-checks in
   `orchestrators/plugin/install-outcome.ts` (`D-08-A14`, operator decision 2026-09-11).

3. **The `direct-coverage` CI job has never executed.** Its first real run is on the PR. The
   local proxy proves everything except the GitHub-side ref creation the in-job base
   assertions exist to catch. Whether it is a REQUIRED status check is a protected-branch
   setting outside any tracked file, so the `RCOV-03` edge-probe row stays `unresolved`.

### Environment debts, unchanged and still blocking

1. `.planning/WINDOWS.md` entries 19, 21, 22 should read `fixed` and cannot be written.
   Every `gsd-tools windows` verb refuses because the rendered table disagrees with the
   fenced JSON at unrelated rows **9 and 30** — a desync predating this phase (`697d6812`).
   Regenerating the table destroys the prose side, so it is an operator decision, not an
   agent repair. 23 windows read open; `/gsd-ship` blocks while any remain.

2. `gsd-tools` state verbs are unreliable in this workstream. `state.update-progress` and
   `state.advance-plan` rewrite `completed_phases: 3 → 1` and `percent: 33 → 11` from a
   roadmap they cannot read; `state.planned-phase` once reported four fields updated while
   writing zero bytes; `roadmap.annotate-dependencies` reports the phase not found because
   the milestone heading is the workstream form. Hand-edit STATE.md, call only
   `roadmap.update-plan-progress`, and verify by grep.

3. `trufflehog` cannot run in this checkout at all — it is a linked worktree, so `.git` is a
   file and the hook's `<root>/.git/index` read fails. Every `pre-commit run --all-files`
   claim in Phase 8 carries `SKIP=trufflehog`. CI's Lint job runs it on a full clone, so it
   is unverified locally rather than known-clean.

4. Commit `c4f503f0` is bisect-unsafe on its own — it carried a comparator change without its
   matching harness change, which landed in `a2393015`. The pair is one change. Recorded
   rather than amended, per the no-history-rewrite rule. `abf1a4c7` (08-05 task 1) is
   likewise red on typecheck and fallow by construction, with the reason in its commit body.

### Executor dispatch note

`workflow.use_worktrees=false`, so `ISOLATION=none` and executors run **sequentially** on the
shared tree. Phase 8 ran all nine plans that way with no cross-contamination. The plan index
recomputes waves topologically from `depends_on` and IGNORES the `wave:` frontmatter field, so
order the dispatch from `depends_on`, not from the roadmap's wave headers. Executors were told
to stage explicit paths only and to leave `.claude/settings.json`, `.codex/config.toml`,
`.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`, `.codegraph/` and the untracked `01-REVIEW*`
drafts alone — those are the operator's and are still modified in the working tree.
