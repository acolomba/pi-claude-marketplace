# Phase 10: Plugin Options, Variables, and Trust - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning
**Mode:** autonomous discuss (`--auto`; the user told this run to proceed
without asking). Every gray area took its upstream-parity answer. Decisions
23, 17, and 10 of the PRD's section 5.2 are maintainer decisions; this run
answered them and marks each **pending maintainer review**. Decision 23 is a
security choice: both options are recorded below, and the run took the one
that keeps a locked user decision and weakens nothing that ships today.

<domain>
## Phase Boundary

Deliver PG-SEC-02, PG-CORE-06, PG-CORE-07, PG-CORE-03 (step 1 only), and
PG-CORE-05, against Pi 1.5.0 (the peer floor and the installed dev copy) and
Claude Code 2.1.323 (the installed binary):

- The trust gap of D-LOC-01 is confirmed or reopened, and the decision is in
  `PROJECT.md` with its premise and the Pi version it was checked against
  (PG-SEC-02).
- In a project that Pi does not trust, no project-scope plugin's `bin` is on
  `PATH` (PG-CORE-06). A plugin with no `bin` directory adds nothing to
  `PATH` (PG-CORE-07).
- A plugin's `userConfig` options resolve to their `default`. Hooks get
  `CLAUDE_PLUGIN_OPTION_<KEY>`. `${user_config.KEY}` is filled in exec-form
  hook commands and arguments, in the five MCP fields under both profiles, and
  in skill, command, and agent content when the option is not sensitive. A
  plugin whose options all have a default installs without `--partial`; one
  with a required option and no default stays partially available
  (PG-CORE-03).
- A user-scope skill or command that names `${CLAUDE_PROJECT_DIR}` gets the
  session directory when the user invokes it, when the model reads it, and
  through `run_plugin_command`. Agent bodies stay as they are (PG-CORE-05).

Not in scope: CORE-03 steps 2 and 3 (values the user sets, and the dialog;
decision 30); a consent record kept by this extension (the reopen branch of
decision 23 is new work that needs its own requirement); narrowing the plugin
`bin` to the bash tool only (core report N5); the `docs/env-vars.md` PATH
matrix column of PG-DOC-02 (Phase 11).

</domain>

<decisions>
## Implementation Decisions

### Decision 23: the project trust gap (PG-SEC-02) -- comes first

