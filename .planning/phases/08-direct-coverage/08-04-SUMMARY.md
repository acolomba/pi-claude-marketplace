---
phase: 08-direct-coverage
plan: 04
subsystem: testing
tags: [direct-coverage, pinned-snapshot, gate-integrity, node-test, git-base-selection]

requires:
  - phase: 08-direct-coverage
    provides: "08-01's repaired reporter and measured enumeration -- the instrument that can name a shortfall set at all"
  - phase: 08-direct-coverage
    provides: "08-02's and 08-03's five closed shortfalls, which is why the pin has two rows rather than seven"
  - phase: 08-direct-coverage
    provides: "08-07's residual reading and one reason per residual site for `install-outcome.ts`, authorized as a pin row by `D-08-A14`"
provides:
  - "`scripts/test-coverage-direct.pin.json` -- the committed, measured pin: two rows, each with the gate's own reading string, authorizing finding ids, and one reason per uncovered site"
  - "`loadCoveragePin` / `assertPinnedReadings` -- a thin root-injectable loader and a pure bidirectional comparator that refuses an addition, a moved reading, a stale row, an emptied pin, and a row naming a module the tree no longer enumerates"
  - "`shortfallReadingOf` -- one exported parser for the gate's own shortfall message, shared by both gate arms and the reporter's `verdictFor`"
  - "`--base <ref>` -- a fail-closed explicit base on `selectBase`, `changedPaths` and `pairsForChangedPaths`, so one gate implementation serves a branch-scoped and a commit-scoped change set at one strictness"
  - "the first green `npm run test:coverage:direct:all`: 230 pairs, 489.4s, 228 complete-or-type-only and 2 refused rows that match the pin exactly"
affects: [08-08, 08-09, direct-coverage, pre-commit-hook, ci-coverage-job]

actuals:
  tokens: 9180
  tasks: 3
  commits: 2
  plan_head_before: c61b6ce5f567a3d78993718510dbb287cc9587aa
  # `commits` is MEASURED (`git rev-list --count c61b6ce5..HEAD` at SUMMARY write), not narrated.
  # It is 2 rather than 3 because tasks 1 and 2 could not be committed apart -- see deviation 1.
  # `tokens` is estimateTokens (chars/4) over `git diff c61b6ce5..HEAD -- scripts/`, the same scale
  # 08-06 and 08-07 used.

tech-stack:
  added: []
  patterns:
    - "Pin split in two: thin I/O (`loadCoveragePin`, root-injectable) and a pure comparator (`assertPinnedReadings`, reads no disk), which is what lets every divergence class be planted as an in-memory array with no fixture tree"
    - "The enumeration is supplied BY THE CALLER to the comparator, so the module the gate imports never imports the gate back and no cycle can form"
    - "A refused pair is recorded, not propagated: the arms keep one report row per pair and the pin comparison, rather than the loop's abort, is what refuses an unrecorded shortfall"
    - "An explicitly named argument never falls back to a discovery chain -- a named base that does not resolve is an error, because falling through answers a question nobody asked"

key-files:
  created:
    - scripts/test-coverage-direct.pin.json
    - scripts/test-coverage-direct.pin.mjs
  modified:
    - scripts/test-coverage-direct.mjs
    - scripts/test-coverage-direct.report.mjs
    - scripts/test-coverage-direct.negative.mjs

key-decisions:
  - "Both pin rows were generated from a measurement taken at this plan's own head, never copied from a SUMMARY: `discover.ts` reads `branches 55/57, lines 412/414` and `install-outcome.ts` reads `branches 109/111, lines 1034/1040`, each re-measured with the gate before the row was written"
  - "Membership was measured, not predicted: the full 230-pair sweep run through the new gate arm exits 0, so the pin's two rows are exactly the measured shortfall set rather than a projection that happened to look right"
  - "`install-outcome.ts` gets `findingIds: [\"D-08-A14\"]` -- 08-07 handed this plan the spelling, and the authorizing record for both of its sites is the decision, since neither site carries a pre-existing ledger finding the way `discover.ts` carries `BC-019`"
  - "Tasks 1 and 2 landed in one commit: `fallow dead-code` refuses an export with no consumer, so a task-1-only commit could not pass its own pre-commit run and `--no-verify` is forbidden"
  - "The changed arm measures the union of the change set and every pinned pair, so the stale direction fires on a commit that touches no pinned file"
  - "`RCOV-02` stays Pending -- 08-09 still carries it, and this phase's convention is that the last contributing plan flips it"

