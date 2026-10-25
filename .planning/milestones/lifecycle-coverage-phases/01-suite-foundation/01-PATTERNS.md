# Phase 1: Suite Foundation - Pattern Map

**Mapped:** 2026-10-22
**Files analyzed:** 22 (new or modified, from 01-CONTEXT.md and 01-RESEARCH.md "Recommended Project Structure", Gap Inventory, Seed Map)
**Analogs found:** 21 / 22

All analogs are git-tracked (`git ls-files features scripts/check-features.mjs`). Module names marked "suggested" are the planner's choice within `.agents/skills/cucumber/rules/layout.md` (no `common/shared/utils/helpers/support/misc/hooks/parameter-types`; no reserved verb names such as `state-lock`, `git-source`, `rollback`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/step_definitions/plugin/installation.steps.ts` (suggested; replaces `plugin.steps.ts` in a move-only commit, then grows: record table, data dir plant/list, skill delete, clones projection, mcp-adapter obstruction) | step module (topic) | file-I/O read + setup | `features/step_definitions/plugin.steps.ts` | exact (it IS the source) |
| `features/step_definitions/plugin/publishing.steps.ts` (optional; git-source plugin + partial `output-styles/` publishing) | step module (topic) | file-I/O + git publish | `features/step_definitions/marketplace/publishing.steps.ts` | exact |
| `features/step_definitions/git-host.steps.ts` (MOVED from `marketplace/git-host.steps.ts`, own commit; repository named as marketplace or plugin; disarm/"serves again") | step module | request-response (stand-in arming, request log) | `features/step_definitions/marketplace/git-host.steps.ts` | exact |
| `features/step_definitions/command.steps.ts` (modify: generalize `Given the user has run`, row steps for `reconcile-applied-cascade` and `plugin-info-cascade`, failing-setup Given) | step module | request-response | itself + `marketplace/update.steps.ts:31` multi-payload Given | exact |
| `features/step_definitions/session.steps.ts` (modify: session payloads on world, other-project session) | step module | request-response (RPC) | itself | exact |
| `features/step_definitions/config.steps.ts` (modify: marketplaces writer step) | step module | file-I/O write | `config.steps.ts` "a config in scope {word} and layer {word}, with these plugins:" (lines ~120-133) | exact |
| `features/step_definitions/<scope-state>.steps.ts` (suggested `scope.steps.ts`; "another process holds the state lock of the {word} scope") | step module | event-driven (child process) | `mcp-configuration.steps.ts` scope Given + `git-host.steps.ts` credential Given | role-match |
| `features/step_definitions/claude-settings.steps.ts` (suggested) | step module | file-I/O write | `git-host.steps.ts` lines 59-75 (writes into `{home}`, `wx`, onRelease, read-back assert) | role-match |
| `features/support/plugin-source-kind.ts` | support (parameter type) | transform | `features/support/source-kind.ts` | exact |
| `features/support/world.ts` (modify: session results, plugin repository records, new tokens) | world | state | itself | exact |
| `features/support/pi-process.ts` (modify: Before() asserts session `payloads: []`) | support (hooks) | lifecycle | itself lines 117-145 | exact |
| `features/lib/pi-commands.ts` (modify: `startSession` returns `{ skills, payloads }` via `get_entries`) | driver | request-response (RPC) | itself lines 66-117 | exact |
| `features/lib/state-lock.ts` (self-spawning lock holder) | lib (stand-in, child process) | event-driven | `features/lib/pi-process.ts` (`PiProcess.start`/`stop` child lifecycle) + RESEARCH Code Example | partial |
| `features/lib/git-plugin.ts` (plugin repos on git host, revisions) | lib (fixture) | file-I/O + git | `features/lib/git-marketplace.ts` + `path-marketplace.ts writePlugin` | exact |
| `features/lib/path-marketplace.ts` (modify: `OfferedPlugin` optional git source; `manifestText` object source; partial plugin) | lib (fixture) | transform | itself lines 60-89 | exact |
| `features/lib/published-marketplace.ts` (modify or new `official-marketplace.ts`) | lib (fixture) | file-I/O + git | itself (`publishMarketplace`) | exact |
| `features/lib/https-git-host/server.ts` (modify: owner/name keys, `disarm`, owner `anthropics`) | lib (stand-in) | request-response | itself lines 32, 181-190, 312-350 | exact |
| `features/lib/layer-config.ts` (modify: `writeLayerMarketplaces`) | lib | file-I/O write | itself `writeLayerPlugins` (lines 74-90) | exact |
| `features/lib/run-tokens.ts` (modify: `{project}`, `{agent dir}`, revision tokens) | lib | transform | itself | exact |
| `features/lib/result-rows.ts` (suggested; rowArrays/record projections shared by command + session steps) | lib | transform | `command.steps.ts` lines 30-99 (private helpers to move) + `lib/field-rows.ts` | exact |
| `features/lib/claude-settings.ts` (suggested) | lib (fixture) | file-I/O write | `features/lib/mcp-configuration.ts` / `layer-config.ts writeLayerText` | role-match |
| `.agents/skills/cucumber/rules/{layout,steps,features}.md` (amend: ownership rule, marketplaces writer, `plugin source kind` column, new tokens) | docs | - | existing rule text | n/a |
| Seed feature files (`features/plugin/{install-dependencies,partial-install,install,git-source,git-source-update,install-rollback,uninstall,reinstall,info,pending,reconcile,prune,import,bootstrap,help,state-lock,enable}.feature`) + six existing scenarios gaining session comparisons | feature | - | `features/plugin/install.feature`, `features/marketplace/add.feature` | exact |

