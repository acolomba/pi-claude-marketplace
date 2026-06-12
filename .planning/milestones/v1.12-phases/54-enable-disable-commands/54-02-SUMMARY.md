---
phase: 54-enable-disable-commands
plan: 02
subsystem: orchestrators
tags: [enable-disable, closed-set-token, cache-only-rematerialization, atomic-supersession]

# Dependency graph
requires:
  - phase: 54-enable-disable-commands
    plan: 01
    provides: isRecordedButDisabled predicate + pluginsToEnable bucket + armed NFR-5 gate + Wave 0 RED scaffolds
provides:
  - setPluginEnabled orchestrator (single function parameterized by enable: boolean)
  - makeEnableDisableHandler edge factory (parses <plugin>@<marketplace> + --scope + --local)
  - (disabled) closed-set PluginStatus token + PluginDisabledMessage variant + renderer arm (D-54-01 LANDED)
  - (already enabled) / (already disabled) REASONS + BENIGN_REASONS additions
  - install.ts pinVersionOverride? opt-in (Pitfall 54-4 ENBL-02 version pin contract)
  - isRecordedButDisabled exported from reconcile/plan.ts (single source of truth shared with planner)
affects: 55 (load-time reconcile apply consuming pluginsToEnable + setPluginEnabled)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 5 (Plan 02): orchestrator delegates re-materialization to installPlugin via orchestrated mode + pinVersionOverride -- DRY over re-implementing the 5-phase ledger while still preserving ENBL-02 (the recorded version pin is propagated verbatim)"
    - "Pattern 6 (Plan 02): cascade-row token (existing (installed) / (uninstalled)) vs inventory token ((disabled)) -- Open Question #2 resolved at the renderer surface, NOT at the orchestrator"
    - "Pattern 7 (Plan 02): config write-back ONLY on the fresh success path; idempotent / failed / not-recorded outcomes leave the config file UNTOUCHED (mirrors autoupdate.ts's idempotent arm discipline)"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/notify-types.test.ts
    - tests/architecture/notify-grammar-invariant.test.ts
    - tests/edge/completions/provider.test.ts
    - tests/edge/router.test.ts
    - tests/edge/handlers/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/shared/notify-v2.test.ts

key-decisions:
  - "D-54-02-A: setPluginEnabled's enable branch delegates re-materialization to installPlugin via { mode: 'orchestrated' } + pinVersionOverride. Considered (and rejected) inlining the 5-phase ledger locally (~150 LOC duplication of install.ts state-commit / bridge phases) and extracting buildInstallPhases as a new exported helper from install.ts (large refactor; touches install.ts call sites in import/execute.ts). The opt-in pinVersionOverride is a 1-line addition to install.ts that preserves ENBL-02 (Pitfall 54-4) without re-litigating the resolver's PI-7 / PUP-3 / SNM-34 precedence at every call site. NFR-5 / FORBIDDEN_TARGETS architectural gate stays GREEN because installPlugin is itself already gated (zero git surface), and enable-disable.ts imports only installPlugin + cascadeUnstagePlugin + shared/notify + persistence/config-io + transaction/with-state-guard."
  - "D-54-02-B: The new (disabled) PluginStatus token is for the LIST/INFO INVENTORY surface ONLY; the cascade-row form on enable/disable success uses the EXISTING (installed) / (uninstalled) state-change tokens (Open Question #2 resolution). This preserves SNM-33 reload-hint discipline (state-change tokens drive the trailer; the new (disabled) token explicitly does NOT) and keeps the catalog-uat byte gate satisfied with minimal new fixtures. The /claude:plugin info section uses the SAME (disabled) byte form as list -- the orchestrator routes through the regular cascade path with a list-arm marketplace header rather than introducing a new disabled arm to PluginInfoRowBase.status."
  - "D-54-02-C: dispatchOutcome + composeOutcomeRow extracted out of setPluginEnabled to reduce cognitive complexity from 18 to within the project's 15 budget WITHOUT splitting the load-bearing transaction closure (Pitfall 54-1: CFG-03 load + idempotency check + enable/disable branch + config write-back MUST all run under the SAME withStateGuard closure). The extraction is rendering-only; the transaction discipline stays intact."

