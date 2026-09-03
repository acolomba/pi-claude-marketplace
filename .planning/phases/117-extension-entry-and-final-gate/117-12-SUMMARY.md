---
phase: 117-extension-entry-and-final-gate
plan: "12"
subsystem: testing
tags: [inventory, requirements, roadmap, broken-windows, milestone-close]

requires:
  - phase: 117-extension-entry-and-final-gate
    provides: "The entry pair (117-08), the correspondence-gate verdicts and controls (117-09, 117-10), and the retained 204-row all-pair result (117-11)"
provides:
  - "REQUIREMENTS.md with 204 closed inventory rows and all 48 requirements dispositioned in both the checklist and the requirement-to-phase mapping"
  - "ROADMAP.md reporting 204/204 Complete, phase 117 at 12/12, and checked milestone boxes for phases 116 and 117"
  - "STATE.md reading the closed pair total, a Complete phase-117 position, and a rewritten forward-look for milestone close-out"
  - "WINDOWS.md with 29 rows whose frontmatter counters were re-derived by counting, plus the last documentation drift filed"
  - "D-117-20 amended in 117-CONTEXT.md to the measured 190 + 7 + 7"
affects: [milestone-close, gsd-complete-milestone, ship-gate]

actuals:
  tokens: 24971
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Every recorded count re-derived by a command run in the recording session, with the producing command named beside it"

key-files:
  created:
    - .planning/phases/117-extension-entry-and-final-gate/117-12-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/WINDOWS.md
    - .planning/phases/117-extension-entry-and-final-gate/117-CONTEXT.md

key-decisions:
  - "Closed all 154 open inventory rows on two pieces of evidence each: a verified-complete phase with a SUMMARY per plan, and a verdict for the row in the retained all-pair result"
  - "Marked COV-01 and COV-05 Complete with their exceptions stated rather than hidden: seven pairs are accepted D-116-01a single-branch shortfalls whose ledger entries stay open"
  - "Marked SUITE-05 Complete on the five separate gates plus three controls, because `npm run check` cannot reach its test link in this checkout; said so rather than asserting the aggregate passed"
  - "Removed the duplicate bare plan list the roadmap progress verb injected under phase 117; no other phase in the file carries two lists"
  - "Left the tool parameter-description question OPEN for the operator per D-117-14, and left the seven D-116-01a ledger entries open"

patterns-established:
  - "A ledger counter is verified by a script that tallies the rows, never by reading the frontmatter header"
  - "A planned count is reported beside the measured one, and the measurement wins"

requirements-completed: [OWN-05, SUITE-06, MOD-10, PRES-01, PRES-02, DEL-04, SUITE-05]

