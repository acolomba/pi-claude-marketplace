---
phase: 19-migration-wave-2-plugin-orchestrator-family
plan: 5
subsystem: plugin-orchestrator-migration
tags: [migration, v1-to-v2, wave-2, plan-19-05, plugin-update, version-arrow, rollback-partial]
requires:
  - phase-19-plan-19-01-uninstall-pilot
  - phase-18-marketplace-orchestrator-family
  - phase-17.1-autoupdate-grammar
  - phase-17.2-renderscope-fix
provides:
  - update-ts-v2-migration
  - direct-path-aggregate-failure-shape-option-b
  - version-arrow-orchestrator-passes-plain-strings-renderer-formats
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/edge/handlers/plugin/update.test.ts
tech-stack:
  added: []
  patterns:
    - "notify(ctx, pi, { marketplaces: [{ name, scope, plugins: [<PluginNotificationMessage>] }] }) -- single V2 call per orchestration arm; bare-label marketplace header (status omitted) for plugin-update cascade per docs/output-catalog.md:489-568"
    - "PluginUpdatedMessage with REQUIRED from/to per D-15-04 -- orchestrator passes plain strings; renderer composes `<from> → v<to>` with asymmetric v-prefix"
    - "Inline notifyDirectFailure() helper consolidates 4 direct-path callsites (enumerate / syncClone / runThreePhaseUpdate / phase-3 aggregate) into a single Option B shape: synthetic PluginFailedMessage carrying the typed `cause` so the renderer's 4-space cause-chain trailer (D-16-08) preserves the V1 error text"
    - "Phase-3 aggregate failure threads UpdatePhaseFailure[] structurally into PluginFailedMessage.rollbackPartial[] (msg-synthesized Error per D-19-03 caveat -- UpdatePhaseFailure discards the unknown Phase3Failure.cause); renderer emits 4-space `[<phase>] (rollback failed)` + 6-space per-phase cause-chain per D-16-08"
    - "outcomeToCascadePluginMessage() narrows PluginUpdateOutcome's 4 partitions (updated/unchanged/skipped/failed) to discriminated PluginNotificationMessage variants; mirrors orchestrators/marketplace/update.ts:446 precedent. Unchanged maps to PluginSkippedMessage(reasons: ['up-to-date']) per catalog all-up-to-date-noop (docs/output-catalog.md:526-532)"
    - "ONE DROPPED post-success warning (completion-cache-refresh inside dropPluginCompletionCache) per D-19-01: surrounding try/catch retained; side-effecting dropMarketplaceCache() still fires; only user-visible standalone-mode warning surface gone"
key-files:
  created:
    - .planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-05-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/edge/handlers/plugin/update.test.ts
