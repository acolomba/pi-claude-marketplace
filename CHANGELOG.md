# Changelog

## [0.1.4] - 2026-05-15

- Implemented marketplace/plugin scope rules for user and project installs, updates, uninstalls, and completions.
- Added project-scope install fallback to user marketplaces and project-precedence resolution for unqualified installed-plugin operations.
- Limited install completions to available plugins for the selected target scope.

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
