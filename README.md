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
/claude:plugin install feature-dev@claude-plugins-official
```

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
