# bridges/

## Purpose

Per-resource staging. Each bridge handles one Claude plugin component type (skills, commands, agents, MCP servers) with prepare/commit/abort discipline. Phase 3 lands all four bridges.

## Allowed Imports

`bridges/` may import from: `domain/`, `persistence/`, `shared/`. Imports from `edge/`, `orchestrators/`, `transaction/`, `presentation/`, `platform/` are forbidden. **Cross-bridge imports are also forbidden** -- `bridges/skills/` cannot import from `bridges/agents/`. Use a domain-level abstraction (Phase 3) if shared logic is needed.

## Planned Contents

- [ ] `skills/{prepare,commit,abort,unstage}.ts` -- Phase 3
- [ ] `commands/{prepare,commit,abort,unstage}.ts` -- Phase 3
- [ ] `agents/{prepare,commit,abort,unstage,index}.ts` -- Phase 3
- [ ] `mcp/{prepare,commit,abort,unstage}.ts` -- Phase 3
