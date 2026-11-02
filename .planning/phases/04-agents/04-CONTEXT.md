# Phase 4: Agents - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning
**Mode:** autonomous (smart discuss in a child session; decisions made from
upstream evidence, no user prompts). The user's standing instruction for this
run: "make decisions as you see fit, but when in doubt research how claude code
upstream operates, and try to maintain compatibility unless we need to deviate
for reasons specific to the implementation of this project." Every decision
below marked **settled autonomously** was taken without the user, and each one
has an entry in `04-DUBIOUS-CHOICES.md` (`P4-DC-NN`).

<domain>
## Phase Boundary

Phase 4 makes a bridged agent look to pi-subagents 0.84 the way Claude Code
2.1.316 defines a plugin agent, and proves it with cucumber scenarios under
`features/agent/` that observe only what Pi and pi-subagents report: the
`subagent` tool's `{action:"list"}` result, a child run's recorded system
prompt and first user message in the scripted model's call log, and install
notifications.

1. **Listing (AGT-01):** `<plugin>:<name>` with its alias and description,
   nested files (FG-15, D-CF4-01), the description fallback (D-CF4-03), and
   same-name agents in two plugins (A15, D-CF4-02).
2. **Runs (AGT-02):** a foreground child with the agent body as its system
   prompt, tools and model by the conversion rules, with and without
   `--map-model` (FG-18, D-CF4-07).
3. **Frontmatter (AGT-03):** `tools`, `disallowedTools`, `model`, `effort`,
   skill preloads (FG-16), and the FG-17 fields (D-CF4-05, D-CF4-06, D-CF4-08).
4. **Skill preload (XK-01):** the preloaded plugin skill's content reaches the
   child (D-CF4-04), built from Phase 1 stand-ins and the frozen
   `features/lib/skill-files.ts` exports only.
5. **Background runs (AGT-04):** proved, or the gap recorded (D-CF4-10).
6. **Companion missing (AGT-05)** and **project trust (AGT-06, D-CF4-09)**.
7. **Lifecycle (AGT-07):** disable, uninstall, update, enable (D-CF4-12).

**Out of scope:** MCP grants to agents (MCP-07, Phase 6; see D-CF4-08's
deferred `excludeTools` finding), hooks on agents (`SubagentStart`/`Stop`,
recorded deferral), a model choosing an agent on its own (RM-01), workflows
calling `agent()` (RM, Phase 7), the frozen Phase 1 files, `.fallowrc.json`.

</domain>

<upstream_evidence>
## Upstream evidence (Claude Code 2.1.316) and pi-subagents 0.84.0

Full records, with binary byte offsets and code citations, are kept beside this
file: `04-UPSTREAM-AGENTS.md` (binary `/opt/claude-code/bin/claude`, 2.1.316,
grepped and probed 2026-11-01, offline, local stub API, no credential, no LLM)
and `04-PI-SUBAGENTS.md` (source under
`node_modules/.cache/optional-peers/node_modules/pi-subagents/src`, read and
exercised by calling its functions on `convertAgent` output, 2026-11-01).

Key facts (upstream = U, pi-subagents = P):

- **U naming:** `agents/` is scanned recursively (32 levels); each subfolder is
  a name segment: `agents/review/security.md` is `<plugin>:review:security`.
  Frontmatter `name` replaces only the last segment. Symlinks inside the
  scanned folder are skipped; dotfiles load; the `.md` check ignores case. A
  file declared in plugin.json loads without subfolder segments. High.
- **U priority:** built-in < plugin < user < project < `--agents` < managed;
  user and project names cannot contain `:`, so a plugin agent never collides
  with them; two plugins each shipping `x` give `p1:x` and `p2:x`. High.
- **U description missing:** a plugin agent gets `Agent from <plugin> plugin`
  (after `when_to_use`/`when-to-use`). High.
- **U skills preload:** looked up as name, alias, or folder name, then as
  `<agent's plugin>:<entry>`, then as the first skill ending in `:<entry>`
  (cross-plugin). Only model-invocable skills qualify: a
  `disable-model-invocation: true` skill, and a plugin skill with no
  description, are skipped (debug log only). The content goes into the first
  user message after the task, as a command-message block, then `Base
  directory for this skill: <dir>`, then the SKILL.md body with frontmatter
  removed and variables substituted. High.
