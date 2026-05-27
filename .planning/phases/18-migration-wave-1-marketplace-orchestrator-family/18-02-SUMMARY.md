---
phase: 18-migration-wave-1-marketplace-orchestrator-family
plan: 2
subsystem: marketplace-orchestrator-migration
tags: [migration, v1-to-v2, wave-2, plan-18-02, autoupdate, notify-recipe-mirror]
requires:
  - plan-18-00-pi-plumbing
  - plan-18-01-add-ts-pilot
  - phase-17.1-autoupdate-grammar
  - phase-17.2-renderscope-fix
provides:
  - autoupdate-ts-v2-migration
  - 5-state-catalog-payload-recipe
  - caller-order-honored-precedent
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts (Rule 3)
  - tests/edge/handlers/plugin/bootstrap.test.ts (Rule 3)
tech-stack:
  added: []
  patterns:
    - "notify(opts.ctx, opts.pi, { marketplaces: MarketplaceNotificationMessage[] }) -- single V2 call replacing 4 V1 wrappers"
    - "MarketplaceNotificationMessage construction inline (no buildAutoupdateRow helper) using the Phase 17.1 5-state catalog: autoupdate enabled / autoupdate disabled / skipped+reasons / failed"
    - "Caller-order honored end-to-end -- alphabetic sort dropped, SC-6 scopes-loop + changed-before-unchanged accumulator order is the visible iteration order"
    - "Optional reasons?: [\"already enabled\" | \"already disabled\"] attached only on idempotent (skipped) variants"
key-files:
  created:
    - .planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-02-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/edge/handlers/plugin/bootstrap.test.ts
decisions:
  - "D-18-04 honored: Phase 17.1 amended grammar (7-entry MarketplaceStatus + optional reasons?:) is the binding contract; this plan constructs payloads against it with zero new amendments."
  - "D-18-05 honored: 5-state autoupdate mapping locked in source -- fresh enable -> autoupdate enabled (info), fresh disable -> autoupdate disabled (info), idempotent enable -> skipped+[\"already enabled\"] (warning), idempotent disable -> skipped+[\"already disabled\"] (warning), not-found -> failed (error). Severity + reload-hint computed by notify() per D-16-11 + D-16-12; callers MUST NOT compose."
  - "D-18-06 honored: byte-exact V2 assertions through the real notify() via makeCtx mock; existing makeCtx() pattern preserved verbatim; severity assertions added per ladder."
  - "D-16-06 caller-order honored: alphabetic sort at autoupdate.ts:178-180 (V1) DROPPED. Iteration order is now SC-6 scopes-loop order combined with the applyAutoupdateFlipInPlace changed-before-unchanged grouping. MAU-2 test absorbs the order change with a presence-plus-relative-order assertion instead of a brittle byte-equal regex."
  - "D-18-08-amendment recipe mirror: 13-line NotificationMessage construction recipe block-comment above the success-path notify() call at autoupdate.ts (mirrors Plan 18-01 pilot at add.ts:160-169 with substituted mp.status values per the Wave 2 substitution table)."
  - "D-16-08 implicit consequence: the V1 state-lock-failure path no longer surfaces the underlying error message in the user-visible byte (V2 confines cause?: Error to plugin variants). The catalog `failure-not-found` byte form `⊘ <mp> [<scope>] (failed)` is what users see; cause text is preserved in error logs (V1 carry-forward) but not in the rendered notification."
  - "Rule 3 deviation: 5 transitive bootstrap test sites flipped from V1 to V2 because bootstrapClaudePlugin composes addMarketplace + setMarketplaceAutoupdate, both now emitting V2 catalog bytes. Plan 18-01 already updated the addMarketplace-inherited site; this plan updates the autoupdate-inherited sites."
metrics:
  duration_minutes: 12
  duration_seconds: 764
  completed: 2026-05-27
---

# Phase 18 Plan 2: `autoupdate.ts` V1 -> V2 Migration Summary

