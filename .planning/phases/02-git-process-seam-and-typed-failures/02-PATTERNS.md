# Phase 2: Git Process Seam and Typed Failures - Pattern Map

**Mapped:** 2026-11-23
**Files analyzed:** 20
**Analogs found:** 19 / 20

All paths below are relative to the repo root; `E/` = `extensions/pi-claude-marketplace/`. All analogs are git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `E/platform/process-run.ts` (NEW) | utility (launcher, spawn injected) | request-response (subprocess) | `E/platform/package-manager.ts` lines 146-410 (MOVE, not copy) | exact |
| `E/platform/package-manager.ts` (MOD, thinner) | service | subprocess | itself; keeps `NODE_PACKAGE_MANAGER_SPAWN` (:81), env `npm_config_update_notifier` (:351), `windowsLaunch` npm-cli.js (:412-444) | exact |
| `E/platform/git-process.ts` (NEW) | service (git lookup, env/argv builder, lanes, run) | subprocess | `E/platform/package-manager.ts` (`createPackageManagerRunner` :466, `NODE_PACKAGE_MANAGER_SPAWN` :81, `findOnWindowsPath` :394) | role-match |
| `E/platform/git-failure-kind.ts` (NEW) | utility (pure classifier) | transform | `E/shared/git-failure-classifiers.ts` `classifyGitFailure` :161-207 | role-match |
| `E/platform/git-credential.ts` (MOD) | service | subprocess, stdin-fed | itself `gitCredentialIO` :143-187 (to be rewired onto GitProcess) | exact |
| `E/platform/git.ts` (MOD) | service | network gate | its own network verbs `clone` :566, `fetch` :612, `resolveRemoteRef` :687, `listRemoteTags` :758 | exact |
| `E/shared/errors.ts` (MOD: `GitCommandError`, `GitFailureKind`) | model (error) | - | `PluginShapeError` :1218-1273 | exact |
| `E/shared/git-failure-classifiers.ts` (MOD: instanceof rung) | utility | transform | `PinnedCommitMissingError` rung in `classifyGitFailure` :186-188 | exact |
| `E/shared/notification-types.ts` (MOD: new reason token) | config (closed set) | - | existing reason union; locked by `test/architecture/notify-closed-set-locks.test.ts` | exact |
| redactor in `E/shared/` (NEW or in `redact-absolute-paths.ts`) | utility | transform | `E/shared/redact-absolute-paths.ts` | role-match |
| `rule-packs/architecture.json` (MOD) | config (gate) | - | `child-process-chokepoint` :111-123 | exact |
| `eslint.config.js` (MOD: GIT_PROCESS_IMPORTERS zone) | config (gate) | - | `PACKAGE_INSTALL_SEAM` :31-36 and its BLOCK C zone | exact |
| `test/architecture/gate-targets.ts` (MOD) | test support | - | `SHELL_OUT_EXEMPT_TARGETS` :209-227; `CREDENTIAL_LEAK_TARGETS` :152-171 | exact |
| `test/architecture/no-shell-out.test.ts` (MOD) | test | - | its package-runner import-gate table :14-57, `expectedFiles` :210-216 | exact |
| `test/architecture/no-credential-leak.test.ts` (MOD) | test | - | its destructure :78-91 / `DECLARED_MODULE_ORDER` :96-109 | exact |
| `test/platform/process-run.test.ts` (NEW, cases MOVED) | test | - | `test/platform/package-manager.test.ts` :1-1189 (fake process control, :122-1189) | exact |
| `test/platform/git-process.test.ts` (NEW) | test | - | `test/platform/package-manager.test.ts` fake spawn + `hermetic-environment.ts` | role-match |
| `test/platform/git-failure-kind.test.ts` (NEW) | test (table corpus) | - | `test/shared/git-failure-classifiers.test.ts` | role-match |
| `test/platform/git-credential.test.ts` (MOD) + `test/platform/credential-ops-contract.ts` | test | - | themselves | exact |
| `features/support/world.ts` `usePiWithoutGit()` + `features/**/*.feature` no-git scenarios | test (cucumber) | - | `usePiWithGitHubBaseUrl` world.ts :688-693 over `usePiWith` :1160-1164 | exact |

## Pattern Assignments

### `E/platform/process-run.ts` (NEW, extracted launcher)

**Analog:** `E/platform/package-manager.ts`. Move `appendCapped`/`finishOutput` (:161-169), `KillTimers`/`startKillTimers` (:171-220), `watchProcess` (:222-285), `variable` (:287), `ignoreKillError`, `killWindowsTree` (:297-311), `stopTree` (:313-336), `notStarted`/`aborted` (:378-385), `windowsPathDirectories`/`findOnWindowsPath` (:387-410), and the Process/SpawnOptions/Host interfaces (:47-133). Must import nothing from `node:child_process` (no-shell-out regex matches type-only imports too, `no-shell-out.test.ts:154`). Copy the D-PL9-19 header comment (package-manager.ts :1-19) with it.

