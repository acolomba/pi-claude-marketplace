# Phase 3: Slash Commands - Pattern Map

**Mapped:** 2026-11-01
**Files analyzed:** 22 (product, tests, features)
**Analogs found:** 21 / 22

All paths are relative to `extensions/pi-claude-marketplace/` unless they start
with `features/`, `test/`, or `.planning/`. Every analog named is git-tracked
source.

## Fallow dupes rule for every Phase 2 analog

`npx fallow dupes` (mild: 50 tokens / 5 lines) fails the combined tree on any
near-copy. Renamed identifiers do NOT escape a match; changed string literals
and changed statement structure do. So for each Phase 2 analog below:

- copy the **contract** (inputs, outcomes, order of checks), never a 5+ line run
  of statements;
- **call** Phase 2's exported functions where the zone allows it (orchestrators
  may import `bridges/skills/*`; `bridges/commands` may NOT import
  `bridges/skills` - fallow zones; `edge/` may NOT import `bridges/`);
- where a shape must repeat, change the structure (different decomposition,
  lookup table instead of if-chain, a shared helper with a parameter), not
  just the names.

Run `npx fallow dupes` after each plan; a new clone group needs either a
restructure or a reviewed inline `fallow-ignore-next-line code-duplication --
<reason>` marker (marker count is tracked in CONVENTIONS.md, so prefer
restructuring).

## Frozen / use-only files

Must be used, never edited:

- Phase 1 invocation cores: `domain/argument-substitution.ts`
  (`substituteArguments`, `parseArgumentNames`, `claudeEffort`,
  `InvocationTooLargeError`), `domain/shell-words.ts`,
  `domain/context-injection.ts` (`expandContextInjections`,
  `ContextInjectionError`), `domain/description-fallback.ts`
  (`descriptionFallback`), `domain/invocation-frontmatter.ts`
  (`droppedInvocationFieldsWarning`), `platform/prompt-shell.ts`
  (`selectPromptShell`, `bashMissingMessage`, `createPromptShellRunner`,
  `NODE_PROMPT_SHELL_HOST`, `NODE_PROMPT_SHELL_SPAWN`).
- ROADMAP "Frozen after Phase 1": `features/support/world.ts`,
  `features/support/pi-process.ts`,
  `features/lib/{pi-process,pi-commands,run-tokens,published-marketplace,companions}.ts`,
  `features/lib/scripted-model/*`, `features/lib/pi-registry-probe/*`,
  `features/lib/hook-recorder.ts`, `features/lib/mcp-stub-server.ts`,
  `test/e2e/_rpc.ts`, `cucumber.json`, `scripts/check-features.mjs`,
  `.agents/skills/cucumber/**`, shared step modules `command`, `session`,
  `config`, `git-host`, `mcp-configuration`, `model`, `companion`,
  `plugin/publishing`, `marketplace/publishing`.
- `.fallowrc.json` (zones, rule pack) and `index.ts` (registration order:
  `registerCommandInvocation` already runs after skill aliases).
- Phase 2-owned (use, do not edit): `bridges/skills/**`,
  `orchestrators/skill-invocation.ts`, `edge/skill-aliases.ts`,
  `features/step_definitions/skill/**`, `features/lib/skill-files.ts`.
  `features/lib/pi-tui.ts` use-only unless a backward-compatible option is
  unavoidable (D-CF3-13).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `bridges/commands/staged-command.ts` (NEW) | utility (bridge writer + record reader + digest) | transform | `bridges/skills/skill-names.ts` (record schema, L35-56) + `bridges/skills/stage.ts` L134-140 (fallback rule) | role-match (must differ: JSON-flow rebuild, not line scanner) |
