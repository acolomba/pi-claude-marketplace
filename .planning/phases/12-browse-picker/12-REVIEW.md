---
phase: 12-browse-picker
reviewed: 2026-11-08
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts
  - test/edge/handlers/plugin/browse.test.ts
  - test/edge/browser/plugin-browser.test.ts
  - features/plugin/browse.feature
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
necessity: 0
status: clean
---

# Phase 12 Code Review

Reviewed inline in the phase session against `.claude/agents/gsd-code-reviewer.md` (standard depth), on the coordinator's instruction that this phase run review without subagents (P12-DC-30). Scope: the files the phase's own commits changed (`git diff 7e961d04 HEAD`), planning artifacts excluded.

## Summary

The D-BG-1201 change is small and contained. `offeredPluginCount` reads the catalog only through `domain/manifest.ts::loadMarketplaceManifest` (NFR-5, NFR-8), applies the same D-PL5-28 name check that `list-flow.ts::loadMarketplaceManifestSoftly` applies, reads only `plugins.length` from the cached parse (no mutation of the shared reference), and turns every throw into `undefined` with a debug-log line, so one bad catalog cannot stop the picker from opening. A throw from `loadVisibleMarketplaces` (a corrupt `state.json`) still reaches the existing `(browse)` failure notice. `Promise.all` keeps the reads concurrent and satisfies `no-await-in-loop`. `marketplaceDescription` is module-private and covers its four forms (both parts, offered only, installed only, source alone) in the unit table.

Checked and not reported:

- The installed count can exceed the offered count when an installed plugin left the catalog (`2 available • 3 installed`). Claude Code computes its two numbers the same way (catalog length; installed ids ending in `@<marketplace>`), so this is parity, not a defect.
- The installed count includes disabled installs, as Claude Code's `installedPlugins` does.
- Every catalog is read when the picker opens, where the old code read none. The loader is memoized by mtime and size and `list` already reads the same files, so the cost is one stat per marketplace on a warm cache.
- Tests: the new unit cases build expected values from literals, never from production code; the scenarios use only frozen steps, carry no implementation tag (no MCP surface, D-BG-04), and each has a product-mutation red proof in the plan SUMMARYs.

## Findings

None.
