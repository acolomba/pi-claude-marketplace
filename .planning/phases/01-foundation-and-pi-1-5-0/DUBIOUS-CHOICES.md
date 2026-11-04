# Phase 1 (Foundation and Pi 1.5.0): Dubious Choices Log

The choices Phase 1 made without the user, in the shape of the root
`.planning/DUBIOUS-CHOICES.md` (read it for DC-01..DC-45, which these entries
stay consistent with). Only the parent session writes this file: each
subagent ends its report with `## Dubious Choices` (or "None"), and the parent
copies every item here. Phase 6 merges this file into the root log.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.

## Discuss step (parent session, 2026-11-04)

### P1-DC-01: Discuss decisions settled without the user

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** The ROADMAP's Phase 1 discuss items (IDs for the parity
  defaults, the closed-set rendering, the legacy compatibility read, the
  self-selecting tag, `none` and the stand-in) are settled by the parent from
  this project's conventions and Claude Code 2.1.318, per the user's
  instruction for this run (the DC-01 precedent).
- **Alternatives:** Stop and ask, as smart discuss would.
- **Why dubious:** four parallel phases freeze on these answers. Each one has
  its own entry below so the user can reverse it alone.
- **Recorded in:** `01-CONTEXT.md`.

### P1-DC-02: Stored compatibility stays the adapter's verdict; a neutral mark is frozen now

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** `effectiveMcpCompatibility` reads a stored compatibility without
  a neutral mark as the adapter's verdict (every legacy record and every record
  Phase 1 writes, since Phase 1 changes no output). Phase 1 adds an optional
  additive field to the frozen `state-io.ts` schema that marks a stored
  compatibility as neutral, and Phase 3's producer writes it. Under the
  adapter a legacy record's effective result equals its stored verdict
  exactly; a bundle block is never lost; with no readable recorded servers the
  stored verdict stands under every implementation.
- **Alternatives:** (a) Define "neutral" as "always computed against the
  adapter profile", which needs no mark but stores one implementation's
  verdict, against "equal implementations". (b) Infer the basis from the
  presence of `mcpServerConfigs`, which fails because Phase 1 writes that
  field while the compatibility is still the adapter's. (c) Let Phase 3 add
  the field, which needs a frozen-file parent line.
- **Why dubious:** it adds a record field whose only purpose is to tell two
  generations of stored compatibility apart.
- **Recorded in:** `01-CONTEXT.md` "Profiles and effective compatibility".

### P1-DC-03: The run's shared Pi loads pi-mcp-adapter under the adapter profile

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the shared Pi follows the profile: with pi-mcp-adapter under the
  adapter profile, with no companion (built-in MCP on) under the builtin
  profile. So install, list, and info through the shared Pi see the profile's
  implementation, and every MCP `Given ... which warned` install step that
  today warns `requires pi-mcp-adapter` changes under the adapter profile.
- **Alternatives:** keep the shared Pi companion-free in both profiles (then it
  is built-in in both, and adapter-profile rows computed there test the wrong
  implementation), or move every MCP command to a profile Pi (slower, and a
  much larger rewrite).
- **Why dubious:** it ends the "the shared Pi has no companions" rule of the
  cucumber skill, and pi-mcp-adapter writes `-builtin:mcp` into the sandbox
  settings on its first run in each scenario.
- **Recorded in:** `01-CONTEXT.md` "Dual-profile cucumber harness".

### P1-DC-04: Profile layout and the `@own-implementation` tag

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** a run with no `--profile` is the adapter profile and runs every
  scenario except `@builtin-only`; the builtin profile runs `@mcp` and
  `@builtin-only` scenarios except `@adapter-only`. Scenarios that choose
  their own implementation (`none`, the switch) carry `@own-implementation`
  and run once, under the adapter profile.
- **Alternatives:** a third default profile for non-MCP scenarios; another tag
  name (`@self-selecting`, `@mcp-switch`); running self-selecting scenarios
  under both profiles.
- **Why dubious:** a naming and scheduling call with no upstream counterpart.
- **Recorded in:** `01-CONTEXT.md` "Dual-profile cucumber harness".

### P1-DC-05: The built-in stand-in registers through Pi's API, and defers to an existing name

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the stand-in for Phases 4 and 5 is a harness Pi extension that
  calls `pi.registerMcpServer` for the stub under the built-in name, only when
  Pi has no registration and no `mcp.json` server of that name, and only
  under the builtin profile.
- **Alternatives:** the ROADMAP's example, an entry in the sandbox's Pi
  `mcp.json`. After Phase 2 merges, that entry would override the extension's
  own registration of the same name, which BLT-04 must report, so the Phase 4
  and Phase 5 scenarios would gain an unstated report.
