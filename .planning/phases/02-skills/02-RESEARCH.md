# Phase 2: Skills - Research

**Researched:** 2026-11-01
**Domain:** Pi extension skills bridge (staging, names, aliases, invocation input handler) and its cucumber behavioral proof (RPC profile Pi, scripted model, real-terminal TUI driver)
**Confidence:** HIGH for the code facts and the Pi 1.4.0 runtime facts (read or run this session); MEDIUM for the TUI-with-model harness shape (one spike run, not yet wired through the world); LOW only where tagged `[ASSUMED]`.

## Summary

Phase 2 changes four product seams, all inside Phase 2's ownership plus one new orchestrator module: (1) `bridges/skills/stage.ts` swaps `firstBodyParagraph` for the frozen `descriptionFallback`, adds the D-CF1-05 dropped-fields line, and writes each staged `SKILL.md` a machine-readable key that carries the skill's upstream names (computed at install, where the directory name, the frontmatter `name`, the discovery order, and the plugin's command basenames are all known); (2) `bridges/skills/discover.ts` reads conventional `skills/` first (E3; today it is read **last**) and skips a skill whose upstream name equals a top-level command basename (D-CF2-03); (3) `orchestrators/skill-alias-state.ts` stops reverse-deriving an elided suffix and reads the stored names; (4) `edge/skill-aliases.ts` stops at `interactive`-only, resolves `/skill:<generated>` and every alias for **bridged** skills, and returns Pi's own `<skill name=... location=...>` block with the Phase 1 cores applied (substitution, then injection), aborting through the notify chokepoint with `{ action: "handled" }`.

The harness side needs no frozen-file edit except the one D-CF2-12 grants: `features/lib/pi-tui.ts` gets optional extra extensions, model flags, and a readiness text. A spike this session ran a real Pi 1.4.0 TUI under the PTY bridge with `--extension features/lib/scripted-model/extension.ts --provider faux --model faux-1`: the session started on `faux-1`, the input event arrived with `source: "interactive"`, Tab applied the single slash completion, and the scripted model logged the `<skill>` block. Because `world.ts` is frozen and module-level state is a cucumber BLOCKER, the TUI scenario must start, drive, and record the turn inside **one** `When` step (closure-held session, `this.onRelease` for the stop, `this.recordTurn` for the frozen `the model receives these calls:` Then).

Three measured traps shape the plan: importing the `ThinkingLevel` or `InputSource` type from the frozen `platform/pi-api.ts` makes its `fallow-ignore-next-line unused-type` marker stale and fails `fallow dead-code` (measured); `rewriteMarkdownReferences` runs over the whole staged file, frontmatter included, so a stored `"demo:review"` string would be rewritten to `/skill:demo-review` unless the key is written after it (read); and changing staged bytes breaks three test files Phase 2 does not own (`test/edge/register.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`) plus `test/bridges/skills/stage.test.ts` (measured: 19 failures, integration suite stays green).

**Primary recommendation:** Compute every skill's upstream alias list at install inside the skills bridge, store it (plus `pluginRoot` and `pluginData`) as one JSON-valued frontmatter key written last, and make the edge handler a thin resolver over a new `orchestrators/skill-invocation.ts` that reads the staged `SKILL.md`, substitutes, injects, and frames Pi's `<skill>` block.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(Copied verbatim from `02-CONTEXT.md` `## Implementation Decisions`.)

### Names and aliases (FG-07, FG-09)

- **D-CF2-01 (generated Pi name; FG-07; settled autonomously):** The Pi name
  stays `/skill:<plugin>-<name>` derived from the source **directory** name
  (SK-2, `domain/name.ts::generatedSkillName`, unchanged). Frontmatter `name`
  does not change the generated name. Reason: E1. Upstream's identity is the
  directory name, both names invoke the skill, and two skills that share a
  frontmatter `name` both load upstream. Deriving the Pi name from frontmatter
  `name` would drop one of them. SK-3 keeps rewriting the staged `name`.
- **D-CF2-02 (alias names; FG-07; settled autonomously):** The `/plugin:skill`
  aliases are exactly Claude Code's names for the skill (E1, `Qqn`):
  1. `<plugin>:<dir>`, with each character outside `[a-zA-Z0-9_-]` replaced
     by `-` and case kept. Nothing is elided.
  2. When frontmatter `name` is set: `<plugin>:<name>`, or `<name>` itself
     when it already starts with `<plugin>:`.
  3. When frontmatter `name` is set and has no `:`, the bare `<name>`.
  Within a plugin, a frontmatter-name alias goes to the first skill in
  discovery order that claims it (E1, `dupe-a`). An alias never takes a name
  that a Pi command of another source already has, as today (SK-6). The
  elided form that the current alias loader derives from the generated name
  (`acme:foo` for directory `acme-foo`) is dropped, because upstream has no
  such name. A bare alias that two plugins both claim goes to the first in the
  loader's scope order (upstream's order across plugins was not probed).
  Residual difference, licensed by the Pi gap (Pi's validator allows only
  `a-z0-9-`, and a Pi skill has no display name or alias field): Pi's command
  list and the system prompt show only the generated name. Upstream shows
  `<plugin>:<name>` in its `/` menu and `(<plugin>:<name>)` to the model.
  Autocomplete offers the aliases, as today.
- **D-CF2-05 (where the alias applies; FG-09; settled autonomously):** The
  alias and the D-CF1-01/D-CF1-02 skill invocation run for `interactive` and
  `rpc` input. Reason: E4. Upstream resolves plugin skill names in every user
  entry point, not only the TUI. `extension` input passes through unchanged,
  because Pi itself expands slash commands in an extension's message only
  when that extension asks for it (Pi facts), and the input event does not
  carry that choice. Supersedes the "interactive Pi sessions" wording of SK-6.
  Interactive input and autocomplete are proven through the TUI driver, and
  RPC through a profile Pi.

### Name clashes (FG-08)

