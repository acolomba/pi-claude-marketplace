---
phase: 19-migration-wave-2-plugin-orchestrator-family
plan: 1
subsystem: plugin-orchestrator-migration
tags: [migration, v1-to-v2, wave-1, plan-19-01, pilot, notify-recipe, plugin-family]
requires:
  - phase-18-marketplace-orchestrator-family
  - phase-17.1-autoupdate-grammar
  - phase-17.2-renderscope-fix
provides:
  - uninstall-ts-v2-migration
  - notification-message-cascade-recipe
  - wave-2-mirror-template-for-plugin-family
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - tests/orchestrators/plugin/uninstall.test.ts
tech-stack:
  added: []
  patterns:
    - "notify(ctx, pi, { marketplaces: [{ name, scope, plugins: [<PluginNotificationMessage>] }] }) -- single V2 call per orchestration arm; bare-label marketplace header (status omitted) for plugin-uninstall surface per docs/output-catalog.md:340-378"
    - "NotificationMessage cascade recipe block-comment (11 lines) directly above the success-arm notify() call site"
    - "Inline narrowCascadeFailure() helper -- typed-cause dispatch mirroring orchestrators/marketplace/remove.ts:126 precedent (instanceof AgentsUnstageFailureError; NodeJS.ErrnoException.code) maps thrown errors to closed-set Reasons for PluginFailedMessage.reasons"
    - "Two DROPPED post-state-commit warnings (cache-refresh failure + data-dir cleanup-leak) per D-19-01: surrounding try/catch retained; side-effecting rm()/dropMarketplaceCache calls still fire; only user-visible warning surface gone"
key-files:
  created:
    - .planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-01-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - tests/orchestrators/plugin/uninstall.test.ts
decisions:
  - "D-19-01 (DROP precedent expanded for plugin family): cache-refresh failure (was uninstall.ts:179) and data-dir cleanup-leak (was uninstall.ts:200) DROPPED entirely; try/catch retained with explanatory comment citing D-18-01 lineage."
  - "D-19-02 (inline construction in orchestrator) honored: no presentation/cascade-summary modifications; payload built inline above the notify() call."
  - "D-19-05 (pilot recipe block-comment placement) honored: 11-line NotificationMessage cascade recipe at uninstall.ts:303-313 -- Wave 2 finds it via grep."
  - "D-19-06 (disjoint file pair) honored: only uninstall.ts + uninstall.test.ts touched among orchestrators/tests."
  - "D-19-07 (test discipline) honored: byte-exact V2 assertions through real notify() via existing makeCtx(); makeCtx() preserved verbatim; deleted assertions targeting dropped warnings; severity assertions retain undefined/error form."
  - "D-16-04/11/12/14 (renderer-as-spec; severity / reload-hint / soft-dep computed by notify()) honored: orchestrator passes no severity; reload-hint computed from PluginUninstalledMessage status (uninstalled is state-changing per D-16-12)."
  - "V2 behavior change documented: PU-8 zero-dropped reload-hint suppression is GONE -- V2 emits the trailer structurally from the PluginUninstalledMessage status, NOT from cascade-outcome resource count."
  - "narrowCascadeFailure: AgentsUnstageFailureError -> \"not in manifest\" (closed-set permissive fallback; mirrors orchestrators/marketplace/remove.ts narrowCascadeFailure); EACCES/EPERM -> \"permission denied\"; ENOENT -> \"source missing\". No new REASONS entries needed."
metrics:
  completed: 2026-05-27
---

# Phase 19 Plan 1: `uninstall.ts` V1 -> V2 Pilot Migration Summary

Wave 1 pilot for Phase 19's plugin orchestrator family. Migrates
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` from the V1
severity-named wrappers (`notifySuccess` + `notifyWarning` + `notifyError`, 5
callsites) to the V2 structured entry point `notify(ctx, pi,
NotificationMessage)` (one call per orchestration arm) and locks the V2
NotificationMessage cascade construction recipe so Wave 2 (Plans 19-02..05) can
mirror it byte-exactly across the remaining 4 plugin orchestrators.

## What Was Built

### Task 1 -- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`

