# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-11-07
**Files analyzed:** 33 (new and modified, from 01-CONTEXT.md and 01-RESEARCH.md "Recommended file layout" and "Recommended plan split")
**Analogs found:** 31 / 33

All analog paths below are git-tracked (`git ls-files` checked). Line numbers are from the worktree at `cf48b0df`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/lib/github-device-flow/extension.ts` (NEW) | harness Pi extension | event-driven (in-process request redirect) | `features/lib/pi-launch-environment.ts` + `features/lib/builtin-mcp-stand-in/extension.ts` | exact (shape) |
| `features/lib/github-device-flow/server.ts` (NEW) | stand-in server | request-response (loopback HTTPS) | `features/lib/https-git-host/server.ts` | exact |
| `features/lib/https-git-host/server.ts` (CHANGED: key path accessor) | stand-in server | request-response | itself (`certificatePath`, lines 337, 354) | exact |
| `features/lib/scripted-model/extension.ts` (CHANGED: error step, usage patch) | harness Pi extension | streaming | itself (`playNextStep` 125-153, `registerProvider` 154-185) | exact |
| `features/lib/scripted-model/script.ts` (CHANGED: new columns) | utility (schema + table parser) | transform | itself (`SCRIPT_VALIDATOR` 29-39, `SCRIPT_COLUMNS` 56, `checkScriptHeader` 68-81, `parseScriptRow` 93-119) | exact |
| `features/lib/hook-files.ts` (CHANGED: `async rewake`, `rewake message`, `rewake summary`, `async`, `waits` columns) | fixture writer | file-I/O | itself (`RecordingHook` 77-96, `BEHAVIOR_FIELDS` 107-116, `meets` marker wait) | exact |
| `features/lib/hook-recorder.ts` (CHANGED: lifecycle log) | stand-in recorder | file-I/O (jsonl log) | itself; log shape of `pi-launch-environment.ts` 64-72, 83 | exact |
| `features/lib/state-lock-holder.ts` (CHANGED: stale lock writer) | fixture writer | file-I/O | itself (`holdStateLock` 56-84, `isStateLockHeld` 87-89) | exact |
| `features/lib/earlier-version-state.ts` (CHANGED: v0.6.0 / v0.19.2 / v0.4.3 / newer-schema writers) | fixture writer | file-I/O (JSON rewrite) | itself (`stateFilePath` 23-25, `jsonObject`/`readObject`/`objectMember` 28-44, `recordEarlierVersionMarketplace` 52+) and `features/lib/mcp-builtin-earlier-record.ts` | exact |
| `features/lib/mcp-configuration.ts` or a new legacy `mcp.json` writer (CHANGED/NEW) | fixture writer | file-I/O | `features/lib/mcp-builtin-earlier-record.ts` + `earlier-version-state.ts` | role-match |
| `features/lib/pi-json-mode.ts` (NEW) | driver | batch (spawn, read stdout lines) | `features/lib/state-lock-holder.ts` (spawn + readline + timeout) and `features/lib/pi-commands.ts` (`claudePluginPayloads` 99-112) | role-match |
| `features/lib/plugin-picker.ts` (NEW) | driver | event-driven (PTY keystrokes, screen text) | `features/lib/pi-tui.ts` (`waitForTextAfter`, `typeText`, `markOutput`) | role-match |
| `features/lib/pi-tui.ts` (CHANGED if picker needs it) | driver | streaming | itself | exact |
| `features/lib/pi-process.ts` (CHANGED: `crash()`) | driver | process control | itself (`stop()` 240-258) | exact |
| `features/lib/pi-commands.ts` (CHANGED: export payload validation) | driver | transform | itself (`claudePluginPayloads` 99-112) | exact |
| `features/lib/upstream/pi.ts` (CHANGED: tool-argument validation projector) | utility | transform | `features/lib/upstream/index.ts` (`projectToolResult`, `projectUserText`, imported at `script.ts:19`) | exact |
| `features/support/world.ts` (CHANGED: launch options) | support (world) | request-response | itself (`PiProfile` 129-133, `usePiWithGitHubBaseUrl` 578-583, `usePiWithBackgroundUpdateDelay` 592-599, `usePiWithProfile` 618-642, `startProfilePi` 917-960) | exact |
| `test/e2e/_rpc.ts` (CHANGED: optional base URL, `PI_SUBAGENT_CHILD`, `"json"` mode) | harness launch | config | itself (`RpcGitEnvironment` 56-67, `RpcProfileEnvironment` 70-72, `rpcChildEnvironment` 221-247, `piArguments` 256-268) | exact |
| `features/step_definitions/scope-state.steps.ts` (CHANGED: stale lock Given) | step module (shared) | request-response | itself (lines 15-24) | exact |
| `features/step_definitions/git-host.steps.ts` (CHANGED: credential helper alone, device flow steps) | step module (shared) | file-I/O | itself (`pi runs with the github base address` 161-166, stored credential Given 170-187) | exact |
| `features/step_definitions/model.steps.ts` (CHANGED only if needed) | step module (shared) | transform | itself (`the model receives these calls:` 97) | exact |
| `features/step_definitions/hook/*.steps.ts` (CHANGED: async release When, summary Then) | step module (topic) | event-driven | `features/step_definitions/hook/session.steps.ts` (`recordSessionAction` 81-98, compaction Given 44-46) | exact |
| `features/step_definitions/session.steps.ts` / `command.steps.ts` / `companion.steps.ts` (CHANGED: json run, picker, child Pi) | step module (shared) | request-response | `features/step_definitions/session.steps.ts` (terminal reload When 131-150) | exact |
| `features/hook/{async,stop-failure,compaction}.feature` (NEW, seed only) | feature (seed) | — | `features/hook/session.feature` | exact |
| `features/plugin/{state-migration,config-migration,model-tools,subagent-child}.feature` (NEW, seed only) | feature (seed) | — | `features/plugin/bootstrap.feature` (header + one scenario) | role-match |
| `features/marketplace/device-flow.feature` (NEW, seed only) | feature (seed) | — | `features/marketplace/github-source.feature` | role-match |
| `features/mcp-server/legacy-move.feature` (NEW, seed only, `@mcp`) | feature (seed) | — | `features/mcp-server/implementation-profiles.feature` (seed file of the last milestone) | role-match |
| `features/marketplace/state-lock.feature`, `features/plugin/{browse,bootstrap}.feature` (CHANGED: add a seed) | feature | — | themselves | exact |
| `.agents/skills/cucumber/rules/layout.md` (CHANGED: "Behavioral gaps" section) | doc (rules) | — | its "MCP built-in" section (lines 82-127) | exact |
| `.agents/skills/cucumber/rules/world-and-stand-ins.md` (CHANGED: new stand-ins) | doc (rules) | — | itself | exact |
| `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md` (NEW) | doc | — | `.planning/milestones/component-features-CHILD-SESSION-BRIEF.md` | exact |
| `.planning/DUBIOUS-CHOICES.md`, `.planning/phases/01-foundation/DUBIOUS-CHOICES.md` (NEW) | record | — | none in tree (archived root log at `.planning/milestones/mcp-builtin-DUBIOUS-CHOICES.md` per layout.md:125) | partial |
| REQUIREMENTS.md / ROADMAP.md / PROJECT.md wording (D-BG-04, D-BG-16) | doc | — | — | n/a (text edits) |

## Pattern Assignments

### `features/lib/github-device-flow/extension.ts` (harness Pi extension, in-process redirect)

**Analog:** `features/lib/pi-launch-environment.ts` (whole file, 84 lines) for the config-file-from-HOME + jsonl-log shape; `features/lib/builtin-mcp-stand-in/extension.ts` lines 1-57 for the "never throws, every decision is a JSON log line" contract.

**Config hand-off and exported path** (pi-launch-environment.ts lines 17-28, 49-57):
```typescript
import { appendFileSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { harnessDirectory } from "./turn-records.ts";

/** The absolute path of this file, which a profile Pi loads as an extension. */
export const PI_LAUNCH_ENVIRONMENT_EXTENSION = fileURLToPath(import.meta.url);

