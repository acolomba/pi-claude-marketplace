---
phase: 116-load-time-workflow-convergence
plan: 03
subsystem: api
tags: [output-catalog, byte-gate, notify, closed-set, negative-control, node-test]

requires:
  - phase: 116-load-time-workflow-convergence
    provides: "the `components now supported` token, its place at the head of both `backfilledRowFromOutcome` arms, and the two re-byted backfill catalog states (plan 01)"
provides:
  - the first published catalog state for the fully promoted (`installed`) arm of a load-time backfill, byte-paired against the renderer
  - a second published state pinning the composed brace order for a backfilled row — caller-placed convergence marker first, renderer-appended soft-dep marker last
  - the corpus-count lock moved 195 -> 197 in all three of its parts, once
  - "membership and rendering are two separate gates" proved by a RUN control, not asserted
affects: [116-04, 117, 114 re-verification]

actuals:
  tokens: 2595       # chars/4 over the realized diff, a85cb7db..HEAD
  tasks: 2
  commits: 2         # MEASURED: git rev-list --count a85cb7db..HEAD
plan_head_before: a85cb7dbafd614b76fd909960f5ce72c4f8d0a74

tech-stack:
  added: []
  patterns:
    - "Prove a byte pairing in THREE directions (annotation removed, fixture removed, one byte changed), not two"
    - "Run the byte-change control by swapping in a DIFFERENT legal closed-set member, so the membership locks and the byte gate are observed disagreeing in the same run"
    - "Derive a published fenced block by running the gate; a green first run is the derivation, a red one prints the actual bytes"

key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts

key-decisions:
  - "State names `backfill-installed` and `backfill-installed-workflow-engine-absent`, mirroring the `backfill-partially-installed*` shape already in that section"
  - "The byte-change control swaps `components now supported` for `up-to-date` — another legal member of the closed set — rather than mangling a character, because that is the exact failure criterion 4 names: a token can be a legal member and never reach a rendered row"
  - "`shared/notify.ts` was NOT edited: its count sentence was already correct on arrival, so there was nothing to change"
  - "The fourth ungated count site, found by the repository-wide search rather than by the research's three-site table, was corrected in the same commit as the other count work"

patterns-established:
  - "A count claim survives in prose the gates do not read; the repository-wide search for the retired value is the only thing that finds the site nobody listed"

requirements-completed: [WCONV-03]

coverage:
  - id: D1
    description: "The fully promoted arm of a load-time backfill has a published catalog state whose bytes equal what `notify()` renders: a bare marketplace header, an `(installed)` row whose brace holds the convergence marker alone, and a one-success tally at severity info"
    requirement: WCONV-03
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (state `backfill-installed`)"
        status: pass
      - kind: unit
        ref: "negative control 3 — the token's rendered bytes changed to another legal closed-set member: catalog gate RED, membership locks GREEN (transcript below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same row in a session with no host workflow engine renders both tokens in ONE brace, the convergence marker first and `requires pi-dynamic-workflows` last, at severity info"
    requirement: WCONV-03
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts (state `backfill-installed-workflow-engine-absent`)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The corpus-count lock reads 197 in its literal, its explanatory comment and its failure message, and it fires before any byte comparison"
    requirement: WCONV-03
    verification:
      - kind: unit
        ref: "negative control 1 — annotation removed: the count assertion fails first with `196 !== 197`, and the inverse walk reports the orphan (transcript below)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every live sentence in the tree stating how large the closed reason set is agrees with the tuple"
    requirement: WCONV-03
    verification:
      - kind: unit
        ref: "repository-wide search for `45-entry` / `45-member` / `45 members` over docs/, extensions/, tests/ — zero live hits remain (recorded below)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-09
status: complete
---

# Phase 116 Plan 03: Load-time workflow convergence Summary