coverage:
  - id: D1
    description: "Every one of the 204 inventory rows carries a closed status, and none reads open"
    requirement: OWN-05
    verification:
      - kind: other
        ref: "rg -c '| Open +|' .planning/REQUIREMENTS.md -- exit 1, no match"
        status: pass
      - kind: other
        ref: "rg -c '^| P1[0-9][0-9]-[0-9]' .planning/REQUIREMENTS.md -- 204"
        status: pass
    human_judgment: false
  - id: D2
    description: "The two module-completion requirements MOD-07 and MOD-10 are closed in both the checklist and the requirement-to-phase mapping, and every phase-117 requirement is dispositioned"
    requirement: MOD-10
    verification:
      - kind: other
        ref: "grep -n '| Pending' .planning/REQUIREMENTS.md -- exit 1; grep -n '^- \\[ \\]' .planning/REQUIREMENTS.md -- exit 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "The roadmap reports the closed pair total 204/204, phase 117 at 12/12 Complete, the plan count agreeing in all four places, and checked milestone boxes for phases 116 and 117"
    requirement: SUITE-06
    verification:
      - kind: other
        ref: "Task 2 verify chain (203/204 absent, 204/204 present, no unchecked Phase 116/117 box, no shipped keyword) -- exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The final inventory contains exactly the production modules at the accepted baseline, with no missing or unexpected owner test"
    requirement: SUITE-06
    verification:
      - kind: other
        ref: "npm run test:corresponding -- exit 0, 'Corresponding-test gate passed.'"
        status: pass
      - kind: other
        ref: "npm run test:corresponding:negative -- exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Focused tests, all-pair direct coverage, planted negative controls and the repository gates pass on the completed tree"
    requirement: SUITE-05
    verification:
      - kind: unit
        ref: "npm test -- 5142 tests / 295 suites / 0 fail on Node v26.8.1"
        status: pass
      - kind: integration
        ref: "npm run test:integration -- 31/31"
        status: pass
      - kind: other
        ref: "npm run typecheck -- exit 0"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:negative -- exit 0"
        status: pass
      - kind: other
        ref: "117-ALL-PAIR-RESULT.ndjson -- 204 rows, 190 complete / 7 accepted-shortfall / 7 type-only"
        status: pass
    human_judgment: true
    rationale: "`npm run check` cannot be run as one command in this checkout — its `format:check` link fails on the operator's pre-existing untracked files and short-circuits before `test`. The five gates were run separately and each exit code read unpiped, which is equivalent in substance but is a judgement the operator should confirm rather than a single command's exit code."
  - id: D6
    description: "The refactor preserved behavior, public surfaces, persistence contracts and the named product corrections"
    requirement: PRES-01
    verification:
      - kind: other
        ref: "git diff --quiet 562f5d13 HEAD -- extensions/ -- exit 0; phase 117 changed no production file"
        status: pass
      - kind: unit
        ref: "npm test -- 5142/0 and npm run test:integration -- 31/31 on the completed tree"
        status: pass
    human_judgment: true
    rationale: "PRES-01 and PRES-02 span the whole milestone, not this phase. The first-hand evidence here is that phase 117 changed no production file and the completed tree is green; the per-phase preservation claims rest on each earlier phase's own verification record, which a human should accept or re-audit at milestone close."
  - id: D7
    description: "The broken-windows ledger's frontmatter counters agree with its rows, and the seven accepted shortfalls stay open"
    verification:
      - kind: other
        ref: "awk row tally -- rows=29 open=22 fixed=7 declared=29/22/7, exit 0"
        status: pass
    human_judgment: false
  - id: D8
    description: "Everything D-117-13 chose to record rather than fix is written down in one place, and D-117-14's question is left open"
    verification: []
    human_judgment: true
    rationale: "The recorded-not-fixed set and the deliberately-open operator decision are prose findings; no gate asserts their presence, and the operator is the reader they exist for."

duration: 15 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 12: Closing Inventory Sweep Summary

**The inventory now records what was measured: 204 closed rows, 48 closed requirements, a 204/204 roadmap, and a ledger whose counters were counted rather than read.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-03T22:17:00Z
- **Completed:** 2026-09-03T22:32:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Closed all 154 open inventory rows and all 37 remaining requirement dispositions, in both places each appears, on stated evidence.
- Brought the roadmap to 204/204 Complete with phase 117 at 12/12 and both recent milestone checkboxes checked, entirely by hand — the prohibited progress verb was never run.
- Rewrote the state narrative for the closed phase, restated the leaked phase-116 block as history, and repaired two truncation artifacts the phase-completion verb had left behind.
- Amended D-117-20 in the phase context record to the measured 190 + 7 + 7, the last document still carrying the superseded 197 + 7 wording.
- Filed the last documentation drift in the ledger and re-derived its counters by counting rows.

## Task Commits

1. **Task 1: Close the inventory rows and the requirement dispositions** — `e474dab7` (docs)
2. **Task 2: Bring the roadmap and the state narrative to the measured totals** — `6e1199f4` (docs)
3. **Task 3: Reconcile the broken-windows ledger and record what stays open** — `91604aa1` (docs)

## Files Created/Modified

- `.planning/REQUIREMENTS.md` — 204 inventory rows closed, 37 requirements closed in checklist and mapping, header and footer prose brought to the closed state
- `.planning/ROADMAP.md` — pair total, phase row, prose plan count, plan checklist and two milestone checkboxes
- `.planning/STATE.md` — frontmatter, current position, progress bar, blockers, session continuity, the phase-117 section and the environment debts
- `.planning/WINDOWS.md` — entry 29 filed; counters 29/22/7
- `.planning/phases/117-extension-entry-and-final-gate/117-CONTEXT.md` — D-117-20 amended

## Measurements taken in this session

Every number below came from a command run during this plan, unpiped, with its own exit code read. The shell here is zsh, where `$status` aliases `$?`, so a piped reading reports the pipe's tail rather than the command.