patterns-established:
  - "Pitfall 54-7 (Plan 02): an idempotent no-op skip ((skipped) {already enabled} / {already disabled}) MUST NOT write the config entry through saveConfig. The autoupdate.ts idempotent arm sets the same precedent; copying the discipline here keeps mtime-based reconcile no-op convergence proofs (Phase 52 SC#4) byte-stable across enable/disable invocations on already-matching state."

requirements-completed: [ENBL-01, ENBL-02, ENBL-03, ENBL-04]

# Metrics
duration: ~47min
completed: 2026-06-10
---

# Phase 54 Plan 02: Enable/Disable Commands -- Atomic User-Visible Surface Summary

**ENBL-01..04 closed in one atomic commit (37d01ed): setPluginEnabled orchestrator + makeEnableDisableHandler edge factory + (disabled) closed-set PluginStatus token + PluginDisabledMessage variant + renderer arm + catalog/UAT byte-equality fixtures + length-lock bumps (PLUGIN_STATUSES 16, STATUS_TOKENS 22, REASONS 31) -- the lockstep that makes any intermediate state architecturally impossible.**

## Performance

- **Duration:** ~47 min
- **Started:** 2026-06-10T18:49:34Z
- **Completed:** 2026-06-10T19:36:17Z
- **Tasks:** 2 (landed in ONE atomic commit per Pitfall 54-2)
- **Files modified:** 20 (2 created, 18 modified)
- **Commit:** 37d01edcb3b889ca4367b1d5a956141393c27204

## Accomplishments

### Closed-set lockstep (D-54-01 LANDED)

- `PLUGIN_STATUSES` 15 -> 16 (appended `"disabled"` at the end of the tuple so head-of-tuple state-change tokens that drive `shouldEmitReloadHint` stay positionally unchanged).
- `STATUS_TOKENS` 21 -> 22 (appended `"disabled"`).
- `REASONS` 29 -> 31 (`"already enabled"` + `"already disabled"`).
- `BENIGN_REASONS` gains BOTH new members so an idempotent (skipped) cascade routes to info via the UXG-02 / D-28-06 first-match ladder (mirrors the `already autoupdate` / `already no autoupdate` precedent set in Phase 27).
- New `PluginDisabledMessage` variant interface (shape: status `"disabled"`, name, optional version, optional scope; NO reasons / dependencies / cause / rollbackPartial -- the inventory row is bare). Added to `PluginNotificationMessage` union.
- New renderer arm `case "disabled":` in `renderPluginRow` -- subject-first grammar, `ICON_UNINSTALLABLE` (`⊘`) glyph reused per RESEARCH Pattern 5 (shared with `will disable`).

### User-visible surface (ENBL-01..04)

- `setPluginEnabled` orchestrator in `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` (single function parameterized by `enable: boolean`, mirrors `setMarketplaceAutoupdate` shape). Composes:
  - `resolveCrossScopePluginTarget` (SCOPE-01) -- marketplace-absent / other-scope route to the standalone `MarketplaceNotAddedMessage` variant per D-47-A.
  - `withStateGuard` outer + `loadConfig` INSIDE the closure (Pitfall 54-1 / A6 -- CFG-03 invalid aborts before any state mutation).
  - Idempotency check via locally-mirrored `isCurrentlyDisabled` predicate (same rule as `orchestrators/reconcile/plan.ts::isRecordedButDisabled`, now exported from the planner as a single source of truth -- see "Decisions Made").
  - Enable branch: delegates to `installPlugin` in `{ mode: "orchestrated" }` with NEW `pinVersionOverride: installed.version` opt-in (Pitfall 54-4 ENBL-02 version pin contract; preserves the recorded version verbatim).
  - Disable branch: `cascadeUnstagePlugin` (reused from `orchestrators/marketplace/shared.ts`) + in-place reset of `resources.*` to `[]` PRESERVING `version` / `resolvedSource` / `compatibility` / `installedAt` + `updatedAt` bump.
  - Config write-back via `saveConfig` (SOLE sanctioned writer per SPLIT-02). ONLY on the fresh success path; idempotent / failed / not-recorded outcomes leave the config UNTOUCHED.
  - Single terminal `notify()` per IL-2 via the extracted `dispatchOutcome` + `composeOutcomeRow` helpers (D-54-02-C cognitive-complexity refactor).