decisions:
  - "D-19-01 (DROP precedent for plugin family) honored: completion-cache-refresh warning at the V1 line 844 inside dropPluginCompletionCache DROPPED entirely; try/catch retained; side-effecting dropMarketplaceCache() call still fires inside try; D-19-01 explanatory comment in the catch body."
  - "D-19-02 (inline cascade construction; cascadeSummary retired; dispatch ternary removed) honored: the V1 cascadeSummary call at the old line 929 and the V1 dispatch ternary (`aggregatedSeverity === 'warning' ? notifyWarning : notifySuccess`) at the old line 952 are GONE. Replaced by renderUpdateCascadeAndNotify() which builds MarketplaceNotificationMessage[] inline with outcomeToCascadePluginMessage() mapping per partition. presentation/cascade-summary.ts is NOT modified."
  - "D-15-04 (PluginUpdatedMessage required from/to; renderer composes version-arrow) honored: the orchestrator passes plain `from: outcome.fromVersion` and `to: outcome.toVersion` strings; the V2 renderer's composeVersionArrow inside renderPluginRow formats `<from> → v<to>` with the asymmetric `v` prefix on `to` only (catalog line 499 byte form `0.5.0 → v1.0.0`)."
  - "Aggregate-failure direct-path shape choice (CONTEXT line 110 Claude's Discretion + RESEARCH Finding 3): Option B (synthetic PluginFailedMessage with cause threaded) chosen UNIFORMLY across all 4 sites for byte-form consistency and to preserve the V1 cause-chain text via the renderer's 4-space cause-chain trailer per D-16-08. Option A (bare marketplace `(failed)` shape) was rejected because it loses the V1 cause-text -- the test at line 826 asserts `/not found in project scope/` which is the cause-text. Per-site `pluginName` choice:"
  - "  - V1 line 170 (enumerate-targets failure): pluginName := target.marketplace (the marketplace IS the failed entity since the throw is `Marketplace \"<name>\" not found in <scope> scope.`). The synthetic shape `⊘ <mp-name> (failed) {not found}` with cause-chain trailer."
  - "  - V1 line 227 (syncCloneOnce failure): pluginName := t.marketplace (the marketplace's network/source failed -- no single plugin caused it). Same shape as 170."
  - "  - V1 line 254 (runThreePhaseUpdate phase-2-or-earlier failure): pluginName := t.plugin (a specific plugin's prep/state-guard threw)."
  - "  - V1 line 783 (phase-3 aggregate failure): pluginName := args.plugin + reasonOverride := 'rollback partial' + rollbackPartial := phase3aFailures (threaded structurally per D-16-08; the renderer composes 4-space `[<phase>] (rollback failed)` + 6-space per-phase cause-chain)."
  - "runPostUpdateMaintenance helper choice (CONTEXT line 111 Claude's Discretion): NOT APPLICABLE -- the V1 update.ts does NOT have a `runPostUpdateMaintenance` named helper; the completion-cache-refresh warning at line 844 lives inside `dropPluginCompletionCache`. After dropping the V1 notifyWarning, `dropPluginCompletionCache` retains the dropMarketplaceCache() side effect inside its try/catch (still required for correctness -- the cache must be invalidated post-update); the catch body becomes silent with a D-19-01 explanatory comment. The helper STAYS in place as a named function (its dropMarketplaceCache side effect is non-trivial)."
  - "D-19-06 (disjoint file pair) honored at the orchestrator+test level: only update.ts + update.test.ts touched among orchestrators/. The edge-handler test (tests/edge/handlers/plugin/update.test.ts) was updated as a Rule-1 cross-cutting impact: 3 assertions referenced the V1 `(no plugins)` byte form which my migration flipped to `(no marketplaces)`. The edge handler delegates to updatePlugins and re-uses the orchestrator's notify path; harmonization keeps npm run check GREEN."
  - "D-19-07 (test discipline) honored: byte-exact V2 assertions through real notify() via the existing makeCtx() pattern (lines 55-72); makeCtx() preserved verbatim. Severity assertions retain undefined/error/warning forms. Dispatch-ternary mock assertions were not present in the V1 test (the test never mocked aggregatedSeverity directly) -- direct severity checks suffice. No completion-cache-refresh test assertions exist to delete (the V1 update.test.ts never asserted on the dropped warning's content; D-19-01's behavioral change is observable only via the unchanged notifications.length === 1 invariant)."
  - "Phase3Failure.cause -> rollbackPartial caveat (D-19-03 lineage / RESEARCH Finding 1): `UpdatePhaseFailure` (the outcome-level type at orchestrators/types.ts:107-110) exposes only `phase: UpdatePhaseBridge; msg: string` -- the typed `Phase3Failure.cause: unknown` is discarded at the outcome boundary. To preserve the V1 cause-text in V2's structured rollbackPartial[i].cause: Error slot, `outcomeToCascadePluginMessage()` synthesizes `new Error(p.msg)` (D-19-03 fallback). The phase-3 direct-path notifyDirectFailure helper threads Phase3Failure (not UpdatePhaseFailure) so the rollbackPartialCauseSlot helper prefers `p.cause instanceof Error` when available, falling back to `new Error(p.msg)` per the same discipline."
  - "D-16-04 / D-16-06 / D-16-08 / D-16-11 / D-16-12 / D-16-14 (renderer-as-spec; caller-order honored; cause-chain indent; severity ladder; reload-hint trigger; single softDepStatus probe) honored: orchestrator passes no severity, no reload-hint, no soft-dep markers; notify() owns every rendering concern. compareByNameThenScope sort runs inside renderUpdateCascadeAndNotify on the grouped MpGroup[] before payload construction (D-16-06: orchestrator controls iteration order)."
metrics:
  duration: "single execution session"
  tasks: 2
  files_modified: 3
  completed: 2026-05-27
---

