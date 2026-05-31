---
mode: quick-full
must_haves:
  truths:
    - User-scope storage must resolve through Pi's agent directory resolver, honoring PI_CODING_AGENT_DIR when set.
    - Project scope must remain <cwd>/.pi and not be affected by PI_CODING_AGENT_DIR.
    - Specs must describe user scope as the resolved Pi agent directory, with ~/.pi/agent only as the default.
  artifacts:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/persistence/locations.ts
    - extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts
    - docs/prd/pi-claude-marketplace-prd.md
    - CLAUDE.md
    - tests/persistence/locations.test.ts
    - tests/bridges/mcp/collision-slots.test.ts
  key_links:
    - Pi exports getAgentDir from @earendil-works/pi-coding-agent.
---

# Quick Task PLAN: Honor PI_CODING_AGENT_DIR for User Scope

## Task 1: Route user-scope path resolution through Pi

- files:
  - `extensions/pi-claude-marketplace/platform/pi-api.ts`
  - `extensions/pi-claude-marketplace/persistence/locations.ts`
  - `extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts`
- action:
  - Re-export Pi's `getAgentDir` from the local Pi API boundary.
  - Replace hardcoded `os.homedir()/.pi/agent` user-scope paths with `getAgentDir()`.
  - Keep project-scope paths based on `<cwd>/.pi`.
- verify:
  - Typecheck passes.
  - Targeted persistence and MCP tests pass.
- done:
  - No production user-scope storage path composes `os.homedir(), ".pi", "agent"` directly.

## Task 2: Add regression coverage for PI_CODING_AGENT_DIR

- files:
  - `tests/persistence/locations.test.ts`
  - `tests/bridges/mcp/collision-slots.test.ts`
- action:
  - Add tests proving `locationsFor("user")` and MCP collision slot 1 honor `PI_CODING_AGENT_DIR`.
  - Keep default-path tests deterministic by clearing the env var around those assertions.
- verify:
  - `node --test tests/persistence/locations.test.ts tests/bridges/mcp/collision-slots.test.ts`
- done:
  - Regression tests fail against the old hardcoded implementation and pass after the fix.

## Task 3: Update specs and project context

- files:
  - `CLAUDE.md`
  - `docs/prd/pi-claude-marketplace-prd.md`
  - relevant code comments/user-facing descriptions
- action:
  - Define user scope as the resolved Pi agent directory: default `~/.pi/agent`, overridden by `PI_CODING_AGENT_DIR`.
  - Update MC-4 and storage-layout wording to avoid normative hardcoding of `~/.pi/agent`.
- verify:
  - `rg "~/.pi/agent"` only shows default/example wording, not unconditional requirements.
  - `npm run check` passes.
- done:
  - Specs and implementation describe the same behavior.
