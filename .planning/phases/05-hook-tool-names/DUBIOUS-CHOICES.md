# Phase 5 (Hook Tool Names): Dubious Choices Log

The choices Phase 5 made without the user, in the shape of the root
`.planning/DUBIOUS-CHOICES.md` (read it for DC-01..DC-45, which these entries
stay consistent with). Only the Phase 5 child session writes this file: each
subagent ends its report with `## Dubious Choices` (or "None"), and the
session copies every item here. Phase 6 merges this file into the root log.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.

## Discuss step (Phase 5 child session, 2026-11-04)

### P5-DC-01: Discuss decisions settled without the user

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the Phase 5 grey areas (tool identity, name form, matching, the
  proxy rule, scenarios, placement) are settled from Pi 1.5.0's source, this
  project's conventions, and Claude Code parity, per the user's instruction
  for this run (DC-01, P1-DC-01 precedent).
- **Alternatives:** stop and ask, as smart discuss would.
- **Why dubious:** each answer shapes what a hook sees. Each has its own entry
  below so the user can reverse it alone.
- **Recorded in:** `05-CONTEXT.md`.

### P5-DC-02: Claude's server form for every built-in server, not only plugin servers

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the hooks bridge names every built-in MCP tool
  `mcp__<registered server name>__<tool>`, reading the server name from the
  namespace alias Pi gives the tool. That covers a user's `mcp.json` servers
  too (D-P5-01, D-P5-02).
- **Alternatives:** (a) map only plugin servers, which needs the list of every
  installed plugin's servers at dispatch time (the hooks bridge has only the
  plugins with hooks); (b) leave non-plugin servers in Pi's folded form.
- **Why dubious:** MHK-01 names plugin MCP tools only. A plugin hook written
  for Claude Code sees `mcp__<server>__<tool>` with `-` kept for every server,
  so parity covers user servers too, and the alias is the one signal Pi
  gives for both.
- **Recorded in:** `05-CONTEXT.md` D-P5-01, D-P5-02.

### P5-DC-03: A matcher with Claude's tool name (with `-`) fires on the built-in tool

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** High. **Status:** open.
- **Choice:** a matcher or `if` literal `mcp__<server>__<tool>` fires when Pi
  1.5.0's `createMcpToolName(server, tool)` gives the event's tool name, so
  Claude's full name fires, `-` in the tool segment included (D-P5-04). The
  only divergence left in the tool segment is the `tool_name` the hook reads
  on stdin, which keeps Pi's fold.
- **Alternatives:** compare the matcher to the Claude-form name as it is, so a
  matcher must fold the tool segment itself (`__echo_text` for the tool
  `echo-text`), which is how D-MB-08's text and the ROADMAP criterion read
  ("only the tool segment's `-` to `_` fold differs").
- **Why dubious:** it reads D-MB-08's divergence as covering only what Pi
  cannot give (the original tool name on stdin), not the matcher, which the
  bridge can compute. Upstream parity favors it: a hook written for Claude
  Code names the real tool. It goes beyond the text of a decision pending the
  user's review.
- **Recorded in:** `05-CONTEXT.md` D-P5-04.

### P5-DC-04: A matcher with the folded tool segment also fires

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Low. **Status:** open.
- **Choice:** `mcp__<server>__echo_text` fires on the tool `echo-text` under
  built-in, because Pi gives both spellings one name (D-P5-04).
- **Alternatives:** none that Pi's information allows; the original tool name
  is not in the tool list.
- **Why dubious:** upstream, that matcher fires only on a tool named
  `echo_text`. A server that offers both gets Pi's hash, and then only the
  hashed form's own spelling fires.
- **Recorded in:** `05-CONTEXT.md` D-P5-04.

### P5-DC-05: A name that Pi cuts inside the namespace stays in Pi's form

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** when Pi's 64-character cut falls inside `mcp__<namespace>__`,
  the hook's `tool_name` is Pi's cut name. Matchers still fire, because the
  matcher check computes Pi's cut and hash from the matcher (D-P5-02,
  D-P5-04).
- **Alternatives:** build `mcp__<server>__<something>` from the cut remainder,
  which is neither Claude's name nor Pi's.
