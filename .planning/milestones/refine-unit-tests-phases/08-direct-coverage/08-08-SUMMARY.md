---
phase: 08-direct-coverage
plan: 08
subsystem: testing
tags: [direct-coverage, pinned-snapshot, requirement-seal, planning-contract, documentation]

requires:
  - phase: 08-direct-coverage
    provides: "08-01's repaired reporter and its first measured enumeration -- the only before-tally this plan's comparison can be taken against"
  - phase: 08-direct-coverage
    provides: "08-02's three guard rewrites and 08-03's two test closures, which are five of the five rows that left the shortfall set"
  - phase: 08-direct-coverage
    provides: "08-04's `loadCoveragePin` / `assertPinnedReadings` and the committed pin this plan regenerates, plus the all-pair arm that compares it"
  - phase: 08-direct-coverage
    provides: "08-05's removal port and 08-07's seventeen closed runs, which moved `install-outcome.ts` to the reading this plan re-measured"
provides:
  - "a second complete sweep of all 230 pairs taken in this repository after every code plan landed -- `accepted-shortfall 2, complete 221, type-only 7`"
  - "the committed pin regenerated from that sweep, proved byte-identical to the artifact 08-04 generated at its own head"
  - "a green strict all-pair arm on the final tree: 230 pairs, 492.4s, exit 0"
  - "`RCOV-01`, `RCOV-02`, and `RCOV-04` clause text that names measured modules, readings, and a reproduction command instead of an inherited count"
  - "all three requirement-clause signature carriers back in agreement: `Scope impact valid: 40 records.`"
  - "`CONTRIBUTING.md` stating the pinned set, how the pin fails in three directions, both gate scopes with their measured costs, and the reachability boundary"
affects: [08-09, direct-coverage, ci-coverage-job, pre-commit-hook]

actuals:
  tokens: 4507
  tasks: 3
  commits: 3
  plan_head_before: 06d2660a53dc0debc4db476e06081253e17bc53a
  # `commits` is MEASURED (`git rev-list --count 06d2660a..HEAD`), not narrated: two TASK commits
  # plus this plan's metadata commit. Two rather than three task commits because task 1's artifact
  # came back byte-identical to the committed one, so there was nothing to commit -- deviation 1.
  # `tokens` is estimateTokens (chars/4) over `git diff 06d2660a..HEAD` across the five changed
  # files, the same scale 08-04, 08-06 and 08-07 used and NOT the scale 08-05's 157916 used.

tech-stack:
  added: []
  patterns:
    - "A generated artifact that comes back identical is a result, not a no-op: the generator ran, the bytes were compared, and the agreement is the finding"
    - "A clause sealed by hash is rewritten in three places in one change -- the prose, the script's sealed table, and the ledger's scope change -- because the checker compares all three and fails on any pair of them disagreeing"
    - "Signature recomputation is done with the production normalizer's exact steps, verified by reproducing the CURRENT sealed values before any edit, so a normalization mistake shows up as a mismatch on known-good input rather than as a sealed wrong answer"

key-files:
  created:
    - .planning/phases/08-direct-coverage/08-08-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md
    - scripts/revalidation.mjs
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/ROADMAP.md
    - CONTRIBUTING.md
    - .planning/phases/08-direct-coverage/deferred-items.md

key-decisions:
  - "The pin was regenerated from the second sweep's `accepted-shortfall` rows and then compared to the committed file; it is byte-identical, so task 1 has no commit. The agreement is the measurement's result -- 08-04's pin, generated at its own head, still describes the final tree"
  - "`RCOV-04`'s clause was rewritten too, against the plan's `read_first` note that it stays as it is: it carried `RCOV-01`'s 204 as a live cross-reference, and task 2's own acceptance criterion demands zero occurrences of 204 anywhere in the requirements record"
  - "`RCOV-04` lost the count rather than gaining the new one (`complete all-pair baseline`), so the cross-reference cannot go stale again the next time the enumeration moves"
  - "`CONTRIBUTING.md` says the hook and the CI job are not wired yet, because they are not: 08-09 owns `RCOV-03` and has not run, and a present-tense claim about a job that does not exist is the exact defect class this phase exists to retire"
  - "The whole-tree figure is stated as around eight minutes, the measured value here and in 08-01, not the plan's inherited nine"
  - "Neither `RCOV-01` nor `RCOV-02` is marked complete: `SEALED_REQUIREMENT_ROUTES` pins both at `Phase 8` / `Pending` until the phase seals, so flipping a checkbox would fail `scope-impact --check` on the route contract"

