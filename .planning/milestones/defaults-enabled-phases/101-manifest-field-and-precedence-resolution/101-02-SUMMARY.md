---
phase: 101-manifest-field-and-precedence-resolution
plan: 02
subsystem: domain
tags: [resolver, precedence, defaultEnabled, tests, strict-mode, loose-mode]

# Dependency graph
requires:
  - 101-01
provides:
  - "The DFEN-02 precedence truth table pinned in strict mode: both entry-wins directions, both agreement cases, and both absent-declaration fallbacks"
  - "The DFEN-01 resolution-time guards: a non-boolean `defaultEnabled` in `plugin.json` resolves `unavailable` with the existing `malformed plugin.json` note prefix; an unrelated unknown key still resolves"
  - "The loose-mode non-conflict proof — a manifest-only `defaultEnabled` with a silent entry is metadata, never a declaration conflict"
  - "Mode-parity proof across four input shapes, asserted against spelled-out literals rather than by cross-calling the other mode"
affects:
  - "102 — reason token, install write-through and notification"
  - "104 — pre-install read surfaces (parity is what lets one answer be rendered)"

actuals:
  tokens: 6300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Truth-table grouping: a multi-cell precedence rule gets one delimited test section carrying every cell, including the cells a reader would otherwise infer"

key-files:
  created: []
  modified:
    - tests/domain/resolver-strict.test.ts
    - tests/domain/resolver-loose.test.ts

key-decisions:
  - "The end-to-end case written by the prior plan was relocated into the new section rather than left inside the PR-2 block. The plan asked for the whole table in one place, and the PR-2 block's own file header claims a 1:1 mapping between PR-2 cases and tests, which the interloping case contradicted."
  - "The manifest-only parity case declares `skills` alongside the metadata field, so its body is not a near-copy of the non-conflict case above it and it additionally shows the metadata field is inert next to a real component declaration."
  - "The agreement cases assert `!notes.some(n => n.includes(\"defaultEnabled\"))` rather than an exact notes length, so an unrelated note added by a later phase does not break the no-diagnostic claim."

patterns-established:
  - "Non-boolean-schema guard: assert the note PREFIX (`malformed plugin.json`) that downstream classifiers key on, never the validator-generated trailing detail."
  - "Mode-parity assertion: spell the expected literal out in the second mode's suite instead of importing the first mode's entry point, so a divergence reads directly in the failure output and each suite keeps its single-mode focus."

requirements-completed: [DFEN-01, DFEN-02]

coverage:
  - id: D1
    description: "The marketplace entry wins over `plugin.json` in BOTH directions — entry `false` over manifest `true`, and entry `true` over manifest `false` — each pinned by its own case"
    requirement: DFEN-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#DFEN-02 entry false + manifest true / DFEN-02 entry true + manifest false"
        status: pass
      - kind: unit
        ref: "node --test tests/domain/resolver-strict.test.ts — 86 pass, 0 fail"
        status: pass
    human_judgment: false
  - id: D2
    description: "Agreement between the two declaration sites resolves to the agreed value with no diagnostic appended to `notes[]`, in both the false-false and true-true directions"
    requirement: DFEN-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#DFEN-02 entry false + manifest false / entry true + manifest true — each asserts the value AND that no note mentions the field"
        status: pass
    human_judgment: false
  - id: D3
    description: "Absent at both sites resolves `true`, reached by two distinct code paths: a `plugin.json` that exists but declares nothing, and no `plugin.json` at all (`readManifest` returns `manifest: null`)"
    requirement: DFEN-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#DFEN-02 entry silent + manifest present but silent / DFEN-02 entry silent + no plugin.json on disk"
        status: pass
    human_judgment: false
  - id: D4
    description: "A manifest-only `defaultEnabled` with a silent entry resolves in loose mode and carries the manifest value; it is never the declaration conflict that a component key in the same position would be"
    requirement: DFEN-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#DFEN-02 manifest-only defaultEnabled with a silent entry -> resolves carrying false, not a conflict"
        status: pass
      - kind: unit
        ref: "node --test tests/domain/resolver-loose.test.ts — 26 pass, 0 fail"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both resolution modes answer the precedence question identically across entry-wins-false, entry-wins-true, absent-both and manifest-only"
    requirement: DFEN-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#DFEN-02 loose: four parity cases, each asserting the same literal the strict suite asserts"
        status: pass
      - kind: unit
        ref: "node --test \"tests/domain/**/*.test.ts\" — 382 pass, 0 fail (both suites agree)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A non-boolean `defaultEnabled` in `plugin.json` resolves `unavailable` carrying the existing `malformed plugin.json` note prefix, with no bespoke error class and no coercion; an unrelated unknown key still resolves"
    requirement: DFEN-01
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#DFEN-01 non-boolean defaultEnabled in plugin.json / DFEN-01 entry declaring an unrelated unknown key"
        status: pass
    human_judgment: false
  - id: D7
    description: "No production file was modified — this plan is tests only"
    verification:
      - kind: other
        ref: "git diff --name-only a8de026c~1 HEAD -- extensions/ is empty; the full diff lists exactly the two test files"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-08-14