## Pattern Assignments

### `features/step_definitions/plugin/installation.steps.ts` (topic step module)

**Analog:** `features/step_definitions/plugin.steps.ts` (61 lines; move verbatim first, imports become `../../lib/...`, `../../support/world.ts`).

Header + imports (lines 1-21):
```ts
/**
 * @fileoverview Steps that check which plugins a scope has installed.
 * ...
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Then } from "@cucumber/cucumber";

import { isPlainObject } from "../lib/field-rows.ts";

import type { ScenarioWorld } from "../support/world.ts";
```

Record reader (lines 23-39) - reuse for "holds these plugins" table form and for reading `resources.skills` names before deleting skill dirs:
```ts
async function recordedPlugins(extensionRoot: string): Promise<readonly string[]> {
  const file = path.join(extensionRoot, "state.json");
  assert.ok(existsSync(file), `${file} does not exist, which is not an empty record`);
  ...
  return Object.entries(state.marketplaces).flatMap(([marketplace, entry]) => { ... });
}
```

Whole-result Then (lines 45-61) - the shape for every new observation step (one `deepStrictEqual` over a projected object):
```ts
Then("the {word} scope has no installed plugins", async function (this: ScenarioWorld, scope: string) {
  const extensionRoot = path.join(this.scopeRoot(scope), "pi-claude-marketplace");
  const resources = path.join(extensionRoot, "resources");
  assert.deepStrictEqual(
    { recorded: await recordedPlugins(extensionRoot), skills: ..., prompts: ... },
    { recorded: [], skills: [], prompts: [] },
  );
});
```

Obstruction Given (mcp-adapter.json as a directory): copy the scope-file Given from `features/step_definitions/mcp-configuration.steps.ts` lines 23-31 (path via `this.scopeRoot(scope)`, `this.onRelease(() => rm(file, ...))`, then assert the effect). Assert `readFile(target)` rejects with `{ code: "EISDIR" }`; "writable again" removes it and asserts `ENOENT` (RESEARCH Pattern 5).
```ts
Given("the mcp-adapter.json file of the {word} scope holds a comment", async function (this: ScenarioWorld, scope: string) {
  const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
  await writeCommentedMcpConfig(file);
  this.onRelease(() => rm(file, { force: true }));
  assert.match(await readFile(file, "utf8"), /^\/\/ /u);
});
```
Data dir: `<scopeRoot>/pi-claude-marketplace/data/<mp>/<plugin>/`; the plant Given asserts the directory exists first. Clones: project each `plugin-clones/<key>` to its origin URL (tokenized) + pinned flag, never the key (Pitfall 4).

