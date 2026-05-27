# Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 18-Migration Wave 1 -- Marketplace Orchestrator Family
**Areas discussed:** Plan granularity & ordering; V1 surfaces that don't map cleanly to V2; Existing orchestrator-test migration; MSG-* lint glob narrowing strategy

---

## Plan granularity & ordering

### Q1: How should Phase 18 be sliced into plans?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 per-file plans + 1 cleanup plan (Recommended) | Plans 18-01..05 each migrate one orchestrator file + its unit tests + drop now-orphaned presentation/* imports. Plan 18-06 narrows MSG-* lint globs and confirms catalog UAT GREEN. | ✓ |
| Grouped: 2 plans (simple vs cascade) + lint | Plan 18-01 migrates add/list/autoupdate; Plan 18-02 migrates remove/update; Plan 18-03 narrows lint. Fewer commits, but cascade complexity lands all at once. | |
| 1 monolithic plan | Single plan does all 5 orchestrators + tests + lint narrowing in one commit. Fastest but no atomicity. | |

**User's choice:** 5 per-file plans + 1 cleanup plan
**Notes:** Mirrors Phase 16's 6-plan / 6-wave pattern. Each commit isolates one orchestrator.

### Q2: How should the 5 per-file plans be ordered across waves?

| Option | Description | Selected |
|--------|-------------|----------|
| Pilot first: add.ts (W1), others parallel (W2), lint (W3) (Recommended) | Wave 1 pilots add.ts (simplest). Wave 2 parallelizes autoupdate/list/remove/update. Wave 3 lint narrowing. | ✓ |
| All 5 in parallel (W1), lint (W2) | Fastest path-to-green. Risk: 5 agents diverge on idioms. | |
| Complexity tiers: simple W1, cascade W2, lint W3 | Simple shapes first, cascade shape second. Mid-ground. | |

**User's choice:** Pilot first: add.ts (W1), others parallel (W2), lint (W3)
**Notes:** Pilot-first locks the V2 NotificationMessage construction pattern on the simplest case before parallelizing.

### Move-on check: More questions or next area?

User selected: **Next area** (Granularity decision is clear -- moving to V1 surfaces).

---

## V1 surfaces that don't map cleanly to V2

### Q1: marketplace remove post-state cleanup-leak warning -- drop, fold into primary, or second notify() call?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop entirely (D-17-09 precedent) (Recommended) | Catalog already drops V1's free-text retry-anchor trailer because it has no V2 representation. Same precedent: cleanup leaks aren't a user-facing surface in V2. | ✓ |
| Emit a SECOND notify() call after the primary | Doubles severity-routing; catalog has no fixture for this shape. | |
| Fold into primary as status: failed with cleanup-leak as cause | Misrepresents the operation (state mutation succeeded); cause invisible. | |

**User's choice:** Drop entirely (D-17-09 precedent)
**Notes:** Cleanup failures still emit via the underlying domain layer (returns error or logs); the user just doesn't see a separate warning. Captured as D-18-01.

### Q2: marketplace update mp-level failure retry-hint suffix -- drop or render via per-plugin shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop entirely (D-17-09 precedent) (Recommended) | Catalog has no shape for free-text retry hints on marketplace-level failures. retryHint dropped from user-visible surface; remains internal to the Error subclass. | ✓ |
| Surface via per-plugin manual-recovery row inside the failed mp block | No plugin available at mp-level failure; would fabricate synthetic plugin row. | |
| Compose retry-hint into the cause: Error message chain | Catalog says mp-level cause-chain not rendered anyway; effectively same as drop. | |

**User's choice:** Drop entirely (D-17-09 precedent)
**Notes:** Captured as D-18-02. retryHint field remains on the Error subclass for programmatic callers.

### Q3: marketplace autoupdate idempotent-flip + enable/disable distinction -- accept catalog '(updated)', amend upstream, or defer?

User initially asked for clarification on what `(updated)` meant in this context and where it came from in the V2 catalog/renderer. After review of `renderMpHeader` (5-arm switch) and the V2 catalog's autoupdate section, the user issued a direct design call: **"for autoupdate enable/disable, the status shouldn't be updated. it should be autoupdate enabled, autoupdate disabled, and skipped {already enabled} / {already disabled}"**. This requires amending upstream phases.

| Option | Description | Selected |
|--------|-------------|----------|
| Insert Phase 17.1 (V2 grammar amendment) before Phase 18 (Recommended) | /gsd-phase --insert adds 17.1 'V2 Grammar Amendment: Autoupdate Surface' amending Phase 15 types + Phase 16 renderer + Phase 17 catalog + ADR atomically. Phase 18 stays a pure execution wave. | ✓ |
| Widen Phase 18's scope to include the upstream amendments | Phase 18 adds 3 upstream-amendment plans + 5 migration plans + 1 lint plan. Phase 18 stops being a 'wave 1 migration'. | |
| Defer to v1.5 | Ship Phase 18 with V2 catalog as-is; restore distinctions later. Both directions render `(updated)`; idempotent invisible. | |

