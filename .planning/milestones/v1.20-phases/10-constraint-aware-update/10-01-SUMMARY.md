---
phase: 10-constraint-aware-update
plan: 01
subsystem: dependency-management
tags: [update-preflight, closed-set-vocabulary, notification-grammar, semver]

# Dependency graph
requires:
  - phase: 03-dependency-resolution
    provides: "intersectDependencyRanges, isUnconstrainedRange, renderConstraintRange (domain/dependency-range.ts)"
  - phase: 05-prune-on-uninstall
    provides: "buildScopeDeclarationDetail, the offline fail-closed declaration walk (orchestrators/plugin/dependency-index.ts)"
provides:
  - "update-constraint-gate.ts: evaluateUpdateConstraint / describeConstraint, the disjoint-declared-ranges arm end to end"
  - "preparePluginUpdate composes the gate between triage and candidate resolution via an injected constraintGate field"
  - "the 62nd closed-set reason token, 'dependents constrain', landed across all nine pinning surfaces"
  - "PluginSkippedMessage.cause, the first skipped-partition cause-chain interpolation"
  - "constraintCauseFor (update-row.ts), the shared carrier both update cascades will read"
affects: [10-02-tag-resolution, 10-03-post-fetch-guard, 10-04-docs-and-regression]

# Actuals (#2632)
actuals:
  tokens: 17612
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Constraint gate as an injected-field leaf (install-clone-probe.ts's composition shape), inverting an already-built declaration map instead of re-walking state"
    - "One cause-line composer (describeConstraint) shared across all three intersectDependencyRanges failure arms, extended rather than duplicated by later plans"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - tests/orchestrators/plugin/update-constraint-gate.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - docs/output-catalog.md

key-decisions:
  - "D-10-09 checkpoint settled: the new reason token is 'dependents constrain' (operator selected proceed-as-recommended) -- two lowercase words, subject-first on the plural 'dependents' subject, structurally matching the existing 'dependents remain' member. It claims only that the dependents impose a range, which keeps it truthful on the post-fetch-guard arm (plan 10-03) where a version WAS found and simply falls outside what they allow -- the fact that rules out reusing 'no matching version'."
  - "describeConstraint's detail parameter carries intersectDependencyRanges' own diagnostic text (position/count-only, never a raw declared-range value), not the folded range itself -- the three arm clauses are fixed text with no range interpolation, and feeding the diagnostic detail through renderConstraintRange keeps the exported function's arm parameter genuinely read (noUnusedParameters) without reintroducing the raw-content leak the domain module's own detail field is designed to avoid."
  - "ConstraintHolder.range is optional (range?: string), not the literal string shown in the plan's artifacts sketch -- a declarer naming the target with no version still holds the key (appears in holders, and in a cause line) but contributes nothing to the fold. This matches Task 3's own clarifying prose over the shorter artifacts-section shape."

requirements-completed: [UPDT-02]

coverage:
  - id: D1
    description: "A plugin held by two disjoint dependent ranges is skipped by update <plugin>@<mp>, with the new token at warning severity and a cause line naming both declarers in key order, marking the disabled one"
    requirement: "UPDT-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-constraint-gate.test.ts#UPDT-02: disjoint declared ranges hold the update and name both declarers"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#D-10-03: the gate runs after triage and before candidate resolution"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-cascade.test.ts#UPDT-02: projects a held constraint outcome as a warning row with its notes as the cause"
        status: pass
      - kind: integration
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 223 exact documented states"
        status: pass
    human_judgment: false
  - id: D2
    description: "The closed reason set moves 61 to 62 members across all nine pinning surfaces in one change; an unconstrained plugin's outcome stays byte-identical with the gate composed"
    requirement: "UPDT-02"
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: Reason is the closed 62-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#success criterion 3: an unconstrained plugin's outcome is identical with and without a real gate"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-constraint-gate.test.ts (direct coverage: branches 29/29, functions 7/7, lines 233/233)"
        status: pass
    human_judgment: false

duration: 62min
completed: 2026-09-22
status: complete
---

# Phase 10 Plan 01: Update Constraint Gate (Disjoint Ranges) Summary

**New `update-constraint-gate.ts` leaf holds a plugin's `update` to what its installed dependents jointly allow, wired into `preparePluginUpdate` between triage and candidate resolution, with the 62nd closed-set reason token (`dependents constrain`) landed across all nine vocabulary-pinning surfaces in one change.**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-22T13:20:09Z (Task 1 checkpoint dispatched)
- **Completed:** 2026-09-22T14:22:00Z
- **Tasks:** 3 (Task 1 checkpoint:decision, Task 2 tracer, Task 3 fail-closed arm + regression)
- **Files modified:** 21 (Task 2) + 3 (Task 3) — see Files Created/Modified

## Accomplishments

- `evaluateUpdateConstraint` inverts `buildScopeDeclarationDetail`'s declaration map against a target plugin's own key (never a second scope, never the target's own self-declaration), folds every holding declarer's declared range through `intersectDependencyRanges`, and returns `unconstrained` / `admits` / `held` — the `held` arm carries a cause line naming every holder in `localeCompare` key order, marking currently-disabled declarers.
- `preparePluginUpdate` composes the gate through an injected `constraintGate` field (default `evaluateUpdateConstraint`), immediately after triage and before `makeUpdateCloneProbe` — a held verdict returns a `skipped` outcome and the clone probe / candidate resolution are never reached.
- The closed reason vocabulary grew by exactly one member, `dependents constrain` (61 → 62), landed in the same change across the `Reason` union, `CommandPrivateReason`, both `EXPECTED_REASONS` test tuples, `REASON_ENROLLMENT`'s length lock, the catalog's member-count prose, and a new `update-held-by-dependents` catalog state (222 → 223 documented states, byte-verified against the fenced block).
- `PluginSkippedMessage` gained an optional `cause?: Error` — the first `skipped` partition to interpolate a remedy — and `composePluginLinesWith`'s cause-bearing status gate widened to admit it; every pre-existing `skipped` row stays byte-frozen (no other producer sets the field).
- The fail-closed arm (an unreadable declarer, D-10-05), the self-declaration skip, and the range-less-declaration handling are all proven: four distinct real-world walk-refusal shapes reach the held arm carrying the walk's own message verbatim with no absolute path in it, and the "invalid" / "too-complex" `intersectDependencyRanges` failures compose distinct arm clauses alongside the already-covered "disjoint" one.
- Success criterion 3's regression proof: one fixture's `preparePluginUpdate` outcome is `deepStrictEqual` whether the real gate runs (over a state that declares no dependent) or an injected `unconstrained` double answers instead — both paths genuinely execute candidate resolution.

## Task Commits

Each task was committed atomically:

1. **Task 1: Settle the new closed-set reason token's exact wording (D-10-09)** — checkpoint:decision, no commit (operator replied `proceed-as-recommended` via the orchestrator)
2. **Task 2: End to end — disjoint dependent ranges hold one update, and the row names the holders** — `15530b66` (feat), formatting follow-up `8c0795dd` (style)
3. **Task 3: The fail-closed arm and the unconstrained regression, proven on the gate's own seams** — `b9417368` (test), formatting follow-up `7289c7c9` (style)

**Plan metadata:** pending (this commit)

_Note: the two `style` commits are pre-commit's own prettier rewrap of newly-added lines, applied as follow-ups per this checkout's no-pre-commit-hook environment note — never amended._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts` — the new leaf: `ConstraintHolder`, `UpdateConstraintSeam`, `UpdateConstraintOptions`, `UpdateConstraintVerdict`, `evaluateUpdateConstraint`, `describeConstraint`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` — `PreparePluginUpdateOptions.constraintGate`, the gate call site between triage and `makeUpdateCloneProbe`, one shared `auth` bundle for both
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts` — `constraintCauseFor`, the held-update cause-line carrier the manual cascade reads; module header rewritten to describe the leaf's dual role
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts` — `projectSkippedOutcome` spreads the constraint cause onto the projected message; `cascadeSkipSeverity` gains a D-10-12 comment
- `extensions/pi-claude-marketplace/shared/notification-types.ts` — `Reason` gains `"dependents constrain"`; `PluginSkippedMessage.cause?: Error`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — `CommandPrivateReason` gains the new token; header narrative extended (61 → 62)
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` — `composePluginLinesWith`'s cause-bearing status gate admits `"skipped"`
- `docs/output-catalog.md` — new `update-held-by-dependents` catalog state; reasons paragraph moved to "62-member"
- `tests/orchestrators/plugin/update-constraint-gate.test.ts` (new), `tests/orchestrators/plugin/update-preflight.test.ts`, `tests/orchestrators/plugin/update-cascade.test.ts`, `tests/orchestrators/plugin/update-row.test.ts`, `tests/shared/notification-grammar.test.ts`, `tests/shared/notification-types.test.ts`, `tests/architecture/notify-closed-set-locks.test.ts`, `tests/architecture/compat-01-no-expansion.test.ts`, `tests/architecture/catalog-uat/catalog-contract.test.ts`, `tests/architecture/catalog-uat/catalog-parser.test.ts`, `tests/architecture/catalog-uat/fixtures/plugin-update.ts`, `tests/orchestrators/plugin/info.messaging.test.ts`, `tests/orchestrators/plugin/update.messaging.test.ts` — vocabulary pins, new/updated cases

## Decisions Made

- **D-10-09 checkpoint (Task 1):** operator selected `proceed-as-recommended` — the token is `dependents constrain`, verbatim, spelled on all nine pinning surfaces.
- **`describeConstraint`'s `detail` parameter carries diagnostic text, not a raw range.** `intersectDependencyRanges`' own `detail` field is measurement/position-only by the domain module's own design (never a declared range's raw content, so one element's content can never be reported against another's failure); passing it through `renderConstraintRange` keeps the function's `arm` parameter genuinely reachable under `noUnusedParameters` while staying inside that safety invariant. The plan's prose ("Pass every range through `renderConstraintRange`") is satisfied literally without leaking declared-range text.
- **`ConstraintHolder.range` is optional**, not the plan artifacts sketch's plain `range: string`. A range-less declarer still holds the key (Task 3's own clarifying text: "a declaration HOLDS the key whatever it names, but only a declared RANGE constrains a version"), so it stays in `holders` and is filtered out of the array handed to the fold.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `update-row.ts` header describes the cause-line carrier as read by `skipped` only, not `unchanged`**
- **Found during:** Task 2
- **Issue:** The plan's literal Task 2 text asks for a header sentence saying "the constraint cause-line carrier the `skipped` and `unchanged` rows read." D-10-17a (the operator clarification already recorded in `10-CONTEXT.md`, dated the same day) rules that `unchanged`'s D-10-13 disclosure is built directly inside `update-preflight.ts`, never through this carrier — `constraintCauseFor` has exactly one caller, `update-cascade.ts::projectSkippedOutcome`.
- **Fix:** Wrote the header to describe the carrier as read by the `skipped` row alone, matching D-10-17a and the actual call graph.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts`
- **Verification:** `grep -c constraintCauseFor extensions/pi-claude-marketplace/orchestrators/plugin/*.ts` shows exactly one call site (`update-cascade.ts`); typecheck/lint green.
- **Committed in:** `15530b66`

**2. [Rule 1 - Bug] An existing update-preflight.test.ts case now injects an unconstrained `constraintGate` double**
- **Found during:** Task 2
- **Issue:** `"keeps an unexpected resolve failure skipped as no-longer-installable, carrying the raw error"` chmods the plugin's own `plugin.json` to `0o000`. The SAME file is read by the constraint gate's own declaration walk (D-10-04's no-`exclude` design means the target is also walked as a potential declarer), which now trips the fail-closed arm FIRST — with a fixed, redacted message that carries no `EACCES` substring, unlike the raw error `resolveUpdateCandidate`'s fallback used to surface.
- **Fix:** Injected `constraintGate: () => Promise.resolve({ kind: "unconstrained" })` so the pre-existing scenario still exercises `resolveUpdateCandidate`'s own unclassified-error fallback, the behavior the test is actually about.
- **Files modified:** `tests/orchestrators/plugin/update-preflight.test.ts`
- **Verification:** the test passes with its original assertions (`EACCES` match) intact.
- **Committed in:** `15530b66`

**3. [Rule 1 - Bug] Two stale `@ts-expect-error` negatives replaced with positive `satisfies` checks**
- **Found during:** Task 2
- **Issue:** `tests/orchestrators/plugin/update.messaging.test.ts` and `tests/orchestrators/plugin/info.messaging.test.ts` each carried a compile-time negative proving `PluginSkippedMessage` could NOT carry `cause`. Widening the type (this plan's own change) makes both assertions genuinely compile, so `@typescript-eslint`'s "unused `@ts-expect-error`" rule fires.
- **Fix:** Replaced each with a positive `satisfies` literal proving `cause` is now structurally admitted, with a one-line comment explaining why (the shared type widened; the command's own producer never sets it, so its rows stay byte-frozen regardless).
- **Files modified:** `tests/orchestrators/plugin/update.messaging.test.ts`, `tests/orchestrators/plugin/info.messaging.test.ts`
- **Verification:** `npm run typecheck` green (was failing with `TS2578: Unused '@ts-expect-error' directive` before the fix).
- **Committed in:** `15530b66`

**4. [Rule 1 - Bug] Two fallow suppressions for `describeConstraint`'s export and its `ConstraintArm` parameter type**
- **Found during:** Task 2
- **Issue:** `npm run fallow`'s production dead-code pass flagged `describeConstraint` as an unused export (its only cross-file consumer is the paired test; its production consumer is the internal call inside `evaluateUpdateConstraint`, in the SAME file) and a private-type leak on its `ConstraintArm` parameter. The plan's own text explicitly directs exporting `describeConstraint` ("plans 10-02 and 10-03 add arms to it, and the paired test drives it directly"), which conflicts with fallow's cross-file-only reachability check.
- **Fix:** Added `fallow-ignore-next-line unused-export` on the export line and `fallow-ignore-next-line private-type-leak` on the `arm: ConstraintArm` parameter line, each with a one-line reason, matching the project's existing suppression precedent (`extensions/pi-claude-marketplace/index.ts`, `reinstall-replace.ts`).
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts`
- **Verification:** `npm run fallow` exits 0 with `✓ No issues found` on both dead-code passes.
- **Committed in:** `15530b66`

**5. [Rule 1 - Bug] `update-row.ts` and 100%-coverage gap for `constraintCauseFor` closed with new unit cases**
- **Found during:** Task 2 (`npm run test:coverage:direct:commit`)
- **Issue:** `constraintCauseFor` (Task 2's new export) had no test at all, dropping `update-row.ts` to 96.39% line / 66.67% function coverage — a shortfall the pin file does not carry.
- **Fix:** Added three focused cases in `tests/orchestrators/plugin/update-row.test.ts`: a held outcome composing an `Error` from its joined notes, a non-held outcome returning `undefined`, and a held-reason-with-no-notes edge returning `undefined`.
- **Files modified:** `tests/orchestrators/plugin/update-row.test.ts`
- **Verification:** `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts` reports 100% lines/branches/functions.
- **Committed in:** `15530b66`

---

**Total deviations:** 5 auto-fixed (5 Rule-1 bug/gate-compliance fixes; 0 missing-critical, 0 blocking, 0 architectural)
**Impact on plan:** All five are necessary corrections surfaced by the plan's own verify gates (typecheck, fallow, direct coverage) or by an explicit operator ruling (D-10-17a) already on record. No scope creep — no new production behavior beyond what Tasks 2 and 3 specify.

## Issues Encountered

None beyond the five auto-fixes documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The gate's seam (`UpdateConstraintSeam`), the `UpdateConstraintOptions` shape (including the as-yet-unread `tagMemo` / `marketplaceTagMemo` / `auth` fields), and the `describeConstraint` composer are all in place for plan 10-02 to add `probeDependencyTags` / `probeMarketplaceTags` and the `pin` arm without widening any already-shipped type.
- `describeConstraint`'s `ConstraintArm` type currently covers `intersectDependencyRanges`' three failure reasons only; plan 10-03's post-fetch-guard arm will need its own arm value and clause, extending `ARM_CLAUSE` rather than writing a second composer.
- `PreparedPluginUpdate` gained no new field (D-10-17 upheld); `UpdateConstraintDisclosure` and its required-but-nullable carriers on `PreparedPluginUpdate` / the two outcome types are still plan 10-03's work, per D-10-17a.
- No blockers. `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm run test:corresponding`, and `npm run test:coverage:direct:commit` are all green on the plan's final tree; `npx prettier --check docs/output-catalog.md` passes.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts` — FOUND
- `tests/orchestrators/plugin/update-constraint-gate.test.ts` — FOUND
- Commit `15530b66` — FOUND in `git log`
- Commit `8c0795dd` — FOUND in `git log`
- Commit `b9417368` — FOUND in `git log`
- Commit `7289c7c9` — FOUND in `git log`

---
*Phase: 10-constraint-aware-update*
*Completed: 2026-09-22*