Spawn contract to keep (:60-81):
```ts
export interface PackageManagerSpawnOptions {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly shell: false;
  readonly stdio: readonly ["ignore", "pipe", "pipe"];
  readonly detached: boolean;
}
export type PackageManagerSpawn = (command: string, args: readonly string[], options: PackageManagerSpawnOptions) => PackageManagerProcess;
```
Git credential needs stdin `"pipe"` (input then EOF), so generalize `stdio[0]` to `"ignore" | "pipe"` and add `windowsHide`.

Group-kill core (:313-336):
```ts
function stopTree(child, signal, options, spawnOptions): void {
  const { pid } = child;
  if (pid === undefined || !Number.isSafeInteger(pid) || pid <= 1) { child.kill(signal); return; }
  if (options.host.platform === "win32") { killWindowsTree(pid, options, spawnOptions); return; }
  try { options.host.signalGroup(pid, signal); } catch { child.kill(signal); }
}
```
Windows lookup (:394-410), loop-await disable comment is the precedent:
```ts
for (const directory of windowsPathDirectories(env)) {
  for (const extension of [".exe", ".cmd"]) {
    const candidate = path.win32.join(directory, `${command}${extension}`);
    // eslint-disable-next-line no-await-in-loop -- PATH order decides which file runs
    if (await host.isFile(candidate)) { return candidate; }
  }
}
```
For git, parameterize the extension list (`.exe` only; D-SG-04 refuses `.cmd`/`.bat`) and add cwd-refusal.

### `E/platform/git-process.ts` (NEW)

**Analog:** `package-manager.ts` factory and binding.
```ts
export const NODE_PACKAGE_MANAGER_SPAWN = spawn as PackageManagerSpawn;   // :81 -> NODE_GIT_SPAWN
export function createPackageManagerRunner(options): PackageManagerRunner {  // :466
  return (request) => runPackageManager(options, request);
}
```
`startProcess` (:338-376) is the shape for the per-run spawn: abort precheck, `try { spawn } catch → notStarted(error as Error)`, `detached: platform !== "win32"`, `env: { ...options.env, ...request.env }`. For git, the base env is an injected parameter defaulting to `process.env` (CONTEXT, hermeticity); the lookup cache lives in the factory instance, not at module level (RESEARCH anti-pattern). Never-reject run result `{ code, stdout, stderr, timedOut, error }` then mapped to `GitCommandError` via `git-failure-kind.ts`.

### `E/platform/git-failure-kind.ts` (NEW, pure)

**Analog:** ordered-rung style of `classifyGitFailure` (`E/shared/git-failure-classifiers.ts:161-207`); implement as a data table per RESEARCH Code Examples (`readonly [GitFailureKind, RegExp][]`, first match wins) so both complexity gates stay flat.

### `E/platform/git-credential.ts` (MOD)

Current launch to replace (:143-187):
```ts
const child = spawnProcess("git", ["credential", subcommand], {
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
  stdio: ["pipe", "pipe", "pipe"],
});
...
child.stdin.on("error", () => {});   // EPIPE swallow -- keep this behavior in the new runner
child.stdin.write(input);
child.stdin.end();
```
Replace `CredentialSpawn` dep with a `GitProcess` collaborator; keep `buildAttributeBlock`/`parseCredentialOutput`/`sanitizeAttrValue` (:189+) untouched. Remove its `node:child_process` import. `orchestrators/auth-host.ts:78-81` keeps composing through git-credential's exported production binding (BLOCK C forbids it to import git-process).

### `E/platform/git.ts` (MOD)

Add `await gitProcess.locate()` at the top of `clone` (:566), `fetch` (:612), `resolveRemoteRef` (:687), `listRemoteTags` (:758) only. Do not gate local verbs (`marketplace-tag-probe.ts` uses `listTags`/`resolveTagOid` on path sources). Update header lines :23-24 (the "no git not found failure mode" claim).

### `E/shared/errors.ts` (MOD: `GitCommandError`)

**Analog:** `PluginShapeError` (:1218-1242):
```ts
export class PluginShapeError extends Error {
  readonly shape: PluginShapeErrorShape;
  readonly kind: PluginShapeErrorKind;
  readonly plugin: string;
  constructor(shape: PluginShapeErrorShape, options?: ErrorOptions) {
    super(buildPluginShapeMessage(shape), options);
    this.name = "PluginShapeError";
    this.shape = shape;
    this.kind = shape.kind;
    this.plugin = shape.plugin;
  }
}
function buildPluginShapeMessage(shape): string { switch (shape.kind) { ... } }  // :1244
```
`GitCommandError` mirrors: `failure: GitFailure` union, `kind = failure.kind`, message built by switch (stderr not in message except `git-missing` requirement text), redacted stderr stored as a field, `{ cause }` passed through.