| `bridges/commands/stage.ts` (mod) | bridge stage/commit | file-I/O | itself; `bridges/skills/stage.ts` L516-616 (`recordProjectSkills`, ledger param) | exact |
| `bridges/commands/unstage.ts` (mod) | bridge unstage | file-I/O | `bridges/skills/unstage.ts` L36-62 (`forgetProjectSkills`) | exact (must differ) |
| `bridges/commands/types.ts` (mod) | model/types | - | itself L45-129 | exact |
| `bridges/commands/project-ledger.ts` (NEW, if split) | utility | file-I/O | `bridges/skills/stage.ts` L516-540 / `unstage.ts` L36-62 | role-match (must differ) |
| `bridges/commands/index.ts` (mod) | barrel | - | itself | exact |
| `bridges/commands/discover.ts` (mod) | bridge discover | file-I/O | itself (L349 `discoverPluginCommands`) | exact |
| `orchestrators/command-invocation.ts` (NEW) | service/orchestrator | request-response | `orchestrators/skill-invocation.ts` | exact (must differ) |
| `edge/command-invocation.ts` (mod) | edge input handler | event-driven | `edge/skill-aliases.ts` L100-216 | exact (must differ) |
| `domain/component-paths.ts` (commands arm) | domain resolver | transform | itself L142-175 (`conventionalFolderApplies`, `collectStrictComponentKind`) | exact |
| `domain/resolver-types.ts` (mod) | model (typebox) | - | itself `ComponentPathsSchema` L6-11 | exact |
| `orchestrators/plugin/info.ts` (commands lenient arm) | orchestrator | read | itself L320-345, L1000-1045 | exact |
| `orchestrators/plugin/install-outcome.ts`, `update-swap.ts`, `orchestrators/marketplace/shared.ts` (call sites) | orchestrator | - | install-outcome L1237-1255 (skills commit/unstage) | exact |
| `test/bridges/commands/staged-command.test.ts`, `project-ledger.test.ts`, `stage.test.ts`, `unstage.test.ts` | test | - | `test/bridges/skills/*.test.ts` | role-match |
| `test/orchestrators/command-invocation.test.ts` | test | - | `test/orchestrators/skill-invocation.test.ts` | exact (must differ) |
| `test/index.test.ts` (edit) | test | - | itself | exact |
| `features/slash-command/{listing,frontmatter,invocation,manifest-forms,lifecycle}.feature` | test (cucumber) | - | `features/slash-command/listing.feature`, `features/skill/*.feature` | exact |
| `features/step_definitions/slash-command/{listing,frontmatter,invocation,manifest-forms,lifecycle}.steps.ts` | test steps | - | `features/step_definitions/slash-command/listing.steps.ts`; `features/step_definitions/skill/{frontmatter,project-provenance}.steps.ts` | exact / role-match |
| `features/lib/slash-command-files.ts` (mod) | test lib | file-I/O | itself; `features/lib/skill-files.ts` | exact |

## Pattern Assignments

### `bridges/commands/staged-command.ts` (NEW, transform)

**Analogs:** `bridges/skills/skill-names.ts` L25-56 (record key + typebox),
`bridges/skills/stage.ts` L134-140 (description rule),
`bridges/skills/project-installs.ts` L70-72 (digest).

Record schema pattern (skill-names.ts L35-46):
```ts
const RECORD_KEY = "pi-claude-marketplace";
const RECORD_SCHEMA = Type.Object({
  names: Type.Array(Type.String()),
  pluginRoot: Type.String(),
  pluginData: Type.String(),
});
const RECORD_VALIDATOR = Compile(RECORD_SCHEMA);
```
Command record: same key string, schema `{ pluginRoot, pluginData }` only (no
`names`; command aliases are deferred). Export `readCommandRecord(frontmatter)`
returning `undefined` on a failed `Check`, consumed by
`orchestrators/command-invocation.ts`.

Digest pattern (project-installs.ts L70-72):
```ts
export function skillFileDigest(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
```
Option A (preferred, no clone): the orchestrator and the commit path call
Phase 2's `skillFileDigest` directly through the orchestrator layer; the bridge
cannot import it. Option B: `commandFileDigest` in this module - a 3-line body
is below the 5-line threshold, safe.

