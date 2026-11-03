/**
 * @fileoverview Steps that load the workflow engine into Pi after a plugin
 * with workflows was installed without it (WDEP-02).
 *
 * The step adds the engine's package to Pi's user settings, the way
 * `pi install` records a package, so the next session loads it as `/reload`
 * would. Pi's RPC mode cannot run the `/reload` builtin, so a scenario starts
 * a new session instead, which re-reads Pi's settings and extensions the same
 * way.
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { resolveCompanion } from "../../lib/companions.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// Returns the text of `file`, or undefined when it does not exist.
async function readTextIfPresent(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

// A profile Pi already keeps its auto-retry choice in the settings file, so
// the step adds a `packages` member beside it, as `pi install` does, and
// fails rather than replace packages it did not write. Every Pi of the
// worker's sandbox reads this file, so the release puts back the text it
// found: a stale entry would load the engine into the shared Pi at its next
// new session.
Given(
  "the user has added the pi-dynamic-workflows package to pi's settings",
  async function (this: ScenarioWorld): Promise<void> {
    const { root } = await resolveCompanion("pi-dynamic-workflows");
    const file = path.join(this.tokens.agentDir, "settings.json");
    const found = await readTextIfPresent(file);
    const current = (found === undefined ? {} : JSON.parse(found)) as Record<string, unknown>;
    assert.strictEqual(Object.hasOwn(current, "packages"), false, `${file} lists packages`);
    const settings = { ...current, packages: [root] };
    await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`);
    this.onRelease(() =>
      found === undefined ? rm(file, { force: true }) : writeFile(file, found),
    );
    assert.deepStrictEqual(JSON.parse(await readFile(file, "utf8")), settings);
  },
);
