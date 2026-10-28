/**
 * @fileoverview Steps about plugin updates and the repair each failed update names.
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

Then("the failed update names these repairs:", function (this: ScenarioWorld, table: DataTable) {
  const result = this.lastResult();
  if (result.kind !== "cascade") {
    assert.fail(`expected a cascade result, got ${JSON.stringify(result)}`);
  }

  const repairs = result.marketplaces.flatMap((marketplace) =>
    marketplace.plugins.map((plugin) => [
      marketplace.name,
      marketplace.scope,
      plugin.id,
      plugin.name,
      plugin.status,
      plugin.reasons.join(", "),
      plugin.scope ?? "",
      "from" in plugin ? (plugin.from ?? "") : "",
      "version" in plugin ? (plugin.version ?? "") : "",
      plugin.cause?.causeChain[0] ?? "",
      plugin.cause === undefined ? "" : String(plugin.cause.truncated),
      (plugin.leaks ?? []).join(", "),
      (plugin.rollbackPartial ?? []).map(({ phase }) => phase).join(", "),
    ]),
  );
  assert.deepStrictEqual(
    [
      [
        "marketplace name",
        "marketplace scope",
        "id",
        "name",
        "status",
        "reasons",
        "scope",
        "from",
        "version",
        "repair",
        "cause truncated",
        "leaks",
        "rollback phases",
      ],
      ...repairs,
    ],
    table.raw(),
  );
  this.markRowsCompared();
});
