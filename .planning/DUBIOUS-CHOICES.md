# mcp-builtin: Dubious Choices Log

This log lists the choices made without the user during the mcp-builtin
milestone (`/gsd-autonomous`, started 2026-11-04). The run decided by this
project's conventions and by Claude Code upstream parity, and it did not stop
to ask. You and the user go through this log together when the run ends.

The parent session kept a working copy of this log in its scratchpad while the
run went on. Everything from `## Session-level choices` up to
`## Phase 6 (execution)` is that working copy, line for line. The last section
adds the Phase 6 entries that the working copy does not have.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until reviewed with the user.
- **IDs.** `S-NN` is a session-level choice. `P{N}-DC-NN` is a choice of
  phase N. `P6-PRE-NN` is a Phase 6 choice made before its discuss step.

Each phase keeps its full log. When an entry below is short, its phase log has
the full text:

- `.planning/milestones/mcp-builtin-phases/01-foundation-and-pi-1-5-0/DUBIOUS-CHOICES.md`
- `.planning/milestones/mcp-builtin-phases/02-built-in-materialization/DUBIOUS-CHOICES.md`
- `.planning/milestones/mcp-builtin-phases/03-read-time-verdicts/DUBIOUS-CHOICES.md`
- `.planning/milestones/mcp-builtin-phases/04-agent-grants/DUBIOUS-CHOICES.md`
- `.planning/milestones/mcp-builtin-phases/05-hook-tool-names/DUBIOUS-CHOICES.md`
- `.planning/milestones/mcp-builtin-phases/06-release-docs-and-combined-tree/DUBIOUS-CHOICES.md`

The log of the previous milestone is archived, unchanged, at
`.planning/milestones/component-features-DUBIOUS-CHOICES.md`.

## Review outcomes (user, 2026-11-06)

- **P1-DC-12:** kept. No `oauth.clientName`, so Pi keeps CIMD; D-MB-11 is Locked.
- **P1-DC-21:** accepted. Re-checked 2026-11-06: the three Pi 1.5.0 packages are published by GitHub Actions from `earendil-works/pi` with SLSA provenance, their lockfile integrity matches the registry, and none has an install script.
- **P1-DC-40:** kept, all six: CR-02 (`undefined` prefix above 55 characters), CR-01 (pin fields derived from `DisabledPin`), WR-02 (`compatibilityBasis` stays top-level), WR-01 (version-mismatch refusal), the jiti cache fix for the CI flake, and the adapter loaded in every adapter-profile shared Pi.
- **P2-DC-02:** kept. The extension resolves built-in values at registration; D-MB-14 is Locked.
- **P2-DC-08 / P2-DC-46 (D-MB-19, D-MB-29; 02-UAT check 1):** option 2. An `mcp.json` override stays reported by `info` and Pi's `/mcp` only (upstream reports a suppressed duplicate in `/plugin`). A registration Pi refuses because another extension owns the name gets a fix: the registration step remembers refused names for the session, and `info` shows `not loaded` for them instead of the other extension's state. No new message kind. **Follow-up fix, queued** (with a cucumber scenario that fails without it).

## Decisions waiting on you

The short list. Each line names the entry and the file with its full text.

### High

- **P1-DC-12** (High): D-MB-11 is reversed in part. Under built-in, neither
  `oauth.clientName` nor `clientRegistration` is written, so Pi keeps CIMD.
  Full text: `.planning/milestones/mcp-builtin-phases/01-foundation-and-pi-1-5-0/DUBIOUS-CHOICES.md`.
- **P1-DC-21** (High): the package legitimacy check ran unattended, with no
  human review. Full text:
  `.planning/milestones/mcp-builtin-phases/01-foundation-and-pi-1-5-0/DUBIOUS-CHOICES.md`.
- **P1-DC-40** (Medium to High; its code review item CR-02 is High): the CI
  flake fix, the code review findings, and the fix directions. CR-02: the
  built-in `toolNamePrefix` returns nothing when the prefix exceeds Pi's
  55-character cut. Full text:
  `.planning/milestones/mcp-builtin-phases/01-foundation-and-pi-1-5-0/DUBIOUS-CHOICES.md`.
- **P2-DC-02** (High): the built-in encoder expands every Claude variable
  itself at registration, so resolved secrets sit in Pi's session registry.
  Full text: `.planning/milestones/mcp-builtin-phases/02-built-in-materialization/DUBIOUS-CHOICES.md`.
- **P2-DC-08** (High): BLT-04 "reported, never silent" is met by `info` and
  Pi's `/mcp` only, with no load notice. Full text:
  `.planning/milestones/mcp-builtin-phases/02-built-in-materialization/DUBIOUS-CHOICES.md`.
- **P2-DC-100** (High): Phase 2's two human checks were accepted
  provisionally so the phase could move on. They are in `02-UAT.md` (see
  below). Full text:
  `.planning/milestones/mcp-builtin-phases/02-built-in-materialization/DUBIOUS-CHOICES.md`.
- **P3-DC-06** (High): `partially-installed` list rows gain
  `{unsupported mcp, requires <other>}`, a visible change to `list`. Full text:
  `.planning/milestones/mcp-builtin-phases/03-read-time-verdicts/DUBIOUS-CHOICES.md`.
- **P3-DC-07** (High): `info`'s `requires:` names the `mcp` marker also when
  it is satisfied, which changes adapter output. Full text:
  `.planning/milestones/mcp-builtin-phases/03-read-time-verdicts/DUBIOUS-CHOICES.md`.
- **P4-DC-06** (High in the working log, Medium in its phase log): agents
  installed before Phase 4 have no stored grant forms. The working log entry
  leaves them unrewritten at load (High). The phase log records the revised
  choice, a textual adapter-to-built-in translation at load (Medium). Full
  text: `.planning/milestones/mcp-builtin-phases/04-agent-grants/DUBIOUS-CHOICES.md`.
- **P4-DC-60** (High, carries P4-DC-13): autoupdate and apply convergence
  staged the adapter form under built-in until the next session rewrote it.
  Phase 6 repointed `updateAgentImplementation` (plan 06-02). Full text:
  `.planning/milestones/mcp-builtin-phases/04-agent-grants/DUBIOUS-CHOICES.md`.
- **P4-DC-76** (High): Phase 4's verification passed despite the
  cascade-update grant gap (P4-DC-13, P4-DC-60). Full text:
  `.planning/milestones/mcp-builtin-phases/04-agent-grants/DUBIOUS-CHOICES.md`.
- **P5-DC-03** (High): a hook matcher or `if` literal
  `mcp__<server>__<tool>` fires on a built-in tool when Pi's
  `createMcpToolName` gives the event's name, so Claude's full name fires.
  Full text: `.planning/milestones/mcp-builtin-phases/05-hook-tool-names/DUBIOUS-CHOICES.md`.

### Other decisions

Key Decisions rows of `.planning/PROJECT.md` that are settled but wait for your
review (`-- Pending`):

- **D-MB-08**: a plugin hook's matcher sees a built-in MCP tool with Claude's
  server segment.
- **D-MB-09**: a project-scope plugin's built-in servers register only when
  the project is trusted.
- **D-MB-10**: built-in servers are registered at `session_start` and again
  after the load reconcile.
- **D-MB-11**: under built-in, the extension writes neither
  `oauth.clientName` nor `clientRegistration` for a plugin server.
- **D-MB-12**: a pi-subagents background child that loads the extension
  writes no file.
- **D-MB-13**: the registered built-in server name is
  `plugin_<plugin>_<server>`, with unsafe characters replaced by `_`.
- **D-MB-14**: built-in values are resolved by the extension at registration,
  not written as `${VAR}` references.
- **D-MB-15**: under built-in, `${CLAUDE_PROJECT_DIR}` is the session `cwd`
  for both scopes.
- **D-MB-16**: no `cwd` is written for a built-in stdio server.
- **D-MB-17**: `timeout` converts with `ms / 1000` and no rounding.
- **D-MB-18**: with an untrusted project, a user-scope record of the same
  plugin registers.
- **D-MB-19**: `mcp.json` overrides and refused registrations are reported in
  `info` only, with no load notice.
- **D-MB-20**: the built-in status is inferred from Pi's tool list.
- **D-MB-21**: legacy `mcp.json` entries run once more under their old name in
  the first built-in session.
- **D-MB-22**: the containment root of a built-in registration is the
  marketplace root or the plugin clones directory.
- **D-MB-23**: the project record wins per server name, not per whole record.
- **D-MB-24**: an `mcp.json` entry with a string `command` or `url` counts as
  an override in `info`.
- **D-MB-25**: `callbackUrl` is written only when `callbackPort` is set.
- **D-MB-26**: Claude's stdio `cwd` rests on minified helper attribution.
- **D-MB-27**: the variable deny-lists stay pinned to Claude Code 2.1.291.
- **D-MB-28**: `description` is read from the manifest at registration, or
  dropped.
- **D-MB-29**: a same-name registration by another extension is a recorded
  gap.
- **D-P3-01** and **D-P3-02**: the stored MCP compatibility is the
  implementation-neutral verdict.
- **D-P3-06**, **D-P3-07**, and **D-P3-08**: the MCP marker table and
  `info`'s `requires:` naming.
- **D-P3-11** and **D-P3-13**: `--partial` consent follows the active
  implementation for user-run installs, and record-driven sites read the
  neutral view.
- **D-P3-12**: a plain user-run `update` keeps today's consent rules, and a
  dependency move asks only for a new degrade.
- **D-P5-01**, **D-P5-02**, and **D-P5-03**: the hook-facing name of a
  built-in MCP tool.
- **D-P5-04**: built-in MCP matching.
- **D-P5-06** and **D-P5-07**: the proxy rule scope (MHK-02).

Follow-ups that need you:

- The two manual checks in
  `.planning/milestones/mcp-builtin-phases/02-built-in-materialization/02-UAT.md` (P2-DC-100): accept
  BLT-04's "reported, never silent" as `info` plus `/mcp`, and run `/reload`
  and `/new` in a real Pi with built-in MCP.
- The version bump and the pull request offer (D-P6-17). AGENTS.md asks to
  offer the bump before the pull request is created.
- Done (e685108): the D-CF1-16 row in `.planning/PROJECT.md` records CI run
  41960058038 on the combined tree (every leg under 5 minutes; the
  15-minute timeout stays). Shown here only so the decision row can be
  reviewed with the rest.

## Session-level choices

### S-01 (Low, open): which branch the parent session works on

- **Chosen:** the parent works on the milestone branch `features/mcp-builtin`
  (already checked out at session start, 10 planning commits ahead of `main`)
  and pushes it, as ROADMAP "Parallelism" and "Merge procedure" require. The
  harness-designated branch `claude/lucid-pasteur-df51ms` (at `main`, no
  commits of its own) is fast-forwarded to the same commits and pushed as a
  mirror, so the harness rule "push to the designated branch" also holds.
- **Alternatives:** (a) work only on `claude/lucid-pasteur-df51ms` and make it
  the milestone branch, which breaks every `features/mcp-builtin` reference in
  ROADMAP.md and CHILD-SESSION-BRIEF.md; (b) push only `features/mcp-builtin`.
- **Why questionable:** the harness says to push only the designated branch
  without explicit permission. AGENTS.md grants it: "In a Claude Code cloud
  session, you may push to origin a `features/<name>` branch other than the
  session's designated branch when concurrent cloud sessions work on it", and
  the Phase 2-5 child sessions are exactly that case.

### S-02 (Low, open): phase discovery ignores the `init.manager` status

- **Observed:** `gsd_run query init.manager` reports all six mcp-builtin phases
  as `disk_status: executed`, `has_context: true`, `verification_status:
  stale`, although `.planning/phases/` does not exist. It most likely matches
  phase numbers 1-6 to archived phase directories of earlier milestones (the
  known "phase numbers repeat across milestones" snag).
- **Chosen:** treat `init.phase-op <N>` as authoritative (it reports
  `has_context: false`, `has_plans: false`, `phase_dir: null` for Phase 1) and
  run every phase from discuss.
- **Why questionable:** a GSD tooling defect worth a backlog line; it does not
  change the product.

### S-03 (Low, open): the autonomous UI step (3a.5) was skipped for Phase 1

- **Observed:** `gsd_run check ui-plan-gate 1` answered `frontend: true` only
  because the goal text contains the word "form" ("its Claude form");
  `hasFrontendEvidence` is false. The only `plan:pre` step hook with a skill is
  `ai-integration-phase` (`workflow.ai_integration_phase: true`); `ui_phase` is
  off.
- **Chosen:** skip 3a.5. Phase 1 has no frontend and builds no AI system, so
  dispatching `gsd-ai-integration-phase` from the UI step would be a mis-route.
  plan-phase still runs its own `plan:pre` hooks.
- **Why questionable:** it departs from the literal autonomous workflow text
  on the strength of a false-positive token match.

## Phase 1: Foundation and Pi 1.5.0

Durable copy: `.planning/milestones/mcp-builtin-phases/01-foundation-and-pi-1-5-0/DUBIOUS-CHOICES.md`.

### Discuss step (parent session, 2026-11-04)

#### P1-DC-01: Discuss decisions settled without the user

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

#### P1-DC-02: Stored compatibility stays the adapter's verdict; a neutral mark is frozen now

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

#### P1-DC-03: The run's shared Pi loads pi-mcp-adapter under the adapter profile

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

#### P1-DC-04: Profile layout and the `@own-implementation` tag

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

#### P1-DC-05: The built-in stand-in registers through Pi's API, and defers to an existing name

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

#### P1-DC-06: The built-in OAuth client is named "Claude Code (plugin:<plugin>:<server>)"

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

#### P1-DC-07: `mcp` and `builtin mcp` join the `requires:` companion names

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

#### P1-DC-08: A restart step turns built-in MCP on by editing the sandbox settings

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** the frozen restart steps include "turn Pi's built-in MCP on",
  which removes `-builtin:mcp` from the sandbox user settings, as the user
  would, before Pi restarts. The DUAL-04 switch needs it.
- **Alternatives:** none that reaches DUAL-04's "after built-in MCP is on".
- **Why dubious:** the harness edits a Pi settings file that D-MB-01 forbids
  the extension to edit; the step acts as the user, not as the extension.
- **Recorded in:** `01-CONTEXT.md` "Dual-profile cucumber harness".

#### P1-DC-09: A third extension that replaces `/mcp` reads as `none`

- **Phase / source:** Phase 1 discuss; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** only `/mcp-adapter` (adapter) or an `mcp` command from
  `builtin:mcp` (built-in) count; another `/mcp` provider reads as `none`.
- **Alternatives:** treat any `/mcp` command as built-in.
- **Why dubious:** a user with another MCP extension sees `{requires mcp}`
  although an MCP client is loaded. Registering into a connector the extension
  cannot identify could raise the extension error MSEL-03 forbids.
- **Recorded in:** `01-CONTEXT.md` "Active implementation snapshot".

#### P1-DC-10: The registered built-in name keeps `-`; only tool names fold and get cut

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

#### P1-DC-11: A Pi's implementation is proven by a harness probe, not by product output

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

### Research step (gsd-phase-researcher, 2026-11-04; adopted by the parent)

#### P1-DC-12: D-MB-11 reversed in part: no `clientName`, so Pi keeps CIMD

- **Phase / source:** Phase 1 research; parent decision.
- **Severity:** High. **Status:** open.
- **Choice:** write neither `oauth.clientName` nor `clientRegistration` under
  built-in. Pi 1.5.0 turns CIMD off whenever `clientName` is set
  (`dist/extensions/mcp/oauth.js` `offersClientMetadataDocument`), so a set
  name would force DCR for every server. Unset, Pi follows Claude Code's
  protocol (CIMD when supported, else DCR) but names itself pi.
- **Alternatives:** keep the original D-MB-11: DCR always, with the name
  "Claude Code (plugin:<plugin>:<server>)".
- **Why dubious:** parity cannot hold both the flow and the name; this picks
  the flow and records the name as a Pi-gap divergence. Supersedes P1-DC-06.
- **Recorded in:** `01-CONTEXT.md` "Amendments after research".

#### P1-DC-13: The adapter-profile shared Pi gets seeded onboarding state

- **Phase / source:** Phase 1 research (measured); parent decision.
- **Severity:** Medium. **Status:** open.
- **Choice:** each reset writes `mcp-onboarding.json` with
  `piBuiltinMcpHandledVersion` so pi-mcp-adapter does not rewrite the sandbox
  settings every session (without it: 66 failures, `EEXIST`, reset timeouts).
  `@own-implementation` scenarios that need the real first-run write remove
  the seed.
