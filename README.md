<!-- markdownlint-disable MD033 MD041 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/images/redpi.png" alt="Pi Claude Marketplace logo" width="360">
</p>
<!-- markdownlint-enable MD033 MD041 -->

# Pi Claude Marketplace

<!-- markdownlint-disable MD033 -->

<p align="center">
  <a href="https://github.com/acolomba/pi-claude-marketplace" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.4em">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" role="img"><title>GitHub</title><style>.invertocat{fill:#000}@media(prefers-color-scheme:dark){.invertocat{fill:#fff}}</style><path class="invertocat" fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>&nbsp;GitHub
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://www.npmjs.com/package/pi-claude-marketplace" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.4em">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><title>npm</title><path fill="#c12127" d="M0,16V0H16V16ZM3,3V13H8V5h3v8h2V3Z"/><path fill="#fff" d="M3,3H13V13H11V5H8v8H3Z"/></svg>&nbsp;npm
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://pi.dev/packages/pi-claude-marketplace" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.4em">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="16" height="16"><rect width="800" height="800" rx="120" fill="#09090b"/><path fill="#fff" fill-rule="evenodd" d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"/><path fill="#fff" d="M517.36 400H634.72V634.72H517.36Z"/></svg>&nbsp;pi.dev
  </a>
</p>
<!-- markdownlint-enable MD033 -->

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

## Command reference

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