- **D-CF2-03 (skill against command; FG-08; settled autonomously):** In one
  plugin, a command whose upstream name (`<plugin>:<file basename>`) equals a
  skill's upstream name (D-CF2-02 item 1) wins, and the skill is not staged.
  Install reports one warning for the skipped skill in the skills bridge's
  discovery warnings, in the style of the D-07/D-141-04 duplicate warning
  (wording at Claude's discretion). Reason: E2. Upstream hides the skill from
  the user and from the model, so a `/skill:` entry and a system-prompt
  listing for it would be an unlicensed divergence. The install warning is
  this project's diagnostic. Upstream says nothing, and the D-07/D-141-04
  duplicate warning sets the precedent. The SK-6 rule stays: `/<plugin>:<name>`
  typed by the user reaches the command. A frontmatter-name alias (D-CF2-02
  items 2 and 3) that equals a command name is not registered.
  **Constraints:** the skills bridge must not import `bridges/commands/`
  (fallow zones) and Phase 2 must not edit it (Phase 3 owns it). The
  command names come from `resolved.componentPaths.commands` (already on the
  `MaterializablePlugin` the skills bridge receives, with D-CF1-06 applied):
  top-level `*.md` basenames, because a nested command's name has a `:` that
  no normalized skill name can contain.
- **D-CF2-04 (skill against skill; settled autonomously, pins D-07 and
  D-141-04):** Two skill directories with one upstream name (E3) or one
  generated name (SK-2 elision) keep today's first-wins rule and warning. The
  scenario pins that the `skills/` copy wins over a declared path's copy,
  which E3 shows upstream does. The planner confirms that
  `componentPaths.skills` lists `skills/` first and fixes it if not.

### Invocation (pins FG-01..FG-04, FG-05, D-CF1-01..03)

- **D-CF2-06 (skill invocation wiring; pins D-CF1-01, D-CF1-02, D-CF1-03):**
  The skill input handler (`edge/skill-aliases.ts`) resolves `/skill:<name>`
  or an alias, then:
  - substitutes arguments with `substituteArguments` from
    `domain/argument-substitution.ts`, passing
    `parseArgumentNames(frontmatter.arguments)` unchanged (01-12);
  - fills `variables` with `CLAUDE_SESSION_ID` (Pi session id),
    `CLAUDE_EFFORT` (`claudeEffort` of the session thinking level), and the
    install-time values (`CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`,
    `CLAUDE_SKILL_DIR`, and `CLAUDE_PROJECT_DIR` at project scope), so a typed
    argument that names one expands as upstream does;
  - runs `expandContextInjections` with the shell from `selectPromptShell`.
    A `bash-missing` choice aborts with `bashMissingMessage(<typed
    invocation>)`. An injection failure aborts with upstream's message through
    the notify chokepoint. When an invocation aborts, nothing reaches the
    model;
  - returns Pi's own `<skill name="..." location="...">` block with the
    substituted body and no raw arguments after it.
  The framing stays Pi's `<skill>` block rather than upstream's `Base
  directory for this skill:` text (E5). SKL-03 names the `<skill>` block, and
  Pi's model-invoked path reads `SKILL.md` in the same frame. The
  frontmatter `shell` and `arguments` are read from the staged `SKILL.md`. A
  model-invoked skill gets neither arguments nor injection (D-CF1-03).
- **D-CF2-07 (description; pins FG-06, D-CF1-04):**
  `descriptionFallback(body, "Plugin skill")` replaces `firstBodyParagraph`
  in `bridges/skills/stage.ts`. The `when_to_use` fold and the 1,536-character
  cap (WTU-01/02) apply on top of the computed base, as today.

### Frontmatter fields (pins FG-10, D-CF1-05, D-CF1-09)

- **D-CF2-08 (dropped fields; pins D-CF1-05):** The skills bridge adds
  `droppedInvocationFieldsWarning(<source>, frontmatter)` to its discovery
  warnings, one line per skill. It is not emitted for a skill whose
  frontmatter does not parse (SKILL-01 placeholder arm), because that skill
  already gets its own warning. `allowed-tools`, `arguments`, `shell`, and
  `user-invocable` are never reported.
- **D-CF2-09 (`user-invocable: false`; cites D-CF1-09):** The skill stays
  listed and runnable from `/`. The scenario pins both under D-CF1-09.
  `disable-model-invocation: true` passes through to Pi and matches upstream:
  the skill is absent from the system-prompt skill list and still runs on
  `/skill:`.

### Pi report, lifecycle, ownership

- **D-CF2-10 (the Pi report; settled autonomously):** Phase 2 writes the gap
  report for Pi as ready-to-file text in its SUMMARY.md, for the parent to
  hand to the user. The report covers three gaps: no per-skill way to hide a
  slash command (D-CF1-09); no display name or alias for a skill (D-CF2-02);
  and no extension hook on the model's own skill path (D-CF1-03). The phase
  does not post to any external tracker. It has no credentials for one, and a
  public post on the user's behalf is the user's call.
- **D-CF2-11 (lifecycle; SKL-06):** Disable, uninstall, update, and enable
  are observed in a new session through `get_commands` (and the alias through
  the profile Pi). They take effect at `/reload`, not upstream's
  `/reload-plugins` (NFR-2, APL-D2). Update shows the new description and
  body.
- **D-CF2-12 (ownership additions; settled autonomously):** Beyond the
  ROADMAP table, Phase 2 also owns `orchestrators/skill-alias-state.ts` and
  its unit test, which only skills use. It may add an optional,
  backward-compatible profile (extra extensions and environment) to
  `features/lib/pi-tui.ts` if the TUI alias scenario needs the scripted
  model. Existing callers do not change. Phase 2 does not edit
  `domain/name.ts` (D-CF2-01 leaves `generatedSkillName` as it is),
  `bridges/commands/**`, or the frozen Phase 1 cores.

### Claude's Discretion

- How the alias loader learns each skill's source directory name and
  frontmatter `name` at session start. For example, the staged `SKILL.md` can
  carry them in an extra frontmatter key that Pi ignores. No `state.json`
  schema change, and no read of the plugin source at session start.
- The wording of the D-CF2-03 warning, in the style of the existing staging
  warnings.
- Which existing tests change for the dropped elided alias (D-CF2-02) and the
  `firstBodyParagraph` removal (D-CF2-07). Remove the old helper only if
  nothing else uses it.
- The plan split inside the ROADMAP's wave template.

### Deferred Ideas (OUT OF SCOPE)

- Showing `(<plugin>:<name>)` to the model and `<plugin>:<name>` in Pi's
  command list. This needs a Pi display-name field (in the D-CF2-10 report).
- Upstream's order for a bare alias that two plugins claim, and whether
  upstream matches slash names case-insensitively. Neither was probed.
- Object-map `commands` declarations (FG-13, Phase 3) and the D-CF2-03 clash
  check: re-check at the Phase 3 merge that a mapped command name is compared
  too.
- Arguments and injection for model-invoked skills (D-CF1-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKL-01 | A new session lists each bridged skill as `/skill:<plugin>-<name>` with its description, including the upstream description fallback as decided | `the session offers these skills:` (frozen session step, RPC `get_commands`); D-CF2-07 swap at `stage.ts:135`; measured fallback outputs (`"Plugin skill"` for an empty body); Pattern 1 |
| SKL-02 | Skill frontmatter variants behave as upstream or as a recorded divergence | D-CF2-08 tagged as **discovery** (not hygiene) so standalone install shows it; Pi passes `disable-model-invocation` through (`skills.js:262`, `formatSkillsForPrompt` filter); new skill-owned system-prompt Then; frozen generic file `Given` writes any `SKILL.md` text |
| SKL-03 | Invoking a skill sends the model its body in a `<skill>` block, with path variables expanded and arguments handled as decided | Pi block format (`agent-session.js:1727-1750`); input handlers run before expansion (`:1594`, `:1661`); Phase 1 core signatures; `{uuid}` projection for `${CLAUDE_SESSION_ID}` (uuidv7); Pattern 3 |
| SKL-04 | A skill and a command (or another skill) with the same qualified name resolve as decided under FG-08 | D-CF2-03 check from `componentPaths.commands` with `shared/fs-utils.ts` helpers; D-CF2-04 ordering bug found at `domain/component-paths.ts:176-187` (conventional `skills/` appended last); fix in `discover.ts` |
| SKL-05 | The interactive `/plugin:skill` alias works as decided under FG-09, tested through the TUI driver | TUI spike (scripted model under PTY, `source: "interactive"`, Tab completion); one-`When` TUI turn design; `pi-tui.ts` optional profile; RPC via the frozen `the user prompts` step |
| SKL-06 | Disable, uninstall, and update remove or replace the skill in a new session, and enable restores it | Existing lifecycle verbs plus `the user starts a new pi session` / `the session offers these skills:`; alias loader keeps the "skill file loaded" check |
</phase_requirements>

## Project Constraints (from AGENTS.md)

The repository has no `CLAUDE.md`; `AGENTS.md` is the project instruction file. Directives that bind this phase:

- **Research before editing; trace callers before modifying a function.**
- **Git:** never commit to `main`; never rebase or rewrite history; commit format per `.agents/skills/committing/SKILL.md`; never `--no-verify`. (The orchestrator commits this file.)
- **GSD records:** prefix `gsd-tools windows append --description` with `[component-features]`; every plan `SUMMARY.md` carries `## Threat Flags` (even "None").
- **Build verification:** GSD gates run `npm run check` on the combined tree (wave post-merge gate, phase gate); the pre-commit hook (`npm run check:commit`) is not a full verdict.
- **Behavioral tests:** a user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without the change. Skill invocation, listing, and aliases are user-visible.
- **Upstream parity:** Claude Code's behavior is the default; divergence needs a recorded decision ID or a Pi capability gap.
- **Containment (NFR-10):** writes only under `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `mcp-adapter.json`, `mcp.json`.
- **Atomic writes (NFR-1), retry-safe operations (NFR-3), `/reload` suffices (NFR-2).**
- **Network (NFR-5):** nothing in this phase may touch the network; `list`/`info`/load stay offline.
- **Output channel (IL-2):** all user-visible output through `shared/notification-dispatch.ts`; no `process.stdout`/`stderr`, no `console.*` (fallow rule pack `no-stdio`, `no-console`, `notify-chokepoint`).
- **Quality bar (NFR-6):** typecheck, ESLint (`--max-warnings 0`, `sonarjs/cognitive-complexity` 15), fallow (dead code, `maxCognitive` 15, `maxCyclomatic` 20, dupes fail on every clone group, boundary zones, rule pack), Prettier, source/test pairing, unit + integration + cucumber, 100% direct coverage per source-test pair.
- **Conventions:** kebab-case files; typed error classes; explicit return types on exports; dependency injection over test-only seams; comments cite durable IDs (no `Phase NN` / `Plan NN`).
- **Milestone rules (ROADMAP):** never edit `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions, `BACKLOG.md` (list lines in SUMMARY); append-only closed sets (prefer an existing reason/kind); own `domain/name.ts` function only (Phase 2 edits none); frozen files listed in ROADMAP "Frozen after Phase 1" and `.agents/skills/cucumber/rules/layout.md`.

## Architectural Responsibility Map

This is a Pi extension, so the tiers are the project's layers, not browser/server tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Description fallback, `when_to_use` fold, cap (SKL-01) | bridges/skills (`stage.ts`) | domain (`description-fallback.ts`, frozen core) | Staging writes Pi's `description` once at install; Pi lists what is staged |
| Upstream names and alias claims (D-CF2-02) | bridges/skills (new pure helper + `stage.ts` writer) | shared (`fs-utils.ts`) | Only install time knows dir name, frontmatter `name`, discovery order, and command basenames together |
| Skill vs command shadow (D-CF2-03), skills-folder-first order (D-CF2-04) | bridges/skills (`discover.ts`) | domain (`component-paths.ts`, read-only) | Discovery already owns first-wins dedup and the warning channel |
| Dropped-fields warning (D-CF2-08) | bridges/skills (`stage.ts`) | domain (`invocation-frontmatter.ts`, frozen core) | Only the stage loop has the parsed source frontmatter |
| Alias table at session time | orchestrators (`skill-alias-state.ts`) | persistence (`state-io.ts`), platform (`pi-api.ts` `parseFrontmatter`) | Reads state plus staged `SKILL.md`; edge may not import bridges |
| Invocation composition (D-CF2-06) | orchestrators (new `skill-invocation.ts`) | domain cores, platform (`prompt-shell.ts`) | Reads a file, runs the cores, frames the block; injectable for unit tests |
| `input` event filter, alias resolve, abort report | edge (`skill-aliases.ts`) | shared (`notification-dispatch.ts`, `notification-run.ts`) | Edge parses user input and calls one orchestrator; notify chokepoint |
| Autocomplete of aliases | edge (`skill-aliases.ts`) | — | Existing `aliasProvider` wrapper |
| Behavioral proof | features (`features/skill/**`, `step_definitions/skill/**`, `lib/skill-files.ts`, `lib/pi-tui.ts` optional profile) | frozen harness (world, scripted model, registry probe, session/model steps) | Observes only what Pi reports |

## Standard Stack

No new dependency. Everything this phase needs is already in the tree.

### Core
| Library / module | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | 1.4.0 (installed) [VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json] | `input` event, `getCommands`, skill loader, `parseFrontmatter` | Peer dep; only imported through `platform/pi-api.ts` (NFR-11) |
| `domain/argument-substitution.ts` | Phase 1 core (frozen) | `substituteArguments`, `parseArgumentNames`, `claudeEffort`, `InvocationTooLargeError` | D-CF1-01 port of `T2e` |
| `domain/context-injection.ts` | Phase 1 core (frozen) | `expandContextInjections`, `ContextInjectionError` | D-CF1-02 |
| `platform/prompt-shell.ts` | Phase 1 core (frozen) | `selectPromptShell` → `PromptShellChoice`, `bashMissingMessage`, `createPromptShellRunner`, `NODE_PROMPT_SHELL_HOST`, `NODE_PROMPT_SHELL_SPAWN` | The fifth sanctioned `node:child_process` site |
| `domain/description-fallback.ts` | Phase 1 core (frozen) | `descriptionFallback(body, "Plugin skill")` | D-CF1-04 port of `A2e` |
| `domain/invocation-frontmatter.ts` | Phase 1 core (frozen) | `droppedInvocationFieldsWarning(source, frontmatter)` | D-CF1-05 |
| `@cucumber/cucumber` | 13.3.0 [VERIFIED: `npx cucumber-js --version`] | Behavioral runner | Project suite |

### Supporting
| Module | Purpose | When to Use |
|---------|---------|-------------|
| `shared/fs-utils.ts` `readDirEntriesTolerant`, `isPlainMarkdownFile` | List a commands directory's top-level `*.md` files without importing the commands bridge | D-CF2-03 shadow check |
| `shared/staging-warnings.ts` `discoveryWarning` | Tag a warning so standalone verbs render it | D-CF2-03 and D-CF2-08 lines |
| `shared/notification-dispatch.ts` `notifyUsageError` + `shared/notification-run.ts` `openNotificationRun` | Report an aborted invocation without a new kind | D-CF2-06 abort path |
| `features/lib/turn-records.ts` `readLogLengths`, `readLogLinesSince`; `features/lib/scripted-model/script.ts` `modelCallsOf` | Build a `ModelTurn` from the call log for a TUI turn | One-`When` TUI step |
| `features/lib/pi-tui.ts` `PiTuiSession` | Real PTY TUI | SKL-05 interactive alias |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A frontmatter key in the staged `SKILL.md` | A sidecar file in the staged skill dir | Sidecar keeps `SKILL.md` bytes unchanged (fewer test edits) but adds a user-visible file to every skill dir and a second write per skill; the key is one atomic file and the PARSE-02 backstop validates it |
| Computing aliases at install | Storing raw `directory` + `name` and computing at session start | Session start cannot know the plugin's command basenames (Pi only sees elided `/<plugin>:<x>` templates), so the D-CF2-03 alias filter would be wrong; install-time computation is exact |
| Fixing order in `discover.ts` | Fixing `domain/component-paths.ts` so `skills` is pushed first | The resolver is not Phase 2's file and feeds `info`, `discover-names`, and every bridge; a discover-local reorder has the smallest blast radius |
| `notifyUsageError` for aborts | A new raw kind | A new kind touches the append-only closed sets (`schema/claude-plugin.schema.json`, `docs/json-output.md`, `docs/output-catalog.md`, catalog counters); `usage-error` already renders `message` at `error` severity and passes the wire schema with any origin |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed by this phase. The legitimacy gate does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
INSTALL / UPDATE / REINSTALL / ENABLE / APPLY (orchestrators, unchanged)
        |
        v
 bridges/skills/discover.ts
   componentPaths.skills ──reorder: "skills" first (D-CF2-04)──> walk dirs (localeCompare)
   componentPaths.commands ──top-level *.md basenames──> commandNames set
   for each skill dir:
     generated-name dedup (D-07/D-141-04 warning) ──> loser skipped
     "<plugin>:<dir normalized>" ∈ commandNames? ──yes──> skip + discovery warning (D-CF2-03)
        |
        v  discovered[] (discovery order) + commandNames
 bridges/skills/stage.ts (per skill, in order)
   read → stripBom → parse (PARSE-01) ─throw─> SKFM-01 repair ─fail─> SKILL-01 degrade arm
   SK-3 name rewrite → description: descriptionFallback / when_to_use fold / cap (D-CF2-07)
   droppedInvocationFieldsWarning (D-CF2-08, parsed arm only) ──> discovery warnings
   SKTK-01 reference rewrite → SK-4 substituteClaudeVars
   alias claims: dir alias, <plugin>:<name>, bare <name>; first claim in plugin wins;
                 drop any equal to a command upstream name (D-CF2-03)
   WRITE LAST: frontmatter key {names, pluginRoot, pluginData}  ──> PARSE-02 re-parse
        |
        v  staged SKILL.md under <scopeRoot>/pi-claude-marketplace/resources/skills/<gen>/
 Pi resource loader (/reload, new session) ──> skill "<gen>" (name from staged frontmatter)

USER INPUT (TUI "interactive" | RPC "rpc" | extension "extension")
        |
 Pi prompt(): extension command? ──yes──> run it (never reaches input handlers)
        |
 input handlers in registration order: hooks UserPromptSubmit → background update →
        |                               skill aliases (this phase) → command invocation (Phase 3)
        v
 edge/skill-aliases.ts
   source == "extension" ──> continue
   parse "/<token> <args>"
   token is a non-skill Pi command name ──> continue (SK-6, D-CF2-03)
   token == "skill:<gen>" for a BRIDGED loaded skill, or token ∈ alias table ──> resolve <gen>
   otherwise ──> continue (Pi expands its own /skill: or the text goes to the model)
        |
        v
 orchestrators/skill-invocation.ts
   read staged SKILL.md (sourceInfo.path) → parseFrontmatter → body (trimmed)
   variables: CLAUDE_SESSION_ID, CLAUDE_EFFORT, CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA,
              CLAUDE_SKILL_DIR (= baseDir), CLAUDE_PROJECT_DIR (project scope only)
   substituteArguments(body, args, parseArgumentNames(fm.arguments), variables)
   selectPromptShell(fm.shell) ─bash-missing─> abort(bashMissingMessage(typed))
   expandContextInjections(substituted, runner) ─ContextInjectionError─> abort(message)
   frame: <skill name="<gen>" location="<path>">\nReferences are relative to <baseDir>.\n\n<body>\n</skill>
        |
   ok ──> { action: "transform", text: block } ──> Pi _expandSkillCommand: not "/skill:" → unchanged
                                              ──> expandPromptTemplate: not "/" → unchanged ──> model
   abort ──> notifyUsageError(...) via notify chokepoint ──> { action: "handled" } (no model call)
```

### Recommended Project Structure (files this phase touches)

```text
extensions/pi-claude-marketplace/
├── bridges/skills/
│   ├── discover.ts            # D-CF2-04 order, D-CF2-03 shadow + commandNames
│   ├── stage.ts               # D-CF2-07, D-CF2-08, alias key written last
│   ├── frontmatter-degrade.ts # delete firstBodyParagraph + its private helpers
│   ├── skill-names.ts         # NEW pure helper: upstream names, claims, key emit/read
│   └── types.ts               # DiscoveredSkill / result fields if needed
├── orchestrators/
│   ├── skill-alias-state.ts   # read stored names; drop skillSuffix (D-CF2-12 ownership)
│   └── skill-invocation.ts    # NEW: read staged SKILL.md, cores, frame block
└── edge/skill-aliases.ts      # rpc + interactive, /skill: for bridged, abort → notify
test/
├── bridges/skills/{discover,stage,frontmatter-degrade,skill-names}.test.ts
├── orchestrators/{skill-alias-state,skill-invocation}.test.ts
├── edge/skill-aliases.test.ts
└── (expected-value edits) edge/register.test.ts, orchestrators/plugin/{materialize-latest,reinstall-flow}.test.ts
features/
├── skill/{listing,frontmatter,invocation,collisions,lifecycle}.feature
├── step_definitions/skill/{listing,frontmatter,invocation,collisions,lifecycle}.steps.ts
└── lib/{skill-files.ts, pi-tui.ts (optional profile only)}
```

New source files need a paired test at the mirrored path (`scripts/check-corresponding-tests.mjs`, NFR-6) and 100% direct coverage.

### Pattern 1: Description fallback swap (D-CF2-07)

**What:** `augmentSkillDescription` computes `base` from `firstBodyParagraph(body)` today [VERIFIED: extensions/pi-claude-marketplace/bridges/skills/stage.ts:135 `const base = sourceDescription === "" ? firstBodyParagraph(body) : sourceDescription;`]. Replace with `descriptionFallback(body, "Plugin skill")`. `descriptionFallback` never returns `""` (it returns the label for an empty body) [VERIFIED: extensions/pi-claude-marketplace/domain/description-fallback.ts:16-27], so `MISSING_DESCRIPTION_PLACEHOLDER` (`"No description provided."`, `stage.ts:106`) and the `folded === "" ? ... :` branch become unreachable and must go, or direct coverage drops below 100%.

`firstBodyParagraph` has no other production caller [VERIFIED: grep — only `bridges/skills/stage.ts` and `test/bridges/skills/frontmatter-degrade.test.ts`]. Delete it with `FENCE`, `skipFencedBlock`, and `collectParagraph` (`frontmatter-degrade.ts:59-115`; `foldWhenToUse` at line 124 stays), or fallow production dead-code reports an unused export. Delete its `describe("firstBodyParagraph")` cases.

**Measured blast radius (trial edit in a scratch worktree, `npm run test:modules`):** 2 failures — `test/bridges/skills/stage.test.ts:741` (`"No description provided."` → `"Plugin skill"`; its `expectedProse` case `# Heading` + paragraph also changes, to `"Heading"`) and `test/orchestrators/plugin/materialize-latest.test.ts:197` (`description: "No description provided."` → `"Plugin skill"`). The second file is outside Phase 2's ownership; it is an expected-value-only edit the plan must list.

### Pattern 2: Stored upstream names (D-CF2-02, discretion item 1)

**What:** compute, per staged skill, the ordered list of names the alias loader may register, and store it with the install-time variable values in one frontmatter key.

Upstream's rule, read from the 2.1.316 binary this session [VERIFIED: /opt/claude-code/bin/claude byte 287674833]:

```js
async function Xqn(e){try{let n=await ek(le(),e,Rbs);return n===null?null:sd(n,e,{normalizeKeys:!0}).frontmatter.name??void 0}catch(n){...;return null}}
function Qqn(e,n,r){let s=`${e}:${n.replace(/[^a-zA-Z0-9_-]/g,"-")}`,h=SAt(r,`plugin skill ${s}`)??"",y=!h?s:h.startsWith(`${e}:`)?h:`${e}:${h}`;return{name:s,loadedFrom:"plugin",userFacingName:()=>y,aliases:h&&!h.includes(":")?[h]:void 0}}
function SAt(e,n){if(e==null)return;let r=String(e);if(r.length<=RI)return r;t(`Frontmatter "name" of ${n} is over ${RI} characters - ignoring it`,{level:"warn"}
```

and `,RI=256` [VERIFIED: binary grep]. Consequences the D-CF2-02 text does not spell out:

- A non-null, non-string frontmatter `name` is converted with `String()` (`name: 123` → `"123"`); a `name` longer than 256 characters is ignored. Reproduce both.
- **Every skill whose frontmatter declares `name` gets a bare alias**, including `name` equal to the directory name. The Phase 1 fixture writer always writes `name: <dir>` [VERIFIED: features/lib/skill-files.ts `skillFileText` returns `` `---\nname: ${skill.name}\ndescription: ...` ``], so in every existing skill scenario `/greet` becomes a working bare alias. A scenario that needs "no bare alias" needs a fixture without `name` (extend `skill-files.ts`, or use the frozen generic file `Given`).
- `h` with whitespace (`name: my skill`) produces a bare alias that no slash input can type (the handler's token regex is `\S+`); skip names containing whitespace or let them sit unused.

Computation order inside the stage loop (`stage.ts:271-383` iterates `discovered` in discovery order):

1. Identity alias `<plugin>:<dir.replace(/[^a-zA-Z0-9_-]/g, "-")>` (case kept).
2. If `name` set: `name.startsWith("<plugin>:") ? name : "<plugin>:<name>"`.
3. If `name` set and has no `:`: bare `name`.
4. Drop any item 2/3 name already claimed by an earlier skill in this plugin, and any name equal to a command upstream name (`<plugin>:<basename>` from the D-CF2-03 set).
5. Store the surviving list.

**Where to write it:** after `rewriteMarkdownReferences` and `substituteClaudeVars`, immediately before `writeFile` and the PARSE-02 re-parse (`stage.ts:363-374`). Writing it earlier is a bug: `rewriteMarkdownReferences` runs on the whole file, frontmatter included, with the token pattern `(?<![A-Za-z0-9_.:/-])/?(?:(<plugin>):|skill:)([A-Za-z0-9_-]+(?:[:.][A-Za-z0-9_-]+)*)` [VERIFIED: extensions/pi-claude-marketplace/domain/skill-tokens.ts:90-93]. A `"` is not in the lookbehind class, so a stored `"demo:review"` would be rewritten to `"/skill:demo-review"`.

**How to emit:** a JSON value on one line. JSON is valid YAML 1.2 flow; a trial insert of `x-claude-skill: {"directory":"orphan-skill"}` passed the PARSE-02 backstop across the whole unit and integration suites (measured). Use the frontmatter-scan helpers (`frontmatterBlockEnd`, `keyValueEnd` in `frontmatter-scan.ts`, as `rewriteNameNode` does) to **replace** an existing node with the same key: an author file that already carries the key would otherwise produce a duplicate YAML key, which `yaml.parse` rejects, and PARSE-02 would fail the install. Apply it on the degraded (SKILL-01) arm too, with the identity alias only (no frontmatter `name` survives that arm).

**Key name and shape** are discretion. Example (the key name is `[ASSUMED]`, pick one unlikely to collide):

```yaml
---
name: demo-review
description: Review skill with frontmatter name fancy
pi-claude-marketplace: {"names":["demo:review","demo:fancy","fancy"],"pluginRoot":"/abs/plugins/demo","pluginData":"/abs/.pi/pi-claude-marketplace/data/fixtures/demo"}
---
```

`CLAUDE_SKILL_DIR` need not be stored: it equals Pi's `sourceInfo.baseDir` for the loaded skill (install wrote `skillDir: targetDir`, `stage.ts:286-291`; Pi sets `baseDir: dirname(filePath)`, `skills.js:258-261`). `CLAUDE_PROJECT_DIR` at project scope is the parent of the scope root (`<cwd>/.pi`), which the loader already iterates.

**Measured blast radius of adding any frontmatter key** (trial in a scratch worktree): `npm run test:modules` → 19 failures: 15 in `test/bridges/skills/stage.test.ts` (owned), 2 in `test/edge/register.test.ts:1579` (json and rpc variants), 1 in `test/orchestrators/plugin/materialize-latest.test.ts:197`, 1 in `test/orchestrators/plugin/reinstall-flow.test.ts:9773`. `npm run test:integration` passed unchanged. All non-owned failures are exact staged-bytes assertions; the fix is expected-value-only.

### Pattern 3: Invocation in the input handler (D-CF2-06)

Pi facts this rests on (all read this session in `node_modules/@earendil-works/pi-coding-agent/dist`):

- `prompt()` runs `_tryExecuteExtensionCommand` first, then `_runInputHandlers(text, images, options?.source ?? "interactive", ...)`, then `_expandSkillCommand` and `expandPromptTemplate` [VERIFIED: core/agent-session.js:1636-1662]. Queued steer/follow-up input goes through the same handlers (`_queueUserInput`, `:1754-1767`).
- `emitInput` chains handlers across extensions; a `transform` replaces the text for the next handler; `handled` stops the chain and the prompt [VERIFIED: core/extensions/runner.js:1201-1236].
- Pi's own block: `` `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${body}\n</skill>` `` with `body = stripFrontmatter(content).trim()`, then `\n\n${args}` when args are non-empty [VERIFIED: core/agent-session.js:1727-1750]. `_expandSkillCommand` returns any text not starting with `/skill:` unchanged, so a returned block passes through.
- `getCommands()` reports a skill as `{ name: "skill:<name>", description, source: "skill", sourceInfo }` [VERIFIED: core/agent-session.js:2756-2761], and `sourceInfo` is `{ path: filePath, ..., baseDir }` [VERIFIED: core/source-info.js:26-33; core/skills.js:258-261]. The handler can therefore build Pi's exact `location` and `References are relative to` values from `getCommands()` without importing Pi internals.
- `InputSource` is `"interactive" | "rpc" | "extension"` [VERIFIED: core/extensions/types.d.ts:908]. `ctx.sessionManager.getSessionId()` exists [VERIFIED: core/session-manager.d.ts:178, :246]; the id is `uuidv7()` [VERIFIED: core/session-manager.js:12-13], which the model-call projection prints as `{uuid}` (`features/step_definitions/model.steps.ts` `UUID_PATTERN`). `pi.getThinkingLevel()` exists [VERIFIED: core/extensions/types.d.ts:1300]. `ctx.signal` is `undefined` when the agent is idle [VERIFIED: types.d.ts, ExtensionContext `signal`].
- Typing a command with no arguments passes `""`, not `undefined`, to upstream's `T2e` [CITED: .planning/phases/01-harness-and-version-raise/01-RESEARCH.md:212]. Pass `args = rest.trim()` (Pi's own trimming) and never `undefined` for a typed invocation.

Composition (signatures as they exist today [VERIFIED: domain/argument-substitution.ts:77-87, :224, :256, :274; domain/context-injection.ts:168; platform/prompt-shell.ts:213-251, :405]):

```typescript
// orchestrators/skill-invocation.ts (sketch; names other than the cores are [ASSUMED])
const { frontmatter, body } = parseFrontmatter(await deps.readFile(skill.path));
const variables = {
  CLAUDE_SESSION_ID: sessionId,
  CLAUDE_EFFORT: claudeEffort(thinkingLevel),            // pass pi.getThinkingLevel() as string
  CLAUDE_PLUGIN_ROOT: stored.pluginRoot,
  CLAUDE_PLUGIN_DATA: stored.pluginData,
  CLAUDE_SKILL_DIR: skill.baseDir,
  ...(scope === "project" ? { CLAUDE_PROJECT_DIR: projectDir } : {}),
};
const substituted = substituteArguments({
  body, args, argumentNames: parseArgumentNames(frontmatter.arguments), variables,
});                                                       // throws InvocationTooLargeError
const choice = selectPromptShell(
  typeof frontmatter.shell === "string" ? frontmatter.shell : undefined, deps.host);
if (choice.kind === "bash-missing") return abort(bashMissingMessage(typedInvocation));
const expanded = await expandContextInjections(substituted, (command) =>
  deps.runner({ command, shell: choice.shell, cwd, env: deps.env }));  // throws ContextInjectionError
return `<skill name="${generatedName}" location="${skill.path}">\n` +
  `References are relative to ${skill.baseDir}.\n\n${expanded}\n</skill>`;
```

Order matters for T-01-22: substitution first, injection second, never the reverse. The seed scenario's expected text changes from `...</skill>\n\nAda` to `...\n\nGreet the person named in the arguments.\n\nARGUMENTS: Ada\n</skill>` (no placeholder in the body, so `appendArguments` adds `\n\nARGUMENTS: Ada`) — that change is the red proof for D-CF2-06.

**Resolution rules for the edge handler:**

- `event.source === "extension"` → `continue` (D-CF2-05). Replace today's `event.source !== "interactive"` gate [VERIFIED: edge/skill-aliases.ts:82-84].
- Parse the token with the existing `^\/(\S+)(?=\s|$)` regex. Drop today's `!name?.includes(":")` early return: bare aliases have no colon.
- Keep the reserved check (`commands.some(c => c.source !== "skill" && c.name === token)` → `continue`) so prompt templates and extension commands win (SK-6, D-CF2-03).
- `token === "skill:<gen>"` is handled **only when `<gen>` is a bridged skill** this extension staged and Pi loaded. A user's own Pi skill (`~/.pi/agent/skills/...`) must keep Pi's native expansion. The loader already proves "bridged and loaded" by matching `sourceInfo.path` to `<root>/pi-claude-marketplace/resources/skills/<gen>/SKILL.md` [VERIFIED: orchestrators/skill-alias-state.ts:63-75].
- Keep the `registerSkillAliases(pi)` default-argument shape: `index.ts` calls it with one argument and is not edited [VERIFIED: extensions/pi-claude-marketplace/index.ts:266-269].

**Abort report:** use `notifyUsageError(ctx, openNotificationRun(pi, origin), { message, usage: "" })` and return `{ action: "handled" }`. `usage-error` renders the message alone when `usage` is empty, at `error` severity [VERIFIED: shared/notification-dispatch.ts:280-300; docs/output-catalog.md "Usage errors"]. The wire schema accepts any of the three origins on a raw kind [VERIFIED: shared/notification-wire.ts:356-373]. Origin choice is discretion: `{ kind: "command", commandId: "skill", invocationId: randomUUID() }` reads truest in `docs/json-output.md`'s terms ("For a command, origin.commandId names the operation"); `{ kind: "hook" }` is semantically wrong. In RPC the payload arrives as a `claude-plugin` custom entry, so the frozen `When the user runs "/skill:demo-check"` (asserts `disposition: "handled"` and at least one payload) plus `Then the result has these fields:` observes it with no new step [VERIFIED: features/lib/pi-commands.ts `runCommandPayloads`].

### Pattern 4: Skill-against-command shadow and folder order (D-CF2-03, D-CF2-04)

**Current order bug:** `collectStrictComponentKind` pushes the declared entry and manifest paths first and appends the conventional folder afterwards [VERIFIED: extensions/pi-claude-marketplace/domain/component-paths.ts:176-187 — `for (const raw of [...readPathOrArray(entryRaw), ...readPathOrArray(manifestRaw)]) { ... }` then `if ((await statKind(path.join(pluginRoot, kind))) === "dir") { if (conventionalFolderApplies(...)) { addComponentPath(resolution, kind, seenPaths, kind); } ...`]. With `skills/twin/` and `extra/twin/` plus `"skills": ["./extra"]`, today's first-wins keeps `extra/twin`; upstream keeps `skills/twin` (E3). D-CF2-04 says fix it.

**Fix in `discover.ts`:** iterate `componentPaths.skills` with the entry equal to `"skills"` (the literal `addComponentPath` pushes for the conventional folder) moved to the front, everything else in its existing order. The resolver stays untouched. `discover-names.ts` also calls `discoverPluginSkills` [VERIFIED: grep `orchestrators/plugin/discover-names.ts:22`], so the reference inventory follows the same winner. Re-check `test/bridges/skills/discover.test.ts` cases at lines 108, 291, 329, 416-481 (order and MANF-03); they use absolute parent paths, not `"skills"`, so they should hold.

**Shadow check:** for each `componentPaths.commands` entry (relative to `pluginRoot` unless absolute, as the commands bridge resolves it), list top-level entries with `readDirEntriesTolerant`, keep `isPlainMarkdownFile` ones (non-dot, regular `.md`, the same filter the commands bridge stages with), and collect `<plugin>:<basename without .md>`. A skill whose identity alias is in the set is skipped with a discovery warning. Recommended wording, with no absolute path so a feature can state the whole line (the redaction projection cuts a line at `[redacted path]`, as `features/plugin/staging-warnings.feature` rows show):

```text
skill source "clash" has the same name "demo:clash" as a command of the plugin; ignoring the skill.
```

Fallow: `discover.ts` already carries a reviewed `code-duplication` marker against the commands bridge (`discover.ts:148`). New listing code that copies the commands walk will create a new clone group; keep the new helper small and differently shaped, and run `npx fallow dupes` before committing.

### Pattern 5: Dropped-fields line (D-CF2-08)

Call `droppedInvocationFieldsWarning(skill.sourceName, parsed.frontmatter)` on the parsed and repaired arms only and push it through `discoveryWarning`. **Do not copy the agents bridge's tag:** agents push `[<source>] dropped fields: ...` as a **hygiene** warning [VERIFIED: bridges/agents/stage.ts:144-147], and standalone verbs render the discovery half only [CITED: shared/staging-warnings.ts header, D-19-01]. D-CF2-08 says "discovery warnings", which is what makes the line visible on a standalone `install` under `N declared component(s) has a note`. The warning text lists fields in frontmatter key order [VERIFIED: domain/invocation-frontmatter.ts:35-41].

### Pattern 6: One-`When` TUI turn (SKL-05)

**Spike (this session, scratch only):** a real Pi 1.4.0 TUI under `features/lib/pi-tui-pty.py`, `dist/bundle/cli.js --offline --no-session --extension <repo>/extensions/pi-claude-marketplace/index.ts --extension <repo>/features/lib/scripted-model/extension.ts --provider faux --model faux-1`, `HOME`/`PI_CODING_AGENT_DIR`/`TMPDIR` in a scratch tree, a one-step `model-script.json`:

- the footer showed `faux-1`, and the start screen did **not** contain `Warning: No models available.` (today's readiness text in `pi-tui.ts`, `READY_TEXT`);
- typing `hello there` + Enter logged `{"source":"interactive","text":"hello there"}` from a probe `input` handler and one call in `model-calls.jsonl`; the terminal showed `SCRIPTED-REPLY-OK`;
- typing `/skill:demo-gr`, Tab, ` Ada`, Enter: the menu showed `→ skill:demo-greet  [u] Greets.`, Tab applied `/skill:demo-greet ` (trailing space), the input event text was `/skill:demo-greet  Ada`, and the model received `<skill name="demo-greet" location=".../SKILL.md">\nReferences are relative to ....\n\nGreet them.\n</skill>\n\nAda`; the TUI rendered the user message as `[skill] demo-greet (ctrl+o to expand)`.
- The bundled CLI is required: `dist/cli.js` failed to load the scripted model (`Cannot find module .../pi-ai/dist/compat.js/providers/faux`); `test/pi-runtime.ts` already resolves `bin.pi` = `dist/bundle/cli.js` [VERIFIED: test/pi-runtime.ts:63-88; package.json `bin`].

**Constraint:** `world.ts` is frozen, its `startTuiSession()` passes only `sandbox`, `git`, and `variables` and waits for `READY_TEXT` [VERIFIED: features/support/world.ts:653-668], and module-level state is a BLOCKER [CITED: .agents/skills/cucumber/SKILL.md "Review"]. So:

1. `features/lib/pi-tui.ts` (D-CF2-12): add optional `extensions?: readonly string[]` (passed to `piArguments("tui", extensions)`, which already takes extras [VERIFIED: test/e2e/_rpc.ts:242-254]), optional extra CLI arguments or `model?: string` for `--provider faux --model faux-1`, and optional `readyText?: string` defaulting to `READY_TEXT`. Existing callers pass none, so behavior is unchanged.
2. One `When` in a skill step module does the whole turn: build the `RpcSandbox` from `this.tokens` (`{ home, agentDir, cwd: projectDir }`, the `RpcSandbox` shape [VERIFIED: test/e2e/_rpc.ts:43-47]) — not from `currentRun()`, which no step module imports today; start `PiTuiSession` with the scripted-model extension, `TMPDIR` = `<home>/tmp` (the profile Pi created it and linked its `jiti` cache), and the model flags; `this.onRelease(() => tui.stop())` at once; record `readLogLengths(harness)`; type the prefix, Tab, the arguments, Enter; poll until `this.unusedScriptSteps()` is empty, then `waitForQuiet`; `readLogLinesSince`; `this.recordTurn({ prompt, disposition, records: [], logs })`. The frozen `Then the model receives these calls:` then compares the whole call text.
3. The scenario first runs `Given pi runs with the scripted model` (creates the harness, trusts the project, warms jiti), installs through RPC, starts a new RPC session, writes the script, and only then runs the TUI `When`. The two Pi processes never call the model at the same time.
4. Give the `When` the profile start timeout (`PROFILE_PI_START_TIMEOUT_MS`, exported from `world.ts`).

The readiness text for the profiled TUI and whether `session_start` (which installs the alias autocomplete provider) has run before the first keystroke were **not** measured for a bridged alias; the plan should open the alias plan with a short spike task that records them.

### Anti-Patterns to Avoid

- **Importing `ThinkingLevel` or `InputSource` from `platform/pi-api.ts`.** Measured: one `import type { ThinkingLevel }` in `edge/` makes `fallow dead-code --fail-on-issues` exit 1 with `Stale suppressions (1) platform/pi-api.ts:77 ... (no unused-type issue found on the next line)`. `pi-api.ts` is frozen. Pass `pi.getThinkingLevel()` straight to `claudeEffort(level: string | undefined)` and compare `event.source` to string literals. The `.fallowrc.json` `dynamicallyLoaded` / `ignoreExports` entries for the six cores did **not** go stale when a core was imported (same trial) — leave them to the parent (DC-13 item 6).
- **Handling `/skill:<name>` for a non-bridged skill.** It would substitute arguments into a user's own Pi skill; leave those to Pi.
- **Writing the alias key before `rewriteMarkdownReferences`.** See Pattern 2.
- **Reading the plugin source at session start** (forbidden by the discretion clause), or changing `state.json` schema.
- **A new notification kind or reason** for the abort or the shadow warning. Both have existing channels.
- **Editing `bridges/commands/**`, `domain/name.ts`, `domain/component-paths.ts`, `index.ts`, `world.ts`, or any frozen core.**
- **Running injection on the model-invoked path** (D-CF1-03): Pi gives no hook there, and nothing in this phase may try to add one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Argument substitution | A regex `$ARGUMENTS` replace | `substituteArguments` + `parseArgumentNames` | `T2e` port with escapes, wrapping, `!` guard, 4M cap |
| `!` command expansion | `child_process` in edge/orchestrators | `expandContextInjections` + `createPromptShellRunner` | Rule pack `child-process-chokepoint` admits only five files; group kill, timeout, upstream texts |
| Shell choice / Windows Git Bash | `process.platform` checks | `selectPromptShell` + `bashMissingMessage` | Upstream `Vv()`/`jd()` port |
| Description fallback | A new first-line parser | `descriptionFallback(body, "Plugin skill")` | `A2e` port |
| Dropped-field detection | A field list in the bridge | `droppedInvocationFieldsWarning` | Frozen D-CF1-05 list |
| Frontmatter parse | `yaml` import | `parseFrontmatter` from `platform/pi-api.ts` | Byte-identical with Pi's loader (PARSE-01) |
| Frontmatter node replace | String `indexOf` | `frontmatterBlockEnd` / `keyValueEnd` (`bridges/skills/frontmatter-scan.ts`) | Multi-line scalar spans (SKILL-03 class) |
| User-visible error | `ctx.ui.notify` | `notifyUsageError` | `notify-chokepoint` rule; JSON/RPC transport |
| Command name listing | Importing `bridges/commands/discover.ts` | `readDirEntriesTolerant` + `isPlainMarkdownFile` | fallow zones forbid cross-bridge imports |
| TUI process | A new PTY driver | `PiTuiSession` + optional profile | Frozen bridge `pi-tui-pty.py`, containment checks |

**Key insight:** every hard part (tokenizer, injection, shell, fallback) already exists as a frozen, tested core; Phase 2's real work is wiring order, name bookkeeping, and proof.

## Runtime State Inventory

Phase 2 changes what the bridge writes and how names resolve, so stored state is relevant.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Staged skills already on users' disks (`<scopeRoot>/pi-claude-marketplace/resources/skills/<gen>/SKILL.md`) carry no names key and an old-rule description | Code edit: the loader must tolerate a missing key (see Open Question 1). No migration: the next install/update/reinstall/enable/apply re-stages. `state.json` unchanged (verified: `PLUGIN_INSTALL_RECORD_SCHEMA` `resources.skills` is a string array, `persistence/state-io.ts:149-160`) |
| Live service config | None — verified: no external service holds skill names | None |
| OS-registered state | None — verified: nothing registers skills with the OS | None |
| Secrets/env vars | None renamed. `CLAUDE_CODE_USE_POWERSHELL_TOOL` and `CLAUDE_CODE_GIT_BASH_PATH` are read by the frozen shell core | None |
| Build artifacts | The cucumber run's `jiti-cache` under the run root holds compiled copies of changed sources; it is keyed by content | None |

## Common Pitfalls

### Pitfall 1: The stale `unused-type` suppression in `pi-api.ts`
**What goes wrong:** `npm run fallow` fails on a frozen file.
**Why it happens:** naming `ThinkingLevel`/`InputSource` makes the two `fallow-ignore-next-line unused-type` markers at `pi-api.ts:77` and `:81` stale; fallow reports stale suppressions as issues.
**How to avoid:** do not import those types. If the planner wants them, it is a parent-applied `pi-api.ts` change (frozen file).
**Warning signs:** `Stale suppressions (1)` in `fallow dead-code`.

### Pitfall 2: Frontmatter key rewritten as a skill reference
**What goes wrong:** stored names become `/skill:...` strings; aliases silently vanish.
**Why it happens:** `rewriteMarkdownReferences` scans the whole file.
**How to avoid:** write the key last; a stage unit test with a plugin-qualified alias proves it.

### Pitfall 3: `skills/` read last
**What goes wrong:** the declared path's twin wins (E3 says the `skills/` copy wins).
**Why it happens:** `component-paths.ts` appends the conventional folder after declared paths.
**How to avoid:** front-load `"skills"` in `discover.ts`; red-proof scenario first.

### Pitfall 4: Dropped-fields line invisible on install
**What goes wrong:** the scenario sees no warning on a standalone `install`.
**Why it happens:** copying the agents bridge's `hygieneWarning` tag; standalone verbs render discovery only.
**How to avoid:** `discoveryWarning`.

### Pitfall 5: Bare aliases appear everywhere
**What goes wrong:** a bare alias such as `greet` captures `/greet` input in scenarios not about aliases, or a negative control expecting literal text gets the skill block.
**Why it happens:** upstream gives every skill with frontmatter `name` a bare alias, and the fixture writer always writes `name`.
**How to avoid:** design negative controls with names nothing claims; offer a fixture variant without `name`.

### Pitfall 6: TUI readiness never arrives
**What goes wrong:** `waitUntilReady` times out after 15 s.
**Why it happens:** with the faux model selected Pi prints no `Warning: No models available.`.
**How to avoid:** the optional `readyText`; measure it in the spike task.

### Pitfall 7: Built-in commands and bare aliases
**What goes wrong:** in RPC, or in TUI for a built-in typed with arguments it does not take (`/new x`), a bare alias equal to a Pi built-in name transforms the input.
**Why it happens:** Pi's interactive mode consumes exact built-in text before `prompt()` (`interactive-mode.js:2503-2645`), but `BUILTIN_SLASH_COMMANDS` is not exported from the package root [VERIFIED: grep of `dist/index.d.ts` and `dist/index.js` found no match], so the reserved set cannot include it.
**How to avoid:** accept and record as a residual (upstream: "unless another command already uses that name"), or hard-code the list with a comment; see Open Question 3.

### Pitfall 8: Non-owned tests break
**What goes wrong:** `npm run check` fails in files outside the ownership table.
**Why it happens:** exact staged-byte assertions (measured list in Pattern 1 and 2).
**How to avoid:** list `test/edge/register.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`, and `test/orchestrators/plugin/reinstall-flow.test.ts` in the owning plan's files; change expected values only.

### Pitfall 9: Reviewed clone markers
**What goes wrong:** `fallow dupes` fails in the combined tree on the commands side.
**Why it happens:** a marker hides only clone instances whose span contains its next line; moving skills code changes the spans.
**How to avoid:** run `npx fallow dupes` after every `stage.ts`/`discover.ts` change (ROADMAP "Reviewed clone pairs"); delete and re-place a marker only above a line the reviewed group still spans.

### Pitfall 10: Phase 3's handler sees the skill block
**What goes wrong:** `edge/command-invocation.ts` (registered after skill aliases) receives `<skill ...>` text.
**Why it happens:** handlers chain transforms.
**How to avoid:** nothing to do in Phase 2; record a SUMMARY line telling Phase 3 its handler must ignore text that does not start with `/`.

## Code Examples

### Skill-owned system-prompt Then (for D-CF2-09)

The frozen `the model call {int} receives this system prompt:` compares the whole prompt, tools included. A skill step can project only the `<available_skills>` block Pi builds [VERIFIED: core/skills.js `formatSkillsForPrompt` emits `  <skill>`, `    <name>`, `    <description>`, `    <location>` lines and filters `disableModelInvocation`]:

```typescript
// features/step_definitions/skill/listing.steps.ts (sketch; step text is the writer's)
Then(
  "the model call {int} lists these skills in its system prompt:",
  function (this: ScenarioWorld, number: number, table: DataTable) {
    const call = modelCallsOf(this.requireTurn().logs).find(({ index }) => index + 1 === number);
    if (call === undefined) {
      assert.fail(`the last turn has no model call ${number}`);
    }
    const rows = availableSkillRows(call.systemPrompt).map(([name, description, location]) => [
      name, description, projectTokens("text", location, this.tokens),
    ]);
    assert.deepStrictEqual([["name", "description", "location"], ...rows], table.raw());
    this.markTurnCompared();
  },
);
```

`availableSkillRows` must unescape Pi's XML escaping and fail on a malformed block; put it in `features/lib/skill-files.ts` only if two step modules need it (layout rule), otherwise keep it private to the step module.

### Observing an aborted invocation (no new step)

```gherkin
Scenario: A failing context command stops the skill and reports the failure
  Given pi runs with the scripted model
  ...
  Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/check/SKILL.md" with this text:
    """
    ---
    description: Checks.
    ---

    Status: !`exit 3`
    """
  ...
  When the user runs "/skill:demo-check"
  Then the result has these fields:
    | kind     | usage-error |
    | severity | error       |
    | message  | ...         |
```

The exact field names come from `envelopeFields` in the frozen command steps; `help.feature` and `usage-errors.feature` show `usage-error` rows. The message is `ContextInjectionError.message` [VERIFIED: 01-13-SUMMARY real-bash run: `Shell command failed for pattern "!\`...\`": ...`].

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| First body paragraph, headings skipped (D-86-06) | First non-blank line, heading text, 97+`...` cut, `Plugin skill` (D-CF1-04) | 2026-10-31 | Descriptions of description-less skills change on next staging |
| `/plugin:skill` alias derived from the elided generated name, interactive only | Upstream names (`Qqn`), interactive and RPC | This phase | `/acme:foo` for dir `acme-foo` stops working; `/acme:acme-foo` and frontmatter-name aliases start working |
| Raw arguments appended after Pi's block | `T2e` substitution inside the block, `!` injection | This phase | Model sees `ARGUMENTS: <args>` inside `</skill>` |
| Declared skills paths win over `skills/` on a name clash | `skills/` wins (E3) | This phase | One clash case flips |

**Deprecated/outdated:** `firstBodyParagraph` and `MISSING_DESCRIPTION_PLACEHOLDER` (remove); `skillSuffix` in `skill-alias-state.ts` (remove or keep only as the legacy fallback, Open Question 1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `${CLAUDE_EFFORT}` reads `low` in a profile Pi, because the faux model runs at thinking level `off` | Pattern 3 | A scenario literal is wrong; the red proof shows the real value |
| A2 | Upstream trims typed arguments as Pi does (`rest.trim()`) | Pattern 3 | Leading/trailing spaces differ inside `ARGUMENTS:` |
| A3 | Upstream gives an identity name precedence over another skill's frontmatter alias with the same text in one plugin | Open Question 2 | A rare same-plugin clash resolves the other way |
| A4 | A command's upstream name is `<plugin>:<basename>` with no character normalization | Pattern 4 | A command `foo.bar.md` vs skill dir `foo.bar` clash is missed or over-reported |
| A5 | The alias key name `pi-claude-marketplace` (or similar) never collides with an author key in practice | Pattern 2 | Mitigated by node replacement |
| A6 | A profiled TUI renders a stable readiness text and installs the alias autocomplete provider before input | Pattern 6 | TUI step flakes; the spike task resolves it |
| A7 | `commandId: "skill"` is an acceptable command origin for the abort payload | Pattern 3 | JSON consumers see an unfamiliar commandId; no schema break |

## Open Questions

1. **Legacy staged skills without the names key.**
   - What we know: existing installs keep working skills; only the alias table needs the key; the next update/reinstall/enable/apply re-stages.
   - What's unclear: whether to keep today's elided-suffix derivation as a fallback for unmarked files (no regression, but keeps a non-upstream name for those installs) or register only `/skill:` until the plugin is re-staged.
   - Recommendation: fall back to today's derivation for unmarked files only (it equals the upstream identity alias in the common lowercase, non-prefixed case), and list a CHANGELOG line telling users to update or reinstall for frontmatter-name aliases. Record it in DUBIOUS-CHOICES.
2. **Identity vs frontmatter alias with the same text across two skills of one plugin.**
   - Recommendation: claim all identity aliases first, then frontmatter aliases in discovery order. Not probed upstream (A3).
3. **Bare alias equal to a Pi built-in command name.**
   - Recommendation: record as a residual of D-CF2-02 (Pi does not export its built-in list); do not hard-code.
4. **Should autocomplete offer bare aliases?**
   - What we know: today's provider returns early unless the typed text contains `:` (`edge/skill-aliases.ts:37-45`); D-CF2-02 says "as today".
   - Recommendation: keep "as today" (qualified aliases only); bare aliases still work on Enter.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v24.22.1 | — |
| Pi (bundled CLI) | profile Pi, TUI | ✓ | 1.4.0 | — |
| python3 | `pi-tui-pty.py` | ✓ | 3.13.18 | — |
| bash | `!` injection scenarios | ✓ | 5.2.21 | — |
| pwsh | `shell: powershell` real run | ✗ | — | Not needed on Linux: `selectPromptShell` runs Bash unless `CLAUDE_CODE_USE_POWERSHELL_TOOL` is set; unit tests cover PowerShell |
| Claude Code binary | upstream probes | ✓ | 2.1.316 | — |
| cucumber-js | behavioral | ✓ | 13.3.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** pwsh (unit-tested only; `bash-missing` is Windows-only and also unit-tested only).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, integration) + `@cucumber/cucumber` 13.3.0 (behavioral) |
| Config file | `package.json` scripts, `cucumber.json` (frozen) |
| Quick run command | `node --test <test-path>`; `npx cucumber-js features/skill`; `npx cucumber-js --name '<title>'` |
| Full suite command | `npm run check` (static + unpaired + integration + cucumber + direct coverage all pairs) |

Run npm scripts in this sandbox with `npm_config_script_shell=<scratch>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` (the session runs as root). `npm run test:modules` took about 2 min 20 s here; `npm run test:integration` about 6 min.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKL-01 | Listed as `/skill:<plugin>-<name>` with description; `A2e` fallback (heading, 100-char cut, empty body → `Plugin skill`); `when_to_use` fold | cucumber + unit | `npx cucumber-js features/skill/listing.feature`; `node --test test/bridges/skills/stage.test.ts` | ❌ listing.feature (Wave 1); ✅ stage.test.ts (edit) |
| SKL-02 | dropped-fields line (discovery tag); `disable-model-invocation` absent from system prompt and runnable; `user-invocable: false` listed and runnable (D-CF1-09); frontmatter `name` keeps the generated name (D-CF2-01) | cucumber + unit | `npx cucumber-js features/skill/frontmatter.feature`; `node --test test/bridges/skills/stage.test.ts` | ❌ frontmatter.feature |
| SKL-03 | `<skill>` block with substituted body, `ARGUMENTS:` append, named/positional args, `${CLAUDE_SESSION_ID}` as `{uuid}`, `${CLAUDE_EFFORT}`, `` !`printf ok` `` injection, failing `!` → usage-error + handled, path vars | cucumber + unit | `npx cucumber-js features/skill/invocation.feature`; `node --test test/orchestrators/skill-invocation.test.ts test/edge/skill-aliases.test.ts` | ✅ invocation.feature (seed, edit); ❌ skill-invocation.test.ts |
| SKL-04 | `skills/clash` + `commands/clash.md`: no `/skill:demo-clash`, warning on install, `/demo:clash` sends the command body; `skills/twin` beats `extra/twin`; generated-name clash keeps D-141-04 | cucumber + unit | `npx cucumber-js features/skill/collisions.feature`; `node --test test/bridges/skills/discover.test.ts` | ❌ collisions.feature |
| SKL-05 | TUI: `/demo:fa` + Tab + `Ada` + Enter → skill block; RPC `/demo:fancy Ada`, `/fancy Ada`, `/demo:review Ada` → skill block; negative control: extension-source or unknown alias passes through | cucumber (TUI + RPC) + unit | `npx cucumber-js --name '<TUI alias title>'`; `node --test test/orchestrators/skill-alias-state.test.ts` | ❌ scenarios; ✅ alias tests (edit) |
| SKL-06 | disable/uninstall remove the skill and alias in a new session; update shows new description and body; enable restores | cucumber | `npx cucumber-js features/skill/lifecycle.feature` | ❌ lifecycle.feature |
| all | pairing + 100% direct coverage of each touched source | coverage | `npm run test:coverage:direct -- <source-or-test>` | per pair |
| all | static gates | static | `npm run check:static` (includes `check:features`, fallow) | ✅ |

**Red proofs to record before each product fix** (CONTEXT "Specific Ideas"): the RPC alias (`/demo:fancy Ada` over RPC reaches the model literally today), the frontmatter-name alias (`/demo:fancy` unknown today), the shadowed skill (`/skill:demo-clash` listed today), the `A2e` fallback (paragraph today), the `skills/`-first order (declared copy wins today), the dropped-fields line (absent today), and the substituted block (seed scenario's `\n\nAda` after `</skill>` today). Negative controls: a `disable-model-invocation` skill absent from the system-prompt rows; an extension-source input unchanged (unit); an alias nobody claims sent literally.

### Sampling Rate
- **Per task commit:** the owner test (`node --test <path>`), its direct coverage, the plan's feature file (`npx cucumber-js features/skill/<file>.feature`), `npx fallow dupes` when `stage.ts`/`discover.ts` changed. The hook runs `check:commit`.
- **Per wave merge:** `npm run check` on the merged tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/bridges/skills/skill-names.test.ts` — pair for the new names helper
- [ ] `test/orchestrators/skill-invocation.test.ts` — pair for the new invocation module (fake `readFile`, fake runner, fake host)
- [ ] `features/skill/{listing,frontmatter,collisions,lifecycle}.feature` and their step modules
- [ ] `features/lib/pi-tui.ts` optional profile (spike first)

## Security Domain

`security_enforcement` is not set to false in `.planning/config.json`, so this section applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (which input reaches the shell) | Only `interactive`/`rpc` input for bridged, Pi-loaded skills; `extension` input and model-invoked reads never reach the runner (D-CF1-03, D-CF2-05) |
| V5 Input Validation | yes | `parseFrontmatter` (read-only); `guardBangs` on argument values; JSON-quoted key emission + PARSE-02 re-parse; `assertSafeName` on directory names |
| V6 Cryptography | no | — |
| V12 Files and Resources | yes | Read only the `SKILL.md` Pi loaded from `<root>/pi-claude-marketplace/resources/skills/<gen>/` (path matched in the loader); writes stay in staging (NFR-10) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Typed argument forms a new `` !` `` command | Tampering / Elevation | Substitution before injection; `guardBangs` (T-01-22 carry-forward); injection scans once |
| Command output triggers a second command | Tampering | `expandContextInjections` never rescans output (T-01-22) |
| Injection failure text leaks to the model | Information disclosure | Abort returns `handled`; error only through `notifyUsageError` (T-01-24 carry-forward) |
| Author `name` value injects a YAML key into the staged frontmatter | Tampering | Emit the key as a JSON value on one line; replace an existing node; PARSE-02 backstop |
| RPC client now triggers plugin shell commands | Elevation | Same trust as interactive input and as upstream print mode (E4); a plugin is installed by the user; record under D-CF2-05 |
| Alias hijacks a real command | Spoofing | Reserved set of non-skill Pi commands checked before the alias (SK-6); command shadows skill at install (D-CF2-03) |

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `bridges/skills/{discover,stage,frontmatter-degrade,rewrite-frontmatter,types,index}.ts`, `edge/skill-aliases.ts`, `orchestrators/skill-alias-state.ts`, `edge/command-invocation.ts`, `index.ts:236-269`, the six Phase 1 cores, `domain/component-paths.ts`, `domain/skill-tokens.ts`, `domain/name.ts`, `shared/{notification-dispatch,notification-run,notification-wire,staging-warnings,vars}.ts`, `persistence/state-io.ts`, `platform/pi-api.ts`, `.fallowrc.json`, `features/{support/world.ts,lib/pi-tui.ts,lib/skill-files.ts,lib/scripted-model/*,step_definitions/{model,session,command}.steps.ts}`, `test/e2e/_rpc.ts`.
- Pi 1.4.0 dist: `core/agent-session.js` (1590-1767, 2742-2762), `core/extensions/runner.js` (1201-1236), `core/extensions/types.d.ts` (908-925, 1300), `core/skills.js` (60-300), `core/source-info.js`, `core/session-manager.{js,d.ts}`, `core/slash-commands.js`, `modes/interactive/interactive-mode.js` (2499-2645).
- Claude Code 2.1.316 binary: `Xqn`, `Qqn`, `SAt`, `RI=256`.
- Measurements this session: fallow stale-suppression trial; `test:modules` with the `descriptionFallback` swap (2 failures) and with a frontmatter key (19 failures); `test:integration` with the key (pass); TUI spike with the scripted model.

### Secondary (MEDIUM confidence)
- `02-CONTEXT.md` upstream evidence E1-E6 (probes by the discuss step, not re-run).
- `01-RESEARCH.md:212` (empty-arguments `""`), `01-13-SUMMARY.md` (composition, real-bash run), `01-SECURITY.md` carry-forward.

### Tertiary (LOW confidence)
- None beyond the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; core signatures read.
- Architecture: HIGH for product seams (read and trial-measured); MEDIUM for the TUI step (spike, not wired).
- Pitfalls: HIGH — four of ten measured, the rest read in source.

**Research date:** 2026-11-01
**Valid until:** 2026-12-01 (Pi peer pinned at 1.4.0 in the lockfile; re-check on a Pi bump)