Description rule (skills/stage.ts L134-140): `typeof d === "string" ? d : ""`
then `=== "" ? descriptionFallback(body, "Plugin command")`. Use the frozen
`descriptionFallback`; pass Pi's parsed `body`.

Frontmatter rebuild: RESEARCH.md Pattern 2 sketch (JSON-flow, one
`"key": <JSON>` line per key; P3-DC-09 item 1). **Must differ from Phase 2:**
do not port `bridges/skills/rewrite-frontmatter.ts` / `frontmatter-scan.ts`
line scanning - that is both a dupes risk and the duplicate-key bug.

Dropped fields (wave 2): call frozen
`droppedInvocationFieldsWarning(source, {...parsed, ...(model ? {model} : {})})`;
return as a warning string; `stage.ts` maps writer warnings through its
existing `discoveryWarning` plumbing.

---

### `bridges/commands/stage.ts` (mod, file-I/O)

**Analog:** itself (`commitPreparedCommands` L306-370) and
`bridges/skills/stage.ts` L516-616.

Ledger hook placement (skills/stage.ts L556-616): `commit(ops, prepared,
ledger)` renames, cleans up, then `await recordProjectSkills(ledger, prepared)`
so a ledger failure throws into the caller's undo. Skills record:
```ts
if (prepared.locations.scope !== "project") { return; }
const digests = await Promise.all(prepared.result.recorded.map(async (skill) => {
  const content = await readFile(path.join(skill.targetPath, "SKILL.md"), "utf8");
  ...
}));
await ledger.update({ projectPath: path.dirname(prepared.locations.scopeRoot),
  forget: prepared._previousNames, remember: new Map(digests) });
```
**Must differ:** per P3-DC-09 item 2 the commands `ledger` is REQUIRED (no
`= NODE_PROJECT_SKILL_LEDGER` default - the bridge cannot import it anyway);
`targetPath` is already the `.md` file (no `path.join(..., "SKILL.md")`);
need `_pluginName` on `PreparedCommandsStaged`. Write it in a different shape
(e.g. a loop building `remember` via a helper taking `(scope, scopeRoot,
records, previousNames)`) or put it in `project-ledger.ts` shared by stage and
unstage, so commit and unstage share one builder and do not mirror skills'
two functions.

Type of the parameter: the bridge may only `import type` the ledger
contract if the zone allows a type import from `bridges/skills` - it does not
(fallow boundaries see type imports). Declare a structurally compatible
`CommandLedger` interface (`update(change: {projectPath; forget; remember:
ReadonlyMap<string,{plugin;sha256}>}) => Promise<void>`) in
`bridges/commands/types.ts`; `NODE_PROJECT_SKILL_LEDGER` satisfies it
structurally at the orchestrator call site.

Stale markers: delete `fallow-ignore-next-line code-duplication` at
`stage.ts` L160, L276, `discover.ts` L314, `unstage.ts` L29 only after
`npx fallow dupes` confirms no group (per CONTEXT discretion); a marker never
reports stale, so check by deleting and re-running.

---

### `bridges/commands/unstage.ts` (mod)

**Analog:** `bridges/skills/unstage.ts` L36-62:
```ts
if (input.locations.scope !== "project" || input.previousSkillNames.length === 0) { return []; }
try {
  await ledger.update({ projectPath: path.dirname(input.locations.scopeRoot),
    forget: input.previousSkillNames, remember: new Map() });
  return [];
} catch (err) {
  return [`could not update the project skill ledger: ${errorMessage(err)}`];
}
```
Behavior to copy: ledger failure on unstage becomes a warning, never blocks
removal. **Must differ:** take `ledger` on `UnstageCommandsInput` (required);
reuse the shared builder from `project-ledger.ts` (remember = empty) rather
than a second guard+try block of the same shape; warning literal says
"command" (literal change alone is not enough if the surrounding 5 lines
match - the shared helper avoids it).

