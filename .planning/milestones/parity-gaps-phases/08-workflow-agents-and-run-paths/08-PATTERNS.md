# Phase 8: Workflow Agents and Run Paths - Pattern Map

**Mapped:** 2026-11-14
**Files analyzed:** 24
**Analogs found:** 23 / 24

All paths are relative to the worktree `/home/acolomba/src/pi-claude-marketplace-gaps-agents`. `E` = `extensions/pi-claude-marketplace`. Every analog named is git-tracked source (checked with `git ls-files`). Line numbers were read on `features/gaps-agents` on the mapping date; find a site by its quoted text if a line has moved.

The amendments at the end of `08-CONTEXT.md` win. So the PG-WF-05 rows are split: option A (recommended, docs only) and option B (code, only after the maintainer's `checkpoint:decision`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `E/orchestrators/plugin/discover-names.ts` (MOD: PG-WF-02(b) join, shared note lead, one notes field) | orchestrator helper (pure join) | transform | itself: `workflowAgentRestrictionNotes` :168-185, `restrictionNote` :136-145, `restrictedAgentTools` :107-123 | exact |
| `test/orchestrators/plugin/discover-names.test.ts` (MOD) | test | transform | itself: PG-SEC-01 cases :273-300, :460-494, :496-520; helpers :70-95 | exact |
| `E/orchestrators/plugin/install-outcome.ts` (MOD: field rename only) | orchestrator ledger body | CRUD | itself :1251-1255 | exact |
| `E/orchestrators/plugin/update-swap.ts` (MOD: field rename only) | orchestrator | CRUD | itself :1710-1715 | exact |
| `E/orchestrators/plugin/info.ts` (MOD: function rename only) | orchestrator (read-only preview) | request-response | itself `previewAgentRestrictionNotes` :1270-1298, `notes` :1169-1175 | exact |
| `test/orchestrators/plugin/{install-outcome,update-swap,info}.test.ts` (MOD: adjust for the rename) | test | - | themselves | exact |
| `features/workflow/agent-steps.feature` (MOD: PG-WF-02(a) binding scenario; PG-WF-07 schema and worktree scenarios) | behavioral test | - | itself :38-62 ("...quoted description holds a colon runs on the agent's body") | exact |
| `features/workflow/missing-agents.feature` (NEW) or scenarios added to `agent-restrictions.feature` (planner's choice) | behavioral test | - | `features/workflow/agent-restrictions.feature` :1-45 (install), :47-76 (update), :78-110 (info), :112+ (no note) | exact |
| `features/workflow/references.feature` or `run.feature` (MOD: PG-WF-07 scenario 1, object `args`) | behavioral test | - | `features/workflow/references.feature` :66-87 | exact |
| `features/workflow/run.feature` (MOD: PG-WF-07 scenario 4, `workflow()` nesting) | behavioral test | - | itself :16-22 | exact |
| `features/workflow/collisions.feature` (MOD: PG-WF-07 scenario 5, two scripts with one `meta.name`) | behavioral test | - | `features/plugin/install-rollback.feature` :9-27 (failed install, nothing written) + `collisions.feature` Background shape | role-match |
| New `Given` step "project is a git repository" in a project or session step module (not `workflow/`) | test harness step | file-I/O | `features/lib/git-marketplace.ts:22-30` (`publishGitRepository`) on `features/lib/hermetic-git.ts:36-43` (`runGit`); step shape `features/step_definitions/hook/tool-use.steps.ts:72` (`this.tokens.projectDir`) | role-match |
| `test/architecture/catalog-uat/fixtures/plugin-info.ts` (MOD: one state for the new note) | test fixture | - | itself :158-183 `installed-with-workflow-preview-note` | exact |
| `test/architecture/catalog-uat/fixture-maps.ts` | unchanged: `PLUGIN_INFO_FIXTURES` is already in `FIXTURE_MAPS` (:14) | - | - | - |
| `docs/output-catalog.md` (MOD: one state section for the note) | docs | - | itself :3125-3155 (the two `note:` states) | exact |
| `docs/workflows-compatibility.md` (MOD: `agentType` row at :126, the paragraph at :165, new section "What a workflow subagent can reach") | docs | - | its own rows with evidence grades | role-match |
| `docs/mcp-compatibility.md` ("Customizing generated agents", :374-453), `README.md`, `README.es.md` (MOD: the `Workflow` sentence, under A or B) | docs | - | Phase 7 `Agent`/`Task` grant text in the same section | role-match |
| `docs/prd/parity-gaps-prd.md` section 9 (MOD: S5 "Result" cell) | docs | - | the S4 cell beside it | exact |
| `.planning/phases/08-workflow-agents-and-run-paths/08-SPIKE-S5.md` (NEW record) | spike record | - | none in this phase directory; follow RESEARCH R1 "Records" | no analog |
| S5 scratch fixture (NOT committed unless it becomes the criterion 5 proof) built from `features/lib/real-subagent-child.ts` | test harness | event-driven | `features/lib/real-subagent-child.ts` `createFixture` :444-500, `writePiConfiguration` :504-522, `NAMED_CALLS` :996-1000 | exact |
| **Option B only:** `E/bridges/agents/convert.ts` (MOD) | converter | transform | itself: `TOOL_MAP` :92-102, `runsMcpTools` :1130-1140, `backgroundForMcp` :1011-1014 and :1075 | exact |
| **Option B only:** `test/bridges/agents/convert.test.ts`, `grant-forms.test.ts` (MOD) | test | transform | themselves (Phase 7 `Agent`/`Task` cases) | exact |
| **Option B only:** `features/agent/frontmatter.feature` (MOD: `subagent get` outline; live child scenario) | behavioral test | - | itself :1232-1264 (outline "An agent that grants <grant> gets pi-subagents' subagent tool"); :384-408 (real-child scenario) | exact |
| **Option B only:** `features/lib/real-subagent-child.ts`, `features/step_definitions/plugin/subagent-hooks.steps.ts` (MOD: workflow in the fixture plugin, new step text, new named call) | test harness | event-driven | themselves; step at `subagent-hooks.steps.ts:379-403` | exact |
| `E/domain/workflow-script.ts`, `E/bridges/agents/{legacy-grant-form,grant-rewrite}.ts` | unchanged on purpose | - | - | - |

## Pattern Assignments

### `E/orchestrators/plugin/discover-names.ts` (pure join, transform)

**Imports already present** (:23-33), nothing new is needed:
```ts
import path from "node:path";

import { discoverPluginAgents, listedToolNames } from "../../bridges/agents/index.ts";
...
import { declaredAgentName } from "../../domain/name.ts";
import { forMessage } from "../../domain/workflow-script.ts";

import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { WorkflowVerdict } from "../../domain/workflow-script.ts";
```

**Input shapes to reuse as they are** (:53-65):
```ts
export interface RestrictionAgent {
  readonly sourceName: string;
  readonly generatedName: string;
  readonly namespace?: readonly string[];
  readonly raw: { readonly tools?: string; readonly disallowedTools?: string };
}

export interface RestrictionWorkflow {
  readonly verdict: WorkflowVerdict;
  readonly scriptFile: string;
}
```

**The model join to mirror** (:168-185):
```ts
export function workflowAgentRestrictionNotes(
  pluginName: string,
  agents: readonly RestrictionAgent[],
  workflows: readonly RestrictionWorkflow[],
): readonly string[] {
  const restricted = restrictedAgentTools(pluginName, agents);

  return workflows.flatMap(({ verdict, scriptFile }) =>
    verdict.outcome === "named"
      ? (verdict.agentTypes ?? []).flatMap((agentType) => {
          const unkept = restricted.get(agentType);
          return unkept === undefined
            ? []
            : [restrictionNote(verdict.fileName, scriptFile, agentType, unkept)];
        })
      : [],
  );
}
```

**The note lead to share** (`restrictionNote`, :136-145). Extract the part up to and including the agent type into one helper that both note builders call. A second copy is a `fallow dupes` clone group. Keep the folder rule and its comment (base name of the script's folder, because redaction would eat the quoted agent type):
```ts
const folder = path.basename(path.dirname(scriptFile));

return `workflow script "${forMessage(fileName)}" in "${forMessage(folder)}" runs agent type "${forMessage(agentType)}", which restricts its tools; ...`;
```

**The declared-name set** uses the same call as `restrictedAgentTools` (:118), without the generated name (RESEARCH R2: a generated name never starts with `<plugin>:`):
```ts
declaredAgentName(pluginName, agent.sourceName, agent.namespace)
```

**New function**: RESEARCH "Code Examples / The join (D-PG8-04)" is the skeleton (`missingAgentTypeNotes`: prefix `${pluginName}:`, `!installed.has(agentType)`). Add the per-script cap of Amendment 7 (value and summary wording are the planner's proposal). New text (D-PG8-05, tenseless, one text for install and `info`):
`workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run`

**One field, not two** (RESEARCH R2 and "Anti-Patterns"). Today's field and its single assembly site (:49-51, :239-243):
```ts
readonly workflowAgentRestrictionNotes: readonly string[];
...
workflowAgentRestrictionNotes: workflowAgentRestrictionNotes(
  plugin,
  agentsDiscovery.discovered,
  workflowsDiscovery.discovered,
),
```
Rename the field and the exported function for what they now hold (for example `workflowAgentNotes`), keep both builders private, and order the notes per script in the order the script names the types. A renamed field makes a consumer that is not updated fail to compile. Update the header comment (:18-21) and the two doc comments (:147-167, :207-212) with `PG-WF-02 / D-PG8-04`, never a phase number. Keep each function under cognitive 15 on both gates: one small function per note kind.

### The three consumers (rename only)

`E/orchestrators/plugin/install-outcome.ts:1251-1255`:
```ts
discoveryWarnings: [
  ...shadowedFolderDiscoveryWarnings(installable.shadowedFolders),
  ...refusedListedSkillPathMessages(installable.refusedListedSkillPaths).map(discoveryWarning),
  ...generatedNames.workflowAgentRestrictionNotes.map(discoveryWarning),
],
```

`E/orchestrators/plugin/update-swap.ts:1710-1715`:
```ts
const stagingWarnings = [
  ...shadowedFolderDiscoveryWarnings(installable.shadowedFolders),
  ...refusedListedSkillPathMessages(installable.refusedListedSkillPaths).map(discoveryWarning),
  ...generatedNames.workflowAgentRestrictionNotes.map(discoveryWarning),
  ...collectUpdateWarnings(handles),
];
```

`E/orchestrators/plugin/info.ts:1270-1298`. The early return and the `try` both stay right for the new note (RESEARCH Pitfall 8: a note may cost itself and never the row):
```ts
const namesAgentTypes = workflows.some(
  ({ verdict }) => verdict.outcome === "named" && verdict.agentTypes !== undefined,
);
if (!namesAgentTypes) {
  return [];
}

try {
  ...
  const { discovered } = await discoverPluginAgents({ pluginName, agentsDirs });

  return workflowAgentRestrictionNotes(pluginName, discovered, workflows).map((note) =>
    redactAbsolutePaths(note),
  );
} catch (err) {
  hookDebugLog(`info: agent restriction notes skipped for "${pluginName}": ${errorMessage(err)}`);
  return [];
}
```
The result enters `notes` at :1169-1175 after `...workflows.warnings`. Update the "PG-SEC-01" comments at each of the three sites to name both notes.

### `test/orchestrators/plugin/discover-names.test.ts` (owner test)

**Imports and helpers** (:1-16, :70-95). The test builds real plugin folders under `mkdtemp(path.join(tmpdir(), prefix))` with `t.after(() => rm(...))`; it touches no Pi home:
```ts
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverGeneratedNames } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts";
```
```ts
function agentCall(agentType: string): string {
  return `await agent("run", { agentType: ${JSON.stringify(agentType)} });\n`;
}

function restrictionNote(fileName: string, folder: string, agentType: string, unkept: string): string {
  return `workflow script "${fileName}" in "${folder}" runs agent type "${agentType}", which restricts its tools; ...`;
}
```
Add a sibling `missingAgentNote(fileName, folder, agentType)` helper.

**Case shape to copy** (:273-300, arrange / act / assert, whole-object `deepStrictEqual`):
```ts
test("PG-SEC-01: notes a workflow script that runs a tool-restricted agent of the plugin", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-restricted-");
  ...
  await writeAgent(agentsDirectory, "reader.md", { tools: "Read" });
  await writeWorkflow(workflowsDirectory, "scan.js", "scan", agentCall("acme:reader"));
  const resolved = resolvedPlugin(pluginRoot, { agents: ["agents"], commands: [], skills: [], workflows: ["workflows"] });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, { ..., workflowAgentRestrictionNotes: [ `workflow script "scan.js" ...` ] });
});
```
- Order and distinct-pair case: :460-494 (two scripts, repeated types, `a.js` before `b.js`).
- Escape case: :496-520 (`U+202E` in the file name, `U+200B` in the agent type, expected through `String.raw`). Add a `\n` case for the agent type.
- Table-driven "no note" cases: the `for (const { shape, frontmatter, script } of [...])` loop at :380+.
- New cases (RESEARCH Pitfall 6 and the test map): bare name, another plugin's name, the generated flat name, a nested name that exists (`acme:review:security`), the plugin name alone with a colon, a non-literal, a skipped or refused script, an AG-12 dropped duplicate, both kinds of note for one script, the cap.
- Every existing `workflowAgentRestrictionNotes: []` literal (:133, :157, :183, :216, :245) follows the field rename.
- Titles cite `PG-WF-02` / `D-PG8-04`. Pair coverage stays 100%: `npm run test:coverage:direct -- test/orchestrators/plugin/discover-names.test.ts`.

### Note scenarios (analog `features/workflow/agent-restrictions.feature`)

**Feature header and Background** (:1-16):
```gherkin
Feature: Workflow agent restrictions

  An install, an update, or an info notes when a workflow runs a plugin agent that restricts its
  tools, ... (PG-SEC-01, a Pi capability gap). A scripted model and a
  local marketplace stand in for real ones.

  Background:
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-subagents         |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
```

**Install scenario** (:18-45). Copy the three `Then` blocks; state the whole note text in both tables (RESEARCH Pitfall 11):
```gherkin
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with the reader."};

      return await agent("Scan the files.", {agentType:"demo:reader"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                           | lines            |
      | cascade    | info     | true         |                                                                  |                  |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 1 declared component has a note. | <whole note text> |
    Then the workflow install diagnostic reports these lines:
      | line             |
      | <whole note text> |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
```
- **Update scenario** :47-76: install 1.0.0 first, offer 1.1.0 with the files, header `Plugin "demo" [user] updated; 1 declared component has a note.`, row `updated` with `from` / `to`.
- **Info scenario** :78-110: `Then the result has these fields:` with the note in `plugin notes`. Note that the field table lists every field (`plugin requires` holds the JSON companion list).
- **No-note scenarios** :112 onward: a name outside the plugin's namespace, and an agent the plugin installs.
- No new step is needed. Untagged workflow scenarios run under the `adapter` profile only (RESEARCH Pitfall 10).

### PG-WF-02(a) binding scenario (analog `features/workflow/agent-steps.feature:38-62`)

```gherkin
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply           | tool | arguments |
      | The files pass. |      |           |
    When the user runs the workflow command "/demo:scan", whose agent steps the model answers
    Then the workflow run ends with the status "completed" and the result "The files pass."
    Then the model receives these calls:
      | call | role | text                                                                    |
      | 1    | user | Read the files you are given.\n\nTask label: agent 1\n\nScan the files. |
```
Use the agents table step for the fixture (:17-19): `the published plugin "demo" of the marketplace "fixtures" has these agents:` with columns `file | name | description | model | body`. The helper declares no `tools` (D-PG8-03). Probe P6's measured row for the unbound case is `Act as workflow subagent type: demo:ghost\n\nTask label: agent 2\n\nAnswer again.`; that is the recorded mutation, and the PG-WF-02(b) scenario can reuse the fixture with `demo:ghost`.

### PG-WF-07: five guard scenarios

| # | Target file | Copy from | Measured rows to state (RESEARCH R4) |
|---|---|---|---|
| 1 | `references.feature` or `run.feature` | `references.feature:66-87` | scripted `workflow {"name":"demo:echo","args":{"who":"Ada","items":["a","b"]}}`; `When the user prompts "..." and the model starts a workflow run`; result `who=Ada n=2` |
| 2 | `agent-steps.feature` | :38-62 | one scripted step `structured_output {"verdict":"pass"}`; result `verdict=pass type=object` |
| 3 | `agent-steps.feature` | :38-62 plus the new `Given` | `bash` steps that print stable text: `git rev-parse --abbrev-ref HEAD \| cut -c1-6` gives `pi/wf/`; later step `git worktree list \| wc -l` gives `2` and `git branch --list 'pi/wf/*' \| wc -l` gives `1` |
| 4 | `run.feature` | :16-22 | `When the user runs the workflow command "/demo:outer"`; result `outer: inner got hi`; notice `started /demo:outer` |
| 5 | `collisions.feature` | `features/plugin/install-rollback.feature:16-27` | see below |

Scenario 1's call table follows `references.feature:80-86` (rows `2 | assistant | tool call workflow {...}` and `2 | tool result | workflow returned: started the workflow echo`).

Scenario 5 result steps (`install-rollback.feature:16-27`):
```gherkin
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons | scope   | version | cause chain                   | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed |         | project | 1.0.0   | {mcp-adapter.json read error} | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the project scope has no installed plugins
```
Measured cause chain for the collision: `Generated workflow name collision detected. Rename the meta.name of one of the source scripts:\n  "demo:scan" <- ["a.js", "b.js"]`. `collisions.feature` has no Background; each scenario repeats the companion and marketplace `Given`s (:8-14). The title states the difference from Claude Code (it keeps the last script that parses, E5), and scenario 3's title states that the engine keeps the worktree (E7).

Five behaviors are five scenarios, not an outline. Each scenario's mutation (R4 "Mutations") goes in the plan SUMMARY and is never committed.

### New `Given`: the session's project is a git repository

**Git calls to copy** (`features/lib/git-marketplace.ts:22-30`), on `runGit` (`features/lib/hermetic-git.ts:36-43`):
```ts
import { runGit } from "./hermetic-git.ts";
...
await runGit(workTree, home, "init", "-q");
await runGit(workTree, home, "add", "-A");
await runGit(workTree, home, "commit", "-q", "--allow-empty", "-m", "publish");
```
```ts
export async function runGit(cwd: string, home: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", ...args],
    { cwd, env: hermeticGitEnvironment(home) },
  );
  return stdout.trim();
}
```
`hermeticGitEnvironment` sets author and committer identity, no system config, and `GIT_CONFIG_GLOBAL=/dev/null`, so the commit needs no user config.

**Where the paths come from**: `this.tokens.projectDir` and `this.tokens.home` on `ScenarioWorld` (`features/support/world.ts:337-342`; `projectDir` is `run.sandbox.cwd`). Existing use: `features/step_definitions/hook/tool-use.steps.ts:72` (`path.join(this.tokens.projectDir, name)`).

**Step shape** (`features/step_definitions/config.steps.ts:156-158`):
```ts
Given(
  "a config in scope {word} and layer {word}, with these plugins:",
  async function (this: ScenarioWorld, scope: string, layer: string, table: DataTable) {
```
Place the step in a project or session step module, not under `step_definitions/workflow/` (RESEARCH R4). No step with the words "git repository" for the project exists today (`git-host.steps.ts` uses a `{git repository}` parameter type for host repositories; pick a step text that does not collide with it). Never call `child_process` from a step. `npm run check:features` checks the step.

### Catalog state for the note

**Fixture to copy** (`test/architecture/catalog-uat/fixtures/plugin-info.ts:158-183`), under the key `"/claude:plugin info <plugin>@<marketplace>"`:
```ts
"installed-with-workflow-preview-note": {
  pi: piWithAllLoaded(),
  message: {
    kind: "plugin-info",
    marketplaceName: "claude-plugins-official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "commit-commands",
      version: "1.2.0",
      description: "Helpful git commit commands for everyday use.",
      notes: [
        'workflow script "roll.js" in "workflows" will be refused: roll.js calls ' +
          "`Math.random`, which the workflow engine refuses as nondeterministic",
      ],
      componentsResolved: true,
      components: {
        skills: ["commit-summary"],
        workflows: ["commit-commands:changelog"],
      },
      requires: [{ companion: "pi-dynamic-workflows", missing: false }],
    },
  },
},
```
Each state has a short comment above it that cites the requirement (`WR-09`, `WGATE-01`); cite `PG-WF-02`. No `fixture-maps.ts` edit: `PLUGIN_INFO_FIXTURES` is imported at :14 and listed in `FIXTURE_MAPS`.

**Catalog section to copy** (`docs/output-catalog.md:3125-3139`): a `### Success -- ...` heading, one paragraph, the marker comment, then the exact bytes:
````markdown
<!-- catalog-state: installed-with-workflow-preview-note -->

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands v1.2.0 (installed)
    Helpful git commit commands for everyday use.
    skills: commit-summary
    workflows: commit-commands:changelog
    requires: pi-dynamic-workflows
    note: workflow script "roll.js" in "workflows" will be refused: roll.js calls `Math.random`, ...
```
````
The new note is tenseless, so its paragraph must not repeat the "FUTURE tense" sentence of the two neighbors. If the fixture lists an agent, `requires` gains `pi-subagents` (see :3120-3122). Proof: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/catalog-uat/catalog-contract.test.ts`. Record in the SUMMARY that the PG-SEC-01 note still has no state.

### Spike S5 fixture (on `features/lib/real-subagent-child.ts`)

Scratch copy only; commit nothing unless it becomes the criterion 5 proof. The four places to extend:

1. **Ambient extensions** (`writePiConfiguration`, :504-522). Add the engine entry to `ambient`; `resolveCompanion("pi-dynamic-workflows")` exists in `features/lib/companions.ts`:
```ts
const settings = { defaultProvider: PROVIDER, defaultModel: MODEL, extensions: ambient };
await writeFile(path.join(agentDir, "models.json"), `${JSON.stringify(models)}\n`);
await writeFile(path.join(agentDir, "settings.json"), `${JSON.stringify(settings)}\n`);
```
2. **Plugin content** (`createFixture`, :444-500). Add `workflows/scan.js` beside the agents loop; the script must call `agent()` once (RESEARCH Pitfall 2):
```ts
const agentsDir = path.join(marketplace, "plugins", PLUGIN, "agents");
await mkdir(agentsDir, { recursive: true });
for (const agent of agents) {
  await writeFile(path.join(agentsDir, `${agent.name}.md`), agentText(agent));
}
```
3. **Scripted calls** (`NAMED_CALLS`, :996-1000). Add the `workflow` calls with and without `background: false`:
```ts
const NAMED_CALLS: Readonly<Record<string, ScriptedToolCall>> = {
  bash: { tool: "bash", arguments: { command: "echo from-child" } },
  "failing read": { tool: "read", arguments: { path: "missing.txt" } },
  "stub mcp tool": { tool: MCP_TOOL, arguments: { text: "pg3" } },
};
```
4. **Observations**. `ProviderRequest` (:272-276) already records `lastUserText` and declared `tools` (rows a1, a3). The tool result text (row a4) is in the child's session file, whose path `detachedChild` (:779) reads from `status.json`. `RealChildVersions` (:211) reports Node, pi-subagents, and the adapter; add the engine.

Hermetic by construction (:449-452): `home = path.join(root, "home")`, `agentDir = path.join(home, ".pi", "agent")`, `cwd = path.join(root, "project")`, all under the fixture root. S5(b) writes the engine settings at `{agentDir}/workflows/settings.json` (RESEARCH Pitfall 4) and runs a control with no settings file. Never the real `~/.pi/agent`.

### Option B only: `E/bridges/agents/convert.ts`

Do not plan these tasks before the maintainer's decision (Amendment 1).

**TOOL_MAP** (:85-102). The `Agent`/`Task` entries and their comment are the precedent:
```ts
 * `Object.prototype` member. D-PG7-08 / PG-AGENT-03: `Agent` and its alias
 * `Task` map to pi-subagents' nested delegation tool. The agent types an
 * `Agent(...)` entry lists are not applied, as Claude Code does not apply
 * them inside a subagent.
 */
const TOOL_MAP: ReadonlyMap<string, string> = new Map([
  ["Read", "read"],
  ...
  ["Agent", "subagent"],
  ["Task", "subagent"],
]);
```
A plain `["Workflow", "workflow"]` entry is NOT enough: the grant maps only when `referenceNames.workflows` is not empty (D-PG8-12 amended). `mapToolName` (:445-453) is the lookup site, and it takes `grants` only, so the condition needs a parameter or a second map chosen by the caller:
```ts
function mapToolName(token: string, grants: readonly McpGrant[]): string | undefined {
  const piName = TOOL_MAP.get(toolNameOf(token));
  if (piName !== undefined) {
    return piName;
  }

  const match = matchMcpGrant(token, grants);
  return match === undefined ? undefined : mcpEntry(match);
}
```
`toolNameOf` (:276-279) already reads `Workflow(demo:scan)` as `Workflow`; the deny side (`explicitDisallow` :534, `omittedToolMapping` :613, which reads `TOOL_MAP.get(toolNameOf(token))` at :625) works on the Pi name. `referenceNames` arrives at :874 and :963 and defaults at :1057 to `{ skills: knownSkills, commands: [], workflows: [] }`. With no staged workflow the token still lands in `dropped` (`mapToolTokens` :466-489), and `tools: Workflow` alone still gives `{ kind: "empty-tools" }` (:1006-1008, AG-11).

**Launch rule** (:1011-1014, :1075):
```ts
const backgroundForMcp = runsMcpTools(toolsResult, mcpServerNames);
if (backgroundForMcp) {
  warnings.push(mcpAsyncWarning(mcpImplementation));
}
...
...((backgroundForMcp || isTrueBackground(raw.background)) && { async: true }),
```
Model predicate (:1130-1140):
```ts
function runsMcpTools(
  toolsResult: ToolMappingResult,
  mcpServerNames: readonly string[] | undefined,
): boolean {
  if (toolsResult.omitted) {
    return (mcpServerNames ?? []).length > 0;
  }

  return toolsResult.mapped.some((name) => name.startsWith("mcp:"));
}
```
Add a sibling predicate for an explicit list that maps `workflow` (the omitted arm forces no launch mode, D-PG8-14), OR it into the `async: true` condition, and push one new warning. Extend the doc comment at :1107-1121 with `D-PG8-13`.

**Warning module analog** `E/bridges/agents/mcp-async-warning.ts`: leading comment with the decision ID, constants for the sentence, one exported function. The new warning must not reuse the MCP sentence: `isMcpAsyncWarning` and `rewriteMcpAsyncWarning` match the known generations exactly, and `grant-rewrite.ts` and `legacy-grant-form.ts` compare stored bytes. Those two modules and their tests need no edit and must stay green. The warning says the security cost (RESEARCH "Security Domain": a `Read`-only agent that starts a workflow starts subagents with `bash`, `edit`, `write`).

**Owner tests**: `test/bridges/agents/convert.test.ts` (map with and without a staged workflow, `Workflow(x)`, deny by either form, `async: true` with `background: false`, the warning, AG-11) and `grant-forms.test.ts`.

### Option B only: `subagent get` outline (`features/agent/frontmatter.feature:1232-1264`)

```gherkin
  Scenario Outline: An agent that grants <grant> gets pi-subagents' subagent tool
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    ...
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file    | name | description          | tools         | body             |
      | lead.md | lead | Delegates the tasks. | Read, <grant> | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                            |
      |                     | subagent | {"action":"get","agent":"demo:lead"} |
      | The agent is shown. |          |                                      |
    When the user prompts "Show the agent."
    Then the model receives these calls:
      | call | role        | text |
      | 1    | user        | Show the agent. |
      | 2    | user        | Show the agent. |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:lead"} |
      | 2    | tool result | subagent returned: agent demo:lead\npath {agent dir}/agents/pi-claude-marketplace-demo-lead.md\ndescription Delegates the tasks.\naliases pi-claude-marketplace-demo-lead\ntools read, subagent\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nsystem prompt:\nAnswer the task. |

    Examples:
      | grant              |
      | Agent              |
      | Agent(demo:helper) |
      | Task               |
      | Task(a, b)         |
```
For `Workflow` and `Workflow(demo:scan)`: add `pi-dynamic-workflows` to the companions, give the plugin a workflow (step `... has the workflow "scan" described as "..." that returns "..."`, `features/step_definitions/workflow/runs.steps.ts:135-136`), and expect `tools read, workflow` plus an `async true` line (`features/lib/upstream/subagents.ts:79-93` decides the line order; read the actual bytes from a first run). Two variants make two scenarios or one outline with a third variant; an outline is for three or more (`.agents/skills/cucumber/rules/features.md:34`). A disallow scenario follows the one at :1266 ("A disallowed Agent or Task entry removes the subagent tool from a tools list").

**Live child scenario** (:384-408, `@mcp` because the fixture has an MCP server). Step at `features/step_definitions/plugin/subagent-hooks.steps.ts:379-403`:
```ts
When(
  "pi-subagents, with its async-by-default setting {word}, launches from a main pi session a real child of each of these agents of a plugin with a stub mcp server, whose hooks record every event and whose stop hook would send a main session back:",
  { timeout: FIXTURE_TIMEOUT_MS },
  async function (this: ScenarioWorld, asyncByDefault: string, table: DataTable) {
    ...
    const observed = await runRealSubagentChild({
      ...(await realChildFixture(this)),
      agents: parseRealChildAgents(table.raw()),
      ...(asyncByDefault !== "unset" && { asyncByDefault: asyncByDefault === "true" }),
    });
```
The step text names "a plugin with a stub mcp server", so a plugin with a workflow needs a new step text and a fixture option on `RealChildFixtureOptions` (:174). Result table step: `pi-subagents ran the real children like this:` (:513-530) with columns `agent | mode | state | runner process | session`.

## Shared Patterns

### Notes never refuse, are recomputed, and are never stored
**Source:** `E/orchestrators/plugin/discover-names.ts:207-212` (doc comment of `discoverGeneratedNames`), D-PG4-13.
**Apply to:** the PG-WF-02(b) join and its three consumers. Each caller adds the notes at exactly one site, so a verb prints a note once.

### Plugin text in a message goes through `forMessage`
**Source:** `E/domain/workflow-script.ts` `forMessage`, used at `discover-names.ts:144` for the file name, the folder, and the agent type.
**Apply to:** every span of the new note. Unit cases with `\n` and U+202E.

### The join lives in `orchestrators/`
**Source:** `discover-names.ts:13-21` header. Fallow zones forbid a bridge importing a sibling bridge; this module imports the per-kind bridge barrels only. No new module, no git surface (ESLint BLOCK F does not apply).

### Scenario fixture and result steps
**Source:** `features/workflow/agent-restrictions.feature`, `agent-steps.feature`, `references.feature`.
**Apply to:** every new workflow scenario. Fixture: `the published plugin {string} of the marketplace {string} has the file {string} with this text:` or `... has these agents:`. Run: `the user runs the workflow command {string}` (plain), `..., whose agent steps the model answers`, or `the user prompts {string} and the model starts a workflow run` (`features/step_definitions/workflow/runs.steps.ts:158,167,179`). Result: `the workflow run ends with the status {string} and the result {string}` (:210), `the model receives these calls:`, `the workflow engine shows these notices:`.

### Hermetic homes
**Source:** `features/lib/real-subagent-child.ts:449-452`, `features/lib/hermetic-git.ts:17-28`, `test/platform/isolated-pi-home.ts` (the `--import` of every `node --test` command).
**Apply to:** the spike, the new step, every test and scenario. Never read, list, stat, or write the real `~/.pi/agent`; say so in every executor dispatch.

### Comment and title IDs
Cite `PG-WF-02`, `PG-WF-07`, `D-PG8-NN`; never a phase, plan, or wave number. No comment on trivial code.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `08-SPIKE-S5.md` | spike record | - | No earlier spike record in this phase directory. Follow RESEARCH R1 "Records": exact command, fixture, versions (pi-subagents 0.88.1, engine 3.15.0, adapter 7.0.1), exit status, deciding output per row a1-a6 and b1-b5. |
| The per-script cap on PG-WF-02 notes, with its count line | part of the join | transform | No existing note is capped. The value and wording are the planner's proposal (Amendment 7), pending review. |
| "What a workflow subagent can reach" section | docs | - | No section of this kind on the page; use the page's graded-row style and RESEARCH R5 and E6 for the content. |

## Metadata

**Analog search scope:** `E/orchestrators/plugin`, `E/bridges/agents`, `test/orchestrators/plugin`, `test/architecture/catalog-uat`, `features/workflow`, `features/agent`, `features/plugin`, `features/lib`, `features/step_definitions`, `features/support`, `docs/output-catalog.md`
**Files scanned:** 19
**Not verified:** how the three consumer tests (`install-outcome`, `update-swap`, `info`) name the notes field; a grep for the field name in them returned no visible match, so they may reach it only through fixtures. Check with `npm run typecheck` after the rename.
**Pattern extraction date:** 2026-11-14
