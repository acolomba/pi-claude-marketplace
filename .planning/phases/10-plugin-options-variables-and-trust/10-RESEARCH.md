# Phase 10: Plugin Options, Variables, and Trust - Research

**Researched:** 2026-11-14
**Domain:** Claude Code `userConfig` options, plugin variables, plugin `bin` on `PATH`, Pi project trust
**Confidence:** HIGH for the code paths and for Pi trust. MEDIUM-HIGH for the upstream `userConfig` flow (read in the minified 2.1.323 binary and the docs; the binary was not run).

## Summary

The phase has four small code changes and one large one. The small ones are well bounded. `recomputePluginPath` has one production caller (`index.ts:199`), and the trust answer it needs is computed 36 lines above it. The `${CLAUDE_PROJECT_DIR}` change at user scope is two expressions (`skill-invocation.ts:151`, `command-invocation.ts:164-166`), and every typed, alias, model-read, and `run_plugin_command` path goes through them. Pi 1.5.2 trust code is byte-identical to 1.5.0, so the premise of D-PG10-01 holds for both versions.

The large change is `userConfig`. Reading the 2.1.323 binary changed three premises of CONTEXT.md, and the planner must see them before it writes a plan. First, upstream applies a `default` only in MCP and LSP server config. Hooks, skills, commands, and agents read **saved values only**, so with nothing saved a hook gets no `CLAUDE_PLUGIN_OPTION_<KEY>` and skill content keeps `${user_config.KEY}` literal. PG-CORE-03 as written therefore delivers more than upstream on hooks and content. Second, upstream's option schema requires `title` and `description`, so the fixture in roadmap success criterion 1 is malformed upstream. Third, in MCP config upstream reads a non-required option with no default as the empty string, not as unset. All three are listed under "Findings that change decisions".

D-PG10-11 (option values reach pi-mcp-adapter through process variables) is workable. pi-mcp-adapter 7.0.1 expands `${NAME}` from `process.env` at connect in all five fields. Four conditions apply: the variables must exist before the adapter's own `session_start` (so they are set in the awaited factory), the stage must read them in the environment it decides with, an exported value must be escaped against the adapter's second and third passes, and the option data must come from the install record, because three of the readers never open a manifest.

**Primary recommendation:** Keep the option schema on the install record (`userConfig`, additive, no `schemaVersion` bump), resolve it through one pure module (`domain/user-config.ts`), and treat each declared `default` as if the user had saved it. Record that last rule as a divergence under D-PG10-04, because upstream does not do it for hooks and content.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Claude's Discretion

