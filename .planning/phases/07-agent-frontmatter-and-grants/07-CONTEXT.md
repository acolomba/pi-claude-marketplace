# Phase 7: Agent Frontmatter and Grants - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning
**Mode:** autonomous discuss (`--auto`, non-interactive run). Every gray area
took the upstream-parity default or the recommended answer. Product choices are
marked **pending maintainer review**.

<domain>
## Phase Boundary

Deliver PG-AGENT-05, PG-AGENT-03, PG-AGENT-07a, and PG-AGENT-09, so that a
bridged agent gets the name, description, model, and tool grants that its
source declares:

- The agents bridge reads source frontmatter as YAML with the skills bridge's
  leniency: a quoted value loses its quotes, a comment is not a value, a
  `description: |` block keeps its lines, and an unquoted description with a
  colon still loads (PG-AGENT-05).
- `Agent` and `Task` grants, with or without a type list, map to pi-subagents
  nested delegation, and so does an omitted `tools` field unless
  `disallowedTools` names `Agent` or `Task` (PG-AGENT-03).
- A source `model: inherit` is written as `model: inherit`, with or without
  `--map-model` (PG-AGENT-07a).
- A source agent with both `tools` and `disallowedTools` is restricted by both,
  and the two warnings about pi-subagents versions below the floor are gone.
  This closes BACKLOG AGTEXCL-01 (PG-AGENT-09).

The tool table is `TOOL_MAP` in `bridges/agents/convert.ts`, not the hook tool
table. Out of scope: PG-AGENT-07c (aliases without `--map-model`), AGENT-04,
-06, -08, -10, -11 (P2), the `Workflow` grant (PG-WF-05, Phase 8), and BACKLOG
AGTLONGNAME-01, which stays open unless this phase closes it as a side effect.

</domain>

<decisions>
## Implementation Decisions

### YAML frontmatter (PG-AGENT-05)

- **D-PG7-01:** Parse a source agent's frontmatter with Pi's YAML
  `parseFrontmatter` (re-exported by `platform/pi-api.ts`), as the skills
  bridge does. Follow upstream's order: parse first; only when that parse
  fails, apply `repairSingleLineScalars` and parse again. Parsing first keeps
  `tools: Read # note` a comment-stripped `Read` (upstream does the same: its
  retry runs only on a failed first parse). Today's line reader is not a
  fallback for a whole file (PRD section 7.7). The line reader's parsing code
  goes away once nothing calls it; the output side of `bridges/agents/
  frontmatter.ts` stays.
- **D-PG7-02 (pending maintainer review):** The repair keeps the skills
  bridge's trigger, an unquoted `: ` in a single-line plain scalar. Upstream's
  retry (`xu` in 2.1.323) also quotes values that contain any of
  ``{}[]*&#!|>%@` `` and turns leading tabs into spaces. The ROADMAP names the
  skills leniency, and widening the shared repair would change skills too, so
  the broader set is a recorded residual, not this phase's work. The plan
  records it in the agents compatibility text and proposes a BACKLOG entry in
  the parent lines.
- **D-PG7-03:** `repairSingleLineScalars` and the scan helpers it needs move to
  a module that both bridges may import (fallow zones forbid
  `bridges-agents` -> `bridges-skills`). The planner picks the home that the
  boundary rules allow (the helpers import `parseFrontmatter` from
  `platform/`, so `shared/` cannot hold them). The skills bridge's behavior and
  tests stay byte-identical.
- **D-PG7-04 (upstream parity):** When the repaired text still fails to parse,
  the agent loads with no frontmatter fields, as Claude Code 2.1.323 loads a
  plugin agent (`NIn`): its name comes from the file name, its description is
  the existing fallback `Agent from <plugin> plugin`, and its `tools` are
  omitted (every tool). The body is the text after the closing fence. Install
  adds one warning that the source frontmatter could not be parsed (wording is
  the agent's discretion within the messaging style guide; pending maintainer
  review). The install is not refused.
