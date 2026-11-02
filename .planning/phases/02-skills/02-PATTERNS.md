# Phase 2: Skills - Pattern Map

**Mapped:** 2026-11-01
**Files analyzed:** 22 (new + modified, product, unit tests, features)
**Analogs found:** 21 / 22

Paths are relative to the repo root; `E/` = `extensions/pi-claude-marketplace/`.
All analogs below are git-tracked source (no gitignored mirrors).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `E/bridges/skills/discover.ts` (mod) | bridge discovery | file-I/O, transform | itself (`duplicateWarning`, `collectSelfSkillDir`) | exact |
| `E/bridges/skills/stage.ts` (mod) | bridge stage | file-I/O, transform | itself (`augmentSkillDescription`, stage loop 355-380) | exact |
| `E/bridges/skills/frontmatter-degrade.ts` (mod: delete `firstBodyParagraph` + helpers) | utility | transform | itself | exact |
| `E/bridges/skills/skill-names.ts` (NEW) | pure utility | transform | `E/bridges/skills/rewrite-frontmatter.ts` (`rewriteNameNode`) | role-match |
| `E/bridges/skills/types.ts` (mod, if needed) | types | - | itself | exact |
| `E/orchestrators/skill-alias-state.ts` (mod) | orchestrator/loader | file-I/O read | itself (`loadQualifiedSkillAliases`, DI deps) | exact |
| `E/orchestrators/skill-invocation.ts` (NEW) | orchestrator | request-response, file-I/O | `E/orchestrators/skill-alias-state.ts` (DI deps object + default) | role-match |
| `E/edge/skill-aliases.ts` (mod) | edge input handler | event-driven | itself + `E/edge/command-invocation.ts` (shape only, do not edit) | exact |
| `test/bridges/skills/{discover,stage,frontmatter-degrade}.test.ts` (mod) | test | - | themselves | exact |
| `test/bridges/skills/skill-names.test.ts` (NEW) | test | - | `test/bridges/skills/rewrite-frontmatter.test.ts` | role-match |
| `test/orchestrators/skill-alias-state.test.ts` (mod) | test | - | itself (strong-mock `ExtensionAPI`) | exact |
| `test/orchestrators/skill-invocation.test.ts` (NEW) | test | - | `test/orchestrators/skill-alias-state.test.ts` | role-match |
| `test/edge/skill-aliases.test.ts` (mod) | test | - | itself | exact |
| `test/edge/register.test.ts`, `test/orchestrators/plugin/{materialize-latest,reinstall-flow}.test.ts` (expected-value only) | test | - | themselves | exact |
| `features/skill/{listing,frontmatter,invocation,collisions,lifecycle}.feature` | feature | - | `features/skill/invocation.feature`, `features/slash-command/listing.feature` | exact |
| `features/step_definitions/skill/{listing,frontmatter,invocation,collisions,lifecycle}.steps.ts` | step module | - | `features/step_definitions/skill/invocation.steps.ts` | exact |
| `features/lib/skill-files.ts` (mod) | fixture writer | file-I/O | itself | exact |
| `features/lib/pi-tui.ts` (mod, optional profile only, D-CF2-12) | harness lib | process | itself (`PiTuiOptions`, `start`) | exact |
| TUI one-`When` turn step | step module | process/event | `features/support/world.ts:653-668` `startTuiSession` + `features/step_definitions/marketplace/background-update.steps.ts:36-60` | role-match |
| Pi gap report (SUMMARY text, D-CF2-10) | doc | - | none | no analog |

## Pattern Assignments

### `E/bridges/skills/discover.ts` (D-CF2-03 shadow, D-CF2-04 order)