The new reason token's name and wording (within the closed notification
vocabulary and the subject-first row grammar). The process variable name
scheme of D-PG10-11 and its ledger variable's name. Whether the option schema
is re-read from the manifest or kept on the record (D-PG10-14). Module
placement (a new `domain/user-config.ts` is the report's proposal). Scenario
wording and splits across feature files. Plan splits. No exception to plan
size, security, coverage, or verification gates.

### Deferred Ideas (OUT OF SCOPE)

- CORE-03 steps 2 and 3: values the user sets (`--config`, `configure`) and
  the dialog; decision 30 (which scope stores a project install's values).
- Option B of decision 23: an extension-kept consent record (new requirement).
- A load-time notice when a project carries plugin records and Pi trusted it
  without a saved decision (a softer mitigation of the trust gap; new
  user-visible behavior, so its own requirement).
- Narrowing plugin `bin` to the bash tool only (core report N5, DV1).
- The `docs/env-vars.md` PATH matrix column (PG-DOC-02, Phase 11).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PG-CORE-03 | `userConfig` defaults and export (step 1): defaults resolve; hooks get `CLAUDE_PLUGIN_OPTION_<KEY>`; `${user_config.KEY}` filled in exec-form hooks, the five MCP fields, and skill and agent content (not sensitive); all-default plugin installs without `--partial`; a required option with no default stays partially available. | Evidence records E1 to E5 give the upstream schema, lookup, value text, throw sites, and the refusal message. Findings F1 to F5 change premises. "Readers and writers" lists every staging and spawn site. "D-PG10-11 mechanism" gives the adapter design. |
| PG-CORE-05 | A user-scope skill or command that names `${CLAUDE_PROJECT_DIR}` gets the session directory when invoked, when the model reads it, and through `run_plugin_command`. Agent bodies stay. | Two gates: `skill-invocation.ts:151`, `command-invocation.ts:164-166`. Four unit tests pin the literal. See "CORE-05 paths". |
| PG-CORE-06 | In a project Pi does not trust, a project-scope plugin's `bin` is not on `PATH`. | One caller (`index.ts:199`), `projectTrusted` at `index.ts:163`. The harness can save "Do not trust" (`trust.json` value `false`). See "PATH". |
| PG-CORE-07 | A plugin with no `bin` directory adds nothing to `PATH`. | Evidence record E6 gives the exact 2.1.323 rule: `stat`, metacharacter set with `\r`, and which stat failures keep the path. |
| PG-SEC-02 | The trust gap of D-LOC-01 is confirmed or reopened and recorded with its premise and Pi version. | Evidence record E7: Pi 1.5.2 `trust-manager.js` and `project-trust.js` are byte-identical to 1.5.0. No API registers a trust path. |
</phase_requirements>

## Findings that change decisions

Each finding names the decision it touches, the evidence, and what the planner should do. None blocks the phase. F1 needs the maintainer.

### F1. Upstream applies a `default` only to MCP and LSP config (touches PG-CORE-03, D-PG10-04, D-PG10-06, D-PG10-10, D-PG10-13)

- **What 2.1.323 does.** The option loader `QH` returns saved values only: `return{...n,...f}` where `n` is `pluginConfigs[...].options` from settings and `f` is the stored secrets (`BIN@304282380`). The default merge is a separate function, `Jgt` (`BIN@304290854`). `Jgt` is called for MCP config (`dNs`, `BIN@313259344`), LSP config (`BIN@309679397`), and mods (`I8t`, `BIN@309896693`). The hook runner calls `QH` alone: `if(ve)wo=await QH(ve,rt)`, then exports `Object.entries(wo)` (`BIN@312871364`, `BIN@312873215`). Skills and commands call `QH` alone (`BIN@310945262`), and so do agents (`BIN@311628343`). [VERIFIED: Claude Code 2.1.323 binary, read 2026-11-14]
- **Consequence.** With nothing saved, an upstream hook gets no `CLAUDE_PLUGIN_OPTION_MODE`, an exec-form `${user_config.mode}` throws `Plugin option "mode" isn't set`, and skill content keeps the reference literal. The docs agree in wording: the section is titled "Reference a saved value", and the hooks page says the variable is exported "for each user configuration value". [CITED: code.claude.com/docs/en/plugins/manifest-reference.md, fetched 2026-11-14]
- **This refutes assumption 02 of `core.md`** ("A `userConfig` default reaches `CLAUDE_PLUGIN_OPTION_<KEY>`", marked inferred there).
- **The interactive dialog does not close the gap.** Its initial values prefill a default only for a boolean and for an `options` picker. A plain text field starts empty, and an empty non-required field is not saved (`H8r`, `L8r`, `BIN@349391123`, `BIN@349389481`).
- **The motivating plugin tolerates both.** `code-modernization`'s `scripts/telemetry.sh` treats an empty `CLAUDE_PLUGIN_OPTION_TELEMETRY` as on (`case "$v" in ''|1|true|...`). [CITED: raw.githubusercontent.com/anthropics/claude-plugins-official, fetched 2026-11-14]
- **What to do.** PG-CORE-03 and success criteria 1 and 2 are locked and require defaults on hooks and content. Keep them, and record the rule as a divergence: "step 1 treats each declared `default` as if the user had saved it". The license is a recorded decision. D-PG10-04 can carry it, and it is already pending maintainer review, but its premise text must say that upstream does this for MCP and LSP only. State the maintainer question in the plan: apply the default on hooks and content (more than upstream), or follow upstream exactly (MCP only, which leaves criteria 1 and 2 unmet). No doc may call the hook and content behavior parity. Design `domain/user-config.ts` so the saved map and the default map stay separate values; then a later switch to strict parity is one line.

### F2. Upstream requires `title` and `description` (touches D-PG10-05, D-PG10-17, roadmap success criterion 1)

The option schema declares `title:o()` and `description:o()` with no `.optional()` (`BIN@299167500`). The docs table marks both "Yes" under Required. The fixture `{"mode": {"type": "string", "default": "fast"}}` fails that schema. Under D-PG10-05 it makes the plugin `unavailable`. Every fixture and scenario must use the full shape, for example `{"mode": {"type": "string", "title": "Mode", "description": "The mode.", "default": "fast"}}` (the `core.md` CORE-03 scenario already does). Do not relax the schema to fit the abbreviated text.

### F3. A `default` whose type does not match `type` is accepted upstream (resolves the condition in D-PG10-05)

`default` is `Be([o(),E(),I(),C(o())])`: a union of string, number, boolean, and array of strings, with no link to `type`. Only `options` constrains it. So `{"type": "number", "default": "abc"}` loads upstream. The binary shows upstream accepts it, so by D-PG10-05's own rule it is not malformed. The value text is `String(default)`.

### F4. In MCP config a non-required option with no default is the empty string (touches D-PG10-06, D-PG10-08)

`Jgt` builds the default map as `if(m.required&&m.default===void 0)continue;n[f]=m.default??""`. So only a `required: true` option with no default is absent from the map and reaches the `Frn` throw. D-PG10-08's sentence "Only a `--partial` install or a non-required option without a default can reach this" is true for exec-form hooks under F1's rule, and false for MCP fields. For MCP, follow `Jgt` exactly: it is parity and it is verified.

### F5. A plugin that declares no `userConfig` (touches D-PG10-08, D-PG10-10, existing tests)

- Hooks: the option map exists for every plugin hook (`{}` when nothing is saved), so an exec-form `${user_config.X}` throws and a shell-form one is refused even when the plugin declares no `userConfig`.
- MCP: `dNs` returns `undefined` when the plugin declares none (`if(!s&&!y)return`), and `cNs` substitutes only `if(r)`. The reference stays literal, as today.
- Skills, commands, agents: substitution runs only when the manifest declares `userConfig`.
- **Existing pins that change:** `features/hook/process.feature:8-28` passes `${user_config.token}` as an exec-form argument of a plugin with no `userConfig` and expects it literal. `test/bridges/hooks/spawn-helpers.test.ts:41-57` and `test/bridges/hooks/dispatch-exec.test.ts:1797-1822` pin the same. Under D-PG10-08 that run now fails as a hook error. Remove the token from the path-variable scenario and add a scenario for the failure.

### F6. The `PATH` rule has three details CONTEXT.md does not list (touches D-PG10-03)

See evidence record E6: the metacharacter set includes `\r`; the filter is skipped on Windows; a stat failure other than `ENOENT` or `ENOTDIR` **keeps** the path.

### F7. `recomputePluginPath` has one production caller (touches D-PG10-02)

CONTEXT.md says codegraph reports three call sites. On `features/gaps-mcp` the tree has the import (`index.ts:28`), one call (`index.ts:199`), and the declaration (`orchestrators/plugin-path.ts:87`). [VERIFIED: grep over `extensions`, `test`, `features`, `scripts`, `docs`]

### F8. D-PG10-11 is workable, with four conditions

See "D-PG10-11 mechanism". The mechanism does not need to change. D-PG10-08's per-surface failure model also stands, with F4 and F5 applied.

### F9. The completion cache needs a `schemaVersion` bump (touches D-PG10-15)

A not-installed plugin whose options all have defaults moves from `partially-available` to `available`. The completion plugin index is a file per scope and marketplace and survives an extension upgrade. Its header records that a classification rule change rides a version bump ("the 4 -> 5 bump drops caches written BEFORE the completion bucketizer learned ..."). Bump `schemaVersion` 7 to 8 in `shared/completion-cache.ts`. `test/shared/completion-cache.test.ts` pins `"schemaVersion": 7` in five places.

### F10. `apply` will not restage an old partial install unless `supported` grows (touches D-PG10-15)

D-PG10-15 lists "an `apply` move" as a restage path. `apply`'s growth move fires only when the resolved `supported` list is a strict superset of the recorded one (`supportedSetGrew`, `orchestrators/reconcile/convergence.ts:293-300`). Taking `userConfig` out of `unsupported` does not grow `supported`. So for a record installed with `--partial` only because of `userConfig`, `apply` does nothing, and `update` does nothing at the same version. `reinstall` and disable then enable do restage. Two choices: keep the CHANGELOG instruction to run `reinstall` once (D-PG10-15 as written), or add `userConfig` to the resolver's `supported` list when the options parse, which makes the existing BFILL-01 growth move restage those records at the next `apply`. The second reuses house machinery but must first audit every reader of `compatibility.supported`. The research found one reader besides the carry-forward in `update-swap.ts`: `convergence.ts:486`.

## Project Constraints (from AGENTS.md)

- Upstream parity is the default. A divergence needs a recorded decision ID or a Pi capability gap. F1 needs one.
- Every disk mutation is atomic (NFR-1). The phase adds no new write path: the record field rides `saveState`.
- Recovery is `/claude:plugin apply`, then `/reload` (NFR-2). No throw may pass `resources_discover` or `session_start`.
- A load changes no installation state (APL-D1). Setting process variables is not installation state; rewriting staged content or `mcp-adapter.json` at load is.
- Containment (NFR-10): a legacy read of a manifest through a record must check the plugin root first (`isPluginRootContained`, UF-1). The record field avoids that read.
- Network policy (NFR-5): nothing here may add a network call. `orchestrators/` and `domain/` modules stay outside `NETWORK_SEAMS`.
- Output goes through `shared/notification-dispatch.ts` only (IL-2). No `console.*`, no `process.stdout`.
- `npm run check` must stay green: typecheck, ESLint, fallow (dead code, health with cognitive 15 and cyclomatic 20, dupes), Prettier, source and test pairing, and 100% direct coverage for every source-test pair. ESLint `sonarjs/cognitive-complexity` 15 is a second, independent ceiling.
- A user-visible `/claude:plugin` change ships a cucumber scenario that fails without it.
- An `@adapter-only` or `@builtin-only` scenario names a requirement or decision ID in its title or feature description.
- Comments and test titles cite durable IDs (D-PG10-xx, PG-CORE-xx), never phase or plan numbers. No comment on trivial code.
- Never commit to main, never `--no-verify`, merge only. Prefix `windows append --description` with `[parity-gaps]`.
- Every plan SUMMARY carries `## Threat Flags`.
- Tests use hermetic homes only (`test/platform/isolated-pi-home.ts`, the cucumber world). State this in every executor dispatch.
- Markdown is formatted by mdformat and markdownlint through pre-commit, not Prettier.
- Typed error classes, one per failure mode, narrowed with `instanceof` (CONVENTIONS.md). Dependencies are passed as parameters, never patched through a test-only seam.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse and resolve `userConfig` (schema, defaults, value text, env name, owned variable name) | domain (`domain/user-config.ts`, new, pure) | -- | Pure and network-free. Used by the resolver, three bridges, and two orchestrators. `domain` imports `shared` only. |
| The resolver arm for a required option with no default, and the malformed arm | domain (`plugin-resolver.ts`, `resolver-types.ts`) | shared (`probe-classifiers.ts`, `notify-reasons.ts`, `notification-types.ts`) | The arm decides install. The reason token belongs to the closed vocabulary. |
| Persist the option schema | persistence (`state-io.ts` record field) | orchestrators (`install-outcome.ts` `statePhase`, `update-swap.ts` record write) | Three readers never open a manifest: the hooks hydrate, the built-in registration, the AMIG-01 move. |
| Fill content at staging | bridges (`skills/stage.ts`, `commands/staged-command.ts`, `agents/convert.ts`, `agents/skill-preload.ts`) | shared (`vars.ts`) | The same point as the path variables. One substitution helper. |
| Hook env and exec-form fill, shell-form refusal | bridges-hooks (`hook-env.ts`, `spawn-helpers.ts`, `routing-state.ts`, `event-router.ts`) | -- | Both lanes share `prepareHookEnv` and `planSpawn`. |
| MCP field fill, both encodings | domain (`claude-mcp-variables.ts`) and bridges-mcp (`substitute.ts`, `adapter-entry.ts`, `builtin-entry.ts`) | orchestrators (`builtin-registration-step.ts`, `mcp-migration.ts`) | One walk, two encoders. |
| Owned process variables for adapter entries | shared (`session-env.ts` pure ledger core) | orchestrators (state-reading shell, like `plugin-path.ts`), entry (`index.ts`) | The D-v1.0-01-11 rule forbids `shared` from importing `persistence`. Mirror the PATH split. |
| `PATH` trust gate and stat filter | orchestrators (`plugin-path.ts`) | entry (`index.ts` passes `projectTrusted`) | `shared/session-env.ts` stays free of `fs`. |
| `${CLAUDE_PROJECT_DIR}` at user scope | orchestrators (`skill-invocation.ts`, `command-invocation.ts`) | -- | The edge handlers already pass `cwd`. |
| Behavioral proof | `features/` | -- | See "Cucumber ownership". |
| Records and docs | `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `.planning/upstream/`, `docs/`, `CHANGELOG.md` | -- | Append-style edits limited to this phase's rows. |

## Standard Stack

No new package. The phase runs on the installed stack.

| Component | Version | Purpose | Evidence |
|-----------|---------|---------|----------|
| typebox | ^1.1.38 | The `userConfig` schema and its compiled validator | [CITED: `.planning/codebase/STACK.md`] |
| @earendil-works/pi-coding-agent | 1.5.0 (dev), 1.5.2 (latest on npm) | Trust, built-in MCP registry | [VERIFIED: `node_modules/@earendil-works/pi-coding-agent/package.json`; `npm view` 2026-11-14 returned `"latest": "1.5.2"`] |
| pi-mcp-adapter | 7.0.1 (test peer) | Expands `${NAME}` at connect | [VERIFIED: `node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/package.json` `"version": "7.0.1"`] |
| @cucumber/cucumber | 13.3.0 | Behavioral suite | [VERIFIED: `node_modules/@cucumber/cucumber/package.json`] |
| node:crypto | built in | Hash for the owned variable name | Already used in `domain/` for version and clone keys |
| Claude Code | 2.1.323 binary | Upstream evidence | [VERIFIED: binary header `// Version: 2.1.323`] |

## Package Legitimacy Audit

Not applicable. The phase installs no external package, and `package.json` and the lockfile do not change.

## Upstream evidence records

Format of `.agents/skills/claude-code-compat-research/SKILL.md`. Binary: `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`, read with `grep -oba` and byte ranges on 2026-11-14. The binary was not run. `BIN@n` is a byte offset. The functions below live in one bundle chunk (`chunk-h9j15sx2.js`), which exports `QH`, `Jgt`, `Frn`, `$rn`, and `ySo` under those names, and the large chunk at `BIN@308952210` imports them under the same names, so one name is one function across the call sites cited.

### E1. The `userConfig` schema, and a malformed one

- **Question:** which fields does an option take, which are required, how strict is it, and what does a malformed `userConfig` do?
- **Claude Code:** Key regex and message: `o().regex(/^[A-Za-z_]\w*$/,"Option keys must be valid identifiers (letters, digits, underscore; no leading digit) — they become CLAUDE_PLUGIN_OPTION_<KEY> env vars in hooks")`. Option object (verbatim, descriptions cut):
  `u({type:B(["string","number","boolean","directory","file"]),title:o(),description:o(),required:I().optional(),default:Be([o(),E(),I(),C(o())]).optional(),multiple:I().optional(),sensitive:I().optional(),min:E().optional(),max:E().optional(),options:C(o().min(1,"An option cannot be empty").max(64,"An option can be at most 64 characters")...).min(1,"options needs at least one value").refine(... "options cannot repeat a value (in any letter case)").readonly().optional()}).strict().superRefine(...)`.
  The `superRefine` messages: `options is only for a field of type "string" that is neither multiple nor sensitive`; `a field with options needs a default among them, or required: true`; `default must be one of the options: <list>`. Each option string must also equal its trimmed form and hold no control, invisible, or bidirectional-formatting character.
  A manifest that fails the schema fails as a whole: `safeParse` returns `{ok:!1, error: "Plugin <name> has an invalid manifest file at <path>.\n\nValidation errors: <path>: <message>, ..."}` and the plugin does not load.
- **Evidence:** `BIN@299167500-299169560` (option schema), `BIN@299169560-299170100` (key regex), `BIN@309804644` (manifest failure). Docs: "Strict objects: `userConfig` options ... An unknown key inside one is an error, and the plugin doesn't load", and the field table with `type`, `title`, `description` required. [CITED: code.claude.com/docs/en/plugins/manifest-reference.md, fetched 2026-11-14]
- **Confidence:** High. The binary and the docs agree.
- **Open:** none for step 1.
- **Project constraints:** fail closed on corrupt data; a malformed `userConfig` is the `unavailable` arm.
- **Divergence:** none. Parity.

### E2. Lookup, value text, `multiple`, `directory` and `file`

- **Question:** how is a key looked up and how does a value become text?
- **Claude Code:** `function Yr(e,n){return Object.hasOwn(e,n)?e[n]:void 0}` is an own-property lookup. `Frn` and `ySo` both end in `String(value)`. A `multiple` value is an array of strings, so its text is the comma-joined list. The reference pattern in both is `/\$\{user_config\.([^}]+)\}/g`: the key is any run without `}`, not only an identifier. No code expands `~` or resolves a `directory` or `file` value; the value validator `zte` only requires `typeof value === "string"` for those two types.
- **Evidence:** `BIN@299278493` (`Yr`), `BIN@304292180-304292800` (`Frn`, `$rn`, `ySo`), `BIN@304273053` (`zte`).
- **Confidence:** High.
- **Project constraints:** the key regex admits `__proto__` and `constructor`, so every map read must be an own-property read.
- **Divergence:** none.

### E3. Where a default applies, and where an unset reference fails

- **Question:** does a `default` reach hooks, content, and MCP config, and what happens to a reference with no value?
- **Claude Code:**
  - Saved values: `function QH(e,r){...let f=_t(e,r)...}` and `async function _t(e,r){let n=jIe(e).options??{},s=(await eo().readAsync(r))?.pluginSecrets,f=[...].reduce(...);return{...n,...f}}`. No default.
  - Default merge: `function Jgt(e,r){let n={};for(let[f,m]of Object.entries(r)){if(m.required&&m.default===void 0)continue;n[f]=m.default??""}...return{...n,...s}}`.
  - MCP: `async function dNs(e,n,r){let s=e.manifest.userConfig,y=...channels...;if(!s&&!y)return;let k=s?await QH($h(e),r):void 0,...;return Jgt({...k,...v},{...s,...y})}`. Then per field `let nt=ZSe(Fe,n),it=nt;if(r)nt=Frn(nt,r);let{expanded:rt,missingVars:gt}=dX(nt,...)`: path variables, then options, then the environment scan over the result. The fields: stdio `command`, each `args` element, each `env` value except `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`; remote `url`, each `headers` value.
  - MCP failure scope: one server. `for(let[v,H]of Object.entries(y)){let q=await dNs(e,v,s);try{k[v]=QG(...,()=>cNs(H,e,q,n,e.name,v))}catch(X){n?.push({type:"generic-error",source:v,plugin:e.name,error:PI(X)})}}`. The other servers of the plugin load.
  - Hooks: `if(ve)wo=await QH(ve,rt)`. Exec form: `if(wo)Fi=Frn(Fi,wo)` after the three path variables, on `command` and on each `args` element. Export: `for(let[zi,oi]of Object.entries(wo)){let gr=zi.replace(/[^A-Za-z0-9_]/g,"_").toUpperCase();Xo[`CLAUDE_PLUGIN_OPTION_${gr}`]=String(oi)}`.
  - Hook failure scope: one hook run. The runner's caller catches: `.catch((St)=>{let wt=d(St);return{stdout:"",stderr:wt,output:wt,status:1,spawnFailed:!0}})`.
  - Skills and commands: `let ms=s.userConfig?await QH(r,Go.credentials):void 0`, then `if(n.userConfig&&n.options)s=ySo(s,n.options,n.userConfig,(k)=>r(LH(k)))`. Agents: `if(k.userConfig)At=ySo(At,await QH(h,v),k.userConfig)`.
  - `ySo`: `if(n[m]?.sensitive===!0)return`[sensitive option '${m}' not available in skill content]`;let c=Yr(r,m);if(c===void 0)return f;let l=String(c);return s?s(l):l`.
  - `Frn`: `throw Error(`Plugin option "${f}" isn't set. Open /plugin manage to configure it, or check that the plugin's userConfig schema declares "${f}".`)`.
- **Evidence:** `BIN@304282380` (`QH`, `_t`), `BIN@304290854` (`Jgt`), `BIN@313259344-313259900` (`dNs`, `cNs`), `BIN@313262700-313262900` (per-server catch), `BIN@312871364-312873400` (hook runner `Lq`), `BIN@312883290` (hook catch), `BIN@310945262`, `BIN@310955236` (skills), `BIN@311628343` (agents), `BIN@310131660` (`LH`).
- **Confidence:** Medium-high. Static read of minified code with no run. The one name per function claim rests on the chunk import list, which was read. The hooks conclusion is also supported by the docs wording ("saved value") and by the model plugin's script.
- **Open:** whether a later Claude Code release merges defaults for hooks. Check the CHANGELOG at the next version bump.
- **Project constraints:** this extension has no saved values in step 1, so strict parity would export nothing to hooks.
- **Divergence:** F1. Proposed: a default counts as a saved value. License: a recorded decision (D-PG10-04, pending maintainer review). The MCP arm is parity.

### E4. The shell-form refusal

- **Question:** what is the exact message, and is the refusal at load or at run?
- **Claude Code:** At run, inside the hook runner, before the spawn: `if(!En&&wo){if($rn(io,wo))throw new A(`Hook from ${ve?`plugin ${ve}`:"a plugin"} references \${user_config.*} in a shell-form command. The substituted value would be re-parsed by the shell. Use exec `+'form instead — {"command": "<executable>", "args": '+'["${user_config.KEY}", ...]} — or read '+"$CLAUDE_PLUGIN_OPTION_<KEY> from the hook's environment."+(St?"":` Command: ${QM(e)}`),"plugin hook references ${user_config.*} in shell-form command")}`. `$rn` is `try{return Frn(e,r)!==e}catch{return!0}`, so any `${user_config.X}` in the command triggers it, set or not. The second argument is a short form of the message. The full text, with `<id>` the plugin id, is:
  `Hook from plugin <id> references ${user_config.*} in a shell-form command. The substituted value would be re-parsed by the shell. Use exec form instead — {"command": "<executable>", "args": ["${user_config.KEY}", ...]} — or read $CLAUDE_PLUGIN_OPTION_<KEY> from the hook's environment. Command: <command>`
- **Evidence:** `BIN@312871389-312872100`. Docs: "Shell-form hook commands, monitor commands, and MCP `headersHelper` reject `${user_config.*}`. A component that references it in one of these fields fails with an error instead of running". [CITED: manifest-reference.md, fetched 2026-11-14]
- **Confidence:** High.
- **Open:** how upstream names the plugin (`ve` is the plugin id, `name@marketplace`). This extension's `RoutingEntry` has `pluginId` and `marketplace`; write `<pluginId>@<marketplace>`.
- **Divergence:** none.

### E5. `CLAUDE_PLUGIN_OPTION_<KEY>` name

- **Claude Code:** `zi.replace(/[^A-Za-z0-9_]/g,"_").toUpperCase()`: replace, then uppercase. Two keys that differ only in case map to one variable; the later entry wins. A schema-valid key never holds a character to replace.
- **Evidence:** `BIN@312873215`. **Confidence:** High. **Divergence:** none.

### E6. Plugin `bin` on `PATH`

- **Question:** which `bin` directories join `PATH`?
- **Claude Code (verbatim):** `var TAo=2000;async function $ys(e){let{enabled:n}=await gi(e),r=n.filter((h)=>!h.isBuiltin&&h.path).map((h)=>ff(h.path,"bin")).filter((h)=>{if(aT!=="\\"&&/[:"'$`\\\n\r]/.test(h))return t(`Dropping plugin bin path with shell metacharacters: ${h}`),!1;return!0}),s=await Promise.all(r.map(async(h)=>{try{return(await zt(lD(h),TAo,`stat timed out after ${TAo}ms`)).isDirectory()}catch(y){let k=w(y);if(k==="ENOENT"||k==="ENOTDIR")return!1;return t(`Keeping plugin bin path on PATH despite a failed stat (${k??d(y)}): ${h}`),!0}}));return r.filter((h,y)=>s[y])}`. The chunk imports `stat as lD` and `sep as aT` and `join as ff`.
- **Reading:** (1) the metacharacter test runs first and only when the path separator is not `\`; the set is `:`, `"`, `'`, `$`, backquote, `\`, newline, and carriage return. (2) `stat` follows a symbolic link; the path is kept when it is a directory. (3) `ENOENT` and `ENOTDIR` drop the path. Any other stat error, and the 2 s timeout, **keep** it.
- **Evidence:** `BIN@314099628` (`$ys`, exported as `getEnabledPluginBinPaths`), `BIN@309680589` (the `fs/promises` import). Docs: "Files in `bin/` at the plugin root are on the `PATH` of the Bash tool's shell while the plugin is enabled"; "Plugin `bin/` directories come after the user's own `PATH` entries". [CITED: code.claude.com/docs/en/plugins/components.md, fetched 2026-11-14]
- **Confidence:** High.
- **Project constraints:** `asAbsolutePluginRoot` already refuses a root that holds `path.delimiter`. The filter here is over the joined `bin` path.
- **Divergence:** the 2 s timeout is not copied (D-PG10-03). Keep the "other error keeps the path" arm: it is upstream's rule and no decision removes it.

