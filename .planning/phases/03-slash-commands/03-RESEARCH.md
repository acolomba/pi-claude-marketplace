# Phase 3: Slash Commands - Research

**Researched:** 2026-11-01
**Domain:** Pi 1.4.0 prompt templates, the commands bridge, the plugin resolver's commands arm, the D-CF2-13 provenance ledger, cucumber scenarios under `features/slash-command/`
**Confidence:** HIGH for code facts (read this session, cited with file:line); MEDIUM for TUI rendering and the upstream collision order (not observed)

## Summary

Phase 3 needs no new library. Everything sits on code this branch already has: the Phase 1 cores (`substituteArguments`, `expandContextInjections`, `selectPromptShell`, `descriptionFallback`, `droppedInvocationFieldsWarning`), Phase 2's skill invocation pattern, and Phase 2's user-scope ledger `project-installs.json`. The work is wiring, plus three design problems the planner must settle before writing tasks: (1) how the commands bridge writes to a ledger it may not import, (2) how the commands bridge rewrites staged frontmatter without copying Phase 2's frontmatter scanner, and (3) how object-map entries travel from the resolver to the bridge. The research gives a concrete answer to each, checked against the fallow rules on this tree.

Three measured facts drive the design. First, fallow 3.35.0's default `mild` duplicate mode normalizes literals but NOT identifiers. A copy of a Phase 2 function with renamed identifiers is not reported, while a copy that differs only in strings is (scratch probe below). Second, Pi's YAML parser throws on a duplicate key (`Map keys must be unique`), so a writer cannot just append a `description:` line when the author wrote `description: ""`. Third, a frontmatter block rebuilt as one JSON-quoted `"key": <JSON>` line per key round-trips exactly through Pi's `parseFrontmatter`, including nested values, aliases, and Windows backslashes. This gives a stage-time writer that needs no line scanner (verified in scratch).

For E8 (a body that starts with `/<template>`), there is no byte-identical safe mechanism in Pi 1.4.0. Returning `handled` and re-sending the body through `pi.sendUserMessage` turns the RPC `prompt` response into `handled`, detaches the turn from the prompt, and sends model and auth errors to `extension_error`. The frozen `the user prompts` step does not wait for a turn after `handled`. The research recommends recording E8 as a residual under D-CF1-01, with a unit test that pins the transformed text.