patterns-established:
  - "Run the long sweep first and in the background, then read context while it works -- the second sweep and the strict arm are sixteen minutes of wall clock that no amount of planning shortens"
  - "Hold every edit to a file the running sweep measures until it finishes; `scripts/revalidation.mjs` and `.planning/` are one pair, and a half-applied seal during the run reports as a coverage failure"

requirements-completed: []

coverage:
  - id: D1
    description: "A second complete sweep of every enumerated pair ran in this repository after all code work landed, and the committed pin is generated from that run"
    requirement: RCOV-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct:report -- 230 rows in 486.9s, exit 0, row count equal to productionPaths().length (230)"
        status: pass
      - kind: other
        ref: "the pin was regenerated from coverage/all-pairs-report.ndjson's accepted-shortfall rows, normalized through prettier, and `git status --porcelain` on it came back empty"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pin equals the sweep's refusal set in both directions and the strict all-pair arm exits 0 on the final tree"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "assertPinnedReadings over the sweep's refused rows, the loaded pin, and productionPaths() -- `sweep refused 2, pin holds 2, bidirectional match`"
        status: pass
      - kind: integration
        ref: "node scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl -- `All-pair run complete: 230 pairs in 492.4s`, exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "`RCOV-01` names the measured pair count with its reproduction command and `RCOV-02` names modules and readings with no count"
    requirement: RCOV-01
    verification:
      - kind: other
        ref: "grep -c 204 .planning/REQUIREMENTS.md == 0; neither `seven terminal shortfalls`, `two removable`, nor `five genuinely` survives"
        status: pass
    human_judgment: false
  - id: D4
    description: "All three requirement-clause signature carriers agree after the rewrite"
    requirement: RCOV-01
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs scope-impact --check -- `Scope impact valid: 40 records.`, exit 0"
        status: pass
      - kind: unit
        ref: "node --test tests/architecture/revalidation.test.ts -- tests 136, fail 0, including the live-tree RVAL-04 case"
        status: pass
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs scripts/revalidation.mjs -- `Direct coverage passed: branches 789/789, functions 202/202, lines 2660/2660`"
        status: pass
    human_judgment: false
  - id: D5
    description: "`CONTRIBUTING.md`'s rows equal the pin's rows, the three superseded claims are gone, and both gate costs are stated"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "the pin is loaded and every row's module and reading is asserted present in CONTRIBUTING.md -- `lists all 2 pinned rows with their readings`"
        status: pass
      - kind: other
        ref: "negative grep for `no CI job`, `deliberately not taught`, `each by one branch the compiler forces`, `ten focused test runs`; positive grep for the pin path, `SKIP=npm-coverage-direct`, `reachability`"
        status: pass
    human_judgment: false
  - id: D6
    description: "The rewritten prose describes the tree a contributor will actually meet"
    verification: []
    human_judgment: true
    rationale: "`CONTRIBUTING.md` now says the hook and the CI job are not wired yet. That is true at this commit and false the moment 08-09 lands, and 08-09's task 3 is what removes the sentence. An operator should confirm that stating the gap is preferable to describing the wiring in advance -- this plan judged that it is, because the phase's whole subject is records that describe something the tree does not have."

duration: 47min
completed: 2026-09-11
status: complete
---

# Phase 8 Plan 08: The Second Sweep and the Coordinated Rewrite Summary