- **D-PG10-01 (pending maintainer review; decision 23; security-sensitive;
  confirms D-LOC-01):** Confirm the accepted gap. Project skills, commands,
  aliases, the model command tool, the skill-read fill, hooks, autoapply, the
  background autoupdate, built-in MCP registrations (D-MB-09), and now `PATH`
  (D-PG10-02) stay gated on `ctx.isProjectTrusted()` alone. Draft the Pi
  request of the PRD's section 8.1 ("a way for an extension to register
  project paths that require trust, or the `project_trust` event for every
  project") as `.planning/upstream/pi-extension-trust-paths.md`, with a
  BACKLOG entry whose trigger is a Pi release that ships it.
  - **Evidence record.** Question: does a repository's plugin run before the
    user trusts the folder? Claude Code: no. "A project-scope plugin ...
    loads only after the same trust check that applies to project allow
    rules" (`docs/research/parity-gaps/core.md` U9, from the plugin loading
    page, fetched 2026-11-11). Pi 1.5.0 (`node_modules/@earendil-works/pi-coding-agent`,
    read 2026-11-14): `resolveProjectTrusted` returns
    `trustStore.get(cwd) ?? true` when `hasTrustRequiringProjectResources(cwd)`
    is false, without asking and without emitting `project_trust`
    (`dist/core/project-trust.js:21-24`). The list it checks is `.pi/`
    `settings.json`, `mcp.json`, `extensions`, `skills`, `prompts`, `themes`,
    `SYSTEM.md`, `APPEND_SYSTEM.md`, plus `.agents/skills` in the cwd or an
    ancestor (`dist/core/trust-manager.js:8-17`, `:157-176`).
    `.pi/claude-plugins.json`, `.pi/pi-claude-marketplace/`, and
    `.pi/mcp-adapter.json` are not on it. A saved "Do not trust" wins even
    for such a folder (1.5.0 fix, core report Pi table). The latest Pi on npm
    is 1.5.2 (`npm view`, 2026-11-14); the research must re-read its
    `trust-manager.js` and `project-trust.js` and record whether the list
    changed. Confidence: high for 1.5.0.
  - **Option A (taken): confirm the gap.** Licensed by a recorded project
    decision (D-LOC-01: "Trust in a repository's contents is Pi's job, not
    something to approximate with user-level state"; the user called the
    user-folder ledger "backwards security") and by a Pi capability gap (no
    API registers a trust-requiring path; `project_trust` is not emitted for
    such a folder). It weakens nothing that ships today, and PG-CORE-06 adds a
    gate. Residual: a repository that commits only this extension's files is
    trusted unless the user saved "Do not trust", so its project-scope
    plugins run.
  - **Option B (not taken): reopen.** A consent record kept by this
    extension: treat the project scope as trusted only when Pi holds a saved
    decision or the user confirmed once (PRD section 7.7). Safer against a
    hostile repository. Costs: a second trust prompt that is not Pi's;
    project-scope plugins stop working in print, JSON, and RPC sessions until
    the user approves; every existing project-scope user gets one prompt; the
    record lives in the user scope, which D-LOC-01 forbids "even for
    security"; it needs a new requirement this roadmap does not hold. An
    autonomous run does not reverse a locked user decision.
  - **Reversibility:** reversible. Reopening later adds a gate in front of
    the same `ctx.isProjectTrusted()` call sites; nothing this phase writes
    has to be migrated.
  - Record: a Key Decisions row in `PROJECT.md` with the premise and the Pi
    versions (1.5.0 floor, and 1.5.2 as the research finds it), and D-LOC-01's
    gated list gains `PATH`.

### PATH (PG-CORE-06, PG-CORE-07)

- **D-PG10-02 (CORE-06):** The `PATH` recompute takes the project trust
  answer that the load already computed for hooks (`projectTrusted` in
  `index.ts` `prepareResources`, the answer recorded at load per D-LOC-01's
  DC-42 item b). When it is false, the project scope contributes no `bin`
  directory, and the ledger removes the project entries an earlier load
  appended. The project scope's `state.json` is not read for `PATH` then.
  Every caller of `recomputePluginPath` passes the answer (the research lists
  them; codegraph reports three call sites in `index.ts`). A user-scope
  plugin's `bin` is unaffected.
