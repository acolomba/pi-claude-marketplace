/**
 * @fileoverview Steps that every agent feature shares: the agents a published
 * plugin holds (HAR-07, AGT-01, D-08).
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given } from "@cucumber/cucumber";

import { agentFileText, publishAgentFile } from "../../lib/agent-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the published plugin {string} of the marketplace {string} has the agent {string} described as {string} with this body:",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    agent: string,
    description: string,
    body: string,
  ) {
    const published = this.requirePublished(name);
    const file = await publishAgentFile(published, plugin, { name: agent, description, body });
    assert.strictEqual(
      await readFile(file, "utf8"),
      agentFileText({ name: agent, description, body }),
    );
  },
);
