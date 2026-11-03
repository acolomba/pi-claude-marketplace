# Phase 1: Harness and Version Raise - Pattern Map

**Mapped:** 2026-11-01
**Files analyzed:** 46 (new or modified, grouped by plan below)
**Analogs found:** 42 / 46

All analog paths below are git-tracked (repo has no capability mirrors). The
spike files under `.planning/spikes/028-model-free-harness/` are tracked, but
they are prototypes: copy the mechanism, not the style (they use `any`, no
braces, and env names like `SPIKE_*` that the harness must not keep).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| **Invocation core (new plan, wave 1)** | | | | |
| `extensions/.../domain/argument-substitution.ts` (new) | utility (pure) | transform | `extensions/.../shared/vars.ts` (`substituteClaudeVars`, l.26-68) | role-match |
| `extensions/.../domain/shell-words.ts` (new) | utility (pure) | transform | `extensions/.../bridges/skills/frontmatter-degrade.ts` (`firstBodyParagraph` line scanner, l.93-113) | partial |
| `extensions/.../domain/context-injection.ts` (new) | utility (pure) | transform | `extensions/.../bridges/mcp/adapter-escape.ts` (regex-driven splice, l.15-60) | partial |
| `extensions/.../domain/description-fallback.ts` (new) | utility (pure) | transform | `bridges/skills/frontmatter-degrade.ts::firstBodyParagraph` (l.93-113) | exact (replaced behavior) |
| `extensions/.../domain/invocation-frontmatter.ts` (new) | config table + utility | transform | `bridges/agents/convert.ts` (`GUIDED_DROPPED_FIELD_WARNINGS`/`droppedFieldWarnings`, l.797-833) + `bridges/agents/stage.ts` l.268-282 | exact |
| `extensions/.../platform/prompt-shell.ts` (new) | platform spawn | request-response (process) | `extensions/.../platform/package-manager.ts` | exact |
| `extensions/.../edge/command-invocation.ts` (new) | edge input handler | event-driven | `extensions/.../edge/skill-aliases.ts` (`registerSkillAliases`, input handler l.84-108) | exact |
| `extensions/.../index.ts` (modify) | entry | wiring | own l.247, l.264-265 | exact |
| `rule-packs/architecture.json` (modify) | config | -- | own `child-process-chokepoint` l.111-122 | exact |
| `test/architecture/gate-targets.ts` (modify `SHELL_OUT_EXEMPT_TARGETS`, l.218) | test config | -- | itself | exact |
| `.fallowrc.json` (modify: `dynamicallyLoaded` + `ignoreExports`) | config | -- | none today (no such keys) | no analog |
| `test/domain/{argument-substitution,shell-words,context-injection,description-fallback,invocation-frontmatter}.test.ts` | test | -- | `test/domain/skill-tokens.test.ts` | exact |
| `test/platform/prompt-shell.test.ts` | test | -- | `test/platform/package-manager.test.ts` | exact |
| `test/edge/command-invocation.test.ts` | test | -- | `test/edge/skill-aliases.test.ts` | exact |
| **01-01 Version raise** | | | | |
| `package.json`, `package-lock.json` | config | -- | itself (l.19-20, 60-74) | exact |
| `scripts/install-test-peers.mjs` | script | batch | itself (`peerNames` l.28) | exact |
| `test/architecture/peer-floor.test.ts` | test | -- | itself (l.34-43 FLOOR-01 case) | exact |
| `bridges/mcp/adapter-escape.ts` (`TRIGGER` l.21) | bridge utility | transform | itself | exact |
| `bridges/mcp/adapter-entry.ts` (`CARRIED_FIELDS` l.45-57) | bridge config | -- | itself | exact |
| `domain/claude-mcp-variables.ts` (ref-with-default segment) | domain | transform | its own `Segment` union | exact |
| `test/integration/adapter-expansion-conformance.test.ts`, `test/bridges/mcp/adapter-entry.test.ts` | test | -- | themselves (RESEARCH Q5 lines) | exact |
| `platform/pi-api.ts` (add `ThinkingLevel`, `InputSource`) | platform types | -- | its own derived aliases (`ExtensionMode` l.69, `StopReason` l.128) | exact |
| docs/comment version lines (README*, `docs/*-compatibility.md`, `docs/env-vars.md`, AGENTS.md, STACK.md, `scripts/pi.sh`, `test/e2e/pi-peer-floor/**`, `test/e2e/pi-json-output.test.ts`) | docs/config | -- | RESEARCH Q10 table (text edits only) | n/a |
| **01-02 Ownership rules** | | | | |
| `.agents/skills/cucumber/rules/layout.md`, `world-and-stand-ins.md` | docs | -- | themselves | exact |
| **01-03 Tracer** | | | | |
| `test/e2e/_rpc.ts` (`startRpcPi` l.442-447, `rpcChildEnvironment` l.190) | test support | process | itself | exact |
| `test/architecture/hermetic-git-environment.test.ts` | test | -- | itself | exact |
| `features/lib/pi-process.ts` (always-on log, `agent_settled`) | harness lib | streaming (JSONL) | itself (`handleLine` l.174-207) | exact |
| `features/lib/scripted-model/{extension,script,calls}.ts` (new) | Pi extension (harness) | event-driven + file-I/O | `.planning/spikes/028-model-free-harness/faux-extension.ts` | exact (prototype) |
| `features/lib/companions.ts` (new) | harness lib | file-I/O | `scripts/install-test-peers.mjs` `readFloors` l.33-50 | role-match |
| `features/lib/turn-records.ts` (new; JSONL slicing, table projection) | harness lib | transform | `features/lib/result-rows.ts` | role-match |
| `features/support/world.ts` (`usePiWithProfile`, `lastTurn`, uncompared-turn marker) | world | -- | own `usePiWith` l.562-566, `After` l.571-597 | exact |
| `features/step_definitions/{model,companion}.steps.ts` (new) | steps | -- | `features/step_definitions/session.steps.ts` | role-match |
| `features/step_definitions/session.steps.ts` (prompt `When`) | steps | -- | itself | exact |
| `features/step_definitions/plugin/publishing.steps.ts` (generic file step) | steps | file-I/O | its own l.242-262 | exact |
| `features/lib/skill-files.ts`, `features/step_definitions/skill/invocation.steps.ts`, `features/skill/invocation.feature` (new) | fixture writer / steps / feature | file-I/O | `publishing.steps.ts` l.242-262 + `features/plugin/staging-warnings.feature` | role-match |
| `.github/workflows/ci.yml` (`behavioral` l.125-145) | CI config | -- | itself + `e2e-tests` job | exact |
| **01-04..01-08 Seeds** | | | | |
| `features/lib/pi-registry-probe/{extension,snapshot}.ts` | Pi extension (harness) | request-response | `.planning/spikes/028-model-free-harness/probe-extension.ts` | exact (prototype) |
| `features/lib/hook-recorder.ts` | harness child process | file-I/O | spike `stub-mcp.mjs` append-log pattern | partial |
| `features/lib/mcp-stub-server.ts` | harness child process | streaming (stdio JSON-RPC) | `.planning/spikes/028-model-free-harness/stub-mcp.mjs` | exact (prototype) |
| `features/lib/{slash-command,hook,mcp-server,agent,workflow}-files.ts` | fixture writer | file-I/O | `features/lib/published-marketplace.ts` (`writePublishedPluginFile` users) | role-match |
| `features/step_definitions/{slash-command/listing,hook/runs,mcp-server/calls,agent/runs,workflow/runs}.steps.ts` + seed `.feature`s | steps / feature | -- | `publishing.steps.ts`, `session.steps.ts`, `staging-warnings.feature` | role-match |
| **Component-directory plan (D-CF1-06, wave 3)** | | | | |
| `domain/component-paths.ts` (`collectStrictComponentKind` l.129-157) | domain resolver | transform | itself | exact |
| `orchestrators/plugin/info.ts` (`deriveLenientComponentPaths` l.1943-1964) | orchestrator helper | transform | itself | exact |
| `features/plugin/component-directories.feature` | feature | -- | `features/plugin/staging-warnings.feature` | exact |
| `test/domain/component-paths.test.ts`, `test/domain/plugin-resolver.test.ts`, `test/orchestrators/plugin/info.test.ts` (l.10000 WFLW-04) | test | -- | themselves | exact |