### E7. Pi project trust at 1.5.2

- **Question:** did the trust-requiring list or `resolveProjectTrusted` change after 1.5.0, and can an extension register a trust path?
- **Pi:** `diff` of the installed 1.5.0 and the unpacked 1.5.2 tarball reports no difference for `dist/core/trust-manager.js`, `dist/core/project-trust.js`, and their `.d.ts` files. The list is unchanged: `"settings.json", "mcp.json", "extensions", "skills", "prompts", "themes", "SYSTEM.md", "APPEND_SYSTEM.md"` (`trust-manager.js:8-17`), plus `.agents/skills` in the cwd or an ancestor (`:157-176`). `resolveProjectTrusted` still returns `options.trustStore.get(options.cwd) ?? true` when no such resource exists, before the `project_trust` emit (`project-trust.js:22-24`). The `dist/core/extensions/types.d.ts` diff between the two versions holds only Markdown transformer types and one doc comment. No type or root export registers a trust path. The 1.5.1 and 1.5.2 changelog sections have no trust entry.
- **Evidence:** `npm pack @earendil-works/pi-coding-agent@1.5.2` unpacked in the session scratchpad on 2026-11-14; `diff` against `node_modules/@earendil-works/pi-coding-agent` (1.5.0).
- **Confidence:** High.
- **Open:** none.
- **Divergence:** D-LOC-01's accepted gap. License: a Pi capability gap, plus the recorded decision. Note for the record: `PROJECT.md:2150` still says "Pi 1.4.0 auto-trusts ...". The row D-PG10-01 writes names 1.5.0 and 1.5.2.

## Current code: readers and writers

### PATH (question 2)

`recomputePluginPath(cwd)` reads both scopes always [VERIFIED: `orchestrators/plugin-path.ts:95-106`]:

```ts
  const scopeRoots = [
    { scope: "user", extensionRoot: locationsFor("user", homedir()).extensionRoot },
    { scope: "project", extensionRoot: locationsFor("project", cwd).extensionRoot },
  ] as const;
```

Its one caller is `const pathResult = await recomputePluginPath(event.cwd);` [VERIFIED: `index.ts:199`], inside `prepareResources`, which computes `const projectTrusted = ctx.isProjectTrusted();` [VERIFIED: `index.ts:163`] and already passes it to `hydrateProjectScopeForCwd` and `loadReconcile`. Pass the same constant. Do not call `ctx.isProjectTrusted()` again: `test/index.test.ts` counts those calls with a strong mock (`trustReads`, `test/index.test.ts:342-366`).

`applyPathLedger` removes every prior-ledger entry before it appends the fresh ones (`shared/session-env.ts:159-192`), so leaving the project scope out of the fresh list removes its earlier entries with no extra code. The early return `if (freshBinDirs.length === 0 && priorLedger === "")` must stay.

The stat filter belongs in `orchestrators/plugin-path.ts`. `shared/session-env.ts` is declared pure with no `fs` (`shared/session-env.ts:13-17`).

Tests that pin "adds a missing dir" by building a record and expecting `<resolvedSource>/bin` with no directory on disk: all ten cases of `test/orchestrators/plugin-path.test.ts` (`:120` to `:486`), and the PATH cases of `test/index.test.ts` (`:1315`, `:1360`, `:1879`, `:2019`, and those through `:2333` that compare `PI_CLAUDE_MARKETPLACE_PATH`). Each needs a real `bin` directory or a new expectation. `test/shared/session-env.test.ts` tests the pure ledger and needs no change beyond none of its claims naming existence.

### `userConfig` today (question 4)

- The only reads of `userConfig` in the extension: `domain/unsupported-components.ts:44` (the closed set) and `domain/components/plugin.ts:43` (`userConfig: Type.Optional(Type.Unknown())` in `UNSUPPORTED_COMPONENT_FIELDS`, spread into both the entry and the manifest schema). `${user_config` appears only in two comments (`bridges/hooks/spawn-helpers.ts:43`, `domain/argument-substitution.ts:16`). `PLUGIN_OPTION` appears nowhere. [VERIFIED: grep over `extensions/pi-claude-marketplace`]
- The unsupported set [VERIFIED: `domain/unsupported-components.ts:38-49`]:
  `"lspServers", "monitors", "themes", "outputStyles", "channels", "userConfig", "settings", "syntaxHighlighting", "mod", "binaries"`.
- **The entry rule is not followed today.** `declaresUnsupportedKind` returns true for `entry[kind] !== undefined || manifest?.[kind] !== undefined` (`unsupported-components.ts:126-129`), so an entry `userConfig` counts even when `plugin.json` exists. The MCP resolver has the right rule to copy [VERIFIED: `domain/mcp-resolution.ts:441`]: `input.manifest === null ? input.entry.mcpServers : input.manifest.mcpServers`.
- The resolver decides the arm in `decideResolution` (`domain/plugin-resolver.ts:867-883`): a structural defect gives `unavailable`; a non-empty `partial.unsupported` gives `partially-available`. `addUnsupportedKindNotes` pushes `contains <kind>` to `notes` and the kind to `unsupported` (`:697-722`). The refusal carries `unsupportedKinds: resolved.unsupported` (`:940`).
- The closed reason vocabulary has four homes that must agree:
  - `shared/notification-types.ts` `Reason` (a bare union in catalog order; "a new token appends at the tail").
  - `shared/notify-reasons.ts` `UnsupportedReason` [VERIFIED: `shared/notify-reasons.ts:117-133`]: `"unsupported hooks" | "lsp" | "requires pi-subagents" | "requires pi-mcp-adapter" | "requires mcp" | "requires builtin mcp" | "requires pi-dynamic-workflows" | "unsupported source" | "unsupported component" | "no longer installable" | "unsupported mcp"`, with a compile-time partition proof.
  - `shared/probe-classifiers.ts` `kindToReason` [VERIFIED: `shared/probe-classifiers.ts:237-251`]: `lspServers` gives `"lsp"`, `hooks` gives `"unsupported hooks"`, `mcpServers` gives `"unsupported mcp"`, anything else gives `"unsupported component"`.
  - `orchestrators/plugin/install.messaging.ts` `classifyResolverReason` (`:545-606`), which must classify any new note the same way as `classifyResolverNote`.
- Gates that lock the vocabulary: `test/architecture/notify-closed-set-locks.test.ts:223` ("Reason is the closed 80-entry reason set"), `test/architecture/compat-01-no-expansion.test.ts:395` (members in order), `test/architecture/cross-surface-reason-parity.test.ts`, the catalog (`docs/output-catalog.md`), and the list in `docs/json-output.md:950`.
- **Naming the keys.** A reason token is a closed literal, so it cannot hold a key. The keys go in the resolver note, which the refusal message prints, and in the `info` breakdown, as dropped MCP servers do. Give the note a fixed prefix and classify it by `startsWith` in both classifiers, ahead of the `includes("lspServers")` arm of `classifyResolverNote`: a key named `lspServers` would otherwise read as `{lsp}` (the WR-01 lesson recorded at `probe-classifiers.ts`).

### Substitution passes (question 4)

| Surface | Site | Today |
|---------|------|-------|
| Skill content | `bridges/skills/stage.ts:148` (description), `:396` (whole file), context at `:507` | `substituteClaudeVars`, project dir only at project scope |
| Command content | `bridges/commands/staged-command.ts:271`, context at `bridges/commands/stage.ts:188` | same |
| Agent body | `bridges/agents/convert.ts:1016`; preloaded skills `bridges/agents/skill-preload.ts:90` | same |
| Exec-form hook | `bridges/hooks/spawn-helpers.ts:52-57` (`planSpawn`), both lanes | path variables only |
| Hook env | `bridges/hooks/hook-env.ts:75-104` (`prepareHookEnv`), both lanes (`dispatch-exec.ts:223`, `async-rewake/registry.ts:856`) | `...process.env`, three path variables, session env |
| MCP, adapter | `domain/claude-mcp-variables.ts` `expandClaudeValue`; `bridges/mcp/substitute.ts`; `bridges/mcp/adapter-entry.ts:184-213`; callers of `prepareStageMcpServers`: `install-outcome.ts:1474`, `update-swap.ts:433`, `reconcile/mcp-migration.ts:489` | `${user_config.KEY}` does not match `CLAUDE_VARIABLE` (`/\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g`), so it stays literal text |
| MCP, built-in | `bridges/mcp/builtin-entry.ts:54-69`, `builtin-escape.ts`; caller `orchestrators/mcp/builtin-registration-step.ts:195` | same walk, values resolved in memory |
| Invocation | `domain/argument-substitution.ts` `VARIABLE_NAMES` | "any other `${...}` stays literal" |

