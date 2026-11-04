# Phase 4 (Agent Grants): Dubious Choices Log

The choices Phase 4 made without the user, in the shape of the root
`.planning/DUBIOUS-CHOICES.md` (read it for DC-01..DC-45, which these entries
stay consistent with). Only the Phase 4 child session writes this file: each
subagent ends its report with `## Dubious Choices` (or "None"), and the
session copies every item here. Phase 6 merges this file into the root log.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.

## Discuss step (Phase 4 child session, 2026-11-04)

### P4-DC-01: Discuss decisions settled without the user

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the ROADMAP's Phase 4 discuss items and research flags are
  settled from pi-subagents 0.84.0's source, this project's conventions, and
  Claude Code parity, per the user's instruction for this run (DC-01 and
  P1-DC-01 precedent).
- **Alternatives:** stop and ask, as smart discuss would.
- **Why dubious:** each answer below shapes user-visible agent files. Each
  has its own entry so the user can reverse it alone.
- **Recorded in:** `04-CONTEXT.md`.

### P4-DC-02: The agents index stores each implementation's rendered frontmatter

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** when an agent renders differently under the adapter and
  built-in, staging renders both, writes the active one, and stores in the
  agents-index row the form the file holds (`mcpImplementation`) plus each
  form's frontmatter block, warnings, and dropped tools. The load swaps the
  frontmatter when the file still holds the recorded form.
- **Alternatives:** (a) re-run the conversion from the plugin source at load,
  which needs every install input (`--map-model`, skill preloads, reference
  names) and silently picks up a changed source, an update at load against
  APL-D1; (b) a pure translator between the two forms, which cannot invert
  Pi's hashed long tool names or restore a grant that built-in dropped (an
  `sse` server); (c) record only `mcpImplementation` and re-stage the plugin
  at load, a full materialization at load.
- **Why dubious:** it stores derived text (about one frontmatter block per
  MCP-granting agent) in `agents-index.json`.
- **Recorded in:** `04-CONTEXT.md` "Grant form per implementation".

### P4-DC-03: With no active implementation, the file gets the adapter form

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Low. **Status:** open.
- **Choice:** an install while no implementation is active writes the
  adapter form, the form every earlier release wrote; the load rewrites it
  once an implementation is active.
