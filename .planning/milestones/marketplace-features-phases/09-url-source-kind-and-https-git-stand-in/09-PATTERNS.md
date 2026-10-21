# Phase 9: URL Source Kind and HTTPS Git Stand-In - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 22 (new + modified)
**Analogs found:** 20 / 22

All analog paths below are git-tracked (`git ls-files features tests/e2e/_rpc.ts` lists them; no gitignored mirrors).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/lib/https-git-host.ts` (new; stand-in: cert, server, arms, log, reset) | utility (loopback fake) | request-response + event-driven | `tests/live-uat/openai-stub-server.mjs` (loopback server, request log) + `features/lib/pi-process.ts` (class with start/stop/idle) | role-match |
| `features/lib/cgi-response.ts` or `features/lib/https-git-host/cgi-response.ts` (new, pure parser) | utility | transform | `features/lib/marketplace-info-fields.ts` (pure, unit-tested lib) | role-match |
| `features/lib/git-marketplace.ts` (new, bare-repo fixture) | utility (fixture) | file-I/O + subprocess | `features/lib/path-marketplace.ts` (dir writers) | role-match |
| `features/lib/published-marketplace.ts` (modify: url arms) | utility (dispatch) | file-I/O | itself, dir/file arms (lines 72-135, 149-331) | exact |
| `features/lib/run-tokens.ts` (modify: `{git host}`) | utility | transform | itself, `{home}` token (lines 12-48) | exact |
| `features/lib/pi-process.ts` (modify: `start(sandbox, env)`) | driver | request-response | itself line 100-103 | exact |
| `tests/e2e/_rpc.ts` (modify: typed `RpcGitEnvironment`) | test harness | process spawn | itself `childEnvironment`/`spawnPi`/`startRpcPi` (lines 167-174, 349-404) | exact |
| `features/support/pi-process.ts` (modify: `PiRun.gitHost`, `piEnvironment`, lifetime, reset assertion) | support hook | event-driven | itself (lines 26-96) | exact |
| `features/support/https-git-host.ts` (new: `BeforeStep` request window, no state) | support hook | event-driven | `features/support/source-kind.ts` (stateless support registration) | role-match |
| `features/support/world.ts` (modify: `tokens.gitHost`, `requestWindow`, `gitHost` getter) | world | — | itself lines 38-85 | exact |
| `features/step_definitions/marketplace/url-source.steps.ts` (or `git-host.steps.ts`) (new: arm, credential, log steps) | step module | request-response | `features/step_definitions/session.steps.ts` (table-compare Then), `marketplace/publishing.steps.ts` (Given) | role-match |
| `features/step_definitions/marketplace/publishing.steps.ts` (modify: pass git host into publishing calls) | step module | — | itself lines 37-57 | exact |
| `features/marketplace/url-source.feature` (new) | feature | — | `features/marketplace/file-source-update.feature` | exact |
| `features/marketplace/url-source-update.feature` (new, UPD-11) | feature | — | `features/marketplace/file-source-update.feature` | exact |
| `features/marketplace/git-source.feature` (new, @url/@github Outlines) | feature | — | `features/marketplace/add.feature` tagged Examples blocks | role-match |
| `features/marketplace/info.feature` (row `#stable`->`#main`, D-17), `features/marketplace/update.feature` ~885 (D-18) | feature | — | themselves | exact |
| `cucumber.json` (drop `not @url`, last plan) | config | — | itself | exact |
| `tests/architecture/cgi-response.test.ts`, `https-git-host.test.ts`/env-builder test (D-11) | test | transform | `tests/architecture/marketplace-info-fields.test.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (D-16 missing-ref classify) + `shared/git-failure-classifiers.ts` | orchestrator / classifier | request-response | `classifyAddError` (add.ts:296-336), `classifyGitSourceAccessFailure` (classifiers:118-136), `isGitNotFoundError` (marketplace/shared.ts:233) | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` `failedAddRow` and/or `shared/notification-json.ts` `wireRow` (D-19 id) | orchestrator / renderer | transform | `failedAddRow` add.ts:755-785; `wireRow` notification-json.ts:401-420 | exact |
| `tests/orchestrators/marketplace/add.test.ts`, `tests/shared/notification-json.test.ts` (paired) | test | — | add.test.ts:3835-3900 | exact |
| `CHANGELOG.md`, `.agents/skills/cucumber/rules/{world-and-stand-ins,layout,steps,features}.md` | docs | — | CHANGELOG `## [Unreleased]` bullets; world-and-stand-ins.md:10 | exact |

