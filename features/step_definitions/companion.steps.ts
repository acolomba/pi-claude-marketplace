/**
 * @fileoverview Steps about the companion extensions of a profile Pi:
 * starting it with the companions a scenario names (HAR-01, D-CF1-15), in a
 * trusted or an untrusted project (D-CF1-07, HAR-06).
 *
 * Each companion loads from the `pi.extensions` entry of its package in the
 * optional peer cache, at the declared floor. A companion that loaded lists
 * at least one command from its own package. Pi trusts a project that holds
 * no trust-requiring resource, whatever its trust store says, so a scenario
 * that compares trust gives the project a pi settings file.
 */

import assert from "node:assert/strict";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import { listedCommands } from "../../test/e2e/_rpc.ts";
import { parseCompanionName, resolveCompanion } from "../lib/companions.ts";

import type { ScenarioWorld } from "../support/world.ts";

// Pi loads every extension twice in a project that needs a trust decision,
// once to ask the extensions and once with the decision. With a cold compile
// cache and a loaded runner, that start overran the 30-second default.
const UNTRUSTED_START_TIMEOUT_MS = 60_000;

// Starts the profile Pi with the companions `table` names, trusting the
// project or not, and asserts that each companion loaded. The world loads
// them in a fixed order, whatever order the table names them in (HAR-01).
async function startWithCompanions(
  world: ScenarioWorld,
  table: DataTable,
  trust: "trusted" | "untrusted",
): Promise<void> {
  const [header, ...rows] = table.raw();
  assert.deepStrictEqual(header, ["companion"]);
  const names = rows.map(([name]) => parseCompanionName(name ?? ""));
  await world.usePiWithProfile({ companions: names, trust });
  const { response } = await world.pi.request({ type: "get_commands" });
  const commands = listedCommands(response);
  const companions = await Promise.all(names.map((name) => resolveCompanion(name)));
  const loaded = companions.map(({ name, root }) => ({
    name,
    loaded: commands.some(
      ({ sourcePath }) => sourcePath?.startsWith(`${root}${path.sep}`) === true,
    ),
  }));
  assert.deepStrictEqual(
    loaded,
    names.map((name) => ({ name, loaded: true })),
  );
}

// HAR-06: `.pi/settings.json` is a trust-requiring resource, so with it the
// trust store entry alone decides whether Pi trusts the project.
Given("the project holds a pi settings file", async function (this: ScenarioWorld) {
  const file = path.join(this.scopeRoot("project"), "settings.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "{}\n", { flag: "wx" });
  this.onRelease(() => rm(file, { force: true }));
  assert.strictEqual(await readFile(file, "utf8"), "{}\n");
});

Given(
  "pi runs with the scripted model and these companions:",
  async function (this: ScenarioWorld, table: DataTable) {
    await startWithCompanions(this, table, "trusted");
  },
);

// D-CF1-07: an untrusted profile Pi starts with no entry in Pi's trust store.
Given(
  "pi runs with the scripted model and these companions in an untrusted project:",
  { timeout: UNTRUSTED_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, table: DataTable) {
    await startWithCompanions(this, table, "untrusted");
    await assert.rejects(access(path.join(this.tokens.agentDir, "trust.json")), {
      code: "ENOENT",
    });
  },
);