## Pattern Assignments

### `edge/command-invocation.ts` (edge, event-driven) -- pass-through seed

**Analog:** `extensions/pi-claude-marketplace/edge/skill-aliases.ts`

Imports (l.1-3): production deps by relative path, Pi types only through the chokepoint:
```ts
import { loadQualifiedSkillAliases } from "../orchestrators/skill-alias-state.ts";

import type { AutocompleteProvider, ExtensionAPI, ExtensionContext } from "../platform/pi-api.ts";
```

Registration with an injectable dependency defaulting to production (l.58-64), and the input handler shape (l.84-108):
```ts
export function registerSkillAliases(
  pi: ExtensionAPI,
  loadAliases: (pi: ExtensionAPI, cwd: string) => Promise<ReadonlyMap<string, string>> = loadQualifiedSkillAliases,
): void {
  ...
  pi.on("input", (event, ctx) => {
    if (event.source !== "interactive") {
      return { action: "continue" };
    }
    ...
    return { action: "transform", text: ..., ...(event.images !== undefined && { images: event.images }) };
  });
}
```
The seed returns `{ action: "continue" }` for every input (pass-through). Export `registerCommandInvocation(pi: ExtensionAPI, ...deps): void` with explicit return type. Do not filter on `source` in the seed beyond what the test pins; D-CF1-01 targets every source (RESEARCH Q11 notes Pi runs `input` handlers for every source). Note `images` spread under `exactOptionalPropertyTypes`.

