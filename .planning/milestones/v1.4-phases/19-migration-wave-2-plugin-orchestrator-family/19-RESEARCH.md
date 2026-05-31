# Phase 19: Migration Wave 2 -- Plugin Orchestrator Family - Research

**Researched:** 2026-05-27
**Domain:** V1->V2 notify migration for the 5 plugin orchestrator files (uninstall, install, list, reinstall, update)
**Confidence:** HIGH

## Summary

This is a verification-focused research pass for an execution-only migration phase. CONTEXT.md is exhaustively detailed (245 lines, 8 locked decisions D-19-01..08, all callsite line numbers cited). The research goal was not to design but to confirm that the line numbers, code shapes, and runtime state assumed by CONTEXT.md still hold today (post-Phase-18 landing on 2026-05-27) and to surface any gaps the planner must account for.

Every V1 callsite line number in CONTEXT.md `<canonical_refs>` "Source files Phase 19 modifies" was verified against the current source. The `RollbackPartial` ledger shape was identified. The eslint MSG-Block 1 / 1b ignores entries were confirmed at lines 160 + 185. The catalog UAT baseline is GREEN. The `makeCtx()` mock pattern in all 5 plugin orchestrator tests is consistent with the Phase 18 marketplace test precedent. The Phase 18 pilot recipe block-comment was captured verbatim from add.ts:160-169.

**Primary recommendation:** Plan as written in CONTEXT.md -- all 8 locked decisions are grounded in confirmed code state. Two findings need surface in the per-file plans: (1) the `RollbackPartial` ledger already carries `cause?: Error` (a real Error, not just `msg: string`) so D-19-03's caveat is resolved in the simpler direction -- the V2 payload can thread `p.cause` directly without synthesizing `new Error(p.msg)`; (2) CONTEXT.md D-19-02 misattributes lines 227/254/783 to `install.ts` -- those lines are actually `update.ts` direct-path failure callsites. install.ts's actual failure-emission lines are 682/700.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-19-01 (DROP post-success "soft warnings"):** All 9 post-success secondary `notifyWarning` emissions across the 5 plugin orchestrators are DROPPED entirely:
- install.ts standalone-mode: mkdir failure (718), dropMarketplaceCache failure (733), agentForeignFailures (750), bridgeWarnings loop (761), PI-13 deps note (808)
- list.ts: PROBE_FAILURES summary (777)
- reinstall.ts: bridgeWarnings (233), maintenanceWarnings (237)
- update.ts: direct-path completion-cache-refresh warning (844)

Precedent: Phase 18 D-18-01 dropped `marketplace/remove.ts`'s cleanup-leak warning on the same basis. Information stays observable via internal return values (`InstallOutcome.postCommitWarnings` for orchestrated callers; `ReinstallPluginOutcome.notes`; per-row `(unavailable)` status in list).

**D-19-02 (INLINE cascade construction, no composer modifications):** Each of install/reinstall/update builds its V2 cascade payload INLINE -- a `plugins: readonly PluginNotificationMessage[]` array wrapped in `marketplaces: [{ name, scope, plugins }]`, passed to a single `notify(ctx, pi, message)`. `presentation/cascade-summary.ts` is NOT modified in Phase 19; it stays alive because `orchestrators/import/execute.ts:399` still imports it (Phase 20 migrates import; Phase 21 deletes the composer). V1 dispatch ternary (`const dispatch = aggregatedSeverity === "warning" ? notifyWarning : notifySuccess`) is REMOVED; `notify()`'s content-derived severity (D-16-11) replaces it.

Inline-construction call sites:
- reinstall.ts:496 (main cascade), reinstall.ts:1313 (single-row cascade)
- update.ts:929 (main cascade)
- install.ts has NO cascadeSummary calls -- it produces standalone-mode single-plugin emissions only (see Finding 2 below)

Manual-recovery anchor in reinstall.ts becomes a `PluginManualRecoveryMessage` entry in the same `plugins[]` array -- not a separate top-level emission. Severity routing via `computeSeverity` classifies a manual-recovery row as `warning` per D-16-11.

**D-19-03 (install.ts rollback-partial composer RETIRED entirely):** `composeRollbackPartialBody` (install.ts:844-881) is RETIRED. V2 `PluginFailedMessage` carries `cause?: Error` + `rollbackPartial?: readonly { phase: string; cause?: Error }[]` structurally (SNM-09 + SNM-10). The orchestrator constructs `PluginFailedMessage` INLINE per error class:
- Rollback partials present: `reasons: ["rollback partial"] as const`, `cause: err` (when Error), `rollbackPartial: failureRollbackPartials.map((p) => ({ phase: p.phase, cause: p.cause }))`
- Entity-shape error: `reasons: [<classified reasons[]>]`, `cause: err`, no `rollbackPartial`. `classifyEntityShapeError` STAYS, returns `Reason[]` directly into `PluginFailedMessage.reasons`
- Generic runtime: `reasons: [<single closest reason>]` or empty, `cause: err`, no `rollbackPartial`

**D-19-04..06 (Plan granularity & wave structure):** 6 plans, 3 waves.
- Wave 1: 19-01 (uninstall.ts pilot)
- Wave 2: 19-02..05 (install.ts, list.ts, reinstall.ts, update.ts) in parallel
- Wave 3: 19-06 (lint narrowing + final catalog UAT)

Wave-2 parallelism is safe -- each plan touches disjoint file pair `orchestrators/plugin/<file>.ts` + `tests/orchestrators/plugin/<file>.test.ts`. Plan 19-06 alone touches `eslint.config.js`.

**D-19-07 (Test discipline -- inherits D-18-06):** Each per-file plan (19-01..05) updates `tests/orchestrators/plugin/<file>.test.ts` IN LOCKSTEP. Tests stay END-TO-END through real `notify()` via mock `ctx`; the existing `makeCtx()` pattern recording `{ message, severity }` tuples is preserved verbatim. Byte-exact `assert.equal(note.message, "<V2 byte string>")` assertions are rewritten from V1 to V2. Behavior assertions stay. Tests are NOT factored to a shared notify-fixture module (deferred to Phase 21 cleanup).

**Test count consequence of D-19-01:** assertions verifying post-success warnings (e.g. `assert.equal(notifications.length, 2)`) are rewritten to expect a SINGLE notification per orchestration. Tests targeting a dropped warning's content are DELETED outright.

**D-19-08 (MSG-* lint narrowing -- inherits D-18-07):** Plan 19-06 extends ONLY the existing additive `ignores: [...]` entry on MSG-Block 1 (line 160) and MSG-Block 1b (line 185). Current value (Phase 18): `["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]`. Plan 19-06 ADDS `"extensions/pi-claude-marketplace/orchestrators/plugin/**"`. Resulting array: `["...orchestrators/marketplace/**", "...orchestrators/plugin/**"]`. No other MSG-Block modifications.

### Claude's Discretion