- **Why dubious:** a registration that steps aside when the name is taken can
  hide a missing registration in a Phase 4 or Phase 5 scenario. Phase 2's own
  scenarios, which never use the stand-in, are what catch that.
- **Recorded in:** `01-CONTEXT.md` "Dual-profile cucumber harness".

### P1-DC-06: The built-in OAuth client is named "Claude Code (plugin:<plugin>:<server>)"

- **Phase / source:** Phase 1 discuss (D-MB-11); parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** set `oauth.clientName` to the name Claude Code 2.1.318 sends in
  dynamic client registration, and never write `clientRegistration`, so Pi's
  `"auto"` (CIMD, else DCR) applies, which matches Claude Code's own CIMD-else-
  DCR provider (binary read 2026-11-04).
- **Alternatives:** leave `clientName` unset (Pi's default name), or name the
  client after Pi or the extension.
- **Why dubious:** an OAuth server sees a client that calls itself Claude Code
  but is Pi. The parity rule (REQUIREMENTS "Defaults taken by the parity
  rule") asks for it, and no decision licenses leaving it unset. The plugin
  server segment Claude uses in that name, `plugin:<plugin>:<server>`, is
  inferred from CC-8, not read at the call site.
- **Recorded in:** `01-CONTEXT.md` "Decision IDs", D-MB-11.

### P1-DC-07: `mcp` and `builtin mcp` join the `requires:` companion names

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** the closed-set commit appends `mcp` and `builtin mcp` to the
  `Companion` union and the wire's `COMPANIONS`, so `info` can print
  `requires: mcp (missing)` and JSON can carry
  `{"companion":"mcp","missing":true}` (D-MB-07: "the same names with
  `(missing)`").
- **Alternatives:** a separate JSON field for an implementation requirement;
  leaving the JSON shape to Phase 3 (a frozen-file parent line).
- **Why dubious:** the JSON field is named `companion` and now holds names that
  are not packages.
- **Recorded in:** `01-CONTEXT.md` "Closed set, one commit".

### P1-DC-08: A restart step turns built-in MCP on by editing the sandbox settings

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** the frozen restart steps include "turn Pi's built-in MCP on",
  which removes `-builtin:mcp` from the sandbox user settings, as the user
  would, before Pi restarts. The DUAL-04 switch needs it.
- **Alternatives:** none that reaches DUAL-04's "after built-in MCP is on".
- **Why dubious:** the harness edits a Pi settings file that D-MB-01 forbids
  the extension to edit; the step acts as the user, not as the extension.
- **Recorded in:** `01-CONTEXT.md` "Dual-profile cucumber harness".

### P1-DC-09: A third extension that replaces `/mcp` reads as `none`

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** only `/mcp-adapter` (adapter) or an `mcp` command from
  `builtin:mcp` (built-in) count; another `/mcp` provider reads as `none`.
- **Alternatives:** treat any `/mcp` command as built-in.
- **Why dubious:** a user with another MCP extension sees `{requires mcp}`
  although an MCP client is loaded. Registering into a connector the extension
  cannot identify could raise the extension error MSEL-03 forbids.
- **Recorded in:** `01-CONTEXT.md` "Active implementation snapshot".

### P1-DC-10: The registered built-in name keeps `-`; only tool names fold and get cut

- **Phase / source:** Phase 1 discuss (D-MB-13); parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** register `plugin_<plugin>_<server>` with `-` kept, because Pi
  1.5.0 accepts `[A-Za-z0-9_-]+` with no length limit. Pi folds `-` only in the
  namespace and tool names, and cuts tool names over 64 characters with an
  8-hex sha256 suffix; both are recorded Pi-gap divergences. Pi's extra hash
  for two tools that sanitize to one name is a recorded gap.
- **Alternatives:** fold `-` in the registered name too, as the brief's wording
  implied ("Server name `plugin_<plugin>_<server>` therefore keeps Claude
  Code names, except that `-` becomes `_`").
- **Why dubious:** it corrects the brief's reading. The visible tool names are
  the same either way; the difference shows in Pi's `/mcp` list and in
  `getMcpServers()`.
- **Recorded in:** `01-CONTEXT.md` "Decision IDs", D-MB-13.

### P1-DC-11: A Pi's implementation is proven by a harness probe, not by product output

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** DUAL-02's proof is a harness-side check of each started Pi
  against the extension's detection rule (commands and their source paths),
  because Phase 1 may add no user-visible output.
- **Alternatives:** expose the active implementation through `info` or a
  debug entry (research PITFALLS 12), which is visible output.
- **Why dubious:** the check proves what Pi loaded, not what the extension
  read from its snapshot; a wrong snapshot read is caught only once Phases 2
  and 3 add output that depends on it.
- **Recorded in:** `01-CONTEXT.md` "Dual-profile cucumber harness".
