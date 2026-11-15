# Phase 11: Skills, Commands, and Records - Pattern Map

**Mapped:** 2026-11-15
**Files analyzed:** 22 (new or modified; a test pair counts with its source)
**Analogs found:** 21 / 22

Every path below is relative to `/home/acolomba/src/pi-claude-marketplace-gaps`. `E/` = `extensions/pi-claude-marketplace/`. All analogs are git-tracked source (`git ls-files` checked). Line numbers were read on `features/gaps` at commit `4d8de3e6` on 2026-11-15. Plans of this phase move lines, so a later plan re-reads its own anchors.

Order the plans as RESEARCH recommends: PG-CMD-09, PG-SKILL-11, the pure parser, the command wiring, the skill wiring, PG-DOC-02, the records, PG-DOC-01 last. The three code areas share `skill-alias-state.ts` and the two invocation files, so the plans run in sequence.

## Mapper findings the planner must see

These came out of reading the analogs. RESEARCH does not state them.

1. **`entryNames` returns names only, and three types sit between the staged file and the suggestion.** The description and hint must travel `entryNames` (`E/orchestrators/skill-alias-state.ts:162-176`) -> `EntryClaim` (`:232-235`) -> `claimedAliases` (`:262-276`, returns `Map<string, string>`) -> the two loops of `loadPluginNames` (`:329-338`) -> `PluginAliasTarget` (`:67-69`) -> `appendAliasSuggestions` (`E/edge/skill-aliases.ts:28-46`), which today gets `aliases.keys()` only (`:70`). `claimedAliases` maps an alias to `entry.name`; the menu text belongs to the entry, so the simplest change keeps that map and looks the text up by entry name in the two loops. `skillClaudeNames` (`:285-295`) reads `names` too and must keep working on the same claim.
2. **`withCommandRecord` and `readCommandRecord` both project the record member by member** (`E/bridges/commands/command-record.ts:42`, `:56`). A new member that is only added to the schema is written by nobody and returned by nobody. Both projections change, with `claudeName` left out when absent (`exactOptionalPropertyTypes`; RESEARCH Pitfall 7).
3. **The em dash precedent is an escape, not a literal.** `E/bridges/hooks/hook-labels.ts:51-53` writes `const MISSING_SCRIPT_DASH = "—";` with a comment that names the `fix-unicode-dashes` hook. Copy that form for the alias description separator.
4. **The compatibility pages do not cite scenario lines today.** `docs/hooks-compatibility.md` cites the directory `features/hook/` once in its header (`:7`), and `docs/mcp-compatibility.md` cites feature files without a line (`:24`, `:26`). The `features/...feature:<line>` form of D-PG11-12 is new. The register and section layout have an analog; the cited status table has none (see "No Analog Found").
5. **The terminal-menu step starts a TUI with no model** (`this.startTuiSession()`, `features/step_definitions/slash-command/frontmatter.steps.ts:135`; the default is `"none"`, `features/support/world.ts:942`). Its three uses (`features/slash-command/aliases.feature:115`, `frontmatter.feature:191`, `manifest-forms.feature:754`) all sit in scenarios with no `pi runs with the scripted model`. The `Background` of `features/skill/aliases.feature:7-12` starts the scripted model for every scenario. The scenario at `:218` proves a TUI session can start after that Background (it uses `startTuiSession("scripted")`), but the no-model start after it is unmeasured. Run the new PG-SKILL-11 skill menu scenario red first; if the start fails, the scenario goes to `features/slash-command/frontmatter.feature`, whose row `demo:demo-skill` (`:196`) already shows a skill alias in a menu.
6. **`docs/env-vars.md` already uses `†` and `‡`** as footnote marks in the matrix (`:24-32`). The `PATH` footnote of D-PG11-10 needs a third mark.
7. **Both invocation orchestrators already inject `readFile`** as `(file) => Promise<string>` (`command-invocation.ts:80`, `skill-invocation.ts:75`). That reader returns decoded text and cannot `stat`, bound the read, or see a NUL byte. The mention reader is a second, separate member with `stat` and a bounded byte read; do not widen `readFile`.
8. **The test builder for the command dependencies rejects any unlisted read** (`test/orchestrators/command-invocation.test.ts:57-69`). A new required member on `CommandInvocationDependencies` makes every case in that file fail to compile until the builder passes one, which is the intended effect (RESEARCH Pattern 4). Give the builder a reader that fails the case when asked for a file the case did not name.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `E/domain/file-mentions.ts` (NEW) + `test/domain/file-mentions.test.ts` (NEW) | domain parser | transform | `E/domain/context-injection.ts` + `test/domain/context-injection.test.ts` | exact |
| `E/orchestrators/mention-attachments.ts` (NEW) + `test/orchestrators/mention-attachments.test.ts` (NEW) | orchestrator I/O shell | file-I/O (read) | dependency object of `E/orchestrators/command-invocation.ts:77-97`; hermetic real-file tests in `test/orchestrators/skill-alias-state.test.ts` | role-match |
| `E/orchestrators/command-invocation.ts` + test | orchestrator | request-response | same file, `renderCommand` `:204-219` | exact |
| `E/orchestrators/skill-invocation.ts` + test | orchestrator | request-response | same file, `fillSkill` `:177-207`, `skillBlock` `:160-165` | exact |
| `E/domain/name.ts` (the Claude Code command name) + `test/domain/name.test.ts` | domain utility | transform | `generatedCommandName` `:511-536`; `skillIdentityName` in `E/bridges/skills/skill-names.ts:76-78` | exact |
| `E/bridges/commands/command-record.ts` + test | model/schema | transform | same file; `RECORD_SCHEMA` in `E/bridges/skills/skill-names.ts:43-61` | exact |
| `E/bridges/commands/staged-command.ts` + test | bridge | file-I/O | same file, `buildStagedCommand` `:268-309` | exact |
| `E/orchestrators/skill-alias-state.ts` + test | orchestrator | file-I/O (read) | same file: `SKILL_KIND` `:140-151`, `installedForms` `:134-138`, `COMMAND_KIND` `:153-159` | exact |
| `E/edge/skill-aliases.ts` + `test/edge/skill-aliases.test.ts`; fixture in `test/orchestrators/typed-expansion.test.ts` | edge | request-response | `appendAliasSuggestions` `:28-46`; pi-tui `dist/autocomplete.js:236-242` | exact |
| `features/slash-command/aliases.feature` (PG-CMD-09 scenario; row `:118`) | behavioral test | - | same file `:13-38`, `:103-118` | exact |
| `features/slash-command/frontmatter.feature` (row `:196`) | behavioral test | - | same file `:167-196` | exact |
| `features/slash-command/invocation.feature` (PG-SKILL-01 scenarios) | behavioral test | - | same file `:88-111`, `:153-172`, `:195-214` | exact |
| `features/skill/aliases.feature` (PG-SKILL-11 menu scenario) | behavioral test | - | `features/slash-command/frontmatter.feature:167-196`; same file `:218-236` | role-match |
| `features/skill/invocation.feature` (attached through an alias) | behavioral test | - | same file `:178-202`, `:230-249` | exact |
| `docs/skills-commands-compatibility.md` (NEW) | doc | - | `docs/hooks-compatibility.md` (register, sections); `docs/mcp-compatibility.md` (scenario citations in prose) | role-match |
| `README.md`, `README.es.md` (name mapping, link) | doc | - | `README.md:102-116`, component list `:28-29`; Spanish `README.es.md:28-29` | exact |
| `docs/env-vars.md` (`PATH` rows) | doc | - | same file `:28`, `:122`, `:161`, footnote marks `:24-32` | exact |
| `docs/research/claude-hooks-vs-pi-events.md` | doc (dated research) | - | the "Out of date" paragraph form of `.planning/BACKLOG.md:3831` | role-match |
| `docs/mcp-compatibility.md` + comments in `E/bridges/mcp/builtin-overrides.ts:12-13`, `E/domain/components/hooks/builtin-mcp-tool-names.ts:5-6`, `E/domain/mcp-resolution.ts:75-76`, `features/mcp-server/sources.feature:405-406` | doc + comments | - | the lines themselves | exact |
| `.planning/BACKLOG.md` (`UAT-02` `:5`, `WOUT-01` `:3829`, `MCPB-01` `:4606`, `TOOLSEARCHOFF-01` `:4934`) | record | - | `:3831` "**Out of date 2026-11-15** (...)" | exact |
| `docs/prd/pi-claude-marketplace-prd.md:118`, `docs/prd/parity-gaps-prd.md:957` (S8 cell) | record | - | the lines themselves | exact |
| `.planning/PROJECT.md`, `CHANGELOG.md` | record | - | `PROJECT.md:2432`, `:2436` (D-PG10 rows), `:1877` (D-141-01), footer lines; `CHANGELOG.md:5-14` | exact |