| What | Command | Result |
| --- | --- | --- |
| Unit suite | `npm test` | 5142 tests / 295 suites / 5142 pass / 0 fail, exit 0, Node v26.8.1 |
| Integration suite | `npm run test:integration` | 31/31, exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Correspondence gate | `npm run test:corresponding` | exit 0, `Corresponding-test gate passed.` |
| Correspondence negative control | `npm run test:corresponding:negative` | exit 0 |
| Direct-coverage negative control | `npm run test:coverage:direct:negative` | exit 0 |
| Production untouched all phase | `git diff --quiet 562f5d13 HEAD -- extensions/` | exit 0 |
| Inventory rows | `rg -c '^\| P1[0-9][0-9]-[0-9]'` | 204 |
| Open inventory rows, before the sweep | `rg -c '\| Open +\|'` | **154** |
| Ledger rows by status | awk tally over the rows | 29 rows, 22 open, 7 fixed; frontmatter agrees |
| Plan and summary files | `find .planning/phases -name '1??-??-{PLAN,SUMMARY}.md'` | 220 plans, 220 summaries after this one |

## Where the plan's stated figures disagreed with the tree

The plan asked for the measurement to win where it disagreed. Four places it did.

1. **The open-row count matched.** Planned 154, measured 154. The distribution also matched the plan's warning that the drift is not contiguous: phases 110 (12), 111 (31), 112 (31), 113 (35), 114 (14), 116 (30) and the single phase-117 entry row — with phase 115 already swept. Phase 116's own 30 rows were the block the older ~115 estimate missed.

2. **Neither module-completion requirement was half-closed.** The plan said "one of them already reads complete in one place and pending in the other". Measured: MOD-07 and MOD-10 both read `- [ ]` in the checklist **and** `Pending` in the mapping. Both places of both requirements were pending. The failure mode the plan warned about had not yet occurred.

3. **The roadmap's phase-117 plan count was not "one plan".** The plan described a prose count reading "1 plan" and a checklist listing one plan. Measured: the prose read `**Plans**: 11/12 plans executed` and the checklist already listed twelve entries — earlier plans in the phase had kept them current. What was actually stale was the progress-table row (`11/12 | In Progress`, with its column alignment collapsed), the total row (`203/204`, `In Progress`), and both milestone checkboxes.

4. **The ledger was not 22 rows with 17 open and 5 fixed.** Measured before any edit: **28 rows, 21 open, 7 fixed**, and the frontmatter counters already agreed with the rows. Entries 27 and 28 had been opened and closed by 117-11 after the plan was written.

## The evidence each closed block rests on

OWN-05 keeps a row open until its pair plan records complete guideline evidence, so each block was closed against two things, not one:

- **Its phase is verified complete.** The roadmap progress table was read before each block was swept: 110 (12/12), 111 (31/31), 112 (31/31), 113 (35/35), 114 (14/14) and 116 (31/31) all read Complete with a date, and every one has a `*-SUMMARY.md` on disk for every `*-PLAN.md` (220/220 measured by `find`).
- **The row has a verdict in the retained all-pair result.** `117-ALL-PAIR-RESULT.ndjson` holds 204 rows over 204 distinct source paths, tallied from the file as 190 `complete`, 7 `accepted-shortfall`, 7 `type-only`. No row is silent.

The phase-117 entry row `P117-01` closed on its own record: the gate driven against `extensions/pi-claude-marketplace/index.ts` returned `complete` at `branches 15/15, functions 3/3, lines 161/161`, exit code 0.

## The two dispositions that are explained rather than asserted

**SUITE-05** asks that focused tests, direct coverage for all pairs, planted negative controls **and `npm run check`** pass on the completed tree. `npm run check` cannot discharge it in this checkout: the script is `typecheck && lint && fallow && format:check && test && test:integration`, and its `format:check` link fails on the operator's pre-existing untracked files (`.mcp.json`, the research cache, root scratch files) and short-circuits **before** `test` ever runs. Running it would have produced a red result that says nothing about this tree's tests, and treating a green `check` as proof would have been the "green run that checked nothing" this milestone exists to remove. It is marked Complete on the five gates run separately with each exit code read unpiped — `npm test` 5142/295/0, `test:integration` 31/31, `typecheck` 0 — plus the three controls (correspondence gate, correspondence negative control, direct-coverage negative control), all exit 0, and the all-pair result recorded in `117-ALL-PAIR-RESULT.md`. `lint` and `fallow` were not re-run here; 117-11 recorded them at 0 and this plan changed no file either tool reads.