**The arm this phase exists to make visible now has published bytes, and changing those bytes is a red run while the membership locks stay green — which is the whole point of pairing them separately.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-09T15:46:00Z
- **Completed:** 2026-09-09T16:11:00Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- Published two new catalog states under the `reconcile-applied-cascade` H2, each with an H3, one prose paragraph, an annotation comment and a fenced block, plus a matching `FIXTURES` entry. Before this, the `installed` arm of a load-time backfill had no published state at all — the arm the convergence marker was added for was the one arm the byte gate never drove.
- The second state pins the composed brace order for a backfilled row: `{components now supported, requires pi-dynamic-workflows}`. The convergence marker is caller-placed by `backfilledRowFromOutcome`; the soft-dep marker is appended by `composeReasons` after every caller reason. Nothing else in the tree pins that composition for this row, and it is the render the real (path-source, workflow-declaring) population is most likely to see first.
- Moved the corpus-count lock 195 -> 197 in one edit carrying all three of its parts (D-116-06).
- Corrected the one live prose site still naming the retired size of `REASONS`, and restated the typed-view module's drift claim so it says what is actually gated.

## Task Commits

1. **Task 1: Publish the fully promoted arm, twice, and move the corpus lock once** — `d9fa70d8` (test)
2. **Task 2: Correct the counts no gate reads, and record the inspection** — `ad17e6ad` (docs)

**Plan metadata:** this SUMMARY (docs)

## Files Created/Modified

- `docs/output-catalog.md` — two new H3 + prose + annotation + fenced-block states (`backfill-installed`, `backfill-installed-workflow-engine-absent`); the reasons-rendering section's tuple-size sentence
- `tests/architecture/catalog-uat.test.ts` — two new `FIXTURES` entries under `reconcile-applied-cascade`; the corpus-count literal, comment and failure message
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — the drift-claim sentence restated (comment only)

The two pre-existing backfill states and their fixtures are **byte-unchanged by this plan**. `git show d9fa70d8 -- docs/output-catalog.md` is a pure insertion; no line inside `backfill-partially-installed` or `backfill-partially-installed-no-reasons` appears in the diff.

## The two new states

```text
● local-mp [user]
  ● hello v1.0.0 (installed) {components now supported}

Reconcile: 1 success
```

```text
● local-mp [user]
  ● hello v1.0.0 (installed) {components now supported, requires pi-dynamic-workflows}

Reconcile: 1 success
```

Both at severity `info` (no `expectedSeverity` on either fixture). The second is driven by `piWithoutWorkflowEngine()` with `dependencies: ["workflows"]` — the value read off the existing `success-with-workflow-engine-absent` fixture rather than guessed. That standalone install row stamps `warning` for the same marker; this projection stays `info` because it applies the SEV-01 companion raise on neither arm, the same stance the sibling load-time enable row takes.

The fenced bytes were derived by running the gate. Both states matched on the first run, so the derivation produced no failure transcript to paste — control 3 below is what proves the comparison is live rather than vacuous.

## Negative controls — all three RUN, transcripts verbatim

### Control 1 — annotation removed: the corpus count and the inverse walk must go RED

Deleted the `<!-- catalog-state: backfill-installed -->` line and its trailing blank line from `docs/output-catalog.md`. Nothing else.

```
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (42.963294ms)
✔ XSURF-03: update-decline partially-upgradable reason brace === list partially-upgradable brace (same kinds) (17.715977ms)
✔ UGRM-02 scope discipline: a non-update bulk cascade keeps `N successes` (no tally override) (4.568667ms)
✖ catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture) (60.829322ms)
✔ loadCatalogExamples: returns no examples when the catalog has no annotations (8.833796ms)
✔ loadCatalogExamples: pairs each discriminator with its next fenced block (0.857359ms)
ℹ tests 6
ℹ suites 0
ℹ pass 4
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4432.835077

✖ failing tests:

test at tests/architecture/catalog-uat.test.ts:5663:1
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (42.963294ms)
  AssertionError [ERR_ASSERTION]: Expected exactly 197 annotated catalog examples; found 196. Check that the discriminator comments in docs/output-catalog.md were not lost, and update this count when examples are added.

  196 !== 197

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/catalog-uat.test.ts:5671:10)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 196,
    expected: 197,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/architecture/catalog-uat.test.ts:5809:1
✖ catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture) (60.829322ms)
  AssertionError [ERR_ASSERTION]: catalog UAT inverse-walk failures (1) -- FIXTURES entries with no catalog annotation:
  [ORPHAN FIXTURE] section=reconcile-applied-cascade state=backfill-installed
      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/catalog-uat.test.ts:5841:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: undefined,
    operator: 'fail',
    diff: 'simple'
  }
```

