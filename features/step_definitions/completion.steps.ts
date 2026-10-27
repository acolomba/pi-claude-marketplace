/** @fileoverview Steps that capture and compare complete plugin command completion sets. */

import assert from "node:assert/strict";

import { Then, When } from "@cucumber/cucumber";

import { pluginCompletions } from "../lib/plugin-completions.ts";

import type { ScenarioWorld } from "../support/world.ts";

When(
  "the user requests plugin completions for {string}",
  async function (this: ScenarioWorld, prefix: string): Promise<void> {
    this.recordCompletions(prefix, await pluginCompletions(prefix, this.tokens.projectDir));
  },
);

Then(
  "the plugin completion set for {string} matches {string}",
  function (this: ScenarioWorld, first: string, second: string): void {
    const projection = (prefix: string) =>
      this.completionsFor(prefix).map(({ label, description }) => ({ label, description }));
    assert.deepStrictEqual(projection(first), projection(second));
    this.markCompletionsCompared(first);
    this.markCompletionsCompared(second);
  },
);

Then(
  "the plugin completion set for {string} is empty",
  function (this: ScenarioWorld, prefix: string): void {
    assert.deepStrictEqual(this.completionsFor(prefix), []);
    this.markCompletionsCompared(prefix);
  },
);
