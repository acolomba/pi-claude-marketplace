# Deferred Items

- `.planning/HANDOFF.json` fails `npm run format:check`
  status: resolved
  **What:** `prettier --check "**/*.{js,json,ts}"` reports the file as unformatted,
  which fails `npm run check` at its `format:check` step before the test steps run.
  **Pre-existing:** committed at `9a1c0180` ("wip: workflows paused after planning
  phase 115"), i.e. before plan 115-01 ran. `git diff HEAD -- .planning/HANDOFF.json`
  is empty, so nothing in this plan touched it.
  **Not fixed here:** out of this plan's scope, and the file is a GSD planning
  artifact rather than source. `npx prettier --write .planning/HANDOFF.json` clears
  it in one edit; it belongs in its own commit, not swept into a plan commit.
  **Verified around it:** every other member of the `check` chain was run directly
  and passed -- typecheck, lint, fallow, `prettier --check` over
  `extensions/**/*.ts` + `tests/**/*.ts` + `scripts/**/*.mjs`, `test:corresponding`,
  `test:corresponding:negative`, `test:coverage:direct:negative`, 5625 unit tests and
  34 integration tests.

- The discovery-warning block's header claims a skip that a gate warning did not carry out
  status: resolved
  **What:** `surfaceDiscoveryWarnings` (`orchestrators/plugin/shared.ts:1453`) heads its
  block with `Plugin "<name>" installed; 1 declared component was skipped.` A gate
  warning's own line correctly says `was installed but the engine will refuse to load
  it`, so the two sentences of one notification disagree about whether anything was
  skipped.
  **Newly reachable because of this plan:** D-115-05 moved the workflows bridge's
  warnings onto `discoveryWarnings`, which is the array that header renders. Before
  that, a standalone install rendered none of them.
  **Not fixed here:** the header is shared by install, update and reinstall, and its
  exact bytes are asserted in `tests/orchestrators/plugin/{install,update,reinstall}.test.ts`
  and `tests/orchestrators/plugin/shared.test.ts`. Changing it is a cross-verb
  rendering change with a catalog consequence (`docs/output-catalog.md`), which is
  plan 115-04's territory, and it is not in this plan's file list.
  **Shape of a fix, when someone takes it:** count the warnings that describe a
  disposal separately from those that describe an admitted-with-caveat script, or
  neutralise the header ("... 1 declared component needs attention."). Either way it
  moves rendered bytes and needs the catalog updated in the same change.
  **Measured by plan 115-04, still open:** the header is NOT reachable from the
  `info` surface and appears in NO catalog state, so the catalog state 115-04 adds
  cannot publish the contradiction and does not. `surfaceDiscoveryWarnings` has three
  call sites (`install.ts:2561`, `update.ts:503`, `reinstall.ts:610`) and none is in
  `info.ts`; `grep "declared component" docs/output-catalog.md` finds only an
  unrelated line. Cost of the fix, measured: 14 sites -- the two header branches in
  `shared.ts` plus 12 assertions across `shared.test.ts` (2), `install.test.ts` (1),
  `reinstall.test.ts` (4) and `update.test.ts` (5). No catalog state has to move with
  it, which makes the fix cheaper than 115-01 estimated, but it is still a cross-verb
  rendering change outside 115-04's file list.

---

## Closure, 2026-09-09

status: resolved

Both items above were fixed during the phase's code-review pass and are recorded
`closed` rather than left `open`. Re-measured at the goal-verification gate:

- **`HANDOFF.json`** — `npx prettier --check .planning/HANDOFF.json` reports
  `All matched files use Prettier code style!`.
- **The discovery-warning header** — `orchestrators/plugin/shared.ts:1461-1462`
  now reads `1 declared component has a note.` / `N declared components have
  notes.` It took the neutralising shape this entry proposed, so the header no
  longer claims a skip the gate warning did not carry out.

Leaving a fixed item marked `open` is the same defect WDOCS-01 exists to correct
— a record advertising completed work as outstanding — so the statuses are
turned here rather than carried into the milestone audit.
