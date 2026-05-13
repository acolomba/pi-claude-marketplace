<!-- markdownlint-disable MD033 MD041 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/images/redpi.png" alt="Pi Claude Marketplace logo" width="360">
</p>
<!-- markdownlint-enable MD033 MD041 -->

# Pi Claude Marketplace

[![CI](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=alert_status)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=coverage)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=bugs)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=code_smells)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=security_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace)

Access Claude plugin marketplaces from Pi Coding Agent.

<!-- markdownlint-disable MD033 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/demos/marketplace-add-plugin-install.gif" alt="Marketplace install demo" width="720">
</p>
<!-- markdownlint-enable MD033 -->

## Features

Installs plugins from the Claude plugin marketplace that contain these components:

- Commands.
- Skills.
- Agents. Requires [pi-subagents](https://pi.dev/packages/pi-subagents).
- MCP servers. Requires [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter).

Plugins that contain unsupported components are marked as "unavailable". The compatible parts may still be installed, but the plugin will not work as originally intended.

## Prerequisites

- [Pi Coding Agent](https://pi.dev)
- [pi-subagents](https://pi.dev/packages/pi-subagents) (optional but recommended)
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) (optional but recommended)

## Usage

Install the Pi extension:

```bash
pi install npm:pi-claude-marketplace
```

In Pi, add the Anthropic marketplace:

```text
/claude:plugin marketplace add anthropics/claude-plugins-official
```

A marketplace may also be added local to a project:

```text
/claude:plugin marketplace add anthropics/claude-plugins-official --scope project
```

List plugins available for installation:

```text
/claude:plugin list claude-plugins-official --available
```

Install a plugin:

```text
/claude:plugin install pr-review-toolkit@claude-plugins-official
```

Then reload:

```text
/reload
```

Set autoupdate:

```text
/claude:plugin marketplace autoupdate claude-plugins-official
```

Plugins are automatically updated when the marketplace is updated:

```text
/claude:plugin marketplace update
```

### Name mapping

Command and skill names are prefixed with the plugin name. If the command or skill is already prefixed with the plugin name plus `-`, that common part is elided.

Commands use Pi's prompt-command colon form:

| Plugin name | Command or skill name | Pi name    |
| ----------- | --------------------- | ---------- |
| `foo`       | `bar`                 | `/foo:bar` |
| `foo`       | `foo-bar`             | `/foo:bar` |
| `foo`       | `foo`                 | `/foo:foo` |

Skills use hyphenated generated names because Pi skill names may contain only lowercase letters, numbers, and hyphens. They can be invoked through Pi's `/skill` command:

| Plugin name | Skill name | Pi name          |
| ----------- | ---------- | ---------------- |
| `foo`       | `bar`      | `/skill:foo-bar` |
| `foo`       | `foo-bar`  | `/skill:foo-bar` |
| `foo`       | `foo`      | `/skill:foo`     |

MCP server names are not prefixed or rewritten. The server name is the key from the plugin's `mcpServers` object. If another MCP config already uses that name, the plugin install or update fails.

| Plugin name | `mcpServers` key | Pi MCP server name               |
| ----------- | ---------------- | -------------------------------- |
| `foo`       | `api`            | `api`                            |
| `foo`       | `foo-api`        | `foo-api`                        |
| `bar`       | `api`            | conflict if `api` already exists |

## `/claude:plugin` reference

This extension mirrors Claude Code's `/plugin` command. Use `/claude:plugin` in Pi for marketplace and plugin operations, then run `/reload` after installing, uninstalling, or updating plugins so Pi discovers the changed resources.

### Marketplace

Add a marketplace from a GitHub repository shorthand, matching Claude Code's common `/plugin marketplace add owner/repo` form:

```text
/claude:plugin marketplace add anthropics/claude-plugins-official
```

Add the same marketplace from a GitHub URL:

```text
/claude:plugin marketplace add https://github.com/anthropics/claude-plugins-official
```

Pin a GitHub marketplace to a branch, tag, or commit with a `#ref` suffix:

```text
/claude:plugin marketplace add https://github.com/anthropics/claude-plugins-official#main
```

Add a marketplace from the local filesystem. The path may be a directory containing `.claude-plugin/marketplace.json` or a direct path to a `marketplace.json` file:

```text
/claude:plugin marketplace add ./my-marketplace
/claude:plugin marketplace add ./my-marketplace/.claude-plugin/marketplace.json
```

Add a marketplace local to the current project with `--scope project`. The default scope is `user`:

```text
/claude:plugin marketplace add anthropics/claude-plugins-official --scope project
```

List configured marketplaces:

```text
/claude:plugin marketplace list
/claude:plugin marketplace ls
```

Refresh one marketplace, or all marketplaces when no name is provided:

```text
/claude:plugin marketplace update claude-plugins-official
/claude:plugin marketplace update
```

Remove a marketplace and all plugins installed from it:

```text
/claude:plugin marketplace remove claude-plugins-official
/claude:plugin marketplace rm claude-plugins-official
```

Toggle marketplace plugin auto-updates. When the marketplace is updated manually, plugins are automatically updated:

```text
/claude:plugin marketplace autoupdate claude-plugins-official
/claude:plugin marketplace noautoupdate claude-plugins-official
```

`/claude:plugin marketplace add`, `remove`, `list`, and `update` intentionally follow Claude Code's `/plugin marketplace ...` command shape where this extension supports the same operation. Today this extension accepts GitHub shorthands such as `owner/repo`, GitHub HTTPS URLs, and filesystem paths; arbitrary Git hosts and remote `marketplace.json` URLs are not installable yet.

### Plugin

List plugins available for installation. Omit the marketplace name to list across configured marketplaces:

```text
/claude:plugin list claude-plugins-official --available
/claude:plugin list --available
```

Filter list output by status:

```text
/claude:plugin list --installed
/claude:plugin list --available
/claude:plugin list --unavailable
```

Install a plugin, using the same `<plugin>@<marketplace>` reference format as Claude Code's `/plugin install`:

```text
/claude:plugin install pr-review-toolkit@claude-plugins-official
```

Install into project scope instead of user scope:

```text
/claude:plugin install pr-review-toolkit@claude-plugins-official --scope project
```

Update one installed plugin, every installed plugin from one marketplace, or all installed plugins:

```text
/claude:plugin update pr-review-toolkit@claude-plugins-official
/claude:plugin update @claude-plugins-official
/claude:plugin update
```

Uninstall a plugin:

```text
/claude:plugin uninstall pr-review-toolkit@claude-plugins-official
```

Reload Pi after changes:

```text
/reload
```

Claude Code users may expect `/reload-plugins`; in Pi, use `/reload`. Claude Code's `/plugin` interactive tabs, plugin enable/disable commands, local scope, hooks, output styles, and LSP server activation are not provided by this extension.

## Development

Install pre-commit hooks:

```bash
pre-commit install
pre-commit install --hook-type commit-msg
```

Enable Git LFS for large binary assets such as images and videos:

```bash
git lfs install
```

Build:

```bash
npm install
npm run check
```

## AI disclaimer

This project is developed with AI agent engineering practices using the [GSD](https://github.com/gsd-build/get-shit-done) spec-driven development system.

The author vibe-coded a prototype until it was feature-complete for a first release, then extracted and reviewed a PRD from the implementation.

The PRD was then used to guide GSD through discussion, planning and implementation phases of a new implementation.

## License

This project is licensed under the MIT License - see the [COPYING](COPYING) file for details

Copyright 2026 [Alessandro Colomba](https://github.com/acolomba)
