# Pi Claude Marketplace

Access Claude plugin marketplaces from Pi Coding Agent.

These Claude Code plugin features are supported:

- Commands.
- Skills.
- Agents. Requires [pi-subagents](https://pi.dev/packages/pi-subagents).
- MCP servers. Requires [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter)

Plugins that contain unsupported features are marked as "unavailable". The compatible parts may still be installed, but the plugin will not to work as originally intended.

## Usage

Install with:

```bash
pi install npm:pi-claude-marketplace
```

In Pi, add the Anthropic marketplace with:

```text
/claude:plugin marketplace add anthropics/claude-plugins-official
```

A marketplace may also be added local to a project:

```text
/claude:plugin marketplace add anthropics/claude-plugins-official --scope project
```

List plugins available for installation with:

```text
/claude:plugin list claude-plugins-official --available
```

Install a plugin with:

```text
/claude:plugin install pr-review-toolkit@claude-plugins-official
```

Then reload:

```text
/reload
```

### Name mapping

Command and skill names are prefixed with the plugin name. If the command or skill is already prefixed with the plugin name plus `-`, that common part is elided.

| Plugin | Command or skill name | Pi name   |
| ------ | --------------------- | --------- |
| `foo`  | `bar`                 | `foo:bar` |
| `foo`  | `foo-bar`             | `foo:bar` |
| `foo`  | `foo`                 | `foo:foo` |

Skills can additionally be invoked through Pi's `/skill` command:

| Plugin | Skill name | Pi name          |
| ------ | ---------- | ---------------- |
| `foo`  | `bar`      | `/skill:foo:bar` |
| `foo`  | `foo-bar`  | `/skill:foo:bar` |
| `foo`  | `foo`      | `/skill:foo:foo` |

MCP server names are not prefixed or rewritten. The server name is the key from the plugin's `mcpServers` object. If another MCP config already uses that name, the plugin install or update fails.

| Plugin | `mcpServers` key | Pi MCP server name               |
| ------ | ---------------- | -------------------------------- |
| `foo`  | `api`            | `api`                            |
| `foo`  | `foo-api`        | `foo-api`                        |
| `bar`  | `api`            | conflict if `api` already exists |

## Development

```bash
npm install
npm run check
```

Install pre-commit hooks:

```bash
pre-commit install
pre-commit install --hook-type commit-msg
```

## AI disclaimer

This project was developed with AI agent engineering practices using the [GSD](https://github.com/gsd-build/get-shit-done) spec-driven development system.

A prototype was developed using vibe coding until it was feature-complete, then a PRD was extracted from the implementation, and reviewed by the author.

The PRD was then used to guide GSD through discussion, planning and implementation phases.
