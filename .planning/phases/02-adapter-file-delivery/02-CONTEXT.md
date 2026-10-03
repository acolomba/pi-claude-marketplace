# Phase 2: Adapter-file delivery - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Install, update, reinstall and uninstall keep a plugin's MCP servers as marked
entries in `<scopeRoot>/mcp-adapter.json` (user: `<Pi agent dir>/mcp-adapter.json`;
project: `<cwd>/.pi/mcp-adapter.json`), and never lose or corrupt anything the
user or the adapter wrote there. Entries keep today's content shape: naming,
`directTools`, translation and variable rules belong to Phases 3 and 4, and the
move of existing `mcp.json` entries belongs to Phase 5.

Requirements: AFILE-01..06.

**Claude Code position:** Claude Code keeps a user's `/mcp` disable of a plugin
server across plugin updates (research FEATURES.md, read from the 2.1.287
binary; confidence high). Carrying user overrides forward (AFILE-06) is the
parity behavior. The file format itself (JSONC, the `mcp-servers` alias, the
nine-source precedence) is pi-mcp-adapter 5's contract, not Claude Code's; it is
followed because the adapter is the consumer (Pi capability gap: Pi has no
plugin MCP host of its own that this project may use, per the milestone's
out-of-scope table).

</domain>

<decisions>
## Implementation Decisions

Decision IDs are milestone-scoped and collide with v1.20 IDs already cited in
source; source comments cite requirement IDs (AFILE-0N), never `D-02-NN`.

### Locked by requirements (recorded, not re-discussed)
- **D-02-01:** Read `mcp-adapter.json` with the adapter's own grammar (BOM
  strip, comments, trailing commas). A file that cannot be parsed refuses the
  operation with a typed error naming the file and keeps its exact bytes; it is
  never treated as empty (AFILE-02). Every foreign key (`settings`, `imports`,
  `claudePlugins`, user servers) survives a write.
- **D-02-02:** When the existing file keeps servers under the legacy
  `mcp-servers` key, our entries go under that key; the ours/theirs partition
  enumerates both keys (AFILE-03).
- **D-02-03:** Collision detection follows adapter 5's nine-source, later-wins
  precedence and names the winning source; an entry with no `command`, `url` or
  `socket` is an override, not a collision (AFILE-05, closes MCPSRC-01).
  Whether a collision refuses or warns keeps today's bridge semantics.
- **D-02-04:** The NFR-10 write set, `persistence/locations.ts` and the
  containment gates name the new file; `mcp.json` stays in the write set for
  the Phase 5 sweep (AFILE-01).

### Comment handling (AFILE-04)
- **D-02-05:** Warn when the bytes we read contained JSONC comments and we
  rewrite the file (our writer drops them). In practice this fires once per
  file, because the rewrite removes the comments. No new persisted state, no
  `.bak` copy, no comment-preserving editor (out of scope per REQUIREMENTS).

### User overrides (AFILE-06)
- **D-02-06:** The carried-forward field set is closed: `disabled`,
  `approveTools`, `includeTools`, `excludeTools`, `lifecycle`, `idleTimeout`,
  `requestTimeoutMs`, `debug`, `searchKeywords`. On update or reinstall, each of
  these that the previous marked entry carries is copied into the new entry.
  `directTools` and `toolPrefix` are owned by this extension and always
  rewritten (Phase 3 stamps them), so an adapter-panel direct-tools toggle
  resets on update. The list is pinned against the adapter 5.0.0 `ServerEntry`
  type by a test, so a field the adapter adds later is a visible decision, not
  a silent omission. — **Reversibility:** costly — changing the set later
  changes which user choices survive updates.

### Uninstall and overlays
- **D-02-07:** Uninstall removes only marked entries. A marker-less override
  stub keyed by one of our server names (for example `{ "disabled": true }`
  written by `/mcp-adapter disable` into the project file) is left in place; it
  is user-authored and inert without a full definition.

### Post-research decisions (operator, 2026-10-02)
Raised by 02-RESEARCH.md open questions; each answered by the operator.

- **D-02-08:** Parse `mcp-adapter.json` with the runtime dependency
  `strip-json-comments@^5.0.3`, the library and options pi-mcp-adapter 5.0.0
  uses (`JSON.parse(stripJsonComments(stripBom(raw), { trailingCommas: true }))`),
  so the grammar matches by construction. Justification for the new runtime
  dependency: AFILE-02 requires reading the file the way the adapter reads it.
- **D-02-09:** AFILE-04 covers every path that rewrites the file: install,
  update, reinstall, enable, uninstall, disable, marketplace remove, prune and
  the reconcile/import cascades. The bridge returns a structured
  comments-dropped notice (not a `warnings` string, which standalone verbs
  drop); orchestrators route it to a user-visible channel.
