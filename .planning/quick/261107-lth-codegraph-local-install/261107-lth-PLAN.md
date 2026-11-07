---
quick_id: 261107-lth
slug: codegraph-local-install
type: quick
---

# Quick 261107-lth: install codegraph project-locally

Run inline by the orchestrator. The verification needs this session's
environment: the global copies hidden from PATH, a throwaway worktree, and
init.sh run in the main checkout.

## Task 1: local codegraph

- files: package.json, package-lock.json, .mcp.json, .codex/config.toml,
  .claude/settings.json, AGENTS.md, scripts/init.sh, scripts/init-worktree.sh,
  scripts/codegraph-worktree-hook.sh, scripts/cloud-env.sh
- action: add `@colbymchenry/codegraph` `^1.6.2` as a devDependency. Point the
  MCP servers at `npx --no codegraph`, and the prompt hook and worktree scripts
  at `node_modules/.bin/codegraph`. In init.sh, drop the global install and
  `codegraph install`, and run `codegraph init --yes` only when `.codegraph/`
  is missing. Keep `alwaysLoad`.
- verify: init.sh leaves no diff beyond the edits; with the global copies off
  PATH, the MCP server reports 1.6.2, and the prompt hook and `explore` answer;
  in a new worktree, init-worktree.sh indexes and starts the daemon, the
  PreToolUse hook restarts it, and stop-worktree-daemon.sh stops it;
  `npm run check` passes.