**COV-05** asks for one complete direct coverage record for each of the 204 rows. It is met under D-117-20 **as amended**: 190 complete numeric records, 7 accepted D-116-01a shortfalls, 7 type-only verdicts by name. The amendment was the operator's decision after 117-11 measured that the original 197 + 7 reading cannot hold on this tree, and this plan carried it into the decision record itself — the last document still reading 197 + 7. The artifact is cited in REQUIREMENTS.md's inventory preamble.

**COV-01** carries the same exception and is marked Complete on the same basis: seven pairs fall one branch short (two of them also short on lines), the operator accepted them in phase 116 under D-116-01a, and MOD-09 was already Complete on that basis before this plan ran. Their ledger entries stay open.

## Recorded rather than fixed — the D-117-13 set, in one place

D-117-13 opened no production licence, so none of these was corrected. All were re-verified in this session against the tree.

1. **Two `edge/register.ts` comments assert a working-directory capture the code does not make** (lines 18-20 and 104-106). `process.cwd()` is evaluated inside the `getArgumentCompletions` arrow, so it is read per completion invocation and nothing is closed over. Already filed as **ledger entry 20**; cited, not duplicated.
2. **`edge/completions/data.ts` advertises an export that does not exist.** The header at lines 6-8 lists `getScopeCompletions` among the module's pure helpers. Measured: that string appears exactly once in the file — in the comment. There is no such symbol.
3. **`edge/completions/data.ts` describes `--partial` as widening a set it in fact shifts** (comment at 361-364). Measured: `INSTALL_STATUSES` is `{available, remote}` (line 64) and `PARTIAL_INSTALL_STATUSES` is `{available, partially-available}` (lines 71-74). The flag drops `remote` and adds `partially-available`; it does not widen, and the no-flag set is not `available`-only as the comment claims.
4. **`BOOLEAN_FLAGS` is re-exported from a handler solely to keep an architecture suite compiling.** Measured: `export { BOOLEAN_FLAGS };` at `edge/handlers/plugin/list.ts:82`, imported at `tests/architecture/flag-catalog-drift.test.ts:48` and used at line 110. No production consumer.
5. **The stale test-path reference the entry-pair plan created.** `bridges/hooks/event-router.ts:741` names `tests/edge/index-handler.test.ts` as the pin for the clean-reconcile invariant; 117-08 deleted that suite. Confirmed already filed by that plan as **ledger entry 26** — checked, not re-filed.

## Still OPEN for the operator, and deliberately not decided here

**The tool `available` / `unavailable` parameter descriptions.** After D-116-15's CR-01 fix made the `remote` and `partially-available` arms reachable, the wording admits a bucket it does not name. D-117-14 holds this open, and this plan does not decide it: the descriptions are part of a published tool contract a language model consumes and of a pinned registration schema, so the change is **one-way** — a later revert is a second contract change, not an undo. Recorded in STATE.md as the milestone's one remaining open operator decision.

## Also recorded, not fixed

**A codebase-conventions document describes an aggregate bridges barrel that does not exist.** `.planning/codebase/CONVENTIONS.md:151` says barrels exist per bridge kind "plus the aggregate `bridges/index.ts`". Measured: `extensions/pi-claude-marketplace/bridges/` holds `agents/`, `commands/`, `hooks/`, `mcp/`, `skills/` and `README.md` — no `index.ts`. The five per-kind barrels do exist, so only the aggregate clause is wrong. Filed as **ledger entry 29** and left unfixed: it is a planning document outside this phase's scope.

Three items in `deferred-items.md` also remain open, all stale documentation references: item 1 (`install.messaging.ts` doc comment, ledger 23), item 2 (`docs/output-catalog.md:2729`, ledger 24) and item 3 (`.planning/codebase/TESTING.md`, ledger 25). Items 1 and the related `event-router.ts` comment live under `extensions/`, which this phase does not touch. Items 4 and 5 are resolved.

## Decisions Made

- **Removed the duplicate bare plan list under phase 117 in the roadmap.** The progress verb had injected `- [x] 117-01-PLAN.md` … beside the descriptive `- [x] **117-01** (…) - objective` list. No other phase in the file carries two lists, and two lists is the structure the recurring off-by-one drift lives in. The surviving list is the descriptive one, which is what the plan asked for ("each with its one-line objective").
- **Marked the phase-117 requirement checklist boxes as well as the mapping rows.** The plan's task text names only the mapping table for the 34 non-module requirements, but leaving 34 checklist boxes unchecked while the mapping reads Complete would recreate exactly the two-places drift this plan exists to remove. Both were updated for all 37.
- **Widened the Status column header and separator in eight inventory tables** so `Complete` fits. One of the eight (phase 115) had rows already reading `Complete` under a six-wide header — a pre-existing misalignment, now consistent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Amended D-117-20 in `117-CONTEXT.md`**

