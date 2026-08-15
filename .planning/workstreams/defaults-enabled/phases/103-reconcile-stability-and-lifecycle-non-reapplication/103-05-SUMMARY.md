---
phase: 103-reconcile-stability-and-lifecycle-non-reapplication
plan: 05
subsystem: testing
tags: [dfen-05, dfen-08, install, reconcile, roadmap, nfr-6, typescript]

requires:
  - phase: 103
    plan: 01
    provides: "the reconcile fixed-point fixtures and the planner-output assertion style this plan's convergence half reuses"
  - phase: 103
    plan: 06
    provides: "the `DFEN_PRECEDENCE_CASES` shape this plan extends — `expectSiblingKeyAbsent` and `alsoSeedSiblingEntry` already landed, and one row's expectation had already moved"
provides:
  - "the DFEN-08 argument that forces the install verdict's asymmetry, written into the test that pins it"
  - "the convergence half the pin rests on: one reconcile pass drives the record disabled without touching the user's declaration"
  - "a `ROADMAP.md` criterion-3 gloss that states DFEN-05's preservation rule instead of an install-time outcome the verb does not produce"
  - "the phase-boundary `npm run check`, green over all six plans together (NFR-6)"
affects: [104, 105, dfen-08-parity-sweep]

actuals:
  tokens: 3100
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "An opt-in per-case flag on a shared table-driven loop, so one row can assert a follow-on pass without the other rows asserting a no-op"
    - "Fixture preconditions for a convergence assertion stated as planner-output assertions (`sourceMismatches` empty, the expected `pluginsToDisable` row present) rather than as prose, so a pass that plans nothing cannot masquerade as convergence"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/install.test.ts
    - .planning/workstreams/defaults-enabled/ROADMAP.md
    - .planning/workstreams/defaults-enabled/phases/103-reconcile-stability-and-lifecycle-non-reapplication/103-VALIDATION.md

key-decisions:
  - "The convergence arm asserts the PLAN before applying it. The plan's fixture preconditions (the marketplace must be declared; the merged read must not abort under CFG-03) are exactly the conditions under which a reconcile pass silently does nothing, and a silent no-op would 'prove' convergence by never planning anything."
  - "The marketplace-declared precondition held as the plan reasoned it would — the install's CR-02 adoption arm declares it — confirmed by the planner assertion rather than assumed, so no explicit marketplace seed was added."
  - "The reworded roadmap clause states the preservation rule and names reconcile as the surface that honors it. It deliberately makes no claim about what the install verb does, because that is where the old wording was wrong."

patterns-established:
  - "A comment addressed to the reader who would make an asymmetry symmetric: it names the specific edit, the requirement that forbids it, and why the obvious rescue (gating on the manifest declaring the field) fails too"

requirements-completed: [DFEN-06, DFEN-07]

coverage:
  - id: D1
    description: "The D-103-01 decision is pinned WITH its argument: installing over an entry that already says `enabled: false` materializes the plugin and leaves the entry byte-identical, and the comment states why no form of the widening survives DFEN-08"
    requirement: DFEN-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#DFEN-05: an explicit `enabled: false` is not rewritten by a defaultEnabled-true manifest (DFEN-08), and the next pass converges the record"
        status: pass
    human_judgment: false
  - id: D2
    description: "The convergence half: one reconcile pass after that install drives the record to disabled and removes the artifacts, with the user's entry still byte-identical"
    requirement: DFEN-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#DFEN-05: an explicit `enabled: false` is not rewritten by a defaultEnabled-true manifest (DFEN-08), and the next pass converges the record"
        status: pass
    human_judgment: false
  - id: D3
    description: "The roadmap's criterion-3 gloss matches DFEN-05's normative claim, and the verification override recording why it moved is intact"
    verification:
      - kind: other
        ref: "grep -L 'stays disabled' .planning/workstreams/defaults-enabled/ROADMAP.md (exit 0); git diff --name-only shows 102-VERIFICATION.md unmodified"
        status: pass
    human_judgment: true
    rationale: "The grep proves the clause is gone, not that its replacement says the right thing. Whether the new wording matches DFEN-05 rather than paraphrasing it loosely is a reading judgment."
  - id: D4
    description: "The phase boundary: `npm run check` ran to completion and exited 0 with all six plans landed — the phase's only cross-plan integration check"
    requirement: DFEN-07
    verification:
      - kind: integration
        ref: "npm run check (exit 0: typecheck, lint, format:check, 3515 unit tests / 3514 pass / 0 fail / 1 platform skip, 18 integration tests / 0 fail)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-15
