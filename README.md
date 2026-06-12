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
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/demos/bootstrap.gif" alt="Bootstrap demo" width="720">
</p>
<!-- markdownlint-enable MD033 -->

## Features

Installs plugins from the Claude plugin marketplace that contain these components:

- Commands.
- Skills.
- Agents. Requires [pi-subagents](https://pi.dev/packages/pi-subagents).
- MCP servers. Requires [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter).

Plugins that contain unsupported components are marked as "unavailable".

## Prerequisites

- [Pi Coding Agent](https://pi.dev)
- [pi-subagents](https://pi.dev/packages/pi-subagents) (optional but recommended, `pi install npm:pi-subagents`)
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) (optional but recommended, `pi install npm:pi-mcp-adapter`)

## Usage

Install the Pi extension.

```bash
pi install npm:pi-claude-marketplace
```

Bootstrap the official Claude plugin marketplace (`anthropics/claude-plugins-official`).

```text
/claude:plugin bootstrap
```

List plugins available for installation.

```text
/claude:plugin list --available
```

Install a plugin.

```text
/claude:plugin install pr-review-toolkit@claude-plugins-official
```

Add another marketplace.

```text
/claude:plugin marketplace add upstash/context7
```

List its plugins.

```text
/claude:plugin list context7-marketplace --available
```

Add another plugin.

```text
/claude:plugin install context7-plugin@context7-marketplace
```

Then reload.

```text
/reload
```

Run a plugin:

```text
/pr-review-toolkit:review-pr
```

### Name mapping

Command and skill names are prefixed with the plugin name. If the command or skill is already prefixed with the plugin name plus `-`, that common part is elided.

Commands and skill names use Pi's colon form:

| Plugin name | Command or skill name | Pi name    |
| ----------- | --------------------- | ---------- |
| `foo`       | `bar`                 | `/foo:bar` |
| `foo`       | `foo-bar`             | `/foo:bar` |
| `foo`       | `foo`                 | `/foo:foo` |

Skills are also registered with hyphenated names after the `/skill:` prefix:

| Plugin name | Skill name | Pi name          |
| ----------- | ---------- | ---------------- |
| `foo`       | `bar`      | `/skill:foo-bar` |
| `foo`       | `foo-bar`  | `/skill:foo-bar` |
| `foo`       | `foo`      | `/skill:foo`     |

MCP server names are not prefixed or rewritten. The server name is the key from the plugin's `mcpServers` object. If another MCP config already uses that name, the plugin install or update fails.

| Plugin name | `mcpServers` key | Pi MCP server name                 |
| ----------- | ---------------- | ---------------------------------- |
| `foo`       | `api`            | `api`                              |
| `foo`       | `foo-api`        | `foo-api`                          |
| `bar`       | `api`            | _conflict if `api` already exists_ |

### Scoping

Marketplaces and plugins can be installed in the user scope or in the current project's scope. The default is user scope.

The user scope is inherited, so it is possible to install a plugin from a user-scope marketplace in the project scope.

It is also possible to install the same plugin in both user and project scopes; the plugin in the user scope takes precedence.

## Configuration files

Each scope stores its declarative marketplace and plugin configuration in `claude-plugins.json` under the scope root.

| Scope     | File path                         |
| --------- | --------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.json` |
| `project` | `<cwd>/.pi/claude-plugins.json`   |

Every mutating command (`marketplace add`, `marketplace remove`, `marketplace autoupdate`, `marketplace noautoupdate`, `install`, `uninstall`, `enable`, `disable`, `import`, `bootstrap`) records its change into this file. The file is the authoritative record of which marketplaces and plugins are installed. Pi applies its contents at extension load (`/reload`).

### Local configuration files

Each scope can also have a `claude-plugins.local.json` file alongside the base file.

| Scope     | File path                               |
| --------- | --------------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.local.json` |
| `project` | `<cwd>/.pi/claude-plugins.local.json`   |

The local file overrides individual entries from the base file: a marketplace or plugin entry in `claude-plugins.local.json` replaces the same-keyed entry in `claude-plugins.json` wholesale.

Pass `--local` to any mutating command to target the local file.

```text
/claude:plugin install context7-plugin@context7-marketplace --local
/claude:plugin marketplace autoupdate context7-marketplace --local
```

A `--local` write never touches the base file.

### Gitignore convention

In the project scope, commit `claude-plugins.json` so collaborators install the same marketplaces and plugins, but keep `claude-plugins.local.json` out of version control. Add the following to your project's `.gitignore`.

```text
.pi/claude-plugins.local.json
```

User-scope files live in your home directory; they are personal and never shared.

## `/claude:plugin` reference

This extension mirrors Claude Code's `/plugin` command. Use `/claude:plugin` in Pi for marketplace and plugin operations, then run `/reload` after installing, uninstalling, updating, or reinstalling plugins so Pi discovers the changed resources.

### Marketplace

Add a marketplace from a GitHub repository `owner/repo` shorthand.

```text
/claude:plugin marketplace add upstash/context7
```

> [!NOTE]
> Private repositories may trigger a Device Flow authentication if Git is not already authenticated.

Add the same marketplace from a GitHub URL.

```text
/claude:plugin marketplace add https://github.com/upstash/context7-marketplace
```

Pin a GitHub marketplace to a branch, tag, or commit with a `#ref` suffix.

```text
/claude:plugin marketplace add https://github.com/upstash/context7-marketplace#v1.0.30
```

Add a marketplace from the local filesystem. The path may be a directory containing `.claude-plugin/marketplace.json` or a direct path to a `marketplace.json` file.

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

Update one marketplace, or all marketplaces if a name is omitted.

```text
/claude:plugin marketplace update context7-marketplace
/claude:plugin marketplace update
```

Remove a marketplace and all plugins installed from it.

```text
/claude:plugin marketplace remove context7-marketplace
/claude:plugin marketplace rm context7-marketplace
```

Toggle marketplace plugin auto-updates. When the marketplace is updated manually, installed plugins are automatically updated.

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

Filter the list by plugin status, installed, available for installation, or unavailable to install.

```text
/claude:plugin list --installed
/claude:plugin list --available
/claude:plugin list --unavailable
```

Show details for one plugin.

```text
/claude:plugin info context7-plugin@context7-marketplace
```

Install a plugin, using the `<plugin>@<marketplace>` format.

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
> Agent definitions in plugins may include a preferred model for running the agent, e.g. "sonnet", "opus", etc. These are discarded by default, but the `--map-model` option for `install` and `update`can be used to make a best-effort attempt at mapping these models to Pi models.

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

Force a reinstall should any foreign content have altered the plugin.

```text
/claude:plugin reinstall context7-plugin@context7-marketplace --force
```

Uninstall a plugin.

```text
/claude:plugin uninstall context7-plugin@context7-marketplace
```

Reload Pi after changes.

```text
/reload
```

### Bootstrap

Bootstrap is a convenience one-shot setup of the official Anthropic marketplace in the user scope with autoupdate enabled.

```text
/claude:plugin bootstrap
```

This is equivalent to running.

```text
/claude:plugin marketplace add anthropics/claude-plugins-official
/claude:plugin marketplace autoupdate claude-plugins-official
```

### Import

Import is a convenience command to import marketplaces and plugins already defined in Claude Code settings.

```text
/claude:plugin import
```

By default, marketplaces and plugins are added in accordance to the scope that they're defined in Claude Code. It's also possible to limit the import to a specific scope.

```text
/claude:plugin import --scope user
/claude:plugin import --scope project
```

Plugins that are not available for installation in Pi because of unsupported components are skipped with a warning.

## Contributing

Refer to [CONTRIBUTING](CONTRIBUTING.md) and [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md).

## AI disclaimer

This project is developed with AI agent engineering practices using the [Open GSD](https://www.opengsd.net/) spec-driven development system.

The author vibe-coded a prototype until it was feature-complete for a first release, then extracted and reviewed a PRD from the implementation.

The PRD was then used to guide GSD through discussion, planning and implementation phases of a new implementation.

## License

This project is licensed under the MIT License. See the [COPYING](COPYING) file for details.

Copyright 2026 [Alessandro Colomba](https://github.com/acolomba)
