---
quick_id: 261103-eqa
slug: make-tests-robust-to-pi-upgrades
status: complete
date: 2026-11-03
commits: [5de5e65]
---

# Quick task 261103-eqa: make tests robust to Pi upgrades

Run as a direct task at the user's request (no PLAN.md); this summary is the record.

## What ran

- Installed Pi 1.5.0 (`pi-coding-agent`, `pi-tui`, `pi-ai`) as dev dependencies and ran every suite. Cucumber 1540/1540, integration, static and unit modules passed. Failures: VER-01 (our own pin check, expected) and the e2e case ADET-01, whose process-exit wait (2 s) was too short under load; it passed on two reruns.
- An audit found about 125 cucumber assertions that pinned text owned by Pi, pi-subagents, pi-mcp-adapter, or the workflow engine.
- Restored the 1.4.0 pins from the committed lockfile (`npm ci`, then `node scripts/install-test-peers.mjs`).

## What changed (5de5e65)

- `features/lib/upstream/` (new): projections that reduce upstream text in a model call to the facts this extension owns, in a fixed form of our own, and throw when they cannot read it. Hooked into `messageRow` in `features/lib/scripted-model/script.ts`.
  - `subagents.ts`: agent list, agent detail, run wrapper, errors, child `Task:` message.
  - `mcp.ts`: the `mcp` proxy's status, server tools, search, and not-found results.
  - `pi.ts`: the read tool's continuation notice becomes `{read continuation}`.
- Steps where upstream composes our part now check only our part, and say so: the child system prompt (the staged agent body, compared whole and required exactly once), the offered tools (only tools an agent can name, or only our marketplace tools), plugin MCP tools, advertised agents.
- Workflow notices reduce to `started`, `refused`, or `unavailable` and the command; the engine's error prefix is no longer pinned.
- Pi layout parsers (available skills, the TUI slash menu, system message sections) tolerate layout changes and fail loudly on an unreadable layout.
- Cucumber rules: a new "Upstream text" rule in `world-and-stand-ins.md`, and the `steps.md` whole-value rule names its one exception.
- `test/e2e/adapter-detection-rpc.test.ts`: the process-exit wait is now 10 s.

## Evidence

- Each area changed some of our values on purpose and every changed scenario failed: 9 (pi-subagents), 2 (pi-mcp-adapter), 13 (workflow and Pi).
- `npm run check` on Pi 1.4.0: exit 0, 1540/1540 scenarios (seed 54387), 327 direct coverage records. PR CI on 5de5e65: all 11 checks green, SonarCloud 0 new issues.

## Trade-offs

- The two "blocked" MCP project-scope scenarios now project alike; the block reason is pi-mcp-adapter's wording.
- An untagged slash-menu description that contains " - " would split into hint and description; no scenario has one, and the step says so.

## Threat Flags

None -- test-only change; no product code or security-relevant surface changed.
