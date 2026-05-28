# Changelog

## [0.3.0] - 2026-05-27 -- v1.4 Structured Notification Messages

Every user-visible `ctx.ui.notify` callsite now flows through the V2 `notify(ctx, pi, NotificationMessage)` and `notifyUsageError(ctx, UsageErrorMessage)` structured entry points; severity, reload hint, and per-row soft-dep markers are computed from message contents at notify time rather than caller-supplied. The v1.3 34-rule MSG-\* drift guard plugin (`tests/lint-rules/`) is retired in favor of closed-set type encoding (PluginStatus / MarketplaceStatus / Reason / StatusToken / Marker unions in `shared/notify.ts`).

User-visible changes:

- No user-visible message-format changes vs v1.3 -- the catalog output shape was locked in Phase 17 (v2.0 always-marketplace-header spec) and has been catalog-UAT GREEN since. v1.4 is a structural / internal milestone.

Internals:

- V2 type model: `NotificationMessage` / `MarketplaceNotificationMessage` / `PluginNotificationMessage` (10-variant discriminated union) / `PluginStatus` / `MarketplaceStatus` / `Dependency` / `UsageErrorMessage` shipped in `shared/notify.ts` (SNM-01..11, SNM-21).
- V2 public API: `notify()` derives severity / reload trailer / per-row soft-dep markers from contents (SNM-12..18, SNM-30).
- Spec rewrite: `docs/messaging-style-guide.md` v2.0 + `docs/output-catalog.md` v2.0 + catalog UAT runner driven by structured fixtures (SNM-19, SNM-20, SNM-26, SNM-31).
- All `notifySuccess` / `notifyWarning` / `notifyError` callsites migrated across `orchestrators/marketplace/*`, `orchestrators/plugin/*`, `orchestrators/import/*`, and `edge/handlers/*`; V1 wrappers deleted from `shared/notify.ts` (SNM-22). All `notifyUsageError(ctx, msg, usage)` callsites migrated to V2 1-arg form (SNM-23).
- Drift-guard teardown: `tests/lint-rules/` (73 files), `tests/architecture/ msg-rule-registry.test.ts`, `tests/architecture/no-legacy-markers.test.ts` deleted; `eslint.config.js` rewritten to stock rules + retained BLOCKS A/B/C/D/E + new `persistence/migrate.ts` block-level no-console override (SNM-24, SNM-25, SNM-27, SNM-28).
- Source consolidation: `shared/grammar/` deleted; REASONS / STATUS_TOKENS / MARKERS / PATTERN_CLASSES inlined into `shared/notify.ts` (SNM-29). `presentation/` directory deleted; 5 utilities relocated (composeError WithCauseChain → `shared/errors.ts`; compareByNameThenScope → `shared/ notify.ts`; EntityErrorRow → file-local in `orchestrators/plugin/ install.ts`; sourceLogical / ParsedSource → direct from `domain/ source.ts` via narrowed BLOCK C edge zone; renderMarketplaceList deleted, zero callers).
- `edge/args-schema.ts` callback parameter renamed `notifyError` → `onError` for V1-era name-shadow cleanup.

1120/1120 tests green; lint + format + types clean.

## [0.2.0] - 2026-05-25 -- v1.3 Consistent Messaging

Every user-visible `ctx.ui.notify` callsite (and the single sanctioned `console.warn`) now conforms to `docs/messaging-style-guide.md` v1.0 and the per-command catalog in `docs/output-catalog.md`. The v1.3 user-contract is structurally enforced by a 34-rule ESLint drift-guard plugin and a byte-equality catalog UAT runner.

User-visible changes:

