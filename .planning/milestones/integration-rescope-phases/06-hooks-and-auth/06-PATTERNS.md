# Phase 6: Hooks and Auth - Pattern Map

**Mapped:** 2026-11-22
**Files analyzed:** 16 (1 new lib, 6 modified harness/steps, 4 feature files, 2 trimmed integration files, 2 deleted integration files, SUMMARY convention)
**Analogs found:** 16 / 16 (all analogs are git-tracked)

## File Classification

| New/Modified File | Plan | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|---|
| `features/lib/pi-one-shot.ts` (NEW) | 06-02 | test harness lib | process spawn / request-response | `features/lib/pi-json-mode.ts` (whole file, 130 lines) | exact (absorbs it) |
| `features/lib/pi-json-mode.ts` | 06-02 | test harness lib | transform (stdout -> payloads) | itself; delegates spawn to `runOneShotPi` | self |
| `features/support/world.ts` | 06-02 | cucumber world | state | `OneShotPiLaunch` `:219-224`, `oneShotPiLaunch()` `:783-787`, routed launch `:1115-1116`, `:967`/`:973` | exact |
| `features/step_definitions/command.steps.ts` | 06-02 | step defs | request-response | json-mode `When` `:130-145` | exact |
| `features/step_definitions/project.steps.ts` | 06-01 | step defs | file-I/O assert | its own `Given` `:21-27` | role |
| `features/lib/hook-files.ts` (F1 ESRCH) | 06-01 | harness lib | file-I/O (/proc) | `features/lib/subagent-hook-session.ts:299-314` (commit 2c7d42d) | exact |
| `features/lib/turn-records.ts` (F2 JSONL) | 06-01 | harness lib | file-I/O | `logLines` `:37-39` itself | self |
| `features/hook/lifecycle.feature`, `session.feature`, `additional-context.feature` | 06-01 | scenarios | behavioral | drafts in `research-06/final/`; existing steps table RESEARCH `:162-182` | exact |
| `features/marketplace/device-flow.feature` | 06-02 | scenarios | behavioral | existing `:10`, `:49`, `:231` scenarios in same file | exact |
| `test/integration/hooks-dispatch-end-to-end.test.ts` (trim to `:403`) | 06-01 | integration test | — | header: `test/integration/standalone-prune.test.ts:1-12` | exact |
| `test/integration/auth-e2e.test.ts` (trim to `:204`) | 06-02 | integration test | — | same header analog | exact |
| DELETE `test/integration/hooks-cross-scope-reconcile.test.ts`, `hooks-additionalcontext-end-to-end.test.ts` | 06-01 | — | — | Phase 5 Task 3 (`4628d21`, deleted `mcp-legacy-sweep.test.ts`) | exact |
| `06-0N-SUMMARY.md` red proofs | both | record | — | `.planning/phases/05-mcp-install-legacy-move-and-overrides/05-02-SUMMARY.md` `## Red proofs` (`:67-91`) | exact |

## Pattern Assignments

### `features/lib/pi-one-shot.ts` (NEW) -- analog `features/lib/pi-json-mode.ts`

Move unchanged from `pi-json-mode.ts` (a copy failed `fallow dupes`, `dup:077716d6`, 27 lines -- MOVE, do not copy):
- Imports `:11-21`: `spawn` (`node:child_process`), `once` (`node:events`), `fileURLToPath`; `killProcessGroup, piArguments, resolveRpcSandbox, rpcChildEnvironment` from `./pi-rpc.ts`; type imports `RpcGitEnvironment, RpcProfileEnvironment, RpcSandbox` last.
- Constants `:30-35`: `SCRIPTED_MODEL_EXTENSION`, `SCRIPTED_MODEL_ARGUMENTS`.
- Spawn + group kill + timeout `:83-120`:
```ts
const sandbox = await resolveRpcSandbox(launch.sandbox);
const child = spawn(process.execPath, [...args], {
  cwd: sandbox.cwd, detached: true,
  env: rpcChildEnvironment(sandbox, launch.git, launch.environment),
  stdio: ["ignore", "pipe", "pipe"],
});
// A second kill could reach an unrelated group that took the id.
let groupKilled = false;
const killGroup = (): void => { if (!groupKilled) { groupKilled = true; killProcessGroup(child); } };
onRelease(killGroup);
...
try { closed = await once(child, "close", { signal: AbortSignal.timeout(timeoutMs) }); }
catch (error) { throw new Error(`${command} in json mode failed or did not exit within ${timeoutMs} ms:\n${output.stderr}`, { cause: error }); }
finally { killGroup(); }
```
New shape (RESEARCH Code Examples `:251-274`): `OneShotLaunch { sandbox, git, environment, extensions }`, `OneShotOutput { exitCode, stdout, stderr }`, `oneShotArguments(mode, extensions, command)` (json: `piArguments("json", loaded)` + model args + command; print: `piArguments("tui", loaded)` + model args + `-p` + command), `runOneShotPi(launch, mode, command, onRelease, timeoutMs)`; error text uses `${mode} mode`. File header `@fileoverview` in the style of `pi-json-mode.ts:1-9`, citing D-BG-601/D-BG-1101. Full validated code: `research-06/intree-final.diff`.

