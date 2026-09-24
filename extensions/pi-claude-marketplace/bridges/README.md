# bridges/

## Purpose

Per-resource staging. Each bridge handles one Claude plugin component type (skills, commands, agents, hooks, MCP servers, workflows) with prepare/commit/abort discipline.

## Allowed Imports

`bridges/` may import from: `domain/`, `persistence/`, `shared/`. Imports from `edge/`, `orchestrators/`, `transaction/`, `presentation/`, `platform/` are forbidden. **Cross-bridge imports are also forbidden** -- `bridges/skills/` cannot import from `bridges/agents/`. Use a domain-level abstraction if shared logic is needed.

## Contents

One directory per component kind, each exposing its staging surface through `index.ts`:

- `skills/` -- plus frontmatter scan, degrade, and rewrite
- `commands/`
- `agents/` -- plus source-to-Pi conversion, the ownership marker, and the agents index
- `hooks/` -- the largest: event routing, translation, and execution alongside staging
- `mcp/` -- plus collision slots and variable substitution
- `workflows/` -- the one bridge that installs executable code; see `docs/workflows-compatibility.md`
