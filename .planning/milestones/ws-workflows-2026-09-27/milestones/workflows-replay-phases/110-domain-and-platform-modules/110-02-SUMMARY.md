---
phase: 110-domain-and-platform-modules
plan: 02
subsystem: domain
tags: [port, workflows, name-generation, unicode, typed-errors, node-test, coverage]

# Dependency graph
requires:
  - phase: 110-domain-and-platform-modules
    provides: "110-01's proved mechanism — path-scoped checkout, blast-radius assertion, owner test as sole consumer, complete direct coverage, whole-tree gate at the commit boundary"
  - phase: 109-kind-inversion
    provides: "`workflows` as a supported component kind, so the generated name has a kind to belong to"
provides:
  - "`generatedWorkflowName(plugin, source)` in `domain/name.ts` — `<plugin>:<elided>` with RN-1 prefix elision"
  - "a module-private `assertSafeSavedWorkflowName` carrying all six clauses of the host engine's `isSafeSavedWorkflowName`, not the two the port shipped"
  - "`WorkflowNameCollision` and `WorkflowNameCollisionError` in `shared/errors.ts` — the WNAM-05 structured-offender contract"
  - "`describe(\"generatedWorkflowName\")` — 18 cases including the four engine-parity rows observed red before the production edit"
  - "`describe(\"WorkflowNameCollisionError\")` — the complete value, the exact message, and the defensive copy"
affects: [110-03, 111-workflows-bridge, 115-admission-gate-warnings]

actuals:
  tokens: 3374
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Red-first on a ported function: write the parity rows against the wrapper as ported, observe the exact failure count, and only then add the clauses"
    - "Invisible code points are written as `\\uXXXX` escapes in both the input and the expected message, never pasted"
    - "A defensive-copy constructor is pinned by `notStrictEqual` + `Object.isFrozen` + a post-construction push into the caller's array"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - tests/domain/name.test.ts
    - tests/shared/errors.test.ts

key-decisions:
  - "The ported wrapper's docblock claim that `assertSafeName` covers the engine's remaining clauses was replaced, not annotated — it was measured false and a comment that argues a false premise is worse than none."
  - "The two added screens replicate the engine exactly rather than exceeding it; only the lax direction self-corrects across engine upgrades."
  - "`CrossPluginConflictError`'s reference-identity assertion was inverted rather than copied, because `WorkflowNameCollisionError` freezes a copy where the analog assigns the argument array."
  - "The `WorkflowNameCollision` type import went into the file's existing separate `import type` block rather than the runtime braces, because `import-x/order` places the type group last."

patterns-established:
  - "Engine-parity gate: replicate a host validator clause-for-clause in a module-private wrapper, cite the engine version the clauses were read from, and state that matching exactly is the goal."
  - "A grep-shaped acceptance criterion is verified by intent when its literal pattern cannot match the house code shape; the corrected pattern and the reason are recorded rather than the criterion silently skipped."

requirements-completed: [WNAM-05, WNAM-06]

