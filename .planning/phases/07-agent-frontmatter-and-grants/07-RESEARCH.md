# Phase 7: Agent Frontmatter and Grants - Research

**Researched:** 2026-11-14
**Domain:** agents bridge (source frontmatter reader, converter, generated frontmatter emitter), pi-subagents 0.88.1 agent files and child launch, cucumber agent harness
**Confidence:** HIGH for the code sites and for the pi-subagents behavior (source read and six hermetic probes); MEDIUM for two upstream edge readings that CONTEXT does not cover (Assumptions A1-A3)

<user_constraints>

## User Constraints (from CONTEXT.md)

The decisions, the discretion areas, and the deferred ideas below are copied verbatim from `07-CONTEXT.md` (lines 39-184, 188-191, and 281-286). [VERIFIED: .planning/phases/07-agent-frontmatter-and-grants/07-CONTEXT.md]

**Locked Decisions (verbatim).** D-PG7-02, D-PG7-04, D-PG7-07, and D-PG7-10 are pending maintainer review and are locked for planning. Findings 2 and 7 in the Summary ask the planner to refine D-PG7-02 and D-PG7-04; they do not unlock them.

<!-- DATA_H4T9WQ2M_START -->

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

<!-- DATA_H4T9WQ2M_END -->

**Claude's Discretion (verbatim)**

<!-- DATA_Z7K3PX8B_START -->

Internal type and helper names; the module that hosts the shared repair
(within fallow zones); exact warning wording; plan split; whether the line
reader's dead code is deleted in the same plan. No exception to plan size,
security, coverage, or verification gates.

<!-- DATA_Z7K3PX8B_END -->

**Deferred Ideas (OUT OF SCOPE, verbatim)**

<!-- DATA_N6R1YC5V_START -->

- Widening the shared repair to upstream's full trigger set and tab rule
  (D-PG7-02); BACKLOG candidate.
- Depth parity (D-PG7-10).
- PG-AGENT-07c, AGENT-04/06/08/10/11, PG-WF-05.
- AGTLONGNAME-01 (pi-subagents naming of granted adapter tools over 64
  characters).

<!-- DATA_N6R1YC5V_END -->

CONTEXT.md also carries "Parent lines for the orchestrator" (PROJECT.md decision rows, one BACKLOG entry, the CHANGELOG text). They are the orchestrator's work, not a plan task of this research. CONTEXT says to take its upstream evidence (Claude Code 2.1.323) as given; this research did not repeat it.

</user_constraints>

## Summary

Every requirement is a change to code that exists: one reader, one converter, one emitter, and their tests. No package is added, no state schema changes, and nothing runs at load. All four requirements can be met in full on pi-subagents 0.88.1. No capability gap was found. Six hermetic probes and one read of the floor version back the pi-subagents claims (see "Probes run in this research").

**Findings that change or refine a CONTEXT decision.** Each one changes a plan task.

1. **D-PG7-06 is answered: emit a literal block scalar.** pi-subagents 0.88.1 reads agent frontmatter with its own line reader, not YAML. It strips one pair of quotes and processes no escape, so a double-quoted `\n` form would show a backslash and an `n` to the model. It does read `|` and `|-` blocks and keeps their newlines. Probe P1 wrote `description: |-` with indented lines `name: injected`, `# not a comment`, a blank line, and `---`; `subagent get` returned all five lines, and the agent kept its name. Emit `description: |-` and indent every line by two spaces. Criterion 2 is reachable; there is no gap to record. [VERIFIED: pi-subagents `src/agents/frontmatter.js:72-141`; probe P1]
2. **D-PG7-02 as written breaks `tools: *`.** Pi's YAML parser refuses `tools: *` (`Alias cannot be an empty string`), the colon repair does not touch the line, and the agent then loads with no fields under D-PG7-04. Today that line works (D-CF4-08), and the scenario "Tool lists split on commas and spaces as Claude Code splits them" pins it with the `starred` agent. A plain scalar that starts with `@` or a backtick fails the same way. The plan must keep `tools: *` working. Recommended: give the moved repair a trigger parameter. Skills pass today's colon rule, so skills stay byte-identical; agents pass the colon rule plus "the value starts with `*`, `&`, `!`, `%`, `@`, or a backtick". This is narrower than upstream's set and keeps D-PG7-02's reason (no change to skills). It needs the maintainer review that D-PG7-02 already carries. [VERIFIED: probe P3]
3. **D-PG7-03's premise is wrong, which makes the choice easier.** `repairSingleLineScalars`, `frontmatterBlockEnd`, `keyValueEnd`, and the scalar emitter import nothing from `platform/`. Only `topLevelNodeIndex` does, and the repair does not use it. Also `shared/` may import `platform/` under both gates. Put the repair in `shared/` (for example `shared/frontmatter-repair.ts`). The pairing rule moves the tests of the moved functions to the new pair; "tests stay byte-identical" can hold for the cases, not for their file. [VERIFIED: bridges/skills/frontmatter-degrade.ts:19, frontmatter-scan.ts:13-14; .fallowrc.json:144-147; eslint.config.js:254-265]
4. **`subagent get` cannot show nested delegation for an agent with no `tools`.** pi-subagents prints no line for `allowNestedSubagents`. Criterion 3's "agent with no `tools` field" clause cannot be read from `subagent get`. The proof for that case is the scripted child's nested call, which the cucumber harness runs today with existing steps (probe P2), plus the `allowNestedSubagents: true` line in the generated file. An explicit `tools: ..., subagent` list needs no `allowNestedSubagents`. The planner records the criterion wording as an override candidate for the verifier. [VERIFIED: pi-subagents `src/agents/agent-management.js:951-1025`; probes P2, P4]
5. **D-PG7-12 is confirmed.** `excludeTools` beside an explicit `tools` list removes one registered MCP tool name from a whole-server `mcp:` grant, under both MCP implementations. No reworded warning is needed. One residual: under pi-mcp-adapter, pi-subagents compares against its own uncut name, so a name over 64 characters does not match. That agent cannot launch today anyway (AGTLONGNAME-01, deferred). [VERIFIED: pi-subagents `src/runs/shared/child-tool-plan.js:213-215,242-245`; probes P4, P5]
6. **Criterion 5's "install prints neither warning" needs the right command.** Per-agent conversion warnings are hygiene warnings. A standalone `install` never printed them. `apply`, `marketplace update`, and the autoupdate cascades do, and the generated file's `provenance.warnings` holds them. A scenario that must fail without the change uses `apply` or the staged file text. `docs/output-catalog.md` holds no row for either warning, so D-PG7-16 has nothing to remove there. [VERIFIED: bridges/agents/stage.ts:168-174; shared/staging-warnings.ts:1-11]
7. **D-PG7-04's warning must be a discovery warning.** As a converter warning it would be hygiene and a standalone install would stay silent about an agent that lost its tool restriction. Report it from `discoverPluginAgents`, whose warnings the stage already tags as discovery. Install then prints `Plugin "demo" [user] installed; 1 declared component has a note.` [VERIFIED: bridges/agents/stage.ts:173; features/plugin/staging-warnings.feature:14-23]
8. **D-PG7-07 holds.** A quoted name installs today as `demo:"x"` in the file `pi-claude-marketplace-demo-"x".md`. `update`, `reinstall`, and `apply` moves all run `prepareStagePluginAgents` and `commitPreparedAgents`, which remove every file of every index row the plugin owns and save only the new rows. Two residuals: a user-edited old file keeps its file and row (AG-5), and a user's `agentOverrides` entry keyed by the old name stops matching. [VERIFIED: bridges/agents/stage.ts:149-154,446-456,482-485; update-swap.ts:888-889]
9. **D-PG7-05 needs four more rules.** A YAML document that is not a mapping (`just text`, a list) comes back as a string or an array and must count as "no fields". A YAML null must become the empty string, as the line reader gives for `key:`, so `tools:` keeps its AG-11 meaning. A `__proto__` key arrives as an own property and must be copied with `setOwn`. The reader must strip the byte-order mark before the repair, because the repair's opening-fence test is anchored. [VERIFIED: probe P3; shared/own-key.ts:17; bridges/skills/stage.ts:359]
10. **D-PG7-08 has a second reason.** An `allowedAgents` key would create a capability ceiling in pi-subagents, and a ceiling sets `MCP_DIRECT_TOOLS` to `__none__` for an agent with no `tools`. That would remove the ambient MCP tools that README line 40 promises. `allowNestedSubagents: true` alone keeps them. [VERIFIED: pi-subagents `src/runs/shared/child-launch.js:49-64,84-90`; probe P5]

**Primary recommendation:** Replace the line reader with one reader in `bridges/agents/frontmatter.ts` that returns string-typed `raw` values, so every consumer of `raw` keeps its types. Move the repair to `shared/`. Change the converter in three small, separately tested steps (tool table and nested key, `model: inherit`, both tool lists). Prove nested delegation with a scripted foreground child in `features/agent/invocation.feature`, and the launch plan with new cases in `test/integration/pi-subagents-child-launch-conformance.test.ts`.

## Architectural Responsibility Map

This is a local Pi extension. The tiers are the project's own layers. [VERIFIED: .planning/codebase/ARCHITECTURE.md]

