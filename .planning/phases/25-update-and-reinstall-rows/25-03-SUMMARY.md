---
phase: 25-update-and-reinstall-rows
plan: 03
subsystem: update-rows
tags: [update, autoupdate, version-arrow, commit, UPR-02, json-wire]

requires:
  - phase: 25-update-and-reinstall-rows
    provides: plan 01's declared-range cause lines (same files, no dependency on its content)
provides:
  - VersionCommits and PluginUpdatedMessage.commits
  - the commit-aware composeVersionArrow in the grammar
  - fromCommit / toCommit on the JSON plugin row, the schema, and docs/json-output.md
  - RevisionMove and PluginUpdateUpdatedOutcome.fromCommit / toCommit, stamped by the swap
  - update-row.ts's revisionCommits rule (file-private), applied by updatedRowFromOutcome
  - the {<repository> commit <n>} cucumber run token
  - the update-same-version-new-commit catalog state
affects: [25-04 revisionVersionSlot builds on revisionCommits, 25-05 reinstalled rows]

actuals:
  tokens: 13400
  tasks: 2
  commits: 2
plan_head_before: 3d7844f4ccc7ae865018c28c49b6b268a16b8b83
plan_head_after: 0b38c23999a76cd419c0503268c1d81baa19d3de

tech-stack:
  added: []
  patterns:
    - "The message carries one optional commits sub-object (both sides required), so a half-annotated arrow cannot be built"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - schema/claude-plugin.schema.json
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - features/lib/run-tokens.ts
    - features/support/world.ts
    - features/plugin/git-source-update.feature
    - .agents/skills/cucumber/rules/features.md
    - docs/json-output.md
    - docs/output-catalog.md
    - docs/messaging-style-guide.md
    - test/architecture/catalog-uat/fixtures/plugin-update.ts

key-decisions:
  - "Outcomes carry raw fromCommit? / toCommit? (each side optional); the message carries commits: VersionCommits (both required); the wire flattens it to fromCommit / toCommit"
  - "revisionCommits stays file-private in update-row.ts until a second module needs it: exporting it for the unit tests alone failed fallow's unused-export gate"
  - "The swap's commit fields come from one file-private helper, so swapPluginUpdate gains no branch"

requirements-completed: [UPR-02]

duration: 55min
completed: 2026-10-23
status: complete
---

# Phase 25 Plan 03: Same-version update names both commits Summary

**An update that moves a git plugin to a new commit at the same declared version now renders `● ghp v1.0.0 (abc1234) → v1.0.0 (def5678) (updated)`, and its JSON row carries the full commits as `fromCommit` and `toCommit`. Every other updated row keeps its bytes.**

## Performance

- Duration: about 55 min
- Tasks: 2 of 2
- Files modified: 26

## Accomplishments

- `shared/notification-types.ts` has `VersionCommits` (`from`, `to`, both required) and an optional `commits` on `PluginUpdatedMessage`.
- `notification-grammar.ts::composeVersionArrow` takes optional commits and appends ` (<first 7 characters>)` after each side. The grammar decides nothing. A row without `commits` renders the same bytes as before.
- `notification-json.ts::wireVersion` emits `fromCommit` / `toCommit` on an `updated` row that has `commits`. `notification-wire.ts::PLUGIN_ROW` admits both. The schema is regenerated, and `docs/json-output.md` documents both. `schemaVersion` stays 1.
- `orchestrators/types.ts` has `RevisionMove` and optional `fromCommit` / `toCommit` on `PluginUpdateUpdatedOutcome`. The swap's `updated` literal spreads them from `preflight.record.resolvedSha` and `preflight.resolvedSha`, each key present only when its side has a sha.
- `update-row.ts::revisionCommits` applies the rule: equal versions, both commits present, different commits. `updatedRowFromOutcome` sets `commits` only then.
- The autoupdate cascade gets the commits through the same composer. `marketplace/update.messaging.ts` needed no code change, and two new cases prove it.
- Cucumber: a `{<repository> commit <n>}` run token (full 40-hex), documented in the cucumber features rule. The same-version scenario in `git-source-update.feature` states `from commit` `{ghp commit 1}` and `to commit` `{ghp commit 2}`.
- Catalog: the new state `update-same-version-new-commit`, its fixture, the `<version-token>` bullet, the update section intro, and the style guide's `version` bullet.

## Task Commits

1. Task 1: a same-version git update names both commits, end to end. Commit `25dbb10b`.
2. Task 2: the autoupdate proof and the catalog state. Commit `0b38c239`.

## Catalog state count

301 after this plan (300 before). `EXPECTED_UTF8_BYTES` moved 48_623 -> 48_761 (+138, the new block). The wire inventory's `PRESENTED.length` moved 310 -> 311.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `revisionCommits` is not exported**
- Found during: Task 1 commit (the pre-commit hook's `fallow` run)
- Issue: the plan asked to export `revisionCommits`. Its only consumer is `updatedRowFromOutcome` in the same module, so fallow reported an unused export and the hook failed. The unit-test rules also forbid exporting a symbol only for a test.
- Fix: `revisionCommits` is file-private. The rule's cases go through `updatedRowFromOutcome`: one case with two different commits at the same version, and a table of eight plain-arrow moves (equal commits, moved version, one side only either way, no commits, equal and different `sha-` versions, `hash-` versions), each asserting the whole row. Plan 04's `revisionVersionSlot` is built on it in the same module and is the export that other modules consume.
- Files: `update-row.ts`, `test/orchestrators/plugin/update-row.test.ts`
- Commit: `25dbb10b`

**2. [Rule 3 - Blocking] Catalog pins beyond the three the plan named**
- Found during: Task 2 (`catalog-contract.test.ts`, `catalog-wire.test.ts`)
- Issue: `EXPECTED_UTF8_BYTES` and the wire test's `PRESENTED.length` (310) also count states.
- Fix: 48_623 -> 48_761 (the new block is exactly 138 bytes) and 310 -> 311.
- Commit: `0b38c239`

**3. [Rule 2 - Clarity] The token maps share one builder**
- Found during: Task 1
- Issue: the commit token map would repeat the revision token map's `flatMap` line for line.
- Fix: `World.revisionTokens(noun, value)` builds both maps. The revision token is unchanged.
- Commit: `25dbb10b`

No file owned by Phase 26 was staged, and `update-preflight.ts` was not edited.

## Verification

- `npm run test:coverage:direct` on all seven task 1 sources and on `marketplace/update.messaging.ts`: exit 0.
- `node --test test/architecture/wire-schema.test.ts test/architecture/json-output-docs.test.ts`: 126 of 126 passed.
- `npm run test:architecture`: exit 0. The catalog wire test validates the new state's payload against the schema.
- Cucumber: `git-source-update.feature` and `update.feature`, 22 of 22 scenarios passed.
- `npm run check` at `0b38c239`: exit 0.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-25-06 holds: the commit comes from the install record or the candidate's `resolvedSha`, never free text, and the grammar only slices it to 7 characters. T-25-05 is accepted as planned.

## Self-Check: PASSED

- Commits `25dbb10b` and `0b38c239` are ancestors of HEAD.
- `fromCommit` appears in `schema/claude-plugin.schema.json`, `docs/json-output.md`, `notification-wire.ts`, and `notification-json.ts`.
- `from commit` appears once in `features/plugin/git-source-update.feature`.
- `catalog-state: update-same-version-new-commit` appears once in `docs/output-catalog.md`, and the state name once in `fixtures/plugin-update.ts`.
- `function revisionCommits` is in `update-row.ts` (file-private, see deviation 1).
