<!-- markdownlint-disable MD033 MD041 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/images/redpi.png" alt="Pi Claude Marketplace logo" width="360">
</p>
<!-- markdownlint-enable MD033 MD041 -->

# Pi Claude Marketplace

[![CI](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=alert_status)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=coverage)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=bugs)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=code_smells)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=security_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![GitHub](https://img.shields.io/badge/GitHub-acolomba%2Fpi--claude--marketplace-181717?logo=github&logoColor=white)](https://github.com/acolomba/pi-claude-marketplace) [![npm](https://img.shields.io/badge/npm-pi--claude--marketplace-cb3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/pi-claude-marketplace) [![pi.dev](https://img.shields.io/badge/pi.dev-pi--claude--marketplace-09090b?logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgODAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgcng9IjEyMCIgZmlsbD0iIzA5MDkwYiIvPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTE2NS4yOSAxNjUuMjlINTE3LjM2VjQwMEg0MDBWNTE3LjM2SDI4Mi42NVY2MzQuNzJIMTY1LjI5Wk0yODIuNjUgMjgyLjY1VjQwMEg0MDBWMjgyLjY1WiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik01MTcuMzYgNDAwSDYzNC43MlY2MzQuNzJINTE3LjM2WiIvPjwvc3ZnPg==)](https://pi.dev/packages/pi-claude-marketplace)

Access Claude plugin marketplaces from [Pi Coding Agent](https://pi.dev).

<!-- markdownlint-disable MD033 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/demos/bootstrap.gif" alt="Bootstrap demo" width="720">
</p>
<!-- markdownlint-enable MD033 -->

## Features

This extension installs plugins from Claude plugin marketplaces that contain these components:

- Commands.
- Skills.
- Agents. Requires [pi-subagents](https://pi.dev/packages/pi-subagents).
- Hooks. Partial support. For more information, see [Hook compatibility](docs/hooks-compatibility.md).
- MCP servers. Requires [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter).

Plugins that contain unsupported components can be partially installed. A partially installed plugin may fail to work as intended.

The `/claude:plugin` command manages Claude marketplaces and plugins, like Claude Code's `/plugin`. A desired-state configuration in `[~/].pi/agent/claude-plugins[.local].json` files makes plugin installations automatic and repeatable. You can share these files across machines or team members.

## Prerequisites

- [Pi Coding Agent](https://pi.dev)
- [pi-subagents](https://pi.dev/packages/pi-subagents) (optional but recommended, `pi install npm:pi-subagents`)
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) (optional but recommended, `pi install npm:pi-mcp-adapter`)

## Usage

Install the Pi extension:

```bash
pi install npm:pi-claude-marketplace
```

Bootstrap the official Claude plugin marketplace (`anthropics/claude-plugins-official`):

```text
/claude:plugin bootstrap
```

List plugins available for installation:

```text
/claude:plugin list --available
```

Install a plugin:

```text
/claude:plugin install pr-review-toolkit@claude-plugins-official
```

Add another marketplace:

```text
/claude:plugin marketplace add upstash/context7
```

List its plugins:

```text
/claude:plugin list context7-marketplace --available
```

Add another plugin:

```text
/claude:plugin install context7-plugin@context7-marketplace
```

Then reload:

```text
/reload
```

Run a plugin:

```text
/pr-review-toolkit:review-pr
```

### Name mapping

This extension prefixes command and skill names with the plugin name. If the name already starts with the plugin name and `-`, this extension removes that common part.

Commands and skill names use Pi's colon form:

| Plugin name | Command or skill name | Pi name    |
| ----------- | --------------------- | ---------- |
| `foo`       | `bar`                 | `/foo:bar` |
| `foo`       | `foo-bar`             | `/foo:bar` |
| `foo`       | `foo`                 | `/foo:foo` |

This extension also registers skills with hyphenated names after the `/skill:` prefix:

| Plugin name | Skill name | Pi name          |
| ----------- | ---------- | ---------------- |
| `foo`       | `bar`      | `/skill:foo-bar` |
| `foo`       | `foo-bar`  | `/skill:foo-bar` |
| `foo`       | `foo`      | `/skill:foo`     |

MCP server names do not change. If another MCP configuration already uses that name, the plugin install or update fails.

| Plugin name | `mcpServers` key | Pi MCP server name                 |
| ----------- | ---------------- | ---------------------------------- |
| `foo`       | `api`            | `api`                              |
| `foo`       | `foo-api`        | `foo-api`                          |
| `bar`       | `api`            | _conflict if `api` already exists_ |

### Scoping

You can install marketplaces and plugins in the user scope or the project scope. The default is user scope.

The project scope inherits the user scope. So you can install a plugin from a user-scope marketplace into the project scope.

You can also install the same plugin in both the user and project scopes. Then the user-scope plugin takes precedence.

### Partially available plugins

Some plugins contain unsupported components: an unmappable hook, an LSP server, or a theme. To install or update these plugins partially, pass the `--partial` option. This extension installs the supported components and ignores the unsupported ones.

List partially available plugins.

```text
/claude:plugin list --partial
```

Install a partially available plugin. Put `--partial` first to enable argument completion for partially available plugins. Without that flag, completion excludes them.

```text
/claude:plugin install --partial hookify@claude-plugins-official
```

## Configuration files

Each scope stores its declarative configuration for marketplaces and plugins in `claude-plugins.json`, under the scope root.

| Scope     | File path                         |
| --------- | --------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.json` |
| `project` | `<cwd>/.pi/claude-plugins.json`   |

These files are the authoritative record of the installed marketplaces and plugins. Pi applies their contents at extension load (`/reload`).

### Local configuration files

Each scope can also have a `claude-plugins.local.json` file alongside the base file.

| Scope     | File path                               |
| --------- | --------------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.local.json` |
| `project` | `<cwd>/.pi/claude-plugins.local.json`   |

The local file overrides individual entries from the base file. An entry in `claude-plugins.local.json` replaces the same-keyed entry in `claude-plugins.json` completely.

Pass `--local` to any mutating command to target the local file only.

```text
/claude:plugin install context7-plugin@context7-marketplace --local
/claude:plugin marketplace autoupdate context7-marketplace --local
```

### Gitignore convention

In the project scope, commit `claude-plugins.json`. Then your collaborators install the same marketplaces and plugins. Keep `claude-plugins.local.json` out of version control. Add this line to your project's `.gitignore`:

```text
.pi/claude-plugins.local.json
```

User-scope files live in your home directory. They are personal and never shared.

## Command reference

This extension mirrors Claude Code's `/plugin` command. Use `/claude:plugin` in Pi for marketplace and plugin operations. After you install, uninstall, update, or reinstall plugins, run `/reload`. Then Pi discovers the changed resources.

### Marketplace

Add a marketplace from a GitHub repository `owner/repo` shorthand.

```text
/claude:plugin marketplace add upstash/context7
```

> [!NOTE]
> If Git is not already authenticated, a private repository will trigger Device Flow authentication.

Add the same marketplace from a GitHub URL.

```text
/claude:plugin marketplace add https://github.com/upstash/context7-marketplace
```

Pin a GitHub marketplace to a branch, tag, or commit with a `#ref` suffix.

```text
/claude:plugin marketplace add https://github.com/upstash/context7-marketplace#v1.0.30
```

Add a marketplace from the local filesystem. The path can be a directory with `.claude-plugin/marketplace.json`, or a direct path to a `marketplace.json` file.

```text
/claude:plugin marketplace add ~/my-marketplace
/claude:plugin marketplace add ~/my-marketplace/.claude-plugin/marketplace.json
```

Add a marketplace local to the current project with `--scope project`. The default scope is `user`.

```text
/claude:plugin marketplace add upstash/context7-marketplace --scope project
```

List configured marketplaces.

```text
/claude:plugin marketplace list
/claude:plugin marketplace ls
```

Show details for one marketplace.

```text
/claude:plugin marketplace info context7-marketplace
/claude:plugin marketplace info context7-marketplace --scope user
```

Update one marketplace. If you omit the name, the command updates all marketplaces.

```text
/claude:plugin marketplace update context7-marketplace
/claude:plugin marketplace update
```

Remove a marketplace and all plugins installed from it.

```text
/claude:plugin marketplace remove context7-marketplace
/claude:plugin marketplace rm context7-marketplace
```

Toggle marketplace plugin auto-updates. When you update the marketplace manually, this extension also updates the installed plugins.

```text
/claude:plugin marketplace autoupdate context7-marketplace
/claude:plugin marketplace noautoupdate context7-marketplace
```

### Plugin

List plugins available for installation. Omit the marketplace name to list across configured marketplaces.

```text
/claude:plugin list context7-marketplace --available
/claude:plugin list --available
```

Filter the list by plugin status, installed, available for installation, partially available (not all features supported), remote (a plugin in a remote repository not yet fetched), or unavailable to install.

```text
/claude:plugin list --installed
/claude:plugin list --available
/claude:plugin list --partial
/claude:plugin list --remote
/claude:plugin list --unavailable
```

Show details for one plugin.

```text
/claude:plugin info context7-plugin@context7-marketplace
```

Install a plugin with the `<plugin>@<marketplace>` format.

```text
/claude:plugin install context7-plugin@context7-marketplace
```

Install in the project scope instead of the user scope.

```text
/claude:plugin install context7-plugin@context7-marketplace --scope project
```

Update one installed plugin, every installed plugin from one marketplace, or all installed plugins.

```text
/claude:plugin update context7-plugin@context7-marketplace
/claude:plugin update @context7-marketplace
/claude:plugin update
```

> [!NOTE]
> Agent definitions in plugins can name a preferred model for the agent, for example "sonnet" or "opus". This extension discards these models by default. To map them to Pi models as a best effort, use the `--map-model` option with `install` and `update`.

Reinstall one installed plugin, every installed plugin from one marketplace, or all installed plugins.

```text
/claude:plugin reinstall context7-plugin@context7-marketplace
/claude:plugin reinstall @context7-marketplace
/claude:plugin reinstall
```

Limit reinstall to one scope with `--scope user` or `--scope project`. The flag can appear before or after the target:

```text
/claude:plugin reinstall --scope project
/claude:plugin reinstall @context7-marketplace --scope user
```

Uninstall a plugin.

```text
/claude:plugin uninstall context7-plugin@context7-marketplace
```

Reload Pi after changes.

```text
/reload
```

#### Remote plugins

Marketplaces can declare remote plugins hosted in a different Git repository. You can list them with the `--remote` option.

```text
/claude:plugin list --remote
```

This extension fetches remote plugin repositories only when needed. So `/claude:plugin info` does not resolve their components. To fetch the repository of one plugin, pass the `--fetch` option.

```text
/claude:plugin info 2crunch-api-security-testing@claude-plugins-official --fetch
```

You can also fetch repositories ahead of time. Fetch one remote plugin, all plugins in one marketplace, or all remote plugins across all marketplaces:

```text
/claude:plugin fetch 2crunch-api-security-testing@claude-plugins-official
/claude:plugin fetch @claude-plugins-official
/claude:plugin fetch
```

After the fetch, each plugin is available, partially available, or unavailable to install.

The `/claude:plugin install` command automatically fetches a remote plugin.

```text
/claude:plugin install 2crunch-api-security-testing@claude-plugins-official
```

### Bootstrap

Bootstrap is a one-step setup. It adds the official Anthropic marketplace in the user scope and enables autoupdate.

```text
/claude:plugin bootstrap
```

It runs these commands:

```text
/claude:plugin marketplace add anthropics/claude-plugins-official
/claude:plugin marketplace autoupdate claude-plugins-official
```

### Import

The `import` command adds marketplaces and plugins already defined in Claude Code settings.

```text
/claude:plugin import
```

By default, the import adds each marketplace and plugin to the same scope it has in Claude Code. You can also limit the import to a specific scope.

```text
/claude:plugin import --scope user
/claude:plugin import --scope project
```

The import skips plugins that Pi cannot install because of unsupported components. It shows a warning for each one.

## Contributing

Read [CONTRIBUTING](CONTRIBUTING.md) and [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md).

## AI disclaimer

The author developed this project with AI agent engineering practices. It uses the [Open GSD](https://www.opengsd.net/) spec-driven development system.

The author vibe-coded a prototype until it was feature-complete for a first release, then extracted and reviewed a PRD from the implementation.

The PRD then guided GSD through the discussion, planning, and implementation phases of a new implementation.

## License

The MIT License covers this project. For details, read the [COPYING](COPYING) file.

Copyright 2026 [Alessandro Colomba](https://github.com/acolomba)