| Capability | Primary tier | Secondary tier | Rationale |
| --- | --- | --- | --- |
| Colon repair of a frontmatter block | `shared/` (new module) | `bridges/skills`, `bridges/agents` (callers) | Pure string helpers with no domain knowledge; both bridges may import `shared/`, not each other. |
| YAML parse | `platform/pi-api.ts` (`parseFrontmatter` re-export) | none | The only door to the Pi package (`pi-peer-chokepoint`). |
| Source agent reader and value normalizer | `bridges/agents/frontmatter.ts` | `bridges/agents/discover.ts` (name, unparseable warning) | The module already owns the input and output sides of agent frontmatter. |
| Tool, model, and nested-delegation mapping | `bridges/agents/convert.ts` | none | Pure conversion with owner tests (AG-7). |
| Generated frontmatter bytes | `bridges/agents/frontmatter.ts` (`emitGeneratedAgentFrontmatter`) | none | The only place that decides how a generated agent file is assembled (AG-8). |
| Removal of a renamed agent's old file and row | `bridges/agents/stage.ts` commit, `orchestrators/plugin/update-swap.ts` finalize | none | Existing owner-row path; no new code. |
| Child tool set, nested `subagent` tool, depth | pi-subagents (companion) | none | The bridge writes keys; pi-subagents enforces them. |
| Projection of `subagent get` and `list` in scenarios | `features/lib/upstream/subagents.ts` | `features/step_definitions/agent/runs.steps.ts` | Harness code; a multi-line description needs a projection change. |
| Documentation | `docs/mcp-compatibility.md` ("Customizing generated agents"), `README.md`, `README.es.md` | `CHANGELOG.md`, `.planning/BACKLOG.md` (parent-owned) | Records only. |

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
| --- | --- | --- |
| PG-AGENT-05 | Agent frontmatter is read as YAML with the leniency that skill frontmatter has: a quoted value loses its quotes, a comment is not a value, a multi-line description keeps its lines, and an unquoted description with a colon still loads. (P1) | Pi's `parseFrontmatter` contract and return types (R4, probe P3); the repair's real dependencies and its new home (R4); the value rules (R7); the emit form for a multi-line description (R1, probe P1); the quoted-name trace (R5); the harness projection gap (R8). |
| PG-AGENT-03 | A bridged agent whose source grants `Agent` or `Task`, with or without a type list, can start subagents. So can an agent with no `tools` field, unless `disallowedTools` names `Agent` or `Task`. (P1) | pi-subagents fan-out rule and child tool registration (R2, probes P2, P4, P5); what `subagent get` prints (R1); a nested call in the cucumber harness (R8, probe P2). |
| PG-AGENT-07a | A source agent with `model: inherit` runs on the parent's model, with or without `--map-model`. (P1) | `mapModel` site (`convert.ts:313-332,962-964`); `subagent get` prints `Model: inherit` (probe P2); the scenario that changes (R8). |
| PG-AGENT-09 | A source agent with both `tools` and `disallowedTools` is restricted by both, and the two warnings that state limits of pi-subagents versions below the floor are gone. (P1) | `excludeTools` beside `tools` in pi-subagents (R3, probes P4, P5); every site of the two warning strings (R6); the warning channel (Summary finding 6). |

Requirement text is quoted from `.planning/REQUIREMENTS.md:41-44`. [VERIFIED: file read this session]

</phase_requirements>

## Project Constraints (from AGENTS.md)

These directives bind the plans. [VERIFIED: AGENTS.md of the worktree and the four skills, read this session]

- Read a file before editing it, and trace a function's callers before changing it. Use CodeGraph (`npx --no codegraph explore "<symbols>"`) before grep. Keep changes surgical.
- Work inside the GSD workflow on `features/gaps-agents`. Never commit to `main`, never rebase, never use `--no-verify`. Follow `.agents/skills/committing/SKILL.md`.
- Upstream parity is the default. A divergence needs a recorded decision ID or a Pi capability gap. D-PG7-02, -04, -07, and -10 carry the IDs for this phase.
- NFR-1 atomic writes, NFR-10 containment, NFR-2 no restart, NFR-3 idempotent or fail-clean, NFR-5 no new network use. A load changes no installation state (APL-D1), so no migration of agent files runs at load.
- One output channel: `notify()` through `shared/notification-dispatch.ts`. No `console.*` or stdio in the extension.
- A user-visible change ships with a cucumber scenario that fails without it. Unit tests and direct coverage do not replace it. Run both profiles (`npm run test:cucumber`).
- Every production source has exactly one owner test at the mirrored path, with 100% line, function, and branch coverage when that pair runs alone. Do not test one source from another module's test. A moved function takes its cases with it.
- Use `node:test`, `node:assert/strict`, and `strong-mock` only.
- Two complexity gates apply to every function: ESLint `sonarjs/cognitive-complexity` 15, and fallow `maxCognitive` 15 with `maxCyclomatic` 20. `fallow dupes` fails on every clone group. `no-await-in-loop` needs a reasoned disable comment.
- The `pi-peer-chokepoint` rule allows the Pi package import only in `platform/pi-api.ts`. Import `parseFrontmatter` from there.
- Comments and test titles cite decision and requirement IDs (D-PG7-NN, PG-AGENT-05), never phase, plan, or wave numbers. No comment on trivial code.
- Gates: the commit hook runs `npm run check:commit`; each wave merge, the phase gate, and the handoff run `npm run check` on the combined tree. A passing hook is not a gate.
- Each plan `SUMMARY.md` includes `## Threat Flags`. Prefix each `gsd-tools windows append --description` with `[parity-gaps]`.
- Tests and probes use a hermetic home only. Never touch the real `~/.pi/agent`. Say so in every executor dispatch.
- README changes follow the `readme` skill: `README.es.md` stays in sync with `README.md`.

## Standard Stack

No package is added, removed, or upgraded. [VERIFIED: package.json read this session]

| Component | Version in the tree | Use in this phase |
| --- | --- | --- |
| `@earendil-works/pi-coding-agent` | 1.5.0 (`node_modules/@earendil-works/pi-coding-agent/package.json`) | `parseFrontmatter`, re-exported at `platform/pi-api.ts:49`. |
| `yaml` | 2.9.1 installed as Pi's own dependency (Pi declares `"yaml": "2.9.0"`) | Reached only through Pi's `parseFrontmatter`. Not a dependency of this project; do not import it. |
| `pi-subagents` | 0.88.1 in `node_modules/.cache/optional-peers` (suite version, `test/integration/optional-peer-suite-versions.json`); declared floor `>=0.87.0` | Reads the generated agent files; the conformance tests import its modules in place. The floor version reads the same keys the same way (probe P7), so no floor change is needed. |
| `pi-mcp-adapter` | 7.0.1 in the same cache | Adapter-profile scenarios. |
| `@cucumber/cucumber` | `^13.3.0` (package.json:19) | Scenarios. |

**Installation:** none. `node scripts/install-test-peers.mjs` fills the optional-peer cache; the npm test scripts run it first.

## Package Legitimacy Audit

This phase installs no external package. No audit is needed.

## Architecture Patterns

### System data flow

```text
source agent .md (plugin content, untrusted)
        |
        v
[discover.ts collectAgentFile]
        |  bytes -> sha256 sourceHash (unchanged)
        v
[frontmatter.ts reader]  stripBom -> parseFrontmatter (Pi YAML)
        |        | throws
        |        v
        |   [shared repair] -> parseFrontmatter again
        |        | throws again                    | parses
        |        v                                  v
        |   no fields + discovery warning      mapping? -- no --> no fields
        |   body = text after closing fence        | yes
        v                                          v
[normalizer]  YAML values -> string-typed RawAgentFrontmatter (own keys only)
        |
        v
[discover.ts]  name = raw.name or file stem -> assertSafeName -> generated name (AG-12 dedupe)
        |
        +--> orchestrators/plugin/discover-names.ts (name preflight, PG-SEC-01 notes)
        +--> bridges/agents/skill-preload.ts (raw.skills)
        v
[convert.ts]  description | model (inherit always) | tools (Agent/Task -> subagent)
        |     omitted tools -> allowNestedSubagents unless Agent/Task denied
        |     explicit tools + per-tool MCP deny -> tools + excludeTools
        v
[frontmatter.ts emitter]  one line, or `description: |-` block (AG-8)
        |
        v
[stage.ts]  staging dir -> commit: remove owned old files, rename, save index
        |
        v
<scopeRoot>/agents/pi-claude-marketplace-<plugin>-<agent>.md + agents-index.json
        |
        v
pi-subagents 0.88.1 line reader -> child tool plan -> child session
```

### R1. The pi-subagents 0.88.1 frontmatter reader

All paths below are under `node_modules/.cache/optional-peers/node_modules/pi-subagents/`. [VERIFIED: files read this session]

- **Line-based, not YAML.** `src/agents/frontmatter.js:110` matches a key with `line.match(/^([\w-]+):\s*(.*)$/)`. A value that starts and ends with the same quote loses that pair (`:120-121`, `rawValue.slice(1, -1)`). No escape is processed. So `"a\nb"` reaches the model as `a\nb`, six characters.
- **Block scalars.** `:122-123` reads `rawValue === ">" || rawValue === ">-"` as folded and `rawValue === "|" || rawValue === "|-"` as literal. No other header form is known (`|+`, `|2`). A block takes every later line whose indent is greater than the key's, and every exactly-empty line (`:98`). A comment line is content inside a literal block (`:95`). `flushBlockLines` removes the indent of the first content line from every line that starts with it (`:150-158`).
- **Consequences for the emitter.** A two-space indent on every line makes it impossible for a description line to start a key or to close the frontmatter (`indexOf("\n---", 3)` at `:78` needs `---` at column 0). The value's first line must not start with white space, or the common indent would be read too wide; trimming the description (the converter already does, `nonBlank`) guarantees that. Use `|-`.
- **Required keys.** An agent file without `name` or `description` is skipped (`src/agents/agents.js:1940-1941`). The description fallback keeps every bridged agent valid.
- **`subagent get`** (`formatAgentDetail`, `src/agents/agent-management.js:951-1025`) prints, in this order and only when set: `Agent:`, `Path:`, `Description: ${agent.description}` (raw, with its newlines), `Aliases:`, `Model: ${agent.model}`, `Tools: ${tools.join(", ")}` (MCP grants as `mcp:<selector>`), `Excluded tools: ...`, then the context lines, `Async:`, and the system prompt. It prints nothing for `allowNestedSubagents` and nothing for `allowedAgents`.
- **`subagent list`** prints `- name (meta): description` (`:768`). With `capabilities: true` it prints `Description: ...; Tools: ...; Model: ...; Thinking: ...` (`:771-797`). The tools value is `default/ambient` for an agent with no `tools`, and `; excludes: a, b` is appended for `excludeTools`. The description goes through `previewDisplayText(…, 240)`, which turns a newline into a space.
- **What the harness shows.** `features/lib/upstream/subagents.ts` lower-cases the labels and keeps only the fields this extension writes. Probe P2 returned, for a hand-written file: `model inherit`, `tools read, subagent`, `tools read, bash` with `excluded tools bash` in `get`, and `; tools read, bash; excluded tools bash` in the capabilities list.