patterns-established:
  - "A pin is proved by planting both directions: the harness carries a passing control, then one refusal per divergence class, each with a comment naming the state it plants and why nothing else in the file could refuse it"
  - "Expected refusal text is typed out in the harness rather than imported from the module under test, so a change to a refusal has to be made in both places and cannot pass by being recomputed"

requirements-completed: []

coverage:
  - id: D1
    description: "A committed pin outside `coverage/` carries, per row, the gate's own reading string, the authorizing finding ids, and one reason per uncovered site"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs <each pinned module> -- both readings re-measured at this plan's head before the rows were written"
        status: pass
      - kind: automated_ui
        ref: "git check-ignore scripts/test-coverage-direct.pin.json exits 1 (the pin is tracked); ./node_modules/.bin/prettier --check on it exits 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both gate arms compare measurement against the pin and refuse an addition, a changed reading, a stale row, an emptied pin, and a row naming a module the tree no longer enumerates"
    requirement: RCOV-01
    verification:
      - kind: unit
        ref: "scripts/test-coverage-direct.negative.mjs -- six planted comparator states with the matching control first, run by npm run test:coverage:direct:negative inside npm run check"
        status: pass
      - kind: integration
        ref: "npm run test:coverage:direct:all -- 230 pairs in 489.4s, exit 0, with the two refused rows matching the pin exactly"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gate accepts one explicitly named base, resolves it exactly, and errors rather than falling back"
    requirement: RCOV-03
    verification:
      - kind: unit
        ref: "scripts/test-coverage-direct.negative.mjs -- selectBase(fixture, 'main') answers that candidate with an empty attempted list; an absent ref and a value with spaces are both refused with no candidate"
        status: pass
      - kind: automated_ui
        ref: "node scripts/test-coverage-direct.mjs --base origin/main prints `Changed-pair base: origin/main`; --base refs/heads/definitely-not-a-real-ref exits 1 naming the ref"
        status: pass
    human_judgment: false
  - id: D4
    description: "`assertCompleteCoverage` stays pure and the reporter gains no knowledge of the pin, while one reading parser is shared by the gate and the reporter"
    requirement: RCOV-01
    verification:
      - kind: automated_ui
        ref: "assertCompleteCoverage's signature is unchanged and its body holds no pin reference; scripts/test-coverage-direct.report.mjs holds no shortfallPattern identifier and imports shortfallReadingOf"
        status: pass
      - kind: unit
        ref: "scripts/test-coverage-direct.negative.mjs -- the existing verdictFor controls (complete, type-only, shortfall, another module's shortfall, a failed focused test) all pass through the shared parser unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every row's reasons are true of the code they name, per uncovered site"
    verification: []
    human_judgment: true
    rationale: "A reason is a claim about why an arm cannot be reached. The gate can prove the reading, and the negative harness can prove the comparison, but only a reader can judge whether `PLUGIN_ENTRY_VALIDATOR` really re-checks what `MARKETPLACE_SCHEMA.plugins` already enforced -- which is the difference between a pin and an allow-list."

duration: 90min
completed: 2026-09-11
status: complete
---

# Phase 8 Plan 04: The Coverage Pin and the Explicit Base Summary

**`npm run test:coverage:direct:all` is green for the first time -- 230 pairs, 489.4s, two refused rows that match a committed, measured pin exactly -- and the pin fails in every direction, proved by seven planted states inside `npm run check`.**

## Performance

- **Duration:** 90 min
- **Started:** 2026-09-11T11:20:00Z
- **Completed:** 2026-09-11T12:50:00Z
- **Tasks:** 3 of 3
- **Files modified:** 5 (2 created, 3 modified)

## The measurement the rows were generated from

Both readings were taken with the gate at this plan's head, before either row was written. Neither
was copied out of a document:

```
Incomplete direct coverage for extensions/pi-claude-marketplace/bridges/commands/discover.ts: branches 55/57, lines 412/414
Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts: branches 109/111, lines 1034/1040
```

Membership was then measured rather than predicted. The full sweep, run through the new all-pair arm
after the wiring landed:

```
All-pair run complete: 230 pairs in 489.4s (489377ms) on v26.8.2
ALLPAIRS EXIT=0
```

Exit 0 from that arm is the membership claim: the arm now records every refused pair and compares the
whole set against the pin, so a third shortfall anywhere in the tree, or either pinned reading being
one branch different, would have failed it. The retained `coverage/all-pairs.jsonl` holds 230 rows,
7 type-only, and exactly two refused:

| module | reading |
|---|---|
| `bridges/commands/discover.ts` | `branches 55/57, lines 412/414` |
| `orchestrators/plugin/install-outcome.ts` | `branches 109/111, lines 1034/1040` |

Both reproduce the figures 08-01 and 08-07 recorded. That is a result, not an assumption: every plan
in this phase has found at least one predicted number that did not reproduce, and 08-07 explicitly
instructed this plan not to trust its own string.

## Accomplishments

- **The pin is committed, outside gitignored `coverage/`, and carries evidence per site.** Two rows,
  sorted by `sourcePath`, each with the gate's own formatted reading string, a `findingIds` array,
  and a `reasons` array with one entry per uncovered site (`D-08-A05`). `discover.ts` carries
  `BC-019` with reasons for line 178's `?? ""` arm and lines 288-290's `CommandNameError` narrowing
  arm; `install-outcome.ts` carries `D-08-A14` with reasons for 422-426's manifest-entry re-check and
  818-820's hooks re-parse guard, taken verbatim from 08-07's handoff.
- **The comparator fails in five directions and the structural one needs no test run.** An
  unpinned shortfall, a reading that moved in either direction, a stale row, an emptied pin with a
  shortfall present, and a row naming a module outside the enumeration. Both drift directions are
  named in one message, the message names the file to update, and it restates at the point of
  failure that the record is a measurement and forgives nothing.
- **Both gate arms enforce it; `assertCompleteCoverage` never learns about it.** The comparison
  lives in `runAllPairs` and `runChangedPairs`, both module-private and neither imported by the
  reporter. `assertCompleteCoverage`'s signature, body and throw message are untouched.
- **The changed arm measures the union of the change set and every pinned pair.** Without it, the
  stale direction could never fire on a commit that does not happen to touch a pinned file, which
  would make the pin an allow-list for exactly those commits. Verified end to end:
  `node scripts/test-coverage-direct.mjs --base HEAD` selected zero changed pairs, reported the 18
  paths it passed over, then measured both pinned pairs and compared equal.
- **One reading parser, one owner.** `shortfallReadingOf` moved into the gate as a named export and
  `verdictFor` delegates to it; the reporter's local `shortfallPattern` is gone. The reporter gains
  nothing about the pin -- it loses a duplicated regex -- and its header now says so.
- **The explicit base is fail-closed.** `--base <ref>` resolves exactly that ref. A ref that does not
  resolve is an error naming it and stating that a named base is never replaced by a fallback. A
  value that is not a plain ref name is refused before git is invoked on it at all.

## Task Commits

1. **Task 1: The pin data, its loader, its pure comparator, and the one shared reading parser** -- `c4b0abf2` (feat, with task 2)
2. **Task 2: Wire the comparison into both gate arms and add the fail-closed explicit base** -- `c4b0abf2` (feat, with task 1)
3. **Task 3: Plant every pin divergence class and the explicit-base refusal in the negative harness** -- `9558acf3` (test)

## Files Created/Modified

**Created**

- `scripts/test-coverage-direct.pin.json` -- the pin. `{ version, rows }`, rows sorted by
  `sourcePath`, prettier-clean, tracked (`git check-ignore` exits 1).
- `scripts/test-coverage-direct.pin.mjs` -- the WHAT THIS PIN IS / WHAT THIS PIN IS NOT header
  (JSON carries no comment, so it lives in the module that reads the pin), the sort-order clause,
  `loadCoveragePin(selectedProjectRoot = projectRoot)`, and
  `assertPinnedReadings(observed, pinRows, enumeratedModules)`.

**Modified**

