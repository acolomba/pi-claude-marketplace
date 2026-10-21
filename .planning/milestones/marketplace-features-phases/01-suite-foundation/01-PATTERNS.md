# Phase 1: Suite Foundation - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 22 (new + modified)
**Analogs found:** 21 / 22

All analogs below are git-tracked source in this worktree (no mirrors).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/lib/pi-commands.ts` (MOD: + `runCommandPayloads`, `NotificationPayload`) | utility (driver) | request-response | itself: `runCommand` lines 51-67 | exact |
| `features/lib/<payload-tables>.ts` (NEW: `flatten`/`cell`/`fieldWords`/`namesLike`/projection moved out of command.steps.ts) | utility | transform | `features/step_definitions/command.steps.ts` lines 33-81 | exact (move) |
| `features/lib/<kind dispatcher>.ts` (NEW: kind -> publish + typed source) | utility (fixture) | file-I/O | `features/lib/path-marketplace.ts` | role-match |
| `features/lib/path-marketplace.ts` (MOD: root under `{home}`, invalid-manifest rewrite) | utility (fixture) | file-I/O | itself lines 51-71 | exact |
| `features/support/world.ts` (MOD: `results[]`, `startedAt`, tokens, published map; optional rename to `ScenarioWorld`) | store (world) | event-driven | itself | exact |
| `features/support/pi-process.ts` (MOD: realpath run root, marketplaces under HOME) | provider (hooks) | event-driven | itself lines 47-61 | exact |
| `features/step_definitions/command.steps.ts` (MOD: all payloads, tokens, `kind` stated, envelope + rows-across steps) | step module | request-response | itself | exact |
| `features/step_definitions/marketplace/publishing.steps.ts` (NEW; replaces flat `marketplace.steps.ts`, which must be deleted) | step module | file-I/O | `features/step_definitions/marketplace.steps.ts` | exact |
| `features/step_definitions/marketplace/results.steps.ts` (NEW: lists these marketplaces / lists no marketplaces) | step module | transform | `command.steps.ts` lines 105-111 (`lists these plugins:`) | exact |
| `features/step_definitions/config.steps.ts` (NEW, read-only, D-07) | step module | file-I/O | `session.steps.ts` (whole-table compare) + `command.steps.ts` | role-match |
| `features/step_definitions/session.steps.ts` (MOD: + `Given the user has started a new pi session`) | step module | request-response | itself lines 16-18 | exact |
| `features/marketplace/add.feature` (NEW seed) | feature | n/a | `features/plugin/install.feature` | role-match |
| `features/marketplace/list.feature` (NEW seed) | feature | n/a | `features/plugin/install.feature` | role-match |
| `features/marketplace/info.feature` (NEW seed) | feature | n/a | `features/plugin/install.feature` | role-match |
| `features/marketplace/update.feature` (NEW seed) | feature | n/a | `features/plugin/update.feature` | role-match |
| `features/plugin/{install,uninstall,update}.feature` (MOD: `\| kind \| cascade \|` row in each `has these fields:` table) | feature | n/a | itself | exact |
| `scripts/check-features.mjs` (NEW gate) | config/gate script | batch | `scripts/check-workflow-install-scripts.mjs` (main/exit shape) + `scripts/check-corresponding-tests.mjs` (fs walk) | role-match |
| `package.json` (MOD: `check:features`, append to `check:static`) | config | n/a | line 88 `check:static`, line 98 `test:corresponding` | exact |
| `cucumber.json` (MOD: `"tags": "not @url and not @github"`) | config | n/a | itself | exact |
| `eslint.config.js` (MOD: two `features/` blocks) | config | n/a | BLOCK F at lines 361-392 (`no-restricted-imports` + `no-restricted-syntax`) | role-match |
| `.agents/skills/cucumber/SKILL.md` + `rules/steps.md` (MOD: usage check points at gate; Outline/`@url`/`@github` Examples pattern) | docs | n/a | SKILL.md line 26, steps.md line 66, features.md line 34 | exact |
| `features/lib/<kind dispatcher>.ts` url/github arms | utility | n/a | none (throw until Phase 9) | no analog |

## Pattern Assignments

### `features/lib/pi-commands.ts` (driver, request-response)

**Analog:** itself. Keep `runCommand` as the strict wrapper; add `runCommandPayloads` beside it with the same import grouping and `assertQuiet`.

Imports (lines 10-17), swap `CASCADE_PAYLOAD_SCHEMA` for/alongside `NOTIFICATION_PAYLOAD_SCHEMA`:
```typescript
import assert from "node:assert/strict";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { CASCADE_PAYLOAD_SCHEMA } from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";

