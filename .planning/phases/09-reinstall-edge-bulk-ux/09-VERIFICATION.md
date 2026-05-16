---
phase: 09-reinstall-edge-bulk-ux
status: passed
verified: 2026-05-15T22:57:13Z
reverified: 2026-05-16T00:00:00Z
post_merge_status: passed
score: 5/5
requirements_verified: [PRL-01, PRL-03, PRL-04, PRL-05, PRL-13, PRL-14, PRL-15, PRL-16]
review_status: passed_after_uat_gap_fixes
human_verification_required: false
uat_status: complete
---

# Phase 09 Verification: Reinstall Edge & Bulk UX

## Verdict

**PASSED** - Phase 09 achieves the user-facing reinstall command goal. `/claude:plugin reinstall` is routed through the command surface, supports bare / marketplace / plugin target forms, accepts `--scope` and reinstall-specific `--force`, renders deterministic batch partitions, aggregates reload and soft-dependency notices correctly, and provides installed-only tab completion with marketplace-wide targets.

Initial UAT found three major gaps: stale marketplace-name completion, explicit-scope cross-scope marketplace handling, and missing README wording for that behavior. Quick task `260515-tqx` fixed and documented those gaps, then `npm run check` passed.

## Goal Coverage

| Success Criterion | Status | Evidence |
|------------------|--------|----------|
| `/claude:plugin reinstall`, `reinstall @<marketplace>`, and `reinstall <plugin>@<marketplace>` route with clear usage on invalid forms | Passed | `edge/router.ts` includes reinstall in `TOP_LEVEL_USAGE` and dispatches to `handlers.reinstall`; `edge/handlers/plugin/reinstall.ts` maps bare, marketplace, and plugin forms to `reinstallPlugins`; handler/router/register tests cover valid and invalid forms. |
| `--scope user|project` is accepted at any position; target resolution mirrors update semantics including explicit-scope behavior | Passed | Reinstall handler uses existing scope parser and locally handles `--force`; `reinstallPlugins` enumerates all/user/project scopes and uses `resolveScopeFromState` for implicit marketplace/plugin targets. UAT gap fix added explicit-scope plugin fallback to `not installed` instead of marketplace-not-found. |
| Batch reinstall continues per plugin and reports deterministic `Reinstalled` / `Skipped` / `Failed` partitions | Passed | `reinstallPlugins` loops sequentially over all targets, catches per-plugin failures into failed outcomes, and renders sorted partitions. Tests cover continuation after failure and deterministic scope/marketplace/plugin ordering. |
| Successful reinstall emits reload hints only for changed generated resources and includes existing soft-dependency warnings when relevant | Passed | Batch render filters `reinstalled` outcomes by `resourcesChanged` before `reloadHint("refresh", ...)`; soft-dependency warnings aggregate only staged agents/MCP from successful outcomes. Tests cover reload and pi-subagents/pi-mcp-adapter aggregation. |
| Tab completion surfaces `reinstall`, installed plugin refs, `@<marketplace>` targets, trailing spaces, and existing soft-fail/state-error behavior | Passed | `provider.ts` includes `reinstall`, reinstall-only `--force`, installed-only plugin-ref mode, and marketplace-only completions. `data.ts` reads marketplace names from live state to avoid stale cache. Completion tests cover top-level, refs, `@m`, stale-cache regression, soft-fail, and state-error propagation. |

## UAT Gap Closure