coverage:
  - id: D1
    description: "`generatedWorkflowName` produces `<plugin>:<elided>` with RN-1 prefix elision"
    requirement: "WNAM-06"
    verification:
      - kind: unit
        ref: "tests/domain/name.test.ts#generates \"acme:audit\" from \"acme-audit\" (plus 4 sibling happy-path rows)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every generated name passes the host engine's real `isSafeSavedWorkflowName`, including the whitespace/separator/NUL and control-and-format clauses `assertSafeName` does not cover"
    requirement: "WNAM-06"
    verification:
      - kind: unit
        ref: "tests/domain/name.test.ts#rejects plugin \"acme\" and source \"my name\" / \" lead\" / \"zw\\u200Bsp\" / \"bidi\\u202Ex\""
        status: pass
      - kind: other
        ref: "node --test tests/domain/name.test.ts before the production edit: 78 tests, 74 pass, 4 fail — exactly those four rows"
        status: pass
    human_judgment: false
  - id: D3
    description: "An empty source, and an elision that empties the head, both throw rather than producing the bare `acme:`"
    requirement: "WNAM-06"
    verification:
      - kind: unit
        ref: "tests/domain/name.test.ts#rejects plugin \"acme\" and source \"\" ; #rejects plugin \"acme\" and source \"acme-\""
        status: pass
    human_judgment: false
  - id: D4
    description: "The 128 cap is measured in UTF-16 code units by `String.prototype.length`, with both the accepting and the refusing boundary pinned"
    requirement: "WNAM-01"
    verification:
      - kind: unit
        ref: "tests/domain/name.test.ts#accepts a joined name of exactly 128 code units ; #rejects a joined name of 129 code units"
        status: pass
    human_judgment: false
  - id: D5
    description: "`WorkflowNameCollisionError` carries its offenders as structured `collisions` data with an exactly-transcribed message, in both the single- and multi-collision shapes"
    requirement: "WNAM-05"
    verification:
      - kind: unit
        ref: "tests/shared/errors.test.ts#exposes every collision and its claimants in caller order ; #names one collision on a single detail line"
        status: pass
    human_judgment: false
  - id: D6
    description: "The constructor's copy is defensive: frozen, not the caller's array, and unreachable by a later push into it"
    requirement: "WNAM-05"
    verification:
      - kind: unit
        ref: "tests/shared/errors.test.ts#freezes a defensive copy a later push into the caller's array cannot reach"
        status: pass
    human_judgment: false
  - id: D7
    description: "The path-scoped checkouts reached neither Phase 109's five inverted files nor the Phase 111 files, and added no `\"workflows\"` member to the ledger `phase` union"
    verification:
      - kind: other
        ref: "git status --porcelain over the five 109 files == 0 lines, at both checkouts; same over errors-bridges.ts + locations.ts == 0; grep -c '\"workflows\"' over non-comment errors.ts == 0"
        status: pass
      - kind: other
        ref: "git diff HEAD~1 HEAD | grep -c '^-[^-]' == 0 for both production files — the change is purely additive"
        status: pass
    human_judgment: false
  - id: D8
    description: "Both edited production files returned to complete direct coverage and the whole gate chain is green"
    verification:
      - kind: other
        ref: "test:coverage:direct name.ts (branches 44/44, functions 6/6, lines 234/234); errors.ts (branches 102/102, functions 46/46, lines 651/651)"
        status: pass
      - kind: other
        ref: "typecheck 0 errors; lint exit 0; fallow exit 0 with dead exports 0.0%; format:check clean; test:corresponding + :negative + test:coverage:direct:negative all pass"
        status: pass
      - kind: integration
        ref: "npm test (5233 pass / 0 fail) and npm run test:integration (32 pass / 0 fail)"
        status: pass
    human_judgment: false

duration: 22 min
completed: 2026-09-05
status: complete
---

# Phase 110 Plan 02: Domain and platform modules Summary

**`generatedWorkflowName` landed with its engine-parity gate completed from two clauses to six — the four rows a plain space, a leading space, U+200B and U+202E produce were observed failing against the ported wrapper before a single production line changed — alongside `WorkflowNameCollisionError` and its defensive-copy contract.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-05T04:44:00Z
- **Completed:** 2026-09-05T05:06:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- The measured WNAM-06 gap is closed inside the phase that owns it. The wrapper
  now replicates every clause of the host engine's `isSafeSavedWorkflowName`,
  so a `meta.name` carrying an interior space, a leading space, a zero-width
  space or a bidi override is refused here rather than becoming an envelope the
  engine silently declines to register.
- The red was real and exact. Four rows failed and only four; the other 74 cases
  in the file passed unchanged, which is what makes the four attributable to the
  gap rather than to the new test block.
- `WorkflowNameCollisionError`'s message template was transcribed from the
  module rather than paraphrased, and the transcription was right first run —
  the `deepStrictEqual` on the whole message would have said otherwise.
- Both edited production files returned to complete direct coverage, and the
  whole gate chain — including `fallow` with dead exports at 0.0% and no
  suppression marker — is green at the commit boundary.

## Task Commits

Both tasks landed as one commit, per Task 2's precondition: `shared/errors.ts`
committed without its owner-test extension would be an unused export that
`fallow dead-code` reports before `npm test` ever runs.