- Ordering of file mutations within each per-file plan (orchestrator first vs test file first)
- Whether to extract a shared helper for `pi: { getAllTools: () => [] }` mock-pi (Phase 18 left inlined; Phase 19 may continue inline or extract)
- Stale comment cleanup in `orchestrators/plugin/shared.ts` (inside per-file plan, in 19-06, or defer to Phase 21)
- Severity assertion form (`assert.equal(note.severity, undefined)` vs helper)
- install.ts cascade-direct-path emission shape: `MarketplaceNotificationMessage` with `plugins: []` (bare failed-mp) OR with single synthetic `PluginFailedMessage { name: "<aggregate>" }`. Catalog has no aggregate-failure fixture; planner picks the one that round-trips cleanly through `notify()`. (NB: see Finding 2 -- these lines are in update.ts, not install.ts)
- Whether `runPostSuccessMaintenance` (reinstall.ts) and `runPostUpdateMaintenance` (update.ts) get inlined into callers or kept as named helpers after D-19-01 drops empty out their notify paths

### Deferred Ideas (OUT OF SCOPE)

- Phase 20: edge/handlers/* + UsageError migration; orchestrators/import/execute.ts (last cascade-summary importer)
- Phase 21: V1 wrappers deleted, 34-rule MSG-* lint plugin deleted, presentation/* composers deleted, bounded shared/notify.ts ignores removed
- Test-helper extraction for `makeCtx()` -- deferred to Phase 21 or quick task
- `presentation/*.test.ts` deletion -- Phase 21
- `orchestrators/plugin/shared.ts` stale comment cleanup
- `RollbackPartial` ledger refactor (already resolved: ledger already carries `cause?: Error` -- no refactor needed; see Finding 1)
- JSON output mode for notifications
- Branded `Version` type with hash/semver validation

## Phase Requirements

No SNM-* requirements close in this phase. Phase 19 is an execution phase contributing to SNM-22 closure in Phase 21.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| V2 NotificationMessage construction (per orchestrator) | Orchestrator | -- | Each plugin orchestrator builds its own NotificationMessage payload inline per D-19-02 (no composer extraction); orchestrators own iteration order per D-16-06 |
| V2 byte rendering | shared/notify.ts (renderer) | -- | Renderer-as-spec (D-16-04); orchestrators must NOT compose tokens, markers, trailers, or severity |
| Severity routing | shared/notify.ts (renderer) | -- | `notify()` derives severity from content per D-16-11; orchestrators MUST NOT pass severity argument |
| Reload-hint trigger | shared/notify.ts (renderer) | -- | `notify()` derives reload-hint per D-16-12 from state-changing variant set; orchestrators MUST NOT append manually |
| Soft-dep marker emission | shared/notify.ts (renderer) | -- | Single `softDepStatus(pi)` probe per `notify()` call (D-16-14); orchestrators declare `dependencies` field on plugin variants and let renderer probe |
| Test assertion (byte-exact) | tests/orchestrators/plugin/*.test.ts | -- | End-to-end through real `notify()` via `makeCtx()` mock (D-19-07); byte assertions cite catalog fixtures or `tests/shared/notify-v2.test.ts` per-variant fixtures |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.x strict | Discriminated unions for `PluginNotificationMessage` variant switching | NFR-7 (typesafe `installable: true \| false`); already adopted by project |
| node:test | bundled Node 22+ | Test framework | NFR-6 quality bar; native TS strip on Node 22.18+; no `tsx` needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | -- | -- | Phase 19 is internal refactor; no new dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline `notify()` construction in each orchestrator | Extract shared `composeCascadePayload` helper | CONTEXT.md explicitly rejects shared extraction (D-19-02 -- inline construction in each orchestrator); shared helper would re-introduce composer indirection Phase 21 will delete anyway |

**Installation:** N/A. No new packages.

**Version verification:** N/A. No new packages to verify.

## Package Legitimacy Audit

N/A. Phase 19 installs no external packages.

## Architecture Patterns

### System Architecture Diagram

```
User command (e.g. /claude:plugin uninstall foo@bar)
   │
   ▼
edge/handlers/plugin/<command>.ts  (parses argv, validates)
   │
   ▼
orchestrators/plugin/<command>.ts  (THIS PHASE -- migrates here)
   │  (state mutation via withStateGuard + per-bridge cascade)
   │
   ├──► standalone-mode path: builds NotificationMessage inline
   │       │
   │       ▼
   │    notify(ctx, pi, NotificationMessage)  (single V2 entry point)
   │       │
   │       ▼  (shared/notify.ts -- NOT modified in Phase 19)
   │    renderer: composeMarketplaceBlock + renderPluginRow + softDepStatus probe
   │       │
   │       ▼  (severity derived from content; reload-hint derived from variants)
   │    ctx.ui.notify(byteString, severity?)
   │
   └──► orchestrated-mode path (install.ts / reinstall.ts): returns outcome with
        postCommitWarnings/notes; cascade caller composes higher-level
        NotificationMessage (NOT migrated by per-plugin entrypoints)
```

### Recommended Project Structure

Existing structure honored verbatim. No file moves, no new files.

```
extensions/pi-claude-marketplace/
├── orchestrators/plugin/
│   ├── uninstall.ts   ← Plan 19-01 (Wave 1 pilot)
│   ├── install.ts     ← Plan 19-02 (Wave 2)
│   ├── list.ts        ← Plan 19-03 (Wave 2)
│   ├── reinstall.ts   ← Plan 19-04 (Wave 2)
│   ├── update.ts      ← Plan 19-05 (Wave 2)
│   └── shared.ts      ← discretionary comment cleanup
├── shared/notify.ts   ← READ-ONLY (V2 renderer + types)
└── presentation/      ← READ-ONLY (composers stay alive until Phase 21)
tests/orchestrators/plugin/
├── uninstall.test.ts  ← Plan 19-01
├── install.test.ts    ← Plan 19-02
├── list.test.ts       ← Plan 19-03
├── reinstall.test.ts  ← Plan 19-04
└── update.test.ts     ← Plan 19-05
eslint.config.js       ← Plan 19-06 (additive ignores)
```

### Pattern 1: Inline NotificationMessage construction (D-19-02)

**What:** Each orchestrator builds its NotificationMessage payload inline above its single `notify()` call. No composer extraction.

**When to use:** Every V2 callsite in plugin orchestrators.

**Example (mirrors Phase 18 pilot at marketplace/add.ts:160-179):**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:160-179 (Phase 18 pilot)
// NotificationMessage construction recipe (Plan 18-01 pilot; Wave 2 mirrors).
// - One MarketplaceNotificationMessage per outcome, emitted via one
//   notify(opts.ctx, opts.pi, ...) call; `plugins: []` is required.
// - Discriminator here: `mp.status === "added"` (github + path collapse
//   to one V2 shape; V1 `<autoupdate>` marker moved to the list surface).
// - Severity (info; no 2nd arg) and `/reload to pick up changes` are
//   computed by notify() per D-16-11 + D-16-12; callers MUST NOT compose.
// - Reference: catalog UAT `path-source` + `github-source` fixtures at
//   tests/architecture/catalog-uat.test.ts:1113-1133. Per D-18-08-amend,
//   Wave 2 (18-02..05) mirrors this with its own mp.status values.
notify(opts.ctx, opts.pi, {
  marketplaces: [
    {
      name: recordedName,
      scope: opts.scope,
      status: "added",
      plugins: [],
    },
  ],
});
```

For Plan 19-01 (uninstall.ts pilot), the substitution is:
- `marketplaces: [{ name: marketplace, scope, status: undefined, plugins: [{ kind: "uninstalled", name: plugin, ...optional version, dependencies: [...], reasons: [] }] }]`
- The marketplace-header is a label row (`status` omitted) per the catalog form at `docs/output-catalog.md:340-348` (success) and lines 368-378 (failure).
- Recipe block-comment is the 10-line band Wave 2 mirrors.

### Pattern 2: Discriminated PluginNotificationMessage construction

**What:** Each plugin row in `plugins[]` carries a `status` discriminator that the renderer switches on via `assertNever` exhaustiveness.

**When to use:** Building any cascade row (install.ts/reinstall.ts/update.ts) or single-shot uninstall row.

**Discriminator set (from shared/notify.ts:325-459):**
- `PluginInstalledMessage` (status: "installed", required `declaresAgents`/`declaresMcp` per D-15-02)
- `PluginUpdatedMessage` (status: "updated", required `from`/`to` per D-15-04)
- `PluginReinstalledMessage` (status: "reinstalled", required `declaresAgents`/`declaresMcp`)
- `PluginUninstalledMessage` (status: "uninstalled", no soft-dep fields per MSG-SD-3)
- `PluginAvailableMessage` / `PluginUnavailableMessage` / `PluginUpgradableMessage` (list surface)
- `PluginFailedMessage` (status: "failed", optional `cause?: Error`, optional `rollbackPartial?: readonly { phase: string; cause?: Error }[]`, `reasons: readonly Reason[]`)
- `PluginSkippedMessage` (status: "skipped", `reasons: readonly Reason[]`)
- `PluginManualRecoveryMessage` (status: "manual-recovery", optional `cause?: Error`, `reasons: readonly Reason[]`)

### Pattern 3: Manual-recovery as structural plugin variant (reinstall.ts)

**What:** The V1 "separate top-level manual-recovery line below the cascade body" is REPLACED by inclusion in the same `plugins[]` array as a `PluginManualRecoveryMessage` variant.

**Source:** reinstall.ts:509-532 (V1 anchor composition; gets retired by Plan 19-04).

**Result after migration:** Single `notify()` call; `computeSeverity` correctly classifies the manual-recovery row as `warning` per D-16-11.

### Anti-Patterns to Avoid

- **Modifying `shared/notify.ts` in Phase 19:** This file is the V2 contract; Phase 19 only IMPORTS from it. Any modification belongs to Phase 16 (already complete) or Phase 21 (cleanup).
- **Modifying `presentation/cascade-summary.ts`:** Stays alive per D-19-02 (still imported by `orchestrators/import/execute.ts:399`). Phase 21 deletes it.
- **Touching `tests/presentation/*.test.ts`:** Composer tests remain valid; Phase 21 deletes them with the composers they cover.
- **Modifying `tests/architecture/catalog-uat.test.ts`:** Plan 19-06 READS this file to verify GREEN; the runner is not modified.
- **Adding Wave 0 plumbing plan:** All 5 plugin orchestrators already accept `pi: ExtensionAPI` (verified during research -- see Code Examples below). Phase 18's Wave 0 plumbing precedent does NOT repeat.
- **Calling `notify()` more than once per orchestration:** Single-`notify()`-call-per-orchestration discipline (D-18-01 expanded by D-19-01). No second notify after the primary. Post-success "soft warnings" with no V2 representation are DROPPED.
- **Orchestrator-level string composition:** No orchestrator-level rendering of tokens, markers, severity, reload-hint, soft-dep markers. Renderer-as-spec (D-16-04) -- orchestrators construct payloads and let `shared/notify.ts` render bytes.
- **Synthesizing `new Error(p.msg)` for rollback-partial cause:** UNNECESSARY -- the `RollbackPartial` ledger already exposes `cause?: Error` (see Finding 1). Thread `p.cause` directly into `PluginFailedMessage.rollbackPartial[i].cause`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Computing severity from cascade contents | Per-orchestrator severity ternary | `notify()`'s content-derived severity (D-16-11) | The V1 dispatch ternary (`aggregatedSeverity === "warning" ? notifyWarning : notifySuccess`) is the exact anti-pattern Phase 19 retires; the renderer owns severity classification |
| Appending `/reload to pick up changes` trailer | Per-orchestrator `appendReloadHint(body, hint)` | `notify()`'s reload-hint trigger ladder (D-16-12) | The renderer's reload-hint trigger ladder fires on state-changing variant detection in `plugins[]`; orchestrators MUST NOT compose |
| Per-row soft-dep marker emission | Per-orchestrator `{requires pi-subagents}` string interpolation | `notify()`'s `softDepStatus(pi)` single-probe + `dependencies` field | Renderer probes once per `notify()` (D-16-14); orchestrator declares `dependencies: readonly Dependency[]` and the renderer threads the probe through `renderPluginRow` |
| 4-space cause-chain indent below plugin row | Per-orchestrator `causeChainTrailer(err)` + manual indent | `notify()`'s built-in cause-chain rendering via `cause?: Error` field on PluginFailed/PluginManualRecovery | The renderer handles cause-chain depth-bounded walks at 4-space indent (D-16-08); orchestrator just sets `cause: err` |
| 6-space rollback-child cause-chain indent | Per-orchestrator `renderRollbackPartial` helper | `notify()`'s built-in per-phase rollback-child rendering | Renderer handles per-phase indent (D-16-08); orchestrator sets `rollbackPartial: [{ phase, cause? }, ...]` |
| Synthesizing `Error` for rollback msg | `new Error(p.msg)` wrapper | `p.cause` directly (the ledger already exposes it) | Finding 1: `RollbackPartial.cause?: Error` exists since Task 260525-cjr C1 |

**Key insight:** The V2 architecture moves ALL rendering concerns into `shared/notify.ts`. Every Phase 19 orchestrator's job reduces to "build the right discriminated union shape and call `notify(ctx, pi, message)` exactly once." Any per-orchestrator composition is a step backward.

## Runtime State Inventory

Phase 19 is a code refactor (rename V1 wrapper calls to V2 entry point). No data migration, no live service config, no OS-registered state, no secrets, no build artifacts change. The following table is included for completeness per the rename/refactor convention:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None | None -- state.json shape unchanged; no data migration |
| Live service config | None | None -- no external services |
| OS-registered state | None | None -- no OS-level registrations affected |
| Secrets/env vars | None | None -- no env var renames |
| Build artifacts | None | None -- TypeScript native strip; no compiled artifacts in repo |

**Catalog fixtures (already shipped by Phase 17 + 17.1 + 17.2):** The 30+ plugin-family `<!-- catalog-state: ... -->` fixtures in `docs/output-catalog.md` lines 139-568 are the binding user contract. Phase 19 does NOT touch them. Plan 19-06 verifies the catalog UAT runner stays GREEN against them.

## Common Pitfalls

### Pitfall 1: Synthesizing `new Error(p.msg)` for rollback-partial cause

**What goes wrong:** Plan 19-02 (install.ts) constructs `PluginFailedMessage.rollbackPartial[i].cause = new Error(p.msg)` based on CONTEXT.md D-19-03's caveat assumption.

**Why it happens:** CONTEXT.md D-19-03 (line 78) reads: *"The current `RollbackPartial` shape in `orchestrators/plugin/install.ts` exposes `phase` + `msg`. The migration MAY need to thread an Error through `RollbackPartial`... if only `msg` is available, the V2 payload sets `cause: new Error(p.msg)`..."*

**Truth (verified in `transaction/phase-ledger.ts:56-60`):** The `RollbackPartial` interface already carries `readonly cause?: Error` (added by Task 260525-cjr C1). The ledger's `rollbackExecuted` function (lines 98-103) populates `cause` from the original undo throw whenever it's an Error instance. The presentation layer (`presentation/rollback-partial.ts`) consumes this via a depth-5 `causeChainTrailer` walker.

**How to avoid:** Thread `p.cause` directly: `rollbackPartial: failureRollbackPartials.map((p) => ({ phase: p.phase, ...(p.cause !== undefined && { cause: p.cause }) }))`. No synthesis needed.

**Warning signs:** Tests asserting on byte form `cause: <p.msg text>` where the source ledger never actually carried that as an Error chain.

### Pitfall 2: CONTEXT.md line attribution slip (D-19-02 install.ts cascade lines)

**What goes wrong:** Plan 19-02 looks for "install.ts cascade-direct-path callsites at 227 + 254 + 783" per CONTEXT.md D-19-02 line 64 -- but those lines in install.ts do not contain V1 callsites.

**Why it happens:** Lines 227/254/783 are the V1 `notifyError` callsites in `update.ts` (verified by `grep -nE "notify(Success|Warning|Error)\(" orchestrators/plugin/update.ts`). CONTEXT.md D-19-02's text says "install.ts" but the line numbers belong to update.ts. The update.ts canonical_ref entry at CONTEXT.md line 157 already lists 227/254/783 correctly as update.ts's callsites.

**Truth:** install.ts has NO `cascadeSummary` import or call. install.ts is single-plugin-only (standalone-mode emission + orchestrated-mode return). All cascade orchestration for plugin install happens in the marketplace/* family (`orchestrators/marketplace/update.ts` etc.) via `installPlugin` outcome composition. install.ts's failure-emission lines are 682 + 700. (See Code Examples for line-by-line confirmation.)

**How to avoid:** Plan 19-02 (install.ts) treats install.ts as single-plugin standalone-mode + orchestrated-mode-return only. The "aggregate-failure" emissions D-19-02 describes belong to Plan 19-05 (update.ts).

**Warning signs:** Plan 19-02 task list includes references to "cascadeSummary" in install.ts.

### Pitfall 3: Touching tests/presentation or shared/notify.ts

**What goes wrong:** Plan adds a verification step modifying `presentation/cascade-summary.ts` to "no longer be called from plugin/" or modifying `shared/notify.ts` to "add a new variant."

**Why it happens:** Engineer notices the composer becomes orphan-imported after Phase 19's `presentation/*` import drops and feels compelled to delete it preemptively; OR notices a missing variant and amends the renderer mid-Phase.

**Truth:** Phase 19 is scoped to migration only. Composer deletion is Phase 21. Variant additions are Phase 15 territory (complete). The catalog UAT is the binding contract -- any byte the catalog requires is already supported by `shared/notify.ts` post-Phase-17.2.

**How to avoid:** Plan tasks explicitly enumerate the files touched per D-19-06 (disjoint pair `orchestrators/plugin/<file>.ts` + `tests/orchestrators/plugin/<file>.test.ts`). Plan 19-06 touches `eslint.config.js` only. No other source files.

**Warning signs:** Plan touches `presentation/*` or `shared/notify.ts` or `tests/presentation/`.

### Pitfall 4: Adding Wave 0 plumbing

**What goes wrong:** Plan 19-00 (does not exist) adds `pi: ExtensionAPI` to plugin orchestrator options interfaces.

**Why it happens:** Phase 18 had a Plan 18-00 (Wave 0 plumbing) because not every marketplace orchestrator accepted `pi`. Engineer assumes the same applies here.

**Truth:** Verified by source inspection -- every plugin orchestrator's options interface already includes `readonly pi: ExtensionAPI`. The marketplace migration's Wave 0 plumbing already propagated `pi` through every orchestrator (Plan 18-00 is the source-of-truth date 2026-05-27).

**How to avoid:** CONTEXT.md `<domain>` opening line is explicit: *"NO Wave 0 plumbing plan is required."* The plan structure is 6 plans total (19-01..06).

**Warning signs:** Plan 19-00 in the plan set.

### Pitfall 5: Forgetting reload-hint behavior change in tests

**What goes wrong:** Test asserts `assert.equal(notifications.length, 2)` expecting `success message + reload hint as separate notifications`, but V2 packs both into a single notification's `message` field.

**Why it happens:** V1's `appendReloadHint(body, hint)` produced one notification's message; V2's `notify()` does the same. But D-19-01 drops 9 separate post-success warning emissions, which DOES change notification count for affected tests.

**Truth:** Each orchestration emits EXACTLY ONE `notify()` call in V2 standalone mode. Test assertions that previously expected `notifications.length === 2` (success + dropped-warning) must flip to `notifications.length === 1`. Tests targeting a dropped warning's CONTENT (e.g. "data dir creation deferred" string) must be DELETED entirely.

**How to avoid:** Each per-file plan enumerates which test assertions need flip vs delete; the planner identifies these by `grep`-ing the test file for assertions referencing the dropped warning's message fragment.

**Warning signs:** Test file with `notifications.length === 2` assertion after V2 migration.

## Code Examples

### install.ts V1 callsite line numbers (verified 2026-05-27)

```
$ grep -nE "notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
682:    notifyError(ctx, body, err);          # rollback-partial / entity / runtime failure
700:    notifyError(ctx, cause);              # internal-error defensive path
718:      notifyWarning(ctx, msg);            # DROP (D-19-01): mkdir failure
733:      notifyWarning(ctx, msg);            # DROP (D-19-01): dropMarketplaceCache failure
750:      notifyWarning(ctx, msg);            # DROP (D-19-01): agentForeignFailures
761:      notifyWarning(ctx, w);              # DROP (D-19-01): bridgeWarnings loop
796:    notifySuccess(ctx, appendReloadHint(body, hint));  # success
808:      notifyWarning(ctx, depsNote);       # DROP (D-19-01): PI-13 deps note
```

CONTEXT.md cited callsites: 682, 700, 718, 733, 750, 761, 796, 808 (8 sites). **All verified.**

### uninstall.ts V1 callsite line numbers (verified 2026-05-27)

```
$ grep -nE "notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
160:    notifyError(ctx, errorMessage(err), err);          # direct-path failure
179:    notifyWarning(...)                                  # cache-refresh failure
200:    notifyWarning(...)                                  # cleanup-leak warning
232:    notifySuccess(ctx, body);                           # defensive guard success
246:  notifySuccess(ctx, appendReloadHint(body, hint));     # success with reload-hint
```

CONTEXT.md cited callsites: 160, 179, 200, 232, 246. **All verified.**

Note: CONTEXT.md says "notifyWarning at 179 + 200 (cascade-failure cause-chain emissions)" -- actually 179 is the cache-refresh failure and 200 is the data-dir cleanup-leak. They are post-state-commit warnings, not cascade-failure emissions. Both behave equivalently for the migration (the V1 wrappers DROP unconditionally per D-19-01 because there's no V2 representation for post-success warnings) -- but the planner should know what the lines actually do, not what CONTEXT.md narrates.

**Action required:** Plan 19-01 evaluates each of lines 179 and 200 against D-19-01's DROP precedent. The cache-refresh failure (179) and cleanup-leak warning (200) are post-success "soft warnings" with no V2 representation -- DROP both per the precedent established by marketplace/add.ts:150-158 (Phase 18 dropped marketplace cache-refresh on the same basis). Surrounding try/catch retained with explanatory comment.

### list.ts V1 callsite line numbers (verified 2026-05-27)

```
$ grep -nE "notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
772:    notifySuccess(ctx, renderPluginList(payload, probe));  # list success
777:      notifyWarning(...)                                    # DROP: PROBE_FAILURES summary
783:    notifyError(ctx, errorMessage(err), err);              # list failure
```

CONTEXT.md cited callsites: 772, 777, 783. **All verified.**

### reinstall.ts V1 callsite line numbers (verified 2026-05-27)

```
$ grep -nE "notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
197:      notifyError(ctx, errorMessage(err), err);             # single-plugin failure
233:    notifyWarning(ctx, warning);                            # DROP: bridgeWarnings loop
237:    notifyWarning(ctx, warning);                            # DROP: maintenanceWarnings loop
240:  notifySuccess(ctx, renderSuccessBody(locked.outcome, ...));  # single-plugin success
254:    notifyError(ctx, errorMessage(err), err);               # enumerateReinstallTargets failure
263:    notifySuccess(ctx, renderRow({ kind: "empty", token: "no plugins" }, ...));  # empty targets
543:    dispatch(ctx, appendReloadHint(composedBody, hint));    # cascade dispatch ternary at line 543 (sets dispatch at line 543, then calls)
```

CONTEXT.md cited callsites: 197, 233, 237, 240, 254, 263, dispatch at 543, cascadeSummary at 496 + 1313. **All verified.**

### update.ts V1 callsite line numbers (verified 2026-05-27)

```
$ grep -nE "notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
170:    notifyError(ctx, errorMessage(err), err);          # enumerate targets failure
178:    notifySuccess(ctx, renderRow({ kind: "empty", token: "no plugins" }, ...));  # empty targets
227:      notifyError(ctx, errorMessage(err), err);        # syncCloneOnce failure
254:      notifyError(ctx, errorMessage(err), err);        # runThreePhaseUpdate failure
783:      notifyError(args.ctx, errorMessage(aggregate), aggregate);  # phase-3 aggregate failure
844:      notifyWarning(...)                                # DROP: completion-cache-refresh
952:    dispatch(ctx, appendReloadHint(body, hint));        # cascade dispatch ternary at line 952
```

CONTEXT.md cited callsites: 170, 178, 227, 254, 783, 844, dispatch at 952, cascadeSummary at 929. **All verified.**

### RollbackPartial ledger shape (verified 2026-05-27)

```typescript
// Source: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:56-60
export interface RollbackPartial {
  readonly phase: string;
  readonly msg: string;
  readonly cause?: Error;   // ADDED by Task 260525-cjr C1; the typed Error chain
}
```

The ledger captures `cause` via lines 98-103:
```typescript
partials.push({
  phase: done.name,
  msg: errorMessage(undoErr),
  ...(undoErr instanceof Error && { cause: undoErr }),
});
```

**Direct mapping into V2 PluginFailedMessage.rollbackPartial:**
```typescript
// In install.ts post-migration, replace composeRollbackPartialBody with inline:
rollbackPartial: failureRollbackPartials.map((p) => ({
  phase: p.phase,
  ...(p.cause !== undefined && { cause: p.cause }),
})),
```

**No `new Error(p.msg)` synthesis needed.** The V1 free-text `p.msg` is implicitly replaced by the catalog form `[<phase>] (rollback failed)` rendered by `notify()` from the `phase` field alone, plus the optional 6-space-indent cause-chain rendered from `cause` when present.

### eslint.config.js MSG-Block 1 + 1b current state (verified 2026-05-27)

```javascript
// Source: eslint.config.js lines 151-190
// MSG-Block 1 -- severity routing (msg-sr-1..6)
{
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],  // line 160
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-sr-1-success-routing": "error",
    "msg/msg-sr-2-warning-routing": "error",
    "msg/msg-sr-3-error-routing": "error",
    "msg/msg-sr-4-cascade-success": "error",
    "msg/msg-sr-5-cascade-warning": "error",
    "msg/msg-sr-6-no-cascade-error": "error",
  },
},
// MSG-Block 1b -- per-scope rendering (msg-gr-3)
{
  files: [
    "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
    "extensions/pi-claude-marketplace/edge/handlers/**/*.ts",
  ],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],  // line 185
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-gr-3-per-scope": "error",
  },
},
```

**Plan 19-06 target state:**
```javascript
// MSG-Block 1 (line 160) -- extend ignores
ignores: [
  "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
  "extensions/pi-claude-marketplace/orchestrators/plugin/**",
],
// MSG-Block 1b (line 185) -- extend ignores identically
ignores: [
  "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
  "extensions/pi-claude-marketplace/orchestrators/plugin/**",
],
```

### Phase 18 pilot recipe block-comment (D-19-05 mirror precedent)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:160-169 (Phase 18 Plan 18-01 pilot)
// NotificationMessage construction recipe (Plan 18-01 pilot; Wave 2 mirrors).
// - One MarketplaceNotificationMessage per outcome, emitted via one
//   notify(opts.ctx, opts.pi, ...) call; `plugins: []` is required.
// - Discriminator here: `mp.status === "added"` (github + path collapse
//   to one V2 shape; V1 `<autoupdate>` marker moved to the list surface).
// - Severity (info; no 2nd arg) and `/reload to pick up changes` are
//   computed by notify() per D-16-11 + D-16-12; callers MUST NOT compose.
// - Reference: catalog UAT `path-source` + `github-source` fixtures at
//   tests/architecture/catalog-uat.test.ts:1113-1133. Per D-18-08-amend,
//   Wave 2 (18-02..05) mirrors this with its own mp.status values.
```