### R2. Nested delegation keys

[VERIFIED: source read; probes P2, P4, P5]

- **The rule.** `src/runs/shared/child-tool-plan.js:216-218`:

  ```js
  const fanoutAuthorized = effectiveDeclaredBuiltinTools.includes("subagent") || (input.allowNestedSubagents === true &&
      !excludedToolSet.has("subagent") &&
      (!allowedToolSet || allowedToolSet.has("subagent")));
  ```

- **`tools: ..., subagent` alone is enough.** Probe P4: `{tools:["read","subagent"]}` gives `fanout: true` and `required: ["read","subagent"]`. Do not also write `allowNestedSubagents` beside an explicit list.
- **For an agent with no `tools`, `allowNestedSubagents: true` is enough.** Probe P5: `fanout: true`, no `tools` in the session, `MCP_DIRECT_TOOLS` left unset (ambient tools kept), `depth: 1`, `maxDepth: 2`. The key must be the literal text `true` (`src/agents/agents.js:2052-2059` accepts `"true"` or `"false"` and throws on anything else).
- **A child has no `subagent` tool unless fan-out is authorized.** pi-subagents does not register itself in a child: `index.js:3-7` loads no extension when `process.env.PI_SUBAGENT_CHILD === "1"`, and `src/extension/index.js:216-219` returns early. A foreground child loads no ambient extension at all (`noExtensions: !launch.ambientExtensions`, `src/runs/shared/child-session.js:460`). The child-safe tool comes from `registerFanoutChildSubagentExtension` (`src/extension/fanout-child.js:214`, `name: "subagent"`), which `src/runs/shared/child-hooks.js:173-174` adds only `if (config.fanoutChild)`. So an agent with no `tools` and `disallowedTools: Agent` needs no key at all to have no `subagent` tool.
- **`excludeTools: subagent` is harmless and visible.** Probe P4: with `allowNestedSubagents` it turns fan-out off. Probe P6: a child whose file holds `excludeTools: subagent` starts and runs, and `subagent get` shows `excluded tools subagent`.
- **Default depth is 2.** `src/shared/types.js:130`: `export const DEFAULT_SUBAGENT_MAX_DEPTH = 2;`. A main session is depth 0, its child 1, and a grandchild 2; a launch is blocked when `depth >= maxDepth` (`:188-193`). So a bridged agent can start a subagent, and that subagent cannot start another. Claude Code allows one more layer (D-PG7-10).

**Recommended mapping.** Add `["Agent", "subagent"]` and `["Task", "subagent"]` to `TOOL_MAP`. Everything else follows from code that exists:

- `toolNameOf` already reads `Agent(a, b)` as `Agent` (`convert.ts:254-257`).
- In an explicit list, `explicitDisallow` already filters by Pi name, so `disallowedTools: Task` removes the `subagent` that `Agent` mapped to (`convert.ts:501-527`).
- In the omitted arm, `TOOL_MAP.get(toolNameOf(token))` puts `subagent` into `excludeTools` (`convert.ts:590`). Set `allowNestedSubagents` when the arm is omitted and `excludeTools` does not hold `subagent`.
- AG-11 no longer fires for `tools: Agent`: the list maps to `subagent`.

### R3. `excludeTools` beside an explicit `mcp:` whole-server grant

[VERIFIED: source read; probes P4, P5]

- `src/runs/shared/child-tool-plan.js:213-215` builds the exclude set and filters the built-in names. `:242-245` filters the resolved MCP selections: `.filter((selection) => !excludedToolSet.has(selection.name))`.
- `src/runs/shared/child-launch.js:225-227` then gives the child `tools: toolPlan.effectiveToolAllowlist` for an explicit list, and passes `excludeTools` to Pi only when there is no explicit list. The allowlist is the enforcement.
- pi-subagents documents it: "`excludeTools` is applied after this resolution. It can narrow an explicit `tools` allowlist" (`docs/agents.md:570`). [CITED: installed package documentation]
- **Probe P4** (adapter resolver, server `plugin_demo_stub_` with tools `echo`, `drop`, `a.b`): `excludeTools: ["mcp__plugin_demo_stub__drop"]` beside the whole-server selector gives the allowlist `read, mcp__plugin_demo_stub__echo, mcp__plugin_demo_stub__a_b`.
- **Which name.** Under the adapter, `selection.name` is pi-subagents' own `mcp__<key>_<tool>` with each `.` replaced by `_` and no length cut (`src/runs/shared/mcp-direct-tool-grant.js:104-114`). Under Pi's built-in MCP it is the tool name in Pi's registry (`src/runs/shared/mcp-direct-tool-allowlist.js:90-106`). `profileFor(id).toolName(...)` (the D-PG1-10 name the omitted arm already writes through `excludeNameFor`, `convert.ts:119-126`) equals both, except for an adapter name over 64 characters, which the adapter cuts and pi-subagents does not. `test/integration/agents-adapter-grant-conformance.test.ts` already measures that mismatch. Use the same `excludeName` and record the long-name case under AGTLONGNAME-01.

**Recommended change.** `ExplicitDisallow.perTool` gains the exclude name; for each per-tool deny whose server selector survives in `kept`, the name goes to `excludeTools` in place of the warning. `GeneratedToolsFields` becomes two arms: explicit (`tools`, optional `excludeTools`, no `allowNestedSubagents`) and omitted (no `tools`, optional `excludeTools`, optional `allowNestedSubagents`).

### R4. Pi's `parseFrontmatter` and the home of the repair

[VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/utils/frontmatter.js, read this session; probe P3]