1. **Task 1 + Task 2: the name generator, its completed parity gate, and the collision error** — `2152a2aa` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/name.ts` — `generatedWorkflowName`
  plus the module-private `assertSafeSavedWorkflowName`, with two clauses and a
  rewritten docblock added on top of the ported form (+80 lines, 0 deletions)
- `extensions/pi-claude-marketplace/shared/errors.ts` — `WorkflowNameCollision`
  and `WorkflowNameCollisionError`, taken whole from the port (+36, 0 deletions)
- `tests/domain/name.test.ts` — `describe("generatedWorkflowName")` at line 432,
  after `describe("generatedAgentName")` (+126)
- `tests/shared/errors.test.ts` — `describe("WorkflowNameCollisionError")` at
  line 1527, after `describe("AggregateResourcesDiscoverError")` (+84)

## The observed red

`node --test tests/domain/name.test.ts`, run against the ported wrapper with the
new `describe` block in place and **no** production edit:

```text
ℹ tests 78
ℹ pass 74
ℹ fail 4
```

The four, named exactly as their test titles read:

| # | Row | Joined name | Why the ported wrapper let it through |
|---|-----|-------------|----------------------------------------|
| 1 | `rejects plugin "acme" and source "my name"` | `acme:my name` | interior U+0020 sits above `assertSafeName`'s `code < 0x20 \|\| code === 0x7f` floor |
| 2 | `rejects plugin "acme" and source " lead"` | `acme: lead` | the trim clause runs on the **joined** name, which has no leading or trailing whitespace of its own |
| 3 | `rejects plugin "acme" and source "zw\u200Bsp"` | `acme:zw\u200Bsp` | U+200B is `\p{Cf}`, above the same floor, and outside JavaScript's `\s` (which stops at U+200A) |
| 4 | `rejects plugin "acme" and source "bidi\u202Ex"` | `acme:bidi\u202Ex` | U+202E is `\p{Cf}` and a bidi override, likewise outside `\s` (which covers U+202F, not U+202E) |

Every other case in the file — including the 128-cap boundary pair, the trim
row `trail `, the two empty-head rows and the `ac/me` separator row — passed
before the edit and after it. Row 2 is the one the research flagged as subtle
and it behaved exactly as measured.

After the two clauses were added: 78 tests, 78 pass, 0 fail.

## The two patterns added, and the sentence they replaced

Added to `assertSafeSavedWorkflowName`, ordered after the existing 128-cap and
trim clauses so the cheapest checks still run first:

```ts
  if (/[\s/\\\0]/u.test(name)) {
    throw new Error(
      `Generated workflow name "${name}" must not contain whitespace, path separators, or NUL.`,
    );
  }

  if (/[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new Error(
      `Generated workflow name "${name}" must not contain control or format characters.`,
    );
  }
```

Both carry `/u`, which is what makes the property escapes code-point classes
rather than code-unit matches.

The docblock sentence they replaced, verbatim from the port branch:

> The other four clauses -- the non-empty check, both dot forms, and the
> separator/NUL screening -- are already enforced by `assertSafeName`.

That was measured false against engine 3.10.1 for a plain space and for the
whole format category. The replacement states which four clauses the wrapper
carries itself (the 128 cap, trim equality, the whitespace/separator/NUL screen
and the control-and-format screen), which two `assertSafeName` carries (the
non-empty check and both dot forms), why the last two screens are not redundant
with `assertSafeName` despite overlapping it, and that matching the engine
exactly is the goal:

> Matching the engine exactly is the goal, never exceeding it: a gate stricter
> than the engine refuses a name the engine would accept, and only the lax
> direction self-corrects when a later engine relaxes a rule.

It cites `WNAM-06 / SC-4` and `@quintinshaw/pi-dynamic-workflows` 3.10.1
`dist/workflow-saved.js`, and no planning artifact.

`assertSafeName` itself was not widened. Skills, commands and agents all share
it and none of them wants a 128-character cap or a whitespace ban.

## The `Object.freeze` divergence, and why the analog's assertion was inverted

`110-PATTERNS.md` lists four things to copy verbatim from
`describe("CrossPluginConflictError")`, the fourth being:

> `assert.strictEqual(error.conflicts, conflicts)` after the deep compare —
> pins reference identity, proving the constructor does not defensively copy.
> `WorkflowNameCollisionError.collisions` needs the identical pair.

Copying that would have failed. The two constructors differ:

```ts
// CrossPluginConflictError
this.conflicts = conflicts;            // the caller's array, by reference

// WorkflowNameCollisionError
this.collisions = Object.freeze([...collisions]);   // a frozen copy
```

So the assertion is inverted, and a third assertion added that the analog has no
need for:

```ts
    const error = new WorkflowNameCollisionError(collisions);
    collisions.push({ generatedName: "acme:late", fileNames: ["late.ts"] });

    assert.deepStrictEqual(error.collisions, [ /* the original two */ ]);
    assert.strictEqual(Object.isFrozen(error.collisions), true);
    assert.notStrictEqual(error.collisions, collisions);
```

`notStrictEqual` alone is a standalone negative — it passes for any value. The
post-construction push is what makes the copy provably *defensive* rather than
incidental: a constructor that copied and then kept a live view would satisfy
the first two assertions and fail the third. The nearer in-repo analog turns out
to be `describe("AggregateResourcesDiscoverError")` at the tail of the same
file, whose constructor uses the identical `Object.freeze([...])` and whose
owner test already pins it this way; the new block follows that shape.

## Standing note: SonarCloud duplication on `domain/name.ts`

`generatedWorkflowName` deliberately mirrors `generatedSkillName` /
`generatedAgentName`. Measured on this branch after the commit, `fallow dupes`
reports:

```text
2 groups, 70 lines across extensions/pi-claude-marketplace/domain/name.ts
  → Extract 2 shared clone groups (70 lines) from name.ts into extensions/pi-claude-marketplace/domain
```

Whole-tree duplication is now 928 lines (1.4%) across 38 files. `fallow dupes
--fail-on-issues` exits **0**, so the local gate does not fail and no action is
owed now — but `sonar-project.properties`'s `sonar.cpd.exclusions` does not list
`domain/name.ts`, so a **Duplicated Lines** condition should be expected on the
pull request.

**The remedy is an addition to `sonar.cpd.exclusions` carrying the
`port/README.md` rationale, not a refactor into a shared helper.** That README
records why the shared `generatedColonName` mechanism is unavailable here: main
has since taught `generatedCommandName` to handle `/`-separated nested command
paths and an elision that would empty the head (CM-4, D-141-02), while workflow
discovery is flat and non-recursive (WBRG-02). A shared helper would pull rules
into a caller that can never produce either shape, and would refactor a function
main changed recently for its own reasons. WNAM-06's 2026-09-04 amendment
explicitly declines the shared-helper mechanism and asks instead that the owner
test pin the `<plugin>:<elided>` output — which it now does.

## Decisions Made

- **The wrapper was completed rather than the gap recorded.** The research
  offered both dispositions. Completing it is additive to a function this plan
  was landing anyway, and it makes the bridge match the engine exactly rather
  than exceed it, so WGATE-03's never-be-stricter-than-the-engine concern does
  not engage. Carrying the gap to Phase 115 would have meant a workflow whose
  author put a space in `meta.name` installing and never running, with no
  signal, until 115 ships.
- **The 128-unit boundary pair are standalone `test()` cases, not data rows.**
  Their titles would otherwise interpolate a 128-character literal, and the
  house rule asks for a short sentence stating public behavior.
- **The `WorkflowNameCollision` type import went into the file's separate
  `import type` block.** The plan said "inside the same braces, placed after the
  runtime names"; `tests/shared/errors.test.ts` has carried a distinct
  `import type { ... }` block since before this plan, and `import-x/order`
  places the type group last. The plan's purpose — that the owner test be the
  consumer keeping a Phase-111-only type export off `fallow`'s unused-type-export
  report — is served either way, and `fallow` confirms it: dead exports 0.0%.

## Deviations from Plan

### Documentation deviations (no rule fired)

No deviation rule 1-4 fired: no bug, no missing critical functionality, no
blocker, and no architectural question arose. Two acceptance criteria were
verified by intent rather than by their literal text.

**1. Two grep-shaped criteria carry a pattern that cannot match the house code shape**

- **Found during:** Task 1 and Task 2, at the acceptance-criteria gate
- **Issue:** the criteria read
  `grep -cE 'describe\("generatedWorkflowName"\)' ... prints 1` and
  `grep -cE 'describe\("WorkflowNameCollisionError"\)' ... prints 1`. Both
  patterns require a closing paren immediately after the closing quote. Every
  `describe()` in this repository is written `describe("Name", () => {`, so the
  pattern matches zero blocks in either file — including all four pre-existing
  ones in `tests/domain/name.test.ts`. The criterion is unsatisfiable as
  written for any real block.
- **Fix:** verified the intent with the corrected pattern
  `describe\("<name>",`. Both print `1`.
  `describe("generatedWorkflowName", ...)` is at `tests/domain/name.test.ts:432`,
  greater than `describe("generatedAgentName", ...)` at `:350`, so the ordering
  half of the criterion holds too.
  `describe("WorkflowNameCollisionError", ...)` is at
  `tests/shared/errors.test.ts:1527`.
- **Files modified:** none — this is a criterion-authoring error, not an
  implementation gap
- **Verification:** `grep -cE 'describe\("generatedWorkflowName",'` → `1`;
  `grep -cE 'describe\("WorkflowNameCollisionError",'` → `1`

**2. The `name.ts` deletion-line criterion passes more strictly than written**

- **Found during:** Task 1, at the acceptance-criteria gate
- **Issue:** the criterion expects
  `git diff HEAD -- .../domain/name.ts | grep -c '^-[^-]'` to count "only the
  deletion lines of the wrapper's own docblock". It counts `0`.
- **Fix:** none needed. The docblock that was rewritten exists only on
  `features/workflow-port-wip`; on `HEAD` the whole
  `generatedWorkflowName` + wrapper region does not exist at all, so the diff
  against `HEAD` is purely additive and the rewrite leaves no deletion line
  behind. `0` satisfies the criterion's guarantee — that no line of
  `assertSafeName`, `generatedSkillName`, `generatedCommandName` or
  `generatedAgentName` was touched — more completely than any nonzero count
  could.
- **Verification:** `git diff HEAD~1 HEAD` over both production files counts `0`
  deletion lines each

---

**Total deviations:** 0 auto-fixed. 2 criteria verified by intent with the
correction and the reason recorded.
**Impact on plan:** none. No production or test behavior differs from what the
plan specified.

## Issues Encountered

- **The two format characters were first written as pasted literals.** The plan
  is explicit that they must be escape sequences, and the first draft of the
  rejection rows carried the raw U+200B and U+202E code points instead. The
  acceptance criterion `grep -c 'u200B'` printed `0` and caught it before any
  commit; both input strings and both expected messages were rewritten to
  `\u200B` / `\u202E`. Worth recording because the pre-commit
  `Forbid the use of unicode BiDi control characters` hook would have refused
  the U+202E literal at the commit boundary anyway — the criterion caught it
  first, and the hook then passed.
- **`pre-commit run --files` reported the documented structural `TruffleHog`
  failure** (`failed to read index file: ... .git/index: not a directory`,
  because `.git` is a file in this worktree). Handled per `CLAUDE.md` §Git: a
  filesystem-mode scan over the same four paths reported
  `verified_secrets: 0, unverified_secrets: 0` and exit 0, and the commit
  carried `SKIP=trufflehog` and nothing else. No `--no-verify`, no `--amend`.
- **No post-commit `prettier` drift.** `git status --porcelain` over
  `extensions/` and `tests/` is empty after the commit. `prettier --write` had
  been run on `tests/shared/errors.test.ts` before staging (it rewrapped one
  array literal onto a single line).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `110-03` is unblocked. It carries the real import dependency on this plan:
  `domain/workflow-script.ts` imports `generatedWorkflowName` and
  `WorkflowNameCollisionError`, both of which are now on the branch.
- Per `110-01`'s note and the research, `110-03` must land `acorn`,
  `domain/workflow-script.ts` and `tests/domain/workflow-script.test.ts` in
  **one** commit, or `fallow dead-code` reports an unused dependency.
- The phase mechanism held for a second time: path-scoped checkout naming one
  file, blast-radius assertion immediately after, owner test as the only
  consumer, complete direct coverage, full gate chain before the commit.
- Nothing consumes `generatedWorkflowName` or `WorkflowNameCollisionError` in
  production yet. `fallow` stays clean because both owner tests import them by
  name, with no suppression marker.
- No `EXTENSION_VERSION` bump was made and none is owed until Phase 111 (A-03).
- Carried to pull-request time, not to `110-03`: the `sonar.cpd.exclusions`
  addition for `domain/name.ts` described above.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/name.ts` — FOUND
- `extensions/pi-claude-marketplace/shared/errors.ts` — FOUND
- `tests/domain/name.test.ts` — FOUND
- `tests/shared/errors.test.ts` — FOUND
- commit `2152a2aa` — FOUND, carrying exactly those four paths and nothing else
- every task `<acceptance_criteria>` re-run (two verified by intent, recorded
  above); plan-level `<verification>` re-run and green: both owner tests pass,
  both files at `hit === found` on branches/functions/lines, the four rows were
  observed red with the count recorded, `errors-bridges.ts` and
  `locations.ts` unmodified, Phase 109's five files unmodified, and the whole
  `npm run check` chain green link by link

---
*Phase: 110-domain-and-platform-modules*
*Completed: 2026-09-05*