- **Alternatives:** keep the shared Pi companion-free; give the adapter its own
  agent directory.
- **Why dubious:** the seed hides the adapter's real first-run behavior in
  every shared-Pi scenario.
- **Recorded in:** `01-CONTEXT.md` amendments; RESEARCH Harness section.

#### P1-DC-14: Each Pi is checked against its own launch configuration

- **Phase / source:** Phase 1 research; parent decision.
- **Severity:** Medium. **Status:** open.
- **Choice:** the implementation probe compares each Pi with what its launch
  implies (the profile for the shared Pi and "MCP implementation" Pis), not
  with the profile for every Pi. Amends P1-DC-11's scope.
- **Alternatives:** check every Pi against the profile, which fails today's
  non-MCP profile Pis and every restart scenario.
- **Why dubious:** a Pi started with a fixed companion list is not held to the
  profile.
- **Recorded in:** `01-CONTEXT.md` amendments.

#### P1-DC-15: `companion-missing.feature` runs `@builtin-only` in Phase 1

- **Phase / source:** Phase 1 research; parent decision.
- **Severity:** Medium. **Status:** open.
- **Choice:** the feature names pi-mcp-adapter and passes only where the shared
  Pi has no adapter, so it is `@builtin-only` until Phase 3 rewrites it.
- **Alternatives:** turn the scenarios into `@own-implementation` profile-Pi
  scenarios now.
- **Why dubious:** an adapter-named feature runs only under the builtin
  profile for a while.
- **Recorded in:** `01-CONTEXT.md` amendments.

#### P1-DC-16: The 9 `{requires pi-mcp-adapter}` rows move to one Phase 3 file as tag pairs

- **Phase / source:** Phase 1 research; parent decision.
- **Severity:** Medium. **Status:** open.
- **Choice:** move them into one new Phase 3 feature file as
  `@adapter-only`/`@builtin-only` pairs (the builtin twin keeps today's marker
  row, the adapter twin drops it).
- **Alternatives:** leave them in `features/plugin/*` and
  `features/marketplace/update.feature` with pairs, since Phase 3 owns the rows
  by function.
- **Why dubious:** the moved scenarios also pin warnings and notices that are
  not about MCP.
- **Recorded in:** `01-CONTEXT.md` amendments.

#### P1-DC-17: Phase 1 edits `update-preflight.ts`, a Phase 3 file

- **Phase / source:** Phase 1 research; parent decision.
- **Severity:** Medium. **Status:** open.
- **Choice:** Phase 1 edits `refreshDisabledRecord` and its projection, the
  disabled-plugin update write the ROADMAP missed; Phase 3 keeps the rest.
- **Alternatives:** leave it to Phase 3 (then a disabled update records the old
  version's servers until Phase 3).
- **Why dubious:** it departs from the ownership table.
- **Recorded in:** `01-CONTEXT.md` amendments.

#### P1-DC-18: New fields `compatibilityBasis?: "neutral"` and `mcpBundle?: true`

- **Phase / source:** Phase 1 research; parent decision.
- **Severity:** Medium. **Status:** open.
- **Choice:** the neutral mark P1-DC-02 asked for, plus a bundle flag so a
  `.mcpb`/`.dxt` block survives the read for legacy records.
- **Why dubious:** two record fields for bookkeeping; a development-build record
  with a bundle and an adapter-blocked server stays ambiguous (the rule keeps
  the block).
- **Recorded in:** `01-CONTEXT.md` amendments.

#### P1-DC-19: Smaller research choices

- **Severity:** Low. **Status:** open.
- The "no absolute path" test covers only `mcpServerConfigs` values;
  `resolvedSource` already stores the plugin root.
- Frozen exports a later phase uses go under `ignoreExports` in
  `.fallowrc.json`, not source markers; Phase 6 removes them.
- Tag rules live in `scripts/check-features.mjs`, not a `test/architecture`
  file (ROADMAP called it "the profile-tag architecture test").
- Tag reasons cite requirement or decision IDs, not phase numbers.
- The Pi 1.5.0 packages, flagged `[SUS]` by the package check only for their
  age (two days, no download data), are accepted: no postinstall, same repo.
- The record producer moves from W2 to W3 (seven test files overlap the
  snapshot plan).
- The frozen status call passes `{ reader, implementation }` to
  `withMcpServerStatus` so Phase 2 needs no frozen-file edit.
- **Recorded in:** `01-RESEARCH.md`.

### Pattern mapping step (gsd-pattern-mapper, 2026-11-04)

#### P1-DC-20: Pattern-map choices

- **Severity:** Low to Medium. **Status:** open.
- (Low) The built-in stand-in extension carries a source
  `fallow-ignore-next-line unused-export` marker, like the registry probe,
  not an `ignoreExports` entry; the CONVENTIONS.md marker count changes.
- (Low) `info.ts` uses the built-in status reader only under `builtin`, and
  the adapter reader under both `adapter` and `none` (follows CONTEXT); a
  dedicated reader for `none` is the alternative.
- (Medium) `ActiveMcpImplementation` and `McpImplementationId` must live in
  `platform/` or `shared/` and be re-exported from `domain/`, because
  `platform/` may not import `domain/`; the planner picks the home.
- **Recorded in:** `01-PATTERNS.md`.

### Planning step (gsd-planner, 2026-11-04)

#### P1-DC-21: Package legitimacy check runs unattended

- **Severity:** High. **Status:** open.
- The three Pi 1.5.0 packages flagged `[SUS]` (age only) are installed after
  an automated `npm view` comparison with 1.4.0 (repository, maintainers,
  scripts, integrity), not a blocking human checkpoint. The planner protocol
  says legitimacy checkpoints are never auto-approved; the unattended run
  overrides it.
- **Recorded in:** `01-01-PLAN.md`.

#### P1-DC-22: Plan shape and frozen-interface width

- **Severity:** Medium. **Status:** open.
- (Low) 14 plans in 5 waves, not the ROADMAP's 9 in 4: same-wave plans must
  own disjoint files.
- (Medium) `McpImplementationId`, `ActiveMcpImplementation`, and
  `PiMcpRegistry` live in `platform/pi-api.ts` (01-03, wave 1);
  `domain/mcp-implementation.ts` re-exports them. A 1.5.0 type break in
  `pi-api.ts` would land in 01-05, not 01-01.
- (Medium) Frozen interfaces are wider than ROADMAP: `agentGrantsStep` takes
  `{pi, ctx, snapshot}`; `McpStatusLookup` carries `projectTrusted` and
  `cwd`; `McpImplementationProfile` adds `toolName(plugin, server, tool)`.
- (Medium) All three D-CF6-10 agent scenarios move to `agent-grants.feature`
  and `invocation.steps.ts` is renamed to `agent-grants.steps.ts`; Phase 2
  recreates the `mcp-server/invocation` step module.
- (Medium) Unreached frozen exports go under fallow `entry` plus per-file
  `ignoreExports` (no source markers); Phase 6 removes them (parent line).
- (Medium) If 01-14 runs in a worktree, its push lands the gate commit on
  remote `features/mcp-builtin` before the local worktree merge.
- (Low) New Phase-1 files and steps: `implementation-profiles.feature`,
  `verdict-markers.feature`, the neutral `the user has run {string}, which
  did not fail`, the built-in-off step, `pi lists these registered mcp
  servers:`.
- (Low) 01-14 also edits the PROJECT.md D-CF1-16 row and the fallow-entry
  sentences in `.planning/codebase/{CONVENTIONS,STACK,ARCHITECTURE}.md`.
- (Low) Smaller rules: malformed recorded config falls back to the stored
  verdict; the scanner reports `sse` before field features; the
  update-in-progress note literal is a private domain constant (TR-04); a
  tag reason may cite an ID in title or description; the probe in 01-13
  calls the product's `softDepStatus`, so harness code imports product
  code; the closed-set commit maps to MDEC-01.
- (Medium/Low) One-way doors settled without a checkpoint: built-in names
  and the profile interface (01-03), the closed-set entries (01-04), the
  `state.json` fields (01-08). "Costly" ratings are flagged only.
- (Low) Orchestrator: the CONTEXT.md amendment bullet was reworded to
  `**D-MB-11 (amended, reversed in part):**` so the decision-coverage gate
  parses it (7/7 covered).
- **Recorded in:** the 01-01..01-14 plans.

### Plan check step (gsd-plan-checker + orchestrator, 2026-11-04)

#### P1-DC-23: Plan-check revisions and accepted warnings

- **Severity:** Medium. **Status:** open.
- (Medium) CI measurement for DUAL-03 moved from the 01-14 executor to the
  parent session: executors have no GitHub tools here (`gh` is search-only).
  01-14 now writes `01-CI-HANDOFF.md`; the parent pushes after the merge,
  dispatches `ci.yml`, and amends the D-CF1-16 row and `01-FROZEN.md`. This
  also removes P1-DC-22's worktree-push concern.
- (Low) Fixed by the orchestrator, not a planner revision: 01-01's version
  grep now exits non-zero on failure; 01-08 gains reinstall and import cases
  in the integration test.
- (Low) Accepted without a split: 01-05 (29 files in one task), 01-08 (33),
  01-11 (25) exceed the checker's 15-file budget; the bulk is mechanical
  typecheck-driven literal edits.
- (Low) Accepted: 01-06 adds one probe per `session_start` (a second
  notification run); Phase 2 may reuse the load run's snapshot.
- (Medium, checker) The checker did not re-measure research inventories
  (47/49 failing adapter scenarios, 9 marker rows); a wrong count would show
  as red scenarios during execution.
- **Recorded in:** `01-01-PLAN.md`, `01-08-PLAN.md`, `01-14-PLAN.md`.

### Execution step, orchestrator (2026-11-04)

#### P1-DC-24: Executor prompts list the GSD contract files instead of inlining them

- **Severity:** Low. **Status:** open.
- execute-phase asks the orchestrator to inline `execute-plan.md`,
  `summary.md`, `checkpoints.md`, `tdd.md`, `worktree-path-safety.md`, and
  `executor-examples.md` verbatim (about 148 KB) into every executor prompt.
  The prompts instead tell each executor to Read those absolute paths first.
  The rule exists because `@` includes do not expand; an explicit Read
  instruction reaches the executor the same way, at a fraction of the
  orchestrator's context.
- Executors also get: `npm ci` in each worktree (no shared node_modules),
  the nondac-sh wrapper, foreground-only commands, and a required
  `<worktree_metadata>` block plus `## Dubious Choices` in the final report.
- The research step's leftover probe worktree (detached at 4908728, holding
  uncommitted experimental 1.5.0 lock changes in the old scratchpad) was
  force-removed before wave 1; 01-01 redoes the raise.
- **Recorded in:** this log only.

#### P1-DC-25: Plan 01-02 executor choices (decision records, cucumber contract)

- **Severity:** Low. **Status:** open.
- D-MB-08..13 rows carry outcome `-- Pending` (user review), provenance
  naming their P1-DC entry; D-MB-11 written in its amended form.
- Rationale text for D-MB-01..07 was written by the executor (REQUIREMENTS
  gives none), e.g. D-MB-06 "A switch is not a plugin action...".
- Kept the durable part of the cucumber skill's "Component features" section
  under a new "Function directories" heading instead of deleting it.
