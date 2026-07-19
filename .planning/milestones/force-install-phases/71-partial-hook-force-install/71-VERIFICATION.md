---
phase: 71-partial-hook-force-install
verified: 2026-06-28T22:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
deferred:
  - truth: "No-force install failure row renders {unsupported hooks} (full RSTATE-05 cross-surface parity)"
    addressed_in: "Future phase (post-71)"
    evidence: "Acknowledged in 71-04-SUMMARY.md key-decisions and logged to deferred-items.md; PHOOK-05 only requires {unsupported hooks} identical across list and info (both verified); SEV-02 block+hint is satisfied; fixing the failure-row token requires threading typed unsupported[] into requireInstallable's thrown reasons -- a resolver-gate change beyond this phase"
---

# Phase 71: Partial Hook Force-Install Verification Report

**Phase Goal:** A plugin whose `hooks.json` parses but contains unsupportable hooks (non-bucket-A events, or unsupported matchers on supported events) becomes `unsupported` (force-installable) instead of `unavailable`. `--force` installs the plugin's supported components AND the supportable hook handlers, dropping only the unsupportable ones; genuinely malformed configs (bad JSON, malformed handlers) still resolve `unavailable`.
**Verified:** 2026-06-28T22:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `checkMatcherSupportability` partitions at event-level AND matcher-level (non-bucket-A events dropped whole; unsupported matchers within a supported event dropped individually) | VERIFIED | `partitionHooks` in `hooks.ts:934` accumulates into `DroppedHook[]`; `partitionEventGroups` handles P1 (event) and P2-P5 (group); `partitionGroupHandlers` handles P6 (handler); sibling groups survive (D-71-02). `checkMatcherSupportability` is fully replaced and no longer exists as a callable function. |
| 2 | A plugin with at least one unsupportable hook but no structural defect resolves `unsupported` (force-degradable), not `unavailable` | VERIFIED | `applyHooksConfig` (`resolver.ts:860`): structural `!ok` arm unchanged (returns true); supportability arm pushes `"hooks"` to `partial.unsupported` and sets `partial.droppedHooks`, returns false. `decideResolution`'s existing `partial.unsupported.length > 0` branch fires automatically. Resolver-strict tests confirm. |
| 3 | Genuinely malformed `hooks.json` (unparseable JSON, `type:"command"` with no `command`) still resolves `unavailable` | VERIFIED | `parseHooksConfig` S1 (JSON.parse) and S2 (HOOKS_VALIDATOR.Check) arms return `{ok:false}` unchanged (`hooks.ts:395-405`). X1 table-desync raises `HooksTableDesyncError` caught at `hooks.ts:422-426` returning `{ok:false}`. Structural arm in `applyHooksConfig` routes those to `partial.notes + return true` (dirty accumulator). |
| 4 | `install --force` materializes a FILTERED `hooks.json` with only supportable handlers; dropped handlers never staged | VERIFIED | Bridge stages `parseHooksConfig.value` (the pure filtered subset). PHOOK-04 install tests read the written file: `PostToolUse` present, `Stop` absent (event-level drop test); `Edit` group present, `.*` regex group absent (matcher-mix test). No source change to `install.ts` / `stage.ts`. |
| 5 | `{unsupported hooks}` renders identically across `list` and `info`; no-force still blocks with `--force` hint | VERIFIED | `narrowUnsupportedKinds` third arm (`probe-classifiers.ts:167`) maps `"hooks"` -> `"unsupported hooks"` (existing REASONS member, count stays 32). `list.test.ts:569` asserts `◉ hookplug v1.0.0 (force-installed) {unsupported hooks}`. `install.test.ts:2444-2457` asserts no-force blocks at `error` severity with `--force` hint. `info.ts` strict reader merges supported + dropped entries (line 381). |

