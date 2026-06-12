---
phase: 55-load-time-reconcile-apply-notification-wiring
plan: 01
subsystem: orchestrators
tags: [orchestrators, notify, recon-03, orchestrated-mode, marketplace, plugin]

# Dependency graph
requires:
  - phase: 19
    provides: InstallPluginNotifications + InstallPluginOutcome orchestrated-mode precedent
  - phase: 46
    provides: ContentReason / Reason closed-set type model + MarketplaceNotAddedMessage variant
  - phase: 54
    provides: setPluginEnabled orchestrator + EnableDisablePluginOptions + runInstallLedger CR-01 nested-lock contract
provides:
  - "AddMarketplaceNotifications + AddMarketplaceOutcome (orchestrators/marketplace/add.ts)"
  - "RemoveMarketplaceNotifications + RemoveMarketplaceOutcome (orchestrators/marketplace/remove.ts)"
  - "UninstallPluginNotifications + UninstallPluginOutcome (orchestrators/plugin/uninstall.ts)"
  - "EnableDisablePluginNotifications + EnableDisablePluginOutcome (orchestrators/plugin/enable-disable.ts)"
  - "Uniform `notifications: { mode: 'standalone' | 'orchestrated' }` option across the four driven orchestrators applyReconcile (Plan 02) composes"