**Move constraint:** creating `step_definitions/plugin/` and deleting `plugin.steps.ts` must be one move-only commit (`scripts/check-features.mjs:265-271` "module beside its own directory").

---

### `features/step_definitions/git-host.steps.ts` (moved, generalized)

**Analog:** `features/step_definitions/marketplace/git-host.steps.ts` (91 lines).

Repository lookup to generalize (lines 18-26) - add a plugin branch that reads a world record of plugin repositories:
```ts
function publishedRepository(world: ScenarioWorld, name: string): string {
  const published = world.requirePublished(name);
  if (published.kind === "url" || published.kind === "github") {
    return published.repository;
  }
  assert.fail(`the marketplace ${name} is not published as a git source`);
}
```

Arm Given (lines 28-36) - keep text; add `this.onRelease(() => this.gitHost.disarm(...))`. Share one arm helper between marketplace and plugin texts (fallow dupes, Pitfall 5):
```ts
Given("the git host answers {int} for the marketplace {string}", async function (this: ScenarioWorld, status: number, name: string): Promise<void> {
  await this.gitHost.arm(publishedRepository(this, name), { kind: "status", status: armedStatus(status) });
});
```

Request log Thens (lines 77-91) - already source-agnostic, keep as-is:
```ts
Then("the git host receives these requests:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.requestsOfLastCommand().requests.map((request) => [request.method, request.path, String(request.status)]);
  assert.deepStrictEqual([["method", "path", "status"], ...rows], table.raw());
});
```

Write-into-home setup with release and read-back (lines 59-75) - the template for `claude-settings.steps.ts`:
```ts
await writeFile(config, configText, { flag: "wx" });
this.onRelease(() => rm(config, { force: true }));
...
assert.deepStrictEqual([await readFile(config, "utf8"), ...], [configText, ...]);
```

---

### `features/lib/https-git-host/server.ts` (modify)

Hard-coded owner (line 32): `const OWNER = "acme";` - keep as default, key repositories/arms by `owner/name`.

`armFor` (lines 181-190):
```ts
function armFor(arms: ReadonlyMap<string, GitHostArm>, served: string): GitHostArm | undefined {
  for (const [repository, arm] of arms) {
    const prefix = `/${OWNER}/${repository}`;
    if (served.startsWith(`${prefix}/`) || served.startsWith(`${prefix}.git/`)) { return arm; }
  }
  return undefined;
}
```

`repositoryPath/Url/Shorthand` (lines ~312-329) and `arm` (lines ~331-350) - add `disarm(repository)` mirroring `arm`'s guard style (throw when not armed):
```ts
async arm(repository: string, arm: GitHostArm): Promise<void> {
  const published = await stat(this.repositoryPath(repository)).then(() => true, () => false);
  if (!published) { throw new Error(`the git host serves no repository ${OWNER}/${repository}.git to arm`); }
  if (this.arms.has(repository)) { throw new Error(`the git host has armed the repository ${OWNER}/${repository}.git already`); }
  this.arms.set(repository, arm);
}
```
`snapshot().arms` stays the Before() reset check (`support/pi-process.ts` lines 136-144).

---

### `features/lib/git-plugin.ts` (new fixture)

**Analogs:** `features/lib/git-marketplace.ts` (publish/push) and `features/lib/path-marketplace.ts writePlugin` (plugin content).

Publish + new revision (git-marketplace.ts lines 22-49):
```ts
export async function publishGitRepository(workTree: string, bareRepository: string, home: string): Promise<void> {
  await runGit(workTree, home, "init", "-q");
  await runGit(workTree, home, "add", "-A");
  await runGit(workTree, home, "commit", "-q", "--allow-empty", "-m", "publish");
  ...
}
export async function pushGitRepository(workTree: string, home: string): Promise<void> { ... }
```