`substituteClaudeVars` is one alternation pass that never rescans a spliced value (`shared/vars.ts:57-73`). Upstream fills options last, after the path variables and `${CLAUDE_SKILL_DIR}`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}` (`KTn`, `BIN@310955236`). In one non-rescanning pass the order does not matter.

**Built-in persistence (D-PG10-12): confirmed, no file.** Pi's core "only validates and stores registrations" (`dist/core/mcp-servers.js:4-5`). The only `mcp.json` writer is `editMcpServers`, and its one caller from the extension applies a patch of `enabled` and `exposure` only (`dist/extensions/mcp/config.js:124-146`, `index.js:214`). A registered config's `command`, `args`, `env`, `url`, and `headers` are never written. So D-PG10-12 stands and the process variable is not needed under built-in.

### The two hook lanes and the failure path

Both lanes build the env with `prepareHookEnv` and the spawn with `planSpawn`. The synchronous lane already turns a throw before the spawn into a start failure [VERIFIED: `bridges/hooks/dispatch-exec.ts:223-246`, read this session]: the error text becomes `stderr`, the result is a `noop` with `failure: { kind: "run", error }` (D-PG5-10), or an `onFailure` block (D-CF5-18). That is upstream's `{status: 1, stderr, spawnFailed: true}` shape. So a typed error thrown where the plan is built reaches the user through existing code. The async lane wraps `spawnAndRegister` in a try and debug-logs (`dispatch-exec.ts:200-206`).

### CORE-05 paths (question 6)

| Path | Edge | Orchestrator | Gate |
|------|------|--------------|------|
| Typed skill, skill alias | `edge/skill-aliases.ts:134` | `invokeBridgedSkill` to `fillSkill` to `invocationVariables` | `skill-invocation.ts:151` |
| Model reads `SKILL.md` | `edge/skill-read.ts:52` | `fillSkillRead` to `invocationVariables` | same line |
| Typed command, command alias | `edge/command-invocation.ts:82` | `invokeStagedCommand` to `renderCommand` to `commandVariables` | `command-invocation.ts:164-166` |
| `run_plugin_command` | `edge/command-tool.ts:64` | `expandStagedCommand` to `commandVariables` | same lines |

The two gates [VERIFIED: `orchestrators/skill-invocation.ts:151`; `orchestrators/command-invocation.ts:164-166`]:

```ts
    ...(skill.projectScope ? { CLAUDE_PROJECT_DIR: request.cwd } : {}),
```

```ts
  if (command.scope === "project") {
    variables.CLAUDE_PROJECT_DIR = request.cwd;
  }
```

A user-scope command's staged body still holds the literal token (install keeps it), and `substituteArguments` fills `CLAUDE_PROJECT_DIR` in the body and in typed arguments when the variable is supplied (`domain/argument-substitution.ts:35-42`). So removing the two conditions is the whole change.

Tests that pin the user-scope literal and must flip:

- `test/orchestrators/command-invocation.test.ts:133` "D-CF3-10: leaves the project directory literal in a user command"
- `test/orchestrators/command-invocation.test.ts:226` "D-CF3-06: a typed argument names the project directory literally in a user command"
- `test/orchestrators/skill-invocation.test.ts:281` "D-CF2-06: leaves the project and plugin variables of a user skill without a record literal" (the project half)
- `test/orchestrators/skill-invocation.test.ts:642` "D-CF1-03: leaves the project directory of a user skill literal"

Tests that stay, because install staging keeps the literal: `test/bridges/skills/stage.test.ts:1464`, `test/bridges/agents/stage.test.ts:593`. No feature file pins the user-scope literal today; `features/skill/invocation.feature:178` and `features/slash-command/invocation.feature:88` are project-scope.

### Where the option schema comes from (question 7)

| Reader | What it has in hand | Manifest reachable cheaply? |
|--------|--------------------|-----------------------------|
| Install, enable, cascade (`install-outcome.ts`) | the fresh resolution | yes |
| Update, reinstall (`update-swap.ts`) | the fresh resolution | yes |
| Hooks hydrate at load (`event-router.ts:665-696`) | the record and the staged `hooks.json` only | no |
| Built-in registration, each session (`builtin-registration-step.ts`) | the record's `mcpServerConfigs` | no |
| AMIG-01 move at load (`reconcile/mcp-migration.ts:459-471`) | a resolution for a moving owner, the record otherwise | partly |
| Owned process variables at factory time | the record | no |

**Recommendation: store the parsed schema on the record.** A manifest read at load fails four ways. It costs a file read and parse per plugin per load. A plugin with no `plugin.json` keeps its options in the marketplace entry, which needs the marketplace manifest. A path-source plugin's root is the live marketplace clone (CORE-08), so the manifest can be newer than the staged content, and the hook values would then disagree with the filled skills. And a read through a record needs the UF-1 containment check first.

The record has a direct precedent [VERIFIED: `persistence/state-io.ts:143-156`]: `mcpServerConfigs` is "OPTIONAL and additive -- NO schemaVersion bump", stored "as the plugin declared it, before plugin-variable substitution", with "ABSENCE MEANS \"this record predates the key\"". Add `userConfig` the same way: the validated option map as declared. It holds no value the user typed, as D-PG10-14 requires. Re-validate it at read with the same parser, as `PLUGIN_ENTRY_VALIDATOR.Check` is re-run in `install-outcome.ts`; a project record is a file a repository can commit.

Two writers set record fields from a resolution: `statePhase` in `install-outcome.ts:1646-1699` and the record write in `update-swap.ts`. Make the new field required on the internal carrier types that feed them (`InstallLedgerContext` and its update twin), so a forgotten site is a compile error.

### Existing installs (question 8)

A record installed with `--partial` because of `userConfig` holds `compatibility.installable: false` and `compatibility.unsupported` containing `"userConfig"`. That block is written at install [VERIFIED: `orchestrators/plugin/install-outcome.ts:1671-1683`] and read as stored:

- `list`, completion: `classifyInstalledRecord` returns `partially-installed` when `record.compatibility.unsupported.length > 0` (`plugin-state-classifier.ts:178-184`). The row stays `(partially-installed) {unsupported component}`.
- `info`: the installed row reads the persisted `compatibility.unsupported` (`info.ts:2380-2409`).
- Only the `mcpServers` kind is recomputed per MCP implementation at read time (`effectiveMcpCompatibility`). No other kind is.
- `apply` convergence: no move (F10). `update`: no move at the same version.
- `reinstall`, disable then enable: restage. `statePhase` and `update-swap` write the fresh `compatibility`, so the status becomes `installed` and the row loses its reason. This is what "re-derived, not sticky" means in this code: each restage rewrites the block; nothing recomputes it at read.
- Hooks of such a record get no `CLAUDE_PLUGIN_OPTION_*` until the restage, because the record has no `userConfig` field. That matches D-PG10-15.
- The completion cache: F9.

## D-PG10-11 mechanism

### What pi-mcp-adapter 7.0.1 does (confirmed)

The expansion function [VERIFIED: `node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/utils.ts:148-154`]:

```ts
export function interpolateEnvVars(value: string, environment: NodeJS.ProcessEnv = process.env): string {
  return value
    // `${NAME:-default}` uses the default only when NAME is unset, as Claude Code does.
    .replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (_, name, fallback: string | undefined) => environment[name] ?? fallback ?? "")
    .replace(/\$env:(\w+)/g, (_, name) => environment[name] ?? "")
    .replace(/\{env:(\w+)\}/g, (_, name) => environment[name] ?? "");
}
```

| Field | Where it is expanded, at connect | Unset variable |
|-------|----------------------------------|----------------|
| `command` | `resolveConfigPath(definition.command)` (`server-manager.ts:1208`, `utils.ts:300-304`): interpolate, then expand a leading `~` | empty string |
| `args` | `expandHomePath(interpolateEnvVars(argument))` (`server-manager.ts:1211-1214`) | empty string |
| `env` | `resolveEnv` to `resolveCommandSecretsRecord` to `resolveCommandSecret` (`server-manager.ts:2253-2271`, `utils.ts:228-264`) | empty string |
| `url` | `resolveServerUrl` (`utils.ts:280-298`, called at `server-manager.ts:1690`) | **throws** `Missing environment variable in MCP server URL: <NAME>` |
| `headers` | `resolveCommandSecretsRecord(definition.headers, ...)` (`server-manager.ts:1704`) | empty string |

All five read `process.env` when the server connects. A leading `!` runs a shell command only when the **raw config value** starts with `!` (`utils.ts:235-236`). An entry value that starts with `${` never does, so an option value cannot trigger a command through a reference.

### How this extension sets process variables today

`applyMcpAdapterEnv` sets `PI_CLAUDE_MARKETPLACE_EMPTY` and `CLAUDE_PROJECT_DIR` (`shared/session-env.ts:118-135`). It runs twice: synchronously at the top of the factory, `applyMcpAdapterEnvFrom(() => process.cwd());` (`index.ts:91`), and at every `session_start`, `applyMcpAdapterEnvFrom(() => ctx.cwd);` (`index.ts:271`). The factory comment gives the reason: "pi-mcp-adapter may load first and connect servers from its own `session_start`, so the values must exist before this extension's handlers run" (`index.ts:88-90`). The factory is async and Pi awaits it before any session event.

### Proposed design

**Name.** `PI_CLAUDE_MARKETPLACE_OPTION_<16 hex>`, where the hex is the first 16 characters of `sha256("<scope>\0<marketplace>\0<plugin>\0<key>")`. The name matches the adapter's `\w+` and this module's `[A-Za-z_][A-Za-z0-9_]*`. A hash avoids two collisions that a readable name has: `a-b` and `a_b` after sanitizing, and `mode` and `MODE` on a platform with case-insensitive variables. The name is a pure function of four strings, so a restage writes the same bytes and `writeIfChanged` stays a no-op (AS-8). The marker needs no new member.

**Ledger.** `PI_CLAUDE_MARKETPLACE_OPTIONS`, a comma-joined list of the owned names, following `PATH_LEDGER_ENV`. On each apply: delete every name in the prior ledger that the fresh set lacks, set the fresh ones, write the ledger. On read, keep only ledger entries that start with the owned prefix, as `applyPathLedger` keeps only absolute entries: a tampered ledger must not delete an unrelated variable.

**Deny-list.** The name is not withheld. `isDenied` reads `PLAIN_DENIED_NAMES`, `matchesPlainNamePattern` (artifact `*_BASE_URL`, memory API names, `OTEL_*`), `REMOTE_SINK_DENIED_NAMES`, and `matchesRemoteSinkNamePattern` (`GIT_CONFIG_*`, `CARGO_REGISTRIES_*_TOKEN`, a registry prefix, `BUNDLE_*`) (`domain/claude-credential-denylist.ts:324-332`, `:470-480`). None matches the prefix. A hash name also holds no secret word. Still, emit the option reference directly as a `ref` segment and do not send it through `segmentFor`: upstream never applies the deny-list to an option key.

**Segments.** Add the option pass to `expandClaudeValue`, after `replaceBuiltins` and before the `CLAUDE_VARIABLE` scan (upstream's order: `ZSe`, `Frn`, `dX`). Use upstream's pattern, `/\$\{user_config\.([^}]+)\}/g`. Run it only when the plugin declares `userConfig` (F5). For each reference:

- no value: add the key to a new `unsetOptions` list on `ExpandedValue`;
- adapter encoding: a `{ kind: "ref", name: <owned name> }` segment, so the existing guards in `serializeSegments` (`PARTIAL_TRIGGER_TAIL`, `MARKER_COMPLETION`) apply unchanged;
- built-in encoding: a `{ kind: "text", text: <value> }` segment, so `escapedForPi` and the `startsWithHome` check in `builtin-entry.ts` apply unchanged.

The option value is not scanned again for `${NAME}`. Upstream does scan it (`dX` runs after `Frn`). Record that as part of D-PG10-11: under the adapter the value is not in the entry, so the scan is not possible, and the built-in arm follows for one behavior across implementations.

**The stage's environment.** Three stage-time decisions read `substitution.env`: the `caFile` origin rule (`resolvedUrl`, `adapter-entry.ts:291-305`, which treats a reference to an unset variable as "no origin"), the OAuth decision (`isCleanHeaderValue`, `:139-150`, which drops `auth` when a header names an unset or empty variable), and the missing-variable report. Give the stage an environment that already holds the plugin's option variables: `{ ...input.env, ...optionEnv }`. Then a url such as `https://${user_config.host}/mcp` resolves to its origin, a carried `caFile` survives a restage at the same origin, and a header that references an option keeps `auth`. No process variable has to be set before the stage runs.

