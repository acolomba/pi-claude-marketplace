# Phase 9: Plugin Package Dependencies - Pattern Map

**Mapped:** 2026-10-26
**Files analyzed:** 13
**Analogs found:** 13 / 13

Scope note: D-PL9-14 overrides D-PL9-09. No new `Reason`; `shared/notify-reasons.ts`, `notification-types.ts`, `notification-wire.ts`, the schema and the row composers are NOT touched. The note travels through `discoveryWarnings` (install) and `notes` (update). D-PL9-11 corrected by research: exempt the three real `child_process` importers plus `platform/package-manager.ts`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/platform/package-manager.ts` (new) | platform utility | subprocess request-response | `platform/git-credential.ts` | exact |
| `test/platform/package-manager.test.ts` (new) | test | subprocess | `test/platform/git-credential.test.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts` (new) | orchestrator helper + phase factory | file-I/O (work dir, rename) | `orchestrators/plugin/clone-cache.ts` (staging + promote) and `install-outcome.ts` phase objects | role-match |
| `test/orchestrators/plugin/package-install.test.ts` (new) | test | file-I/O | `test/orchestrators/plugin/clone-cache.test.ts` (real tmp dirs, injected ops) | role-match |
| `orchestrators/plugin/install-outcome.ts` (modify) | ledger | transaction | itself, lines 1520-1534 | exact |
| `orchestrators/plugin/materialize-latest.ts` (+ test) (modify) | runner | transform of outcome | itself, lines 63-155 | exact |
| `rule-packs/architecture.json` (modify) | config | n/a | `isomorphic-git-chokepoint` rule, lines 103-109 | exact |
| `eslint.config.js` BLOCK C (modify) | config | n/a | BLOCK C zones (390+), `NETWORK_SEAMS` (line 44) | exact |
| `test/architecture/no-shell-out.test.ts` (modify) | architecture test | n/a | itself | exact |
| `test/architecture/gate-targets.ts` (modify) | gate registry | n/a | `SHELL_OUT_EXEMPT_TARGETS` lines 204-217 | exact |
| `features/lib/npm-registry.ts` (new) | cucumber stand-in server | request-response (HTTP) | `features/lib/https-git-host/server.ts` | role-match |
| `features/plugin/package-dependencies.feature` (new) | behavior spec | n/a | `features/plugin/install-dependencies.feature` | role-match |
| `features/step_definitions/plugin/package-dependencies.steps.ts` (new) | step module | n/a | `features/step_definitions/git-host.steps.ts` (arm + `onRelease`) | role-match |

## Pattern Assignments

### `platform/package-manager.ts` (platform, subprocess)

**Analog:** `extensions/pi-claude-marketplace/platform/git-credential.ts`

Imports (line 51): `import { spawn } from "node:child_process";` then `../shared/*` imports, then `import type`.

Narrow process interface + typed spawn + live binding (lines ~93-130):
```ts
export interface CredentialProcess {
  readonly stdout: { on(event: "data", listener: (chunk: Buffer) => void): void; };
  kill(signal: "SIGTERM"): boolean;
  on(event: "error" | "close",
     listener: ((error: Error) => void) | ((code: number | null) => void)): void;
}
export type CredentialSpawn = (command: string, args: readonly string[],
  options: CredentialSpawnOptions) => CredentialProcess;
export const NODE_CREDENTIAL_SPAWN = spawn as CredentialSpawn;
```
Timeout idiom (`gitCredentialIO`, ~145-175):
```ts
const timer = setTimeout(() => { child.kill("SIGTERM"); reject(...); }, timeoutMs);
timer.unref();
child.on("error", (err: Error) => { clearTimeout(timer); reject(err); });
child.on("close", (code: number | null) => { clearTimeout(timer); ... });
```
Deviations required (RESEARCH §6, D-PL9-12/15): resolve, never reject, with `{ code, signal?, stdout, stderr, timedOut, error? }`; `stdio: ["ignore","pipe","pipe"]`, `shell: false`, `cwd`, `env: { ...process.env, npm_config_update_notifier: "false" }`; SIGTERM then SIGKILL after grace, resolve on `close`; cap captured streams; `command` is a parameter (sonarjs `no-os-command-from-path`); never `spawnSync`. Do NOT copy `dispatch-exec.ts`'s `deps.spawnImpl ?? spawn` default.

### `test/platform/package-manager.test.ts`

**Analog:** `test/platform/git-credential.test.ts` lines 1-16, 94-135: imports `NODE_CREDENTIAL_SPAWN` and the factory, asserts the production launcher identity (`const productionLauncher: unknown = NODE_CREDENTIAL_SPAWN;`, line 105), and drives timeouts with short `timeoutMs: 50` plus a process fake (`./credential-process-fake.ts`). For real-child cases RESEARCH recommends `process.execPath` with `-e "<script>"` as the command.

### `orchestrators/plugin/package-install.ts` (orchestrator, file-I/O)

**Analog A (work dir + promote):** `orchestrators/plugin/clone-cache.ts` lines 232-255:
```ts
const stagingDir = await args.locations.sourcesStagingDir(randomUUID());
try { ...work in staging... } catch (err) {
  const leak = await cleanupStaging(removalOps, stagingDir, "plugin clone staging");
  throw appendLeakToError(err, leak);
}
await promoteStagingToClone(removalOps, stagingDir, cloneRoot, "plugin clone staging");
```
Here: copy `package.json` + lockfile into the work dir, run, rename `node_modules` into the plugin root, park the old one inside the work dir (not in the plugin root; hash walk), `rm` work dir in `finally`. Containment via `assertPathInside(locations.extensionRoot, pluginRoot, ...)` catching `PathContainmentError`/`SymlinkRefusedError` by `instanceof` -> skip with note (D-PL9-03).

**Analog B (phase object):** `install-outcome.ts` `workflowsPhase`, lines 1317-1350: `{ name: "workflows", do: async (c) => {...}, undo: ... }` typed `Phase<InstallLedgerContext>`; the bridge pushes into `c.discoveryWarnings`. `createPackagesPhase` returns `Phase<{ locations; resolved: { pluginRoot }; discoveryWarnings: string[] }>` named `"packages"`, never throws on package failure (PKD-02), undo uses plain `rm` (no `assertPathInside`, it escapes `runPhases`).

Table/constants: RESEARCH "Lockfile table" code example (bun.lock, npm-shrinkwrap.json, package-lock.json, bun.lockb refused; yarn/pnpm unsupported; 60_000 ms; 500-char note). D-PL9-16: unparseable package.json -> note, not throw.

### `install-outcome.ts` (modify)

Lines 1524-1534, literal array; add `packagesPhase` between `workflowsPhase` and `statePhase`, update the comment listing the sequence:
```ts
  // The PRD-fixed sequence is
  // [skills, commands, agents, hooks, mcp, workflows, state].
  const phases: readonly Phase<InstallLedgerContext>[] = [
    skillsPhase, commandsPhase, agentsPhase, hooksPhase, mcpPhase, workflowsPhase, statePhase,
  ];
```
Plus one import from `./package-install.ts` and `const packagesPhase = createPackagesPhase(...)` beside the other phase constants.

### `materialize-latest.ts` (modify)

Lines 98-102 and 127-138: the two swap returns (`return swapPluginUpdate(args, preflight, policy);` and the spread in `swapAfterSettle`) get wrapped by a helper from `package-install.ts` that appends a note to `notes` only when `partition === "updated"`; plugin root is `preflight.installable.pluginRoot`; force = `policy.skipSameRevision`. Its test: `test/orchestrators/plugin/materialize-latest.test.ts` (existing pair).

### `rule-packs/architecture.json`

Copy lines 103-109 shape:
```json
{ "id": "isomorphic-git-chokepoint", "kind": "banned-import",
  "specifiers": ["isomorphic-git"],
  "files": ["extensions/pi-claude-marketplace/**"],
  "exclude": ["extensions/pi-claude-marketplace/platform/git.ts"],
  "message": "D-13: ..." }
```
New `child-process-chokepoint` with specifiers `node:child_process`, `child_process`; excludes `platform/git-credential.ts`, `bridges/hooks/dispatch-exec.ts`, `bridges/hooks/async-rewake/registry.ts`, `platform/package-manager.ts` (verified rule in RESEARCH §4). Update rule counts in docs only if the planner chooses (STACK/CONVENTIONS say "11 rules").

### `eslint.config.js` BLOCK C

`NETWORK_SEAMS` constant at line 44 is the model for a documented `PACKAGE_INSTALL_SEAMS` constant. Append one zone to BLOCK C's `import-x/no-restricted-paths` zones (block starts ~390, `files: ["extensions/pi-claude-marketplace/**/*.ts"]`):
```js
{ target: "./extensions/pi-claude-marketplace/**/!(package-install).ts",
  from: ["./extensions/pi-claude-marketplace/platform/package-manager.ts"],
  message: "D-PL9-10: only the PACKAGE_INSTALL_SEAMS module imports platform/package-manager.ts; ..." }
```
Do not add a new block (flat-config replaces rule options); do not add to `NETWORK_SEAMS`.

