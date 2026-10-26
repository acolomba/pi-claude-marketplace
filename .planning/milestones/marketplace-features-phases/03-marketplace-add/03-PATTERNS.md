# Phase 3: Marketplace Add - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 5 (3 modified, 2 new; `remove.steps.ts` not created under Option 1)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/marketplace/add.feature` (extend) | test (Gherkin) | request-response | itself (seeds, lines 1-80) + `features/plugin/install.feature:45-67` (failure envelope) | exact |
| `features/marketplace/remove.feature` (new) | test (Gherkin) | request-response | `features/marketplace/add.feature:1-20`, `features/marketplace/update.feature:1-6` | exact |
| `features/step_definitions/marketplace/add.steps.ts` (new) | test step module | file-I/O setup | `features/step_definitions/marketplace/publishing.steps.ts` | exact |
| `features/lib/path-marketplace.ts` (modify) | test utility (fixture) | file-I/O | itself: `writeMarketplace` (56-75), `writeInvalidManifest` (77-88) | exact |
| `features/lib/published-marketplace.ts` (modify) | test utility (kind dispatch) | transform | itself: `publishMarketplace` (40-63), `invalidateManifest` (65-83) | exact |

## Pattern Assignments

### `features/marketplace/add.feature` (extend)

**Analog:** the Phase 1 seeds in the same file.

Success Outline with three Examples blocks (lines 7-35): untagged dir/file block, then `@url` and `@github` blocks, each with a `source kind` column:
```gherkin
  Scenario Outline: Adding a marketplace records it in the chosen scope
    Given the marketplace "tools" is published as a <source kind> source
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |
```
- ADD-02 (no `--scope`): copy the ADD-14 single-scenario shape (lines 36-48) with `{home}/marketplaces/tools` and `user` scope.
- ADD-05: copy the Outline above with an extra `Given the marketplace "tools" is added to the user scope` (seed line 52 pattern) and two config `Then`s (user, project).
- ADD-13: single scenario; seed base via `Given the marketplace "extras" is added to the project scope`, `When ... --local`, then two config `Then`s (`claude-plugins.json`, `claude-plugins.local.json`). No new session (Pitfall 9).

**Failure envelope** (from `features/marketplace/info.feature:27-31` / `features/plugin/install.feature:48-52`) — four rows, `summary` required, no `severity` in the row table:
```gherkin
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name  | scope   | status | reasons        |
      | tools | project | failed | duplicate name |
```
- ADD-06: untagged Examples with only a `source` column (no `source kind`); row name = `<source>` as typed (incl. literal `~/marketplaces/missing`). No config `Then` (Pitfall 5).
- ADD-07: Examples columns `| manifest problem | source kind | source |`; 4 untagged dir/file rows + `@url` block of 2. No config `Then`.
- ADD-04: Examples `| source kind | source | second source |`; 2 dir rows + `@url` block of 2; config `Then` on project scope with `<source>`.
- Every scenario must have a row step (`world.ts` After hook) and no `Given` after `When`/`Then`; never use `And`/`But`.

---

### `features/marketplace/remove.feature` (new)

**Analog:** header of `features/marketplace/add.feature:1-5`:
```gherkin
Feature: Marketplace add

  Adding a marketplace records it in a scope under the name its manifest declares.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use local marketplaces in place of published ones.
```
Title must be `Feature: Marketplace remove` (gate: kebab of file name) with a 2-3 line description true for Phase 4's later scenarios. Body: use RESEARCH.md "remove --local (Option 1)" sketch verbatim in shape; setup `--local` adds use `Given the user has run "..."` (`command.steps.ts:101-104`, asserts severity info). Success envelope is three rows (no summary).

---

### `features/step_definitions/marketplace/add.steps.ts` (new)

**Analog:** `features/step_definitions/marketplace/publishing.steps.ts`

**Header + imports** (lines 1-23) — `@fileoverview` saying what the module owns; builtin, external, lib, then `import type` last; exports nothing:
```ts
/**
 * @fileoverview Steps that publish local marketplaces by source kind and add
 * them to a scope, shared by every marketplace verb.
 * ...
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import { readOfferedPlugins } from "../../lib/path-marketplace.ts";
import { runCommand } from "../../lib/pi-commands.ts";
import { invalidateManifest, publishMarketplace } from "../../lib/published-marketplace.ts";

import type { PublishedMarketplace, SourceKind } from "../../lib/published-marketplace.ts";
import type { ScenarioWorld } from "../../support/world.ts";
```