**An exported value must be escaped.** The adapter's second and third passes read what the first pass inserted. A default of `{env:AWS_SECRET_ACCESS_KEY}`, referenced in a header, would be expanded from Pi's environment and sent to the plugin's server. That bypasses AVAR-05. `applyMcpAdapterEnv` refuses a working directory with a marker for this reason (`shared/session-env.ts:128-131`). For an option, export the value through the same split-token escape that literal text gets: `serializeLiteral(value, false)` from `bridges/mcp/adapter-escape.ts`. Worked case: the value `{env:HOME}` is exported as `{env:{env:PI_CLAUDE_MARKETPLACE_EMPTY}HOME}`; pass 3 matches only the inner token, replaces it with the empty string, and does not rescan, so the server receives `{env:HOME}`. The value `$env:HOME` is exported as `$env{env:PI_CLAUDE_MARKETPLACE_EMPTY}:HOME`; pass 2 finds no `$env:`, pass 3 removes the token. The overlay in the stage's environment must hold the same escaped text, because `resolvedUrl` runs the same three passes. [ASSUMED: derived by reading the two regex chains; prove it with a unit test that runs the adapter's own `interpolateEnvVars`, in the style of `test/integration/adapter-expansion-conformance.test.ts`]

**A leading `~`.** The adapter expands a leading `~` in `command` and in each `args` element after interpolation. A literal one is already a blocked feature (`"command ~"`, `"args ~"` in the dropped-server union, `domain/resolver-types.ts`). An option value that starts with `~`, referenced at the start of `command` or of an `args` element, would be expanded under the adapter and not upstream. Block that server at the stage, as the built-in arm does for a resolved `~` (`builtin-entry.ts:78-91`).

**When the variables are set.**

1. In the factory, awaited, before it returns, for the user scope and for the project scope at `process.cwd()` (see Open Question 1 for the trust issue). This is the only point that is certain to precede the adapter's `session_start`.
2. At every `session_start`, from `ctx.cwd`, next to `applyMcpAdapterEnvFrom`.
3. After a successful install, update, reinstall, enable, or apply, so an adapter command that reconnects before `/reload` finds the values. A stale name after an uninstall or disable is removed at the next load.

Read state with `loadState(extensionRoot, { persistMigration: false })`, as `builtin-registration-step.ts:89` does: a load must not write.

**If a scope's state cannot be read**, leave that scope's owned names as they are. The PATH ledger removes them, which is right for `PATH`. Here a removed variable turns a reference into the empty string for four of the five fields, and a stdio server would start with a wrong argument.

**pi-mcp-adapter project approval.** The adapter approves a project server by a hash of its definition (`project-server-trust.ts`). The reference text is stable, so a later value change does not ask again. The first restage of a plugin whose entry held a literal `${user_config.KEY}` changes the bytes and asks once. Say so in the CHANGELOG.

**pi-subagents.** A background child inherits the parent's environment, and its hash of an MCP server definition reads the entry text, which is stable.

## Architecture Patterns

### Data flow

```
plugin.json userConfig (or marketplace entry when no plugin.json)
        │
        ▼
 domain/user-config.ts  parse (strict, upstream schema)
        │                 ├─ malformed ──────────────► resolver: unavailable, note names key/field
        │                 └─ ok
        ▼
 resolved options  { saved: {}  (step 1: defaults count as saved, F1)
                     mcp:   Jgt({} , schema)  (default, "" for non-required, absent for required)
                     unsetRequired: [keys] ──────────► resolver: partially-available, new reason
                     sensitive: set of keys }
        │
        ├──► install record: userConfig (as declared)  ◄── statePhase, update-swap
        │
        ├──► content staging (skills, commands, agents): value │ literal when unset │ placeholder when sensitive
        │
        ├──► hooks: CacheEntry ─► RoutingEntry ─► prepareHookEnv (CLAUDE_PLUGIN_OPTION_<KEY>)
        │                                        └► planSpawn (exec fill │ shell-form refusal │ unset throw)
        │                                             └► existing start-failure path (D-PG5-10)
        │
        └──► MCP walk (expandClaudeValue)
                 ├─ adapter:  ${PI_CLAUDE_MARKETPLACE_OPTION_<hash>}  in mcp-adapter.json
                 │              ▲ value in process.env, escaped; ledger PI_CLAUDE_MARKETPLACE_OPTIONS
                 │              │ set in factory, at session_start, after install/update/enable
                 ├─ built-in: value as text in Pi's session registry (no file)
                 └─ unset option referenced ─► that server is not written or registered, and is reported

 load (resources_discover):  projectTrusted ──► recomputePluginPath(cwd, projectTrusted)
                                                  user scope always; project scope only when trusted
                                                  bin kept when: no metacharacter and stat is a directory
```

### Recommended structure

```
extensions/pi-claude-marketplace/
├── domain/user-config.ts            # new: schema, parse, resolve, value text, env names
├── domain/plugin-resolver.ts        # userConfig stage; the two new arms
├── domain/claude-mcp-variables.ts   # option pass in expandClaudeValue
├── shared/vars.ts                   # option references in content
├── shared/session-env.ts            # pure owned-variable ledger core
├── orchestrators/plugin-options.ts  # new: state-reading shell for the ledger (mirrors plugin-path.ts)
├── orchestrators/plugin-path.ts     # trust input, stat filter
├── persistence/state-io.ts          # record field userConfig
└── bridges/hooks/{hook-env,spawn-helpers,routing-state,event-router}.ts
```

The new module names are suggestions. Each new source file needs a paired test with 100% direct coverage.

### Pattern 1: one resolved value object, two maps

**What:** `resolveOptions(schema)` returns the saved-equivalent map and the MCP map as separate members, plus the unset required keys and the sensitive key set.
**Why:** F1 and F4. Hooks and content read one map; MCP reads the other. A later move to strict parity or to step 2 changes one producer.
**Shape (names are illustrative):**

```ts
// Source: Claude Code 2.1.323 Jgt (BIN@304290854) and QH (BIN@304282380)
interface ResolvedOptions {
  /** What hooks and content read. Step 1: each declared default, as text. */
  readonly values: ReadonlyMap<string, string>;
  /** What MCP fields read: Jgt's map. A non-required option with no default is "". */
  readonly mcpValues: ReadonlyMap<string, string>;
  /** Keys with required: true and no default. Non-empty selects the partial arm. */
  readonly unsetRequired: readonly string[];
  readonly sensitive: ReadonlySet<string>;
}
```

Use a `Map`, or `Object.hasOwn` on every read: the key regex admits `__proto__`.

### Pattern 2: required fields on the carriers

Every place that builds a `CacheEntry`, a `ReadAndCachePluginHooksOptions`, a `McpSubstitutionContext`, or a staging context gets the option data as a **required** member. There are two `CacheEntry` producers (`event-router.ts:218`, `:779`), three `prepareStageMcpServers` callers, and one built-in context (`builtin-registration-step.ts:247-252`). An optional member compiles at every site that forgets it.

### Pattern 3: the failure model per surface

| Surface | Condition | Result | Existing carrier |
|---------|-----------|--------|------------------|
| Manifest | `userConfig` fails the schema | plugin `unavailable` | `decideResolution` structural arm |
| Manifest | a `required` option has no default | plugin `partially-available` | `partial.unsupported` plus a new reason |
| Content | reference to an option with no value | stays literal | none needed |
| Content | reference to a sensitive option | placeholder text | none needed |
| Exec-form hook | reference to an option with no value | that hook run fails with upstream's message | `dispatch-exec.ts` start-failure path |
| Shell-form hook | command names `${user_config.` | that hook run is refused with upstream's message | same |
| MCP field | reference to an option with no value | that one server is not written or registered; the command reports it | see Open Question 2 |

### Anti-Patterns to Avoid

- **Writing a value into `mcp-adapter.json`,** including as a `${NAME:-default}` fallback. D-PG10-11 forbids it, and a fallback is the value.
- **Reading a manifest at load** for the hooks hydrate or the registration. Use the record.
- **Putting the stat in `shared/session-env.ts`.** The module is pure by its own header.
- **A second `ctx.isProjectTrusted()` call for `PATH`.** Pass the constant computed at `index.ts:163`.
- **Sending the option reference through `segmentFor`.** It would be reported as a missing variable and tested against the deny-list.
- **Exporting a raw value.** See the escape above.
- **A reason token that carries a key.** The vocabulary is closed literals; the keys go in the note and in `info`.
- **Claiming parity for the hook and content default** in a doc, a comment, or a scenario title.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Option schema validation | hand-written field checks | a typebox schema compiled once, plus small functions for the `options` rules | the house pattern in `domain/components/*.ts`; strictness is one option |
| Owned-variable bookkeeping | module-level state | an env-var ledger like `PATH_LEDGER_ENV` | module state is wiped on `/reload`; `process.env` persists |
| Adapter-safe text | a new escaper | `serializeLiteral` and `serializeSegments` in `bridges/mcp/adapter-escape.ts` | they already encode the adapter's three passes |
| Hook failure reporting | a new result kind | the start-failure path in `dispatch-exec.ts` | it already carries a cause to the user (D-PG5-10, D-CF5-18) |
| Record field | a side file | an optional field on `PLUGIN_INSTALL_RECORD_SCHEMA` | atomic with the record, under the state lock |
| Own-key copies | `obj[key] = value` with input keys | `safeSet` or a `Map` | `__proto__` is a valid option key |
| Untrusted project in a scenario | a custom temp home | the cucumber world's profile | hermetic by construction |
| Restaging old installs | a load-time rewrite | `reinstall`, or the BFILL-01 growth move (F10) | APL-D1 |

**Key insight:** every surface already has a single choke point: `substituteClaudeVars` for content, `prepareHookEnv` and `planSpawn` for hooks, `expandClaudeValue` for MCP. The work is to feed each one the same resolved options, not to add new passes.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` records installed with `--partial` hold `compatibility.unsupported` with `"userConfig"` and no `userConfig` field. | None at load. A restage rewrites both. The reader treats an absent field as "predates the key". |
| Stored data | `mcp-adapter.json` entries of such installs hold the literal text `${user_config.KEY}`. | None at load. The next restage writes the reference. |
| Stored data | Staged skills, prompts, and agent files of such installs hold the literal reference. | None at load. The next restage fills them. |
| Stored data | Completion cache files with `schemaVersion` 7 hold the old candidate classification. | Bump to 8 (F9); the reader drops and rebuilds. |
| Live service config | pi-mcp-adapter's project approvals are keyed by a hash of the entry. | None in code. The first restage asks again for an affected project server. CHANGELOG. |
| OS-registered state | None. Verified: the extension registers nothing with the OS. | None. |
| Secrets and env vars | New process variables `PI_CLAUDE_MARKETPLACE_OPTION_*` and the ledger `PI_CLAUDE_MARKETPLACE_OPTIONS`. They die with the process. | Document them in `docs/env-vars.md`. Add them to the env snapshot list at `test/index.test.ts:304`. |
| Build artifacts | None. No build step. | None. |

## Common Pitfalls

### Pitfall 1: The abbreviated fixture is malformed

**What goes wrong:** A scenario copies `{"mode": {"type": "string", "default": "fast"}}` from the roadmap, and the plugin resolves `unavailable`.
**Why:** `title` and `description` are required (F2).
**Avoid:** Use the full shape everywhere. Add one scenario that proves the abbreviated shape is refused, so the strictness is pinned.

### Pitfall 2: An option field compiles everywhere it is forgotten

**What goes wrong:** One staging path fills options and another does not, and the type checker is silent.
**Why:** An optional member (the recorded "optional-field silent-omission class").
**Avoid:** Pattern 2. Then grep the three `prepareStageMcpServers` callers and the two `CacheEntry` producers by name in the plan check.

### Pitfall 3: Existing hook pins on the literal reference

**What goes wrong:** `features/hook/process.feature` and two unit tests fail after the exec-form change.
**Why:** They pin D-CF5-15's literal pass-through for a plugin with no `userConfig` (F5).
**Avoid:** Change them in the same plan as the hook change, and say why in the plan.

### Pitfall 4: PATH tests assume a missing directory joins

**What goes wrong:** About eighteen cases fail at once.
**Why:** They build records with a `resolvedSource` that has no `bin` on disk.
**Avoid:** Create the directory in the fixture, or re-expect. Keep one case for each stat outcome: directory, missing, a file named `bin`, a symbolic link to a directory, and an error other than `ENOENT`.

### Pitfall 5: The strong mock counts trust reads

**What goes wrong:** `test/index.test.ts` fails with an unexpected `isProjectTrusted` call.
**Avoid:** Pass the constant.

### Pitfall 6: A default can smuggle an adapter marker

**What goes wrong:** A plugin's default of `{env:NAME}` or `$env:NAME` reaches its own server expanded from Pi's environment.
**Why:** The adapter re-reads inserted text in passes 2 and 3.
**Avoid:** Export the escaped value. Test it against the adapter's own function.

### Pitfall 7: The stage decides with the wrong environment

**What goes wrong:** A restage removes the user's `caFile` with `url-unresolved`, or drops `auth`, for a server whose url or header names an option.
**Why:** `resolvedUrl` and `isCleanHeaderValue` read `substitution.env`, where the owned variable is unset.
**Avoid:** Overlay the option variables on the stage's environment.

### Pitfall 8: The variables arrive after the adapter connects

**What goes wrong:** A stdio server starts with an empty argument and stays up for the session (`lazy-keep-alive`).
**Why:** The variable was set in a `session_start` handler that ran after the adapter's.
**Avoid:** Set it in the awaited factory.

### Pitfall 9: A reason added in one place

**What goes wrong:** Typecheck or an architecture test fails, or `list` and `install` disagree.
**Why:** The reason vocabulary has four homes and three gates.
**Avoid:** One plan task that touches `notification-types.ts`, `notify-reasons.ts`, `probe-classifiers.ts`, `install.messaging.ts`, the two lock tests, the parity test, `docs/output-catalog.md`, and `docs/json-output.md`.

### Pitfall 10: A note with a key in it is misclassified

**What goes wrong:** An option key `lspServers` or a key containing `source` gives the row the wrong reason.
**Why:** `classifyResolverNote` and `classifyResolverReason` fall back to substring tests.
**Avoid:** A fixed note prefix, matched by `startsWith`, before the substring arms, in both classifiers.

### Pitfall 11: Two complexity gates

**What goes wrong:** `expandClaudeValue`, `planSpawn`, or `recomputePluginPath` passes ESLint and fails fallow, or the reverse.
**Avoid:** Put each new pass in its own small function. Do not grow `segmentFor`.

### Pitfall 12: A stage-time fill is read again at invocation

**What goes wrong:** A default that holds `$ARGUMENTS`, `$1`, or `` !`cmd` `` is expanded when the user invokes the skill.
**Why:** The value is written at staging, and the invocation passes run later. Upstream fills at invocation and guards the value (`LH`, the wrapper).
**Avoid:** Nothing for step 1: the default is the plugin author's own text, and the author can write the same thing in the body. Extend the residual note in `domain/argument-substitution.ts:11-19` to say so. Step 2 must move the fill to invocation or guard the value.

### Pitfall 13: A stale variable after a failed state read

See "If a scope's state cannot be read" above.

## Code Examples

### Verbatim in-repo values the plan depends on

The ledger precedent [VERIFIED: `shared/session-env.ts:73`, `:82`]:

```ts
export const PATH_LEDGER_ENV = "PI_CLAUDE_MARKETPLACE_PATH";
export const ADAPTER_EMPTY_ENV = "PI_CLAUDE_MARKETPLACE_EMPTY";
```

The comment to correct [VERIFIED: `shared/session-env.ts:144-148`]:

```ts
 * surviving base and against itself). Append never prepends -- a plugin binary
 * cannot shadow a system/Pi binary (T-90-01). Adds a dir even if it does not
 * exist on disk (no fs stat; Claude Code parity). The new ledger holds exactly
 * the dirs actually appended, so a repeated recompute is idempotent and a
 * plugin dropped between loads leaves no stale entry (D-90-01).
