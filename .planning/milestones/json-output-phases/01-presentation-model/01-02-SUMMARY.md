---
phase: 01-presentation-model
plan: 02
subsystem: notify
tags: [notify, presentation-model, resolve-step, envelope, text-strategy]

requires:
  - phase: 01-presentation-model
    provides: "01-01 notify wire-corpus baseline and `node scripts/notify-corpus.mjs check`"
provides:
  - "extensions/pi-claude-marketplace/shared/notification-resolve.ts: InfoEnvelope, AttentionEnvelope, ResolvedEnvelope, ResolvedTally, ResolvedTallySuccess, resolveEnvelope, resolveUpdateNoOpEnvelope"
  - "notification-grammar.ts formatNotificationText: folds body, no-op headline or tally sentence, reload trailer, then prepends the summary at warning/error"
  - "notification-summary.ts exports computeSeverity, buildSummaryLine, countRowsBySeverity, tallyCategory, SummaryCounts"
  - "dispatch seam: every emitter renders the body, resolves the envelope, and hands both to emitWithSummary (one ctx.ui.notify call)"
affects: [01-presentation-model row facts, markers, failure detail, json-output wire schema]

actuals:
  tokens: 20733
  tasks: 2
  commits: 2
plan_head_before: 729b7152b41f3ccfd4ffdd215cd28462a6994f1d
plan_head_after: 580f6879fa4254364925840e08bf081834f6d447

tech-stack:
  added: []
  patterns:
    - "Resolve -> format -> notify: envelope facts are plain readonly interfaces; the text strategy reads them and never re-derives English"
    - "Severity and the summary line resolve before the reload and tally facts, preserving the message.kind read order"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - tests/shared/notification-resolve.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-summary.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - tests/shared/notification-summary.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/architecture/notify-will-reload-agreement.test.ts
    - tests/architecture/catalog-uat/fixtures/plugin-update.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "emitWithSummary keeps its name but takes a ResolvedEnvelope, so the five notify-context comments that name the seam stay true"
  - "resolveEnvelope computes severity and the summary line first, then needsReload and the tally, because the getter-backed kind cases in notification-dispatch.test.ts pin the bytes of that read order"
  - "computeSeverity spells its return type inline and SummaryCounts is exported, to satisfy fallow private-type-leaks on the newly exported functions"

patterns-established:
  - "Envelope model growth: add a readonly member to both InfoEnvelope and AttentionEnvelope, resolve it in notification-resolve.ts, and read it in formatNotificationText; lint:type-members proves the read"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "resolveEnvelope resolves severity, the composed summary line, needsReload, the numeric tally, and noOp:false; resolveUpdateNoOpEnvelope resolves noOp:true with no tally and no reload"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-resolve.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "formatNotificationText composes the tally sentence, the no-op headline, the reload trailer, and the summary prepend, dropping absent segments so no two segments are separated by two blank lines"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatNotificationText"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-grammar.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Emitted bytes and argc are unchanged: the wire corpus, the output catalog, and catalog-contract all match"
    requirement: PMOD-01
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check"
        status: pass
      - kind: other
        ref: "git diff --exit-code 2f173031 -- docs/output-catalog.md"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 80min
completed: 2026-09-29
status: complete
---

# Phase 1 Plan 02: Envelope Resolve Step Summary

**A new `notification-resolve.ts` computes each notification's severity, summary line, `needsReload`, numeric tally, and update no-op flag once. `formatNotificationText` in the grammar turns those facts into the summary block, tally sentence, no-op headline, and `/reload` trailer. All 2622 corpus entries and the output catalog are byte-identical.**

## Performance

- **Duration:** 80 min
- **Started:** 2026-09-29T14:15:48Z
- **Completed:** 2026-09-29T15:35:42Z
- **Tasks:** 2
- **Files modified:** 11 (2 created, 9 modified)

## Accomplishments