- **D-02-10:** A marker-less override stub under one of our server names in the
  target file is absorbed: only the D-02-06 carry-forward fields are copied into
  our entry; credential-bearing fields are never copied.
- **D-02-11:** A failed install restores the exact prior bytes of
  `mcp-adapter.json` (replacement handle, as reinstall does) instead of
  unstaging from the rewritten file.
- **D-02-12:** Before the Phase 5 migration, the same plugin's marked entries in
  the same scope's legacy `mcp.json` are not a collision, and uninstall (and
  every unstage) also removes them, marker-keyed. Moving entries stays Phase 5.
- **D-02-13:** The same plugin's own marked entries in the other scope's
  adapter file are not a collision (Claude Code parity: one effective server;
  adapter later-wins picks the project copy).
- **D-02-14:** When the staged MCP set is empty and `mcp-adapter.json` cannot be
  parsed, the operation proceeds without touching the file and the user gets a
  notice naming it. Plugins with MCP servers refuse with the AFILE-02 typed
  error; unstage keeps refusing on an unparseable file.
- **D-02-15:** [informational] Overrides do not survive a plugin disable then enable (D-02-06
  stays update/reinstall only); recorded as a backlog item.

- **D-02-16:** A symlinked `mcp-adapter.json` keeps today's write-through
  behavior (`write-file-atomic` resolves the link); NFR-10 containment does not
  check the link target. Accepted threat, as for `mcp.json` today.
- **D-02-17:** The same plugin's own marked entries never count as a collision
  in any of the nine sources (widens D-02-12/D-02-13 to the other scope's legacy
  `mcp.json` and ancestor `.pi/mcp-adapter.json` files), on the same
  one-effective-server reasoning.

### Claude's Discretion
- Module split: extract the JSONC document reader and the entry handling out of
  `bridges/mcp/stage.ts` up front (it sits near fallow's `maxUnitSize` and
  cognitive-complexity ceilings); names are the planner's.
- The exact warning wording, as a closed-catalog amendment in
  `docs/output-catalog.md`.
- How the JSONC parse is implemented (no new runtime dependency unless the
  planner justifies one; the adapter uses `strip-json-comments`).

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — AFILE-01..06
- `.planning/ROADMAP.md` §Phase 2 — success criteria and notes
- `.planning/research/PITFALLS.md` §Pitfall 1 (JSONC wipe), §Pitfall 2 (`mcp-servers` alias), §Pitfall 3 (overlays and carry-forward)
- `.planning/research/ARCHITECTURE.md` — adapter-doc / collision-slots / stage design
- `.planning/research/FEATURES.md` — TS-1, TS-8, TS-9 and the Claude Code `/mcp` disable parity fact
- `.planning/research/STACK.md` — pi-mcp-adapter 5.0.0 facts (file layout, precedence, `ServerEntry`)
- `.planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-CONTEXT.md` — detection and marker decisions this phase builds on
- `docs/output-catalog.md` — closed catalog for any new warning token

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bridges/mcp/{stage,unstage,collision-slots,marker,safe-set,substitute}.ts`: the prepare/commit/abort triplet and MC-5 marker to retarget.
- `persistence/locations.ts`: `mcpJsonPath` (line 58/203) is the model for an `mcpAdapterJsonPath` getter routed through `assertPathInside`.
- `shared/atomic-json.ts`: the atomic writer (drops comments; D-02-05 warns about it).

### Established Patterns
- Marker-keyed ours/theirs partition; unstage removes by marker.
- Typed errors in `shared/errors.ts`, discriminated with `instanceof`.
- Closed-catalog amendments for new user-visible tokens.

### Integration Points
- Install/update/reinstall/uninstall ledgers call the MCP bridge; `prune-rollback.ts` snapshots must cover the new file.

</code_context>

<specifics>
## Specific Ideas

- Test fixtures must include comments, trailing commas, a BOM, the `mcp-servers`
  key, and a `{ "disabled": true }` stub (the research's warning signs).
- Feed the same fixture to our parser and the adapter's grammar in one test.

</specifics>

<deferred>
## Deferred Ideas

- Keeping user overrides across plugin disable then enable (D-02-15): needs
  persisted state; backlog.
- Phase 3 hand-off: ANAME-07 will write `requestTimeoutMs` from the manifest,
  but it is a carried field (D-02-06), so a plugin's later timeout change would
  never apply. Phase 3 must decide how translation and carry-forward interact.

</deferred>

---

*Phase: 02-adapter-file-delivery*
*Context gathered: 2026-10-02*
