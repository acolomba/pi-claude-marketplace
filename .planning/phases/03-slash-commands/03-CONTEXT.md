# Phase 3: Slash Commands - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning
**Mode:** autonomous (smart discuss in a child session; decisions made from
upstream evidence, no user prompts). The user's standing instruction: "make
decisions as you see fit, but when in doubt research how claude code upstream
operates, and try to maintain compatibility unless we need to deviate for
reasons specific to the implementation of this project." Every choice a user
might have made differently is logged in
`.planning/phases/03-slash-commands/DUBIOUS-CHOICES.md` (`P3-DC-NN`).

**Base:** this branch was fast-forwarded to the milestone head `0e360ca`
(Phase 2 Skills executed and reviewed, including D-CF2-13), so Phase 3 builds
on the real skills code rather than on its expected shape (P3-DC-01).

<domain>
## Phase Boundary

Phase 3 makes a bridged command look to Pi the way Claude Code 2.1.316 defines
it, and proves it with cucumber scenarios under `features/slash-command/` that
observe only what Pi reports (registry probe, RPC, the scripted model's call
log and system prompt, the TUI driver, `/claude:plugin` results):

1. **Listing (CMD-01):** `/<plugin>:<name>` prompt templates, nested
   directories colon-joined, with the description, including the D-CF1-04
   fallback written at install.
2. **Invocation (CMD-02):** the Phase 1 cores (D-CF1-01 arguments, D-CF1-02
   injection) wired into `edge/command-invocation.ts`, the body compared whole
   in the model call log.
3. **Frontmatter and content (CMD-03):** `argument-hint`, `description`, path
   variables, `!` injection, model invocation (FG-11), `user-invocable`
   (FG-12), the D-CF1-05 dropped fields.
4. **Manifest forms (CMD-04):** the object-map `commands` form (FG-13),
   declared file and directory paths, and where a declaration replaces or adds
   to `commands/` (FG-14, corrected for marketplace entries).
5. **Lifecycle (CMD-05):** disable, uninstall, update, enable seen in a new
   session.

**Out of scope:** skills (Phase 2) and the skill-command clash (SKL-04,
D-CF2-03); the frozen Phase 1 cores; a command reached through the model's
Skill tool (RM-02, D-CF3-01); command frontmatter-`name` aliases and a
`SKILL.md` inside `commands/` (deferred, below).

</domain>

<upstream_evidence>
## Upstream evidence (Claude Code 2.1.316)

Full record with commands, fixtures, outputs, and byte offsets:
`03-UPSTREAM-EVIDENCE.md` (probed 2026-11-01, local marketplace, throwaway
HOME and config dir, a local HTTP stub with a dummy key in place of the API;
no credential, no LLM). **Isolation note:** the first probe trees reached
`api.anthropic.com/api/claude_code/policy_limits` despite `env -i` (the binary
uses its built-in API address). The core probes (base, object map, mixed
array) were re-run in a loopback-only network namespace (`unshare -rn`) with
identical results; a few edge variants rest on the networked runs only
(P3-DC-02).

- **E1 (FG-11).** A plugin command with a `description` (or `when_to_use`)
  is in the model's skill list: `- probe-plugin:deploy: Deploy things`, under
  "The following skills are available for use with the Skill tool:". The model
  can run it through the Skill tool. `disable-model-invocation: true` removes
  it from the list and the Skill tool refuses it.