### `E/shared/git-failure-classifiers.ts` (MOD)

Insert the new rung alongside the existing typed rung (:186-188):
```ts
if (error instanceof PinnedCommitMissingError) {
  return { reason: "source missing" };
}
```
→ add `if (error instanceof GitCommandError) { return reasonOfGitFailure(error.failure, rule); }` with exhaustive switch + `assertNever`. Callers `classifyGitHostFailure` (:212) and `classifyGitSourceAccessFailure` (:228) inherit it. Note the return-type union (:168-172) must grow if the new token is added.

### Gate files (one commit)

`rule-packs/architecture.json` :111-123 -- replace first `exclude` entry:
```json
"exclude": [
  "extensions/pi-claude-marketplace/platform/git-credential.ts",   // -> platform/git-process.ts
  "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts",
  "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts",
  "extensions/pi-claude-marketplace/platform/package-manager.ts",
  "extensions/pi-claude-marketplace/platform/prompt-shell.ts"
],
"message": "D-21 / D-PL9-11 / D-CF1-02: only the five sanctioned spawn sites ..."   // rewrite citing D-SG-01
```
`test/architecture/gate-targets.ts` :209-227 `SHELL_OUT_EXEMPT_TARGETS` -- same swap plus doc comment ("`git-credential.ts` runs the credential helper" -> git-process). `CREDENTIAL_LEAK_TARGETS` :152-171 positional; append git-process last and edit `no-credential-leak.test.ts` together.

`eslint.config.js` :31-36 analog:
```js
/**
 * D-PL9-10 / PKD-03: the only module that may import platform/package-manager.ts. ...
 */
const PACKAGE_INSTALL_SEAM =
  "./extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts";
```
Add `GIT_PROCESS_IMPORTERS = [platform/git.ts, platform/git-credential.ts]` with a D-SG-01 comment and a composed BLOCK C zone. Pitfall 3: flat-config option replacement drops a zone -- compose both zones in every block's `zones` array; the no-shell-out computed-config rows catch it. BLOCK F needs no change (`regex: "platform/git"` at :578 already covers the new files).

### Tests

`test/platform/process-run.test.ts`: move (not copy) cases from `test/platform/package-manager.test.ts` :122-1189 plus the fake-process helper `createPackageManagerProcess` (:31+). Import style (package-manager.test.ts :1-21):
```ts
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { NODE_PACKAGE_MANAGER_HOST, NODE_PACKAGE_MANAGER_SPAWN, createPackageManagerRunner } from "../../extensions/pi-claude-marketplace/platform/package-manager.ts";

import { createHermeticEnvironment } from "./hermetic-environment.ts";

import type { PackageManagerHost, PackageManagerProcess, ... } from "../../extensions/pi-claude-marketplace/platform/package-manager.ts";
```
`git-process.test.ts`: same fake-spawn control; real-git cases use `hermeticGitEnvironment`-built base env. A shared fake helper should be a `*-fake.ts` (e.g. `test/platform/process-fake.ts`) to avoid dupes between process-run and git-process tests.

### `features/support/world.ts` `usePiWithoutGit()`

Analog (:688-693 over :1160-1164):
```ts
async usePiWithGitHubBaseUrl(value: string): Promise<void> {
  await this.usePiWith({
    ...currentRun().piEnvironment,
    PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: value,
  });
}
```
→ `PATH: <empty dir or SSH stand-in binDirectory>`. Scenarios list in RESEARCH Pattern 7 (git-source add fails, git-source plugin install fails, path-source and hosted still succeed, askpass not run).

## Shared Patterns

- **Typed error:** `PluginShapeError` shape (`E/shared/errors.ts:1218-1273`); narrow by `instanceof` + `kind`, never message.
- **Never-reject run result + injected spawn/host/env:** `package-manager.ts` (`notStarted` :378, factory :466). Apply to process-run, git-process.
- **Gate trio edited together:** rule pack + `gate-targets.ts` + `no-shell-out.test.ts` (+ eslint zone, + credential-leak list).
- **Output:** no stdio inheritance; spawn with piped stdio only (IL-2).
- **Loops with await:** reasoned `eslint-disable-next-line no-await-in-loop` (package-manager.ts :402).

## No Analog Found

| File | Role | Reason |
|---|---|---|
| git env/argv hardening builder inside `git-process.ts` (D-SG-02 lane, D-SG-05 `-c` list) | utility | No existing env builder of this size; use exact lists from `02-EVIDENCE.md` Q11/Q14 and RESEARCH Pattern 2 |

## Metadata

**Analog search scope:** `E/platform/`, `E/shared/`, `test/platform/`, `test/architecture/`, `rule-packs/`, `eslint.config.js`, `features/support/`
**Files scanned:** ~14
**Pattern extraction date:** 2026-11-23