**Analog:** itself. Copy the warning shape of `duplicateWarning` (lines ~77-88):
```ts
function duplicateWarning(sourceName: string, skillsDir: string, generatedName: string, winningSourceName: string): string {
  return (
    `skill source "${sourceName}" in "${skillsDir}" elides to generated name ` +
    `"${generatedName}", already produced by skill source "${winningSourceName}"; ` +
    `ignoring duplicate.`
  );
}
```
New `shadowedByCommandWarning` follows it but with no absolute path (RESEARCH Pattern 4):
`skill source "clash" has the same name "demo:clash" as a command of the plugin; ignoring the skill.`
Skip point: mirror `collectSelfSkillDir`'s `winner !== undefined -> warnings.push(...); return true;` and the subdir loop at line ~186.
Command basenames: `readDirEntriesTolerant` (already imported, line 30) + `isPlainMarkdownFile` from `shared/fs-utils.ts`. Never import `bridges/commands/**` (fallow zones). Keep the helper differently shaped from the commands walk; `discover.ts:148` already carries a `fallow-ignore-next-line code-duplication` marker; run `npx fallow dupes`.
Order fix: move the `componentPaths.skills` entry equal to `"skills"` to the front, inside `discover.ts` only (not `domain/component-paths.ts`).

### `E/bridges/skills/stage.ts` (D-CF2-07, D-CF2-08, names key)

**Analog:** itself.
- Line 135 swap: `const base = sourceDescription === "" ? firstBodyParagraph(body) : sourceDescription;` -> `descriptionFallback(body, "Plugin skill")` from `domain/description-fallback.ts`. Delete `MISSING_DESCRIPTION_PLACEHOLDER` (line 106) and the `folded === "" ?` branch (unreachable -> coverage).
- Dropped fields: push `droppedInvocationFieldsWarning(skill.sourceName, parsed.frontmatter)` into the discovery list mapped through `discoveryWarning` (lines 249, 399 show `discoverWarnings.map(discoveryWarning)`). Parsed/repaired arms only. Do NOT copy agents' hygiene tag (`bridges/agents/stage.ts:144-147`).
- Key write position (lines 363-374): insert after `substituteClaudeVars` and before `writeFile`, so `parseFrontmatter(content)` (PARSE-02) validates it:
```ts
content = rewriteMarkdownReferences(content, pluginName, referenceNames);
content = substituteClaudeVars(content, skillVars);
// <- write names key HERE (after rewrite, Pitfall 2)
await writeFile(skillMdPath, content, "utf8");
...
parseFrontmatter(content);
```

### `E/bridges/skills/skill-names.ts` (NEW pure helper)

**Analog:** `E/bridges/skills/rewrite-frontmatter.ts` lines 30-49 (`rewriteNameNode`) — node replace via `frontmatterBlockEnd`/`keyValueEnd` from `./frontmatter-scan.ts`:
```ts
const lines = content.split("\n");
const blockEnd = frontmatterBlockEnd(lines);
let keyIndex = -1;
for (let i = 1; i < blockEnd; i++) { if ((lines[i] ?? "").startsWith(NAME_KEY)) { keyIndex = i; break; } }
const replacement = `${NAME_KEY} ${newName}`;
if (keyIndex === -1) { return [lines[0], replacement, ...lines.slice(1)].join("\n"); }
const lastReplaced = keyValueEnd(lines, keyIndex, blockEnd);
return [...lines.slice(0, keyIndex), replacement, ...lines.slice(lastReplaced + 1)].join("\n");
```
For the new key insert before the closing `---` (or replace existing node). Emit value as one-line JSON. Names computation per RESEARCH Pattern 2 (`Qqn` port: `[^a-zA-Z0-9_-]` -> `-`, `String()` coercion, 256 cap, bare only when no `:`). Watch fallow dupes against `rewriteNameNode` — factor a shared "replace node" function in `frontmatter-scan.ts`/this file rather than copying the loop. Explicit return types on exports.

### `E/orchestrators/skill-alias-state.ts` (mod)