Annotation restored. Note the count assertion fires **before** any byte comparison, exactly as the plan warned: a forgotten count reports the corpus size, never the new state.

### Control 2 — fixture removed: the forward walk must report a missing fixture

Deleted the `backfill-installed-workflow-engine-absent` `FIXTURES` entry and its comment block from `tests/architecture/catalog-uat.test.ts`, leaving its catalog annotation and fenced block in place.

```
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (38.203077ms)
✔ XSURF-03: update-decline partially-upgradable reason brace === list partially-upgradable brace (same kinds) (2.454209ms)
✔ UGRM-02 scope discipline: a non-update bulk cascade keeps `N successes` (no tally override) (0.760602ms)
✔ catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture) (9.218981ms)
✔ loadCatalogExamples: returns no examples when the catalog has no annotations (0.750279ms)
✔ loadCatalogExamples: pairs each discriminator with its next fenced block (0.522863ms)
ℹ tests 6
ℹ suites 0
ℹ pass 5
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2967.860879

✖ failing tests:

test at tests/architecture/catalog-uat.test.ts:5631:1
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (38.203077ms)
  AssertionError [ERR_ASSERTION]: catalog UAT failures (1):
  [MISSING FIXTURE] section=reconcile-applied-cascade state=backfill-installed-workflow-engine-absent
      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/catalog-uat.test.ts:5653:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: undefined,
    operator: 'fail',
    diff: 'simple'
  }
```

Fixture restored. The inverse walk stays green here, which is the asymmetry that makes both walks necessary: an annotation with no fixture is a forward-walk failure only.

### Control 3 — the token's rendered bytes changed WITHOUT touching the closed set

**This is the phase's negative control 3, the one criterion 4 requires.** The change swaps `components now supported` for `up-to-date` inside the `backfill-installed` fenced block — `up-to-date` is a legal, unmodified member of `REASONS`, so the closed set is untouched and every membership gate should stay green while the byte gate must go red. That is the precise failure the clause names: *a token can be a legal member of the closed set and never reach a rendered row.*

```
===== catalog gate =====
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (36.992599ms)
✔ XSURF-03: update-decline partially-upgradable reason brace === list partially-upgradable brace (same kinds) (2.359315ms)
✔ UGRM-02 scope discipline: a non-update bulk cascade keeps `N successes` (no tally override) (0.703314ms)
✔ catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture) (8.867361ms)
✔ loadCatalogExamples: returns no examples when the catalog has no annotations (0.730282ms)
✔ loadCatalogExamples: pairs each discriminator with its next fenced block (0.505216ms)
ℹ tests 6
ℹ suites 0
ℹ pass 5
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2090.728985

✖ failing tests:

test at tests/architecture/catalog-uat.test.ts:5663:1
✖ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (36.992599ms)
  AssertionError [ERR_ASSERTION]: catalog UAT failures (1):
  [BYTE MISMATCH] section=reconcile-applied-cascade state=backfill-installed
  --- expected ---
  ● local-mp [user]
    ● hello v1.0.0 (installed) {up-to-date}

  Reconcile: 1 success
  --- actual ---
  ● local-mp [user]
    ● hello v1.0.0 (installed) {components now supported}

  Reconcile: 1 success
  ----------------
      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/architecture/catalog-uat.test.ts:5685:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: undefined,
    operator: 'fail',
    diff: 'simple'
  }
===== membership locks (must stay GREEN) =====
✔ OUT-08: REASONS is the closed 46-entry reason set (2.08303ms)
✔ SNM-02: STATUS_TOKENS is the closed 24-entry token set (0.30855ms)
✔ SNM-02: PLUGIN_STATUSES is the closed 19-entry plugin-status set (0.304748ms)
✔ SNM-02: MARKETPLACE_STATUSES is the closed 7-entry marketplace-status set (0.293411ms)
ℹ tests 18
ℹ suites 0
ℹ pass 18
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2413.019231
```