status: complete
---

# Phase 103 Plan 05: The DFEN-08 pin, the roadmap reword, and the phase boundary Summary

**The precedence row that pins `install` over an existing `enabled: false` now carries the DFEN-08 argument that forces its asymmetry and proves the divergence it leaves closes on the next reconcile pass; the roadmap criterion that misdescribed that behavior states the preservation rule instead; and `npm run check` is green over all six plans together.**

## What changed

Two bookkeeping items and one gate.

**The pin gained its argument.** The row asserting that an explicit
`enabled: false` survives a manifest declaring `defaultEnabled: true` recorded
the product half ("running `install` IS the user asking for the install") and
nothing else. The requirement half — the load-bearing one, and written down
nowhere in the source tree — is now in the comment: the symmetric edit is to
widen the landed-disabled verdict so it also fires on an explicit `false`;
DFEN-08 forbids it, because a plugin declaring the field true and a plugin whose
manifest never mentions it must behave byte-identically to the pre-`defaultEnabled`
releases across install, update, reinstall, list, info and reconcile. Widening
changes `install` for the silent manifests. Gating the widening on the manifest
declaring the field changes the declared-true case instead — which is exactly
this row. No form survives, so the verdict keeps firing only on the ABSENT value.

**The pin gained its ending.** A new opt-in `expectReconcileConverges` case flag
runs one `applyReconcile` pass after the install on that row alone. The record
moves to `enabled: false`, the staged skill leaves disk, and the seeded entry
still deep-equals `{ enabled: false }` — convergence acts on the RECORD, and a
pass that "fixed" the config instead would be the overwrite DFEN-05 forbids.
Without this half the row pinned a divergence and said nothing about its end.

**The roadmap says what ships.** Phase 102's success criterion 3 carried an
illustrative clause claiming a user who wrote `enabled: false` against a
manifest declaring the field true "stays disabled". The entry IS preserved,
which is what DFEN-05 requires, but the verb materializes and records the plugin
enabled and the next reconcile pass converges it. The clause now states the
preservation rule and names reconcile as the surface that honors it. The
`102-VERIFICATION.md` override stays as the audit trail for why it moved.

## Phase-level record

### The phase boundary gate (NFR-6)

Pre-flight, then the gate, both with their results captured rather than assumed:

| Pre-flight | Result |
|---|---|
| `test -d node_modules` | present — the phase ran sequentially and non-isolated for exactly this reason |
| `check` is a defined script | `typecheck && lint && format:check && test && test:integration` |

`npm run check` **RAN TO COMPLETION and exited 0.** Unit suite 3515 tests /
3514 pass / 0 fail / 1 skip; integration suite 18 tests / 0 fail. The single skip
is the pre-existing platform-conditional arm
(`D-62-05: reapOrphans on non-Linux platform soft-skips SIGKILL`, skipped because
this host IS Linux) and is unrelated to this phase.

The gate is the phase's only cross-plan integration check, and it had real
coupling to catch: plan `103-02`'s architecture gate READS the source of
`orchestrators/plugin/reinstall.ts`, which plan `103-03` EDITS. Each plan's own
suite run was green while the pair was unverified until this run.

### Where plans departed from `103-CONTEXT.md`, or found what it did not anticipate

- **The `--local` flag reading, shared by `103-04` and `103-06`.** D-103-13's
  sentence describes an `enable` WITHOUT the flag and does not say what a typed
  flag does. The rule implemented is: flag typed → local file; no flag → follow
  the declaration; neither → base file. Dropping the flag entirely would void the
  WB-01 / UAT-05 contract that `--local` targets the local file unconditionally,
  including fresh-creating it on ENOENT. `103-04`'s SUMMARY flags the stricter
  reading (the declaration decides even when the flag is typed) as available for
  one condition plus two test rewrites, and says it should be taken as an
  explicit decision rather than drifted into.

- **D-103-12, D-103-13 and D-103-16 are ONE defect at three call sites.** The
  three verbs that author an enablement declaration on the user's behalf —
  `enable`/`disable`, and the standalone `install` write-back, alongside
  `reinstall`'s missing disabled short-circuit — each aimed their write with the
  caller's flag rather than with the declaration's location. After this phase the
  two write-target sites share one helper,
  `selectDeclaringConfigWriteTarget` (`orchestrators/plugin/shared.ts`), so a
  fourth authoring verb inherits the rule instead of re-opening the question.

