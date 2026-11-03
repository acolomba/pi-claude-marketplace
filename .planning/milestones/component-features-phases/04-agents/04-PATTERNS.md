# Phase 4: Agents - Pattern Map

**Mapped:** 2026-11-01
**Files analyzed:** 30 (product, unit tests, out-of-ownership test literals, features, steps, fixture lib)
**Analogs found:** 28 / 30

Paths are relative to the repo root; `E/` = `extensions/pi-claude-marketplace/`.
All analogs are git-tracked source (no gitignored mirrors). Ownership is from
ROADMAP.md row 4: `features/agent/**`, `features/step_definitions/agent/**`,
`features/lib/agent-files.ts`, `E/bridges/agents/**`, `E/persistence/agents-index-*`,
`test/bridges/agents/**`, `test/integration/agents-*`. Everything else is marked
**OUT** (minimal edit only, as CONTEXT amendments allow) or **FROZEN** (no edit).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality | Ownership |
|---|---|---|---|---|---|
| `E/bridges/agents/discover.ts` (mod: recursive walk + declared-file branch, D-CF4-01) | bridge discovery | file-I/O | itself (`discoverPluginAgents` 61-122, `duplicateWarning` 38-48) | exact | owned |
| `E/bridges/agents/types.ts` (mod: `DiscoveredAgent.namespace`, structural skill-record type) | types | - | itself (155-200) | exact | owned |
| `E/bridges/agents/convert.ts` (mod: D-CF4-03/05/06/07/08 + D-CF4-04 append) | pure transform | transform | itself (`SUPPORTED_SOURCE_FIELDS`, `MODEL_MAP`, `THINKING_VALUES`, `splitCsv`, `GUIDED_DROPPED_FIELD_WARNINGS`) | exact | owned |
| `E/bridges/agents/frontmatter.ts` (mod: `async?`, fixed `advertise: true`) | emitter | transform | itself (433-441, 525-545) | exact | owned |
| `E/bridges/agents/stage.ts` (mod: read preloaded skill sources, D-CF4-04) | bridge stage | file-I/O | itself (`formatAgentWarnings` 265-280) + `E/bridges/skills/stage.ts:355-361` (body transforms) | exact | owned; clone-marker hazard at 443 |
| `E/bridges/agents/skill-preload.ts` (NEW, optional leaf) | pure-ish utility | file-I/O read + transform | `E/bridges/skills/stage.ts:350-365` | role-match | owned (needs paired test) |
| `E/domain/name.ts` (mod: `generatedAgentName`/`declaredAgentName` only) | domain pure | transform | itself (545-581) | exact | **OUT** (own arm only) |
| `E/orchestrators/plugin/install-outcome.ts` (one-field edit at ~1229 and 1310) | orchestrator ledger | CRUD | itself | exact | **OUT** (minimal, inside `skillsPhase`/`agentsPhase`) |
| `E/orchestrators/plugin/update-swap.ts` (one-line edit at 406) | orchestrator | CRUD | itself | exact | **OUT** (minimal, inside `prepareUpdateHandles`) |
| `E/shared/concerns/soft-dep.ts` | shared | - | itself (102-125) | exact | **OUT** (pi-subagents arm only; no change expected) |
| `test/bridges/agents/{discover,convert,frontmatter,stage}.test.ts` (mod) | test | - | themselves | exact | owned |
| `test/bridges/agents/skill-preload.test.ts` (NEW, if leaf added) | test | - | `test/bridges/agents/convert.test.ts` | role-match | owned |
| `test/domain/name.test.ts` (mod 1164-1310) | test | - | itself | exact | **OUT** (agents describes only) |
| `test/orchestrators/plugin/{update-swap,reinstall-flow,install-flow-ledger}.test.ts`, `test/edge/handlers/plugin/{install,update}.test.ts` (expected literals) | test | - | themselves | exact | **OUT** (expected-value only) |
| `features/agent/{listing,frontmatter,companion-missing,lifecycle}.feature` (NEW) | feature | - | `features/agent/invocation.feature`, `features/skill/listing.feature` | exact | owned |
| `features/agent/{invocation,project-trust}.feature` (mod) | feature | - | themselves | exact | owned |
| `features/step_definitions/agent/{listing,frontmatter,companion,trust,lifecycle}.steps.ts` (NEW) | step module | - | `features/step_definitions/agent/runs.steps.ts`, `features/step_definitions/skill/listing.steps.ts` | exact | owned |
| `features/step_definitions/agent/runs.steps.ts` (mod: move seed Given out, add child-tools step) | step module | - | itself | exact | owned |
| `features/lib/agent-files.ts` (mod: frontmatter map, nested path, republish, raw SKILL.md) | fixture writer | file-I/O | itself + frozen `features/lib/skill-files.ts` | exact | owned |
| pi-subagents settings `Given` (`disableBuiltins`) | step | file-I/O | `features/step_definitions/companion.steps.ts:60-66` (FROZEN, copy shape) | role-match | owned (agent module) |
| `{pi-subagents dir}` token step | step | - | none; D-CF4-09 amended drops it | no analog | not needed |
| AGT-04 gap record / pi-subagents defect draft (SUMMARY text) | doc | - | none | no analog | SUMMARY |