- **U fields:** `background: true` forces a background run; the default is
  foreground. `memory` is `user|project|local` and adds a memory section and
  Read/Write/Edit. `effort` accepts `low, medium, high, xhigh, max`, `med`, or
  an integer. Ignored for plugin agents with a warning: `permissionMode, hooks,
  mcpServers, initialPrompt, observer, observerMessage, observeSubagents`. High.
- **U model:** aliases `sonnet, opus, haiku, fable, best, opusplan` (and
  `[1m]` forms, case-insensitive), `inherit`, or any full ID passed through;
  omitted means inherit. First-party: opus `claude-opus-5-5`, sonnet
  `claude-sonnet-5-5`, haiku `claude-haiku-5-5`, fable and best
  `claude-fable-5-1`. Medium (account-dependent).
- **U tools:** split on commas and spaces outside parentheses; `*` or omitted
  means all; `disallowedTools` applies even beside `tools`; all entries
  unresolved refuses the spawn. High.
- **U trust:** project agents and plugin agents load and run in untrusted
  folders; only frontmatter `hooks`/inline `mcpServers` of project agents wait
  for trust; plugin agents count as trusted. High for `-p`, medium for
  interactive.
- **U advertising:** available agent types (plugin agents included) are listed
  to the model (`Available agent types for the Agent tool:`, binary offset
  151868376). High.
- **P discovery:** recursive; merged by frontmatter `name`; builtin < package <
  user < project; re-reads files on every list and run (no `/reload` needed
  for the file to show).
- **P list:** `Executable agents:` sections; each line
  `- <name> (<source>[, aliases: a]): <description>`; 13 builtins unless
  `subagents.disableBuiltins`. The list ignores project trust
  (`extension/index.js:511`); runs follow it (default scope `both` becomes
  `user`, so an untrusted project agent run is `Unknown agent: ...`).
- **P skills:** an agent's `skills` puts an `<available_skills>` block (name,
  description, path) in the child prompt and tells it to `read` the file; the
  body is not inlined; a `disable-model-invocation` skill is silently left out.
- **P async:** `async: true` spawns a detached runner that loads no
  `--extension` (the scripted model is unreachable there); results return by a
  `subagent-notify` message that starts a new parent turn; parent and child
  model calls are unordered. `asyncByDefault` is true; a frontmatter `async`
  sets the default when the call omits it.
- **P model:** resolved against Pi's registry; `sonnet` fails ("Unknown
  subagent model"); omitted means the parent session's model.
- **P thinking:** `off, minimal, low, medium, high, xhigh, max`.
- **P excludeTools:** applied beside an explicit `tools` list since 0.62.0
  (`runs/shared/child-tool-plan.js:214-216, 245`), contrary to the comment in
  `convert.ts:389-409`.
- **P advertise:** a boolean field; `advertise: true` agents go into the
  parent system prompt catalog (max 16 agents, 12,288 bytes), rebuilt at
  `session_start`.

</upstream_evidence>

<decisions>
## Implementation Decisions

### Names and listing (FG-15, A15, AGT-01)

- **D-CF4-01 (nested agent files; FG-15; settled autonomously):** Follow
  upstream. The agents bridge scans each agents directory recursively (depth
  limit 32, symlinked entries skipped, dot-folders and dotfiles included,
  `.md` matched case-insensitively). A file at `agents/review/security.md`
  declares `<plugin>:review:security`; frontmatter `name` replaces only the
  last segment. The on-disk file and alias join the segments with `-`
  (`pi-claude-marketplace-<plugin>-review-security`), so the existing AG-12
  first-wins duplicate warning also covers a nested name that flattens onto a
  flat one. Names keep passing `assertSafeName` per segment (project license:
  names reach the filesystem). A file named directly by a declared `agents`
  path keeps its bare name, as upstream. A declared folder path (upstream
  fails the whole plugin) keeps today's behavior and is recorded as a residual.
- **D-CF4-02 (same-name priority; A15; settled autonomously):** Pin upstream's
  observable rule: two plugins each shipping agent `x` list as `p1:x` and
  `p2:x`, both runnable. A user's own pi-subagents agent whose name contains
  `:` and equals a bridged name is not modeled (pi-subagents allows `:` in
  user names, upstream does not; Pi gap) and is recorded as a residual.
