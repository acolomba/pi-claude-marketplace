---
phase: 99-post-audit-tech-debt-closure
plan: 02
subsystem: tests
tags: [architectural-test, drift-gate, regex, enbl-05, test-only]

requires:
  - phase: 99-post-audit-tech-debt-closure
    provides: "the live ENBL-05 drift gate (INLINE_REDERIVATIONS, extensionSourceFiles walk, stripComments pre-pass)"
provides:
  - "DESTRUCTURED_ENABLED_BINDING — flags a destructure that binds the `enabled` key off a record"
  - "BRACKET_ENABLED_ACCESS — flags bracket access to the `enabled` key"
  - "BOOLEAN_ENABLED_COERCION — flags a Boolean(...) coercion wrapping an `.enabled` read"
  - "Per-pattern twin/negative-control proof and a membership + non-global wiring pin"
affects: [any future rewrite of a disabled-state check into a non-operator-adjacent spelling]

actuals:
  tokens: 1340
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Gate self-test as a DATA table: {label, pattern, line} triples so each pattern proves TRUE on its own twin and FALSE on every negative control, with no prose that stripComments could turn into evidence"
    - "Membership pin: assert a proven pattern is actually IN the array the walk consumes, so a self-test cannot pass while the gate sees nothing"

key-files:
  created: []
  modified:
    - tests/orchestrators/reconcile/plan.test.ts

key-decisions:
  - "Flagged the ACCESS shape (not the comparison) for the bracket and Boolean twins: neither has a legitimate use anywhere in the extension tree, so an unconditional match is simpler AND stricter than enumerating every negation spelling that could wrap it."
  - "Matched the destructuring BINDING (`{ ... enabled ... } = <expr>`) rather than a bare `!enabled`. A bare identifier cannot be told apart from any unrelated local, so a bare-identifier pattern would be a false-positive engine, not a gate."
  - "`[^{}]*` (never crossing a nested brace) plus a REQUIRED `=` after the closing brace is what keeps the destructuring pattern off object literals: a literal's `=` precedes its brace, so it can never reach the match."
  - "Ran the three candidate regexes over all 202 extension source files (post-stripComments) BEFORE the first edit. Zero hits, so no pattern had to be narrowed after the fact and no exemption was ever considered."

patterns-established:
  - "A drift-gate pattern needs three assertions, not one: TRUE on its twin, FALSE on each excluded axis, and membership in the array the walk actually iterates."

requirements-completed: [D-99-02b]

coverage:
  - id: D1
    description: "The gate flags a destructured `const { enabled } = record` disabled-state rederivation"
    requirement: "D-99-02b"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05: the drift gate flags the destructured, bracket-access and Boolean() twin spellings (D-99-02b)"
        status: pass
      - kind: other
        ref: "RED commit 5481856c — suite exit 1, that test the sole failure, before the patterns existed"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate flags a bracket-access `record[\"enabled\"]` rederivation"
    requirement: "D-99-02b"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05: the drift gate flags the destructured, bracket-access and Boolean() twin spellings (D-99-02b)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gate flags a `Boolean(record.enabled)` comparison twin"
    requirement: "D-99-02b"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05: the drift gate flags the destructured, bracket-access and Boolean() twin spellings (D-99-02b)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No new pattern matches the config-declaration axis `entry.enabled !== false` or a legitimate `isRecordedButDisabled(...)` call"
    requirement: "D-99-02b"
    verification:
      - kind: unit
        ref: "same test — inner NON_REDERIVATIONS loop, run per pattern (3 patterns x 2 controls) plus a gate-level control loop"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole-tree walk stays green: no new pattern fires on any legitimate consumer in the extension tree"
    requirement: "D-99-02b"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05: no disabled-state twin survives ANYWHERE in the extension tree (drift gate) — 202 files walked, offenders []"
        status: pass
      - kind: other
        ref: "pre-flight dry run of the three candidate regexes over all 202 stripped sources — 0 hits"
        status: pass
    human_judgment: false
  - id: D6
    description: "The import-presence half of the gate still passes, unchanged"
    requirement: "D-99-02b"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05: every former definition site imports the single persistence/state-io.ts predicate — untouched by all three commits"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every widened pattern is wired into the walk and is non-global"
    requirement: "D-99-02b"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05: every widened pattern reaches the source walk, and no pattern is global (D-99-02b)"
        status: pass
      - kind: other
        ref: "deletion probe: unwiring BRACKET_ENABLED_ACCESS from INLINE_REDERIVATIONS turned the suite red (exit 1) on exactly that test; restored via `git restore --source=HEAD`"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-10