status: complete
---

# Phase 101 Plan 02: Manifest field and precedence resolution Summary

**The `defaultEnabled` precedence rule is now pinned cell by cell — both entry-wins directions, both agreement cases, both absent-declaration fallbacks — in both resolution modes, plus the two DFEN-01 validation guards that live at resolution time.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-14T14:50Z
- **Completed:** 2026-08-14T15:05Z
- **Tasks:** 2
- **Files modified:** 2 (both test files; zero production files)

## Accomplishments

- The strict-mode truth table reads as one delimited section: the entry beats the manifest in both directions, agreement is not a conflict, and the two ways of being silent (a `plugin.json` that declares nothing, and no `plugin.json` at all) both land on `true`.
- The entry-`true`-beats-manifest-`false` direction has its own case. Nothing about the false-wins case implies it, and removing the entry-side branch of the precedence helper fails exactly that test.
- Both agreement cases assert the resolved `notes[]` in addition to the resolved value, so a future "you declared this twice" note would fail the suite rather than slip through.
- The loose-mode non-conflict test is the MM-6 conflict test with the outcome inverted. It is the only guard that would notice if a later edit widened the conflict accumulators from closed tuples to open key iteration — which would turn every metadata field into conflict material.
- Four parity cases assert the same literals the strict suite asserts. The read-surface phase can now render one answer without explaining a mode divergence it never had.

## Task Commits

1. **Task 1: Strict-mode precedence matrix and the two resolution-time validation guards** - `a8de026c` (test)
2. **Task 2: Loose mode — metadata is not conflict material, and the answer is mode-independent** - `d4ebe4ee` (test)

## Files Created/Modified

- `tests/domain/resolver-strict.test.ts` - a new `DFEN-01 / DFEN-02` section holding eight precedence cases and the two validation guards; the prior plan's end-to-end case relocated into it
- `tests/domain/resolver-loose.test.ts` - a new `DFEN-02` section holding the non-conflict proof and four parity cases, placed directly after the MM-6 block it contrasts with

## Decisions Made

- **The prior plan's end-to-end case was relocated, not duplicated.** It sat between `PR-2(4)` and the `HOOK-01` tests, which contradicts the file header's claim of a 1:1 PR-2-case-to-test mapping and split the truth table across two places. Moving it into the new section satisfies the plan's "one place" instruction without writing a second copy of the same cell.
- **The manifest-only parity case declares `skills` as well.** Written plainly it would have been a near-copy of the non-conflict case immediately above it. Adding an unrelated real component declaration differentiates the body and buys a second fact: the metadata field stays inert next to a declaration the conflict machinery *does* police.
- **The no-diagnostic assertion is a substring predicate, not a notes-length check.** `!notes.some(n => n.includes("defaultEnabled"))` survives an unrelated note being added by a later phase while still failing if the field itself becomes chatty.
- **Placement in the loose file is next to MM-6, not at the end.** The contrast with the conflict case is the whole point of the test, and adjacency is what makes it legible.

## Deviations from Plan

None — plan executed exactly as written. No deviation rule fired; no auto-fix was needed.

One judgment call inside planned work, recorded above rather than left implicit: the relocation of the prior plan's end-to-end case. The plan said the new cases "extend it rather than duplicating it" and asked for the table in one place; relocating satisfies both, whereas leaving it in place would have satisfied only the first.

## Issues Encountered

- The `trufflehog` pre-commit hook fails structurally in a linked worktree (`.git` is a file, so the git-mode scan cannot read the index). Handled by the project's sanctioned procedure both times: a clean `trufflehog filesystem` scan over the exact path being committed (`verified_secrets: 0`, `unverified_secrets: 0`), then `pre-commit run --files ...` with every other hook passing, then `SKIP=trufflehog git commit`. No other hook was skipped and `--no-verify` was never used.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Scope fence held: no install was recorded disabled, nothing was written to `claude-plugins.json`, no reason token was added, and no notification or read surface changed. Acting on the resolved value remains phase 102's work.
- The concurrent plan `101-03` is untouched — `tests/domain/manifest.test.ts`, `tests/orchestrators/plugin/install.test.ts` and `tests/orchestrators/plugin/info.test.ts` were not opened.
- `npm run typecheck`, `npm run lint` and `npm run format:check` are green; the whole domain suite is 382 pass / 0 fail.

## Self-Check: PASSED

Both modified files exist on disk; both task commits (`a8de026c`, `d4ebe4ee`) are present in `git log`; `git diff --name-only a8de026c~1 HEAD -- extensions/` is empty, confirming no production file was touched.

---
*Phase: 101-manifest-field-and-precedence-resolution*
*Completed: 2026-08-14*
