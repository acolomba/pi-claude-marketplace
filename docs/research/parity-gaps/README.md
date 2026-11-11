# Parity gap analysis: evidence reports

These six reports are the evidence behind [`docs/prd/parity-gaps-prd.md`](../../prd/parity-gaps-prd.md). Read the PRD first. It ranks the gaps, merges the duplicates between reports, and corrects two errors that a second review found in them.

Six research agents wrote the reports on 2026-11-11, one for each area. Each report has the same sections: the upstream contract, the capability of the latest Pi or extension, the current project behavior, the gaps that can be closed, the gaps that cannot be closed today, the divergences with no recorded reason, the wrong or stale project documentation, and the assumptions that were not verified.

| Report                                     | Area                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- |
| [`skills-commands.md`](skills-commands.md) | Skills and commands                                                  |
| [`hooks.md`](hooks.md)                     | Hooks                                                                |
| [`mcp.md`](mcp.md)                         | MCP servers, for Pi's built-in MCP and for pi-mcp-adapter            |
| [`workflows.md`](workflows.md)             | Workflows                                                            |
| [`subagents.md`](subagents.md)             | Subagents                                                            |
| [`core.md`](core.md)                       | The plugin container, and an inventory of the Pi 1.5.2 extension API |

Versions compared: Claude Code 2.1.322; Pi 1.5.2; `@earendil-works/pi-mcp` 1.5.2; pi-mcp-adapter 7.0.1; pi-subagents 0.88.0; `@quintinshaw/pi-dynamic-workflows` 3.15.1; this repository at `fed88184` (version 0.23.0).

Limits:

- No Pi session, no Claude Code session, and no `npm` script was run. Statements about run-time behavior come from source and documentation.
- The reports are a snapshot. Line numbers in them are for the versions above.
- The reports are kept as the agents wrote them, except that machine-local paths were replaced with package names. Where a report and the PRD disagree, the PRD is right.

The folder [`review/`](review/) holds the five reports of the document review that the PRD went through on 2026-11-11. The PRD from version 1.1 on applies their findings; start with `review/consolidated_review_report.md`.