Wave 2 migration of `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` from the V1 severity-named wrappers (`notifyError` x2 + `notifySuccess` x2) to the V2 structured entry point `notify(opts.ctx, opts.pi, NotificationMessage)`. Consumes the Phase 17.1 amended grammar (7-entry `MarketplaceStatus` + optional `reasons?:`) end-to-end without further amendments. The 5 D-18-05 catalog states (`enable-fresh`, `disable-fresh`, `enable-idempotent`, `disable-idempotent`, `failure-not-found`) plus the empty-scopes sentinel are all reachable via the new V2 calls.

## What Was Built

### Task 1 -- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`

| Change | Location | Detail |
|--------|----------|--------|
| Drop V1 imports | lines 43-44 (old) | Removed `renderRow` from `presentation/compact-line.ts`, `MARKETPLACE_LABEL_PROBE` from `shared/constants/marketplace-label-probe.ts` |
| Drop V1 type import | line 52 (old) | Removed `MarketplaceRow` type import from `presentation/compact-line.ts` |
| Drop V1 wrapper imports | line 46 (old) | Removed `notifyError, notifySuccess` from `shared/notify.ts`; replaced with `notify` |
| Add V2 type import | new | Added `import type { MarketplaceNotificationMessage } from "../../shared/notify.ts"` (used by the success-path accumulator) |
| Drop V1 row helper | lines 80-120 (old) | Removed `AutoupdateRowInput` interface + `buildAutoupdateRow` helper; V2 constructs payload inline per outcome |
| Update header docblock | lines 1-58 | Old `<autoupdate>` / `<no autoupdate>` marker-as-outcome legend replaced with the 5-state V2 catalog mapping + caller-order discipline note |
| Per-scope error path | new ~lines 145-159 | `notifyError(opts.ctx, errorMessage(err), err)` -> `notify(opts.ctx, opts.pi, { marketplaces: [{ name, scope, status: "failed", plugins: [] }] })` |
| missingEverywhere path | new ~lines 174-188 | `notifyError(opts.ctx, errorMessage(first.cause), first.cause)` -> `notify(opts.ctx, opts.pi, { marketplaces: [{ name, scope: first.scope, status: "failed", plugins: [] }] })` |
| Empty-scopes path | new line 198 | `notifySuccess(opts.ctx, renderRow({ kind: "empty", token: "no marketplaces" }, ...))` -> `notify(opts.ctx, opts.pi, { marketplaces: [] })` (D-16-17 sentinel computed by notify()) |
| Success/flip path | new lines 218-237 | `notifySuccess(opts.ctx, sorted.map(renderRow).join("\n"))` -> one `notify(opts.ctx, opts.pi, { marketplaces })` call with payload accumulated inline. Alphabetic sort at V1 lines 178-180 DROPPED per D-16-06 |
| Add recipe block-comment | new lines 202-217 | 13-line recipe mirroring Plan 18-01's pilot at add.ts:160-169 with the autoupdate-specific mp.status values + D-16-06 caller-order note + catalog UAT fixture line references |