## Pattern Assignments

### `features/lib/https-git-host.ts` (loopback fake)

**Analogs:** `tests/live-uat/openai-stub-server.mjs:172-200` (server shape), `features/lib/pi-process.ts:77-140` (class lifecycle + stop grace), RESEARCH Patterns 2, 4, 5 for CGI env / arms / log.

Server body pattern (openai-stub-server.mjs:172-181) -- buffer body, handle `req` error by destroying:
```js
const server = createServer((req, res) => {
  let body = "";
  req.on("error", () => { res.destroy(); });
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => { ... logRequest(req, parsed); ... });
});
```
Adapt: `node:https` `createServer({ key, cert }, ...)`, collect `Buffer[]` (binary pack body, never decode), listen `127.0.0.1:0`. Arm check BEFORE buffering (RESEARCH Pattern 4). Spawn `git http-backend` with async `spawn`/`execFile` only (never `execFileSync` -- deadlock, RESEARCH anti-pattern). Count `server.on("connection")`.

Class lifecycle (pi-process.ts:77-84, 100-103, 132-140): private constructor + `static async start(...)`, `stop()` with grace, then kill. Mirror as `GitHost.start(root)` / `reset()` / `snapshot()` / `mark()` / `requestsSince()` / `arm()` / `close()`. No work at module load (dry-run gate loads modules).

File header style (pi-process.ts:1-11): `@fileoverview` block explaining why the design exists.

### `features/lib/cgi-response.ts` (pure parser)

**Analog:** `features/lib/marketplace-info-fields.ts` (pure lib with an architecture unit test). Use RESEARCH Pattern 3 signature `parseCgiResponse(output: Buffer): CgiResponse`; explicit return types (`explicit-module-boundary-types`). Layout gate: either `lib/cgi-response.ts` or `lib/https-git-host/cgi-response.ts`, never `lib/https-git-host.ts` beside `lib/https-git-host/` (scripts/check-features.mjs:238-274).

### `features/lib/git-marketplace.ts` (bare-repo fixture)

**Analog:** `features/lib/path-marketplace.ts` (writers `writeMarketplace`, `writeManifestText`, `writeMarketplaceDescription`, `writeDependencyAllowance`, `writeInvalidManifest`, `writeMalformedManifest`, imported at published-marketplace.ts:13-20). The fixture reuses those writers on a work tree, then commits+pushes (RESEARCH "Commit-and-push publication", lines 680-697). Env from scratch: `fixtureGitEnvironment(home)` (RESEARCH Pattern 2) -- never spread `process.env`.

### `features/lib/published-marketplace.ts` (url arms)

**Analog:** itself. Each arm today:
```ts
    case "url":
    case "github":
      throw noStandIn(kind);
```
(lines 89-91, 131-133, and in `republishMarketplace`, `rewritePublishedManifest`, `removePublishedSource`, `invalidateManifest`, `publishUnreadableSkillFile`, `publishedPluginFile`, `allowDependenciesOn`, `describeMarketplace`). Split `case "url":` from `case "github":` (github keeps `noStandIn` for Phase 10). Dir arm to mirror (lines 125-127):
```ts
    case "dir":
      await writeMarketplace(root, name, plugins, manifestPath);
      return { kind, root, source: root, manifestPath };
```
Url arm returns `{ kind: "url", root: work, source: "https://127.0.0.1:<port>/acme/<dir>.git", manifestPath }`. Signatures gain a "publication sites" handle (`{ marketplacesRoot, gitHost }`) passed from steps -- `features/lib` must not import `features/support` (layout.md). `publishedPluginFile` becomes a write-and-commit function (RESEARCH Pattern 7 table). `publishUnreadableSkillFile` url arm stays a throw (D-18 removes its rows). Keep `ownedTarget` (lines 181-195) for path-containment of deletes.