### `test/architecture/no-shell-out.test.ts` + `gate-targets.ts`

`gate-targets.ts` lines 204-217: append `"extensions/pi-claude-marketplace/platform/package-manager.ts"` to `SHELL_OUT_EXEMPT_TARGETS` and rewrite the "these three and no others" doc to four with the D-PL9-11/PKD-03 reason. `no-shell-out.test.ts`: header text at ~65-75 ("Adding a FOURTH file requires..."), and the case at ~142-151:
```ts
test("whitelist: exactly three files may import node:child_process", () => {
  assert.deepEqual([...].sort(), [
    "bridges/hooks/async-rewake/registry.ts",
    "bridges/hooks/dispatch-exec.ts",
    "platform/git-credential.ts",
  ]);
});
```
-> "exactly four", insert `"platform/package-manager.ts"` in sorted position. Same commit as the platform module.

### `features/lib/npm-registry.ts` (new stand-in)

**Analog:** `features/lib/https-git-host/server.ts`. `listen` helper (lines 130-142):
```ts
function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (address === null || typeof address === "string") { reject(new Error("...")); return; }
      resolve(address.port);
    });
  });
}
```
Class shape `HttpsGitHost` (276+): `address` getter, `arm(...)` for failures (`armedStatus`, line 75), `requestsSince(window)` request log, `close()` (415). Use `node:http` (loopback, plain), not https. Tarball: ustar writer + `gzipSync`, sha512 integrity (RESEARCH recipe steps 1-3). Per-scenario instance (not run-level like `gitHost`).