- **D-PG10-03 (CORE-07):** A `<pluginRoot>/bin` joins `PATH` only when it
  exists and is a directory at the recompute (`stat`, which follows a
  symbolic link, as upstream's check does), and a path holding one of
  upstream's metacharacters (`:`, `"`, `'`, `$`, a backquote, `\`, or a
  newline) is dropped. Upstream: Claude Code 2.1.322 `getEnabledPluginBinPaths`
  (core report U5.4, `BIN@298211553`); the research re-greps 2.1.323 for the
  exact set and the stat call. Upstream's 2 s stat timeout is not copied
  (a local stat). A `bin` created after the load joins at the next `/reload`,
  as upstream needs `/reload-plugins`. With two enabled plugins, one with
  `bin/`, `PATH` holds one plugin entry.
- Corrections that land here: `shared/session-env.ts:145-146` ("adds a dir
  even if it does not exist ... Claude Code parity"), `docs/env-vars.md`
  (the line near 180 that says a missing `bin` is added, and the PENV-01
  wording), PENV-01 in `PROJECT.md` ("added even if the directory does not
  exist" was parity at 2.1.212, not 2.1.322).

### Decision 17: `userConfig` defaults and export (PG-CORE-03 step 1)

- **D-PG10-04 (pending maintainer review; decision 17; amends BACKLOG
  USRCFG-01):** Support step 1 now. `userConfig` leaves
  `UNSUPPORTED_COMPONENT_KINDS` (`domain/unsupported-components.ts:44`).
  USRCFG-01 is amended: step 1 ships; steps 2 and 3 stay open behind decision
  30; its claim that sensitive values need OS secret custody is corrected
  (upstream keeps them in `~/.claude/.credentials.json` where there is no
  keychain; core report W4). Premise: upstream treats `userConfig` as an input
  to hooks, MCP servers, and content, not as a component; the one plugin in
  the sample (`code-modernization`, 7 options, all with defaults) reads
  `CLAUDE_PLUGIN_OPTION_TELEMETRY`.
- **D-PG10-05 (schema; fail closed):** Parse `userConfig` against upstream's
  schema: key `^[A-Za-z_]\w*$`; option fields `type` (`string`, `number`,
  `boolean`, `directory`, `file`), `title`, `description`, `required`,
  `default`, `options`, `multiple`, `sensitive`, `min`, `max`; strict object
  (Claude Code 2.1.323 binary: the zod schema whose key message reads
  "Option keys must be valid identifiers ... they become
  CLAUDE_PLUGIN_OPTION_<KEY> env vars in hooks"; core report U4.9). A
  `userConfig` that does not parse makes the plugin `unavailable` with a
  reason naming the first bad key or field: it is malformed data, and the
  project fails closed and never treats it as a partial install (memory
  "resolver state: malformed vs degrade"). The research records what
  upstream does with a malformed `userConfig` (manifest validation error) and
  with a `default` whose type does not match `type`; a mismatched default is
  malformed unless the binary shows upstream accepts it. Marketplace-entry
  `userConfig` applies only when the plugin has no `plugin.json` (core report
  U7.5); the research checks that the manifest merge already follows this.
- **D-PG10-06 (resolution):** Each option resolves to its `default`. An option
  with `required: true` and no `default` makes the plugin
  `partially-available`, with a new reason in the closed reason vocabulary
  that names the option keys; `--partial` installs it with those options
  unset, and `info` lists them in its breakdown (memory "unsupported features
  -> partial install"). A non-required option with no `default` is unset.
  Upstream's CLI install never prompts and prints `N userConfig options not
  yet set`; the requirement's partial arm for a required option is the
  PRD's chosen step-1 safety rule (section 7.7, CORE-03 row) and is not a
  parity claim.
- **D-PG10-07 (value text):** A resolved value becomes text as upstream does:
  `String(value)` (binary `Frn`: `return String(m)`). The research reads
  `Yr(r,f)` (the lookup by key) and the `multiple` case, and records whether a
  `directory` or `file` default is expanded (for example `~`).
- **D-PG10-08 (unset references):** In skill, command, and agent content, a
  reference to an unset option stays literal (binary `ySo`: `if(c===void 0)return f`).
  In an exec-form hook field or an MCP field, upstream throws
  `Plugin option "KEY" isn't set. Open /plugin manage to configure it, or check
  that the plugin's userConfig schema declares "KEY".` (binary `Frn`, default
  `missingKey:"throw"`). Parity: the hook run that names it fails as a hook
  error with that cause, and the MCP server that names it is not written or
  registered and the command reports it. The research finds where upstream
  catches the throw for each surface (one server or the whole plugin; one
  hook or all) and the planner maps it to the closest existing notice or
  reason. Only a `--partial` install or a non-required option without a
  default can reach this.
- **D-PG10-09 (sensitive):** In skill, command, and agent content, a
  reference to an option with `sensitive: true` becomes
  `[sensitive option 'KEY' not available in skill content]`, whether or not
  it has a value (binary `ySo`). Hooks and MCP servers get the value. Step 1
  has only defaults, which are public manifest text; the rule still holds so
  that step 2 needs no content change.