| UAT Finding | Status | Fix Evidence |
|-------------|--------|--------------|
| `/claude:plugin reinstall @m` did not suggest marketplaces in live Pi because marketplace-name completion could use stale cache | Fixed | `getMarketplaceNamesAcrossScopes` now rebuilds names from state directly; regression `PRL-16 :: reinstall @m ignores stale marketplace-name cache` passes. |
| `reinstall plugin@marketplace --scope project` failed when the marketplace existed only in user scope | Fixed | `enumerateMarketplaceReinstallTargets` now returns a selected-scope plugin target that becomes `Skipped: not installed` for explicit plugin targets; regression `PRL-05 explicit plugin reinstall in another scope reports not-installed instead of marketplace-not-found` passes. |
| README omitted cross-scope marketplace-source behavior | Fixed | README now states `--scope` selects installed records/resources while the marketplace reference identifies the source marketplace; `reinstall-docs.test.ts` asserts this wording. |
| Install completion suggests unavailable plugins | Not a reinstall gap | Confirmed intentional Phase 6 behavior: install mode includes unavailable rows for future install `--force` support. |

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | Bulk reinstall entrypoint, quiet seam, deterministic summary | Verified | Exports `reinstallPlugins`; single-plugin `render: "none"` supports batch aggregation; partitions and reload/soft-dep notices are generated centrally. |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` | Thin edge handler for reinstall forms, `--scope`, and `--force` | Verified | Parses reinstall-specific `--force`, rejects unknown flags/extra args, and delegates target union to `reinstallPlugins`. |
| `extensions/pi-claude-marketplace/edge/router.ts` | Usage and dispatch for reinstall | Verified | `TOP_LEVEL_USAGE` includes reinstall syntax and `routeClaudePlugin` dispatches the command. |
| `extensions/pi-claude-marketplace/edge/register.ts` | Pi command registration includes reinstall | Verified | Handler map includes `reinstall: makeReinstallHandler(pi)` and command description mentions reinstall. |
| `extensions/pi-claude-marketplace/edge/completions/provider.ts` | Reinstall completion branches | Verified | Top-level `reinstall`, reinstall-only `--force`, and installed-only plugin-ref/marketplace-only target completions are implemented. |
| `extensions/pi-claude-marketplace/edge/completions/data.ts` | Installed-only reinstall filtering and robust marketplace names | Verified | Reinstall mode keeps `status === "installed"`; marketplace names are rebuilt from state instead of stale marketplace-name cache. |
| `README.md` | Reinstall command docs | Verified | Documents all target forms, scope, force, cached/no-network behavior, version preservation, installed-only semantics, no reload on empty target sets, data cleanup ordering, and cross-scope source behavior. |
| `tests/edge/handlers/plugin/reinstall.test.ts` | Edge parser coverage | Verified | Covers bare, marketplace, plugin, scope, force, and invalid forms. |
| `tests/edge/completions/provider.test.ts` | Completion coverage | Verified | Covers top-level reinstall, refs, `@marketplace`, `--force`, stale-cache regression, soft-fail, and state errors. |
| `tests/architecture/reinstall-docs.test.ts` | Static docs contract | Verified | Protects README reinstall syntax and semantic notes. |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `edge/router.ts` | `edge/handlers/plugin/reinstall.ts` | `handlers.reinstall(rest, ctx)` | Wired | Router dispatch test verifies `reinstall foo@bar --force` reaches the reinstall handler. |
| `edge/register.ts` | `makeReinstallHandler(pi)` | command handler map | Wired | Register tests verify command description and live registered-command route. |
| `makeReinstallHandler` | `reinstallPlugins` | target union `{kind: all|marketplace|plugin}` | Wired | Handler tests verify exact target forms and flag propagation. |
| `reinstallPlugins` | `reinstallPlugin` | sequential quiet calls with `render: "none"` | Wired | Bulk orchestrator reuses the Phase 8 atomic core instead of duplicating replacement logic. |
| `renderReinstallPartitionAndNotify` | presentation helpers | `reloadHint`, `appendReloadHint`, soft-dep helpers | Wired | Reload/soft-dep tests prove only successful changed/restaged outcomes contribute. |
| completion provider | completion data | `getPluginRefCompletions("reinstall", ..., { allowMarketplaceOnly: true })` | Wired | Reinstall completion tests verify installed refs and `@marketplace` targets. |
| docs test | README | static contract strings | Wired | `reinstall-docs.test.ts` fails if documented syntax/semantics drift. |

## Automated Gates

| Gate | Result |
|------|--------|
| Focused Phase 09 suite | Passed: `node --test tests/orchestrators/plugin/reinstall.test.ts tests/edge/handlers/plugin/reinstall.test.ts tests/edge/router.test.ts tests/edge/register.test.ts tests/edge/completions/provider.test.ts tests/architecture/reinstall-docs.test.ts tests/architecture/no-orchestrator-network.test.ts` |
| Full project check | Passed: `npm run check` with 898 tests, 0 failures |
| UAT | Complete: 5 tests total; original 3 issues fixed by quick task `260515-tqx`; remaining install-completion observation classified as intentional existing behavior |

## Requirement Traceability

| Requirement | Status | Evidence |
|-------------|--------|----------|
| PRL-01 | Verified | Router usage, handler, registration, and tests expose top-level reinstall with usage errors. |
| PRL-03 | Verified | `target.kind === "marketplace"` enumerates installed plugins in one marketplace; tests cover marketplace reinstall. |
| PRL-04 | Verified | Bare reinstall enumerates installed plugins across user/project or selected scope; tests cover all-scope behavior. |
| PRL-05 | Verified | `--scope` at any position reaches the orchestrator; explicit-scope UAT regression is fixed and tested. |
| PRL-13 | Verified | Batch loop continues after failures and renders deterministic partitions. |
| PRL-14 | Verified | Reload hint is emitted only for successful changed outcomes. |
| PRL-15 | Verified | Soft-dependency warnings aggregate only from successful restaged agents/MCP servers. |
| PRL-16 | Verified | Completion mode covers reinstall command, installed refs, `@marketplace`, trailing spaces, soft-fail, and state-error behavior. |

## Risks / Follow-Up

- No blocking gaps remain. The only UAT-adjacent note is install completion showing unavailable plugins, which is preserved intentionally from Phase 6 and is not part of reinstall acceptance.
- `09-VALIDATION.md` frontmatter still says `status: draft` / `Approval: pending`, but the executed plan summaries, UAT, verification, and green gates supersede it. This can be cleaned up as planning metadata if desired.

## Conclusion

Phase 09 is complete and verified. The reinstall command is user-facing, bulk-capable, scope-aware, completion-backed, documented, UAT-tested, and covered by focused and full-suite automated validation.

## Post-Merge Re-verification (2026-05-16)

**Context:** Merge commit `bd26932` brought origin/main into this branch. Main added bootstrap and import commands, refactored `edge/completions/data.ts` (split into `getInstallPluginToMarketplacesMap`/`getInstalledPluginToMarketplacesMap`, added target-scope-awareness), introduced CMP-1..8 scope rules, and added the AG-7 omit-model agent mapping quick task. The merge resolution kept reinstall's edge surface and required two follow-ups: collapsing four plugin-ref dispatch branches behind `pluginRefBranchConfig` (cognitive-complexity cap) and re-inlining `marketplaceNamesForScope` to bypass the marketplace-name cache (keeping the PRL-16 stale-cache regression test green for both reinstall and update modes).

**Verdict:** PASSED -- Phase 09 success criteria still hold post-merge.

| Concern | Result |
|---------|--------|
| Router/register wiring | Verified: `TOP_LEVEL_SUBCOMMANDS` includes `reinstall` (router.ts:56), `TOP_LEVEL_USAGE` carries `reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--force]` (router.ts:84), `routeClaudePlugin` dispatches `case "reinstall"` (router.ts:138), `register.ts:81` wires `makeReinstallHandler(pi)`, and `COMMAND_DESCRIPTION` ends "...and reinstall plugins from configured marketplaces" (register.ts:63). |
| Completion wiring | Verified: `provider.ts`'s `pluginRefBranchConfig` returns `{ mode: "reinstall", allowMarketplaceOnly: true, targetScope: explicitScope? }` for reinstall; reinstall flows through main's new `getInstalledPluginToMarketplacesMap` which filters for `row.status === "installed"`. PRL-16 contract preserved despite the structural refactor. |
| CMP-1..8 interaction | Composes correctly: `resolveScopeFromState` (orchestrators/marketplace/shared.ts:393) checks project first then user, matching CMP-5 project-precedence; explicit `--scope` overrides; bare `reinstall` iterates both scopes when no `--scope`. PRL-04 and CMP-5 don't conflict (PRL-04 is multi-target enumeration, CMP-5 is single-target precedence). |
| PRL-05 cross-scope path | Verified: `enumerateMarketplaceReinstallTargets` (reinstall.ts:287) still returns a selected-scope plugin target that becomes `not installed` when the marketplace lives only in another scope. Test `PRL-05 explicit plugin reinstall in another scope reports not-installed instead of marketplace-not-found` passes. |
| Stale marketplace-name cache (PRL-16 UAT regression) | Initially regressed after the merge (`marketplaceNamesForScope` used cached `getMarketplaceNames`); refixed by inlining `rebuildNamesForScope` so all marketplace-name reads in the completion dispatch bypass the cache. Test `PRL-16 :: reinstall @m ignores stale marketplace-name cache` passes. |
| Targeted edge suite | Passed: `node --test "tests/edge/**/*.test.ts"` -- 207/207 tests green, including all 10 reinstall-related PRL-16 tests (top-level "rei", `--force` flag, installed-only mode, `--force` reaches installed refs, `@` marketplace-only, `@m` stale cache, plugin half multi-marketplace, soft-fail, state-error propagation). |
| Full `npm run check` | Passed: typecheck + lint + format + 1010 tests, 0 failures. |
