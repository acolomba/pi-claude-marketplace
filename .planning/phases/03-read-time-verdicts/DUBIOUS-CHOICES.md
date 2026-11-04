# Phase 3 (Read-Time Verdicts): Dubious Choices Log

The choices Phase 3 made without the user, in the shape of the root
`.planning/DUBIOUS-CHOICES.md` (read it for DC-01..DC-45, which these entries
stay consistent with) and of Phase 1's log
(`.planning/phases/01-foundation-and-pi-1-5-0/DUBIOUS-CHOICES.md`,
P1-DC-01..). Only this phase's session writes this file: each subagent ends
its report with `## Dubious Choices` (or "None"), and the session copies every
item here. The parent merges this file into the root log in Phase 6, and the
session sends each step's new entries to the parent as it goes.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.

## Discuss step (Phase 3 session, 2026-11-04)

All answers are the recommended ones, settled without the user (P1-DC-01
precedent). Each is recorded in `03-CONTEXT.md`.

### P3-DC-01: The neutral stored verdict is the `none` view

- **Severity:** Medium. **Status:** open.
- **Choice:** the stored compatibility counts an MCP server as blocked only
  when both profiles block it (plus a bundle), so `sse` and
  `bareElicitationCapability` never enter a stored record.
- **Alternatives:** (a) store no MCP kind at all and rely only on the recorded
  configs; (b) store the active implementation's verdict with its basis.
- **Why dubious:** (a) loses a bundle block when the configs are unreadable;
  (b) makes the record depend on the implementation at install, which MREC-03
  forbids. The chosen view equals what `effectiveMcpCompatibility` computes
  for `none`, so a neutral record reads the same under `none` either way.

### P3-DC-02: Phase 3 changes the verdict that Phase 1's record writers write

- **Severity:** Medium. **Status:** open.
- **Choice:** `statePhase` (install) and the update-swap record write are
  Phase 1-owned functions in shared files; Phase 3 changes only which verdict
  they store and sets `compatibilityBasis: "neutral"`, in the narrowest diff.
- **Alternatives:** a parent line for Phase 1's functions, applied at merge.
- **Why dubious:** it edits a function another phase owns by the ownership
  table. Phase 1 is finished and the ROADMAP names Phase 3 as the writer of
  the neutral basis, so the edit cannot collide with a running sibling.

### P3-DC-03: The resolver gives a view per implementation, and every caller names one

- **Severity:** Medium. **Status:** open.
- **Choice:** the resolver classifies each server under both profiles and
  exposes `state`/`unsupported`/`droppedMcpServers` for a named
  implementation (`adapter`, `builtin`, `none`), with no default.
- **Alternatives:** keep the resolver adapter-only and let each caller run
  `effectiveMcpCompatibility` on the resolution.
- **Why dubious:** it widens the resolver's interface and touches every
  caller; the alternative leaves the resolver's own `state` wrong under
  built-in and is easy to forget at a new call site.

### P3-DC-04: One offline effective-read helper for every record read

- **Severity:** Low. **Status:** open.
- **Choice:** a new Phase 3 module joins `recordedMcpServers` and
  `effectiveMcpCompatibility`; a legacy record re-resolves offline from the
  cached clone; an unreadable read keeps the stored verdict.
- **Alternatives:** each surface calls the two frozen functions itself.
- **Why dubious:** a legacy record costs one offline re-resolve per read
  (list of many legacy plugins re-reads each manifest).

### P3-DC-05: The marker when no single implementation runs every server

- **Severity:** Medium. **Status:** open.
- **Choice:** with servers split (one only the adapter runs, one only
  built-in runs), the marker is `requires mcp` when none is active and the
  other implementation's name when one is active.
- **Alternatives:** no marker; always `requires mcp`; the implementation
  that runs more servers.