## Pattern Assignments

### `E/domain/file-mentions.ts` + `test/domain/file-mentions.test.ts` (NEW pair; domain parser, transform)

**Analog:** `E/domain/context-injection.ts`, a pure scanner of a skill or command body that follows a Claude Code parser.

**Header pattern** (`:1-21`): a `//` block that opens with the decision ID, says what the module does and where its I/O lives, and names the upstream version and symbols:
```typescript
// domain/context-injection.ts
//
// D-CF1-02: Claude Code's dynamic context injection. In the body of a skill or
// command, after argument substitution, each `` !`cmd` `` and each ```` ```! ````
// ...
// The command runner is a port (`ShellRun`), so this module never starts a
// process; the edge passes a runner built by platform/prompt-shell.ts.
// ...
// The parser, the order, the replacement, and the texts follow Claude Code
// 2.1.316 (`FUr`, `TGe`, `d$o`, `qTn`, `MRr`). Residual differences recorded
// under D-CF1-02: ...
```
Write the same three parts: PG-SKILL-01 with D-PG11-02 to D-PG11-06; "this module reads no file"; "Claude Code 2.1.323 (`z_s`, `R3n`, `DNt`, `sls`)" with the two recorded divergences (D-PG11-02, D-PG11-03) named as divergences. No phase or plan numbers.

**Constants, each with a `//` reason** (`:55-70`):
```typescript
// An inline !`cmd` at the start of a line or after whitespace; group 1 is the
// command. It runs on the masked text, so a pattern inside a code span is skipped.
const INLINE_PATTERN = /(?<=^|\s)!`([^`]+)`/gm;

// An ordinary inline code span, which the mask blanks unless `!` or a backtick
// comes right before it.
const CODE_SPAN = /`[^`\n]+`/g;
```
For an upstream expression kept verbatim, copy the disable form of `E/domain/claude-mcp-variables.ts:86-89` (`// eslint-disable-next-line sonarjs/concise-regex -- kept verbatim from Claude Code`).

**The mask to model, and not to reuse** (`:79-85`):
```typescript
// Blanks each ordinary code span, keeping its backticks and its length.
function maskCodeSpans(text: string): string {
  return text.replace(CODE_SPAN, (span: string, offset: number) => {
    const before = text[offset - 1];
    return before === "!" || before === "`" ? span : `\`${" ".repeat(span.length - 2)}\``;
  });
}
```
Copy the idea (same length, so offsets hold). Do not import it and do not copy the `before === "!"` exception: the mention mask blanks every span and every fence, the `!` forms included (RESEARCH F2). This function is module-private, so nothing exports it today; keep it so.

**One small function per rule** (`:91-119`): `fencedInjections`, `inlineInjections`, `findInjections` each do one pass, and the fence scan is an `indexOf` loop that moves forward only (`:93-103`), which is the linear shape RESEARCH Pitfall 5 asks for. Give fences, spans, quoted mentions, unquoted tokens, the tail cut, and the line range a function each; both complexity gates (ESLint 15, fallow 15/20) then stay clear.

**Port type for the I/O the module does not do** (`:35-36`): `export type ShellRun = (command: string) => Promise<ShellRunResult>;` with a discriminated result (`:24-33`). The byte checks of D-PG11-06 (size limit, NUL test, 2,000-line cut, BOM, the `<file>` block text) are pure functions here over bytes or text the orchestrator read. Use `stripBom` from `E/shared/bom.ts:24` (`domain` may import `shared`).

**Test analog:** `test/domain/context-injection.test.ts:1-48`:
```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextInjectionError,
  expandContextInjections,
} from "../../extensions/pi-claude-marketplace/domain/context-injection.ts";