- `scripts/test-coverage-direct.mjs` -- `shortfallReadingOf` exported; `measurePair` records a
  coverage refusal and rethrows anything else; both arms compare against the pin; `pairsWithPinned`
  builds the changed arm's union; `explicitBaseSelection` plus the `explicitBase` trailing parameter
  on `selectBase`, `changedPaths` and `pairsForChangedPaths`; the `--base <ref>` argument form and
  the widened usage message.
- `scripts/test-coverage-direct.report.mjs` -- a file header recording why the shared parser does not
  weaken its independence; `verdictFor` delegates; the local regex is gone.
- `scripts/test-coverage-direct.negative.mjs` -- six comparator states over one shared row literal
  with the matching control first, two loader states under the injected fixture root, and three
  explicit-base states; the closing sentence names them all.

## Decisions Made

1. **`install-outcome.ts`'s `findingIds` is `["D-08-A14"]`.** 08-07 handed this plan the spelling on
   the ground that neither residual site carries a pre-existing ledger finding. The authorizing
   record for both is the decision that reversed `D-08-A06`, so naming it is the honest answer; a
   fabricated `IO-00x` id would point at nothing.
2. **`discover.ts`'s `findingIds` stays `["BC-019"]`,** as the plan specifies, even though `BC-019`
   covers only one of its two sites. The per-site evidence lives in `reasons`, which is the field
   `D-08-A05` widened for exactly this case, and the second reason states in its own words why the
   `?? ""` arm is unreachable rather than borrowing an id that does not cover it.
3. **The membership claim is measured, not projected.** The plan predicted two rows and forbade
   treating that as a target, so the full sweep was run through the new arm rather than the
   prediction being accepted. It agreed -- which is worth recording precisely because it might not
   have.
4. **A row naming a module outside the enumeration is passed over when the changed arm builds its
   union**, so the comparison after the loop refuses it as the structural failure it is. Pairing it
   first would have refused it as a missing pair member, which is a true statement about the file
   system and a misleading one about the pin.
5. **The harness types out the expected refusal trailer rather than importing it.** Importing the
   constant from the module under test would make the assertion recompute the value it is checking,
   and every one of the six comparator cases would keep passing through a rewrite of the refusal.

## Deviations from Plan

### 1. [Rule 3 - Blocking] Tasks 1 and 2 could not be committed separately

- **Found during:** Task 1, at its commit.
- **Issue:** The plan asks for a commit per task. With only task 1 on disk, `loadCoveragePin` and
  `assertPinnedReadings` have no consumer, and the `npm-fallow` pre-commit hook fails:
  `Unused exports (2) scripts/test-coverage-direct.pin.mjs :122 loadCoveragePin :249 assertPinnedReadings`.
  The consumers arrive in task 2. `--no-verify` is forbidden, and staging task 1 while task 2's edits
  sat unstaged in the working tree would have produced a green hook run over a tree the commit does
  not contain -- a hook that checked something other than what was committed.
- **Fix:** Implemented task 2, then committed tasks 1 and 2 together as `c4b0abf2`. Task 3 kept its
  own commit. Both tasks' acceptance criteria were verified independently before the commit.
- **Files modified:** none beyond the two tasks' own files.
- **Verification:** `SKIP=trufflehog pre-commit run --files scripts/test-coverage-direct.{pin.mjs,pin.json,mjs,report.mjs}` passes every hook including `npm fallow`.
- **Committed in:** `c4b0abf2`

### 2. [Measurement] `JSON.stringify(pin, null, 2)` is not prettier-clean for this shape

- **Found during:** Task 1.
- **Issue:** Research recorded the generated output as byte-identical to prettier's, verified against
  a one-row probe. It is not, for a row carrying a one-element array: prettier collapses
  `"findingIds": [\n  "BC-019"\n]` onto one line, and `prettier --check` fails on the generated file.
- **Fix:** The generator's output is passed through prettier before it is committed. The plan already
  required asserting `prettier --check` on the pin, which is what caught it.
- **Files modified:** `scripts/test-coverage-direct.pin.json`
- **Verification:** `./node_modules/.bin/prettier --check scripts/test-coverage-direct.pin.json` exits 0, and `npm run format:check` covers it in the check chain.
- **Committed in:** `c4b0abf2`

### 3. [Rule 2 - Missing critical coverage] A third explicit-base state was planted

