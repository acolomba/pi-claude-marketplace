---
phase: 18-migration-wave-1-marketplace-orchestrator-family
plan: 0
subsystem: marketplace-orchestrator-plumbing
tags: [plumbing, refactor, wave-0, plan-18-00, pi-threading]
requires:
  - phase-17.1-autoupdate-grammar
  - phase-17.2-renderscope-fix
provides:
  - marketplace-orchestrator-pi-plumbing
  - edge-handler-pi-factories
  - register-ts-shared-file-decoupled
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/{add,autoupdate,list,update}.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/{add,autoupdate,list,update}.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - tests/{edge,orchestrators,integration}/**/*.test.ts (8 files)
tech-stack:
  added: []
  patterns:
    - "pi-as-first-positional-factory-arg (matches makeRemoveHandler precedent)"
    - "makeCtx-returns-{ctx,pi,notifications} (extends D-18-06 mock pattern)"
key-files:
  created:
    - .planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-00-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
    - tests/edge/handlers/marketplace/add.test.ts
    - tests/edge/handlers/marketplace/autoupdate.test.ts
    - tests/edge/handlers/marketplace/list.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/edge/handlers/plugin/bootstrap.test.ts
    - tests/integration/fold-adoption.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/orchestrators/marketplace/list.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
decisions:
  - "D-18-08 amendment: Wave 0 lands as a single atomic plumbing-only commit (per the must-have truth)."
  - "Rule 3 deviation: extend the plumbing past the plan's stated 8-file scope to also thread `pi` through `update.ts` edge handler, `bootstrap.ts` orchestrator + edge handler, `import/execute.ts`, and 4 additional test files (bootstrap orchestrator test + 4 edge handler tests + integration test). The plan promoted update.ts's `pi?` to required, which forced the update edge handler + every consumer of bootstrap orchestrator + the import flow to also take `pi`; without these additional fixes `npm run check` would not pass on the same commit."
  - "Implementation choice: extend each test's `makeCtx()` to also return `pi` (mirrors production ExtensionContext + ExtensionAPI shape) instead of the plan's `pi: (ctx as unknown as { pi: ExtensionAPI }).pi,` cast. Both satisfy D-18-06; the makeCtx extension is shorter, more typesafe, and preserves the existing mock pattern verbatim."
metrics:
  duration_minutes: 26
  completed: 2026-05-27
---

# Phase 18 Plan 0: Marketplace Orchestrator `pi` Plumbing Summary

Pre-thread `pi: ExtensionAPI` through every marketplace orchestrator `*Options` interface + every edge handler factory + `register.ts` wiring, in one atomic plumbing-only commit, so Waves 1/2 (Plans 18-01..05) can swap V1 notify wrappers for V2 `notify(ctx, pi, message)` calls without re-touching shared edge surfaces.

## What Was Built

### Task 1 -- Orchestrator `*Options` interfaces (4 files)

| File | Change | Status |
|------|--------|--------|
| `orchestrators/marketplace/add.ts` | Added `readonly pi: ExtensionAPI` to `AddMarketplaceOptions` (after `ctx`); added `ExtensionAPI` to existing platform/pi-api.ts import group | new field |
| `orchestrators/marketplace/autoupdate.ts` | Added `readonly pi: ExtensionAPI` to `AutoupdateOptions` (after `ctx`); added `ExtensionAPI` import | new field |
| `orchestrators/marketplace/list.ts` | Added `readonly pi: ExtensionAPI` to `ListMarketplacesOptions` (after `ctx`); added `ExtensionAPI` import | new field |
| `orchestrators/marketplace/update.ts` | Promoted `readonly pi?: ExtensionAPI` to non-optional `readonly pi: ExtensionAPI` on BOTH `UpdateMarketplaceOptions` and `UpdateAllMarketplacesOptions`; deleted two dead-branch `...(opts.pi !== undefined && { pi: opts.pi })` conditionals since `pi` is now always defined (lint catches the unnecessary conditional). The internal `RefreshOneArgs.pi?` stays optional + the `NULL_PROBE` fallback inside `refreshOneMarketplace` is preserved per plan rationale ("Plan 18-05 deletes the fallback once the V2 migration removes the last optional-pi reader"). | strict tightening + lint cleanup |

