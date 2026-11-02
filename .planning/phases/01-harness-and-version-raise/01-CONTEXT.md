# Phase 1: Harness and Version Raise - Context

**Gathered:** 2026-10-31
**Status:** Ready for planning
**Mode:** autonomous (decisions made from upstream evidence, no user prompts).
The user asked for no interruptions: every dubious choice below is also listed
in `.planning/DUBIOUS-CHOICES.md` for later review.

<domain>
## Phase Boundary

Phase 1 is the milestone's only prerequisite. It delivers four things, so that
each component phase (2-7) can write its scenarios by adding only its own
files:

1. **Version raise (VER-01..VER-06):** Pi 1.4.0 and its three companions at
   their latest releases, the declared floors raised, the pi-mcp-adapter 7.x
   escape fix, and the docs that name versions.
2. **Harness (HAR-01..HAR-08, CI-01):** the profile Pi, the scripted model,
   the registry probe, the hook recorder, the MCP stub, the companion
   resolver, the model-turn `When`, hermetic resets, the trust setup, the six
   function directories with one seed scenario each, the cucumber skill rules,
   and the CI shards.
3. **Pre-fan-out decisions (DEC-01, DEC-02)** recorded with IDs, below.
4. **Shared product cores that the decisions need** (new in this discussion;
   D-CF1-01, -02, -04, -05, -06). What two or more component phases must
   implement identically is built once here, as pure tested code that the
   component phases only wire, so the parallel sessions cannot diverge.

**Out of scope:** wiring the invocation core into skills (Phase 2) and commands
(Phase 3); every FG item a component phase owns (FG-07..FG-09, FG-11..FG-13,
FG-15..FG-28, FG-30..FG-32); behavior that needs a real model (RM-01..RM-05).

</domain>

<upstream_evidence>
## Upstream evidence (Claude Code 2.1.316)

Binary `/opt/claude-code/bin/claude` (`claude --version`: `2.1.316 (Claude
Code)`), grepped 2026-10-31 with `grep -a -o`. Minified names are quoted so a
researcher can find them again. Confidence is **high** for literal code below
and **medium** where a helper name collides across bundle chunks (noted).
Facts marked *(research)* come from `.planning/research/FEATURES.md` and were
not re-checked in this discussion.

