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

## Research step (gsd-phase-researcher, 2026-11-04; adopted by the parent)

### P1-DC-12: D-MB-11 reversed in part: no `clientName`, so Pi keeps CIMD

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

### P1-DC-13: The adapter-profile shared Pi gets seeded onboarding state

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

### P1-DC-14: Each Pi is checked against its own launch configuration

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

### P1-DC-15: `companion-missing.feature` runs `@builtin-only` in Phase 1

- **Phase / source:** Phase 1 research; parent decision.
- **Severity:** Medium. **Status:** open.
- **Choice:** the feature names pi-mcp-adapter and passes only where the shared
  Pi has no adapter, so it is `@builtin-only` until Phase 3 rewrites it.
- **Alternatives:** turn the scenarios into `@own-implementation` profile-Pi
  scenarios now.
- **Why dubious:** an adapter-named feature runs only under the builtin
  profile for a while.
- **Recorded in:** `01-CONTEXT.md` amendments.

### P1-DC-16: The 9 `{requires pi-mcp-adapter}` rows move to one Phase 3 file as tag pairs

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

### P1-DC-17: Phase 1 edits `update-preflight.ts`, a Phase 3 file

- **Phase / source:** Phase 1 research; parent decision.
- **Severity:** Medium. **Status:** open.
- **Choice:** Phase 1 edits `refreshDisabledRecord` and its projection, the
  disabled-plugin update write the ROADMAP missed; Phase 3 keeps the rest.
- **Alternatives:** leave it to Phase 3 (then a disabled update records the old
  version's servers until Phase 3).
- **Why dubious:** it departs from the ownership table.
- **Recorded in:** `01-CONTEXT.md` amendments.

### P1-DC-18: New fields `compatibilityBasis?: "neutral"` and `mcpBundle?: true`

- **Phase / source:** Phase 1 research; parent decision.
- **Severity:** Medium. **Status:** open.
- **Choice:** the neutral mark P1-DC-02 asked for, plus a bundle flag so a
  `.mcpb`/`.dxt` block survives the read for legacy records.
- **Why dubious:** two record fields for bookkeeping; a development-build record
  with a bundle and an adapter-blocked server stays ambiguous (the rule keeps
  the block).
- **Recorded in:** `01-CONTEXT.md` amendments.

### P1-DC-19: Smaller research choices

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

## Pattern mapping step (gsd-pattern-mapper, 2026-11-04)

### P1-DC-20: Pattern-map choices

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

## Planning step (gsd-planner, 2026-11-04)

### P1-DC-21: Package legitimacy check runs unattended

- **Severity:** High. **Status:** open.
- The three Pi 1.5.0 packages flagged `[SUS]` (age only) are installed after
  an automated `npm view` comparison with 1.4.0 (repository, maintainers,
  scripts, integrity), not a blocking human checkpoint. The planner protocol
  says legitimacy checkpoints are never auto-approved; the unattended run
  overrides it.
- **Recorded in:** `01-01-PLAN.md`.

### P1-DC-22: Plan shape and frozen-interface width

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

## Plan check step (gsd-plan-checker + orchestrator, 2026-11-04)

### P1-DC-23: Plan-check revisions and accepted warnings

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

## Execution step, orchestrator (2026-11-04)

### P1-DC-24: Executor prompts list the GSD contract files instead of inlining them

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

### P1-DC-25: Plan 01-02 executor choices (decision records, cucumber contract)

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

### P1-DC-26: Plan 01-04 executor choices (closed-set entries)

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

### P1-DC-27: Plan 01-01 executor choices (Pi 1.5.0 raise)

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

### P1-DC-28: Plan 01-03 executor choices (domain seam) and an orchestrator fix

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

### P1-DC-29: Plan 01-05 executor choices (snapshot field)

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

### P1-DC-30: Plan 01-06 executor choices (session steps)

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

### P1-DC-31: Plan 01-07 executor choices (cucumber profiles)

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