| Change | Final location | Detail |
|--------|---------------:|--------|
| Drop V1 wrapper imports | (was line 43) | Removed `notifyError, notifySuccess, notifyWarning` |
| Drop `presentation/*` composer imports | (was lines 39-40 + 50) | Removed `renderRow` (compact-line) + `appendReloadHint, reloadHint` (reload-hint) + the `PluginInlineUninstalledRow` type import |
| Drop unused helpers | (was line 38, 42) | Removed `softDepStatus` (V2's notify() owns the single probe per D-16-14) + `appendLeaks` (no longer needed -- cleanup-leak warning is DROPPED) |
| Add V2 imports | new lines 54-55 | `import { notify } from "../../shared/notify.ts";` + `AgentsUnstageFailureError` from `../marketplace/shared.ts` for typed-cause narrowing |
| Add V2 type imports | new lines 61-65 | `Reason`, `PluginFailedMessage`, `PluginUninstalledMessage` |
| Add `narrowCascadeFailure` helper | new lines 94-123 | Typed-cause dispatch mirroring `orchestrators/marketplace/remove.ts:126`; maps `AgentsUnstageFailureError`/errno codes to closed-set `Reason` for `PluginFailedMessage.reasons` |
| Replace V1 failure notify | (was line 160; now lines 211-235) | One V2 `notify()` call with `PluginFailedMessage` carrying `reasons: [narrowCascadeFailure(cause)]`, `cause: err`, and `version` when present. Severity (`error`) + no reload-hint computed by notify() per D-16-11 + D-16-12 |
| DROP cache-refresh warning | (was lines 179-182; now lines 252-258) | Try/catch retained; `dropMarketplaceCache(...)` still fires inside try; D-19-01 explanatory comment in catch body |
| DROP data-dir cleanup-leak warning | (was lines 199-203; now lines 263-273) | Try/catch retained; `rm(dataDir, ...)` still fires; D-19-01 explanatory comment in catch body |
| Replace V1 success notify (single + defensive arms) | (were lines 232 + 246; now lines 297-322) | Consolidated into ONE V2 `notify()` call with `PluginUninstalledMessage`. The defensive-guard branch was removed -- the surviving notify() emits the same V2 byte shape regardless of cascade outcome shape |
| Add recipe block-comment | new lines 303-313 (11 lines) | Wave 2 mirror template (header + 9 content lines + 1 reference line) directly above the success-arm notify() call |

**Recipe block-comment location:**
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:303-313`
(11 comment lines directly above the `notify(ctx, pi, ...)` call at line 314).
Wave 2 agents find it via:

```
grep -n "NotificationMessage cascade recipe" \
  extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
```

**Verbatim recipe text:**

```
// NotificationMessage cascade recipe (Plan 19-01 pilot; Wave 2 mirrors).
// - One MarketplaceNotificationMessage per affected marketplace, emitted
//   via a single notify(opts.ctx, opts.pi, ...) call per orchestration.
// - plugins: readonly PluginNotificationMessage[] in display order
//   (orchestrator-controlled iteration per D-16-06; notify() does not sort).
// - Discriminators by status: "uninstalled" here. Plans 19-02..05 mirror
//   with their own status sets: installed/updated/reinstalled/failed/
//   skipped/manual recovery/available/unavailable/upgradable.
// - Severity + "/reload to pick up changes" trailer are computed by notify()
//   per D-16-11 + D-16-12; callers MUST NOT compose them.
// - Reference: catalog UAT plugin-uninstall fixtures at docs/output-catalog.md:340-378.
```

**Wave 2 substitution table** (the only varying part across plans -- the
discriminator status set):

| Plan | Orchestrator | Plugin variant status set used in the cascade |
|------|--------------|-----------------------------------------------|
| 19-02 | install.ts | `"installed"`, `"failed"` (with `rollbackPartial?: readonly { phase; cause? }[]` for the install-failure-with-rollback-partial path per D-19-03) |
| 19-03 | list.ts | `"available"`, `"unavailable"`, `"upgradable"`, `"failed"` (list surface) |
| 19-04 | reinstall.ts | `"reinstalled"`, `"skipped"`, `"failed"`, `"manual recovery"` (cascade + structural manual-recovery anchor row per D-19-02) |
| 19-05 | update.ts | `"updated"` (with required `from`/`to` per D-15-04), `"skipped"`, `"failed"` (cascade) |

### Task 2 -- `tests/orchestrators/plugin/uninstall.test.ts`

V2 byte-string flips + dropped-warning assertion deletion + V2 reload-hint
behavior-change flip. Existing `makeCtx()` (lines 49-66) preserved verbatim per
D-19-07.

| Test | V1 surface | V2 result |
|------|-----------|-----------|
| PU-1 (success cascade order + reload-hint) | regex `/○ hello@mp \[project\] v\S+ \(uninstalled\)/` matching V1 compact-line shape | byte-exact assert against `● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes` |
| PU-2 + PU-4 (state commit BEFORE cleanup; cleanup-leak warning) | TWO assertions: `severity === "warning"` + `/cleanup partial/i` match + dataDir-included match | DROPPED per D-19-01. Only the V2 success notification is asserted; defense-in-depth assertion confirms the dropped warning's leaked-path text does NOT appear. State-record-removal invariant retained. Test renamed: PU-2-only (was PU-2 + PU-4) |
| PU-3 + PU-7 (foreign agent content -> notifyError) | regex `/Failed to remove .* agent/i` match against `notifications[0].message` | V2 byte-prefix assert against `● mp [project]\n  ⊘ hello v0.0.1 (failed) {not in manifest}\n` + retained regex backstop confirming the agents-bridge error text still surfaces verbatim in the 4-space cause-chain trailer (D-16-08) + asserts `/reload to pick up changes` is NOT present per docs/output-catalog.md:376 |
| PU-8 (a) reload-hint present when >=1 dropped | regex `/\/reload to pick up changes$/` | byte-exact assert against `● mp [project]\n  ○ lonely v0.0.1 (uninstalled)\n\n/reload to pick up changes`; test renamed: "uninstalled variant -> reload-hint always emitted by notify() per D-16-12" |
| PU-8 (b) zero-dropped -> NO reload-hint | `.includes("/reload to pick up changes") === false` (V1: hint suppressed when cascade dropped 0) | **V1->V2 behavior change**: V2 emits reload-hint structurally from `PluginUninstalledMessage` status per D-16-12, NOT from cascade-outcome resource count. New assertion is byte-exact `● mp [project]\n  ○ empty v0.0.1 (uninstalled)\n\n/reload to pick up changes`. Test renamed: "V2 per-variant reload-hint -- emitted on uninstalled even with zero dropped (cascade stub)" |
| MSG-SD-3 (soft-dep markers structurally absent) | Type reference: `PluginInlineUninstalledRow` | Updated to `PluginUninstalledMessage` (V2 type name); behavior assertion unchanged (no soft-dep marker bytes) |
| PU-5 / PU-6 / NFR-5 / D-03-INV | unchanged | unchanged (silent-converge, legacy state migration, no-git-surface, completion-cache invalidation -- all behavioral assertions outside the V2 notification rendering layer) |

**Test count assertion flips:** All tests with `notifications.length === 1` stay
at 1 (V1 + V2 both emit exactly one notification per orchestration on the
relevant paths). PU-2 originally asserted length=1 (V1 was 1 too -- the warning
was the only notification on the cleanup-leak path), so no length flip was
needed; only the warning-content assertions were deleted.

**Deleted assertions** (per D-19-07 test-count consequence of D-19-01):

- PU-2's `assert.equal(notifications[0]?.severity, "warning")` (V1 cleanup-leak surface)
- PU-2's `assert.match(notifications[0]?.message ?? "", /cleanup partial/i)` (V1 warning text)
- PU-2's `assert.ok((notifications[0]?.message ?? "").includes(dataDir), ...)` (V1 leaked-path assertion)

No "cache refresh deferred" / "data dir.*deferred" assertions existed
pre-migration (the cache-refresh warning was not test-covered in V1 either), so
no deletions were needed for those surfaces.

## Verification

### Plan invariants

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -cE "notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | 0 | 0 |
| `grep -c "NotificationMessage cascade recipe" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | 1 | 1 |
| `grep -c 'from "../../presentation/' extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | 0 | 0 |
| `notify(ctx, pi, ...)` call sites in uninstall.ts (failure arm + success arm) | 2 | 2 |
| Recipe block-comment line count | 6-10 (planner band) / 10+1 (plan-action target) | 11 (1 header + 9 content + 1 reference) |
| `grep -c "cache refresh deferred" tests/orchestrators/plugin/uninstall.test.ts` | 0 | 0 |
| `grep -c "data dir.*deferred" tests/orchestrators/plugin/uninstall.test.ts` | 0 | 0 |
| `grep -c "notifications.length, 2" tests/orchestrators/plugin/uninstall.test.ts` | 0 | 0 |
| `grep -c "(uninstalled)\\\\n\\\\n/reload to pick up changes" tests/orchestrators/plugin/uninstall.test.ts` | >=1 | 4 |

### Test pipeline

```
$ node --test tests/orchestrators/plugin/uninstall.test.ts
# tests 11
# pass 11
# fail 0

$ node --test tests/architecture/catalog-uat.test.ts
# tests 3
# pass 3
# fail 0

$ npm run check
typecheck     PASS
lint          PASS
format:check  PASS
test          1365 tests / 1363 pass / 0 fail / 2 todo (identical to Phase 18 baseline)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import order corrected by ESLint**

- **Found during:** post-Task-1 `npm run check`
- **Issue:** Initial draft placed the `type` import block in the order
  `notify.ts -> pi-api.ts -> reasons.ts`. ESLint's `import-x/order` rule
  requires alphabetical ordering of type imports within their group:
  `pi-api.ts -> reasons.ts -> notify.ts -> types.ts -> marketplace/shared.ts`.
- **Fix:** Reordered the type import block once before commit.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
- **Commit:** f8ed33e

**2. [Rule 3 - Blocking] Prettier formatting on the consolidated type import block**

- **Found during:** post-Task-1 `npm run check`
- **Issue:** The multi-line `import type { PluginFailedMessage, PluginUninstalledMessage } from "..."` block was a single-line short enough to fit on one line; Prettier collapsed it.
- **Fix:** `npx prettier --write` collapsed the block to a single line.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
- **Commit:** f8ed33e

### Behavior changes documented in the plan (not deviations)

**1. PU-8 (b) reload-hint flip**

The V1 contract suppressed the reload-hint when the cascade reported zero
dropped resources. V2 emits the trailer structurally from the
`PluginUninstalledMessage` status per D-16-12 -- the trigger ladder is
per-variant, not per-cascade-outcome resource count. The plan's
`must_haves.byte_contracts` documents this on the single-shot success
arm. PU-8 (b)'s assertion is flipped to expect the trailer; the test name
is updated to reflect the new V2 contract. NOT a deviation -- this is the
V1->V2 behavior shift the plan explicitly requires.

**2. Test PU-2 + PU-4 renamed to PU-2-only**

The PU-4 warning surface (data-dir cleanup-leak named the leaked path)
is gone in V2 per D-19-01. The PU-2 state-commit-BEFORE-cleanup invariant
is still binding and still asserted: the state record is removed even
when the post-state-commit `rm()` fails. The test was renamed but its
behavioral asserts retained. Defense-in-depth assertion confirms the
dropped warning's leaked-path text does NOT appear on any V2 notification.

### Other deviations

None. All other plan steps executed verbatim.

## Authentication Gates

None.

## V1 -> V2 Migration Status (uninstall.ts only)

| Status | Count |
|--------|------:|
| V1 wrapper callsites remaining in uninstall.ts | 0 |
| V2 notify() callsites in uninstall.ts | 2 (failure + success arms) |
| `presentation/*` imports remaining in uninstall.ts | 0 |
| V1 wrapper callsites DROPPED entirely per D-19-01 | 2 (cache-refresh failure + data-dir cleanup-leak) |
| Catalog UAT plugin-uninstall fixtures still GREEN | 3/3 (success, success-soft-dep-omitted, failure-permission-denied) |

Plugin-family aggregate V1 callsite count (all 5 plugin orchestrators):

```
$ grep -rE "notify(Success|Warning|Error)\(" \
    extensions/pi-claude-marketplace/orchestrators/plugin/*.ts | wc -l
25
```

Pre-Plan-19-01: 30 V1 callsites (5+8+3+7+7 per 19-RESEARCH.md / 19-CONTEXT.md
canonical_refs). Net -5 in this plan (1 notifyError + 2 notifyWarning + 2
notifySuccess from uninstall.ts). Plans 19-02..05 will close the remaining 25.

## Threat Flags

None. Per the plan's `<threat_model>` block, Phase 19 Plan 19-01 is an internal
API refactor:

- T-19-01-01 (cause-chain information disclosure): `accept` -- V2 inherits the
  existing V1 cause-message behavior verbatim; the depth-5 walk (MSG-CC-1)
  applies at the same indent. No new disclosure.
- T-19-01-02 (notification flooding): `mitigate` -- V2 emits exactly one
  notification per orchestration vs V1's worst-case 3 (success + cache-refresh
  warning + cleanup-leak warning).