**The second full sweep reads `accepted-shortfall 2, complete 221, type-only 7` over 230 pairs, the pin regenerated from it is byte-identical to the committed one, the strict all-pair arm exits 0 on the final tree, and five records that carried a stale count or a stale membership now carry the measurement.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-09-11T13:05:00Z
- **Completed:** 2026-09-11T13:52:00Z
- **Tasks:** 3 of 3
- **Files modified:** 6 (1 created, 5 modified; task 1 changed none -- see deviation 1)

## The second sweep

Run in this repository checkout (`D-08-A10`), on Node `v26.8.2`, after plans 02, 03, 05, 06 and 07
had all landed. The last two stdout lines, verbatim:

```
All-pair report written: 230 rows in 486.9s on v26.8.2 to coverage/all-pairs-report.ndjson
Verdicts: accepted-shortfall 2, complete 221, type-only 7
```

230 rows, equal to `productionPaths().length`. The run was not halted: the row count matches the
enumeration and the `Verdicts:` tally is present, which is the pair of assertions `T-08-04` asks
for because this reporter's known defect class is exiting with a plausible-looking partial tally.

The strict arm was then run against the same tree:

```
All-pair run complete: 230 pairs in 492.4s (492391ms) on v26.8.2
ALLPAIRS EXIT=0
```

Exit 0 from that arm is the strongest single statement in this plan. The arm records every refused
pair and compares the whole set against the pin, so a third shortfall anywhere in the tree, a
pinned reading one branch different, or a pinned module that had gone complete would each have
failed it.

## Before and after, against the first sweep

`08-01-SUMMARY.md` measured `accepted-shortfall 7, complete 216, type-only 7`. Every one of those
seven rows is accounted for, and nothing new appeared:

| module (under `extensions/pi-claude-marketplace/`) | first sweep | second sweep | what happened |
| --- | --- | --- | --- |
| `bridges/commands/discover.ts` | `branches 55/57, lines 412/414` | same, refused | **stayed** -- pinned, reading unmoved |
| `orchestrators/plugin/install-outcome.ts` | `branches 60/83, functions 22/27, lines 956/1031` | `branches 109/111, lines 1034/1040`, refused | **stayed** -- pinned, reading moved by 08-05's port and 08-07's seventeen closed runs |
| `bridges/hooks/event-router.ts` | `branches 107/111, lines 959/967` | complete | closed by 08-03's three generation-guard cases |
| `orchestrators/plugin/update-preflight.ts` | `functions 20/21, lines 589/593` | complete | closed by 08-03's two predicate cases |
| `edge/args.ts` | `branches 28/29, lines 86/89` | complete | closed by 08-02's `entries()` rewrite |
| `edge/handlers/shared.ts` | `branches 14/15, lines 83/85` | complete | closed by 08-02's `for...of` rewrite |
| `edge/handlers/plugin/pending.ts` | `branches 9/10` | complete | closed by 08-02's destructuring rewrite |

Rows that appeared between the sweeps: **none**. `complete` moved 216 to 221, exactly the five
closures; `type-only` is unchanged at 7. No `accepted-shortfall` row lacked an existing pin row, so
`D-08-09a`'s "record why neither a rewrite nor a test can reach it, or escalate" examination has no
members this run and nothing is escalated.

## The pin, as regenerated

Two rows, sorted by `sourcePath`, each `reading` copied from its report row's `coverage` value --
which is the gate's own formatted `<counts>` substring, so the pin cannot drift from the gate's
vocabulary:

| module | reading | findingIds | reasons |
| --- | --- | --- | --- |
| `bridges/commands/discover.ts` | `branches 55/57, lines 412/414` | `BC-019` | 178's `?? ""` arm, which `isErrnoException` already makes unreachable while `ErrnoException`'s `code?: string` forces it to exist; 288-290's `CommandNameError` narrowing arm, unreachable but still narrowing the `unknown` catch binding |
| `orchestrators/plugin/install-outcome.ts` | `branches 109/111, lines 1034/1040` | `D-08-A14` | 422-426's re-validation of a manifest entry the identical compiled schema accepted in the same pass; 818-820's hooks re-parse guard over bytes the resolver already ran both `{ok:false}` arms on |

