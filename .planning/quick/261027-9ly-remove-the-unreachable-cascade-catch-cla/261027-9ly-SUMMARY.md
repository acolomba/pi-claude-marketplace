---
phase: 261027-9ly
plan: 01
subsystem: orchestrators/marketplace
tags: [marketplace-update, autoupdate, error-classification, dead-code]
status: complete
requires: []
provides:
  - "refreshFailureReasons as the single refresh-row classifier in update.ts"
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - test/orchestrators/marketplace/update.test.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - docs/output-catalog.md
decisions:
  - "User decision 7.17 applied: the autoupdate cascade catch sets no reasons; production reasons come from runCascadeTarget's shared ladder (PUP-9, GLK-02)"
requirements: [GLK-02, UPD-11]
metrics:
  duration: ~20min
  completed: 2026-10-27
actuals:
  tokens: 6267
  tasks: 2
  commits: 2
plan_head_before: 342437c501c754e786ee3fd7f159eb6fca09be79
plan_head_after: 2915e7db1c4a4aa3deaeae9ee53ff10b165154b6
---

# Quick Task 261027-9ly Plan 01: Remove the unreachable cascade catch classification Summary

The autoupdate cascade catch in `orchestrators/marketplace/update.ts` now records a thrown
`pluginUpdate` failure without classifying it. The refresh classification that the removed
`reasonsFromCascadeError` helper also served is now inside `refreshFailureReasons`, and
`transportReason` reads only the `MarketplaceUpdateError` cause.

## What changed

- **update.ts:** removed the `PluginShapeError` import, the `typedReasons` const, and its `reasons`
  spread in the cascade catch. Kept the GHB-03 rethrow, `notes`, the three `declares*: false` flags,
  and the cause spread. The second comment paragraph is now a present-tense PUP-9 note. The helper
  is gone, and its manifest, baseline, and transport arms moved into `refreshFailureReasons` after
  the lock-held and non-`MarketplaceUpdateError` guards. `transportReason(err: MarketplaceUpdateError)`
  no longer has the "error is its own bearer" arm. The `MARKETPLACE_REFRESH_RULE` and
  `refreshFailureReasons` docs no longer name the cascade or the removed helper.
- **update.test.ts:** deleted the 260525-cjr section (3 tests), the non-Error cascade rejection
  test, and the 4-row PluginShapeError cascade-rejection loop (8 tests total). The kept catch case,
  "autoupdate continues in installed order after an ordinary plugin failure", now pins the whole
  notification (`⊘ zeta (failed) {unreadable manifest}` plus `cause: zeta update failed`, in
  installed order). Added a refresh-path EACCES/EPERM loop (2 tests) that pins `{permission denied}`.
  The GHB-03 cascade test is unchanged.
- **errors.ts / output-catalog.md:** the `InvalidMarketplaceManifestError` doc and the
  `update-path-invalid-manifest` prose now name `refreshFailureReasons`.

I applied both prototype patches (`git apply --check` passed at `342437c5`), then checked each diff
against the plan's task steps. They match.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 1 | 7444e80a | refactor(marketplace): drop the unreachable autoupdate catch reasons |
| 2 | 2915e7db | docs(marketplace): point the manifest notes at refreshFailureReasons |

Both are pathspec commits with the hook on. `npm run check:commit`, gitlint, mdformat, and
markdownlint-cli2 passed. Each commit holds exactly its two paths, and afterwards
`git status --porcelain` lists neither path.

## Verification (Node v26.12.1, every command unpiped, exit status read directly)

| Command | Exit | Result |
|---------|------|--------|
| `npx fallow dead-code --trace update.ts:updateMarketplace` (before) | 0 | USED, reachable, 1 direct ref |
| `npx fallow dead-code --trace update.ts:updateAllMarketplaces` (before) | 0 | USED, reachable, 1 direct ref |
| `node --test --test-reporter=tap test/orchestrators/marketplace/update.test.ts` | 0 | `# tests 103`, `# pass 103`, `# fail 0` (109 at HEAD) |
| `npm run test:coverage:direct -- .../marketplace/update.ts` | 0 | branches 131/131, functions 18/18, lines 868/868 |
| `npx cucumber-js features/marketplace/update.feature` | 0 | 91 scenarios (91 passed), 1135 steps |
| `node --test test/architecture/catalog-uat/catalog-contract.test.ts` | 0 | 4/4 pass |
| `npm run typecheck` | 0 | clean |
| `npm run fallow` | 0 | dead-code, cycle run, health, dupes clean |
| trace after (both exports) + `diff` against before | 0 / 0 | identical |
| `grep -rln 'reasonsFromCascadeError' extensions test features docs` | 1 | no output (HEAD: 4 files) |

The full `npm run check` was not run here; the orchestrator runs it on the combined tree.

### fallow trace, before and after (byte-identical, `diff` exit 0)

```text
  USED updateMarketplace in extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts

  File: reachable
  Namespace: value
  Reason: Used by 1 file(s)

  1 direct reference(s):
    -> extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts (named import)
```

```text
  USED updateAllMarketplaces in extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts

  File: reachable
  Namespace: value
  Reason: Used by 1 file(s)

  1 direct reference(s):
    -> extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts (named import)
```

### Acceptance grep counts (all at the planned values)

- update.ts: `reasonsFromCascadeError` 0, `typedReasons` 0, `PluginShapeError` 0,
  `reasonsFromTypedError` 0, `and its autoupdate cascade` 0, `passes the raw error` 0,
  `bearer = err;` 0. `function transportReason(err: MarketplaceUpdateError)` 1,
  `rethrowInvalidGitHubBaseUrl(err);` 2, cause spread 1, `refreshFailureReasons(err)` 1.
- update.test.ts: `260525-cjr` 0, `cascade rejection` 0, `PluginShapeError` 0;
  `renders the failed row as permission denied` 1 (one template title in a 2-row loop),
  `cause: zeta update failed` 1, GHB-03 cascade title 1, kept catch-case title 1.
- errors.ts: old name 0, `update.ts::refreshFailureReasons` 1. output-catalog.md: old name 0,
  `classifies it via \`refreshFailureReasons\` to` 1.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: all four modified files exist.
- FOUND: 7444e80a and 2915e7db are ancestors of HEAD.
