# Plugin List PRE-EDIT Ledger

Status: READY
Hub: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
Legacy test: tests/orchestrators/plugin/list.test.ts
Evidence captured: 2026-09-09T21:27:00Z
CodeGraph artifact: `/tmp/phase06-list-preedit-codegraph.txt`

The fresh trace was captured after the gate and documentation repoint commit and before any edit
to the legacy hub or its paired test. The tracked hub contains comments only. Its paired test is a
direct-import shell with no test cases. Current production imports target the four atomic owners.

| Category | Current owner or responsibility | Destination | Evidence |
| --- | --- | --- | --- |
| exported symbol | live legacy hub export census: zero exports | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts and the three list leaves | tracked two-line hub plus fresh CodeGraph trace |
| exported symbol | InstalledListRow, ComposeInstalledListRowOptions, composeInstalledListRow | extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts | direct exports and direct owner pair |
| exported symbol | FilterBucket, CandidateRow, availableRowMessage | extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts | direct exports and direct owner pair |
| exported symbol | OrphanFold, isOrphanMarketplaceClone, foldOrphanListRows, orderPluginListBlocks | extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts | direct exports and direct owner pair |
| exported symbol | ListPluginsOptions, loadPluginListPayload, listPlugins | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts | direct exports and direct owner pair |
| production caller | live imports of the legacy hub: zero | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts | fresh CodeGraph trace and exact import scan |
| production caller | extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts calls listPlugins | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts | direct import and handler flow proof |
| production caller | extensions/pi-claude-marketplace/edge/handlers/tools.ts calls loadPluginListPayload | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts | direct import and tool projection proof |
| source-scanning gate | tests/architecture/no-orchestrator-network.test.ts list network surface | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts | repointed in commit 9ac8ecc8 and focused gate passes |
| source-scanning gate | tests/architecture/no-split-01-cast-reads.test.ts autoupdate history | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts | repointed in commit 9ac8ecc8 and focused gate passes |
| source-scanning gate | tests/architecture/scope-fences-63.test.ts hook-column fence | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts | repointed in commit 9ac8ecc8 and focused gate passes |
| source-scanning gate | scripts/check-phase-06-hub-ledger.mjs retired-hub and owner census | four list production and test pairs | segmented retired path retains deletion enforcement without a live PRE-EDIT fixture |
| source-scanning gate | tests/scripts/check-phase-06-hub-ledger.test.ts PRE-EDIT mechanics | neutral example hub and owner fixture | READY, category, duplicate-owner, path, graph, and closure failures remain direct-tested |
| documentation comment | docs/plans/2026-08-07-manifest-independent-installed-plugin-info-design.md inventory design | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts | repointed in commit 9ac8ecc8 |
| documentation comment | extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts fold and rendering owner comments | tests/orchestrators/plugin/list-flow.test.ts and list-flow.ts | repointed in commit 9ac8ecc8 |
| documentation comment | tests/edge/handlers/plugin/list.test.ts projected-body ownership comments | tests/orchestrators/plugin/list-flow.test.ts | repointed in commit 9ac8ecc8 |
| documentation comment | tests/edge/handlers/tools.test.ts status-vocabulary ownership comment | tests/orchestrators/plugin/list-flow.test.ts | repointed in commit 9ac8ecc8 |
| test ownership | installed record projection, absence reasons, partial and upgrade states | tests/orchestrators/plugin/list-installed-row.test.ts | ten direct public-result cases and 100 percent direct coverage |
| test ownership | available, partial, unavailable, probe-failure, cold and warm candidate rows | tests/orchestrators/plugin/list-candidate-row.test.ts | six direct public-result cases and 100 percent direct coverage |
| test ownership | orphan adoption, clone identity, stable row and block ordering | tests/orchestrators/plugin/list-orphan-fold.test.ts | eight direct pure-contract cases and 100 percent direct coverage |
| test ownership | list enumeration, filters, scope folding, failures, exact zero, one, and many notification bytes | tests/orchestrators/plugin/list-flow.test.ts | retained end-to-end flow proof and 100 percent direct coverage |
| completeness invariant | every list production source has exactly one mirrored direct owner | scripts/check-corresponding-tests.mjs plus the four list pairs | npm run test:corresponding verifies inverse source-test mapping |
| completeness invariant | all 30 Phase 6 owner pairs include the four list pairs | scripts/check-phase-06-hub-ledger.mjs OWNER_PAIRS | closure validates exact production and test inventories |
| completeness invariant | retired list hub remains absent after deletion | scripts/check-phase-06-hub-ledger.mjs LEGACY_HUBS | closure fails when the reconstructed retired path is tracked |
| completeness invariant | zero, one, and many list output retains structural plural cardinality, tally grammar, order, and exact bytes | tests/orchestrators/plugin/list-flow.test.ts | exact notification arrays cover 0 successes, 1 success, and many successes |
| completeness invariant | full qualified legacy production and test paths disappear | extensions, tests, scripts, docs, and eslint.config.js | final tracked-tree scan must return zero matches |
| dependency edge | edge/handlers/plugin/list.ts to listPlugins | orchestrators/plugin/list-flow.ts to notification dispatch | direct one-way edge confirmed by CodeGraph |
| dependency edge | edge/handlers/tools.ts to loadPluginListPayload | orchestrators/plugin/list-flow.ts to row leaves | direct one-way edge confirmed by CodeGraph |
| dependency edge | list-flow.ts installed enumeration | orchestrators/plugin/list-installed-row.ts to resolver and notification types | directed leaf edge confirmed by CodeGraph |
| dependency edge | list-flow.ts candidate enumeration | orchestrators/plugin/list-candidate-row.ts to resolver and notification types | directed leaf edge confirmed by CodeGraph |
| dependency edge | list-flow.ts orphan adoption and final ordering | orchestrators/plugin/list-orphan-fold.ts to compare-name-scope and notification types | directed leaf edge confirmed by CodeGraph |

Graph verdict: the production graph is directed from edge callers to `list-flow.ts`, from the flow
to the three leaves, and then to domain/shared dependencies. The fresh CodeGraph trace reports no
unresolved dependency cycle. All named source and owner paths are tracked before deletion.