**Plan 19-01 pilot recipe (Phase 19's structural mirror, plugin-cascade-specific):**
```
// NotificationMessage cascade recipe (Plan 19-01 pilot; Wave 2 mirrors).
// - One MarketplaceNotificationMessage per affected marketplace,
//   emitted via one notify(opts.ctx, opts.pi, ...) call.
// - `plugins: readonly PluginNotificationMessage[]` in display order
//   (orchestrator-controlled iteration per D-16-06; notify() does not sort).
// - Discriminators by status: "uninstalled" here; install/reinstall/update
//   mirror with their own status sets (installed/updated/reinstalled/failed/
//   skipped/manual-recovery).
// - Severity + `/reload to pick up changes` computed by notify() per
//   D-16-11 + D-16-12; callers MUST NOT compose.
// - Reference: catalog UAT plugin-uninstall fixtures at
//   docs/output-catalog.md:340-378. Wave 2 (19-02..05) mirrors this
//   with its own status sets.
```

Wave 2 agents find it via `grep -n "NotificationMessage cascade recipe" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`.

### Existing makeCtx() pattern in plugin tests (verified 2026-05-27)

```typescript
// Source: tests/orchestrators/plugin/uninstall.test.ts:44-66
interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(piOverrides?: { getAllTools?: () => unknown[] }): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;
  const pi = {
    getAllTools: piOverrides?.getAllTools ?? ((): unknown[] => []),
  } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}
```

The pattern is consistent across all 5 plugin orchestrator test files (`uninstall.test.ts`, `install.test.ts`, `list.test.ts`, `reinstall.test.ts`, `update.test.ts`). Phase 18 marketplace tests (e.g. `tests/orchestrators/marketplace/add.test.ts:29-44`) carry a slight variant: `pi` is constructed first and threaded onto `ctx.pi` as well (because Plan 18-00 added `pi` to `ExtensionContext` shape in marketplace tests). Plugin tests use the older form without `ctx.pi`. Both work with the V2 `notify(ctx, pi, message)` signature; the planner does not need to harmonize them.

### Phase 18 marketplace tests (precedent for V2 byte-exact assertions)

The Phase 18 plans (18-01..05) provide the structural precedent for V2 byte-exact assertions, makeCtx() preservation, dropped-warning deletion patterns. Each Phase 19 per-file plan should reference the matching Phase 18 plan:

| Phase 19 plan | Phase 18 reference for structural precedent |
|---------------|---------------------------------------------|
| 19-01 (uninstall.ts pilot) | 18-01 (marketplace/add.ts pilot) -- recipe block-comment + cache-leak drop |
| 19-02 (install.ts) | 18-02 (marketplace/autoupdate.ts) -- multi-outcome + reasons[] |
| 19-03 (list.ts) | 18-03 (marketplace/list.ts) -- list surface + dropped warnings |
| 19-04 (reinstall.ts) | 18-04 (marketplace/remove.ts) -- failure-partial + cascade |
| 19-05 (update.ts) | 18-05 (marketplace/update.ts) -- cascade + dispatch ternary retirement |
| 19-06 (lint narrowing) | 18-06 (lint narrowing) -- additive ignores |

### Confirmed: All plugin orchestrators already accept `pi: ExtensionAPI`

```
$ grep -n "readonly pi:\|pi: ExtensionAPI" extensions/pi-claude-marketplace/orchestrators/plugin/{install,uninstall,list,reinstall,update}.ts | head -10
```
Returns positive matches in each file (e.g. uninstall.ts:66, install.ts inside `InstallPluginOptions`). No Wave 0 plumbing plan needed.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V1 severity-named wrappers (`notifySuccess`/`notifyWarning`/`notifyError`) compose body via per-presentation composers (`renderRow`, `renderRollbackPartial`, `cascadeSummary`, etc.) and pass byte string to `ctx.ui.notify` | V2 structured `notify(ctx, pi, NotificationMessage)` accepts discriminated-union payload; renderer in `shared/notify.ts` composes body + severity + reload-hint + soft-dep markers per type contract | Phase 16 (renderer) + Phase 17 (catalog) + Phase 18 (marketplace migration) -- 2026-05 | Phase 19 migrates plugin family; Phase 20 migrates edge handlers; Phase 21 deletes V1 wrappers + composers |
| Manual severity dispatch ternary (`dispatch = aggregatedSeverity === "warning" ? notifyWarning : notifySuccess`) | `notify()` content-derived severity per D-16-11 ladder | Phase 16 D-16-11 | The orchestrator becomes oblivious to severity; renderer classifies from payload contents (any failed → error; any manual-recovery → warning; otherwise success) |
| Per-orchestrator `appendReloadHint(body, hint)` | `notify()` content-derived reload-hint per D-16-12 trigger ladder | Phase 16 D-16-12 | Orchestrator declares state-changing variants; renderer appends trailer when ≥1 such variant present |
| Per-orchestrator `softDepStatus(pi)` probe + manual marker emission | Single `softDepStatus(pi)` probe per `notify()` call (D-16-14); orchestrator declares `dependencies` field | Phase 16 D-16-14 + D-16-15 | Markers render at notify-time from companion-loaded probe; orchestrator owns no markers |
| V1 install.ts `composeRollbackPartialBody` builds `PluginInlineRow` + `RollbackChild[]` via `renderRollbackPartial` | V2 `PluginFailedMessage.rollbackPartial: readonly { phase, cause? }[]` structurally; renderer handles indent + cause-chain | Phase 15 SNM-09/10 + Phase 16 D-16-08 | install.ts's `composeRollbackPartialBody` retires entirely in Plan 19-02 |

**Deprecated/outdated:**

- All `presentation/*` composer imports in plugin orchestrators (cause-chain, manual-recovery, rollback-partial, version-arrow, compact-line, reload-hint, sort, cascade-summary) -- dropped by Phase 19. After Phase 19, `cause-chain`, `manual-recovery`, `rollback-partial`, `version-arrow` become orphan-imported (no remaining importers); Phase 21 deletes them. `compact-line`, `reload-hint`, `sort`, `cascade-summary` still have non-plugin importers (notably `orchestrators/import/execute.ts`) until Phase 20/21.

- The V1 separate-top-level manual-recovery anchor pattern in reinstall.ts:514-543 -- replaced by inline `PluginManualRecoveryMessage` in the cascade `plugins[]` per D-19-02.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The catalog UAT (`tests/architecture/catalog-uat.test.ts`) will stay GREEN end-to-end through every wave as long as each orchestrator's inline NotificationMessage construction matches a catalog `<!-- catalog-state: ... -->` fixture for its emission states | Pattern 1, Pitfall 3 | If a Phase 19 orchestrator emits a NotificationMessage shape that round-trips through `notify()` to a byte string NOT in the catalog, the UAT runner does not detect it (the UAT only asserts catalog fixtures byte-equal). The planner's per-plan task list must explicitly enumerate which catalog `<!-- catalog-state: -->` keys each orchestrator's emission paths satisfy, and `tests/shared/notify-v2.test.ts` covers per-variant edge cases. Existing per-orchestrator unit tests (the byte-exact `assert.equal(note.message, ...)` lines) are the actual gate for non-catalog edge cases (Risk: LOW because byte-exact unit tests do exist; planner must just ensure they cover every emission). |
| A2 | Phase 18 marketplace test precedent is structurally applicable to Phase 19 plugin tests despite minor `makeCtx()` divergence (marketplace tests attach `pi` to `ctx.pi`; plugin tests do not) | Code Examples > Existing makeCtx() pattern | Risk: MINIMAL. Both forms work with the V2 `notify(ctx, pi, message)` signature because `notify()` consumes `pi` from its second positional argument, not from `ctx.pi`. The planner does not need to harmonize the forms. |
| A3 | install.ts orchestrated-mode path is genuinely untouched by Phase 19 -- the `InstallOutcome.postCommitWarnings: readonly string[]` field remains the internal API consumed by cascade orchestrators | D-19-01, CONTEXT.md Specific Ideas line 213 | Risk: NEEDS PLANNER VERIFICATION at Plan 19-02 time. The cascade caller (marketplace/* family, already V2 post-Phase-18) composes the higher-level NotificationMessage from InstallOutcome. If that composition reads postCommitWarnings to inject into the cascade payload (rather than dropping them silently), then dropping the standalone-mode warnings creates a behavior asymmetry. Plan 19-02 must verify the cascade caller's handling of postCommitWarnings or surface this as an open question. |
| A4 | The `runPostSuccessMaintenance` and `runPostUpdateMaintenance` helpers (reinstall.ts / update.ts) can be safely inlined OR kept as named helpers post-migration | CONTEXT.md Claude's Discretion line 111 | Risk: LOW (cosmetic). After D-19-01 drops, these helpers only return warning-string arrays consumed by the internal `notes` field on outcomes (orchestrated mode). The planner picks either form. |

## Open Questions

1. **Does install.ts's orchestrated-mode cascade caller currently read or drop `postCommitWarnings`?**
   - What we know: install.ts orchestrated-mode returns `InstallOutcome.postCommitWarnings: readonly string[]` (line 134); CONTEXT.md line 213 says this internal API is UNTOUCHED.
   - What's unclear: whether the cascade caller in `orchestrators/marketplace/update.ts` (or wherever bulk install composes outcomes into a NotificationMessage) injects those warnings into the cascade payload OR drops them silently.
   - Recommendation: Plan 19-02 task list includes a verification step: `grep -nr "postCommitWarnings" extensions/pi-claude-marketplace/orchestrators/` to identify all consumers. If the cascade caller injects them into the V2 payload, the planner must decide whether to also drop them at the cascade boundary (consistency with D-19-01) or keep them (cascade-only surface). Since marketplace family is already V2, this is a Phase-18-landed concern -- the planner verifies the existing behavior is what's intended.

2. **Should Plan 19-01 (uninstall pilot) drop lines 179 + 200 silently or surface a comment?**
   - What we know: Both lines emit post-success warnings (cache-refresh deferred at 179; cleanup-leak warning at 200). Both fall under D-19-01's DROP precedent (no V2 representation).
   - What's unclear: whether the surrounding try/catch should keep an explanatory comment (as Phase 18 add.ts did at lines 150-158) or be silently emptied.
   - Recommendation: Plan 19-01 keeps the try/catch + comment, mirroring Phase 18's structural precedent. The cleanup-leak warning's information (leaked path) is genuinely lost to the user; this is the explicit tradeoff D-19-01 accepts.

3. **Plan 19-02 install.ts: aggregate-failure emission shape choice (Claude's Discretion).**
   - What we know: install.ts has no cascadeSummary call. There's no "aggregate-failure emission" in install.ts at all (lines 227/254/783 in CONTEXT.md D-19-02 refer to update.ts). install.ts's failure paths emit single-plugin `PluginFailedMessage`-bearing payloads.
   - What's unclear: NONE for install.ts. (CONTEXT.md's Claude's Discretion item at line 110 referring to "install.ts cascade-direct-path emissions at lines 227 + 254 + 783" is mis-attributed; the question belongs to Plan 19-05 update.ts where those lines actually live.)
   - Recommendation: Plan 19-02 enumerates install.ts's actual emission paths at lines 682 + 700 + 796 only (after D-19-01 drops). Plan 19-05 (update.ts) handles the genuine aggregate-failure shape question for lines 227 + 254 + 783.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner + native TS strip | ✓ | ≥22.18 | -- |
| `npm run check` | Phase gate (typecheck + lint + format:check + tests) | ✓ | -- | -- |
| `node --test` | Catalog UAT + orchestrator tests | ✓ | bundled | -- |
| `git` | Atomic commit per plan | ✓ | -- | -- |
| `grep` | Verification commands | ✓ | -- | -- |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (bundled with Node 22.18+, native TS strip) |
| Config file | none (CLI flags only) |
| Quick run command | `node --test tests/orchestrators/plugin/<file>.test.ts` (per-file iteration during plan execution) |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + tests) |

### Phase Requirements -> Test Map

Phase 19 closes ZERO requirements; it is execution-only. Validation maps to CONTEXT.md success criteria from ROADMAP.md §"Phase 19" rather than SNM-* IDs.

| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|-------------|
| SC #1: Zero V1 callers in `orchestrators/plugin/**` | After all 5 per-file plans land, `grep -rE "notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/` returns zero CallExpression matches (prose comments tolerated) | grep verification | `grep -rE "notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/ \| grep -vE ":\s*//"` | ✅ (running grep at plan time) |
| SC #2: MSG-Block 1 + 1b narrowed via additive `ignores` | `eslint.config.js` MSG-Block 1 + 1b ignores entries each include both `marketplace/**` and `plugin/**` paths | grep | `grep -c "orchestrators/plugin/\*\*" eslint.config.js` returns 2 | ✅ (post-Plan-19-06) |
| SC #3: Catalog UAT GREEN for plugin family | `node --test tests/architecture/catalog-uat.test.ts` exits 0; 3 subtests pass | unit | `node --test tests/architecture/catalog-uat.test.ts` | ✅ existing (verified GREEN today) |
| SC #4: `npm run check` GREEN; other families unchanged | `npm run check` exit 0; `git diff --name-only` for non-plugin orchestrator + edge families is empty | shell | `npm run check && git diff --name-only <base>..HEAD -- <out-of-scope-globs>` | ✅ |
| Per-orchestrator unit tests | Each `tests/orchestrators/plugin/<file>.test.ts` passes with V2 byte-exact assertions | unit (per-file in lockstep) | `node --test tests/orchestrators/plugin/<file>.test.ts` | ✅ existing structure |

### Sampling Rate
- **Per task commit:** `node --test tests/orchestrators/plugin/<file>.test.ts` (the file the task touches) -- fast iteration on the specific orchestrator
- **Per wave merge:** `npm run check` -- full suite to catch cross-file regressions (Rule 3 fixes for inherited V2 byte changes, as in Phase 18 bootstrap test precedent)
- **Phase gate (post Plan 19-06):** `npm run check && node --test tests/architecture/catalog-uat.test.ts` -- full suite + catalog UAT explicit confirmation

### Wave 0 Gaps

No Wave 0 plumbing plan needed. All 5 plugin orchestrators already accept `pi: ExtensionAPI`. All 5 plugin test files already have `makeCtx()` patterns. The catalog UAT runner is already in place.

*(If no gaps: "None -- existing test infrastructure covers all phase requirements")*

None -- existing test infrastructure covers all phase requirements.

## Security Domain

> security_enforcement default = enabled (no override in config.json); section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Phase 19 is internal refactor; no auth surface change |
| V3 Session Management | no | No session model in Pi extension |
| V4 Access Control | no | Plugin scope (user/project) handled by `locationsFor` and `assertPathInside` (NFR-10) -- unchanged by Phase 19 |
| V5 Input Validation | partial | `PluginNotificationMessage` discriminated union enforces typed payloads; renderer's `assertNever` exhaustiveness gate prevents invalid status discriminators from compiling. No new validation surface added. |
| V6 Cryptography | no | No cryptographic surface |
| V7 Error Handling | yes | V2 cause-chain rendering (D-16-08) is depth-bounded (MSG-CC-1: depth-5) -- prevents unbounded recursion through Error.cause chains. Rollback-partial 6-space indent rendering depth-bounded similarly. No information disclosure concern: cause messages reach the user verbatim today (same in V1 via `causeChainTrailer`). |
| V8 Data Protection | no | No data-protection surface change |
| V9-V14 | no | Not applicable to this scope |

### Known Threat Patterns for {V1->V2 notify migration}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Information disclosure via cause-chain (depth-5 messages exposing internal paths, error details) | I (Information disclosure) | Phase 19 inherits the existing V1 behavior -- cause messages reach the user verbatim today via V1 wrappers. V2 changes the rendering layer, not the message contents. NO new disclosure. The depth-5 bound (MSG-CC-1) is the existing mitigation against unbounded walks. |
| Notification flooding (multiple `notify()` calls in standalone mode) | D (Denial-of-service) | D-19-01 + D-18-01 single-`notify()`-call-per-orchestration discipline. Each orchestration emits EXACTLY ONE notification. (The V1 baseline emitted up to 6 per install in standalone mode; V2 collapses to 1.) Net reduction in notification volume. |
| Severity manipulation (orchestrator picks wrong severity, e.g. error when warning was correct) | T (Tampering) | Renderer-owned severity per D-16-11. Orchestrator MUST NOT pass severity; renderer derives from payload contents. MSG-Block 1 lint rules (msg-sr-1..6) enforce; Plan 19-06 narrows the lint to exempt `orchestrators/plugin/**` because the V2 notify() call has no severity arg to flag. |
| Reload-hint suppression (state-changing operation but no reload hint) | T | Renderer-owned reload-hint per D-16-12. Orchestrator declares state-changing variants in `plugins[]`; renderer fires the trailer. Cannot be suppressed by orchestrator. |
| Catalog drift (orchestrator emits a byte form not in the catalog) | T | Catalog UAT byte-equality gate (`tests/architecture/catalog-uat.test.ts`); SC #3 of phase. Plus per-orchestrator unit tests with byte-exact `assert.equal(note.message, ...)` lines. |

## Sources

### Primary (HIGH confidence)

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- verified V1 callsite line numbers 682, 700, 718, 733, 750, 761, 796, 808; verified `composeRollbackPartialBody` at lines 844-881; verified no `cascadeSummary` import.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- verified V1 callsite line numbers 160, 179, 200, 232, 246.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` -- verified V1 callsite line numbers 772, 777, 783; verified `PROBE_FAILURES` module-level capture buffer at line 260.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- verified V1 callsite line numbers 197, 233, 237, 240, 254, 263, dispatch ternary at 543, cascadeSummary at 496 + 1313.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- verified V1 callsite line numbers 170, 178, 227, 254, 783, 844, dispatch ternary at 952, cascadeSummary at 929.
- `extensions/pi-claude-marketplace/transaction/phase-ledger.ts:56-60` -- verified `RollbackPartial { phase, msg, cause?: Error }` shape.
- `eslint.config.js:151-190` -- verified MSG-Block 1 (line 160) + MSG-Block 1b (line 185) current `ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:160-179` -- Phase 18 pilot recipe block-comment + V2 notify() call structure.
- `tests/orchestrators/plugin/uninstall.test.ts:44-66` -- `makeCtx()` mock-ctx pattern.
- `tests/architecture/catalog-uat.test.ts` -- verified GREEN baseline today (`node --test` returns exit 0, 3 subtests pass).
- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-01-SUMMARY.md` -- Phase 18 Plan 18-01 pilot recipe details.
- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-06-SUMMARY.md` -- Phase 18 Plan 18-06 lint narrowing precedent.
- `.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-CONTEXT.md` -- User decisions for Phase 19 (all 8 locked decisions D-19-01..08).
- `docs/output-catalog.md:139-568` -- plugin-family catalog fixtures (BINDING USER CONTRACT).

### Secondary (MEDIUM confidence)

- None. All claims grounded in directly-read source files.

### Tertiary (LOW confidence)

- None. Phase 19 is verification-focused; no claims rest on external sources.

## Project Constraints (from CLAUDE.md)

- **Conventional Commits:** Every commit message MUST follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/). Plan task commits use `feat(19): ...` or `refactor(19): ...` per the phase.
- **No commits to main:** Phase 19 work lands on `gsd/v1.3-replan-catalog` (current branch).
- **Pre-commit hooks MUST pass:** Run `pre-commit run --all-files` before `git commit`. Fix and re-stage; never use `--no-verify`. (Worktree caveat: prefix with `SKIP=trufflehog` for worktree commits.)
- **Title length:** ≥5 chars, ≤72 chars. Body lines ≤80 chars.
- **`npm run check` GREEN before phase merge** (NFR-6). This is SC #4.
- **Atomic file operations** (NFR-1) -- orthogonal to Phase 19 (no new file mutation patterns introduced).
- **Recovery model** (NFR-2 / NFR-3) -- orthogonal (no orchestrator restart required for plan execution).
- **No network** (NFR-5) -- orthogonal (Phase 19 touches only in-process notification rendering).
- **Containment** (NFR-10) -- orthogonal.
- **ctx.ui.notify chokepoint** (IL-2) -- Phase 19 is the migration that consolidates ALL plugin orchestrator output through the new V2 `notify()` chokepoint, which itself terminates in `ctx.ui.notify`. Compliance is the migration's purpose.
- **No telemetry** (IL-4) -- orthogonal.
- **English only** (IL-1) -- orthogonal (catalog strings are English).
- **Two scopes only** (SC-1) -- orthogonal.
- **TypeScript strict + discriminated `installable: true|false`** (NFR-7) -- `PluginNotificationMessage` discriminated union is the structural enforcement; `assertNever` in renderer is the exhaustiveness gate.
- **`@mariozechner/pi-coding-agent` peer ^0.73.1** (NFR-11) -- orthogonal (no peer dep changes).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; existing stack documented in CLAUDE.md verified against current source.
- Architecture: HIGH -- verified against current source files; CONTEXT.md decisions match observed code state.
- Pitfalls: HIGH -- Pitfalls 1-5 grounded in concrete CONTEXT.md text + verified source state.
- Callsite line numbers: HIGH -- every cited callsite verified via grep against current source.
- RollbackPartial shape: HIGH -- verified directly in `transaction/phase-ledger.ts:56-60`.
- ESLint config state: HIGH -- verified at `eslint.config.js:160 + 185`.
- Recipe block-comment: HIGH -- verified verbatim from `marketplace/add.ts:160-169`.
- Catalog UAT baseline: HIGH -- ran the test, observed exit 0 with 3/3 passing subtests.

**Research date:** 2026-05-27

**Valid until:** 2026-06-03 (7 days, fast-moving -- Phase 19 expected to execute in 1-2 sessions; if delayed >7 days, re-verify line numbers because they drift with any unrelated commits to plugin orchestrators).