**`index.ts` wiring** (l.264-265): add `registerCommandInvocation(pi);` on the line **after** `registerSkillAliases(pi);` (RESEARCH Q11: registration order is chain order; hooks UserPromptSubmit first, then `backgroundUpdate.onInput` l.247, then skill aliases, then command invocation).

**Test analog:** `test/edge/skill-aliases.test.ts` l.1-56 -- `strong-mock` with `exactParams: true`, `It.willCapture<InputListener>("input")`, `when(() => { pi.on("input", input); }).thenReturn().times(1)`, then call `input.value?.({ type: "input", text, source }, ctx)`, assert, `verify(pi); verify(ctx);`. `InputListener` type alias at l.19-22. Arrange/act/assert comments are the house style.

---

### `platform/prompt-shell.ts` (platform, process spawn) -- D-CF1-02

**Analog:** `extensions/pi-claude-marketplace/platform/package-manager.ts`

Header comment pattern (l.1-39): cite IDs, describe spawn shape, and the chokepoint sentence. Copy and update the count:
```ts
// D-21 / D-PL9-11: this is one of four modules that may import
// node:child_process. test/architecture/no-shell-out.test.ts holds the
// whitelist, and the rule pack's child-process-chokepoint rule bans the import
// everywhere else.
```
Injected launcher type + production constant (l.47-81):
```ts
export type PackageManagerSpawn = (...) => PackageManagerProcess;
export const NODE_PACKAGE_MANAGER_SPAWN = spawn as PackageManagerSpawn;
```
Runner factory taking options (`createPackageManagerRunner`, l.466) and a never-rejecting run (l.340-376):
```ts
return new Promise((resolve) => {
  const spawnOptions = { cwd: request.cwd, env: {...}, shell: false, stdio: ["ignore", "pipe", "pipe"], detached: options.host.platform !== "win32" };
  let child;
  try {
    child = options.spawn(launch.command, launch.args, spawnOptions);
  } catch (error: unknown) {
    resolve(notStarted(error as Error));
    return;
  }
  watchProcess(child, options, resolve, (signal) => { stopTree(...); }, request.signal);
});
```
For `!` commands: launch `bash -c <command>` (argv, `shell: false`), resolve `{ code, stdout, stderr, error? }`; the domain module formats success/failure text (RESEARCH Q4). Reuse `StringDecoder` decoding and process-group kill logic from this file rather than writing new ones. Shell selection rule (Linux/macOS: Bash unless `CLAUDE_CODE_USE_POWERSHELL_TOOL`) goes through an injected `host`/`env`, as `NODE_PACKAGE_MANAGER_HOST` (l.107-131) does.

**Gate edits that must land together:**
- `rule-packs/architecture.json` l.115-121: add `"extensions/pi-claude-marketplace/platform/prompt-shell.ts"` to `exclude`, rewrite `message` to "five sanctioned spawn sites ... and the `!` prompt shell".
- `test/architecture/gate-targets.ts` l.218 `SHELL_OUT_EXEMPT_TARGETS`: add the file; `test/architecture/no-shell-out.test.ts` l.158/190 text says "four" -- update.
- If only the edge may import it, add a BLOCK C zone in `eslint.config.js` like the `package-manager.ts` one (`no-shell-out.test.ts` l.30-37 tests that zone).