**Result: it went RED.** The pairing is not membership-only, so the clause's alternative — "the pairing MUST be strengthened rather than the control being written off" — does not apply and nothing was written off. The run shows both gates in the same transcript disagreeing: 18/18 membership assertions green against a byte gate that failed on the same token. Byte restored; 6/6 green.

## The ungated counts — per-site checklist, value found and value written

The research's Q3 table named THREE sites. Plan 116-01 had already corrected all three in commit `a42a7e04`, so the values found here were already current:

| # | Site | Value found | Value written | Action |
|---|---|---|---|---|
| 1 | `tests/architecture/notify-closed-set-locks.test.ts:29` — the test's own TITLE, `OUT-08: REASONS is the closed __-entry reason set` | **46** | **46** | none needed (already correct on arrival) |
| 2 | `extensions/pi-claude-marketplace/shared/notify.ts:82` — the tuple's catalog-stability doc, "its __-entry membership AND order" | **46** | **46** | none needed (already correct on arrival) |
| 3a | `extensions/pi-claude-marketplace/shared/notify-reasons.ts:7` — "OUT-08: the __-entry membership AND order" | **46** | **46** | none needed (already correct on arrival) |
| 3b | `extensions/pi-claude-marketplace/shared/notify-reasons.ts:14` — "instead of the flat __-entry set" | **46** | **46** | none needed (already correct on arrival) |
| **4** | **`docs/output-catalog.md:63`** — "The __-member `…::REASONS` tuple defines the closed set." | **45** | **46** | **CORRECTED** |

Site 4 is not in the research's table and not in this plan's `<read_first>`. It was found only by the repository-wide search the plan's own last paragraph requires. Phase 114 had actually gated it once, with `grep -c '45-member' docs/output-catalog.md` as a plan verify — a check that is correct exactly once and then becomes a check that the site is *stale*.

**Sites named: 3. Sites actually carrying a wrong count: 1, and it was a fourth one nobody listed.** This is the milestone's recurring defect in its exact shape once more: an enumeration shorter than the set it names. The number three was measured by the research against the tree as it stood; it was never wrong about the sites it listed, only incomplete.

### The drift claim, restated

`notify-reasons.ts` carried: "`COMPAT-01` pins the membership by enumeration and `notify-closed-set-locks.test.ts` pins the length, so the two sentences above cannot drift from the tuple again without a red test." The claim is true of the tuple and false of the prose, which is the reason site 4 was able to sit wrong for a full plan. It now reads:

> `COMPAT-01` pins the membership by enumeration and `notify-closed-set-locks.test.ts` pins the length, so the tuple itself cannot drift. Neither gate reads a comment: the counts in the two sentences above, in `notify.ts`'s own tuple doc and in that lock test's title are prose, so nothing turns red when they fall behind. The change that grows the set is what moves them, in the same edit.

## The repository-wide search for the retired count

```
grep -rn "45-entry\|45-member\|45 entries\|45 members" \
  --include=*.ts --include=*.md --include=*.js --include=*.json . \
  | grep -v node_modules | grep -v '^./.codegraph' | grep -v '^./coverage'
```

**21 hits. Breakdown:**