### Task 2 -- Edge handler factories + register.ts wiring (3 files + register.ts)

| File | Change |
|------|--------|
| `edge/handlers/marketplace/add.ts` | `makeAddHandler(deps)` → `makeAddHandler(pi: ExtensionAPI, deps: EdgeDeps)`; threads `pi` into `addMarketplace({...})` after `ctx` |
| `edge/handlers/marketplace/autoupdate.ts` | `makeAutoupdateHandler(enable)` → `makeAutoupdateHandler(pi, enable)`; threads `pi` into `setMarketplaceAutoupdate({...})` (Risks #10 option-a -- matches `makeRemoveHandler(pi)` sibling convention) |
| `edge/handlers/marketplace/list.ts` | Converted plain `handleMarketplaceList` function into factory `makeMarketplaceListHandler(pi)`; threads `pi` into `listMarketplaces({...})` |
| `edge/register.ts` | Updated 4 marketplace wire-lines (add, list, autoupdate × 2) to thread `pi`; import switched from `handleMarketplaceList` to `makeMarketplaceListHandler` |

### Rule 3 deviations -- additional files threaded for `npm run check` GREEN

The plan called out Plan 18-05 as the owner of `update.ts`'s plumbing decision and explicitly said Plan 18-00 "does NOT touch `marketplaceUpdate: makeMarketplaceUpdateHandler(deps)`." But Task 1 (per the plan) promoted `update.ts`'s `pi?` to required `pi`, which created an immediate downstream compile break in the existing `makeMarketplaceUpdateHandler` and in every other caller of the 4 promoted-or-introduced interfaces. To honor `must_haves.coverage_constraints` "npm run check MUST be GREEN before AND after this plan," the plumbing was extended to:

| File | Change | Rule | Reason |
|------|--------|------|--------|
| `edge/handlers/marketplace/update.ts` | `makeMarketplaceUpdateHandler(deps)` → `makeMarketplaceUpdateHandler(pi, deps)`; threads `pi` into both `updateMarketplace` and `updateAllMarketplaces` call sites | Rule 3 | The plan's Task 1 promotion of `update.ts` `pi?` to required forced this. Plan 18-05 can still own the V2 migration of update.ts; today's change is signature-only and matches the sibling factory shape. |
| `edge/register.ts` line 87 | `makeMarketplaceUpdateHandler(deps)` → `makeMarketplaceUpdateHandler(pi, deps)` | Rule 3 | Companion to the above. |
| `orchestrators/plugin/bootstrap.ts` | Added `readonly pi: ExtensionAPI` to `BootstrapOptions`; threaded into composed `addMarketplace` + `setMarketplaceAutoupdate` calls | Rule 3 | `bootstrapClaudePlugin` composes both `addMarketplace` and `setMarketplaceAutoupdate`, which now require `pi`. Without a `pi` on `BootstrapOptions` the composition cannot type-check. |
| `edge/handlers/plugin/bootstrap.ts` | `makeBootstrapHandler(deps)` → `makeBootstrapHandler(pi, deps)`; threads `pi` into `bootstrapClaudePlugin({...})` | Rule 3 | Companion to the above. |
| `edge/register.ts` line 77 | `bootstrap: makeBootstrapHandler(deps)` → `bootstrap: makeBootstrapHandler(pi, deps)` | Rule 3 | Companion to the above. |
| `orchestrators/import/execute.ts` line 805 | Added `pi: opts.pi` to the `addMarketplace({...})` call inside `importClaudeSettings`; `ImportClaudeSettingsOptions` already exposes `pi` (no interface change) | Rule 3 | `addMarketplace` requires `pi` after Task 1. |

These are signature plumbing only -- no behavior change, no V1 → V2 notify migration, no new user-visible output. They are precisely the same shape Plan 18-00 introduces for the 4 marketplace orchestrators; they just happen to live one level up in the call graph.

### Task 3 -- Tests threaded for compile (4 marketplace + bootstrap orchestrator + 4 edge + integration = 10 files)

Approach: extend each test's `makeCtx()` to also return `pi` (mirroring the production `ExtensionContext` carrying `pi` alongside `ui.notify`), then add `pi` to each call site. This is a slight refinement of the plan's recommended `pi: (ctx as unknown as { pi: ExtensionAPI }).pi,` cast -- shorter, type-safe, and preserves the existing mock pattern (D-18-06) verbatim. Documented in the decisions section.

| Test file | makeCtx return tuple | Call sites updated |
|-----------|----------------------|--------------------|
| `tests/orchestrators/marketplace/add.test.ts` | `{ ctx, pi, notifications }` | 14 `addMarketplace({...})` calls (incl. 2 with `ctx: ctx1`/`ctx: ctx2`) |
| `tests/orchestrators/marketplace/autoupdate.test.ts` | `{ ctx, pi, notifications }` | 11 `setMarketplaceAutoupdate({...})` calls |
| `tests/orchestrators/marketplace/list.test.ts` | `{ ctx, pi, notifications }` | 5 `listMarketplaces({...})` calls |
| `tests/orchestrators/marketplace/update.test.ts` | `{ ctx, pi, notifications }` | 18 `updateMarketplace({...})` / `updateAllMarketplaces({...})` calls |
| `tests/orchestrators/plugin/bootstrap.test.ts` | `{ ctx, pi, notifications }` | 5 `bootstrapClaudePlugin({...})` calls |
| `tests/edge/handlers/marketplace/add.test.ts` | added `makePi()` helper | 4 `makeAddHandler(makePi(), deps)` |
| `tests/edge/handlers/marketplace/autoupdate.test.ts` | added `makePi()` helper | 5 `makeAutoupdateHandler(makePi(), bool)` |
| `tests/edge/handlers/marketplace/list.test.ts` | rewritten end-to-end to use `makeMarketplaceListHandler(makePi())` | 3 calls |
| `tests/edge/handlers/marketplace/update.test.ts` | added `makePi()` helper | 4 `makeMarketplaceUpdateHandler(makePi(), deps)` |
| `tests/edge/handlers/plugin/bootstrap.test.ts` | added `makePi()` helper | 6 `makeBootstrapHandler(makePi(), deps)` |
| `tests/integration/fold-adoption.test.ts` | `makeCtx` already returned `pi`; just added `pi: ctx.pi` to 3 `addMarketplace({...})` calls | 3 calls |

No byte-string assertions changed; no severity assertions changed; no test names changed. Test count: 1362 (1360 pass + 2 todo) BEFORE and AFTER -- identical to the pre-plan baseline.

## Verification

```
$ npm run check
typecheck     ✓
lint          ✓
format:check  ✓
test          ✓  1362 tests (1360 pass, 0 fail, 2 todo) -- IDENTICAL to baseline
```

Byte-equality invariants confirmed:

- `grep -c "readonly pi: ExtensionAPI" extensions/pi-claude-marketplace/orchestrators/marketplace/{add,autoupdate,list}.ts` returns `1` per file.
- `grep -c "readonly pi?: ExtensionAPI" extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` returns `1` -- the internal `RefreshOneArgs.pi?`, NOT the public Options interfaces (per plan rationale).
- `grep -c "makeAddHandler(pi" extensions/pi-claude-marketplace/edge/register.ts` returns `1`.
- `grep -c "makeAutoupdateHandler(pi" extensions/pi-claude-marketplace/edge/register.ts` returns `2`.
- `grep -c "makeMarketplaceListHandler(pi)" extensions/pi-claude-marketplace/edge/register.ts` returns `1`.
- `grep -rn "handleMarketplaceList" extensions/pi-claude-marketplace/` returns only the historical comment in `list.ts`'s header docblock; no live import or usage.
- `grep -r "notifySuccess\|notifyWarning\|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/ | wc -l` returns `42` -- all V1 wrapper callsites are untouched (no V1 → V2 migration in this plan; Plans 18-01..05 own that).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended plumbing past the plan's stated 8-file scope**

- **Found during:** Task 1 (interface promotion in `update.ts`)
- **Issue:** The plan promoted `update.ts`'s `pi?` to required `pi` but explicitly said Plan 18-00 "does NOT touch `marketplaceUpdate: makeMarketplaceUpdateHandler(deps)`" -- which is the direct consumer of the promoted interface and immediately fails to compile.
- **Fix:** Threaded `pi` through `makeMarketplaceUpdateHandler` (and updated `register.ts` line 87). Same shape as the other 3 factory updates the plan does request.
- **Files modified:** `edge/handlers/marketplace/update.ts`, `edge/register.ts` (the lone update wire-line)

**2. [Rule 3 - Blocking] Threaded `pi` through `BootstrapOptions` + bootstrap edge handler**

- **Found during:** Task 1 typecheck
- **Issue:** `orchestrators/plugin/bootstrap.ts::bootstrapClaudePlugin` composes `addMarketplace` and `setMarketplaceAutoupdate`, both of which now require `pi`. `BootstrapOptions` did not carry `pi`, so the composition broke typecheck.
- **Fix:** Added `readonly pi: ExtensionAPI` to `BootstrapOptions`, threaded into both composed calls. Bumped the factory signature of `makeBootstrapHandler` to `(pi, deps)` to match. Updated `register.ts` line 77. Updated `tests/orchestrators/plugin/bootstrap.test.ts` and `tests/edge/handlers/plugin/bootstrap.test.ts` accordingly.
- **Files modified:** `orchestrators/plugin/bootstrap.ts`, `edge/handlers/plugin/bootstrap.ts`, `edge/register.ts`, the two bootstrap test files.

**3. [Rule 3 - Blocking] Threaded `pi: opts.pi` into the `addMarketplace` call inside `import/execute.ts`**

- **Found during:** Task 1 typecheck
- **Issue:** `ImportClaudeSettingsOptions` already exposed `pi`, but the single `addMarketplace({...})` call inside `importClaudeSettings` was missing the `pi` field.
- **Fix:** One-line addition: `pi: opts.pi,` after `ctx: opts.ctx,`. No interface change.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`.

**4. [Rule 3 - Blocking] Threaded `pi` into `fold-adoption.test.ts` integration test**

- **Found during:** Task 1 typecheck
- **Issue:** Integration test calls `addMarketplace({...})` from 3 sites; its existing `makeCtx` already produced a `pi` field but the call sites didn't pass it.
- **Fix:** Added `pi: <ctx-var>.pi,` to each of the 3 sites. No new helpers.
- **Files modified:** `tests/integration/fold-adoption.test.ts`.

**5. [Rule 3 - Blocking] Deleted two `...(opts.pi !== undefined && { pi: opts.pi })` dead conditionals in `update.ts`**

- **Found during:** Task 1 `npm run lint`
- **Issue:** ESLint's `@typescript-eslint/no-unnecessary-condition` fired on the spread-conditional pattern because `opts.pi` is now provably defined after the interface promotion.
- **Fix:** Replaced the conditional spread with an unconditional `pi: opts.pi,` field. The `NULL_PROBE` fallback inside `refreshOneMarketplace` is preserved per plan rationale.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`.

### Other deviations

**Implementation choice (documented in decisions):** Each test's `makeCtx()` was extended to also return `pi: ExtensionAPI` so call sites can write `pi` directly instead of casting via `(ctx as unknown as { pi: ExtensionAPI }).pi`. Both forms satisfy D-18-06; the makeCtx extension is shorter, type-safe, mirrors production wiring, and changes makeCtx's public tuple shape from `{ ctx, notifications }` to `{ ctx, pi, notifications }` -- no test name changed, no severity assertion changed, no notification count changed.

## Authentication Gates

None.

## V1 → V2 Migration Status

**ZERO V1 callsites migrated in this plan.** Per the D-18-08 amendment, Plan 18-00 is plumbing only. The 42 V1 `notifySuccess` / `notifyWarning` / `notifyError` callsites in `extensions/pi-claude-marketplace/orchestrators/marketplace/` continue to emit V1 strings. Plans 18-01..05 own the V1 → V2 migration; Plan 18-06 owns the lint narrowing + final UAT.

## Threat Flags

None. Per the plan's `<threat_model>` block (T-18-00-01: accept), this is a signature-only refactor with no new attack surface.

## Known Stubs

None.

## Self-Check: PASSED

- All 23 modified files exist on disk and compile.
- `npm run check` exits 0 (typecheck + lint + format:check + 1360 tests pass / 0 fail / 2 todo -- IDENTICAL to baseline).
- Plan's verification invariants confirmed (grep counts, V1 wrapper preservation).
- No catalog UAT byte changes.
- No orchestrator notify-call-site migrations.