**Test analog:** `test/platform/package-manager.test.ts` (fake spawn injected; no real processes for the unit pairs; 100% direct coverage required).

---

### `domain/argument-substitution.ts`, `domain/shell-words.ts`, `domain/context-injection.ts`, `domain/description-fallback.ts` (domain, pure transform)

**Analog for structure:** `extensions/pi-claude-marketplace/shared/vars.ts` -- an exported vars interface (l.26), module-level constant table + compiled regex (l.37-44), one exported function with explicit return type (l.68):
```ts
export interface ClaudePluginVars { ... }
const TOKEN_TO_FIELD = { ... };
const CLAUDE_VAR_PATTERN = new RegExp(...);
export function substituteClaudeVars(content: string, vars: ClaudePluginVars): string {
```
**Analog for scanner style:** `bridges/skills/frontmatter-degrade.ts` l.93-113 (`firstBodyParagraph`): small loop delegating to helpers (`skipFencedBlock`, `collectParagraph`) to stay under cognitive complexity 15. `domain/description-fallback.ts` replaces this behavior with A2e (first non-blank line; `/^#+\s+(\S.*)$/`; 97 + `...` over 100; label fallback) -- do **not** edit `frontmatter-degrade.ts` in Phase 1 (Phase 2 wires it).

**Analog for regex splice:** `bridges/mcp/adapter-escape.ts` l.15-45: named module constants with a comment each (`TRIGGER`, `PARTIAL_TRIGGER_TAIL`, `MARKER_COMPLETION`), a `switch` helper per token kind (`escapeTrigger`). Use the same shape for `oPo`/`rPo`/`TGe` ports in `context-injection.ts`.

Rules all four must follow (CONVENTIONS): domain imports `shared/` only; split T2e passes and the tokenizer into one function per pass/node kind (both complexity gates); the 4,000,000-char overflow is a typed `Error` subclass with `this.name` (in `shared/errors.ts` style, see CONVENTIONS `StaleSourceCloneError`); comments cite `D-CF1-01`/`D-CF1-02`/`D-CF1-04`, never phase numbers.

**Test analog:** `test/domain/skill-tokens.test.ts` l.1-25 -- `describe`/`test` from `node:test`, `assert` from `node:assert/strict`, import by `.ts` path, arrange/act/assert comments. Encode RESEARCH Q1 golden vectors as a table-driven loop.

---

### `domain/invocation-frontmatter.ts` (domain, field table) -- D-CF1-05

**Analog:** `bridges/agents/convert.ts` l.797-833 and `bridges/agents/stage.ts` l.268-282.

Table as a frozen record, derived set (convert.ts l.801-822):
```ts
const GUIDED_DROPPED_FIELD_WARNINGS: Readonly<Record<string, (declaredName: string) => string>> =
  Object.freeze({ ... });
export const GUIDED_DROPPED_FIELDS: ReadonlySet<string> = new Set(Object.keys(GUIDED_DROPPED_FIELD_WARNINGS));
```
Warning line format the bridges must emit (stage.ts l.275-277):
```ts
if (summarizedDropped.length > 0) {
  out.push(`[${converted.sourceName}] dropped fields: ${summarizedDropped.join(", ")}`);
}
```
Export `UNHONORED_INVOCATION_FIELDS` (`disallowed-tools`, `model`, `effort`, `agent`, `context`, `background`, `hooks`, `paths`) as a `ReadonlySet<string>` and a `droppedInvocationFields(frontmatterKeys): string[]` in declaration order; the `[<source>] dropped fields:` string is built by the bridges (Phases 2/3) or by a helper here.

---

### Unwired cores and fallow (`.fallowrc.json`)

**No analog in config.** Closest precedent is the inline marker in `index.ts` l.70-76:
```ts
// fallow-ignore-next-line unused-export -- package.json `pi.extensions` loads this default.
export default async function claudeMarketplaceExtension(pi: ExtensionAPI): Promise<void> {
```
Per RESEARCH Pattern 5: add each unwired core to `dynamicallyLoaded` and its exports to `ignoreExports`. Alternative (RESEARCH Alternatives): pass the cores as default deps of `registerCommandInvocation` so they are reachable through `index.ts` -- see Dubious Choices.

---

### `bridges/mcp/adapter-escape.ts`, `adapter-entry.ts`, `domain/claude-mcp-variables.ts` (01-01)