**Score:** 5/5 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases or explicitly deferred with documentation.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | No-force install failure row renders `{unsupported source}` instead of `{unsupported hooks}` | Future phase (post-71) | Logged in `deferred-items.md`; SEV-02 contract (block + `--force` hint) is satisfied; parity gap exists only on the failure path composer which reads the structural `notes` path, not the typed `unsupported[]` list |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/components/hooks.ts` | `DroppedHook` union, `HooksPartition` type, `partitionHooks` function, widened `HookConfigParseResult` ok-arm | VERIFIED | `DroppedHook` (lines 303-311), `HooksPartition` (321-324), `partitionHooks` (934), ok-arm carries `value: HooksConfig` + `dropped: readonly DroppedHook[]` (338-345); `ifPredicates` built over `partition.supported` (440-442) |
| `tests/fixtures/hooks-stop-only.json` | Empty-subset edge fixture (Stop event only) | VERIFIED | File exists on disk |
| `tests/fixtures/hooks-posttooluse-and-stop.json` | Event-level partial fixture | VERIFIED | File exists on disk |
| `tests/fixtures/hooks-pretooluse-matcher-mix.json` | Intra-event matcher-group partition fixture | VERIFIED | File exists on disk |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | `applyHooksConfig` split, `PartialResolution.droppedHooks`, arm spreads | VERIFIED | Three-way verdict at lines 866-903; `droppedHooks` on `PartialResolution` (294); spread into `installable()` (337) and `unsupported()` (359); Q2 gate at line 887 |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | `narrowUnsupportedKinds` third case `hooks` -> `unsupported hooks` | VERIFIED | Line 167: `return "unsupported hooks"` for `kind === "hooks"`; widened return union at line 153; REASONS unchanged at 32 entries |
| `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` | `appendHooksBlock` matcher-group `(unsupported)` rendering; optional `matcher` on lenient arm | VERIFIED | `HookSummaryEntry` lenient arm carries `matcher?: string` (line 77); `appendHooksBlock` renders `event(matcher) (unsupported)` when matcher present, `event (unsupported)` when absent (lines 111-112) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | Strict reader carries dropped-handler enumeration | VERIFIED | `projectDroppedHookEntries` (line 315-335) produces lenient entries; `readHookSummaryEntries` returns `[...supported, ...dropped]` (line 381) |
| `docs/output-catalog.md` | `force-installed-inventory-hooks` catalog block | VERIFIED | Line 344: `◉ hook-plugin v1.0.0 (force-installed) {unsupported hooks}` with correct prose describing the partial-hook degrade |
| `tests/architecture/catalog-uat.test.ts` | Matching byte-driver fixture for `force-installed-inventory-hooks` | VERIFIED | Line 700: `"force-installed-inventory-hooks"` entry with Q3 audit comment |
| `tests/orchestrators/plugin/install.test.ts` | PHOOK-04 strict-subset staging + SEV-01/SEV-02 coverage | VERIFIED | Lines 2304 (event-level drop), 2354 (matcher-mix drop), 2432-2497 (no-force blocks + force-degrade info) |
| `tests/orchestrators/plugin/list.test.ts` | Force-installed partial-hook row renders aggregate `{unsupported hooks}` | VERIFIED | Line 569: asserts `◉ hookplug v1.0.0 (force-installed) {unsupported hooks}` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `parseHooksConfig` | `partitionHooks` | success-arm call after `HOOKS_VALIDATOR.Check` | VERIFIED | `hooks.ts:418-421`: `partition = partitionHooks(candidate)` in the success path |
| `applyHooksConfig` | `partial.unsupported` | push `"hooks"` when `dropped.length > 0` | VERIFIED | `resolver.ts:879`: `partial.unsupported.push("hooks")` gated on `hooksResult.dropped.length > 0` |
| `decideResolution` | `unsupported()` | `partial.unsupported.length > 0` (unchanged routing) | VERIFIED | No change to `decideResolution` needed; the existing branch fires automatically |
| `install --force` partial-hook | staged `hooks.json` | `writeHookConfig` stages `parseHooksConfig.value` (filtered subset) | VERIFIED | Bridge re-parses at materialize time; `parseHooksConfig.value` is the pure filtered subset; PHOOK-04 test reads staged file and asserts strict subset |
| `info.ts readHookSummaryEntries` (strict) | `appendHooksBlock` dropped arm | merge `droppedHooks` into projected entries via `projectDroppedHookEntries` | VERIFIED | `info.ts:379-381`: `const supported = projectHookSummaryEntries(parsed.value); const dropped = projectDroppedHookEntries(parsed.dropped); return [...supported, ...dropped]` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `applyHooksConfig` | `hooksResult.dropped` | `readStandaloneHooks` -> `parseHooksConfig` -> `partitionHooks` | Yes: accumulates `DroppedHook[]` over real config events | FLOWING |
| `projectDroppedHookEntries` | `dropped: readonly DroppedHook[]` | Propagated from `parseHooksConfig.dropped` via strict reader | Yes: produces one `HookSummaryEntry` per unique (event, matcher) drop | FLOWING |
| staged `hooks.json` | `parseHooksConfig.value` | `partitionHooks.supported` (pure projection) | Yes: real filtered `HooksConfig` subset written to disk | FLOWING |

### Behavioral Spot-Checks

Step 7b SKIPPED for runnable-server checks (tests must be driven with `node --test`). The orchestrator confirmed the full `npm run check` is GREEN independently (2489 unit pass / 0 fail, 16/16 integration). OUT-08 test asserting `REASONS.length === 32` confirmed passing via `notify-closed-set-locks.test.ts:29-30`.

### Probe Execution

Step 7c: No probe scripts declared in phase plans; no `scripts/*/tests/probe-*.sh` files found for this phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PHOOK-01 | 71-01 | `checkMatcherSupportability` partitions at event AND matcher level | SATISFIED | `partitionHooks` accumulates drops at P1/P2-P5/P6 granularity; three fixtures + migrated unit/arch tests pass |
| PHOOK-02 | 71-02 | Plugin with unsupportable hook resolves `unsupported` (not `unavailable`) | SATISFIED | `applyHooksConfig` routes to `partial.unsupported`; resolver-strict tests confirm `state === "unsupported"` for all three degradable fixtures |
| PHOOK-03 | 71-01, 71-02 | Structural precedence preserved -- malformed `hooks.json` still resolves `unavailable` | SATISFIED | S1/S2 arms in `parseHooksConfig` unchanged; X1 via `HooksTableDesyncError`; `applyHooksConfig` structural `!ok` arm unchanged; resolver-strict tests 174-205 retained |
| PHOOK-04 | 71-04 | `install --force` stages filtered `hooks.json`; dropped handlers never staged; no-force blocks | SATISFIED | PHOOK-04 tests read staged file bytes and assert dropped events/groups absent; no-force install asserts `error` severity + hint |
| PHOOK-05 | 71-03, 71-04 | `{unsupported hooks}` renders identically across `list` and `info` at correct severity | SATISFIED | `narrowUnsupportedKinds` third arm; REASONS count stays 32 (OUT-08 passes); list and info tests verify byte-identical `{unsupported hooks}` token; catalog-uat `force-installed-inventory-hooks` row GREEN |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No `TBD`/`FIXME`/`XXX` markers in any phase-modified source or test file | — | — |

**Code review findings addressed:**

- **WR-01** (P6 match-all group renders `event() (unsupported)`): Confirmed as **false positive**. `projectHookSummaryEntries` uses `group.matcher ?? ""` (line 287), so the supported side ALSO renders `event()` for match-all groups — the convention is consistent on both sides. Not a rendering defect.
- **WR-02** (T-71-04 planning-matrix IDs in resolver.ts comments): **Fixed** in commit `f0ed94ac`. Grep on `resolver.ts` for `T-71` returns no matches.
- **IN-01** (dead `droppedHooks` spread on `installable` arm): Harmless dead code; `droppedHooks` can only be set when `partial.unsupported` is non-empty, which routes to `unsupported()` not `installable()`. No correctness impact.
- **IN-02** (no-force failure renders `{unsupported source}`): Deferred with documentation. SEV-02 block + `--force` hint requirement is satisfied. See deferred items table above.

### Human Verification Required

None. All phase behaviors are mechanically verifiable:
- Resolver verdict routing: covered by resolver-strict unit tests
- Strict-subset staging: covered by PHOOK-04 install tests that read the written file
- Severity arms: covered by install.test.ts SEV-01/SEV-02 assertions
- Byte-exact token parity: covered by catalog-uat and notify-v2 suites

### Gaps Summary

None. All 5 roadmap success criteria and all PHOOK-01..05 requirements are verified against the codebase. The one documented deviation (no-force failure renders `{unsupported source}` instead of `{unsupported hooks}`) is intentionally deferred per `deferred-items.md` and does not violate any stated requirement — PHOOK-05 requires parity across `list` and `info` (both verified), and SEV-02 requires blocking with the `--force` hint (verified).

---

_Verified: 2026-06-28T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
