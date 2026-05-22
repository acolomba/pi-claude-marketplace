# Changelog

## [Unreleased] - v1.3 Phase 12 messaging foundations

- Reload-hint trailer collapsed to the single canonical form `/reload to pick up changes` (style guide MSG-RH-1). The legacy three-verb selector (`Run /reload to load|refresh|drop "..."`) is retired from `presentation/reload-hint.ts`. 8 reload-hint callsite trailers now emit `/reload to pick up changes`; Phase 12 carve-out per D-CMC-10; roadmap criterion #2 authorizes (the verb-selector removal is the WHAT, which structurally requires the trailer to change wherever the composer is called; roadmap criterion #4 "user-visible output unchanged except for migrate.ts" is read as authorized-by-criterion-#2 for this carve-out). The legacy `RELOAD_HINT_PREFIX` constant in `shared/markers.ts` is retained as a snapshot-test-only export through Phase 12 per D-CMC-08; Phase 13's atomic three-file edit deletes it together with the markers-snapshot row and the PRD §6.12 row.

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
