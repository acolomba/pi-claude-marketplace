/**
 * @fileoverview Marketplace-update setup that changes a published source in place.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { runCommand, runCommandPayloads } from "../../lib/pi-commands.ts";
import {
  invalidateManifest,
  publishConventionalDecoy,
  publishUnreadableSkillFile,
  restoreUnreadableSkillFile,
  removePublishedSource,
  rewritePublishedManifest,
  unreadableSkillCopyError,
} from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the marketplace {string} update source contains this manifest:",
  async function (this: ScenarioWorld, name: string, text: string) {
    await rewritePublishedManifest(this.requirePublished(name), text);
  },
);

// A bare update emits one cascade per marketplace and an MCP config notice
// after a cascade that rewrote a commented config. The update has succeeded
// when no cascade reports a failure.
Given("the user has updated every marketplace", async function (this: ScenarioWorld) {
  const payloads = await runCommandPayloads(this.pi, "/claude:plugin marketplace update");
  for (const payload of payloads) {
    if (payload.kind === "mcp-config-notices") {
      continue;
    }

    if (payload.kind !== "cascade") {
      assert.fail(`expected a cascade or an MCP config notice, got ${JSON.stringify(payload)}`);
    }

    assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
  }
});

Given(
  "the manifest of the marketplace {string} to update is not valid json",
  async function (this: ScenarioWorld, name: string) {
    await invalidateManifest(name, this.requirePublished(name), "malformed");
  },
);

Given(
  "the manifest of the marketplace {string} to update breaks the manifest schema",
  async function (this: ScenarioWorld, name: string) {
    await invalidateManifest(name, this.requirePublished(name), "schema-invalid");
  },
);

Given(
  "updating the marketplace {string} in the {word} scope has failed as unparseable",
  async function (this: ScenarioWorld, name: string, scope: string) {
    const payload = await runCommand(
      this.pi,
      `/claude:plugin marketplace update ${name} --scope ${scope}`,
    );
    assert.deepStrictEqual(
      {
        severity: payload.severity,
        marketplaces: payload.marketplaces.map((marketplace) => ({
          name: marketplace.name,
          status: marketplace.status,
          reasons: marketplace.plugins.map((plugin) => plugin.reasons),
        })),
      },
      {
        severity: "error",
        marketplaces: [{ name, status: "failed", reasons: [["unparseable"]] }],
      },
    );
  },
);

Given(
  "the published source of the marketplace {string} is removed",
  async function (this: ScenarioWorld, name: string) {
    await removePublishedSource(this.requirePublished(name));
  },
);

Given(
  "the published plugin {string} of the marketplace {string} has an unreadable skill file",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const published = this.requirePublished(name);
    const file = await publishUnreadableSkillFile(published, plugin);
    await assert.rejects(readFile(file), { code: "EACCES" });
    const scratch = await mkdtemp(path.join(this.tokens.home, "skill-copy-"));
    this.onRelease(() => rm(scratch, { recursive: true, force: true }));
    const error = await unreadableSkillCopyError(published, plugin, scratch);
    assert.deepStrictEqual([error.code, error.syscall], ["EACCES", "copyfile"]);
    this.recordErrorMessage("{unreadable skill file copy error}", error.message);
  },
);

Given(
  "the unreadable skill file of the published plugin {string} of the marketplace {string} can be read again",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const file = await restoreUnreadableSkillFile(this.requirePublished(name), plugin);
    assert.strictEqual(await readFile(file, "utf8"), "Unreadable.\n");
  },
);

Given(
  "a conventional decoy is published for the marketplace {string}",
  async function (this: ScenarioWorld, name: string) {
    await publishConventionalDecoy(this.requirePublished(name), name);
  },
);