# Phase 19 Plan 5: `update.ts` V1 -> V2 Migration Summary

Wave 2 migration of the **version-arrow cascade orchestrator** in Phase 19's
plugin orchestrator family. Migrates
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` from the V1
severity-named wrappers (`notifySuccess` + `notifyWarning` + `notifyError`, 6
surviving callsites) + the cascadeSummary composer call + the V1 dispatch
ternary to the V2 structured entry point `notify(ctx, pi, NotificationMessage)`
(one call per orchestration arm). Locks the `PluginUpdatedMessage.from`/`to`
shape per D-15-04 -- the only variant carrying version-arrow fields -- and the
rollback-partial-in-update-cascade case that mirrors install.ts's
rollback-partial structurally.

## What Was Built

### Task 1 -- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`

Nine retirement events total across update.ts (per the plan's accounting):

| Retirement | V1 line | What was removed | What replaced it |
|---|---:|---|---|
| Empty-targets success | 178 | `notifySuccess(ctx, renderRow({ kind: "empty", token: "no plugins" }, softDepStatus(pi)))` | `notify(ctx, pi, { marketplaces: [] })` -- the renderer's `(no marketplaces)` sentinel per D-16-17 (Wave 1 precedent at orchestrators/marketplace/update.ts:230) |
| Direct-path failure (enumerate targets) | 170 | `notifyError(ctx, errorMessage(err), err)` | `notifyDirectFailure({ ctx, pi, marketplace: targetMarketplaceName(target), scope, pluginName: targetMarketplaceName(target), err })` -- Option B synthetic PluginFailedMessage with cause threaded |
| Direct-path failure (syncCloneOnce) | 227 | `notifyError(ctx, errorMessage(err), err)` | `notifyDirectFailure({ ctx, pi, marketplace: t.marketplace, scope: t.scope, pluginName: t.marketplace, err })` -- Option B with marketplace identity as synthetic plugin name |
| Direct-path failure (runThreePhaseUpdate) | 254 | `notifyError(ctx, errorMessage(err), err)` | `notifyDirectFailure({ ctx, pi, marketplace: t.marketplace, scope: t.scope, pluginName: t.plugin, err })` -- Option B with the actual plugin name (per-plugin throw) |
| Direct-path failure (phase-3 aggregate) | 783 | `notifyError(args.ctx, errorMessage(aggregate), aggregate)` | `notifyDirectFailure({ ctx, pi, marketplace, scope, pluginName: args.plugin, err: aggregate, reasonOverride: "rollback partial", rollbackPartial: phase3aFailures })` -- Option B + structural rollbackPartial threading per D-16-08 |
| DROP completion-cache-refresh warning | 844 | `notifyWarning(args.ctx, '... completion cache refresh deferred: ' + errorMessage(err))` | Try/catch retained; D-19-01 explanatory comment in the catch body. `dropMarketplaceCache()` still fires inside try (correctness preserved) |
| Cascade rendering (cascadeSummary call) | 929 | `const { message, severity } = cascadeSummary({ marketplace, rows, probe }); ... spliceRollbackPartials(...)` per-block + `bodySegments.join("\n\n")` | Inline V2 construction in `renderUpdateCascadeAndNotify`: MarketplaceNotificationMessage[] built from grouped outcomes, plugin rows via `outcomeToCascadePluginMessage` per partition, single `notify(ctx, pi, { marketplaces })` call |
| V1 dispatch ternary | 952 | `const dispatch = aggregatedSeverity === "warning" ? notifyWarning : notifySuccess; dispatch(ctx, appendReloadHint(body, hint))` | REMOVED. notify() computes severity per D-16-11 from variant set and reload-hint per D-16-12 from state-changing variants; the orchestrator passes neither |
| Eight presentation/* imports | (imports block) | `cascadeSummary`, `renderRow` (compact-line), `appendReloadHint`/`reloadHint`, `renderRollbackPartial`, `composeVersionArrow`, plus the type imports `MarketplaceRow`, `PluginCascadeRow`, `RollbackChild` | Replaced by `notify` + per-variant types `Dependency`, `MarketplaceNotificationMessage`, `PluginFailedMessage`, `PluginNotificationMessage` from `shared/notify.ts`. `compareByNameThenScope` from `presentation/sort.ts` KEPT (sort utility -- not a notify composer). `composeErrorWithCauseChain` from `presentation/cause-chain.ts` KEPT (used by `updateSinglePlugin` to build the cascade-outcome's `notes` field, which is internal API consumed by the marketplace cascade caller) |

**New helpers added:**

- `outcomeToCascadePluginMessage(target, outcome): PluginNotificationMessage` --
  mirrors `orchestrators/marketplace/update.ts:446` per-partition mapper.
  Narrows `PluginUpdateOutcome` to `PluginNotificationMessage`:
  - `updated` -> `PluginUpdatedMessage{ from, to, dependencies, scope }` --
    plain strings; renderer composes `<from> → v<to>`.
  - `unchanged` -> `PluginSkippedMessage{ reasons: ["up-to-date"] }` -- maps
    the V1 internal `unchanged` partition to the catalog `(skipped)
    {up-to-date}` user-visible byte form (docs/output-catalog.md:528-532).
  - `skipped` -> `PluginSkippedMessage{ reasons, version? }` -- producer-
    narrowed `outcome.reasons` preferred; legacy notes-substring fallback
    for back-compat fixtures.
  - `failed` -> `PluginFailedMessage{ reasons, version?, cause?,
    rollbackPartial? }` -- when `phaseFailures.length > 0`, reasons pins
    to `["rollback partial"]` and rollbackPartial threads
    `{phase, cause: new Error(msg)}` per D-19-03 fallback (the outcome
    type's `UpdatePhaseFailure` discards the original
    `Phase3Failure.cause: unknown` so msg-synthesis is the only path).
    PluginFailedMessage has NO `from`/`to` fields per D-15-04; the
    optional `version` slot surfaces `outcome.fromVersion` (the
    pre-update version) per catalog `failed-with-rollback-partial`
    (docs/output-catalog.md:514 byte form `⊘ delta v1.0.0 (failed)
    {rollback partial}`).

- `renderUpdateCascadeAndNotify(ctx, pi, outcomes)` -- groups outcomes by
  (scope, marketplace), sorts via `compareByNameThenScope` (D-16-06:
  orchestrator-controlled iteration; notify() does not sort), emits via
  a single `notify(ctx, pi, { marketplaces })` call. The recipe block-
  comment cross-links the Plan 19-01 pilot at uninstall.ts:303-313.

- `notifyDirectFailure(args)` -- consolidates 4 direct-path failure
  callsites into one Option B helper. Builds a synthetic
  `PluginFailedMessage` with `cause: err`, `reasons: [<narrowed-or-
  override>]`, and optional `rollbackPartial: phase3aFailures.map(...)`
  for the phase-3 aggregate path. The renderer composes the 4-space
  cause-chain trailer per D-16-08, preserving the V1 user-visible
  error-message text.

- `narrowDirectFailReason(err): Reason` -- per-instanceof / per-errno /
  per-substring narrower for direct-path failures. instanceof
  `PluginShapeError` -> `no longer installable` / `not in manifest`;
  errno EACCES/EPERM -> `permission denied`; ENOENT/ENOTDIR -> `source
  missing`; "not found" substring -> `not found`; "rollback" -> `rollback
  partial`; "concurrently uninstalled/removed" -> `concurrently
  uninstalled`; "concurrently updated" -> `concurrently updated`;
  "network" -> `network unreachable`; "unparseable"/"invalid" -> `invalid
  manifest`; fallback -> `unreadable manifest`.

- `rollbackPartialCauseSlot(p: Phase3Failure)` -- coerces the typed-
  unknown `Phase3Failure.cause` (preferred when `instanceof Error`) into
  the optional `{ cause?: Error }` slot consumed by
  `PluginFailedMessage.rollbackPartial`. Falls back to `new Error(p.msg)`
  per D-19-03 caveat when the cause isn't a typed Error. Extracted to a
  named helper to avoid a SonarJS-flagged nested ternary.

- `outcomeDependencies(declaresAgents, declaresMcp): readonly Dependency[]`
  -- maps the outcome's boolean predicates to the v2 `Dependency[]` tuple
  for `PluginUpdatedMessage.dependencies`.

- `targetMarketplaceName(target): string` -- derives the marketplace name
  for the enumerate-targets failure path. Per the V1 contract that path
  is only reachable when `target.kind !== "all"`; the marketplace is
  always present in those cases. The `"(targets)"` fallback for the
  unreachable bare-form path is defensive only.

**ThreePhaseArgs interface amended:** added `readonly pi?: ExtensionAPI` so the
phase-3 direct-path notifyDirectFailure() invocation inside `runThreePhaseUpdate`
has the API handle for the single `softDepStatus(pi)` probe per V2 notify() call
(D-16-14). The field is undefined in cascade mode (`updateSinglePlugin` doesn't
notify directly -- the marketplace autoupdate caller owns the cascade notify).

**Recipe cross-reference comment** (above the surviving notify() call in
`renderUpdateCascadeAndNotify`): cross-links Plan 19-01's pilot recipe at
uninstall.ts:303-313 and the catalog UAT fixtures at
docs/output-catalog.md:489-568 (single-mp-mixed, failed-with-rollback-partial,
all-up-to-date-noop, bare-multi-mp, same-mp-both-scopes).

### Task 2 -- `tests/orchestrators/plugin/update.test.ts`

Byte-exact V2 assertions across the 5 plugin-update catalog states + 1 dropped-
warning has-NO-effect on test count (the V1 test never asserted on the dropped
warning's content -- D-19-01's behavioral change is observable only via the
unchanged `notifications.length === 1` invariant, which all V2 tests now
verify). Existing `makeCtx()` (lines 55-72) preserved verbatim per D-19-07.

| Test | V1 surface | V2 result |
|------|-----------|-----------|
| PUP-1 bare empty | `assert.equal(msg, "(no plugins)")` | Byte-exact `(no marketplaces)` per Wave 1 precedent (Plan 19-04 / marketplace/update.ts:230). Test title updated. |
| PUP-3 unchanged | regex `/● hello \[project\] \(skipped\) \{up-to-date\}/` + severity `undefined` | Byte-exact `● mp [project]\n  ⊘ hello (skipped) {up-to-date}` + severity `"warning"`. V2 severity ladder (D-16-11) routes any `skipped` to warning (catalog `all-up-to-date-noop` 526-532: "Severity: warning per D-16-11 (skipped triggers warning even without failures)"). |
| PUP-4 skipped (no longer installable) | regex `/⊘ hello \[project\].+\(skipped\) \{no longer installable\}/` | Byte-exact `● mp [project]\n  ⊘ hello v1.0.0 (skipped) {no longer installable}` -- orphan-fold suppresses the redundant `[project]` bracket per Phase 17.2 + optional `version` slot from fromVersion. |
| PUP-5 skipped (not in manifest) | regex `/⊘ hello \[project\].+\(skipped\) \{not in manifest\}/` | Byte-exact `● mp [project]\n  ⊘ hello v1.0.0 (skipped) {not in manifest}`. |
| PUP-6 happy (version-arrow + reload-hint) | regex `/● hello \[project\] v1\.0\.0 → v1\.0\.1 \(updated\)/` + reload-hint regex | Byte-exact `● mp [project]\n  ● hello 1.0.0 → v1.0.1 (updated) {requires pi-subagents, requires pi-mcp}\n\n/reload to pick up changes`. Catalog `single-mp-mixed` (495-504) version-arrow shape `<from> → v<to>` with asymmetric `v` prefix on `to` only. Soft-dep markers emit because the plugin declares both companions and `getAllTools()` returns `[]` (probe sees both unloaded). |
| PUP-1 @mp form (mixed updated + skipped) | regex `/● mp \[project\]\n {2}● alpha \[project\] v1\.0\.0 → v1\.0\.1 \(updated\)\n {2}● beta \[project\] \(skipped\) \{up-to-date\}/` | Byte-exact `● mp [project]\n  ● alpha 1.0.0 → v1.0.1 (updated)\n  ⊘ beta (skipped) {up-to-date}\n\n/reload to pick up changes` + severity `"warning"` (skipped row present routes to warning per D-16-11). No soft-dep markers on `alpha` -- the PUP-1 @mp fixture sets only `hasSkill: true`. |
| PUP-1 pl@mp not installed | regex `/⊘ hello \[project\] \(skipped\) \{not installed\}/` | Byte-exact `● mp [project]\n  ⊘ hello (skipped) {not installed}` -- orphan-fold suppresses the plugin-row bracket. |
| PUP-1 missing marketplace (direct-path failure) | `notifications[0].severity === "error"` + `/not found in project scope/` regex match | Byte-exact `● ghost-mp [project]\n  ⊘ ghost-mp (failed) {not found}\n    cause: Marketplace "ghost-mp" not found in project scope.` + severity `"error"`. Demonstrates the Option B synthetic-plugin shape: marketplace name doubles as the failed-row plugin name; cause-chain trailer at 4-space indent per D-16-08 preserves V1 error text. |
| PUP-1 pl@mp no-scope fallback | regex `/⊘ hello \[project\] \(skipped\) \{not installed\}/` | Same byte-exact assertion as the pl@mp not-installed test. |

Behavior assertions preserved: state-mutation, error-throw on typed errors,
NFR-5 path-source-no-git, scope independence, cascade `updateSinglePlugin`
never-throws contract, RECOVERY_PLUGIN_REINSTALL_PREFIX surfaces in the
phase-3-failure cause-chain text.

### Task 2-bis -- `tests/edge/handlers/plugin/update.test.ts` (Rule-1 cross-cutting impact)

The edge handler `makeUpdateHandler` delegates to `updatePlugins`, so the
orchestrator's V2 empty-targets byte-form flip (`(no plugins)` -> `(no
marketplaces)`) propagated to 3 edge-handler shim tests:

- "shim :: bare /update with no positional ..." -- flipped to `(no marketplaces)`.
- "shim :: --scope user/project propagated to updatePlugins" -- flipped.
- "shim :: bare form + --map-model is accepted ..." -- flipped.

These are the only out-of-listed-files changes; per deviation Rule 1
(auto-fix bugs that prevent the suite from passing) these flips preserve
the `npm run check` GREEN gate without expanding scope into a separate
edge-handler migration (Phase 20 territory).

## Constraints Honored

- **D-19-01** (DROP post-success warnings with no V2 representation): the
  completion-cache-refresh warning at V1:844 is dropped; the side-effecting
  dropMarketplaceCache call still fires; only the user-visible standalone-mode
  warning surface disappears. The orchestrated/cascade path is unaffected
  (no separate warning emission in cascade mode).
- **D-19-02** (INLINE cascade construction; cascadeSummary retired; dispatch
  ternary removed): cascadeSummary call gone; V1 dispatch ternary gone;
  presentation/cascade-summary.ts NOT modified (still imported by
  orchestrators/import/execute.ts per Phase 20 territory; Phase 21 deletes
  the composer).
- **D-19-03 caveat** (Phase3Failure.cause threading): handled by the
  `rollbackPartialCauseSlot` helper -- prefers `p.cause instanceof Error`
  when threaded directly (phase-3 direct-path notifyDirectFailure with
  Phase3Failure[]); falls back to `new Error(p.msg)` synthesis when the
  outcome-level `UpdatePhaseFailure` (the cascade-path narrowed shape)
  has already discarded the typed cause. The V1 cause-text surfaces
  via the renderer's 6-space-indent per-phase cause-chain per D-16-08.
- **D-15-04** (PluginUpdatedMessage required from/to): orchestrator passes
  plain `from: outcome.fromVersion` and `to: outcome.toVersion` strings
  via `PluginUpdatedMessage`. The renderer's `composeVersionArrow` formats
  `<from> → v<to>` with the asymmetric `v` prefix on `to` only per the
  catalog line 499 byte form. PluginFailedMessage's optional `version` slot
  surfaces `outcome.fromVersion` (the pre-update version) for the failed
  cascade row -- D-15-04 confines from/to to the `updated` variant alone.
- **D-19-06** (disjoint file pair) honored at the plan-listed level:
  update.ts + update.test.ts. The edge-handler test was a Rule-1 cross-
  cutting fix.
- **D-19-07** (byte-exact V2 assertions through real notify(); makeCtx()
  preserved verbatim) honored.
- **D-16-04 / D-16-06 / D-16-08 / D-16-11 / D-16-12 / D-16-14**
  (renderer-as-spec; caller-order; cause-chain indent; severity; reload-
  hint; soft-dep probe) honored.
- **RESEARCH Finding 1** (Phase3Failure already carries `cause?: Error`):
  honored for the direct-path phase-3 helper. For the cascade-path,
  `UpdatePhaseFailure` (the outcome-level narrowed shape at
  orchestrators/types.ts:107-110) does NOT carry `cause` -- only `phase`
  + `msg`. The `outcomeToCascadePluginMessage` synthesis of `new
  Error(p.msg)` is structurally necessary for that path; the direct-path
  notifyDirectFailure preserves the typed cause when present.
- **RESEARCH Finding 3** (CONTEXT line attribution): the "aggregate-failure
  direct-path Claude's Discretion question" attributed to install.ts in
  CONTEXT line 110 actually belongs to update.ts (lines 170/227/254/783).
  Plan 19-05 owns the answer: Option B uniformly across all 4 sites.

## Verifications

| Check | Result |
|---|---|
| `node --test tests/orchestrators/plugin/update.test.ts` | 16/16 pass |
| `node --test tests/architecture/catalog-uat.test.ts` | 3/3 pass |
| `npm run check` (typecheck + lint + format:check + full test suite) | GREEN (1363 pass / 0 fail / 2 todo) |
| `grep -cE "notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 0 |
| `grep -c "cascadeSummary" extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 0 |
| `grep -cE 'dispatch\s*=\s*aggregatedSeverity' extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 0 |
| `grep -c "composeVersionArrow" extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 0 |
| `grep -cE 'status:\s*"updated"' extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 1 (the `outcomeToCascadePluginMessage` `updated` arm builds the `PluginUpdatedMessage`) |
| `grep -c "→ v" tests/orchestrators/plugin/update.test.ts` | 3 (PUP-6 happy + PUP-1 @mp mixed + one in commentary -- all V2 byte-form assertions or doc references) |
| `grep -c "completion cache\|cache refresh deferred" tests/orchestrators/plugin/update.test.ts` | 0 |
| `grep -cE 'notifications\.length,\s*[2-9]' tests/orchestrators/plugin/update.test.ts` | 0 (every assertion stays at `notifications.length === 1`) |
| `grep -c "aggregatedSeverity" tests/orchestrators/plugin/update.test.ts` | 0 |

## Deviations from Plan

### Rule-1 Auto-fix (cross-cutting test impact)

**Edge-handler test assertions updated:**
`tests/edge/handlers/plugin/update.test.ts` had 3 assertions on
`notifications[0]!.message === "(no plugins)"` that broke once the
orchestrator's empty-targets byte form flipped to `(no marketplaces)`.
The edge handler delegates to `updatePlugins` and re-uses the orchestrator's
notify path verbatim; harmonizing the test fixtures is the minimal fix that
keeps `npm run check` GREEN. The edge handler itself is NOT migrated to V2
(Phase 20 territory) -- only the byte-form assertions are updated to match
the orchestrator's new V2 empty-targets output.

Files: `tests/edge/handlers/plugin/update.test.ts` (3 assertions).

### No Other Deviations

The plan was executed substantively as written. The 4 direct-path failure
shapes were unified on Option B per the "Aggregate-failure direct-path
shape choice" decision documented above; no surprises in the rollback-partial
threading, the version-arrow shape, the cascade severity routing, or the
dropped warning's behavioral footprint.

## Wave 2 Coordination Note

Plan 19-05 ran in parallel with Plans 19-02 / 19-03 / 19-04 per D-19-05.
The disjoint-file-pair contract (D-19-06) held at the orchestrator+test
level. The only shared concern outside the disjoint pair was the 3 edge-
handler test flips above (Rule-1 cross-cutting), which are localized to
update-related test fixtures and do not interfere with the parallel
plans' install / list / reinstall counterparts.

The recipe block-comment cross-reference at the top of
`renderUpdateCascadeAndNotify` cites the Plan 19-01 pilot at
uninstall.ts:303-313 so future readers can trace the construction
discipline back to Wave 1's locked recipe.

## Self-Check: PASSED

- FOUND: `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (modified)
- FOUND: `tests/orchestrators/plugin/update.test.ts` (modified)
- FOUND: `tests/edge/handlers/plugin/update.test.ts` (modified)
- FOUND: `.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-05-SUMMARY.md` (this file)
- VERIFICATION: all grep gates above return their expected counts; full `npm run check` GREEN; catalog UAT GREEN end-to-end.