Plugin content (path-marketplace.ts `writePlugin`, ~lines 60-77) - same `.claude-plugin/plugin.json` + `skills/<name>-skill/SKILL.md`; parameterize the root so it can write at a repo root or a subpath (git-subdir), several plugins per repo:
```ts
await writeFile(path.join(pluginRoot, ".claude-plugin", "plugin.json"), JSON.stringify({ name: plugin.name, version: plugin.version, ...(plugin.dependencies !== undefined && { dependencies: plugin.dependencies }) }));
await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${plugin.name}-skill\ndescription: A skill of ${plugin.name} ${plugin.version}.\n---\n\nVersion ${plugin.version}.\n`);
```
Record each revision's 40-hex sha so `run-tokens.ts` can project `sha-<12 hex>` to a readable token.

---

### `features/lib/path-marketplace.ts` (modify `manifestText`)

Current (lines ~79-89):
```ts
function manifestText(name: string, plugins: readonly OfferedPlugin[]): string {
  return JSON.stringify({ name, owner: { name: "features" },
    plugins: plugins.map((plugin) => ({ name: plugin.name, source: `./plugins/${plugin.name}`, version: plugin.version })) });
}
```
Add optional git source on `OfferedPlugin`; emit object source per RESEARCH Code Example (`{ source: "github", repo }`, `{ source: "url", url, sha? }`, `{ source: "git-subdir", url, path }`). Partial plugin: write `output-styles/<file>` beside skills. Manifest rewrites go through `writeManifestText` (size-change trick, lines ~103-116).

---

### `features/step_definitions/plugin/publishing.steps.ts` (optional) and seeds' publish Givens

**Analog:** `features/step_definitions/marketplace/publishing.steps.ts`.

Imports and the publish-once-with-release Given (lines 12-60):
```ts
Given("the marketplace {string} is published as a {source kind} source", async function (this: ScenarioWorld, name: string, kind: SourceKind) {
  if (this.publishedMarketplace(name) !== undefined) { assert.fail(`the marketplace ${name} is already published in this scenario`); }
  const root = await requireFreeRoot(this.publicationSites, name, kind);
  this.onRelease(() => rm(root, { recursive: true, force: true }));
  this.recordPublished(name, await publishMarketplace(this.publicationSites, name, kind, []));
});
```
New plugin-repo Given should copy this shape and record on the world (new `recordPluginRepository` next to `recordPublished`, world.ts lines 165-183).

---

### `features/support/plugin-source-kind.ts` (new)

**Analog:** `features/support/source-kind.ts` (17 lines, copy whole):
```ts
import { defineParameterType } from "@cucumber/cucumber";
import { parseSourceKind } from "../lib/published-marketplace.ts";

