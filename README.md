<!-- markdownlint-disable MD033 MD041 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/images/redpi.png" alt="Pi Claude Marketplace logo" width="360">
</p>
<!-- markdownlint-enable MD033 MD041 -->

# Pi Claude Marketplace

[![CI](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/acolomba/pi-claude-marketplace/actions/workflows/ci.yml) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=alert_status)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=coverage)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=bugs)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=code_smells)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=acolomba_pi-claude-marketplace&metric=security_rating)](https://sonarcloud.io/summary/overall?id=acolomba_pi-claude-marketplace) [![GitHub](https://img.shields.io/badge/GitHub-acolomba%2Fpi--claude--marketplace-181717?logo=github&logoColor=white)](https://github.com/acolomba/pi-claude-marketplace) [![npm](https://img.shields.io/badge/npm-pi--claude--marketplace-cb3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/pi-claude-marketplace) [![pi.dev](https://img.shields.io/badge/pi.dev-pi--claude--marketplace-09090b?logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgODAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgcng9IjEyMCIgZmlsbD0iIzA5MDkwYiIvPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTE2NS4yOSAxNjUuMjlINTE3LjM2VjQwMEg0MDBWNTE3LjM2SDI4Mi42NVY2MzQuNzJIMTY1LjI5Wk0yODIuNjUgMjgyLjY1VjQwMEg0MDBWMjgyLjY1WiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik01MTcuMzYgNDAwSDYzNC43MlY2MzQuNzJINTE3LjM2WiIvPjwvc3ZnPg==)](https://pi.dev/packages/pi-claude-marketplace)

Access Claude plugin marketplaces from [Pi Coding Agent](https://pi.dev). Supports Claude commands, skills, agents, hooks, MCP servers and workflows.

<!-- markdownlint-disable MD033 -->

<p align="center">
  <img src="https://media.githubusercontent.com/media/acolomba/pi-claude-marketplace/refs/heads/main/demos/bootstrap.gif" alt="Bootstrap demo" width="720">
</p>
<!-- markdownlint-enable MD033 -->

## Features

This extension installs plugins from Claude plugin marketplaces that contain these components:

- Commands.
- Skills.
- Agents. Requires [pi-subagents](https://pi.dev/packages/pi-subagents). Agents in subfolders get their folder names, as in Claude Code, for example `demo:review:security`. Agents run in the foreground unless they set `background: true`. An agent gets the content of the skills it preloads.
- Hooks. Partial support. For more information, see [Hook compatibility](docs/hooks-compatibility.md).
- MCP servers. Requires [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter). For more information, see [MCP compatibility](docs/mcp-compatibility.md).
- Workflows. Requires [@quintinshaw/pi-dynamic-workflows](https://pi.dev/packages/@quintinshaw/pi-dynamic-workflows). For more information, see [Workflow compatibility](docs/workflows-compatibility.md).

Plugins that contain unsupported components can be partially installed. A partially installed plugin may fail to work as intended.

The `/claude:plugin` command manages Claude marketplaces and plugins, like Claude Code's `/plugin`. Desired-state configs in `[~/].pi/agent/claude-plugins[.local].json` make plugin installations automatic and repeatable. You can share these configs across machines or team members.

## Prerequisites

- [Pi Coding Agent](https://pi.dev) 1.4.0 or newer
- [pi-subagents](https://pi.dev/packages/pi-subagents) 0.84.0 or newer (optional but recommended, `pi install npm:pi-subagents`)
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) 7.0.0 or a later 7.x release (optional but recommended, `pi install npm:pi-mcp-adapter`). Pi's built-in MCP support does not satisfy this requirement.
- [@quintinshaw/pi-dynamic-workflows](https://pi.dev/packages/@quintinshaw/pi-dynamic-workflows) 3.15.0 or a later 3.x release (optional but recommended, `pi install npm:@quintinshaw/pi-dynamic-workflows`)

## Usage

For scripts, see [JSON output](docs/json-output.md).

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

Commands use a colon (`:`) on POSIX and a dot (`.`) on Windows:

| Plugin name | Command name | Pi name (POSIX) | Pi name (Windows) |
| ----------- | ------------ | --------------- | ----------------- |
| `foo`       | `bar`        | `/foo:bar`      | `/foo.bar`        |
| `foo`       | `foo-bar`    | `/foo:bar`      | `/foo.bar`        |
| `foo`       | `foo`        | `/foo:foo`      | `/foo.foo`        |

A command also has aliases in interactive sessions and over RPC. If the command's frontmatter sets `name`, the command also answers to `/<plugin>:<name>`, and to `/<name>` when the name has no colon. For example, `bar` with frontmatter `name: baz` in plugin `foo` also answers to `/foo:baz` and `/baz`. If two commands set the same `name`, the first command gets the alias. A skill keeps an alias that it already has. Command aliases use a colon on every platform.

Skills use Pi's `/skill:` form and also have aliases in interactive sessions and over RPC:

| Plugin name | Skill name                          | Pi skill form    | Aliases                        |
| ----------- | ----------------------------------- | ---------------- | ------------------------------ |
| `foo`       | `bar`                               | `/skill:foo-bar` | `/foo:bar`                     |
| `foo`       | `foo-bar`                           | `/skill:foo-bar` | `/foo:foo-bar`                 |
| `foo`       | `foo`                               | `/skill:foo`     | `/foo:foo`                     |
| `foo`       | `bar`, with frontmatter `name: baz` | `/skill:foo-bar` | `/foo:bar`, `/foo:baz`, `/baz` |

The aliases are the names that Claude Code gives a skill. The skill name is the name of the skill's folder. If the skill's frontmatter sets `name`, the skill also answers to `/<plugin>:<name>`, and to `/<name>` when the name has no colon. If two skills of a plugin set the same `name`, the first skill gets the alias. Skill aliases use a colon on every platform. If an alias conflicts with a command, the command takes precedence. If a skill has the same name as a command of its plugin, install skips the skill and warns. Use `/skill:foo-bar` to invoke the skill.

Plugin MCP servers get the names that Claude Code gives them. The model sees each tool as `mcp__plugin_<plugin>_<server>__<tool>`. pi-mcp-adapter stores each server under a key that ends with `_`. `/claude:plugin info` shows each server as `plugin:<plugin>:<server>`.

| Plugin name | `mcpServers` key | Adapter server key  | Tool names                      | Name shown by `info` |
| ----------- | ---------------- | ------------------- | ------------------------------- | -------------------- |
| `foo`       | `api`            | `plugin_foo_api_`   | `mcp__plugin_foo_api__<tool>`   | `plugin:foo:api`     |
| `foo`       | `my.db`          | `plugin_foo_my_db_` | `mcp__plugin_foo_my_db__<tool>` | `plugin:foo:my.db`   |
| `bar`       | `api`            | `plugin_bar_api_`   | `mcp__plugin_bar_api__<tool>`   | `plugin:bar:api`     |

### Scoping

You can install marketplaces and plugins in the user scope or the project scope. The default is user scope.

The project scope inherits the user scope. So you can install a plugin from a user-scope marketplace into the project scope.

You can also install the same plugin in both the user and project scopes. Then the user-scope plugin takes precedence.

### Partially available plugins

Some plugins contain unsupported components: an unmappable hook, an LSP server, a theme, an MCP server that uses a feature pi-mcp-adapter cannot run, or an MCP bundle. To install or update these plugins partially, pass the `--partial` option. This extension installs the supported components and ignores the unsupported ones.

List partially available plugins.

```text
/claude:plugin list --partial
```

Install a partially available plugin. Put `--partial` first to enable argument completion for partially available plugins. Without that flag, completion excludes them.

```text
/claude:plugin install --partial hookify@claude-plugins-official
```

## Configuration files

Each scope declares its marketplaces and plugins in two layers: the base layer and the local layer. The file of a layer is its config. The base config, `claude-plugins.json`, is under the scope root.

| Scope     | File path                         |
| --------- | --------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.json` |
| `project` | `<cwd>/.pi/claude-plugins.json`   |

The configs of a scope are the desired state of its marketplaces and plugins. The catalog of a marketplace is the list of plugins and versions that it offers. A new session or `/reload` does not change your installed plugins, unless you turn on [autoapply](#autoapply). It only lists the changes that your configs and the marketplace catalogs need.

To see those changes, run `/claude:plugin pending`. To make them, run `/claude:plugin apply`. Then run `/reload` so that Pi loads the result.

```text
/claude:plugin pending
/claude:plugin apply
/reload
```

Whether Pi applies a declared plugin's components depends on the entry's optional `enabled` key and on the install-time default the plugin author declares. For more information, see [Plugin enablement](docs/plugin-enablement.md).

### Autoapply

To make each new session and `/reload` apply your configs, turn on `autoapply`:

```text
/claude:plugin autoapply on
```

This sets the top-level `autoapply` key of a config to `true`. Like `enable`, it writes the user base config unless you add `--scope project` or `--local`. `/claude:plugin autoapply off` sets the key to `false`. Run `/claude:plugin autoapply` with no value to see the value in effect, the config that sets it, and each config's own value. With `--scope` or `--local`, it lists only those configs. A set does not run `apply`: the next load reads the new value. You can also edit the key by hand:

```json
{
  "autoapply": true,
  "plugins": { "context7-plugin@context7-marketplace": {} }
}
```

The default is `false`. When `autoapply` is on, the load runs `/claude:plugin apply` for both scopes before Pi looks for skills and prompts. So the plugins that it installs are ready in the same session. The load can clone repositories from the network, as `apply` does. A failed change shows as a failed row and stays in `pending`. The next load tries it again.

Any config can set `autoapply`. The most specific config that sets it wins, in this order: the project local config, the project base config, the user local config, and the user base config. If a config is not valid, for example because `autoapply` is not `true` or `false`, the load does not apply anything and reports the config.

A user config cannot turn off a project's `autoapply`, because the project configs are more specific. To stop it on your machine, set `"autoapply": false` in the project local config. A load never asks you to sign in. If a clone needs a credential that you have not stored, its row fails, and `/claude:plugin apply` can then ask you to sign in.

> [!WARNING]
> A project's base config is usually in version control. If it sets `autoapply` to `true`, starting `pi` in that project installs its plugins, hooks and MCP servers included, with no prompt. Read `.pi/claude-plugins.json` before you start `pi` in a project that you cloned. Claude Code has no such setting: it does not install a plugin that only a project's settings enable, and you install it with a command.

### The local config

The local config, `claude-plugins.local.json`, is next to the base config.

| Scope     | File path                               |
| --------- | --------------------------------------- |
| `user`    | `~/.pi/agent/claude-plugins.local.json` |
| `project` | `<cwd>/.pi/claude-plugins.local.json`   |

The local config overrides entries from the base config. To write to the local config, add `--local`:

```text
/claude:plugin marketplace add upstash/context7 --local
/claude:plugin install context7-plugin@context7-marketplace --local
```

### Gitignore convention

In the project scope, commit the base config, `claude-plugins.json`. Then your collaborators install the same marketplaces and plugins. Keep the local config, `claude-plugins.local.json`, out of version control. Add this line to your project's `.gitignore`:

```text
.pi/claude-plugins.local.json
```

User-scope configs live in your home directory. They are personal and never shared.

## Command reference

This extension mirrors Claude Code's `/plugin` command. Use `/claude:plugin` in Pi for marketplace and plugin operations. After you install, uninstall, update, or reinstall plugins, run `/reload`. Then Pi discovers the changed resources. If you edit a config by hand, run `/claude:plugin apply` before `/reload`.

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

Add a marketplace from another `https://` git host, such as GitLab.

```text
/claude:plugin marketplace add https://gitlab.com/my-group/my-marketplace
```

> [!NOTE]
> Device Flow authentication also covers `gitlab.com`. Non-GitHub hosts need the full `https://` URL; the `owner/repo` shorthand only resolves to GitHub.

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

Remove a marketplace and uninstall its plugins. A dependency that another plugin still needs stays installed.

```text
/claude:plugin marketplace remove context7-marketplace
/claude:plugin marketplace rm context7-marketplace
```

### Autoupdate

Autoupdate is a setting for each marketplace. It controls what happens when the marketplace updates:

- If autoupdate is on, the extension updates the marketplace and its installed plugins in the background. The update starts after the first message of a `tui` session, with a random delay of up to ten minutes. A manual `marketplace update` also updates the installed plugins of the marketplace.
- The background update changes only the marketplaces of the user scope. A repository can turn autoupdate on in its project config, so the background update never changes the project scope. To update the project scope, run `/claude:plugin marketplace update` or `/claude:plugin update --scope project`.
- If autoupdate is off, `marketplace update` refreshes only the list of plugins in the marketplace.

Turn autoupdate on or off for one marketplace.

```text
/claude:plugin marketplace autoupdate context7-marketplace
/claude:plugin marketplace noautoupdate context7-marketplace
```

If a marketplace has no autoupdate setting, autoupdate is off. Official Claude marketplaces are the exception, as in Claude Code. An official marketplace is one with a name that Claude Code reserves for Anthropic, such as `claude-plugins-official`. Autoupdate is on by default for these marketplaces, except for `knowledge-work-plugins` and `first-party-plugins`.

### Plugin

Browse plugins interactively across configured marketplaces. In interactive mode, running bare `/claude:plugin` also opens the browser.

```text
/claude:plugin browse
/claude:plugin
```

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

A plugin can declare the other plugins it needs. The install adds them too, into the same scope. For more information, see [Dependency resolution](docs/dependency-resolution.md).

Update one installed plugin, every installed plugin from one marketplace, or all installed plugins.

```text
/claude:plugin update context7-plugin@context7-marketplace
/claude:plugin update @context7-marketplace
/claude:plugin update
```

> [!NOTE]
> Agent definitions in plugins can name a preferred model for the agent, for example "sonnet" or "opus". This extension discards these models by default. To map them to Pi models as a best effort, use the `--map-model` option with `install` and `update`. It maps `sonnet`, `opus`, `haiku`, `fable`, `best`, and `opusplan`, with or without `[1m]`, to the current Claude models, for example `anthropic/claude-sonnet-5-5`. It keeps full `claude-` model IDs.

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

Keep the plugin's data directory with `--keep-data`.

```text
/claude:plugin uninstall context7-plugin@context7-marketplace --keep-data
```

Also remove the dependencies that no remaining plugin needs with `--prune`.

```text
/claude:plugin uninstall context7-plugin@context7-marketplace --prune
```

You can uninstall a plugin that another installed plugin needs. Its row names the enabled dependents as `{dependents unsatisfied}`. The next `/claude:plugin apply` installs the plugin again as a dependency, because the dependents still declare it. If that install fails, `apply` disables those dependents. For more information, see [Dependency resolution](docs/dependency-resolution.md).

To remove orphaned dependency installs without naming a plugin to uninstall, run `prune`. It selects the user scope by default. Use `--scope project` to select the project scope.

```text
/claude:plugin prune
/claude:plugin prune --scope project
```

Preview the same scope with `--dry-run`. The preview reads the current state and writes nothing. A later `prune` checks the state again, so its result can change.

```text
/claude:plugin prune --dry-run
/claude:plugin prune --scope project --dry-run
```

Only dependency-installed plugins that no installed plugin in the same scope declares qualify. Even disabled plugins still hold their dependencies. Plugins you installed by name stay installed. The sweep repeats until no more plugins qualify. Actual rows read `(uninstalled) {dependency pruned}`; preview rows read `(will uninstall) {dependency pruned}`. If none qualify, both commands report `Nothing to prune in user scope: no orphaned dependency installs were found.` for the default scope.

Reload Pi after changes. Neither `/reload` nor `/claude:plugin apply` prunes orphaned dependencies. Run `prune` or `uninstall <plugin> --prune` to remove them.

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

Bootstrap is a one-step setup. It adds the official Anthropic marketplace, `claude-plugins-official`, in the user scope. Autoupdate is on by default for this marketplace. If the marketplace is already added, bootstrap does not change its [autoupdate](#autoupdate) setting.

```text
/claude:plugin bootstrap
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