## Pattern Assignments

### `E/bridges/agents/discover.ts` (D-CF4-01)

**Analog:** itself. Today's flat loop (lines ~61-122) is the shape to keep for per-entry work; only the iteration source changes:
```ts
for (const agentsDir of agentsDirs) {
  // eslint-disable-next-line no-await-in-loop -- AG-12: the first-discovered name wins the shared map
  const entries = await readDirEntriesTolerant(agentsDir);
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of sorted) {
    const sourcePath = path.join(agentsDir, entry.name);
    // eslint-disable-next-line no-await-in-loop -- AG-12: ...
    if (!(await isPlainMarkdownFile(agentsDir, entry))) { continue; }
    const bytes = await readFile(sourcePath);
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    const { raw, body } = parseFrontmatter(bytes.toString("utf8"));
    const stem = entry.name.slice(0, -3);
    const sourceName = raw.name ?? stem;
    assertSafeName(sourceName, `agent name in ${sourcePath}`);
    const generatedName = generatedAgentName(pluginName, sourceName);
    const incumbent = seenByGenerated.get(generatedName);
    if (incumbent !== undefined) { warnings.push(duplicateWarning(incumbent, sourceName, sourcePath)); continue; }
    seenByGenerated.set(generatedName, { sourceName, generatedName, sourcePath, sourceHash, raw, body });
  }
}
```
- Replace `isPlainMarkdownFile` (shared, `E/shared/fs-utils.ts:209`, used by commands and skills -- do NOT edit) with an agents-local predicate: `entry.isFile() && /\.md$/i.test(entry.name)`, skip `entry.isSymbolicLink()`, recurse `entry.isDirectory()` while depth < 32, dotfiles allowed. Stem: strip only a lowercase `.md` (`name.endsWith(".md") ? name.slice(0, -3) : name`).
- Declared file path: `lstat(agentsDir)`; a regular `.md` file yields one agent with `namespace: []`; a symlink is refused (T-03-27).
- Keep `duplicateWarning` text byte-identical: `features/plugin/staging-warnings.feature:19` pins `agent source "helper" at "[redacted path]`.
- Every new `await` inside a loop needs its own `// eslint-disable-next-line no-await-in-loop -- AG-12: ...` comment (convention).
- **Clone hazard:** `E/bridges/commands/discover.ts:314` carries a reviewed commands/skills clone marker over its walk. Do not model the agents walk on that walk (e.g. use an async generator or an explicit stack); run `npx fallow dupes` after the edit.

### `E/domain/name.ts` (OUT; agents functions only)

**Analog:** itself, lines 545-581:
```ts
export function generatedAgentName(plugin: string, source: string): string {
  assertSafeName(plugin);
  assertSafeName(source);
  const generated = `pi-claude-marketplace-${plugin}-${source}`;
  assertSafeName(generated);
  return generated;
}
export function declaredAgentName(plugin: string, source: string): string { /* same, `${plugin}:${source}` */ }
```
Add a trailing `namespace: readonly string[] = []`, `assertSafeName` each segment, join with `-` / `:` (RESEARCH "Default-param name helpers"). Only callers: `discover.ts:98`, `convert.ts:624`. Update the two `describe` blocks in `test/domain/name.test.ts:1164-1310` so both branches stay at 100% direct coverage.

### `E/bridges/agents/convert.ts` (single wave-2 owner; D-CF4-04 append in wave 3)