### `features/lib/run-tokens.ts`

**Analog:** itself (lines 12-48). Add `readonly gitHost: string` to `RunTokens` with a doc comment; `const GIT_HOST_TOKEN = "{git host}";` beside `HOME_TOKEN` (line 20); chain `.replaceAll` in `expandTokens` (line 34) and `projectTokens` (line 47) per RESEARCH "Run token" example. Update the file header and function docs that say "every `{home}`".

### `tests/e2e/_rpc.ts`

**Analog:** itself:
```ts
function childEnvironment(sandbox: RpcSandbox): NodeJS.ProcessEnv {
  return {
    HOME: sandbox.home,
    PI_CODING_AGENT_DIR: sandbox.agentDir,
    PI_OFFLINE: "1",
    PATH: process.env.PATH ?? "",
  };
}
```
(lines 167-174); `spawnPi(sandbox, extraExtensions)` at 349-361 sets `env: childEnvironment(sandbox)`; `startRpcPi(sandbox)` at 400-404 is called only by `features/lib/pi-process.ts:102`. Add exported `interface RpcGitEnvironment` (RESEARCH Pattern 6), an optional `git?: RpcGitEnvironment` on `spawnPi`/`childEnvironment` spread as named keys, so `runRpcSession` stays unchanged. Doc comment style: see `startRpcPi` JSDoc at 394-399.

### `features/lib/pi-process.ts`

**Analog:** line 100-103:
```ts
  static async start(sandbox: RpcSandbox): Promise<PiProcess> {
    return new PiProcess(await startRpcPi(sandbox));
  }
```
Add the env parameter; re-export the type as done for `RpcSandbox` (lines 16-20).

### `features/support/pi-process.ts` (lifetime + reset)

**Analog:** itself. Extend `PiRun` (lines 27-32) with `readonly gitHost` and `readonly piEnvironment`. In `BeforeAll` (47-65) start the host (after `mkdtemp`, before `PiProcess.start`). In `Before` (67-90) replace with the same env:
```ts
  if (!run.pi.idle) {
    await run.pi.stop();
    run.pi = await PiProcess.start(run.sandbox);   // -> (run.sandbox, run.piEnvironment)
  }
```
then `await run.gitHost.reset()` before emptying sandbox, and widen the assertion (lines 86-89):
```ts
  assert.deepStrictEqual(
    { skills, marketplaces: listed.marketplaces },
    { skills: [], marketplaces: [] },
  );
```
to include `gitHost: run.gitHost.snapshot()` (RESEARCH Pattern 1 contract). `AfterAll` (92-96): `pi.stop()` then `gitHost.close()` then `rm`. Hooks stay arrows (`BeforeAll`/`AfterAll` and world-free `Before`, world-and-stand-ins.md:8).

### `features/support/https-git-host.ts` (BeforeStep window)

**Analog:** `features/support/source-kind.ts` (stateless support module, header + one registration, imports from `../lib/`). Body: `BeforeStep(function (this: ScenarioWorld, { pickleStep }) { if (pickleStep.type === "Action") { this.requestWindow = this.gitHost.mark(); } })` -- `function` with typed `this` because it uses the world (world-and-stand-ins.md:8). Reach the host via the world getter rather than importing `currentRun` from a second support module if possible.

### `features/support/world.ts`

**Analog:** itself. Getter pattern (lines 55-63, 82-85):
```ts
  get tokens(): RunTokens {
    return { home: currentRun().sandbox.home, scenarioStartedAt: this.startedAt };
  }
```
Add `gitHost: currentRun().gitHost.address` (host:port) here; add `get gitHost()` like `get pi()`; add `requestWindow` as an initialized field with a comment (like `uncomparedRows`, lines 40-43). No `markRequestsCompared` (D-04).

