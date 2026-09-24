---
phase: 101-workflow-component-kind-recognition
plan: 02
subsystem: domain
tags: [resolver, tests, component-kinds, workflows, containment, dedup]

# Dependency graph
requires:
  - phase: 101-01
    provides: "`workflows` in both supported-kind tuples and the required `componentPaths.workflows` member these cases read"
provides:
  - "the strict-mode `workflows` admission matrix: both manifest forms, union order, first-wins dedup, no-note absent path, containment parity, empty convention directory"
  - "the loose-mode `workflows` matrix: entry-only, manifest-only conflicts, convention directory grants nothing"
  - "a parity pin on the empty declared string, which documents inherited behavior the plan's truth described incorrectly"
affects: [101-03, 101-04, workflow-materialization]

actuals:
  tokens: 3400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "parity assertion instead of value assertion: where a behavior is inherited from shared machinery, assert that `workflows` and `skills` produce the identical result rather than restating the value, so a kind-specific shortcut fails loudly"
    - "differential fixture: assert emptiness is not absence by resolving an empty and a populated convention directory in the same test and comparing the two resolutions"

key-files:
  created: []
  modified:
    - tests/domain/resolver-strict.test.ts
    - tests/domain/resolver-loose.test.ts

key-decisions:
  - "the empty declared string is ADMITTED, not rejected -- the plan's truth was wrong about the code; asserted as parity with `skills` rather than changing production"
  - "the encoding case derives NFD from NFC via `String.prototype.normalize` and asserts the two differ, so the case cannot silently degenerate into comparing a string with itself"
  - "the empty-convention-directory case compares against a populated directory in the same resolution, which both differentiates it from the existing convention case and states the actual contract"

patterns-established:
  - "Inherited-behavior tests assert parity with an already-proven sibling kind; the note text is compared with the kind name masked out, so only kind-specific divergence can fail it"

requirements-completed: []

coverage:
  - id: D7
    description: "Both manifest declaration forms resolve: `workflows: \"wf\"` and `workflows: [\"a\", \"b\", \"a\"]` flow through readPathOrArray with first-wins dedup preserving declaration order"
    requirement: WFLW-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-02 manifest declares workflows as a string -> that single path is collected"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-02 manifest declares workflows as an array -> declaration order kept, repeats collapsed"
        status: pass
    human_judgment: false
  - id: D8
    description: "The declared and convention axes UNION declared-first, and an exactly-equal declared path merges to a single element"
    requirement: WFLW-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-02 declared workflows path UNIONs with the convention directory, declared first"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-02 a declared path equal to the convention path merges instead of duplicating"
        status: pass
    human_judgment: false
  - id: D9
    description: "Dedup compares raw JavaScript strings through the collector's Set<string>; no normalization step exists, so NFC and NFD forms stay distinct"
    requirement: WFLW-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-02 manifest declares workflows as an array -> declaration order kept, repeats collapsed (encoding assertion)"
        status: pass
    human_judgment: false
  - id: D10
    description: "A declared path absent from disk is accepted with an EMPTY notes array and the plugin stays installable -- validation is shape-only and never stats"
    requirement: WFLW-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-02 a declared workflows path that does not exist on disk is accepted with NO note"
        status: pass
    human_judgment: false
  - id: D11
    description: "A declared path escaping the plugin root resolves unavailable with a containment note, at parity with the same input under skills"
    requirement: WFLW-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-02 a declared workflows path escaping the plugin root -> unavailable, at parity with skills"
        status: pass
    human_judgment: false
  - id: D12
    description: "An EMPTY convention workflows directory is admitted; the resolver's view of an empty and a populated directory is identical"
    requirement: WFLW-03
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-03 an EMPTY convention workflows directory is admitted exactly like a populated one"
        status: pass
    human_judgment: false
  - id: D13
    description: "An empty declared array admits nothing on the declared axis and leaves the convention axis untouched; an empty declared string is handled identically to the same input under skills"
    requirement: WFLW-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-02 an empty declared workflows array admits nothing on the declared axis"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WFLW-02 a declared EMPTY-STRING workflows path is handled exactly as the same input under skills"
        status: pass
    human_judgment: false
  - id: D14
    description: "Loose mode is entry-only for workflows: declared resolves, manifest-only produces the inherited conflict note and resolves unavailable, and a convention directory alone grants nothing"
    requirement: WFLW-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#WFLW-02 loose: entry.workflows declared -> installable with workflows"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#WFLW-02 loose: entry.workflows absent but manifest declares workflows -> conflict notInstallable"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#WFLW-02 loose: entry + manifest both absent + <pluginRoot>/workflows exists -> installable WITHOUT workflows (no implicit-by-convention in loose)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-14
status: complete
---

# Phase 101 Plan 02: Workflow component-kind recognition Summary

**Twelve cases across both resolution modes pin the `workflows` admission matrix the shared collector delivers for free — declared forms, union order, dedup comparator, silent absent path, containment parity, and the loose-mode negative**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-14T18:50:00Z
- **Completed:** 2026-08-14T19:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- The strict-mode file grew from 78 to 87 tests. Nine cases cover the declared axis that admitting the kind proves nothing about: both manifest forms, first-wins dedup, declared-equals-convention merge, declared-first union order, the accepted-without-note absent path, containment parity with `skills`, the empty convention directory, the empty declared array, and the empty declared string.
- The loose-mode file grew from 21 to 24 tests. The third case is the load-bearing negative: a `workflows/` directory on disk with nothing declared leaves `componentPaths.workflows` empty and the kind out of `supported`. Widening a shared tuple is exactly the change that could silently hand loose mode the strict-mode convention axis; nothing else in the phase would catch it.
- Two cases assert **parity** rather than a value. The containment case masks the kind name out of both notes and compares the arrays, so the only way it can fail is a workflows-specific shortcut around `validateComponentPath`. The empty-string case compares the two kinds' whole resolutions. This is the right shape for behavior that is inherited rather than written.
- The empty-convention-directory case resolves an empty and a populated directory in the same test and asserts the two resolutions are identical. That states the actual contract — existence is the signal, emptiness is a downstream consequence — instead of restating the existing convention case with different words.
- `npm run check` is green: 3458 tests, 0 failures, 1 pre-existing platform-conditional skip (the non-Linux `reapOrphans` arm).