- Added a step-text rule (a phase's step names its topic, D-08) not in the
  ROADMAP ownership text.
- The contract text names details from later plans (01-07, 01-10) and
  RESEARCH: `mcpImplementationLaunch(profile)`, the stub-exit reset check,
  the stand-in loading last, both settings files for the off check.
- Reserved names split by owner: `verdict-markers.feature` to Phase 3,
  `agent-grants.*` to Phase 4.
- Fixed three existing skill lines that contradicted the new contract.
- **Recorded in:** `01-02-SUMMARY.md`.

#### P1-DC-26: Plan 01-04 executor choices (closed-set entries)

- **Severity:** Low. **Status:** open.
- The closed-set commit touches a ninth file,
  `test/shared/notification-types.test.ts`, whose exact-type lock fails
  typecheck without the two new reasons.
- Comment wording for `overridden by mcp.json` and `project not trusted`
  was inferred from BLT-05; Phase 2 may adjust it.
- New members appended at the end of the `docs/json-output.md` lists (the
  existing list is not in declaration order).
- No `windows append --kind deviation` entry for the ninth file (it would
  block ship while open, and nothing is unresolved).
- **Recorded in:** `01-04-SUMMARY.md`.

#### P1-DC-27: Plan 01-01 executor choices (Pi 1.5.0 raise)

- **Severity:** Medium. **Status:** open.
- (Medium) The automated legitimacy check (P1-DC-21) passed: same
  repository and maintainers as 1.4.0, no install scripts, integrity
  strings recorded. The packages are two days old.
- (Low) New transitive packages (`@earendil-works/pi-schema` 1.5.0,
  `@isaacs/nonrecursive-glob-match` 1.0.3, nested `minimatch` 11.0.3) were
  checked only for install scripts and against research's lock diff, not
  audited maintainer by maintainer.
- (Low) `docs/mcp-compatibility.md` line 9 reworded to "a run of Pi 1.4.0
  and pi-mcp-adapter 7.0.0" so the dated run stays correct.
- (Low) `docs/hooks-compatibility.md` gained "and then its hooks do not
  run" after the "Do not trust" sentence (no scenario covers it).
- (Low) CHANGELOG bullet has no PR number yet; the PR author appends it.
- (Low) The gate ran in parts on one commit, reusing the pre-commit
  `check:static` result.
- **Recorded in:** `01-01-SUMMARY.md`.

#### P1-DC-28: Plan 01-03 executor choices (domain seam) and an orchestrator fix

- **Severity:** Medium. **Status:** open.
- (Medium) No RED-only commits for the TDD plan: the commit hook runs the
  staged pairs' tests and refused a failing RED commit; `--no-verify` and
  `test.skip` are forbidden. RED evidence is recorded in the SUMMARY. The
  end-of-phase TDD review will flag the plan.
- (Low) Commit scope `mcp`, not the plan ID (project rule), so the GSD TDD
  gate greps find nothing.
- (Low) A stored `false` turns `true` only when `unsupported` is non-empty
  and holds only `mcpServers` (the plan's wording was vacuously true for
  `[]`).
- (Medium, fixed by the orchestrator) The adapter profile's `toolName` was
  `prefix + tool`. pi-mcp-adapter 7.0.0 `formatToolName` (toolPrefix "mcp")
  turns `.` into `_` and does not re-prefix a name that already carries the
  prefix. Commit 3def844 matches the adapter, with three test rows. The
  adapter's deferred surface (`mcp__<ns>__<tool>`, sanitized, 64-char cut)
  is a different surface the extension does not configure.
- (Low) The built-in `grantSelector` `mcp:<registered name>` is unverified
  against pi-subagents' grant syntax for Pi built-in servers; Phase 4 uses
  it.
- (Low) `McpServerShape` carries full TypeBox static types; the built-in
  tool prefix reuses `foldedMcpServerKey`; `PiMcpRegistry` uses method
  signatures like the rest of `pi-api.ts`.
- **Recorded in:** `01-03-SUMMARY.md`, commit 3def844.

#### P1-DC-29: Plan 01-05 executor choices (snapshot field)

- **Severity:** Low to Medium. **Status:** open.
- (Medium) No RED-only commit (hook typecheck refused it); RED evidence in
  the SUMMARY, as in P1-DC-28.
- (Low) A throwing `getCommands()` reads as an empty list (plan said
  undefined); same result.
- (Low) The old probe read order is kept, because
  `test/edge/command-run.test.ts` pins it.
- (Low) Partial test helpers default `mcpImplementation` to `none`; every
  caller that sets `piMcpAdapterLoaded: true` now also sets `adapter`.
- (Low) The whole `test:modules` was not re-run after the read-order fix;
  the hook's all-pairs direct coverage ran every paired test.
- (Low) Title `ADET-01 does not count Pi's built-in MCP alone` kept while it
  now expects `mcpImplementation: "builtin"`.
- (Low) The commit ran in background mode once (all-pairs coverage).
- **Recorded in:** `01-05-SUMMARY.md`.

#### P1-DC-30: Plan 01-06 executor choices (session steps)

- **Severity:** Medium. **Status:** open.
- (Medium) `materializeMcpSession` is composed in `index.ts` from
  `createMcpSessionMaterializer`, not exported from
  `session-materialize.ts`: fallow fails an export only tests use, and
  `ignoreExports` is for exports a later phase consumes.
- (Low-Medium) A mode check runs before the session steps at
  `session_start` (not asked for; every other mutating stage checks it, and
  `session-materialize.ts` is frozen).
- (Low-Medium) The resync's mode check sits inside its own try/catch, so a
  mode failure skips only the resync (and the catch is reachable for
  coverage).
- (Low) No RED-only commit (P1-DC-28 precedent).
- (Medium, follow-up) The existing test `AAP-03 / NFR-2: an autoapply load
  whose apply throws ...` in `test/index.test.ts` states too few mode reads
  and UI emissions; a strong-mock miss silently skips later stages (now the
  PATH stage and the resync). Its assertions still hold. Left for the code
  review step.
- (Low) The architecture test casts its Proxy fakes once; the session_start
  read is asserted as "at least one".
- **Recorded in:** `01-06-SUMMARY.md`.

#### P1-DC-31: Plan 01-07 executor choices (cucumber profiles)

- **Severity:** Medium. **Status:** open.
- (Medium) CI still runs `npm run test:cucumber -- $SHARD_PATHS`; with the
  two-profile chain the paths reach only the builtin run, so each shard runs
  the whole adapter suite until plan 01-13 switches CI to
  `test:cucumber:profile`.
- (Low) Files outside the plan: `test/e2e/adapter-detection-rpc.test.ts`
  (projects `ListedCommand.source`), `features/lib/turn-records.ts`
  (exports `isRunning` for reuse), `.fallowrc.json` (`ignoreExports` for
  three lib exports 01-09 uses).
- (Low) `adapterOnboardingSeedText` is not exported though the plan lists it.
- (Low) Every restart waits for the adapter's onboarding write when the
  stopped Pi loaded the adapter (contract names it for `without-adapter`
  only).
- (Low) `readBuiltinTurnedOff` reads project settings regardless of trust
  (Pi 1.5.0 ignores untrusted project settings).
- (Low) The run-root check repeats the `pi-cm-features-` mkdtemp prefix.
- (Low) Seeds repeat their Givens instead of a Background; the
  `@own-implementation` flag is set by a tagged Before hook; the settings-off
  release removes `{agent dir}/settings.json`; the seed is compact JSON.
- **Recorded in:** `01-07-SUMMARY.md`.

#### P1-DC-32: Plan 01-10 executor choices (stand-in and remaining steps)

- **Severity:** Low. **Status:** open.
- The stand-in's server list lives at `<home>/builtin-mcp-stand-in.json`
  (the plan said the harness dir, which exists only after the Pi starts).
- `features/support/world.ts` gained a read-only `profilePiStarted` getter
  (outside the plan's files).
- The builtin wait derives the namespace from `path.basename` of the stub's
  plugin argument.
- The adapter wait and the neutral wait share one function; the adapter
  wait's failure text changed to "the adapter mcp implementation did not
  finish listing ...".
- The builtin seed pins that Pi 1.5.0 lists a deferred tool, inactive,
  before any search (measured).
- Seeds install at user scope; a project-scope adapter server needs an
  adapter-only step.
- An unrelated http MCP scenario in `configuration.feature` flaked once
  (OAuth probe error) and passed on rerun; recorded only in the SUMMARY.
- **Recorded in:** `01-10-SUMMARY.md`.

#### P1-DC-33: Plan 01-09 executor choices (profile-following shared Pi, tags, moves)

- **Severity:** Medium. **Status:** open.
- (Medium) Added `the user has run {string}, which did not fail` to
  `command.steps.ts`, which plan 01-10 also added; the orchestrator keeps
  one definition at merge.
- (Low) Three `configuration.feature` installs now accept any non-error
  result (they used to prove a notice appeared).
- (Low) The `.fallowrc.json` `ignoreExports` entry for the seed and stub-pid
  helpers stays although `pi-process.ts` now uses them; Phase 6 removes it.
- (Low) The onboarding seed is also written in `BeforeAll`; the shared Pi
  uses `TMPDIR=<run root>/shared-pi-tmp` with its own jiti cache;
  `BeforeAll` has its own 90 s timeout.
- (Low) The stub-exit check runs only under the builtin profile.
- (Low) Tag-reason sentences make some feature descriptions four or five
  lines; reason IDs follow the plan (configuration and sources cite BLT-02).
- (Low) The moved `apply` pair inlines an unused four-plugin Background;
  builtin twins copy rows verbatim; twin titles end ", under Pi's built-in
  MCP" / ", under pi-mcp-adapter".
- **Recorded in:** `01-09-SUMMARY.md`.

#### P1-DC-34: Plan 01-08 executor choices (record producer)

- **Severity:** Low to Medium. **Status:** open.
- (Medium) No RED-only commits (P1-DC-28 precedent); RED evidence captured
  by reverting sources temporarily.
- (Low) New export `mcpServerConfigsOf` in the frozen
  `persistence/state-io.ts` (the record's own conversion; has production
  users).
- (Low) `compatibilityBasis` sits at the record's top level (RESEARCH
  Pattern 3 and 01-03's `StoredMcpCompatibility`), not inside
  `compatibility` as the CONTEXT amendment's wording suggests.
- (Low) `disabledPinProjection` now takes a `Pick` of the record, changing
  one call line in `disabledRefreshWouldWrite`.
- (Low) An old disabled record without `mcpServerConfigs` is rewritten on
  its next update (bumps `updatedAt`); key order inside a config counts as a
  change for a disabled plugin (`JSON.stringify` comparison).
- (Low) The import integration case declares the marketplace through
  `extraKnownMarketplaces`; five whole-record test files outside the plan
  gained `mcpServerConfigs: []`.
- **Recorded in:** `01-08-SUMMARY.md`.
- (Orchestrator) At the wave-3 merge both copies of the step landed in
  `command.steps.ts`; commit e4f64ba keeps 01-10's copy (shared `runSetup`,
  `["info", "warning"]`) and drops 01-09's "no error" copy.

#### P1-DC-35: Plan 01-12 executor choices (recorded servers)

- **Severity:** Low to Medium. **Status:** open.
- (Medium) No RED-only commits (P1-DC-28 precedent).
- (Low) Added a typed `LegacyServersUnreadableError` (reasons
  `not-in-manifest`, `unavailable`, `root-mismatch`) in
  `recorded-servers.ts`, not `shared/errors.ts`.
- (Low) A legacy git record without `resolvedSha` passes `resolvedSha: ""`
  in the synthetic materialized result (the resolver reads only the root).
- (Low) `LegacyServersSource.marketplace` is a `Pick` of the marketplace
  record; the root check is strict string equality with `resolvedSource`
  (a moved marketplace reads as `unreadable`).
- (Low) `.fallowrc.json`: one `entry` line and a seven-name `ignoreExports`
  block for this module.
- **Recorded in:** `01-12-SUMMARY.md`.

#### P1-DC-36: Plan 01-13 executor choices (tag rules, CI profile axis)

- **Severity:** Medium. **Status:** open.
- (Medium) CI behavioral job names changed to `behavioral tests, <profile>
  <shard> (Node 24)`. A branch protection rule naming the old checks would
  wait forever; check required status checks before the PR merges.
- (Low) The builtin leg's shard is named `all`.
- (Low) The MCP-scenario match is the word `\bmcp\b` (case-insensitive), so
  a bare tool name like `mcp__plugin_demo_stub__echo` does not count.
- (Low) The tag-reason rule accepts any ID-shaped word and does not check
  that the ID exists.
- (Low) "A non-MCP scenario carries no implementation tag" (features.md) is
  not gated; no scenario violates it today.
- (Low) `classifyMcpImplementation` passes no `sourceInfo.source` (the RPC
  `ListedCommand` lacks it); the command-name arm decides in the harness.
- (Low) The skill's layout table now differs from ROADMAP's ownership table
  in two cells (the `invocation` step module rename and agent-grants).
- (Low) The @mcp inventory found exactly research's 25 scenarios; all pass
  under builtin, so nothing moved to `verdict-markers.feature`.
- **Recorded in:** `01-13-SUMMARY.md`.

#### P1-DC-37: Plan 01-11 executor choices (status readers)

- **Severity:** Medium. **Status:** open.
- (Medium) One code commit for two tasks: the hook type-checks the whole
  tree, so Task 2's caller updates went into Task 1's commit.
- (Medium) No RED-only commit (P1-DC-28 precedent).
- (Low) The info handler test proves the `isProjectTrusted()` read through
  the strict mock; a constant `true` would not fail it (no visible effect
  yet).
- (Low) `noStatusReaders()` uses two adapter-style trackers, not the
  built-in seed; a new `@ts-expect-error` pin rejects a single reader as
  `mcpStatus`.
- (Low) One adapter cucumber step timed out (30 s, marketplace add, under
  load) and passed on a targeted rerun; `test/integration/
  mcp-status-conformance.test.ts` edited outside the plan (direct caller).
- **Recorded in:** `01-11-SUMMARY.md`.

#### P1-DC-38: Plan 01-14 executor choices (phase gate, frozen record)

- **Severity:** Low to Medium. **Status:** open.
- (Medium) `01-FROZEN.md` wins over the ROADMAP text where they differ
  (the code is what children import; each difference cites a P1-DC entry).
- (Low) The gate ran on the base commit f3ab832 (no fix needed); the
  cucumber part ran as the three CI legs (10-minute tool cap); the adapter
  total 1558 matches.
- (Low) `behavioral-shard-coverage.test.ts` is listed as frozen; the brief's
  frozen list gains `edge/handlers/plugin/info.ts` (ROADMAP freezes it).
- (Low) CONVENTIONS.md counts 44 `fallow-ignore` markers, now including
  `features/`.
- (Low) The CI handoff proposes the full amended D-CF1-16 text; if the
  timeout must rise, the parent edits the frozen `ci.yml` before children
  start.
- (Low) No WINDOWS.md entry and no requirements marking (DUAL-03 waits on
  the parent's CI run).
- **Recorded in:** `01-14-SUMMARY.md`.

#### P1-DC-39: Validation and security audits

- **Severity:** Low to Medium. **Status:** open.
- (Low) Nyquist: one gap fixed (commit 7fb00f3): the AAP-03 autoapply-abort
  test now asserts the read-only fallback's second notification and exact
  mode reads (P1-DC-30). PI15-03 was marked green from per-suite runs.
- (Medium) Security: UF-1 reported as an advisory finding instead of opening
  T-01-27: the legacy reader trusts the recorded `resolvedSource` for git and
  tag-pinned records, so nothing re-checks it against its clone root
  (NFR-10). Unreachable in Phase 1; Phase 2 adds the containment check when
  it wires the reader in (parent line for the Phase 2 child).
- (Low) Accept-disposition threats were closed from the plan registers; the
  auditor re-ran `npm view` for the Pi 1.5.0 trio over the network.
- **Recorded in:** `01-VALIDATION.md`, `01-SECURITY.md`.

#### P1-DC-40: CI flake fix, code review findings, and fix directions

- **Severity:** Medium to High. **Status:** open.
- (Medium) CI's adapter components shard lost one terminal-UI scenario to
  the 15 s TUI readiness wait in each of two attempts (different scenarios).
  Commit 863d8f3 raises the default to 25 s (inside the 30 s step timeout)
  instead of lowering parallelism or speeding up the start. Likely cause:
  Pi 1.5.0's slower terminal start plus the adapter now loading in every
  adapter-profile shared Pi, on 4 vCPU with 8 workers.
- (High) Code review CR-02: the built-in `toolNamePrefix` promised a prefix
  Pi's 55-char cut breaks for long plugin+server names. Direction chosen:
  return `string | undefined` (undefined when the prefix exceeds 55 chars),
  consumers fall back to full tool names; frozen shape changes before the
  freeze.
- (Medium) CR-01 (`restorePin` mirror list missed the new record fields and
  `resolvedVersion`): fixed by deriving the list from `DisabledPin`.
- (Medium) WR-02: `compatibilityBasis` stays top-level; every writer that
  replaces `compatibility` clears it (alternative: move it inside
  `compatibility`).
- (Medium) WR-01: the legacy reader refuses `version-mismatch` when the
  re-resolved version differs from `resolvedVersion`.
- (Low) WR-03 debug log on unreadable; WR-04 widen the built-in status
  reader to `getAllTools`; WR-05 ENOENT race in `stubPidsIn`; IN-05 stale
  ignoreExports. IN-01..04 and IN-06 skipped.
- (Low) Reviewer's view: the adapter-profile shared Pi loading the adapter
  for every scenario (P1-DC-03) means non-MCP scenarios no longer run in a
  companion-free Pi.
- **Recorded in:** `01-REVIEW.md`, `01-REVIEW-FIX.md`.
- (Orchestrator, supersedes the 25 s timeout) The TUI failures were a cold
  jiti cache: since a280c4a the adapter-profile shared Pi used its own TMPDIR
  and stopped warming `/tmp/jiti`, the cache TMPDIR-less terminal Pis use.
  Commit 8d03f4e symlinks the shared Pi's `jiti` to `/tmp/jiti` and restores
  the 15 s wait (863d8f3 reverted in effect).
- (Medium, fixer) WR-01 compares the version install would derive with the
  record's `version`; a path plugin that changes its MCP declaration without
  bumping its version still reads the new servers.
- (Low, fixer) `deriveInstallVersion` exported from `install-outcome.ts` for
  the legacy reader (it now imports the install ledger module);
  `replaceCompatibility` also routes the AMIG-01 write in
  `mcp-migration.ts`; `STUB_TOOL_NAMES` added to the frozen
  `features/lib/mcp-stub-server.ts`; the built-in prefix promise stays at 55
  characters (56 would also be safe).

### Phase 2 (child session session_01EDUMG78rMfEcaGf2ZRYWev, branch features/mcp-builtin-phase-2)

Full text in `.planning/milestones/mcp-builtin-phases/02-built-in-materialization/DUBIOUS-CHOICES.md` on that branch.

#### Discuss step (received 2026-11-04 10:50Z)

- P2-DC-01 (Medium): discuss items settled without the user, from upstream parity, the Pi 1.5.0 source, and conventions.
- P2-DC-02 (High): the built-in encoder expands every Claude variable itself (Claude's rule plus the AVAR-05 deny-lists) from the session env at each registration, then escapes `$` to `$$` and a leading `!` to `$!` in env/headers; command/args/url get the expanded value; an unset variable with no default keeps literal `${NAME}`. Alternative: write `${VAR}` references for Pi (Pi expands only env/headers/clientSecret, reads bare `$NAME`, has no `:-default`, runs `!cmd`, fails on unset) or a mix. Dubious because resolved secrets sit in Pi's session registry, readable by other extensions through `getMcpServers()`; nothing is persisted.
- P2-DC-03 (Low): under built-in, `${CLAUDE_PROJECT_DIR}` = `ctx.cwd` for both scopes (the adapter keeps AVAR-01's install-time rule).
- P2-DC-04 (Medium): no `cwd` written for a built-in stdio server (not a Claude field); Pi uses the session dir. Researcher to confirm Claude Code 2.1.318's dir; a difference becomes a recorded gap.
- P2-DC-05 (Low): timeout = normalized ms / 1000, fractions kept.
- P2-DC-06 (Medium): registration classifies the record's full `mcpServerConfigs` with the built-in profile, so a server the adapter blocked at install runs under built-in with no reinstall. Alternative: register only what the install-time verdict kept (the user's `--partial` consent named a smaller set).
- P2-DC-07 (Low): a trusted project record wins over the user record of the same plugin; with an untrusted project the user record registers.
- P2-DC-08 (High): BLT-04 "reported, never silent" is met by info (`overridden by mcp.json`; `not loaded` for a registration Pi refused) plus Pi's own /mcp override list and a debug log; no new closed-set load notice. Alternative: a new load-origin notice (closed-set addition, catalog counters change). A user who never runs info or /mcp does not learn of it; upstream reports `mcp-server-suppressed-duplicate` in /plugin.
- P2-DC-09 (Low): no load-time plugin-to-plugin collision check; ANAME-03's install refusal covers it.
- P2-DC-10 (Medium): built-in status inferred from Pi's tool list (connected / disabled / not connected / not loaded); failed vs connecting vs needs sign-in are indistinguishable.
- P2-DC-11 (Medium): no code for pre-AMIG-01 legacy mcp.json entries; in the first built-in session after such an upgrade Pi may show the tools twice until the same load's AMIG-01 move.
- P2-DC-12 (Low): the switch scenario's `none` leg asserts only "not reached, no extension error"; the `{requires mcp}` row is Phase 6 (DUAL-04).

### Phase 3 (child session session_01EDUMG5p4jHecGXqAFGi3Do, branch features/mcp-builtin-phase-3)

Full text in `.planning/milestones/mcp-builtin-phases/03-read-time-verdicts/DUBIOUS-CHOICES.md` on that branch.

#### Discuss step (received 2026-11-04 10:53Z)

- P3-DC-01 (Medium): the neutral stored verdict is the `none` view (MCP blocked only when both profiles block, plus bundles); sse and bareElicitation are never stored. Alternatives: store no MCP kind; or the active implementation's verdict with a basis.
- P3-DC-02 (Medium): Phase 3 edits the Phase 1-owned `statePhase` and the update-swap record write, only to change the stored verdict and set `compatibilityBasis: "neutral"`. Alternative: a parent line.
- P3-DC-03 (Medium): the resolver exposes state/unsupported/dropped per named implementation (adapter|builtin|none), no default; `mcpServers` stays the adapter subset. Alternative: an adapter-only resolver with callers running `effectiveMcpCompatibility`.
- P3-DC-04 (Low): one offline effective-read helper (`recordedMcpServers` + `effectiveMcpCompatibility`) for every record read; legacy records cost an offline re-resolve per read.
- P3-DC-05 (Medium): when servers split (one adapter-only, one builtin-only), the marker is `requires mcp` with none active, else the other implementation's name. D-MB-07 does not cover it.
- P3-DC-06 (High): `partially-installed` list rows gain `{unsupported mcp, requires <other>}` (today they carry no marker): a visible list change that D-MB-07's example requires.
- P3-DC-07 (High): info `requires:` names the D-MB-07 marker also when satisfied: a stdio plugin shows `requires: mcp` under both implementations and `requires: mcp (missing)` with none; JSON `{"companion":"mcp","missing":false}` replaces today's adapter `{"companion":"pi-mcp-adapter","missing":false}`. Changes adapter output. Alternatives: name the active implementation when satisfied; or drop the entry when satisfied.
- P3-DC-08 (Low): the MCP `Dependency` carries per-profile verdicts instead of a bare `declaresMcp` (about 30 emit sites change).
- P3-DC-09 (Medium): under `none`, `--partial` is asked only for servers both profiles block and non-MCP drops; sse installs without consent. Alternative: never ask under none.
- P3-DC-10 (Medium): apply convergence holds a move for consent only when the candidate drops something the installed record (effective, active implementation) does not; enable/import/promotion/cascades read the neutral stored installable. The same apply can differ by implementation.
- P3-DC-11 (Medium): no load warning row when a switch makes a plugin partial; list and info show it (APL-D1 favors silence).
- P3-DC-12 (Low): AMIG-01 stays adapter-explicit; its record write stores the neutral verdict and basis.
- P3-DC-13 (Low): verdict-markers pairs whose twins now agree fold into single `@mcp` scenarios.

### Phase 4 (child session session_01EDUMG87PKcySw33ikhvFmE, branch features/mcp-builtin-phase-4)

Full text in `.planning/milestones/mcp-builtin-phases/04-agent-grants/DUBIOUS-CHOICES.md` on that branch.

#### Discuss step (received 2026-11-04 11:02Z)

Research closed P1-DC-28: pi-subagents 0.84.0 resolves built-in `mcp:<server>[/<tool>]` through Pi's namespace and `createMcpToolName`, so the frozen `grantSelector` `mcp:plugin_<p>_<s>` is correct. Background children set `PI_SUBAGENT_CHILD=1`; foreground children never load ambient extensions.

- P4-DC-01 (Medium): discuss items settled without the user from the pi-subagents source and conventions.
- P4-DC-02 (Medium): agents-index rows store each implementation's rendered frontmatter (plus warnings, droppedTools) and `mcpImplementation`; the load swaps the frontmatter when the file still holds the recorded form. Stores derived text in agents-index.json. Alternatives: re-convert from the plugin source at load; a pure translator; re-stage at load.
- P4-DC-03 (Low): with no active implementation, install writes the adapter form.
- P4-DC-04 (Medium): the async warning gets a built-in wording; adapter text unchanged. Cross-phase: Phase 3's `@builtin-only` update scenario in verdict-markers.feature quotes the adapter text (parent told Phase 3).
- P4-DC-05 (Medium): the built-in form maps declared servers whose built-in verdict is supported (an sse grant is dropped under built-in, kept under adapter).
- P4-DC-06 (High): agents installed before this phase (no stored forms) are not rewritten at load; under built-in their MCP grant fails until reinstall, update, or disable+enable. Alternatives: legacy adapter-to-builtin translation at load (lossy only for long per-tool excludeTools names); re-stage at load. Conflicts with the milestone goal that a switch needs no user action (parent sent its view to Phase 4).
- P4-DC-07 (Low): child detection is `PI_SUBAGENT_CHILD === "1"` in a new `platform/subagent-child.ts` (a pi-subagents internal, not a documented API).
- P4-DC-08 (Medium): the MGRT-02 gate edits the unowned `orchestrators/reconcile/load.ts` (skips the autoapply apply step and the AMIG-01 move in a child; optional env param so the frozen index.ts is unchanged).
- P4-DC-09 (Medium): the load rewrite is silent (debug log only).
- P4-DC-10 (Medium): the MGRT-02 cucumber scenario uses a profile Pi started with `PI_SUBAGENT_CHILD=1`, not a real background child.
- P4-DC-11 (Low): edits the unowned `features/lib/upstream/subagents.ts` so the error projection names built-in servers.
- P4-DC-12 (Low): AG-11 applies to the active form only.
- Parent lines so far: `docs/mcp-compatibility.md` agents section gains the built-in `mcp:` form and override example.

#### Phase 2 research step (received 2026-11-04 11:19Z)

- P2-DC-13 (Medium): the UF-1 containment bound is corrected: `resolvedSource` must lie inside the record's `marketplaceRoot` (path records) or the scope's `pluginClonesDir` (git records), not `<scopeRoot>/pi-claude-marketplace/` as the parent's advisory worded it (a directory marketplace's root is the user's own directory, so the advisory wording would refuse every local-marketplace plugin).
- P2-DC-14 (Low): the same plugin in both trusted scopes: the project wins per server name (adapter file-merge semantics).
- P2-DC-15 (Low): info counts any JSON-object mcp.json entry in our namespace as `overridden by mcp.json`, without Pi's `validateMcpServerConfig` (not re-exported by the frozen pi-api.ts); an invalid entry would show overridden while Pi connects ours.
- P2-DC-16 (Medium): built-in info status scenarios use the full-field step and so pin Phase 3's `requires` row; re-verify after Phase 3 merges.
- P2-DC-17 (Medium): OAuth/timeout/exposure/description values under built-in are observed through a Phase 2 harness probe of `getMcpServers()` configs, not runtime use.
- P2-DC-18 (Medium): a Phase 2-local tool_search projection step; a Phase 6 parent line moves it into `features/lib/upstream/` (Phases 4/5 may duplicate it).
- P2-DC-19 (Low): `substitute.ts` takes a required `McpFieldEncoder`; the adapter path passes `ADAPTER_FIELD_ENCODER` (byte-identical output).
- P2-DC-20 (Low): `callbackUrl` `http://localhost:<port>/callback` written only when `callbackPort` is set.
- P2-DC-21 (Low): Claude's stdio cwd (project root) rests on minified-helper attribution plus CC-1.
- P2-DC-22 (Medium): the env deny-lists stay pinned to Claude Code 2.1.291 (unowned files); re-pinning to 2.1.318 becomes a backlog line. A credential 2.1.318 would blank could still reach a server (same as the adapter today).
- P2-DC-23 (Low): the plugin description for built-in registration is read from the manifest at registration by a small owned reader; if fallow flags a clone, description is dropped under built-in.

### Phase 5 (child session session_01EDUMG4jWcEu7RZAr5kSKXC, branch features/mcp-builtin-phase-5)

Full text in `.planning/milestones/mcp-builtin-phases/05-hook-tool-names/DUBIOUS-CHOICES.md` on that branch. (The first Phase 5 session failed container setup and did no work.)

#### Discuss step (received 2026-11-04 12:28Z)

- P5-DC-01 (Medium): discuss decisions settled without the user.
- P5-DC-02 (Medium): the hooks bridge names every built-in MCP tool `mcp__<registered server name>__<tool>` from Pi's namespace alias, so user mcp.json servers get Claude's form too, not only plugin servers. Alternatives: plugin servers only; leave non-plugin servers folded.
- P5-DC-03 (High): a matcher or `if` literal `mcp__<server>__<tool>` fires on a built-in tool when Pi's `createMcpToolName(server, tool)` yields the event's name, so Claude's full name fires, `-` in the tool segment included; only the stdin `tool_name` keeps Pi's fold. Alternative: compare the Claude-form name as is, so authors must fold the tool segment, as D-MB-08's text and the ROADMAP criterion read. Goes beyond the text of a decision pending review.
- P5-DC-04 (Low): a matcher with the folded tool segment also fires on the `-` tool under built-in (Pi gives both one name).
- P5-DC-05 (Medium): when Pi's 64-char cut falls inside the namespace, the hook's `tool_name` is Pi's cut name; matchers still fire.
- P5-DC-06 (Medium): the D-CF5-12 proxy rule applies only when `mcpImplementation === "adapter"`, read lazily once per bridge generation. Fixes a built-in mis-detection of long cut names as proxy calls.
- P5-DC-07 (Medium): Phase 1's `@adapter-only` scenario in `features/hook/tool-use.feature` keeps its tag (now for the proxy de-dup) and gains an `@builtin-only` twin; the shared scenario lives in a new `features/hook/mcp-tool-names.feature`.
- P5-DC-08 (Medium): the tool-segment fold scenario uses a server in Pi's own mcp.json, run by a new Phase 5 stub lib, not a plugin server.
- P5-DC-09 (Low): Pi's `tool_search` keeps its Pi name in hooks (no mapping to Claude's `ToolSearch`).

#### Phase 4 research and plan step (received 2026-11-04 12:46Z; 6 plans, 4 waves)

- P4-DC-06 revised to Medium after the parent's note: legacy agent rows get a textual adapter-to-builtin translation at load (selectors drop the key's trailing `_`, per-tool excludeTools tokens become Pi's sanitized names, warnings swap). Gaps: an exclude name over 64 characters leaves that agent untranslated, silently (P4-DC-30); an sse grant is translated, not dropped.
- P4-DC-13 (Medium): autoupdate and apply-convergence updates carry no run, so they stage the adapter form under built-in until the next `/reload` rewrites it. Parent line: repoint after Phase 3 merges.
- P4-DC-14 (Low): `agentGrantsStep(input, env = process.env)` adds an optional second parameter to the frozen signature (call-compatible).
- P4-DC-15..17 (Low): the step locks with `persistMigration: false`; the rewrite stages through `agents-staging/<uuid>/` plus rename; stored forms are validated before writing.
- P4-DC-18..21 (Low): untrusted-project leg unit-only; the child grants scenario is red only by mutation; the switch scenario starts from no implementation; a child still prints the load's pending block.
- P4-DC-22 (Low): 4 waves, not 3.
- P4-DC-23 (Medium): cross-phase: from wave 3, Phase 3's `@builtin-only` update scenario in verdict-markers.feature fails on the adapter async-warning text; Phase 4's gate excludes exactly that scenario by name; a parent line rewrites the row. Parent decision: leave the row to Phase 3, which owns the file and was told at 11:03Z.
- P4-DC-24 (Medium): the built-in async warning has no Phase 4 scenario (only Phase 3's row proves it).
- P4-DC-25..29 (Low): per-verb `@adapter-only`/`@builtin-only` pairs (17 scenarios); the install pair installs inside the profile Pi (departs from the harness "install through the shared Pi first" rule); optional `StageAgentsInput.mcpGrantForms`; a new leaf `mcp-async-warning.ts`; `convertAgentForm` returns undefined where AG-11 would throw.
- P4-DC-31..44 (Low): legacy detection by the async warning; one corrupt index row blocks the scope's rewrite save silently; an old index simulated by deleting new fields; a conformance test imports a non-public pi-subagents path; a user-edited legacy file is translated in place; `update-swap` agents block extracted into `prepareUpdateAgents` (merge-conflict risk with Phase 3 in `prepareUpdateHandles`); codebase-map updates are parent lines; oversized tasks; other plan-shape items.
- P4-DC-45..47: checker warnings handled; P4-DC-46 (Medium) the checker accepted P4-DC-13 as info though success criterion 1 names updating; the GSD decision-coverage gate could not parse CONTEXT (no D-NN IDs).

#### Phase 3 research, plan, and revision (received 2026-11-04 13:02Z; 9 plans, 5 waves)

- P3-DC-14 (Low): ran plan-phase's standard research; decisions numbered D-P3-01..23.
- P3-DC-15 (Medium): `resolveStrict` keeps its two-argument signature (the frozen `recorded-servers.ts` calls it); its top-level verdict is the neutral view; a pure `resolutionFor(resolved, active)` derives views. Risk: a forgotten call site reads `none`.
- P3-DC-16 (Low): the `mcpServers` kind goes last when one implementation blocks (adapter reason order changes for bare-elicitation plugins with other kinds).
- P3-DC-17 (Medium): pure `mcp-verdict.ts` plus I/O `mcp-verdict-read.ts`, imported only by cycle-safe modules.
- P3-DC-18 (Medium): legacy records with no MCP trace skip the offline re-resolve on list.
- P3-DC-19 (Medium): Dependency "mcp" becomes `McpDependency {kind:"mcp", runEvery}`; catalog fixtures use `runEvery:["adapter"]` to keep the frozen counters 324/54652.
- P3-DC-20 (Medium): record-driven consent gates (enable/re-enable/promotion/promoting import) read the `none` view; fresh import/apply installs read the active view.
- P3-DC-21 (Medium): the update intent mark keeps the old basis instead of forcing "neutral" (departs from D-P3-02's literal list).
- P3-DC-22 (Medium): completions stay on the stored verdict. Parent line: the frozen `edge/register.ts` gives the completion resolver no run, and the completion cache keys only scope+marketplace.
- P3-DC-23 (Low): edits unowned files no sibling owns (edge/handlers/tools.ts, browse.ts, orchestrators/types.ts, plugin/fetch.ts, reconcile/{pending,read-pass,apply,notify}.ts).
- P3-DC-24, 25 (Low): an unreadable record uses the stored verdict as the adapter's; fetch rows follow the active implementation.
- P3-DC-26..29 (Low): 5 waves, not 3; `declaresMcp` keeps its name typed `McpDependency | false`; update modules rely on fallow ignoring type-only cycle edges; `InstallLedgerOptions.consentView` required.
- P3-DC-30 (Medium): edits `toInstallLedgerSummary` in install-outcome.ts beyond the consent gate the ownership table names; possible friction with Phase 4.
- P3-DC-31..35 (Low): convergence consent rule; AMIG-01 dropped-server write uses the `none` view plus basis; `InfoBlock.mcpDependency` required; `requires:` entries sort by code-unit name, so `builtin mcp`/`mcp` precede `pi-` names (visible order change); marker and requires share one name table.
- P3-DC-36 (Medium): plan 03-08 edits one cell of Phase 2's `features/mcp-server/project-scope.feature` before the merge to keep its wave gate green; likely merge conflict, re-applied after merging.
- P3-DC-37..39 (Low): new requires scenarios use not-installed plugins; the e2e foreign-tool case also turns off built-in MCP; e2e marker tests rerun after merge.
- P3-DC-40 (Medium): after Phase 2 merges, `invalid-configs.feature`'s two tool-call scenarios go `@mcp`, proving the skipped server with the registered-servers step (proof moves from "answers a call" to "is registered").
- P3-DC-41 (Medium): the merge plan continues if a sibling has not merged yet, records the missing phase, and runs the gate (alternative: BLOCKED.md).
- P3-DC-42 (Medium): wave 5 (the milestone merge) runs in the main checkout, not a worktree.
- P3-DC-43..48 (Low): merge conflict policy (frozen files take the milestone side; owned files keep Phase 3 functions); merge title `chore: merge the parallel component work`; trailers use the parent's Claude-Session URL; ROADMAP plan list filled on the branch; two companion-missing info scenarios tagged `@builtin-only` for one wave; the concurrency probes are a state-lock backstop, no test.
- P3-DC-49..53 (Low): one 3-commit plan for the Dependency type; `mcpDependencyOfResolution` dropped; executor reads line ranges; two files dropped from a plan's list; between waves 2 and 3 a bare-elicitation-only plugin shows `requires pi-mcp-adapter` without the adapter (interim).

#### Phase 2 plan step (received 2026-11-04 13:04Z; 9 plans, 3 waves)

- P2-DC-24 (Medium): value-pinning scenarios load a Phase 2 config probe through `usePiWithProfile({companions: [], extraExtensions: [probe]})` instead of the frozen launch list; adds one fallow-ignore unused-export marker.
- P2-DC-25, 26 (Low): the registration sync takes an injected log callback; a new synchronous mcp.json override reader in `bridges/mcp` (the extension's first `readFileSync`, forced by the frozen synchronous info call).
- P2-DC-27 (Medium): tracer plan 02-01 is large (20 files, about 125k tokens).
- P2-DC-28 (Low): seven parallel wave-2 plans each run cucumber.
- P2-DC-29 (Medium): the `disabled` status is proven by driving Pi's TUI `/mcp` through a PTY, with a unit-proof fallback.
- P2-DC-30 (Medium): synchronous mcp.json read (see 26).
- P2-DC-31 (Low): plan 02-04 edits one fixture line in Phase 3's `test/orchestrators/plugin/info.test.ts`; also a parent line.
- P2-DC-32..42 (Low): no built-in twin for the adapter `pending approval` info row; the lifecycle Background install moved into 8 adapter scenarios; a disabled-in-session server stays registered until the next session (D-MB-10) is pinned; only the autoapply-at-load scenario distinguishes the resync; new polling Then steps; extension-error check covers every record; MSEL-04 shown by an empty report; MREC-02 is an `@mcp` listing scenario; the docs citation check is inline; COVERAGE.md treats Pi's in-process MCP surface as an external API; the decision-coverage gate replaced by a manual audit.
- P2-DC-43 (Medium): merge note: once the built-in status reader lands, Phase 3's `companion-missing.feature:76` `@builtin-only` cell `"status":"status unknown"` reads `not loaded`. Phase 2's gate tolerates exactly that cell (P2-DC-48 edits and restores it within the gate command); a one-cell parent line goes to the parent. Phase 3 rewrites that row and merges last.
- P2-DC-44, 45 (Low): adapter gate in three directory groups; outcome-dependent branches left to executors.
- P2-DC-46 (Medium): if another extension registers `plugin_<p>_<s>` first, Pi refuses ours (debug log only) and info's built-in row shows the other extension's state: a documented gap plus a backlog line.
- P2-DC-47..51 (Low): plan split shape; the gate's temporary edit of Phase 3's cell; a control plugin in the server-less listing scenario; an extra reversed-precedence red run; the checker's last size warning accepted.
- Planned parent lines (02-08 SUMMARY): CHANGELOG and README lines; PROJECT.md Key Decisions rows; BACKLOG lines (tool_search projector, deny-list re-pin, load-time notice for overridden or refused registrations, tool_search-off fallback, foreign-owner gap); built-in status rows in docs/output-catalog.md and docs/json-output.md; the companion-missing.feature cell; the info.test.ts fixture line; .fallowrc ignoreExports cleanup.

#### Phase 4 wave 1 (received 2026-11-04 13:45Z; gate green: adapter 1559/1559, builtin 39/39)

- P4-DC-48 (Low): commit trailers use the brief's Claude-Session (the parent's session id), though the child's own harness names its session; its first commit 3685c3e used the child's own.
- P4-DC-49 (Low): the conformance test reproduces Pi's `createMcpToolName` with node:crypto rather than importing Pi dist internals.
- P4-DC-50 (Low): an io test pins TypeBox error text for a bad `mcpImplementation`.
- P4-DC-51 (Low): some RED proof is type-level only.
- P4-DC-52 (Low): the child autoapply scenario's red fails at the session-report step, not at "no installed plugins".

#### Phase 5 research and plan step (received 2026-11-04 13:53Z; 4 plans, 3 waves; checker passed)

Research confirmed: Claude Code names tools `mcp__En(server)__En(tool)` (En folds `[^a-zA-Z0-9_-]`), no length cut, discovery tool `ToolSearch`.

- P5-DC-10 (Medium): the proxy rule reads the implementation through `openNotificationSnapshot(pi).softDeps.mcpImplementation`, not `softDepStatus(pi)` (D-JO-01); CONTEXT D-P5-06 amended.
- P5-DC-11 (Low): Pi's `namespace.name` already starts with `mcp__`; D-P5-02 wording corrected.
- P5-DC-12 (Medium): the built-in twin of the tool-use pair keeps a `*` PreToolUse hook but its PostToolUse hook is a Claude-form literal (a `*` PostToolUse row would pin Pi's own tool_search text).
- P5-DC-13 (Medium): the Phase 1 tool-use pair moves to plugin hook-demo / server stub-server (with demo/stub the built-in twin passed on the Phase 1 tree, so no red proof).
- P5-DC-14 (Medium): the shared `@mcp` scenario's model script is built by a profile-aware step from `profileFor(...).toolName`, against the cucumber rule "a feature writes the whole script as literals" (no literal works under both profiles). Alternative: a tagged pair with literal scripts.
- P5-DC-15 (Low): no hardening for the edge case where adapter and built-in are both loaded.
- P5-DC-16 (Low): found, not acted on: Claude Code 2.1.318 treats a matcher of `[a-zA-Z0-9_|, -]` as an exact-name list and others as unanchored regex; this project accepts only `[A-Za-z0-9_|-]` and prefixes. Existing parity gaps; maybe BACKLOG.
- P5-DC-17 (Low): research probes and red proofs run cucumber on scratch feature files outside `features/`.
- P5-DC-18 (Medium): red proofs restore `bridges/hooks` and `domain/components/hooks` from 6404197 (Phase 1 product code) in the worktree, run the scenario, restore HEAD, and require an empty git status.
- P5-DC-19 (Low): `createHookToolView(pi)` is a defaulted handler parameter, against "don't default to a live boundary".
- P5-DC-20..23 (Low): cut-name scenario placement; the shared scenario adds a must-not-run folded-server hook and an if hook; the folded-tool literal firing becomes a tested contract (P5-DC-04); the PreToolUse notice label gets its own `@mcp` scenario.
- P5-DC-24 (Medium): MHK-02's "no implementation" case is unit-tested only (no stand-in can register a proxy-shaped tool without an MCP implementation).
- P5-DC-25..27 (Low): no identity cache (one `getAllTools()` read per MCP tool event with hooks); plan shape; CONTEXT decision bullets reformatted for the decision-coverage gate.

#### Phase 2 wave 1 (received 2026-11-04 14:04Z; gate green: builtin 42/42, adapter 1559/1559)

- P2-DC-52 (Low): executors read the GSD procedure files by absolute path instead of the workflow's verbatim inline embed (same as the parent's P1-DC-24).
- P2-DC-53 (Low): `substituteAndInject`'s encoder parameter defaults to the adapter encoder (reverses P2-DC-19) because an unowned integration test calls it with two arguments; a forgetful caller silently gets adapter encoding. Parent line: pass the encoder in that test, then make it required.
- P2-DC-54 (Low): `ADAPTER_FIELD_ENCODER` defined in substitute.ts (exporting it elsewhere left test-only exports).
- P2-DC-55..58 (Low): description reader treats a directory named plugin.json as no manifest; an empty server list skips the description and data-dir reads; an unlisted plugin reads its description only inside its plugin dir; the tool_search projector accepts any tool name on a loaded line.

#### Phase 3 wave 1 (received 2026-11-04 14:09Z; gate green: adapter 1561/1561, builtin 41/41)

- P3-DC-54, 55 (Low): executor prompts name the GSD execution files by path; each wave's post-merge gate is the brief's gate, and GSD's evaluation-scope spot-check is replaced by checking merged commits plus SUMMARY.
- P3-DC-56 (Medium): the list switch scenario installs under the adapter-profile Pi and lists from a fresh built-in Pi, not through `the user restarts pi without pi-mcp-adapter`, because pi-mcp-adapter turns built-in MCP off, so that restart lands on no implementation (relayed to Phase 2 for its switch scenario).
- P3-DC-57 (Medium): sibling tests pin the cleared basis after update/reinstall for one wave until 03-06 writes the basis in the update runner.
- P3-DC-58..62 (Low): the LLM list tool opens one snapshot also on load-failure paths; the no-trace legacy proof keeps a declared sse server; `resolutionFor` spreads the neutral resolution; the interim basis gap tracked in the SUMMARY; browse loader wiring proven only through the shared payload builder.

#### Phase 4 wave 2 (received 2026-11-04 14:39Z; gate green: adapter 1559/1559, builtin 39/39)

- P4-DC-53..59 (Low): built-in server set keeps declaration order (unpinned); a stage without `mcpGrantForms` records no forms, so a re-stage from such a caller drops stored forms; RED evidence by restoring base sources; a legacy row whose file lacks the frame or marker stays a candidate (one lock and read per load under built-in); legacy warning translation runs on every list line of the frontmatter block; the swap reads/writes UTF-8 strings (invalid UTF-8 body bytes would become U+FFFD); `test/bridges/agents/agent-grant-seeds.ts` added outside files_modified.

#### Phase 5 wave 1 (received 2026-11-04 15:01Z; gate green: adapter 1559/1559, builtin 40/40)

- P5-DC-28..31 (Low): the `if` field gets the Claude-form event from task 1 on; dispatch unit cases written after the code with RED evidence by restoring sources; the new call step takes JSON as a single-quoted Gherkin string (a first in the suite); typing and scope details. Red proofs against Phase 1 code: builtin fails, adapter passes (parity guard).

#### Phase 2 cross-phase finding (received 2026-11-04 15:07Z)

- P2-DC-77 (Medium, Phase 2 log): Pi 1.5.0 RPC `new_session` emits `session_start` twice, and Pi's built-in MCP `session_start` handler opens new connections without closing the earlier ones, so any server registered across a new session (ours or the Phase 1 stand-in) leaks one stdio connection. The stub exits about 3 s after Pi, after the frozen HAR-05 stand-in check, so the After hook fails. Phase 2 runs its new-session scenario `@adapter-only` (WINDOWS 112). Parent line: the frozen harness (`features/lib/turn-records.ts` `assertStandInsStopped`, or `pi-commands.ts` `startSession`) should wait briefly for stand-ins to exit or avoid the double bind; plus an upstream Pi report.

#### Phase 3 wave 2 (received 2026-11-04 15:10Z; gate green: adapter 1564/1564, builtin 48/48)

- P3-DC-63 (Medium): a warm git installed plugin under a partially-available view keeps the D-78-04 `components: not resolved` fallback, so under built-in an installed github plugin with an sse server reads `(partially-installed) {unsupported mcp}` without server lines. Alternative: list the warm tree's components (also changes lspServers git rows).
- P3-DC-64..67 (Low): info reads the record verdict for every installed block; a malformed recorded config writes every recorded server; the built-in info scenario pins `status unknown` (becomes `not loaded` after Phase 2 merges); unit tests seed the neutral record through a helper.
- P3-DC-68 (Medium): interim `requires pi-mcp-adapter` for a bare-elicitation-only plugin, pinned by a test, until 03-04 switches the rule.
- P3-DC-69..74 (Low): declared-row MCP dependency read inside the lock; a type-only guard; a hand-made legacy record in a test; a table column renamed for an acceptance grep; `false as const`; `isMcpDependency` checks `typeof === "object"`.

#### Phase 2 wave 2 (received 2026-11-04 15:21Z; gate: adapter 1564/1564, builtin 96/97, the one failure is the tolerated Phase 3 cell)

- P2-DC-59 (Low): wave 2 ran 3 executors at a time with cucumber `--parallel 2` on a 4-CPU box.
- P2-DC-60..64 (Low, switch): the last-leg adapter listing wait can return early after a restart; empty results as header-only tables; model-call numbering continues across restarts; the earlier-record rewrite drops `mcpServerConfigs` but leaves `compatibilityBasis`; a one-member holder avoids a fallow clone of the frozen earlier-version-state.ts.
- P2-DC-65..68 (Low, values): the Pi-resolver conformance test runs through `builtinServerConfig`; source twins' rows depend on Pi's search ranking; the `auth.provider` drop proven on a stdio stub only; the bundle scenario runs under both implementations.
- P2-DC-69..73 (Low, status): project row decided by `marketplaceScope`; the TUI /mcp-disable step waits on the stub log; an mcp.json entry counts as an override only with a string command or url (narrows P2-DC-15); an untrusted project row skips mcp.json reads.
- P2-DC-74..76 (Low, trust): two When steps; pins Pi's progressToken 3; the distrust twin checks the registry.
- P2-DC-77 (Medium, lifecycle): "A new session offers the plugin's tool again (BLT-01)" runs `@adapter-only` because of the Pi 1.5.0 RPC `new_session` double `session_start` leak; built-in "every new session" rests on the startup and /reload scenarios.
- P2-DC-78 (Low): the built-in enable twin uses "which did not fail" (enable warns `requires pi-mcp-adapter`, a Phase 3 marker).
- P2-DC-79..83 (Low, configuration): the IN-02 notice step reads scope from `--scope` and fixes file mcp-adapter.json; built-in twins use the frozen implementation step; pins Pi client details; the escaping mutation run does not cover plugin-dir rows.
- P2-DC-84 (Low, listing): the 64-char cut scenario also pins the registry row.

#### Phase 4 wave 3 (received 2026-11-04 15:33Z; gate: adapter 1567/1567, builtin 43/43 with only the P4-DC-23 Phase 3 scenario excluded)

- P4-DC-60 (High, carries P4-DC-13): autoupdate and apply convergence stage the adapter form under built-in until the next session rewrites it (adapter warning text and an unresolvable grant until reload). Parent line: repoint `updateAgentImplementation` to Phase 3's ThreePhaseArgs field after Phase 3 merges.
- P4-DC-61 (Medium): the four `@adapter-only` verb scenarios pass on the pre-phase tree (regression pins; no red proof possible under adapter).
- P4-DC-62 (Medium): the built-in refusal twin checks only model calls, not the stub's messages (no proof that no tools/call reached the server).
- P4-DC-63, 64 (Low): a 10-line feature description (skill says 2-3); update unit cases have no separate unit red run.
- The Pi new_session heads-up does not apply to Phase 4 (no built-in scenario starts a new session).

#### Phase 5 wave 2 (received 2026-11-04 16:02Z; gate green: adapter 1560/1560, builtin 44/44)

- P5-DC-32..36 (Low): router unit cases count inventory reads through a counter on `makeRecordingPi`; dispatch proxy rows drive a recording `HookToolView` stub; three guard unit cases pass on any tree; the built-in twin and cut-name scenario pin a `*` row on Pi's `tool_search` (a later ToolSearch rename would change them); docs describe Pi's cut as ">64 chars, cut and ended with a hash" without the 55-char rule.
- The Pi new_session leak does not affect Phase 5.

#### Phase 3 wave 3 (received 2026-11-04 16:11Z; gate green: adapter 1570/1570, builtin 48/48)

- P3-DC-75 (Medium): the "pi settings unchanged" step's expected text includes Pi's own `"retry": {"enabled": false}` (Pi saves it when the harness turns auto-retry off over RPC) and compares the whole file. Alternatives: compare only `extensions`; snapshot after Pi starts (frozen world change).
- P3-DC-76 (Low): a new `When pi-mcp-adapter finishes listing ...` step after a restart, since the only listing wait is a frozen `Given`.
- P3-DC-77 (Low): kept companion-missing info scenarios use `which did not fail` (a stdio install under built-in no longer warns).
- P3-DC-78 (Low): a partially-installed row carries its MCP dependency even when an implementation runs every server (an lsp-degraded plugin with a stdio server reads `{lsp, requires mcp}` with none active).
- P3-DC-79..81 (Low): "split" names an empty `runEvery`; some feature descriptions exceed 2-3 lines; one executor skipped trufflehog in pre-commit (re-run by Phase 3 on merged files).

#### Phase 4 wave 4, code review and fix (received 2026-11-04 16:15Z)

Review: 0 critical, 6 warnings, 5 info; fixed WR-01, WR-02, WR-04, WR-05, WR-06, IN-01, IN-02; skipped WR-03 (= P4-DC-13/60), IN-03..05.

- P4-DC-65, 66, 68 (Low): the wave-3 gate reused for identical inputs (test:modules run anew); no README grants sentence (conditional draft in parent line 6); "phase DUBIOUS file unchanged" read as "no executor edited it".
- P4-DC-67 (Medium): parent line 2 asks for a new `@builtin-only` autoupdate/apply-convergence scenario with the repoint after Phase 3 merges (unscheduled post-merge work).
- P4-DC-69 (Medium): the reviewer rated WR-03 (= P4-DC-60) a warning, not a blocker.
- P4-DC-70 (Medium): an unlocked needs-check is silent about why a row never converges.
- P4-DC-71 (Medium): the tightened built-in error projection has no unit cases (`features/lib` has no unit-test home).
- P4-DC-72 (Medium): the child step resets the launch env to `{}` after its Pi starts; the child grants scenario observes through a no-MCP restart.
- P4-DC-73..75 (Low): WR-01 and WR-06 in one commit; debug wording; one fix pass, no re-review loop.

#### Phase 2 wave 3, code review and fix (received 2026-11-04 16:37Z; phase gate green on 52b8d95: builtin 93/93 excluding companion-missing, adapter 1564/1564; review 0 blockers, 5 warnings, 2 info, all fixed)

- P2-DC-85..89, 91 (Low, docs): one citation per table cell; `bareElicitationCapability` support for built-in proven through Pi's initialize capabilities; a sentence cites extension source; switching steps name no Pi command and /reload-alone switching was not run; a timeout cell cites a timeout-only scenario; the companion tolerance check ran as split commands.
- P2-DC-90 (Medium): `docs/mcp-compatibility.md` cites P2-DC review-log IDs as licenses; they may be renumbered when merged into the root log. Suggested parent line: mint decision IDs (D-MB-NN) for P2-DC-02/04/05/08/10/13/14/20/46 and re-point the docs.
- P2-DC-92 (Medium): review fixes WR-03/WR-04 add process-level state in `platform/mcp-builtin-status.ts` (replaced names; name owners), written by the registration step, because the frozen reader takes only `pi`; a replaced server then disabled in /mcp reads "not connected" (amends P2-DC-10).
- P2-DC-93 (Low): a built-in row whose name another record owns reads "not loaded"; only a user row owned by a project record reads "overridden by project scope" (amends P2-DC-14).
- P2-DC-94 (Low): WR-01 containment per record: a git record bounded by its own `plugin-clones/<key>` entry, a path record by its marketplace root, which for a non-path marketplace must sit inside `sources/<mp>/` (amends P2-DC-13).
- P2-DC-95, 96 (Low): non-path marketplaces, including unknown kinds, fail closed; a server whose resolved command or argument starts with `~` is refused (Pi would expand home; Claude keeps it literal); info shows "not loaded".
- P2-DC-97..99 (Low): no cucumber scenario for the WR-03 race or the WR-04 cross-marketplace case (unit only); WR-05 reads the probe report from the session record log; debug lines reuse the shared path redaction.

#### Phase 5 wave 3 gate (received 2026-11-04 16:39Z; gate green on cd5c7b4: adapter 1168+392, builtin 44/44, coverage, test:modules; red sweep against Phase 1 hooks code: builtin 5/5 MCP hook scenarios fail, adapter 23/23 pass)

- P5-DC-37 (Low): gate shortcuts: after the sweep only the two hook feature files were re-run; 20 untagged tool-use rows proven by total only; `/tmp/jiti` not cleared before the sweep; parent lines drafted by the executor; the post-Phase-2 note assumes Phase 2's registration keeps Pi's namespace alias equal to the registered name (`-` kept), which no frozen interface states.

#### Phase 4 verification and transition (received 2026-11-04 16:49Z; VERIFIED 3/3 with three accepted gaps; security threats_open 0; branch at ba0c33f)

- P4-DC-76 (High): verification passed despite the cascade-update grant gap (P4-DC-13/60); closure is parent line 2 after Phase 3 merges.
- P4-DC-77, 78 (Low): the verifier reused gate logs; two sources edited briefly for red proofs and restored.
- P4-DC-79 (Low): `nyquist_compliant: true` with the accepted gaps untested.
- P4-DC-80 (Medium): fixed a pre-existing frontmatter-injection path in `convert.ts` (a tools token with an unclosed `(` plus a line break; UF-1/T-04-01) instead of leaving it as an open medium threat (commit 16b53bf).
- P4-DC-81, 82 (Low): ASVS 1 / block-on-high defaults; UF-2 advisory: the rewrite's read-then-rename window can lose an editor save; no change.

#### Phase 2 verification (received 2026-11-04 16:54Z; verifier: human_needed, 5/7 truths verified, none failed)

- P2-DC-100 (High): the two human items were accepted provisionally so the phase could transition: (1) BLT-04 "reported, never silent" is met only by info (`overridden by mcp.json`) and Pi's /mcp, and a foreign owner of the name is only debug-logged (P2-DC-08/46): accept, or open a load-time-notice follow-up; (2) built-in /reload and in-session new-session re-registration are unproven by a scenario (P2-DC-77, P2-DC-88): manual UAT steps in `02-UAT.md`. The VERIFICATION status was set to passed by this disposition, not by a human. Alternative: leave human_needed and stop before transition.
- Parent: REQUIREMENTS.md traceability for Phase 2's 11 IDs is left for the parent.

#### Phase 2 security, validation, and transition (received 2026-11-04 17:01Z; DONE, branch at 73db55e)

- Security: SECURED, 46/46 threats closed; advisories UF-2 (a path-kind marketplace root comes from the same state.json and cannot be bounded further), UF-3 (the description read's manifestPath has no containment check; only a description string reaches Pi), UF-4 (the frozen legacy reader's debug line is unredacted), UF-5 (the stand-in loads idle).
- Validation: `nyquist_compliant: false`: manual rows for /reload (BLT-01/MSEL-02, not run) and BLT-04 (no load-time report); everything else green.
- P2-DC-101 (Low): the transition ran `phase.complete 2` and skipped evolve_project and update_project_reference (children never edit PROJECT.md).

#### Phase 5 code review and fix (received 2026-11-04 17:03Z; 0 critical, 1 warning, 5 info, all fixed; head 1d638d7)

- P5-DC-38 (Medium): a matcher with the folded tool segment fires only when Pi did not hash the name; for a name over 64 characters, or one another tool of the same server already sanitizes to, only Claude's full name (with `-`) fires. Behavior cannot change; docs and contract corrected (narrows P5-DC-04). A hook written with the folded name silently never fires on such tools.
- P5-DC-39 (Low): under built-in, a server-prefix matcher `mcp__<S>__.*` fires only when `<S>` is exactly the registered server name; for a server named `a__b`, `mcp__a__.*` fires in Claude Code and under the adapter but not under built-in. Documented only.
- P5-DC-40 (Low): the view keeps its first proxy-rule answer per generation; a failed first read under the adapter keeps false until /reload (proxy calls then run hooks twice). Documented only.
- P5-DC-41 (Low): cleanups (unreachable check removed, `MCP_TOOL_PREFIX` shared, a stale comment fixed).

#### Phase 5 verification and transition (received 2026-11-04 17:32Z; DONE: verified 6/6, security 17/17 closed, Nyquist validated; branch at 4ca8e2d)

- P5-DC-42 (Low): orchestration shortcuts: executors read the GSD files by path; code review and fix ran before the verify:post security and Nyquist audits; the transition skipped evolve_project; the regression gate reused the post-fix full check; a wave-1 worktree cleanup was finished by hand.

### Merges into features/mcp-builtin (parent, 2026-11-04 17:40-18:10Z)

#### P6-PRE-01: Merge integration choices

- **Severity:** Low. **Status:** open.
- Phase 5 merged first (tree identical to its head, so its own final gate covered it); Phase 4 and Phase 2 merged with conflicts only in REQUIREMENTS.md, ROADMAP.md, and STATE.md, resolved by keeping every phase complete.
- The first 5+4 gate failed only on Phase 3's `@builtin-only` update row in `verdict-markers.feature`; the parent applied Phase 4's parent line 1 on the milestone branch (commit 0bec3c2) instead of waiting for Phase 3, so the milestone stays green; Phase 3 takes the milestone's text at its merge.
- After the Phase 2 merge the parent applied Phase 2's companion-missing cell (`status unknown` -> `not loaded`, commit d1711fd) for the same reason.
- The combined tree had one new fallow clone group (the same scenario-file write in Phase 5's `tool-use.steps.ts` and Phase 2's `builtin-status.steps.ts`); the parent extracted `features/lib/scenario-file.ts` (commit e4eff85) instead of adding a fallow-ignore marker.
- One gate run covers the 5+4+2 tree (the 5+4 gate stopped at cucumber, so its coverage step did not run on that tree alone).

#### Phase 3 wave 4 (received 2026-11-04 17:52Z; gate green: adapter 1582/1582, builtin 54/54)

- P3-DC-82 (Medium): `toInstallLedgerSummary`'s `summary.resolved` is now the active view for every consumer (alternative: a separate member).
- P3-DC-83 (Medium): enable/update/apply switch scenarios use a fresh built-in Pi (install under the adapter-profile Pi, act from a Pi running built-in), since a restart without pi-mcp-adapter lands on none; one load-row scenario turns built-in off in settings, then restarts with it on.
- P3-DC-84..86 (Low): a type-only narrowing; hand-built options pass `consentView "none"`; an enable cascade member row stays `installed {dependency enabled, requires pi-mcp-adapter}` under built-in for an sse member.
- P3-DC-87 (Medium): 03-06 edits Phase 1's record writers (`applyAllSuccessRecordFields`, `markUpdateInProgress`, `refreshDisabledRecord`/`nextDisabledPin`) minimally; watch the merge with Phase 4's `prepareUpdateAgents` in the same file.
- P3-DC-88..93 (Low): update-swap.ts imports mcp-verdict-read.ts; autoupdate with no notification reads `?? "none"`; newlyDegraded read at swap start; a missing marketplace throws marketplace-removed; fixtures name `mcpImplementation "none"`; a `--partial` update under built-in is now a warning row (was info).
- P3-DC-94 (Medium): apply holds more moves: a record already partial for one kind is held when the candidate drops a new kind (D-12 moved it before). Alternative: ask only when the record is installable.
- P3-DC-95 (Medium): AMIG-01 converts every moving legacy record to the neutral basis, so the first reload after the upgrade writes state.json even for a plain stdio move. Alternative: write only when the verdict differs.
- P3-DC-96..99, 101..103 (Low): `applyNeutralVerdict` (renamed from `applyDroppedServers`) passes the record with its basis; migration suite defaults to the neutral basis; read-pass test edits are compile-forced only; the e2e foreign-tool case turns built-in MCP off; `mcpDependencyOf` reads every declared server (sse plus stdio under built-in reads `requires: pi-mcp-adapter (missing)`); a not-installed sse plugin under built-in shows `requires: pi-mcp-adapter (missing)`.
- P3-DC-100 (Medium): the second companion-missing info scenario installs while pi-mcp-adapter is active, proving only that a loaded adapter gives untagged `mcp`.
- P3-DC-104 (Medium, a fix after merge, 1178bd7): apply's catalog move now carries the run's implementation (`PluginConvergeTarget.mcpImplementation` in orchestrators/types.ts), so a move to an sse version under built-in reports `partially-installed {unsupported mcp, requires pi-mcp-adapter}` instead of `updated {requires pi-mcp-adapter}`.

#### Phase 3, wave 5 (03-09, the milestone merge into Phase 3)

- P3-DC-105 (Low): the 03-09 executor's commits name its own session in the `Claude-Session` trailer, not the parent session. History is not rewritten.
- P3-DC-106 (Low): `invalid-configs.feature` keeps `@adapter-only` on its two tool-call scenarios and adds `@builtin-only` twins that prove the skipped server through `pi lists these registered mcp servers:` (that step lists nothing under pi-mcp-adapter). D-P3-18 asked for one `@mcp` scenario.
- P3-DC-107 (Low): STATE.md frontmatter counters were combined by hand at the merge.
- P3-DC-108 (Low): `companion-missing.feature` restores `status unknown` (eb4ebf7), because Phase 3's rewritten scenario turns Pi's built-in MCP off. The parent's d1711fd `not loaded` is deliberately dropped there. The merge commit body says the opposite.
- P3-DC-109 (Low): Phase 4's `installGrantedAgent` test helper passes the run's implementation as `consentView` (compile-forced at the merge).
- P3-DC-110 (Low): Phase 2's `builtin-status.feature` `plugin requires` cells (seven) now read `[{"companion":"mcp","missing":false}]` under Phase 3's `requires:` rule.

#### Phase 3, code review and fix (03-REVIEW.md iterations 1-3, 03-REVIEW-FIX.md), reported 20:11Z

- P3-DC-111 (Low): `lifecycle.feature:396` "A new session offers the plugin's tool again" (Phase 2) failed once in Phase 3's gate on the merged tree (seed 115524). It passed 4/4 alone and in a full adapter rerun (1599/1599, seed 888709). Treated as a load flake.
- P3-DC-112 (Medium): review decisions. CR-01 fixed: a migrated legacy bare-elicitation plugin lost its MCP servers on read surfaces. WR-01 fixed: an unreadable record never holds an apply move or flags `newlyDegraded` for MCP alone. WR-02 fixed for cascades only: dependency moves ask only for a new degrade, while a plain user-run `update` keeps today's rules (D-P3-12/D-MB-06). IN-01 titles reworded, IN-02 style guide applied, IN-03 skipped.
- P3-DC-113 (Medium): CR-01 and WR-01 have no cucumber scenario, because no step seeds a released-build legacy record. Unit and integration tests prove them.
- P3-DC-114..121 (Low): the WR-01 excuse is narrowed (a ws server that no implementation runs still asks); an excused record moves with `partial:true`; WR-02 goes through an injected lazy port `readRecordDegradeBaseline`; pending twins were folded once (later reversed); CR-01 writes configs only when it rewrites the verdict or basis; IN-01 titles reworded; IN-02 lists reinstall rows.
- P3-DC-122 (Medium, supersedes P3-DC-117): `pending` previews a declared fresh install under the ACTIVE implementation (D-P3-15 literal). Under built-in, an sse plugin previews `(will install)` with `partial:true`, while `apply` refuses that install with `(failed) {unsupported mcp}`. This pending/apply mismatch existed before Phase 3 for every partially-available kind. PARENT LINE (BACKLOG): "apply refuses a declared install pending previews as will partially install; choose one behavior for both".
- P3-DC-123 (Low): an unreadable legacy record (no basis) under the adapter counts as readable, so its new drops are not excused.
- P3-DC-124 (Medium): AMIG-01 writes verdict, basis, configs, and bundle only from the RECORDED version's servers (the frozen `recordedMcpServers`, which refuses a version mismatch). Otherwise the record stays fully legacy. Staging still uses the current checkout (reinstall parity).
- P3-DC-125 (Low): an AMIG-01 integration test deletes the install's `mcpServerConfigs` so it looks like a released record.
- P3-DC-126 (Low): a dependency move skips `--partial` only when it drops `mcpServers` alone.
- P3-DC-127 (Low): REVIEW-FIX.md lists iteration 2 first.

#### Phase 3, verification and transition (reported 20:32Z; branch verified at 0ac2d71)

- P3-DC-128 (Low): the review loop ran before the verifier, and the full gate stood in for GSD's regression gate.
- P3-DC-129 (Low): the Phase 3 parent wrote 03-VERIFICATION.md and 03-SECURITY.md from the reports the verifier and auditor returned, because their harness forbids them to write report files.
- P3-DC-130 (Low): transition ran in post-completion mode, and its PROJECT.md evolve step became parent lines.
- P3-DC-131 (Low): phase.complete's verification-debt warnings are false positives (relative paths and commands in SUMMARYs).

## Phase 6 (parent session)

## Smart discuss (06-CONTEXT.md)

- **P6-DC-01 (Medium):** DUAL-04 extends Phase 2's switch scenario with a
  `{requires mcp}` read after the adapter is removed (D-P6-05), and adds no
  separate scenario. The alternative is a new scenario that repeats the
  install and the restarts.
- **P6-DC-02 (Medium):** a frozen export that still has no consumer loses its
  `export` or is deleted, and is not kept under `ignoreExports` (D-P6-08). The
  alternative is to keep it for a future consumer.
- **P6-DC-03 (Medium):** the parent lines that are not docs or records go to
  BACKLOG.md, except the eight code changes D-P6-10 lists (D-P6-12). The
  alternative is to apply more of them now, such as P5-DC-15.
- **P6-DC-04 (Low):** the Pi 1.5.0 RPC defect is drafted in BACKLOG.md and is
  not filed upstream (D-P6-11).
- **P6-DC-05 (Low):** the previous milestone's root log moves to
  `.planning/milestones/component-features-DUBIOUS-CHOICES.md`, and the new
  root log takes its path (D-P6-14).
- **P6-DC-06 (Low):** the codebase maps get targeted edits, and
  `/gsd-map-codebase` is not re-run (D-P6-15).
- **P6-DC-07 (Low):** a CI behavioral timeout changes only above 80% use
  (D-P6-16).
- **P6-DC-08 (Low):** the version bump and the PR wait for the user review
  (D-P6-17).
- **P6-DC-09 (Low):** the CHANGELOG folds the existing Pi 1.5.0 bullet into
  one milestone lead bullet with sub-bullets (D-P6-01).
- P6-PRE-02 (Low): the post-merge gate on a25cd35 counted one adapter TUI readiness timeout (`background-update.feature:192`, seed 992831) as a load flake. It passed alone (seed 681540). The rest of the chain (builtin 129/129, direct coverage) then ran separately, not as one `npm run check` invocation.

- **P6-DC-10 (Medium):** the DUAL-04 read is `/claude:plugin list`, and a
  read-only `list` does not count as a "plugin command" (D-P6-18). The
  alternative is reading through the extension's LLM tool in a model turn,
  which renumbers every later call.
- **P6-DC-11 (Medium):** all nine stale `requires: pi-mcp-adapter` catalog
  blocks change, not only the two the parent lines name (D-P6-19).
- **P6-DC-12 (Low):** no closed-set entry is removed, since each has an
  emitter (D-P6-20).
- **P6-DC-13 (Low):** `StoredMcpCompatibility` and `LegacyServers` stay
  exported, against the letter of D-P6-08. `LegacyServersUnreadableError`
  is unexported, so its test moves from `instanceof` to matching `name` and
  `reason` (D-P6-21).
- **P6-DC-14 (Medium):** P3-DC-22 gets a cucumber pair that calls the
  completion provider in-process with the profile's implementation. The
  observation does not go through Pi's terminal UI (D-P6-22).
- **P6-DC-15 (Medium):** UF-1 (a low-severity advisory) changes the former
  frozen `LegacyServersSource` interface across about nine call sites
  (D-P6-23). The alternative is to accept the risk in SECURITY.md.
- **P6-DC-16 (Low):** D-MB IDs are minted for seven more cited P2-DC IDs
  (D-P6-24).
- **P6-DC-17 (Medium):** D-CF1-16's 1.5-times rule replaces D-P6-16's 80% rule
  (D-P6-25).
- **P6-DC-18 (Low):** the 02-08 status examples become prose and table rows,
  not counted catalog states (D-P6-26).
- **P6-DC-19 (Low):** P2-DC-18 is only a file move to
  `features/lib/upstream/tool-search.ts`. The separate projection step
  stays, which leaves a second projection path.
- **P6-DC-20 (Low):** the Elicitation rows in `docs/hooks-compatibility.md` may
  be reworded to name Pi's built-in MCP. That wording is not checked against
  a source.

- **P6-DC-21 (Low):** the completion cache keys its file name by the MCP
  implementation, so the file shape does not change and `schemaVersion`
  stays 6. The alternative is a new field with a schema bump.
- **P6-DC-22 (Low):** a containment failure in the legacy reader gets its own
  internal reason, `uncontained`, if no notification closed set carries the
  reasons. Otherwise it maps to `root-mismatch`. The planner checks the lock
  tests.

## Phase 6 planner (eeb093a)

- **P6-PLN-01 (Medium):** the DUAL-04 switch scenario gets three
  `/claude:plugin list` reads (adapter boundary, `{requires mcp}` row,
  built-in boundary). ROADMAP criterion 2 says "no plugin command runs in
  between"; `list` changes no state, but a reader may count it as one.
- **P6-PLN-02 (Medium):** plans that carry out parent lines list
  already-complete requirement IDs as proxies (MGRT-01, MREC-03, BLT-01,
  BLT-02, MREC-02, MSEL-01, DUAL-01, DUAL-03). Traceability reads oddly.
- **P6-PLN-03 (Medium):** the completion cache gets a stamp field and a
  `schemaVersion` bump to 7. This reverses P6-DC-21 (per-implementation file
  names), because six invalidation sites unlink one `pluginCacheFile` path.
- **P6-PLN-04 (Low):** the stamp option is optional; absent means unstamped,
  so a caller that forgets it writes rows any implementation can read.
- **P6-PLN-05 (Medium):** no cucumber scenario for the cache stamp or UF-1
  containment, only unit tests. Both are visible only for stale or tampered
  files, but AGENTS.md asks for a scenario for visible behavior.
- **P6-PLN-06 (Medium):** the "which did not fail" strictness re-check
  (02-08 item 9) goes to BACKLOG STRICTINSTALL-01 instead of being settled.
- **P6-PLN-07 (Medium):** oversized tasks: 06-03 has 18 files, 06-08 15,
  06-09 34 (the `piMcpAdapterLoaded` removal). Atomic for typecheck.
- **P6-PLN-08 (Low):** D-MB-14..29 are minted in strict P2-DC order,
  including P2-DC-13, which no doc cites.
- **P6-PLN-09 (Low):** the gate and CI handoff run in wave 4 and the records
  in wave 5; the gate stays valid because 06-13 changes only `.planning/**`.
- **P6-PLN-10 (Low):** the gate runs CI's parts in a `gate.sh` (fresh ESLint
  cache, e2e, peer-floor install) instead of one `npm run check`.
- **P6-PLN-11 (Low):** the red-proof worktree at d1711fd runs its own
  `npm ci` (no `node_modules` symlink).
- **P6-PLN-12 (Low):** seven parallel plans in wave 1.
- **P6-PLN-13 (Low):** `candidateFor` moves into
  `plugin-state-classifier.ts` rather than being exported from
  `list-installed-row.ts`.
- **P6-PLN-14 (Low):** the elicitation wording in the hooks doc rests on a
  grep (no elicitation code in Pi 1.5.0); it may change after a Pi upgrade.
- **P6-PLN-15 (Low):** the READMEs link to decision docs instead of citing
  decisions inline.
- **P6-PLN-16 (Low):** the stand-in wait is bounded at 10 s with a 50 ms
  poll, a judgment, not a measurement.
- **P6-PLN-17 (Low):** the assumption-delta is recorded as "promote" in
  06-03 and 06-09.
- **P6-PLN-18 (Low):** tests and implementation are committed together, with
  RED recorded in the SUMMARY rather than separate red commits.
- **P6-PLN-19 (Low):** all window actions sit in 06-10, which depends on the
  other plans' SUMMARYs.
- **P6-PLN-20 (Low):** the `update --partial` completion pair makes a plugin
  partial with a broken `hooks/hooks.json`, not an MCP-only degrade.
- **P6-PLN-21 (Low):** Phase 6's own requirements move to Validated at the
  transition, not in 06-10.
- **P6-PLN-22 (Low):** the D-P3 and D-P5 row IDs stay as written; two ID
  schemes in Key Decisions.
- **P6-PLN-23 (Low):** the root log copies this working log from its first
  `##` section and writes a new preface; the High list is computed from
  severity markers in every source, so P4-DC-06 lists as High (Medium in its
  phase log).
- **P6-PLN-24 (Low):** parent-line labels group some lines (02-08 items 10-12
  as PL-37, the 03-09 addendum CHANGELOG lines as PL-56); repeated parent
  notes are PL-90.N sub-rows.
- **P6-PLN-25 (Low):** the ROADMAP progress row reads `0/13`, status
  "Not started".

## Phase 6 plan check

- **P6-CHK-01 (Medium):** checker iteration 1 was a spot check that found 0
  blockers and 4 scope warnings (06-09 at 27 files, 06-03 at 18, 06-08 at 15,
  and 06-11 tagged only DUAL-01). The parent kept the plans unsplit: the
  required-field edits must land in one commit for typecheck. It added a
  sizing note to 06-09 and a proxy-tag note to 06-11 by hand, instead of
  sending them to a planner revision, and ran a full-read iteration 2.
- **P6-CHK-02 (Low):** the checker rated plans of 15 or more files as
  warnings, although its own threshold table calls them blockers.
- **P6-CHK-03 (Medium):** checker iteration 2 (a full read) found 1 blocker,
  RESEARCH Open Questions not marked RESOLVED; the parent marked them. It
  also found 6 warnings, which a revision planner fixes (iteration 3):
  commit titles over 72 characters, `test:modules` in 06-09, e2e required in
  the 06-12 gate, no failing greps for MDOC-02's statements, plans over the
  budget, and DUAL-04's three `list` reads.
- **P6-CHK-04 (Medium):** DUAL-04 now keeps ONE `/claude:plugin list` read,
  the `{requires mcp}` row (D-P6-18). It drops the adapter-side and
  built-in-side boundary reads that the planner added, to stay closest to
  "no plugin command in between". 06-13 records D-P6-18's reading against
  DUAL-04. This supersedes P6-PLN-01.
- **P6-CHK-05 (Medium):** the 06-12 gate keeps e2e and the peer-floor install
  as recorded parts outside the required pass count. A network-reach failure
  is recorded as "deferred to CI e2e-tests", not fixed in a loop; an
  assertion failure still fails the gate.
- **P6-CHK-06 (Low):** plans over the 100k estimate (06-03, 06-08, 06-10,
  06-11, 06-13) stay unsplit, each with a commit-per-task note.
- **P6-CHK-07 (Low):** the cache stamp and UF-1 containment still ship with
  unit proofs only (same as P6-PLN-05); the checker left it as INFO for the
  user.
- **P6-CHK-08 (Low):** every plan hard-codes the `Claude Opus 5.5`
  co-author trailer, as the session's attribution reminder gives it.

## Phase 6 plan revision (835ef31)

- **P6-REV-01 (Medium):** a failed e2e part counts as "network-unavailable,
  deferred to CI" only because the executor reads the log and writes the
  deferral line. The check verifies only that the line exists. The backstop
  is threat row T-06-29 (quote the cause) and CI's `e2e-tests` job.
- **P6-REV-02 (Medium):** the revision planner fixed the Spanish README
  phrases ("activa el MCP integrado de Pi o instala pi-mcp-adapter", "Cuando
  los dos están cargados, pi-mcp-adapter ejecuta") as exact grep targets.
  The English ones are fixed the same way. Any later rewording by the readme
  or humanizer pass must keep these strings.
- **P6-REV-03 (Low):** the 15-minute CI floor is attributed to ci.yml's
  current value. PROJECT.md's D-CF1-16 row also says "never below 15
  minutes".
- **P6-REV-04 (Low):** `test:modules` stays a required gate part (`unit`)
  beside the seven `npm run check` parts, because ROADMAP criterion 3 names it.
- **P6-REV-05 (Low):** 06-06 Task 2 now requires two D-MB-08 citations, and
  Task 1's `my-db` grep became a regex because the old check already passed
  at HEAD.
- **P6-REV-06 (Low):** the 06-12 MDOC-02 check uses stand-in strings (a `_`
  code span for the CHANGELOG fold, `/plugin MCP servers/i`). It also checks
  two statements beyond the original step (3) list.
- **P6-REV-07 (Low):** a new threat row, T-06-29, covers the e2e deferral.
- **P6-REV-08 (Low):** the D-P6-18 reading goes in an indented line under the
  DUAL-04 bullet in REQUIREMENTS.md. The requirement text and its
  traceability row stay as they are.
- **P6-REV-09 (Low):** gate.sh skips e2e when the e2e install fails. A
  non-network install failure must still be called a gate failure by the
  executor.
- **P6-REV-10 (Low):** 06-09 keeps its commit-hook fallback line that names
  `test:coverage:direct:all`, as Task 1's replacement for the hook.
- **P6-REV-11 (Low):** the plan check stops after three iterations without a
  fourth checker pass over the iteration-3 edits. The revision planner tested
  each new command against scratch copies, and both probes report 0/0 on 94
  commands. The parent changed the ROADMAP's "DUAL-04 reads" to "read".
- **P6-REV-12 (Low):** the revision commit used `SKIP=trufflehog git commit`,
  as the committing skill allows for this session.

## Phase 6 execution (orchestrator)

- **P6-EXE-01 (Low):** wave 1 runs all seven plans in parallel on a 4-CPU
  container, each in its own worktree with its own `npm ci`. Executors are
  told to run one scenario or test file at a time, and 06-05 is told to say
  its flake runs were under parallel load. The alternative was two batches,
  4 then 3.
- **P6-EXE-02 (Low):** executor prompts list the GSD contract files
  (execute-plan.md, the summary template, checkpoints.md, tdd.md for 06-02
  and 06-03, worktree-path-safety.md, executor-examples.md) for the executor
  to Read. They are not inlined verbatim (about 130 KB each), the same way as
  in Phase 1.
- **P6-EXE-03 (Medium):** six of the seven wave-1 executors (06-01 to 06-06)
  died before their first model turn. The project's SubagentStart hook
  (`scripts/init-worktree.sh`: a full `npm install` with scripts, then
  `codegraph init`) ran seven at once on 4 CPUs, and after about 10 minutes
  the hook was cancelled and the stall watchdog fired. The worktrees of 06-01
  and 06-02 were also missing 1,268 tracked files (`extensions/`,
  `features/`, `test/`). Nobody committed anything. The parent re-dispatches
  the six plans one at a time, waiting for each start hook to finish. Each
  prompt gains an incomplete-checkout halt, and the executor skips
  reinstalling when the hook's `npm install` left the lockfile unchanged
  (the plans say `npm ci --ignore-scripts`). This supersedes P6-EXE-01. The
  hook script was not changed; a hook timeout or lighter worktree setup is a
  user decision.

### 06-01 executor (58ab863, cbcf825)

- **P6-DC-0101 (Low):** the D-P6-18 comment stays one line of about 160
  characters, as the plan wrote it.
- **P6-DC-0102 (Low):** the red run used `npm run test:cucumber:profile` in a
  red worktree with its own `npm ci`, not the research's `npx cucumber-js`.
- **P6-DC-0103 (Low):** both green seeds are reported (323157, 391967).
- **P6-DC-0104 (Low):** the 02-08 item 9 switch-part parent line is "verified,
  no change". The three `the session reports no results` restart rows pass
  as they are. No extra per-restart reads were added (D-P6-18 forbids them).
- **P6-DC-0105 (Low):** the commit ledger file in `.git/worktrees/<id>/` was
  not written, because the isolation guard refused the write. Commits are
  measured from the dispatch base 37f1cfd.

### 06-07 executor (7b04f94, d343443, bf66a4c)

- **P6-DC-0701 (Low):** all nine catalog blocks become `mcp`. The `analytics`
  transport (http) was taken from `test/orchestrators/plugin/info.test.ts:7665`.
- **P6-DC-0702 (Low):** the 3161 block keeps `status unknown`, not 02-08's
  `not loaded`, because its probe finds no MCP implementation.
- **P6-DC-0703 (Low):** no example blocks for `overridden by mcp.json` and
  `project not trusted` (D-P6-26), only table rows and prose.
- **P6-DC-0704 (Low):** the built-in status table gives the check order of
  `info-mcp-status.ts` ("first match wins"). It also adds the
  `ownedElsewhere` cause of `not loaded`.
- **P6-DC-0705 (Low):** the every-companion prose keeps the adapter's name
  ("an MCP implementation, pi-mcp-adapter, loaded"), so that "the adapter"
  in the next sentence has a referent.
- **P6-DC-0706 (Low):** the D-MB-07 sentence becomes an exact three-case rule
  (the `split` shape breaks 03-09's short form).
- **P6-DC-0707 (Low):** the 3161 prose says why no implementation runs:
  the adapter is absent and the user's settings turn off built-in MCP.
- **P6-DC-0708 (Low):** two places add "with none active" qualifiers. The
  others keep the short form.
- Deviation: "pi-mcp-adapter is not loaded" was reworded to "is absent",
  because `partial-vocabulary-guard.test.ts` bans the phrase (D-75-01).

### 06-02 executor (670f742, 75c1d48, c48face)

- **P6-DC-0201 (Low):** the "arguments win" unit case reuses
  `runWithAllLoaded()` as the adapter run, not a new `adapterRun()` helper.
- **P6-DC-0202 (Low):** `updateAgentImplementation` is deleted. The grant reads
  `args.mcpImplementation` with no fallback chain, against the 04-06 parent
  line's order: the field is required, so the fallbacks could never run.
- **P6-DC-0203 (Low):** to show the adapter twin passes before the fix, the
  executor swapped back one file (`update-swap.ts`) and did not check out a
  full base tree.
- **P6-DC-0204 (Low):** the autoupdate cascade path has unit coverage only. The
  scenario covers `apply` convergence. An autoupdate run with a notification
  but no `preflightNotification` also changes behavior, and no scenario
  observes that.
- **P6-EXE-04 (Medium):** a container restart killed the 06-03, 06-04, 06-05
  and 06-06 executors. What survived:
  - 06-03: Task 1 committed (29135b2), Task 2 uncommitted.
  - 06-04: two commits (c5445ba, ec36113) and a staged rename.
  - 06-05: uncommitted edits.
  - 06-06: nothing.
  The parent saved the uncommitted edits as patches in the scratchpad. It
  then started continuation executors in new worktrees, which fast-forward
  onto the old branch, apply the patch as a draft, and finish. The old
  worktrees stay until the wave merges.

### 06-04 executors (c5445ba, ec36113, ed1b7a7, ee217b0)

- **P6-DC-0401 (Low):** the "both readers" `plantPlugin` titles were renamed to
  "three readers", beyond the plan's "four" → "five" rename.
- **P6-DC-0402 (Low):** the entry-description fallback is proven in one case
  only. The stop and link cases expect `undefined` from an entry with no
  description, which cannot tell a fallback from nothing.
- **P6-DC-0403 (Low):** the red proof reversed the `find` in
  `builtin-description.ts` instead of reordering `MANIFEST_CANDIDATES`.
- **P6-DC-0404 (Low):** `test:integration` ran with `TEST_CONCURRENCY=2`.
- **P6-DC-0405 (Low):** Task 1's direct-coverage and integration evidence was
  re-run on the final tree (after the restart), not between tasks.
- **P6-DC-0406 (Low):** the SUMMARY lists BLT-01 and BLT-02 as completed but
  does not mark them in REQUIREMENTS.md (orchestrator-owned).

### 06-05 executors (230b60d, 938a127)

- **P6-DC-0501 (Low):** one bounded wait covers every stand-in, including a
  non-integer pid. A malformed pid file holds the check for the full 10 s
  before the scenario fails.
- **P6-DC-0502 (Low):** the 10 s bound sits inside the `After` hook's 30 s
  step budget. On a loaded runner, stop plus the wait plus the other releases
  could approach the hook limit; that would fail, not pass falsely. The
  stub's real exit time was not measured.
- **P6-DC-0503 (Medium):** no upstream report was drafted, because the `@mcp`
  lift passed (D-P6-11, branch a). The Pi 1.5.0 defect remains: RPC
  `new_session` runs `session_start` twice, and the built-in MCP keeps the
  first connection's server process alive until Pi exits. A real user's
  server process can leak once per new session. The harness now tolerates
  the leak; the leak itself is not fixed. Whether to report it upstream is a
  user decision.

### 06-03 executors (29135b2, cd2f629, 7d24997, e9f880d)

- **P6-DC-0301 (Low):** a cache read with no implementation option is its own
  stamp (unstamped matches only unstamped). See P6-PLN-04.
- **P6-DC-0302 (Low):** Task 2 removed Task 1's `dropMarketplaceCache` call from
  a register test. The stamp alone now forces the rebuild. The shared seeds
  are stamped `none`.
- **P6-DC-0303 (Low):** the RED fixture used `rm(..., { force: true })`, so the
  old code fails on the planned assertion.
- **P6-DC-0304 (Low):** Task 3's setup check is not a `list` run. `list`
  cannot show the difference, so the proof is an edge-deps unit pair plus
  the built-in scenario.
- **P6-DC-0305 (Low):** `candidateFor`'s unit RED is a module load failure,
  because the change is a pure move.
- **P6-DC-0306 (Low):** completion reads the MCP verdict of a disabled record
  too. `list` short-circuits before that read. The result is the same.
- **P6-DC-0307 (Low):** the cache schema repeats the implementation literals
  inline in shared/. A fourth implementation would force a rebuild on every
  read; it would never serve wrong rows. Typecheck does not catch the drift.
- **P6-DC-0308 (Low):** completion takes one inventory snapshot per lookup, not
  memoized (MSEL-01; T-06-07 accepts the cost). The inherited Task 1 also
  edited `marketplace-add-seed-mirrors.test.ts`, outside `files_modified`.
- **P6-DC-0309 (Low):** the Task 3 pair installs with `--partial` under the
  adapter too, so the two members' Givens stay identical.
- Note: the parent line says "the run's active MCP implementation". Completion
  has no run, so the read is per lookup. 06-13 may want to reword the
  disposition.

### 06-06 executor (81cc18c, aa665c7, 8969c18, e67e945)

- **P6-DC-0601 (Low):** the agents-bullet sentence goes right after "Requires
  pi-subagents.", as the parent line says, not at the end of the bullet.
- **P6-DC-0602 (Low):** the `my-db` row shows both tool-name forms in one cell,
  labeled "(adapter)" and "(built-in)", not in split columns.
- **P6-DC-0603 (Medium):** the README's `{requires mcp}` sentence ("no
  implementation active, and either one can run the servers") does not
  exactly cover the `split` case: some servers run only under the adapter,
  others only under built-in. docs/output-catalog.md holds the exact rule.
- **P6-DC-0604 (Low):** the README says the marker shows in `list` and in the
  install result, not in `info` (`info` shows a `requires:` line).
- **P6-DC-0605 (Low):** the README adds that built-in MCP is on unless the Pi
  settings' `extensions` hold `-builtin:mcp` (which pi-mcp-adapter adds),
  verified in Pi 1.5.0 `dist/core/package-manager.js`.
- **P6-DC-0606 (Low):** the README says hooks see "the server part of a tool
  name as Claude Code writes it", because the built-in tool segment keeps
  Pi's `-` to `_` fold (D-MB-08).
- **P6-DC-0607 (Low):** the Elicitation rows say "Pi 1.5.0 has no
  elicitation" in plain words, resting on an empty grep of `dist/`.
- **P6-DC-0608 (Low):** the built-in refusal text goes in its own paragraph.
  Its full text comes from the 04-RESEARCH measurement; the scenario asserts
  only `plugin_demo_stub`.
- **P6-DC-0609 (Low):** the pi-mcp-adapter prerequisite says "optional" and
  drops "but recommended".
- Dependency: docs/mcp-compatibility.md now cites D-MB-14..29, so 06-10 must
  write those PROJECT.md rows.
- **P6-EXE-05 (Low):** the wave-1 gate (`npm run check` at 2dbfd52) failed in
  direct coverage only: `test/index.test.ts` "owner graph" did not expect the
  per-lookup completion snapshot that 06-03 added. 06-03 never ran
  index.test.ts. The parent fixed it (b09698e, a `PROBES_PER_COMPLETION`
  constant, plus one probe each for the owner and peer loads). It then reran
  only check:static, test:unpaired and test:coverage:direct:all; the
  integration and both cucumber profiles pass at 2dbfd52, and the fix
  changes no input they read. The commit hook skipped `check:commit` ("no
  files to check") for this test-only commit.

### 06-08 executor (41bc6ae, 698a3a6, 0895d5a)

- **P6-DC-0801 (Low):** a legacy git record without `resolvedSha` whose root
  lies under `plugin-clones/` is now refused as `uncontained`, so its stored
  verdict stands. Before, the reader re-resolved it. The old test was
  reshaped. This keeps one rule for the reader and the registration step
  (D-P6-23, D-PL2-23).
- **P6-DC-0802 (Low):** the exported check is named
  `isPluginRootContained(record, source)`.
- **P6-DC-0803 (Low):** a legacy record's containment is checked twice: once by
  the registration step for its debug line, and once by the reader.
- **P6-DC-0804 (Low):** the refusal assertions also pin the error's `plugin`
  and `marketplace` fields, beyond the plan's `{ name, reason }`.
- **P6-DC-0805 (Low):** `classifyInstalledPluginRow` computes
  `locationsFor(scope, cwd)` itself, rather than taking an eighth parameter.
- **P6-DC-0806 (Low):** both commit hooks ran without the nondac prefix. The
  checks were also run by hand with it, and the wave gate is authoritative.
- **P6-DC-0807 (Low):** the `mcp-verdict-read.ts` header still calls the reader
  "frozen". It is left for 06-13's 01-FROZEN.md work.

### 06-09 executor (aeb9c7e, 7a68741)

- **P6-DC-0901 (Low):** `pending.test.ts` also lost its unused `adapterLoaded`
  row field and destructure.
- **P6-DC-0902 (Low):** the deleted "reports the adapter loaded" case was a loop
  that generated 11 tests. The whole loop went, so pi-api.test.ts goes from
  81 to 70 tests and soft-dep.test.ts from 83 to 81.
- **P6-DC-0903 (Low):** `test:coverage:direct:all` was not run by hand. The
  commit hook's `check:commit` ran all pairs, because shared test support was
  staged.
- **P6-DC-0904 (Low):** the `softDepStatus` read-order comment and the
  `runWithMcpAdapterLoaded` helper name were kept.

### 06-10 executor (3fd8819, 511bb30, a65e979, e0c2430)

- **P6-DC-1001 (Low):** the BACKLOG and Last updated dates read 2026-11-05 (the
  actual date), not the plan's 2026-11-04.
- **P6-DC-1002 (Low):** the CHANGELOG entry has 18 sub-bullets. Seven use two
  sentences where the reader need not act, a soft departure from the
  changelog skill's rule.
- **P6-DC-1003 (Low):** the CHANGELOG says "project servers only in a trusted
  project", and it leaves out the hook-name case where the cut falls inside
  the namespace (that case is documented in hooks-compatibility.md).
- **P6-DC-1004 (Medium):** the rationales of Key Decisions D-MB-14..29 are
  paraphrased from the P2-DC entries' Choice, Alternatives and Why-dubious
  fields, because those entries have no rationale field. A paraphrase can
  shift meaning; review these rows.
- **P6-DC-1005 (Low):** the D-P3-06..08 row also cites P3-DC-06.
- **P6-DC-1006 (Low):** the D-P5 rows cite no DC ID and are labeled "settled
  autonomously, pending user review".
- **P6-DC-1007 (Low):** the five new Validated entries go at the top of the
  list.
- **P6-DC-1008 (Low):** the `windows status` output is summarized in the
  SUMMARY, not pasted.
- **P6-DC-1009 (Low):** the executor read only `templates/summary.md` of the
  five GSD contract files in full, to keep reads targeted. The plan has no
  checkpoints.
- **P6-DC-1010 (Low):** two BACKLOG statements were inferred, not tested:
  MCPV2-02's "Pi exposes a denied tool like any other" under built-in, and
  STRICTINSTALL-01's "no Phase 6 plan owns the strict-install edit".
- Records: 17 BACKLOG entries; window 112 fixed (13 open, 47 fixed); 23 new
  Key Decisions rows, all Pending (the Pending count went from 6 to 29).

### 06-11 executor (d6157b2, 0ca5ee6, 9ab4c42, c7ee68f)

- **P6-DC-1101 (Low):** CONVENTIONS.md's `npm run check` line also gains
  `test:cucumber` and `check:features`.
- **P6-DC-1102 (Low):** ARCHITECTURE.md scopes "every verdict read goes through
  `mcp-verdict-read.ts`" to a record's verdict and names its importers. The
  AMIG-01 move and completion do not import it, so the plan's wording would
  overclaim.
- **P6-DC-1103 (Low):** STRUCTURE.md gains one `features/` line and a short
  entry, not a full tree.
- **P6-DC-1104 (Low):** the cucumber skill states "up to 10 seconds" and names
  `STAND_IN_EXIT_TIMEOUT_MS`.
- **P6-DC-1105 (Low):** the code-duplication marker breakdown was corrected from
  the marker reasons. The old text placed one marker in the wrong pair.
- **P6-DC-1106 (Low):** phase words in the frozen-export bullet were replaced
  with D-P6-08/21.
- **P6-DC-1107 (Low):** the STACK pi-subagents bullet adds a D-MB-12 summary to
  the drafted text.
- **P6-DC-1108 (Low):** the load flow numbers the resync as step 3. The grants
  step (at `session_start`) is described in the intro as amending APL-D1.
- **P6-DC-1109 (Low):** the plan ledger was not written (guard).
  `plan_head_before` is the dispatch base.
- Measured fallow-ignore count: 45 (7 unused-file, 25 code-duplication, 5
  private-type-leak, 7 unused-export, 1 unused-type).

### 06-12 executor (9e9c116, 1d5f8df; gate on a7f73bf)

- **P6-DC-1201 (Low):** the re-verification table adds a builtin row for
  implementation-switch.feature. The MREC-02 scenario is `@mcp`, so the
  builtin profile runs it; the plan said none ran.
- **P6-DC-1202 (Low):** the gate sha is the base a7f73bf. The plan made no
  product commit, and the diff outside `.planning/**/*.md` is empty, so
  gates.md allows reusing the result.
- **P6-DC-1203 (Low):** a clean `npm ci --ignore-scripts` ran before the gate,
  over the start hook's `npm install`, so the gate matches CI.
- **P6-DC-1204 (Low):** the handoff ends with an empty `## CI timings` heading,
  and the "unverified" line sits in a `## Status` section.
- **P6-DC-1205 (Low):** the README `#name-length` line is recorded as 175, with
  126 noted.
- **P6-DC-1206 (Low):** the tracer verify was not re-run before expanding; the
  gate covered the same sha.
- Gate (a7f73bf, 18 min): check:static (fresh ESLint cache), unpaired,
  integration, adapter 1168+435, builtin 133, direct 350, test:modules, e2e
  install and e2e all exit 0. No flake reruns, no deferrals.

## Phase 6 (execution)

This section holds the P6-DC entries that the working copy above does not
have. Each entry is written once. The working copy above already holds
P6-DC-01 to P6-DC-22 from
`.planning/milestones/mcp-builtin-phases/06-release-docs-and-combined-tree/DUBIOUS-CHOICES.md`, and
one entry for each item of the `## Dubious Choices` section of the
06-01 to 06-12 SUMMARYs (P6-DC-0101 to P6-DC-1206), so they are not repeated
here. The SUMMARYs keep the full text of those entries.

### From `.planning/milestones/mcp-builtin-phases/06-release-docs-and-combined-tree/06-13-SUMMARY.md`

- **P6-DC-1301 (Low):** the root log's `## Phase 6 (execution)` section repeats none of P6-DC-01 to P6-DC-22 and P6-DC-0101 to P6-DC-1206, because the working-log copy above it already has an entry with each ID. The working log's executor entries are short summaries, so the full text of the 80 SUMMARY entries stays only in the SUMMARYs. Alternative: copy the full SUMMARY text again, so one file holds it all, at the cost of a second, longer version of 80 entries. Chosen because the plan's rule writes each entry once.
- **P6-DC-1302 (Low):** the twelve `### High` lines and the 36 `### Other decisions` lines are my own short paraphrases of the entries and the Key Decisions row titles. Alternative: quote each entry's first line verbatim, which is longer and in places unclear without context. A paraphrase can drift from the entry; each line names the file with the full text.
- **P6-DC-1303 (Low):** PL-10 (01-14 "CI") is `applied; open`. The local re-measure is done (9e9c116), and the CI run is not. Alternatives: `left for the user` (the parent, not the user, runs CI) or `applied` (would hide the pending run). Chosen by the plan's rule that a line not done is `open` and listed for the parent.
- **P6-DC-1304 (Low):** the re-verification lines PL-36 (switch and status part), PL-44, PL-76, and PL-88 are `applied` with the gate commit a7f73bf as evidence, although no commit changed anything for them: they ran and passed with no change. Alternative: `nothing to apply`, which would hide that the re-run happened, or `already applied`.
- **P6-DC-1305 (Low):** PL-03 (remove the closed-set entries nothing emits) is `nothing to apply`, because all six are emitted (D-P6-20). Alternative: `applied` with 06-07's record, but 06-07 Task 3 has no commit and nothing was removed.
- **P6-DC-1306 (Low):** PL-32 (02-08 item 5) is `applied; no longer applicable`: the two example blocks became prose and table rows (D-P6-26) and count as applied in d343443, and the line 3161 `not loaded` change no longer applies (P6-DC-0702). Alternative: mark the example-block part `open`, since the blocks the line asked for do not exist.
- **P6-DC-1307 (Low):** the PL-90 group row's outcome is `repeats earlier lines`, outside the plan's list of outcomes, and PL-89 and several sub-rows join two or more `repeats PL-NN` parts. Alternative: give PL-90 one `repeats` label, which no single label fits. The checks read only `applied`, shas, and BACKLOG IDs, so this does not change them.
- **P6-DC-1308 (Low):** in 01-FROZEN.md, the module-private `LegacyServersUnreadableReason` and `LegacyServersUnreadableError` stay in interface 3's code block without `export` and with a `// module-private` comment, as interface 2 shows `hasLoadedBuiltinMcp`. The amended `agentGrantsStep` line keeps `async`, as the source has it, unlike the block's other declarations. Alternative: delete the two private lines and write the step without `async`.
- **P6-DC-1309 (Low):** PL-05 (CHANGELOG with the PR number) and PL-92 (02-UAT.md) carry `left for the user` for their open part. The PR number waits for the PR, which waits for the user (D-P6-17); the 02-UAT.md checks need the user. Alternative: `open`, which would ask the parent to act on something only the user can settle.