**Recipe block-comment location:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:202-217` -- 13 lines directly above the `notify(opts.ctx, opts.pi, { marketplaces })` call at line 237. Honors D-18-08-amendment's 6-15 line band (slightly above the planner's "6-10 lines" pilot target -- the broader 5-state mapping is harder to compress without losing the substitution table).

**5-state mapping in source (per outcome):**

| Outcome | mp.status | Optional reasons[] | Severity (computed) | Reload-hint (computed) |
|---------|-----------|--------------------|---------------------|------------------------|
| enable fresh | `"autoupdate enabled"` | omitted | info (undefined) | YES (`/reload to pick up changes`) |
| disable fresh | `"autoupdate disabled"` | omitted | info (undefined) | YES (`/reload to pick up changes`) |
| enable idempotent | `"skipped"` | `["already enabled"]` | "warning" | suppressed |
| disable idempotent | `"skipped"` | `["already disabled"]` | "warning" | suppressed |
| not-found (per-scope or missing-everywhere) | `"failed"` | omitted | "error" | suppressed |
| empty scopes | (marketplaces: []) | n/a | info (undefined) | suppressed |

**Caller-order discipline (D-16-06):** The V1 alphabetic sort at lines 178-180 is removed. The visible iteration order in multi-marketplace bare-form output is:

1. SC-6 outer loop: `["project", "user"]` when `opts.scope` is undefined; `[opts.scope]` otherwise.
2. Inner accumulator (per scope): `result.changed[]` entries pushed first, then `result.unchanged[]` entries.

For the MAU-2 mixed test seed `{ already (true), to-flip (false) }` with `enable: true`: `applyAutoupdateFlipInPlace` returns `changed: ["to-flip"]` and `unchanged: ["already"]`, so `to-flip` precedes `already` in the rendered output. The test absorbs this via presence + relative-order assertion (`message.indexOf("to-flip") < message.indexOf("already")`) rather than a single byte-equal string -- making the test robust to the orchestrator's accumulator-order semantics and the renderer's intra-block join discipline.

### Task 2 -- `tests/orchestrators/marketplace/autoupdate.test.ts`

12 tests updated: 9 byte-string flips, 4 new severity assertions (one per fresh/idempotent/failed state group + one severity assertion on the multi-marketplace MAU-2 test). The existing `makeCtx()` pattern recording `{ message, severity? }` tuples is preserved verbatim (D-18-06).

| Test (old line) | Surface | V1 byte | V2 byte | Severity assert |
|----------------:|---------|---------|---------|-----------------|
| 80 (MAU-1 enable fresh) | per-scope enable fresh | `● mp [project] <autoupdate>` | `● mp [project] (autoupdate enabled)\n\n/reload to pick up changes` | undefined (info) |
| 99 (MAU-1 disable fresh) | per-scope disable fresh | `● mp [project] <no autoupdate>` | `● mp [project] (autoupdate disabled)\n\n/reload to pick up changes` | undefined (info) |
| 115 (MAU-3 enable idempotent) | enable idempotent | `● mp [project] <autoupdate> {already enabled}` | `● mp [project] (skipped) {already enabled}` | "warning" |
| 131 (MAU-3 disable idempotent) | disable idempotent | `● mp [project] <no autoupdate> {already disabled}` | `● mp [project] (skipped) {already disabled}` | "warning" |
| 145 (MAU-4 missing field enable) | enable fresh from missing field | `● mp [project] <autoupdate>` | `● mp [project] (autoupdate enabled)\n\n/reload to pick up changes` | undefined (info) |
| 162 (MAU-4 missing field disable) | disable idempotent from missing field | `● mp [project] <no autoupdate> {already disabled}` | `● mp [project] (skipped) {already disabled}` | "warning" |
| 176 (MAU-2 bare-form multi) | bare-form mixed | regex `<autoupdate> {already enabled}` + `<autoupdate>$` | presence + relative-order + severity warning + reload-hint inclusion | "warning" (mixed -> worst-present) |
| 204 (CMC-10 empty scopes) | empty scopes | `(no marketplaces)` | `(no marketplaces)` (unchanged -- D-16-17 sentinel is identical V1/V2) | (untouched) |
| 212 (single-name user-scope) | user-only single flip | `● only [user] <autoupdate>` | `● only [user] (autoupdate enabled)\n\n/reload to pick up changes` | undefined (info) |
| 229 (state-lock failure) | lock-held -> error | regex `/Another pi-claude-marketplace operation is in progress/` | `⊘ only [project] (failed)` (per D-16-08, cause text not in user byte) | "error" |
| 260 (absent-from-both error) | missing-everywhere error | severity-only assertion | `⊘ absent-zzz-9999 [project] (failed)` + severity | "error" |
| 275 (NFR-5 grep) | git-import absence | unchanged | unchanged | n/a |

### Rule 3 deviation -- bootstrap-test transitive byte flips

`bootstrapClaudePlugin` composes `addMarketplace` (migrated in Plan 18-01) and `setMarketplaceAutoupdate` (migrated in this plan). The bootstrap test files hold byte-exact assertions on both composed notifications. Plan 18-02's V2 migration of `autoupdate.ts` caused `notifications[1]` in the clean/half-config tests and `notifications[0]` in the already-bootstrapped test to flip from the V1 marker-as-outcome shape to the V2 catalog shape. Per Rule 3 (auto-fix blocking issues directly caused by this task's changes) the affected byte assertions were updated; the plan's `coverage_constraints` require `npm run check` GREEN at the merge of this plan (per RESEARCH Risks #8).

| File | Test | Before | After |
|------|------|--------|-------|
| `tests/orchestrators/plugin/bootstrap.test.ts` | bootstrap (clean state) | `notifications[1]: "● claude-plugins-official [user] <autoupdate>"` | `"● claude-plugins-official [user] (autoupdate enabled)\n\n/reload to pick up changes"` |
| `tests/orchestrators/plugin/bootstrap.test.ts` | bootstrap (already bootstrapped) | `notifications[0]: "● claude-plugins-official [user] <autoupdate> {already enabled}"` | `"● claude-plugins-official [user] (skipped) {already enabled}"` + added severity warning assert |
| `tests/orchestrators/plugin/bootstrap.test.ts` | bootstrap (half-configured) | `notifications[0]: "● claude-plugins-official [user] <autoupdate>"` | `"● claude-plugins-official [user] (autoupdate enabled)\n\n/reload to pick up changes"` |
| `tests/edge/handlers/plugin/bootstrap.test.ts` | clean-state handler | `notifications[1]: "● claude-plugins-official [user] <autoupdate>"` | `"● claude-plugins-official [user] (autoupdate enabled)\n\n/reload to pick up changes"` |
| `tests/edge/handlers/plugin/bootstrap.test.ts` | whitespace-only-args handler | `notifications[1]: "● claude-plugins-official [user] <autoupdate>"` | `"● claude-plugins-official [user] (autoupdate enabled)\n\n/reload to pick up changes"` |

These do NOT migrate the bootstrap orchestrator (it remains untouched -- composes `addMarketplace` + `setMarketplaceAutoupdate` both already on V2 after this plan). The `notifications.some(/autoupdate/i.test(...))` clone-error assertion at the bottom of `tests/orchestrators/plugin/bootstrap.test.ts` remains correct (clone fails before autoupdate is reached; no notifications generated for autoupdate-related text).

## Verification

```
$ npm run check
typecheck     PASS
lint          PASS
format:check  PASS
test          PASS  1362 tests (1360 pass, 0 fail, 2 todo) -- IDENTICAL to Plan 18-01 baseline
```

Plan-specified invariants:

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -c "notifySuccess\|notifyWarning\|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | 0 | 0 |
| `grep -c 'from "../../presentation/' extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | 0 | 0 |
| Actual `notify(opts.ctx, opts.pi,` call sites in autoupdate.ts (excluding comments) | 4 | 4 (per-scope failure / missing-everywhere failure / empty-scopes / success-flip) |
| Recipe block-comment line count | 6-15 | 13 |
| catalog UAT (`tests/architecture/catalog-uat.test.ts`) byte-equality | GREEN | GREEN (3/3 tests pass) |
| `tests/orchestrators/marketplace/autoupdate.test.ts` | 12 tests pass | 12 tests pass |
| `tests/orchestrators/plugin/bootstrap.test.ts` (Rule 3 dep) | 4 tests pass | 4 tests pass |
| `tests/edge/handlers/plugin/bootstrap.test.ts` (Rule 3 dep) | 3 tests pass | 3 tests pass |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated 5 transitive byte assertions in bootstrap tests**