```

The segment model [VERIFIED: `domain/claude-mcp-variables.ts:48-50`]:

```ts
export type Segment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "ref"; readonly name: string; readonly fallback?: string };
```

The hook env [VERIFIED: `bridges/hooks/hook-env.ts:86-95`]:

```ts
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: vars.projectDir,
    CLAUDE_PLUGIN_ROOT: vars.pluginRoot,
    CLAUDE_PLUGIN_DATA: vars.pluginData,
    ...extra,
    // D-91-02: the session env spreads LAST so the authoritative per-dispatch
    // snapshot wins over both the live `process.env` and any per-lane `extra`.
    ...claudeSessionEnvFor(transCtx.sessionId),
  };
```

Put the option variables after the three path variables and before `...extra`, so the session env still wins.

The exec-form arm [VERIFIED: `bridges/hooks/spawn-helpers.ts:52-57`]:

```ts
  if (Array.isArray(argsField)) {
    const args: string[] = (argsField as readonly unknown[]).map((a): string =>
      typeof a === "string" ? substituteClaudeVars(a, vars) : JSON.stringify(a),
    );
    return { command: substituteClaudeVars(command, vars), args, shell: false };
  }
```

### PATH filter, shape only

```ts
// Source: Claude Code 2.1.323 getEnabledPluginBinPaths (BIN@314099628).
// The character class is upstream's, verbatim.
const SHELL_METACHARACTER = /[:"'$`\\\n\r]/;

async function isUsableBinDir(dir: string): Promise<boolean> {
  if (path.sep !== "\\" && SHELL_METACHARACTER.test(dir)) {
    return false;
  }

  try {
    return (await stat(dir)).isDirectory();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code !== "ENOENT" && code !== "ENOTDIR";
  }
}
```

Log each drop and each kept-despite-error through `hookDebugLog(..., "env")`, as `collectBinDirs` logs an invalid root.

### Scenario steps the new scenarios reuse

- `Given the published plugin {string} of the marketplace {string} has the file {string} with this text:` (`features/step_definitions/plugin/publishing.steps.ts:329`) writes `.claude-plugin/plugin.json` with `userConfig`.
- `Given the published plugin {string} of the marketplace {string} has these hooks, each recording its runs:` with a `form` of `exec` and an `arguments` cell (`features/hook/process.feature:13-15`).
- `Then the hooks record these runs:` states every `CLAUDE_*` variable of the hook's environment as a column, because the recorder keeps "every `CLAUDE_*` variable" (`features/lib/hook-recorder.ts:68-74`). `CLAUDE_PLUGIN_OPTION_MODE` appears as a column with no harness change.
- `Given the scripted model plays these steps:` with `| reply | tool | arguments |` and a `bash` row, then `Then the model receives these calls:` with `bash returned: ...` (`features/plugin/project-trust.feature:28-41`).
- `Given the project holds a pi settings file` and `Given pi runs with the scripted model in an untrusted project` (`features/step_definitions/model.steps.ts:74`).
- `Given the published plugin {string} of the marketplace {string} has the stub mcp server {string} with these fields:` (`features/step_definitions/mcp-server/builtin-values.steps.ts:46`) and the stub that echoes two environment variables (`configuration.steps.ts:183`).
- `Then the http mcp server {string} receives these json-rpc requests:` (`configuration.steps.ts:291`); the HTTP stand-in logs every header (`features/lib/mcp-server-http.ts`).

## Records to correct (question 9)

| Where | Line | Now | Change |
|-------|------|-----|--------|
| `shared/session-env.ts` | 145-146 | "Adds a dir even if it does not exist on disk (no fs stat; Claude Code parity)." | The ledger core appends what it is given; the caller keeps only an existing directory (D-PG10-03). |
| `orchestrators/plugin-path.ts` | 24-33, 71-86 | no trust input, no filter | Header and doc comments for the trust input and the filter. |
| `docs/env-vars.md` | 55 | "Each installed enabled plugin's `<pluginRoot>/bin` is appended ..." | Add: only when the directory exists; a project plugin's only in a trusted project. **Note:** on this branch no line near 180 says a missing `bin` is added. Line 180 is the user-scope paragraph below. The only PATH text is line 55 and the ledger section at 159-161. |
| `docs/env-vars.md` | 35, 71, 85, 97 | "user-scope occurrences stay literal (SUB-02)" | Skills and commands: filled at invocation and at the model's read (D-PG10-16). Agents: still literal at user scope. |
| `docs/env-vars.md` | 178-184 | "Pi writes skill, command and agent content once at install time, when the project root of a future session is not known." | Replace the reason. Keep the agent sentence. |
| `docs/env-vars.md` | 256 | "`${user_config.*}` / `CLAUDE_PLUGIN_OPTION_*` -- needs a plugin-options feature Pi does not have." | Remove from "Not delivered". Add the delivered rows, the two new pi-only variables, and the divergence (F1, D-PG10-11). The matrix column itself is PG-DOC-02 (Phase 11). |
| `docs/hooks-compatibility.md` | 295 | "`${user_config.KEY}` also stays as written, because Pi has no plugin user configuration (USRCFG-01)." | Filled in exec form; refused in shell form; unset fails the run. |
| `docs/hooks-compatibility.md` | 404 | `${user_config.*}` interpolation, Pi ✗ | ✓ for defaults, with the divergence note. |
| `docs/mcp-compatibility.md` | -- | no `${user_config` text (grep found none) | Add one short section: defaults fill the five fields; under pi-mcp-adapter the entry holds a reference (D-PG10-11). |
| `docs/output-catalog.md`, `docs/json-output.md:950` | -- | the reason list | Add the new reason. |
| `domain/argument-substitution.ts` | 16-17 | "`${user_config.*}` stays literal: plugin user configuration is not a supported component, so Pi has no value for it." | Pi fills it at staging; a value is read by the `$` passes only in Pi (Pitfall 12). |
| `bridges/hooks/spawn-helpers.ts` | 38-46 | "`${user_config.KEY}` included, stays literal" | The new rule. |
| `domain/unsupported-components.ts` | 14-17, 38-49 | `userConfig` in the set; audit note at 2.1.291 | Remove the member; move the audit note to 2.1.323 (core report W9). |
| `.agents/skills/claude-code-compat-research/SKILL.md` | "Kinds this project deliberately does not bridge" | lists `userConfig` | Remove it from the list. Only if the planner counts the skill as a record to correct; it is outside D-PG10-18's list, so ask or leave a note. |
| `.planning/PROJECT.md` | 745 | PENV-01: "added even if the directory does not exist — verified live: Claude Code 2.1.212 ..." | True at 2.1.212, not at 2.1.323; now only an existing directory. |
| `.planning/PROJECT.md` | 1707 | Validated bullet: "added even if absent) — matching Claude Code 2.1.212 (PENV-01)" | Append "(corrected by D-PG10-03)". |
| `.planning/PROJECT.md` | 2150 | D-LOC-01 row; gated list; "Pi 1.4.0 auto-trusts ..." | Add `PATH` to the gated list and "Confirmed by D-PG10-01 (Pi 1.5.0 and 1.5.2)". |
| `.planning/PROJECT.md` | 2203 | D-CF5-15: "`${user_config.*}` stays literal (USRCFG-01)" | Append "Amended by D-PG10-10". |
| `.planning/PROJECT.md` | after 2401 | Key Decisions table ends at D-PG9-16 | Append D-PG10-01, D-PG10-04, D-PG10-11, D-PG10-16 in the D-PG9 row format, each "pending maintainer review". Add a footer line after 2702. |
| SUB-02 | `.planning/milestones/v1.17-REQUIREMENTS.md:46` (archived); `PROJECT.md:2573` footer | no SUB-02 row in `PROJECT.md` | Follow the D-PG9-01 precedent for ANAME-05: put "amends SUB-02" in the D-PG10-16 row title and the footer. Do not edit the archived file. |
| `.planning/BACKLOG.md` | 1387 | USRCFG-01 | Amend: step 1 ships; steps 2 and 3 open behind decision 30; the keychain claim corrected (W4). |
| `.planning/BACKLOG.md` | 4843 | item 2: no scenario for `bin` on `PATH` | Mark covered by this phase's scenarios. |
| `.planning/BACKLOG.md` | end | -- | New entry, for example `PITRUSTPATHS-01`, trigger: a Pi release that lets an extension register a trust-requiring path or emits `project_trust` for every project. |
| `.planning/upstream/pi-extension-trust-paths.md` | new | -- | Shape of `pi-mcp-adapter-per-server-sampling.md`: H1 problem title; `Patch: no patch exists; this report is not filed.`; `Repository:`; `Package version: 1.5.2, read as source, 2026-11-14`; Problem with `dist/core/trust-manager.js:8-17`, `:157-176`, `dist/core/project-trust.js:22-24`, `dist/main.js:637`, `:650-654`; "Claude Code, for contrast"; `## Draft issue`. |
| `CHANGELOG.md` | 5-25 | the milestone's `[Unreleased]` bullet | One sub-bullet (the `changelog` skill, then `simple-english` Plain and `humanizer`): options with defaults, the `reinstall` instruction, and the one-time project server approval. |

## Cucumber ownership (question 10)

Rules read: `.agents/skills/cucumber/rules/layout.md`, `features.md`. A feature lives in the directory of its function, and `Feature: <Function> <capability>` is `features/<function>/<capability>.feature`. A step belongs to the function of the thing it names. A scenario with a step that has the word `mcp`, or a doc string or cell that names `mcpServers` or `.mcp.json`, is an MCP scenario and carries exactly one implementation tag.

| Scenario | Feature file | Tag | Step module for a new step |
|----------|-------------|-----|----------------------------|
| A project plugin's executable is not found by the bash tool in a project the user marked "Do not trust" | `features/plugin/project-trust.feature` (existing) | none | `model.steps.ts` (the profile step), `plugin/publishing.steps.ts` (the executable) |
| A trusted project's plugin executable is found by the bash tool | `features/plugin/executables.feature` (new, `Feature: Plugin executables`) | none | `plugin/publishing.steps.ts` |
| Two enabled plugins, one with `bin/`: one plugin entry on `PATH` | `features/plugin/executables.feature` | none | -- |
| A plugin whose options all have a default installs without `--partial` | `features/plugin/options.feature` (new, `Feature: Plugin options`) | none | -- |
| A required option with no default is refused without `--partial`, and installs with it | `features/plugin/options.feature` | none | -- |
| A `userConfig` option without `title` makes the plugin unavailable | `features/plugin/options.feature` | none | -- |
| `info` lists the unset required options | `features/plugin/options.feature` or `info.feature` | none | -- |
| A hook's environment holds `CLAUDE_PLUGIN_OPTION_MODE` | `features/hook/process.feature` (existing: "its command form, its arguments, and its environment") | none | -- |
| An exec-form hook's command and arguments have the option filled | `features/hook/process.feature` | none | -- |
| A shell-form hook that names `${user_config.` is not run, with Claude Code's message | `features/hook/failures.feature` (existing) | none | -- |
| An exec-form hook that names an unset option fails with Claude Code's message | `features/hook/failures.feature` | none | -- |
| The option reaches `command`, `args`, and `env` of a stdio server | `features/mcp-server/options.feature` (new, `Feature: MCP server options`) | `@mcp` | `mcp-server/` module of its own |
| The option reaches `url` and `headers` of a remote server | `features/mcp-server/options.feature` | `@mcp` | -- |
| `mcp-adapter.json` holds a reference and no value (D-PG10-11) | `features/mcp-server/options.feature` | `@adapter-only`, ID in the title | -- |
| Pi's registry holds the value (D-PG10-12) | `features/mcp-server/options.feature` or `builtin-values.feature` | `@builtin-only`, ID in the title | reuse the registry probe |
| A server that names an unset option is not offered, and the install says so | `features/mcp-server/options.feature` | `@mcp`, or a pair if the report differs | -- |
| Skill content has the option filled; a sensitive option shows the placeholder | `features/skill/frontmatter.feature` or a new `features/skill/options.feature` | none | -- |
| Agent content has the option filled | `features/agent/listing.feature` or `frontmatter.feature` | none | -- |
| A user-scope command sends the project path when typed | `features/slash-command/invocation.feature` | none | -- |
| A user-scope command sends the project path through `run_plugin_command` | `features/slash-command/model-runs.feature` | none | -- |
| A user-scope skill shows the project path when the model reads it | `features/skill/model-reads.feature` | none | -- |
| A user-scope agent body keeps the literal | `features/agent/listing.feature` | none | -- |

**Stand-ins.**

- *A hook that prints an environment variable:* the recording hook already does it (above). No new stand-in.
- *The bash tool with a scripted model:* a `bash` row with `{"command": "..."}`. Use a command whose output does not depend on the shell's error text: `command -v hello || echo absent` for presence, and `printf %s "$PI_CLAUDE_MARKETPLACE_PATH"` for "one plugin entry", because `PATH` itself holds system directories.
- *An executable in `bin/`:* missing. `writePublishedPluginFiles` writes mode 0644 (`features/lib/published-marketplace.ts:719-750`). Add a step that writes the file and sets 0755, as `features/lib/hook-files.ts:528` does for hook scripts.
- *"Do not trust" saved:* missing. The existing untrusted profile has no trust entry and a settings file, so Pi's answer is "not decided in a mode that cannot ask". To match the success criterion's words, add a profile value that writes `{"<realpath of cwd>": false}` to the sandbox `trust.json`. Pi's "Do not trust" option saves exactly `decision: false` (`trust-manager.js`, `getProjectTrustOptions`), and a saved `false` wins even with no protected resource (`project-trust.js:22-24`, the 1.5.0 fix). `PiProfile.trust` is `"trusted" | "untrusted"` today (`features/support/world.ts:144`). This scenario is stronger than the existing profile: it proves the gate in a folder that holds only this extension's files.
- *The MCP stub:* enough as it is. The stdio stub names its tool by its fourth argument and prefixes its answer with `STUB_TAG` (`features/lib/mcp-stub-server.ts:6-10`), so `args` and `env` fills are visible in the tool name and the answer under both profiles. `command` can be `${user_config.runtime}` with a default the step sets to the Node path. The HTTP stand-in logs headers, and a `url` given whole as `${user_config.endpoint}` is proven by any request arriving.

`features/support/**`, `features/lib/**`, and the shared step modules are foundation files. Land the two harness additions first, in a plan of their own.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| A plugin `bin` joins `PATH` unconditionally | Only an existing directory, with no shell metacharacter | between Claude Code 2.1.212 and 2.1.322 | PENV-01's parity claim is stale |
| `userConfig` as an unsupported kind (USRCFG-01) | Defaults delivered; values and dialog deferred | this phase | `code-modernization` installs without `--partial` |
| User-scope `${CLAUDE_PROJECT_DIR}` literal (SUB-02) | Filled at invocation and at the model's read | this phase | SUB-02's reason predates the invocation port |
| `/docs/en/plugins-reference` | `/docs/en/plugins/manifest-reference` and siblings | 2026 docs restructure | cite the new pages |

**Deprecated or outdated:**

- The D-LOC-01 premise "Pi 1.4.0 auto-trusts": still true in substance at 1.5.2, with the 1.5.0 exception that a saved "Do not trust" wins.
- `core.md` assumption 02: refuted (F1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The split-token escape of an exported value survives the adapter's three passes and yields the raw value. Derived by reading both regex chains, not run. | D-PG10-11 mechanism | A marker in a default is expanded (credential leak) or the server receives the escape token. Prove with a test against the adapter's own `interpolateEnvVars` before any other MCP work. |
| A2 | Upstream hooks and content read saved values only (F1). Static read of minified code; the binary was not run. | F1, E3 | If a default does reach upstream hooks, PG-CORE-03 is parity and the divergence record is unnecessary. The code is the same either way. |
| A3 | pi-mcp-adapter may run its `session_start` before this extension's. Taken from the comment at `index.ts:88-90`; the load order was not measured. | D-PG10-11 mechanism | If this extension always runs first, a `session_start` set would be enough. Setting in the factory is safe in both cases. |
| A4 | The `Then the hooks record these runs:` step accepts a `CLAUDE_PLUGIN_OPTION_MODE` column with no change. Read in the recorder; the Then step's column mapping was read only at its header. | Cucumber ownership | A small step change in a foundation file. |
| A5 | Adding `userConfig` to the resolver's `supported` list has no reader besides the growth move. One grep. | F10 | A display surface would show a new kind. Audit before choosing that option. |
| A6 | A 16-hex-character hash is unique enough for the owned names. | D-PG10-11 mechanism | A collision gives two options one value. 64 bits over a handful of names is ample; a longer slice costs nothing. |
| A7 | The stdio stub can take `command` from an option whose default is the Node path. Not tried. | Cucumber ownership | Prove `command` by a unit and conformance test and four fields by scenario. |

## Open Questions

1. **Project-scope option variables before the trust answer.**
   - What we know: the values must exist before the adapter's `session_start`, so they are set in the factory. The factory has `process.cwd()` and no trust answer. D-PG10-02 says an untrusted project's `state.json` is not read for `PATH`. pi-mcp-adapter itself blocks every project server in an untrusted project (`project-server-trust.ts:276-290`).
   - What is unclear: whether the factory may read the project's `state.json` to set variables with hash names.
   - Recommendation: in the factory, set both scopes from `process.cwd()` with `persistMigration: false`. At `session_start`, apply again with the trust answer: when the project is untrusted, do not read its state and remove its names. The window has no consumer, the names are not attacker-chosen, and nothing is written. Say so in the D-PG10-11 record. The stricter alternative (user scope only in the factory) leaves a race in which a trusted project's stdio server can start with an empty value.

2. **How a server that names an unset option is dropped and reported.**
   - What we know: upstream drops one server and records a `generic-error` for the plugin. After F4 only a `--partial` install of a plugin with a required option reaches this. Both encodings go through `substituteAndInject`.
   - Option A, at the resolver: a new member of the dropped-server feature union, so `info`, `list`, and the `unsupported mcp` reason show it. Cost: `classifyMcpServer(server)` takes no context today, and the verdict is recomputed from records in several places; each needs the options.
   - Option B, at the bridge: `expandClaudeValue` reports `unsetOptions`; the adapter stage leaves the server out and emits a notice of the MCP config family (the `ca-file-removed` notice of Phase 9 is the worked precedent: type, wire schema, JSON, resolve, text, catalog test); the built-in entry builder returns `undefined`, which already means "not registered".
   - Recommendation: Option B. One choke point, no verdict plumbing, and the shape matches upstream (the plugin stays enabled; one server is missing; the command says why). The planner should confirm that a skipped server is left out of `resources.mcpServers`.

3. **The maintainer question of F1.** It must reach the maintainer, not be settled in a plan. Plan for "keep PG-CORE-03, record the divergence", and keep the two maps separate so the other answer is cheap.

4. **Whether `apply` should restage old partial installs (F10).** Recommendation: keep `reinstall` in the CHANGELOG for this phase, and note the growth-move option in the D-PG10-15 record.

5. **Should an ordinary `${PI_CLAUDE_MARKETPLACE_OPTION_...}` reference written by another plugin be withheld?** In step 1 the values are public manifest text, so nothing leaks. In step 2 a plugin could read another plugin's value this way, and every hook inherits all of them. Recommendation: note it as a step-2 precondition in BACKLOG USRCFG-01. A one-line guard in `segmentFor` now is optional.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | ✓ | v26.13.1 | -- |
| pi-mcp-adapter test peer | adapter profile, conformance tests | ✓ | 7.0.1 in `node_modules/.cache/optional-peers` | `node scripts/install-test-peers.mjs` |
| Pi | both profiles | ✓ | 1.5.0 | -- |
| Pi 1.5.2 tarball | evidence only | ✓ | unpacked in the session scratchpad | `npm pack` again |
| Claude Code binary | evidence only | ✓ | 2.1.323 | -- |

**Missing dependencies:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (unit, integration); @cucumber/cucumber 13.3.0 (behavioral) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`); `package.json` scripts |
| Owner test | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test file>` |
| Pair coverage | `npm run test:coverage:direct -- <source file>` |
| One feature, one profile | `npm run test:cucumber:profile -- --profile adapter <feature file>` (and `--profile builtin`) |
| One scenario | `npx cucumber-js --profile adapter --name '<scenario title>'` |
| Feature rules | `npm run check:features` |
| Integration subset | `node scripts/install-test-peers.mjs && node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/<file>` |
| Full gate | `npm run check` (wave merge, phase gate) |

Every command runs in a hermetic home. No test may read or write the real `~/.pi/agent`.

### Phase Requirements → Test Map

`X/` is `extensions/pi-claude-marketplace/`. "Red" means the case fails on today's code.

| Req / Decision | Behavior | Type | Command | Red before? | File |
|----------------|----------|------|---------|-------------|------|
| PG-CORE-03, D-PG10-05 | schema: required `type`, `title`, `description`; strict; key regex; `options` rules; mismatched default accepted | unit | owner test `test/domain/user-config.test.ts`; coverage `X/domain/user-config.ts` | red (new) | ❌ new pair |
| PG-CORE-03, D-PG10-06, F4 | resolve: default; `""` in the MCP map for a non-required option; required with no default listed | unit | same | red | ❌ |
| D-PG10-07, E2, E5 | value text `String(value)`, array joined by comma; env name; owned variable name | unit | same | red | ❌ |
| D-PG10-05 | malformed `userConfig` gives `unavailable` with a note naming the key or field; entry `userConfig` ignored when `plugin.json` exists | unit | `test/domain/plugin-resolver.test.ts` | red | ✅ file |
| D-PG10-06 | required with no default gives `partially-available` with the new reason; `--partial` admits it | unit | `test/domain/plugin-resolver.test.ts`, `test/shared/probe-classifiers.test.ts`, `test/orchestrators/plugin/install.messaging.test.ts` | red | ✅ |
| D-PG10-04 | `userConfig` is not an unsupported kind | unit | `test/domain/unsupported-components.test.ts` | red (flips `:105`, `:128`) | ✅ |
| D-PG10-06 | reason vocabulary gains one token in every home | architecture | `node --import … --test test/architecture/notify-closed-set-locks.test.ts test/architecture/compat-01-no-expansion.test.ts test/architecture/cross-surface-reason-parity.test.ts` | red until re-pinned | ✅ |
| D-PG10-14 | record field `userConfig`; absent loads; re-validated at read | unit | `test/persistence/state-io.test.ts`; `test/orchestrators/plugin/install-outcome.test.ts` | red | ✅ |
| D-PG10-13, D-PG10-08, D-PG10-09 | content: value, literal when unset, sensitive placeholder | unit | `test/shared/vars.test.ts`; `test/bridges/skills/stage.test.ts`; `test/bridges/commands/staged-command.test.ts`; `test/bridges/agents/convert.test.ts` | red | ✅ |
| D-PG10-10 | hook env holds `CLAUDE_PLUGIN_OPTION_<KEY>` on both lanes | unit | `test/bridges/hooks/hook-env.test.ts` | red | ✅ |
| D-PG10-10, D-PG10-08, E4 | exec-form fill; unset throws upstream's message; shell-form refusal with upstream's message | unit | `test/bridges/hooks/spawn-helpers.test.ts`; `test/bridges/hooks/dispatch-exec.test.ts` | red (flips `:41-57`, `:1797-1822`) | ✅ |
| D-PG10-10 | options reach the routing entry from the record at load and from the resolution at install | unit | `test/bridges/hooks/event-router.test.ts` | red | ✅ |
| D-PG10-11, D-PG10-12 | option pass in `expandClaudeValue`: `ref` for the adapter, text for built-in, `unsetOptions`, no pass when none declared | unit | `test/domain/claude-mcp-variables.test.ts` (flips `:328`); `test/bridges/mcp/substitute.test.ts` | red | ✅ |
| D-PG10-11 | entry holds the reference; no value in the entry; byte-equal across restages; `caFile` and `auth` decisions read the overlay | unit | `test/bridges/mcp/adapter-entry.test.ts`; `test/bridges/mcp/stage.test.ts` | red | ✅ |
| D-PG10-11, A1 | the adapter's own `interpolateEnvVars` turns reference plus escaped value into the raw value, for a value with `{env:X}`, `$env:X`, and `${X}` | integration | `test/integration/adapter-expansion-conformance.test.ts`, `test/integration/mcp-variable-expansion.test.ts` | red | ✅ files, new cases |
| D-PG10-11 | owned-variable ledger: set, replace, remove a gone name, ignore a foreign ledger entry | unit | `test/shared/session-env.test.ts`; the new orchestrator's test | red | ✅ / ❌ new pair |
| D-PG10-11 | the factory and `session_start` set the variables; a failed state read keeps them | unit | `test/index.test.ts` | red | ✅ |
| D-PG10-12 | built-in config holds the value; `~` after resolution is not registered | unit | `test/bridges/mcp/builtin-entry.test.ts`; `test/orchestrators/mcp/builtin-registration-step.test.ts`; `test/integration/mcp-builtin-encoding-conformance.test.ts` | red | ✅ |
| PG-CORE-05, D-PG10-16 | user-scope skill and command get `request.cwd` | unit | `test/orchestrators/skill-invocation.test.ts` (flips `:281`, `:642`); `test/orchestrators/command-invocation.test.ts` (flips `:133`, `:226`) | red | ✅ |
| PG-CORE-06, D-PG10-02 | untrusted: project state not read, project ledger entries removed, user scope kept | unit | `test/orchestrators/plugin-path.test.ts`; `test/index.test.ts` | red | ✅ |
| PG-CORE-07, D-PG10-03, E6 | directory kept; missing, file, metacharacter dropped; link to a directory kept; other stat error kept | unit | `test/orchestrators/plugin-path.test.ts` | red (about ten cases re-fixtured) | ✅ |
| F9 | completion cache `schemaVersion` 8; a version 7 file is rebuilt | unit | `test/shared/completion-cache.test.ts` | red | ✅ |
| PG-CORE-06 | "Do not trust" saved: bash does not find `hello` | e2e | `npm run test:cucumber:profile -- --profile adapter features/plugin/project-trust.feature` | red | ✅ file, new scenario |
| PG-CORE-06, PG-CORE-07 | trusted: bash finds `hello`; two plugins, one entry | e2e | `… features/plugin/executables.feature` | first: **guard, passes today**; second: red | ❌ new |
| PG-CORE-03 | installs without `--partial`; required refused; abbreviated shape unavailable; `info` breakdown | e2e | `… features/plugin/options.feature` | red | ❌ new |
| PG-CORE-03 | hook prints the option; exec fill | e2e | `… features/hook/process.feature` | red | ✅ file |
| D-PG10-08, D-PG10-10 | shell-form refusal; unset option failure | e2e | `… features/hook/failures.feature` | red | ✅ file |
| PG-CORE-03 | five MCP fields, both profiles | e2e `@mcp` | `… --profile adapter features/mcp-server/options.feature` and `--profile builtin` | red | ❌ new |
| D-PG10-11 | `mcp-adapter.json` holds no value | e2e `@adapter-only` | adapter profile, same file | red | ❌ |
| D-PG10-12 | Pi's registry holds the value | e2e `@builtin-only` | builtin profile, same file | red | ❌ |
| PG-CORE-03, D-PG10-09 | skill and agent content filled; sensitive placeholder | e2e | `… features/skill/<file>` and `features/agent/<file>` | red | ✅ / ❌ |
| PG-CORE-05 | user-scope command typed and through the tool; skill read; agent literal | e2e | `… features/slash-command/invocation.feature features/slash-command/model-runs.feature features/skill/model-reads.feature features/agent/listing.feature` | red, red, red, **guard** | ✅ files |
| all | feature layout and tags | static | `npm run check:features` | n/a | ✅ |
| PG-SEC-02, D-PG10-01, D-PG10-18 | records, upstream draft, BACKLOG, docs | doc review | manual: each row of "Records to correct" | n/a | ❌ new records |

### Sampling Rate

- **Per task commit:** the owner test of each touched pair, plus `npm run check:commit` through the hook. The feature file under its profile when a feature or step file changes.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green, which runs both cucumber profiles in full.

### Wave 0 Gaps

- [ ] `test/domain/user-config.test.ts` with `X/domain/user-config.ts`: the new pair.
- [ ] The owned-variable orchestrator and its test: a new pair, if the planner places the state-reading shell in its own module.
- [ ] `features/support/world.ts` and `features/step_definitions/model.steps.ts`: a profile that saves "Do not trust" (`trust.json` value `false`).
- [ ] `features/step_definitions/plugin/publishing.steps.ts` (and `features/lib/published-marketplace.ts` if needed): a step that writes an executable file.
- [ ] A conformance case that runs the adapter's `interpolateEnvVars` on reference plus escaped value (A1). Land it before the MCP plans.

### Red and guard summary

Guards, expected to pass on today's code: "a trusted project's plugin executable is found" (the first `bin` on `PATH` scenario) and "a user-scope agent body keeps the literal". Everything else is red before and green after. Re-expected existing cases: `features/hook/process.feature:8-28`, the two hook unit pins, the four invocation unit pins, the PATH fixtures, `test/domain/claude-mcp-variables.test.ts:328`, `test/domain/unsupported-components.test.ts`, and the completion cache version.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes (what an untrusted project may put on `PATH`; which plugin reads which option) | `ctx.isProjectTrusted()` computed once per load; hash-named variables per scope, plugin, and key |
| V5 Input Validation | yes (`userConfig` from a manifest; the same from a record; a ledger read from the environment) | strict typebox schema; own-property reads; re-validation at the record read; prefix filter on the ledger |
| V6 Cryptography | no (the hash is a name, not a secret) | `node:crypto` sha256 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A repository commits a project `state.json` whose record points at a folder with `bin/`, and the user has saved "Do not trust" | Elevation | PG-CORE-06: the project scope is left out and its state is not read. |
| The same repository, with no saved decision and none of Pi's protected paths | Elevation | **Not mitigated.** The accepted gap of D-LOC-01, confirmed by D-PG10-01. Record it; draft the Pi request. |
| A default holds an adapter marker and is referenced in a `url` or header | Information disclosure | Export the escaped value (A1). Test against the adapter's own function. |
| A default starts with `!` and is referenced in `env` or `headers` | Elevation | Under the adapter the raw entry value starts with `$`, so no command runs. Under built-in, `escapedForPi` prefixes `$`. Add a case for each. |
| A default starts with `~` at the start of `command` or an argument | Tampering | Block the server, as the literal case is blocked. |
| An option key of `__proto__` or `constructor` | Tampering | `Map` or `Object.hasOwn` everywhere; `safeSet` for copies. Upstream's lookup is own-property too. |
| A tampered ledger variable names an unrelated variable | Tampering | On read keep only names with the owned prefix. |
| A hand-edited record `userConfig` | Tampering | Re-validate with the manifest parser; an invalid one reads as no options and is logged. |
| Another plugin reads `${PI_CLAUDE_MARKETPLACE_OPTION_...}`, or a hook reads the inherited variables | Information disclosure | Step 1: none, the values are public manifest text. Step 2: a precondition (Open Question 5). |
| Option variables in the model's bash environment | Information disclosure | Recorded divergence D-PG10-11, as AVAR-01. Step 1 values are public. |
| A shell-form hook splices an option into a shell | Elevation | Refused at run, as upstream. |
| A default with `$ARGUMENTS` or `` !`cmd` `` in skill content | Tampering | Author-controlled text in step 1; residual recorded (Pitfall 12). |
| A path with a shell metacharacter on `PATH` | Tampering | Upstream's filter (E6). |

## Sources

### Primary (HIGH confidence)

- In-repo source read this session: `index.ts`; `orchestrators/plugin-path.ts`, `skill-invocation.ts`, `command-invocation.ts`, `reconcile/convergence.ts`, `reconcile/mcp-migration.ts`, `mcp/builtin-registration-step.ts`, `plugin/install-outcome.ts`, `plugin/install.messaging.ts`, `plugin/plugin-state-classifier.ts`, `plugin/info.ts`, `plugin/list-installed-row.ts`, `plugin/install-flow-ledger.ts`; `shared/session-env.ts`, `vars.ts`, `notify-reasons.ts`, `probe-classifiers.ts`, `notification-types.ts`, `notification-mcp.ts`, `completion-cache.ts`; `domain/unsupported-components.ts`, `plugin-resolver.ts`, `resolver-types.ts`, `claude-mcp-variables.ts`, `claude-credential-denylist.ts`, `argument-substitution.ts`, `plugin-root.ts`, `mcp-resolution.ts`, `components/plugin.ts`; `bridges/mcp/{substitute,adapter-escape,adapter-entry,stage,builtin-escape,builtin-entry,marker}.ts`; `bridges/hooks/{hook-env,spawn-helpers,dispatch-exec,event-router,routing-state}.ts`; `persistence/state-io.ts`.
- Harness read: `features/lib/{pi-process,hook-recorder,mcp-stub-server,mcp-server-http,published-marketplace}.ts`, `features/support/world.ts`, `features/step_definitions/{model,hook/runs,plugin/publishing}.steps.ts`, `features/plugin/project-trust.feature`, `features/mcp-server/{builtin-trust,builtin-values}.feature`, `features/hook/process.feature`, `.agents/skills/cucumber/rules/{layout,features}.md`.
- pi-mcp-adapter 7.0.1 source: `utils.ts`, `server-manager.ts`, `project-server-trust.ts`.
- Pi 1.5.0 (installed) and 1.5.2 (npm tarball): `dist/core/{trust-manager,project-trust,mcp-servers}.js`, `dist/main.js`, `dist/extensions/mcp/{config,index}.js`, `dist/core/extensions/types.d.ts`, `CHANGELOG.md`.
- Claude Code 2.1.323 binary, byte offsets listed in the evidence records.

### Secondary (MEDIUM confidence)

- code.claude.com/docs/en/plugins/manifest-reference.md, components.md, troubleshooting.md (fetched 2026-11-14).
- raw.githubusercontent.com/anthropics/claude-plugins-official: `plugins/code-modernization/.claude-plugin/plugin.json` and `scripts/telemetry.sh` (fetched 2026-11-14; an artifact shows what that plugin does, not what Claude Code guarantees).
- `docs/research/parity-gaps/core.md`, `docs/prd/parity-gaps-prd.md`, the Phase 9 research, context, and summaries.

### Tooling notes

- The research-plan and research-store seam and the knowledge graph were not used. The hard rules allow one written file, and `graphify.enabled` is `false`. Confidence levels above are stated by source, not by the seam.
- The research file is not committed: the orchestrator forbids git commits in this run.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH. No new package; versions read from installed `package.json` files.
- Architecture: HIGH for the choke points and the record precedent, all read. MEDIUM for the adapter escape (A1), which is analysis until a test runs it.
- Upstream `userConfig`: MEDIUM-HIGH. Schema, lookup, throw text, and refusal text are verbatim from the binary. The default-reach conclusion (F1) is a static read supported by the docs' wording.
- Pi trust: HIGH. Byte-identical files.
- Pitfalls: HIGH for the pinned tests (grepped by line). MEDIUM for load order (A3).

**Research date:** 2026-11-14
**Valid until:** 2026-12-14, or the next Claude Code, Pi, or pi-mcp-adapter bump, whichever comes first. Re-check F1 at the next Claude Code version.
