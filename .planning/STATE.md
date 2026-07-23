---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: mcp-string-refs
status: planned
last_updated: "2026-07-22T00:00:00.000Z"
last_activity: 2026-07-22
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 85 — `mcpServers` string file-path references (ready to plan)
Plan: —
Status: Roadmap complete — awaiting `/gsd-plan-phase 85`
Last activity: 2026-07-22 — Roadmap created for milestone v1.14 (mcp-string-refs); 4/4 requirements (MCPR-01..04) mapped to Phase 85

## Roadmap Summary

- 1 phase (Phase 85), continuing the global counter from Phase 84 (agent-skill-preloads).
- All four requirements resolve in one seam: `domain/resolver.ts::applyStrictMcp`
  string-reference resolution (before `applyMcpValue`) + `assertPathInside` containment.
- Locked design decisions carried into the phase: resolve in the resolver layer (not
  the cached manifest loader); referenced file is a WRAPPED `.mcp.json` only; malformed
  / missing / out-of-root reference → single `(unavailable)` plugin, never a
  whole-manifest throw and never a soft-degrade; D-14 symlink refusal stays strict;
  `plugin.json` `mcpServers` array form deferred (MCPR-F1).
