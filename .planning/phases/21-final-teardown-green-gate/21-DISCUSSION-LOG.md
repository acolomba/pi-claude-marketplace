# Phase 21: Final Teardown & GREEN Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 21-Final Teardown & GREEN Gate
**Areas discussed:** shared/grammar/ retention scope; Orphaned presentation/* deletion scope + minor cleanups; no-legacy-markers.test.ts update strategy (SNM-28); Plan/wave structure & atomicity

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| shared/grammar/ retention scope | SNM-29 explicit deferral. Aggressive inline vs migration trim vs strict trim. | ✓ |
| Orphaned presentation/* deletion scope + minor cleanups | Strict-orphan vs V1-grammar purge vs full clean-sweep, plus edge/args-schema rename + barrel cleanup. | ✓ |
| no-legacy-markers.test.ts update strategy (SNM-28) | Keep + prune ALLOW_LIST vs keep + expand block list vs delete entirely. | ✓ |
| Plan/wave structure & atomicity | 1 mega-plan vs 3-plan vs 5-plan. | ✓ |

**User's choice:** All four areas selected.

---

## shared/grammar/ retention scope

| Option | Description | Selected |
|--------|-------------|----------|
| Strict trim (low-disruption) | DELETE markers.ts + pattern-classes.ts (zero callers). RETAIN reasons.ts + status-tokens.ts as the canonical enum source. Orchestrators keep importing Reason from shared/grammar/reasons.ts. Tightest diff (2 deletes + 0 source changes). Closes SNM-29 via 'retained as enum source' arm. | |
| Migration trim (clean public surface) | DELETE markers.ts + pattern-classes.ts. RETAIN reasons.ts + status-tokens.ts as SoT but ADD StatusToken re-export to shared/notify.ts. Migrate ~10 import sites in orchestrators + compact-line.ts to import Reason/StatusToken from shared/notify.ts. Realizes the Phase 16 'single import surface' comment. | |
| Aggressive inline (max consolidation) | Inline REASONS const + Reason type + STATUS_TOKENS + StatusToken directly into shared/notify.ts. DELETE shared/grammar/ entirely. ~80 lines into shared/notify.ts (already ~1175 lines); 4 file deletes; all consumers migrate. Maximum single-source-of-truth at the cost of notify.ts size. | ✓ |

**User's choice:** Aggressive inline.
**Notes:** Locks D-21-01. The Phase 16 design comment at `shared/notify.ts:9-13` already signaled this destination; the aggressive arm finishes the journey. `pattern-classes` and `markers` are zero-caller orphans but their closed-set declarations are inlined anyway to preserve the v1.4 type-surface documentation.

---

## Orphaned presentation/* deletion scope + minor cleanups

| Option | Description | Selected |
|--------|-------------|----------|
| Strict-orphan (smallest blast radius) | Delete only the 6 fully-orphaned V1 composers (cascade-summary, manual-recovery, rollback-partial, version-arrow, soft-dep, reload-hint) + their tests. KEEP compact-line, plugin-list, cause-chain, sort, marketplace-list, index.ts (scrubbed barrel). Defer minor cleanups. | |
| V1-grammar purge (Recommended) | Strict-orphan PLUS: delete compact-line.ts (move EntityErrorRow type to install.ts); delete plugin-list.ts (chain); delete cause-chain.ts (inline composeErrorWithCauseChain into shared/errors.ts). FOLD edge/args-schema callback rename + barrel scrub + README cleanup. | |
| Full clean-sweep (max consolidation) | V1-grammar purge PLUS: move sourceLogical + ParsedSource to domain/source.ts; inline renderMarketplaceList into orchestrators/marketplace/list.ts; inline compareByNameThenScope into shared/notify.ts. DELETE presentation/ directory entirely. Mirrors the 'aggressive inline' shared/grammar/ choice. | ✓ |

**User's choice:** Full clean-sweep.
**Notes:** Locks D-21-02. `presentation/` directory is deleted entirely. The 5 relocations move each utility to its natural home (domain primitives → `domain/`, error helpers → `shared/errors.ts`, comparator → `shared/notify.ts`, install-specific type → `install.ts`, single-caller helper → inlined). Mirrors the D-21-01 aggressive consolidation. `tests/presentation/` directory deleted entirely (11 test files); behavioral coverage migrates to the V2 surface tests (`notify-v2.test.ts`, `catalog-uat.test.ts`) plus targeted migration of `sourceLogical` / `composeErrorWithCauseChain` assertions if not already covered in `tests/domain/source.test.ts` / `tests/shared/errors.test.ts` (planner verifies during research).

---

## no-legacy-markers.test.ts update strategy (SNM-28)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep + prune ALLOW_LIST (Recommended) | Retain the test and its 5 ES-5 literal block-list as a static-audit defense-in-depth gate for the codebase's lifetime. Prune ALLOW_LIST entries for the deleted tests/lint-rules/* files. Refresh top-of-file comments for v2 vocabulary. | |
| Keep + expand block list | Retain the 5 ES-5 literals AND add additional v1-era anchor literals (notifySuccess(, notifyWarning(, notifyError(, V1 3-arg notifyUsageError syntactic patterns) as raw-text blocks. Mostly redundant with type system but catches comment-block regressions. | |
| Delete entirely | Closed-set type encoding (PluginStatus, MarketplaceStatus, Reason) makes ES-5 marker reintroduction structurally impossible -- the test becomes redundant. SNM-28's deletion arm. Smallest test surface. | ✓ |

**User's choice:** Delete entirely.
**Notes:** Locks D-21-03. Tradeoff acknowledged in CONTEXT.md: the static byte-grep would still catch raw-string regressions in comment blocks, but after Phase 21 there are NO `console.log` callsites in extension code (lint-blocked by BLOCK A's `no-console: "error"` + per-file override allowing only `persistence/migrate.ts` `console.warn`). The grep-defense was a v1.3 transitional gate; closing it for v1.4 is consistent with the rest of the teardown.

---

## Plan/wave structure & atomicity

| Option | Description | Selected |
|--------|-------------|----------|
| Single mega-plan (1 plan, 1 atomic commit) | Everything in one massive atomic teardown commit. Maximum atomicity, very large diff (~80+ files), painful to review or revert. | |
| 3-plan (Recommended): infra-teardown / source-consolidation / gate | Plan 21-01: ESLint + MSG-* + static-audit teardown (atomic). Plan 21-02: source consolidation -- V1 wrappers deleted + shared/grammar inlined + presentation/ clean-sweep + edge/args-schema rename. Plan 21-03: final npm run check GREEN gate + closure. | ✓ |
| 5-plan (finest granularity) | 21-01: ESLint + MSG-* + static-audit. 21-02: V1 wrapper deletion. 21-03: shared/grammar aggressive inline. 21-04: presentation/ clean-sweep. 21-05: misc cleanups + final GREEN gate. Each plan reviewable in isolation; W2 plans serialize on shared/notify.ts. | |

**User's choice:** 3-plan structure.
**Notes:** Locks D-21-06. Plan 21-01 is independent infra (config + rule files); Plan 21-02 is the dense source-consolidation atomic commit centered on `shared/notify.ts`; Plan 21-03 is verification-and-closure (npm run check GREEN + CHANGELOG + STATE.md / PROJECT.md / REQUIREMENTS.md closure entries). Planner retains discretion to sub-split Plan 21-02 if the diff is genuinely unreviewable, but the recommended default is one atomic commit because the cross-file dependencies are dense (D-21-08).

---

## Claude's Discretion

The planner has flexibility on (per D-21-07 + 21-08 + scattered notes in CONTEXT.md `<decisions>` section):

- Internal `shared/notify.ts` layout (where to place the inlined REASONS / STATUS_TOKENS / MARKERS / PATTERN_CLASSES declarations).
- Whether `composeErrorWithCauseChain` stays as exported named function or gets inlined into its 3 callers after the move to `shared/errors.ts`.
- `MarketplaceListEntry` interface placement in `orchestrators/marketplace/list.ts` (file-local vs exported).
- CHANGELOG entry phrasing for Plan 21-03.
- Whether Plan 21-02 stays as ONE atomic commit (recommended default) or splits into 21-02a/b/c if the diff is genuinely unreviewable.
- `tests/architecture/markers-snapshot.test.ts` review (orthogonal to SNM-28; expected to remain GREEN with no changes).
- Test-count accounting in Plan 21-03 SUMMARY.md.

## Deferred Ideas

- `shared/markers.ts` future cleanup (still actively used by production; orthogonal to Phase 21).
- `docs/messaging-style-guide.md` post-v1.4 review (doc-only update; backlog).
- `docs/output-catalog.md` per-command usage-error fixtures (explicitly REJECTED in Phase 20 D-20-04 for v1.4).
- Test-helper extraction for `makeCtx()` (cosmetic refactor; carried backlog from Phase 18 / 19 / 20).
- Branded `Version` type with `hash-<12hex>` / semver validation (carried backlog from Phase 15/16).
- Type-model amendments for top-level cause-bearing failure shape (explicitly REJECTED for v1.4).
- v1.5 milestone planning (not part of Phase 21; would be a fresh `/gsd-new-milestone` cycle).