- **Why dubious:** upstream sees the full name. Pi's cut is a Pi capability
  gap (D-MB-13); this keeps the name the model and Pi's own logs show.
- **Recorded in:** `05-CONTEXT.md` D-P5-02, D-P5-10.

### P5-DC-06: The proxy rule reads the active implementation, not the tool's source

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the D-CF5-12 proxy rule applies only when
  `softDepStatus(pi).mcpImplementation` is `adapter`, read once per bridge
  generation at the first proxy-shaped call (D-P5-06, D-P5-07).
- **Alternatives:** (a) apply it only when the tool named `mcp` or
  `mcp__<server>` was registered by pi-mcp-adapter (its `sourceInfo.source`),
  which is stricter but misses a fork that ADET-02 detects by its
  `mcp-adapter` command; (b) read the implementation at `session_start`,
  which adds probes beside the frozen run snapshot.
- **Why dubious:** with the adapter active, another extension's
  proxy-shaped tool still runs no hook, as today. MHK-02 words it "while the
  adapter is active", which this follows.
- **Recorded in:** `05-CONTEXT.md` D-P5-06, D-P5-07.

### P5-DC-07: Phase 1's `@adapter-only` hook scenario becomes a tagged pair

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the scenario keeps `@adapter-only`, now for the adapter's proxy
  de-dup (D-CF5-12, MHK-02), and gains an `@builtin-only` twin in the same
  file, where the `*` hooks also run on `tool_search` (D-P5-11). The
  shared, both-profile scenario lives in the new `mcp-tool-names.feature`.
- **Alternatives:** drop the `*` hooks so one scenario runs under both
  profiles, which loses the proof that the outer proxy call runs no hook.
- **Why dubious:** the brief says to remove the tags Phase 1 placed. The
  scenario's expectation differs by implementation, and the milestone rule
  for that case is a tagged pair in one file.
- **Recorded in:** `05-CONTEXT.md` D-P5-11.

### P5-DC-08: The tool-segment fold scenario uses a user `mcp.json` server and a Phase 5 stub

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the scenario that pins the `-` to `_` fold of the tool segment
  configures a server in Pi's own `mcp.json`, run by a new Phase 5 stub
  library whose tool has a `-` in its name (D-P5-09).
- **Alternatives:** (a) a plugin server, which needs the frozen stub to offer
  such a tool (a parent line) or the extension's registration from Phase 2,
  which merges after Phase 5; (b) a Phase 5 stand-in extension loaded from the
  agent's `extensions/` directory.
- **Why dubious:** MHK-01 speaks of a plugin MCP tool; this scenario's server
  is the user's. The fold is the same for both, and the plugin case is pinned
  for the server segment by the shared scenario.
- **Recorded in:** `05-CONTEXT.md` D-P5-09.

### P5-DC-09: `tool_search` keeps its Pi name in hooks

- **Phase / source:** Phase 5 discuss; child session.
- **Severity:** Low. **Status:** open.
- **Choice:** a `*` hook sees Pi's `tool_search` under its own name, not as
  Claude Code's `ToolSearch` (deferred idea).
- **Alternatives:** map `tool_search` to `ToolSearch` in the tool-name table.
- **Why dubious:** both are the deferred-tool discovery tool, so a matcher
  `ToolSearch` written for Claude Code does not fire. It is outside MHK-01 and
  MHK-02.
- **Recorded in:** `05-CONTEXT.md` Deferred Ideas.

## Research step (gsd-phase-researcher, 2026-11-04; adopted by the child session)

### P5-DC-10: The proxy rule reads the implementation through the notification snapshot

- **Phase / source:** Phase 5 research.
- **Severity:** Medium. **Status:** open.
- **Choice:** the bridge reads the active implementation through
  `openNotificationSnapshot(pi).softDeps.mcpImplementation`, not by calling
  `softDepStatus(pi)` itself; CONTEXT D-P5-06 now says so.
- **Alternatives:** call `softDepStatus` directly, as D-P5-06 first read.
- **Why dubious:** it changes how a discuss decision is carried out. D-JO-01
  (PROJECT.md) makes the notification run the only caller of
  `softDepStatus`; the answer and the probe counts are the same.
- **Recorded in:** `05-CONTEXT.md` D-P5-06, `05-RESEARCH.md`.