- `makeEnableDisableHandler` edge factory in `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts` -- mirrors `makeAutoupdateHandler` shape. Parses `<plugin>@<marketplace>` + `--scope` via `parseRequiredPluginMarketplaceRef`; parses `--local` via a local token scan AFTER `parseCommandArgs` (rejects unknown long flags via `notifyUsageError` -- T-54-02-06 mitigation).
- Router (`SubcommandHandlers` + `TOP_LEVEL_SUBCOMMANDS` + `TOP_LEVEL_USAGE` + switch arms) + register (dual `makeEnableDisableHandler(pi, true|false)` wiring) + completion provider (`PluginRefMode` + `PluginRefCompletionMode` extended; `pluginRefBranchConfig` returns installed-plugin completion config for the new arms).

### Architectural gate satisfaction

- `tests/architecture/no-orchestrator-network.test.ts` (Plan 01 armed) NOW ACTIVE on the new orchestrator file -- the ENOENT-skip path no longer fires. The new file imports ZERO platform/git / DEFAULT_GIT_OPS / refreshGitHubClone surface (NFR-5 / Pitfall 54-3 enforced structurally).
- `tests/architecture/config-state-write-seams.test.ts` GREEN -- the orchestrator's config write-back routes EXCLUSIVELY through `saveConfig` (SPLIT-02 ownership-split preserved; no raw `atomicWriteJson(configJsonPath, ...)` calls in the new orchestrator).
- `tests/architecture/reconcile-planner-purity.test.ts` GREEN -- exporting `isRecordedButDisabled` from `orchestrators/reconcile/plan.ts` does NOT break the planner's purity gate (the predicate is pure; only the visibility changed).
- `tests/architecture/catalog-uat.test.ts` GREEN -- forward-walk byte-equality AND inverse-walk orphan detection both pass; 10 new FIXTURES entries paired with each new catalog state.
- `tests/architecture/notify-types.test.ts` GREEN -- length-locks read 16 / 22 / 31; PluginDisabledMessage shape proof + 4 negative-presence proofs (cause / reasons / dependencies / rollbackPartial / from / to) + scope/version per-variant assertions.
- `tests/architecture/notify-grammar-invariant.test.ts` GREEN -- new subject-first proof for `(disabled)` rows (DISABLED_TOKEN_RE + 3-fixture exercise asserting the row icon + name appear BEFORE the `(disabled)` token).

### Test surface

- `tests/orchestrators/plugin/enable-disable.test.ts` (Wave 0 scaffold flipped) -- 10 GREEN tests covering: ENBL-01 base config write-back; ENBL-01 --local file isolation (Pitfall 54-5 base mtime unchanged); ENBL-02 version pin + resources reset; ENBL-03 missing-clone aborts with `(failed)`; idempotency arms (enable / disable); CFG-03 invalid-config abort with information-disclosure containment (T-54-02-02); marketplace-not-added explicit-scope routing.
- `tests/edge/handlers/plugin/enable-disable.test.ts` (Wave 0 scaffold flipped) -- 5 GREEN tests covering: missing positional / malformed ref / unknown flag USAGE errors; `--local` parse + forward; `--scope` parse + forward.
- `tests/shared/notify-v2.test.ts` -- 8 new byte-equality tests for the new inventory + idempotent skip + cascade rows.

## A1 / A2 / A3 / A4 / A5 / A6 confirmation log

- **A1:** Plan 01's docstring evidence of `statePhase` owning all `resources.*` writes -- carried forward verbatim. The Phase 54 Plan 02 disable branch RESETS resources in place outside the install ledger (the disable path does NOT invoke `statePhase`), which is the correct dual: ledger writes for install/enable, in-place reset for disable. Both paths PRESERVE the soft-degraded carve-out (Plan 01 D-54-01-A) because disable only runs when `isCurrentlyDisabled === false`, i.e. the state is NOT in the soft-degraded shape.
- **A6:** `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:66-83` confirmed -- `withStateGuard(locations, mutate)` acquires the per-scope `.state-lock` lockfile BEFORE `loadState`, runs the mutate closure under the lock, and saves on no-throw exit. The Plan 02 implementation honors Pitfall 54-1 by reading `loadConfig` INSIDE the closure: a concurrent flip from another process either fails fast at `acquireStateLock` (ELOCKED -> `StateLockHeldError`) OR retries against the fresh post-flip state on the next invocation.
- **A2-A5** were planner-side concerns closed in Plan 01.

## ENBL-04 three-orthogonal-facts proof

