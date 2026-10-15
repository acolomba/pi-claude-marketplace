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
- A step module exports nothing.
- Order the registrations `Given`, then `When`, then `Then`.

## Steps

- Register a step that reads or writes the world with an anonymous `function` expression taking a typed `this`: `Given("the name {string}", function (this: ScenarioWorld, name: string) { ... })`. An arrow cannot reach the world, because Cucumber passes it as `this` and an arrow ignores that binding. A step that never touches the world is an arrow: lint's `prefer-arrow-callback` rejects a `function` expression whose body does not use `this`.

- Keep each step short. `Given` records or sets up the thing given, `When` performs the action, `Then` asserts the condition.

- A `Given` that performs setup asserts that the setup succeeded, so a broken precondition fails in the `Given` and not in a later `Then`.

- A `Then` has no side effects. It reads what the `When` left on the world.

- Assert with `node:assert/strict`, comparing whole values: build the expected record or row set from the step argument and `deepStrictEqual` it against the same projection of the actual value. No `assert.ok(x.includes(...))`.

- A `Then` compares a data table as strings: project the actual value to rows of strings, header included, and `deepStrictEqual` them against `table.raw()`. A `Given` that needs typed values reads the table through a parser in `features/lib/` that throws on a missing or unknown column. `noUncheckedIndexedAccess` types every cell as `string | undefined`, and a default such as `?? ""` hides a typo in the feature.

- Step text uses Cucumber expressions (`{string}`, `{int}`, `{word}`), never regular expressions. A custom parameter type is defined in the support module named after what it parses.

- Every step text matches exactly one definition, and every definition is used by at least one scenario. `npm run test:cucumber` fails on an undefined or ambiguous step but passes with an unused one; `npx cucumber-js --dry-run --format usage` lists unused definitions as `UNUSED`.

## Errors

- Do not catch exceptions in step, support, or library code to log them. Let them bubble up: the stack trace is more useful than a log line.