**Analog:** itself. Keep: DI shape (lines ~22-27), `reserved` set, `loadedPaths` check, two-root loop with `no-await-in-loop` disable comment:
```ts
export interface SkillAliasDependencies {
  readonly loadState: (extensionRoot: string) => Promise<SkillAliasState>;
  readonly getAgentDir: () => string;
}
const DEFAULT_DEPENDENCIES: SkillAliasDependencies = { loadState, getAgentDir };
...
const roots = [dependencies.getAgentDir(), path.join(cwd, ".pi")];
for (const root of roots) {
  // eslint-disable-next-line no-await-in-loop -- two scope roots, one state read each
  state = await dependencies.loadState(path.join(root, "pi-claude-marketplace"));
```
Replace: `skillSuffix` + `generatedSkillName` import (delete; drop the elided alias) with a read of the stored key from each loaded staged `SKILL.md` (add `readFile` to deps; parse through `parseFrontmatter` from `platform/pi-api.ts`). Tolerate a missing key (pre-Phase-2 staged files). First claim wins across roots (`aliases.has(alias)` guard). Return type may widen from `Map<string,string>` to carry `pluginRoot`/`pluginData`/scope for invocation.

### `E/orchestrators/skill-invocation.ts` (NEW)

**Analog for structure:** `skill-alias-state.ts` (deps interface + `DEFAULT_DEPENDENCIES` + optional last param). **Analog for composition:** RESEARCH Pattern 3 sketch (substitute -> `selectPromptShell` -> `bashMissingMessage` abort -> `expandContextInjections` -> Pi `<skill>` frame). Imports from frozen cores: `domain/argument-substitution.ts` (`substituteArguments`, `parseArgumentNames`, `claudeEffort`), `domain/context-injection.ts` (`expandContextInjections`, `ContextInjectionError`), `platform/prompt-shell.ts` (`selectPromptShell`, `bashMissingMessage`, `createPromptShellRunner`, `NODE_PROMPT_SHELL_HOST`, `NODE_PROMPT_SHELL_SPAWN`). Return a discriminated `{ kind: "ok", text } | { kind: "abort", message }` rather than throwing. Do NOT import `ThinkingLevel`/`InputSource` types from `platform/pi-api.ts` (stale fallow marker, Pitfall 1); take `string | undefined`. Not in `NETWORK_SEAMS` and must not name git.

### `E/edge/skill-aliases.ts` (mod)