- `shared/notification-resolve.ts` holds the D-09 model as plain readonly interfaces. It has no typebox import. `resolveEnvelope` returns `{ severity: "info", needsReload, noOp, tally? }` or `{ severity: "warning" | "error", summary, needsReload, noOp, tally? }`. `resolveUpdateNoOpEnvelope` keeps severity and the summary line, and sets `noOp: true` with no tally and no reload.
- The tally is numeric: `{ label, failures, warnings, success?: { count, verb? } }`. The `composeTally` presence rules carry over unchanged: plural cardinality, a label, the bare-header subtraction, zero successes on a populated result, and the owner override. The tally is absent when no category is present.
- `notification-grammar.ts` now owns `RELOAD_HINT_TRAILER`, `UPDATE_NO_OP_HEADLINE`, the tally sentence, and the wire-format mini-spec, all module-private. `formatNotificationText` joins body, then headline or tally, then trailer. It drops empty segments before joining and prepends the summary at warning and error.
- `notification-summary.ts` no longer exports `composeWithSummary`, `composeTally`, `foldTallyAndHint`, `RELOAD_HINT_TRAILER`, or `UPDATE_NO_OP_HEADLINE`. It now exports `computeSeverity`, `buildSummaryLine`, `countRowsBySeverity`, and `tallyCategory`, with their bodies unchanged.
- In `notification-dispatch.ts`, each of the four structured emitters renders its body, calls `resolveEnvelope` or `resolveUpdateNoOpEnvelope`, and makes one `ctx.ui.notify` call: one argument at info, two otherwise. `emitCascadeWith` no longer takes a hint argument, and the update no-op keeps its body without a sentinel.

## Task Commits

1. **Task 1: Severity and the summary line resolve before the text strategy prepends them** - `37a79818` (feat)
2. **Task 2: Tally counts, needsReload, and the no-op flag resolve with the envelope** - `580f6879` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-resolve.ts` - the resolve step and the envelope model
- `tests/shared/notification-resolve.test.ts` - owner test with literal envelopes: the severity and summary kinds, every tally presence rule, needsReload stamps, reconcile-applied, and the no-op
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` - `formatNotificationText`, the tally sentence, the two literals, the wire-format mini-spec
- `extensions/pi-claude-marketplace/shared/notification-summary.ts` - exports the severity, summary, and counting helpers; removes the folds and literals; restated header
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` - resolve, then format, then notify at every emitter
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - doc comments now name `resolveEnvelope` and the resolved tally
- `tests/shared/notification-summary.test.ts` - direct `computeSeverity`, `buildSummaryLine`, and `countRowsBySeverity` cases; every emitting case left in place (D-02)
- `tests/shared/notification-grammar.test.ts` - `formatNotificationText` cases: info bytes, summary prepend, tally words and verb, segment order, no-op slot, adjacency edge
- `tests/architecture/notify-will-reload-agreement.test.ts` - restated claim: `needsReload` is resolved in notification-resolve.ts from `shouldEmitReloadHint`, and the trailer literal lives in notification-grammar.ts. The mirror constant is unchanged.
- `tests/architecture/catalog-uat/fixtures/plugin-update.ts` - two comments no longer name the deleted `composeTally`
- `scripts/check-unused-type-members.contracts.json` - five contracts repinned by line only (dispatch, grammar x2, notify-context x2)

## Decisions Made

- `emitWithSummary` kept its name and now takes a `ResolvedEnvelope`. Five `notify-context.ts` comments and several dispatch comments name the seam, and they stay accurate.
- The body is still rendered before the envelope is resolved at every emitter. `dispatchRow` floors a row with no render arm to error while rendering, and severity must read that floored stamp.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fallow private-type-leaks on the new exports**
- **Found during:** Task 1 (`computeSeverity`) and Task 2 (`countRowsBySeverity`)
- **Issue:** Exporting `computeSeverity` leaked the private `ComputedSeverity` alias, and exporting `countRowsBySeverity` leaked the private `SummaryCounts` interface. `private-type-leaks` is an error in `.fallowrc.json`.
- **Fix:** `computeSeverity` spells its return type as `"warning" | "error" | undefined`, which is the signature the plan's interface block gives. `SummaryCounts` is exported.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notification-summary.ts`
- **Verification:** `npm run fallow` exits 0
- **Committed in:** `37a79818`, `580f6879`

