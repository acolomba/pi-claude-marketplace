---
quick_id: 261107-lth
status: complete
---

# Quick 261107-lth summary

codegraph is now the devDependency `@colbymchenry/codegraph` (`^1.6.2`; the
lockfile pins 1.6.2). Every caller runs the project copy:

- `.mcp.json` and `.codex/config.toml`: `npx --no codegraph serve --mcp`
  (`--no`, so npx never downloads the unrelated `codegraph` package).
  `alwaysLoad` stays.
- `.claude/settings.json` prompt hook: `"$CLAUDE_PROJECT_DIR"/node_modules/.bin/codegraph`,
  with no npx startup cost on every prompt.
- `scripts/init-worktree.sh` and `scripts/codegraph-worktree-hook.sh`: the
  worktree's own `node_modules/.bin/codegraph`, after its `npm install`.
- `scripts/init.sh`: no global install and no `codegraph install`, which
  rewrote the committed configs (the `.mcp.json` drift). It runs
  `codegraph init --yes` only when `.codegraph/` is missing.
- AGENTS.md shell line: `npx --no codegraph explore`.

Verified: init.sh in the main checkout left only these edits. With every global
copy removed from PATH, the MCP server answered `initialize` as version 1.6.2
(the global copies are 1.6.0), and the prompt hook and `explore` returned
context. In a new worktree, init-worktree.sh built the index and started a
daemon from the worktree's `node_modules`; after it was killed, the PreToolUse
hook restarted it and rewrote `projectPath`; stop-worktree-daemon.sh stopped
it. `npm run fallow` passes.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