- **D-PG7-05:** YAML values become the converter's inputs this way: `name` is
  `String(value)` (upstream), trimmed, still checked by `assertSafeName`; a
  YAML sequence for `tools`, `disallowedTools`, or `skills` is joined as the
  comma list the converter already splits, and a comma string stays one
  string, so `Agent(a, b)` still splits at top level only; `background` counts
  only `true` or `"true"` (upstream accepts only those; `yes` is a string);
  other scalars become strings; a mapping value is a dropped field as today.
  `model` is trimmed and `inherit` matched in any case (upstream lowercases
  it).
- **D-PG7-06:** A `description: |` block keeps its newlines in the generated
  agent. The emitter must stay injection-safe (AG-8): a multi-line value can
  never form a new key in what pi-subagents parses back. Research decides the
  form from how pi-subagents 0.88.1 reads frontmatter (for example a
  double-quoted scalar with `\n` escapes if it reads YAML). If pi-subagents
  cannot carry a newline in `description`, that is a capability gap: record it
  and keep the one-line form, and criterion 2's second half becomes a
  documented gap that the verifier treats as an override candidate.
- **D-PG7-07 (pending maintainer review; changes installed artifacts):** A
  quoted `name` (`name: "x"`) now yields the generated name `demo:x` and a
  different generated file. No migration runs at load (APL-D1). At the next
  `update` that re-materializes the plugin, at `reinstall`, or at an `apply`
  convergence move, the agents bridge's per-plugin unstage (agents-index rows
  owned by the plugin) removes the old file and row, and the new file is
  written. The plan proves that after such an update or reinstall no old
  agent file, agents-index row, or `resources.agents` entry stays. Research
  first: whether a quoted name installs today at all (`assertSafeName` on
  `"x"`), and whether update unstages names it no longer discovers.

### Nested delegation (PG-AGENT-03)

- **D-PG7-08:** `TOOL_MAP` maps `Agent` and `Task` to pi-subagents' `subagent`
  tool. `Task` is upstream's alias of `Agent` (2.1.323 alias table
  `{Task:"Agent",...}`), in `tools` and in `disallowedTools`. `Agent(x, y)` and
  `Task(x, y)` map the same way; the type list is not written as
  `allowedAgents`, because Claude Code ignores it inside a subagent.
- **D-PG7-09:** An agent with no `tools` field (or `*`) gets nested delegation
  through `allowNestedSubagents: true`, unless `disallowedTools` names `Agent`
  or `Task` (bare or with a list). Research confirms the exact pi-subagents
  0.88.1 keys and whether an explicit `tools: ..., subagent` list also needs
  `allowNestedSubagents`.
- **D-PG7-10 (pending maintainer review; known divergence):** Nesting depth is
  left to pi-subagents (default 2) and the user's pi-subagents settings. Claude
  Code's default is 3 (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` overrides it).
  The requirement does not ask for depth parity, and a per-agent depth key
  would override the user's own setting. The PRD rejected a project setting
  beside pi-subagents' `asyncByDefault` for the same reason (AGENT-01). The compatibility documentation states the difference.

### Model inherit (PG-AGENT-07a)

- **D-PG7-11:** A source `model: inherit` (trimmed, any case) writes
  `model: inherit` with or without `--map-model`. Upstream ranks frontmatter
  `inherit` above `CLAUDE_CODE_SUBAGENT_MODEL`; pi-subagents ranks frontmatter
  above `subagents.defaultModel`, so the written line restores the order.
  Every other `model` value without `--map-model` keeps today's behavior
  (PG-AGENT-07c is P2). Installed agents change at their next update or
  reinstall.

### Both tool lists (PG-AGENT-09)

- **D-PG7-12:** With explicit `tools` and `disallowedTools`, the deny applies
  first, as upstream's runtime does (2.1.323 filters the pool by the deny set,
  then resolves `tools`; the schema help text "Ignored if `tools` is set" is
  stale). Exact names stay filtered out of `tools`. A per-tool MCP deny under a
  whole-server grant is written to `excludeTools` beside `tools`, in the
  registered name the form's implementation uses (D-PG1-10).
  `GeneratedToolsFields` allows both keys. Research verifies against
  pi-subagents 0.88.1 source that `excludeTools` removes one tool from an
  `mcp:` whole-server selector grant; if it does not, the per-tool case keeps a
  reworded, true warning (capability gap) and the rest still lands.