| Fact         | Variant carrier                                | Renderer token            |
| ------------ | ---------------------------------------------- | ------------------------- |
| installable  | `compatibility.installable: true` (state)      | `(installed)` / `(available)` |
| enabled      | `enabled: true | false | undefined` (config)   | cascade transition tokens |
| materialized | non-empty `resources.*` arrays (state)         | `(disabled)` (inventory)  |

`PluginDisabledMessage` is structurally distinct from `PluginUnavailableMessage` -- the variant carries NO `reasons`, the byte form differs (`(disabled)` vs `(unavailable)`), and the discriminated union arity is now N+1 (16 variants). The catalog states for `disabled-inventory` (list + info) and the four cascade variants (`enable-fresh`, `disable-fresh`, `enable-idempotent`, `disable-idempotent`) each have distinct byte forms.

## Bytes-touched table

| File | Lines added / removed | What |
|------|----------------------|------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | +406 / -0 | NEW -- setPluginEnabled orchestrator + helpers (runEnableBranch / runDisableBranch / writeConfigEntry / dispatchOutcome / composeOutcomeRow / narrowEnableFailure / narrowDisableFailure / isCurrentlyDisabled) |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts` | +92 / -0 | NEW -- makeEnableDisableHandler factory + extractLocalFlag helper |
| `extensions/pi-claude-marketplace/shared/notify.ts` | +51 / -2 | "disabled" added to PLUGIN_STATUSES + STATUS_TOKENS; "already enabled" / "already disabled" added to REASONS + BENIGN_REASONS; PluginDisabledMessage variant interface; union arm; renderPluginRow case "disabled" arm |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | +13 / -2 | pinVersionOverride? opt-in + branch in resolvePluginVersion call (Pitfall 54-4) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | +5 / -1 | scopeOf case "disabled" arm |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` | +1 / -1 | isRecordedButDisabled function export |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` | +13 / -0 | 3-switch case "disabled" arms (projectRowStatus / pluginScopeOrFallback / pluginVersion) |
| `extensions/pi-claude-marketplace/edge/router.ts` | +9 / -2 | SubcommandHandlers fields + TOP_LEVEL_SUBCOMMANDS + TOP_LEVEL_USAGE + switch arms |
| `extensions/pi-claude-marketplace/edge/register.ts` | +3 / -0 | makeEnableDisableHandler import + dual factory wiring |
| `extensions/pi-claude-marketplace/edge/completions/provider.ts` | +30 / -1 | PluginRefMode union extension + case "enable" / case "disable" arms |
| `extensions/pi-claude-marketplace/edge/completions/data.ts` | +8 / -1 | PluginRefCompletionMode union extension |
| `docs/output-catalog.md` | +127 / -0 | 2 new H2 sections + disabled-inventory state under list / info |
| `tests/architecture/catalog-uat.test.ts` | +143 / -0 | 10 new FIXTURES entries (5 for enable + 4 for disable + 1 disabled-inventory) |
| `tests/architecture/notify-types.test.ts` | +44 / -8 | length-lock bumps + _VDisabled alias + shape proof + negative-presence proofs |
| `tests/architecture/notify-grammar-invariant.test.ts` | +69 / -0 | DISABLED_TOKEN_RE + 3-fixture subject-first test |
| `tests/shared/notify-v2.test.ts` | +156 / -0 | 8 new byte-equality tests |
| `tests/edge/handlers/plugin/enable-disable.test.ts` | +56 / -71 | Wave 0 scaffold replaced with 5 GREEN behavior tests |
| `tests/orchestrators/plugin/enable-disable.test.ts` | +402 / -134 | Wave 0 scaffold replaced with 10 GREEN behavior tests |
| `tests/edge/completions/provider.test.ts` | +5 / -2 | TC-1 keyword list bumped (enable / disable added) |
| `tests/edge/router.test.ts` | +2 / -0 | SubcommandHandlers fixture: enable + disable wired |

**Total:** 20 files; 1920 insertions; 174 deletions; ONE commit.

## Test count delta

| Suite | Plan 01 baseline | Plan 02 final | Delta |
|-------|------------------|----------------|-------|
| Unit (npm test) | 1640 (16 skipped) | 1662 (0 skipped) | +22 (16 RED scaffolds flipped to GREEN + 6 new tests) |
| Integration (npm run test:integration) | 7 | 7 | 0 (Plan 02 surface is unit-level) |

## Phase 55 hand-off

- The new `pluginsToEnable` bucket (Plan 01) + the cache-only enable path (Plan 02) compose into Phase 55's load-time reconcile-apply call site. Phase 55 will drive `setPluginEnabled` (or a renamed apply seam) per-entry serially under the existing per-scope lock per RECON-06.
- The new `isCurrentlyDisabled` predicate locally mirrored in Plan 02's orchestrator is the SAME RULE as the planner's exported `isRecordedButDisabled` -- Phase 55 can choose either anchor (both are pure; both gate on the empty-resources + installable:true intersection). The planner's export is the canonical single source of truth.
- Phase 55 owns the load-time entry point + the migrate-before-reconcile ordering rail + Pitfall 52-2 (concurrent first-load lock coverage) + Pitfall 52-4 (D-13 gate race).

## Decisions Made

- **D-54-02-A: installPlugin delegation + pinVersionOverride opt-in.** See key-decisions; Pitfall 54-4 ENBL-02 version pin is preserved without re-implementing the 5-phase ledger locally.
- **D-54-02-B: (disabled) is an inventory-surface token, NOT a cascade-row token.** Open Question #2 resolved at the renderer surface. Cascade-row form on enable/disable success uses the EXISTING (installed) / (uninstalled) state-change tokens.
- **D-54-02-C: dispatchOutcome + composeOutcomeRow extracted to satisfy the cognitive-complexity budget.** Splitting was purely a rendering concern; the load-bearing transaction closure (CFG-03 / idempotency / enable-or-disable / config write-back) STAYS in ONE withStateGuard scope (Pitfall 54-1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture marketplace records missing required `name` + `addedFromCwd` fields**
- **Found during:** Initial test run after orchestrator implementation -- state.json schema validation rejected the fixture with `must have required properties name, addedFromCwd`.
- **Fix:** Extended the test fixture's marketplace record to include the missing required fields. The MARKETPLACE_RECORD_SCHEMA is canonical (state-io.ts).
- **Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** All 10 ENBL behavior tests GREEN.
- **Committed in:** part of the single Plan 02 atomic commit.

**2. [Rule 3 - Blocking] TC-1 completion provider expected keyword list out of date**
- **Found during:** First `npm run check` after wiring `enable` / `disable` into `TOP_LEVEL_SUBCOMMANDS`. The pre-existing `tests/edge/completions/provider.test.ts` TC-1 test held a sorted snapshot of every top-level keyword; adding the two new keywords broke the byte-equality.
- **Fix:** Updated the snapshot to include `"enable"` and `"disable"` in their alphabetical slots.
- **Files modified:** `tests/edge/completions/provider.test.ts`
- **Verification:** TC-1 GREEN; the test continues to enforce snapshot-discipline against future drift.
- **Committed in:** part of the single Plan 02 atomic commit.

**3. [Rule 3 - Blocking] SubcommandHandlers test fixture in router.test.ts missing enable / disable**
- **Found during:** First typecheck after extending `SubcommandHandlers`. The router-test fixture constructed a complete `SubcommandHandlers` shape and tsc flagged the missing properties.
- **Fix:** Added the two `mk("enable")` / `mk("disable")` wirings.
- **Files modified:** `tests/edge/router.test.ts`
- **Verification:** typecheck GREEN; router tests GREEN.
- **Committed in:** part of the single Plan 02 atomic commit.

**4. [Rule 1 - Bug] CFG-03 abort test asserted byte-identical state.json round-trip**
- **Found during:** The first CFG-03 test version round-tripped state.json bytes (`statePre === statePost`). The withStateGuard contract is "save on no-throw" so state IS re-serialized, AND `loadState` normalizes the `source` field (drops `absPath`, computes `logical`) at load time. The byte form changes by design.
- **Fix:** Weakened the assertion to the actual T-54-02-02 invariant: the plugin record's `resources.*` arrays and `version` field are unchanged. The state-io source normalization is allowed.
- **Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** CFG-03 test GREEN; the load-bearing T-54-02-02 information-disclosure mitigation is still asserted (the absolute path NEVER appears in the rendered notify body).
- **Committed in:** part of the single Plan 02 atomic commit.

**5. [Rule 3 - Blocking] Lint: cognitive-complexity 18 > 15 (`setPluginEnabled`) + non-null-assertion + nullish-coalescing + no-useless-assignment + type-vs-interface**
- **Found during:** `npm run lint` after the first implementation pass.
- **Fix:** Extracted `runEnableBranch` / `runDisableBranch` / `writeConfigEntry` / `dispatchOutcome` / `composeOutcomeRow` / `isCurrentlyDisabled` helpers from the orchestrator (D-54-02-C); replaced `tokens[i]!` with a typed undefined-guard in the edge handler; rewrote a ternary to use `??` in install.ts; consolidated the test file's `baseExistsPre/Post` toggle into a single `fileExists` async helper; converted the `ScopedLocationsLike` type alias to an interface.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** `npm run lint` GREEN.
- **Committed in:** part of the single Plan 02 atomic commit.

**6. [Rule 1 - format] Prettier reformat across 4 files**
- **Found during:** `npm run format:check`.
- **Fix:** `npx prettier --write` on the 4 flagged files.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`, `tests/architecture/notify-grammar-invariant.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** `npm run format:check` GREEN.
- **Committed in:** part of the single Plan 02 atomic commit.

**7. [Rule 2 - Missing Critical] Info-surface disabled rendering routed through cascade path instead of new PluginInfoRowBase arm**
- **Found during:** First catalog draft attempted a `disabled-inventory` state under `## /claude:plugin info` using `PluginInfoMessage` -- but `PluginInfoRowBase.status` is the closed 4-member set (installed | available | unavailable | failed); adding `"disabled"` there would have grown the info-surface type model, breaking notify-types' existing PluginInfoBaseExpected shape proof.
- **Fix:** Replaced the info-surface catalog state with prose pointing at the list-surface byte form (same `(disabled)` token; orchestrator routes through the regular cascade path on info when the plugin is disabled, with a list-arm marketplace header). The info section now references the list section's `disabled-inventory` state instead of duplicating it. No new info-surface variant; no new shape proof needed.
- **Files modified:** `docs/output-catalog.md`
- **Verification:** catalog-uat byte-equality + inverse-walk orphan detection both GREEN; notify-types untouched.
- **Committed in:** part of the single Plan 02 atomic commit.

