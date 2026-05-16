# Changelog

## [0.1.5] - 2026-05-16

- Added `/claude:plugin bootstrap` command: one-shot setup of the official Anthropic marketplace (`anthropics/claude-plugins-official`) in user scope with autoupdate enabled. Idempotent -- safe to re-run.
- Moved `TOP_LEVEL_SUBCOMMANDS` and `MARKETPLACE_SUBCOMMANDS` to `router.ts` so completion provider and router stay in sync automatically.

## [0.1.4] - 2026-05-15

- Implemented marketplace/plugin scope rules (CMP-1..8) for user and project installs, updates, uninstalls, and completions.
- Added project-scope install fallback to user marketplaces when no same-named project marketplace exists.
- Added project-precedence resolution for unqualified installed-plugin operations (uninstall, update).
- Applied the same project-precedence rule to unqualified `marketplace remove` and `marketplace update` -- when a marketplace name exists in both scopes, the project-scope record is used instead of erroring with an ambiguity message.
- Limited install completions to available (not already installed, not unavailable) plugins for the current target scope.
- `tmp/` is now excluded from ESLint and Prettier so `npm run check` passes cleanly when Pi runtime artifacts are present.
- Simplified `scripts/pi.sh`: removed `--clear-screen` alias, `--option=value` forms, redundant tilde expansion, and the `pushd`/`trap` dance.

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
