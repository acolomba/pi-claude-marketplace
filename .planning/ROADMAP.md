# Roadmap: pi-claude-marketplace — mcp-string-refs (MCP Server String References)

## Overview

Today the resolver accepts `mcpServers` only as an inline object (a server map) or
from a conventional plugin-root `.mcp.json`. Claude's spec also allows `mcpServers`
to be a **string** — a `./`-relative path to a wrapped `.mcp.json`-shaped file inside
the plugin's own source dir (`string | object` for a marketplace entry;
`string | array | object` for `plugin.json`, array deferred). This milestone teaches
the resolver to resolve that string reference and install the referenced servers at
parity with the inline form.

It reimplements the intent of external PR #99 (@lucatume) but deliberately places the
resolution in the **resolver layer** (`domain/resolver.ts`), not the cached manifest
loader. Loader-level inlining (PR #99's approach) fails the ENTIRE marketplace load on
one broken reference, breaks the manifest cache's `(mtimeMs, size)` coherence, and
distorts the WR-01 change-detection key in `marketplace/update.ts`. Resolving in the
resolver means a broken reference isolates to a single `(unavailable)` plugin while
every sibling in the same marketplace still installs — the resolver's existing
structural-defect path (`applyStrictMcp` → `applyMcpValue` → `dirty` →
`decideResolution` → `unavailable`), extended so the string is resolved and read
BEFORE that validation runs.

The change is small and cohesive: all four requirements land in one resolver seam.
`applyStrictMcp` already reads `entry.mcpServers ?? manifest?.mcpServers`, so the
marketplace-entry site (MCPR-01) and the `plugin.json` site (MCPR-02) share one code
path; malformed/missing handling (MCPR-03) and containment (MCPR-04) are inherent to
resolving that reference. Containment reuses the existing single chokepoint
`assertPathInside` (NFR-10 + D-14 symlink refusal). One phase delivers the whole
capability.

## Phases

**Phase Numbering:**

- Integer phases (85): Planned milestone work (continues from Phase 84, the last
  agent-skill-preloads phase)

- Decimal phases (85.1, 85.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 85: `mcpServers` string file-path references** - The resolver resolves a `./`-relative string `mcpServers` (marketplace entry OR `plugin.json`) to a wrapped `.mcp.json` inside the plugin root and installs its servers at parity with the inline form; a missing / malformed / out-of-root reference isolates that one plugin to `(unavailable)` with a note, never failing the marketplace load

## Phase Details

### Phase 85: `mcpServers` string file-path references

**Goal**: A Claude plugin that declares `mcpServers` as a `./`-relative string path — from a `marketplace.json` entry or a `plugin.json` — resolves and installs the MCP servers declared in the referenced wrapped `.mcp.json`, at full parity with the inline-object form. Resolution happens in `domain/resolver.ts` (`applyStrictMcp`, before `applyMcpValue`), reusing `assertPathInside` for containment, so a broken reference degrades a single plugin to `(unavailable)` instead of failing the whole marketplace read.
**Depends on**: Nothing (single phase of this milestone; extends the existing `applyStrictMcp` seam)
**Requirements**: MCPR-01, MCPR-02, MCPR-03, MCPR-04
**Success Criteria** (what must be TRUE):

  1. A marketplace whose plugin entry sets `mcpServers` to a `./`-relative string path installs the MCP servers declared in the referenced file after `/reload`, byte-for-byte at parity with the same servers declared inline as an object (MCPR-01).
  2. A plugin whose `plugin.json` sets `mcpServers` to a `./`-relative string path installs the referenced servers at the same parity (MCPR-02).
  3. A plugin whose referenced file is missing, is malformed JSON, or lacks a top-level `mcpServers` object resolves `(unavailable)` with a note, while its sibling plugins in the same marketplace still install — the marketplace manifest load succeeds; there is never a whole-manifest throw and never a silent drop to `undefined` (MCPR-03).
  4. A plugin whose `mcpServers` reference resolves outside the plugin root — via `../` traversal or a symlink (refused under D-14 house policy) — resolves `(unavailable)` with a note, per-plugin, and the resolver never reads a file outside the plugin root (MCPR-04).
  5. The conventional plugin-root `.mcp.json` keeps its existing unwrapped-superset tolerance unchanged: a plugin relying on the conventional standalone `.mcp.json` (no declared string reference) still installs exactly as before — the wrapped-only rule applies to the declared string reference only (locked design boundary; regression guard).

**Plans**: 1/2 plans executed

- [x] 85-01-PLAN.md — Widen the `mcpServers` schemas (`string | object`) and resolve a `./`-relative string reference to a wrapped `.mcp.json` in `applyStrictMcp` at inline parity; missing / malformed / wrapper-less / traversal / symlink references degrade one plugin to `(unavailable)` (MCPR-01..04, criterion 5).
- [ ] 85-02-PLAN.md — Land the `{malformed mcp}` closed-set failure-class reason token and route `malformed mcp reference:` notes to it without reclassifying inline `malformed mcpServers` (MCPR-03 / D-02).

## Progress

**Execution Order:**
Single phase: 85

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 85. `mcpServers` string file-path references | 1/2 | In Progress|  |