**2. [Rule 1 - Bug] The envelope read `message.kind` in a new order**
- **Found during:** Task 2
- **Issue:** The first version of `resolveEnvelope` resolved `needsReload` and the tally before severity. That added `message.kind` reads before `computeSeverity`. Two `notification-dispatch.test.ts` cases use a getter-backed `kind` that changes value on each read, so their output bytes changed ("summary computation preserves its ... empty fallback after narrowing").
- **Fix:** Severity and the summary line now resolve first, through `resolveAttention`, and `needsReload` and the tally resolve after. The comment at the call site records why.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts`
- **Verification:** Both dispatch cases pass, and the corpus check passes.
- **Committed in:** `580f6879`

**3. [Rule 2 - Missing coverage] Direct `countRowsBySeverity` case**
- **Found during:** Task 2
- **Issue:** Deleting the direct `composeTally` cases left the `p.severity ?? "info"` default on an unstamped plugin row unreached by the summary pair (101 of 102 branches reached).
- **Fix:** Added "countRowsBySeverity counts unstamped rows as info", a whole-value case on the newly exported function.
- **Files modified:** `tests/shared/notification-summary.test.ts`
- **Verification:** Direct coverage passes: branches 101/101.
- **Committed in:** `580f6879`

**4. [Plan wording] The kind-sequence summary cases became direct calls**
- **Found during:** Task 1
- **Issue:** The plan says to keep the kind-sequence cases that reach `buildSummaryLine`'s defensive empty-string arms. They needed a getter only because `composeWithSummary` put `computeSeverity` in front of `buildSummaryLine`.
- **Fix:** With `buildSummaryLine` exported, two direct cases reach both empty arms: a read-only kind, and a non-failed `plugin-info`. The unused `messageWithKindSequence` helper in that file was removed. The dispatch file's own getter cases are unchanged.
- **Files modified:** `tests/shared/notification-summary.test.ts`
- **Verification:** Direct coverage for notification-summary.ts passes.
- **Committed in:** `37a79818`

**5. [Rule 1 - Stale prose] Comments naming deleted or moved symbols outside the listed files**
- **Found during:** Task 2
- **Issue:** Two comments in `tests/architecture/catalog-uat/fixtures/plugin-update.ts` named `composeTally`. The header of `notify-context.ts` placed `emitContextCascade` in `notification-summary.ts`, but it lives in `notification-dispatch.ts`.
- **Fix:** Restated each claim as it now holds.
- **Files modified:** `tests/architecture/catalog-uat/fixtures/plugin-update.ts`, `extensions/pi-claude-marketplace/shared/notify-context.ts`
- **Committed in:** `580f6879`

---

**Total deviations:** 5 (1 blocking, 2 bugs or stale claims, 1 coverage, 1 plan-wording adjustment).
**Impact on plan:** No scope change. Each fix keeps a gate green or a comment true, and the corpus shows no byte change.

## Issues Encountered

- The first corpus check after Task 1 exited 1. The contract pins had moved, so `unused-type-member-gate.test.ts` failed with an empty report. Repinning the contracts fixed it, and the next check passed.

## Verification

- `node scripts/notify-corpus.mjs check`: `Notify corpus check passed: 2622 baseline entries present, 0 extra.` (exit 0, after each task)
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty (exit 0)
- `tests/architecture/catalog-uat/catalog-contract.test.ts`: passes, 205 exact documented states
- Direct coverage passed for notification-resolve.ts (35/35 branches), notification-summary.ts (101/101), notification-grammar.ts (217/217), notification-dispatch.ts (45/45), and notify-context.ts (18/18)
- `npm run lint:type-members`: passed with the 4 recorded exceptions; every envelope member has a production read
- `npm run check`, run unpiped and logged: `CHECK_EXIT=0`. The unit suite ran 7279/7279 and the integration suite 36/36.
- `rg -n "composeTally|foldTallyAndHint|RELOAD_HINT_TRAILER|UPDATE_NO_OP_HEADLINE"` over notification-summary.ts and notification-dispatch.ts: no match. `const RELOAD_HINT_TRAILER|const UPDATE_NO_OP_HEADLINE` in notification-grammar.ts: exactly 2 lines.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

`notification-resolve.ts` is ready for the later plans to add row facts, markers, and failure detail. When a plan adds an envelope member, it must also add a production read in `formatNotificationText` or dispatch, or `lint:type-members` fails. Any new `message.kind` read in `resolveEnvelope` must come after `resolveAttention`, or the two dispatch getter cases change bytes.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/notification-resolve.ts` and `tests/shared/notification-resolve.test.ts` exist.
- Commits `37a79818` and `580f6879` exist on `features/json`.

---
*Phase: 01-presentation-model*
*Completed: 2026-09-29*