import type { PiProcess, RpcExchange } from "./pi-process.ts";
```
Core (lines 56-67) — the new function copies this, replacing `length === 1` with `notDeepStrictEqual(payloads, [])` and validating each in a `map`:
```typescript
export async function runCommand(pi: PiProcess, command: string): Promise<CascadePayload> {
  const exchange = await pi.request({ type: "prompt", message: command });
  assertQuiet(exchange);
  assert.deepStrictEqual(exchange.response.data, { disposition: "handled" }, command);
  const payloads = exchange.entries
    .filter((entry) => entry.customType === "claude-plugin")
    .map((entry) => entry.data);
  assert.strictEqual(payloads.length, 1, JSON.stringify(payloads));
  const [payload] = payloads;
  assert.ok(CASCADE_VALIDATOR.Check(payload), JSON.stringify(CASCADE_VALIDATOR.Errors(payload)));
  return payload;
}
```
Narrow via `Check` (no `as`). `runCommand` may be re-expressed over `runCommandPayloads` + length/kind assertion. Note `support/pi-process.ts:81` calls `runCommand(run.pi, "/claude:plugin list")` and reads `.marketplaces` — keep that signature.

---

### `features/lib/<payload-tables>.ts` (utility, transform)

**Analog:** `features/step_definitions/command.steps.ts` lines 23-81 (`UNSTATED_FIELDS`, `fieldWords`, `isPlainObject`, `cell`, `flatten`, `namesLike`, `pluginRecords`). Move these verbatim (they are needed by `command.steps.ts` and `marketplace/results.steps.ts`; step modules export nothing, so they must live in lib). Name it after the vertical, not `shared`/`utils`/`helpers` (gate catch-all list).

Insert projection at the leaf, before `cell()` joins arrays — modify `cell`/`flatten` (lines 44-58) so each string leaf (and each array element) goes through `projectLeaf(key, value, run)` from RESEARCH "Leaf projection":
```typescript
function flatten(record: object, prefix: readonly string[] = []): Array<[string, string]> {
  return Object.entries(record).flatMap(([key, value]): Array<[string, string]> => {
    const words = fieldWords(prefix, key);
    return isPlainObject(value) ? flatten(value, words) : [[words.join(" "), cell(value)]];
  });
}
```
`projectLeaf` uses `value.replaceAll(run.home, "{home}")` (exact substring, no regex) and `{scenario time}` only for key `lastUpdatedAt` within `[startedAt, Date.now()]` with `new Date(at).toISOString() === value`. `UNSTATED_FIELDS` drops `"kind"` (D-01). lib imports only `import type { DataTable }` (path-marketplace.ts line 14 pattern).

---

### `features/lib/path-marketplace.ts` + `features/lib/<kind dispatcher>.ts` (fixture, file-I/O)

**Analog:** `features/lib/path-marketplace.ts`. File header `@fileoverview` block (lines 1-9), node imports then `import type { DataTable }` (lines 11-14), table-reading guard with explicit column check (lines 25-34), `writeMarketplace` (lines 52-71):
```typescript
export async function writeMarketplace(
  root: string,
  name: string,
  plugins: readonly OfferedPlugin[],
): Promise<void> {
  await Promise.all(plugins.map((plugin) => writePlugin(root, plugin)));
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ name, owner: { name: "features" }, plugins: plugins.map(...) }),
  );
}
```
Invalid-manifest variant: same `writeFile` target with `plugins: "nope"` (schema-invalid, not corrupt JSON — RESEARCH Pattern 3). Dispatcher: `dir` -> typed source `<home>/marketplaces/<name>`; `file` -> `<root>/.claude-plugin/marketplace.json`; `url`/`github` -> `throw new Error(...)` until Phase 9. Return `{ kind, typedSource }` for the world.

---

### `features/support/world.ts` (world, event-driven)

**Analog:** itself. Field-initializer state (lines 25-27), getter onto `currentRun()` (lines 30-37), `lastResult()` guard (lines 40-46):
```typescript
export class PluginWorld extends World {
  result: CascadePayload | undefined = undefined;
  skills: readonly OfferedSkill[] | undefined = undefined;
  private readonly releases: Array<() => Promise<void> | void> = [];
  get marketplacesRoot(): string {
    return currentRun().marketplacesRoot;
  }
  lastResult(): CascadePayload {
    if (this.result === undefined) {
      throw new Error("no command has run in this scenario");
    }

    return this.result;
  }
```
Add: `results: NotificationPayload[] | undefined`, `readonly startedAt = Date.now()` as a field initializer (world is built before `Before()`), a published map `Map<string, {kind, typedSource}>`, a `home` getter from `currentRun()`. Single-payload accessor asserts `length === 1` (never `find`). Rename to `ScenarioWorld` is discretionary; if done, update every `this: PluginWorld` import in step modules.

---

### `features/support/pi-process.ts` (hooks, event-driven)

**Analog:** itself, `BeforeAll` lines 47-61:
```typescript
BeforeAll(async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-cm-features-"));
  const sandbox = {
    home: path.join(root, "home"),
    agentDir: path.join(root, "agent"),
    cwd: path.join(root, "project"),
  };
  ...
  piRun = { root, sandbox, marketplacesRoot: path.join(root, "marketplaces"), pi: await PiProcess.start(sandbox) };
});
```
Change: `const root = await realpath(await mkdtemp(...))` (Pitfall 2; `tests/e2e/_rpc.ts:141-165` realpaths before spawning); `marketplacesRoot: path.join(sandbox.home, "marketplaces")` (D-04). `Before()` (lines 63-86) already empties `sandbox.home`, so the moved root is cleaned automatically.

---

### `features/step_definitions/command.steps.ts` (step module, request-response)

**Analog:** itself. Header doc (lines 1-12), imports (lines 14-21), anonymous `function` with `this: PluginWorld` (lines 83-103):
```typescript
Given("the user has run {string}", async function (this: PluginWorld, command: string) {
  const payload = await runCommand(this.pi, command);
  assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
});

