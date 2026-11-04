# Phase 2 (Built-in Materialization): Dubious Choices Log

The choices Phase 2 made without the user, in the shape of the root
`.planning/DUBIOUS-CHOICES.md` (DC-01..DC-45, which these entries stay
consistent with) and of Phase 1's log (`P1-DC-NN`). Only this phase's parent
session (the Phase 2 child session) writes this file: each subagent ends its
report with `## Dubious Choices` (or "None"), and the session copies every
item here. The milestone parent merges this file into the root log in Phase 6.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.

## Discuss step (Phase 2 session, 2026-11-04)

### P2-DC-01: Discuss decisions settled without the user

- **Phase / source:** Phase 2 discuss; Phase 2 session.
- **Severity:** Medium. **Status:** open.
- **Choice:** The ROADMAP's Phase 2 discuss items (how Claude Code sets `cwd`
  and expands variables, references or resolved values, the timeout rounding,
  the switch through `none`, the legacy `mcp.json` report) are settled by the
  session from upstream parity, the Pi 1.5.0 source, and this project's
  conventions, per the user's instruction for this run (P1-DC-01 precedent).
- **Alternatives:** Stop and ask, as smart discuss would.
- **Why dubious:** each answer shapes what a built-in server receives. Each
  has its own entry below so the user can reverse it alone.
- **Recorded in:** `02-CONTEXT.md`.

### P2-DC-02: Built-in values are resolved by the extension at registration, not written as `${VAR}` references

- **Phase / source:** Phase 2 discuss.
- **Severity:** High. **Status:** open.
- **Choice:** The built-in encoder expands every Claude variable itself with
  Claude's rule and the AVAR-05 deny-lists, from the session environment at
  each registration, then escapes `$` to `$$` and a leading `!` to `$!` in
  `env` and `headers` (the fields Pi expands). `command`, `args`, and `url`
  get the expanded value as is. An unset variable with no default keeps
  Claude's literal `${NAME}` text.
- **Alternatives:** (a) Write `${VAR}` references and let Pi expand them:
  Pi expands only `env`, `headers`, and `oauth.clientSecret`, reads bare
  `$NAME`, has no `:-default`, runs a leading `!` as a shell command, and
  fails the connection on an unset variable, so the server would not get
  Claude's values. (b) A mix: references in `env` and `headers`, resolved
  values elsewhere: still breaks `:-default` and the unset rule.
- **Why dubious:** resolved values, secrets included, sit in Pi's session
  registry, where any extension of the same Pi process can read them through
  `getMcpServers()`; that process already holds them in `process.env`. Nothing
  is persisted.
- **Recorded in:** `02-CONTEXT.md` "Translation and value encoding".

### P2-DC-03: `CLAUDE_PROJECT_DIR` is the session `cwd` for both scopes under built-in