### `features/step_definitions/marketplace/url-source.steps.ts`

**Analogs:** `session.steps.ts:24-35` for table and empty-assert Thens:
```ts
Then("the session offers these skills:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.sessionSkills().map((skill) => [skill.command, skill.description]);
  assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
});
Then("the session offers no skills", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.sessionSkills(), []);
});
```
-> `the git host receives these requests:` (`| method | path | status |`, project `{git host}` not needed since paths are host-free) and `the git host receives no request` asserting `{ requests: [], connections: 0 }`. Givens follow `publishing.steps.ts:46-57` (header doc, `this: ScenarioWorld`, `assert.fail` on misuse). Credential Given writes `.gitconfig` + `.git-credentials` (mode 0o600) under `currentRun().sandbox.home` via the world, no git process (D-09). Import order per CONVENTIONS (node, external, parent libs, then `import type`).

### `features/step_definitions/marketplace/publishing.steps.ts`

**Analog:** itself lines 46-57 -- calls `requireFreeRoot(this.marketplacesRoot, name, kind)` and `publishMarketplace(this.marketplacesRoot, ...)`; swap the string for the sites handle; step text unchanged. The `onRelease(() => rm(root, ...))` release remains valid for the work tree; the host reset removes repositories.

### Feature files

**Analog:** `features/marketplace/file-source-update.feature:1-35`: title `Feature: Marketplace file source update` = file name (gate), two-line description, `Given ... published as a ... source`, `When the user runs "..."`, `Then the results list these marketplaces and plugins:` then `Then the result has these fields:`. Url commands write `https://{git host}/acme/tools.git`. Outlines over 500/502/503 (D-07) with three+ variants (features.md). `@url`/`@github` Examples blocks for git-source.feature follow the existing tagged-block form in `add.feature`.

### `tests/architecture/*.test.ts` (features/lib unit tests)

**Analog:** `tests/architecture/marketplace-info-fields.test.ts:1-40`:
```ts
/** @fileoverview Checks the source fields accepted by marketplace-info assertions. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { expectedInfoFields } from "../../features/lib/marketplace-info-fields.ts";
for (const { ... } of [ ... ]) { test(`${title} for a ${kind} source`, () => { // arrange // act // assert
```
Use the same table-driven `for ... test(...)` with `// arrange / act / assert` comments. Cases: RESEARCH Pattern 3 list (parser) and D-11 (env builders emit no inherited `GIT_*`, set `GIT_CONFIG_NOSYSTEM`). Do not name unregistered production paths (gate-file path rules D-07-06).

### D-16: `orchestrators/marketplace/add.ts` + classifier

**Analog:** `classifyAddError` (add.ts:296-336), the errno arm then delegation:
```ts
    const transportReason = classifyGitSourceAccessFailure(err);
    if (transportReason !== undefined) {
      return transportReason;
    }
```
and the name-duck-typed NotFound check (marketplace/shared.ts:225-235):
```ts
function isGitNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.name === "NotFoundError";
}
```
Add a `NotFoundError` arm (no isomorphic-git import, D-13) returning `source missing` (existing token, used for 404/410 at git-failure-classifiers.ts:20, 118-136). If `isGitNotFoundError` must be shared, move/export it through `shared/git-failure-classifiers.ts` (cross-orchestrator surface per its header lines 1-13) rather than importing marketplace/shared.ts into a new place. Note `handleAddFailure` (add.ts:832-870) rethrows unclassified errors in standalone mode -- that is today's `internal-error`.

Paired test: `tests/orchestrators/marketplace/add.test.ts:3835-3864`:
```ts
test("D-76-09: a missing repository HttpError renders (failed) {source missing} via notify()", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({ fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"), cloneThrows: httpError(404) });
    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: "https://gitlab.example.com/team/missing-mp", gitOps });
    // assert
    assert.deepStrictEqual(notifications, [ { message: "...(failed) {source missing}", severity: "error" } ]);
```
Copy with `cloneThrows` = an error whose `name`/`code` is `"NotFoundError"` and a `#ref` source. Use `createHermeticEnvironment(t, ...)` as the ADD-10 tests do (3866-3868). Direct-coverage 100% applies to `add.ts`/`git-failure-classifiers.ts` pairs (`tests/shared/git-failure-classifiers.test.ts` if the classifier changes).