Both rows' reasons were carried forward from the pin 08-04 committed; neither `sourcePath` is new,
so no reason was written fresh, and `orchestrators/plugin/install-outcome.ts` is present under
`D-08-A14`, which reversed `D-08-A06`'s prohibition on the operator's decision.

## Accomplishments

- **The pin is a measurement that agreed with itself.** Generated from the second sweep, sorted,
  serialized, normalized through prettier, and then compared: `git status --porcelain` on it comes
  back empty. 08-04 generated its rows at its own head and forbade this plan from trusting them;
  this plan did not, and the regenerated bytes match anyway. That is a result rather than an
  assumption, and it is what makes the committed artifact a statement about the final tree.
- **Five records now say the same measured thing.** `.planning/REQUIREMENTS.md`,
  `scripts/revalidation.mjs`, `01-REVALIDATION.json`, `.planning/ROADMAP.md`, and `CONTRIBUTING.md`
  all name modules and readings. None of them restates a shortfall count.
- **The seal held across the rewrite.** Three clauses changed, three signatures were recomputed with
  the production normalizer's own steps, and the values were written into both carriers.
  `node scripts/revalidation.mjs scope-impact --check` prints exactly `Scope impact valid: 40
  records.` The method was checked against known-good input first: the helper reproduced the three
  CURRENT sealed values byte for byte before any clause was touched, so a normalization mistake
  would have shown up as a mismatch on the old text rather than as a confidently sealed wrong
  answer.
- **`scripts/revalidation.mjs`'s diff is three lines and no dash.** The whole change to that file is
  three entries of `SEALED_REQUIREMENT_SIGNATURES`. `SEALED_REQUIREMENT_ROUTES` has no diff, no
  em-dash byte moved, and the `fix-unicode-dashes` hook reports `no files to check` for it because
  the exclusion 08-01 widened still covers it.
- **`CONTRIBUTING.md`'s three false claims are gone rather than softened.** The seven-row table (four
  of whose modules read complete and neither of whose current refusals it named), the "each by one
  branch the compiler forces" sentence (false on both clauses), and the paired
  exception-list-and-no-job rationale. In their place: the pin's two rows, what a pinned row is, the
  three directions the pin fails in, both gate scopes with their measured costs, the sanctioned
  `SKIP=npm-coverage-direct` escape, and the reachability boundary -- which the file did not
  previously state at all.

## Task Commits

1. **Task 1: Run the second full sweep and generate the committed pin from it** -- no commit; the
   regenerated artifact is byte-identical to the committed one (deviation 1)
2. **Task 2: Rewrite the RCOV clauses and re-seal across all three carriers** -- `d6a0e7af` (docs)
3. **Task 3: Bring the roadmap criteria and `CONTRIBUTING.md` into agreement** -- `3925ce0e` (docs)

## Files Created/Modified

**Created**

- `.planning/phases/08-direct-coverage/08-08-SUMMARY.md` -- this file.

**Modified**

- `.planning/REQUIREMENTS.md` -- `RCOV-01` names the measured 230 and the command that reports it;
  `RCOV-02` names the three rewritten guards, the two test-closed modules, and the two pinned
  modules with their readings; `RCOV-04` drops the inherited count entirely.
