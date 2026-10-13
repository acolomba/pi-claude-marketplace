/**
 * @fileoverview Steps that run `/claude:plugin` commands in a headless Pi.
 *
 * A `Given` command is setup and must succeed. A `When` command is the action
 * under test, and its result is kept on the world for the `Then` steps.
 */

import assert from "node:assert/strict";

import { Given, When } from "@cucumber/cucumber";

import { runCommand } from "../pi-commands.ts";

import type { PluginWorld } from "../world.ts";

async function priorCommand(this: PluginWorld, command: string): Promise<void> {
  const payload = await runCommand(this.sandbox, command);
  assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
}

Given("the user has run {string}", priorCommand);

async function runUserCommand(this: PluginWorld, command: string): Promise<void> {
  this.result = await runCommand(this.sandbox, command);
}

When("the user runs {string}", runUserCommand);
