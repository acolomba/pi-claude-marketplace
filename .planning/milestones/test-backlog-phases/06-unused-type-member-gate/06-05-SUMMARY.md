---
phase: 06-unused-type-member-gate
plan: "05"
subsystem: testing
tags: [typescript, compiler-api, static-analysis, audit, gate, node-test]
status: complete

requires:
  - phase: 06-unused-type-member-gate
    provides: The candidate inventory, member identity and the three-way exit contract the audit reports
  - phase: 06-unused-type-member-gate
    provides: The directed transfer graph that settles the optional EdgeDeps member
  - phase: 06-unused-type-member-gate
    provides: The validated-contract engine the audit supplies to the analysis unchanged
  - phase: 06-unused-type-member-gate
    provides: Whole-object operations, which took the live population to 261 unread and zero unsupported
  - phase: 05-production-export-ownership
    provides: The completed, stable production-export ownership the live inventory is measured against
provides:
  - "`scripts/check-unused-type-members.audit.mjs`, an instrument that separates a complete inventory from a clean verdict"
  - "`--inventory`: the complete current population recorded as a triage document, always succeeding and saying out loud that it is not a verdict"
  - "`--check`: closure over a fresh analysis, failing unread, unsupported, missing, duplicate, stale-source, stale-record, incomplete and invalid evidence"
  - A source digest recomputed from disk rather than from the report, so a stale ledger is caught by something other than the report it describes
  - The conceptual-owner grouping that keeps each architectural layer, and each bridge kind, its own owner
  - "`.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md`: 3,464 candidates, 483 pending dispositions, bound to digest `08023619`"
  - The `lint:type-members:audit` package entry, deliberately absent from `npm run check`
affects: [06-06, 06-07, 06-08]

actuals:
  tokens: 72208
  tasks: 2
  commits: 3
plan_head_before: 6db7556fadf510bb90c245aa6a65db6d54a917b7

tech-stack:
  added: []
  patterns:
    - "An inventory command that always succeeds and states its own limits, kept separate from a closure command that fails"
    - "Evidence bound to a source digest computed independently of the report it accompanies"
    - "A machine-readable ledger embedded as the first fenced json block of a human-readable markdown page"
    - "A carried explanation is dropped when its row's status moves, because the prose was written about a row that no longer exists"

key-files:
  created:
    - scripts/check-unused-type-members.audit.mjs
    - tests/scripts/check-unused-type-members.audit.test.ts
    - .planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md
  modified:
    - package.json

key-decisions:
  - "An inventory and a verdict are different answers, so they are different commands with different exit meanings: `--inventory` always succeeds, `--check` fails every unresolved row"
  - "A member the analyzer settled with a production witness is explained by that witness; every other status carries a recorded disposition, which is 483 of 3,464 rows rather than all of them"
  - "The fingerprint covers analysed source only -- the two analysed roots plus tsconfig.json and the contract file -- because an analyzer change is caught more precisely by the per-row status reconciliation than by a digest that can only say something moved"
  - "The ledger is the first fenced json block of the triage document, so one artifact is both a readable page and a checkable record"
  - "A regeneration carries a recorded note forward only when the row's status is unchanged; a status move drops the explanation back to pending"
  - "The audit reads the report and never writes to the analyzer or the contract file, so a verdict stays the gate's alone"
  - "The gate reads no planning record; only the audit does, which keeps mandatory analysis independent of `.planning/`"

