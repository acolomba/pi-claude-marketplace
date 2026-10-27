---
phase: 06-import-marketplace-planning
plan: 03
subsystem: orchestrators
status: complete
tags: [mim-01, mim-02, import, reconcile, source-claim]
requires: []
provides:
  - "Import plans every extraKnownMarketplaces entry: referenced first, then the rest in settings order; the official name only when an enabled plugin names it (D-PL6-01, D-PL6-08)"
  - "marketplaceSourceClaims, a pure export of reconcile/plan.ts returning the planner's own claim map (D-PL6-10)"
  - "Import follows a one-to-one source claim: a settings alias of a recorded source skips under the recorded name and installs or enables under it (D-PL6-02)"
  - "A planner source mismatch blocks before any add; a plugin-less mismatch renders a (failed) block with the mismatch as cause (D-PL6-09)"
affects: [06-04 import rows, 06-06 phase gate]
tech-stack:
  added: []
  patterns: ["alias the scope plan after the locked read pass instead of threading a second identity"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
    - test/orchestrators/import/marketplaces.test.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - test/orchestrators/import/execute.test.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - test/orchestrators/reconcile/plan.test.ts
    - features/plugin/import.feature
decisions:
  - "A plugin-less source mismatch uses the existing add-failed reason with the mismatch text as its cause (no new brace token on the cause row)"
  - "Aliasing rewrites each claimed plugin ref's raw to <plugin>@<recorded>, so every outcome's ref names the recorded key"
  - "The claim map is filtered to entries whose recorded name differs from the declared one before it reaches the aliasing step"
requirements: [MIM-01, MIM-02]
metrics:
  duration: 39min
  completed: 2026-10-27
estimate:
  tokens: 80000
  tasks: 2
actuals:
  tokens: 10700
  tasks: 2
  commits: 2
plan_head_before: 26d795a9b3cb91259d1e360a6f71933e53ba405c
plan_head_after: 9120ea3277869ad686b2300a87f1e856f0924986
---

# Phase 6 Plan 03: Import Marketplace Planning Summary

Import now plans every `extraKnownMarketplaces` entry of the settings, as Claude Code registers them, and a settings name for a source that the scope records under one other name reuses that record through the reconcile planner's own source claim.

## What changed

- **marketplaces.ts (MIM-02, D-PL6-01, D-PL6-08):** `planMarketplaceSources` (renamed from `planMarketplaceSourcesForRefs`) plans the enabled plugins' marketplaces first, then walks `Object.keys(extraKnownMarketplaces)` and plans every name not yet seen. It skips `claude-plugins-official` unless an enabled plugin names it. A shared `planOne` closure keeps each function under both complexity ceilings. An unmappable unreferenced entry gets the `unmappable-marketplace-source` diagnostic and skips no plugin.
- **plan.ts (D-PL6-10):** a new pure export, `marketplaceSourceClaims(declared, recorded)`, returns `buildMarketplaceClaims(...).recordedByDeclared`. Nothing else in plan.ts changed, and the planner purity test still passes.
- **execute.ts:**
  - `readPassForImport` builds the desired config once and returns `claims` inside the same lock. Only entries whose recorded name differs from the declared name are kept.
  - `aliasedScopePlan` renames each claimed `marketplacesToEnsure` entry to its recorded name and keeps the settings source. It also rewrites each claimed plugin ref's `marketplace` and `raw`. The aliased plan feeds `ensurePlannedMarketplaces`, `pushSkippedPluginWarnings`, `applyPlannedPlugins`, and `writeBatchedConfigForScope`, so the WR-01 repair declares the recorded name with the settings source.
  - `ensurePlannedMarketplaces` now runs in this order: a planner mismatch blocks, then a recorded name is a skip, and anything else is added. Its doc says D-PL6-02 supersedes lifecycle-coverage D-07.
  - In `recordPlannedMismatch`, the `source-mismatch` arm with no plugins goes through `recordMarketplaceAddFailure` (D-PL6-09). The WR-04 `MarketplaceBlock` comment, the `failure` field comment, and the `recordMarketplaceAddFailure` comment are updated.
- **Tests:**
  - marketplaces.test.ts has 4 new cases: order, unmappable unreferenced, unreferenced official, and referenced official.
  - plan.test.ts has a new `describe("marketplaceSourceClaims")` with 5 cases.
  - In execute.test.ts, the D-07 case is replaced by the MIM-01 case. That case asserts the whole result, the config bytes, an empty `planReconcile` over the written config, and the cascade. Six more cases are added: MIM-02 unreferenced add, D-PL6-01 lock-only scope, D-PL6-09 plugin-less mismatch, conflicted claim with plugins, conflicted claim without plugins, and aliased enable.
  - import.feature has 2 new scenarios.

## RED runs of the scenarios

- **Scenario 1**, "Importing adds an extra known marketplace that no enabled plugin names", before the change: `1 scenario (1 failed)`. `Then the result has these fields` gave `tally success count` 2, but 3 was expected, because `tools` was never planned.
- **Scenario 2**, "Importing settings that name a known marketplace under another name installs the plugin under the recorded marketplace", before the change: `1 scenario (1 failed)`. `Then the result has these fields` gave `severity` error (expected info), `needs reload` false, `tally failures` 2 (expected 0), and summary `Some operations have failed.`. The orchestrated add of the recorded source failed as a duplicate name.
- After the change, `npx cucumber-js features/plugin/import.feature` passes: 18 scenarios, 225 steps.

## Planner choices for user review (plan 06-06)

1. **Plugin-less mismatch vocabulary (D-PL6-09):** an extra known marketplace that no plugin names, whose recorded source differs (or whose claim is conflicted), records a `MarketplaceFailureOutcome` with reason `add-failed` and the mismatch text as its cause. It renders `⊘ <mp> [scope] (failed)` and `⊘ <mp> (failed)` with a `cause:` row, and it has no brace token. This is the same shape as the `unknown-stored` arm. The alternative was a new `{source mismatch}` brace on the cause row.
2. **Rewritten `ref.raw` (RESEARCH A2):** an aliased plugin's `ref` field reads `plugin@<recorded>`, not the settings text `plugin@<settings name>`.
3. **Conflicted-claim cause text:** a conflicted claim reuses the existing mismatch sentence, so the cause reads `Existing marketplace source ambiguous recorded marketplaces: a, b does not match Claude settings source ./mp.` (or `... recorded marketplace claimed by multiple declarations: X ...`). That is awkward but unchanged vocabulary. A clearer sentence would need a planner-cause-specific message.
4. **No reload hint for a marketplace-only import:** when the settings name only an extra marketplace, the cascade reads `● tools [user] (added)` / `Import: 1 success` with no `/reload` line, as `marketplace add` does.

## Verification

- `node --test test/orchestrators/import/marketplaces.test.ts test/orchestrators/import/execute.test.ts test/orchestrators/reconcile/plan.test.ts`: all pass.
- `npm run test:coverage:direct --` for marketplaces.ts, execute.ts, and plan.ts each exited 0, so each stays at 100%.
- `node --test test/architecture/reconcile-planner-purity.test.ts`: pass.
- `node --test test/integration/reserved-record-keys.test.ts`: 14 pass.
- `npm run fallow` exited 0, ESLint on the 6 TS files exited 0, and `tsc --noEmit` is clean.
- Both commit hooks (`check:commit`) passed. In the second, `fallow dead-code` saw the plan.ts export used by execute.ts.
- Acceptance greps all match: `from the same .refs. set` 0, `Object.keys(` in marketplaces.ts 1, `export function marketplaceSourceClaims` 1, `marketplaceSourceClaims(` in execute.ts 1, `is added, not followed to that record` 0.

## Commits

- `9986012b` feat(import): add every extra known marketplace of the settings
- `9120ea32` fix(import): reuse a marketplace recorded under another name

`commits: 2` is measured with `git rev-list --count 26d795a9..HEAD -- <plan files>`. The unfiltered range holds 9 commits, because wave-1 siblings 06-01 and 06-02 committed in the same worktree in between.

## Deviations from Plan

None. The plan was executed as written. Two expected strings in the new execute cases were corrected to the shipped grammar during writing: a marketplace-only add has no reload line, and the failed block counts the header and its cause row as 2 failures, as the `unknown-stored` case does.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All 7 modified files exist.
- Commits `9986012b` and `9120ea32` are ancestors of HEAD.