- **D-PG10-10 (hooks):** Every option with a value is exported to both hook
  spawn lanes (the synchronous dispatch and the async-rewake spawn) as
  `CLAUDE_PLUGIN_OPTION_<KEY>`, the key uppercased and each character outside
  `[A-Za-z0-9_]` replaced by `_` (core report U4.13, `BIN@296981078`).
  `${user_config.KEY}` is filled in an exec-form hook's `command` and each
  `args` element, in the same pass as the path variables (extends D-CF5-15,
  which today keeps `${user_config.*}` literal). A shell-form hook command that
  names `${user_config.` is refused at run time, not run, with upstream's
  message (binary: "plugin hook references ${user_config.*} in shell-form
  command" with the remedy to use exec form or read
  `$CLAUDE_PLUGIN_OPTION_<KEY>`; core report U4.14). The research records the
  exact message text and whether upstream refuses at load or at run.
- **D-PG10-11 (MCP under the adapter):** No resolved option value is written
  into `mcp-adapter.json`. A field that names `${user_config.KEY}` is written
  as a reference to a process variable that this extension sets on Pi's
  process at load and at `session_start`, as it does for `CLAUDE_PROJECT_DIR`
  at user scope (AVAR-01, `docs/env-vars.md` "`CLAUDE_PROJECT_DIR` at user
  scope"). The variable name is unique per scope, plugin, and key, so two
  plugins with the same key never share a value, and the set of names this
  extension owns is kept in a ledger like `PI_CLAUDE_MARKETPLACE_PATH`, so a
  name whose plugin is gone is removed at the next load. The research must
  confirm, in pi-mcp-adapter 7.0.1, that `${NAME}` is expanded from
  `process.env` at connect in `command`, `args`, `env`, `url`, and `headers`
  (the Phase 9 `caFile` origin rule reads `url` as `resolveServerUrl` does,
  `utils.ts:146-165`, `:280-298`), that the name passes this project's
  credential deny-list (`domain/claude-credential-denylist.ts`, AVAR-05), and
  how the Phase 9 marker, carried fields, and `caFile` origin rule read an
  entry whose url holds such a reference. Divergence (pending maintainer
  review): the model's bash tool and every other child of Pi inherit these
  variables, and upstream gives the bash tool no option (core report U4.7).
  Licensed as AVAR-01 is: pi-mcp-adapter reads only its config file and the
  process environment, so the process environment is the only place a value
  can be that is not the file.
- **D-PG10-12 (MCP under Pi's built-in MCP):** The value is filled at each
  registration in memory, as `${CLAUDE_PROJECT_DIR}` is (D-MB-15,
  `bridges/mcp/builtin-escape.ts`). The research confirms that a built-in
  registration writes no file; if Pi persists it, D-PG10-11's process
  variable is used instead.
- **D-PG10-13 (content):** `${user_config.KEY}` is filled in skill, command,
  and agent content when the content is staged (install, update, reinstall,
  enable, an `apply` move), the same point where the path variables are
  written today. Commands are filled because upstream's commands are skills
  (`Commands`/`Skills` pages; U4.12 names "skill and agent content"). Workflow
  scripts are not filled (U4.8). The residual note in
  `domain/argument-substitution.ts:16-17` is corrected.
- **D-PG10-14 (where values come from):** In step 1 every value is a default
  from the installed plugin's own manifest, so it is derived from the plugin's
  `plugin.json` (or marketplace entry) when needed and is not stored
  elsewhere. If a reader (the hooks hydrate at load, the load-time variable
  pass of D-PG10-11) cannot reach the manifest cheaply, the planner may keep
  the parsed option schema on the install record; that choice is the agent's
  discretion, and it stores no value the user typed.
- **D-PG10-15 (existing installs):** A plugin installed earlier with
  `--partial` because of `userConfig` gets its options at its next restage
  (`update`, `reinstall`, a disable then enable, an `apply` move), the path
  that gave entries the Phase 9 defaults (D-PG9-04). Nothing rewrites staged
  content or `mcp-adapter.json` at load (APL-D1). Its partial status is
  re-derived, not sticky (memory "force-install redesign"). The CHANGELOG line
  tells such users to run `reinstall` once.

### Decision 10: `${CLAUDE_PROJECT_DIR}` at user scope (PG-CORE-05)

- **D-PG10-16 (pending maintainer review; decision 10; amends SUB-02):** Fill
  `${CLAUDE_PROJECT_DIR}` with the session's working directory for a
  user-scope skill or command at the invocation step
  (`orchestrators/skill-invocation.ts:151`,
  `orchestrators/command-invocation.ts:164`), in the model-read fill of a
  staged `SKILL.md` (D-CF1-03 as amended), and in `run_plugin_command`.
  Aliases take the same invocation path. Install-time staging keeps the
  literal at user scope (SUB-02's install rule stands; the invocation fills
  it). Agent bodies stay as they are, because pi-subagents reads the agent
  file itself. Upstream: the three path variables resolve "Anywhere in the
  Markdown body" of skill, command, and agent content, at every scope (core
  report U4.4). SUB-02's reason ("content is written once at install") is
  stale since the invocation-time port (D-CF1-01). The value equals what hooks
  and MCP servers already get (AVAR-01, D-MB-15). Correct `docs/env-vars.md`
  "`CLAUDE_PROJECT_DIR` at user scope".

### Behavioral evidence

- **D-PG10-17:** Each user-visible change ships a cucumber scenario that fails
  without it:
  - an untrusted project ("Do not trust" saved) with an enabled project-scope
    plugin that has `bin/hello`: the bash tool does not find `hello`; in a
    trusted project it does (the first `bin`-on-`PATH` scenario; core report
    CORE-06);
  - two enabled plugins, one with `bin/`: the bash tool's `PATH` holds one
    plugin entry;
  - `userConfig: {"mode": {"type": "string", "default": "fast"}}` and a hook
    that prints `$CLAUDE_PLUGIN_OPTION_MODE`: it prints `fast`, and the plugin
    installs without `--partial`; a required option with no default is refused
    without `--partial`;
  - `${user_config.KEY}` filled in an exec-form hook command and argument, in
    the five MCP fields under both profiles, and in skill and agent content; a
    sensitive option's placeholder in skill content;
  - a user-scope command with `project ${CLAUDE_PROJECT_DIR}` sends the project
    path when typed and through `run_plugin_command`; a user-scope skill shows
    the path when the model reads its `SKILL.md`; an agent body keeps the
    literal.
  Owner unit tests cover the schema parser, the resolver arm, the value text,
  the env name, the PATH filter, and the trust input. All tests run in a
  hermetic home and never touch the real `~/.pi/agent`.

### Records

- **D-PG10-18:** Append Key Decisions rows D-PG10-01, D-PG10-04, D-PG10-11,
  and D-PG10-16 to `PROJECT.md`, each with its premise and versions, marked
  pending maintainer review; add `PATH` and the confirmation to D-LOC-01's
  text ("Confirmed by D-PG10-01"); correct PENV-01; append "Amended by
  D-PG10-16" to SUB-02 and "Amended by D-PG10-10" to D-CF5-15. Amend BACKLOG
  USRCFG-01; add the Pi trust-paths BACKLOG entry. Correct `docs/env-vars.md`
  and `shared/session-env.ts:145-146`. One CHANGELOG bullet (the `changelog`
  skill). These shared-file edits are append-style and limited to this phase's
  rows.

### Amendments after research (10-RESEARCH.md "Findings that change decisions")

Research read the 2.1.323 binary further. Where a finding contradicts a
decision above, this section wins.

- **D-PG10-19 (pending maintainer review; amends the premise of D-PG10-04,
  D-PG10-06, D-PG10-10, D-PG10-13; F1):** Claude Code 2.1.323 applies a
  `default` only to MCP and LSP config (`Jgt`); hooks, skills, commands, and
  agents read saved values only (`QH`). With nothing saved, an upstream hook
  gets no `CLAUDE_PLUGIN_OPTION_<KEY>` and content keeps the reference literal.
  PG-CORE-03 and success criteria 1 and 2 are locked and require the default on
  hooks and content, so step 1 treats each declared `default` as if the user
  had saved it. This is **more than upstream**, licensed by this recorded
  decision; no doc may call it parity. `domain/user-config.ts` keeps the saved
  map and the default map as separate values, so strict parity (defaults on
  MCP only) is a one-line switch. Maintainer question: keep defaults on hooks
  and content, or follow upstream exactly (which leaves criteria 1 and 2
  unmet).
- **D-PG10-20 (F2, F3; amends D-PG10-05 and the D-PG10-17 fixtures):** `title`
  and `description` are required, as upstream. Every fixture uses the full
  shape, for example
  `{"mode": {"type": "string", "title": "Mode", "description": "The mode.", "default": "fast"}}`;
  the abbreviated ROADMAP text stands for that shape. A `default` whose type
  differs from `type` is accepted (upstream's default is a type-agnostic
  union); its text is `String(default)`.
- **D-PG10-21 (F4, F5; amends D-PG10-06 and D-PG10-08):** In MCP fields, follow
  `Jgt` exactly: a non-required option with no default is the empty string;
  only a `required` option with no default reaches the "isn't set" failure. A
  plugin that declares no `userConfig` keeps an MCP, skill, command, or agent
  reference literal (upstream substitutes only when the manifest declares
  options), but an exec-form hook reference fails as a hook error and a
  shell-form one is refused, as upstream's hook runner does for every plugin.
  `features/hook/process.feature:8-28`,
  `test/bridges/hooks/spawn-helpers.test.ts:41-57`, and
  `test/bridges/hooks/dispatch-exec.test.ts:1797-1822`, which pin the literal,
  change, and a scenario proves the failure. An MCP server that names an
  option with no value is dropped at the bridge with a notice in the Phase 9
  `ca-file-removed` style (research open question 2).
- **D-PG10-22 (F6, F7; amends D-PG10-02 and D-PG10-03):** `recomputePluginPath`
  has one production caller (`index.ts:199`). The metacharacter set includes
  `\r`; the filter is skipped on Windows; a stat failure other than `ENOENT` or
  `ENOTDIR` keeps the path (upstream E6).
- **D-PG10-23 (F8; refines D-PG10-11 and D-PG10-14):** The option schema is
  stored on the install record as an additive `userConfig` field with no
  `schemaVersion` bump, following `mcpServerConfigs`. Variable names are
  `PI_CLAUDE_MARKETPLACE_OPTION_<16 hex of sha256(scope, marketplace, plugin, key)>`,
  owned through the ledger `PI_CLAUDE_MARKETPLACE_OPTIONS`. The value is
  exported through the existing split-token escape, so the adapter's later
  `{env:` and `$env:` passes cannot expand a default (AVAR-05). The stage
  overlays the variables on its environment, so the Phase 9 `caFile` origin
  rule reads them. **Security choice (pending maintainer review; research open
  question 1):** user-scope variables are set in the awaited factory;
  project-scope variables are set only once the load's trust answer is true,
  and removed when it is false, so an untrusted project's `state.json` never
  feeds the process environment. Residual: a project-scope stdio server that the
  adapter starts before the load reads an unset variable. The faster option
  (set from the project's `state.json` in the factory, remove at
  `session_start` if untrusted) is recorded and not taken.
- **D-PG10-24 (F9, F10; amends D-PG10-15):** Bump the completion cache
  `schemaVersion` from 7 to 8. `apply` does not restage a record installed with
  `--partial` only because of `userConfig` (its growth move needs `supported`
  to grow), so "an `apply` move" leaves D-PG10-15's list and its CHANGELOG
  instruction to run `reinstall` once stands. Alternative for the maintainer:
  add `userConfig` to `supported` so the BFILL-01 growth move restages at
  `apply`.
- **Pi 1.5.2 (E7):** `trust-manager.js` and `project-trust.js` are
  byte-identical to 1.5.0, and no API registers a trust path; D-PG10-01's
  record names both versions.
- **Correction:** the `docs/env-vars.md` PATH text is at line 55, not near 180;
  10-RESEARCH.md's table of records lists the real lines.

### Decided autonomously

Reversible technical choices: D-PG10-02, D-PG10-03, D-PG10-05 to D-PG10-10,
D-PG10-12 to D-PG10-15, D-PG10-17, D-PG10-18.

### Pending maintainer review

- D-PG10-01 (decision 23): confirm the D-LOC-01 trust gap. **Security
  flag:** option B (an extension-kept consent record) is the safer posture
  against a repository that ships only this extension's files; it was not
  taken because it reverses a locked user decision and needs a requirement
  this roadmap does not hold.
- D-PG10-04 (decision 17): `userConfig` step 1 now; amends USRCFG-01.
- D-PG10-11: process variables carry option values to adapter entries; the
  bash tool inherits them (divergence, as AVAR-01).
- D-PG10-16 (decision 10): fill `${CLAUDE_PROJECT_DIR}` at invocation for
  user-scope skills and commands; amends SUB-02.
- D-PG10-06: the partial arm for a required option with no default (PRD
  safety rule, not parity).
- D-PG10-19: defaults on hooks and content are more than upstream (F1).
- D-PG10-23: project-scope option variables wait for the trust answer.
- D-PG10-24: `reinstall`, not `apply`, refreshes an old partial install.

### the agent's Discretion

The new reason token's name and wording (within the closed notification
vocabulary and the subject-first row grammar). The process variable name
scheme of D-PG10-11 and its ledger variable's name. Whether the option schema
is re-read from the manifest or kept on the record (D-PG10-14). Module
placement (a new `domain/user-config.ts` is the report's proposal). Scenario
wording and splits across feature files. Plan splits. No exception to plan
size, security, coverage, or verification gates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` -- Phase 10 section (goal, discuss order, notes,
  success criteria)
- `.planning/REQUIREMENTS.md` -- PG-CORE-03, PG-CORE-05, PG-CORE-06,
  PG-CORE-07, PG-SEC-02
- `docs/prd/parity-gaps-prd.md` -- section 5.2 (decisions 10, 17, 23), 5.3
  (decision 30), 7.6 (CORE-03, CORE-06, SEC-02, CORE-05, CORE-07), 7.7 (the
  CORE-06/SEC-02 and CORE-03 rows), 8.1 (the Pi trust request)
- `docs/research/parity-gaps/core.md` -- U4 (variables and `userConfig`), U5
  (`bin`), U9 (trust), CORE-03, CORE-05, CORE-06, CORE-07, N1-N5, W2-W5, the
  "Settings, packages, trust" and "Env and subprocess" tables
- `docs/research/parity-gaps/mcp.md` -- `${user_config.*}` rows and the MCP
  report's note on where a sensitive value may be written

### Recorded decisions this phase amends or relies on
- `.planning/PROJECT.md` -- D-LOC-01 (line ~2150), PENV-01 (~745), SUB-02,
  D-CF5-15 (~2203), D-MB-09, D-MB-15, D-MB-18, AVAR-01, D-90-06
- `.planning/BACKLOG.md` -- USRCFG-01 (line 1387), the PENV-01 scenario gap
  (~4843), the untrusted-project AMIG-01 note (~5170)
- `.planning/phases/09-adapter-entries-and-mcp-features/09-CONTEXT.md` --
  D-PG9-03 (marker, fail closed), D-PG9-04 (restage path), D-PG9-14 (`caFile`
  origin rule and env-based url reading)

### Docs to correct
- `docs/env-vars.md` -- the PATH text near line 180 and "`CLAUDE_PROJECT_DIR`
  at user scope"
- `docs/mcp-compatibility.md` -- `${user_config.*}` text, if any

### Upstream evidence
- Claude Code 2.1.323 binary:
  `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`
  (`Frn`, `ySo`, the `userConfig` zod schema, the shell-form refusal text,
  `getEnabledPluginBinPaths`)
- `.agents/skills/claude-code-compat-research/SKILL.md` -- evidence rules

### Pi and companion source
- `node_modules/@earendil-works/pi-coding-agent/dist/core/project-trust.js`,
  `trust-manager.js` (1.5.0); 1.5.2 from the npm tarball, unpacked in a
  scratch directory
- `node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/` (7.0.1,
  after `scripts/install-test-peers.mjs`) -- `utils.ts` interpolation,
  `server-manager.ts` `resolveEnv`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/plugin-path.ts` -- `recomputePluginPath(cwd)` and
  `collectBinDirs`; add the trust input and the stat filter here.
- `shared/session-env.ts` -- `applyPathLedger` and `PATH_LEDGER_ENV`; the
  ledger pattern for D-PG10-11's owned variable names.
- `index.ts` `prepareResources` -- computes `projectTrusted` once and passes
  it to the hooks hydrate and `loadReconcile`; `recomputePluginPath` is called
  at `:199` without it.
- `domain/claude-mcp-variables.ts` -- the segment model (text and `ref`) that
  writes `${NAME}` references into adapter entries; D-PG10-11 adds the option
  references here.
- `bridges/mcp/builtin-escape.ts` -- the built-in field encoder that fills
  variables at registration.
- `shared/vars.ts` (`substituteClaudeVars`), `domain/argument-substitution.ts`
  -- content and exec-form substitution.
- `bridges/hooks/hook-env.ts`, `spawn-helpers.ts`, `dispatch-exec.ts`,
  `async-rewake/registry.ts` -- the two hook spawn lanes.
- `domain/unsupported-components.ts`, `domain/components/plugin.ts:43`
  (`userConfig: Type.Optional(Type.Unknown())`), `domain/plugin-resolver.ts`,
  `domain/resolver-types.ts` -- the resolver arms.
- `orchestrators/skill-invocation.ts:124-151`, `:238`, `:354`;
  `orchestrators/command-invocation.ts:164-165` -- the scope-gated
  `CLAUDE_PROJECT_DIR`.
- `features/lib/pi-process.ts` `decidedProjectTrust` -- the harness already
  records a trust decision.

### Established Patterns
- Fail closed on corrupt data; malformed manifest data is `unavailable`.
- Partial install: `partially-available`, `--partial`, and an `info`
  breakdown, never "install and warn".
- Variables kept for the adapter are references, never values (AVAR-05
  decides deny-listed names at install).
- All disk writes are atomic; containment NFR-10.

### Integration Points
- The Phase 9 marker and carried fields compare an entry with what a restage
  would write; a referenced option variable must compare equal across
  restages.
- Status rows, `apply` convergence, `info`, and the completion cache classify
  plugins; removing `userConfig` from the unsupported set changes their
  verdicts.

</code_context>

<specifics>
## Specific Ideas

Evidence checked 2026-11-14:

1. Pi 1.5.0 installed (`node_modules/@earendil-works/pi-coding-agent/package.json`);
   1.5.2 latest on npm.
2. Claude Code 2.1.323 binary grep: `Frn` (fill or throw), `ySo` (content
   fill, sensitive placeholder, unset stays literal), the `userConfig` key
   regex and description ("Available as ${user_config.KEY} in MCP/LSP server
   config, hook commands, and (non-sensitive only) skill/agent content"), and
   the shell-form refusal message fragment.
3. The sample plugin `code-modernization` (7 options, all with defaults) is
   the motivating case (core report CORE-03).

</specifics>

<deferred>
## Deferred Ideas

- CORE-03 steps 2 and 3: values the user sets (`--config`, `configure`) and
  the dialog; decision 30 (which scope stores a project install's values).
- Option B of decision 23: an extension-kept consent record (new requirement).
- A load-time notice when a project carries plugin records and Pi trusted it
  without a saved decision (a softer mitigation of the trust gap; new
  user-visible behavior, so its own requirement).
- Narrowing plugin `bin` to the bash tool only (core report N5, DV1).
- The `docs/env-vars.md` PATH matrix column (PG-DOC-02, Phase 11).

</deferred>

---

*Phase: 10-plugin-options-variables-and-trust*
*Context gathered: 2026-11-14*