- **E2 (FG-12).** `user-invocable: false` on a command: absent from init
  `slash_commands`; present in the model's list; typed `/probe-plugin:hidden
  hello` sends nothing to the model and answers "This skill can only be
  invoked by Claude, not directly by users. ...". The model can still run it.
- **E3 (FG-13, object map in `plugin.json`).** Accepted by validate and
  install. Keys become `<plugin>:<key>`, verbatim (case kept; `ns:sub`,
  `dir/name`, `dot.name`, non-ASCII all register; matching is case-sensitive).
  A key ending in `:` or holding `<`/`>` is refused with a log warning; a key
  with a space is listed but cannot be typed. `source` (a file, relative to the
  plugin root) loads that file under the key's name; `content` is an inline
  body whose own frontmatter is parsed. The manifest's `description`,
  `argumentHint`, `model`, and `allowedTools` override the file's frontmatter;
  a field it leaves out keeps the file's value. A `source` naming a directory
  ignores the key and loads the directory's files under their own names. A
  missing `source` file: validate fails, install succeeds, that entry is
  absent, `plugin list` says "failed to load", siblings load. Two keys on one
  file: the first loads. A non-`.md` source is silently not loaded. Both or
  neither of `source`/`content`: invalid manifest, install fails. An array
  holding an object fails validation. The map replaces `commands/`, with the
  `Default commands/ folder is ignored because the manifest sets "commands"`
  note.
- **E4 (marketplace-entry `commands`).** The entry's declarations ADD to
  `commands/` whether or not `plugin.json` exists: the folder is read only
  unless `plugin.json` declares `commands` (`let Et=!Se.commands&&Me`), and no
  entry path clears it. An entry map's `source` entries load; its `content`
  entries are dropped silently (`registerInlineContent:!1`). This contradicts
  D-CF1-06's "(marketplace entry or plugin manifest)" for commands, and the
  docs' "No `plugin.json`: the entry is the manifest".
- **E5 (path forms).** In `plugin.json`, `"commands": "./cmds/a.md"` and
  `["./cmds/a.md", "./more"]` load the single file as `probe-plugin:a` and walk
  the directory recursively, names relative to it (`probe-plugin:sub:x`).
- **E6 (message shape).** `/probe-plugin:deploy one two` sends a tag block
  (`<command-message>`, `<command-name>`, `<command-args>`) and then the
  substituted body `Deploy one two now\n`. With no arguments the args tag is
  left out and `$ARGUMENTS` is empty (`T2e` gets `""`).
- **E7 (`argument-hint`).** Not in the stream or the model request; only in
  the SDK `initialize` command list (and the TUI menu).
- **E8 (a body that starts with `/`).** Sent literally; the second command is
  not expanded.
- **E9 (not asked, deferred).** A command's frontmatter `name` gives
  `/<plugin>:<name>` and bare `/<name>` aliases, as for skills. A `SKILL.md`
  inside `commands/` becomes a skill named after its folder.
- **Earlier evidence pinned, not re-probed:** `T2e`, `HRe`/`MRr`, `A2e`,
  `user-invocable` for skills (01-CONTEXT E1-E6), and D-CF2-13's
  `installed_plugins.json` / `not_installed_here` provenance (02-REVIEW-FIX).

Pi facts (installed `@earendil-works/pi-coding-agent` 1.4.0, read
2026-11-01): `expandPromptTemplate` matches `^/(\S+)(?:\s+([\s\S]*))?$`, finds
the template by file basename, and returns `substituteArgs(body, args)` (1-based,
missing index becomes `""`, `${N:-d}`, `$@`, `${@:N}`); the frontmatter is not
sent. The input handlers run first, then `_expandSkillCommand` and
`expandPromptTemplate` run on the (possibly transformed) text, so a returned
text that starts with `/<template>` is expanded again. A template's
description is frontmatter `description` or the first non-empty body line cut
at 60 characters; `argument-hint` reaches only the interactive autocomplete
(`pi-tui` `autocomplete.js`), not `get_commands`. Untrusted projects' staged
prompts are already left out of resource discovery (Phase 2, `6a7ea1b`).

</upstream_evidence>

<decisions>
## Implementation Decisions

### Model and user invocation (FG-11, FG-12)

- **D-CF3-01 (model invocation; FG-11; settled autonomously):** A bridged
  command stays a Pi prompt template that only the user invokes. Pi gives the
  model no way to see or run a prompt template, and staging each command again
  as a Pi skill would add a `/skill:<plugin>-<name>` entry to the slash menu
  that Claude Code does not have (and that Pi cannot hide, D-CF1-09's gap).
  Licensed by the Pi gap; recorded with the commands-for-the-model gap in the
  Pi gap report (a parent line appended to D-CF2-10's draft). A negative
  scenario pins that the model's system prompt does not list the command.
  `disable-model-invocation` on a command therefore changes nothing in Pi and
  is not reported as a dropped field. RM-02 stays the real-model proof.
- **D-CF3-02 (`user-invocable: false`; FG-12; extends D-CF1-09):** A command
  with `user-invocable: false` stays listed and runnable from `/`, as D-CF1-09
  keeps it for skills. Upstream hides and refuses it but lets the model run it
  (E2); in Pi the model cannot run any command (D-CF3-01), so hiding it would
  leave the command unreachable. The scenario pins listed and runnable.

### Manifest forms and directories (FG-13, FG-14)

- **D-CF3-03 (object-map `commands` in `plugin.json`; FG-13):** Support it as
  E3 does.
  - Each entry is a command named `<plugin>:<key>`. The key goes through the
    command naming of `domain/name.ts` (`generatedCommandName`) as a source
    name, so CM-2 elision (D-141-01/02) applies as for files, and a `/` in a
    key becomes a `:` segment (residual, Pi gap: a template's name is its file
    name). Case is kept. A key that ends in `:`, holds `<`, `>`, or
    whitespace, or fails RN-2 is skipped with an install warning.
  - `source`: a `.md` file relative to the plugin root (contained, no
    symlink, as the walk requires) staged under the key's name; a directory
    `source` is read as a declared directory and its key ignored; a missing
    or non-`.md` source skips that entry with an install warning and keeps the
    plugin installable (upstream: "failed to load" in `plugin list`). Two keys
    on one file: the first wins, the second is skipped with a warning.
  - `content`: the inline text is the command file; its own frontmatter is
    parsed as a file's would be.
  - Overrides: the manifest's `description` and `argumentHint` are written
    into the staged frontmatter as `description` and `argument-hint`, over the
    file's. A manifest `model` counts as a set `model` field for the D-CF1-05
    dropped-fields warning. `allowedTools` is ignored without a warning, as
    `allowed-tools` is (D-CF1-05).
  - Both or neither of `source`/`content` in an entry: the manifest is invalid
    and the plugin is not installable, as upstream install fails. An array
    that holds an object keeps today's refusal.
  - A map counts as a `commands` declaration: it replaces `commands/` with
    D-CF1-06's shadowed-folder warning. Detection follows upstream's `IKn`
    (an object whose first value is an object with `source` or `content`).
  - The resolver change stays in the commands arm of
    `domain/component-paths.ts` and its lenient mirror in
    `orchestrators/plugin/info.ts`; the map's entries reach the commands bridge
    through the resolved plugin (shape at the planner's discretion).
- **D-CF3-04 (marketplace-entry `commands`; corrects D-CF1-06 for
  commands; settled autonomously):** As E4: `commands/` is read unless
  `plugin.json` declares `commands`; a marketplace entry's `commands` adds to
  it and never triggers the shadowed-folder warning. An entry map's `source`
  entries load; its `content` entries are dropped with an install warning
  (upstream drops them silently; the warning follows the D-CF2-03 diagnostic
  precedent). Supersedes the "marketplace entry" half of D-CF1-06 for
  commands only. Agents and workflows keep D-CF1-06 until their phases probe
  them (parent line to Phases 4 and 7).
- **D-CF3-05 (declared file paths; bug policy):** A declared `commands` path
  that names a `.md` file (string, array element, or directory map value
  aside) is one command named from the file's basename (E5); today's walk
  finds nothing in it. A declared non-`.md` file is skipped with a warning.
  A declared directory keeps today's recursive walk. FG-14's replace rule for
  `plugin.json` (D-CF1-06) is pinned by a scenario in this phase's
  `manifest-forms.feature`.

### Invocation (pins FG-01..FG-05, D-CF1-01..03)

- **D-CF3-06 (command invocation wiring; pins D-CF1-01, D-CF1-02,
  D-CF1-03):** `edge/command-invocation.ts` handles `interactive` and `rpc`
  input (as D-CF2-05 does for skills); `extension` input and any text that
  does not start with `/` pass through (after a skill invocation the text
  starts with `<skill name=`). For `/<name> <rest>` where Pi lists a `prompt`
  command `<name>` whose file is one this extension staged in either scope's
  `pi-claude-marketplace/resources/prompts/`, it:
  - reads the staged file once and parses its frontmatter as Pi does;
  - substitutes with `substituteArguments` (body as Pi's loader gives it,
    `args` = `rest.trim()`, `""` when nothing was typed, never `undefined`;
    `parseArgumentNames(frontmatter.arguments)`; variables
    `CLAUDE_SESSION_ID`, `CLAUDE_EFFORT` from the thinking level,
    `CLAUDE_PROJECT_DIR` at project scope, and `CLAUDE_PLUGIN_ROOT` /
    `CLAUDE_PLUGIN_DATA` from a record the bridge stores in the staged
    frontmatter, so a typed argument naming one expands as upstream);
  - runs `expandContextInjections` with the shell from `selectPromptShell`
    (frontmatter `shell`); `bash-missing`, an injection failure, an oversized
    invocation, and an unreadable staged file abort with the cores' or a
    plain message through the notify chokepoint, and nothing reaches the model;
  - returns the substituted body as the transformed text (Pi's template
    expansion sends the body without frontmatter; Claude Code's
    `<command-message>` tag block is not added, residual under D-CF1-01, as
    D-CF2-06 kept Pi's own skill framing).
  A typed command that is not one of this extension's staged templates keeps
  Pi's own expansion. A returned body that starts with `/<template>` would be
  expanded again by Pi (E8 says upstream sends it literally): the planner
  prevents it if a safe mechanism exists, otherwise it is a residual recorded
  under D-CF1-01 with a unit test pinning the behavior.
- **D-CF3-07 (project-command provenance; follows D-CF2-13):** A
  project-scope bridged command runs through the handler only when Pi trusts
  the project and the user-scope ledger
  `<agentDir>/pi-claude-marketplace/project-installs.json` lists its
  generated name for the canonical project path with the SHA-256 of the staged
  file as it is now; otherwise it aborts with a message in D-CF2-13's shape
  ("The command <typed> was not installed into the project <cwd> on this
  machine, or its file changed after the install. Install its plugin into
  this project with --scope project, then run /reload to use it.") and runs
  nothing. Commit records the committed command files at project scope;
  unstage forgets them. Same file and schema as the skills ledger (a command
  name holds `:` and never equals a skill name). Constraints: the commands
  bridge must not import `bridges/skills/` (fallow zones), Phase 3 does not
  edit Phase 2's files, and no near-copy of `bridges/skills/project-installs.ts`
  may land (fallow dupes fails the combined tree). The planner picks the
  mechanism (for example, reading through Phase 2's exported reader from the
  orchestrator layer and passing a writer to the commands bridge through its
  callers, or a name-neutral writer in an allowed layer); any edit a cleaner
  shared module would need in Phase 2's files is a parent line.
- **D-CF3-08 (description; pins FG-06, D-CF1-04):** When a command's
  frontmatter has no non-empty `description` (and no D-CF3-03 override), the
  bridge writes `descriptionFallback(body, "Plugin command")` into the staged
  frontmatter, so Pi's 60-character rule never applies. A degraded command
  (CMD-01 neutralized frontmatter) gets the fallback too.
- **D-CF3-09 (dropped fields; pins D-CF1-05):** The commands bridge adds
  `droppedInvocationFieldsWarning(<source>, frontmatter)` to its discovery
  warnings, one line per command, not for a command whose frontmatter does
  not parse (it already gets the CMD-01 warning). A D-CF3-03 manifest `model`
  counts.
- **D-CF3-10 (`argument-hint`, path variables):** `argument-hint` passes
  through to Pi (and D-CF3-03 writes `argumentHint`); the scenario observes it
  in the TUI autocomplete, the only place Pi shows it (E7 says upstream shows
  it only in its menu too). `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`,
  and `${CLAUDE_PROJECT_DIR}` keep their install-time substitution (CM-3,
  SUB-02); `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}` are filled at
  invocation.

### Lifecycle and pins

- **D-CF3-11 (lifecycle; CMD-05):** Disable, uninstall, update, and enable
  are observed in a new session through the registry probe, and update shows
  the new description and body through the model call log. They take effect
  at `/reload` (NFR-2, APL-D2). Existing behavior is pinned with negative-edit
  proofs where no product change is needed (as 02-05 did).
- **D-CF3-12 (listing pins):** CM-2 elision (`acme-lint` gives `acme:lint`,
  D-141-01/02) and dotfile skipping (CM-4) stay recorded divergences and are
  pinned; nested `build/web.md` gives `/<plugin>:build:web` (C1, MATCH).

### Ownership (settled autonomously)

- **D-CF3-13:** Beyond the ROADMAP row, Phase 3 owns the new
  `orchestrators/command-invocation.ts` (and its test) beside
  `edge/command-invocation.ts`, and edits only the commands arms of
  `domain/component-paths.ts` and `orchestrators/plugin/info.ts`
  (ROADMAP: "the resolver change stays inside the commands arm"), plus
  minimal call-site edits in orchestrators if D-CF3-07's writer travels
  through them. It uses `features/lib/pi-tui.ts` without editing it unless a
  backward-compatible option is unavoidable. Expected-value edits to tests
  outside Phase 3 are limited by a `git diff` criterion and listed.

### Claude's Discretion

- Module split, the record key name in the staged command frontmatter, the
  abort origin (prefer an existing notification kind and origin; no
  closed-set edit unless unavoidable, then as its own commit), warning
  wording in the style of the existing staging warnings, and the plan split
  inside the ROADMAP's wave template.
- Removing the stale `fallow-ignore-next-line code-duplication` markers in
  `bridges/commands/stage.ts` and `discover.ts` once `npx fallow dupes`
  confirms on this tree (02-07 Parent lines).

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`: Phase 3, the milestone rules, file ownership, and
  merge procedure.
