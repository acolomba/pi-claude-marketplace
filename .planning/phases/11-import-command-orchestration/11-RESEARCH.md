# Phase 11 Research: Import Command Orchestration

## Scope

Phase 11 wires the pure Phase 10 Claude settings import plan into the real `/claude:plugin import [--scope user|project]` command. It must execute marketplace ensures before plugin installs, keep user/project scopes independent, classify expected failures as skips or warnings, and summarize results through `ctx.ui.notify`.

## Code Findings

### Phase 10 import foundation

- `extensions/pi-claude-marketplace/orchestrators/import/settings.ts` exposes `loadMergedClaudeSettingsForScope(scope, options)` and keeps settings discovery pure.
- `extensions/pi-claude-marketplace/orchestrators/import/refs.ts` exposes strict non-throwing `plugin@marketplace` parsing and exact-true extraction.
- `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts` exposes `buildClaudeImportPlan(inputs)` returning per-scope `marketplacesToEnsure`, `pluginsToInstall`, `skippedPlugins`, and diagnostics.
- Phase 10 deliberately does not read Pi state, add marketplaces, install plugins, notify users, or touch the network.

### Existing marketplace add semantics

- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` owns source parsing, GitHub/path add behavior, state locking, atomic clone/path recording, cache invalidation, and success notification.
- `addMarketplace` currently fails duplicate marketplace names with `MarketplaceDuplicateNameError`; Phase 11 should avoid calling it for already-present matching marketplaces so idempotent imports are silent.
- GitHub network remains confined to `addMarketplace`'s GitHub branch, satisfying IMP-11/NFR-5 when import delegates instead of cloning directly.

### Existing plugin install semantics

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` owns cached-manifest resolution, installability errors, staging/rollback, state commit, cache invalidation, soft-dependency warnings, and reload hints.
- `installPlugin` currently returns `Promise<void>` and catches failures internally by notifying `ctx`; it does not return a typed outcome. Phase 11 needs a notification-control/result seam to classify already-installed, unavailable/uninstallable, and unexpected failures without duplicating install internals.
- The reload hint is currently appended directly to the success message. Phase 11 needs an option to suppress the immediate install reload hint and report reload guidance once in the final import summary.

### Edge layer

- `extensions/pi-claude-marketplace/edge/args.ts` already parses position-independent `--scope user|project` and leaves omitted scope as `undefined`.
- `extensions/pi-claude-marketplace/edge/router.ts` needs a new top-level `import` handler, usage string entry, and dispatch branch.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` needs `import` in top-level completions. Existing flag completion already offers `--scope`; no plugin-ref completion should be added for import.
- `extensions/pi-claude-marketplace/edge/register.ts` needs to wire a new import handler. The handler needs both `pi` (for install soft-dep probes) and `deps.gitOps` (to pass to marketplace add).

## Recommended Architecture

1. Add a new orchestrator module, likely `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, with an entrypoint such as `importClaudeSettings(opts)`.
2. The orchestrator loads selected scopes with `loadMergedClaudeSettingsForScope`, builds a plan with `buildClaudeImportPlan`, then executes each scoped plan independently.
3. For each scoped plan:
   - Read current state for preflight idempotency and source-mismatch checks.
   - Skip existing marketplace records when their stored source matches the planned source.
   - Record a source-mismatch diagnostic and mark dependent plugin imports skipped when an existing marketplace's source differs from the Claude settings source.
   - Call `addMarketplace` only for missing marketplaces.
   - If `addMarketplace` fails, record a marketplace failure and skip only plugins depending on that marketplace.
   - Skip already-installed plugins silently in normal operation.
   - Call `installPlugin` for remaining plugins using the new notification/result seam.
4. Aggregate all diagnostics/outcomes into one final summary notify. Use warning severity when there were warnings/skips/failures but at least the command completed safely; use default severity for clean/up-to-date imports; reserve error severity for global failures such as impossible settings/state read failure that prevents planning safely.

## Source Matching

A deterministic helper should compare the planned source string against the stored marketplace record source. Implementation should avoid guessing from user-facing strings. Recommended approach:

- Parse the planned source through `parsePluginSource` and compare normalized fields against `marketplaces[name].source` after state load normalization.
- GitHub match: `kind === "github"`, same owner, repo, and optional ref.
- Path match: `kind === "path"`, same stored `rawPath`/portable path representation after the same parser/factory normalization used by marketplace add.
- Unknown/unsupported parse results should be treated as an add failure or source-mismatch skip, not as a match.

## Validation Architecture

Use a Nyquist-style validation strategy: each behavior is covered at the lowest layer that can observe it without over-coupling, and then sampled once at the user-facing command layer.

- Unit-frequency coverage: pure result classification, source-match helpers, warning aggregation, and summary formatting should be tested in `node:test` without disk-heavy fixtures.
- Integration-frequency coverage: import orchestration should use disk-backed temporary scopes and fake `gitOps`/fixture marketplaces to verify real state locking, add delegation, install delegation, idempotency, and source mismatch.
- Edge-frequency coverage: router/handler/completion tests should verify command syntax, omitted-vs-explicit scope expansion, usage errors, and top-level completion exposure.
- End-to-end sample: one rich fixture should exercise the full command path with official GitHub, extra-known directory, extra-known GitHub, local override disable, already-installed skip, unavailable warning, both scopes, final summary, and source mismatch. This avoids duplicating every lower-layer case at the slowest level while still proving the assembled import command works as a user runs it.

## Risks and Open Points

- `installPlugin` currently swallows errors after notifying; Phase 11 cannot classify install failures reliably without adding a typed outcome/notification-control seam.
- Suppressing per-plugin reload hints must not suppress soft-dependency/dependency warnings that remain important. Prefer option names that distinguish `reloadHint: "immediate" | "suppress"` from general notification suppression.
- `addMarketplace` success notifications may still fire per added marketplace. Context only requires preserving semantics and aggregating final import summary/reload guidance; do not suppress add notifications unless implementation adds an explicit seam and tests existing behavior.
- Existing `REQUIREMENTS.md` traceability footer still maps IMP-01/02/03/09/10/11 to Phase 9; Phase 11 planning should not edit it unless a separate documentation plan is requested.
