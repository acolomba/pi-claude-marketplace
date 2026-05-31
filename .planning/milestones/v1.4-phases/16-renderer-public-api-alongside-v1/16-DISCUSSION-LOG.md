# Phase 16: Renderer & Public API (Alongside V1) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 16-renderer-public-api-alongside-v1
**Areas discussed:** Pi-API access, Output grammar, Composer reuse, Test location, Spec authority, Cascade summary, UsageError signature, assertNever dispatch, Plugin sort, Marketplace sort, MP separator, Cause rendering, Reload-hint gate

---

## Pi-API access

| Option | Description | Selected |
|--------|-------------|----------|
| Add pi as 2nd arg: notify(ctx, pi, message) | Most natural; mirrors how orchestrators already pass pi separately. Requires amending SNM-12's literal signature in REQUIREMENTS.md + ADR. Probe is computed inline (softDepStatus(pi)); no module-level state. | ✓ |
| Module-level setPi(pi) at bootstrap; notify reads global | Keeps SNM-12 signature unchanged. Adds hidden global state in shared/notify.ts -- test isolation gets harder, parallel session safety dubious. Pi must be set exactly once. | |
| Inject probe via 3rd opts arg: notify(ctx, message, opts?: { probe?: SoftDepProbe }) | Keeps SNM-12 close (extension via opts). Mildly violates SNM-16 'no caller-supplied probe state' literal wording, but the spirit (renderer owns probing) holds when opts.probe is omitted in production and only tests inject it. | |

**User's choice:** Add `pi` as 2nd arg -- `notify(ctx, pi, message)`.
**Notes:** SNM-12 needs an editorial update to add `pi` to the literal signature. Captured as part of D-16-01.

---

## Output grammar

| Option | Description | Selected |
|--------|-------------|----------|
| V1 grammar -- single-plugin inline form | Phase 16 goal explicitly says 'byte-equal output to V1 callers when given equivalent payloads'. Catalog UAT byte-equality against V1 composers stays GREEN. | |
| v2 always-marketplace-header form already | Phase 16 emits the two-line form. Per-status unit tests assert v2 shape; catalog UAT still tests V1. Phase 17 becomes pure docs + UAT-migration. | ✓ |
| Both -- switch on a feature flag or payload field | Conditional emission introduces a flag-removal task in Phase 17. Adds complexity for no clear win. | |

**User's choice:** v2 always-marketplace-header form NOW (Phase 16 lands the new grammar in code).
**Notes:** Catalog UAT (testing V1 composers) stays GREEN because V1 callers route through V1 wrappers. The phase goal's "byte-equal to V1" wording is interpreted as a non-blocker because no V1 caller routes through `notify()` in Phase 16. Authority resolution covered in the next question.

---

## Composer reuse