coverage:
  - deliverable: "An inventory that records the complete population and refuses to read as a verdict"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the inventory records every candidate and states it is not a clean verdict"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the recorded ledger names the exact declarations that still need evidence"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the owner groups account for every candidate the report holds"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#each architectural layer is its own conceptual owner"
        status: pass
    human_judgment: false
  - deliverable: "A closure check that refuses unread and unsettled members"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses an unread member the inventory happily recorded"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses a member the analysis could not settle"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check accepts the fully explained counterpart"
        status: pass
    human_judgment: false
  - deliverable: "A closure check that refuses missing, duplicate, stale, unexplained and invalid evidence"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses a ledger that dropped a row it must account for"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses a ledger that names one declaration twice"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses evidence recorded against source that has since moved"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses a ledger row the current report no longer holds"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses a candidate that appeared after the inventory was taken"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses a disposition nobody has explained yet"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses an explanation that carries no evidence at all"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses a disposition outside the vocabulary it accepts"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses a recorded status that no longer matches the report"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the check refuses an owner table that leaves candidates unaccounted for"
        status: pass
    human_judgment: false
  - deliverable: "The audit reports a verdict it cannot change, and is safe to load"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the audit reports the gate's verdict and never changes it"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#importing the audit module does not run it"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#a missing triage document is a setup failure, not a clean audit"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#naming neither command is a setup failure"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the package exposes the audit as a real executable entry"
        status: pass
    human_judgment: false
  - deliverable: "Evidence survives a regeneration only where the row it explains did not move"
    verification:
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#a recorded explanation survives a regeneration that did not move its row"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#a recorded explanation is dropped once the member's status changes"
        status: pass
      - kind: test
        ref: "tests/scripts/check-unused-type-members.audit.test.ts#the fingerprint follows the analysed source and ignores everything else"
        status: pass
    human_judgment: false
  - deliverable: "The stable post-Phase-5 live population, recorded complete with every failure retained"
    verification:
      - kind: command
        ref: "node scripts/check-unused-type-members.audit.mjs --inventory"
        status: pass
      - kind: command
        ref: "node scripts/check-unused-type-members.audit.mjs --check"
        status: pass
    human_judgment: true
    rationale: "The measurement is exact and reproducible from the recorded digest, but whether each of the 261 unread rows is a defect, a validated contract or an analyzer gap is the reconciliation 06-06 owns. This plan deliberately reaches no verdict on them."

requirements-completed: []

duration: 50 min
completed: 2026-09-15
---

# Phase 06 Plan 05: Live Inventory and Closure Audit Summary

**An audit that refuses to let a complete inventory read as a clean verdict, and the stable post-Phase-5 population it records: 3,464 candidates, 483 needing a disposition, 261 unread, zero the analysis could not settle.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-09-15T15:32:00Z
- **Completed:** 2026-09-15T16:22:49Z
- **Tasks:** 2
- **Files:** 4 (3 created, 1 modified)

## What Was Built

`scripts/check-unused-type-members.audit.mjs` answers two questions that a single
number cannot. The distinction is the plan's core claim, and it is implemented as
two commands whose exit statuses mean different things.

`--inventory` asks *what is the complete current population?* It records every
candidate, including the ones the analyzer could not settle, and it always
succeeds. A command that succeeds is normally read as approval, so this one says
otherwise in its own output and in the document it writes: **"This is an
inventory, not a clean-gate verdict."**

`--check` asks *is that population closed?* It re-runs the analysis, recomputes
the source digest from disk, and reconciles every recorded disposition against
the fresh report. It fails on eight distinct categories:

| Category | What it catches |
| --- | --- |
| `unread` | The report still holds a member nothing reads |
| `unsupported` | The report still holds a member the analysis could not settle |
| `missing` | A row needing a disposition has no record |
| `duplicate` | Two records name one declaration |
| `stale-source` | The analysed source, or the counts it produces, moved since the inventory |
| `stale-record` | A record names a row the report no longer holds, or records a status that has changed |
| `incomplete` | A record is pending, carries no evidence, or the owner groups do not account for every candidate |
| `invalid` | A record names no declaration, or carries a disposition outside the accepted vocabulary |

Neither command can change an analyzer verdict. The audit only ever reads the
report; the contract file stays the sole place a member is excused, and the gate
owns that. A control proves it by running the gate before and after a full
`--inventory` plus `--check` cycle and comparing every member, witness and
finding.

### What carries a disposition, and why not everything

A member the analyzer settled with a production witness is explained by that
witness -- the report already names the file, line and column that reads it.
Asking a human to re-explain 2,981 of those would bury the rows that actually
need judgment. So a disposition is required for every status that rests on
something a reader has to agree with: `unread`, `unsupported-analysis`,
`test-only-observed` and `explicit-contract`. On this tree that is 483 rows of
3,464, and the inventory still counts and groups all 3,464.

### The fingerprint

The digest is computed from disk, over `extensions/pi-claude-marketplace/**/*.ts`,
`tests/**/*.ts`, `tsconfig.json` and the contract file -- 602 files here. It is
deliberately derived independently of the report, because an instrument that
checks a report may not take its oracle from that report.

The analyzer's own `scripts/*.mjs` are **not** hashed, and that is a decision
rather than an omission. When 06-06 changes the analyzer, the ledger's recorded
counts and each row's recorded status are compared against the fresh report, and
those comparisons say exactly *which* rows moved and how. A digest over the
analyzer could only say that something moved.

