---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 1
subsystem: edge
tags: [snm-23, notify-usage-error, mechanical-sweep, v1-to-v2-migration]
dependency_graph:
  requires:
    - "shared/notify.ts::notifyUsageError V2 overload (Phase 16 SNM-13)"
    - "shared/notify.ts::UsageErrorMessage interface (Phase 15 SNM-08)"
  provides:
    - "30 V2 1-arg `notifyUsageError(ctx, { message, usage })` callsites across 13 production edge files"
    - "Zero V1 3-arg `notifyUsageError(ctx, msg, usage)` callsites remain anywhere in extensions/pi-claude-marketplace/edge/**"
  affects:
    - "Plan 20-03 (catch-all wrapper teardown in bootstrap.ts + import.ts) -- `notifyError` mixed imports preserved unchanged so 20-03 can drop them with the catch-all"
    - "Phase 21 SNM-22 final teardown -- V1 3-arg overload at shared/notify.ts:127 now has zero callers across the entire edge layer; only orchestrators retain V1 callers until further Phase 21 sweeps"
tech-stack:
  added: []
  patterns:
    - "Inline V2 payload construction at each callsite per D-19-07 inheritance (CONTEXT line 149) -- no helper extraction"
    - "Object-property shorthand `{ message, usage }` where the callback parameter `message` and parser-passed `usage` variable carry the V1 positional values verbatim"
    - "Multi-line V2 object literal whenever Prettier wrapped the call after the swap (long `${interpolated}` messages or multi-prop layouts)"
key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/edge/router.ts (4 sites: lines 125, 148, 161, 181)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts (3 sites: lines 58, 85, 95)"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts (1 site: line 43)"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts (1 site: line 38)"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts (1 site: line 36)"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts (1 site: line 36)"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts (1 site: line 40)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts (3 sites: lines 40, 57, 65)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts (3 sites: lines 52, 65, 75)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts (3 sites: lines 36, 48, 61)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts (4 sites: lines 34, 44, 52, 86)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts (2 sites: lines 31, 36; `notifyError` co-import preserved at line 7)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts (3 sites: lines 38, 43, 49; `notifyError` co-import preserved at line 21)"
decisions:
  - "Strict mechanical-sweep discipline per D-20-01: 30 V1 3-arg callsites swapped to V2 1-arg object form with byte-identical wire output (renderer at shared/notify.ts:127-156 produces `${message}\\n\\n${usage}` at \"error\" severity for both overloads)."
  - "Inline payload construction at each callsite per D-19-07 (CONTEXT line 149) -- no helper extraction. Each swap is a single-line semantic edit; Prettier's 100-col width drove the multi-line layout for long callsites."
  - "Mixed `notifyError, notifyUsageError` imports preserved unchanged in import.ts (line 7) + bootstrap.ts (line 21). Plan 20-03 will drop `notifyError` together with the catch-all wrappers. Premature drop would have broken those files."
  - "Zero test edits -- verified upfront via `grep -rn 'notifyUsageError(' tests/edge/`: no test file constructs a V1 3-arg call directly. All assertions go through `makeCtx()`-recorded `${message}\\n\\n${usage}` byte strings which are invariant under the V1->V2 swap per D-20-06 (D-19-07 inheritance)."
  - "Atomic single-commit boundary -- both Task 1 (15 sites) and Task 2 (15 sites) landed in commit `ec1e795` per the plan's `npm run check` gate."
metrics:
  duration: "8 min"
  tasks: 2
  files: 13
  completed: 2026-05-27
requirements_addressed:
  - SNM-23
---

# Phase 20 Plan 1: Edge Handler `notifyUsageError` V2 Signature Sweep Summary

One-liner: 30 V1 3-arg `notifyUsageError(ctx, msg, USAGE)` callsites across 13 edge files migrated to the V2 1-arg structured form `notifyUsageError(ctx, { message: msg, usage: USAGE })` -- byte-invariant on the wire, atomic single commit, zero test edits required.

## Tasks Executed

### Task 1: 15 sites across 8 files (router + marketplace handlers + plugin/shared + plugin/list)

| File | Sites | Lines |
| ---- | ----- | ----- |
| `extensions/pi-claude-marketplace/edge/router.ts` | 4 | 125, 148, 161, 181 |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` | 3 | 58, 85, 95 |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` | 1 | 43 |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` | 1 | 38 |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` | 1 | 36 |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts` | 1 | 36 |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` | 1 | 40 |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` | 3 | 40, 57, 65 |

Task 1 subtotal: **15 sites**.

### Task 2: 15 sites across 5 files (plugin install/update/reinstall/import/bootstrap)

| File | Sites | Lines |
| ---- | ----- | ----- |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` | 3 | 52, 65, 75 |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` | 3 | 36, 48, 61 |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` | 4 | 34, 44, 52, 86 |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` | 2 | 31, 36 (notifyError co-import at line 7 STAYS) |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` | 3 | 38, 43, 49 (notifyError co-import at line 21 STAYS) |