---

### `orchestrators/command-invocation.ts` (NEW, request-response)

**Analog:** `orchestrators/skill-invocation.ts` (298 lines). Highest clone
risk in the phase.

Imports (L20-45) - reuse the same cores and, crucially, Phase 2's exports:
```ts
import { provenProjectSkills, skillFileDigest } from "../bridges/skills/project-installs.ts";
import { claudeEffort, InvocationTooLargeError, parseArgumentNames, substituteArguments } from "../domain/argument-substitution.ts";
import { ContextInjectionError, expandContextInjections } from "../domain/context-injection.ts";
import { getAgentDir, parseFrontmatter } from "../platform/pi-api.ts";
import { bashMissingMessage, createPromptShellRunner, NODE_PROMPT_SHELL_HOST, NODE_PROMPT_SHELL_SPAWN, selectPromptShell } from "../platform/prompt-shell.ts";
```
plus `readCommandRecord` from `bridges/commands/index.ts` (orchestrators may
import bridges).

Contract to mirror: request (`commands`, `typed`, `args`, `cwd`,
`projectTrusted`, `sessionId`, `thinkingLevel`), outcome union
`not-bridged | ok{text} | abort{message}`, injected dependencies
(`getAgentDir`, `readFile`, `host`, `runShell`), check order (L251-298):
find staged -> trust -> read+parse (abort on throw) -> ledger digest ->
substitute + inject, mapping `ContextInjectionError | InvocationTooLargeError`
to abort.

**Must differ structurally (dupes):**
- Lookup: `source === "prompt"`, staged path
  `<root>/pi-claude-marketplace/resources/prompts/<name>.md`; no `baseDir`, no
  `CLAUDE_SKILL_DIR`, no `skillBlock` - `ok.text` is the substituted body.
- Do NOT re-declare `DEFAULT_DEPENDENCIES` with the same 8-line literal
  (L77-86 is a clone magnet). Prefer exporting nothing new from Phase 2 and
  building the default from a differently shaped factory, or accept the
  dependency bundle from the edge caller.
- Do not reproduce `fillSkill` (L169-198) line-for-line: e.g. resolve the
  shell first (bash-missing abort before substituting), then one
  `substituteArguments` call with variables built from a table, then inject.
- Untrusted / not-installed messages: D-CF3-07 text (literal differs).
- Ledger check: call `provenProjectSkills(agentDir, cwd, readFile)` and
  compare to `skillFileDigest(content)` inline (same ledger file and schema,
  D-CF3-07).

---

### `edge/command-invocation.ts` (mod, event-driven)

**Analog:** `edge/skill-aliases.ts` L100-216. Current seed (13 lines) returns
`{ action: "continue" }`.

Patterns to keep:
- `if (event.source === "extension") return { action: "continue" };`
- token regex `/^\/(\S+)(?=\s|$)/`, args `event.text.slice(token.length + 1).trim()`
  (`""` when empty).
- Abort reporting (L118-127):
```ts
const run = openNotificationRun(pi, { kind: "command", commandId: "skill", invocationId: createInvocationId() });
notifyUsageError(ctx, run, { message, usage: "" });
```
  Command origin per P3-DC-09 item 6: `commandId: <typed name without "/">`.
- Injected `invoke` defaulting to the orchestrator, `createInvocationId =
  randomUUID`, catch-all `outcome = { kind: "abort", message: errorMessage(error) }`.

**Must differ:** no alias table, no cache, no `session_start` autocomplete
provider; dispatch only when `pi.getCommands()` has a `source === "prompt"`
entry with `name === token` (the opposite filter of skill-aliases L192). Write
the `inputResult` mapping fresh (skill-aliases has its own private one); a
`switch` on `outcome.kind` returning `{action:"transform", text}` /
`{action:"handled"}` / `continue` avoids the clone. Do not edit `index.ts`.
E8 residual: unit test pins that a body starting with `/` is returned
unchanged (P3-DC-09 item 3).

