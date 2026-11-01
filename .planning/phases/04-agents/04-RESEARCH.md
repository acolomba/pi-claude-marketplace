# Phase 4: Agents - Research

**Researched:** 2026-11-01
**Domain:** Claude plugin agents bridged to pi-subagents 0.84.0 (agents bridge product changes + cucumber observation mechanics)
**Confidence:** HIGH for code anchors and measured harness behavior; MEDIUM for the wave split and two design recommendations flagged below

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(Copied verbatim from `04-CONTEXT.md` `<decisions>`.)

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

### Claude's Discretion

- The plan split, wave placement (the ROADMAP's three-wave template), step
  texts (kind-prefixed parameter types, D-CF1-08), and `features/lib/agent-files.ts`
  fixture shapes (a frontmatter map, nested paths).
- The exact install warning texts for D-CF4-04 skips and D-CF4-05 fields, in
  the style of the existing `convert.ts` warnings.
- Whether the D-CF4-04 skill text is read from the staged skill or from the
  plugin source (both after substitution), as long as the child receives the
  body upstream would inject.

### Deferred Ideas (OUT OF SCOPE)

- Emitting `excludeTools` beside `tools` for per-tool MCP disallows (Phase 6 /
  parent; D-CF4-08).
- Mapping `memory` onto pi-subagents' `memory` (needs a per-agent path and a
  `local` scope pi-subagents lacks).
- Cross-plugin skill preload fallback (D-CF4-04 residual).
- Guarding this extension's load-time reconcile in pi-subagents async
  children when it is installed as a Pi package (`PI_SUBAGENT_CHILD`), found
  by the pi-subagents research; a lifecycle concern outside Phase 4.

Also out of scope (CONTEXT `<domain>`): MCP grants to agents (MCP-07, Phase 6), hooks on agents, a model choosing an agent on its own (RM-01), workflows calling `agent()` (Phase 7), the frozen Phase 1 files, `.fallowrc.json`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGT-01 | pi-subagents' agent list shows each bridged agent as `<plugin>:<name>` with its alias and description, incl. nested files (FG-15) | Listing observation measured (E1/E8); nested-discovery change map (`discover.ts`, `domain/name.ts`); fallback text change (`convert.ts:629-633`); advertised section observation (E1) |
| AGT-02 | Foreground run: child system prompt = agent body, tools and model per conversion rules, with and without `--map-model` | Seed shape (`invocation.feature`); child `tools` observable in the call log (E2/E5); `--map-model` failure text measured (E3); `list capabilities:true` shows Tools/Model/Thinking (E9) |
| AGT-03 | Frontmatter variants: `tools`, `disallowedTools`, `model`, `effort`, skill preloads, FG-17 fields | `list capabilities:true` and `get` give whole-value observations without a run (E9); `get` prints `Async:` (pi-subagents `agent-management.js` lines quoted below) |
| AGT-04 | Background run completes with the scripted model, or the gap is recorded | Bounded feasibility measured (E4/E4b): **recorded gap** under D-CF4-10, root cause pasted below |
| AGT-05 | Without pi-subagents: `{requires pi-subagents}`; loading it later lists agents with no reinstall | `softDepMarkers` unchanged (`soft-dep.ts`); shared-Pi install then profile-Pi start pattern |
| AGT-06 | Project-scope agents in a trusted project; untrusted behavior pinned | Seeds exist; default-scope untrusted text measured (E6) and its portability problem (repo path) |
| AGT-07 | Disable, uninstall, update remove/replace; enable restores | List observation after a new session; empty-list text `- (none)` (pi-subagents `formatAgentListSections`) |
| XK-01 | Agent preloading a plugin skill gets that skill's content in its child session | D-CF4-04 implementation path (skill records from the orchestrator, source read + same two body transforms); child-prompt observation via frozen `the model call N receives this system prompt:` |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Read a file before editing; trace callers before modifying a function.
- Never commit to `main`; branch `features/component-features-phase-4`; never rebase/amend/force-push; never `--no-verify`. Commit titles per `.agents/skills/committing/SKILL.md`, no phase/plan IDs in titles (CHILD-SESSION-BRIEF).
- Every plan `SUMMARY.md` has a `## Threat Flags` section, even "None".
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario under `features/` that fails without the change (red proof recorded).
- GSD gates run `npm run check` on the combined tree; the phase gate also runs `npm run test:modules` and `npm run test:cucumber` (CHILD-SESSION-BRIEF). `npm run check` now **includes** `test:cucumber` (`package.json` `check` script).
- Upstream parity is the default; divergence only with a recorded ID or a Pi capability gap.
- Containment (NFR-10): writes only under `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `mcp-adapter.json`, `mcp.json`. Atomic writes (NFR-1). No network on `list`/`info`/`uninstall` (NFR-5).
- Output only through `shared/notification-dispatch.ts` (IL-2); no `console.*`/stdio in extension code.
- TypeScript strict; explicit return types on exports; cognitive complexity <= 15 under BOTH ESLint sonarjs and fallow health; fallow dupes fails on every clone group; 100% direct coverage per source-test pair.
- Never edit: `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions, `BACKLOG.md`, the "Frozen after Phase 1" files, `.fallowrc.json`, the six invocation cores. List those lines as "Parent lines" in the last SUMMARY.
- Own arm only: `shared/concerns/soft-dep.ts` pi-subagents arm; `domain/name.ts` agents functions only. Orchestrator fixes stay minimal and inside their own function.
- Dubious choices go to the phase `04-DUBIOUS-CHOICES.md` (via the orchestrator), never the root file.
- Root container: run npm scripts and cucumber through the `nondac-sh` wrapper (see Environment Availability).

## Summary

The Phase 4 product surface is small and well contained: `bridges/agents/{discover,convert,frontmatter,stage,types}.ts`, the two agent functions in `domain/name.ts`, and two one-line orchestrator call sites for the skill preload. Every decision maps to a concrete edit with a file:line anchor (below). The non-obvious costs are elsewhere: (1) unit tests **outside** Phase 4's ownership pin the exact generated agent bytes and the 4.x `--map-model` targets, so the emitter changes (D-CF4-05, D-CF4-14, D-CF4-03, D-CF4-07) must update those tests in the same plan; (2) `convert.ts` is touched by five decisions, so wave-2 plans cannot all own it in parallel; (3) two observations need agent-owned steps because pi-subagents prints absolute repository paths that no frozen run token projects.