**Publish-with-release pattern** (lines 35-46) — copy for "another marketplace named X to add ... in Y" and "directory X to add holds no marketplace manifest":
```ts
Given(
  "the marketplace {string} is published as a {source kind} source",
  async function (this: ScenarioWorld, name: string, kind: SourceKind) {
    if (this.publishedMarketplace(name) !== undefined) {
      assert.fail(`the marketplace ${name} is already published in this scenario`);
    }

    const root = path.join(this.marketplacesRoot, name);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    this.recordPublished(name, await publishMarketplace(this.marketplacesRoot, name, kind, []));
  },
);
```
Deviation: the second-publish step registers `onRelease` for its own directory but must NOT call `this.recordPublished("tools", ...)` (Pitfall 6).

**Manifest-break pattern** (lines 72-77) — copy for the two literal ADD-07 steps (`... to add is not valid json`, `... to add breaks the manifest schema`); `requirePublished` (lines 26-33) is module-private in publishing.steps.ts, so add.steps.ts needs its own small lookup or uses `this.publishedMarketplace(name)` + `assert.fail`:
```ts
Given(
  "the manifest of the marketplace {string} has become invalid",
  async function (this: ScenarioWorld, name: string) {
    await invalidateManifest(this.marketplacesRoot, name, requirePublished(this, name));
  },
);
```
Rules: Cucumber expressions only (no regex), step text lower case and naming "add", `{source kind}` parameter type (`features/support/source-kind.ts`), each new step committed with the scenario that first uses it (Pitfall 3).

---

### `features/lib/path-marketplace.ts` (modify)

**Analog:** same file, lines 55-88. Extract the manifest object/text once so the valid, schema-invalid, and malformed writers do not clone it:
```ts
export async function writeMarketplace(root: string, name: string, plugins: readonly OfferedPlugin[]): Promise<void> {
  await Promise.all(plugins.map((plugin) => writePlugin(root, plugin)));
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await writeFile(
    manifestPath(root),
    JSON.stringify({
      name,
      owner: { name: "features" },
      plugins: plugins.map((plugin) => ({ name: plugin.name, source: `./plugins/${plugin.name}`, version: plugin.version })),
    }),
  );
}

export async function writeInvalidManifest(root: string, name: string): Promise<void> {
  await writeFile(
    manifestPath(root),
    JSON.stringify({ name, owner: { name: "features" }, plugins: "nope" }),
  );
}
```
New `writeMalformedManifest(root, name)` = valid text `.slice(0, -1)` (56 bytes vs 57 valid vs 61 schema-invalid; size rule from RESEARCH "Manifest Cache"). Doc comment explains the size choice, like lines 77-82. Possibly a tiny empty-directory helper (`mkdir(..., { recursive: true })`) or inline in the step.

---

### `features/lib/published-marketplace.ts` (modify)

**Analog:** same file, lines 40-83. Kind-dispatch switch with url/github throwing `noStandIn`:
```ts
export async function invalidateManifest(
  marketplacesRoot: string,
  name: string,
  published: PublishedMarketplace,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      await writeInvalidManifest(path.join(marketplacesRoot, name), name);
      return;
    case "url":
    case "github":
      throw noStandIn(published.kind);
  }
}
```
Parameterize rather than clone (Pitfall 8, fallow audit fails on new clone groups): add a manifest-problem argument to `invalidateManifest` (schema vs malformed), and a directory argument to `publishMarketplace` (lines 45-63: `const root = path.join(marketplacesRoot, name)`) with the existing signature delegating to it. Run `npx fallow dupes` after edits.

## Shared Patterns

### Command/result steps (no change)
**Source:** `features/step_definitions/command.steps.ts:101-115`
```ts
Given("the user has run {string}", async function (this: ScenarioWorld, command: string) {
  const payload = await runCommand(this.pi, expandTokens(command, this.tokens));
  assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
});
```
Apply to: `--local` setup adds in remove.feature. `When the user runs`, `the result has these fields:`, `the result lists these marketplaces:` used by every scenario.

### Config read step (no change)
**Source:** `features/step_definitions/config.steps.ts:31-60` — `the {string} file of the {word} scope declares these marketplaces:`; missing file fails by design (never after ADD-06/07 failures). Read-only module (D-07); a zero-declaration step is not needed under Option 1.

### Tokens
`{home}` expands in commands and projects back in rows (`features/lib/run-tokens.ts`); `~` is never a token, typed literally.

## No Analog Found

None. `features/step_definitions/marketplace/remove.steps.ts` is not needed under the recommended Option 1.

## Metadata

**Analog search scope:** `features/` (lib, step_definitions, support, marketplace, plugin)
**Files scanned:** 12
**Pattern extraction date:** 2026-10-16