---

### `domain/component-paths.ts` + `domain/resolver-types.ts` + `orchestrators/plugin/info.ts`

**Analog:** themselves. Commands arm only.
- `conventionalFolderApplies` (component-paths L148-154) currently reads
  `!entryRaw && !manifestRaw` for commands; D-CF3-04 changes commands to
  `!manifestRaw` only (entry adds). Keep the `skills` and agents/workflows
  branches byte-identical.
- `componentPaths` type at L43: add optional `commandMap` (P3-DC-09 item 5),
  only set when a map exists, so existing `deepStrictEqual` tests stay equal;
  mirror in `ComponentPathsSchema` (resolver-types L6-11) as `Type.Optional`.
- Declared file path (D-CF3-05): extend `collectStrictComponentKind` (L165+)
  commands arm; containment through existing `resolveContainedComponentPath`
  / `assertPathInside`.
- `info.ts` L320-345 (`commands: file entries -> basename minus .md`) and
  L1041-1045 (`discoverComponentNames(resolved.componentPaths.commands,
  "commands")`): add the lenient map + file-path handling there.

---

### Orchestrator call sites

`orchestrators/plugin/install-outcome.ts` L84-98 imports, L1237-1255
(skills commit/unstage, which use the default ledger). Add
`NODE_PROJECT_SKILL_LEDGER` import from `../../bridges/skills/index.ts` (or
`project-installs.ts`) and pass it to `commitPreparedCommands` /
`unstagePluginCommands`. Same in `update-swap.ts` and
`orchestrators/marketplace/shared.ts` L577-580:
```ts
const cmdResult = await unstagePluginCommands({ locations, previousCommandNames: installedPlugin.resources.prompts });
```
-> add `ledger: NODE_PROJECT_SKILL_LEDGER`. Minimal edits only (D-CF3-13).

---

### Features

- `features/step_definitions/slash-command/listing.steps.ts` L15-31: the
  `Given ... has the slash command {string} described as {string} with this
  body:` pattern (`this.requirePublished(name)`, `publishSlashCommand`,
  assert file text). Wave 1 adds the `... with this command file:` docstring
  variant; implement via a new `slash-command-files.ts` helper so the step body
  is not a near-copy of the existing step (different call, not just a different
  string).
- Frontmatter/provenance steps: model on
  `features/step_definitions/skill/frontmatter.steps.ts` and
  `project-provenance.steps.ts`, but call shared `session`/`model` steps
  (frozen, use only) and `features/lib/pi-tui.ts` for autocomplete; do not
  copy skill step bodies.
- Feature files follow `features/slash-command/listing.feature`.

## Shared Patterns

### Output / abort
**Source:** `edge/skill-aliases.ts` L118-127. `openNotificationRun` +
`notifyUsageError` only (notify chokepoint; never `ctx.ui.notify`).

### Errors
`errorMessage` from `shared/errors.ts`; narrow on `instanceof`
(`ContextInjectionError`, `InvocationTooLargeError`).

### Containment / atomic writes
`assertPathInside` (shared/path-safety.ts) before every unlink/rename (see
commands `stage.ts` L320-324); ledger writes go through Phase 2's ledger
(`atomicWriteJson` inside), never a new writer.

### Loops
Each sequential `await` in a loop carries
`// eslint-disable-next-line no-await-in-loop -- <reason>`.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| Object-map entry staging (`kind: "inline"` content) in `staged-command.ts` / `discover.ts` | transform | No inline-content component exists; use RESEARCH.md Pattern 3 |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{bridges,orchestrators,edge,domain}`, `features/step_definitions/{skill,slash-command}`, `features/lib`
**Files scanned:** ~20
**Pattern extraction date:** 2026-11-01