### `features/step_definitions/plugin/package-dependencies.steps.ts` (new)

**Analog:** `features/step_definitions/git-host.steps.ts` lines 1-60: fileoverview, imports (`node:assert/strict`, `node:fs/promises`, `@cucumber/cucumber`, lib, then `import type { ScenarioWorld } from "../support/world.ts"`), arm-then-`world.onRelease(...)`. World release hook: `features/support/world.ts:377` `onRelease(release)`. Add plugin files with `writePublishedPluginFile(published, plugin, file, text)` (`features/lib/published-marketplace.ts:471-484`, commits+pushes for git). Write `{home}/.npmrc` (registry, `update-notifier=false`, `fetch-retries=0`).

### `features/plugin/package-dependencies.feature` (new)

**Analog:** `features/plugin/install-dependencies.feature`: `Feature:` + prose paragraph, `Given the marketplace "tools" is published as ...` (use a git kind: url/github on the run's host), `When the user runs "/claude:plugin install ..."`, `Then the result has these fields:` / `Then the result lists these plugins:` tables, `When the user starts a new pi session`. Scenarios: success (module present / hook proof per D-PL9-17 spike), npm failure via armed 404 -> `(installed)` row + warning note, yarn.lock refusal exact-text note.

## Shared Patterns

- **Containment:** `assertPathInside` (`shared/path-safety.ts`), narrow on `instanceof`; never in `undo`.
- **Staging dir:** `locations.sourcesStagingDir(randomUUID())` (`persistence/locations.ts:355-360`), same FS as plugin-clones.
- **Warnings:** push strings into `discoveryWarnings` / `notes`; no `notify` calls from the new modules (IL-2); `surfaceDiscoveryWarnings` redacts absolute paths.
- **DI:** launcher and timeout passed as parameters (`createCredentialOps({ spawn, timeoutMs })`); composition owner binds `NODE_*_SPAWN`.
- **Tests:** hermetic home / real tmp dirs; 100% direct coverage per pair.

## No Analog Found

None outright. The tarball/ustar writer in `npm-registry.ts` has no in-repo precedent; use RESEARCH §"Behavioral test recipe".

## Metadata

**Search scope:** `extensions/pi-claude-marketplace/{platform,orchestrators/plugin}`, `test/{platform,architecture}`, `features/{lib,plugin,step_definitions,support}`, `eslint.config.js`, `rule-packs/`.
**Pattern extraction date:** 2026-10-26