- **Why dubious:** D-MB-07 does not cover this case ("the implementation that
  would run every server" does not exist). Upstream has no counterpart:
  Claude Code runs every transport itself.

### P3-DC-06: `partially-installed` list rows gain the MCP marker

- **Severity:** High. **Status:** open.
- **Choice:** a partially-installed row whose blocked server another
  implementation runs shows `{unsupported mcp, requires <other>}`; today such
  a row carries no dependencies and shows no marker.
- **Alternatives:** keep the marker off partially-installed list rows.
- **Why dubious:** a visible change to `list`; D-MB-07's example requires the
  marker beside `{unsupported mcp}`, so this follows it.

### P3-DC-07: `info`'s `requires:` names the D-MB-07 marker, also when it is satisfied

- **Severity:** High. **Status:** open.
- **Choice:** a stdio plugin reads `requires: mcp` under either
  implementation and `requires: mcp (missing)` with none; JSON
  `{"companion":"mcp","missing":false}` replaces today's
  `{"companion":"pi-mcp-adapter","missing":false}` under the adapter.
- **Alternatives:** name the active implementation when it runs every server
  (`requires: pi-mcp-adapter` under the adapter, `requires: builtin mcp`
  under built-in); or drop the MCP entry when satisfied.
- **Why dubious:** it changes today's adapter output (JSON consumers see a new
  companion name). It keeps one meaning for the line: what the plugin needs.

### P3-DC-08: The marker input carries per-profile verdicts

- **Severity:** Low. **Status:** open.
- **Choice:** the MCP `Dependency` carries the verdicts each emit site already
  has instead of a bare `declaresMcp`.
- **Alternatives:** recompute the verdicts inside the marker function from
  raw configs.
- **Why dubious:** about 30 emit sites change shape at once.

### P3-DC-09: With no implementation, consent covers only blocks under both

- **Severity:** Medium. **Status:** open.
- **Choice:** under `none`, `--partial` is asked only for servers both
  profiles block (and non-MCP drops); an `sse` plugin installs without it.
- **Alternatives:** never ask under `none` (a `ws` server too).
- **Why dubious:** D-MB-05 says "needs no `--partial` consent" without the
  qualifier; a `ws` server is dropped under every implementation, so the drop
  is a content drop, not a missing soft dependency.

### P3-DC-10: Apply's convergence asks only for a new degrade under the active implementation

- **Severity:** Medium. **Status:** open.
- **Choice:** a catalog move is held for consent only when the candidate drops
  something the installed record, read under the active implementation, does
  not; enable, import, promotion, and cascades read the neutral stored
  `installable`.
- **Alternatives:** compare against the neutral view only.
- **Why dubious:** a version that newly adds an `sse` server is held under
  built-in but not under the adapter, so the same apply differs by
  implementation (D-MB-06 says consent is against the active implementation).

### P3-DC-11: No load warning row after a switch

- **Severity:** Medium. **Status:** open.
- **Choice:** the load prints nothing new when a plugin becomes partial
  because of a switch; `list` and `info` show it.
- **Alternatives:** a load warning row naming the plugin and the marker.
- **Why dubious:** a user may miss that a server stopped running; APL-D1 and
  "a switch needs no user action" favor silence.

### P3-DC-12: AMIG-01 stays adapter-explicit

- **Severity:** Low. **Status:** open.
- **Choice:** the legacy `mcp.json` move stages the adapter view into
  `mcp-adapter.json` under every implementation and keeps its notice text; its
  record write stores the neutral verdict with the basis.
- **Alternatives:** skip the move under built-in.
- **Why dubious:** under built-in the moved entries feed only the adapter
  file, which the active implementation does not read.

### P3-DC-13: Agreeing tag pairs fold into one `@mcp` scenario

- **Severity:** Low. **Status:** open.
- **Choice:** the nine `verdict-markers.feature` pairs whose twins now agree
  become single `@mcp` scenarios; new pairs pin the rows that differ.
- **Alternatives:** keep the pairs with identical bodies.
- **Why dubious:** P1-DC-16 moved them as pairs on the expectation that they
  differ; folding loses that history.