### P5-DC-11: The namespace prefix is `<namespace name>__`

- **Phase / source:** Phase 5 research.
- **Severity:** Low. **Status:** open.
- **Choice:** the Claude-form name strips `<namespace name>__` from Pi's name;
  CONTEXT D-P5-02 is corrected.
- **Alternatives:** the first text, `mcp__<namespace name>__`, which never
  matches because Pi's namespace name already starts with `mcp__`.
- **Why dubious:** a decision's text was corrected after discuss.
- **Recorded in:** `05-CONTEXT.md` D-P5-02.

### P5-DC-12: The built-in twin's PostToolUse hook is a literal, not `*`

- **Phase / source:** Phase 5 research.
- **Severity:** Medium. **Status:** open.
- **Choice:** in the built-in half of the tool-use pair, only the PreToolUse
  hook is `*`; the PostToolUse hook names the tool in Claude's form.
- **Alternatives:** keep `*` for both, as D-P5-11 first said.
- **Why dubious:** a `*` PostToolUse row would pin `tool_search`'s result,
  which is Pi's own wording; the cucumber rules forbid stating upstream text,
  and the runs table must list every column.
- **Recorded in:** `05-CONTEXT.md` D-P5-11.

### P5-DC-13: The tool-use pair moves to `hook-demo`/`stub-server`

- **Phase / source:** Phase 5 research.
- **Severity:** Medium. **Status:** open.
- **Choice:** both halves of the Phase 1 scenario use names with `-`.
- **Alternatives:** keep `demo`/`stub` and record the twin as coverage only.
- **Why dubious:** it rewrites a Phase 1 scenario; with `demo`/`stub` the
  built-in twin passes on the Phase 1 tree and gives no red proof (D-P5-12).
- **Recorded in:** `05-CONTEXT.md` D-P5-11.

### P5-DC-14: A profile-aware step builds the model script

- **Phase / source:** Phase 5 research.
- **Severity:** Medium. **Status:** open.
- **Choice:** the shared `@mcp` scenario's model script is built by a step
  from `profileFor(...).toolName` (helper `features/lib/hook-mcp-calls.ts`).
- **Alternatives:** an `@adapter-only`/`@builtin-only` pair with literal
  scripts, which drops D-P5-08's single both-profile scenario.
- **Why dubious:** the cucumber rule says a feature file writes the whole
  script as literals (`world-and-stand-ins.md`); no literal works under both
  profiles, because the tool names differ.
- **Recorded in:** `05-RESEARCH.md`.

### P5-DC-15: Built-in tools are not excluded from the proxy rule under the adapter

- **Phase / source:** Phase 5 research.
- **Severity:** Low. **Status:** open.
- **Choice:** no extra hardening: when the adapter and built-in MCP are both
  loaded, a built-in cut-name tool with a string `tool` input is still
  skipped as a proxy call.
- **Alternatives:** never treat a `builtin:mcp` tool as a proxy call.
- **Why dubious:** an edge case stays; the hardening goes beyond D-P5-06.
- **Recorded in:** `05-RESEARCH.md` Open Questions.

### P5-DC-16: Claude Code matcher differences stay out of scope

- **Phase / source:** Phase 5 research.
- **Severity:** Low. **Status:** open.
- **Choice:** none acted on: Claude Code 2.1.318 treats a matcher of
  `[a-zA-Z0-9_|, -]` as a list of exact names (spaces and commas allowed) and
  any other matcher as an unanchored regex; this project accepts only
  `[A-Za-z0-9_|-]` and matches server prefixes with `startsWith`.
- **Alternatives:** widen the safe charset and match unanchored.
- **Why dubious:** two existing parity gaps stay.
- **Recorded in:** `05-RESEARCH.md`.

### P5-DC-17: Research probes ran cucumber on scratch feature files

- **Phase / source:** Phase 5 research.
- **Severity:** Low. **Status:** open.
- **Choice:** probes ran `npx cucumber-js` on feature files outside
  `features/`; the plans reuse this for the red proofs (D-P5-12).
- **Alternatives:** red proofs from a temporary edit inside `features/`.
- **Why dubious:** not a documented harness use; it writes no repo file.
- **Recorded in:** `05-RESEARCH.md` Validation Architecture.