import type { ShellRun, ShellRunResult } from "../../extensions/pi-claude-marketplace/domain/context-injection.ts";

test("D-CF1-02: replaces an inline command with its output", async () => {
  // arrange
  // act
  // assert
```
Titles open with the ID (`PG-SKILL-01:` or `D-PG11-04:`). For the parser's many input shapes use the table loop of `test/domain/dependencies.test.ts` (`for (const { label, candidate, expected } of [...]) { test(...) }`). Cases RESEARCH requires: quoted, unquoted, the four CJK marks, tail cut (`@a.md,`, `@dir/`, `@x.c++`), `#L10`, `#L10-20`, both agent forms, backtick and tilde fences, an unclosed fence, a span of N backticks, an inline `` !`cat @/abs/x.md` `` and a ```` ```! ```` fence (Pitfall 1), a repeat, and the order pin (text order, assumption A3). The pair needs 100% direct coverage: `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/file-mentions.ts`.

---

### `E/orchestrators/mention-attachments.ts` + test (NEW pair; orchestrator, file-I/O read)

**Analog for the dependency shape:** `E/orchestrators/command-invocation.ts:77-97`:
```typescript
/** The side effects of an invocation. */
export interface CommandInvocationDependencies {
  readonly getAgentDir: () => string;
  readonly readFile: (file: string) => Promise<string>;
  /** The machine facts that choose a shell and give the commands their environment. */
  readonly host: PromptShellHost;
  readonly runShell: PromptShellRunner;
}

/** The dependencies of a running Pi: its agent directory, the filesystem, and this machine's shells. */
function nodeDependencies(): CommandInvocationDependencies {
  const host = NODE_PROMPT_SHELL_HOST;
  return {
    host,
    runShell: createPromptShellRunner({ host, spawn: NODE_PROMPT_SHELL_SPAWN }),
    readFile: async (file) => readFile(file, "utf8"),
    getAgentDir,
  };
}
```
Export one reader interface from the new module (a `stat` that answers regular-or-not with the size, and a read of at most N bytes), plus its Node implementation as a constant. Each invocation orchestrator adds it as one member of its own dependencies object (finding 7). No `_setReaderForTest` seam.

**Error handling:** none surfaces. D-PG11-06 says every failure (missing, directory, too large, binary, unreadable) leaves the mention as text with no notice, so the module catches a reader rejection per mention and returns no block. Do not call `notify`. A debug line follows `hookDebugLog(\`skill aliases skip ${entry.file}: ${errorMessage(err)}\`, "skills")` (`E/orchestrators/skill-alias-state.ts:171`).

**Reads in a loop.** Mentions are independent, so read them with `Promise.all` over the list, as `kindClaims` does (`skill-alias-state.ts:252-254`), and keep mention order from the input array. That avoids a `no-await-in-loop` disable.

**Boundaries.** The module imports `domain/file-mentions.ts`, `node:fs/promises`, `node:os` (`homedir` for `~`), and `node:path`. It names no git surface, so it stays outside `NETWORK_SEAMS` (ESLint BLOCK F). It writes nothing, so NFR-1 and NFR-10 do not apply; say so in the header.

**Test analog:** real files under a hermetic root, as `test/orchestrators/skill-alias-state.test.ts:1-13` sets up:
```typescript
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
// ...
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
```
with `const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");` (the form `test/orchestrators/plugin-path.test.ts:121` uses). Real files for the symbolic link, directory, size, and NUL cases; an in-memory reader for the `~` and relative-path cases so no test resolves the real home. Never read or write the real `~/.pi/agent`.

---

### `E/orchestrators/command-invocation.ts` (orchestrator, request-response)

**The one function that changes** (`:204-219`):
```typescript
async function renderCommand(
  request: CommandInvocationRequest,
  file: CommandFile,
  dependencies: CommandInvocationDependencies,
): Promise<CommandInvocationOutcome> {
  const filled = substituteArguments({
    body: file.body,
    args: request.args,
    argumentNames: parseArgumentNames(file.frontmatter.arguments),
    variables: commandVariables(request, file.frontmatter),
  });
  const run = contextShell(request, file.frontmatter, dependencies);
  return run === undefined
    ? refusal(bashMissingMessage(request.typed))
    : { kind: "send", text: await expandContextInjections(filled, run) };
}
```
Compute `commandVariables(...)` once into a constant. Scan `substituteArguments({ body: file.body, args: undefined, argumentNames: [], variables })`, the variables-only branch at `E/domain/argument-substitution.ts:243-245`. Read the files after `expandContextInjections` resolves (RESEARCH F3), so a refused invocation reads nothing. `renderCommand` gains two steps; if either gate complains, move the "scan, then read, then append" into the shared orchestrator module rather than a helper per file (fallow `dupes` fails on a clone between the two invocation files).

**Do not touch** `expandStagedCommand` (`:290-320`) or the trust refusal in `prepareCommand` (`:247-251`), which already runs before the file is read (RESEARCH F14). Extend the header block (`:1-23`) with a PG-SKILL-01 / D-PG11-07 paragraph in its style.

**Test analog:** `test/orchestrators/command-invocation.test.ts:53-69` (the `dependencies(files)` builder that rejects any unlisted read) and `:101-110`:
```typescript
describe("invokeStagedCommand", () => {
  test("D-CF1-01: sends a project command's body with the typed arguments appended", async () => {
    // arrange
    const files = { [PROJECT_COMMAND]: commandFile("Greet the person named in the arguments.") };

    // act
    const outcome = await invokeStagedCommand(request(), dependencies(files));
```
New cases: a body mention attached; `@$ARGUMENTS` with arguments naming an existing file and a reader that fails the case if asked (Pitfall 2); the guard that `expandStagedCommand` asks the mention reader for nothing (D-PG11-07).

---

### `E/orchestrators/skill-invocation.ts` (orchestrator, request-response)

**The function and the block** (`:160-165`, `:183-206`):
```typescript
function skillBlock(skill: BridgedSkill, body: string): string {
  return (
    `<skill name="${skill.name}" location="${skill.location}">\n` +
    `References are relative to ${skill.baseDir}.\n\n${body}\n</skill>`
  );
}
// ...
  const substituted = substituteArguments({
    body: parsed.body.trim(),
    args: request.args,
    argumentNames: parseArgumentNames(parsed.frontmatter.arguments),
    variables: invocationVariables(request, skill, parsed.frontmatter),
  });
  // ...
  return { kind: "ok", text: skillBlock(skill, expanded) };
```
The blocks go into the `body` argument of `skillBlock`, after the rendered body and before `\n</skill>` (RESEARCH F12). `skillBlock` itself does not change. The scan input is `parsed.body.trim()` with `args: undefined`. The dependencies object is `SkillInvocationDependencies` (`:73-89`); add the same reader member there. Leave `fillSkillRead` (`:350-398`) alone and pin it with a guard case in `test/orchestrators/skill-invocation.test.ts`.

---

### `E/domain/name.ts` (the Claude Code command name)

**Analog:** `generatedCommandName` (`:511-536`) for placement and doc-comment style, and `skillIdentityName` (`E/bridges/skills/skill-names.ts:72-78`) for the "never elided" rule:
```typescript
/**
 * D-CF2-02 item 1: the upstream name of the skill directory `directoryName`.
 * Case is kept and nothing is elided.
 */
export function skillIdentityName(pluginName: string, directoryName: string): string {
  return `${pluginName}:${directoryName.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
}
```
The new function sits beside `generatedCommandName`, takes `(plugin, source)` with `source` being `DiscoveredCommand.sourceName`, always joins with `":"`, and never calls `commandNamespaceSeparator()` (`:530`; RESEARCH Pitfall 8). Its doc comment cites D-PG11-01 and PG-CMD-09 and says it amends D-141-01 for the alias only. `generatedCommandName` validates each segment with `assertSafeName` (`:517-519`) and has already run on the same input before the stager calls the new function, so the new one adds no second validation.

**Test analog:** `describe("generatedCommandName", ...)` at `test/domain/name.test.ts:1025`, a table loop over `{ pluginName, sourceName }` rows (`:1082`, `:1115`). Rows: flat, flat with the plugin prefix (`demo-lint` -> `demo:demo-lint`), nested (`build/web`), a map key.

---

### `E/bridges/commands/command-record.ts` and `staged-command.ts`

**Schema today** (`command-record.ts:16-28`):
```typescript
export interface CommandRecord {
  readonly pluginRoot: string;
  readonly pluginData: string;
}

// A record with a member of its own is not one install wrote.
const STORED_RECORD = Compile(
  Type.Object(
    { pluginRoot: Type.String(), pluginData: Type.String() },
    { additionalProperties: false },
  ),
);
```
Add `claudeName: Type.Optional(Type.String())` so a file staged before this phase still validates (RESEARCH F15). Keep `additionalProperties: false`.

**Writer and reader, both member by member** (`:39-43`, `:54-57`; finding 2):
```typescript
  return Object.fromEntries([
    ...entries,
    [RECORD_KEY, { pluginRoot: record.pluginRoot, pluginData: record.pluginData }],
  ]);
// ...
  return STORED_RECORD.Check(stored)
    ? { pluginRoot: stored.pluginRoot, pluginData: stored.pluginData }
    : undefined;
```
Build the stored object in this one place with a fixed member order and a conditional spread for `claudeName`, the form `staged-command.ts:196` uses: `...(argumentHint !== undefined && { "argument-hint": argumentHint })`. `assertReadsBack` (`staged-command.ts:246-258`) compares `JSON.stringify` of the whole frontmatter, so the order written is the order expected only because both come from `withCommandRecord`. Update the header (`:3-8`) and the reader's doc comment ("exactly the two string members", `:47-50`).

**Stage-time write** (`staged-command.ts:290-297`):
```typescript
  const record: CommandRecord = {
    pluginRoot: context.pluginRoot,
    pluginData: context.pluginDataDir,
  };
  const frontmatter = withCommandRecord(
    stagedFrontmatter(parsed.frontmatter, body, command.overrides),
    record,
  );
```
`context.pluginName` (`:285`) and `command.sourceName` (`:305`) are in scope. Store the name always; the reader's `reserved` set drops it when it equals the Pi name (`skill-alias-state.ts:321-323`), so the stager compares nothing. Extend the header paragraph at `:22-24`.

**Test analogs:** `test/bridges/commands/command-record.test.ts:9-28` (round trip, key order pinned with `keys: Object.keys(recorded)`) and `:30-52` (an author value under the record key is replaced). New cases: a record with `claudeName` round-trips; a record without it still reads; a planted `claudeName` in source frontmatter is replaced. `test/bridges/commands/staged-command.test.ts` pins the staged text, so its expectations gain the member.

---

### `E/orchestrators/skill-alias-state.ts` (alias source, menu text)

**The kind to change** (`:153-159`) and the kind to mirror (`:134-151`):
```typescript
function installedForms(pluginName: string, names: readonly string[]): readonly string[] {
  const prefix = `${pluginName}:`;
  const bare = names.find((name) => !name.includes(":"));
  return names.filter((name) => name.startsWith(prefix) || name === bare);
}

const SKILL_KIND: AliasKind = {
  // ...
  names: (entry, frontmatter) => {
    const record = readSkillRecord(frontmatter);
    return record === undefined
      ? legacyAliases(entry)
      : installedForms(entry.pluginName, record.names);
  },
};

const COMMAND_KIND: AliasKind = {
  source: "prompt",
  resources: (record) => record.prompts ?? [],
  stagedFile: (root, name) =>
    path.join(root, "pi-claude-marketplace", "resources", "prompts", `${name}.md`),
  names: (entry, frontmatter) => frontmatterNameAliases(entry.pluginName, frontmatter.name),
};
```
`COMMAND_KIND.names` adds the stored name from `readCommandRecord(frontmatter)` (import from `../bridges/commands/command-record.ts`, as `command-invocation.ts:28` does), kept only under the plugin's own prefix and with no whitespace, in a small function with a doc comment in the style of `installedForms` ("D-PG11-01 / T-02-17: ..."). The whitespace rule is the one `frontmatterNameAliases` applies (`skill-names.ts:102`). Put the stored name before the frontmatter aliases. No comparison with the Pi name: `claimedAliases` (`:262-276`) drops a name in `reserved`.

**The read to widen** (`:162-176`): `entryNames` already holds the parsed frontmatter. Return the menu text beside the names from this one read (finding 1); add a `menu` reader to `AliasKind` only if the two kinds differ, and they do not: both read `description` and `argument-hint` from the staged frontmatter. Hint text per RESEARCH F4: a string as is, `String(value)` for a number, a boolean, or a list of scalars, nothing for a mapping. `frontmatterNameAliases` (`skill-names.ts:89-104`) is the model for reading an `unknown` frontmatter value with `typeof` arms and `String()`.

**Carrier** (`:67-69`): give `PluginAliasTarget` a required member on both arms (RESEARCH Pattern 4). Builders that then stop compiling: `loadPluginNames` (`:331`, `:336`), `test/edge/skill-aliases.test.ts:69`, `:320-321`, `test/orchestrators/skill-alias-state.test.ts`, `test/orchestrators/typed-expansion.test.ts`. Update the module header (`:9-14`) and the `PluginNames.aliases` doc (`:299-304`).

**Test analog:** `test/orchestrators/skill-alias-state.test.ts:41-58`, the staged-file builders:
```typescript
/** A staged `SKILL.md` whose record stores `names`. */
function recordedSkill(generatedName: string, names: readonly string[]): string {
  return [
    "---",
    `name: ${generatedName}`,
    "description: A skill.",
    `pi-claude-marketplace: {"names":${JSON.stringify(names)},"pluginRoot":"/plugin","pluginData":"/data"}`,
    "---",
```
Add a sibling builder for a staged command with a record. Cases: the stored name becomes an alias; a stored name equal to the Pi name is dropped (through `reserved`); a stored name under another plugin's prefix is dropped; a file with no `claudeName` gives the frontmatter aliases only.

---

### `E/edge/skill-aliases.ts` (suggestion text)

**The line** (`:36-45`):
```typescript
  const matches = [...aliases].filter(
    (alias) => alias.toLowerCase().includes(query) && !existing.has(alias),
  );

  return matches.length === 0
    ? suggestions
    : {
        items: [...nativeItems, ...matches.map((alias) => ({ value: alias, label: alias }))],
        prefix: suggestions?.prefix ?? typed,
      };
```
and its caller (`:69-70`): `appendAliasSuggestions(typed, suggestions, aliases.keys())`. Pass the entries, not the keys. Build `description` as pi-tui does (`node_modules/@earendil-works/pi-tui/dist/autocomplete.js:236-242`): hint and description joined by a space, U+2014, a space; either alone; the member left out when both are empty (`exactOptionalPropertyTypes`: use the conditional spread of `:112`, `...(event.images !== undefined && { images: event.images })`). Write the dash as `"—"` (finding 3). The colon rule at `:58-65` stays.

**Test analog:** `test/edge/skill-aliases.test.ts:771-790` (a provider case that returns native items and expects the alias appended as `{ value: "foo:bar", label: "foo:bar" }`). Those expectations gain `description`. Cases: hint only, description only, both, neither, a list hint.

---

### Cucumber: PG-CMD-09 in `features/slash-command/aliases.feature`

**Analog:** the Outline at `:13-38`:
```gherkin
  Scenario Outline: Each name Claude Code gives a command sends its body to the model
    Given pi runs with the scripted model
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "ship" with this command file:
      """
      ---
      name: fancy
      description: Ships the branch.
      ---

      Ship the branch.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply    |
      | Shipped. |
    When the user prompts "<typed name> production"
    Then the model receives these calls:
      | call | role | text                                     |
      | 1    | user | Ship the branch.\n\nARGUMENTS: production |

    Examples:
      | typed name  |
      | /demo:ship  |
```
The new scenario publishes the command `demo-lint` (file `commands/demo-lint.md`) and is an Outline with two rows, `/demo:lint` and `/demo:demo-lint`, so one scenario proves "the same body, as `/demo:lint x` does" (criterion 3). The second row is red before the change. The file's `Background` (`:7-11`) already publishes the marketplace. Title ends with `(PG-CMD-09)`, the form `features/skill/invocation.feature:204` uses (`... (PG-CORE-05)`). Update the Feature description (`:3-5`): the names now also come from the file path.

### Cucumber: PG-SKILL-11 rows and scenario

**Rows that change** (RESEARCH F5):
- `features/slash-command/aliases.feature:116-118`: the `demo:fancy` row gets description `Ships the branch.`
- `features/slash-command/frontmatter.feature:193-196`: the `demo:demo-skill` row gets `A skill of demo 1.0.0.` (the default fixture skill's description, shown at `:165`).

**Analog for the new skill menu scenario:** `features/slash-command/frontmatter.feature:167-196`:
```gherkin
  Scenario: A command's argument hint is shown in pi's terminal menu
    # ... publish, add, install ...
    When the user types the slash command prefix "/demo:de" in pi's terminal
    Then pi's terminal menu offers these slash commands:
      | command         | argument hint | description          |
      | demo:deploy     | <environment> | Deploys the branch.  |
```
with the skill fixture of `features/skill/aliases.feature:219-227` plus an `argument-hint:` line. Steps: `features/step_definitions/slash-command/frontmatter.steps.ts:131-152`. No new step. Constraints from the step's reader: the description must hold no dash between spaces (`hintAndDescription`, `:60-77`; RESEARCH Pitfall 10), and the table lists every row of the menu in Pi's order, so the prefix must match the alias rows the scenario expects and nothing else. Mind finding 5 before placing it in `features/skill/aliases.feature`.

### Cucumber: PG-SKILL-01 in `features/slash-command/invocation.feature` and `features/skill/invocation.feature`

**Analog for "attached":** `features/slash-command/invocation.feature:88-111` (a command file with path variables, the model text with `{home}` tokens):
```gherkin
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "paths" with this command file:
      """
      ---
      description: Reports the paths.
      ---

      Root ${CLAUDE_PLUGIN_ROOT}, data ${CLAUDE_PLUGIN_DATA}, project ${CLAUDE_PROJECT_DIR}.
      """
    # ...
    When the user prompts "/demo:paths"
    Then the model receives these calls:
      | call | role | text                                                                                                                                    |
      | 1    | user | Root {home}/marketplaces/fixtures/plugins/demo, data {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo, project {project dir}. |
```
Add the template with `Given the published plugin "demo" of the marketplace "fixtures" has the file "templates/x.md" with this text:` (`features/step_definitions/plugin/publishing.steps.ts:355-356`). The expected cell holds the body, then `<file name="{home}/marketplaces/fixtures/plugins/demo/templates/x.md">\n...\n</file>`, with `\n` written as `\n` (`features/step_definitions/model.steps.ts:135-143` compares the whole text).

**Analog for "argument not attached":** `:195-214` (an argument that must not act):
```gherkin
  Scenario: An argument that starts with an exclamation mark reaches the model escaped and runs nothing
    # ... body "Echo: $ARGUMENTS" ...
    When the user prompts '/demo:echo !`printf pwned`'
    Then the model receives these calls:
      | call | role | text                     |
      | 1    | user | Echo: \\! `printf pwned` |
```
Type the path of the fixture file that exists in the scenario's world, `@{home}/marketplaces/fixtures/plugins/demo/templates/x.md`; `the user prompts {string}` expands tokens (`features/step_definitions/session.steps.ts:98-99`). Never the real `/etc/hostname`.

**Analog for "`!` output not attached":** `:153-172` (`Status: !\`printf ok\``). The three exclusions (fence, code span, `!` output) fit one Scenario Outline whose Examples vary the body line; the Outline form with a body per row is at `:28` onward.

**Analog for the skill through an alias:** `features/skill/invocation.feature:230-249` (alias over RPC, the whole `<skill ...>` block in one cell) with the path-variable fixture of `:184-192`. The staged skill file is `{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-review/role.md`; publish it with the generic file step at `skills/review/role.md`. The `<file>` block sits before `\n</skill>` in the expected cell.

**Rules.** Read `.agents/skills/cucumber/SKILL.md` and its `rules/` before writing. None of these is an MCP scenario, so none carries an implementation tag. A title may not call D-PG11-02 or D-PG11-03 "parity" or "as Claude Code". `npm run check:features` gates feature and step files.

---

### `docs/skills-commands-compatibility.md` (NEW, last plan)

**Analog:** `docs/hooks-compatibility.md`.

**Header block** (`:1-7`):
```markdown
# Hook compatibility

Feature-by-feature comparison of Claude Code's hooks system against the Pi-Claude bridge, with the design rationale for which features were implemented, which were deferred, and which the bridge declares unsupportable.

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes).

The upstream column reflects Claude Code 2.1.316 and its published hooks reference at [code.claude.com/docs/en/hooks](...). The Pi column reflects the bridge sources under `extensions/pi-claude-marketplace/bridges/hooks/` ..., and the behavior that the cucumber scenarios under `features/hook/` prove (D-CF5-21). A note names its decision ID, such as `D-CF5-01`. ...
```
Copy: title form (`# Skill and command compatibility`), one-sentence purpose, the legend line, and the paragraph that pins the upstream version (2.1.323), the Pi version (1.5.0), the source directories, and the feature directories (`features/skill/`, `features/slash-command/`).

**Section layout** (`grep -n "^#"`): topic sections at `##`, sub-topics at `###`, a closing `## Further reading` (`:592-595`) that links the upstream reference. Sections for this page, from D-PG11-12: name mapping (with D-PG11-01), typed arguments and variables, `!` injection, `@file` attachment, dropped fields, `run_plugin_command`, the skill-read fill, the status table, "Not proven by a scenario", further reading.

**Prose register for one feature** (`:182-190`):
```markdown
### UserPromptExpansion

`UserPromptExpansion` hooks run when you type a line that names a prompt template or a skill, before the line expands (D-PG6-18). These lines run them:

- a prompt template, such as `/demo:deploy staging` for a plugin's command or `/notes` for a template of your own
```
Second person, present tense, a decision ID in parentheses, a `demo` example. A difference from upstream is stated as a difference with its ID; D-PG11-02, D-PG11-03, and the directory rule of D-PG11-06 are written as divergences and never as parity.

**Classification buckets** (`:223-232`): "**Deferred for engineering reasons** -- ..." followed by a bullet list. Use that form for the deferred items (directory mentions, the model paths, images).

**Scenario citations.** `docs/mcp-compatibility.md:24` cites inline in parentheses: `(`features/mcp-server/implementation-switch.feature`)`. D-PG11-12 adds the line: `features/skill/aliases.feature:14`. The status table starts from RESEARCH "PG-DOC-01: status table map", with line numbers re-read on the final tree (Pitfall 12) and the citation check of RESEARCH "Validation Architecture" run with a count above zero.

**Formatting.** mdformat and markdownlint run in pre-commit, not Prettier. A literal em dash is rewritten by `fix-unicode-dashes`; the analog writes `--`.

### `README.md` and `README.es.md`

`README.md:102-116` is the name-mapping section. The command alias paragraph at `:114` ("A command also has aliases in interactive sessions and over RPC. If the command's frontmatter sets `name`, ...") gains the Claude Code name, with `foo-bar` in plugin `foo` answering to `/foo:foo-bar`; the table at `:108-112` already has that row. Link the new page in the form of `:28` ("For more information, see [Hook compatibility](docs/hooks-compatibility.md)."). `README.es.md:28` is the Spanish form ("Para más información, consulta [Compatibilidad de hooks](docs/hooks-compatibility.md)."). Both files change in the same commit (the `readme` skill).

---

### PG-DOC-02 corrections

Use RESEARCH "PG-DOC-02: the eight rows" for the text of each row. Patterns for the form:

- **A dated correction that keeps the entry** (`.planning/BACKLOG.md:3831`): `**Out of date 2026-11-15** (parity-gaps Phase 8, 08-03 and 08-04). <the corrected statement with its source>.` Use it for `UAT-02` (`:5`), `TOOLSEARCHOFF-01` (`:4934`), `MCPB-01` (`:4606`), and for the dated amendment in `docs/research/claude-hooks-vs-pi-events.md`. For `WOUT-01` only the heading at `:3829` is left to fix. In `.planning/` records a phase reference is normal; in `docs/` and in code comments it is not.
- **`docs/env-vars.md`**: matrix row `:28`, hook table row `:122`, MCP table row `:161`. The Claude Code cell is one `✓` for all surfaces; add a footnote mark that is not `†` or `‡` (finding 6) and a footnote that names Claude Code 2.1.323, "read in its binary and not run", and the deferred divergence (core report N5).
- **Code comments** (`E/bridges/mcp/builtin-overrides.ts:12-13`, `E/domain/components/hooks/builtin-mcp-tool-names.ts:5-6`, `E/domain/mcp-resolution.ts:75-76`): comment-only edits to build inputs. The commit hook runs `check:commit` with direct coverage for the staged pairs (RESEARCH Pitfall 11). Comments cite decision IDs and versions, never a phase.
- **`features/mcp-server/sources.feature:405-406`**: a scenario description edit; `npm run check:features` applies.
- **Unmeasured marks**: the codemode reach (row 2) and the `UAT-02` fix (row 7) carry the word "unmeasured" with "read in code, not run".

### Records (D-PG11-14)

- **`.planning/PROJECT.md`**: row form of `:2432` and `:2436`:
  `| **D-PG10-16 (parity-gaps, Phase 10, settled in the autonomous discussion of 2026-11-14, pending maintainer review; PRD decision 10; amends SUB-02): <title>**: <premise, versions> | <reference> | -- Pending |`
  Append D-PG11-01 (with "PRD decision 13; amends D-141-01"), D-PG11-02, and D-PG11-03 after the D-PG10 rows, each "pending maintainer review" with Claude Code 2.1.323 and Pi 1.5.0. Add "Amended by D-PG11-01" to the D-141-01 row at `:1877`. Add a footer line in the form of the file's last line: `_Last updated: 2026-11-15 during parity-gaps Phase 10; Key Decisions gains ..._`.
- **`docs/prd/parity-gaps-prd.md:957`**: the S8 row of the section 9 table; add a pointer to `11-SPIKE-S8.md` for the two questions it answered (`@file` text and the `PATH` consumers).
- **`CHANGELOG.md`**: one sub-bullet under the milestone bullet at `:5`, in the voice of `:9-14` (what changed, then what the user does): "An installed agent keeps its old ID until the next `update --map-model`." is the model for the restage note of D-PG11-01. Read `.agents/skills/changelog/SKILL.md` first.

## Shared Patterns

### Injected I/O, pure domain
**Source:** `E/domain/context-injection.ts:35-36` (port type), `E/orchestrators/command-invocation.ts:77-97` (dependencies object with Node defaults)
**Apply to:** `domain/file-mentions.ts`, `orchestrators/mention-attachments.ts`, both invocation orchestrators
The domain module declares the shapes and does no I/O; the orchestrator holds the reader in its dependencies object; tests pass their own reader. No test-only seam and no export made for a test.

### Required carriers
**Source:** RESEARCH Pattern 4; `PluginAliasTarget` at `E/orchestrators/skill-alias-state.ts:67-69`
**Apply to:** the alias target's menu text, the mention reader on both dependency objects
A required member that may be `undefined` makes every builder a compile error until it decides. An optional member compiles at every forgotten site.

### A stored value is checked again when read
**Source:** `installedForms`, `E/orchestrators/skill-alias-state.ts:128-138`; `withCommandRecord`, `E/bridges/commands/command-record.ts:30-44`
**Apply to:** the stored `claudeName`
```typescript
function installedForms(pluginName: string, names: readonly string[]): readonly string[] {
  const prefix = `${pluginName}:`;
  const bare = names.find((name) => !name.includes(":"));
  return names.filter((name) => name.startsWith(prefix) || name === bare);
}
```
The writer replaces the whole record key; the reader keeps only a name under the plugin's own prefix.

### Silent degrade with a debug line
**Source:** `E/orchestrators/skill-alias-state.ts:168-173`
**Apply to:** an unreadable mention, an unreadable staged file in the alias pass
```typescript
  try {
    frontmatter = parseFrontmatter(await dependencies.readFile(entry.file)).frontmatter;
  } catch (err) {
    hookDebugLog(`skill aliases skip ${entry.file}: ${errorMessage(err)}`, "skills");
    return [];
  }
```
No `notify`, no `console`, no `process.stdout` (IL-2).

### Escaped non-ASCII literals
**Source:** `E/bridges/hooks/hook-labels.ts:51-53`; `E/shared/bom.ts:24-28`
**Apply to:** the U+2014 separator, the four CJK marks of the mention parser (write them as escapes or confirm the hooks leave them), any BOM
```typescript
// D-PG5-11: the em dash of Claude Code 2.1.323's missing-script notice. It
// stays escaped because the fix-unicode-dashes hook rewrites a literal one.
const MISSING_SCRIPT_DASH = "—";
```

### Decision-ID comments and titles
**Source:** every analog header above
**Apply to:** all new code, tests, and scenario titles
Cite `D-PG11-xx`, `PG-SKILL-01`, `PG-CMD-09`, `PG-SKILL-11`; never a phase, plan, or wave number. No comment on trivial code.

### Hermetic tests
**Source:** `test/platform/hermetic-environment.ts` (`createHermeticEnvironment(t, prefix)`), `test/platform/isolated-pi-home.ts`
**Apply to:** every unit test that touches a file; every scenario runs in the cucumber world
Never read, list, or write the real `~/.pi/agent` or the real home. A `~` case uses an injected home, not `os.homedir()` of the developer.

### Complexity and duplication
**Source:** CONVENTIONS (two gates), `.fallowrc.json`
**Apply to:** the parser (one function per rule) and the two invocation files (shared wiring lives in `orchestrators/mention-attachments.ts`, not twice)
`fallow dupes` fails on every clone group; ESLint and fallow score cognitive complexity differently and both must pass.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| The status table of `docs/skills-commands-compatibility.md` (each row cites `features/...feature:<line>`) | doc | - | No page cites a scenario line today: `docs/hooks-compatibility.md` cites a directory and `docs/mcp-compatibility.md` cites files without lines. Use RESEARCH "PG-DOC-01: status table map" for the rows and its citation check for the proof. |

## Metadata

**Analog search scope:** `E/domain`, `E/orchestrators` (root), `E/edge`, `E/bridges/{commands,skills,hooks}`, `E/shared`, `E/index.ts`, `test/{domain,orchestrators,edge,bridges/commands}`, `features/{slash-command,skill}`, `features/step_definitions` (root, `slash-command/`, `skill/`, `plugin/`), `features/support/world.ts`, `docs/{hooks-compatibility,mcp-compatibility,env-vars}.md`, `README.md`, `README.es.md`, `CHANGELOG.md`, `.planning/{PROJECT,BACKLOG}.md`, `docs/prd/`
**Files scanned:** ~35
**Pattern extraction date:** 2026-11-15