defineParameterType({
  name: "source kind",
  regexp: /dir|file|url|github/,
  transformer: parseSourceKind,
});
```
New: `name: "plugin source kind"`, `regexp: /github|url|git-subdir/`, transformer from `lib/git-plugin.ts`. Feature Examples column must NOT be named `source kind` (Pitfall 7; `check-features.mjs:35-36, 357-386`).

---

### `features/lib/pi-commands.ts` (modify `startSession`)

Current (lines 103-117):
```ts
export async function startSession(pi: PiProcess): Promise<readonly OfferedSkill[]> {
  const started = await pi.request({ type: "new_session" });
  assertQuiet(started);
  assert.deepStrictEqual(started.response.data, { cancelled: false });
  const listed = await pi.request({ type: "get_commands" });
  assertQuiet(listed);
  ...
}
```
Add a `get_entries` request; validate its response with a `Compile(Type.Object(...))` like `COMMANDS_VALIDATOR` (lines 39-48); filter `customType === "claude-plugin"` and validate each with `PAYLOAD_VALIDATOR` exactly as `runCommandPayloads` (lines 73-80):
```ts
const payloads = exchange.entries.filter((entry) => entry.customType === "claude-plugin").map((entry) => entry.data);
return payloads.map((payload) => {
  assert.ok(PAYLOAD_VALIDATOR.Check(payload), JSON.stringify(PAYLOAD_VALIDATOR.Errors(payload)));
  return payload;
});
```
Return all entries unfiltered by count (double reconcile pass is real; comment cites rpc-mode.js:334-340). Do not reject an empty list (unlike commands).

---

### `features/step_definitions/session.steps.ts` (modify)

Current (lines 18-35):
```ts
Given("the user has started a new pi session", async function (this: ScenarioWorld) {
  await startSession(this.pi);
});
When("the user starts a new pi session", async function (this: ScenarioWorld) {
  this.skills = await startSession(this.pi);
});
```
The `When` must also set `this.results`, `this.uncomparedRows` (via shared `rowArrays`), `this.uncomparedNotices`, guarded by the same pre-assertions as `When the user runs` (command.steps.ts lines 106-122). The `Given` asserts every payload severity `info`. Other-project session: start a second `PiProcess` (`PiProcess.start(sandbox, run.piEnvironment)`, see `support/pi-process.ts` line 92/123) with a fresh cwd under `currentRun().root`, read commands/entries, stop it, and `this.onRelease` both stop and `rm` the directory.

---

### `features/step_definitions/command.steps.ts` (modify)

Generalize `Given the user has run` (lines 101-104) from:
```ts
const payload = await runCommand(this.pi, expandTokens(command, this.tokens));
assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
```
to `runCommandPayloads` + every payload severity `info` (pattern from `marketplace/update.steps.ts:31`). Add a failing-setup Given asserting a failure severity (Pitfall 8). Extend `marketplaceRecords`/`pluginRecords` (lines 50-88) to accept `reconcile-applied-cascade` (has `marketplaces` with `plugins`) and `plugin-info-cascade` (`blocks`). Keep `lastResult()` failing on more than one payload (DRV-01). Move `ROW_FIELDS`, `rowArrays`, `pluginRecords`, `envelopeFields` (lines 30-99) into `features/lib/result-rows.ts` once session.steps.ts needs them (layout Boundaries: second user -> lib).

---

### `features/support/world.ts` (modify)

Patterns to follow: fields with doc comments (lines 40-58), `tokens` getter (lines 97-105) -> add project dir and agent dir (`run.sandbox.cwd`, `run.sandbox.agentDir`) and revision map; record/require pair (lines 165-183) for plugin repositories; `lastResult/allResults` error text (lines 111-134) reword for sessions; `onRelease`/`release` (lines 194-213) unchanged. After hook (lines 218-230) already enforces uncompared rows.

---

### `features/lib/run-tokens.ts` (modify)

```ts
export function expandTokens(text: string, tokens: RunTokens): string {
  return text.replaceAll(HOME_TOKEN, tokens.home).replaceAll(GIT_HOST_TOKEN, tokens.gitHost);
}
export function projectTokens(key: string, value: string, tokens: RunTokens): string {
  if (key === "lastUpdatedAt" && isScenarioTime(value, tokens.scenarioStartedAt)) { return SCENARIO_TIME_TOKEN; }
  return value.replaceAll(tokens.home, HOME_TOKEN).replaceAll(tokens.gitHost, GIT_HOST_TOKEN);
}
```
Add tokens as new `*_TOKEN` consts and new readonly `RunTokens` members. Order matters: the project dir (`<root>/project`) and agent dir (`<root>/agent`) do not contain `<root>/home`, so replacement order is independent, but replace longer paths before shorter if any nest. Document in `rules/features.md` "Run tokens".

---

### `features/lib/layer-config.ts` (modify) + `config.steps.ts`

Writer (lines 74-90):
```ts
export async function writeLayerPlugins(filePath: string, plugins: readonly LayerPlugin[]): Promise<void> {
  const config = await readLayerObject(filePath);
  const written = { ...config, plugins: Object.fromEntries(plugins.map(({ key, entry }) => [key, entry])) };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(written, null, 2)}\n`);
}
```
Add `readLayerMarketplaces(table)` (header check like `readLayerPlugins`, lines 46-56) and `writeLayerMarketplaces` keeping `plugins`. Step: copy `config.steps.ts` Given "a config in scope {word} and layer {word}, with these plugins:" (write, then read back with `readConfigObject` and `deepStrictEqual` the member). Amend `rules/steps.md` ("No other config step writes") in the same plan.