Self-analog edits, exact lines:
- `adapter-escape.ts` l.21: `const TRIGGER = /\$env:|\{env:|\$(?=\{\w+\})/g;` -> `/\$env:|\{env:|\$(?=\{\w+(?:\}|:-))/g`; re-derive `PARTIAL_TRIGGER_TAIL` l.25 and `MARKER_COMPLETION` l.31. `mergedRuns` (l.44-58) already joins `:-` default text with neighbors -- the hybrid delegation adds a new segment kind that this function must pass through.
- `adapter-entry.ts` l.45-57: append `"appendStructuredContent", "roots",` after `"trace"` (D-CF1-14); `CARRIED_FIELD_SET` l.59 derives automatically.
- `domain/claude-mcp-variables.ts`: extend the exported `Segment` union (imported type-only by adapter-escape.ts l.15) with a ref-with-default arm.

### `platform/pi-api.ts` (01-01)

Add derived aliases in the style of l.66-69 and l.126-128 (no new peer import; NFR-11 chokepoint):
```ts
/** Pi's mode union, derived from its context because the root omits the alias. */
export type ExtensionMode = ExtensionContext["mode"];
```
-> `export type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;` and `export type InputSource = InputEvent["source"];`. `InputEvent`, `SessionCompactEvent` are already re-exported (l.53, 56). Test pair: `test/platform/pi-api.test.ts`.

### `scripts/install-test-peers.mjs`, `test/architecture/peer-floor.test.ts`, `package.json` (01-01)

- `install-test-peers.mjs` l.28: `const peerNames = ["pi-mcp-adapter", "pi-subagents"];` -> add `"@quintinshaw/pi-dynamic-workflows"`; `readFloors` (l.33+) reads `peerDependencies` generically, so no logic change. Comment at l.25 pairs it with `test/integration/optional-peer.ts`.
- `peer-floor.test.ts` l.34-43 is the case template:
```ts
test("package.json peerDependencies pins the pi-coding-agent floor at >=1.0.0 (FLOOR-01)", async () => {
  // arrange
  const pkg = await readPackageJson();
  // act
  const range = pkg.peerDependencies?.[PEER];
  // assert
  assert.ok(range, `peerDependencies["${PEER}"] is missing`);
  assert.equal(range, ">=1.0.0", `FLOOR-01 violation: ...`);
});
```
Copy for the engine peer (range, optional meta, not in deps/devDeps/lock packages) and the pi-ai exact devDep.

---

### `test/e2e/_rpc.ts` + `features/lib/pi-process.ts` (01-03)

- `_rpc.ts` l.442-447 today: `startRpcPi(sandbox, git)` -> `spawnPi(await resolveRpcSandbox(sandbox), [], git)`. The `[]` is the extra-args slot: grow the signature with `extraExtensions` (mapped to `--extension <path>` pairs) and typed extra env; `rpcChildEnvironment` l.190-198 is the env allowlist where `TMPDIR` joins. `killProcessGroup` l.327 is reused by the reset.
- `pi-process.ts`: `PiProcess.start` l.115-117 forwards new params. `handleLine` l.174-207 returns early when no request is pending (`if (record === undefined || pending === undefined) return;`): add an append-only `records` array **before** that guard, keep the `switch` windowing for `request()`. `idle` l.124-126 additionally false between `agent_start` and `agent_settled`. `stop()` l.150-171 already closes stdin, waits `STOP_GRACE_MS`, then kills the group -- the profile Pi reuses it.

### `features/support/world.ts` (01-03)

Copy `usePiWith` (l.562-566) for `usePiWithProfile`:
```ts
private async usePiWith(environment: RpcGitEnvironment): Promise<void> {
  const pi = await PiProcess.start(currentRun().sandbox, environment);
  this.onRelease(() => pi.stop());
  this.scenarioPi = pi;
}
```
Public wrappers with a JSDoc paragraph explaining why a second Pi exists follow l.426-455 (`usePiWithGitHubBaseUrl`, `usePiWithBackgroundUpdateDelay`). Cleanup via `onRelease` (l.539-558, LIFO, aggregate errors). The uncompared-turn and unused-script checks join the `After` hook (l.571-597): capture before `await this.release()`, assert only when `result?.status === Status.PASSED`, using `assert.deepStrictEqual(x, [], "no step compared ...")` wording.

### `features/lib/scripted-model/extension.ts` (Pi extension, event-driven + file-I/O)