All observation mechanics were **measured** this session with throwaway step and feature files kept in the scratch folder (no repository file was edited): the list result (with and without builtins), the advertised catalog section, `list capabilities:true`, `get`, the foreground default of a frontmatter `async: false`, the `--map-model` failure text, the untrusted default-scope error, and a bounded async run. The async run is not provable with the frozen harness: the detached runner fails to load the scripted model extension because pi-subagents' `JITI_ALIAS` maps the bare `@earendil-works/pi-ai` specifier to `dist/compat.js`, which breaks the extension's `@earendil-works/pi-ai/providers/faux` import. AGT-04 should close on the recorded gap (D-CF4-10).

**Primary recommendation:** Wave 1 owns nested discovery + names + fallback + `advertise` and every shared step/fixture; wave 2 runs one `convert.ts`/`frontmatter.ts` owner (frontmatter plan: D-CF4-05/06/07/08) beside the two product-free pinning plans (companion+trust, lifecycle); the invocation plan (D-CF4-04 / XK-01, runs, `--map-model` run, AGT-04 gap) moves to wave 3 because it edits `convert.ts` after the frontmatter plan; decisions/docs/gate become wave 4.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Recursive agent discovery, naming (D-CF4-01) | Bridge (`bridges/agents/discover.ts`) | Domain (`domain/name.ts` agents functions) | Discovery owns AG-12 first-wins; names are pure domain helpers |
| Field conversion (D-CF4-03/05/06/07/08) | Bridge (`convert.ts`, pure) | Bridge emitter (`frontmatter.ts`) | `convert.ts` maps; `frontmatter.ts` owns byte assembly and field order |
| Skill preload content (D-CF4-04) | Bridge (`stage.ts` reads files; `convert.ts` appends) | Orchestrator (`install-outcome.ts`, `update-swap.ts` pass skill records) | `convert.ts` must stay pure; the orchestrator is the only layer that holds both the skills result and the agents call |
| `advertise: true` (D-CF4-14) | Bridge emitter (`frontmatter.ts`) | — | Fixed extension-side default like `systemPromptMode` |
| Companion-missing marker (D-CF4-11) | Shared (`shared/concerns/soft-dep.ts`) | — | Already correct; no change expected |
| Observation of list/run/catalog | Cucumber step modules (`features/step_definitions/agent/**`) | Fixture lib (`features/lib/agent-files.ts`) | Frozen steps cover calls and child prompt; agent-owned steps cover the advertised section, child tools, and the repo-path token |

## Standard Stack

No new runtime or dev dependency. Everything needed is already installed and pinned.

### Core (existing, verified this session)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pi-subagents (optional peer, cucumber cache) | 0.84.0 | Agent runtime the bridge targets | Declared floor; `node_modules/.cache/optional-peers/node_modules/pi-subagents/package.json` [VERIFIED: package.json read] |
| @earendil-works/pi-coding-agent | 1.4.0 | Pi host; `parseFrontmatter` re-exported by `platform/pi-api.ts:39` | [VERIFIED: package.json read; pi-api.ts:39 `export { parseFrontmatter } from "@earendil-works/pi-coding-agent";`] |
| @earendil-works/pi-ai | 1.4.0 | Model catalog holding the D-CF4-07 targets | `dist/providers/data/anthropic.json` contains `"id":"claude-fable-5-1"`, `"id":"claude-haiku-5-5"`, `"id":"claude-opus-5-5"`, `"id":"claude-sonnet-5-5"` [VERIFIED: grep of the catalog] |
| @cucumber/cucumber | 13.3.0 | Behavioral tests | [VERIFIED: package.json read] |
| fallow | 3.35.0 | dead-code / health / dupes gates | `npx fallow --version` [VERIFIED] |

**Installation:** none.

## Package Legitimacy Audit

No package is installed by this phase. **Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
/claude:plugin install|update|enable|reinstall
        |
        v
orchestrator ledger (install-outcome.ts agentsPhase | update-swap.ts prepareUpdateHandles)
        |  skills phase result: StagedSkillRecord[] {generatedName, sourcePath(dir), targetPath(dir)}
        v
bridges/agents/stage.ts  prepareStagePluginAgents
        |-- discover.ts  (recursive walk -> DiscoveredAgent{namespace[], sourceName, generatedName ...})
        |-- [NEW] read preloaded skills' SOURCE SKILL.md -> {eligible|skip reason, baseDir=targetPath, body}
        |-- convert.ts (pure)  description fallback, model map, tools split, thinking, async, skills split
        |        '-- appends "Base directory for this skill: <targetPath>\n\n<body>" blocks; drops inlined skills: entries
        '-- frontmatter.ts emitGeneratedAgentFile (adds async?, advertise: true)
        v
<scopeRoot>/agents/pi-claude-marketplace-<plugin>-<seg...>-<name>.md  (+ agents-index.json row)
        v
pi-subagents 0.84 (re-reads files per list/run; advertised catalog rebuilt at session_start)
        |-- subagent {action:list[,capabilities]} / {action:get}  -> tool result text (call log)
        |-- before_agent_start -> systemPromptOptions.sections.advertised_subagents (parent prompt)
        '-- foreground run (in-process child, inherits faux provider) -> child call in call log
```

### Recommended file layout (owned paths only)

```text
extensions/pi-claude-marketplace/bridges/agents/
  discover.ts          # recursive walk + declared-file branch (D-CF4-01)
  convert.ts           # D-CF4-03/05/06/07/08 + D-CF4-04 append
  frontmatter.ts       # async?/advertise emission, field order
  stage.ts             # reads preloaded skill sources (D-CF4-04); do NOT touch lines ~437-470
  types.ts             # DiscoveredAgent.namespace, StageAgentsInput skill records
  skill-preload.ts     # OPTIONAL new leaf (needs test/bridges/agents/skill-preload.test.ts, 100% direct coverage)
