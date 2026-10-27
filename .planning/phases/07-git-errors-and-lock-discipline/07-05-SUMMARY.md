---
phase: 07-git-errors-and-lock-discipline
plan: 05
subsystem: completion-cache
tags: [completion, list, upgradable, version-rule, offline, nfr-5]
status: complete

requires: []
provides:
  - "upgradeCandidate exported from orchestrators/plugin/list-installed-row.ts, body unchanged (D-PL7-16)"
  - "orchestrators/edge-deps.ts::classifyInstalledPluginRow decides upgradable through list's upgradeCandidate (GLK-07, D-PL7-09)"
affects: [edge-deps, list-installed-row, git-source-probe, completion]

actuals:
  tokens: 4138
  tasks: 2
  commits: 2
plan_head_before: 794beb634e78ea543c8cff892b0d5132772dcfc3
plan_head_after: 6f99f049b5897d54952c97b5c38d2edb36323ada

tech-stack:
  added: []
  patterns:
    - "Completion and list share one upgrade decision: the completion bucketizer calls list's upgradeCandidate instead of comparing the entry's version itself"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
    - test/orchestrators/edge-deps.test.ts
    - test/orchestrators/plugin/git-source-probe.test.ts

decisions:
  - "classifyInstalledPluginRow takes the plugin's scope and the resolver's cwd in place of a ScopedLocations; upgradeCandidate builds its own locationsFor(pluginScope, cwd), so the two are the same bundle."
  - "The marketplace context spreads into the upgradeCandidate options (marketplaceRoot, marketplaceName) instead of being restated field by field."
  - "A disabled record still runs upgradeCandidate; classifyInstalledRecord freezes it at installed (ENBL-02 / ENBL-05), and the existing disabled rows pass unchanged."

requirements-completed: [GLK-07]

metrics:
  duration: "~25 min"
  completed: 2026-10-27
---

# Phase 07 Plan 05: Completion Reads List's Upgrade Rule Summary

Tab completion now decides whether an installed plugin is upgradable with the same function `list` uses, `upgradeCandidate`. It reads the version from plugin.json, then the catalog entry, then the commit, all offline. Before, completion compared only the entry's version, so a plugin whose plugin.json matched the installed version was offered for `update` while `list` showed it as installed (GLK-07, D-PL7-09, D-PL7-16).

## What changed

- `list-installed-row.ts`: the `export` keyword on `upgradeCandidate`. Nothing else changed (D-PL7-16).
- `edge-deps.ts`
  - `classifyInstalledPluginRow(pluginName, installed, manifestEntry, scope, marketplaceContext, cwd)`. With no manifest entry the candidate is `{ upgradable: false }`. Otherwise it is `await upgradeCandidate(manifestEntry, { pluginName, pluginScope: scope, marketplaceScope: scope, ...marketplaceContext, record: installed, lookup: { kind: "declared", entry: manifestEntry }, cwd })`, passed to `classifyInstalledRecord`. The row keeps `version: installed.version`.
  - The entry-version comparison and the separate probe call are gone. The imports `parsePluginSource`, `declaredVersionWithPin`, `isSameVersion`, and `probeUpgradeCandidate` are removed. `UpgradeCandidate` (type) and `upgradeCandidate` are imported.
  - The JSDoc now describes list's rule (VER-01 / VER-02, D-PL7-09, NFR-5, CR-01).
  - Not-installed rows are unchanged: they keep `probeManifestEntry` and the entry version (D-PL7-15).
  - The raw lookup `parsed.plugins.find((p) => p.name === pluginName)` is unchanged (architecture gate `manifest-lookup-drift`).