- `scripts/revalidation.mjs` -- three `SEALED_REQUIREMENT_SIGNATURES` values.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` -- the same three
  signatures, plus `SCOPE-REQ-RCOV-01`'s and `SCOPE-REQ-RCOV-02`'s `afterAnchor` and one added
  rationale sentence each citing `D-08-A02`. `beforeAnchor`, `findingIds`, `decisionIds`, and
  `action` are untouched, and the record count is still 40.
- `.planning/ROADMAP.md` -- §"Phase 8" criteria 1 and 2. Criteria 3 and 4 have no diff.
- `CONTRIBUTING.md` -- §"Coverage sweeps" and §"The whole-tree report".
- `.planning/phases/08-direct-coverage/deferred-items.md` -- the `WINDOWS.md` item re-checked and
  re-routed (see Issues Encountered).

## Decisions Made

1. **`RCOV-04`'s clause was rewritten, against the plan's `read_first` note.** See deviation 2. It
   lost the number rather than gaining the new one, so the cross-reference to `RCOV-01`'s baseline
   cannot go stale again.
2. **Neither `RCOV-01` nor `RCOV-02` is marked complete.** `SEALED_REQUIREMENT_ROUTES` pins
   `RCOV-01` through `RCOV-03` at `Phase 8` / `Pending` until the phase seals, and
   `validateRequirementDisposition` compares the live status against it. Flipping a checkbox would
   fail `scope-impact --check` on the route contract, which is a stronger reason than the phase
   convention that 08-09 flips `RCOV-02` -- both point the same way.
3. **`CONTRIBUTING.md` states that the hook and the CI job are not wired yet.** The plan's task 3
   asks the file to say the gate "now runs" in both. It does not: 08-09 owns `RCOV-03` and has not
   run, `.pre-commit-config.yaml` has no `npm-coverage-direct` hook, and `.github/workflows/` has no
   coverage job. Writing the present tense would have put a false claim into the file in the same
   commit that removes three others. The sentence names both scopes, both bases, and both costs, and
   08-09's task 3 deletes the one clause that will become stale.
4. **The whole-tree cost is stated as around eight minutes.** The plan asked to keep "around nine
   minutes ... which this phase's measurement confirms." It does not confirm it: 08-01 measured
   479.8s, this plan measured 486.9s and 492.4s. Eight is the honest rounding of all three.
5. **The branch-scoped cost is given as the measured 147 pairs and about six and a half minutes**,
   `D-08-A07`'s figure, with the note that it grows with the branch. `D-08-17`'s "ten focused test
   runs" was not copied, per `D-08-A07`.

## Deviations from Plan

### 1. [Measurement] Task 1 produced no commit, because the regenerated pin was already correct

- **Found during:** Task 1, at its commit step.
- **Issue:** The plan expects a commit per task and task 1's file is
  `scripts/test-coverage-direct.pin.json`. The pin was generated from the second sweep's
  `accepted-shortfall` rows as specified -- not hand-authored, not copied from a document -- sorted
  by `sourcePath`, serialized as `JSON.stringify(pin, null, 2)` plus a trailing newline, and then
  normalized through prettier (08-04's deviation 2 recorded that the generated form is not
  prettier-clean for a one-element `findingIds` array, and that reproduced here exactly). The
  result is byte-identical to the committed file: `git status --porcelain` on it is empty.
- **Fix:** None needed. There is nothing to commit, and an empty commit would record a change that
  did not happen. The measurement itself is the deliverable and it is recorded above.
- **Files modified:** none.
- **Verification:** `git diff --stat -- scripts/test-coverage-direct.pin.json` empty after the
  generator and prettier both ran; `./node_modules/.bin/prettier --check` exits 0; the bidirectional
  comparator prints `sweep refused 2, pin holds 2, bidirectional match`; the strict all-pair arm
  exits 0.
- **Committed in:** n/a

### 2. [Rule 3 - Blocking] Task 2's two acceptance criteria could not both be satisfied

- **Found during:** Task 2, reading `.planning/REQUIREMENTS.md`.
- **Issue:** The task's verify requires `grep -c "204" .planning/REQUIREMENTS.md` to be `0`, "meaning
  the superseded pair count survives somewhere in the requirements record". `204` occurs twice: in
  `RCOV-01`'s clause and in `RCOV-04`'s evidence record, which reads "superseded by `RCOV-01`'s
  complete 204-pair baseline". But another criterion of the same task requires
  `SEALED_REQUIREMENT_SIGNATURES` to differ "for exactly the `RCOV-01` and `RCOV-02` keys", and the
  action says to edit no other requirement's clause. `RCOV-04`'s clause is sealed too --
  `parseRequirementClauses` reads the `## Evidence and History` section with its own pattern -- so
  any edit to it changes a third signature. The two criteria contradict each other.