- **D-CF4-03 (description fallback; settled autonomously):** A plugin agent
  with no description gets upstream's text, `Agent from <plugin> plugin`,
  with `when_to_use`/`when-to-use` used first when present. The install
  warning stays (AG-7 records it).
- **D-CF4-13 (listing observation):** AGT-01 and AGT-07 observe the
  `subagent {action:"list"}` tool result in the model call log, compared
  whole. Scenarios may write `subagents.disableBuiltins: true` into the
  sandbox's Pi settings through an agent-owned `Given` so the expected list
  holds only bridged agents; one scenario keeps the builtins as a control.
- **D-CF4-14 (advertise; settled autonomously):** Emit `advertise: true` on
  every bridged agent, so the parent model sees bridged agents as Claude Code
  shows plugin agents to its model. A parent line warns the parent to
  re-verify sibling scenarios that compare a parent system prompt with
  pi-subagents loaded.

### Conversion (FG-16, FG-17, FG-18, AGT-02, AGT-03)

- **D-CF4-04 (skill preload content; FG-16, XK-01; Pi gap; settled
  autonomously):** pi-subagents passes only a skill's name and path to the
  child, so the child gets no skill content without a model action. The
  bridge therefore writes each resolved preloaded skill's content into the
  generated agent, after the converted body, in upstream's form: `Base
  directory for this skill: <the staged skill dir>` followed by the SKILL.md
  body with frontmatter removed and plugin variables substituted. Placement
  differs (system prompt, not upstream's first user message): Pi gap,
  pi-subagents offers no hook on the child's first message. A skill that is
  not model-invocable (`disable-model-invocation: true`, or no description)
  is skipped with an install warning (upstream skips it with a debug log;
  the warning follows D-CF1-05's unhonored-field style). The `skills:` entry
  for an inlined skill is not emitted, so the child does not see it twice.
  Cross-plugin fallback (`first skill ending in :<entry>`) is not modeled:
  today's foreign-reference drop stays (residual).
- **D-CF4-05 (FG-17 fields; settled autonomously):** `background: true` emits
  `async: true`; any other agent emits `async: false`, matching upstream's
  foreground default (pi-subagents defaults to async). Exception: an agent
  whose tools carry an `mcp:` entry keeps today's output (no `async` field,
  the MCP async warning), so Phase 6's MCP-07 is unaffected. Upstream's
  "background forces background even when the call asks foreground" is a
  residual (pi-subagents lets the call override). `initialPrompt`,
  `observer`, `observerMessage`, `observeSubagents` join the guided dropped
  fields ("Claude Code ignores it for plugin agents too"). `memory`,
  `maxTurns`, `isolation`, `color`, `omitClaudeMd`, `autoCompactWindow`,
  `experimental` stay dropped with the generic warning, recorded under this
  ID (pi-subagents' `memory` needs a path and has no `local` scope;
  `maxTurns` has no pi-subagents field; the rest have no Pi meaning).
  `when_to_use`/`when-to-use` are consumed by D-CF4-03, not dropped.
- **D-CF4-06 (effort; settled autonomously):** `THINKING_VALUES` gains `max`;
  `med` maps to `medium`; an integer effort is dropped with the existing
  unknown-effort warning (pi-subagents takes levels only).
- **D-CF4-07 (model; FG-18; settled autonomously):** Without `--map-model`,
  `model:` stays omitted (AG-7, the child inherits; upstream's alias would
  differ only when it names another family). With `--map-model`: `sonnet`
  `anthropic/claude-sonnet-5-5`, `opus` and `opusplan`
  `anthropic/claude-opus-5-5`, `haiku` `anthropic/claude-haiku-5-5`, `fable`
  and `best` `anthropic/claude-fable-5-1`, matched case-insensitively with a
  `[1m]` suffix stripped; a full `claude-*` ID passes through as
  `anthropic/<id>`; `inherit` omits. Anything else stays the unknown-model
  warning.
- **D-CF4-08 (tools; settled autonomously):** `tools` and `disallowedTools`
  split on commas and whitespace outside parentheses; `*` means the same as
  an omitted `tools`. AG-11 (an explicit list that maps to nothing refuses
  the install) stays. Finding deferred to Phase 6 and the parent:
  pi-subagents applies `excludeTools` beside `tools`, so the ANAME-02
  "cannot narrow" warning is stale; changing it touches MCP-07's surface, so
  Phase 4 only fixes the comment and records a parent line.

### Background, companion, trust, lifecycle (AGT-04..AGT-07)

- **D-CF4-10 (background runs; AGT-04; settled autonomously):** The planner's
  research spends one bounded task on proving an `async: true` run without
  editing frozen files (for example loading the scripted model into the
  child through `subagents.defaultSubagentOnlyExtensions` and avoiding the
  parent/child call race). If no deterministic scenario results, the gap is
  recorded under this ID with the measured cause (the detached runner loads
  no `--extension`; parent and child model calls are unordered against one
  shared script), and AGT-04 is satisfied by the recorded gap, as the
  requirement allows.
- **D-CF4-11 (companion missing; AGT-05):** Pin today's behavior:
  `{requires pi-subagents}` at install, and loading pi-subagents then
  `/reload` lists the agents with no reinstall. Only the pi-subagents arm of
  `shared/concerns/soft-dep.ts` may change.
- **D-CF4-09 (project trust; AGT-06; Pi gap; settled autonomously):** Upstream
  runs plugin agents in untrusted folders; pi-subagents treats the bridge's
  project-scope files (`<cwd>/.pi/agents/`) as project agents and refuses to
  run them without Pi's trust. The bridge cannot bypass that without writing
  project agents to the user scope (against SC-1 / scope separation), so the
  divergence is licensed as a Pi capability gap and pinned:
  `project-trust.feature` keeps its trusted/untrusted pair (explicit
  `agentScope:"project"`) and adds the default-scope untrusted run
  (`Unknown agent: ...`). pi-subagents' list ignoring trust is reported as a
  pi-subagents defect (drafted report text in the SUMMARY, not filed) and not
  pinned as desired behavior.
- **D-CF4-12 (lifecycle; AGT-07):** Disable, uninstall, and update remove or
  replace the agent in the list result; enable restores it; each observed in
  a new session after the command (pi-subagents re-reads files, so no
  `/reload` is needed for the file, but a new session keeps the parent
  catalog of D-CF4-14 current).

### Amendments after research (2026-11-01; settled autonomously)

The researcher's open questions (`04-RESEARCH.md`), answered with the
recommended or upstream option. Each amends the decision it names.

- **D-CF4-07 amended:** frontmatter `opusplan` maps to
  `anthropic/claude-sonnet-5-5`, as the upstream record says a frontmatter
  `opusplan` runs on sonnet (it is opus only in plan mode, which agents lack).
- **D-CF4-01 amended:** a declared folder path is walked with the same
  recursive walker (residual against upstream, which refuses folders); a
  declared file path, which installs nothing today (`readdir` ENOTDIR), gets a
  file branch and keeps its bare name. A symlinked declared file is refused
  (T-03-27), where upstream follows it (residual). The agents walk gets its own
  predicate; `shared/fs-utils.ts` behavior for skills and commands is
  unchanged. `orchestrators/plugin/info.ts` stays flat (residual, parent line).
- **D-CF4-09 amended:** pin only the explicit `agentScope:"project"` pair (the
  Phase 1 seed); the default-scope untrusted run, whose error text names
  repository paths no frozen run token covers, is not pinned (recorded).
- **D-CF4-05 amended:** the `async`-field exception also covers an agent with
  no `tools` list in a plugin that ships MCP servers (a foreground child loads
  no ambient pi-mcp-adapter tools), so those keep today's output too.
- **D-CF4-08 amended:** a `Tool(spec)` entry such as `Bash(git log *)` maps
  by its tool name (`Bash`), as upstream resolves it; the spec is dropped.
- **D-CF4-06 amended:** `effort` is lowercased before matching, as upstream.
- **D-CF4-04 implementation (accepted from research):** the two orchestrator
  call sites (`install-outcome.ts`, `update-swap.ts`) pass the skills phase's
  result rows to the agents stage, which reads each preloaded skill's source
  `SKILL.md`, checks model-invocability, and applies the skills bridge's body
  transforms (`rewriteMarkdownReferences`, then `substituteClaudeVars` with
  `skillDir` at the staged target). Minimal edits inside their own functions.
- **Waves:** four waves, not three (wave 1 tracer; wave 2 the `convert.ts`
  owner plus the two no-product-change plans; wave 3 invocation and XK-01;
  wave 4 decisions, docs, gate), because `convert.ts` carries five decisions.

### Claude's Discretion

- The plan split, wave placement (the ROADMAP's three-wave template), step
  texts (kind-prefixed parameter types, D-CF1-08), and `features/lib/agent-files.ts`
  fixture shapes (a frontmatter map, nested paths).
- The exact install warning texts for D-CF4-04 skips and D-CF4-05 fields, in
  the style of the existing `convert.ts` warnings.
- Whether the D-CF4-04 skill text is read from the staged skill or from the
  plugin source (both after substitution), as long as the child receives the
  body upstream would inject.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 4 section and the milestone rules (ownership,
  frozen files, merge procedure); `.planning/CHILD-SESSION-BRIEF.md`.
- `.planning/REQUIREMENTS.md` AGT-01..07, XK-01.
- `.planning/research/FEATURES.md` section 3 (A1-A17) and FG-15..FG-18.
- `.planning/phases/01-harness-and-version-raise/01-CONTEXT.md` D-CF1-05,
  D-CF1-06, D-CF1-07, D-CF1-08, D-CF1-17.
- `.planning/DUBIOUS-CHOICES.md` DC-07, DC-20 (01-07), DC-22.
- `04-UPSTREAM-AGENTS.md`, `04-PI-SUBAGENTS.md` (this directory).
- `.agents/skills/cucumber/**`, `.agents/skills/local-verification/SKILL.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bridges/agents/convert.ts` (`convertAgent`, `MODEL_MAP`, `TOOL_MAP`,
  `THINKING_VALUES`, `SUPPORTED_SOURCE_FIELDS`, `GUIDED_DROPPED_FIELD_WARNINGS`,
  `mapSkills` via `domain/skill-tokens.ts::resolveSkillReference`).
- `bridges/agents/discover.ts` (flat discovery, AG-12 duplicates),
  `bridges/agents/frontmatter.ts` (emitter, field order, `aliases`,
  `skills`, `inheritSkills`), `bridges/agents/stage.ts` (warnings,
  `dropped fields:` summary).
- `domain/name.ts` `generatedAgentName`/`declaredAgentName` (agents' own arm).
- Seeds: `features/agent/invocation.feature`, `project-trust.feature`,
  `features/step_definitions/agent/runs.steps.ts`, `features/lib/agent-files.ts`;
  frozen `features/lib/skill-files.ts` (`PluginSkill`, `skillFileText`,
  `publishSkill`) for XK-01.
- Shared frozen steps: scripted model (`Given the scripted model plays these
  steps:`, `Then the model receives these calls:`, `Then the model call N
  receives this system prompt:`), companions Givens, `{uuid}` run token.

### Established Patterns
- Scenarios compare whole literal values; the child system prompt pins
  pi-subagents 0.84.0's instruction text (Phase 1 seed).
- Foreground pi-subagents children run in-process and use the parent's
  scripted model provider.
- Install warnings use `[<source>] ...` lines from the stage layer.

### Integration Points
- `shared/concerns/soft-dep.ts` (pi-subagents arm only), unit tests under
  `test/bridges/agents/**`, integration tests `test/integration/agents-*`.

</code_context>

<specifics>
## Specific Ideas

- Red proofs: every product change (D-CF4-01, -03, -04, -05, -06, -07, -08,
  -14) ships a scenario that fails without it; record the red run in the
  plan SUMMARY.
- Draft, not file: the pi-subagents defect report (list ignores trust) and the
  Pi/pi-subagents gap notes (no first-message hook for skill preload; async
  runner loads no `--extension`).

</specifics>

<deferred>
## Deferred Ideas

- Emitting `excludeTools` beside `tools` for per-tool MCP disallows (Phase 6 /
  parent; D-CF4-08).
- Mapping `memory` onto pi-subagents' `memory` (needs a per-agent path and a
  `local` scope pi-subagents lacks).
- Cross-plugin skill preload fallback (D-CF4-04 residual).
- Guarding this extension's load-time reconcile in pi-subagents async
  children when it is installed as a Pi package (`PI_SUBAGENT_CHILD`), found
  by the pi-subagents research; a lifecycle concern outside Phase 4.

</deferred>