- **Found during:** Task 2 verification, observed in `npm run check` test phase (5 test failures across 2 bootstrap test files).
- **Issue:** `tests/orchestrators/plugin/bootstrap.test.ts` (3 sites) and `tests/edge/handlers/plugin/bootstrap.test.ts` (2 sites) hold byte-exact assertions on `notifications[i]?.message` for the second composed notification emitted by `setMarketplaceAutoupdate` inside `bootstrapClaudePlugin`. After this plan's V2 migration of autoupdate.ts, those bytes flipped from the V1 marker-as-outcome shape (`● claude-plugins-official [user] <autoupdate>` and `<autoupdate> {already enabled}` and `<autoupdate>` half-config) to the V2 catalog shape ((autoupdate enabled) + reload-hint, (skipped) + {already enabled} + severity warning). The plan's `files_modified` only enumerated `autoupdate.ts` and `autoupdate.test.ts`, but the plan's coverage_constraints + RESEARCH Risks #8 require `npm run check` GREEN at the merge of this plan.
- **Fix:** Updated only the byte strings + commentary on the 5 sites; added a severity-warning assertion to the idempotent-already-bootstrapped case to lock the D-18-05 ladder transitively. The bootstrap orchestrator + edge handler source files are NOT modified.
- **Files modified:** `tests/orchestrators/plugin/bootstrap.test.ts`, `tests/edge/handlers/plugin/bootstrap.test.ts`
- **Commit:** caee417

