---
phase: 05-marketplace-command-parity
plan: 08
subsystem: marketplace
tags: [json-output, row-id, marketplace-subject, cucumber]
status: complete

requires:
  - phase: 05-marketplace-command-parity
    provides: "05-06 marketplace/shared.ts (fsErrnoReason) as the base of marketplaceFailureRows edits"
provides:
  - "marketplaceFailureRows marks its child row `marketplaceSubject: true` (remove, autoupdate, lock-held add/remove/update)"
  - "refreshOneMarketplace's failed child row is a marketplace subject (marketplace update)"
  - "PluginInfoRowBase.marketplaceSubject?: true and the bare-id branch of wirePluginInfoRow"
  - "buildManifestFailureMessage (marketplace info) marks its plugin-info row"
  - "docs/json-output.md id rule for marketplace-level rows (plugin row and plugin-info row tables)"
affects: [marketplace remove, marketplace update, marketplace autoupdate, marketplace info, marketplace add lock-held, JSON payload]

# commits is measured over plan_head_before..plan_head_after. It counts 3:
# this plan's 2 task commits plus 6a09f1d2 of plan 05-07, which ran in
# parallel in the same tree. The SUMMARY commit is not counted.
actuals:
  tokens: 18000
  tasks: 2
  commits: 3
plan_head_before: 92728de5b9337211c30080ade0320af91debdeb5
plan_head_after: e84128c2d90ae556e6bedc854ac8344a9044e5b3

tech-stack:
  added: []
  patterns:
    - "A row that stands for a marketplace carries `marketplaceSubject: true`; the wire reads the marker, never name equality, so a plugin named like its marketplace keeps `<name>@<mp>`"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - docs/json-output.md
    - test/orchestrators/marketplace/shared.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/marketplace/info.test.ts
    - test/shared/notification-json.test.ts
    - test/edge/register.test.ts
    - features/marketplace/autoupdate.feature
    - features/marketplace/file-source-update.feature
    - features/marketplace/git-source.feature
    - features/marketplace/remove.feature
    - features/marketplace/state-lock.feature
    - features/marketplace/update.feature
    - features/marketplace/url-source-update.feature
    - features/marketplace/info.feature

key-decisions:
  - "wirePluginInfoRow tests `plugin.marketplaceSubject === true`, not name equality (D-PL5-12): the unmarked case of a plugin named like its marketplace is pinned by a test and keeps `tools@tools`"
  - "add.ts surfaceLockHeldAdd keeps its own redundant marker spread; 05-07 owned add.ts in this wave and 05-09 removes the spread"

requirements-completed: [MKT-04]

duration: ~75min
completed: 2026-10-27
---

# Phase 5 Plan 08: bare marketplace ids on marketplace-level rows Summary

Marketplace-level failure rows now use the marketplace name alone as their JSON `id`, not `<mp>@<mp>`. This covers a failed `marketplace remove`, `marketplace update`, autoupdate, the lock-held rows of `add`/`remove`/`update`, and the `marketplace info` manifest failure. The text output is byte-identical.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | `1dc7db3b` | fix(marketplace): give a marketplace failure row the marketplace id |
| 2 | `e84128c2` | fix(marketplace): give a marketplace info failure the marketplace id |

## Accomplishments

- **Task 1 (tracer):** `marketplaceFailureRows` and `refreshOneMarketplace` mark their child row `marketplaceSubject: true`, so `rowId` (which already honored the marker for ADD-10) returns the bare name. 19 pinned cells changed in 7 feature files (`tools@tools`, `fixtures@fixtures`, `zeta@zeta` to the bare name), with the touched tables re-aligned. `update.test.ts` `zeta@zeta` became `zeta`; the `shared.test.ts` deep-equal now carries the marker. `remove.test.ts` and `autoupdate.test.ts` needed no change, because neither deep-compares these rows. The plugin-row `id` cell in `docs/json-output.md` states the rule.
- **Task 2:** `PluginInfoRowBase.marketplaceSubject?: true` (D-PL5-26), and `wirePluginInfoRow` emits `plugin.name` when the marker is set. The marker is not written to the wire. `buildManifestFailureMessage` sets it. New tests: notification-json (marked row gives `tools`; an unmarked row named like its marketplace keeps `tools@tools`), and info.test.ts (a json-mode manifest failure wires `id: "bad-mp"`, payload schema-valid). `register.test.ts` `demo@demo` became `demo`, and 3 cells in info.feature changed. The plugin-info `id` doc cell states the exception.

## Verification

- `node --test` of shared, update, remove, autoupdate, info, notification-json, register, json-output-docs, and wire-schema: all pass.
- `npx cucumber-js features/marketplace/ features/plugin/import.feature features/plugin/autoapply.feature features/plugin/configuration.feature`: 456/456 scenarios pass on the combined tree at `e84128c2` (it includes 05-07's hosted commit).
- `npm run test:coverage:direct` for marketplace/shared.ts, marketplace/update.ts, shared/notification-json.ts, and marketplace/info.ts: exit 0.
- `npm run check:static` in a private worktree: all green. Both commit hooks ran `npm run check:commit`: Passed.
- Acceptance greps: every listed file has 0 matches for `tools@tools`/`fixtures@fixtures`/`zeta@zeta`/`demo@demo`. `import.feature` still has its 1 `fixtures@fixtures`. `marketplaceSubject` appears 2 times in notification-json.ts. A PCRE scan for `| X@X ` across features/ and test/ finds only import.feature:515.

## Deviations from Plan

- **info.test.ts assertion form:** the plan says "the manifest-failure message carries the marker". info.test.ts asserts only TUI text, which does not show the marker. So the new case runs `getMarketplaceInfo` in json mode through `createJsonCapture` and asserts the wired bare id. This exercises the marker the wire reads, which the plan's step 2 of Task 1 allows as one form.
- **shared.test.ts:** the plan allows either a wire-builder assertion or a marker assertion. shared.test.ts has no wire builder, so the existing deep-equal now asserts the marker. notification-json.test.ts already covers the marker-to-bare-id mapping for cascade rows. The test title gained "marketplace-subject".

## Files outside the ROADMAP Files line

- `extensions/pi-claude-marketplace/shared/notification-types.ts`: the `PluginInfoRowBase.marketplaceSubject` field (D-PL5-26). Phase 3 also edits this file.
- `extensions/pi-claude-marketplace/shared/notification-json.ts`: the bare-id branch of `wirePluginInfoRow` (D-PL5-26).
- Owner tests: `test/orchestrators/marketplace/{shared,update,info}.test.ts`, `test/shared/notification-json.test.ts`.
- `test/edge/register.test.ts`: it pins the marketplace info json/rpc payload (`demo@demo` became `demo`).

## For the parent / later phases

- **CHANGELOG line candidate:** "JSON output: marketplace-level failure rows (a failed marketplace add, remove, update, or autoupdate) and a failed `marketplace info` now use the marketplace name alone as their `id`, not `<marketplace>@<marketplace>`."
- **Phase 6:** import's own marketplace failure row still emits `<mp>@<mp>` (`orchestrators/import/execute.ts`; `features/plugin/import.feature:515`, `fixtures@fixtures`). It is left unchanged per D-PL5-25.
- **Plan 05-09:** `add.ts::surfaceLockHeldAdd`'s marker spread is now redundant, because `marketplaceFailureRows` sets it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-17 holds: the bare id is the already-redacted `name` that the payload already carries, and the marker is not serialized.

## Self-Check: PASSED

- Commits `1dc7db3b` and `e84128c2` are ancestors of HEAD; all modified files listed above exist.