- **BACKLOG CANDIDATE — the fourth flag-aimed write site, deliberately out of
  scope.** `maybeWritePluginConfigBack`
  (`extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:871-900`; the
  plan cited `:815-822`, which drifted when `103-04` inserted the helper above
  it) still derives its target as
  `opts.local ? configLocalJsonPath : configJsonPath` and writes a bare `{}`
  entry when the key is absent from that file, on the `update` and `reinstall`
  post-success paths. Under a local-only declaration a flagless `update`
  therefore adds `{"<plugin>@<marketplace>": {}}` to the BASE file, where CFG-02
  shadows it. **It breaks no success criterion:** the patch carries no field, so
  the merged view never moves, `isDeclaredEnabled` is unmoved, and no enable is
  ever planned. It is cosmetic config pollution, not a re-enable loop. Named here
  so the sweep is not read as exhaustive — the RULE is settled; its COVERAGE is
  three sites, not all of them.

- **`103-06` moved one pre-existing expectation, and that is an intended
  behavior change, not a relaxed assertion.** The `install-dfen05-local-true-wins-`
  row previously expected the BASE file to hold a fieldless entry
  (`expectSiblingEntryAfter: {}`); it now expects the base file to hold no entry
  and to not be created at all (`expectSiblingKeyAbsent: true`), because the
  write-back addresses the file the declaration lives in. The outcome for the
  record, the artifacts and the local entry is unchanged. The old assertion could
  not simply be relaxed: the loop asserted `status === "valid"` on the sibling,
  which now fails against a file correctly never created.

- **`103-03`'s divergence from `update`'s disabled arm.** D-103-12 said to mirror
  `update`'s branch. The guard is mirrored; the BODY is deliberately empty.
  `update` returns `runDisabledRecordRefresh`, but `reinstall` preserves the
  recorded version (D-68-02) and carries the recorded git identity forward
  (PURL-07), so no pin can move and no `tx.save()` is warranted — the arm returns
  before `loadCachedEntry` / `resolveInstallable` and refreshes nothing, leaving
  `state.json` byte- and mtime-untouched (RECON-05). It also leaves a catalog
  candidate for the documentation phase: the exact bytes of the reinstall skipped
  row for a disabled plugin, already pinned by a byte-equality test.

- **`103-02` ran its mutation check against `update.ts` rather than
  `reinstall.ts`,** because `103-03` was editing `reinstall.ts` concurrently in
  the same wave. The gate treats both targets identically.

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-15T13:00Z
- **Completed:** 2026-08-15T13:30Z
- **Tasks:** 2
- **Files modified:** 2 (plus `103-VALIDATION.md`)

## Task Commits

1. **Task 1: the DFEN-08 rationale and the convergence half** — `799ebb10` (test)
2. **Task 2: the roadmap reword and the phase boundary** — `e5b89bd3` (docs)

## Files Created/Modified

- `tests/orchestrators/plugin/install.test.ts` — the amended precedence row
  (comment, title, `expectReconcileConverges: true`), the new optional
  `DfenPrecedenceCase` field with its doc comment, and the opt-in loop arm: two
  planner precondition assertions, one `applyReconcile` pass, and the record /
  artifact / whole-entry assertions after it.
- `.planning/workstreams/defaults-enabled/ROADMAP.md` — Phase 102 success
  criterion 3's second illustrative clause. Nothing else in that block, and no
  other phase block, moved.
- `.planning/workstreams/defaults-enabled/phases/103-.../103-VALIDATION.md` — the
  three `103-05-*` rows moved from ⬜ pending to ✅ green.

## Decisions Made

- **The convergence arm asserts the PLAN before applying it.** The plan named two
  fixture preconditions to check by hand: the config must declare the
  marketplace, or the planner classifies the entry as a dangling reference and
  pushes no disable; and the pass must not trip `applyReconcile`'s CFG-03 abort.
  Both are conditions under which the pass silently does nothing — and a silent
  no-op would leave the convergence assertions passing for the wrong reason only
  if the record were already disabled, but would certainly stop being a proof of
  anything. Asserting `planned.sourceMismatches` empty and
  `planned.pluginsToDisable` deep-equal to the expected single row states both
  preconditions as executable facts that live with the test.