status: complete
---

# Phase 99 Plan 02: ENBL-05 drift-gate widening Summary

**Three non-global patterns added to the single-axis rederivation set so a destructured binding, a bracket access, or a `Boolean()` coercion of `enabled` can no longer install a second definition of "disabled" behind a green gate — each proven TRUE on its twin literal and FALSE on both the config-declaration axis and a legitimate predicate call.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 (3 commits — RED / GREEN / wiring pin)
- **Files modified:** 1 (test-only; no production line touched)

## The three final regex forms, verbatim

| Constant | Regex | Twin literal it was proven against |
|---|---|---|
| `DESTRUCTURED_ENABLED_BINDING` | `/\{[^{}]*\benabled\b[^{}]*\}\s*=(?![=>])/` | `const { enabled } = record;` |
| `BRACKET_ENABLED_ACCESS` | `/\[\s*["']enabled["']\s*\]/` | `if (!record["enabled"]) {` |
| `BOOLEAN_ENABLED_COERCION` | `/Boolean\s*\([^)]*\.enabled\b[^)]*\)/` | `if (Boolean(record.enabled) === false) {` |

Both negative controls, applied to **each** pattern individually:

- `if (entry.enabled !== false) {` — the config-declaration axis (`persistence/config-io.ts:89`), a different fact about a different object whose default is enabled-when-absent.
- `if (isRecordedButDisabled(record)) {` — the legitimate consumer call shape.

**No pattern had to be narrowed after firing on the tree.** All three were dry-run over every one of the 202 `.ts` files under `extensions/pi-claude-marketplace/` (with the same `stripComments` pre-pass the walk uses) *before* the first edit: zero hits. The walk has stayed green on every commit since. No exemption was added, and none was needed.

## Why each pattern is shaped the way it is

- **Bracket and `Boolean()` flag the ACCESS, not the comparison.** Neither spelling has a legitimate use anywhere in this tree, so matching them unconditionally is both simpler and stricter than enumerating `!x`, `=== false`, `!== true` and every future negation someone invents. The `Boolean` pattern requires the `.enabled` read *inside* the parens, which is what leaves the nine `Type.Boolean()` typebox schema declarations (including `config-io.ts:56` and `state-io.ts:82`) untouched.
- **Destructuring matches the binding, never a bare identifier.** `!enabled` on its own cannot be told apart from any unrelated local, so a bare-identifier pattern would be a false-positive engine. Two properties keep the binding pattern off object literals: `[^{}]*` never crosses a nested brace, and the `=` must follow the *closing* brace — a literal's `=` precedes its opening brace, so it can never reach the match. `(?![=>])` excludes `===`, `!==` and arrow bodies.

## Task Commits

1. **Task 1 (RED): pin the escaping twin spellings** - `5481856c` (test) — suite exit 1, the new test the sole failure among 34.
2. **Task 1 (GREEN): widen the gate** - `07d4e31a` (test) — three constants added, appended to `INLINE_REDERIVATIONS`, per-pattern proof + negative controls; 34/34 pass.
3. **Task 2: pin the wiring and the non-global flags** - `6bafbf30` (test) — membership + `re.global === false` over every member; 35/35 pass.

## Files Created/Modified

- `tests/orchestrators/reconcile/plan.test.ts` - three named non-global constants, the `ESCAPING_TWIN_SPELLINGS` / `NON_REDERIVATIONS` data tables, two new tests, and the `INLINE_REDERIVATIONS` doc comment extended from three spellings to six.

## Decisions Made