- **D-PG7-13:** Remove both warnings: `` `excludeTools` requires pi-subagents
  >= 0.62.0 ... `` and `disallowedTools entry <tool> cannot narrow the
  whole-server grant <server> -- pi-subagents takes no excludeTools beside an
  explicit tools: list ...`. Stored warning text in agent files and
  agents-index rows (grant forms, legacy grant form, grant rewrite) is matched
  byte for byte; the plan keeps the old text recognized wherever stored text is
  compared, so a session-start grant rewrite of an old row still works.
- **D-PG7-14:** A deny with a specifier (`Bash(rm:*)`) removes the whole tool,
  as upstream's deny matcher adds the bare tool name. `disallowedTools:
  mcp__*` without `tools` stays the documented gap (`excludeTools` takes exact
  names).

### Proof and records

- **D-PG7-15:** Each requirement ships cucumber scenarios that fail without the
  change, in `features/agent/frontmatter.feature` (or a new sibling feature),
  under both MCP profiles where grants differ. Criterion 3's scripted child
  `subagent({agent: "demo:helper"})` call needs a real or scripted
  pi-subagents child; research finds what the harness supports (Phase 3's
  child tests are the precedent). If only an integration test against the
  installed pi-subagents can run the child, that test carries the proof and
  the scenario pins `subagent get`.
- **D-PG7-16:** Docs: the agents section of the compatibility documentation
  and `docs/output-catalog.md` (warning rows removed or added) change in the
  same plan as the behavior. BACKLOG AGTEXCL-01 is marked closed (parent-owned
  edit, minimal). CHANGELOG is parent-owned; the parent lines carry the entry
  text, including "run `reinstall` once to rename a quoted agent name and to
  pick up `model: inherit`".

### Decided autonomously

Reversible technical choices: D-PG7-01, -03, -05, -06, -08, -09, -11, -12,
-13, -14, -15, -16. Each touches the agents bridge's pure conversion, its
emitter, or tests and docs, with no persisted data format change beyond the
generated agent files that the next update rewrites.

### Pending maintainer review

- D-PG7-02: narrower repair trigger than upstream's retry.
- D-PG7-04: warning wording on an unparseable agent; loading it with no fields
  matches upstream.
- D-PG7-07: renamed agent files for quoted names, applied only at the next
  update or reinstall, with no load-time warning.
- D-PG7-10: depth stays pi-subagents' default.

### the agent's Discretion

Internal type and helper names; the module that hosts the shared repair
(within fallow zones); exact warning wording; plan split; whether the line
reader's dead code is deleted in the same plan. No exception to plan size,
security, coverage, or verification gates.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `bridges/skills/frontmatter-degrade.ts` `repairSingleLineScalars` and
  `bridges/skills/frontmatter-scan.ts` (`frontmatterBlockEnd`,
  `keyValueEnd`); `bridges/skills/stage.ts:97-103` shows parse-repair-parse.
- `bridges/agents/frontmatter.ts`: `parseFrontmatter` (line reader, to be
  replaced), `emitYamlScalar`, `GeneratedToolsFields` (the `never` arms that
  forbid `tools` with `excludeTools`), `GeneratedFrontmatterFields`.
- `bridges/agents/discover.ts:128-158` `collectAgentFile`: `raw.name ?? stem`,
  `assertSafeName`, `generatedAgentName`.
- `bridges/agents/convert.ts`: `TOOL_MAP` (:79), `mapModel` (:313, `inherit`
  returns no emit), `mapTools` (:461), `explicitDisallow`,
  `explicitMcpWarnings` (:542, stale warning), `omittedToolMapping` (:578,
  version warning at :608), `agentDescription` fallback (:821-834),
  `convertAgentOrEmpty` (:925).
- `bridges/agents/grant-forms.ts`, `grant-rewrite.ts`,
  `legacy-grant-form.ts`, `mcp-async-warning.ts`: stored forms and warning
  text compared at session start.
- `bridges/agents/unstage.ts` `unstagePluginAgents`: per-plugin removal by
  agents-index owner rows.

### Established Patterns

Pure conversion with owner unit tests; warnings never refuse an install;
cross-bridge imports are banned by fallow zones; atomic writes; one output
channel. Trace callers with CodeGraph before editing.

### Integration Points

- `features/agent/frontmatter.feature`, `features/agent/listing.feature`, and
  `features/mcp-server/agent-grants.feature`; `subagent get` / `subagent
  list` steps.
- `test/integration/agents-adapter-grant-conformance.test.ts` (real
  pi-subagents) for the excludeTools-under-`mcp:` check.
- pi-subagents source after `node scripts/install-test-peers.mjs`:
  `node_modules/.cache/optional-peers/node_modules/pi-subagents/` (suite
  version 0.88.1).

</code_context>

<specifics>
## Specific Ideas

Upstream evidence, Claude Code **2.1.323**
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`),
grepped 2026-11-14; docs <https://code.claude.com/docs/en/sub-agents> fetched
2026-11-14. Confidence high unless noted.