| Option | Description | Selected |
|--------|-------------|----------|
| notify() calls existing presentation/* composers | Composers stay in place; notify() is a thin shape-adapter. Minimum code churn in Phase 16. | |
| Duplicate the grammar inside notify(); composers untouched | notify() implements the v2 grammar fresh (with its own assertNever switch). Composers untouched. Phase 21 deletes both V1 wrappers AND composers. Larger Phase 16 diff; cleaner SNM-17 'sole site' claim. | ✓ |
| Relocate composers into shared/notify/ subdir; re-export from presentation/ for V1 | File moves + import path updates across V1 callers and tests. Larger Phase 16 diff. | |

**User's choice:** Duplicate the grammar inside `notify()`; presentation/* composers untouched.
**Notes:** Bounded duplication window (Phase 16-20). Phase 21 deletes V1 wrappers AND composers together. Captured as D-16-04 / D-16-09.

---

## Test location

| Option | Description | Selected |
|--------|-------------|----------|
| tests/shared/notify-v2.test.ts | Mirrors existing tests/shared/notify.test.ts. Keeps V1 and V2 tests side-by-side; Phase 21 deletes notify.test.ts and renames notify-v2.test.ts → notify.test.ts. | ✓ |
| Extend tests/shared/notify.test.ts with V2 test blocks | Single file holds V1 + V2 tests. Risks file size growth. | |
| tests/architecture/notify-renderer.test.ts | tests/architecture/ historically holds 'gate' / drift / parity tests, not per-variant unit tests -- convention shift. | |

**User's choice:** `tests/shared/notify-v2.test.ts`.
**Notes:** Captured as D-16-16.

---

## Spec authority

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 16 sets the spec; Phase 17 ratifies it in docs | Per-status unit tests written in Phase 16 are the de facto spec. Phase 17's docs/output-catalog.md rewrite mirrors what Phase 16 shipped. Catalog UAT migration in Phase 17 is mechanical. | ✓ |
| Phase 17 catalog rewrite happens first, then Phase 16 implements it | Requires reordering phases (17 before 16). Cleanest separation but invalidates the current ROADMAP.md ordering. | |
| Phase 16 plan includes a mini-spec doc explicitly | Phase 16's PLAN.md contains an inline v2-grammar spec section. Phase 17 expands it to the full docs rewrite. | |

**User's choice:** Phase 16 sets the spec; Phase 17 ratifies it in docs.
**Notes:** Planner may opt to include a mini-spec section in PLAN.md (Claude's Discretion in CONTEXT.md). Captured as D-16-04 / D-16-18.

---

## Cascade summary

| Option | Description | Selected |
|--------|-------------|----------|
| No -- marketplace header + indented rows is the full output | v2 spec is uniform: every output renders marketplace header + indented plugin rows. Simpler grammar; aligns with PROJECT.md wording. | ✓ |
| Yes -- keep the cascade-summary line above the marketplace block | Multi-plugin payloads emit a summary line. Preserves V1's at-a-glance summary. Adds another grammar element to model. | |
| Yes for cascades ≥ N plugins, otherwise no | Threshold-based. Adds a tunable that needs a value picked. Adds branching to the renderer. | |

**User's choice:** No cascade-summary line.
**Notes:** Severity routing replaces the at-a-glance summary. Captured as D-16-05.

---

## UsageError signature

| Option | Description | Selected |
|--------|-------------|----------|
| notifyUsageError(ctx, message: UsageErrorMessage) -- no pi | UsageErrorMessage has no plugin rows / dependencies / soft-dep probes -- no need for pi. Keeps SNM-13 signature as written. | ✓ |
| notifyUsageError(ctx, pi, message) -- symmetric with notify() | Always pass pi. Consistent call-site shape across the V2 surface. Mildly amends SNM-13. | |

**User's choice:** `notifyUsageError(ctx, message: UsageErrorMessage)` -- no pi.
**Notes:** Captured as D-16-02.

---

## assertNever dispatch

| Option | Description | Selected |
|--------|-------------|----------|
| Two nested switches with one assertNever each | Outer `switch (marketplace.status)` (4 + undefined); inner `switch (plugin.status)` (10) inside a per-plugin loop. Two `default: assertNever(...)` calls. Most readable. | ✓ |
| One combined dispatch table keyed by stringified discriminator | Single Record<MpStatus|PluginStatus, fn>. More terse but mixes concerns. Less idiomatic. | |
| Two file-private helpers, each its own assertNever switch | Same as (1) but helpers extracted at module scope. Easier unit-test seams. | |

**User's choice:** Two nested switches with one `assertNever` each (interpreted as two file-private helpers `renderMpHeader` / `renderPluginRow` at module scope per the preview shown -- both wordings describe the same structure).
**Notes:** User initially asked for clarification on what `assertNever` is; explanation provided and re-asked. Captured as D-16-09.

---

## Plugin sort

| Option | Description | Selected |
|--------|-------------|----------|
| Caller-supplied order (notify() doesn't sort) | notify() iterates marketplace.plugins[] in caller order. Caller is responsible for sorting via compareByNameThenScope if desired. | ✓ |
| notify() sorts by name (then scope when orphan-folded) | notify() re-sorts plugins via compareByNameThenScope. Stable across all surfaces. Loses caller control. | |
| notify() sorts by status group, then by name within group | Failed/manual-recovery first, then skipped, then installed/updated/uninstalled, then available/unavailable/upgradable. Likely overfitting Phase 16. | |

**User's choice:** Caller-supplied order.
**Notes:** Captured as D-16-06.

---

## Marketplace sort

| Option | Description | Selected |
|--------|-------------|----------|
| Caller-supplied order (notify() doesn't sort) | Symmetric with the plugin-sort decision. Callers can sort by name, by scope, or interleave however the command surface demands. | ✓ |
| notify() sorts by name (scope as tiebreaker) | Stable. Locks one canonical ordering. Removes caller responsibility. | |
| notify() groups by scope (user marketplaces, then project), then by name | Mirrors v1.3's per-scope rendering pattern. Adds another piece of grammar. | |

**User's choice:** Caller-supplied order.
**Notes:** Captured as D-16-06 (same decision as plugin sort).

---

## MP separator

| Option | Description | Selected |
|--------|-------------|----------|
| Single blank line between marketplaces | `...indented rows...\n\n● next-marketplace [scope]\n  ...`. Standard Markdown/CLI convention. Reload-hint trailer appends after one more blank line. | ✓ |
| No separator -- marketplaces stack directly | More compact but visually harder to scan when 3+ marketplaces appear. | |
| Horizontal divider line between marketplaces | Adds a vocabulary element to the v2 spec; not aligned with v1.3 visual style. | |

**User's choice:** Single blank line between marketplaces.
**Notes:** Captured as D-16-07.

---

## Cause rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Indented cause chain immediately after the failing plugin row | After the plugin row, render the depth-5 causeChainTrailer(cause) indented to align with the row text. Each failed/manual-recovery plugin gets its own cause block in place. Retires v1.3's single top-level cause trailer (SNM-10). | ✓ |
| All cause chains aggregated at the bottom of the output | Plugin rows emit just the failure marker; a bottom section lists causes. Closer to v1.3's shape but loses the visual co-location SNM-10 was designing toward. | |
| Cause appended as a single-line tail of the plugin row | Compact but loses the depth-5 walk's value. | |

**User's choice:** Indented cause chain immediately after the failing plugin row (4-space indent, one level deeper than the 2-space plugin row indent).
**Notes:** Captured as D-16-08.

---

## Reload-hint gate

| Option | Description | Selected |
|--------|-------------|----------|
| Only on success-class statuses (added/removed/updated) | Reload-hint fires when marketplace.status ∈ {added, removed, updated} OR any plugin status ∈ {installed, updated, reinstalled, uninstalled}. Marketplace 'failed' does NOT trigger hint. | ✓ |
| Any marketplace status set, including failed (literal SNM-15 reading) | Reload-hint fires whenever marketplace.status is set, even when failed. Users see '/reload to pick up changes' under failed marketplace headers -- may be confusing. | |
| Also when failed has rollbackPartial (state really changed) | Hint fires on success-class statuses AND on plugin failed-with-rollbackPartial. Most semantically precise but requires walking the payload tree for rollbackPartial[] presence. | |

**User's choice:** Only on success-class statuses.
**Notes:** SNM-15 needs an editorial refinement to say "any state-changing marketplace status set" rather than "any marketplace status set". Captured as D-16-12; flagged for the planner.

---

## Claude's Discretion

Decisions deferred to the planner (recorded in CONTEXT.md `<decisions>` → "Claude's Discretion"):

- Exact byte form of the v2 grammar for each variant (anchored by D-16-04..D-16-15; planner reads V1's `presentation/compact-line.ts::renderRow` for compatibility ergonomics).
- Exact rendering of orphan-fold `scope?` on plugin rows (anchored by SNM-11 + MSG-PL-6; planner decides bracket placement).
- Exact rendering of empty `marketplaces: []` and empty `plugins: []` (anchored by D-15-08 / D-15-09; planner picks bytes).
- Whether to import `causeChainTrailer` from `presentation/cause-chain.ts` or from `shared/errors.ts` directly (both work; D-11 layering allows either).
- Whether to factor `renderPluginRow` further into per-variant helpers, or keep all 10 cases inline in the switch.
- Mini-spec section in PLAN.md vs. annotated test file as Phase 17's authority source.
- Whether the SNM-12 / SNM-15 REQUIREMENTS.md edits (per D-16-01 / D-16-12) land as a separate plan in Phase 16, or as a docs-only commit inside the renderer plan.

## Deferred Ideas

Ideas captured in CONTEXT.md `<deferred>`:

- Migrating any orchestrator or edge call site to `notify()` -- Phases 18 / 19 / 20.
- Deleting V1 wrappers, MSG-* lint rules, `presentation/*` composers -- Phase 21 final teardown.
- Rewriting `docs/messaging-style-guide.md` v1.0 → v2.0 -- Phase 17 (SNM-19).
- Rewriting `docs/output-catalog.md` to always-marketplace-header form -- Phase 17 (SNM-20).
- Migrating `tests/architecture/catalog-uat.test.ts` to drive `notify()` via structured fixtures -- Phase 17 (SNM-31).
- Splitting `notify()`'s internal helpers into multiple files under `shared/notify/` -- Phase 21 (if file size warrants).
- Removing the grammar duplication via a `presentation/* → shared/notify` import -- Phase 21 (when V1 wrappers and composers are deleted together).
- Pruning `Reason` to a v1.4-active subset -- Phase 21 (alongside the `shared/grammar/` retire-or-keep decision per SNM-29).
- Branded `Version` type with `hash-<12hex>` / semver validation -- Carried over from Phase 15; backlog.
- JSON output mode for notifications -- REQUIREMENTS.md "Out of Scope"; backlog.