- `git-source-probe.ts`: the orphaned `probeUpgradeCandidate` is deleted, with the `ResolvedPlugin` type import that only it used. The header comment does not name the function, so it is unchanged.
- `git-source-probe.test.ts`: the `describe("probeUpgradeCandidate")` block (six cases) and its import are deleted.
- `edge-deps.test.ts`
  - `FixturePlugin` gains `pluginJsonVersion?: string`. `layoutMarketplace` writes `pluginJsonVersion ?? manifestVersion` into plugin.json, so existing rows write the same bytes as before.
  - New row: a record at its plugin.json version (1.0.0) whose entry declares 2.0.0 is `installed`.
  - New row: a record whose entry declares no version but whose plugin.json declares 2.0.0 is `upgradable`.
  - New row: a git-source record (`https://example.com/plugin.git`) with no mirror and a newer entry version is `upgradable`, as list's remote candidate is.
- Browse: verified only (D-PL7-09). `edge/handlers/plugin/browse.ts` imports `loadPluginListPayload` from `list-flow.ts` and builds its rows from that payload (line 86). Nothing there changed.

## Commits

| Commit | Message |
|--------|---------|
| 5c4c6b48 | fix(completion): offer update by list's version rule |
| 6f99f049 | test(completion): pin list's version rule at its other edges |

## Verification

| Check | Result |
|-------|--------|
| `node --test test/orchestrators/edge-deps.test.ts test/orchestrators/plugin/git-source-probe.test.ts test/orchestrators/plugin/list-installed-row.test.ts test/architecture/manifest-lookup-drift.test.ts` (after Task 1) | exit 0, 90 tests, 90 pass |
| `node --test test/orchestrators/edge-deps.test.ts test/edge/handlers/plugin/browse.test.ts` (after Task 2) | exit 0, 47 tests, 47 pass |
| `npm run test:coverage:direct -- edge-deps.ts git-source-probe.ts list-installed-row.ts` | exit 0 (100% for all three pairs) |
| `npm run test:coverage:direct -- edge-deps.ts` (after Task 2) | exit 0 |
| `npm run fallow` (after Task 1, and again before this SUMMARY) | exit 0 both times |
| `npm run typecheck` (before this SUMMARY) | exit 0 |
| `npx eslint` on the five files | exit 0 |
| Commit hook `npm run check:commit` | Passed on both commits |
| Acceptance greps | `export async function upgradeCandidate`: 1; `upgradeCandidate(` in edge-deps: 1; `probeUpgradeCandidate` anywhere in `extensions` or `test`: none; the raw `find` line: 1; browse.ts has no commit since `features/plugin-lifecycle` |

### Fails-without proof

I ran the three GLK-07 rows against the old `edge-deps.ts` and `git-source-probe.ts` from 794beb63, then restored both files with `git checkout -- <path>`:

- "keeps a record at its plugin.json version installed when the entry differs": FAILS on the old code (actual `upgradable`, expected `installed`).
- "marks a record upgradable to a newer plugin.json version the entry omits": FAILS on the old code (actual `installed`, expected `upgradable`).
- "marks a git record with no mirror upgradable to a newer entry version": passes on both. The plan asks for this row to *keep* the entry-version decision, so it guards against a regression and does not show a change.

All existing bucketizer rows pass unchanged. No existing row changed status.

### Harness limit

The cucumber harness has no step that reads tab completions, so no scenario under `features/` covers GLK-07's completion half. The unit rows above are the only coverage. The harness belongs to Phase 10 (TST-01 / TST-02).

## Deviations

None. The plan was executed as written.

## Out-of-line edits

None. The edits stayed in the five files the plan lists.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-07-10 holds: `upgradeCandidate` folds any `resolveListCandidate` throw to the CR-01 degrade. A broken manifest still makes `loadManifestForMarketplace` throw `ManifestSoftFailError` (the existing soft-failure cases pass). `edge-deps.ts` names no git surface, and the suite's `fetch` replacement throws on any call. No package was installed (T-07-SC).

## Self-Check: PASSED

- All five modified files exist. The deleted function has no remaining reference.
- Commits 5c4c6b48 and 6f99f049 are ancestors of HEAD. `git rev-list --count 794beb63..HEAD` = 2.
