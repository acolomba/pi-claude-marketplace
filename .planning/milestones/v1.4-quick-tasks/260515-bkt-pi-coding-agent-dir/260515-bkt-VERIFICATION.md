status: passed

# Quick Task 260515-bkt Verification

## Must-haves

- User-scope storage resolves through Pi's agent directory resolver and honors `PI_CODING_AGENT_DIR`: **passed**
- Project scope remains `<cwd>/.pi`: **passed**
- Specs describe user scope as resolved Pi agent dir with `~/.pi/agent` only as default: **passed**
- Regression tests cover env override for locations and MCP collision slots: **passed**

## Evidence

- `platform/pi-api.ts` re-exports `getAgentDir` from `@earendil-works/pi-coding-agent`.
- `persistence/locations.ts` uses `getAgentDir()` for `scope === "user"`.
- `bridges/mcp/collision-slots.ts` uses `path.join(getAgentDir(), "mcp.json")` for pi-user-scope slot.
- Targeted tests and full `npm run check` pass.