### The ledger

The ledger is the first fenced `json` block of the triage document, so one
artifact is both a readable page and a checkable record. Regenerating rewrites
the prose and carries recorded dispositions forward; nothing written outside the
block survives, which is stated at the top of the generated page.

A carried explanation is dropped when its row's status moves. An explanation is
written about the status the row had when it was written, so once the row becomes
something else the prose is about a row that no longer exists.

## Live Measurements

Every number below is measured against this repository with `/usr/bin/time -v`.

| Run | Unread | Unsupported | Findings | Candidates | Wall | Peak RSS |
| --- | --- | --- | --- | --- | --- | --- |
| Inherited baseline (06-04) | 261 | 0 | 261 | 3,464 | 80.2 s | 2.05 GiB |
| Gate re-measured at plan start | 261 | 0 | 261 | 3,464 | 80.3 s | 2.05 GiB |
| `--inventory` (recorded) | 261 | 0 | 261 | 3,464 | 77.4 s | 2.00 GiB |
| `--check` | 261 | 0 | 744 problems | 3,464 | 81.7 s | 2.04 GiB |

**The inherited 261 / 0 / 261 baseline holds exactly.** Every member's status in
a fresh run at this plan's HEAD is byte-identical to the run taken before any of
this plan's commits, which also corroborates that adding a test file changed no
verdict.

### The recorded population

| | Count |
| --- | --- |
| Production files analysed | 236 |
| Source files hashed | 602 |
| Candidates | 3,464 |
| Runtime-observed | 2,981 |
| Test-only-observed | 222 |
| Explicit-contract | 0 |
| Unread | 261 |
| Unsupported analysis | 0 |
| Rows needing a disposition | 483 |

Recorded against revision `0dc3666b` and digest
`08023619455e8db92b7ab9ffb609179fd3adabea8fb30ac2f995eefdeba46cb6`. The transfer
walk spent 2,894,478 steps in 50.2 s of the 77.4 s run.

### Population by conceptual owner

| Owner | Candidates | Runtime | Test-only | Unread |
| --- | --- | --- | --- | --- |
| orchestrators | 1,811 | 1,613 | 86 | 112 |
| shared | 346 | 325 | 5 | 16 |
| bridges/hooks | 344 | 232 | 80 | 32 |
| domain | 269 | 226 | 14 | 29 |
| bridges/agents | 177 | 164 | 4 | 9 |
| edge | 131 | 111 | 3 | 17 |
| platform | 84 | 67 | 3 | 14 |
| persistence | 80 | 57 | 13 | 10 |
| bridges/commands | 76 | 63 | 4 | 9 |
| bridges/skills | 74 | 61 | 4 | 9 |
| bridges/mcp | 55 | 47 | 4 | 4 |
| transaction | 17 | 15 | 2 | 0 |

`transaction` is the one layer already closed: all 17 of its members carry a
witness.

### What `--check` says today

Exit 1 with 744 problems: 261 `unread` and 483 `incomplete`. **Zero
`stale-source`, zero `stale-record`, zero `missing`, zero `duplicate`, zero
`invalid`** -- the recorded ledger reconciles exactly against a freshly
recomputed digest and a freshly run analysis. Those 483 `incomplete` rows are the
work 06-06 does; they are not a defect in the record.

## The EdgeDeps Trace

The plan requires the current `EdgeDeps` members traced from
`extensions/pi-claude-marketplace/edge/types.ts` to real read sites. All four are
`runtime-observed`, and each read site below was read out of the source file
directly rather than taken from the report.

| Declaration | Member | Witnesses | First read site |
| --- | --- | --- | --- |
| `edge/types.ts:25:3` | `completionCache` | 11 | `edge/handlers/marketplace/add.ts:44:29`, property access |
| `edge/types.ts:26:3` | `gitOps` | 6 | `edge/handlers/marketplace/add.ts:45:20`, property access |
| `edge/types.ts:27:3` | `pluginUpdate` | 3 | `edge/handlers/marketplace/update.ts:62:28`, property access |
| `edge/types.ts:28:3` | `importClaudeSettings` (optional) | 1 | `edge/handlers/plugin/import.ts:60:17`, value transfer via `edge/register.ts:103:35` |