### D-19: failed-add row id

**Analog:** `shared/notification-json.ts:401-420`:
```ts
function wireRow(row: ResolvedRow, mp: ResolvedMarketplace) {
  return {
    status: row.status,
    name: row.name,
    id: row.name.includes("@") ? row.name : `${row.name}@${mp.name}`,
```
and `failedAddRow` (add.ts:755-785) which names both the block and the synthetic child `subject` (the raw URL), producing `<url>@<url>`. Related pinned instances: 03.2-REVIEW IN-04 (`tools@tools` in `marketplaceFailureRows`, marketplace/shared.ts; remove.feature:55,72,206; autoupdate.feature), tracked as WINDOWS #98. Fix choice is the planner's (user decision, costly reversibility); update `tests/shared/notification-json.test.ts` (rows asserting `id:` near 381-503) and `tests/orchestrators/marketplace/add.test.ts` ADD-10 cases (3866-3990), plus any JSON catalog/doc entry (`tests/architecture/json-output-docs.test.ts` checks docs).

### CHANGELOG.md

**Analog:** `CHANGELOG.md` `## [Unreleased]` -- one plain-English bullet per user-visible change, e.g. "An empty argument now fails with a message that names it, such as `Source must not be empty.`". Add one bullet for D-16 (`{source missing}` for a missing ref) and one for D-19 (row id change in JSON output).

### Cucumber rule amendments

**Analog:** `.agents/skills/cucumber/rules/world-and-stand-ins.md:10` ("One exception: a process under test that is too slow to start per scenario...") -- extend with the stand-in lifetime per RESEARCH "Rule amendments" table (lines 654-661); same sentence fix in `layout.md:56` (pointer to `steps.md` should be `world-and-stand-ins.md`); add log-step rule to `steps.md`; `{git host}` to `features.md:96,107`. Markdown is formatted by mdformat, not prettier.

## Shared Patterns

### Env built from scratch (never spread `process.env`)
**Source:** `tests/e2e/_rpc.ts:167-174`. **Apply to:** Pi env, CGI env, fixture-git env, and the D-11 test.

### Module header + doc comments
**Source:** `features/support/pi-process.ts:1-12`, `features/lib/run-tokens.ts:1-10`. Cite requirement IDs (HOST-0N, DRV-03, D-NN), never phase/plan numbers.

### Hook form
**Source:** world-and-stand-ins.md:8 -- `BeforeAll`/`AfterAll` arrows; hooks using the world are `function` with typed `this`. Only one module-level state (`piRun`, support/pi-process.ts:36).

### Release ownership
**Source:** `publishing.steps.ts:54` `this.onRelease(() => rm(root, { recursive: true, force: true }))`; the world's `After()` runs releases. Host repositories are cleared by `gitHost.reset()` in `Before()`, not by releases.

### Typed errors in production
**Source:** CONVENTIONS + `classifyAddError` -- narrow by `instanceof` or library name duck-type, never message substrings.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| openssl cert generation inside `https-git-host.ts` | utility | subprocess | No run-time certificate code exists; use RESEARCH/STACK `openssl req -x509` command |
| CGI spawn of `git http-backend` | utility | streaming subprocess | No CGI bridge exists; use RESEARCH Patterns 2-3 |

## Metadata

**Analog search scope:** `features/`, `tests/e2e/_rpc.ts`, `tests/architecture/`, `tests/live-uat/`, `tests/orchestrators/marketplace/`, `extensions/pi-claude-marketplace/{orchestrators/marketplace,shared}/`, `.agents/skills/cucumber/rules/`, `CHANGELOG.md`
**Files scanned:** ~25
**Pattern extraction date:** 2026-10-20