- `.planning/REQUIREMENTS.md`: CMD-01..CMD-05.
- `.planning/phases/03-slash-commands/03-UPSTREAM-EVIDENCE.md`.
- `.planning/research/FEATURES.md`: FG-11..FG-14, the commands table C1-C17.
- `.planning/phases/01-harness-and-version-raise/01-CONTEXT.md` (D-CF1-01..17)
  and the SUMMARYs of 01-10, 01-11, 01-12, 01-13.
- `.planning/phases/02-skills/02-CONTEXT.md` (D-CF2-01..12),
  `02-REVIEW-FIX.md` (D-CF2-13), `02-07-SUMMARY.md` ("Phase 3 (commands)",
  the Pi gap report, the reviewed clone pairs).
- `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts`,
  `edge/skill-aliases.ts`, `bridges/skills/project-installs.ts` (patterns;
  Phase 2 owned).
- `.planning/DUBIOUS-CHOICES.md` DC-03..DC-10, DC-13, DC-24..DC-27.
- `.agents/skills/cucumber/SKILL.md`,
  `.agents/skills/claude-code-compat-research/SKILL.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `bridges/commands/{discover,stage,unstage,types}.ts`: recursive walk,
  first-wins dedup, CMD-01 neutralize, CM-3 substitution, staging and commit.
- `edge/command-invocation.ts`: the Phase 1 pass-through seed, registered in
  `index.ts` after the skill aliases (do not edit `index.ts`).
- `orchestrators/skill-invocation.ts`: the skill-side composition (staged-file
  lookup through `pi.getCommands()`, trust and ledger checks, cores, abort
  outcomes) to mirror without cloning.
- The frozen cores: `domain/{argument-substitution,shell-words,context-injection,description-fallback,invocation-frontmatter}.ts`,
  `platform/prompt-shell.ts`.
- `features/lib/slash-command-files.ts`, `features/step_definitions/slash-command/listing.steps.ts`,
  the shared `session`/`model` steps (registry probe listing, `the user
  prompts`, `the model receives these calls`, `the model call N receives this
  system prompt`), `features/lib/pi-tui.ts` for the autocomplete.

### Established Patterns

- Discovery warnings flow through the bridge's `warnings` into the install
  notification; CMD-01 degraded records into `{malformed command}`.
- Reviewed clone pairs `bridges/{skills,commands}/{stage,discover,unstage}.ts`
  with markers in both copies; stale markers on the commands side (02-07).
- Aborted skill invocations report as `usage-error`; RPC clients receive a
  `claude-plugin` entry.

### Integration Points

- Pi `input` event (`interactive`, `rpc`), `pi.getCommands()` (`source:
  "prompt"`, `sourceInfo.path`), resource discovery's prompt paths.

</code_context>

<specifics>
## Specific Ideas

- Scenario literals come from the probe: `deploy.md` body `Deploy $ARGUMENTS
  now` with `one two` reaches the model as `Deploy one two now`; an object map
  `alpha` (source) and `beta` (content) list as `/demo:alpha` and `/demo:beta`
  with the manifest descriptions; a marketplace-entry declaration keeps
  `commands/` read.
- Red proofs before each product rule: argument substitution (`$0`, append),
  `!` injection, the A2e fallback, dropped-field warning, object map, file
  paths, the entry-adds rule, project provenance.

</specifics>

<deferred>
## Deferred Ideas

- Command frontmatter `name` aliases (`/<plugin>:<name>`, bare `/<name>`;
  E9). Upstream has them; deferred to a backlog line (parent line), P3-DC.
- A `SKILL.md` inside `commands/` loaded as a skill (E9).
- Claude Code's `<command-message>` tag block in front of the body.
- Commands for the model (needs a Pi feature; in the Pi gap report).
- Agents and workflows marketplace-entry declarations (re-probe in Phases 4
  and 7).

</deferred>
