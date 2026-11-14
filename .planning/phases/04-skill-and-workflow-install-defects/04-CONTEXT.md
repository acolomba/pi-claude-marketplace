# Phase 4: Skill and Workflow Install Defects - Context

**Gathered:** 2026-11-13
**Status:** Ready for planning
**Mode:** autonomous smart discuss (the user said "just go ahead without asking
me"). Every question that smart discuss would ask took its recommended answer.
Those answers are marked **pending maintainer review**.

<domain>
## Phase Boundary

Deliver PG-CORE-01, PG-SKILL-04, PG-WF-01, and PG-SEC-01, so that the official
skill and workflow plugins install what Claude Code loads, and the installed
text names things that exist:

- A marketplace entry whose `source` is the marketplace root and which lists
  `skills` installs only the listed skills. At the next `update` or
  `reinstall`, no file or record of a removed skill stays behind (PG-CORE-01).
- A relative link from a staged skill to a sibling skill of the same plugin
  resolves to the sibling's staged folder (PG-SKILL-04).
- A workflow reference that the source wrote without a leading slash keeps no
  slash, so `Workflow({ name: "demo:scan" })` starts the workflow. A reference
  that the source wrote with a slash keeps the slash (PG-WF-01).
- The install of a plugin whose workflow script names a restricted agent of the
  plugin prints a note that the workflow does not keep the restriction, and
  `info` shows the note. The workflow compatibility page says the same. The
  engine request is drafted under `.planning/upstream/` (PG-SEC-01).

Phase 1 is complete. This phase changes nothing inside Pi or a companion
package. The engine fix stays a drafted request. PG-WF-02 (the `agentType`
binding scenario and the unknown-agent note) is Phase 8 work. The
`docs/workflows-compatibility.md:126` correction belongs to PG-WF-02, not to
this phase. The `:174` correction lands here.

</domain>

<decisions>
## Implementation Decisions

### Root-source skill selection (PG-CORE-01)

- **D-PG4-01 (pending maintainer review; hard to reverse: it amends D-CF1-06
  and changes the installed skill set of existing plugins):** Copy the 2.1.323
  rule exactly. The rule applies when the entry's `source` is a **string**
  whose segments, split on `/` or `\`, are all `""` or `"."` (`"./"`, `"."`),
  and the entry's `skills` is present and non-empty (a string or an array).
  An object-form path source does not trigger it. Then:
  - The validated listed paths replace both the conventional `skills/` folder
    and the manifest's `skills` paths.
  - `skills/` stays only when a listed path is `skills/` itself or the plugin
    root. Such a path then does not count twice.
  - If no listed path survives validation and at least one was refused as
    path traversal, the plugin installs no skills.
  - If no listed path survives and none was a traversal, the normal rule
    applies (`skills/` plus the manifest paths). This is how upstream behaves.
    The existing refusal notes still print. The maintainer should confirm that
    this fallback, which looks odd, is wanted. Parity is the default, so this
    record keeps it.
  Build the rule once in the strict arm (`collectStrictComponentKind` in
  `domain/component-paths.ts`) and in the lenient mirror in
  `orchestrators/plugin/info.ts` (around `:2100-2140`). D-CF1-06 is amended
  with this exception (see Parent lines). D-CF1-06's shadowed-folder warning
  does not cover `skills/` here: upstream drops the folder silently.
- **D-PG4-02 (pending maintainer review; product: what existing users have to
  do):** No migration at load (APL-D1). An installed plugin loses the extra
  skills at its next `update` that re-materializes it, or at `reinstall`, or
  at an `apply` convergence move. Each of these uses the skills bridge's
  existing `previousSkillNames` unstage path. Do not add new detection for
  drift in the resolved set. The CHANGELOG entry tells users of
  `anthropics/skills` plugins to run `reinstall` once. The plan must prove
  that after such an update or reinstall none of these stays: the skill's
  target folder, its `resources.skills` entry in `state.json`, its name claims
  and aliases, and its completion-cache rows. Research before planning:
  whether `update` sees a change when only the entry's `skills` list in
  `marketplace.json` changes. For a root-source path plugin, the hash version
  covers the marketplace root, which likely includes `.claude-plugin/`.
  Success criterion 1 depends on this.
- **D-PG4-03:** When several plugins share one `skills/` folder, as the five
  `anthropics/skills` entries do, each plugin installs only its own listed
  skills under its own prefix. There is no de-duplication across plugins,
  because upstream loads each plugin on its own.

### Sibling skill links (PG-SKILL-04)

- **D-PG4-04:** Resolve by source path, not by matching folder names. A
  relative path token that starts with one or more `../` segments is resolved
  against the source location of the file it appears in, inside the plugin
  tree. If it lands at or inside a discovered skill folder of the same plugin,
  and that folder is not the file's own skill, the token is rewritten. The new
  path runs from the staged file to the sibling's staged folder
  (`../<generated name>/<rest>`), and a trailing `/` is kept. This covers
  supporting Markdown in subfolders (`references/x.md` linking
  `../../b/ref.md`). It also covers the bare folder form that `plugin-dev`
  uses (`` `../hook-development/` ``).
- **D-PG4-05:** Rewrite wherever the token appears in a staged `SKILL.md` or
  its supporting `.md` files: link targets, code spans, plain text, and fenced
  code. This matches the existing all-lines `rewriteMarkdownReferences` pass.
  A rewrite happens only when the path resolves to a real sibling skill, which
  limits the risk of changing prose that only looks like a path. The pass
  runs before `${CLAUDE_*}` substitution. `${CLAUDE_SKILL_DIR}/../b/...` is
  rewritten the same way, because after substitution it would also point at a
  missing folder.
- **D-PG4-06:** Leave a path untouched when it resolves outside every sibling
  skill (`../../docs/x.md`, climbing to the plugin root; the requirement
  excludes this), or when the sibling did not stage (skipped, collided, or
  refused). Such a path stays dead, as it is today. `${CLAUDE_PLUGIN_ROOT}/...`
  paths already work and are not touched.
- **D-PG4-07:** The skills staging context needs the sibling map (source skill
  folder to generated name) next to `InstalledReferenceNames`. The install,
  update, reinstall, and marketplace paths that build that context
  (`install-outcome.ts`, `update-swap.ts`, `marketplace/shared.ts`) pass the
  map. The record-only fallback in `stageSkill` cannot rebuild it and leaves
  sibling paths alone.

### Workflow references (PG-WF-01)

- **D-PG4-08:** In `rewriteMarkdownReferences`, a token that resolves to a
  workflow keeps the source's leading-slash state. Without a slash in the
  source, the output is the bare installed name (`demo:scan`). With a slash,
  it is `/demo:scan`. Name elision is still applied (`acme:acme-audit`
  becomes `acme:audit`). Resolution of commands and skills does not change
  (they keep `/<command>` and `/skill:<name>`), and neither does the
  command > skill > workflow precedence. The rule applies to every caller of
  the rewriter: skills and their supporting Markdown, commands, and agent
  bodies. A skill's `allowed-tools` entry `Workflow(claude-security:scan)`
  therefore stays bare.
- **D-PG4-09 (closes the ROADMAP open question):** No cucumber fixture relies
  on a bare `plugin:workflow` mention becoming a slash command. `features/`
  only runs typed `/demo:hello` commands. Two unit tests in
  `test/domain/skill-tokens.test.ts` expect `/acme:audit` from a bare source:
  "converges an elidable reference onto a generated workflow name" and "keeps
  the colon workflow name on win32". Change them to expect the bare name, and
  add a case for a source that already has a slash.
- **D-PG4-10:** Correct `docs/workflows-compatibility.md:174` in the same
  change. Retargeting keeps the source's leading slash, so a name inside a tool
  call matches the saved workflow name the engine's `workflow` tool loads, and
  a slash reference matches the command. Name the residuals from PRD §8.4: the
  engine's tool text tells the model to call `workflow` only when the user
  opted in, and `parallel()` rejects.

### Workflow agent tool restriction (PG-SEC-01)

- **D-PG4-11:** The trigger is an admitted (`named`) workflow script with a
  string-literal `agentType` property value equal to the name of an agent the
  same plugin ships, where that agent's source frontmatter declares a
  non-empty `tools` or `disallowedTools` field. Match against the upstream
  name `<plugin>:<agent source name>` and the generated agent name. The note
  appears whether or not pi-subagents is present and whether or not the agent
  was staged, because the engine runs either way without the restriction.
  Accepted residuals: an `agentType` that is not a literal gives no note (a
  missing note, never a false one), and so does an agent of another plugin.
  The divergence is licensed by a Pi capability gap: the engine, which this
  project does not own, creates the child session (spike S4).
- **D-PG4-12 (pending maintainer review; product: user-visible wording and
  granularity):** Give one note per distinct (script, agent type) pair, in the
  existing workflow-script note family. The note never refuses and never
  changes the install's outcome. Proposed install wording: `workflow script
  "scan.js" in "workflows" runs agent type "demo:reader", which restricts its
  tools; the workflow engine does not keep that restriction, so the agent can
  use read, bash, edit, and write`. `info` uses the same text in the
  info-tense form that the existing notes use.
- **D-PG4-13:** Placement. A pure domain helper in `domain/workflow-script.ts`
  pulls the literal `agentType` values out of the AST the module already
  parses. An orchestrator-level join with the agents discovery output builds
  the notes. The workflows bridge must not import the agents bridge (fallow
  boundary zones). The notes travel in `discoveryWarnings`, as D-CF1-06's
  shadowed-folder warnings do, so install, update, reinstall, apply, and
  `info` share one path. Recompute the notes. Never persist them, so there is
  no `state.json` schema change.
- **D-PG4-14:** The compatibility page gets a row for an agent type's tool
  restriction (upstream ✓, Pi ✗), with spike S4 as evidence (engine 3.15.1,
  Pi 1.5.2). The row says that only the engine's codemode path removes denied
  built-ins, and that the install note exists.
- **D-PG4-15:** Draft the engine request as
  `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md`. Follow
  the shape of the existing drafts there: a Patch line, the repository, the
  measured package version, the problem with evidence, and a draft issue with
  title and body. The request: apply the agent type's tool policy to Pi's
  built-in tools in every mode. The codemode branch already pushes
  policy-filtered names into `excludeTools`
  (`src/agent.ts:1208-1262` at 3.15.0; recheck the lines at 3.15.1). A patch
  is optional. The maintainer files the request (REQUIREMENTS out of scope:
  changes inside companion packages). The other §8.4 requests are not part of
  this draft.

### Behavioral evidence

- **D-PG4-16:** Each requirement ships a cucumber scenario that fails without
  its change (AGENTS.md "Behavioral tests"), shaped like its success
  criterion. The cases: a root-source entry where `info` lists `a` only and
  only `a` installs, then an update that drops a listed skill and leaves
  nothing behind; a sibling link that names an existing staged file in the
  text the model receives; a scripted-model run that copies `demo:scan` from
  the prompt and completes; and a restricted-agent workflow whose note
  appears at install and in `info`. Owner unit tests cover each rule's edge
  arms: the traversal and no-valid-path fallbacks, the slash-preserving case,
  `../../` climbing, and a non-literal `agentType`. All tests run in a
  hermetic home and never touch the real `~/.pi/agent`.

### Decided autonomously

Reversible technical choices, each cheap to undo before planning: D-PG4-03,
D-PG4-04, D-PG4-05, D-PG4-06, D-PG4-07, D-PG4-08, D-PG4-09, D-PG4-11,
D-PG4-13, D-PG4-14, D-PG4-15, D-PG4-16. Undo touches one pure function or one
module, or a doc or draft file, with no persisted data.

### Pending maintainer review

Recommended answers taken without asking, because the run is non-interactive:

- D-PG4-01: hard to reverse. It amends D-CF1-06, changes the installed set,
  and keeps upstream's odd no-valid-path fallback.
- D-PG4-02: product. Existing installs keep the extra skills until the user
  runs `update` or `reinstall`, and there is no load-time warning.
- D-PG4-12: product. The note's wording and its one-note-per-pair
  granularity.

### the agent's Discretion

The exact token grammar for relative paths. The names of internal types and
fields. Whether the sibling map extends `InstalledReferenceNames` or sits
beside it. The final wording of the documentation (D-PG4-10, D-PG4-14) inside
the stated content. Whether the upstream draft carries a patch. Plan splits.
No exception to plan size, security, coverage, or verification gates.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/component-paths.ts`: `collectStrictComponentKind` (`:493-526`) and
  `conventionalFolderApplies` (`:475-481`, which always returns `true` for
  skills, the root of PG-CORE-01). `addValidatedComponentPaths` and
  `validateComponentPath` already produce refusal notes, and the root-source
  rule needs to know whether a refusal was path traversal.
- `orchestrators/plugin/info.ts` `:2100-2140`: the lenient mirror of
  D-CF1-06, which must follow the same rule.
- `bridges/skills/stage.ts`: `stageSkill` (`:283-380`) calls
  `rewriteMarkdownReferences` before `substituteClaudeVars`, then
  `rewriteSupportingMarkdown` (`:165-196`). That is where the sibling-path
  rewrite hooks in. `skillVars.skillDir` is the staged target folder.
- `domain/skill-tokens.ts` `:82-118`: `rewriteMarkdownReferences`. The
  workflow arm (`:114-115`) is the single line PG-WF-01 changes. Its callers
  are listed in `docs/research/parity-gaps/workflows.md` WF-01.
- `domain/workflow-script.ts`: `admitWorkflowScript` already parses the
  script AST and has `literalString`. `bridges/workflows/discover.ts`
  `verdictWarning` and the tense-aware note family are the formatting
  precedent.
- `orchestrators/plugin/install-outcome.ts:1238-1240` and
  `update-swap.ts:1703`: the `discoveryWarnings` composition sites for
  orchestrator-level notes.
- `bridges/skills/unstage.ts` `previousSkillNames`: removes skills that are
  no longer discovered at update.

### Established Patterns

Pure domain functions with owner unit tests. Notes never refuse an install.
The cross-bridge import ban (fallow zones) means cross-kind joins happen in
orchestrators. All disk writes are atomic. There is one mode-selected output
channel. Trace the callers with CodeGraph before editing, because the
rewriter has callers in the skills, commands, and agents bridges.

### Integration Points

- `features/lib/published-marketplace.ts` and `features/lib/workflow-files.ts`
  publish fixture plugins, skills, agents, and workflows. A root-source entry
  needs a fixture marketplace whose entry has `source: "./"`.
- The scripted-model harness (`features/workflow/run.feature`) can carry the
  PG-WF-01 run.
- The engine source for the request:
  `node_modules/.cache/optional-peers/node_modules/@quintinshaw/pi-dynamic-workflows/src/agent.ts`
  (3.15.0 installed; spike S4 ran on 3.15.1).

</code_context>

<specifics>
## Specific Ideas

Upstream evidence, checked 2026-11-13 (compat-research evidence records):

1. **Root-source `skills` (PG-CORE-01).** Docs:
   <https://code.claude.com/docs/en/plugins-reference.md> line 674: "When a
   marketplace entry whose `source` is the marketplace root lists specific
   `skills` subdirectories, only those subdirectories load, and the plugin's
   default `skills/` directory isn't scanned." Binary: Claude Code **2.1.323**
   (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`),
   grep of
   `typeof e.source==="string"&&e.source.split(/[\\/]/).every((nt)=>nt===""||nt===".")&&e.skills!==void 0`.
   It keeps `skillsPath` (the folder) only if a listed path equals
   `<root>/skills` or `<root>`, sets `skillsPaths` to the other listed paths
   (which replaces the manifest paths), clears both when the only refusals are
   traversals, and leaves both unchanged when nothing validates without a
   traversal. Confidence high for the rule. The PRD's 2.1.322 reading agrees.
   Not run in a sandbox.
2. **Sibling skill paths (PG-SKILL-04).** Docs:
   <https://code.claude.com/docs/en/skills.md> line 492: `${CLAUDE_SKILL_DIR}`
   is "the skill's subdirectory within the plugin". Plugin skills stay inside
   the plugin tree, so `../<sibling>/` resolves. Artifacts in the local
   `claude-plugins-official` clone:
   `plugins/mcp-server-dev/skills/build-mcp-app/SKILL.md:59`
   (`../build-mcp-server/references/elicitation.md`) and
   `plugins/plugin-dev/skills/skill-development/SKILL.md:609-614` (six bare
   `../<folder>/` mentions). Confidence high.
3. **Workflow names (PG-WF-01).** Docs:
   <https://code.claude.com/docs/en/workflows.md> line 214 (plugin workflows
   are namespaced `<plugin>:<meta.name>`). Artifacts (local clone, observed
   2026-11-13): `code-modernization/commands/modernize-*.md` (7 `Workflow({`
   sites), `claude-security/skills/claude-security/jobs/scan-*.md`
   (`Workflow({ name: "claude-security:scan",`), and
   `claude-security/skills/claude-security/SKILL.md:12`
   (`Workflow(claude-security:scan)`). The engine refuses names that contain
   `/` (workflows report WF-01, `workflow-saved.ts:84-94`). Confidence high.
4. **Agent type tool restriction (PG-SEC-01).** Binary 2.1.323: the workflow
   `agent()` path throws `agent type '<x>' not found. Available agents: ...`,
   then builds the spawn options with
   `disallowedTools:[...q.disallowedTools??[],...rn.disallowedTools??[]]` and
   `tools:q.tools`. So upstream keeps the agent definition's `tools` and
   `disallowedTools`. The Pi side: spike S4 (PRD §9, run 2026-11-11, engine
   3.15.1, Pi 1.5.2) shows a child whose agent type allows only `read` holding
   `read, bash, edit, write`, and `bash` staying when denied. Engine 3.15.0
   source, `src/agent.ts:1208-1262`: `applyToolPolicy` filters `customTools`
   only, and policy names reach `excludeTools` only under
   `builtin:codemode`. Confidence high.

PRD §5.2 lists no open decision for this phase. Use counts (PRD): all five
`anthropics/skills` entries have the root-source shape; 2 of 40 official
skills use sibling links; 9 workflow call sites in 7 files; `agentType` in 7
of 7 official scripts.

</specifics>

<deferred>
## Deferred Ideas

- Paths that climb to the plugin root (`../../docs/x.md`). PG-SKILL-04 leaves
  them out. A later option is to stage a plugin's skills under one folder that
  keeps the original names.
- Version-gating or removing the PG-SEC-01 note once an engine release keeps
  the restriction. Add a BACKLOG item when the request is filed.
- Bare-name preservation for command and skill references in tool-call
  positions (for example `Skill({ skill: "plugin:x" })`). Pi has no matching
  tool. Not part of PG-WF-01.
- PG-WF-02 (binding scenario, unknown-`agentType` note, the `:126` doc fix),
  WF-03 option notes, WF-05 `Workflow` grants: Phase 8 and later.
- The other §8.4 engine requests (`parallel()` nulls, the tool text that
  invites plugin instructions, listing saved names).

</deferred>

## Parent lines for the orchestrator

Recommended PROJECT.md amendments. This phase did not edit PROJECT.md.

1. Append to the D-CF1-06 decision text (Key Decisions table, row starting
   `**D-CF1-06 (component-features, Phase 1, ...`), after "Skills keep the
   union.":

   > Exception (D-PG4-01, Claude Code 2.1.323): when a marketplace entry's `source` is a string that names the marketplace root (every `/`- or `\`-separated segment is empty or `.`) and the entry lists a non-empty `skills`, only the listed paths load; `skills/` and the manifest's `skills` paths are not read unless a listed path is `skills/` or the root.

2. Replace the "Supplemental component paths" bullet under Out of Scope
   (`.planning/PROJECT.md:1750`) with:

   > - **Supplemental component paths for `commands`, `agents`, and `workflows`** -- a declared path replaces the conventional folder, and install warns when an existing folder is left unread, as in Claude Code 2.1.316. A declared `skills` path still adds to `skills/` (D-CF1-06), except for a root-source marketplace entry that lists `skills`, which loads only those paths (D-PG4-01). A marketplace entry's `commands` adds to `commands/`, as the 2.1.316 binary does (D-CF3-04).

3. Add decision rows D-PG4-01 (root-source skills), D-PG4-08 (workflow
   references keep the source's slash state), and D-PG4-11/12 (workflow
   agent-restriction note, licensed by the engine capability gap; spike S4)
   once the phase verifies. Mark D-PG4-01, D-PG4-02, and D-PG4-12 as accepted
   without review until the maintainer confirms them.