---

**Total deviations:** 7 auto-fixed (3 bugs, 1 missing-critical, 3 blocking/format).
**Impact on plan:** Every auto-fix preserves the plan's success criteria at the user-contract level. The two semantically-load-bearing deviations (D-54-02-A installPlugin delegation + D-54-02-C dispatch extraction) keep the atomic-supersession discipline intact while satisfying the project's lint budget and the discriminated-union architectural invariants.

## Issues Encountered

- None beyond the deviations documented above. The execution surfaced 7 issues the plan's behavior block did not anticipate; all resolved automatically per Rules 1-3.

## User Setup Required

None - no external service configuration required; no new dependencies.

## Threat Flags

None - the new orchestrator and edge handler import only sanctioned surfaces (`saveConfig` for config writes, `cascadeUnstagePlugin` for disable, `installPlugin` for enable, `notify` for output; no new network surface, no new auth surface, no new schema field). T-54-02-01..07 are all `mitigate` dispositions and each mitigation is in place (Pitfall 54-1 / 54-2 / 54-3 / 54-4 / 54-5 / unknown-flag rejection / closed-set lockstep).

## Next Phase Readiness

- Plan 02 closes the user-visible Phase 54 surface. ENBL-01..04 are CLOSED. The atomic-supersession contract (Pitfall 54-2) is honored.
- Phase 55 (Load-Time Reconcile Apply, Notification & Wiring) is now unblocked: the `pluginsToEnable` bucket produces real rows (Plan 01) AND the `setPluginEnabled` orchestrator is the apply seam (Plan 02). The single-source-of-truth predicate `isRecordedButDisabled` is now exported from the planner for Phase 55's consumption.

## Self-Check: PASSED

Verified:
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` -- CREATED.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts` -- CREATED.
- All 18 modified files exist on disk with the expected changes.
- Commit hash `37d01edcb3b889ca4367b1d5a956141393c27204` exists in `git log`.
- `npm run check` GREEN end-to-end (typecheck + lint + format:check + 1662 unit tests + 7 integration tests; up from 1640 + 7 in Plan 01).

---
*Phase: 54-enable-disable-commands*
*Completed: 2026-06-10*