**Analog:** `.planning/spikes/028-model-free-harness/faux-extension.ts` (36 lines):
```ts
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
export default function faux(pi: any): void {
  const handle = fauxProvider();
  const factory = (context: any) => {
    appendFileSync(`${process.env.HOME}/faux-calls.log`, JSON.stringify({ ... }) + "\n");
    const step = steps[i++] ?? { text: "done" };
    return step.tool
      ? fauxAssistantMessage([fauxToolCall(step.tool, step.args ?? {})], { stopReason: "toolUse" })
      : fauxAssistantMessage([fauxText(step.text)]);
  };
  handle.setResponses(Array.from({ length: 50 }, () => factory));
  pi.registerProvider(handle.provider);
}
```
Required changes (D-CF1-17, RESEARCH Pattern 1): no in-memory `i` -- index = line count of the sandbox `calls.jsonl`; read `script.json` per call; self-replenish via `handle.appendResponses([player])` instead of 50 copies; **no** `?? { text: "done" }` fallback -- throw past the script and log an `overflow` record; full record (all messages, tool names+schemas, system prompt). Types: import Pi types through `test`-side type imports, not `any`. Default export needs `// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.` (copy of `index.ts` l.76).

### `features/lib/pi-registry-probe/extension.ts`

**Analog:** spike `probe-extension.ts` l.5-21: `pi.registerCommand(name, { description, handler })` that calls `pi.appendEntry(customType, { allTools: pi.getAllTools().map(...), activeTools: pi.getActiveTools(), commands: pi.getCommands().map(...) })`. `PiProcess` already captures `entry_appended` custom entries (`pi-process.ts` l.192-199), so the step reads the snapshot from `exchange.entries`. Same fallow marker on the default export.

### `features/lib/mcp-stub-server.ts` and `features/lib/hook-recorder.ts`

**Analog:** spike `stub-mcp.mjs` (23 lines): readline over stdin, `appendFileSync(log, JSON.stringify(...) + "\n")` per request, `switch (msg.method)` with `initialize`/`tools/list`/`tools/call`/default, skip replies when `msg.id === undefined`. Port to `.ts` under `features/lib/` (D-CF1-17), log under `$HOME`, add a pid file and `process.stdin.on("close", () => process.exit(0))` (RESEARCH Pitfall H). Hook recorder: same append-one-JSON-line-to-`$HOME` pattern, reading the hook payload from stdin. Neither is a Pi extension, so no default export and no fallow marker -- but check that fallow sees them reachable (they are spawned by path, so likely also need an `entry`/`dynamicallyLoaded` entry; verify with `npx fallow dead-code`).

### `features/lib/companions.ts`

**Analog:** `scripts/install-test-peers.mjs` l.25-50 (`cacheDir = node_modules/.cache/optional-peers`, `readFloors` with `minVersion(range)` and thrown `Error` naming the missing peer). Read `node_modules/.cache/optional-peers/node_modules/<name>/package.json` `pi.extensions[0]` and compare its `version` with the floor. `features/` may not import `test/integration/optional-peer.ts` (layout rule), so this duplicates the path constant -- keep a "change the two together" comment like `install-test-peers.mjs` l.25.

### Step modules, fixture writers, seed features

**Step module header + imports:** `features/step_definitions/session.steps.ts` l.1-25 (`@fileoverview` block explaining what the steps observe; imports `{ type DataTable, Given, Then, When } from "@cucumber/cucumber"`, lib helpers, `import type { ScenarioWorld } from "../support/world.ts"`). Steps take `this: ScenarioWorld`.

**File-writing `Given` that proves its own write:** `features/step_definitions/plugin/publishing.steps.ts` l.242-262:
```ts
Given(
  "the published plugin {string} of the marketplace {string} has two agents named {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, agent: string) {
    const published = this.requirePublished(name);
    const first = await writePublishedPluginFile(published, plugin, path.join("agents", "first.md"), agentText("The first agent."));
    ...
    assert.deepStrictEqual([await readFile(first, "utf8"), ...], [agentText("The first agent."), ...]);
  },
);
```
The generic file step (01-03) and every `<kind>-files.ts` writer build on `writePublishedPluginFile`.

**Feature shape:** `features/plugin/staging-warnings.feature` l.1-21: `Feature:` + prose paragraph, `Background:` publishing a dir-source marketplace and adding it, `When the user runs "/claude:plugin install demo@fixtures --scope project"`, whole-value `Then the command reports these results:` tables. `features/lib/*` depth <= 3 and `.ts` only; `step_definitions/` depth <= 3 ending `.steps.ts` (`scripts/check-features.mjs` l.238-248).