The optional one is the interesting row. 06-01 recorded `importClaudeSettings` as
the shape that read as unread under a dot-read-only model. It is now settled by a
directed transfer: `register.ts:103` passes the whole `deps` object into
`makeImportHandler`, and `import.ts:60` reads `deps.importClaudeSettings` off the
parameter that received it. Both coordinates check out against the source:
`register.ts:103` is `import: makeImportHandler(pi, deps, hooksRouting),` with
`deps` starting at column 35, and `import.ts:60` is
`await (deps.importClaudeSettings ?? importClaudeSettings)(options);` with the
member name starting at column 17.

So the phase's goal declaration has no current unread member. The offender that
must fail the gate is the planted `neverReadAnywhere`, which is 06-07's.

## Leads for 06-06 (not classifications)

These are measurements handed forward, not dispositions. Recording them here is
the "preserve current failures verbatim for 06-06" the plan asks for.

- **The 261 unread rows span 77 distinct production files.** 192 are members of type literals, 68 of interfaces and 1 an interface method. 223 are required members and 38 optional. 87 sit on a nested or parameter shape, whose owner name carries a dot.
- **`kind` alone accounts for 46 rows**, the largest single key. Reading the source at those sites shows the shape: `Extract<AgentsReplacement, { kind: "replaced" }>` in `bridges/agents/stage.ts:75`. The `{ kind: "replaced" }` literal is a selection filter in a type position -- nothing reads it at run time, and its purpose is exactly the `type-selection` contract category 06-03's engine already models.
- **A window scan puts 76 of the 261 inside an `Extract<>` or `Exclude<>` filter.** That is a four-line-window heuristic, not a classification: it is a starting point for 06-06's contract work, and each row still needs its own proof.
- **The 222 test-only rows carry 2,371 witnesses, 1,812 of them `deep-comparison`.** 06-04's deep-comparison modelling is what separates most of that population from the unread set, so any change to it moves these rows.
- **The largest remaining single-file clusters after the filter shapes** are `bridges/hooks/async-rewake/registry.ts` (17), `orchestrators/marketplace/remove.ts` (13), `platform/pi-api.ts` (10) and `edge/handlers/tools.ts` (9).

No additional bounded live-remediation plan IDs are required yet. Whether any of
the 261 is a genuine source repair rather than an analyzer gap or a contract is
06-06 Task 1's finding, and the orchestrator adds owner-specific plans at that
point per 06-VALIDATION.md.

## Verification

| Task | Command | Result |
| --- | --- | --- |
| 06-05-T1 | `node --test tests/scripts/check-unused-type-members.audit.test.ts` | 21/21 pass (RED: 4/21 against the always-satisfied stand-in) |
| 06-05-T2 | `node --test tests/scripts/check-unused-type-members.audit.test.ts && node scripts/check-unused-type-members.audit.mjs --inventory` | exit 0; 25/25 pass, inventory recorded |

Plan-level verification, all run in the foreground with the exit status captured:

| Command | Result |
| --- | --- |
| `node scripts/check-unused-type-members.audit.mjs --check` | exit 1, 744 problems (261 unread, 483 incomplete) -- the inventory's unresolved rows fail closure, as the plan requires |
| `node --test` over the five inherited analyzer suites | 134/134 pass, unmodified |
| `npm run test:corresponding` | exit 0 |
| `npm run test:corresponding:negative` | exit 0 |
| `pre-commit run --files` on every commit's file set | passed, including `npm lint`, `npm format check`, `npm typecheck`, `npm fallow` (all four sub-gates) and the direct-coverage hook |

**Production unit coverage and the direct pins are unchanged by construction.**
`git diff 6db7556f..HEAD -- extensions/` is empty: this plan touched no
production source, so the 100 percent native aggregate baseline and every direct
pin recorded at the stable wave boundary still stand. No coverage run was
repeated for a plan that changed nothing they measure.

### RED evidence

| Task | RED result | What failed |
| --- | --- | --- |
| 1 | 21 tests, 4 pass, 17 fail | Against a deliberately non-discriminating stand-in that records a population and calls every population satisfied. All eight refusal categories, both inventory-content cases and the owner grouping failed. The four passes are the absence assertions the stand-in genuinely met -- inert on import, the no-command setup failure, the package entry, and the verdict-stability case an audit that does nothing trivially satisfies. |
| 2 | 25 tests, 24 pass, 1 fail | The carried-note case. An explanation recorded while a member was unread survived the member becoming test-only-observed, which is a real hole in the artifact 06-06 inherits. |

An always-satisfied audit fails 17 of 21 of Task 1's cases, so the suite
discriminates the mutant this plan exists to catch.