const VARIABLES_FILE = "pi-launch-environment.json";
const LOG_FILE = "pi-launch-environment.jsonl";
...
export async function writeLaunchEnvironment(home: string, variables: ...): Promise<string> {
  const file = path.join(home, VARIABLES_FILE);
  await mkdir(home, { recursive: true });
  await writeFile(file, `${JSON.stringify(variables)}\n`, { flag: "wx" });
  return file;
}
```
Note: the new extension sits one directory deeper, so its turn-records import is `../turn-records.ts` (as `builtin-mcp-stand-in/extension.ts:40` does).

**Default export with fallow marker** (pi-launch-environment.ts lines 74-84):
```typescript
// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function launchEnvironment(): void {
  const home = process.env.HOME;
  if (home === undefined || home === "") {
    throw new Error("the launch environment needs HOME to find its file");
  }
  const variables = parseVariables(readFileSync(path.join(home, VARIABLES_FILE), "utf8"));
  Object.assign(process.env, variables);
  appendFileSync(path.join(harnessDirectory(home), LOG_FILE), `${JSON.stringify(variables)}\n`);
}
```
Apply: read `{home}/harness/...json` (git host port, stand-in port), replace `https.request`/`https.get`/`http.request`/`http.get`/`globalThis.fetch`, log each decision to `{home}/harness/github-redirect.jsonl` synchronously (`appendFileSync`, since the patched request is synchronous). Redirect rule and fail-closed list: RESEARCH Q5(b) lines 184-186.

**Decision union for log lines** (builtin-mcp-stand-in/extension.ts lines 49-57):
```typescript
type Decision =
  | { readonly decision: "registered"; readonly name: string }
  | { readonly decision: "skipped"; readonly name: string; readonly reason: string }
  | { readonly decision: "failed"; readonly name?: string; readonly error: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```
Copy as `routed` / `refused` decisions with the original URL and the routed-to address.

**Import ordering for a Pi type** (builtin-mcp-stand-in/extension.ts line 45): `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";` last, after sibling imports.

---

### `features/lib/github-device-flow/server.ts` (loopback HTTPS stand-in)

**Analog:** `features/lib/https-git-host/server.ts`

- Arm union to copy for the poll script (line 77): `| { readonly kind: "credential"; readonly user: string; readonly password: string }` -- the device flow script becomes a closed union of `authorization_pending` / `authorized` / `access_denied` / `expired_token` steps.
- Request record and log types: `GitHostRequest` (line 94), `RequestWindow` (106), `GitHostTraffic` (112), `GitHostSnapshot` (118) -- copy the request-record shape and add the form body.
- Certificate: the git host writes `key.pem`/`cert.pem` under its root (50-52) and reads them at 375-376; it exposes `readonly certificatePath` (337, set at 354). Add a sibling `readonly keyPath` set beside line 354, and have the Device Flow server read both files rather than run `openssl` again (RESEARCH Pitfall 6, DC-B).
- Credential arm check (263-270) is what accepts `x-access-token:<fixed token>`; the stand-in issues that token.
- Product contract the server must satisfy: response fields `device_code`, `user_code`, `verification_uri`, `expires_in`, `interval` (RESEARCH Q5(a), `domain/github-auth.ts:195-206`); answer `interval: 0`; never `slow_down`.
- Pid file and log location: `{home}/harness/<name>.jsonl`, `<name>-<pid>.pid` (cucumber rules; checked by `assertStandInsStopped` in `turn-records.ts:99-114`).

---

### `features/lib/scripted-model/script.ts` (schema + table parser)

**Analog:** itself.

**Schema to extend** (lines 21-39):
```typescript
export type ScriptStep =
  | { readonly reply: string }
  | { readonly tool: string; readonly arguments: Readonly<Record<string, unknown>> };
...
const SCRIPT_VALIDATOR = Compile(
  Type.Array(
    Type.Union([
      Type.Object({ reply: Type.String() }, { additionalProperties: false }),
      Type.Object(
        { tool: Type.String(), arguments: Type.Record(Type.String(), Type.Unknown()) },
        { additionalProperties: false },
      ),
    ]),
  ),
);
```
Add arms: `{ error: string; stopReason?: "error" | "length" }` and an optional `contextTokens: number` on the reply arm (names from RESEARCH Q2 line 150).

**Column set and header check** (lines 56, 68-81):
```typescript
const SCRIPT_COLUMNS: ReadonlySet<string> = new Set(["reply", "tool", "arguments"]);
...
function checkScriptHeader(header: readonly string[]): void {
  const unknown = header.filter((column) => !SCRIPT_COLUMNS.has(column));
  if (unknown.length > 0) { throw new Error(`unknown model script column: ${unknown.join(", ")}`); }
  if (!header.includes("reply")) { throw new Error("the model script has no reply column"); }
  if (header.includes("tool") !== header.includes("arguments")) { ... }
}
```
Add `error`, `stop reason`, `context tokens`; keep the `reply` requirement (every existing table must stay valid).

**Row parser pattern** (lines 93-119): one `cell(column)` accessor, empty-string meaning absent, each row shape validated with a row-numbered error message. Keep `parseScriptRow` under cognitive complexity 15 (both ESLint sonarjs and fallow health) -- split per-arm helpers if needed.

---

### `features/lib/scripted-model/extension.ts` (faux provider player)

**Analog:** itself.

**Step player** (lines 125-153) -- add the `error` arm beside `reply`/`tool`:
```typescript
  if ("reply" in step) {
    return fauxAssistantMessage([fauxText(step.reply)]);
  }
  const toolArguments = step.arguments as Parameters<typeof fauxToolCall>[1];
  return fauxAssistantMessage([fauxToolCall(step.tool, toolArguments)], {
    stopReason: "toolUse",
  });
```
Error arm: `fauxAssistantMessage([], { stopReason: step.stopReason ?? "error", errorMessage: step.error })` (options verified at RESEARCH Q1 line 132).

**Provider registration** (lines 155-185) -- the usage patch wraps `faux.streamSimple` at the `streamSimple:` property (line 175) with `createAssistantMessageEventStream` from `@earendil-works/pi-ai` (RESEARCH "Pattern: patching usage after the faux core", lines 320-339). The hand-off between `playNextStep` and the wrapper must be per call, not module state (module header lines 6-14: the model keeps no count in memory; a child agent's Pi plays the same script).

---

### `features/lib/state-lock-holder.ts` (stale lock writer)

**Analog:** itself. New function goes beside `holdStateLock` (56-84) and reuses `isStateLockHeld` (87-89):
```typescript
export function isStateLockHeld(extensionRoot: string, lockFile: string): Promise<boolean> {
  return lockfile.check(extensionRoot, { lockfilePath: lockFile, realpath: false, stale: 10_000 });
}
```
The file header (lines 1-11) already explains that a hand-made lock directory goes stale after ten seconds; the new writer turns that into the fixture (`mkdir` empty dir, `utimes` 60 s back, assert `isStateLockHeld` false). Update the header paragraph accordingly. Code shape: RESEARCH "Stale lock writer" lines 398-407.

**Step analog** `features/step_definitions/scope-state.steps.ts` lines 15-24:
```typescript
Given(
  "another process holds the state lock of the {word} scope",
  async function (this: ScenarioWorld, scope: string) {
    const extensionRoot = path.join(this.scopeRoot(scope), "pi-claude-marketplace");
    const lockFile = path.join(extensionRoot, ".state-lock");
    this.onRelease(await holdStateLock(extensionRoot, lockFile));
    assert.equal(await isStateLockHeld(extensionRoot, lockFile), true);
  },
);
```
Copy for e.g. `a dead process left a stale state lock of the {word} scope`.

**Seed analog:** `features/marketplace/state-lock.feature` scenarios (Given publish -> Given add -> Given lock -> When command -> Then result fields / record / config). The stale seed uses the same Then steps, with an `info` outcome.

---

### `features/lib/earlier-version-state.ts` (earlier-release fixture writers)

**Analog:** itself (lines 1-60 read).

**Helpers to reuse** (lines 20-44):
```typescript
const STATE_SCHEMA_VERSION = 3;
function stateFilePath(scopeRoot: string): string {
  return path.join(scopeRoot, "pi-claude-marketplace", "state.json");
}
function jsonObject(value: unknown, what: string): Record<string, unknown> { ... }
async function readObject(file: string): Promise<Record<string, unknown>> { ... }
function objectMember(holder: Record<string, unknown>, member: string): Record<string, unknown> { ... }
```
**Export signature style** (lines 52-58): one `args` object with readonly fields, explicit `Promise<...>` return type, doc comment naming what earlier version wrote. Each new writer's doc comment must name the release and the commit that ended the shape (v0.6.0 / `222a7344`; v0.19.2 / `8b6ac3bc`; v0.4.3 / `5f1d0c57`; mcp.json v0.19.2 / `94160614`) -- RESEARCH Q9 lines 222-229.

**Record-member-dropping analog:** `features/lib/mcp-builtin-earlier-record.ts` (30 lines; drops `mcpServerConfigs`/`mcpBundle` through `installation-record.ts`). Use the same approach to drop `enabled`/`provenance`.

---

### `features/lib/hook-files.ts` + `features/lib/hook-recorder.ts` (async hook fixtures)

**Analog:** itself. Header doc (lines 25-60) lists every script column with its meaning; add the new columns in the same bullet style. Add fields to `RecordingHook` (77-96) and to `BEHAVIOR_FIELDS` (107-116) for script-only behavior (`waits`, `exit code` already exists), and handler fields (`async rewake` -> `asyncRewake`, `rewake message`, `rewake summary`, `async`) beside `timeout`/`if`/`on failure`/`once`.

**Marker-wait precedent** (header lines 49-52): `meets` creates `$HOME/hook-meetings/<name>` and waits on another file -- copy for `waits` on `$HOME/hook-releases/<name>`.

**Lifecycle log:** jsonl under `{home}/harness/` like `pi-launch-environment.ts` (line 83) and a `hook-<name>-<pid>.pid` file so `assertStandInsStopped` catches a leaked hook.

**Step analog** `features/step_definitions/hook/session.steps.ts`:
- compaction Given (line 46): `const COMPACTION_SETTINGS = \`${JSON.stringify({ compaction: { keepRecentTokens: 1 } })}\n\`;` -- reused by the compaction seed, not duplicated.
- `recordSessionAction` (81-98) -- copy for the "release the hook and wait for its end" When: `readLogLengths` -> act -> `recordsSince` -> `faultsOf` empty -> `readLogLinesSince` -> no overflowing calls -> `world.recordTurn(...)`.

---

### `test/e2e/_rpc.ts` (launch plumbing)

**Analog:** itself.

**Optional variable pattern already in the file** (lines 61-66 and 238-241):
```typescript
  readonly PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS?: string;
...
    if (git.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS !== undefined) {
      environment.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS =
        git.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS;
    }
```
Make `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` optional the same way (line 60, set at 237); add `PI_SUBAGENT_CHILD?: "1"` to `RpcProfileEnvironment` (lines 70-72) and copy it in the `profileEnvironment` block (243-245). Under `exactOptionalPropertyTypes`, build objects with conditional spreads rather than `key: undefined`.

**Mode switch** (`piArguments`, lines 256-268): widen `mode: "rpc" | "tui"` to include `"json"` and emit `["--mode", "json"]`.

---

### `features/support/world.ts` (launch options)

**Analog:** itself.
- `PiProfile` (129-133): add optional launch members (e.g. `githubBase?: "unset"`, `subagentChild?: true`), documented in the interface comment above it.
- `usePiWithGitHubBaseUrl` (578-583) and `usePiWithBackgroundUpdateDelay` (592-599) show how a variant spreads `currentRun().piEnvironment` and sets `this.tuiEnvironment` so a later terminal session shares it -- the Device Flow variant must set `tuiEnvironment` too (DFLOW-04, RESEARCH Q5(c)).
- `usePiWithProfile` (618-642) prepares `TMPDIR` and the `jiti-cache` symlink; the json driver needs the same preparation (RESEARCH Q6 requirement 1) -- factor or reuse, do not duplicate (fallow dupes).
- `startProfilePi` (917-960): `PiProcess.start(sandbox, piEnvironment, { extensions: [...], environment: { TMPDIR }, ... })` is where the child marker and the extra extension enter.

---

### `features/lib/pi-process.ts` (`crash()`)

**Analog:** `stop()` lines 235-258:
```typescript
  async stop(): Promise<void> {
    if (this.stopped) { return; }
    this.stopped = true;
    if (!this.exited) { ... this.child.stdin.end(); ... await Promise.race([exit, grace]); ... }
    killProcessGroup(this.child);
  }
```
`crash()` sets `stopped`, sends `SIGKILL` to `this.child` only (not the group), and awaits `exit`. Keep the "second call does nothing" guard.

---

### `features/lib/pi-commands.ts` (export payload validation) and `features/lib/pi-json-mode.ts` (NEW)

**Analog to export** (pi-commands.ts lines 99-112):
```typescript
function claudePluginPayloads(
  entries: ReadonlyArray<{ readonly customType?: string; readonly data?: unknown }>,
): NotificationPayload[] {
  return entries
    .filter((entry) => entry.customType === "claude-plugin")
    .map(({ data: payload }) => {
      assert.ok(PAYLOAD_VALIDATOR.Check(payload), JSON.stringify(PAYLOAD_VALIDATOR.Errors(payload)));
      return payload;
    });
}
```
Add `export` and an explicit return type (already present). The json driver maps each stdout line `{"type":"entry_appended","entry":{...}}` to its `entry` and passes them through this function.

**Spawn + line reading + timeout analog** (state-lock-holder.ts lines 36-47, 60-71): `spawn(process.execPath, [...])`, `createInterface({ input: child.stdout })`, the `within(promise, ms)` race with a `TIMED_OUT` symbol, `SIGKILL` on timeout. For json mode use `stdio: ["ignore", "pipe", "pipe"]` (Pitfall 4) and `--provider faux --model faux-1`.

---

### `features/lib/plugin-picker.ts` (NEW picker driver)

**Analog:** `features/lib/pi-tui.ts` (`PiTuiSession`: `markOutput`, `waitForTextAfter`, `typeText`, `waitForQuiet`, `stop`; lines 190-320 per RESEARCH Q7). A library registers nothing; it takes a `PiTuiSession` and returns rows. Started from steps through `this.startTuiSession(...)` as in `features/step_definitions/session.steps.ts` lines 131-150. Picker titles and row labels to anchor on: RESEARCH Q7 line 204.

---

### Step modules (shared)

**Analog for a Given that starts a per-scenario Pi** (`features/step_definitions/git-host.steps.ts` lines 161-166):
```typescript
Given(
  "pi runs with the github base address {string}",
  async function (this: ScenarioWorld, value: string): Promise<void> {
    await this.usePiWithGitHubBaseUrl(value);
  },
);
```
**Analog for a sandbox git config Given** (same file, 170-187): write `{home}/.gitconfig` with `{ flag: "wx" }`, `this.onRelease(() => rm(...))`, then `assert.deepStrictEqual` the read-back. The new "credential store only" Given is this minus the `.git-credentials` write.

**Model call read-back:** `Then("the model receives these calls:", ...)` at `features/step_definitions/model.steps.ts:97` already renders tool results (`<tool> returned: <text>`); D-BG-08 needs no new step (RESEARCH Q10).

---

### Seed feature files

**Analog:** `features/plugin/bootstrap.feature` lines 1-12 (title = `<Function> <capability>`, a description paragraph naming the stand-ins, a sentence-case scenario title, `Given`/`When`/`Then` only):
```gherkin
Feature: Plugin bootstrap

  Bootstrap adds Claude Code's official marketplace to the user scope, where its
  autoupdate is on by default. A loopback https git host stands in for GitHub and
  serves the official marketplace through the GitHub base override.

  Scenario: Bootstrapping adds the official marketplace to the user scope with its autoupdate on by default
    Given the marketplace "claude-plugins-official" is published as the official marketplace
    When the user runs "/claude:plugin bootstrap"
    Then the command reports these results:
```
Titles required by `scripts/check-features.mjs`: `Hook async`, `Hook stop failure`, `Hook compaction`, `Plugin state migration`, `Plugin config migration`, `Plugin model tools`, `Plugin subagent child`, `Marketplace device flow`, `MCP server legacy move` (RESEARCH Q11). Only `legacy-move` carries `@mcp`; keep the word `mcp` out of other seeds' step text (check-features MCP rule).

---

### `.agents/skills/cucumber/rules/layout.md` ("Behavioral gaps" section)

**Analog:** its own "MCP built-in" section, lines 82-127: intro paragraph, `### Frozen after Phase 1` bullet list (build/CI, harness, skill, seed features, product), `### What each phase owns` table (Phase | Owns product | Owns tests and features | Must not touch), `### Reserved names`, `### Parent-owned files`. Copy the structure; add the per-stream list of frozen seed steps that each stream must keep in use (RESEARCH Q11 last bullet, Pitfall 7).

### `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md`

**Analog:** `.planning/milestones/component-features-CHILD-SESSION-BRIEF.md` (and `mcp-builtin-CHILD-SESSION-BRIEF.md`), updated for local branches and no push (D-BG-16).

## Shared Patterns

### Harness directory and logs
**Source:** `features/lib/turn-records.ts` (`harnessDirectory`, `assertStandInsStopped` 99-114), used at `pi-launch-environment.ts:22,83` and `scripted-model/extension.ts:26,126`.
**Apply to:** every new stand-in, extension, and hook lifecycle log: one JSON line per event in `{home}/harness/<name>.jsonl`; pid files `<name>-<pid>.pid`.

### Cleanup through `onRelease`
**Source:** `scope-state.steps.ts:21`, `git-host.steps.ts:176-179`, `world.ts` `startProfilePi` release.
**Apply to:** every Given that starts a process or writes outside the emptied sandbox.

### Libraries register nothing; harness extensions are default exports
**Source:** `pi-launch-environment.ts:74-75`; cucumber rules. Each new `--extension` file carries `// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.` (bump the 47-marker count in `.planning/codebase/CONVENTIONS.md` or note it).

### Typebox validation of harness files
**Source:** `scripted-model/script.ts:29-51` (`Compile(Type...)`, `Type.Static`).
**Apply to:** Device Flow script/config, redirect config, lifecycle log reading.

### Upstream text
**Source:** `features/lib/upstream/index.ts` (imported by `script.ts:19`). Pi's tool-argument validation text gets a projector there, never a literal in a feature.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| in-process `https.request`/`fetch` patch inside `github-device-flow/extension.ts` | harness extension | interception | No existing harness code patches Node builtins; follow RESEARCH Q5(b) and the "Pattern: a harness Pi extension" sketch (lines 305-318) |
| `.planning/DUBIOUS-CHOICES.md` (root log) | record | — | No live root log in the tree; the last milestone's was archived to `.planning/milestones/mcp-builtin-DUBIOUS-CHOICES.md` -- use it as a format reference if present |

## Metadata

**Analog search scope:** `features/lib/**`, `features/support/world.ts`, `features/step_definitions/**`, `features/{hook,plugin,marketplace,mcp-server}/*.feature`, `test/e2e/_rpc.ts`, `.agents/skills/cucumber/rules/*`, `.planning/milestones/*BRIEF*`
**Files scanned:** ~25 read in part or whole
**Pattern extraction date:** 2026-11-07