- **Found during:** Task 3.
- **Issue:** The plan's harness case covers a resolvable explicit base and an unresolvable one. The
  threat register's `T-08-14` mitigation is that a value carrying whitespace or a shell
  metacharacter is refused **before** git is invoked, and nothing in the harness would have shown
  that the pattern test runs ahead of `rev-parse` rather than after it.
- **Fix:** Added a third state: `selectBase(fixture, "a ref with spaces")` answers `ok: false` with no
  candidate and a reason naming the value and the pattern rather than a git exit status.
- **Files modified:** `scripts/test-coverage-direct.negative.mjs`
- **Verification:** `npm run test:coverage:direct:negative` exits 0 with the new state asserted.
- **Committed in:** `9558acf3`

---

**Total deviations:** 3 (1 Rule 3 blocking, 1 Rule 2, 1 measurement)
**Impact on scope:** None. No file under `extensions/` or `tests/` was touched; all five changed
files are under `scripts/`.

## Verification

| check | result |
|---|---|
| pin loads, validates and compares equal to itself over `productionPaths()` | `pin rows 2 self-consistent` |
| `shortfallReadingOf` answers the reading and refuses a `Focused test failed:` message | `shortfallReadingOf ok` |
| `verdictFor` keeps its exact behaviour while holding no regex | `reporter delegates` |
| `git check-ignore scripts/test-coverage-direct.pin.json` | exit 1 -- the pin is tracked |
| `./node_modules/.bin/prettier --check scripts/test-coverage-direct.pin.json` | exit 0 |
| `node scripts/test-coverage-direct.mjs --base origin/main` | `Changed-pair base: origin/main` |
| `node scripts/test-coverage-direct.mjs --base refs/heads/definitely-not-a-real-ref` | exit 1, stderr names the ref and states no fallback |
| `node scripts/test-coverage-direct.mjs --base "a ref with spaces"` | exit 1, names the value, no git invocation on it |
| `node scripts/test-coverage-direct.mjs --base HEAD` | zero changed pairs reported, both pinned pairs measured, exit 0 |
| `npm run test:coverage:direct:negative` | exit 0, closing sentence names every new control |
| `npm run test:coverage:direct:all` | **exit 0** -- 230 pairs, 489.4s, 2 refused rows matching the pin |
| `npm run typecheck && npm run lint && npm run fallow && npm run format:check` | exit 0, no new clone, no new threshold override |
| `npm run test:corresponding && npm run test:corresponding:negative` | exit 0 |
| `npm test` | 6,003 cases, `fail 0` |

`SKIP=trufflehog pre-commit run --files` passed clean before each commit, including `npm fallow`.

## Issues Encountered

- **An unconsumed export cannot be committed here.** The `fallow dead-code` gate makes a
  loader-and-comparator-first commit impossible, which is a real property of this repository's
  gates rather than a plan defect. Any future plan that creates a module in one task and its
  consumer in the next will hit the same wall.
- **A refused pair prints nothing in the changed arm.** `runPair` prints its own success line and a
  refusal is now recorded rather than propagated, so a developer running the hook sees the focused
  test output and then silence until the comparison either passes or names the drift. That is
  deliberate -- the arms file no verdict per row -- but 08-09 should decide whether the hook wants a
  per-row line the way the reporter has one.

## Next Phase Readiness

- **08-08's second sweep has a green baseline to reproduce.** The sweep run here through the new
  all-pair arm already exits 0 against this pin. If 08-08's own work moves any reading, the arm will
  say so by name, in both directions, which is the point.
- **08-09 wires it.** The hook passes a commit-scoped `--base`; CI keeps the default branch-scoped
  chain. Both forms are implemented and planted here, so 08-09 is configuration rather than gate
  work. `CONTRIBUTING.md`'s seven-row table is now wrong in two ways -- the count and four of the
  modules -- and 08-09 owns rewriting it.
- **`RCOV-02` is still Pending** and belongs to 08-09, the last plan carrying it.
- **One open judgment for a reviewer:** deliverable D5. The comparator is proved; the *reasons* are
  claims about why two arms cannot be reached. If either reason is wrong, the pin is an allow-list
  with good manners, and no gate in this repository can tell.

---
*Phase: 08-direct-coverage*
*Completed: 2026-09-11*

## Self-Check: PASSED

Both created files and the SUMMARY exist on disk; both task commits resolve in `git log`.