**2. [Rule 3 - Cosmetic] MAU-2 test absorbed order-change via relative-order assertion**

- **Found during:** Task 2 first test run (the bare-form mixed test failed because the planner's RESEARCH had hinted the order might be insertion-order, but the actual order is changed-first-then-unchanged per the orchestrator's accumulator loop).
- **Issue:** The plan's Task 2 step 7 noted "Asserting the EXACT iteration order is acceptable but only if the source's scopes-loop order is deterministic ... if not, adjust the test to assert presence + relative-order via two `assert.ok(...indexOf...)` checks rather than a single byte string." Because the accumulator pushes `result.changed[]` before `result.unchanged[]`, `to-flip` (changed) precedes `already` (unchanged) in the rendered output, opposite to the seed's `Object.entries` order. Either ordering is correct per D-16-06; the planner explicitly authorized this adjustment.
- **Fix:** Replaced the brittle byte-equal regex with a presence-plus-relative-order assertion plus a severity-warning assertion (mixed outcomes -> worst severity present, per the notify()-computed ladder). Added a commentary note explaining the accumulator-order semantics for downstream readers.
- **Files modified:** `tests/orchestrators/marketplace/autoupdate.test.ts`
- **Commit:** caee417

**3. [Rule 3 - Blocking] State-lock-failure test flipped from cause-text regex to V2 byte form**

- **Found during:** Task 2 first test run.
- **Issue:** The V1 test at line 229 (pre-migration) asserted `assert.match(notifications[0]!.message, /Another pi-claude-marketplace operation is in progress/)` against the cause-message text propagated by V1's `notifyError(errorMessage(err), err)`. In V2, per D-16-08, `cause?: Error` is confined to plugin-level variants -- the mp-level `(failed)` row carries only `{ name, scope, status: "failed", plugins: [] }` with no cause-chain surface. The user-visible byte is now `⊘ only [project] (failed)` regardless of whether the underlying error was a state-lock contention or a not-found.
- **Fix:** Flipped the regex to a byte-equal assertion on the V2 form + severity "error". Added a comment noting that the cause is preserved in error logs (V1 carry-forward Pi-API behaviour) but not in the rendered notification, per D-16-08. This is a documented consequence of the Phase 17.1 amended grammar; the catalog `failure-not-found` fixture binds the V2 byte form.
- **Files modified:** `tests/orchestrators/marketplace/autoupdate.test.ts`
- **Commit:** caee417

**4. [Rule 3 - Cosmetic] Updated header docblock in autoupdate.ts**

