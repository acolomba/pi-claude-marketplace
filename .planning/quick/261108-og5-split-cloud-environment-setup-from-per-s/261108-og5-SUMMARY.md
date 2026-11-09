---
quick_id: 261108-og5
status: complete
---

# Quick 261108-og5 summary

The cloud environment now holds only what does not depend on the branch, and
every session start installs the rest.

- `scripts/cloud-env-setup.sh` (new), for the environment's setup script:
  Node 24, the setpriv `node` wrapper, pre-commit, then `init.sh --tools`.
  The pre-commit warmup is gone.
- `scripts/init.sh` takes `--tools` (skills, gsd-core, fallow skill pointers)
  and `--deps` (git hooks, `npm install`, CodeGraph), and runs both by
  default. `--deps` syncs an existing index instead of skipping it; in the
  cloud the index builds in the background. `--tools` fetches fallow at the
  devDependency's range when node_modules is missing, and skips fallow's MCP
  registration, which `.mcp.json` now owns.
- `scripts/init-session.sh` (cloud): no `.init-done` gate. It runs
  `init.sh --deps` every session, runs `cloud-env-setup.sh` when the
  environment setup did not, and writes the session id to
  `node_modules/.session-ready`.
- `scripts/mcp-server.sh` (new): `.mcp.json` starts codegraph and fallow
  through it. In the cloud it waits for the session mark, so a server never
  starts from node_modules that the hook is replacing. `.claude/settings.json`
  sets `MCP_TIMEOUT` to 300000.
- CONTRIBUTING.md: the two stages, the new environment setup script, and why
  the dependencies install per session.

The claude-code-templates mod was skipped, as the user asked: its download
uses the GitHub API, which the session proxy refuses for repositories not
attached to the session.

Verified in this session:

- `cloud-env-setup.sh` run from /home/user: exit 0 in 18 s, no tracked change.
- The hook on the warm checkout: 2.6 s, session mark written, index synced.
- An empty worktree: setup 13 s; the hook 12 s with the MCP wrapper already
  waiting; codegraph answered `initialize` 13 s after it started waiting; 35
  GSD agents and all skills present; the index finished 175 s later in the
  background.
- A codegraph server started before the index exists loads it once it
  exists.
- The wrapper keeps waiting on a mark from another session and starts at once
  outside the cloud; `claude mcp list` connects both servers locally.
- `MCP_TIMEOUT` in `.claude/settings.json`: a server that starts in 40 s
  connects; without it, the connect times out at 30 s.
- A local `init.sh` run (no `CLAUDE_CODE_REMOTE`): exit 0, foreground sync.

Not verified: the hook and MCP servers sharing `CLAUDE_CODE_SESSION_ID` in a
fresh session start (Bash and MCP children of this session share it; the hook
falls back to its input's `session_id`), and the environment cache rebuild
after the setup script changes.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