## Assertion and Coverage Ledger

| Task | Assertion and regression evidence | Coverage evidence |
| --- | --- | --- |
| 06-05-T1 | 21 controls. Positive: a complete inventory with exact hand-authored identities, the owner totals reconciling to the candidate count, a fully explained population accepted. Negative: unread, unsupported, missing, duplicate, stale-source, stale-record, status-drift, pending, empty-note and out-of-vocabulary evidence each refused with its own category. Absence: the gate's verdict unchanged across a full audit cycle, the module inert on import, a missing document a setup failure rather than a clean audit, neither command a setup failure. | RED failed 17 of 21 against the always-satisfied stand-in. Every expected declaration identity is counted by hand from fixture text printed in the test file; none is read out of the report under audit. The 134 inherited analyzer controls pass unmodified. |
| 06-05-T2 | 4 further controls. Positive: a note surviving a regeneration that did not move its row; each architectural layer, and each bridge kind, its own conceptual owner. Negative: a note dropped once the row's status moved; an owner table that leaves a candidate unaccounted for. Plus the live run: a complete fingerprint-bound inventory and a closure check that fails all 744 outstanding rows. | RED failed 1 of the 4 -- the one that found a real defect. Fingerprint scope is proved in both directions by a temporary fixture: an unanalysed file leaves the digest alone, a `.ts` file under an analysed root moves it. |

No production coverage threshold, direct pin or assertion contract was weakened.
One inherited assertion was **strengthened**; see deviation 2.

## Deviations from Plan

### 1. [Rule 1 - Bug] A carried explanation outlived the row it explained