When("the user runs {string}", async function (this: PluginWorld, command: string) {
  this.result = await runCommand(this.pi, command);
});

Then("the result has these fields:", function (this: PluginWorld, table: DataTable) {
  const stated = table.raw().map(([name]) => String(name));
  ...
  const rows = namesLike(stated, new Set(fields.keys())).map((name) => [name, fields.get(name)]);
  assert.deepStrictEqual(rows, table.raw());
});
```
Changes: expand tokens in the command string (`command.replaceAll("{home}", this.home)`) in both run steps; `When` uses `runCommandPayloads`; envelope step and rows-across-payloads step follow the `lists these plugins:` shape (lines 105-111) — `namesLike` over every scalar leaf except `marketplaces`/`blocks`, one row per payload, `?? ""` for absent fields. `lists these plugins:` asserts `kind === "cascade"` first.

---

### `features/step_definitions/marketplace/publishing.steps.ts` (step module, file-I/O)

**Analog:** `features/step_definitions/marketplace.steps.ts` (whole file, 35 lines) — move its two steps here and delete the flat file (layout.md split rule; gate fails `<x>.steps.ts` beside `<x>/`). Imports note: from a subdirectory, paths become `../../lib/...` and `../../support/world.ts`.
```typescript
Given(
  "the marketplace {string} offers these plugins:",
  async function (this: PluginWorld, name: string, table: DataTable) {
    const root = path.join(this.marketplacesRoot, name);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    await writeMarketplace(root, name, readOfferedPlugins(table));
  },
);