- T-19-01-03 (severity tampering): `mitigate` -- V2 `notify(ctx, pi, message)`
  signature has no severity argument; renderer-derived per D-16-11; orchestrator
  cannot misclassify.

## Known Stubs

None. The V2 emissions construct real `PluginUninstalledMessage` /
`PluginFailedMessage` payloads with all required fields populated from runtime
state (the marketplace name, scope, plugin name, version, error cause, and
narrowed Reason are all carried verbatim).

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
  exists, compiles under strict TypeScript, and passes ESLint + Prettier.
- File `tests/orchestrators/plugin/uninstall.test.ts` exists and 11/11 tests
  pass.
- Commit `f8ed33e` exists on the worktree branch and contains both modified
  files.
- `npm run check` exits 0 (typecheck + lint + format:check + 1363 pass / 0 fail
  / 2 todo).
- Catalog UAT runner `tests/architecture/catalog-uat.test.ts` exits 0 with 3/3
  subtests passing (byte-equality through real `notify()` is preserved end-to-end
  for plugin-uninstall fixtures).
- Plan's verification invariants confirmed: V1-wrapper grep returns 0;
  recipe-block-comment grep returns 1; presentation/* import grep returns 0;
  V2 notify() call sites count = 2; test-file dropped-warning greps return 0;
  test-file V2-success-byte grep returns 4.
- Recipe block-comment present at `uninstall.ts:303-313` (11 lines).
- No modifications to STATE.md, ROADMAP.md, or REQUIREMENTS.md (orchestrator
  owns those writes per `<parallel_execution>` rules).