**Primary recommendation:** Plan four waves. Wave 1: the listing tracer plus a new staged-command writer (description fallback and record, JSON-flow frontmatter) and the shared command-file `Given`. Wave 2: frontmatter, and invocation together with the provenance writer. Wave 3: manifest forms, and lifecycle. Wave 4: the gate. Pass the D-CF2-13 ledger to the commands bridge as a required parameter from the four orchestrator call sites.

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; branch `features/*`; merge, never rebase; commit per `.agents/skills/committing/SKILL.md`; never `--no-verify`.
- Read a file before editing; trace callers before modifying a function.
- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap.
- TypeScript strict; exported functions declare return types; named exports only; kebab-case files; typed `Error` subclasses with `this.name`.
- All disk mutations atomic (NFR-1): ledger writes go through `shared/atomic-json.ts` (Phase 2's ledger already does).
- Containment (NFR-10): writes only under `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `mcp-adapter.json`, `mcp.json`. The ledger is `<agentDir>/pi-claude-marketplace/project-installs.json` (inside).
- Output only through `shared/notification-dispatch.ts` (IL-2; fallow rule `notify-chokepoint`); no `console`, no `process.stdout`.
- NFR-5: `orchestrators/` and `domain/` modules outside `NETWORK_SEAMS` must not name the git surface (ESLint BLOCK F). `orchestrators/command-invocation.ts` must stay off it.
- `npm run check` green: typecheck, ESLint (`--max-warnings 0`, `sonarjs/cognitive-complexity` 15), fallow (dead code, two cycle runs, health `maxCognitive` 15 / `maxCyclomatic` 20, dupes, boundaries, rule pack), Prettier, pairing, unit, integration, cucumber, 100% direct coverage per source-test pair.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it (red proof).
- Every plan SUMMARY carries `## Threat Flags`.
- WINDOWS descriptions are prefixed `[component-features]`.
- Milestone rules (ROADMAP): component phases never edit `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions, `BACKLOG.md`. Closed sets are append-only, and an addition lands in its own commit. Each phase edits only its own arm in `domain/name.ts` and `shared/concerns/soft-dep.ts`. An orchestrator fix stays minimal and inside its own function.
- Root container: run npm scripts with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/573eac57-8096-527f-94a8-f7aea09fcdeb/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Without it, about 167 tests fail as root. Cold-cache ESLint can run out of memory under parallel load.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Model and user invocation (FG-11, FG-12)

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

#### Manifest forms and directories (FG-13, FG-14)

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

#### Invocation (pins FG-01..FG-05, D-CF1-01..03)

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

#### Lifecycle and pins

- **D-CF3-11 (lifecycle; CMD-05):** Disable, uninstall, update, and enable
  are observed in a new session through the registry probe, and update shows
  the new description and body through the model call log. They take effect
  at `/reload` (NFR-2, APL-D2). Existing behavior is pinned with negative-edit
  proofs where no product change is needed (as 02-05 did).
- **D-CF3-12 (listing pins):** CM-2 elision (`acme-lint` gives `acme:lint`,
  D-141-01/02) and dotfile skipping (CM-4) stay recorded divergences and are
  pinned; nested `build/web.md` gives `/<plugin>:build:web` (C1, MATCH).

#### Ownership (settled autonomously)

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

### Deferred Ideas (OUT OF SCOPE)

- Command frontmatter `name` aliases (`/<plugin>:<name>`, bare `/<name>`;
  E9). Upstream has them; deferred to a backlog line (parent line), P3-DC.
- A `SKILL.md` inside `commands/` loaded as a skill (E9).
- Claude Code's `<command-message>` tag block in front of the body.
- Commands for the model (needs a Pi feature; in the Pi gap report).
- Agents and workflows marketplace-entry declarations (re-probe in Phases 4
  and 7).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMD-01 | A new session lists each bridged command as a prompt template `/<plugin>:<name>` (nested directories colon-joined) with its description | Listing already works (seed). D-CF3-08 needs the new stage-time frontmatter writer (§Pattern 2). D-CF3-12 pins existing elision and dotfile behavior (negative-edit proofs). Observed through the frozen `pi offers these slash commands from prompt templates:` step. |
| CMD-02 | Invoking a command sends the model its body with `$ARGUMENTS`, positional arguments, and the appended-arguments rule handled as decided under FG-01..FG-03 | Handler design in §Pattern 1, the Pi flow at `agent-session.js:1631-1693`, the cores' API (`argument-substitution.ts:77-88, 224-245`). E8 residual in §Pitfall 1. |
| CMD-03 | `argument-hint`, `description`, path variables, injection (FG-05), model invocation (FG-11), `user-invocable` (FG-12) | `argument-hint` reaches only the TUI menu (`interactive-mode.js:515-519`, `autocomplete.js:236-238`). Model-invocation negative control reuses Phase 2's `<available_skills>` step. Injection runs in the handler (invocation plan). |
| CMD-04 | Object-map `commands` (FG-13) and custom command directories (FG-14) | Resolver shape in §Pattern 3. D-CF3-04 rule change at `component-paths.ts:148-154`. D-CF3-05 file paths in the bridge walk (`discover.ts:185-200`). Tests that change are listed in §Non-owned test impact. |
| CMD-05 | Disable, uninstall, update remove or replace the command in a new session; enable restores it | Existing behavior. `cascadeUnstagePlugin` (`marketplace/shared.ts:553-581`) and `runInstallLedger` cover every verb. The ledger must follow (forget on unstage, re-record on update commit). Negative-edit proofs, as 02-05 did. |
</phase_requirements>

## Architectural Responsibility Map

This is a Pi extension, not a web app, so the tiers are the extension's layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect object map, validate entries, apply D-CF3-04 folder rule | `domain/component-paths.ts` (commands arm) | `domain/resolver-types.ts` (type only) | Resolution of declared paths is pure domain logic. The resolved plugin carries the result to every bridge. |
| Lenient component map for the `unavailable` info arm | `orchestrators/plugin/info.ts` (`deriveLenientComponentPaths`) | -- | Info re-derives paths when the arm carries none (NFR-7). |
| Map keys, file paths, inline content, per-entry warnings | `bridges/commands/discover.ts` | `domain/name.ts` (`generatedCommandName`, unchanged) | Discovery warnings are the established channel for an installable plugin. |
| Staged bytes: description fallback, overrides, record, dropped-fields line | New `bridges/commands/staged-command.ts` | `bridges/commands/stage.ts` (calls it) | One writer for the staged frontmatter, testable in isolation. |
| Ledger record and forget | New `bridges/commands/project-ledger.ts` (writer interface + helpers) | `orchestrators/plugin/{install-outcome,update-swap}.ts`, `orchestrators/marketplace/shared.ts` pass `NODE_PROJECT_SKILL_LEDGER` | The bridge cannot import `bridges/skills/**` (fallow zone `bridges-commands` allows `domain, persistence, shared, platform` only). Orchestrators may import it. |
| Typed-command interception | `edge/command-invocation.ts` | `shared/notification-dispatch.ts` (abort report) | Edge parses Pi input and maps the outcome to an `InputEventResult`. |
| Find staged template, provenance check, substitution, injection | New `orchestrators/command-invocation.ts` | `bridges/skills/project-installs.ts` (`provenProjectSkills` reader), `bridges/commands` (record reader, digest) | Edge may not import bridges. Orchestrators compose bridges and domain cores. |

## Standard Stack

No package is added. The phase uses what the repository already ships.

### Core (in-repo, frozen Phase 1 cores)

| Module | Export | Purpose |
|--------|--------|---------|
| `domain/argument-substitution.ts` | `substituteArguments`, `parseArgumentNames`, `claudeEffort`, `InvocationTooLargeError` | T2e port (D-CF1-01) |
| `domain/context-injection.ts` | `expandContextInjections`, `ContextInjectionError` | `!` injection (D-CF1-02) |
| `platform/prompt-shell.ts` | `selectPromptShell`, `bashMissingMessage`, `createPromptShellRunner`, `NODE_PROMPT_SHELL_HOST`, `NODE_PROMPT_SHELL_SPAWN` | Shell selection and spawn |
| `domain/description-fallback.ts` | `descriptionFallback(body, "Plugin command")` | A2e port (D-CF1-04) |
| `domain/invocation-frontmatter.ts` | `droppedInvocationFieldsWarning(sourceName, frontmatter)` | D-CF1-05 |
| `platform/pi-api.ts` | `parseFrontmatter`, `getAgentDir`, types `ExtensionAPI`, `InputEvent`, `InputEventResult` | Pi boundary (frozen) |

[VERIFIED: `domain/description-fallback.ts:2` quotes `export type DescriptionFallbackLabel = "Plugin skill" | "Plugin command";`]
[VERIFIED: `domain/argument-substitution.ts:78-88` quotes `readonly args: string | undefined;` with the comment "`undefined` when the user typed no arguments", and `readonly append?: boolean;`]

### Supporting (Phase 2, read-only for Phase 3)

| Module | Export | Use in Phase 3 |
|--------|--------|----------------|
| `bridges/skills/project-installs.ts` | `provenProjectSkills(agentDir, projectPath, read)`, `NODE_PROJECT_SKILL_LEDGER`, `skillFileDigest` | Reader (from the orchestrator) and writer instance (passed by the orchestrators) |

[VERIFIED: `bridges/skills/project-installs.ts:30-36` quotes `version: Type.Literal(1), projects: Type.Record(Type.String(), Type.Record(Type.String(), Type.Object({ plugin: Type.String(), sha256: Type.String() })))`]
[VERIFIED: `bridges/skills/project-installs.ts:65-67` quotes `return path.join(agentDir, "pi-claude-marketplace", "project-installs.json");`]
[VERIFIED: `bridges/skills/project-installs.ts:70-72` quotes `return createHash("sha256").update(content, "utf8").digest("hex");`]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON-flow frontmatter rebuild | Line insertion before the closing fence | Fewer byte changes, but `description: ""` or `description: null` already present gives a duplicate key, which Pi's parser rejects (`Map keys must be unique`). Handling that needs Phase 2's key-spelling scanner (`frontmatter-scan.ts`), which the commands bridge may not import and must not copy. |
| Ledger passed as a parameter | A second ledger writer in `persistence/` or `bridges/commands/` | A second writer of the same file is the near-copy D-CF3-07 forbids. |
| Map entries on `componentPaths` | A new top-level resolved field (`commandEntries`) beside `shadowedFolders` | A top-level field needs an edit to `domain/plugin-resolver.ts:156-176` (`materializableFields`) and a new covered branch in its pair test. `componentPaths` already passes through whole (`plugin-resolver.ts:164`). |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed by this phase. **Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```text
 INSTALL / UPDATE / ENABLE / REINSTALL / APPLY / IMPORT
 marketplace.json entry + plugin.json
        |
        v
 domain/component-paths.ts (commands arm)
   - string / array paths      -> componentPaths.commands (dirs AND .md files)
   - object map (IKn rule)     -> componentPaths.commandMap? [entries + origin]
   - folder rule: read unless plugin.json declares commands (D-CF3-04)
   - malformed map value       -> note + dirty -> unavailable
        |
        v  resolved plugin (MaterializablePlugin)
 bridges/commands/discover.ts
   - walk dirs (unchanged), file path -> 1 command (D-CF3-05)
   - map entries -> source file | inline content | dir walk
   - key / source / dup / entry-content checks -> discovery warnings
        |
        v  DiscoveredCommand[]  (file | inline, + overrides)
 bridges/commands/staged-command.ts  (NEW)
   read -> PARSE-01 gate (neutralize on throw) -> CM-3 vars -> SKTK refs
   -> rebuild frontmatter: {...parsed, overrides, description fallback,
      "pi-claude-marketplace": {pluginRoot, pluginData}} as JSON-flow YAML
   -> dropped-fields line (D-CF3-09) -> PARSE-02 backstop
        |
        v
 bridges/commands/stage.ts commit --(project scope)--> ledger.update(...)
        ^ ledger passed in by install-outcome / update-swap
 unstage.ts --(project scope)--> ledger.update({forget})
        ^ ledger passed in by install-outcome undo / cascadeUnstagePlugin
        |
        v  <scope>/pi-claude-marketplace/resources/prompts/<plugin>:<name>.md
 Pi resources_discover -> prompt templates (user, then trusted project)

 INVOCATION (user types "/demo:greet Ada")
 Pi prompt(): extension command? -> input handlers in order
   skill-aliases (passes: a non-skill command of that name exists)
   command-invocation (edge)
     source extension | no leading "/" | token not a staged prompt -> continue (sync)
     else orchestrators/command-invocation.ts:
       trust (project) -> read staged file once -> ledger digest (project)
       -> substituteArguments -> selectPromptShell -> expandContextInjections
       ok    -> {action:"transform", text: body}   (Pi re-expands only if body starts with "/<known>")
       abort -> notifyUsageError + {action:"handled"}  (nothing reaches the model)
 Pi: _expandSkillCommand, expandPromptTemplate (no-op on a body) -> _startRun -> model
```

### Recommended Project Structure (new and changed files)

```text
extensions/pi-claude-marketplace/
├── bridges/commands/
│   ├── types.ts              # DiscoveredCommand union (file | inline), overrides
│   ├── discover.ts           # file paths, map entries, warnings      (wave 3)
│   ├── staged-command.ts     # NEW: staged bytes writer + record reader + digest (wave 1, then 2, 3)
│   ├── project-ledger.ts     # NEW: ProjectCommandLedger type, record/forget helpers (wave 2)
│   ├── stage.ts              # prepare calls staged-command; commit takes ledger (wave 1, 2)
│   ├── unstage.ts            # forget at project scope (wave 2)
│   └── index.ts              # barrel exports
├── edge/command-invocation.ts            # handler (wave 2)
├── orchestrators/command-invocation.ts   # NEW (wave 2)
├── domain/component-paths.ts             # commands arm (wave 3)
├── domain/resolver-types.ts              # ComponentPathsSchema gains optional commandMap (wave 3)
└── orchestrators/plugin/info.ts          # lenient commands arm (wave 3)
features/
├── slash-command/{listing,frontmatter,invocation,manifest-forms,lifecycle}.feature
├── step_definitions/slash-command/{listing,frontmatter,invocation,manifest-forms,lifecycle}.steps.ts
└── lib/slash-command-files.ts            # add a whole-file writer (wave 1)
```

### Pattern 1: Command invocation (D-CF3-06), mirroring skills without cloning

**Pi 1.4.0 flow** [VERIFIED: `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js`, read this session; the CLI runs the bundled copy `dist/bundle/chunks/chunk-MM3LKT73.js`, whose `prompt` body is the same, checked by grep]:

1. `prompt(text, options)` at line 1631. `expandPromptTemplates` defaults to true (line 1636). An extension command runs first, on the raw text (line 1641).
2. `_runInputHandlers(text, images, source, streamingBehavior)` at line 1652 (defined 1590-1601). `handled` returns with `preflightResult("handled")`. `transform` replaces text and images.
3. Then `expandedText = this._expandSkillCommand(expandedText); expandedText = expandPromptTemplate(expandedText, [...this.promptTemplates]);` at lines 1661-1662, on the transformed text.
4. `_startRun({ messageType: "user", prompt: expandedText, images })` at line 1693. No trim of the prompt text (`_prepareRun` line 1504 uses `trigger.prompt` as is).
5. RPC `steer` and `follow_up` go through `_queueUserInput` (lines 1752-1767), which also runs the input handlers, then expands. A `transform` works on both paths.
6. `runner.emitInput` (`dist/core/extensions/runner.js:1201-1236`) passes each handler the text the previous one returned. A handler that throws becomes an `extension_error` and the chain continues. The `the user prompts` step fails a turn with any `extension_error`, so the handler must catch everything.

**Finding the staged template.** `pi.getCommands()` maps templates as `{ name: template.name, description: template.description, source: "prompt", sourceInfo: template.sourceInfo }` [VERIFIED: `agent-session.js:2750-2755`]. `sourceInfo.path` is the resource file path (`resource-loader.js:667-669` and `722-726` return `{ ...sourceInfo, path: resourcePath }`). Pi de-duplicates templates by name, first wins (`resource-loader.js:895-907`), and our `resources_discover` lists the user scope first, then the trusted project (`orchestrators/discover.ts:29-50`). So the handler resolves the command the way Phase 2 resolves a skill (`orchestrators/skill-invocation.ts:108-135`): find `source === "prompt" && name === token`. It is project scope when `path.resolve(sourceInfo.path) === path.resolve(cwd, ".pi", "pi-claude-marketplace", "resources", "prompts", token + ".md")`. It is user scope when the path equals the same under `getAgentDir()`. Anything else is `not-bridged`, so a user's own Pi template keeps Pi's expansion.

**Synchronous pre-filter (required by a non-owned test).** `test/index.test.ts:2357-2372` calls the registered listener with `"/demo:greet Ada"` and asserts `deepStrictEqual(outcome, { action: "continue" })`. A returned Promise fails that assertion. The handler must answer synchronously when the token is not a staged prompt, and return a Promise only for a match. The test's strict `pi` mock also has no `getCommands` expectation at `probes = 0` (`test/index.test.ts:328-338`). That test therefore needs a one-line `when(() => pi.getCommands()).thenReturn([])` expectation, which is a listed non-owned edit.

**Request shape** (mirror `SkillInvocationRequest`, `skill-invocation.ts:47-61`): `commands`, `name` (token), `typed` (`/${token}`), `args` = `event.text.slice(token.length + 1).trim()` (`""` when nothing typed), `cwd`, `projectTrusted`, `sessionId`, `thinkingLevel`.

**Variables:** `CLAUDE_SESSION_ID`, `CLAUDE_EFFORT` (`claudeEffort(pi.getThinkingLevel())`), `CLAUDE_PROJECT_DIR` = cwd at project scope only, `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` from the staged record. There is no `CLAUDE_SKILL_DIR`, because commands stay literal for it, as `bridges/commands/stage.ts:237-240` already says.

**Abort report.** Mirror `edge/skill-aliases.ts:118-127` [VERIFIED, quoted]: `openNotificationRun(pi, { kind: "command", commandId: "skill", invocationId: createInvocationId() }); notifyUsageError(ctx, run, { message, usage: "" });`. `commandId` is an open `Type.String({ minLength: 1 })` [VERIFIED: `shared/notification-wire.ts:356`] and `readonly commandId: string` [VERIFIED: `shared/notification-run.ts:33-34`], so no closed-set edit is needed. Recommendation: `commandId` = the typed command name without the slash (for example `demo:greet`). The skill side uses the constant `skill`, which is the Pi command family, and the docs define `commandId` as "Names the operation, such as `plugin list`" (`docs/json-output.md:203`). This adds a `docs/json-output.md` parent line.

**Abort messages:**

- Untrusted project (a trust change within a session; resource discovery already drops an untrusted project's prompts): mirror the skill text, "The command <typed> belongs to the project <cwd>, which Pi does not trust. Trust the project folder, then run /reload to use it."
- Ledger miss or digest mismatch: D-CF3-07's literal text.
- Unreadable staged file: "Cannot read the command <typed>: <error>. Run /reload to load the installed commands again."
- Core errors: `ContextInjectionError.message`, `InvocationTooLargeError.message`, `bashMissingMessage(typed)`.

**Dupes discipline.** fallow `mild` does not normalize identifiers (measured below). Large parts of `skill-invocation.ts` and `skill-aliases.ts` (the `DEFAULT_DEPENDENCIES` block, `fillSkill`, `inputResult`'s switch) would be reported if copied with the same identifiers. Write the command side with its own names and structure: for example, outcome kinds such as `"not-staged" | "send" | "refuse"`, a dependencies object named differently, and a shell step factored differently. Then run `npx fallow dupes` on the tree before each commit that adds these files.

### Pattern 2: Staged command writer (D-CF3-08, D-CF3-06 record, D-CF3-09, D-CF3-03 overrides)

The writer rebuilds the frontmatter as JSON-flow YAML, one `"<key>": <JSON>` line per key. It keeps the bytes after the original closing fence exactly as Pi would read them.

```typescript
// bridges/commands/staged-command.ts (sketch; names are the planner's)
// Pi's extractFrontmatter: closing fence = first "\n---" after index 3;
// body = normalized.slice(endIndex + 4).trim()   (dist/utils/frontmatter.js)
function rebuildFrontmatter(
  normalized: string,
  frontmatter: Readonly<Record<string, unknown>>,
): string {
  const lines = Object.entries(frontmatter).map(
    ([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`,
  );
  const close = normalized.startsWith("---") ? normalized.indexOf("\n---", 3) : -1;
  const rest = close === -1 ? normalized : normalized.slice(close + 4);
  return `---\n${lines.join("\n")}\n---${close === -1 ? "\n" : ""}${rest}`;
}
```

Verified properties (scratch run of Pi's own `parseFrontmatter`, `research-p3/roundtrip.mjs`):

- The parsed result is deep-equal to the object written, for nested maps and lists, numbers, booleans, `null`, an alias (expanded to its value), a block scalar holding `--- not a fence`, a key with a space, and a value with a Windows path `C:\x\${y}`. The body is unchanged.
- A JSON-quoted line can never start with `---`, so the rebuilt block cannot end early.
- `description: a` twice throws `Map keys must be unique at line 2, column 1`. This is why the line-insertion alternative fails.

Order inside `prepareStageCommands` (`bridges/commands/stage.ts:197-262` today): read, then `stripBom`, then the PARSE-01 gate (neutralize on throw, record degraded), then `substituteClaudeVars`, then `rewriteMarkdownReferences`. Then parse the result, compute the effective frontmatter (`{...parsed, ...overrides, description fallback when missing or empty, "pi-claude-marketplace": {pluginRoot, pluginData}}`), rebuild, write, and keep the PARSE-02 backstop. Do the rebuild last, so substitution and reference rewriting never touch the record.

- **Description rule:** use the fallback when `typeof description !== "string" || description === ""`, matching Phase 2's skills rule [VERIFIED: `bridges/skills/stage.ts:134-140` quotes `const sourceDescription = typeof rawDescription === "string" ? rawDescription : "";` and `sourceDescription === "" ? descriptionFallback(body, "Plugin skill") : sourceDescription`]. Pass the body Pi would load (the parse result's `body`).
- **Record key:** reuse the skills key name `pi-claude-marketplace` [VERIFIED: `bridges/skills/skill-names.ts:36` quotes `const RECORD_KEY = "pi-claude-marketplace";`] with the value `{ "pluginRoot": ..., "pluginData": ... }`. Export a `readCommandRecord(frontmatter)` (typebox-checked) from the commands bridge for the orchestrator. Put it in this module, because edge cannot import bridges.
- **Digest:** export a `commandFileDigest(content)` that hashes the same way as `skillFileDigest` (sha256, utf8, hex), so the commit-time and the invocation-time digests come from one function on the commands side.
- **Dropped fields (D-CF3-09, wave 2):** `droppedInvocationFieldsWarning(sourceName, {...parsedSourceFrontmatter, ...(override.model ? { model } : {})})` on the PARSE-01 parse (before substitution), skipped for a degraded command. Return it as a warning line, and have `stage.ts` collect the writer's warnings into `discoverWarnings.map(discoveryWarning)` from wave 1 on, so wave 2 changes only the writer file.
- **Overrides and inline content (wave 3):** the writer reads `kind: "file"` from disk and uses `kind: "inline"` content directly, so `stage.ts` has no branch that only manifest forms can reach (100% direct coverage of `stage.ts`).

### Pattern 3: Object map on the resolved plugin (D-CF3-03, D-CF3-04, D-CF3-05)

- **Shape (recommended):** add an optional `commandMap` to `componentPaths` (`ComponentPathResolution.componentPaths` in `component-paths.ts:43`, and `ComponentPathsSchema` in `resolver-types.ts:6-11`, a `Type.TOptional<Type.TArray<Type.TObject<...>>>`). Each entry has `key`, `source?` (contained relative path) or `content?`, `description?`, `argumentHint?`, `model?`, and `origin: "manifest" | "entry"`. Add the field only when a map exists, so every existing `deepStrictEqual` of a resolution stays equal, and `plugin-resolver.ts:164` (`componentPaths: partial.componentPaths`) carries it with no edit. Keep `componentPaths.commands: string[]` unchanged: Phase 2's skills shadow check reads it as directories [VERIFIED: `bridges/skills/skill-names.ts:157-165`; `bridges/skills/discover.ts:243-247`; `bridges/skills/stage.ts:437-441`].
- **Detection (IKn):** a non-null, non-array object whose first value (`Object.values(v)[0]`) is a non-null object with an own `source` or `content`. Anything else follows today's path. An object that is not a map gives the note `component path for "commands" is not a string (got object)`, the plugin is dirty, and it is unavailable (`component-paths.ts:82-87`). An array holding an object keeps the same refusal.
- **Per-entry structural checks in the resolver (manifest invalid, so dirty and a note):** both or neither of `source`/`content`; a non-string `source`, `content`, `description`, `argumentHint`, or `model`; `allowedTools` that is not an array of strings. These mirror upstream's zod schema `vps` (03-UPSTREAM-EVIDENCE byte 274106966). A `source` that is absolute or escapes the root goes through `resolveContainedComponentPath` (`component-paths.ts:12-37`). That function refuses symlinks too, because `assertPathInside` walks every segment with `lstat` (`shared/path-containment.ts:86-162`). Escape and symlink give the existing "escapes plugin root" note and dirty, the same policy as a declared string path.
- **Per-entry checks in the bridge (warning, entry skipped, plugin stays installable):** key ends in `:` or holds `<`, `>`, or whitespace; `generatedCommandName` throws (RN-2); `source` missing, not `.md`, or a dotfile; a second key on an already-used file; and `content` with `origin: "entry"`. A `source` that is a directory is walked as a declared directory with file-based names, and its key and overrides are ignored (E3.7).
- **D-CF3-04 folder rule (commands only):** read `commands/` when `!manifestRaw`, whatever the entry says. Give the shadow warning only when `manifestRaw` is truthy, the folder exists, and no declared path reaches it. Today's shared rule is [VERIFIED: `component-paths.ts:148-154` quotes `return kind === "skills" || (!entryRaw && !manifestRaw);`]. Keep agents and workflows unchanged (D-CF3-04). Do it as a commands branch that delegates to a separate function, to stay under the two complexity gates.
- **Order (first-wins input):** upstream lists the folder's command before the entry-declared ones. The probe tree `v-arrmkt` init `slash_commands` reads `['probe-plugin:other', 'probe-plugin:a', 'probe-plugin:b', 'probe-plugin:sub:x']`, where `other` is from `commands/` [VERIFIED: read from `probe-p3/tree/v-arrmkt/out/hello.jsonl` this session]. Upstream processes `plugin.json` first and then appends the entry (`mode:"append"`, evidence bytes 287733647 and 287777722). Recommended commands order: folder (when read), then plugin.json paths, then entry paths. Which file wins a name collision between the folder and a declared path was not probed [ASSUMED].
- **D-CF3-05 in the bridge:** `walkCommandsDir(dir, base, ...)` calls `readWalkEntries`, which for `dir === base` uses `readDirEntriesTolerant` and returns `[]` on `ENOTDIR` [VERIFIED: `shared/fs-utils.ts:178-189`]. That is why a declared `.md` file finds nothing today. Before the walk, `lstat` the declared path. A regular `.md` file gives one command, `sourceName = basename without .md`. A non-`.md` file gives a warning. A symlink is skipped with a warning, the same symlink policy the walk applies. A directory keeps the walk. ENOENT stays silent, as today.
- **Lenient mirror (`info.ts:1946-1971`):** change `if (kind === "skills" || !declared)` (line 1960) so that commands always push `"commands"` (the lenient arm reads only the marketplace entry, and an entry now adds). Leave map entries out of the lenient list. Upstream `plugin details` lists neither mapped nor single-file commands: `v-map` shows `Skills (0)`, `v-strfile` shows `Skills (0)`, and `v-arr` lists only `b` from the directory [VERIFIED: read from `probe-p3/tree/v-*/out/details.stdout` this session]. Our `discoverComponentNames` already reads only top-level `.md` files of directories and treats a file path as empty (ENOTDIR, `info.ts:349-362`), which matches.

### Pattern 4: Ledger writer without importing skills (D-CF3-07)

Call sites, the complete list [VERIFIED by grep and read this session]:

| Function | Call site | Reached by |
|----------|-----------|------------|
| `commitPreparedCommands` | `orchestrators/plugin/install-outcome.ts:1283` | install, enable (`runInstallLedger`), import, apply, cascades |
| `commitPreparedCommands` | `orchestrators/plugin/update-swap.ts:1243` | update, reinstall (`materialize-latest` / `reinstall-record`), apply convergence, autoupdate |
| `unstagePluginCommands` | `orchestrators/plugin/install-outcome.ts:1293` (commands phase `undo`) | rollback of any ledger run |
| `unstagePluginCommands` | `orchestrators/marketplace/shared.ts:577` (`cascadeUnstagePlugin`) | uninstall, disable, prune, marketplace remove |

Phase 2 avoided call-site edits with a default parameter: `commitPreparedSkills(ops, prepared, ledger: ProjectSkillLedger = NODE_PROJECT_SKILL_LEDGER)` [VERIFIED: `bridges/skills/stage.ts:559-563`], and a factory-bound `unstagePluginSkills = createUnstagePluginSkills(NODE_SKILLS_UNSTAGE_REMOVER, NODE_PROJECT_SKILL_LEDGER)` [VERIFIED: `bridges/skills/index.ts:30-33`]. The commands bridge cannot do either, because any default would import `bridges/skills/project-installs.ts`, which the boundary rule forbids [VERIFIED: `.fallowrc.json` quotes `{ "from": "bridges-commands", "allow": ["domain", "persistence", "shared", "platform"] }`].

Recommended mechanism (fewest edits, no second writer):

1. `bridges/commands/project-ledger.ts` declares a structural `ProjectCommandLedger { readonly update: (change: { readonly projectPath: string; readonly forget: readonly string[]; readonly remember: ReadonlyMap<string, { readonly plugin: string; readonly sha256: string }> }) => Promise<void> }`. `NODE_PROJECT_SKILL_LEDGER` is assignable to it (contravariant parameter: the commands change type is assignable to `ProjectSkillLedgerChange`).
2. `commitPreparedCommands(ops, prepared, ledger: ProjectCommandLedger)` is a REQUIRED third parameter. After the renames, and at project scope only, it reads each committed target file, digests it, and calls `ledger.update({ projectPath: path.dirname(locations.scopeRoot), forget: _previousNames, remember })`. A throw propagates, so the caller's undo removes the commands, as in skills. The staged variant needs a bridge-internal `_pluginName` (skills added the same, 02-REVIEW-FIX).
3. `unstagePluginCommands(input)` takes `ledger` in `UnstageCommandsInput`. At project scope with names, it forgets them. A failed write becomes a warning (`warnings` already exists on the result, `types.ts:152-155`).
4. The four call sites import `NODE_PROJECT_SKILL_LEDGER` from `../../bridges/skills/project-installs.ts` (`orchestrators/skill-invocation.ts:24` already deep-imports that module) and pass it. That is one import and one argument per site. The barrel identity test `test/bridges/commands/index.test.ts` keeps passing.
5. The reader: `orchestrators/command-invocation.ts` calls `provenProjectSkills(agentDir, cwd, read)` [VERIFIED: `project-installs.ts:117-129`] and compares the entry for the command's generated name with `commandFileDigest(content)`.

Write the record and forget helpers with commands-side identifiers and a shape that differs from `recordProjectSkills` (`skills/stage.ts:523-543`) and `forgetProjectSkills` (`skills/unstage.ts:43-61`). The identical runs would otherwise reach 50 tokens. Check with `npx fallow dupes` (Pattern 1's measurement).

### Anti-Patterns to Avoid

- **Returning a Promise for every `/` input:** breaks `test/index.test.ts:2357-2372` and costs a microtask on every typed slash command.
- **Calling `pi.sendUserMessage` from the input handler for every command:** this changes the RPC `prompt` disposition to `handled` (`modes/rpc/rpc-mode.js:298-318`), so RPC clients and the frozen `the user prompts` step no longer wait for the turn.
- **Line-inserting `description:`:** a duplicate key breaks Pi's parse of the staged file.
- **Importing `bridges/skills/**` from `bridges/commands/**`:** fallow boundary violation.
- **Editing Phase 2 files** (`bridges/skills/**`, `orchestrators/skill-*.ts`, `edge/skill-aliases.ts`): any cleaner shared module goes to the parent as a line.
- **A new `features/lib/*` module:** the libs are frozen except the six fixture writers (layout.md "Frozen after Phase 1"). Put step helpers in the Phase 3 step modules.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Argument substitution, `$N`, `ARGUMENTS:` append | Pi's `substituteArgs` or a new parser | `substituteArguments` + `parseArgumentNames` | Frozen T2e port; Pi's is 1-based and drops the append (FG-01/02) |
| `!` injection | Spawning a shell yourself | `expandContextInjections` + `selectPromptShell` + `createPromptShellRunner` | Child-process chokepoint, escaping, failure messages |
| Description fallback | Pi's 60-character rule | `descriptionFallback(body, "Plugin command")` | D-CF1-04 |
| Ledger read/write | A new ledger file or writer | `provenProjectSkills` + `NODE_PROJECT_SKILL_LEDGER` | One file, one writer (D-CF3-07) |
| YAML emit | A YAML library or a line scanner | JSON-flow lines (`JSON.stringify` key and value) | No new dependency; round-trip verified with Pi's parser |
| Path containment | `path.relative` checks | `resolveContainedComponentPath` / `assertPathInside` | Refuses symlinks segment by segment |
| Command naming | Joining strings | `generatedCommandName(plugin, source)` (unchanged) | CM-2 elision, RN-2, platform separator |

**Key insight:** every hard part of this phase already exists as a frozen core or a Phase 2 export. The risk is not missing logic. The risk is copying logic across a fallow zone, and the duplicate gate catches that only on the combined tree.

## Runtime State Inventory

This phase is not a rename. It does change what an existing install must hold for its commands to run, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `<agentDir>/pi-claude-marketplace/project-installs.json` lists only skills today. Project-scope commands installed before this phase have no entries, so after the upgrade the handler aborts them with the D-CF3-07 message. Staged command files from before this phase have no record and no fallback description: typed arguments naming `${CLAUDE_PLUGIN_ROOT}` stay literal, and Pi's 60-character rule applies until restage. | No data migration (D-CF3-07 is locked). Recovery is `/claude:plugin update` or `reinstall <plugin> --scope project`, then `/reload`. CHANGELOG parent line, as DC-25 item 1 did for skills. |
| Live service config | None. Verified: commands have no companion or external service. | None |
| OS-registered state | None. Verified: no scheduler or service registration in the commands path. | None |
| Secrets/env vars | None. The ledger holds names and digests only. | None |
| Build artifacts | None. No build step; Node strips types at runtime. | None |

## Common Pitfalls

### Pitfall 1: E8, a body that starts with another template's name

**What goes wrong:** the handler returns `transform` with `/demo:other run`. Pi then runs `_expandSkillCommand` and `expandPromptTemplate` on it (`agent-session.js:1661-1662`) and sends `other`'s raw body instead of the literal text that upstream sends (E8). The second template gets Pi's own 1-based substitution, no `!` injection, and no provenance check. It sends text only, so no command runs.
**Why it happens:** Pi expands after the input handlers, and the only opt-out (`expandPromptTemplates: false`) exists on `prompt` and `sendUserMessage` options, not on the `transform` result.
**Options evaluated:**

- (a) Residual. Pi expands only when the first token names a loaded template or `skill:<loaded skill>`, which is rare.
- (b) `handled` plus `pi.sendUserMessage(body, { deliverAs: event.streamingBehavior })`, whose `expandPromptTemplates` default is `false` (`agent-session.js:1910-1937`). This is byte-identical, but `sendUserMessage` is fire-and-forget on `ExtensionAPI` (`types.d.ts:1267-1270` returns `void`). The RPC `prompt` response becomes `handled` (`rpc-mode.js:306-310`), and a missing model or auth becomes an `extension_error` instead of a prompt error. The frozen `the user prompts` step skips waiting on `handled`, so no scenario could observe it reliably.
- (c) Prefix one character (for example a space). This is safe mechanically, but the model sees bytes that upstream does not send.

**Recommendation:** (a). Detect nothing. Pin with a unit test that the handler's `transform` text starts with `/demo:other`, and optionally a scenario that pins Pi's re-expansion under D-CF1-01 (the planner chooses). Record it in the D-CF1-01 residuals and DUBIOUS-CHOICES.
**Warning signs:** a scenario for a chained body passes with `OTHER BODY`.

### Pitfall 2: fallow dupes on the combined tree

**What goes wrong:** a command-side copy of a Phase 2 function passes on a branch where the skills file differs, and fails after a merge.
**Why it happens:** `mild` mode abstracts literals but not identifiers (measured, §Code Examples). Reviewed clone markers hide a whole clone span.
**How to avoid:** use different identifiers and structure. Run `npx fallow dupes` (exit 0 required) before each commit that adds code mirroring skills, and again at every wave merge.
**Warning signs:** `fallow dupes` reports a group spanning `bridges/commands/*` and `bridges/skills/*`, or `orchestrators/command-invocation.ts` and `orchestrators/skill-invocation.ts`, or `edge/command-invocation.ts` and `edge/skill-aliases.ts`.

### Pitfall 3: stale clone markers

**What goes wrong:** markers that cover no group stay forever, because fallow never reports a stale `code-duplication` marker.
**Measured on this tree** (scratch copy of both bridges with every marker deleted, `fallow dupes`): one group remains, `dup:23c99c81`, 28 lines, `commands/stage.ts:160-186` with `skills/stage.ts:413-440`. Stale: `commands/stage.ts:276`, `commands/discover.ts:314`, `commands/unstage.ts:29` (the unstage group ended with Phase 2's ledger change), and on the Phase 2 side `skills/stage.ts:499` and `skills/unstage.ts:87` [VERIFIED: scratch measurement, `research-p3/markers`; files outside the two bridges were not in the copy].
**How to avoid:** wave 1 deletes the three stale commands markers and re-measures. When wave 1 rewrites `prepareStageCommands`, re-measure `stage.ts:160`. If the group ends, delete it too, and send a parent line for `skills/stage.ts:413` (Phase 2 owned). Update the counts in CONVENTIONS.md through a parent line.

### Pitfall 4: the frozen harness and cross-phase steps

**What goes wrong:** a plan edits `session.steps.ts`, `world.ts`, `pi-tui.ts`, or a `features/lib` file, or copies Phase 2's TUI boilerplate (about 80 identical tokens in the `PiTuiSession.start` option block).
**How to avoid:** for argument-hint, use `this.startTuiSession()` from the world (`features/support/world.ts:653-668`). It starts a TUI on the run's shared sandbox with no model and the default ready text, the same as `marketplace/background-update.steps.ts:37-53`. That needs no profile and no copy of Phase 2's code. For the model-invocation negative control, reuse Phase 2's `the model call {int} lists these skills in its system prompt:` (`features/step_definitions/skill/frontmatter.steps.ts:64-80`). For a provenance miss, reuse `the user's pi directory records no plugin install for the project` (`skill/project-provenance.steps.ts:20-31`), whose text is kind-neutral.

### Pitfall 5: Pi trims a frontmatter file's body

**What goes wrong:** a command file with no frontmatter currently reaches the model with its trailing newline. Pi returns `body: normalized` untrimmed when there is no fence, and `.trim()` when there is one (`dist/utils/frontmatter.js` `extractFrontmatter`). After the writer adds a frontmatter block, the body is trimmed. Upstream sends `Deploy one two now\n` (E6).
**How to avoid:** accept it as a residual (Phase 2's skills send `parsed.body.trim()`, `skill-invocation.ts:180`). Write scenario literals from Pi's trimmed body.

### Pitfall 6: the shared-sandbox TUI and description tags

**What goes wrong:** the menu row is not `name` plus the description. Pi builds `"<hint> — <desc>"` [VERIFIED: `pi-tui/dist/autocomplete.js:236-238`], and the description first gets a source tag `[u]`, `[p]`, or `[t]` from `getAutocompleteSourceTag` (`interactive-mode.js:425-451`, applied to templates at 513-519). The PTY is 120 columns by 40 rows (`features/lib/pi-tui-pty.py:24-26`).
**How to avoid:** the frontmatter plan spikes the rendered menu first: type `/demo:dep`, wait for the `→ ` marker, and dump `tui.text`. Then write a whole-line expectation. Which tag an extension-discovered prompt gets in the shared sandbox is [ASSUMED].

### Pitfall 7: the ledger after a failed update

**What goes wrong:** `update-swap` phase 3 continues across bridge failures and never restores old files (`update-swap.ts` header, lines 22-29). A commands commit that recorded the new digests stands even if a later bridge fails. The recovery hint is reinstall, the same as skills.
**How to avoid:** no extra work. Do not add rollback-restore logic. Document it in the unit test titles.

### Pitfall 8: Windows separator and map keys

**What goes wrong:** `generatedCommandName` uses `.` on Windows (`platform/os.ts:18-20`). A key holding `:` (`ns:sub`) produces a filename with `:`, which NTFS refuses, so staging fails.
**How to avoid:** CI is Linux only (STACK.md). Note it as a residual. Optionally skip a key with `:` on win32 with a warning.

## Code Examples

### Measured: fallow `mild` mode and identifiers

```text
# research-p3/dupe-probe (scratch), fallow 3.35.0, defaults (mild, 50 tokens, 5 lines)
exact copy of a 19-line function           -> 1 clone group (dup:3d4ac95b)
same function, identifiers renamed          -> "No code duplication found"
same function, only string literals changed -> clone group, 38 lines (90.5%)
```

### Edge handler shape (sketch)

```typescript
// edge/command-invocation.ts -- sketch only; identifiers deliberately differ from skill-aliases.ts
export function registerCommandInvocation(
  pi: ExtensionAPI,
  runCommand: (request: CommandInvocationRequest) => Promise<CommandInvocationOutcome> = invokeBridgedCommand,
  newInvocationId: () => string = randomUUID,
): void {
  pi.on("input", (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };
    const token = /^\/(\S+)(?=\s|$)/.exec(event.text)?.[1];
    if (token === undefined) return { action: "continue" };
    const commands = pi.getCommands();
    if (!commands.some((c) => c.source === "prompt" && c.name === token)) return { action: "continue" };
    return runCommand({ /* ... */ }).then(/* map send / refuse / not-staged */);
  });
}
```

### Upstream literals for scenarios (03-UPSTREAM-EVIDENCE)

- `deploy.md` body `Deploy $ARGUMENTS now`, typed `/demo:deploy one two`, model text `Deploy one two now` (Pi trims, Pitfall 5).
- `/demo:deploy` with no arguments gives `Deploy  now` (two spaces; args `""`).
- An object map with `alpha` (source) and `beta` (content) lists `/demo:alpha` and `/demo:beta` with the manifest descriptions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pi expands a bridged command (`substituteArgs`, 1-based) | The extension's handler substitutes (T2e, 0-based, `ARGUMENTS:` append) | This phase | `$1` and `$ARGUMENTS[0]` change meaning for existing commands |
| D-CF1-06: an entry declaration replaces `commands/` | D-CF3-04: an entry declaration adds; only plugin.json replaces | This phase | Entry-declared plugins gain their `commands/` files |
| Object-map `commands` makes the plugin unavailable | Supported (D-CF3-03) | This phase | |
| Pi's description rule (first line, 60 characters) | A2e fallback written at install | This phase | Listing text changes for commands without a description |

## Non-owned test impact (D-CF3-13 `git diff` criterion)

Expected-value or setup edits the planner should anticipate outside Phase 3's files. Confirm each by running `npm run test:modules` after each wave.

| File | Why | Wave |
|------|-----|------|
| `test/index.test.ts` (~2357-2372) | The handler now calls `pi.getCommands()` on `/` input. Add a strict `getCommands` expectation returning `[]` for that case | 2 |
| `test/domain/component-paths.test.ts` (case table at 326-401) | The commands row of "an entry-declared ${kind} path replaces the existing ${kind}/ folder" now expects `["commands", "custom"]` (order per Pattern 3) and no `shadowedFolders`. Add map and D-CF3-04 cases (pair coverage of the commands arm) | 3 |
| `test/domain/resolver-types.test.ts` | Compiler proof for the optional `commandMap` field | 3 |
| `test/orchestrators/plugin/info.test.ts` | New lenient case: an entry declaration keeps `commands/` (direct coverage of the line-1960 change) | 3 |
| `test/orchestrators/plugin/install-flow-ledger.test.ts`, `reinstall-flow.test.ts`, `update-flow.test.ts`, `test/orchestrators/marketplace/shared.test.ts`, `install-outcome.test.ts`, `update-swap.test.ts` | Possible user-tree diffs (`project-installs.json` now also appears for a commands-only project install), and any strict mocks of the commands bridge signatures | 2 |
| `test/orchestrators/plugin/reinstall-flow.test.ts:490-492, 5602-5618` | Reads the staged `hello:deploy.md` with `includes` and `match`. These should still pass after the JSON-flow rebuild (body unchanged); re-run | 1 |
| Phase 2 features `features/skill/collisions.feature`, `features/skill/aliases.feature:135-165` | Type `/demo:clash` with no arguments at project scope. They pass only if the commit writes the ledger in the same wave as the handler | 2 |

No feature or test outside `test/bridges/commands/**` pins staged command bytes exactly [VERIFIED: grep of `test/` and `features/` for `promptsTargetDir` / `resources/prompts` reads; `features/step_definitions/plugin/installation.steps.ts:296-318` lists only names].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Upstream lets the `commands/` folder's file win a name collision with an entry-declared path (inferred from listing order only) | Pattern 3 | First-wins winner differs from upstream for colliding names; a scenario would pin the wrong side |
| A2 | The source tag Pi's TUI shows for an extension-discovered prompt in the shared sandbox (`[t]`, `[u]`, `[p]`, or none) | Pitfall 6 | The argument-hint scenario's expected line is wrong until spiked |
| A3 | A map in a marketplace entry that sets both or neither of `source`/`content` should also make the plugin unavailable (upstream probed only in plugin.json) | Pattern 3 | An entry map would refuse install where upstream might skip the entry |
| A4 | Reusing Phase 2's step texts (`lists these skills in its system prompt`, `records no plugin install for the project`) in Phase 3 features is acceptable under the milestone ownership rules | Pitfall 4 | The planner must add duplicate steps, with dupes risk |
| A5 | A symlinked or escaping map `source` should make the plugin unavailable (the declared-path policy) rather than skip the entry | Pattern 3 | D-CF3-03 says "contained, no symlink" but not the consequence |

## Open Questions

1. **Abort origin `commandId`.** Known: the field is an open string. Unclear: whether JSON clients prefer a constant. Recommendation: the typed command name without the slash (`demo:greet`), plus a `docs/json-output.md` parent line.
2. **Hidden and bidi characters in map keys.** Upstream's `sbs` also refuses hidden, direction-changing, and blank-like characters (03-UPSTREAM-EVIDENCE Q3.11), and D-CF3-03 does not list them. Recommendation: also skip keys holding a Unicode format character (`\p{Cf}`), with the same warning. This is cheap, closer to upstream, and blocks display spoofing. Planner's call; log it as P3-DC.
3. **Map entries in `supported`.** A map-only plugin has an empty `componentPaths.commands`, so `supported` would lack `"commands"` (`component-paths.ts:193-195`). Recommendation: push `"commands"` when a map exists.
4. **Four waves versus the ROADMAP's three.** See §Validation Architecture. Recommendation: four waves (Phase 2 also used four, with a recorded reason).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v24.22.1 | -- |
| npm | scripts | ✓ | 10.9.9 | -- |
| python3 | `features/lib/pi-tui-pty.py` (TUI scenarios) | ✓ | 3.13.18 | -- |
| bash | `!` injection scenarios (`selectPromptShell`) | ✓ | `/usr/bin/bash` | -- |
| `nondac-sh` wrapper | npm scripts as root | ✓ | `/tmp/claude-0/-home-user-pi-claude-marketplace/573eac57-8096-527f-94a8-f7aea09fcdeb/scratchpad/nondac-sh` (`setpriv` drops DAC override) | -- |
| fallow | gates | ✓ | 3.35.0 (signed) | -- |
| fallow.tools docs | reference | ✗ (host not in this session's allowed network) | -- | `npx fallow explain`, local probes |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `strong-mock` (unit); `@cucumber/cucumber` (behavior) |
| Config file | `cucumber.json` (frozen); `package.json` scripts |
| Quick run command | `node --test test/bridges/commands/<file>.test.ts`; `npx cucumber-js features/slash-command` |
| Full suite command | `npm run check` (with the root wrapper prefix) |

### Phase Requirements to Test Map

| Req / Decision | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-01 / D-CF3-08 | Fallback description: first line, heading, 101-char cut, empty body `Plugin command`, degraded command | unit + cucumber (red: Pi's 60-char text) | `node --test test/bridges/commands/staged-command.test.ts`; `npx cucumber-js features/slash-command/listing.feature` | ❌ Wave 1 |
| CMD-01 / D-CF3-12 | Nested `build/web` gives `/demo:build:web`; `demo-lint` gives `/demo:lint`; `.hidden.md` not listed | cucumber (negative-edit proof) | listing.feature | ✅ seed only |
| D-CF3-06 record | Record written, read back, PARSE-02 safe | unit | staged-command.test.ts, stage.test.ts | ❌ Wave 1 |
| CMD-02 | `$ARGUMENTS`, `$0`, `ARGUMENTS:` append, `$ARGUMENTS[N]`, named `arguments`, no-args `""` | unit (orchestrator) + cucumber Outline (red: Pi 1-based) | `node --test test/orchestrators/command-invocation.test.ts`; invocation.feature | ❌ Wave 2 |
| CMD-02 | User's own Pi template keeps Pi's expansion (negative control) | unit + cucumber | edge and orchestrator tests | ❌ Wave 2 |
| CMD-02 / E8 | Chained body text pinned (residual) | unit | orchestrator test | ❌ Wave 2 |
| CMD-03 / FG-05 | `!` runs; failure gives usage-error, model gets nothing; `!` argument escaped | cucumber (red: literal `!`) + unit | invocation.feature | ❌ Wave 2 |
| CMD-03 | `${CLAUDE_SESSION_ID}` / `${CLAUDE_EFFORT}` at invocation; typed `${CLAUDE_PLUGIN_ROOT}` | cucumber + unit | invocation.feature | ❌ Wave 2 |
| D-CF3-07 | Unrecorded project command aborts; recorded runs; user scope never checks | unit (ledger fakes) + cucumber (red: command ran) | invocation.feature (reuses Phase 2 provenance Given); `node --test test/bridges/commands/project-ledger.test.ts` | ❌ Wave 2 |
| D-CF3-07 writer | Commit records at project scope, none at user scope, failure propagates; unstage forgets, failure is a warning | unit | stage.test.ts, unstage.test.ts, project-ledger.test.ts | ❌ Wave 2 |
| CMD-03 / D-CF3-09 | `[deploy] dropped fields: model, effort`; none for clean or degraded; manifest `model` counts (wave 3) | unit + cucumber (red: no warning row) | frontmatter.feature | ❌ Wave 2 |
| CMD-03 / D-CF3-10 | `argument-hint` in TUI menu | cucumber (TUI, shared sandbox) | frontmatter.feature | ❌ Wave 2 (spike first) |
| CMD-03 / D-CF3-01 | Command absent from `<available_skills>` while a skill is present | cucumber (negative control, divergence pin) | frontmatter.feature | ❌ Wave 2 |
| CMD-03 / D-CF3-02 | `user-invocable: false` listed and runnable | cucumber (negative-edit proof) | frontmatter.feature | ❌ Wave 2 |
| CMD-04 / D-CF3-03 | Map source and content listed with manifest descriptions; overrides; content frontmatter; invalid keys, missing or non-`.md` source, second key warnings; directory source walked; both/neither unavailable | unit (resolver, discover, writer) + cucumber (red: plugin unavailable) | `node --test test/domain/component-paths.test.ts test/bridges/commands/discover.test.ts`; manifest-forms.feature | ❌ Wave 3 |
| CMD-04 / D-CF3-04 | Entry declaration adds to `commands/`, no warning; entry map `content` dropped with warning | unit + cucumber (red: `commands/` file missing) | manifest-forms.feature | ❌ Wave 3 |
| CMD-04 / D-CF3-05 | `"./cmds/a.md"` gives `/demo:a`; array file + dir; non-`.md` warns | unit + cucumber (red: nothing listed) | manifest-forms.feature | ❌ Wave 3 |
| CMD-04 / FG-14 | plugin.json declaration replaces `commands/` with the note | cucumber (negative-edit proof) | manifest-forms.feature | ❌ Wave 3 |
| CMD-05 / D-CF3-11 | Disable, uninstall, enable, update (new description listed, new body in model log); uninstall-before-reload aborts with the unreadable message | cucumber (negative-edit proofs; the abort row needs the handler) | lifecycle.feature | ❌ Wave 3 |

### Sampling Rate

- **Per task commit:** the touched pair's `node --test`, `npm run test:coverage:direct -- <path>`, the plan's own feature (`npx cucumber-js features/slash-command/<file>.feature`), and `npx fallow dupes` when a file mirrors Phase 2 code. The hook runs `check:commit`.
- **Per wave merge:** `npm run check` on the merged tree (with the wrapper), plus `npx fallow dupes`.
- **Phase gate:** `npm run check` green and two extra random-order `npm run test:cucumber` runs, as 02-07 did.

### Wave 0 Gaps

None. The existing infrastructure covers all requirements. New test files are created by their plans: `test/bridges/commands/staged-command.test.ts`, `project-ledger.test.ts`, and `test/orchestrators/command-invocation.test.ts`.

### Recommended plan and wave split

| Wave | Plan | Owns (product) | Owns (features) |
|------|------|----------------|-----------------|
| 1 | 03-01 Listing tracer | `bridges/commands/{types,stage,staged-command}.ts` (writer: description fallback, record, warning plumbing; delete stale markers) and tests | `listing.feature`, `listing.steps.ts` (adds `the published plugin {string} of the marketplace {string} has the slash command {string} with this command file:`), `features/lib/slash-command-files.ts` |
| 2 | 03-02 Frontmatter | `bridges/commands/staged-command.ts` (D-CF3-09) and its test | `frontmatter.feature`, `frontmatter.steps.ts` (TUI steps) |
| 2 | 03-03 Invocation and provenance | `edge/command-invocation.ts`, `orchestrators/command-invocation.ts` (new), `bridges/commands/{stage (commit),unstage,project-ledger,index}.ts`, call sites in `install-outcome.ts`, `update-swap.ts`, `marketplace/shared.ts`, `test/index.test.ts` edit | `invocation.feature`, `invocation.steps.ts` |
| 3 | 03-04 Manifest forms | `domain/component-paths.ts` (commands arm), `domain/resolver-types.ts`, `orchestrators/plugin/info.ts` (lenient), `bridges/commands/{discover,staged-command}.ts` (overrides and inline) | `manifest-forms.feature`, `manifest-forms.steps.ts` |
| 3 | 03-05 Lifecycle | none expected (negative-edit proofs) | `lifecycle.feature`, `lifecycle.steps.ts` |
| 4 | 03-06 Gate | none | decision IDs, the Pi gap parent line, SUMMARY parent lines, `npm run check` |

Why four waves: the staged-file writer is touched by frontmatter (wave 2) and manifest forms (wave 3). The invocation plan owns `stage.ts` commit in wave 2. Lifecycle's "uninstall before reload aborts" row needs the handler. Keeping each wave's files disjoint without pre-building unused code needs the third wave. The three-wave alternative pre-builds the override and inline paths in wave 1 and has no red proof for them until wave 2. Steps that two wave-2 or wave-3 plans need: only the command-file `Given`, which goes in wave 1.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes | D-CF3-07 ledger in the user scope (a repository cannot write it); Pi trust; resource discovery drops untrusted projects (`index.ts`, Phase 2 `6a7ea1b`) |
| V5 Input Validation | yes | typebox checks for map values and the record; `generatedCommandName` RN-2; key filters (`:` suffix, `<`, `>`, whitespace, optionally `\p{Cf}`); PARSE-01/02 gates |
| V6 Cryptography | yes (integrity digest only) | `node:crypto` sha256; no custom hashing |
| V12 Files and Resources | yes | `resolveContainedComponentPath` / `assertPathInside` (symlink refusal); `lstat` on declared files; atomic ledger write |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A cloned repository ships a staged command whose `!` lines run on the first typed use | Elevation of privilege | D-CF3-07 ledger check before `expandContextInjections`; digest of the exact bytes that run |
| Map `source` or key escapes the plugin root (`../`, absolute, symlink) | Tampering / information disclosure | Resolver containment (note + unavailable); RN-2 rejects `..` segments in keys |
| Frontmatter injection through override values (newline, `---`) | Tampering | JSON-flow emit: every value is a JSON string literal on one line |
| Typed argument forms a `!` command | Elevation of privilege | Core escapes a word-initial `!` (D-CF1-02, T-01-22); injection runs after substitution, once |
| Display spoofing with bidi or hidden characters in a map key | Spoofing | Recommended `\p{Cf}` skip (Open Question 2) |
| Chained body re-expanded by Pi (E8) bypasses provenance | Tampering (low) | Pi's expansion sends text only; no shell runs. Residual recorded |
| Oversized invocation | Denial of service | `InvocationTooLargeError` (4,000,000 characters) |

## Sources

### Primary (HIGH confidence; read this session)

- `node_modules/@earendil-works/pi-coding-agent` 1.4.0: `dist/core/agent-session.js` 1590-1601, 1631-1693, 1700-1767, 1895-1937, 2743-2763; `dist/core/prompt-templates.js` 61-131, 252-266; `dist/utils/frontmatter.js`; `dist/core/resource-loader.js` 320-345, 646-672, 895-907; `dist/core/extensions/runner.js` 1201-1236; `dist/core/extensions/types.d.ts` 910-930, 1267-1270; `dist/modes/rpc/rpc-mode.js` 298-326; `dist/modes/interactive/interactive-mode.js` 425-451, 465-530; `node_modules/@earendil-works/pi-tui/dist/autocomplete.js` 228-258.
- Repository: `bridges/commands/*`, `bridges/skills/{project-installs,stage,unstage,index,skill-names}.ts`, `orchestrators/skill-invocation.ts`, `edge/{skill-aliases,command-invocation}.ts`, `domain/{component-paths,resolver-types,plugin-resolver,name,description-fallback,invocation-frontmatter,argument-substitution}.ts`, `orchestrators/plugin/{info,install-outcome,update-swap,discover-names}.ts`, `orchestrators/marketplace/shared.ts`, `orchestrators/discover.ts`, `shared/{fs-utils,path-safety,notification-run}.ts`, `.fallowrc.json`, `features/**` (listed), `test/index.test.ts`, `test/domain/component-paths.test.ts`, `test/orchestrators/plugin/info.test.ts`.
- `03-UPSTREAM-EVIDENCE.md` and the retained probe tree (`v-arrmkt` init order, `details.stdout` for four variants).
- Scratch probes: `research-p3/dupe-probe` (fallow mild mode), `research-p3/markers` (bridge clone groups), `research-p3/roundtrip.mjs` (Pi parser round-trip, duplicate-key throw).

### Secondary

- `npx fallow explain code-duplication` ("abstracting identifiers and literals in non-strict modes"). The measured mild behavior abstracts literals only. The local probe is authoritative for this version.

### Tertiary

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH. Every module was read, and no package is added.
- Architecture: HIGH for the Pi flow and boundaries (read). MEDIUM for the upstream collision order (A1).
- Pitfalls: HIGH for dupes, parser, and test impact (measured). MEDIUM for TUI rendering (A2).

**Research date:** 2026-11-01
**Valid until:** 2026-12-01, or until a Pi version bump or a Phase 2 merge change, whichever comes first.

## Dubious Choices

1. **JSON-flow frontmatter rebuild for every staged command.** Every staged command's frontmatter bytes change, and key order is kept but quoting is not. Chosen over line insertion because of the duplicate-key throw and the ban on copying Phase 2's scanner.
2. **Map entries on `componentPaths.commandMap`** instead of a top-level resolved field. It avoids touching `plugin-resolver.ts`, but it puts a non-path value inside an object named "componentPaths".
3. **Required `ledger` parameter on `commitPreparedCommands` and in `UnstageCommandsInput`**, with `NODE_PROJECT_SKILL_LEDGER` (a "skill"-named export) passed by four orchestrator sites. A rename to a neutral name is a Phase 2 parent line.
4. **E8 recorded as a residual.** Options (b) `sendUserMessage` and (c) a one-character prefix were rejected. (b) breaks RPC disposition semantics and the frozen prompt step. (c) changes bytes.
5. **Abort origin `commandId` = typed command name** (not a constant like the skills' `skill`).
6. **Four waves** instead of the ROADMAP's three-wave template.
7. **Reusing two Phase 2 step texts** across phases (model skill list, provenance Given) to avoid duplicate step code.
8. **Commands order folder, then plugin.json, then entry** for first-wins, inferred from upstream listing order (A1), which differs from the generic entry-first order the other kinds keep.
9. **Lenient info mirror always includes `commands/`** even when an unseen plugin.json would replace it (the lenient arm reads only the entry).
10. **Escaping or symlinked map `source` makes the plugin unavailable** (declared-path policy), not a skipped entry (A5).
11. **Optional `\p{Cf}` key filter** beyond D-CF3-03's list (Open Question 2), left to the planner.
12. **Untrusted-project abort keeps a separate trust message**, as skills do, while D-CF3-07's text covers the ledger miss.
13. **Scratch measurements of stale markers** used a copy of only the two bridges. A clone with a file outside them would not show; the wave-1 plan re-measures on the real tree.
14. **No research-plan seam or web fetch**: the questions were in-repo and about the installed Pi. fallow.tools is not reachable from this session.
