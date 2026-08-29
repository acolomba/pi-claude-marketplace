# Phase 4 Marketplace Orchestrator Test Fixtures

Each subdirectory mimics a Claude marketplace clone. The clone has `.claude-plugin/marketplace.json` at its root. The guarded `createGitOpsFake` factory in `tests/platform/git-ops-fake.ts` copies a fixture when its local `cloneFixture` boundary is set.

| Fixture              | Purpose                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valid-marketplace/` | Happy-path manifest used by `add.test.ts`, `update.test.ts`. Validates against `MARKETPLACE_VALIDATOR.Check`.                                                                 |
| `invalid-manifest/`  | Syntactically broken JSON. Drives the MA-9 cleanup path (`addMarketplace` clone advances, manifest read throws, staging cleanup runs, leak surfaced via `appendLeakToError`). |
| `empty-marketplace/` | Valid manifest with `plugins: []`. Drives the MU-1 silent-succeed path (bare-form update against an empty marketplace) and the cascade-no-op path.                            |

All fixtures match the PRD §6.3 marketplace.json schema (forward-compatible: `parsePluginSource` may classify entries as `unknown` -- that is intentional). Plugin entries reference `./plugins/<name>` relative paths; the test harness does NOT need the plugin sub-trees to exist for marketplace-orchestrator tests (those tests never call the plugin resolver -- Phase 5 owns that).