- **Found during:** Task 2, writing the controls the live inventory needs
- **Issue:** Regenerating the inventory carried a recorded disposition and note forward by declaration identity alone. A note written to explain an unread member survived that member becoming `test-only-observed` and still read as explained. 06-06 remeasures repeatedly as it corrects the analyzer, so this would have let stale prose close rows it was never written about -- exactly the "accepts stale evidence" failure the plan's `fails_when` names.
- **Fix:** Carry a recorded disposition forward only when the row's status is unchanged; a status move resets it to `pending` with an empty note.
- **Files modified:** `scripts/check-unused-type-members.audit.mjs` (outside Task 2's declared files, which are the test and the triage document)
- **Verification:** `a recorded explanation is dropped once the member's status changes` asserts the moved row is back to pending while its unmoved sibling keeps its note. It failed before the fix.
- **Commit:** `3c30479b`

### 2. [Rule 1 - Bug] A control of mine asserted timing, not the verdict it named

- **Found during:** Task 2's verify run, after the control had already been committed green
- **Issue:** `the audit reports the gate's verdict and never changes it` compared the gate's whole `--json` stdout byte for byte. That output includes `work.transferMs`, a wall-clock measurement that differs by a millisecond between two identical runs, so the control asserted timing stability rather than verdict stability and went red at random. It had already produced one spurious failure during the Task 1 green run that I wrongly set aside as load contention.
- **Fix:** Compare the report with its `work` block removed, which is a structural comparison of every member, witness, finding and count -- strictly stronger where it matters and no longer coupled to the clock.
- **Files modified:** `tests/scripts/check-unused-type-members.audit.test.ts`
- **Verification:** The suite ran green twice in a row afterwards, and the control still names the claim it makes.
- **Commit:** `3c30479b`

### 3. [Documented choice] Commit messages carry no plan scope

The GSD task-commit protocol asks for `{type}({phase}-{plan}):`. This project's
`CLAUDE.md` forbids milestone and phase identifiers in commit messages and takes
precedence, so the three commits are plain Conventional Commits. They are
`f2938b8a` (RED), `0dc3666b` (Task 1 green) and `3c30479b` (Task 2).

### 4. [Documented choice] The triage document is generated, not hand-written

The plan asks for exact candidates, witnesses, test-only observations, contract
evidence and unresolved categories grouped by conceptual owner. All of it is
rendered by `--inventory` from the report rather than transcribed, which is what
makes the artifact remeasurable. 06-06 writes its evidence into the ledger
block's `note` fields, which survive regeneration.

### 5. [Documented choice] The package alias is not in `npm run check`

`lint:type-members:audit` is a real executable entry so the script is reachable
for the dead-code census, and a control pins both that and its absence from
`check`. Activation is 06-08's, after closure.

---

**Total deviations:** 2 auto-fixed bugs and 3 documented choices.
**Impact:** Both bugs were in work this plan authored and both were found by
controls this plan wrote. One hardened the artifact 06-06 depends on; the other
replaced a flaky assertion with a stronger one. No gate was weakened, no
suppression, census pin, threshold override or coverage exclusion was added.

## Observed Limits

These are bounds on the instrument, stated rather than worked around.

- **The audit suite takes 71 seconds.** 06-VALIDATION.md targets under 30 for small fixture suites. Each of the 25 controls spawns one or two child processes that each build a TypeScript program from scratch, at roughly 1.7 s per build; the fixtures themselves are two or three files. Nothing here is slow because of the tree's size, and the suite still runs in parallel with the others under `npm test`.
- **The fingerprint does not cover the analyzer.** Changing `scripts/*.mjs` leaves the digest alone. That is deliberate and argued above, and the per-row status reconciliation is what catches an analyzer change -- more precisely than a digest could.
- **The recorded revision is informational.** An uncommitted edit moves the digest but not `git rev-parse HEAD`, so the digest is the authority and the revision is there for a reader who wants to find the source again.
- **`--check` re-runs the whole analysis**, so closure costs 82 seconds and 2.04 GiB. There is no cached-report mode, deliberately: an audit that trusted a stored report would be checking the record against itself.
- **The triage document is 234 KB across 5,145 lines.** That is the cost of listing all 483 rows needing a disposition alongside their witnesses. It sits under `.planning/`, which both `mdformat` and `markdownlint-cli2` exclude, so no formatter can disturb the ledger block.

## Known Stubs

None. No placeholder values, no unwired output and no committed `skip` or `todo`.

The 483 `pending` dispositions in the recorded ledger are not stubs: they are the
measured, unresolved state the plan is required to preserve verbatim for 06-06,
and `--check` fails every one of them rather than treating any as settled.

## Threat Flags

None. This plan adds no network surface, no authentication path and no schema at
a trust boundary. Its two new surfaces are contained and controlled: the audit
parses the analysed tree only through the existing analyzer, which never imports
or executes it, and the one subprocess it spawns is `git rev-parse HEAD` through
an argv array with no shell, whose failure degrades to the string `unknown`
rather than propagating.

## Issues Encountered

- **`--check` fails today, and is meant to.** 744 problems: 261 unread members and 483 dispositions nobody has recorded evidence for. Closure is 06-06's deliverable; this plan's job was to make the failure exact and attributable, which it is -- zero of the 744 are stale, missing, duplicate or invalid.
- **No genuine source repair has been identified yet.** Whether any of the 261 rows needs a bounded owner-specific plan is 06-06 Task 1's finding. No such plan ID exists to record here.

## Next Phase Readiness

- **Ready for 06-06.** It inherits a fingerprint-bound record of the complete population, an instrument that fails every unresolved row, a place to write evidence that survives remeasurement, and the leads above. Its Task 2 verify command, `node scripts/check-unused-type-members.audit.mjs --check`, runs today and fails for the right reasons.
- **06-06 must remeasure if source content changes.** Any edit under `extensions/pi-claude-marketplace/` or `tests/`, or to `tsconfig.json` or the contract file, moves the digest and `--check` reports `stale-source`. Re-running `--inventory` rebuilds the record and carries forward every note whose row did not move.
- **`requirements-completed` is deliberately empty.** MEMBER-01 and MEMBER-02 are declared by all eight plans in this phase, so neither may read `Complete` until the last declaring plan finishes.
- **No blocker.** `npm run check` does not run the gate or the audit, so nothing downstream is gated on the live population being clean yet.

---

*Phase: 06-unused-type-member-gate*
*Completed: 2026-09-15*

## Self-Check: PASSED

- `scripts/check-unused-type-members.audit.mjs` -- FOUND
- `tests/scripts/check-unused-type-members.audit.test.ts` -- FOUND
- `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` -- FOUND
- `f2938b8a`, `0dc3666b`, `3c30479b` -- all three FOUND in `git log`
- `commits: 3` is measured: `git rev-list --count 6db7556f..HEAD` returned 3 before this
  documentation commit, which is excluded exactly as 06-02 through 06-04 recorded theirs.
- `tokens: 72208` is `chars/4` over every file this plan changed. 12,280 of it is the
  authored script and test; the remaining 59,927 is the generated triage document. The
  plan estimated 16,000, which the authored share came in under.