---

### `features/lib/state-lock.ts` (new, self-spawning) + scope step

No in-repo analog for a self-spawning lib. Child lifecycle style: `features/lib/pi-process.ts` (`PiProcess.start` line 114, `stop` line 145). Core code from RESEARCH "Lock holder" example: child mode when `process.argv[1] === fileURLToPath(import.meta.url)` runs `mkdir(extensionRoot)`, `lockfile.lock(extensionRoot, { lockfilePath, realpath: false, retries: 0, stale: 10_000, update: 2_000 })`, prints `locked`, keeps stdin open, releases on stdin `end`. Parent: `spawn(process.execPath, [thisFile, extensionRoot, lockFile], { stdio: ["pipe","pipe","inherit"] })`, await ready line with timeout, return `release()` (end stdin, await exit 0, assert `stat(lockFile)` -> ENOENT; SIGKILL fallback). Note: `proper-lockfile` import is banned only inside `extensions/pi-claude-marketplace/**` by the rule pack; `features/` is outside it. The Given registers `this.onRelease(handle.release)` and asserts `lockfile.check(...) === true`.

---

### Seed feature files

**Analog:** `features/marketplace/add.feature` / `features/plugin/install.feature`; rules in `rules/features.md`. Title must equal the kebab path (`Feature: Plugin git source` for `plugin/git-source.feature`, `check-features.mjs:312-326`), 2-3 line description, Given/When/Then only, whole tables. For outlines over plugin kinds use a `plugin source kind` column with untagged Examples.

## Shared Patterns

### Release on the world
**Source:** `features/support/world.ts` lines 194-213; used in `publishing.steps.ts` and `git-host.steps.ts` lines 66-69.
**Apply to:** lock child, second PiProcess + its dir, obstruction, arms (disarm), settings files, planted data files.
```ts
this.onRelease(() => rm(root, { recursive: true, force: true }));
```

### Setup Given asserts its effect
**Source:** `config.steps.ts` (read back after write), `mcp-configuration.steps.ts` line 30, `git-host.steps.ts` lines 70-73.
**Apply to:** every new Given.

### Whole-result comparison
**Source:** `command.steps.ts` `recordTable(stated, records)` vs `table.raw()` + `this.markRowsCompared()` (lines 131-147); `lib/field-rows.ts` (`fieldRecord`, `flatten`, `recordTable`, `isPlainObject`).
**Apply to:** all new Then steps (record table, clones, data dir files, reconcile/plugin-info-cascade rows).

### Module header + import order
**Source:** every step module: `@fileoverview` block, builtin / external / internal (`../lib/...`) / type-only last, blank lines between groups (`plugin.steps.ts` lines 1-21).

### Validation of driver payloads
**Source:** `lib/pi-commands.ts` `PAYLOAD_VALIDATOR` (line 37) and `assertQuiet` (lines 52-58).
**Apply to:** session payloads, second PiProcess reads.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `features/lib/state-lock.ts` | lib stand-in | child process | No self-spawning lib module exists; use RESEARCH "Lock holder" prototype + `lib/pi-process.ts` lifecycle style |

## Metadata

**Analog search scope:** `features/step_definitions/**`, `features/support/**`, `features/lib/**`, `features/**/*.feature`, `scripts/check-features.mjs` (via RESEARCH line refs)
**Files scanned:** 18
**Pattern extraction date:** 2026-10-22