affects: [55-02-apply-reconcile, 55-03-load-reconcile-race-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RECON-03 orchestrated-mode: standalone-default option `notifications?: { mode }` + typed discriminated `*Outcome` union; orchestrated branches suppress ctx.ui.notify and return the typed outcome; standalone branches stay byte-identical."
    - "Failure-emit helpers (emitCascadeFailure / emitMarketplaceNotAdded / emitPartialFailure / handleAddFailure / outcomeToTypedResult / resolveScopeOrFailedOutcome) extract the orchestrated-vs-standalone dispatch into named helpers; keeps cognitive complexity inside the SonarJS budget."
    - "Orchestrated outcome `reason` typed `Reason` (broader than `ContentReason`) so the structural `not added` sentinel can flow through the same field; consumer (Plan 02 apply.ts) dispatches on the broader closed set."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "Outcome `reason` typed `Reason` (not `ContentReason` as the must_haves block strictly stated) so the not-added structural sentinel can be carried through the same failure field; plan consumer Plan 02 will dispatch on the broader closed set."
  - "Implementation signature returns `Promise<*Outcome | undefined>` (no function overloads) -- `void` is invalid as a TS union constituent under @typescript-eslint/no-invalid-void-type, and overloads collided with exactOptionalPropertyTypes."
  - "remove.ts orchestrated mode bypasses resolveScopeOrNotifyNotAdded via a new resolveScopeOrFailedOutcome helper so the not-added arm surfaces a typed MarketplaceNotFoundError instead of firing the standalone variant."
  - "Catastrophic non-classified add failure in orchestrated mode collapses to the closed-set `unparseable` reason (every recognised add precondition yields a typed error; a non-enumerated throw is by construction an opaque/corrupted source-tree shape, NOT a network reachability problem)."
  - "setPluginEnabled save-failure (withLockedStateTransaction rethrow) in orchestrated mode maps to `lock held` reason."

patterns-established:
  - "Failure-emit helpers (emit*Failure / emit*NotAdded) per orchestrator: each takes `{ ctx, pi, ..., orchestrated }` and returns either an outcome (orchestrated branch) or `undefined` (after firing standalone notify)."
  - "rethrowPreconditionErrors short-circuit lives BEFORE the mode branch so bootstrap composer contract (ATTR-07 Phase 48) is preserved across both modes."

requirements-completed: [RECON-03]

# Metrics
duration: ~80m
completed: 2026-06-10
---

# Phase 55 Plan 01: Load-Time Reconcile Apply, Notification & Wiring — Foundation Summary

**Adds `notifications: { mode: "standalone" | "orchestrated" }` + typed discriminated `*Outcome` union to addMarketplace / removeMarketplace / uninstallPlugin / setPluginEnabled so applyReconcile (Plan 02) can compose N orchestrator calls into ONE notify() per load (IL-2) without injecting a swallow-and-capture ctx.**

## Performance

- **Duration:** ~80 min
- **Started:** 2026-06-10T21:32:12Z
- **Completed:** 2026-06-10T22:50:00Z
- **Tasks:** 2/2
- **Files modified:** 10

## Accomplishments

- Four orchestrators now accept a uniform `notifications?: AddMarketplaceNotifications | RemoveMarketplaceNotifications | UninstallPluginNotifications | EnableDisablePluginNotifications` option (each a discriminated `{ mode: "standalone" | "orchestrated" }` union).
- Each orchestrator exports a typed `*Outcome` discriminated union (success arm + collapsed `failed` arm carrying `reason: Reason`, `error: Error`, `cause: string`); setPluginEnabled additionally exposes `enabled` / `disabled` / `skipped` arms for the asymmetric ENBL semantics.
- Standalone mode (omitted option) is BYTE-IDENTICAL to today: catalog-uat + notify-v2 + every existing add/remove/uninstall/enable-disable fixture stays GREEN unchanged.
- Orchestrated mode fires ZERO `ctx.ui.notify` calls across every covered arm and returns the typed outcome for the caller to render.
- CR-01 nested-lock contract preserved: setPluginEnabled's enable branch still calls `runInstallLedger` inside `withLockedStateTransaction`; orchestrated mode is purely an output-side change.

## Task Commits

1. **Task 1: addMarketplace + removeMarketplace orchestrated mode** — `34b505d` (feat)
2. **Task 2: uninstallPlugin + setPluginEnabled orchestrated mode** — `1cc3906` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — AddMarketplaceNotifications + AddMarketplaceOutcome types, `notifications` option on AddMarketplaceOptions, orchestrated success/failure branches, `handleAddFailure` helper.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` — RemoveMarketplaceNotifications + RemoveMarketplaceOutcome types, `notifications` option, `resolveScopeOrFailedOutcome` + `emitPartialFailure` helpers.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` — UninstallPluginNotifications + UninstallPluginOutcome types, `notifications` option, `emitCascadeFailure` + `emitMarketplaceNotAdded` helpers.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` — EnableDisablePluginNotifications + EnableDisablePluginOutcome types, `notifications` option, `outcomeToTypedResult` helper mapping the internal SetEnabledOutcome sentinel.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` — ImportDeps.addMarketplace signature widened to `Promise<AddMarketplaceOutcome | undefined>` (call site discards return).
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts` — `SingleNameMarketplaceRun` return type widened from `Promise<void>` to `Promise<unknown>` to accept the new union.
- `tests/orchestrators/marketplace/add.test.ts` — +5 orchestrated-mode tests (success, unsupported-source failure, duplicate-name failure, rethrowPreconditionErrors interaction, standalone-default regression guard).
- `tests/orchestrators/marketplace/remove.test.ts` — +4 orchestrated-mode tests (clean success, bare-form missing-marketplace, explicit-scope miss, standalone-default regression guard).
- `tests/orchestrators/plugin/uninstall.test.ts` — +3 orchestrated-mode tests (success, missing-marketplace, standalone-default regression guard).
- `tests/orchestrators/plugin/enable-disable.test.ts` — +5 orchestrated-mode tests (disable success, idempotent already-disabled, idempotent already-enabled, missing-marketplace, standalone-default regression guard).

## Decisions Made

- **Outcome `reason: Reason` (broader than `ContentReason`)** — the plan's must_haves block states `reason: ContentReason`, but also requires the missing-marketplace arm to surface `reason: "not added"`. Since `ContentReason = Exclude<Reason, "not added">`, these are contradictory; choosing `Reason` satisfies both the typed `MarketplaceNotFoundError` requirement and gives Plan 02's apply consumer a single field to dispatch on (no separate marker bool). Documented inline in each Outcome type's JSDoc.
- **`Promise<*Outcome | undefined>` over function overloads** — `void` is invalid as a TS union constituent under `@typescript-eslint/no-invalid-void-type`; overloaded signatures with `& { notifications: { mode: "orchestrated" }}` failed against `exactOptionalPropertyTypes: true`. The single-return-shape approach is simpler and orchestrated callers narrow naturally on `outcome !== undefined`.
- **Orchestrated catastrophic-failure fallback for add = `"unparseable"`** — every recognised add precondition yields a typed error (`classifyAddError` catch ladder), so a non-enumerated throw is by construction an opaque/corrupted source-tree shape, not a network problem (network failures are already classified by the github guard's clone-catch).
- **Orchestrated lock-held failure for setPluginEnabled = `"lock held"`** — withLockedStateTransaction rethrows on lock contention or save failure; `lock held` is the closest closed-set REASONS member.

## Deviations from Plan

### Rule 1 — Bug fix / Rule 3 — Blocker fix

**1. [Rule 3 - Blocker] Plan stated `reason: ContentReason` but required `reason: "not added"` for the missing-marketplace failure arm**
- **Found during:** Task 1 (typecheck)
- **Issue:** TS2322 — `"not added"` is not assignable to `ContentReason` (defined as `Exclude<Reason, "not added">`).
- **Fix:** Typed outcome `reason: Reason` (broader closed set). Documented as a deliberate broader-than-the-plan choice in each Outcome type's JSDoc.
- **Files modified:** add.ts, remove.ts, uninstall.ts, enable-disable.ts
- **Verification:** typecheck + npm run check GREEN
- **Committed in:** 34b505d (Task 1), 1cc3906 (Task 2)

**2. [Rule 3 - Blocker] `void` is not valid in a TS union under @typescript-eslint/no-invalid-void-type**
- **Found during:** Task 1 (lint)
- **Issue:** Initial implementation used `Promise<*Outcome | void>` for the return type; ESLint rejected.
- **Fix:** Replaced with `Promise<*Outcome | undefined>`. Tried function overloads as an alternative but they collided with `exactOptionalPropertyTypes: true`.
- **Files modified:** add.ts, remove.ts, uninstall.ts, enable-disable.ts, import/execute.ts
- **Verification:** lint + typecheck GREEN
- **Committed in:** 34b505d (Task 1), 1cc3906 (Task 2)

**3. [Rule 3 - Blocker] SonarJS cognitive-complexity threshold exceeded after inlining the orchestrated branches**
- **Found during:** Task 1 + Task 2 (lint)
- **Issue:** addMarketplace, removeMarketplace, uninstallPlugin all tripped the cognitive-complexity ceiling once the orchestrated branches landed inline.
- **Fix:** Extracted failure-emit helpers (`handleAddFailure`, `emitPartialFailure`, `resolveScopeOrFailedOutcome`, `emitCascadeFailure`, `emitMarketplaceNotAdded`, `outcomeToTypedResult`); each takes the dispatch inputs + the `orchestrated` bool and returns either the typed outcome (orchestrated) or `undefined` (after firing standalone notify).
- **Files modified:** add.ts, remove.ts, uninstall.ts, enable-disable.ts
- **Verification:** lint GREEN
- **Committed in:** 34b505d (Task 1), 1cc3906 (Task 2)

### Rule 2 — Auto-added missing functionality

None — orchestrated-mode foundation has no hidden security/correctness gaps.

### Rule 4 — Architectural deviations

None — the orchestrated-mode pattern is a sibling option, not a structural change.

## Verification

- `tests/orchestrators/marketplace/add.test.ts` — 25/25 GREEN (20 standalone + 5 orchestrated)
- `tests/orchestrators/marketplace/remove.test.ts` — 23/23 GREEN (19 standalone + 4 orchestrated)
- `tests/orchestrators/plugin/uninstall.test.ts` — 23/23 GREEN (20 standalone + 3 orchestrated)
- `tests/orchestrators/plugin/enable-disable.test.ts` — 15/15 GREEN (10 standalone + 5 orchestrated)
- `tests/architecture/catalog-uat.test.ts` — GREEN (byte-equality unchanged)
- `tests/shared/notify-v2.test.ts` — GREEN
- `tests/architecture/notify-types.test.ts` — GREEN (no closed-set length-lock changes)
- `npm run check` — GREEN end-to-end (1689 unit + 7 integration)

## Threat Model Disposition

- T-55-01-01 (info disclosure via orchestrated `cause` / `error`): mitigation contract documented in each Outcome type's JSDoc — the consumer (Plan 02 apply.ts) will project `outcome.reason` (closed-set) into the cascade and NEVER render raw `error.message` in user-visible output. Plan 01 only exposes the typed surface; the projection contract lands in Plan 02.
- T-55-01-02 (hostile caller suppresses notifications via orchestrated mode): accepted as the four orchestrators are package-internal exports with no public IPC / extension API exposure.
- T-55-01-03 (orchestrated failures produce no log unless caller renders): mitigation by default-omitted standalone behavior — no existing caller silently drops error notifications; orchestrated-mode is opt-in.
- T-55-01-SC (package legitimacy): N/A — no new packages installed.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Hand-off to Plan 02

- `applyReconcile` (orchestrators/reconcile/apply.ts) will call each of the four orchestrators with `{ notifications: { mode: "orchestrated" } }`, aggregate the typed outcomes into a single `ReconcileAppliedCascadeMessage` (new variant Plan 02 introduces), and emit ONE `notify()` per load (IL-2 + RECON-04).
- Plan 02 owns the new pending-tense status tokens, the cascade-message variant, the catalog states + FIXTURES, and the threat-mitigation projection contract (T-55-01-01).
- `pluginsToEnable` bucket (Phase 53 hand-off) is already wired to `isRecordedButDisabled` in Phase 54; Plan 02 will route each entry through `setPluginEnabled({ enable: true, notifications: { mode: "orchestrated" }})`.

## Self-Check: PASSED

Verified files exist:
- extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts — FOUND
- extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts — FOUND
- extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts — FOUND
- extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts — FOUND
- tests/orchestrators/marketplace/add.test.ts — FOUND
- tests/orchestrators/marketplace/remove.test.ts — FOUND
- tests/orchestrators/plugin/uninstall.test.ts — FOUND
- tests/orchestrators/plugin/enable-disable.test.ts — FOUND

Verified commits exist:
- 34b505d (Task 1) — FOUND
- 1cc3906 (Task 2) — FOUND
