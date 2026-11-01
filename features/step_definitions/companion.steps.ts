/**
 * @fileoverview Steps about the companion extensions of a profile Pi:
 * starting it with the companions a scenario names (HAR-01, D-CF1-15).
 *
 * Each companion loads from the `pi.extensions` entry of its package in the
 * optional peer cache, at the declared floor. A companion that loaded lists
 * at least one command from its own package.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import { listedCommands } from "../../test/e2e/_rpc.ts";
import { parseCompanionName, resolveCompanion } from "../lib/companions.ts";

import type { ScenarioWorld } from "../support/world.ts";

// The world loads the companions in a fixed order, whatever order the table
// names them in (HAR-01).
Given(
  "pi runs with the scripted model and these companions:",
  async function (this: ScenarioWorld, table: DataTable) {
    const [header, ...rows] = table.raw();
    assert.deepStrictEqual(header, ["companion"]);
    const names = rows.map(([name]) => parseCompanionName(name ?? ""));
    await this.usePiWithProfile({ companions: names });
    const { response } = await this.pi.request({ type: "get_commands" });
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
  },
);