- **The marketplace declaration held; nothing extra was seeded.** The plan's
  flagged assumption — that the install's CR-02 adoption arm synthesizes the
  marketplace declaration from the recorded path source — is TRUE for this
  fixture, confirmed by the `sourceMismatches` assertion passing on the
  post-install config. No explicit marketplace seed was added.
- **The reworded clause makes no claim about the install verb.** It states that
  the value the user wrote is kept, unrewritten by the manifest, and honored by
  reconcile, where desired enablement is read. Describing an install-time outcome
  is what the old wording did wrong.

## Deviations from Plan

### 1. [Rule 3 — Blocking] The planner's bucket names differ from the plan's prose

- **Found during:** Task 1
- **Issue:** The plan describes the planner's "disable bucket" and "dangling"
  classification, and the first draft asserted `planned.disable` /
  `planned.dangling`. `ReconcilePlan`'s fields are `pluginsToDisable` and
  `sourceMismatches` — dangling references are a `cause: "dangling-reference"`
  variant of the source-mismatch bucket, not a bucket of their own. The first
  run failed on `undefined !== []`.
- **Fix:** Assert `planned.sourceMismatches` empty (which covers the dangling
  arm) and `planned.pluginsToDisable` deep-equal to
  `[{ scope: "project", plugin: "hello", marketplace: "mp" }]`.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Verification:** 122/122 green in `install.test.ts` after the correction.
- **Committed in:** `799ebb10`

---

**Total deviations:** 1 (1 blocking)
**Impact on plan:** None on scope or behavior — a name correction against the
real planner type.

## Issues Encountered

- **TruffleHog failed structurally on both commits**, as it always does in a
  linked worktree (`failed to read index file: .../.git/index: not a directory`).
  Confirmed clean by the sanctioned filesystem route instead —
  `trufflehog filesystem <changed paths> --results=verified,unknown --fail` →
  exit 0, `verified_secrets: 0`, `unverified_secrets: 0` — before each commit,
  which was then made with `SKIP=trufflehog` and nothing else skipped.
- **Prettier reformatted the new dynamic imports** in the loop arm; re-run and
  restaged before the commit, and `npm run format:check` is clean.

## Verification

| Gate | Result |
|---|---|
| `test -d node_modules` (pre-flight) | exit 0 — the gate below could actually be attempted |
| `npm run check` | **exit 0**, ran to completion (NFR-6 phase boundary, all six plans) |
| `node --test tests/orchestrators/plugin/install.test.ts` | 122 pass, 0 fail |
| `node --test "tests/orchestrators/plugin/**/*.test.ts"` | 782 pass, 0 fail |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | clean |
| `grep -L 'stays disabled' .../ROADMAP.md` | prints the filename, exit 0 |
| `git diff --name-only -- extensions/` | empty for both tasks |
| `102-VERIFICATION.md` | unmodified — absent from `git diff --name-only` |
| planning-artifact references in the new comment | none (`Phase N` / `Plan N` / `Wave N` / `Pitfall N`) |

## Known Stubs

None.

## Next Phase Readiness

- All four success criteria of this phase are pinned by tests, and the boundary
  gate is green over every plan together.
- **For Phase 105 (the DFEN-08 parity sweep):** the argument that forces the
  install verdict's asymmetry now lives in `install.test.ts` rather than only in
  a planning document, so the sweep can cite the test rather than re-deriving it.
- **For the backlog:** `maybeWritePluginConfigBack`'s flag-aimed target, recorded
  above with its blast radius and the reason it is benign.
- **For the documentation phase:** `103-03`'s reinstall skipped row remains a
  catalog candidate; `docs/output-catalog.md` gained nothing this phase by
  decision.

## Self-Check: PASSED

- `tests/orchestrators/plugin/install.test.ts` — FOUND
- `.planning/workstreams/defaults-enabled/ROADMAP.md` — FOUND
- `.planning/workstreams/defaults-enabled/phases/103-.../103-VALIDATION.md` — FOUND
- Commit `799ebb10` — FOUND in `git log`
- Commit `e5b89bd3` — FOUND in `git log`

---
*Phase: 103-reconcile-stability-and-lifecycle-non-reapplication*
*Completed: 2026-08-15*
