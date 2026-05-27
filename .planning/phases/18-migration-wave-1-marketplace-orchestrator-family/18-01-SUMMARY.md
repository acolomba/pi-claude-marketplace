---
phase: 18-migration-wave-1-marketplace-orchestrator-family
plan: 1
subsystem: marketplace-orchestrator-migration
tags: [migration, v1-to-v2, wave-1, plan-18-01, pilot, notify-recipe]
requires:
  - plan-18-00-pi-plumbing
  - phase-17.1-autoupdate-grammar
  - phase-17.2-renderscope-fix
provides:
  - add-ts-v2-migration
  - notification-message-construction-recipe
  - wave-2-mirror-template
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts (Rule 3)
  - tests/edge/handlers/plugin/bootstrap.test.ts (Rule 3)
tech-stack:
  added: []
  patterns:
    - "notify(opts.ctx, opts.pi, { marketplaces: [{ name, scope, status, plugins: [] }] }) -- single V2 call replacing 2 V1 wrappers"
    - "NotificationMessage construction recipe block-comment (10 lines) directly above the notify() call site"
    - "Cache-leak warning DROP via D-18-01 precedent extension (empty catch block, no second notify())"
key-files:
  created:
    - .planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-01-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/edge/handlers/plugin/bootstrap.test.ts
decisions:
  - "D-18-08-amendment honored: 10-line NotificationMessage construction recipe block-comment above the notify() call site at add.ts:160-169 (within the planner's 6-10 line band). Wave 2 (Plans 18-02..05) literally mirrors it."
  - "D-18-01 precedent extension honored: cache-leak warning at the former line 141 DROPPED entirely; surrounding try/catch retained with an explanatory comment so the cache-refresh failure is still swallowed."
  - "D-18-06 implicit consequence honored: 4 byte-string flips + 1 boolean reload-hint flip in add.test.ts; existing makeCtx() pattern recording { message, severity } tuples preserved verbatim."
  - "Rule 3 deviation: 3 transitive byte assertions in bootstrap tests (1 orchestrator + 2 edge handler) flipped from V1 to V2 because bootstrap composes addMarketplace; the second notification (from autoupdate.ts, still V1) keeps its V1 shape until Plan 18-02."
metrics:
  duration_minutes: 13
  duration_seconds: 804
  completed: 2026-05-27
---

# Phase 18 Plan 1: `add.ts` V1 -> V2 Pilot Migration Summary

Pilot migration of `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`
from the V1 severity-named wrappers (`notifySuccess` + `notifyWarning`, 2
callsites) to the V2 structured entry point `notify(opts.ctx, opts.pi,
NotificationMessage)`. Locks the V2 NotificationMessage construction recipe so
Wave 2 (Plans 18-02..05) can mirror it verbatim across the remaining 4
marketplace orchestrators.

## What Was Built

### Task 1 -- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`

| Change | Location | Detail |
|--------|----------|--------|
| Drop V1 import | line 53/55/63 (old) | Removed `renderRow` + `MARKETPLACE_LABEL_PROBE` + `notifySuccess, notifyWarning` |
| Drop V1 type import | line 72 (old) | Removed `MarketplaceRow` type import from presentation/compact-line.ts |
| Add V2 import | new line 61 | `import { notify } from "../../shared/notify.ts";` |
| Drop cache-leak warning | old lines 149-154 | The `notifyWarning(opts.ctx, \`Marketplace ... cache refresh deferred ...\`)` is gone; the surrounding try/catch keeps its swallowing semantics with an explanatory comment (D-18-01 precedent) |
| Update header docblock | lines 27-35 | Old `renderRow(MarketplaceRow)` block replaced with V2 `notify(opts.ctx, opts.pi, ...)` description; cross-references the recipe block-comment |
| Add construction recipe | new lines 160-169 (10 comment lines) | The Wave 2 mirror template -- discriminator (`mp.status === "added"`), plugins: [] requirement, severity + reload-hint computed by notify(), catalog UAT fixture key + line, D-18-08-amendment rationale |
| Replace V1 success call | old lines 161-169 -> new lines 170-180 | `notify(opts.ctx, opts.pi, { marketplaces: [{ name: recordedName, scope: opts.scope, status: "added", plugins: [] }] });` -- both github + path source kinds collapse to the same V2 shape (no marker, no source-kind conditional) |

**Recipe block-comment location:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:160-169` -- 10 comment lines directly above the `notify(opts.ctx, opts.pi, ...)` call at line 170. Wave 2 agents find it via `grep -n "NotificationMessage construction recipe" extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`.

**Verbatim recipe (paraphrased for downstream agents):**

```
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

Wave 2 substitution table (the only varying part across plans):