Given(
  "the marketplace {string} is added to the {word} scope",
  async function (this: PluginWorld, name: string, scope: string) {
    const source = path.join(this.marketplacesRoot, name);
    const payload = await runCommand(this.pi, `/claude:plugin marketplace add ${source} --scope ${scope}`);
    assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
  },
);
```
New: `publish as a {word} source` and `manifest becomes invalid` in the same shape, calling the lib dispatcher and recording onto the world; `is added` types the recorded `typedSource` (default dir). No `onRelease` needed once the root is under HOME (Before() wipes it), but keeping it is harmless.

---

### `features/step_definitions/marketplace/results.steps.ts` (step module, transform)

**Analog:** `command.steps.ts` lines 105-111:
```typescript
Then("the result lists these plugins:", function (this: PluginWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = pluginRecords(this.lastResult());
  const columns = namesLike(stated, new Set(records.flatMap((record) => [...record.keys()])));
  const rows = records.map((record) => columns.map((column) => record.get(column) ?? ""));
  assert.deepStrictEqual([columns, ...rows], table.raw());
});
```
`lists these marketplaces:` = same with block records (no `plugins`), failing if any block has plugin rows. `lists no marketplaces` mirrors `session offers no skills` (`session.steps.ts` lines 25-27: `assert.deepStrictEqual(x, [])`) after asserting kind `cascade`. Module name must not be a verb name.

---

### `features/step_definitions/config.steps.ts` (step module, file-I/O read)

**Analog:** `session.steps.ts` lines 20-23 (header row + rows, whole-table compare):
```typescript
Then("the session offers these skills:", function (this: PluginWorld, table: DataTable) {
  const rows = this.sessionSkills().map((skill) => [skill.command, skill.description]);
  assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
});
```
Read `claude-plugins.json` / `.local.json` with `readFile` + `JSON.parse` under the scope root (project: `sandbox.cwd/.pi/`, user: `sandbox.agentDir`); project `source` cells through the same leaf projection. Read only (D-07).

---

### `features/step_definitions/session.steps.ts`

Add `Given("the user has started a new pi session", ...)` copying lines 16-18 (`await startSession(this.pi)`), without storing skills.

---

### `features/marketplace/*.feature` (seeds)

**Analog:** `features/plugin/install.feature` lines 1-24:
```gherkin
Feature: Plugin install

  Installing a plugin from an added marketplace materializes it in the chosen scope.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Installing a plugin reports it installed in the chosen scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | severity     | info |
      | needs reload | true |
```
Title `Feature: Marketplace add` -> `marketplace/add.feature`; three-line description; repeated `Given`/`Then` (no `And`); lower-case step text. Outline shape from CONTEXT `<specifics>`: `@url`/`@github` only on `Examples` blocks. Plugin features: add `| kind | cascade |` as the first row of every `has these fields:` table.

---

### `scripts/check-features.mjs` (gate, batch)

**Analog A (entry/exit/reporting):** `scripts/check-workflow-install-scripts.mjs` lines 67-100:
```javascript
function main() {
  const projectRoot = parseProjectRoot(process.argv.slice(2));
  const violations = checkWorkflowInstallScripts(projectRoot);

  if (violations.length === 0) {
    if (process.env.CI) {
      process.stdout.write("Workflow install-scripts gate passed.\n");
    }

    return;
  }

  for (const violation of violations) {
    process.stderr.write(`missing ${ignoreScriptsFlag}: ${violation.path}:${violation.line}: ${violation.text}\n`);
  }

  process.stderr.write(`Workflow install-scripts gate failed with ${violations.length} violation(s).\n`);
  process.exitCode = 1;
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
```
(Make `main` async and `await` it; quiet unless `CI`, per run-parallel convention.)

**Analog B (fs walk):** `scripts/check-corresponding-tests.mjs` lines 1-27:
```javascript
const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
function toProjectPath(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}
function filesBelow(projectRoot, relativeRoot, predicate) {
  ...
  return readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => toProjectPath(projectRoot, path.join(entry.parentPath, entry.name)))
    .sort();
}
```
Core: the `loadConfiguration` / `runCucumber` dry-run in RESEARCH Pattern 5 (tagExpression `""`, order `defined`, parallel 0, sink stdout; count `testCase` envelopes; never trust `success`). Linted under the `scripts/**/*.mjs` block (eslint.config.js line 513, `disableTypeChecked`, node globals) — `process.stdout.write` is fine there.

---

### `package.json`

Copy line 98 shape: `"check:features": "node scripts/check-features.mjs"`, and append `check:features` to line 88:
```json
"check:static": "node scripts/run-parallel.mjs typecheck lint lint:workflows fallow format:check test:corresponding",
```

### `cucumber.json`

Add `"tags": "not @url and not @github"` to the existing `default` profile (RESEARCH Code Examples). Prettier covers it (format script includes `cucumber.json`).

### `eslint.config.js` (two `features/` blocks)

**Analog:** BLOCK F, lines 361-392 (a `files`-scoped object with `no-restricted-imports` `paths/patterns` + `no-restricted-syntax` selector array, each with a `message`, preceded by a rationale comment). No existing block sets these rules for `features/`, so new blocks override nothing (the `tests/**` block at 457 sets `no-restricted-syntax: off` but does not match `features/`). Place after the global `**/*.{js,ts}` block (line 140); use the measured selectors in RESEARCH Pattern 6 verbatim.

### `.agents/skills/cucumber/SKILL.md`, `rules/steps.md`, `rules/features.md`

Replace the `npx cucumber-js --dry-run --format usage` sentences (SKILL.md line 26, steps.md line 66) with `npm run check:features` (Pitfall 3). Document the multi-kind Outline with `@url`/`@github` on `Examples` blocks only near features.md line 34 (and reconcile its "three or more variants" rule, Pitfall 4).

## Shared Patterns

### Module header + import order
**Source:** every `features/**/*.ts` (e.g. `command.steps.ts` lines 1-21). `@fileoverview` block; `node:` imports, blank line, `@cucumber/cucumber` / `typebox`, blank line, relative value imports, blank line, `import type` last. `.ts` extensions on relative imports.

### Step definitions
**Source:** `command.steps.ts` lines 83-111, `session.steps.ts`. Anonymous `function (this: PluginWorld, ...)` when using the world; Cucumber expressions only; no exports; assert with `node:assert/strict` `deepStrictEqual` against `table.raw()` (whole-value compare).

### Strict single-payload assertion
**Source:** `pi-commands.ts` line 63 `assert.strictEqual(payloads.length, 1, JSON.stringify(payloads))`. Never `find`/`filter` for "the" result.

### Given-setup success check
**Source:** `command.steps.ts` line 85 / `marketplace.steps.ts` line 33: `assert.strictEqual(payload.severity, "info", JSON.stringify(payload))`.

### Gate script conventions
**Source:** `scripts/check-workflow-install-scripts.mjs` 67-100; `scripts/run-parallel.mjs` header (quiet unless `CI`).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Cucumber API usage in `scripts/check-features.mjs` | gate | batch | No script uses `@cucumber/cucumber/api`; use RESEARCH Pattern 5 (measured). |
| url/github arms of the kind dispatcher | utility | n/a | Kinds land in Phase 9; throw a clear error. |

## Metadata

**Analog search scope:** `features/**`, `scripts/*.mjs`, `eslint.config.js`, `cucumber.json`, `package.json`, `.agents/skills/cucumber/**`
**Files scanned:** 20
**Pattern extraction date:** 2026-10-15