- **RED asserted at the gate level, not the pattern level.** A per-pattern RED would have had to reference constants that did not yet exist, leaving `npm run typecheck` red on the branch for one commit. Asserting `INLINE_REDERIVATIONS.some(re => re.test(twin))` is the same contract stated through the array's public behaviour, fails for exactly the right reason, and keeps every commit typecheck-clean. The per-pattern form landed in GREEN, where the constants exist.
- **Membership is its own assertion.** A pattern that passes its self-test but never reaches the array is a gate that proves itself while seeing nothing. `INLINE_REDERIVATIONS.includes(twin.pattern)` closes that gap; the deletion probe confirmed it fires.
- **Non-global pinned as an assertion, not a grep.** The plan's done-criteria named a `grep -n "/g[;,)]"` check (which returns only `stripComments`' legitimate `.replace(/…/g, "")`, no gate pattern). An `assert.equal(re.global, false)` over every member is the durable form of the same check and survives future additions to the array.
- **Twin literals held as DATA, never as prose.** Per the plan's prohibition, nothing in this file describes the twin spellings in a comment that `stripComments` could turn into evidence for or against the walk.

## Deviations from Plan

**Task boundary shifted by one step.** The plan assigned the `INLINE_REDERIVATIONS` append and its doc-comment extension to Task 2. Both landed in Task 1's GREEN commit instead, because the RED assertion is stated over the array — leaving the append for Task 2 would have made the GREEN commit red. Task 2 delivered the wiring pin, the non-global pin, and the verification sweep. Net effect on the artifact is nil; only the commit each hunk sits in moved.

No Rule 1/2/3 auto-fixes were needed. No architectural (Rule 4) question arose.

## Must-Haves: satisfied

- **Gate flags the destructured, bracket-access and `Boolean()` twins (D-99-02b)** — satisfied; per-pattern TRUE assertions, and the RED commit proves the gate did not flag them before.
- **Each new pattern carries an inline self-test against its planted twin spelling** — satisfied, in the `GLYPH_DECLARATION` self-test style: inline string literals, no twin planted in a real source file.
- **Each new pattern carries a negative control against `entry.enabled !== false`** — satisfied; the control loop runs per pattern, plus a second gate-level control loop over all six members.
- **The whole-tree walk stays green** — satisfied; 202 files, `offenders` deep-equals `[]`, on every commit.
- **The import-presence half still passes unchanged** — satisfied; `PREDICATE_DEFINITION_SITE`, `FORMER_DEFINITION_SITES`, `TWO_AXIS_CONJUNCTION` and `SINGLE_PREDICATE_IMPORT` appear in no diff hunk.

## Verification Evidence

All exit codes captured directly, never through a pipe.

| Gate | Command | Exit |
|---|---|---|
| Affected suite | `node --test tests/orchestrators/reconcile/plan.test.ts` | 0 — 35 pass, 0 fail |
| Lint | `npm run lint` | 0 |
| Typecheck | `npm run typecheck` | 0 |
| Format | `npm run format:check` | 0 |
| Deletion probe | same suite with `BRACKET_ENABLED_ACCESS` unwired | 1 — membership test the sole failure |
| Production files touched | `git diff --name-only f0861e0d HEAD` | `tests/orchestrators/reconcile/plan.test.ts` only |

Pre-commit hooks ran clean on every commit; `trufflehog` failed structurally (worktree git-mode scan) and was cleared by a filesystem-mode scan over the changed path each time — `verified_secrets: 0`, `unverified_secrets: 0`.

## Known Stubs

None. No stub, TODO, FIXME, skipped test, or unrun `<verify>` was introduced.

## Threat Flags

None. T-99-02-01 (regex backtracking) is mitigated as planned — every pattern uses bounded negated character classes with no nested quantifier, and the suite's runtime did not move measurably. T-99-02-02 (a second definition of "disabled" landing unseen) is reduced exactly as the plan predicted: the three twin rewrites are now red tests.

## Self-Check: PASSED

- `tests/orchestrators/reconcile/plan.test.ts` — FOUND
- `.planning/phases/99-post-audit-tech-debt-closure/99-02-SUMMARY.md` — FOUND
- Commits `5481856c`, `07d4e31a`, `6bafbf30` — all FOUND in `git log`