| Plan | Orchestrator | mp.status values |
|------|--------------|-----------------|
| 18-02 | autoupdate.ts | `"autoupdate enabled"`, `"autoupdate disabled"`, `"skipped"` (with reasons), `"failed"` |
| 18-03 | list.ts | `undefined` (list-surface arm; uses `details: MarketplaceDetails`) |
| 18-04 | remove.ts | `"removed"` (clean), `"failed"` (partial; cascade restructured per D-18-03) |
| 18-05 | update.ts | `"updated"`, `"failed"` (mp-level), mixed-outcomes cascade |

### Task 2 -- `tests/orchestrators/marketplace/add.test.ts`

4 byte-string flips + 1 boolean reload-hint flip; existing makeCtx() preserved verbatim per D-18-06.

| Old line | Surface | V1 byte | V2 byte |
|---------:|---------|---------|---------|
| 91 (now 99-102) | github-source success | `● valid-marketplace [project] <autoupdate> (added)` | `● valid-marketplace [project] (added)\n\n/reload to pick up changes` |
| 94 (now 106) | reload-hint includes() boolean | `false` | `true` (D-18-06 implicit consequence) |
| 295 (now 305-309) | path-source success | `● valid-marketplace [project] (added)` | `● valid-marketplace [project] (added)\n\n/reload to pick up changes` |
| 373 (now 392-395) | tilde-path source | `● valid-marketplace [project] (added)` | `● valid-marketplace [project] (added)\n\n/reload to pick up changes` |
| 60 (now 60) | test name (cosmetic) | `MA-5 + MA-11: ... NO reload hint` | `MA-5: ... emits V2 success message with reload-hint trailer (D-18-06 flip)` |

Untouched (per plan): state-mutation assertions, gitOps.cloneCalls counts, error-throw assertions, NFR-5 path-source-no-git assertions, MA-9 leak-cleanup assertion, CMP-1 cross-scope independence, substring `[project]` assertion at line 400, severity assertions (`assert.equal(note.severity, undefined)`), the `[project]` includes() assertion.

Verified per plan: `grep -in "cache-leak\|completion cache refresh deferred" tests/orchestrators/marketplace/add.test.ts` returns 0 lines -- no cache-leak tests existed pre-migration; no deletions needed.

### Rule 3 deviation tasks (out of plan's `files_modified`, in scope of `npm run check` GREEN constraint)