- **Fix:** Took the grep criterion and `D-08-01` ("Every artifact naming 204 ... is corrected to the
  measured count in this phase"), which agree. `RCOV-04`'s clause was rewritten minimally --
  `complete 204-pair baseline` to `complete all-pair baseline`, one phrase, no other word changed --
  and its signature re-sealed in both carriers alongside the other two. Its `afterAnchor`,
  `beforeAnchor`, `findingIds`, `decisionIds`, `action`, and `rationale` are untouched, and the
  record count the live-tree case asserts is still 40.
- **Files modified:** `.planning/REQUIREMENTS.md`, `scripts/revalidation.mjs`,
  `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`
- **Verification:** `grep -c "204" .planning/REQUIREMENTS.md` is `0`;
  `node scripts/revalidation.mjs scope-impact --check` prints `Scope impact valid: 40 records.`;
  `node --test tests/architecture/revalidation.test.ts` reports `fail 0`.
- **Committed in:** `d6a0e7af`

### 3. [Rule 1 - Bug] `CONTRIBUTING.md` would have carried a new false claim

- **Found during:** Task 3, before writing the gate-location paragraph.
- **Issue:** The action instructs the file to "Say that the changed-pair gate now runs in a dedicated
  CI job and in a scoped local pre-commit hook." Neither exists at this commit:
  `.pre-commit-config.yaml`'s local hooks are `npm-lint`, `npm-format-check`, `npm-typecheck` and
  `npm-fallow` only, and no workflow in `.github/workflows/` mentions the coverage gate. 08-09 wires
  both and has not run. Writing the present tense would have removed three false claims and added a
  fourth in the same commit.
- **Fix:** The paragraph names both scopes, both bases, the hook id and the branch-scoped ref, and
  then says "Neither is wired yet; until they land, run the changed-pairs sweep by hand before you
  open a pull request." Every needle the task's verify requires is present. 08-09's task 3 rewrites
  this section again and removes the one clause that becomes stale.
- **Files modified:** `CONTRIBUTING.md`
- **Verification:** the task's own content check passes -- `CONTRIBUTING.md claims agree with the pin
  mechanism` -- and the negative greps for all four superseded phrases return nothing.
- **Committed in:** `3925ce0e`

### 4. [Measurement] The nine-minute whole-tree figure does not reproduce

- **Found during:** Task 3.
- **Issue:** The action says to keep `CONTRIBUTING.md`'s "around nine minutes for the whole tree"
  figure "which this phase's measurement confirms". Three measured runs say otherwise: 479.8s
  (08-01), 486.9s (this plan's report) and 492.4s (this plan's strict arm). All three round to
  eight.
- **Fix:** The sentence reads "around eight minutes for the whole tree".
- **Files modified:** `CONTRIBUTING.md`
- **Verification:** the three run lines are quoted above and in `08-01-SUMMARY.md`.
- **Committed in:** `3925ce0e`

---

**Total deviations:** 4 (1 Rule 3 blocking, 1 Rule 1, 2 measurement)
**Impact on scope:** One extra requirement clause and one extra signature key, both inside the
artifact set the plan already owns. No file under `extensions/` or `tests/` was touched.

## Verification

| check | result |
|---|---|
| `npm run test:coverage:direct:report` | exit 0 -- 230 rows in 486.9s, `Verdicts: accepted-shortfall 2, complete 221, type-only 7` |
| report row count vs `productionPaths().length` | 230 vs 230 |
| pin regenerated from the sweep, then `git status --porcelain` | empty -- byte-identical to the committed artifact |
| `./node_modules/.bin/prettier --check scripts/test-coverage-direct.pin.json` | exit 0 |
| bidirectional comparator over the sweep, the pin and the enumeration | `sweep refused 2, pin holds 2, bidirectional match` |
| `node scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl` | **exit 0** -- `All-pair run complete: 230 pairs in 492.4s` |
| `node scripts/revalidation.mjs scope-impact --check` | `Scope impact valid: 40 records.`, exit 0 |
| `node --test tests/architecture/revalidation.test.ts` | tests 136, `fail 0` |
| `node scripts/test-coverage-direct.mjs scripts/revalidation.mjs` | `Direct coverage passed: branches 789/789, functions 202/202, lines 2660/2660` |
| `grep -c "204" .planning/REQUIREMENTS.md` | `0` |
| `git diff` on `scripts/revalidation.mjs` | three signature lines; `SEALED_REQUIREMENT_ROUTES` no diff; no em-dash character changed |
| roadmap negative greps | no `204 current source-test pairs`, no `All seven terminal shortfalls`, no `the two removable`, no `the five genuinely`; criteria 3 and 4 no diff |
| `CONTRIBUTING.md` content check | `claims agree with the pin mechanism` and `lists all 2 pinned rows with their readings` |
| `SKIP=trufflehog pre-commit run --files` (both commits' file sets) | every hook `Passed`, no `files were modified by this hook` |
| `npm run check` | **exit 0** -- typecheck, lint, fallow, format:check, both corresponding gates, the direct-coverage negative harness, the unit suite and the integration suite |

`trufflehog` is skipped for the reason 08-01 recorded and `CLAUDE.md` prescribes: this checkout is a
linked worktree, so `<root>/.git` is a file and the hook cannot read `<root>/.git/index`. It
modifies nothing and CI runs it on a full clone.

## Issues Encountered

- **`.planning/WINDOWS.md` entries 19, 21 and 22 are still false and still unwritable.**
  `windows fixed 19` refuses with the same rows 9 and 30 table/JSON desync that blocked 08-02, a
  disagreement predating this phase (`697d6812`). `deferred-items.md` named 08-08 as the natural
  home because it owns the same three modules' stale `CONTRIBUTING.md` rows -- and it retired those
  rows -- but repairing 9 and 30 means regenerating the table, which destroys the prose side of the
  ledger. That is an operator decision, so the item was re-checked, annotated with what 08-08 did
  and did not do, and re-routed rather than absorbed.
- **A long sweep and an edit to a paired file cannot overlap.** `scripts/revalidation.mjs` pairs with
  `tests/architecture/revalidation.test.ts`, which reads `.planning/`, so a clause edited while the
  arm was running would have failed that pair with a signature mismatch and reported it as a
  coverage failure. The task 2 and task 3 edits were held until the arm finished, which is why the
  plan's sixteen minutes of sweeping is serial time rather than time to work in.

## Next Phase Readiness

- **08-09 has a green, agreeing tree to wire.** The strict all-pair arm exits 0, the changed-pair arm
  has its explicit base, and the pin describes the final tree. 08-09 is configuration: the
  `npm-coverage-direct` hook, the `direct-coverage` job with `fetch-depth: 0`, and the
  `test:coverage:direct:commit` script.
- **08-09 must delete one sentence.** `CONTRIBUTING.md` currently says "Neither is wired yet; until
  they land, run the changed-pairs sweep by hand before you open a pull request." That clause is the
  only forward-looking statement in the section and it becomes false the moment the hook and the job
  land. Its task 3 already rewrites this section.
- **`RCOV-01` and `RCOV-02` stay Pending.** Both are sealed at `Phase 8` / `Pending` in
  `SEALED_REQUIREMENT_ROUTES`; the phase seals them when 08-09 closes `RCOV-03`.
- **One open judgment for a reviewer, carried forward from 08-04's D5.** The pin's `reasons` are
  claims about why two arms cannot be reached. This plan re-measured both readings and confirmed the
  rows are still the complete refusal set, which is a different question. If either reason is wrong,
  the pin is an allow-list with good manners, and no gate in this repository can tell.

---
*Phase: 08-direct-coverage*
*Completed: 2026-09-11*

## Self-Check: PASSED

All six named artifacts exist on disk and both task commits resolve in `git log`.