features/agent/{listing,frontmatter,invocation,companion-missing,project-trust,lifecycle}.feature
features/step_definitions/agent/{listing,frontmatter,runs,companion,trust,lifecycle}.steps.ts  (names are the planner's)
features/lib/agent-files.ts   # frontmatter map + nested path + replace (republish) + raw SKILL.md writer
```

### Per-decision change map (file:line anchors)

**D-CF4-01 nested discovery** — `bridges/agents/discover.ts:61-122` (flat loop), `domain/name.ts:545-551` and `:575-581`.

- Today the loop reads one level: `const entries = await readDirEntriesTolerant(agentsDir);` then `if (!(await isPlainMarkdownFile(agentsDir, entry))) { continue; }` (`discover.ts:72`, `:82`) [VERIFIED: discover.ts read]. `isPlainMarkdownFile` rejects dotfiles and is case-sensitive: `if (entry.name.startsWith(".") || !entry.isFile() || !entry.name.endsWith(".md")) {` (`shared/fs-utils.ts:209`) [VERIFIED: fs-utils.ts read].
- `isPlainMarkdownFile` and `readDirEntriesTolerant` are **shared**: commands (`bridges/commands/discover.ts:52`, `:263`) and skills (`bridges/skills/skill-names.ts:26`, `:138`) call them [VERIFIED: grep + read]. Do not change them; Phase 4 does not own `shared/fs-utils.ts`. Write an agents-local predicate: regular file (`entry.isFile()`; a Node Dirent of a symlink is never `isFile()`), name `/\.md$/i`, dotfiles allowed; skip `entry.isSymbolicLink()`; recurse `entry.isDirectory()` while namespace depth < 32.
- Stem: upstream strips only a lowercase `.md` (`replace(/\.md$/,"")`), so `UPPER.MD` loads as `UPPER.MD` (`04-UPSTREAM-AGENTS.md` Q1) [CITED: 04-UPSTREAM-AGENTS.md]. Mirror that: `name.endsWith(".md") ? name.slice(0, -3) : name`.
- **Declared file paths load nothing today.** Probe this session: `discoverPluginAgents({ pluginName: "demo", agentsDirs: ["<d>/custom/review/security.md", "<d>/custom"] })` printed `{"discovered":[],"warnings":[]}` [VERIFIED: probe `scratchpad/researcher/probe-declared.ts`]. The file arm hits `readdir` ENOTDIR -> `[]`; the folder arm is flat, so `custom/review/security.md` is missed. "A file named directly by a declared `agents` path keeps its bare name" therefore needs a **new** file branch: `lstat(agentsDir)`; regular file ending `.md` (upstream's single-file branch is case-sensitive) -> one agent, namespace `[]`. Keep refusing a symlinked declared file (T-03-27), although upstream follows it: record as a residual under D-CF4-01.
- Name helpers today: `const generated = \`pi-claude-marketplace-${plugin}-${source}\`;` and `const declared = \`${plugin}:${source}\`;` (`domain/name.ts:548`, `:578`) [VERIFIED: name.ts read]. Add a trailing `namespace: readonly string[] = []` parameter to both; `assertSafeName` each segment, then the joined result; join with `-` (generated) and `:` (declared). Callers: only `discover.ts:98` and `convert.ts:624` [VERIFIED: grep]. Their tests live in `test/domain/name.test.ts:1164-1310` (`describe("generatedAgentName")`, `describe("declaredAgentName")`), which must cover the new default-parameter branch for 100% direct coverage of `domain/name.ts`.
- Representation: add `namespace: readonly string[]` to `DiscoveredAgent` (`types.ts:157-170`); keep `sourceName` = frontmatter `name` or stem. Duplicate warning (`discover.ts:38-48`) must keep its exact flat prefix ``agent source "${sourceName}" at "`` because `features/plugin/staging-warnings.feature:19` pins `agent source "helper" at "[redacted path]` [VERIFIED: feature read] (frozen lifecycle file).
- Walk order decides AG-12 winners: sorted by `localeCompare` per directory, DFS pre-order. `localeCompare("review", "review-security.md") < 0`, so a nested `review/security.md` is visited before a flat `review-security.md` and wins the shared generated name `pi-claude-marketplace-<p>-review-security` [ASSUMED from `localeCompare` semantics; unit-test it].
- **Fallow dupes risk:** the commands walk (`bridges/commands/discover.ts:310-345`) carries a reviewed clone marker with skills. A near-copy in agents creates a new clone group that `fallow dupes --fail-on-issues` rejects, and boundary zones forbid importing it. Write the agents walk in its own shape (single async generator or explicit stack); run `npx fallow dupes` after the edit. Baseline `npx fallow dupes --quiet` printed nothing this session [VERIFIED].
- **Unaffected by nesting** (verified by reading): unstage/uninstall removes by recorded `generatedName`/`targetPath` (flat files in `<scopeRoot>/agents/`); the AG-5 ownership check `isOwnedAgentFile` is a substring check on the marker; `agents-index-schema.ts:29-30` stores `sourceAgent: Type.String()` and `generatedName: Type.String()` (no persistence change) [VERIFIED: schema read]; `orchestrators/plugin/discover-names.ts:75,85` maps `discovered.generatedName` (nested names flow through).
- **Not changed, recorded as residual:** `orchestrators/plugin/info.ts:331-343` `nameFromEntry` lists agents flat and case-sensitive (`entry.isFile() && entry.name.endsWith(".md") ? entry.name.slice(0, -3) : undefined`) and does not filter dotfiles [VERIFIED: info.ts read]. Phase 4 does not own `info.ts`; commands already diverge the same way. Parent line.

**D-CF4-03 fallback** — `convert.ts:629-633`: `description = \`Imported Claude Code plugin agent ${sourceName} from plugin ${pluginName}.\`;` and `warnings.push("source description was missing or empty -- using fallback");` [VERIFIED: convert.ts read]. New: `description ?? when_to_use ?? when-to-use ?? \`Agent from ${pluginName} plugin\`` with each value trimmed and empty treated as missing (upstream `zie`, `04-UPSTREAM-AGENTS.md` Q9) [CITED]. Keep the warning text (D-CF4-03). Add `when_to_use` and `when-to-use` to `SUPPORTED_SOURCE_FIELDS` (`convert.ts:29-38`, today `"name","description","model","tools","disallowedTools","thinking","effort","skills"`) so they leave `droppedFields`.

**D-CF4-14 advertise** — emitter `frontmatter.ts:536-540` hardcodes `"systemPromptMode: replace"`, `"inheritProjectContext: true"`, `` `inheritSkills: ...` `` [VERIFIED]. Add `"advertise: true"` there as a fixed line (no new field on `GeneratedFrontmatterFields`), which keeps `test/integration/provenance-invisibility.test.ts:44-67` compiling (it builds `GeneratedFrontmatterFields` literally). pi-subagents rejects a non-boolean `advertise` (`04-PI-SUBAGENTS.md` Q1 table) [CITED]; emit exactly `true`.

**D-CF4-05 async + fields** — add `background` to `SUPPORTED_SOURCE_FIELDS`; `true` or `"true"`/`'true'` (the agents parser keeps quotes verbatim, `frontmatter.ts` AG-6 contract) -> `async: true`, anything else -> `async: false`; skip the field when the explicit mapped tools contain an `mcp:` entry (today's `MCP_ASYNC_WARNING`, `convert.ts:96-99`, and the test `ANAME-02: an explicit list of only mcp: entries converts with the async warning and no async field` at `test/bridges/agents/convert.test.ts:1676`). Add an optional `async?: boolean` to `GeneratedFrontmatterFields` (`frontmatter.ts:433-441`) so `provenance-invisibility.test.ts` compiles unchanged. Add `initialPrompt`, `observer`, `observerMessage`, `observeSubagents` to `GUIDED_DROPPED_FIELD_WARNINGS` (`convert.ts:801-813`); the stage layer's generic `dropped fields:` line skips guided fields automatically (`stage.ts:273`).

**D-CF4-06 effort** — `THINKING_VALUES` (`convert.ts:102-109`: `"off","minimal","low","medium","high","xhigh"`) gains `"max"`; map `med` -> `medium` in `mapThinking` (`convert.ts:487-522`). pi-subagents lists `Thinking: max` for such an agent (E9).

**D-CF4-07 model** — `MODEL_MAP` (`convert.ts:44-48`: `sonnet: "anthropic/claude-sonnet-4-6"`, `opus: "anthropic/claude-opus-4-7"`, `haiku: "anthropic/claude-haiku-4-5"`) [VERIFIED] becomes the 5.x table; normalize with `toLowerCase()` and strip a trailing `[1m]`; `^claude-` passes through as `anthropic/<id>`; `inherit` unchanged (`convert.ts:206-208`). See Open Question 1 on `opusplan`.

**D-CF4-08 tools** — `splitCsv` (`convert.ts:153-182`) splits on `,` only. Replace with a splitter on commas and whitespace outside `(...)`, keeping the inline-array and quote stripping. It also feeds `skills` (upstream splits skills the same way) and `disallowedTools`. `*` anywhere -> treat as omitted `tools` (route to `omittedToolMapping`). Fix only the doc comment at `convert.ts:389-394` ("pi-subagents takes no `excludeTools` beside an explicit `tools:` list" is stale per `04-PI-SUBAGENTS.md` mismatch 2); keep the warning string at `:401-402` (MCP-07 surface) and record a parent line.

**D-CF4-04 skill preload** — see Pattern 2.

### Pattern 1: Observe pi-subagents through the call log (measured)

The parent model calls `subagent` and the tool result lands in call 2 of the turn. `the model receives these calls:` (frozen, `features/step_definitions/model.steps.ts`) compares every non-system message; Gherkin `\n` in a table cell is a newline, as the seed already uses.

Measured list result, builtins hidden (E1, `{"subagents":{"disableBuiltins":true}}` written to `{agent dir}/settings.json` after the profile Pi started — pi-subagents re-reads settings by fingerprint):

```text
Executable agents:
User agents
- demo:adv (user): Advertised one.
- demo:reviewer (user, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given.
```

Builtins control (E8) appends a blank line, `Builtin agents`, and 13 deterministic lines (no paths): `claude-code`, `claude-code-writer`, `codex-exec`, `codex-exec-writer`, `cursor-agent`, `cursor-agent-writer`, `delegate`, `evidence-auditor`, `oracle (builtin, context: fork, aliases: advisor)`, `researcher`, `reviewer`, `scout`, `worker (builtin, context: fresh, aliases: developer, coder, implementer, develop)`. Empty list text is `Executable agents:\n- (none)` (`agent-management.js` `formatAgentListSections`: `if (agents.length === 0) return ["- (none)"];`) [VERIFIED: source read].

`{"action":"list","capabilities":true}` (E9) is the whole-value observation for AGT-03 without running a child:

```text
Executable agents (capabilities):
User agents
- demo:a (user, aliases: pi-claude-marketplace-demo-a): Description: Agent A.; Tools: read, grep, find; Model: anthropic/claude-sonnet-5-5; Thinking: max
- demo:b (user): Description: Agent B.; Tools: default/ambient; excludes: bash; Model: inherits current session; Thinking: high
```

Undefined thinking prints `Thinking: default` (`formatAgentCapabilitiesLine`: `const thinking = agent.thinking === false ? "off" : agent.thinking ?? "default";`); descriptions are cut at 240 chars [VERIFIED: source read]. `{"action":"get","agent":"demo:a"}` (E9) prints `Agent: demo:a (user)`, `Path: <agentDir>/agents/a.md` (projects to `{agent dir}/agents/...`), `Description:`, `Aliases:`, `Model:`, `Tools:`, `System prompt mode:`, three `Inherit ...` lines, `Async: false` (only when defined: `if (agent.defaultAsync !== undefined) lines.push(\`Async: ...\`)`), `Thinking:`, then `System Prompt:` and the body [VERIFIED: E9 output + source read]. `get` is the only deterministic proof of the `background: true -> async: true` half of D-CF4-05.

### Pattern 2: D-CF4-04 skill preload (recommended design)

**Why the orchestrator must pass skill records.** In install/enable the skills phase commits before agents prepare (`install-outcome.ts:1237` commit, `:1303` agents prepare), but update/reinstall prepare every bridge first and commit later (`update-swap.ts:1483` `prepareUpdateHandles`, which prepares agents at `:399-407`; skills commit at `:1224`) [VERIFIED: grep + read]. Reading the staged target during an update would read the previous version or nothing. The agents bridge cannot import the skills bridge (fallow `boundaries`: `bridges-agents` may import only `domain`, `persistence`, `shared`, `platform`) [VERIFIED: `.fallowrc.json` read].

**Recommended:** pass the skills result rows (`StagedSkillRecord`: `generatedName`, `sourcePath` = source skill dir, `targetPath` = `<extensionRoot>/resources/skills/<name>`; `bridges/skills/types.ts:66-72`) [VERIFIED] instead of bare names:

- `install-outcome.ts:1310` today `knownSkills: c.stagedSkillNames,`; set a new context field next to `:1229` (`c.stagedSkillNames = prep.result.recorded.map(...)`) so there is no new `?? []` branch to cover.
- `update-swap.ts:406` today `knownSkills: handles.skills.result.recorded.map((record) => record.generatedName),`; pass `handles.skills.result.recorded`.
- Declare a structural type in `bridges/agents/types.ts` (do not import skills types). Keep `knownSkills` derivable from the rows.

In `stage.ts` prepare (before `convertAgent`, never in the commit block), for each resolved preload: read `<sourcePath>/SKILL.md`, `stripBom`, parse with Pi's `parseFrontmatter` (`platform/pi-api.ts:39`; same parser the skills bridge uses, `bridges/skills/stage.ts:26`). Skip with an install warning when `frontmatter["disable-model-invocation"] === true`, when neither `description` nor `when_to_use` is a non-empty string (upstream pool rule, `04-UPSTREAM-AGENTS.md` Q4), or when the parse throws (the skills bridge degrades such a skill to hidden). Body = parsed body (Pi trims it), then `rewriteMarkdownReferences(body, pluginName, referenceNames)` then `substituteClaudeVars(body, { pluginRoot, pluginData: pluginDataDir, skillDir: targetPath, projectDir })` — the same two transforms, in the same order, the skills bridge applies (`bridges/skills/stage.ts:360-361`) [VERIFIED]. Pass the prepared blocks into `convertAgent` (keep `convert.ts` pure). Do not read the staged copy: the skills bridge fills a missing description with a fallback (`augmentSkillDescription`, `stage.ts:125-157`), so eligibility must come from the source.

Appended text (one block per eligible skill, in `skills:` order, after the converted body):

```text
<converted agent body>

Base directory for this skill: <targetPath>

<skill body>
```

The emitter normalizes the body to one leading blank line and a trailing newline (`frontmatter.ts` `emitGeneratedAgentFile`). The child prompt shows the body trimmed, before pi-subagents' `Intercom orchestration channel:` text (seed `invocation.feature:28-112`). In a user-scope scenario `<targetPath>` projects to `{agent dir}/pi-claude-marketplace/resources/skills/<generated name>` (`persistence/locations.ts:223` `const skillsTargetDir = path.join(extensionRoot, "resources", "skills");`) [VERIFIED]. Omit the inlined skill from `skills:`; `skillPath` is emitted only when `skills` is non-empty (`frontmatter.ts:528-534`), so it disappears with it.

Residuals to record under D-CF4-04: inline `!` commands in a preloaded skill stay literal (upstream runs them at spawn; Pi has no spawn hook); `$ARGUMENTS` handling (see Assumption A5); the frontmatter-name alias lookup is not modeled; a source whose YAML only parses after the skills bridge's colon repair is skipped here while Pi lists it.

### Pattern 3: Agent-owned steps the frozen harness lacks

1. **Advertised catalog (D-CF4-14).** The parent system prompt cannot be compared whole: it embeds `<docs>` paths under the repository root (`/home/user/pi-claude-marketplace/node_modules/@earendil-works/pi-coding-agent/README.md`, measured E1), which no run token projects. Read instead the leading system message's `sections.advertised_subagents` of one call (logged whole in `model-calls.jsonl`). Measured value (E1):

   ```text
   <advertised_subagents>
   The following file-defined subagents opted into discovery. Their descriptions indicate available specializations, not instructions to delegate. Use subagent only when delegation is needed.
     <subagent>
       <name>demo:adv</name>
       <description>Advertised one.</description>
     </subagent>
   </advertised_subagents>
   ```

   Source: `agents/advertised-agent-prompt.js:21-25` (`ADVERTISED_AGENTS_TAG = "advertised_subagents"`, `CATALOG_INTRODUCTION` verbatim above), sorted by name, max 16 entries / 12,288 bytes, descriptions XML-escaped and cut at 512 bytes; set only when the parent's selected tools include `subagent` (`extension/index.js:726-741`) and rebuilt at `session_start` (`:1203`) [VERIFIED: source read]. The child prompt does **not** get it (E2: child call `has advertised False`).
2. **Child tools (AGT-02).** The frozen steps never compare `call.tools`. Measured child tool names for an agent with omitted `tools` (E2): `read, bash, edit, write, bg_wait, contact_supervisor` (pi-subagents runtime tools included). A whole-list `Then the model call {int} offers these tools:` style step in an agent module proves the mapping in a real run.
3. **Repo-path token for the untrusted default-scope run (D-CF4-09).** Measured (E6, project-scope install, untrusted, `agentScope` omitted):

   ```text
   Unknown agent: demo:reviewer
   Effective cwd: /tmp/pi-cm-features-6Rqlee/project
   Consulted agent-definition directories:
   - builtin: /home/user/pi-claude-marketplace/node_modules/.cache/optional-peers/node_modules/pi-subagents/agents (13 candidates)
   - user: /tmp/pi-cm-features-6Rqlee/agent/agents (absent)
   - user: /tmp/pi-cm-features-6Rqlee/home/.agents (absent)
   Available agents:
   - (none)
   ```

   `isError: true` (renders `subagent failed:`). The sandbox paths project, but the builtin line holds the repository path, which differs on CI. The frozen calls step cannot compare it portably. Needs an agent-owned calls step that first projects `resolveCompanion("pi-subagents").root` (frozen `features/lib/companions.ts`) to a kind-named token such as `{pi-subagents dir}`, plus a parent line to add the token to the frozen cucumber skill's run-token list. See Open Question 3.

### Pattern 4: AGT-05 companion loaded later

Install through the run's shared Pi (no companions) with `Given the user has run "/claude:plugin install ..."` (result severity is `info` with reason `requires pi-subagents`, e.g. `features/plugin/reinstall.feature:191-197`) [VERIFIED], then `Given pi runs with the scripted model and these companions:` (a fresh Pi process that loads pi-subagents), then the list turn. The `{requires pi-subagents}` observation is a separate scenario whose `When` is the install, because no `Given` may follow a `When`. `softDepMarkers` already appends the marker iff `declaresAgents && !probe.piSubagentsLoaded` (`shared/concerns/soft-dep.ts:102-125`) [VERIFIED]; no product change expected.

### Anti-Patterns to Avoid

- **Comparing the parent system prompt whole:** non-portable (repo paths in `<docs>`).
- **Reading the staged SKILL.md for eligibility or during update:** fallback description hides "no description"; update reads the old copy.
- **Editing `shared/fs-utils.ts` for dotfiles/case:** changes commands and skills behavior.
- **Touching `stage.ts` lines spanned by the reviewed clone marker (`stage.ts:443` and the commit/rollback block below it):** can break the agents/commands clone suppression, visible only in the combined tree.
- **Defining a shared step in wave 1 that only wave 2 uses:** `npm run check:features` fails on an unused step at the wave-1 gate.
- **A background (`async: true`) run in any scenario:** the completion wake starts a new parent turn after the step settled, consuming or overflowing the script.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SKILL.md frontmatter split | A regex split | `parseFrontmatter` from `platform/pi-api.ts` | Same YAML semantics Pi and the skills bridge use for `disable-model-invocation === true` |
| `${CLAUDE_*}` substitution | String replaces | `shared/vars.ts::substituteClaudeVars` | No re-expansion (T-03-01), SUB-01/02 semantics |
| Same-plugin reference rewrite | Custom token rewrite | `domain/skill-tokens.ts::rewriteMarkdownReferences` / `resolveSkillReference` | Identical to the skills bridge's body transform |
| Path containment for nested names | Manual checks | `assertSafeName` per segment + existing `assertPathInside` in `stage.ts:195-203` | NFR-10 chokepoint |
| Repo-root path token | Hard-coded paths in features | `resolveCompanion(name).root` from frozen `features/lib/companions.ts` | Portable across machines |
| UUIDs in tool results | Custom regex | frozen `projectCallText` (`{uuid}`) in the calls step | Already projects mission ids |

## Runtime State Inventory

Not a rename phase, but the emitter change alters files already on disk.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `agents-index.json` rows: schema unchanged (`sourceAgent`, `generatedName` strings) | None |
| Live service config | None — verified: no external service stores agent names | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts / installed files | Agent files already installed lack `async`/`advertise` and keep the old fallback/model until the next install/update/reinstall/enable re-stages them | No migration (pi-subagents reads files as-is); state it in the CHANGELOG parent line |

## Common Pitfalls

### Pitfall 1: Tests outside Phase 4 ownership pin generated bytes
**What goes wrong:** `npm run check` fails after an emitter change.
**Why:** exact agent file literals in `test/orchestrators/plugin/update-swap.test.ts:232` and `:698` (the latter also pins `description: Imported Claude Code plugin agent bot from plugin hello.`), `test/orchestrators/plugin/reinstall-flow.test.ts:677`, `test/orchestrators/plugin/install-flow-ledger.test.ts:1286`; `MAPPED_MODEL = "anthropic/claude-sonnet-4-6"` at `test/edge/handlers/plugin/install.test.ts:348` and `update.test.ts:470`; `test/integration/provenance-invisibility.test.ts:49,128` uses a literal model string (unaffected unless the emitter's input type gains a required field) [VERIFIED: grep].
**How to avoid:** the plan that changes the emitter updates these literals in the same commit; list them in the plan's `files_modified`; note merge-conflict risk with sibling phases.

### Pitfall 2: `convert.ts` contention across wave-2 plans
**What goes wrong:** two parallel plans edit `convert.ts`/`frontmatter.ts` and their unit tests.
**How to avoid:** one wave-2 owner for `convert.ts` + `frontmatter.ts` (+ `convert.test.ts`, `frontmatter.test.ts`); the D-CF4-04 append lands in a later wave.

### Pitfall 3: Advertised catalog is session-scoped
**What goes wrong:** a scenario installs and lists in the same session and sees no catalog change.
**How to avoid:** `Given the user has started a new pi session` after every install/lifecycle command (D-CF4-12). File discovery itself needs no reload (E1 wrote an agent file after Pi started and it listed).

### Pitfall 4: Absolute repository paths in pi-subagents output
Parent `<docs>` section and the `Unknown agent` builtin line. Only `{home}`, `{project dir}`, `{agent dir}`, `{git host}`, revision/commit/error tokens and `{uuid}` project (`features/lib/run-tokens.ts:134-157`) [VERIFIED].

### Pitfall 5: Background launches
Omitting `async` today launches in the background (pi-subagents `resolveAsyncByDefault`: `return config.asyncByDefault !== false;`, `extension/config.js:265-267`) [VERIFIED]. Every scenario must pass `"async":false` or rely on D-CF4-05's emitted `async: false` (measured foreground in E2). The red run of the D-CF4-05 "omitted async runs foreground" scenario will launch a background child that fails and wakes the parent; that is acceptable for a red proof but do not leave such a scenario green-by-accident.

### Pitfall 6: `--map-model` targets are unknown to the profile Pi
Measured (E3): `subagent failed: Unknown subagent model 'anthropic/claude-sonnet-5-5' in the active Pi model registry.` (no `Did you mean`, `isError: true`). The profile Pi has only the faux provider; `ANTHROPIC_*` keys are not in the child allowlist (`test/e2e/_rpc.ts:212-238`) [VERIFIED]. Use it as the AGT-02 `--map-model` run observation and prove the mapping table with `list capabilities:true` (`Model: anthropic/claude-sonnet-5-5`).

### Pitfall 7: Complexity ceilings
`mapModel` normalization, the new splitter, and the eligibility check each risk crossing cognitive 15 under fallow's or ESLint's algorithm. Keep helpers small; run `npx fallow health` and `npm run lint` on the touched files.

### Pitfall 8: Root container
~167 permission-injection cases fail as root. The existing `discover.test.ts:186` ("rejects an unreadable markdown entry with the filesystem error") is one; run tests through `nondac-sh`.

### Pitfall 9: `check:features` unused-step rule per gate
Each wave's gate runs `npm run check` on the combined tree; a step defined but unused by that wave's features fails.

## Code Examples

### Agent-owned advertised-section step (shape)
```ts
// Source: measured E1 + frozen features/lib/scripted-model/script.ts exports
Then(
  "the model call {int} advertises these agents:",
  function (this: ScenarioWorld, number: number, expected: string) {
    const call = modelCallsOf(this.requireTurn().logs).find(({ index }) => index + 1 === number);
    if (call === undefined) {
      assert.fail(`the last turn has no model call ${number}`);
    }
    const leading = call.messages.find(
      (message): message is { role: "system"; sections?: Record<string, string | null> } =>
        typeof message === "object" && message !== null && (message as { role?: unknown }).role === "system",
    );
    assert.strictEqual(projectTokens("text", leading?.sections?.advertised_subagents ?? "", this.tokens), expected);
    this.markTurnCompared();
  },
);
```

### pi-subagents settings Given (shape; mirrors frozen `the project holds a pi settings file`)
```ts
// Source: features/step_definitions/companion.steps.ts:60-66 pattern
Given("pi-subagents hides its builtin agents", async function (this: ScenarioWorld) {
  const file = path.join(this.scopeRoot("user"), "settings.json");
  const text = `${JSON.stringify({ subagents: { disableBuiltins: true } })}\n`;
  await writeFile(file, text, { flag: "wx" });
  this.onRelease(() => rm(file, { force: true }));
  assert.strictEqual(await readFile(file, "utf8"), text);
});
```

### Default-param name helpers
```ts
// Source: domain/name.ts:545-581 (current bodies quoted above)
export function generatedAgentName(plugin: string, source: string, namespace: readonly string[] = []): string {
  assertSafeName(plugin);
  for (const segment of namespace) {
    assertSafeName(segment, "agent namespace segment");
  }
  assertSafeName(source);
  const generated = ["pi-claude-marketplace", plugin, ...namespace, source].join("-");
  assertSafeName(generated);
  return generated;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `excludeTools` ignored beside `tools` | Applied beside `tools` | pi-subagents 0.62.0 | ANAME-02 warning stale (D-CF4-08 parent line) |
| Thinking levels to `xhigh` | `max` accepted | pi-subagents 0.84 (`shared/model-info.js:1`) | D-CF4-06 |
| 4.x Claude IDs in `--map-model` | 5.x IDs in pi-ai 1.4.0 catalog | — | D-CF4-07 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `localeCompare` puts a nested `review/` dir before `review-security.md`, so the nested agent wins the flattened duplicate | D-CF4-01 | Wrong winner in the AG-12 warning; unit test catches it |
| A2 | Writing `{agent dir}/settings.json` before or after the profile Pi start is equally safe for Pi itself (only measured after start) | Pattern 1 | Pi might reject unknown keys at start; write after the profile Given to match the measurement |
| A3 | `thinking: max` on the faux model does not break a foreground run (only listing was measured) | D-CF4-06 | Run scenarios with `effort: max` could fail; observe effort via `list capabilities:true` only |
| A4 | The default fixture skill `skills/<plugin>-skill/SKILL.md` (`features/lib/path-marketplace.ts:108`) is acceptable as a Phase 1 stand-in for XK-01 | XK-01 | If the reviewer reads "stand-in" more strictly, publish a skill with frozen `publishSkill` instead |
| A5 | `$ARGUMENTS` in a preloaded skill should stay literal: the frozen port of `T2e` fills only variables when there are no arguments (`domain/argument-substitution.ts:212-220`), while the upstream record says it "becomes empty" | Pattern 2 | One-word divergence in an edge case; record under D-CF4-04 |
| A6 | Starting a profile Pi after a shared-Pi install is an acceptable stand-in for "load the companion, then `/reload`" | AGT-05 | Reviewer may want an in-process `/reload`; Pi cannot add a companion to a running process |

## Open Questions

1. **`opusplan` target.** D-CF4-07 maps `opusplan` to `anthropic/claude-opus-5-5`, but the upstream record says a frontmatter `opusplan` resolves to the **sonnet** model (`04-UPSTREAM-AGENTS.md` Q6: "`sonnet` and `opusplan` -> the sonnet model ... static reading, medium confidence"). Recommendation: follow the evidence record (`opusplan` -> `anthropic/claude-sonnet-5-5`) and log it as a dubious choice, or keep the locked text and log the conflict. The planner must pick one; do not leave it silent.
2. **Declared folder paths.** "Keeps today's behavior": today a declared folder is scanned flat. With one recursive walker, a declared folder would recurse too. Recommendation: recurse every directory entry (simpler, closer to the conventional folder) and record it as the D-CF4-01 residual.
3. **Untrusted default-scope run token.** Needs a new token (`{pi-subagents dir}`) introduced by an agent step plus a parent line for the frozen cucumber skill. Alternative: pin only the explicit-scope pair already in the seed and record the default-scope text in the SUMMARY. Recommendation: the token step; flag as dubious.
4. **Omitted-tools agents and MCP (Phase 6 interaction).** `async: false` makes an omitted-`tools` agent run in the foreground, where children load no ambient extensions, so it loses the pi-mcp-adapter tools a background run had. D-CF4-05's exception covers only explicit `mcp:` entries. Recommendation: keep the decision as written and add a parent line warning Phase 6.
5. **`Tool(spec)` entries.** The new splitter keeps `Bash(git log *)` as one token, which `TOOL_MAP` drops; upstream resolves it to Bash. Not in D-CF4-08. Recommendation: keep the drop (warning already names it) and record it.
6. **Effort case.** Upstream lowercases `effort`; D-CF4-06 does not say. Recommendation: lowercase (parity), log as dubious.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | v24.22.1 | — |
| npm | scripts | yes | 10.9.9 | — |
| pi-subagents (peer cache) | agent scenarios | yes | 0.84.0 | — |
| pi-mcp-adapter / pi-dynamic-workflows (peer cache) | skill/invocation seeds | yes | 7.0.0 / 3.15.0 | — |
| Claude Code binary | upstream re-checks only | yes | 2.1.316 | evidence record |
| `setpriv` wrapper `nondac-sh` | running tests as root | yes | `/tmp/claude-0/-home-user-pi-claude-marketplace/fb4a8792-4b94-5254-b428-f0378f680856/scratchpad/nondac-sh` | — |
| fallow | gates | yes | 3.35.0 | — |

Run cucumber as: `NODE_OPTIONS=--max-old-space-size=6144 <scratch>/nondac-sh -c 'npx cucumber-js features/agent'` (baseline: 3 scenarios, 39 steps, passed in 31.6 s this session). Run npm scripts with `npm_config_script_shell=<scratch>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`.

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit/integration), `@cucumber/cucumber` 13.3.0 (behavioral) |
| Config file | `cucumber.json` (frozen), `package.json` scripts (frozen) |
| Quick run command | `node --test test/bridges/agents/<file>.test.ts`; `npx cucumber-js features/agent/<file>.feature` (via `nondac-sh`) |
| Full suite command | `npm run check` (static + unpaired + integration + cucumber + direct coverage) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGT-01 | list shows `<plugin>:<name>`, alias, description; nested `p:review:security`; fallback `Agent from p plugin`; two plugins `p1:x`/`p2:x`; builtins control; advertised section | cucumber | `npx cucumber-js features/agent/listing.feature` | no (wave 1) |
| AGT-01 | recursive walk, dotfiles, case, depth 32, symlink skip, declared file, flattened duplicate | unit | `node --test test/bridges/agents/discover.test.ts test/domain/name.test.ts` | yes (rewrite) |
| AGT-02 | foreground run: child prompt = body; child tools; model omitted inherits; `--map-model` run reports `Unknown subagent model ...` | cucumber | `npx cucumber-js features/agent/invocation.feature` | yes (seed) |
| AGT-03 | tools/disallowedTools split, `*`, effort `max`/`med`/integer, model table, `background` -> `Async: true`, others `Async: false`, guided fields warnings | cucumber + unit | `npx cucumber-js features/agent/frontmatter.feature`; `node --test test/bridges/agents/convert.test.ts test/bridges/agents/frontmatter.test.ts` | no / yes |
| AGT-04 | recorded gap D-CF4-10 (no automated test); emission of `async: true` pinned by unit test and `get` scenario | unit + cucumber | `node --test test/bridges/agents/convert.test.ts` | yes |
| AGT-05 | `{requires pi-subagents}` at install; companion later lists agent | cucumber | `npx cucumber-js features/agent/companion-missing.feature` | no |
| AGT-06 | trusted/untrusted explicit-scope pair; untrusted default-scope `Unknown agent` | cucumber | `npx cucumber-js features/agent/project-trust.feature` | yes (seed) |
| AGT-07 | disable/uninstall remove; update replaces description; enable restores | cucumber | `npx cucumber-js features/agent/lifecycle.feature` | no |
| XK-01 | child prompt carries `Base directory for this skill: ...` + body; dmi / no-description skill skipped with warning; skill not in `skills:` | cucumber + unit | `npx cucumber-js --name '<title>' features/agent/invocation.feature`; `node --test test/bridges/agents/stage.test.ts` | partial |

### Sampling Rate
- **Per task commit:** owner unit tests + `npm run test:coverage:direct -- <source>` for each touched pair + the plan's feature file; the hook runs `check:commit`.
- **Per wave merge:** `npm run check` on the combined tree (includes `test:cucumber`), then `npx fallow dupes`.
- **Phase gate:** `npm run check`, `npm run test:modules`, `npm run test:cucumber` green.

### Red-proof expectations
Each product change records a failing run before its fix: D-CF4-01 (nested list line absent), D-CF4-03 (`Imported Claude Code plugin agent ...` instead of `Agent from ...`), D-CF4-14 (no `advertised_subagents` section), D-CF4-05 (`get` has no `Async:` line; omitted-async call launches in background), D-CF4-06 (`Thinking: default` for `effort: max`), D-CF4-07 (`Model: anthropic/claude-sonnet-4-6`), D-CF4-08 (`Tools:` line missing a space-separated tool), D-CF4-04 (child prompt shows pi-subagents' `<available_skills>` block, not the body; measured shape in E7). Pinning-only scenarios (AGT-05, AGT-06, AGT-07) need a negative control each, not a red proof.

### Wave 0 Gaps
- [ ] `features/agent/listing.feature`, `frontmatter.feature`, `companion-missing.feature`, `lifecycle.feature` and their step modules
- [ ] `features/lib/agent-files.ts`: frontmatter map, nested path, replace-on-update writer, raw SKILL.md writer (via frozen `writePublishedPluginFile`/`writePublishedPluginFiles`)
- [ ] Move the seed agent `Given` from `agent/runs.steps.ts` to the shared listing module in its own commit (layout rule D-08)

### Recommended plan/wave split
| Wave | Plan | Owns (product) | Features |
|------|------|----------------|----------|
| 1 | listing tracer | `discover.ts`, `domain/name.ts` (agents fns), `convert.ts` (D-CF4-03 only), `frontmatter.ts` (`advertise`), `types.ts` (namespace), `agent-files.ts`, shared steps, orchestrator test literals for `advertise`/fallback | `listing.feature` |
| 2 | frontmatter | `convert.ts`, `frontmatter.ts` (D-CF4-05/06/07/08), edge test `MAPPED_MODEL`, orchestrator test literals for `async` | `frontmatter.feature` |
| 2 | companion + trust | none expected | `companion-missing.feature`, `project-trust.feature` |
| 2 | lifecycle | none expected | `lifecycle.feature` |
| 3 | invocation + XK-01 | `stage.ts`, `types.ts`, optional `skill-preload.ts`, `convert.ts` (append), `install-outcome.ts`/`update-swap.ts` call sites | `invocation.feature`; AGT-04 gap record |
| 4 | decisions/docs/gate | docs, SUMMARY parent lines | — |

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (project trust) | pi-subagents trust gate kept (D-CF4-09); never write project agents to user scope (SC-1) |
| V5 Input Validation | yes | `assertSafeName` per namespace segment; strict `true`/`false` emission for `async`/`advertise`; emitter quote-flip/newline normalization (AG-8) |
| V6 Cryptography | no | — |
| V12 Files and Resources | yes | symlink refusal in the walk and for declared files; `assertPathInside` on staged/target paths; skill sources come from skills-bridge records already contained |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Symlinked agent dir/file escaping the plugin root | Tampering / Info disclosure | skip `isSymbolicLink()` before recursion or read (T-03-27) |
| Path separators or control chars in a folder name reaching a filename | Tampering | per-segment `assertSafeName` before `generatedAgentName` |
| Plugin-authored description entering the parent system prompt (`advertise`) | Spoofing (prompt injection) | upstream does the same; pi-subagents XML-escapes and caps at 512 bytes; note in Threat Flags |
| Inlined skill body breaking the agent frontmatter | Tampering | content is appended after the closing `---`; pi-subagents splits at the first closing delimiter |
| Inline `!` commands executing at install | Elevation | not executed by the agents bridge (residual, literal text) |

## Sources

### Primary (HIGH)
- Repository source read this session: `bridges/agents/{convert,discover,frontmatter,stage,types}.ts`, `domain/name.ts`, `shared/fs-utils.ts`, `shared/concerns/soft-dep.ts`, `orchestrators/plugin/{install-outcome,update-swap,discover-names,info}.ts`, `bridges/skills/{stage,types}.ts`, `persistence/{locations,agents-index-schema}.ts`, `.fallowrc.json`, `features/**` harness files, `test/**` pins listed above.
- pi-subagents 0.84.0 source: `src/agents/advertised-agent-prompt.js`, `src/extension/index.js`, `src/extension/config.js`, `src/agents/agent-management.js`, `src/runs/foreground/subagent-executor.js`, `src/runs/shared/child-session.js`, `src/runs/shared/child-tool-plan.js`, `src/runs/background/runner-aliases.js`, `src/shared/required-child-extensions.js`.
- Measured experiments (throwaway, scratch only): `/tmp/claude-0/-home-user-pi-claude-marketplace/fb4a8792-4b94-5254-b428-f0378f680856/scratchpad/researcher/exp/` (`exp.steps.ts`, `f1`-`f7.feature`, `out/e1..e9.json`, `out/e4tmp/`).
- `04-UPSTREAM-AGENTS.md`, `04-PI-SUBAGENTS.md` (this directory).

### AGT-04 measured root cause (pasted)
With `subagents.defaultSubagentOnlyExtensions` pointing at the scripted model (E4), the wake notice read `Background task failed: **demo:bg** ... Model "faux/faux-1" not found. Use --list-models to see available models.` Registering the same file through `registerRequiredChildExtensions` (E4b, scratch extension `reqext.ts`) surfaced the cause: `Required child extension failed to load: /home/user/pi-claude-marketplace/features/lib/scripted-model/extension.ts: Failed to load extension: Cannot find module '/home/user/pi-claude-marketplace/node_modules/@earendil-works/pi-ai/dist/compat.js/providers/faux'`. The alias table maps the bare specifier: `{ specifier: "@earendil-works/pi-ai", pkg: "@earendil-works/pi-ai", subpath: "./compat" }` and has no `providers/faux` entry (`src/runs/background/runner-aliases.js:16-27`). Fixing it needs the frozen scripted model (import path) or pi-subagents (alias), and the parent/child call race on the shared call-log index remains. Recommendation: **recorded gap under D-CF4-10**; draft a pi-subagents report (alias prefix match) and a parent line for the scripted model; no async scenario ships.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from disk.
- Architecture / change map: HIGH — every anchor read this session; D-CF4-04 design MEDIUM (two viable sources, recommendation reasoned).
- Observation mechanics: HIGH — measured with the real harness.
- Wave split: MEDIUM — follows the ROADMAP rule on product-file contention, deviates from the three-wave template.

**Research date:** 2026-11-01
**Valid until:** 2026-12-01 (pins are frozen; re-check if pi-subagents or Pi versions change)