`bootstrapClaudePlugin` composes `addMarketplace` and `setMarketplaceAutoupdate`; the existing bootstrap test files assert on the byte form of BOTH composed notifications. Plan 18-01's V2 migration of add.ts caused `notifications[0]` to flip from V1 to V2 bytes, breaking these tests transitively. The plan's coverage_constraints require `npm run check` GREEN at the merge of this plan (per RESEARCH Risks #8), so per Rule 3 (auto-fix blocking issues directly caused by this task's changes) the affected byte assertions were updated.

| File | Line(s) | Change |
|------|---------|--------|
| `tests/orchestrators/plugin/bootstrap.test.ts` | 149-156 | `notifications[0]` flipped from `● claude-plugins-official [user] <autoupdate> (added)` to V2 byte; commentary updated; `notifications[1]` (autoupdate V1 shape) kept verbatim |
| `tests/edge/handlers/plugin/bootstrap.test.ts` | 108-118 | Same flip for clean-state handler test |
| `tests/edge/handlers/plugin/bootstrap.test.ts` | 138-146 | Same flip for whitespace-only-args handler test |

These do NOT migrate the bootstrap orchestrator or the autoupdate orchestrator (both remain V1 calling V1 wrappers); they only update the inherited V2 byte that add.ts now emits. Plan 18-02 will own the V2 migration of autoupdate.ts and the `notifications[1]` flip in the same bootstrap tests.

## Verification

```
$ npm run check
typecheck     PASS
lint          PASS
format:check  PASS
test          PASS  1362 tests (1360 pass, 0 fail, 2 todo) -- IDENTICAL to Plan 18-00 baseline
```

Plan-specified invariants:

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -c "notifySuccess\|notifyWarning\|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | 0 | 0 |
| `grep -c 'from "../../presentation/' extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | 0 | 0 |
| `notify(opts.ctx, opts.pi` actual call sites in add.ts (excluding comments) | 1 | 1 |
| Recipe block-comment line count (lines starting with `//`) | 6-10 | 10 |
| catalog UAT (`tests/architecture/catalog-uat.test.ts`) byte-equality | GREEN | GREEN (3/3 tests pass) |
| `tests/orchestrators/marketplace/add.test.ts` | 13 tests pass | 13 tests pass |
| `tests/orchestrators/plugin/bootstrap.test.ts` (Rule 3 dep) | 4 tests pass | 4 tests pass |
| `tests/edge/handlers/plugin/bootstrap.test.ts` (Rule 3 dep) | 3 tests pass | 3 tests pass |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated 3 transitive byte assertions in bootstrap tests**

- **Found during:** Task 2 verification, observed in `npm run check` test phase
- **Issue:** `tests/orchestrators/plugin/bootstrap.test.ts` (1 site) and `tests/edge/handlers/plugin/bootstrap.test.ts` (2 sites) hold byte-exact assertions on `notifications[0]?.message` which is emitted by `addMarketplace` composed inside `bootstrapClaudePlugin`. After Plan 18-01's V2 migration of add.ts, those bytes flipped from the V1 shape (`● <mp> [user] <autoupdate> (added)`) to the V2 shape (`● <mp> [user] (added)\n\n/reload to pick up changes`). The plan's `files_modified` only enumerated `add.ts` and `add.test.ts`, but the plan's coverage_constraints say `npm run check` MUST be GREEN at the merge of this plan (RESEARCH Risks #8).
- **Fix:** Updated only the byte string + commentary on the 3 sites. `notifications[1]` (the autoupdate V1 shape) is intentionally NOT touched -- it stays V1 until Plan 18-02 migrates autoupdate.ts. No other test assertions or call sites changed; the bootstrap orchestrator and the autoupdate orchestrator themselves are NOT migrated by this plan.
- **Files modified:** `tests/orchestrators/plugin/bootstrap.test.ts`, `tests/edge/handlers/plugin/bootstrap.test.ts`
- **Commit:** 6e8ed45

**2. [Rule 3 - Blocking] Updated stale header docblock in add.ts**

- **Found during:** Task 1 source review
- **Issue:** Lines 27-31 of add.ts contained a stale V1 commentary block referencing `renderRow(MarketplaceRow)`, the (github-source) `<autoupdate> (added)` marker form, and `MA-11 / RH-1: NO reload hint here`. All three are factually wrong post-migration (no renderRow, no marker on this surface, reload-hint IS emitted).
- **Fix:** Rewrote the 5 stale lines as 9 V2-accurate lines describing the V2 notify() call, the marker movement to the list surface, and the D-16-12 reload-hint trigger; cross-referenced the construction recipe block-comment.
- **Rationale:** Leaving the stale docblock would actively mislead Wave 2 planners reading add.ts as the pilot reference.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`
- **Commit:** 6e8ed45

**3. [Rule 3 - Cosmetic] Renamed first test from `MA-5 + MA-11: ... NO reload hint` to `MA-5: ... emits V2 success message with reload-hint trailer (D-18-06 flip)`**

- **Found during:** Task 2 review
- **Issue:** The original test name asserted "NO reload hint" -- factually wrong post-D-18-06 flip (the assertion at the bottom now asserts reload-hint IS present).
- **Fix:** One-line test name change to reflect the V2 contract and reference D-18-06.
- **Files modified:** `tests/orchestrators/marketplace/add.test.ts`
- **Commit:** 6e8ed45

### Other deviations

None. The cache-leak warning DROP is per D-18-01 precedent extension (planned, not a deviation).

## Authentication Gates

None.

## V1 -> V2 Migration Status (add.ts only)

| Status | Count |
|--------|------:|
| V1 wrapper callsites remaining in add.ts | 0 |
| V2 notify() callsites in add.ts | 1 |
| `presentation/*` imports remaining in add.ts | 0 |
| Catalog UAT fixtures for `add` source still GREEN | 3/3 (path-source, github-source, failure-unreachable) |

Marketplace-family aggregate V1 callsite count (across all 5 orchestrators):

```
$ grep -r "notifySuccess\|notifyWarning\|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/ | wc -l
40
```

Pre-Plan-18-01: 42 (per Plan 18-00 SUMMARY). Net -2 in this plan (`notifySuccess` + `notifyWarning` from add.ts). Plans 18-02..05 will close the remaining 40.

## Threat Flags

None. Per the plan's `<threat_model>` block (T-18-01-01: accept), this is an internal API refactor; byte output is governed by the Phase 17 catalog binding contract; no new attack surface or auth/session change.

## Known Stubs

None. add.ts now emits real V2 NotificationMessage payloads; no placeholder or hardcoded empty fields beyond `plugins: []` which is structurally required (D-15-08/09).

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` exists and compiles.
- File `tests/orchestrators/marketplace/add.test.ts` exists and 13/13 tests pass.
- File `tests/orchestrators/plugin/bootstrap.test.ts` exists and 4/4 tests pass.
- File `tests/edge/handlers/plugin/bootstrap.test.ts` exists and 3/3 tests pass.
- Commit `6e8ed45` exists on the worktree branch and contains all 4 modified files.
- `npm run check` exits 0 (typecheck + lint + format:check + 1360 pass / 0 fail / 2 todo).
- Plan's verification invariants confirmed (grep counts 0 + 0; notify() call count 1; recipe lines 10).
- NotificationMessage construction recipe block-comment present at add.ts:160-169 (10 lines, within 6-10 band).
- No catalog UAT byte changes; UAT runner GREEN.
- No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes per parallel_execution rules).