**Analog:** itself.
- `SUPPORTED_SOURCE_FIELDS` (29-38): add `when_to_use`, `when-to-use`, `background`.
- `MODEL_MAP` (44-48) today 4.x; replace with the 5.x table, lowercase + strip `[1m]`, `^claude-` -> `anthropic/<id>`, `opusplan` -> `anthropic/claude-sonnet-5-5` (amended D-CF4-07). `inherit` arm at 206-208 unchanged.
- `THINKING_VALUES` (102-109): add `"max"`; `mapThinking` (487-522) lowercases, maps `med` -> `medium`.
- `MCP_ASYNC_WARNING` (96-99): keep string as-is (MCP-07 surface). The `async` exception applies to `mcp:` tools and to omitted-`tools` agents in MCP-shipping plugins (D-CF4-05 amended).
- `splitCsv` (153-182): keep the `[ ... ]` and quote stripping, replace `.split(",")` with a comma/whitespace splitter that respects parentheses; `Tool(spec)` maps by its name before `TOOL_MAP` (D-CF4-08 amended); `*` routes to the omitted-tools path. Fix only the stale comment at ~389-394.
- Description fallback (629-633) today:
  ```ts
  let description = raw.description ?? "";
  if (description === "") {
    description = `Imported Claude Code plugin agent ${sourceName} from plugin ${pluginName}.`;
    warnings.push("source description was missing or empty -- using fallback");
  }
  ```
  New text `Agent from ${pluginName} plugin`, `when_to_use`/`when-to-use` first; keep the warning string.
- `GUIDED_DROPPED_FIELD_WARNINGS` (801-813): add `initialPrompt`, `observer`, `observerMessage`, `observeSubagents` in the same form as `permissionMode`:
  ```ts
  permissionMode: (): string =>
    "agent-level `permissionMode` is not converted -- dropped (Claude Code ignores it for plugin agents too).",
  ```
  `stage.ts:273` excludes guided fields from the generic `dropped fields:` line automatically.
- Keep `convert.ts` pure: the D-CF4-04 skill blocks come in as an argument, built by `stage.ts`.
- Complexity: split `mapModel`, the splitter and the eligibility check into small helpers (both ESLint sonarjs 15 and fallow `maxCognitive` 15).

### `E/bridges/agents/frontmatter.ts`

**Analog:** itself. `GeneratedFrontmatterFields` (433-441): add only optional `readonly async?: boolean` (so the `test/integration/provenance-invisibility.test.ts:44-67` literal still compiles). Fixed lines (536-540):
```ts
lines.push(
  "systemPromptMode: replace",
  "inheritProjectContext: true",
  `inheritSkills: ${frontmatter.inheritSkills ? "true" : "false"}`,
);
```
Add `"advertise: true"` as a fixed line here; emit `async: true|false` strictly, only when defined. `skills:`/`skillPath` (528-534) already disappear when the inlined skills empty the list.

### `E/bridges/agents/stage.ts` + optional `skill-preload.ts` (D-CF4-04)

**Analog for the body transforms:** `E/bridges/skills/stage.ts:360-361` (copy the order, do not import -- `bridges-agents` may not import `bridges-skills`):
```ts
content = rewriteMarkdownReferences(content, pluginName, context.referenceNames);
content = substituteClaudeVars(content, skillVars);
```
Here `skillVars` = `{ pluginRoot, pluginData: pluginDataDir, skillDir: <record.targetPath>, projectDir }`. Read `<record.sourcePath>/SKILL.md` (source, not staged copy), strip BOM, `parseFrontmatter` from `E/platform/pi-api.ts`. Skip with a warning when `disable-model-invocation === true`, no non-empty `description`/`when_to_use`, or parse throws.

**Analog for warnings:** `formatAgentWarnings` (265-280) prefixes `[${converted.sourceName}] ` -- push the skip warning through `converted.warnings` to get the same prefix.

**Clone hazard:** `stage.ts:443` `fallow-ignore-next-line code-duplication` covers the TR-01/TR-05 commit-and-rollback block shared with `E/bridges/commands/stage.ts`. Do all new work in the prepare path before `convertAgent`; do not edit lines ~437-470. If the marked span shifts, follow the CONVENTIONS rule: delete marker, `npx fallow dupes`, restore above a line the group still spans.

### `E/orchestrators/plugin/install-outcome.ts` / `update-swap.ts` (OUT, minimal)

Today:
```ts
// install-outcome.ts ~1229 (skillsPhase)
c.stagedSkillNames = prep.result.recorded.map((r) => r.generatedName);
// install-outcome.ts ~1310 (agentsPhase)
knownSkills: c.stagedSkillNames,
// update-swap.ts ~406
knownSkills: handles.skills.result.recorded.map((record) => record.generatedName),
```
Add a sibling context field set next to 1229 holding `prep.result.recorded`, and pass the rows (structural type declared in `bridges/agents/types.ts`) beside `knownSkills`. No new `?? []` branch (100% coverage).

### `features/lib/agent-files.ts`