| Class | Count | Disposition |
|---|---|---|
| Live source / published docs stating the tuple's size | **1** (`docs/output-catalog.md:63`) | **corrected to 46** |
| `.planning/` historical ledger entries — prior phases' RESEARCH, CONTEXT, VALIDATION, PATTERNS, PLAN, SUMMARY and VERIFICATION files describing the set *at the time they were written* | **20** | **left exactly as written.** These are correct statements about past states (114's verification recording 45 members, 115's context noting the set "just reached 45", 116's own research and validation naming the `45-entry` title as the drift trap, 116-01's summary tabulating the three corrections it made). Rewriting them would falsify the record. |

Re-run after the correction over the live tree only:

```
$ grep -rn "45-member\|45-entry" docs/ extensions/ tests/
(no output)
```

Zero live sites remain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing correctness] A fourth ungated count site, in a file Task 2 does not declare**

- **Found during:** Task 2, by the repository-wide search the task's own action paragraph requires
- **Issue:** `docs/output-catalog.md:63` states the tuple's size in the reasons-rendering section. It is prose, outside every fenced block, so neither the byte gate nor any lock reads it. It was stale.
- **Fix:** corrected to 46 in the same commit as the other count work
- **Files modified:** `docs/output-catalog.md` (declared under Task 1, edited again in Task 2's commit)
- **Commit:** `ad17e6ad`
- **Why this way:** keeping every count correction in one commit matches the pattern 116-01 established ("the three silently-green prose counts are fixed by inspection in the same commit"), and splitting one sentence's fix into Task 1's commit would have put a count claim in a commit about catalog bytes.

### Scope reductions

**2. `extensions/pi-claude-marketplace/shared/notify.ts` was NOT modified**

The plan lists it under `files_modified` and Task 2 instructs "the tuple's own doc paragraph states the count … Correct it." It already read 46 on arrival — 116-01 corrected it. There was nothing to change, so nothing was changed. The inspection is recorded as site 2 above.

**3. `tests/architecture/notify-closed-set-locks.test.ts` was NOT modified**

Same reason: its title already read `46-entry`. Recorded as site 1 above. It was still RUN, as Task 2's verify requires, and stays green.

Both are the plan being one wave stale about work 116-01 had already absorbed, not a decision to skip anything. The plan's declared file set therefore over-states this plan's footprint by two files; the SUMMARY's `key-files.modified` records the three that actually changed.

## Issues Encountered

None. Every verify passed on first run except the three deliberately planted controls.

## Verification Run

| Check | Result |
|---|---|
| `node --test tests/architecture/catalog-uat.test.ts` | 6/6 pass |
| `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts` | 18/18 pass |
| `npm run typecheck` | exit 0, no output |
| `npm run lint` | exit 0, no output |
| `npm test` | **5650/5650 pass**, 313 suites, 0 fail |
| `pre-commit run --files <this plan's paths>` (both commits) | every hook Passed; no hook reported modifying a file. TruffleHog fails structurally in this linked worktree (`.git` is a file), covered by a filesystem scan instead |
| `trufflehog filesystem <paths> --results=verified,unknown --fail` (both commits) | `verified_secrets: 0, unverified_secrets: 0` |

`npm run check` was deliberately NOT run — 116-04 owns that gate.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

Wave 2 is complete: 116-02 and 116-03 both landed, sharing no file. 116-04 can run the full `npm run check` chain and close the phase.

One carried observation for 116-04 and for `/gsd-verify-work`: the `installed` arm now has published bytes but the `partially-installed` arm still has no state pinning its composed order against an absent host engine. That was not in scope here — D-116-06 fixed the state count at two — and the composition is the same `composeReasons` append either way, so the order is pinned once for backfilled rows. Noted, not deferred as a defect.

## Self-Check: PASSED

- `docs/output-catalog.md` — FOUND, contains both new annotations
- `tests/architecture/catalog-uat.test.ts` — FOUND, contains both new fixtures and the 197 lock
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — FOUND, drift claim restated
- commit `d9fa70d8` — FOUND in `git log`
- commit `ad17e6ad` — FOUND in `git log`
