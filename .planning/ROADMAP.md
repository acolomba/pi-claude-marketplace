# Roadmap: pi-claude-marketplace

## Milestones

- ✅ **v1.14 mcp-string-refs** — Phase 85 (shipped 2026-07-23) — full detail: `milestones/v1.14-ROADMAP.md`

_No active milestone. Run `/gsd-new-milestone` to start the next one (continue the global phase counter from Phase 85)._

## Phases

<details>
<summary>✅ v1.14 mcp-string-refs (Phase 85) — SHIPPED 2026-07-23</summary>

- [x] Phase 85: `mcpServers` string file-path references (2/2 plans) — completed 2026-07-23
  Resolves a `./`-relative string `mcpServers` (marketplace entry OR `plugin.json`)
  to a wrapped `.mcp.json` inside the plugin root and installs its servers at parity
  with the inline form; a missing / malformed / out-of-root reference isolates that
  one plugin to `(unavailable) {malformed mcp}`, never failing the marketplace load.

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 85. `mcpServers` string file-path references | v1.14 | 2/2 | Complete | 2026-07-23 |