**Analog:** itself:
```ts
export function agentFileText(agent: PluginAgent): string {
  return `---\nname: ${agent.name}\ndescription: ${agent.description}\n---\n\n${agent.body}\n`;
}
export async function publishAgentFile(published, plugin, agent): Promise<string> {
  return writePublishedPluginFile(published, plugin, path.join("agents", `${agent.name}.md`), agentFileText(agent));
}
```
Extend with a frontmatter map and a relative path (nested `agents/review/security.md`); keep `agentFileText`/`publishAgentFile` signatures for the seed. Use frozen `features/lib/skill-files.ts` exports (`PluginSkill`, `skillFileText`, `publishSkill`) and `writePublishedPluginFile(s)` for XK-01 raw SKILL.md; never edit them.

### `features/step_definitions/agent/*.steps.ts`

**Analog:** `features/step_definitions/agent/runs.steps.ts` -- `@fileoverview` citing IDs, imports `node:assert/strict`, `@cucumber/cucumber`, lib, then `import type { ScenarioWorld }`; every Given asserts the written bytes back:
```ts
const file = await publishAgentFile(published, plugin, { name: agent, description, body });
assert.strictEqual(await readFile(file, "utf8"), agentFileText({ name: agent, description, body }));
```
Settings Given copies the frozen `companion.steps.ts:60-66` shape (`writeFile(..., { flag: "wx" })`, `this.onRelease(() => rm(file, { force: true }))`, read-back assert), writing `{"subagents":{"disableBuiltins":true}}` to `scopeRoot("user")/settings.json` after the profile Pi start (Assumption A2). Advertised-section and child-tools Thens: RESEARCH "Code Examples" shape, ending in `this.markTurnCompared()`. Parameter types get an `agent` prefix (D-CF1-08). Define a step only in the wave whose feature uses it (`check:features` unused-step rule). Moving the seed Given to `listing.steps.ts` is its own commit.

### Features

**Analog:** `features/agent/invocation.feature` (scripted model plays steps, `the model receives these calls:` whole compare with `\n` cells, `the model call N receives this system prompt:`), `project-trust.feature` (trusted/untrusted pair, explicit `agentScope:"project"` only per D-CF4-09 amended). AGT-05 install-then-companion pattern: `features/plugin/reinstall.feature:191-197`.

## Shared Patterns

- **Install warnings:** `[<source>] <text>` via `converted.warnings` -> `formatAgentWarnings` (`stage.ts:265-280`). Guided field text style: "... is not converted -- dropped (Claude Code ignores it for plugin agents too)."
- **Name safety:** `assertSafeName` per segment, then joined (NFR-10); `assertPathInside` already at `stage.ts:195-203`.
- **Loops:** each sequential `await` carries a reasoned `no-await-in-loop` disable.
- **Expected-literal updates (Pitfall 1):** the emitter plan also updates `test/orchestrators/plugin/update-swap.test.ts:232,698`, `reinstall-flow.test.ts:677`, `install-flow-ledger.test.ts:1286`, and `MAPPED_MODEL` in `test/edge/handlers/plugin/install.test.ts:348`, `update.test.ts:470` (OUT; expected values only; merge-conflict risk with siblings).

## Frozen / Do-not-edit

`features/support/*`, `features/lib/{pi-process,pi-commands,run-tokens,published-marketplace,companions,skill-files}.ts`, `features/lib/scripted-model/*`, shared step modules (`command`, `session`, `config`, `model`, `companion`, `plugin/publishing`, `marketplace/publishing`, ...), `cucumber.json`, `scripts/check-features.mjs`, `.agents/skills/cucumber/**`, `package.json`, `package-lock.json`, `E/platform/pi-api.ts`, `.fallowrc.json`, `E/shared/fs-utils.ts` (not owned), `E/orchestrators/plugin/info.ts` (residual), `features/plugin/staging-warnings.feature`, CHANGELOG/README. A token like `{pi-subagents dir}` would need a frozen run-tokens change: not done (D-CF4-09 amended).

## No Analog Found

| File | Reason |
|---|---|
| AGT-04 recorded gap / pi-subagents defect draft | SUMMARY prose; root cause in RESEARCH (JITI_ALIAS breaks faux import in detached runner) |
| Recursive walk shape | Only analog (`commands/discover.ts:310-345`) is under a clone marker; write a distinct shape |

## Metadata

**Analog search scope:** `E/bridges/{agents,skills,commands}`, `E/domain/name.ts`, `E/orchestrators/plugin/{install-outcome,update-swap}.ts`, `features/{agent,lib,step_definitions}`.
**Pattern extraction date:** 2026-11-01