**Analog:** itself (108 lines). Keep `registerSkillAliases(pi, loadAliases = loadQualifiedSkillAliases)` default-arg shape (`index.ts:266-269` calls with one arg, not edited), the per-cwd cache cleared on `session_start`, and the reserved check:
```ts
const commands = pi.getCommands();
if (commands.some((command) => command.source !== "skill" && command.name === name)) {
  return { action: "continue" };
}
```
Change: line 82 `if (event.source !== "interactive")` -> `if (event.source === "extension")`; drop line 88 `!name?.includes(":")` (bare aliases); handle `skill:<gen>` only for bridged loaded skills; return `{ action: "transform", text: block, ...(event.images !== undefined && { images: event.images }) }` (keep the images spread, line 104). Autocomplete `aliasProvider` filter (line 42 `!typed.includes(":")`) must also admit bare aliases.
Abort path: `notifyUsageError(ctx, openNotificationRun(pi, origin), { message, usage: "" })` then `{ action: "handled" }`. Call-site analog: `E/edge/handlers/marketplace/list.ts:33` `notifyUsageError(ctx, run, { message, usage: USAGE });`. `openNotificationRun` is in `E/shared/notification-run.ts:77` (used by `edge/register.ts:47,173`). Type return as `InputEventResult` like `edge/command-invocation.ts`:
```ts
export function registerCommandInvocation(pi: ExtensionAPI): void {
  pi.on("input", (): InputEventResult => ({ action: "continue" }));
}
```
(read-only reference; `command-invocation.ts` is Phase 3's.)

### Unit tests

**Analog:** `test/orchestrators/skill-alias-state.test.ts` lines 1-50 — `node:test`, `strong-mock` (`mock<ExtensionAPI>({ exactParams: true, name: "extension API" })`, `when(() => pi.getCommands()).thenReturn([...])`, `verify`), `// arrange` / act / assert comments, `.ts` relative imports, type imports last. `getCommands` items carry `{ name, source, sourceInfo: { path, source, scope, origin } }`. New sources need paired tests at mirrored paths and 100% direct coverage. Expected-value-only edits in non-owned tests: `test/edge/register.test.ts:1579`, `test/orchestrators/plugin/materialize-latest.test.ts:197`, `test/orchestrators/plugin/reinstall-flow.test.ts:9773` (list in plan; staged bytes change).

### Feature files

**Analog:** `features/skill/invocation.feature` (whole). Background steps verbatim:
```gherkin
Given pi runs with the scripted model
Given the marketplace "fixtures" is published as a dir source
Given the marketplace "fixtures" offers these plugins:
  | name | version |
  | demo | 1.0.0   |
Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" described as "..." with this body:
Given the marketplace "fixtures" is added to the project scope
Given the user has run "/claude:plugin install demo@fixtures --scope project"
Given the user has started a new pi session
Given the scripted model plays these steps:
When the user prompts "/skill:demo-greet Ada"
Then the model receives these calls:
```
Listing analog: `features/slash-command/listing.feature` (`When the user lists the slash commands pi offers` / `Then pi offers ...`); for skills use the frozen session step `the session offers these skills:`. Seed expected text must change to `...\n\nGreet the person named in the arguments.\n\nARGUMENTS: Ada\n</skill>` (red proof for D-CF2-06).

### Step modules + `features/lib/skill-files.ts`

**Analog:** `features/step_definitions/skill/invocation.steps.ts` — `@fileoverview`, `Given(...)` with `function (this: ScenarioWorld, ...)`, `this.requirePublished(name)`, write through the lib then `assert.strictEqual(await readFile(file), <lib text>)`. Lib analog: `skillFileText`/`publishSkill` in `skill-files.ts` (`writePublishedPluginFile(published, plugin, path.join("skills", ...), text)`). Extend `PluginSkill` with optional `frontmatterName?`, extra frontmatter, and an optional dir/declared-path, since today every fixture writes `name: <dir>` (which yields a bare alias). New parameter types prefixed `skill`. No module-level state (BLOCKER).

### `features/lib/pi-tui.ts` + TUI one-`When` turn

**Analog:** `PiTuiOptions` (lines 30-38) and `PiTuiSession.start` (lines ~165-174):
```ts
const child = spawn("python3", [PTY_BRIDGE, "--", process.execPath, ...piArguments("tui")], {
  cwd: sandbox.cwd, detached: true,
  env: { ...rpcChildEnvironment(sandbox, options.git), ...options.variables }, ...
```
Add optional `extensions?`, model args, `readyText?` (default `READY_TEXT`, line 25, used at line 297). Step analog: `world.ts:653-668` `startTuiSession` (frozen; copy its `PiTuiSession.start` + `this.onRelease(() => tui.stop())` + `waitUntilReady` sequence inside one `When`, then `this.recordTurn(...)`); `background-update.steps.ts:102` shows `waitForQuiet(250, 5_000)`.

## Shared Patterns

- **Output:** only `notifyUsageError`/`notify` from `E/shared/notification-dispatch.ts`; no new kind/reason (closed sets).
- **Warnings:** discovery-tagged via `discoveryWarning` (`E/shared/staging-warnings.ts`), as in `stage.ts:249,399`.
- **DI over seams:** deps object + `DEFAULT_DEPENDENCIES` default param (`skill-alias-state.ts`).
- **Loops:** `// eslint-disable-next-line no-await-in-loop -- <reason>` at every sequenced await.
- **Comments:** cite D-CF2-xx / SK-n / FG-nn, never phase/plan numbers.
- **Complexity:** cognitive <= 15 under both ESLint and fallow; split helpers.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| Pi gap report (D-CF2-10, inside SUMMARY.md) | doc text | no prior upstream issue draft in repo; use CONTEXT D-CF2-10 contents |

## Metadata

**Analog search scope:** `E/bridges/skills`, `E/edge`, `E/orchestrators`, `E/shared`, `features/{skill,slash-command,step_definitions,lib,support}`, `test/orchestrators`
**Files scanned:** ~20
**Pattern extraction date:** 2026-11-01
