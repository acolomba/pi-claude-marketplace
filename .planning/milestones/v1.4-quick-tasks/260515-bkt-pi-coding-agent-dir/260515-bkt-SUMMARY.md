# Quick Task 260515-bkt Summary

**Task:** lets update the specs and the implementation to listen to PI_CODING_AGENT_DIR if set instead of hardcoding ~/.pi
**Status:** Complete

## Changes

- Routed user-scope path resolution through Pi's `getAgentDir()` export via `platform/pi-api.ts`.
- Updated user-scope `ScopedLocations` and pi-mcp-adapter collision slot 1 to honor `PI_CODING_AGENT_DIR`.
- Added regression tests for `locationsFor("user")` and `MCP_COLLISION_SLOTS()` with `PI_CODING_AGENT_DIR` set.
- Updated PRD/project docs and code comments to define user scope as the resolved Pi agent dir, with `~/.pi/agent` only as the default.
- Kept project scope unchanged at `<cwd>/.pi`.

## Verification

- `node --test tests/persistence/locations.test.ts tests/bridges/mcp/collision-slots.test.ts` ✅
- `npm run check` ✅
- LSP diagnostics for edited implementation files ✅

## Notes

`scripts/pi.sh --home ...` now aligns with extension behavior because the extension resolves user scope through Pi's agent-dir resolver instead of composing `os.homedir()/.pi/agent` directly.