1. **Parser.** Skills, commands, and agents share `md()`, which calls
   `Bun.YAML.parse`, and on a throw retries once (`zWn`) after `xu` quotes each
   top-level `key: value` whose unquoted value contains `: ` or one of
   ``{}[]*&#!|>%@` ``. A second failure logs `Failed to parse YAML frontmatter
   in <path>` and returns `{}`. Replayed with bun 1.4.4: `Reviews: code and
   tests` loads on the retry; `tools: Read # note` gives `Read`; `|` keeps
   newlines. Caveat: the embedded Bun may differ from 1.4.4.
2. **Unparseable plugin agent** (`NIn`): loads with no fields, name from the
   file name, description `Agent from <plugin> plugin`, all tools.
3. **Name:** `[plugin, ...folders, String(name)].join(":")`; absent or empty
   falls back to the file name; no sanitizing.
4. **Agent/Task:** `Task` aliases `Agent`; the `Agent(type, ...)` list is read
   only on the main-thread `--agent` path (medium-high: data flow plus docs);
   omitted `tools` grants every tool including `Agent`; a deny of `Agent` or
   `Task` removes it. Default depth 3.
5. **tools + disallowedTools:** deny filters the pool first; per-tool
   `mcp__srv__tool` deny under a `mcp__srv` grant removes only that tool;
   specifiers deny the whole tool.
6. **Model:** call parameter > frontmatter non-`inherit` > frontmatter
   `inherit` (main-loop model, env not consulted) > `CLAUDE_CODE_SUBAGENT_MODEL`
   > main model.

Corrections to project evidence: the PRD's AGENT-05 note ("not found in the
binary") is now answered; subagents.md note 13 (deny ignored beside `tools`)
follows the stale help text, not the runtime.

Use counts (PRD): 4 of 40 agents quote a description, 4 use `|`; none quotes
`name`, `model`, or `effort`; 5 of 28 `tools` lines use `Agent(...)`; 12 of 40
agents omit `tools`; 16 of 29 `model` lines say `inherit`.

</specifics>

<deferred>
## Deferred Ideas

- Widening the shared repair to upstream's full trigger set and tab rule
  (D-PG7-02); BACKLOG candidate.
- Depth parity (D-PG7-10).
- PG-AGENT-07c, AGENT-04/06/08/10/11, PG-WF-05.
- AGTLONGNAME-01 (pi-subagents naming of granted adapter tools over 64
  characters).

</deferred>

## Parent lines for the orchestrator

Recommended shared-file edits; this phase does not edit PROJECT.md or
CHANGELOG.md.

1. PROJECT.md Key Decisions: add D-PG7-01 (agent frontmatter is YAML with the
   colon repair), D-PG7-08/09 (Agent/Task grant nested delegation), D-PG7-11
   (`model: inherit` always written), D-PG7-12 (`excludeTools` beside
   `tools`). Mark D-PG7-02, -04, -07, -10 accepted without review until the
   maintainer confirms them.
2. BACKLOG: new entry for D-PG7-02's wider repair set.
3. CHANGELOG (under the milestone entry): agent frontmatter is read as YAML;
   agents can start subagents; `model: inherit` is kept; both tool lists
   restrict an agent. Run `reinstall` once to apply this to installed plugins.
