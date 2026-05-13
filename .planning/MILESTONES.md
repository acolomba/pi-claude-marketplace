# Milestones: pi-claude-marketplace

## Completed Milestones

### v1.0: successor architecture

**Status:** Complete
**Completed:** 2026-05-11

Shipped the PRD-derived successor architecture for `pi-claude-marketplace`: `/claude:plugin` command surface, marketplace lifecycle, plugin `install` / `uninstall` / `update`, top-level `list`, skills/commands/agents/MCP bridges, tab completion, real Pi wiring, live/runtime e2e coverage, and cross-process state locking.

## Current Milestone

### v1.1: Reinstall Command

**Status:** Defining requirements
**Started:** 2026-05-13

Add a `reinstall` command that replaces installed plugins without leaving them absent if reinstall fails. Syntax and scoping are analogous to `update`; each plugin replacement is atomic; cached manifests and recorded versions are reused with no network sync; plugin data directories are deleted only after successful replacement.