- **Contract.** The function strips one byte-order mark, turns CRLF and CR into LF, and needs the text to start with `---`. The block ends at `indexOf("\n---", 3)`. With no closing fence it returns `{ frontmatter: {}, body: <whole text> }`. It then calls `yaml`'s `parse` and returns `frontmatter: parsed ?? {}` and `body: normalized.slice(endIndex + 4).trim()`.
- **It throws on invalid YAML** and catches nothing. Probe P3 errors: `Nested mappings are not allowed in compact mappings` (unquoted colon), `Map keys must be unique` (a repeated key), `Alias cannot be an empty string` (`tools: *`), `Plain value cannot start with reserved character @`, `Block scalar values in collections must be indented` (a tab-indented block).
- **Return types.** Booleans (`background: true`, also `True`), numbers (`name: 123`, `effort: 32000`, `1.0` becomes `1`), `null` (`key:` and `~`), strings (`yes` stays a string), arrays (block and flow sequences), nested objects, and an own `__proto__` key. A document that is not a mapping returns a string or an array in `frontmatter`.
- **The criteria cases** (probe P3): `description: "Reviews: code."` gives `Reviews: code.`; `name: "x"` gives `x`; `tools: Read # note` gives `Read`; `description: |` gives `First line.\nSecond line.\n`; the unquoted `Reviews: code and tests` with `model: "sonnet"` fails the first parse, and after the repair gives both values right.
- **Flow sequence with a type list.** `tools: [Read, Agent(a, b)]` parses to `["Read","Agent(a","b)"]`. Joining with `,` gives `Read,Agent(a,b)`, which `topLevelParts` splits correctly because it tracks parentheses. D-PG7-05's join rule covers this case.
- **The repair's real trigger.** A line is repaired when its value is not empty, does not start with a quote, `[`, `{`, `|`, or `>`, contains a `:` anywhere, and spans one line (`repairableScalar`, `frontmatter-degrade.ts:159-171`, with `UNREPAIRABLE_VALUE = /^["'[{|>]/` at `:150`). That is a little wider than the "unquoted `: `" of D-PG7-02: a value such as `Bash(git log:*)` is quoted too, but only after the first parse has already failed.
- **How the skills bridge handles the throw.** `bridges/skills/stage.ts:233-256` parses; on a throw it calls `repairUnparseableFrontmatter` (`:97-108`), which returns nothing when the repair changed no byte or the second parse throws. The last arm degrades the skill. The skills bridge strips the byte-order mark before all of this (`:359`), because the repair's `OPENING_FENCE = /^---[ \t]*\r?\n/` is anchored (`frontmatter-degrade.ts:144`).

**Where the repair can live.** `.fallowrc.json` allows `bridges-agents` and `bridges-skills` to import `domain`, `persistence`, `shared`, and `platform` (`:103-126`), and `shared` to import `platform` (`:144-147`). ESLint BLOCK C says the same for `shared/` (`eslint.config.js:254-265`), and `shared/notification-run.ts:1` already imports a value from `platform/pi-api.ts`. The functions the repair needs import nothing:

| Function | Today | Imports | Used by |
| --- | --- | --- | --- |
| `frontmatterBlockEnd` | `bridges/skills/frontmatter-scan.ts:23-31` | none | repair, `setDescriptionScalar`, `rewrite-frontmatter.ts`, `skill-names.ts` |
| `keyValueEnd` | `frontmatter-scan.ts:62-87` | none | repair, `setDescriptionScalar`, `topLevelNodeIndex` |
| `emitSafeDoubleQuotedScalar` | `frontmatter-degrade.ts:89-93` (private) | none | repair, `setDescriptionScalar` |
| `repairSingleLineScalars` | `frontmatter-degrade.ts:203-228` | the three above | `bridges/skills/stage.ts:98` |
| `extractBodyAfterFrontmatter` | `bridges/skills/stage.ts:79-83` (private) | none | skills degrade arm; the agents D-PG7-04 arm needs the same text |

**Recommendation.** Create `shared/frontmatter-repair.ts` with these five functions exported, and its owner test `test/shared/frontmatter-repair.test.ts`. `topLevelNodeIndex` and `nodeKeys` stay in `bridges/skills/frontmatter-scan.ts` (they import `parseFrontmatter` and a skills error). Move the test cases of the moved functions out of `test/bridges/skills/frontmatter-degrade.test.ts` and `frontmatter-scan.test.ts` unchanged. Moving `extractBodyAfterFrontmatter` avoids a second copy that `fallow dupes` would report.

### R5. A quoted name today, and what update and reinstall remove

[VERIFIED: files read this session]

- **Today.** `discover.ts:141-144`: `const sourceName = raw.name ?? stem;`, then `assertSafeName`, then `generatedAgentName`. `assertSafeName` refuses only an empty name, `.` and `..`, `/` and `\`, and ASCII control characters (`domain/name.ts:35-66`). So `name: "x"` passes with its quote marks: generated name `pi-claude-marketplace-demo-"x"`, file `pi-claude-marketplace-demo-"x".md`, declared name `demo:"x"`.
- **After the change.** The name is `x`: generated name `pi-claude-marketplace-demo-x`, declared name `demo:x`.
- **Update and reinstall.** Both run the shared swap (`update-swap.ts:485` prepare, `:1341` commit; `reinstall-flow.ts:408` through `materialize-latest.ts`). `prepareStagePluginAgents` takes every index row the plugin owns as `previousEntries` (`stage.ts:149-154`), whatever names the new discovery finds. `commitPreparedAgents` removes each replaced row's file (`stage.ts:446-456`), renames the new files in, and saves `[...otherEntries, ...newEntries, ...previous.kept]` (`:482-485`). The record gets `sRecord.resources.agents = handles.agents.result.recorded.map((r) => r.generatedName)` (`update-swap.ts:888-889`).
- **When it happens.** `reinstall` always. `update` only when the marketplace offers another revision (an up-to-date plugin is skipped, as the existing scenario "An installed ordinary agent adopts the delegated preference on update" shows). `apply` when it moves the plugin.
- **Residual 1.** An old file the user edited fails the ownership check, so its file and row stay (AG-5, `stage.ts:195-211`). `reinstall`'s force replaces such a row only when this staging produces the same name at the same path (`partitionPreviousEntries`, `stage.ts:326-346`); a renamed agent's edited old file stays. Document it; do not add code.
- **Residual 2.** The new target `pi-claude-marketplace-demo-x.md` is refused when a file no row names already sits there (`AgentTargetOccupiedError`, `stage.ts:369-373` and `target-check.ts:47-52`). That is the existing PI-6 rule.
- **Residual 3.** A plugin with both `name: "x"` and `name: x` had two agents and now has one; the first discovered wins and the other gets the AG-12 duplicate warning.

### R6. The two warning strings and the MCP async warning

[VERIFIED: grep over `extensions`, `test`, `features`, `docs`, `README.md`, `CHANGELOG.md`, and `scripts`, this session]

| Text | Produced | Compared at run time | Stored | Tests and docs |
| --- | --- | --- | --- | --- |
| `` `excludeTools` requires pi-subagents >= 0.62.0 -- earlier versions ignore it and keep the default tool set `` | `convert.ts:607-611` | nowhere | provenance of old agent files; `warnings` and `mcpForms.*.warnings` of old index rows; stored frontmatter blocks | `test/bridges/agents/convert.test.ts:28,1430,1568,2122,2172,2487`; `CHANGELOG.md:402` (history, leave); `docs/prd/pi-claude-marketplace-prd.md:470` |
| `disallowedTools entry <tool> cannot narrow the whole-server grant <server> -- pi-subagents takes no excludeTools beside an explicit tools: list, so the agent keeps every tool of that server` | `convert.ts:542-552` | `legacy-grant-form.ts:48,85-101` by its own constant `NARROW_GRANT_LEAD = " cannot narrow the whole-server grant "` | same places | `convert.test.ts:2094,2942`; `test/bridges/agents/legacy-grant-form.test.ts:19-25` (its own copy of the old text) |
| MCP async warning, two generations | `mcp-async-warning.ts:12-35` | `grant-rewrite.ts` (`isMcpAsyncWarning`), `legacy-grant-form.ts` (`rewriteMcpAsyncWarning`) | same places | not touched by this phase |

What must keep recognizing old text:

- `legacy-grant-form.ts` stays as it is. It holds its own constant, so removing the producer in `convert.ts` does not break it, and its test keeps its own literal. It translates the selector inside an old cannot-narrow warning for a row an earlier release wrote.
- `grant-rewrite.ts` swaps a stored block with `startsWith`, byte for byte, and never reads either warning. An old row whose stored blocks hold the old warnings still swaps.
- No file in `features/` names either warning, and `docs/output-catalog.md` has no row for either. `docs/mcp-compatibility.md` does not quote them.

### R7. Consumers of `raw` and of the agents `parseFrontmatter`

[VERIFIED: grep and file reads this session]

| Consumer | Reads | Effect of YAML values |
| --- | --- | --- |
| `bridges/agents/discover.ts:138-142` | `parseFrontmatter(...)`, `raw.name` | The only production caller of the line reader. Gets the new reader, the empty-name fallback, and the unparseable warning. |
| `bridges/agents/convert.ts` | `raw.description`, `when_to_use`, `when-to-use`, `model`, `tools`, `disallowedTools`, `thinking`, `effort`, `skills`, `background`, `Object.keys(raw)` | Unchanged when `raw` stays string-typed. `isTrueBackground` (`:1090-1092`) already takes `true` as text. |
| `bridges/agents/skill-preload.ts:55` | `agent.raw.skills` | Unchanged; a sequence arrives joined. |
| `orchestrators/plugin/discover-names.ts:92-93,223` | `agent.raw.tools`, `agent.raw.disallowedTools` through `listedToolNames`; generated names | The PG-SEC-01 notes get cleaner input (`tools: Read # note` is now `Read`). No code change. |
| `orchestrators/plugin/info.ts:1288` | `discoverPluginAgents` for the same notes | No code change. `info` lists a not-installed plugin's agents by file name (`:343-353`), so a quoted name does not reach it. |
| `test/bridges/agents/convert.test.ts:11,2715-2719` | the line reader, to re-read generated files | Needs another reader or a text comparison when the line reader goes. |
| `test/bridges/agents/frontmatter.test.ts:10-581` | 18 cases of the line reader | Replaced by cases of the new reader. |

`features/lib/agent-files.ts`, `skill-preload.ts:24`, the commands bridge, and the orchestrators already use Pi's `parseFrontmatter`; none calls the agents line reader.

**Recommended value rules** (D-PG7-05 plus Summary finding 9). Apply them once, in the reader, so `RawAgentFrontmatter` keeps `string` for its known keys (`types.ts:24-34`) and `test/bridges/agents/types.test.ts:159` keeps its proof:

| YAML value | Result |
| --- | --- |
| document is not a mapping | no fields; no warning unless the parse threw (Assumption A2) |
| string | kept (the converter trims where it already does) |
| boolean, number | `String(value)` |
| `null` | `""`, as the line reader gives for `key:` |
| sequence under `tools`, `disallowedTools`, `skills` | items as strings, joined with `,` |
| mapping, or a sequence under another key | the key stays out of the known fields and is listed in `droppedFields` |
| `name` | `String(value).trim()`; empty falls back to the file stem; then `assertSafeName` |
| any key | copied with `setOwn` (`shared/own-key.ts:17`), so `__proto__` stays data |

### R8. The cucumber harness and the scenarios that change

[VERIFIED: features and step files read this session; probes P1, P2, P6]

**Steps that exist.**

- Fixtures: `the published plugin {string} of the marketplace {string} has these agents:` (`features/step_definitions/agent/listing.steps.ts:163-174`). Every column other than `file` and `body` is a frontmatter key, written as `key: value`; "Gherkin reads `\n` in a cell as a newline" (`features/lib/agent-files.ts:59-62`). So a cell `"x"`, `Read # note`, or `\|\n  First line.\n  Second line.` writes the source forms this phase needs. No new fixture step is needed.
- `subagent get` and `subagent list`: the scripted model calls the `subagent` tool (`{"action":"get","agent":"demo:x"}`, `{"action":"list","capabilities":true}`), and `the model receives these calls:` shows the projected result.
- File text: `the agents folder of the {word} scope holds the file {string} with this text:` and `the agents index of the user scope holds these rows:`.
- An earlier release's file: `... holds the file {string} as an earlier release wrote it, with this text:`.
- Child tools: `the agent's model call {int} is offered these of the tools an agent can name:` and `... is offered the tools an agent can name that the model call {int} is offered` (`features/step_definitions/agent/runs.steps.ts:80-100`). They compare only `AGENT_NAMEABLE_TOOLS` (`:24-32`: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`).

**A scripted child can make the nested call today.** The scripted model's script and call log live in the sandbox home, "so a Pi of a child agent, which shares that home, reads the same script and the same log" (`features/lib/scripted-model/script.ts:5-9`). Probe P2 ran, with existing steps only: parent call `subagent {"agent":"demo:lead","task":"Ask the helper.","async":false}`, child call `subagent {"agent":"demo:helper","task":"Say hello.","async":false}`, grandchild reply `Helper says hello.`, child reply `Lead got the hello.` The child's model call received `subagent returned: Helper says hello.` and the parent received `subagent returned: Lead got the hello.` It worked for a file with `tools: read,subagent` and for a file with `allowNestedSubagents: true` and no `tools`. Probe P6 shows the opposite case: a child without the tool cannot reach the helper (no helper call appears). So D-PG7-15's first option holds: scenarios carry the proof; no integration test of a real child is required. Constraints:

- The parent call and the nested call both set `"async": false`. Without it pi-subagents starts a background child and returns an acknowledgement, not the reply, and the harness cannot run the scripted model in a background child (BACKLOG AGTASYNC-01).
- The fixture plugin has no MCP server. An agent with no `tools` in a plugin with MCP servers gets `async: true`.

**The harness gap.** `projectDetail` (`features/lib/upstream/subagents.ts:216-246`) reads one `label: value` per line up to the first blank line. Probe P1: a description with a blank line fails with `cannot read pi-subagents' agent detail`; without the blank line only the first description line is shown. The plan changes this projection so a multi-line description shows its lines. Keep the scenario's description free of blank lines and of lines that look like a field, and put the hostile-line cases in the unit and integration tests.

**Scenarios whose expected output changes.**

| Scenario | File | What changes |
| --- | --- | --- |
| An ordinary bridged agent leaves its launch mode to pi-subagents | `features/agent/frontmatter.feature` | The pinned text of `pi-claude-marketplace-demo-plain.md` gains `allowNestedSubagents: true`. |
| An installed ordinary agent adopts the delegated preference on update | same | The two texts written by the new code gain the line; the "earlier release" texts stay. |
| An installed ordinary agent adopts the delegated preference on reinstall | same | Same. |
| With --map-model Claude Code's model names are listed as the models they select | same | The `demo:inherit` line gains `; model inherit`. |
| Tool lists split on commas and spaces as Claude Code splits them | same | Unchanged only if `tools: *` still parses (Summary finding 2); otherwise `demo:starred` would list as `Agent from demo plugin`. |
| A run of an agent without a tools list offers the child the tools the session has | `features/agent/invocation.feature:246-267` | Unchanged as written. If `subagent` joins `AGENT_NAMEABLE_TOOLS`, this scenario fails before the change and passes after it, which makes it the best proof for the omitted-`tools` case. |
| Installing an agent granted a plugin MCP tool stages it to run in the background (D-CF6-10) | `features/mcp-server/agent-grants.feature:403-443` | Unchanged (explicit `tools`, no deny). |

**Scenarios to add** (titles are the writer's; each names the behavior it proves):

1. PG-AGENT-05, `features/agent/frontmatter.feature`: quoted description and quoted name list without quote marks; the unquoted-colon description with `model: "sonnet"` under `--map-model`; `tools: Read # note` grants `read` alone; a `description: |` block keeps its lines in `subagent get` and in the staged file.
2. PG-AGENT-05, same file: an agent whose frontmatter does not parse installs under its file name with the fallback description, and the install reports the note.
3. PG-AGENT-05 (D-PG7-07), same file: an agent an earlier release installed under a quoted name is renamed by `reinstall` and by `update` to a newer version; the old file, its index row, and the old record name are gone.
4. PG-AGENT-03, `features/agent/frontmatter.feature`: `subagent get` shows `tools ..., subagent` for `Agent`, `Agent(demo:helper)`, `Task`, and `Task(a, b)`, shows no `subagent` when `disallowedTools` names `Agent` or `Task`, and the staged file of an agent with no `tools` holds `allowNestedSubagents: true`.
5. PG-AGENT-03, `features/agent/invocation.feature`: a scripted child of an agent that grants `Agent(demo:helper)` calls the helper and gets its reply; the same for an agent with no `tools`; a child of an agent that denies `Agent` does not reach the helper.
6. PG-AGENT-07a, `features/agent/frontmatter.feature`: `subagent get` shows `model inherit` without `--map-model` (and the changed `--map-model` scenario shows it with the flag).
7. PG-AGENT-09, `features/mcp-server/agent-grants.feature`, one `@adapter-only` and one `@builtin-only` scenario: an agent with `tools: mcp__plugin_demo_stub, Read` and `disallowedTools: mcp__plugin_demo_stub__echo` lists both `tools` and `excluded tools`, and its staged file's `warnings:` holds only the MCP async warning. The selectors differ by implementation (`mcp:plugin_demo_stub_` and `mcp:plugin_demo_stub`), so one `@mcp` scenario cannot serve both.
8. PG-AGENT-09, `features/agent/frontmatter.feature`: an `apply` that restages an agent with no `tools` and `disallowedTools: Bash` reports no staging warning, where today it reports the 0.62.0 line. The scenario "Apply reports each plugin agent field Claude Code also ignores" is the model for the steps.

### R9. Documentation that changes

[VERIFIED: files read this session]

- `docs/mcp-compatibility.md`, section "Customizing generated agents" (`:374-453`). It holds the "three conversion rules". Add: frontmatter is read as YAML with the colon repair and what stays unrepaired; an agent whose frontmatter cannot be parsed; `Agent` and `Task` grants, the `allowNestedSubagents` key, and that the type list is not applied; the depth of 2 against Claude Code's 3; `model: inherit`; `excludeTools` beside `tools`; and that a quoted name changes the file name at the next update or reinstall. Line 380 lists the tools a foreground child of an agent with no `tools` is offered (`read`, `bash`, `edit`, `write`, `bg_wait`, `contact_supervisor`); that child now also gets `subagent`, so re-measure the sentence.
- `docs/mcp-compatibility.md`, section "Divergences and documented absences" (`:613` onward): add the depth divergence (D-PG7-10) and the repair residual (D-PG7-02).
- `README.md:379`, the note on models: it says "This extension discards these models by default". Add that `model: inherit` is always kept. `README.es.md` holds the same note and must change with it (`readme` skill).
- `README.md:27`, the agents bullet: a short mention that an agent can start subagents is optional.
- `docs/output-catalog.md`: no row exists for either removed warning. Add a row only for the new unparseable-agent note, in the catalog's form for a per-plugin diagnostic.
- `docs/prd/pi-claude-marketplace-prd.md:459-476` (AG-7 detail) still describes the state before D-PG1-04 and D-PG3-01 (`anthropic/` IDs, `async: false`). Earlier phases of this milestone did not update it. Leave it unless the maintainer asks; say so in the plan summary.
- `.planning/BACKLOG.md:4620-4622`, AGTEXCL-01. Its text: "Emit `excludeTools` beside an explicit `tools:` list for a per-tool MCP disallow, and reword the stale ANAME-02 warning ... The warning is user-visible, so the change needs a cucumber scenario. It touches MCP-07 (D-CF6-07, D-CF6-10)." Closing it is a parent-owned edit. This phase removes the warning instead of rewording it, because the limit it stated is gone.
- `CHANGELOG.md:402` describes the 0.62.0 warning in a past release. It is history; do not edit it.

### Suggested plan slices

The slices touch the same three source files and the same feature file, so they run in sequence, not in parallel.

1. **Shared repair module.** Move the five functions to `shared/frontmatter-repair.ts`, add the trigger parameter (skills pass the colon rule), move their test cases, and update the skills imports. No behavior change; `npm run check` proves it.
2. **YAML reader (PG-AGENT-05).** New reader and normalizer in `bridges/agents/frontmatter.ts`; `discover.ts` name rule and unparseable note; the `|-` emitter; removal of the line reader and its tests; the harness projection; scenarios 1-3; the integration case against pi-subagents' own parser.
3. **Grants and model (PG-AGENT-03, -07a, -09).** `TOOL_MAP`, `allowNestedSubagents`, `model: inherit`, `excludeTools` beside `tools`, removal of the two warnings, `GeneratedToolsFields`; scenarios 4-8; the launch conformance cases.
4. **Documentation.** The sections of R9, in the plan of the behavior they describe or as the last plan.

### Anti-Patterns to Avoid

- **Emitting a double-quoted description with escapes.** pi-subagents strips the quotes and keeps the backslashes. `emitSafeDoubleQuotedScalar` is for text that Pi's YAML parser reads back (the repair, skills), never for the generated agent file.
- **Falling back to the line reader for a file that does not parse.** PRD section 7.7 rejected it; D-PG7-01 repeats it.
- **Writing `allowedAgents` from the `Agent(x, y)` list.** Upstream ignores the list in a subagent (D-PG7-08), and the key removes ambient MCP tools (Summary finding 10).
- **Writing `allowNestedSubagents` beside an explicit `tools` list.** It would grant nesting to an agent whose list has no `Agent`.
- **Writing an explicit `tools` list for an agent that omits `tools`, to make `subagent get` show `subagent`.** It would cut the ambient and default tools the agent has today.
- **Typing `raw` as `unknown` values and narrowing in every consumer.** Normalize once in the reader.
- **A second copy of the fence or body helpers in the agents bridge.** `fallow dupes` fails on every clone group.
- **Changing `legacy-grant-form.ts` or `mcp-async-warning.ts`.** Stored text is matched byte for byte.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| --- | --- | --- | --- |
| YAML parsing | A wider line reader, or a direct `yaml` import | `parseFrontmatter` from `platform/pi-api.ts` | It is what Pi, the skills bridge, and the commands bridge read with; the `pi-peer-chokepoint` rule bans another door. |
| Colon repair | An agents-only repair | The moved `repairSingleLineScalars` | One rule for both bridges; it already excludes quoted values, flow collections, block headers, and multi-line scalars. |
| Body of an unparseable file | A new fence search | The moved `extractBodyAfterFrontmatter` | It reproduces Pi's own split, so both arms agree on where the block ends. |
| Safe names | A new character filter | `assertSafeName`, `generatedAgentName`, `declaredAgentName` (`domain/name.ts`) | They refuse separators and control characters, which a YAML string can now hold. |
| Registered MCP tool name for `excludeTools` | String building in the converter | `excludeNameFor` / `profileFor(id).toolName` (`convert.ts:119-126`) | D-PG1-10; conformance-tested against both implementations. |
| Own-key writes | `raw[key] = value` | `setOwn` (`shared/own-key.ts:17`) | A YAML `__proto__` key with a mapping value would otherwise become the prototype of `raw`. |
| Removing a renamed agent | A migration or a sweep | The owner-row removal in `commitPreparedAgents` | It already removes every row the plugin owns. |
| A real-child run for the nested call | A new harness | The scripted model with a foreground child | Probe P2 ran it with existing steps. |

**Key insight:** the generated agent file has exactly one reader that matters, pi-subagents' line reader. Every emit decision is checked against that reader, not against YAML.

## Runtime State Inventory

This phase renames an artifact (the file of an agent with a quoted name) and changes the bytes of generated agent files.

| Category | Items found | Action required |
| --- | --- | --- |
| Stored data | `<scopeRoot>/agents/pi-claude-marketplace-<plugin>-"x".md`; `agents-index.json` rows (`generatedName`, `targetPath`, `warnings`, `mcpForms.*.frontmatter` blocks that hold the old forms and the two old warnings); `state.json` `resources.agents` names | None at load (APL-D1). The next `reinstall`, the next `update` to another revision, or an `apply` move replaces them through code that exists (R5). The plan proves it with scenario 3. |
| Live service config | A user's pi-subagents `subagents.agentOverrides` entry in `settings.json`, keyed by the old name of a quoted-name agent (`pi-claude-marketplace-demo-"x"` or `demo:"x"`) | Not migrated; it is the user's file. State it in the compatibility text. The PRD counts no quoted name in 40 sampled agents. |
| OS-registered state | None. Verified: the bridge registers nothing with the OS. | None |
| Secrets and env vars | None. Verified: no key or variable name changes. | None |
| Build artifacts | None. Verified: no build step; `node_modules/.cache/optional-peers` holds companions, not output of this code. | None |

Old files that are not rewritten keep working: pi-subagents reads `async: false`, the old tool lists, and a one-line description as before, and the session-start grant rewrite swaps stored blocks byte for byte.

## Common Pitfalls

### Pitfall 1: `tools: *` is not YAML

**What goes wrong:** the agent loses its name, description, and every other field, and the `starred` row of an existing scenario changes.
**Why it happens:** `*` opens an alias. The colon repair does not see the line.
**How to avoid:** Summary finding 2. Add a unit case and keep the `starred` scenario green.
**Warning signs:** `demo:starred` lists as `Agent from demo plugin`.

### Pitfall 2: the repair quotes a trailing comment

**What goes wrong:** when another line breaks the first parse, a line such as `tools: Bash(npm run:*) # c` is quoted whole, and `#` and `c` become dropped tools (probe P3).
**Why it happens:** the repair runs on every eligible line with a colon, and quoting keeps the comment text.
**How to avoid:** accept it; upstream's retry quotes the whole value too. Do not write a test that expects the comment to vanish on the repair path. Record it with the D-PG7-02 residual.

### Pitfall 3: strict YAML where the line reader was lenient

**What goes wrong:** a repeated key, a tab-indented block, or a description that starts with `[` or `{` makes the file unparseable, and the agent loads with every tool (D-PG7-04).
**Why it happens:** `yaml` refuses them; today's reader took the last value or the raw text.
**How to avoid:** this is the locked upstream-parity rule. Make the note visible on a standalone install (Summary finding 7) and word it so the loss of the tool restriction is clear. List these forms in the compatibility text.

### Pitfall 4: the description header forms pi-subagents does not know

**What goes wrong:** a one-line description whose whole text is `|`, `|-`, `>`, or `>-` opens a block in pi-subagents and swallows the next keys.
**Why it happens:** a YAML source `description: "|"` now gives the bare character; the line reader kept the quotes.
**How to avoid:** in `emitYamlScalar`, wrap such a value in quotes (pi-subagents strips them and stores the character). Add the four cases to the emitter test.

### Pitfall 5: body bytes

**What goes wrong:** generated files differ from today's for a source with CRLF line ends, several trailing blank lines, or leading spaces on the first body line.
**Why it happens:** Pi's `parseFrontmatter` returns a trimmed, LF-only body; the line reader kept the bytes after one leading newline.
**How to avoid:** take the body from Pi on the parsed arm (one definition of where the block ends) and accept the change: pi-subagents trims the body itself (`src/agents/frontmatter.js:83`), so the child's prompt is the same. Update the body cases of the reader test; do not keep two splitters.

### Pitfall 6: the wrong command for a hygiene warning

**What goes wrong:** a scenario asserts that `install` "does not print" a warning that `install` never printed, so it passes before the change.
**How to avoid:** Summary finding 6. Use `apply` or the staged file's `warnings:` list.

### Pitfall 7: `subagent get` and an agent with no `tools`

**What goes wrong:** a scenario waits for `tools ..., subagent` in `subagent get` for an agent with no `tools`.
**How to avoid:** Summary finding 4. Use the nested call and the staged file line.

### Pitfall 8: background launch in the nested scenario

**What goes wrong:** the child's nested call returns a background acknowledgement, or the fixture's agent is forced to `async: true`.
**How to avoid:** set `"async": false` on both calls and give the fixture plugin no MCP server (R8).

### Pitfall 9: complexity and clone gates

**What goes wrong:** `convertAgentOrEmpty`, `mapTools`, or the new reader passes one cognitive-complexity gate and fails the other; a copied helper fails `fallow dupes`.
**How to avoid:** one small function per rule (the normalizer per value kind, the nested key decision, the exclude list), and the shared module for anything both bridges need. Run `npm run check:static` after each task.

### Pitfall 10: tests that re-read generated files with the line reader

**What goes wrong:** `test/bridges/agents/convert.test.ts:2715-2719` stops compiling when the line reader is deleted.
**How to avoid:** compare the frontmatter blocks as text, or parse with pi-subagents' own reader in the integration suite.

### Pitfall 11: profile coverage

**What goes wrong:** a new scenario with no tag runs under the adapter profile only.
**Why it happens:** the `builtin` profile runs `(@mcp or @builtin-only) and not @adapter-only` (`cucumber.json`).
**How to avoid:** only the PG-AGENT-09 MCP scenarios differ by implementation; write the pair as R8 scenario 7 does. `npm run check:features` checks the tags.

### Pitfall 12: the soft-dependency probe inside a fan-out child

**What goes wrong:** nothing breaks, but a reader may be surprised: `platform/pi-api.ts:238` treats a registered `subagent` tool as "pi-subagents loaded", and a background child with nested delegation now has that tool.
**How to avoid:** no change is needed; a background child changes no installation state (D-MB-12). Do not build on that probe inside a child.

## Code Examples

Skeletons only. Names are the planner's. Each literal below is quoted from a source read this session: `subagent` and `allowNestedSubagents` (pi-subagents `child-tool-plan.js:216-218`), `excludeTools` (`frontmatter.ts:553-554`), `inherit` (`convert.ts:319`), `|-` (pi-subagents `frontmatter.js:123`).

### Reader: parse, repair once, then no fields (D-PG7-01, D-PG7-04)

```ts
// bridges/agents/frontmatter.ts
function parseSource(text: string): { parsed: PiParsed } | { parseError: string } {
  try {
    return { parsed: parseFrontmatter(text) };
  } catch (first) {
    const repaired = repairSingleLineScalars(text, AGENT_REPAIR_TRIGGER);
    if (repaired !== text) {
      try {
        return { parsed: parseFrontmatter(repaired) };
      } catch {
        // The first error names the author's defect.
      }
    }

    return { parseError: errorMessage(first) };
  }
}
```

The caller strips the byte-order mark first, builds `raw` from a mapping with the R7 rules, and on `parseError` returns no fields, the body from `extractBodyAfterFrontmatter`, and the error for the discovery note.

### Emitter: one line or a literal block (D-PG7-06, AG-8)

```ts
function emitDescription(value: string): string {
  const lines = value.split(/\r\n|\r|\n/);
  if (lines.length === 1) {
    return `description: ${emitYamlScalar(value)}`;
  }

  // pi-subagents reads `|-` as a literal block and takes every indented or
  // empty line, so no line of the value can start a key or close the block.
  return ["description: |-", ...lines.map((line) => (line === "" ? "" : `  ${line}`))].join("\n");
}
```

The value arrives trimmed, so its first line has no leading white space.

### Tool fields: the two arms (D-PG7-09, D-PG7-12)

```ts
export type GeneratedToolsFields =
  | {
      readonly tools: readonly [string, ...string[]];
      readonly excludeTools?: readonly [string, ...string[]];
      readonly allowNestedSubagents?: never;
    }
  | {
      readonly tools?: never;
      readonly excludeTools?: readonly [string, ...string[]];
      readonly allowNestedSubagents?: true;
    };
```

The emitter writes `allowNestedSubagents: true` after `excludeTools`. In the omitted arm the converter sets it when `excludeTools` does not hold `subagent`.

### Model: `inherit` before the flag (D-PG7-11)

```ts
function mapModel(raw: string | undefined, mapFlag: boolean): ModelMapping {
  const value = raw?.trim() ?? "";
  if (value.toLowerCase() === "inherit") {
    return { emit: "inherit", originalModel: raw, warning: undefined };
  }

  return mapFlag ? mapAliasOrId(raw, value) : NO_MODEL;
}
```

Whether `originalModel` is recorded for `inherit` without the flag is the planner's choice; recording it gives the same file with and without `--map-model`, which makes criterion 4 one comparison.

### Launch conformance case (PG-AGENT-09), in the style of the existing file

```ts
// test/integration/pi-subagents-child-launch-conformance.test.ts
const child = launch.buildInProcessChildLaunch({
  ...runnerInput(cwd),
  tools: ["read"],
  mcpDirectTools: ["plugin_demo_stub_"],
  excludeTools: ["mcp__plugin_demo_stub__drop"],
});
assert.deepStrictEqual(child.session.tools, ["read", "mcp__plugin_demo_stub__echo"]);
```

Probe P5 returned exactly this for a cached server with tools `echo` and `drop`. Derive the three inputs from `convertAgent` output, as `agents-adapter-grant-conformance.test.ts:30-55` does, so the test fails when the bridge writes another name.

## State of the Art

| Old approach | Current approach | When changed | Impact |
| --- | --- | --- | --- |
| Line reader for source agents, values verbatim | Pi's YAML parser with one colon repair | This phase | Quoted values, comments, sequences, and block scalars read as upstream reads them. |
| Multi-line description flattened to one line | `description: \|-` literal block | This phase | pi-subagents 0.87.0, the declared floor, reads `\|` and `\|-` with the same code as 0.88.1 (probe P7); the comment at `frontmatter.ts:26-30` that says otherwise is out of date. |
| `tools` and `excludeTools` never together | Both keys allowed | This phase; pi-subagents applies `excludeTools` beside `tools` since 0.62.0 | Closes AGTEXCL-01. |
| `Agent` and `Task` dropped | `subagent` tool or `allowNestedSubagents: true` | This phase; pi-subagents has both since 0.59.0 | Bridged agents can delegate one layer. |
| `model: inherit` writes no line | `model: inherit` always | This phase | `subagents.defaultModel` no longer overrides the source. |

**Out of date in the tree:**

- `convert.ts:535-541` and `:565-577` (comments on the two warnings) and `frontmatter.ts:13-36,44-54,409-424,481-485` (header text on the line reader, the one-line rule, and "never both"): rewrite with the code they describe.
- `docs/research/parity-gaps/subagents.md` note 13 and the PRD's AGENT-05 note: CONTEXT already corrects them; they are research records and stay.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
| --- | --- | --- | --- |
| A1 | Claude Code reads an explicit empty `tools:` (YAML null) as "no tools", not as "every tool", so mapping null to the empty string (which keeps today's AG-11 refusal) is parity. From training memory of Claude Code's agent loader, not checked this session. | R7 value rules | A plugin agent with an empty `tools:` key would fail the install where upstream gives it every tool. One-line change in the normalizer. |
| A2 | Claude Code treats frontmatter that parses to something other than a mapping as no frontmatter, with no warning. | R7 value rules | The note for such a file would be missing or extra. Low: the outcome (no fields) is the same either way. |
| A3 | The YAML parser inside Claude Code refuses a repeated key and a tab-indented block as `yaml` 2.9.1 does. CONTEXT notes the embedded parser may differ. | Pitfall 3 | An agent that loads with its fields upstream would load without them here. The note makes it visible. |
| A4 | In a Gherkin table cell, `\|` is a literal pipe and leading spaces after `\n` are kept, so the existing agents step can write a `description: \|` block. | R8 | The fixture needs the `has the file ... with this text:` step with a doc string. That step exists. |
| A5 | When `subagent` joins `AGENT_NAMEABLE_TOOLS`, the parent and the child offer it in the same relative order to the other nameable tools. | R8 | The "offered the tools ... that the model call is offered" step would need an order-free comparison. |
| A6 | `docs/output-catalog.md` wants a row for the new unparseable-agent note. D-PG7-16 says "warning rows removed or added"; no row exists for any agent conversion warning today. | R9 | A missing or unwanted catalog row; review decides. |

## Open Questions

1. **How wide should the agents repair trigger be?**
   - What we know: the colon rule alone breaks `tools: *`, and values that start with `@` or a backtick (probe P3). Upstream quotes a value that contains any of a wider set.
   - What is unclear: whether the maintainer wants only `*` (the pinned case), the reserved-start set, or upstream's full set.
   - Recommendation: the reserved-start set (`*`, `&`, `!`, `%`, `@`, backtick) for agents only, through a trigger parameter. It fixes every single-line failure in probe P3 except a value that starts with `[` or `{`. Keep the rest as the D-PG7-02 residual and its BACKLOG entry.

2. **Where does the unparseable-agent note go besides the install diagnostic?**
   - What we know: a discovery warning reaches every staging verb. It is not written to the agent file's provenance, which only converter warnings reach.
   - Recommendation: discovery only. Adding the same text as a converter warning would print it twice in `apply`.

3. **How is criterion 3's wording handled for an agent with no `tools`?**
   - What we know: `subagent get` cannot show it (Summary finding 4).
   - Recommendation: the plan states the evidence it uses (nested call, staged file line, offered-tools step) and lists the clause as an override candidate, so the verifier does not read it as a gap.

4. **Does the D-PG7-04 rule fit the maintainer's "fail closed on corrupt data" preference?**
   - What we know: the rule is upstream parity and already pending review. An unparseable agent gets every tool and, with this phase, nested delegation.
   - Recommendation: keep the locked rule, make the note say what was lost, and carry the question in the review list. No plan task depends on the answer.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
| --- | --- | --- | --- | --- |
| Node, npm | Everything | Yes | v26.13.1 | None needed |
| Optional-peer cache | Scenarios, conformance tests | Yes (installed this session with `node scripts/install-test-peers.mjs`) | pi-subagents 0.88.1, pi-mcp-adapter 7.0.1, pi-dynamic-workflows 3.15.0 | The npm test scripts install it |
| Cucumber harness with scripted model | All scenarios | Yes | Probes P1, P2, P6 ran in 18 to 35 s each | None needed |
| Pi 1.5.0 with `yaml` | The reader | Yes | Pi 1.5.0, `yaml` 2.9.1 | None needed |
| GSD tooling in the worktree | Planning records | Yes | `.claude/gsd-core/bin/gsd-tools.cjs` | None needed |
| Network | Nothing in this phase (probe P7 fetched one public tarball) | Not needed | none | none |

**Missing dependencies with no fallback:** none.

## Validation Architecture

`workflow.nyquist_validation` is `true` and `workflow.test_command` is `npm run check`. [VERIFIED: .planning/config.json]

### Test Framework

| Property | Value |
| --- | --- |
| Framework | `node:test` owner tests; Cucumber 13.3.0 scenarios under the `adapter` and `builtin` profiles |
| Config file | `cucumber.json`; no runner config for `node:test` |
| Owner test | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>` |
| Pair coverage | `npm run test:coverage:direct -- <source-or-test-path>` |
| Integration file | `node scripts/install-test-peers.mjs && node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test/integration/file>` |
| One scenario | `npx cucumber-js --profile <adapter\|builtin> --name '<scenario title>'` |
| Feature paths | `npm run test:cucumber:profile -- --profile <adapter\|builtin> <feature paths>` |
| Static gate | `npm run check:static` (type check, ESLint, fallow, Prettier, pairing, `check:features`) |
| Full gate | `npm run check` |

### Phase Requirements → Test Map

"Fails without the change" is the failure direction each check must have.

| Req ID | Behavior | Type | Owner (file) | Automated command | Fails without the change because | File exists? |
| --- | --- | --- | --- | --- | --- | --- |
| PG-AGENT-05 | Repair with a trigger parameter; fence, span, scalar, and body helpers; the skills cases unchanged | unit | `test/shared/frontmatter-repair.test.ts` | owner test and pair coverage | The module does not exist; the moved cases are the regression net for skills | New (Wave 0) |
| PG-AGENT-05 | Skills still parse, repair, and degrade as before | unit | `test/bridges/skills/{frontmatter-degrade,frontmatter-scan,stage}.test.ts` | owner tests | A changed trigger or import would change a staged skill | Yes; cases move out, the rest stay |
| PG-AGENT-05 | Reader: quoted values, comment, block and folded scalars, sequences, flow sequence with `Agent(a, b)`, booleans, numbers, null, mapping, `__proto__`, non-mapping document, byte-order mark, repair arm, both-parses-fail arm, `tools: *` | unit | `test/bridges/agents/frontmatter.test.ts` | owner test and pair coverage | The line reader keeps quote marks, reads `#` as a value, and has no failure arm | Yes; the reader block is rewritten |
| PG-AGENT-05 | Emitter: one-line bytes unchanged; `\|-` block; hostile lines (`name: x`, `---`, `# c`, blank); the four header characters | unit | `test/bridges/agents/frontmatter.test.ts` | owner test | A multi-line value is flattened to one line | Yes, extend |
| PG-AGENT-05 | The block description survives pi-subagents' own reader and injects no key | integration | `test/integration/provenance-invisibility.test.ts` (or a sibling file) | integration file command | pi-subagents returns one flattened line | Yes, extend |
| PG-AGENT-05 | Name: quoted, numeric, empty falls back to the stem, unsafe refused; unparseable file gives the note and the stem name | unit | `test/bridges/agents/discover.test.ts` | owner test | `sourceName` holds the quote marks; no note exists | Yes, extend |
| PG-AGENT-05 | Criteria 1 and 2 through `subagent get`, `subagent list`, and the staged file | cucumber | `features/agent/frontmatter.feature` | one-scenario command | `demo:"x"`, quote marks in the description, `unknown model`, `#` and `note` dropped, one-line description | Feature exists; scenarios new |
| PG-AGENT-05 | Multi-line description in the projected `subagent get` | harness | `features/lib/upstream/subagents.ts` | exercised by the scenario above | The projection drops every line after the first (probe P1) | Yes, change |
| PG-AGENT-05 | Unparseable agent installs with the note | cucumber | `features/agent/frontmatter.feature` | one-scenario command | Today the line reader never fails | Scenario new |
| PG-AGENT-05 | Quoted-name agent renamed at `reinstall` and `update`; nothing old stays (D-PG7-07) | cucumber | `features/agent/frontmatter.feature` | one-scenario command | The agent keeps `demo:"x"` and its file name | Scenario new; steps exist |
| PG-AGENT-03 | `Agent`, `Task`, with and without a list, map to `subagent`; deny by either name; `tools: Agent` alone is valid; omitted arm sets the nested key unless denied; no key beside an explicit list | unit | `test/bridges/agents/convert.test.ts` | owner test and pair coverage | The tokens land in `droppedTools`; no key is written | Yes, extend |
| PG-AGENT-03 | The key is emitted in order and typed per arm | unit | `test/bridges/agents/frontmatter.test.ts`, `types.test.ts` | owner tests | The type forbids the key | Yes, extend |
| PG-AGENT-03 | pi-subagents authorizes fan-out for the written keys and keeps ambient MCP tools | integration | `test/integration/pi-subagents-child-launch-conformance.test.ts` | integration file command | A wrong key name or value gives `fanoutChild: false` | Yes, extend |
| PG-AGENT-03 | `subagent get` shows `subagent` for the four grant forms, not for a denied one; the staged file of an agent with no `tools` holds the key | cucumber | `features/agent/frontmatter.feature` | one-scenario command | `tools read` only; no key | Scenario new |
| PG-AGENT-03 | A scripted child calls `subagent({agent: "demo:helper"})` and gets the reply; a denied child does not reach the helper | cucumber | `features/agent/invocation.feature` | one-scenario command | The child has no `subagent` tool, so no helper call appears (probe P6 shows this shape) | Scenario new; steps exist |
| PG-AGENT-07a | `inherit` in any case emits `model: inherit` with and without the flag; other values unchanged | unit | `test/bridges/agents/convert.test.ts` | owner test | No `model` line | Yes, extend |
| PG-AGENT-07a | `subagent get` shows `model inherit` without `--map-model`; the list shows it with the flag | cucumber | `features/agent/frontmatter.feature` | one-scenario command | No model value is shown | One scenario new, one changed |
| PG-AGENT-09 | Per-tool MCP deny under a kept whole-server grant goes to `excludeTools` in the registered name, per implementation; exact names still filtered; both warnings absent | unit | `test/bridges/agents/convert.test.ts`, `grant-forms.test.ts` | owner tests | The cannot-narrow warning is returned and no `excludeTools` | Yes; six pinned warning cases change |
| PG-AGENT-09 | Old stored text still translates and swaps | unit | `test/bridges/agents/legacy-grant-form.test.ts`, `grant-rewrite.test.ts` | owner tests | Must stay green unchanged; a red test means stored text is no longer recognized | Yes, no edit expected |
| PG-AGENT-09 | pi-subagents removes the excluded tool from the child's tool list, adapter and built-in | integration | `test/integration/pi-subagents-child-launch-conformance.test.ts`, `agents-builtin-grant-conformance.test.ts` | integration file command | The bridge writes no `excludeTools`, so the tool stays | Yes, extend |
| PG-AGENT-09 | `subagent list` shows tools and excluded tools; the staged file's `warnings:` holds neither old text | cucumber | `features/mcp-server/agent-grants.feature` (`@adapter-only`, `@builtin-only`) | one-scenario command under each profile | No `excluded tools`; the cannot-narrow line in `warnings:` | Scenarios new |
| PG-AGENT-09 | `apply` reports no 0.62.0 warning for an agent with `disallowedTools` and no `tools` | cucumber | `features/agent/frontmatter.feature` | one-scenario command | The diagnostic lists the 0.62.0 line | Scenario new; steps exist |
| all | Documentation | docs | `docs/mcp-compatibility.md`, `README.md`, `README.es.md`, `docs/output-catalog.md` | `pre-commit run --files <files>` | Review only | Yes |

### Sampling Rate

- **Per task commit:** the owner tests and pair coverage of the files the task changes, and the task's scenarios. The commit hook adds `npm run check:commit`.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`; record the command, exit status, commit, Node version, and scenario counts of both profiles.

### Wave 0 Gaps

- [ ] `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts` and `test/shared/frontmatter-repair.test.ts`, with the moved cases.
- [ ] Multi-line description support in `features/lib/upstream/subagents.ts` (`projectDetail`).
- [ ] `subagent` in `AGENT_NAMEABLE_TOOLS` (`features/step_definitions/agent/runs.steps.ts`), if the planner uses the offered-tools step as proof.
- [ ] No new step is needed for fixtures, the nested call, the file text, or the index rows.
- [ ] No framework install.

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is enabled. This is a local extension that processes untrusted plugin content. It has no authentication, session, or cryptography surface.

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
| --- | --- | --- |
| V2 Authentication | No | none |
| V3 Session Management | No | none |
| V4 Access Control | Yes, as tool grants | The converter maps only table names; pi-subagents enforces the allowlist, the exclude list, and the depth limit. |
| V5 Input Validation | Yes | Pi's YAML parser (aliases bounded by `yaml`'s default limit, no custom tags), own-key copy, `assertSafeName`, validated tokens for every identifier the emitter writes. |
| V6 Cryptography | No | none (`sourceHash` is an identity hash, unchanged) |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard mitigation |
| --- | --- | --- |
| A multi-line or crafted description injects a key (`tools`, `model`, `extensions`) into the generated agent file | Tampering, Elevation of privilege | The `\|-` block with a fixed indent; the integration case against pi-subagents' own reader with hostile lines; the header-character quoting of Pitfall 4. |
| A YAML `__proto__` mapping changes how `raw` resolves `tools` or `name` | Tampering | `setOwn` for every key; a unit case with `__proto__:` holding `tools`. |
| A YAML string name with a newline, a separator, or a control character reaches a path | Tampering | `assertSafeName` in `discover.ts` and in both name generators; a unit case for a double-quoted name with `\n`. |
| A YAML key with a newline reaches a provenance list or a user-visible line | Tampering, Spoofing | `sanitizeProvenanceValue` already flattens provenance values; the normalizer should refuse or flatten a key that holds a control character before it reaches `dropped fields:`. |
| An alias bomb in frontmatter | Denial of service | `yaml` bounds alias expansion by default; no option of ours changes it. No extra code. |
| Unparseable frontmatter removes an author's tool restriction, and the agent also gains nested delegation | Elevation of privilege | Locked upstream parity (D-PG7-04). The discovery note on every staging verb says what was lost. Listed for maintainer review (Open Question 4). |
| An agent restricted to `Read` plus `Agent` delegates to an agent with more tools | Elevation of privilege | Upstream behaves the same (the type list is not applied inside a subagent). pi-subagents bounds it to one more layer. State it in the compatibility text; do not narrow with `allowedAgents`. |
| A per-tool MCP deny that does not match the registered name leaves the tool available | Elevation of privilege | Names come from `excludeNameFor`; the conformance tests fail on a mismatch. The over-64-character adapter case is recorded under AGTLONGNAME-01. |

## Probes run in this research

All probes used the cucumber harness's sandbox home or a `mkdtemp` home with `HOME` and `PI_CODING_AGENT_DIR` inside it. None touched `~/.pi/agent`, and none changed the repository (`git status --short` was empty afterwards). The only tree change is the optional-peer cache under `node_modules/.cache`, written by `node scripts/install-test-peers.mjs`. Scratch files are under `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/probe/`.

| Probe | What ran | Deciding output |
| --- | --- | --- |
| P1 | Cucumber, adapter profile: an installed agent whose file was replaced by a hand-written one with `description: \|-` and the lines `First line: with a colon.`, `name: injected`, `# not a comment`, a blank line, `---`, `Last line.`; then `subagent get` | pi-subagents returned `Agent: demo:block (user)` and `Description: First line: with a colon.\nname: injected\n# not a comment\n\n---\nLast line.\nAliases: ...`. The harness projection then failed with `cannot read pi-subagents' agent detail`. |
| P2 | Same harness: files with `model: inherit` and `tools: read,subagent`; with `allowNestedSubagents: true` and no `tools`; with `tools: read,bash` and `excludeTools: bash`; then `get`, `list`, and nested foreground runs | `model inherit`, `tools read, subagent`; no tools or nested line for the second file; `tools read, bash` and `excluded tools bash`; the list line `; tools read, bash; excluded tools bash`. Both nested runs: the child received `subagent returned: Helper says hello.` and the parent `subagent returned: Lead got the hello.` (and `Open got the hello.`). |
| P3 | Node with the hermetic import: Pi's `parseFrontmatter`, then `repairSingleLineScalars` and a second parse, on 27 frontmatter texts | The values and errors quoted in R4 and in Pitfalls 1-3. |
| P4 | Node, `mkdtemp` home: pi-subagents `resolvePiLaunchToolPlan` with a cached adapter server | Whole-server grant with `excludeTools: ["mcp__plugin_demo_stub__drop"]`: allowlist without `drop`. `tools: ["read","subagent"]`: `fanout: true`. No tools with `allowNestedSubagents`: `fanout: true`; plus `excludeTools: ["subagent"]`: `fanout: false`. |
| P5 | Node, `mkdtemp` home: pi-subagents `buildInProcessChildLaunch` as a runner | No tools with `allowNestedSubagents`: `fanout: true`, `MCP_DIRECT_TOOLS` unset, `depth: 1`, `maxDepth: 2`. Server grant with a per-tool exclude: `tools: ["read","mcp__plugin_demo_stub__echo"]`, `MCP_DIRECT_TOOLS: "plugin_demo_stub_"`. |
| P6 | Cucumber: a file with `excludeTools: subagent` and no `tools`; `get`, then a foreground run whose child tries the nested call | `excluded tools subagent`; the child ran, no helper call appeared, and the parent received the child's next reply. |
| P7 | `npm pack pi-subagents@0.87.0` into the scratchpad; three files read | The declared floor holds the same lines: `rawValue === "\|" \|\| rawValue === "\|-"` (`src/agents/frontmatter.js:123`), the fan-out rule (`src/runs/shared/child-tool-plan.js:216`), the MCP exclude filter (`:244`), and `Excluded tools:` in the detail (`src/agents/agent-management.js:971`). |

## Sources

### Primary (HIGH confidence)

- Repository source, read this session with the line citations above: `bridges/agents/{frontmatter,convert,discover,stage,unstage,grant-forms,grant-rewrite,legacy-grant-form,mcp-async-warning,skill-preload,target-check,types}.ts`, `bridges/skills/{frontmatter-degrade,frontmatter-scan,stage}.ts`, `domain/name.ts`, `orchestrators/plugin/{discover-names,info,update-swap}.ts`, `shared/{staging-warnings,own-key}.ts`, `platform/pi-api.ts`, `.fallowrc.json`, `eslint.config.js`, `cucumber.json`, and the features, steps, and harness libraries named above.
- pi-subagents 0.88.1, installed in the optional-peer cache: `src/agents/{frontmatter,agents,agent-management}.js`, `src/runs/shared/{child-tool-plan,child-launch,child-session,child-hooks,mcp-direct-tool-allowlist,mcp-direct-tool-grant}.js`, `src/extension/{index,fanout-child}.js`, `src/shared/types.js`, `index.js`, `docs/agents.md`, `docs/configuration.md`.
- Pi 1.5.0: `dist/utils/frontmatter.js` and its type file.
- Probes P1-P7.
- `07-CONTEXT.md` for the upstream contract (Claude Code 2.1.323), taken as given.

### Secondary (MEDIUM confidence)

- `docs/prd/parity-gaps-prd.md` section 7.5 and `docs/research/parity-gaps/subagents.md` for use counts and the earlier reading of pi-subagents 0.88.0.

### Tertiary (LOW confidence)

- Assumptions A1-A3, from training memory of Claude Code's agent loader. Not relied on for a locked decision.

No web or documentation lookup was run; probe P7 fetched the public pi-subagents 0.87.0 tarball from the npm registry. Every question was answerable from the repository and the installed packages, and the task said not to repeat the upstream research. Graphify is disabled (`gsd-tools graphify status`); the research-plan seam was therefore not used.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH. No change; versions read from the installed tree.
- pi-subagents behavior (R1, R2, R3): HIGH. Source read and probed on 0.88.1.
- Reader design and value rules (R4, R7): HIGH for Pi's behavior (probe P3); MEDIUM for the null and non-mapping rules (A1, A2).
- Rename trace (R5): HIGH. Read in source; not probed end to end.
- Warning sites (R6): HIGH. Full-tree grep.
- Harness (R8): HIGH for the nested call and the projection gap (probes); MEDIUM for the exact step and table shapes of the new scenarios.
- Pitfalls: HIGH; each is tied to a read line or a probe.

**Research date:** 2026-11-14
**Valid until:** 2026-12-14 for the code sites; re-check the pi-subagents sources when the suite version moves from 0.88.1, and the reader when Pi moves from 1.5.0.
**Scope of this research:** only this file was written in the repository. No source, test, feature, plan, or state file was changed, and nothing was committed.
