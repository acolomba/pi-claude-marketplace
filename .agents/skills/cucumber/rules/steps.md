# Step modules

Part of the `cucumber` skill: `.agents/skills/cucumber/SKILL.md`.

Read `.agents/skills/cucumber/rules/layout.md` first: it decides which modules exist, where they live, and what each may register or import. This file covers writing them. A step module looks like this:

```ts
/**
 * @fileoverview Steps about orders: the lines they hold, placing them, and what they record.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { readOrderLines } from "../lib/order-lines.ts";

import type { ScenarioWorld } from "../support/world.ts";

Given("the order holds these lines:", function (this: ScenarioWorld, table: DataTable): void {
  this.lines = readOrderLines(table);
});

When("the customer places the order", async function (this: ScenarioWorld): Promise<void> {
  this.order = await this.shop.placeOrder(this.lines);
});

Then("the order has these lines:", function (this: ScenarioWorld, table: DataTable): void {
  const lines = this.order.lines.map((line) => [
    line.item,
    String(line.quantity),
    String(line.subtotal),
  ]);
  assert.deepStrictEqual([["item", "quantity", "subtotal"], ...lines], table.raw());
});
```

`readOrderLines()` in `features/lib/order-lines.ts` checks the header and converts every row to a typed line, throwing on a missing or unknown column.

## Tools

Use `@cucumber/cucumber` for the runner, `node:assert/strict` for assertions, and the world for scenario state. Node runs the `.ts` files directly.

## Step modules

- Start each module with an `@fileoverview` that says what its steps own.
- A step module exports nothing. Lint rejects a step module that exports anything.
- Order the registrations `Given`, then `When`, then `Then`.

## Steps

- Register a step that reads or writes the world with an anonymous `function` expression taking a typed `this`: `Given("the name {string}", function (this: ScenarioWorld, name: string) { ... })`. An arrow cannot reach the world, because Cucumber passes it as `this` and an arrow ignores that binding. A step that never touches the world is an arrow: lint's `prefer-arrow-callback` rejects a `function` expression whose body does not use `this`.

- Keep each step short. `Given` records or sets up the thing given, `When` performs the action, `Then` asserts the condition.

- A `Given` that performs setup asserts that the setup succeeded, so a broken precondition fails in the `Given` and not in a later `Then`.

- A setup command runs through `the user has run <command>`. The command may emit any number of payloads, and the step requires each one to be info.

- A setup command that must fail, such as the first attempt of a retry, runs through `the user has run <command>, which failed`. The step asserts that every payload the command emits is an error, so a retry scenario fails in its setup when the first attempt succeeds.

- The config steps read the layer configs a user owns and never write them, with three exceptions. All three write through `features/lib/layer-config.ts`. The step `a config in scope <scope> and layer <layer>, with these plugins:` writes the `plugins` member of one layer config and keeps the other members of the file. The step `a config in scope <scope> and layer <layer>, with these marketplaces:` writes the `marketplaces` member of one layer config from a `| name | source | autoupdate |` table and keeps the other members of the file. It expands the run tokens in each source, so a local marketplace is `{home}/marketplaces/<name>`. These two steps model a hand edit, or a version-control update of the base config. The step `a config in scope <scope> and layer <layer>, with this text:` writes the whole text of one layer config from a doc string. It models a hand edit that breaks the file. No other config step writes.

- A `Then` reads what the `When` left on the world. It has five exceptions to the rule against side effects. A row comparison calls `this.markRowsCompared()` after its comparison. A comparison of every result calls `this.markResultsCompared()`. A step that lists one row per result also calls `this.markNoticesCompared()`. A completion set comparison calls `this.markCompletionsCompared()`. A TUI notice comparison calls `this.markTuiNoticesCompared()`. These markers let the world fail a scenario that leaves a result, completion set, or TUI notice unchecked (`.agents/skills/cucumber/rules/world-and-stand-ins.md`). No other `Then` writes to the world.

- A request-log step, such as `the git host receives these requests:` or the step that states an empty log, compares only the requests of the last `When` step. A `BeforeStep` hook opens a new request window at each `When`, so the requests of a `Given` or of an earlier command are never part of it. Unlike the row arrays, the log has no compared-marker, so a command's requests go unchecked unless a log step states them. Log steps appear only in the feature files whose scenarios use git sources (the git source kinds of marketplaces and of plugins, and the official marketplace) and in the feature file of refused source forms (`features/marketplace/unsupported-source.feature`), never in an Outline that a verb feature shares with the local kinds.

- Assert with `node:assert/strict`, comparing whole values: build the expected record or row set from the step argument and `deepStrictEqual` it against the same projection of the actual value. No `assert.ok(x.includes(...))`.

- A `Then` compares a data table as strings: project the actual value to rows of strings, header included, and `deepStrictEqual` them against `table.raw()`. A `Given` that needs typed values reads the table through a parser in `features/lib/` that throws on a missing or unknown column. `noUncheckedIndexedAccess` types every cell as `string | undefined`, and a default such as `?? ""` hides a typo in the feature.

- Step text uses Cucumber expressions (`{string}`, `{int}`, `{word}`), never regular expressions. A custom parameter type is defined in the support module named after what it parses.

- Step text is a string literal. Lint rejects a regular expression or a variable in its place. Its check reads the callee by name, so lint also rejects a step registered through `defineStep`, a renamed import of `Given`, `When`, or `Then`, and a namespace import of `@cucumber/cucumber`. A local alias such as `const step = Given` still escapes lint, so `npm run check:features` also fails on any registered step text that is not a Cucumber expression.

- A step that types a command expands the run tokens in it before it sends the command, and a step that reads a result projects the run tokens back. `.agents/skills/cucumber/rules/features.md` lists the tokens. The text of a step definition never contains a token, because a brace in a Cucumber expression names a parameter type.

- Every step text matches exactly one definition, and every definition is used. `npm run test:cucumber` fails on an undefined or ambiguous step in the rows it runs. `npm run check:features` fails on an unused, undefined, or ambiguous step in every row, including the rows that `cucumber.json` excludes.

## Errors

- Do not catch exceptions in step, support, or library code to log them. Let them bubble up: the stack trace is more useful than a log line.