Task 2 subtotal: **15 sites**.

**Phase-wide total: 30 V1 3-arg callsites retired; 30 V2 1-arg callsites added.**

## Commit

| Hash | Type | Message |
| ---- | ---- | ------- |
| `ec1e795` | `refactor(20)` | `refactor(20): migrate edge handler usageerror callsites to V2 1-arg (SNM-23)` |

13 files changed, 69 insertions(+), 34 deletions(-).

## Deviations from Plan

None -- plan executed exactly as written. The mechanical-sweep recipe applied verbatim to all 30 sites; no Shape A / B / C decisions required surprise handling; no test edits surfaced; no import-line changes; no architectural surprises; no auth gates.

## Verification

### Automated Gates (all GREEN)

- `node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/list.test.ts` -> 45/45 pass, 0 fail.
- `node --test tests/edge/handlers/plugin/install.test.ts tests/edge/handlers/plugin/update.test.ts tests/edge/handlers/plugin/reinstall.test.ts tests/edge/handlers/import.test.ts tests/edge/handlers/plugin/bootstrap.test.ts` -> 39/39 pass, 0 fail.
- `node --test tests/architecture/catalog-uat.test.ts` -> 3/3 pass (catalog UAT byte-equality through real `notifyUsageError` -- structural-shape gate per D-20-04).
- `npm run check` -> typecheck + lint + format + 1369/1371 tests pass (0 fail, 2 todo). Tests count matches the Phase 19 baseline exactly; no regressions.

### Phase-Wide Invariant Proofs

Verified post-commit:

- `grep -rcE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/` returns **0** -- no V1 3-arg string-literal-second-arg form remains.
- `grep -cE "notifyUsageError\(ctx,\s*\{" extensions/pi-claude-marketplace/edge/{router,handlers/plugin/shared,handlers/plugin/list,handlers/plugin/install,handlers/plugin/update,handlers/plugin/reinstall,handlers/plugin/import,handlers/plugin/bootstrap}.ts extensions/pi-claude-marketplace/edge/handlers/marketplace/*.ts` summed returns **30** -- the V2 form count matches the verified site count exactly (15 Task 1 + 15 Task 2).
- `grep -c "notifyError" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns ≥ 1 (the mixed `notifyError, notifyUsageError` import at line 7 + the catch-all wrapper at lines 47-50 STAY; Plan 20-03 drops them together).
- `grep -c "notifyError" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` returns ≥ 1 (the mixed import at line 21 + catch-all wrapper at lines 57-66 STAY; Plan 20-03 drops them together).

## Byte-Invariance Confirmation

The dual-overload renderer at `shared/notify.ts:127-156` produces byte-identical output for both V1 (3-arg) and V2 (1-arg) forms:

- V1: `ctx.ui.notify(\`${message}\\n\\n${usageBlock ?? ""}\`, "error")` (line 144).
- V2: `ctx.ui.notify(\`${message.message}\\n\\n${message.usage}\`, "error")` (line 149).

Both emit the on-the-wire string `${message}\\n\\n${usage}` at `"error"` severity. The migration was a signature change at callsites only -- wire form preserved exactly.

Consequence: every `makeCtx()`-recorded byte assertion (`assert.match(notifications[0]?.message ?? "", /Usage:/)` and exact-equality variants) stayed byte-identical without any test edit.

## Plan-Closure Status

- All success criteria met (atomic commit, zero V1 form, 30 V2 form, byte invariance, `npm run check` GREEN, catalog UAT GREEN, mixed imports preserved).
- SNM-23 migration half closed: V1 3-arg signature has zero remaining callers in the entire edge layer.
- SNM-22 deletion half stays open for Phase 21 (V1 wrapper deletion gate; orchestrators still have V1 callers until further Phase 20+ sweeps).
- Plan 20-02 and 20-03 are unblocked: 20-02 (V1 to V2 in remaining orchestrators) and 20-03 (catch-all wrapper teardown in import.ts + bootstrap.ts).

## Self-Check: PASSED

Verified before SUMMARY commit:

- All 13 production files exist and are tracked: `git status` shows only the committed changes; `git log --stat HEAD~1..HEAD` reports 13 files modified.
- Commit hash `ec1e795` exists: `git log --oneline -3` shows the commit as HEAD.
- No file deletions: `git diff --diff-filter=D --name-only HEAD~1 HEAD` returns empty.
- `npm run check` exit code 0 captured pre-commit; tests pass 1369/1371 (matches Phase 19 baseline; 0 fail, 2 todo).
- Catalog UAT byte-equality `tests/architecture/catalog-uat.test.ts` -> 3/3 pass.