- **E1. Argument substitution, `T2e(body, args, append=true, names=[],
  valueTransform, bodyTransform)`.** If `args` is `undefined` or `null`, the
  body is returned unchanged. Otherwise:
  1. `bodyTransform` runs first (plugin variables; substituted values are
     wrapped so later passes never re-read them).
  2. `\$` (not preceded by `\`) before a digit, `ARGUMENTS`, or a declared
     name becomes a literal `$`.
  3. Named `$name` placeholders (from frontmatter `arguments` via `Rhe`:
     array, or whitespace-split string; entries that are empty or all digits
     are skipped; names of at most 64 chars, at most 64 names, longest first)
     become argument `i`; a missing one becomes the empty string.
  4. `$ARGUMENTS[N]` becomes argument `N`; a missing index stays literal.
  5. `$N` (regex `/\$(\d+)(?!\w)/`) becomes argument `N`; a missing index
     stays literal.
  6. `$ARGUMENTS` becomes the raw argument text.
  7. If nothing was substituted, `append` is true, and the argument text is
     non-empty, `\n\nARGUMENTS: <args>` is appended.
  Arguments are indexed by `G=(i)=>(L??=c$o(args))[i]`: **0-based**, so `$0`
  is the first argument. `c$o` tokenizes with `Ck` (a shell parser,
  `S_().parse`, medium confidence on its exact grammar) and falls back to
  whitespace splitting. The total size is capped at 4,000,000 characters with
  the error "This skill, command or hook and the arguments filled into it add
  up to more than 4,000,000 characters...". Plugin commands and skills call
  `T2e(body, args, true, argumentNames, valueTransform, bodyTransform)`.
  Upstream has no `${N:-x}`, `$@`, or `${@:N}` forms; they stay literal.
- **E2. Dynamic context injection, `HRe`.** After `T2e`, unless `Ahe()` (Cowork,
  or `disableSkillShellExecution` in policy or user settings, which
  neutralizes the patterns), each `` !`cmd` `` and fenced ```` ```! ```` block
  is checked with the Bash tool's permission check. `allow` runs it through
  the Bash tool and replaces the pattern with the output; any other verdict
  throws "Shell command permission check failed for pattern ...". A failing
  command throws "Shell command failed for pattern ...: <output>" (`MRr`), and
  an interrupt throws "Shell command interrupted for pattern ...". `shell:
  bash` (needs bash) and `shell: powershell` select the shell.
- **E3. Description fallback, `A2e(body, "Plugin skill" | "Plugin command")`.**
  The first non-blank line, trimmed; a line matching `/^#+\s+(\S.*)$/` gives
  its text; longer than 100 chars gives the first 97 plus `...`; no non-blank
  line gives the label.
- **E4. Component directories.** The plugin loader sets the default
  `commands/` path only when the manifest declares no `commands`
  (`Et=!Se.commands&&Me`), and the same for `agents`, `workflows`,
  `outputStyles` and `themes`; `skills/` is always read (`gt=ze`) and declared
  `skills` paths add to it. A declared field over an existing default folder
  records `{type:"folder-shadowed-by-manifest", component, folderPath,
  manifestFields}`.
- **E5. Session hook values** *(research)*: SessionStart `source` is
  `startup|resume|clear|compact|fork`; SessionEnd `reason` is
  `clear|resume|logout|prompt_input_exit|other`.
- **E6. `user-invocable`** *(spike 028)*: a `false` skill is hidden from `/`
  and refused on `/name`; the model can still invoke it.
- **E7. MCP `${VAR:-default}`** *(research, docs)*: Claude Code expands it when
  it starts the server (connect time).

Pi facts (installed `@earendil-works/pi-coding-agent` 1.3.0, research says
1.4.0 is byte-identical here): `prompt()` runs extension `input` handlers for
every source, before `_expandSkillCommand` and `expandPromptTemplate`, and a
handler may return `{action:"transform", text}`. The skill block is
`<skill name="<name>" location="<file>">\nReferences are relative to
<baseDir>.\n\n<body>\n</skill>`, followed by `\n\n<args>` when arguments were
typed. `substituteArgs` is 1-based, supports `${N:-d}`, `$@`, `${@:N[:L]}`,
re-joins parsed arguments with spaces, and has no escape. Project trust order:
`--approve`/`--no-approve`, then "no trust-requiring project resources", then
an extension `project_trust` handler, then the persisted trust store, then
`defaultProjectTrust`, then (headless) untrusted.

</upstream_evidence>

<decisions>
## Implementation Decisions

### Pre-fan-out: invocation content of skills and commands (DEC-01)

- **D-CF1-01 (argument substitution; FG-01, FG-02, FG-03, FG-04):** When a
  user invokes a bridged command (`/<plugin>:<cmd> <args>`) or a bridged skill
  (`/skill:<name> <args>`, or its `/<plugin>:<skill>` alias), the content the
  model receives follows E1 exactly: 0-based `$N` and `$ARGUMENTS[N]` with a
  missing index left literal, `$ARGUMENTS` as the raw text, named `$name` from
  frontmatter `arguments`, the `\$` escape, the `ARGUMENTS:` append, no
  re-substitution of values, Pi-only forms left literal, the size cap, and
  `${CLAUDE_SESSION_ID}` (the Pi session id) and `${CLAUDE_EFFORT}` replaced
  at invocation. **Mechanism:** one pure port of `T2e`, built and unit-tested
  in Phase 1, called from Pi's `input` event at invocation time. No
  install-time placeholder rewriting. Phase 2 wires it for skills in
  `edge/skill-aliases.ts`, producing Pi's own `<skill>` block with the
  substituted body and no raw arguments after the block. Phase 3 wires it for
  commands in a command input handler that Phase 1 creates as a pass-through
  seed, producing the substituted body as Pi's template expansion would.
  Residual difference licensed by the Pi gap and recorded under this ID:
  whatever the port's tokenizer cannot reproduce of upstream's shell parser
  (it must match quoting and backslash escapes).
- **D-CF1-02 (dynamic context injection; FG-05):** Implement it. In
  user-invoked bridged commands and skills, each `` !`cmd` `` and ```` ```! ````
  block runs after argument substitution, before the content reaches the
  model, and its output replaces the pattern (E2). A failing command aborts
  the invocation with upstream's message shape, reported through the notify
  chokepoint, and nothing reaches the model. `shell: bash` (default) and
  `shell: powershell` select the shell. Pi has no permission modes, so the
  bridge behaves like Claude Code's `bypassPermissions` mode for these
  commands: each runs, and `allowed-tools` does not gate it (Pi-gap license,
  recorded under this ID). **Mechanism:** the parser and splicer are part of
  the Phase 1 invocation core; the process spawn lives in one new `platform/`
  module added to the `child-process-chokepoint` exemptions in
  `rule-packs/architecture.json`. The plan carries a threat model: the
  commands come from the installed plugin, the same trust as its hooks, and
  arguments flow into them as upstream.
- **D-CF1-03 (model-invoked skills; Pi gap):** When the model uses a skill on
  its own, Pi lists it in the system prompt and the model reads `SKILL.md`
  itself; no extension hook sits on that path. D-CF1-01 and D-CF1-02 therefore
  apply only to user-invoked skills and commands. Licensed by the Pi
  capability gap.
- **D-CF1-04 (description fallback; FG-06):** A skill or command with no
  frontmatter `description` gets E3 (`A2e`). Skills: replaces the
  first-paragraph fallback; supersedes D-86-06 (SKILL-02), which followed older
  upstream docs. Commands: the bridge writes the computed `description` into
  the staged frontmatter at install, so Pi's 60-character fallback never
  applies. One pure port in Phase 1; Phases 2 and 3 wire it.
- **D-CF1-05 (unhonored frontmatter fields; FG-10):** One divergence ID,
  licensed by the Pi gap (Pi reads only `name`, `description`,
  `argument-hint`, and `disable-model-invocation`): `disallowed-tools`,
  `model`, `effort`, `agent`, `context`, `background`, `hooks`, and `paths`
  have no effect on bridged skills and commands. Install reports them as the
  agents bridge does, with one `[<source>] dropped fields: <fields>` warning
  per component in the bridge's discovery warnings. Not reported:
  `allowed-tools` (it only grants tools, and Pi runs every tool without
  asking), `arguments` and `shell` (honored by D-CF1-01 and D-CF1-02), and
  `user-invocable` (its own divergence, D-CF1-09, kept as it is by the user).
  The field table lives in the Phase 1 core, so both phases report the same
  fields.

### Pre-fan-out: plugin layout and harness trust (DEC-01)

- **D-CF1-06 (component directories; FG-14):** Follow E4. A declared
  `commands`, `agents`, or `workflows` path (marketplace entry or plugin
  manifest) replaces the conventional folder; a declared `skills` path adds to
  `skills/`. When a declaration leaves an existing conventional folder unread,
  install warns, as upstream records `folder-shadowed-by-manifest`. Supersedes
  D-07 (COMP-01) and D-24 for commands, agents, and workflows; skills keep the
  union. D-24 adopted the union "vs upstream Claude Code behavior" as
  documented in 2026-05, and upstream has since changed, so this keeps D-24's
  intent. The PROJECT.md Out of Scope bullet ("Custom component-path arrays as
  supplemental -- explicit declaration replaces the default") is rewritten to
  state the per-kind rule (DEC-02). Implemented once in Phase 1
  (`domain/component-paths.ts` strict arm and the lenient mirror
  `deriveLenientComponentPaths` in `orchestrators/plugin/info.ts`), with a
  scenario that fails without it, and with every existing test and scenario
  that pins the union for those three kinds updated. Phases 3, 4, and 7 pin
  their own kind.
- **D-CF1-07 (project trust in the harness; FG-29 setup, Pitfall 7):** The
  profile Pi trusts its sandbox project by default through a persisted
  trust-store entry: the record Pi saves when a user answers its trust prompt.
  Not `--approve`, not `defaultProjectTrust`. A `Given` starts a profile Pi on
  an untrusted project (no entry), and Phase 1 seeds one untrusted scenario
  beside a trusted one (HAR-06). Project MCP server approval is not part of
  the default: a separate `Given` sets pi-mcp-adapter's user-global
  `projectServers: "allow"`, so Phase 6 can settle FG-29 either way.
- **D-CF1-08 (function directory names):** `features/skill/`,
  `features/slash-command/` (`command` already names `command.steps.ts`),
  `features/agent/`, `features/hook/`, `features/mcp-server/` (not `mcp`),
  `features/workflow/`. A parameter type a phase adds is prefixed with its
  kind.

### The 2026-10-31 decisions (DEC-02, FG-33)

These are the user's decisions from spike 028; this discussion only assigns
IDs.

- **D-CF1-09 (`user-invocable: false`):** Keep today's behavior (listed and
  runnable) as a divergence licensed by the Pi gap: Pi has no per-skill way to
  hide a slash command. Report the gap to Pi. Phase 3 extends the ID to
  commands (FG-12).
- **D-CF1-10 (`new` sent as `clear`):** SessionStart `source` and SessionEnd
  `reason` send `clear` for Pi `new`, and `clear` matchers are admitted.
  Supersedes those parts of D-58-06 and D-60-04.
- **D-CF1-11 (`compact` on compaction):** SessionStart fires with
  `source: "compact"` on Pi's `session_compact`, and `compact` matchers are
  admitted. Supersedes that part of D-58-06.
- **D-CF1-12 (`fork` matchers):** `fork` matchers are admitted; Pi sends the
  same value.

Phase 5 implements D-CF1-10..12. Phase 1 widens the Pi event and API types
they need in `platform/pi-api.ts`.

### Phase 1's own decisions

- **D-CF1-13 (`${NAME:-default}` under pi-mcp-adapter 7.x; VER-05):** Leave
  `${NAME:-default}` in `command`, `args`, `env`, `url`, and `headers` to the
  adapter, which expands it at connect time, as Claude Code does (E7).
  Deny-listed names keep their install-time decision (AVAR-05). Literal text,
  including a literal `${NAME:-x}` the bridge writes (such as an `oauth`
  value), is escaped so it reaches the server unchanged (VER-04). Precondition:
  the conformance property shows that adapter 7.x expands `:-` as Claude's rule
  (`domain/claude-mcp-variables.ts`) does for unset, empty, and set values. If
  any case differs, keep today's install-time resolution of `:-` and record the
  difference under this ID.
- **D-CF1-14 (new adapter entry keys; VER-05):** `appendStructuredContent` and
  `roots` join `CARRIED_FIELDS`. They are user choices with no Claude field, so
  a user's value survives update and reinstall, as AFILE-06 does for the other
  user keys.
- **D-CF1-15 (profile Pi shape):** One profile Pi per scenario that asks for
  one (measured 1.6-1.7 s warm), stopped with its process group in the
  scenario's reset. No pooling unless the CI measurement in the phase gate
  requires it.
- **D-CF1-16 (CI shape; CI-01):** The `behavioral` job installs the companions
  (`scripts/install-test-peers.mjs`) and runs as a path-sharded matrix:
  lifecycle (`features/{marketplace,plugin}/**`) and components (the six
  function directories). Each shard's timeout is at least 1.5 times its
  measured run and never below 15 minutes. Companion scenarios are not
  serialized unless the measurement shows interference.
- **D-CF1-17 (harness mechanics):** The hook recorder and the MCP stub are
  `.ts` files under `features/lib/` (never `features/support/`, which cucumber
  imports into every worker). The scripted model reads its script from a file
  in the scenario sandbox and derives its step index from its own call log,
  so a child agent's Pi reads the same script, and the script, counter, and
  log reset with the sandbox. There is no fallback reply: a turn past the
  script fails, and steps left unused fail the scenario.

### Claude's Discretion

- Module names and layer placement of the cores (pure logic in `domain/` or
  `shared/`, the spawn in `platform/`), the plan split, and wave placement,
  within the file-ownership rules below.
- Warning wording for D-CF1-05 and D-CF1-06, in the style of the existing
  staging warnings.
- The `${CLAUDE_EFFORT}` value for each Pi thinking level, once research pins
  upstream's values; a level with no counterpart is recorded under D-CF1-01.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `edge/skill-aliases.ts`: an `input` handler that already returns
  `{action:"transform"}` (interactive-only today, owned by Phase 2 after this
  phase).
- `bridges/agents/convert.ts` (`droppedFieldWarnings`,
  `GUIDED_DROPPED_FIELDS`) and `bridges/agents/stage.ts:275`: the
  `[<source>] dropped fields:` pattern D-CF1-05 copies.
- `bridges/skills/frontmatter-degrade.ts::firstBodyParagraph`: the D-86-06
  fallback D-CF1-04 replaces (Phase 2 wires the replacement).
- `domain/component-paths.ts::collectStrictComponentKind` and
  `orchestrators/plugin/info.ts::deriveLenientComponentPaths`: the union
  D-CF1-06 changes.
- `bridges/mcp/adapter-escape.ts` (`TRIGGER`, `serializeSegments`),
  `bridges/mcp/substitute.ts`, `domain/claude-mcp-variables.ts`: the 7.x
  escape fix and the `:-` delegation (D-CF1-13).
- `shared/session-env.ts`: the session id behind `${CLAUDE_SESSION_ID}`.
- `bridges/hooks/dispatch-exec.ts`, `platform/package-manager.ts`: sanctioned
  spawn sites, the pattern for the D-CF1-02 spawn module.
- `.planning/spikes/028-model-free-harness/`: working prototypes of the faux
  extension, probe, stub server, and driver.

### Established Patterns

- Rule-pack chokepoints: a new `child_process` site must join
  `child-process-chokepoint` in `rule-packs/architecture.json`.
- Seed and hand over: Phase 1 creates each kind's directory, fixture writer,
  and first step module with one seed scenario, then the kind's phase owns
  them.
- Discovery warnings flow through the bridges' `warnings` arrays into the
  install notification.

### Integration Points

- `extensions/pi-claude-marketplace/index.ts`: input-handler registrations.
- `test/e2e/_rpc.ts` (`startRpcPi`): extra extensions, typed extra env,
  `TMPDIR`.
- `features/support/world.ts`: profile Pi, `lastTurn`, the uncompared-turn
  marker.

</code_context>

<specifics>
## Specific Ideas

- **Two plans beyond the roadmap's nine** (the planner may split or merge):
  an invocation core plan (D-CF1-01, -02, -04, -05: the pure ports, the field
  table, the spawn module, and the rule-pack entry) and a component-directory
  plan (D-CF1-06). Both are file-disjoint from 01-01..01-09; the core has no
  harness dependency and fits wave 1.
- **No component phase edits `index.ts`.** Phase 1 creates
  `edge/command-invocation.ts` as a unit-tested pass-through registered in
  `index.ts` and hands it to Phase 3. Phase 1 also checks whether any other
  component phase needs an `index.ts` registration (for example Phase 5 and
  `session_compact`) and adds it now.
- **The cores are frozen after Phase 1.** A component phase that needs a core
  change reports it to the parent session instead of editing the core; the
  parent applies it on the milestone branch, so both phases merge one fix.
- **Roadmap ownership additions:** Phase 3 also owns
  `edge/command-invocation.ts`. Phase 1 may edit the docs that describe the
  D-CF1-06 change (for example `docs/workflows-compatibility.md`) before it
  hands them to their phases.
- **Research questions for this phase:** the grammar of upstream's argument
  tokenizer (`Ck`, `S_().parse`) and how close the port can come; what the
  `valueTransform` and `bodyTransform` that plugin commands pass to `T2e` do;
  upstream's `${CLAUDE_EFFORT}` values; the `!` output format (`qTn(stdout,
  stderr)`) and error texts; whether upstream passes `undefined` or `""` for
  `/cmd` with no arguments; adapter 7.x `:-` semantics against Claude's rule
  (D-CF1-13); the Pi trust-store file, and whether pi-subagents and
  pi-mcp-adapter read Pi's trust; the nested `mcp` proxy double fire; whether
  a pi-subagents background child loads an `--extension`; the CI timing.

</specifics>

<deferred>
## Deferred Ideas

- A Pi-side switch equivalent to `disableSkillShellExecution` for D-CF1-02.
- Refusing a typed `/skill:name` for a `user-invocable: false` skill in the
  invocation handler: cheap once D-CF1-01 is wired, but the user chose to keep
  today's behavior on 2026-10-31 (D-CF1-09).
- Arguments and injection for model-invoked skills (D-CF1-03): needs a Pi
  hook on the model's skill path; report it to Pi with the user-invocable gap.
- Gating `!` commands with `allowed-tools`, if Pi gains a permission system.
- Pooling profile Pis per worker, only if CI time requires it (D-CF1-15).

</deferred>