**User's choice:** Insert Phase 17.1 (V2 grammar amendment) before Phase 18
**Notes:** User-locked design captured as D-18-05. New MarketplaceStatus values: `"autoupdate enabled"`, `"autoupdate disabled"`, `"skipped"`. New REASONS: `"already enabled"`, `"already disabled"`. New optional `reasons?: readonly Reason[]` on MarketplaceNotificationMessage. Severity: failed → error; skipped → warning (consistent with plugin); fresh enable/disable → info. Reload-hint: fresh triggers; skipped does not. Captured as D-18-04 (insertion mechanic) + D-18-05 (design contract for Phase 17.1 to implement).

### Move-on check: More questions or next area?

User selected: **Next area** (cleanup-leak / retry-hint / autoupdate covered -- moving to test migration).

---

## Existing orchestrator-test migration

### Q1: What should orchestrator unit tests assert after V2 migration?

| Option | Description | Selected |
|--------|-------------|----------|
| Byte-exact assertions, updated in lockstep per plan (Recommended) | Each per-file plan rewrites byte assertions to V2 shape. Tests stay end-to-end through real notify(). Belt-and-braces with catalog UAT. | ✓ |
| Trim to behavior-only; catalog UAT owns byte shape | Drop byte-exact asserts; keep notification count, severity, state mutations, error types. Single source of truth for bytes; orchestrator-construction bugs may stay invisible. | |
| Hybrid: behavior + structured payload assertion | Mock notify() boundary; assert on NotificationMessage payload fields. Strong isolation; requires reworking mock pattern in every file. | |

**User's choice:** Byte-exact assertions, updated in lockstep per plan
**Notes:** Captured as D-18-06. The existing `makeCtx()` mock pattern (recording `{message, severity}` tuples) is preserved verbatim. The new byte strings come from the V2 catalog and tests/shared/notify-v2.test.ts per-variant fixtures.

### Move-on check: More questions or next area?

User selected: **Next area** (Test scope clear -- moving to MSG-* lint narrowing).

---

## MSG-* lint glob narrowing strategy

### Q1: How should MSG-Block 1 + 1b narrowing work?

| Option | Description | Selected |
|--------|-------------|----------|
| Add `ignores: ['orchestrators/marketplace/**']` to MSG-Block 1 + 1b (Recommended) | Smallest diff. files: stays unchanged; ignores entry added. Phase 19/20 extend additively. | ✓ |
| Replace `files:` with explicit allow-list enumeration | Makes the included set explicit but Phase 19/20 churn the list each time. | |
| Split MSG-Block 1 into per-family sub-blocks | Maximum visibility but over-engineered for what's essentially 'exclude this folder'. | |

**User's choice:** Add `ignores: ['orchestrators/marketplace/**']` to MSG-Block 1 + 1b
**Notes:** Captured as D-18-07. Additive narrowing: Phase 19 extends ignores with `orchestrators/plugin/**`; Phase 20 extends with `orchestrators/edge/**` (and removes Block 1b's edge/handlers entry); Phase 21 deletes the whole MSG-* plugin block. Other MSG-Blocks (2/3/4a/4b/5/6) need no Phase 18 modification.

### Move-on check: More questions or wrap up?

User selected: **Wrap up -- ready for context** (All four selected areas captured).

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` under "Claude's Discretion":

- File-mutation ordering within each per-file plan (orchestrator vs test first).
- Stale `shared.ts` comment cleanup timing (per-file plan, 18-06, or Phase 21).
- Whether pilot 18-01 adds an explicit construction-pattern comment for Wave 2 plans to follow.
- Whether to extract a shared mock-pi helper for the `getAllTools: () => []` pattern.
- Severity-tier assertion form (`assert.equal(note.severity, undefined)` vs helper).

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`:

- Phase 17.1 (V2 Grammar Amendment: Autoupdate Surface) -- inserted before Phase 18 lands.
- Phase 19 (Plugin family migration), Phase 20 (Edge + UsageError), Phase 21 (Final teardown).
- `orchestrators/marketplace/shared.ts` stale comment cleanup.
- `makeCtx()` + `pi.getAllTools` test-helper extraction (cosmetic).
- `tests/presentation/*.test.ts` deletion (deferred to Phase 21).
- JSON output mode for notifications (REQUIREMENTS.md backlog).
- Branded `Version` type with hash-12hex / semver validation (carried backlog).