- **Found during:** Task 2
- **Issue:** The plan's `files_modified` names four files and does not include `117-CONTEXT.md`, but STATE.md's own Blockers section recorded "D-117-20 must be amended in 117-CONTEXT.md … Owned by the 117-12 sweep", and the decision record was the last document still carrying the superseded "197 records plus 7 type-only" wording. Closing that blocker without making the edit would have made STATE.md itself untrue.
- **Fix:** Rewrote D-117-20 to read 190 complete numeric records + 7 accepted D-116-01a shortfalls + 7 named type-only rows, naming the seven claimants and their ledger entries, quoting the superseded wording explicitly as superseded, and citing both artifacts. The blocker entry now reads RESOLVED.
- **Files modified:** `.planning/phases/117-extension-entry-and-final-gate/117-CONTEXT.md`
- **Verification:** `rg '197 records plus 7|COV-05 reads as 197'` matches only the line that quotes the old wording as history.
- **Committed in:** `6e1199f4`
- **Scope check:** the file is inside the planning tree, so the plan's "must not touch any file outside the planning tree" prohibition is not crossed.

**2. [Rule 1 - Bug] Repaired a mapping-table cell that lost its trailing pad**

- **Found during:** Task 1
- **Issue:** The first pass replacing `Pending` with `Complete` in the requirement-to-phase mapping dropped the space before the closing pipe, producing `| Complete|`.
- **Fix:** Re-padded all 37 cells to `| Complete |`; verified zero occurrences of `Complete|$` remain.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Committed in:** `e474dab7`

---

**Total deviations:** 2 auto-fixed (1 × Rule 2, 1 × Rule 1)
**Impact on plan:** No scope creep. Both stayed inside the planning tree; nothing outside it was touched, confirmed by `git diff --quiet -- extensions/ tests/ scripts/ package.json` exiting 0 at every task's verify.

## Tooling: what was used and what it did

- **`roadmap.update-plan-progress` — NOT used**, per the plan's outright prohibition. Every roadmap edit was a hand-applied exact-string substitution with an anchor assertion, then diffed. The diff is seven hunks and nothing else moved.
- **`state.advance-plan`, `state.update-progress`, `state.record-metric`, `phase.complete`, `state.add-decision` — NOT used.** The plan documents each as damaging (blind increment, writes nothing, double-increment, cannot write root planning files under workstream mode plus multi-line frontmatter truncation, rejects an out-of-root summary path). STATE.md was hand-edited instead, including its `progress` counters, which were set from a measured `find`: `completed_phases: 10`, `completed_plans: 220`.
- **`windows append` — used, and it behaved.** It updated both the markdown table and the JSON mirror and recomputed the counters; the diff is 16 added lines and three counter lines, nothing else. The result was still verified independently by tallying the rows rather than trusting the header.
- **Two truncation artifacts repaired by hand**, both left by earlier `phase.complete` runs: nine lines of phase-116 narrative leaked into the Current Position block below `Status:`, and a fragment (`twelve plans. Read 117-CONTEXT.md …`) leaked under `**Resume file:** None`. Both are the documented "truncates a multi-line frontmatter field to its first line and leaks the remainder" defect.

## Issues Encountered

None. Every task's verify block passed on its first run after the edits.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 117 is complete and so is milestone v1.19: ten phases, 220 plans, 220 summaries, 204 pairs, 48 requirements. `/gsd-complete-milestone` is the next step.

Two things it will meet:

- **The workstream wall.** `phase.complete` cannot write the root planning files while workstream mode is active and neither workstream holds v1.19. Every transition from 114 onward was hand-applied; the milestone close will be too.
- **The ship gate reads the ledger's open count**, which is 22. Seven of those (entries 15-19, 21, 22) are accepted D-116-01a shortfalls pinned by identity and must not be closed by bookkeeping; they close only by a production rewrite. The rest are documented findings awaiting an operator decision or a licence.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*

## Self-Check: PASSED

All five modified planning files exist on disk. All four commits
(`e474dab7`, `6e1199f4`, `91604aa1`, `4f343a7b`) are reachable from
`git log --oneline --all`. All three task verify chains were re-run after the
SUMMARY landed and each exits 0, including
`git diff --quiet -- extensions/ tests/ scripts/ package.json`: nothing outside
the planning tree changed.