## Task Commits

1. **Task 1: Strict-mode admission matrix for `workflows`** — `42ded3e0` (test)
2. **Task 2: Loose-mode matrix — entry-only, through the same shared tuple** — `e94a2fdc` (test)

## Files Created/Modified

- `tests/domain/resolver-strict.test.ts` — nine cases appended after the existing convention-only block, under a `WFLW-02` banner that states why inherited behavior is worth pinning
- `tests/domain/resolver-loose.test.ts` — three cases appended before the `MM-7` section, mirroring the `MM-6` skills trio in shape so the two kinds' loose behavior reads identically

## Decisions Made

- **Parity, not value, for inherited behavior.** For containment and the empty string, asserting the literal note text or the literal array would pin a fact about the shared collector that other kinds' tests already pin. Asserting that `workflows` and `skills` produce the same thing pins the fact this phase actually introduces: that no kind-specific path was added.
- **The encoding case derives its fixtures.** `"café".normalize("NFC")` and `nfc.normalize("NFD")` plus an `assert.notEqual` guard, rather than two hand-typed literals. Two visually identical string literals are the kind of thing a later reader "fixes"; deriving them makes the intent unmistakable and makes silent degeneration impossible.
- **The empty-convention case is differential.** Comparing an empty directory's resolution against a populated one's, in one test, both differentiates it from the pre-existing `WFLW-01` case and expresses the contract more precisely than repeating that case's assertions.
- **No production file was touched.** The plan scoped this to two test files, and every case passed against the tree as `101-01` left it.

## Deviations from Plan

### Findings

**1. [Rule 4 - Surfaced, not fixed] The plan's empty-string truth does not match the code**

- **Found during:** Task 1
- **Issue:** The plan's `must_haves.truths` states that "a declared empty string is rejected by the same shape validation that rejects any other unusable path." It is not rejected. `validateComponentPath` finds `""` non-array, string, and not absolute; `path.resolve(pluginRoot, "")` returns `pluginRoot` itself, and `isPathInside` returns true for a zero-length relative path. The element is admitted, so `componentPaths.workflows` becomes `[""]` and the kind enters `supported`.
- **Why this is not a Wave 1 gap:** `skills: ""` behaves identically, and has since long before this phase. There is no workflows-specific defect, and no production edit is in scope for a test-only plan. Changing shared shape validation to reject the empty string would alter behavior for four kinds at once and belongs in its own change with its own decision.
- **Fix:** Asserted the real behavior as a **parity** contract — `workflows: ""` and `skills: ""` must produce the same state, the same paths array and the same notes — with a comment recording that the empty string is shape-valid because it resolves to the plugin root. The probe row is covered; the claim is corrected rather than papered over.
- **Files modified:** `tests/domain/resolver-strict.test.ts`
- **Verification:** the case passes; the pre-existing behavior it pins was confirmed by resolving both kinds against identical fixtures.
- **Committed in:** `42ded3e0`

**Downstream note for the materialization phase.** An admitted `""` element means a declared component path can name the plugin root itself. Recognition does not care, but a bridge that enumerates `componentPaths.workflows` will walk `<pluginRoot>` when it sees one. That is a pre-existing property of all four path-bearing kinds, not something this phase introduced, and it is recorded here so the phase that first walks these paths does not rediscover it as a surprise.

**2. [Bookkeeping] REQUIREMENTS.md rows left `Pending`**

- **Found during:** State updates
- **Issue:** Same judgment `101-01` made and for the same reason: the traceability rows are scoped to the phase, and `101-03` and `101-04` still owe proofs against the same four IDs.
- **Fix:** Left the rows unchanged.
- **Files modified:** none
- **Committed in:** n/a

---

**Total deviations:** 1 finding surfaced (plan truth corrected against real behavior), 1 bookkeeping judgment call
**Impact on plan:** No production code touched. Every case named in the two task actions was written and passes; one `must_haves` truth was asserted in corrected form.

## Issues Encountered

- **None blocking.** All seven strict cases and all three loose cases behaved exactly as the plan predicted on first run. The only surprise was the empty-string treatment, documented above.
- `trufflehog` fails structurally in this worktree, as CLAUDE.md documents. Both commits were preceded by a clean filesystem-mode scan (`verified_secrets: 0`, `unverified_secrets: 0`) and used `SKIP=trufflehog`, that hook only.

## User Setup Required

None — no external service configuration and no package install.

## Next Phase Readiness

- **Ready.** `npm run check` green.
- `101-03` can add the catalog block and its paired `FIXTURES` entry; `101-04` can pin `compatibility.supported` recording `"workflows"`. Neither depends on anything this plan changed, since it changed no production behavior.
- **Handed forward:** the empty-string admission described above, for whichever phase first walks `componentPaths.workflows` on disk.

## Self-Check: PASSED

Both modified files verified present on disk; both commit hashes verified in `git log`.

---
*Phase: 101-workflow-component-kind-recognition*
*Completed: 2026-08-14*