### `features/lib/pi-json-mode.ts`
Keep `CUSTOM_ENTRY_RECORD`/`customEntries` (`:37-60`) and the exit/no-payload checks (`:122-130`); `runJsonModeCommand` calls `runOneShotPi(launch, "json", ...)` and checks `exitCode !== 0`. `JsonModeLaunch = OneShotLaunch`; `DEFAULT_JSON_MODE_MS` comment `:37-40` stays.

### `features/support/world.ts`
- `OneShotPiLaunch` (`:219-224`) gains `readonly extensions: readonly string[]`.
- `oneShotPiLaunch()` (`:783-787`) currently returns `{ sandbox, git: piEnvironment, environment: { TMPDIR } }`; change to `git: this.tuiEnvironment ?? piEnvironment, extensions: this.tuiExtensions` -- same fallback already used at `:967` and `:973`. Fields set by `keepTerminalSessionLocal` at `:1115-1116`.
- Add public `printModeRun: OneShotOutput | undefined = undefined`.

### `features/step_definitions/command.steps.ts`
Copy the json `When` (`:130-145`) shape: `await this.oneShotPiLaunch()`, `expandTokens(command, this.tokens)`, `(release) => { this.onRelease(release); }`. Add S1/S2/S3 exactly as RESEARCH `:276-288` (`PRINT_MODE_MS = 25_000`; `assert.deepStrictEqual(printModeOutput(this), { exitCode, stdout: "", stderr: \`${text}\n\` })`). Place beside json/terminal forms; update file header `:4` to mention print mode.

### `features/step_definitions/project.steps.ts`
Import order per `:12-19` (node builtins, blank, `@cucumber/cucumber`, blank, lib, blank, type). Add `readdir` to `node:fs/promises` and `Then` to the cucumber import:
```ts
Then("the project directory is empty", async function (this: ScenarioWorld) {
  assert.deepStrictEqual(await readdir(this.tokens.projectDir), []);
});
```

### `features/lib/hook-files.ts` (F1) -- analog 2c7d42d
Current `:679-685` catches only `ENOENT`. Analog comment style (`subagent-hook-session.ts:300-301`): "A process that exited but is not yet reaped still has its /proc entry, and reading its environ then fails with ESRCH instead of ENOENT." Change:
```ts
if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ESRCH")) {
  return false;
}
```
Own first commit of 06-01, commit message modelled on 2c7d42d (`test(hooks): ...`).

### `features/lib/turn-records.ts` (F2)
Current `:36-39` comment "A stand-in appends whole lines" + `split("\n")`. Replace body with `text.slice(0, text.lastIndexOf("\n") + 1).split("\n").filter(...)` and reword the comment (a half-written last line is not yet a record). Own commit.

### Feature files
- Hook drafts: `research-06/final/{lifecycle,session,additional-context}.feature`; landing lines `lifecycle.feature:70`, `:91`; `session.feature:567` (WR-05, uses S4); `additional-context.feature:230` (HOOK-E2E-04).
- Auth drafts: `research-06/final/device-flow.feature`; landing `:256`, `:287` (AUTH-07), `:327`, `:351` (D-BG-1101, print). Reuse steps from RESEARCH table `:162-182` (git-host, device-flow, scope-state, checkout steps); titles cite durable IDs in parentheses, as existing `device-flow.feature` scenarios do.

### Integration trims -- header analog `test/integration/standalone-prune.test.ts:1-12`
```ts
// test/integration/standalone-prune.test.ts
//
// Two cases of `/claude:plugin prune` through the registered command, kept
// for the calls that must not happen (ITSCOPE-01). ... Everything a
// user can see of prune is in `features/plugin/prune.feature`, ...
```
Write the same: path line, blank `//`, what is kept and why (internal: no-`cwd` host context / cleanup-failure fault injection, ITSCOPE-01), then which feature files cover the visible behavior. Helper keep/drop lists: RESEARCH `:157-158` (tsc `noUnusedLocals` is on).

### SUMMARY red proofs -- `05-02-SUMMARY.md:67-91`
Bullets: scratch folder `$D`, checkout `root=`, plan base sha, inputs checksum, break helper (`break.sh`, `[file, old, new]` triples, `git checkout -- extensions/` EXIT trap, `restored=clean`), then one bullet per break: `**ID** (\`file:line\`, \`-old\` / \`+new\`). <profile> \`N scenarios (P passed, F failed)\`, \`exit=1\`` and the failing step text. Breaks for this phase: RESEARCH `## Deliberate breaks` (`:432`). Include `## Threat Flags`.

## Shared Patterns
- **Release hand-off:** every spawned process registers its kill via `this.onRelease(...)` before waiting (`pi-json-mode.ts:98`, `command.steps.ts:140`).
- **Token expansion:** `expandTokens(command, this.tokens)` for every command string.
- **Error codes:** narrow with `error instanceof Error && "code" in error && error.code === ...`, rethrow otherwise.
- **Ordering of commits:** harness race fixes first, each its own commit; full adapter suite in at least two more runs.

## No Analog Found
None.

## Metadata
**Scope searched:** `features/lib`, `features/support`, `features/step_definitions`, `test/integration`, phase 05 SUMMARY, commit 2c7d42d.