### `.github/workflows/ci.yml` `behavioral` (l.125-145)

Today: single job, `timeout-minutes: 10`, `npm ci --ignore-scripts`, `npm run test:cucumber`. Change to `strategy: { fail-fast: false, matrix: { include: [{shard: lifecycle, ...}, {shard: components, ...}] } }`, add `node scripts/install-test-peers.mjs` step (copy from the `integration` job, which runs `npm run test:integration` that installs peers), pass paths through `env:` (zizmor), `timeout-minutes: 15`.

### `domain/component-paths.ts` + `orchestrators/plugin/info.ts` (D-CF1-06)

- `component-paths.ts` l.129-157 `collectStrictComponentKind`: the union is l.148-150:
```ts
if ((await statKind(path.join(pluginRoot, kind))) === "dir") {
  addComponentPath(resolution, kind, seenPaths, kind);
}
```
Gate it: always for `skills`; for `commands`/`agents`/`workflows` only when `entry[kind]` and `manifest[kind]` are both falsy (upstream `!manifest.commands`: declared `[]` suppresses, `""`/`null`/absent keep). When suppressed and the folder is a dir, push the shadowed warning into `resolution.notes` (existing note channel, l.126) in staging-warning style. Keep the function under complexity 15 by extracting a `conventionalFolderApplies(kind, fromEntryRaw, fromManifestRaw)` helper.
- `info.ts` l.1943-1964 `deriveLenientComponentPaths`: seeds all four kinds with the conventional folder; change seed so `commands`/`agents`/`workflows` start empty when the entry declares that kind. `asDeclaredList` l.1966+ stays.

## Shared Patterns

### Output (IL-2)
**Source:** `shared/notification-dispatch.ts` (sole `ctx.ui.notify` site). **Apply to:** `edge/command-invocation.ts` and later injection failures -- return `{ action: "handled" }` and notify through the dispatch helpers; never `console`/stdout (rule pack `no-stdio`, `notify-chokepoint`).

### Pi types (NFR-11)
**Source:** `platform/pi-api.ts`. **Apply to:** every extension file -- import Pi types only from `../platform/pi-api.ts` (see `skill-aliases.ts` l.3). Harness files under `features/` and `test/` may import `@earendil-works/*` directly (spike does).

### Dependency injection over seams
**Source:** `registerSkillAliases(pi, loadAliases = loadQualifiedSkillAliases)` (skill-aliases.ts l.58-64) and `NODE_PACKAGE_MANAGER_SPAWN`/`createPackageManagerRunner` (package-manager.ts l.81, 466). **Apply to:** `command-invocation.ts`, `prompt-shell.ts`.

### Pi-loaded default exports
**Source:** `index.ts` l.76 marker. **Apply to:** `features/lib/scripted-model/extension.ts`, `features/lib/pi-registry-probe/extension.ts`.

### Scenario cleanup
**Source:** `world.ts` `onRelease` l.539-558. **Apply to:** profile Pi stop, stub pid assertions, TMPDIR removal.

### Tests
`node:test` + `node:assert/strict`, arrange/act/assert comments, `.ts` import paths, `strong-mock` with `exactParams: true` for Pi API mocks (`test/edge/skill-aliases.test.ts`). 100% direct coverage per source-test pair.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.fallowrc.json` `dynamicallyLoaded`/`ignoreExports` entries | config | -- | Keys not used anywhere yet; follow RESEARCH Pattern 5 (measured) |
| `domain/shell-words.ts` tokenizer grammar | utility | transform | No parser exists in repo; use RESEARCH Q1 code + golden vectors |
| `features/lib/turn-records.ts` | harness lib | transform | Closest is `features/lib/result-rows.ts` (row projection) but no JSONL slicer exists |
| CI matrix sharding | config | -- | No matrix job exists in `ci.yml`; follow RESEARCH Q9 shape |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{edge,platform,domain,bridges,shared,orchestrators}`, `features/{lib,support,step_definitions,plugin}`, `test/{edge,domain,platform,architecture,e2e}`, `scripts/`, `rule-packs/`, `.github/workflows/`, `.planning/spikes/028-model-free-harness/`
**Files scanned:** ~45
**Pattern extraction date:** 2026-11-01