- **Alternatives:** write the built-in form (Pi's own implementation), or
  write no MCP grant until an implementation is active (AG-11 would then
  refuse an agent whose only tools are MCP tools).
- **Why dubious:** "equal implementations" suggests no default; the research
  chose the adapter for compatibility.
- **Recorded in:** `04-CONTEXT.md`; `.planning/research/ARCHITECTURE.md`
  "Install".

### P4-DC-04: A built-in wording of the async warning

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the D-CF6-10 warning keeps its adapter text byte for byte; the
  built-in form ends "a launch before Pi's built-in MCP has listed the
  server's tools still fails" instead of naming pi-mcp-adapter's cache.
  Phase 3's `@builtin-only` row in `verdict-markers.feature` that quotes the
  warning then reads the built-in text after the merge (cross-phase note).
- **Alternatives:** one wording for both (keeps Phase 3's row, but the
  adapter clause is wrong under built-in); drop the trailing clause under
  built-in.
- **Why dubious:** a user-visible text change that touches a sibling's row.
- **Recorded in:** `04-CONTEXT.md` "Grant form per implementation".

### P4-DC-05: The built-in form maps the declared servers that built-in runs

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the adapter form maps `resolved.mcpServers` (today's input);
  the built-in form maps the `declaredMcpServers` whose built-in verdict is
  supported, so an `sse` server's grant is dropped with today's warning under
  built-in and kept under the adapter.
- **Alternatives:** map the same server set in both forms (a built-in grant
  of a blocked server would fail the launch); map every declared server.
- **Why dubious:** the grant set now depends on Phase 3's per-profile
  verdicts, which Phase 3 may still refine.
- **Recorded in:** `04-CONTEXT.md`.

### P4-DC-06: Agents installed before this phase are not rewritten at load

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** High. **Status:** open.
- **Choice:** a legacy agents-index row has no stored forms, so the load
  leaves its adapter-form file. Under built-in its MCP grant fails to resolve
  until `reinstall`, `update`, or disable-then-enable re-stages it.
- **Alternatives:** translate legacy adapter files to the built-in form at
  load (exact for selectors and warnings, lossy only for long per-tool
  `excludeTools` names), or re-stage the plugin's agents at load.
- **Why dubious:** the milestone goal says a switch never needs user action;
  this is a gap for agents installed by an earlier release.
- **Recorded in:** `04-CONTEXT.md` "Legacy rows", "Deferred Ideas".

### P4-DC-07: A background child is detected by `PI_SUBAGENT_CHILD=1`

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Low. **Status:** open.
- **Choice:** `platform/subagent-child.ts` reads the variable pi-subagents'
  runner sets (`src/runs/background/subagent-runner.js:89`), the same signal
  pi-subagents uses to stay inert in its own children.
- **Alternatives:** compare the session's parent session id
  (`PI_SUBAGENT_PARENT_SESSION`), which the parent process also carries
  while launching; detect `print` mode, which a user's `pi -p` run also has.
- **Why dubious:** a pi-subagents internal, not a documented API; a rename
  upstream would silently turn the guard off. The new file also does not take
  a phase name prefix.
- **Recorded in:** `04-CONTEXT.md` "Background child".

### P4-DC-08: The child gate edits the unowned `load.ts`; first-run migrations stay ungated

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** `orchestrators/reconcile/load.ts`, which no phase owns, skips
  the autoapply apply step and the AMIG-01 MCP move in a child, through an
  optional environment parameter so the frozen `index.ts` call is unchanged.
  The MIG-01 config migration and `loadState`'s legacy migration stay,
  because the parent's load runs them first and both are idempotent.
- **Alternatives:** a parent line for `index.ts` to skip the load reconcile's
  writes in a child (MGRT-02 then waits for Phase 6); also gate the read
  pass's migrations in the unowned `read-pass.ts`; skip the whole load
  reconcile in a child (loses the hook routing rebuild).
- **Why dubious:** it edits a file outside the ownership table, and D-MB-12's
  "no config" is met only in the steady state.
- **Recorded in:** `04-CONTEXT.md` "Background child".

### P4-DC-09: The load rewrite is silent

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the rewrite reports nothing; a skipped agent (edited file, held
  lock, write failure) is only debug-logged. No closed-set entry is added.
- **Alternatives:** a load warning row naming each agent left in the old
  form (needs a new reason and catalog states).
- **Why dubious:** a user whose edited agent keeps a grant that no longer
  resolves gets no hint at load.
- **Recorded in:** `04-CONTEXT.md` "Load-time rewrite".

### P4-DC-10: The background child scenario uses a stand-in Pi, not a real child

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** a profile Pi started with `PI_SUBAGENT_CHILD=1` through the
  launch-environment stand-in plays the background child, because the
  harness's background children load neither the companions nor this
  extension (MCPBG-01).
- **Alternatives:** unit and integration tests only; extend the frozen
  harness so a real background child loads the extension (a parent line).
- **Why dubious:** the scenario proves the guard's behavior, not that
  pi-subagents sets the variable; that rests on the cited source line.
- **Recorded in:** `04-CONTEXT.md` "Behavioral tests".

### P4-DC-11: Phase 4 edits the unowned `features/lib/upstream/subagents.ts`

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Low. **Status:** open.
- **Choice:** the pi-subagents error projection learns the built-in server
  and selector names, so the built-in foreground refusal reads
  `error naming plugin_demo_stub`; the adapter projection is unchanged.
- **Alternatives:** a new Phase 4 lib with its own projection (duplicates the
  reader); assert the built-in refusal as a bare `error`, which proves
  nothing about the grant.
- **Why dubious:** a shared harness file outside the ownership table.
- **Recorded in:** `04-CONTEXT.md` "Behavioral tests".

### P4-DC-12: An implementation whose form empties an explicit tools list

- **Phase / source:** Phase 4 discuss; child session.
- **Severity:** Low. **Status:** open.
- **Choice:** AG-11 applies to the active form only: staging fails as today
  when the active form maps an explicit list to nothing; an inactive form
  that does is not stored, and a load under that implementation leaves the
  file.
- **Alternatives:** fail staging when either form is empty; write the agent
  with no MCP grant under the other implementation.
- **Why dubious:** an enable after a switch can now fail AG-11 where the
  install did not, which D-MB-06's spirit (no failure because of a switch)
  argues against.
- **Recorded in:** `04-CONTEXT.md` "AG-11 per form".