- **Found during:** Task 1 source review (the V1 docblock's marker-as-outcome legend would actively mislead downstream readers post-migration).
- **Issue:** Lines 5-20 of autoupdate.ts contained the V1 CMC-33 / MSG-GR-5 legend describing the `<autoupdate>` / `<no autoupdate>` marker forms and the "marker IS the outcome" discipline. All of that is factually wrong post-D-17.1-01 (the marker moved off this surface onto the list header).
- **Fix:** Rewrote the docblock to describe the V2 5-state mapping table, the severity/reload-hint computation rules, and the D-16-06 caller-order discipline (alphabetic sort dropped). Added a "CMC-33 / MSG-GR-5 retirement" callout explaining that the V1 marker-as-outcome shape is no longer emitted.
- **Rationale:** Leaving the V1 docblock would actively mislead future readers reading autoupdate.ts as a reference for the Wave 2 patterns.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`
- **Commit:** caee417

### Other deviations

None. The alphabetic-sort drop is per D-16-06 / D-18-05 (planned, not a deviation). The `MarketplaceNotFoundError` import + `shouldCollectNotFound` helper are retained verbatim from V1 (correct cross-scope behaviour). The `errorMessage` import was removed because V2 no longer surfaces the cause text on mp-level failures (D-16-08).

## Authentication Gates

None.

## V1 -> V2 Migration Status (autoupdate.ts only)

| Status | Count |
|--------|------:|
| V1 wrapper callsites remaining in autoupdate.ts | 0 |
| V2 notify() callsites in autoupdate.ts | 4 (per-scope failure, missing-everywhere failure, empty-scopes, success-flip) |
| `presentation/*` imports remaining in autoupdate.ts | 0 |
| Catalog UAT fixtures for autoupdate (Phase 17.1 5 states) | 5/5 GREEN |
| Local helpers retired (`buildAutoupdateRow`, `AutoupdateRowInput`) | 2 |
| Alphabetic sort dropped per D-16-06 | YES |

Marketplace-family aggregate V1 callsite count (across all 5 orchestrators):

```
$ grep -r "notifySuccess\|notifyWarning\|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/ | wc -l
33
```

Pre-Plan-18-02: 40 (per Plan 18-01 SUMMARY). Net -7 in this plan (4 V1 callsites in autoupdate.ts + 3 helper indirection points removed when `buildAutoupdateRow` was deleted; the 3 helpers in shared.ts may not all be autoupdate-attributable -- the residual 33 covers `remove.ts`, `update.ts`, `list.ts`, and `shared.ts`). Plans 18-03..05 will close the remaining 33.

## Threat Flags

None. Per the plan's `<threat_model>` block (T-18-02-01: accept), this is an internal API refactor; byte output is governed by the Phase 17.1 amended catalog binding contract; no new attack surface or auth/session change.

## Known Stubs

None. autoupdate.ts emits real V2 MarketplaceNotificationMessage payloads; no placeholder or hardcoded empty fields beyond `plugins: []` which is structurally required (D-15-08/09).

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` exists, compiles, and `grep -c "notifySuccess\|notifyWarning\|notifyError"` returns 0.
- File `tests/orchestrators/marketplace/autoupdate.test.ts` exists and 12/12 tests pass.
- File `tests/orchestrators/plugin/bootstrap.test.ts` exists and 4/4 tests pass (Rule 3 update).
- File `tests/edge/handlers/plugin/bootstrap.test.ts` exists and 3/3 tests pass (Rule 3 update).
- Commit `caee417` exists on the worktree branch and contains all 4 modified files.
- `npm run check` exits 0 (typecheck + lint + format:check + 1360 pass / 0 fail / 2 todo -- identical to Plan 18-01 baseline).
- Plan's verification invariants confirmed (grep counts 0 + 0; notify() actual call count 4; recipe lines 13).
- NotificationMessage construction recipe block-comment present at autoupdate.ts:202-217 (13 lines, within 6-15 band).
- No catalog UAT byte changes; UAT runner GREEN (5/5 autoupdate fixtures match).
- No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes per `parallel_execution` rules).
