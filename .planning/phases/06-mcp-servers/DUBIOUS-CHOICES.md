# Phase 6 (MCP Servers): Dubious Choices Log

Choices made without the user in the Phase 6 child session
(`features/component-features-phase-6`). Same shape as the root
`.planning/DUBIOUS-CHOICES.md`; the parent merges these entries into it.
Severity: High changes what a user sees or diverges from upstream; Medium is a
judgment call a reviewer may reverse at low cost; Low is process, naming, or
tooling. Status stays `open` until the user reviews it.

## Entries

### P6-DC-01: MCP server sources merge as upstream (MC-1 superseded)

- **Phase / source:** Phase 6 smart discuss (D-CF6-01, FG-27).
- **Severity:** High. **Status:** open.
- **Choice:** A plugin's MCP servers become the union of `.mcp.json` and the
  declared `mcpServers` values, with a later same-name server replacing an
  earlier one, replacing PRD MC-1's "first match wins, no merge".
- **Alternatives:** Keep MC-1 and record it as a licensed divergence.
- **Why dubious:** MC-1 is a recorded PRD requirement, so it could count as
  a license; it was not chosen for an implementation reason, so parity wins
  under the user's instruction. Plugins that declared the same server in two
  places now install more servers than before.
- **Upstream evidence:** binary 2.1.316 manifest schema text "MCP servers to
  include in the plugin (in addition to those in the .mcp.json file, if it
  exists)"; plugins reference "mcpServers".
- **Recorded in:** `06-CONTEXT.md` D-CF6-01.

### P6-DC-02: One malformed server is skipped, not the whole plugin

- **Phase / source:** Phase 6 smart discuss (D-CF6-02, FG-28).
- **Severity:** High. **Status:** open.
- **Choice:** Skip a malformed server with an install warning and install the
  rest of the plugin, as upstream does.
- **Alternatives:** Keep `(unavailable) {malformed mcp}` for the whole plugin
  and give it a decision ID.
- **Why dubious:** The docs cite ANAME-07 as the license, but ANAME-07 covers
  unsupported transport features, not malformed servers; a reviewer may read
  "a malformed component makes a plugin unavailable everywhere" as a project
  principle worth keeping.
- **Upstream evidence:** docs (mcp "Invalid server configs"), to be confirmed
  on the binary by the phase researcher.
- **Recorded in:** `06-CONTEXT.md` D-CF6-02.

### P6-DC-03: Project-scope plugin servers keep adapter approval

- **Phase / source:** Phase 6 smart discuss (D-CF6-03, FG-29).
- **Severity:** Medium. **Status:** open.
- **Choice:** Keep the adapter's project trust (a headless session needs the
  user-global `projectServers: "allow"`) as a licensed divergence, and pin
  the blocked cases.
- **Alternatives:** Write the adapter's approval file at install (outside
  NFR-10's write set); install project-scope servers into the user file.
- **Why dubious:** Upstream never asks to approve a plugin server, so a
  project-scope plugin user sees a prompt or a blocked server that Claude
  Code users never see.
- **Upstream evidence:** docs (Claude Code asks only for project `.mcp.json`
  servers); adapter 7.0.0 `project-server-trust.ts`.
- **Recorded in:** `06-CONTEXT.md` D-CF6-03.

### P6-DC-04: Phase 6 adds its own stand-ins and agent fixture writer

- **Phase / source:** Phase 6 smart discuss (D-CF6-06, D-CF6-07).
- **Severity:** Low. **Status:** open.
- **Choice:** New stand-ins (such as a loopback HTTP MCP server) live in
  Phase 6-owned `features/lib/mcp-server-*.ts` files, and the MCP-07 agent is
  written by a helper in `mcp-server-files.ts`, not by `agent-files.ts`.
- **Alternatives:** Extend the frozen stub (a parent line); import Phase 4's
  `agent-files.ts`.
- **Why dubious:** The ownership table names only `mcp-server-files.ts` for
  Phase 6's lib; new `mcp-server-*` files widen it. Writing an agent outside
  `agent-files.ts` duplicates a little fixture code.
- **Recorded in:** `06-CONTEXT.md` D-CF6-06, D-CF6-07.

### P6-DC-05: Commit trailer names this child session

- **Phase / source:** Phase 6 child session, git.
- **Severity:** Low. **Status:** open.
- **Choice:** Commits end with `Claude-Session:
  https://claude.ai/code/session_01EDUMG6ciPE7kp9aMmHch1m` (this child
  session, as the session's own attribution reminder gives), not the parent's
  `session_01EDUMG5ARYqF6oZYKmj6oB3` that the brief prints.
- **Alternatives:** Copy the brief's trailer verbatim.
- **Why dubious:** The brief says "exactly"; the trailer is meant to point at
  the session that made the commit, which is this one.
- **Recorded in:** this file; every Phase 6 commit.