- **Phase / source:** Phase 2 discuss.
- **Severity:** Low. **Status:** open.
- **Choice:** Under built-in, `${CLAUDE_PROJECT_DIR}` expands to `ctx.cwd` at
  each registration for user-scope and project-scope servers alike. The
  adapter path keeps its install-time rule (project scope expands, user scope
  keeps the reference for pi-mcp-adapter to read from Pi's process, AVAR-01).
- **Alternatives:** Mirror the adapter rule and leave the reference for a
  user-scope server: Pi would expand `${CLAUDE_PROJECT_DIR}` only in `env` and
  `headers`, and only from `process.env`, which the extension sets anyway.
- **Why dubious:** the two implementations take the value from different
  places, though both give the session's project directory.
- **Recorded in:** `02-CONTEXT.md`.

### P2-DC-04: No `cwd` is written for a built-in stdio server

- **Phase / source:** Phase 2 discuss.
- **Severity:** Medium. **Status:** open.
- **Choice:** The built-in entry never carries `cwd`: Claude's plugin schema
  has none (CC-1), and Pi then starts the server in the session directory.
  The phase researcher confirms the directory Claude Code 2.1.318 uses; a
  difference is recorded as a gap, not patched with a Pi-only `cwd`.
- **Alternatives:** Write `cwd` as the plugin root, as some MCP hosts do.
- **Why dubious:** the upstream directory was not proven from the binary
  during discuss (research rated it LOW).
- **Recorded in:** `02-CONTEXT.md`.

### P2-DC-05: `timeout` converts with `ms / 1000` and no rounding

- **Phase / source:** Phase 2 discuss.
- **Severity:** Low. **Status:** open.
- **Choice:** The built-in `timeout` is the adapter translation's normalized
  milliseconds divided by 1000, fractions kept (Pi accepts any positive
  number of seconds).
- **Alternatives:** Round up to whole seconds; round to the nearest second.
- **Why dubious:** Pi resets the timeout on progress and Claude does not; the
  conversion cannot close that gap.
- **Recorded in:** `02-CONTEXT.md`.

### P2-DC-06: A server the active built-in profile runs registers even if the install recorded the plugin as partial

- **Phase / source:** Phase 2 discuss.
- **Severity:** Medium. **Status:** open.
- **Choice:** Registration reads the record's full `mcpServerConfigs` and
  classifies each server with the built-in profile, so a server the adapter
  blocked at install (for example `bareElicitationCapability: true`) runs
  under built-in with no reinstall.
- **Alternatives:** Register only the servers the install-time verdict kept.
- **Why dubious:** the user's `--partial` consent at install named a smaller
  set; equal implementations (and research FEATURES "the full record now
  serves every server") favor serving it.
- **Recorded in:** `02-CONTEXT.md`.

### P2-DC-07: With an untrusted project, a user-scope record of the same plugin registers

- **Phase / source:** Phase 2 discuss.
- **Severity:** Low. **Status:** open.
- **Choice:** The trusted project record wins over the user record of the same
  plugin; while the project is not trusted, the project record registers
  nothing and the user record registers.
- **Alternatives:** Hold back both while the project is not trusted.
- **Why dubious:** Claude Code reads no project settings before trust, so the
  user install is what it would load; Pi's own trust rules are the gate
  (D-LOC-01).
- **Recorded in:** `02-CONTEXT.md`.

### P2-DC-08: `mcp.json` overrides and failed registrations are reported in `info` only, with no new load notice

- **Phase / source:** Phase 2 discuss.
- **Severity:** High. **Status:** open.
- **Choice:** BLT-04's "reported, never silent" is met by `info`
  (`overridden by mcp.json`, and `not loaded` for a registration Pi refused)
  plus Pi's own `/mcp` override list. A refused registration is also
  debug-logged. No closed-set message kind is added for a load-time notice.
- **Alternatives:** A new load-origin notice surface listing overridden and
  failed built-in registrations (append-only closed-set addition, catalog
  counters change).
- **Why dubious:** a user who never runs `info` or `/mcp` does not learn of
  the override. Upstream reports a suppressed duplicate plugin server in
  `/plugin` (`mcp-server-suppressed-duplicate`), the analog of `info`.
- **Recorded in:** `02-CONTEXT.md` "Naming, collisions, overrides, and status".

### P2-DC-09: No load-time collision check between plugin servers under built-in

- **Phase / source:** Phase 2 discuss.
- **Severity:** Low. **Status:** open.
- **Choice:** Plugin-to-plugin folded-name collisions stay refused at install
  by ANAME-03, which runs under every implementation because install keeps
  staging adapter entries (MSEL-04); the built-in name is the adapter key
  without its trailing `_`, so the refusal covers both.
- **Alternatives:** Repeat the check at each registration, in a fixed order.
- **Why dubious:** a hand-edited `state.json` could hold two colliding
  records; Pi would then hash the colliding tool names.
- **Recorded in:** `02-CONTEXT.md`.

### P2-DC-10: The built-in status is inferred from Pi's tool list

- **Phase / source:** Phase 2 discuss.
- **Severity:** Medium. **Status:** open.
- **Choice:** `connected` means a tool of the server's namespace is not
  `hidden`; `disabled` means every such tool is `hidden`; `not connected`
  means registered with no tools; `not loaded` means Pi lists no
  registration. Pi gives extensions no connection state.
- **Alternatives:** Report `status unknown` for every registered server.
- **Why dubious:** a server that connected and offers no tools reads
  `not connected`, and a failed server cannot be told from one still
  connecting or waiting for sign-in.
- **Recorded in:** `02-CONTEXT.md`.

### P2-DC-11: Legacy `mcp.json` entries run once more under their old name in the first built-in session

- **Phase / source:** Phase 2 discuss (ROADMAP discuss item).
- **Severity:** Medium. **Status:** open.
- **Choice:** Phase 2 adds no code for entries that releases before AMIG-01
  wrote to `mcp.json`. They are keyed by the declared server name, so they
  never override a `plugin_<plugin>_<server>` registration; in the first
  built-in session after such an upgrade, Pi's built-in MCP also runs the
  legacy entry under its old name until the same load's AMIG-01 move takes it
  out. The one-session duplicate is recorded as a gap.
- **Alternatives:** Run the AMIG-01 move before Pi reads `mcp.json` (Pi reads
  it at its own `session_start`, which an extension cannot precede, and the
  move is Phase 3's file); skip registering a server whose legacy entry is
  still present for that session.
- **Why dubious:** the user may see the server's tools twice, under two
  names, for one session.
- **Recorded in:** `02-CONTEXT.md` "Switch, legacy entries, scenarios, and docs".

### P2-DC-12: The switch scenario asserts only "not reached" in the `none` leg

- **Phase / source:** Phase 2 discuss.
- **Severity:** Low. **Status:** open.
- **Choice:** In `implementation-switch.feature`, the leg after the adapter
  is removed (its `-builtin:mcp` left in the settings) asserts that the
  server is not reached and that Pi reports no extension error; the
  `{requires mcp}` row is Phase 6's step (DUAL-04), since Phase 3 owns that
  marker.
- **Alternatives:** Skip the `none` leg in Phase 2 and add it in Phase 6.
- **Why dubious:** the scenario is incomplete until Phase 6.
- **Recorded in:** `02-CONTEXT.md`.

## Research step (gsd-phase-researcher, 2026-11-04)

### P2-DC-13: Containment root corrected to the marketplace root or the plugin clones directory

- **Phase / source:** Phase 2 research; amends `02-CONTEXT.md`.
- **Severity:** Medium. **Status:** open.
- **Choice:** UF-1's check requires `resolvedSource` inside the record's
  `marketplaceRoot` (path records) or the scope's `pluginClonesDir` (git
  records), not inside `<scopeRoot>/pi-claude-marketplace/` as the parent's
  advisory worded it, because a `dir`/`file` marketplace's root is the user's
  own directory.
- **Alternatives:** The advisory's wording (refuses every local-marketplace
  plugin); no check.
- **Why dubious:** it departs from the advisory text; the bound is the owning
  clone root NFR-10 names.

### P2-DC-14: The project record wins per server name, not per whole record

- **Phase / source:** Phase 2 research (researcher DC 1); amends CONTEXT.
- **Severity:** Low. **Status:** open.
- **Choice:** With the same plugin in both trusted scopes, each project server
  overwrites the user server of the same name; user servers the project record
  lacks still register.
- **Alternatives:** Skip the whole user record (CONTEXT's first wording).
- **Why dubious:** differs only when the two records declare different server
  sets; matches the adapter's file merge.

### P2-DC-15: Any JSON-object `mcp.json` entry counts as an override in `info`

- **Phase / source:** Phase 2 research (researcher DC 2).
- **Severity:** Low. **Status:** open.
- **Choice:** The override check treats any object entry with our namespace as
  an override, without Pi's `validateMcpServerConfig` (not re-exported by the
  frozen `pi-api.ts`).
- **Alternatives:** A frozen-file parent line to re-export the validator.
- **Why dubious:** an invalid entry would show `overridden by mcp.json` while
  Pi actually connects our server.

### P2-DC-16: `info` status scenarios use the full-field step and pin Phase 3's `requires` row

- **Phase / source:** Phase 2 research (researcher DC 3).
- **Severity:** Medium. **Status:** open.
- **Choice:** Built-in `info` status scenarios assert the whole info block,
  which includes rows Phase 3 may change; they are re-verified after Phase 3
  merges.
- **Alternatives:** A narrow step that compares only the `mcp` list.
- **Why dubious:** couples a Phase 2 file to Phase 3 rows.

### P2-DC-17: OAuth and timeout values are observed through a Phase 2 registry-config probe

- **Phase / source:** Phase 2 research (researcher DC 4).
- **Severity:** Medium. **Status:** open.
- **Choice:** A harness Pi extension reports `getMcpServers()` configs, so
  scenarios pin the values Pi holds for each registration.
- **Alternatives:** A loopback 401 authorization-server stand-in; unit and
  integration proof only.
- **Why dubious:** it observes Pi's registry, not Pi's runtime use of the
  values.

### P2-DC-18: A Phase 2-local `tool_search` projection step, moved to `upstream/` later by a parent line

- **Phase / source:** Phase 2 research (researcher DC 5).
- **Severity:** Medium. **Status:** open.
- **Choice:** Phase 2 owns a step module and lib that project Pi's
  `tool_search` result; a Phase 6 parent line moves it into the shared
  `features/lib/upstream/`.
- **Alternatives:** Ask the parent to add it to the frozen shared module now.
- **Why dubious:** Phases 4 and 5 may write their own copy.

### P2-DC-19: The adapter path passes its encoder explicitly

- **Phase / source:** Phase 2 research (researcher DC 6).
- **Severity:** Low. **Status:** open.
- **Choice:** `substituteAndInject` takes the encoder as a required parameter.
- **Alternatives:** A default parameter (CONTEXT's first wording).
- **Why dubious:** wording change only; output identical.

### P2-DC-20: `callbackUrl` is written only when `callbackPort` is set

- **Phase / source:** Phase 2 research (researcher DC 7).
- **Severity:** Low. **Status:** open.
- **Choice:** Without `callbackPort`, no `callbackUrl` is written and Pi uses
  `http://127.0.0.1:<free port>/callback`.
- **Alternatives:** Always write `http://localhost/callback` (Claude's host).
- **Why dubious:** a pre-registered client that allows only `localhost` would
  be refused.

### P2-DC-21: Claude's stdio `cwd` rests on minified helper attribution

- **Phase / source:** Phase 2 research (researcher DC 8).
- **Severity:** Low. **Status:** open.
- **Choice:** P2-DC-04 (no `cwd`) is supported by helpers found by name in the
  minified binary, plus CC-1.
- **Alternatives:** A live probe of Claude Code (no credentials here).
- **Why dubious:** symbol attribution in minified code can be wrong.

### P2-DC-22: The deny-lists stay pinned to Claude Code 2.1.291

- **Phase / source:** Phase 2 research (researcher DC 9).
- **Severity:** Medium. **Status:** open.
- **Choice:** The built-in encoder reuses `expandClaudeValue` and its
  2.1.291 deny-lists unchanged; the re-pin to 2.1.318 is a parent line
  (unowned files).
- **Alternatives:** Diff and re-pin in this phase (needs unowned files).
- **Why dubious:** a credential 2.1.318 would blank could still reach a
  built-in server (same exposure as the adapter today).

### P2-DC-23: `description` read from the manifest at registration, or dropped

- **Phase / source:** Phase 2 research (open question 1); amends CONTEXT.
- **Severity:** Low. **Status:** open.
- **Choice:** A small read-only reader in the owned built-in files gives the
  description install would; if it is an unreviewable clone, built-in drops
  `description` and records the gap.
- **Alternatives:** A record field (frozen `state-io.ts`).
- **Why dubious:** a fourth manifest reader, or a lost tool-search hint.

## Pattern mapping step (gsd-pattern-mapper, 2026-11-04)

### P2-DC-24: The Phase 2 config probe loads through `usePiWithProfile` with explicit `extraExtensions`

- **Phase / source:** Phase 2 pattern map (mapper DC 1).
- **Severity:** Medium. **Status:** open.
- **Choice:** Scenarios that pin registered values start their Pi with
  `usePiWithProfile({ companions: [], extraExtensions: [probe] })`, as
  `listing.steps.ts` already does, rather than through the frozen launch list.
- **Alternatives:** A parent line adding the probe to `world.ts`'s launch;
  drop the value scenarios.
- **Why dubious:** that launch differs from the shared-profile launch, and the
  probe's default export adds one `fallow-ignore` `unused-export` marker.

### P2-DC-25: The registration sync takes an injected log callback

- **Phase / source:** Phase 2 pattern map (mapper DC 2).
- **Severity:** Low. **Status:** open.
- **Choice:** `syncBuiltinRegistrations` receives its debug log as a
  parameter, so its failure paths are tested without a log capture.
- **Alternatives:** Call `hookDebugLog` directly, as the rest of the module
  does.
- **Why dubious:** a parameter that exists only to observe logging.

### P2-DC-26: The synchronous `mcp.json` override reader lives in `bridges/mcp`

- **Phase / source:** Phase 2 pattern map (mapper DC 3).
- **Severity:** Low. **Status:** open.
- **Choice:** A new synchronous reader in the owned built-in bridge files
  serves `info`'s override stamp.
- **Alternatives:** `persistence/`; a synchronous variant in `adapter-doc.ts`.
- **Why dubious:** the extension's first synchronous file read; possible
  clone of `readMcpConfigDoc`.

## Planning step (gsd-planner, 2026-11-04)

### P2-DC-27: Tracer plan 02-01 is large (22 files, 3 tasks)

- **Phase / source:** Phase 2 planning.
- **Severity:** Medium. **Status:** open.
- **Choice:** Tracer plan 02-01 is large (22 files, 3 tasks).
- **Alternatives:** Split Wave 1 into encoding/translation and step/sync plans.
- **Why dubious:** Breaks the split-at-5-files guidance and risks executor context.

### P2-DC-28: Wave 2 runs six parallel plans, each running cucumber profiles

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** Wave 2 runs six parallel plans, each running cucumber profiles.
- **Alternatives:** 4-5 plans as the ROADMAP grouped them.
- **Why dubious:** Machine load can add flakes and timeouts.

### P2-DC-29: The `disabled` status is proven by driving Pi's TUI `/mcp` manager through a pseudo-terminal (02-04), with a unit-proof fallback

- **Phase / source:** Phase 2 planning.
- **Severity:** Medium. **Status:** open.
- **Choice:** The `disabled` status is proven by driving Pi's TUI `/mcp` manager through a pseudo-terminal (02-04), with a unit-proof fallback.
- **Alternatives:** Unit-only proof.
- **Why dubious:** The PTY-driven upstream UI is fragile.

### P2-DC-30: A synchronous `readFileSync` `mcp.json` reader, the extension's first (02-04)

- **Phase / source:** Phase 2 planning.
- **Severity:** Medium. **Status:** open.
- **Choice:** A synchronous `readFileSync` `mcp.json` reader, the extension's first (02-04).
- **Alternatives:** An async read plus a frozen-file change to the info call.
- **Why dubious:** Blocking I/O and a new pattern (see P2-DC-26).

### P2-DC-31: 02-04 edits one fixture line in the shared `test/orchestrators/plugin/info.test.ts`

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** 02-04 edits one fixture line in the shared `test/orchestrators/plugin/info.test.ts`.
- **Alternatives:** Leave the case failing and write a parent line.
- **Why dubious:** Merge-conflict risk with Phase 3.

### P2-DC-32: The adapter `pending approval` info scenario gets no built-in twin in `project-scope.feature`; `project not trusted` lives in `builtin-status.feature`

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** The adapter `pending approval` info scenario gets no built-in twin in `project-scope.feature`; `project not trusted` lives in `builtin-status.feature`.
- **Alternatives:** A twin depending on 02-04.
- **Why dubious:** Departs from the pair-in-one-file rule.

### P2-DC-33: The lifecycle Background install moves into 8 adapter scenarios to keep their strict form

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** The lifecycle Background install moves into 8 adapter scenarios to keep their strict form.
- **Alternatives:** A lenient Background.
- **Why dubious:** Duplication.

### P2-DC-34: A scenario pins that a server disabled in session stays registered until the next session (D-MB-10)

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** A scenario pins that a server disabled in session stays registered until the next session (D-MB-10).
- **Alternatives:** Do not pin it.
- **Why dubious:** MCPV2-01 may reverse it; Claude parity unverified.

### P2-DC-35: Only the autoapply-at-load scenario tells the resync apart, with a mutation red run

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** Only the autoapply-at-load scenario tells the resync apart, with a mutation red run.
- **Alternatives:** Unit-only proof.
- **Why dubious:** A single indirect witness.

### P2-DC-36: New polling `Then` steps for tool listings, because no Given may follow a When

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** New polling `Then` steps for tool listings, because no Given may follow a When.
- **Alternatives:** Change the frozen harness.
- **Why dubious:** A Then that waits.

### P2-DC-37: `pi reports no extension error` checks every record of the restarted Pi

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** `pi reports no extension error` checks every record of the restarted Pi.
- **Alternatives:** Filter MCP-related errors only.
- **Why dubious:** Unrelated errors fail it.

### P2-DC-38: MSEL-04 "no rewrite at load" is shown by an empty session report plus the adapter serving, not by a file check

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** MSEL-04 "no rewrite at load" is shown by an empty session report plus the adapter serving, not by a file check.
- **Alternatives:** Compare `mcp-adapter.json` bytes.
- **Why dubious:** Indirect, but scenarios must not read bridge files.

### P2-DC-39: MREC-02 is an `@mcp` listing scenario rather than a call pair

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** MREC-02 is an `@mcp` listing scenario rather than a call pair.
- **Alternatives:** Call twins.
- **Why dubious:** A weaker "reaches" claim.

### P2-DC-40: The docs citation check is an inline node one-liner in 02-08's verify, not a committed script

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** The docs citation check is an inline node one-liner in 02-08's verify, not a committed script.
- **Alternatives:** A committed script.
- **Why dubious:** Hard to read and edit.

### P2-DC-41: COVERAGE.md treats Pi's in-process MCP extension surface as an external API (26-row matrix)

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** COVERAGE.md treats Pi's in-process MCP extension surface as an external API (26-row matrix).
- **Alternatives:** Declare no external API, as Phase 1 did.
- **Why dubious:** Treats a host API as external.

### P2-DC-42: The decision-coverage gate is replaced by a manual audit (CONTEXT has no `D-NN` bullets)

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** The decision-coverage gate is replaced by a manual audit (CONTEXT has no `D-NN` bullets).
- **Alternatives:** Reformat CONTEXT.md.
- **Why dubious:** No machine gate.

### P2-DC-43: 02-08's gate tolerates one known failure: Phase 3's `companion-missing.feature:76` cell reads `not loaded` instead of `status unknown` once the built-in status reader lands

- **Phase / source:** Phase 2 planning.
- **Severity:** Medium. **Status:** open.
- **Choice:** 02-08's gate tolerates one known failure: Phase 3's `companion-missing.feature:76` cell reads `not loaded` instead of `status unknown` once the built-in status reader lands.
- **Alternatives:** The parent applies the one-cell fix first.
- **Why dubious:** The phase branch gate is not fully green.

### P2-DC-44: The adapter cucumber gate runs in 3 directory groups

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** The adapter cucumber gate runs in 3 directory groups.
- **Alternatives:** Finer splits.
- **Why dubious:** May exceed the 10-minute cap under load.

### P2-DC-45: Outcome-dependent plan branches: 02-03's bundle-scenario tag, 02-01's description-drop branch, 02-03's probe run in a Then

- **Phase / source:** Phase 2 planning.
- **Severity:** Low. **Status:** open.
- **Choice:** Outcome-dependent plan branches: 02-03's bundle-scenario tag, 02-01's description-drop branch, 02-03's probe run in a Then.
- **Alternatives:** Fix them at planning time.
- **Why dubious:** Executors decide.

## Plan revision step (gsd-planner revision 1, 2026-11-04)

### P2-DC-46: A same-name registration by another extension is a recorded gap

- **Phase / source:** Phase 2 plan revision (checker warning on 02-04).
- **Severity:** Medium. **Status:** open.
- **Choice:** When another extension registered `plugin_<plugin>_<server>`
  first, Pi refuses ours (debug log only) and `info`'s built-in row shows the
  other extension's server state. Documented in the docs, COVERAGE.md, and a
  BACKLOG parent line.
- **Alternatives:** Widen the frozen status-reader parameter (parent line); a
  module-level own-path cell set by the step; match on our own tool's
  `sourceInfo` (path not guaranteed to match).
- **Why dubious:** BLT-04 says "never silent"; this case is only debug-logged.

### P2-DC-47: Plan split shape: 02-01 keeps the calls step and one twin, 02-09 takes the rest of the listing lift

- **Phase / source:** Phase 2 plan revision.
- **Severity:** Low. **Status:** open.
- **Choice:** 02-01 still lists 22 files; the listing lift moves to new plan
  02-09 in Wave 2 (no renumbering, no new wave).
- **Alternatives:** The checker's split (a new wave for five plans);
  renumbering.
- **Why dubious:** 02-01 stays above the 15-file threshold, and plan numbers
  no longer follow wave order. P2-DC-28 now means seven Wave 2 plans and
  P2-DC-41's matrix has 27 rows.

### P2-DC-48: The 02-08 gate edits one cell of a Phase 3 file in the working tree and restores it

- **Phase / source:** Phase 2 plan revision.
- **Severity:** Low. **Status:** open.
- **Choice:** To prove the one tolerated failure, the gate command changes the
  `companion-missing.feature` cell to `not loaded`, reruns, and restores the
  file in the same command.
- **Alternatives:** Parse the assertion diff; read the output by hand.
- **Why dubious:** a temporary edit to a sibling's file; an interrupted call
  leaves it changed (the plan says how to restore it).

### P2-DC-49: The server-less `@mcp` listing scenario uses a control plugin

- **Phase / source:** Phase 2 plan revision.
- **Severity:** Low. **Status:** open.
- **Choice:** It drops the header-only tables so the scenario can fail against
  the seed.
- **Alternatives:** Keep the earlier shape with no red proof.
- **Why dubious:** departs from the earlier plan wording; no registry table.

### P2-DC-50: An extra reversed-precedence red run in 02-05

- **Phase / source:** Phase 2 plan revision.
- **Severity:** Low. **Status:** open.
- **Choice:** The trusted both-scope scenario gets a reversed-precedence red
  run, since forcing trust cannot change it.
- **Alternatives:** Seed red run only.
- **Why dubious:** one red run beyond the checker's hint.