- Universal compact-line grammar `<icon> <subject> [<scope>] [<marker>] [(status)] [{reasons}]` on every notify line; closed status-token + reasons enum; reasons rendered as 1-3 words lowercase.
- Plugin-row icon discipline: `●` installed / `○` uninstalled-no-error / `⊘` error or failure-cascade child. Marketplace icons reflect outcome class.
- Per-scope marketplace and plugin rendering, name-primary + scope-secondary sort (project before user). Per-row soft-dep markers `{requires pi-subagents}` / `{requires pi-mcp}` replace the aggregated trailer.
- Single canonical reload trailer `/reload to pick up changes`; the legacy three-verb selector (`Run /reload to load|refresh|drop "..."`) is retired.
- Single canonical manual-recovery `⊘ <resource> (manual recovery) {<reason>}` line and rollback-partial `{rollback partial}` reason + per-phase indented children; cause chains rendered per style guide §9.
- ES-5 supersession (PRD §6.12 markers retired): the 5 legacy strings are reachable only via `docs/messaging-style-guide.md` §15 and the static-audit fixture.

Internals:

- New `shared/grammar/` closed-set constants (`STATUS_TOKENS`, `REASONS`, `MARKERS`, `PATTERN_CLASSES`) with YAML-frontmatter set-equality drift test reading the style guide as the binding contract.
- New `presentation/` Wave 1 composers (`compact-line`, `cascade-summary`, `manual-recovery`, `rollback-partial`, `cause-chain`, `reload-hint`, `sort`) consumed by every user-visible orchestrator.
- New `tests/lint-rules/` 34-rule MSG-\* drift-guard ESLint plugin (16 meta-assertion + 18 full-impl); 4-way registry parity test ties style-guide body to rule files to ESLint wiring to plugin module.
- New `tests/architecture/catalog-uat.test.ts` byte-equality runner against `docs/output-catalog.md`.
- `InstallPluginOutcome.installed` and `PluginCascadeRow` carry REQUIRED `declaresAgents` / `declaresMcp` predicates (CMC-13), propagated through install / reinstall / update / import.
- Cross-scope cascade ordering canonicalized via `presentation/sort.ts::compareByNameThenScope` (CR-01); active two-axis MSG-GR-3 lint rule prevents regression in orchestrators.

1249/1249 tests green; lint + format + types clean.

## [0.1.7] - 2026-05-16

- Added `/claude:plugin reinstall` command: re-stages an installed plugin from its cached marketplace manifest without touching the network or changing the recorded version. Supports `reinstall <plugin>@<marketplace>`, `reinstall @<marketplace>`, bare `reinstall`, `--scope user|project`, and `--force` for plugins whose previous agent files were manually edited. Failure preserves the previous installed plugin, resources, and data directory; the plugin data directory is cleaned up only after the replacement and state commit succeed.

## [0.1.6] - 2026-05-16

- Added convenience `import` command to install marketplaces and plugins defined in the Claude Code configuration.

## [0.1.5] - 2026-05-16

- Added `/claude:plugin bootstrap` command: one-shot setup of the official Anthropic marketplace (`anthropics/claude-plugins-official`) in user scope with autoupdate enabled. Idempotent -- safe to re-run.
- Model specifications in plugin agent manifests are ignored unless the `--map-models` option is used when installing or updatinga plugin.

## [0.1.4] - 2026-05-15

- Clearer marketplace/plugin scoping rules.
- Completion on `/claude:plugin install` is limited to available plugins.

## [0.1.3] - 2026-05-15

- Fixed user-scope path resolution to honor Pi's agent home override.
- Updated the demo recording to use an isolated Pi home.

## [0.1.2] - 2026-05-13

- Lowered Node.js engine requirement to `>=20.19.0` and downgraded `write-file-atomic` to v7 for broader compatibility.
- Updated project branding images (SVG/PNG).

## [0.1.1] - 2026-05-13

- Moved @mariozechner packages to @earendil-works packages.

## [0.1.0] - 2026-05-12

- Initial release of `pi-claude-marketplace`.
- Supports four Claude plugin component types in Pi: skills, commands, agents, and MCP servers.
