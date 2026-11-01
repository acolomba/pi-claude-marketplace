/**
 * @fileoverview Steps about the record of project installs a project skill
 * needs: a project whose plugin files the user's pi directory does not record
 * as installed by the user, as in a clone of a repository that commits them
 * (D-CF2-13).
 */

import assert from "node:assert/strict";
import { access, appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

/** The user's record of the plugins installed into projects, under the agent directory. */
function projectInstallsRecord(world: ScenarioWorld): string {
  return path.join(world.tokens.agentDir, "pi-claude-marketplace", "project-installs.json");
}

// D-CF2-13: the project keeps its `.pi/pi-claude-marketplace/` tree and the
// `state.json` that names the skill, as a clone of a repository that commits
// them does; only the user's own record of the install is gone.
Given(
  "the user's pi directory records no plugin install for the project",
  async function (this: ScenarioWorld) {
    const ledger = projectInstallsRecord(this);
    await rm(ledger, { force: true });
    await assert.rejects(access(ledger), { code: "ENOENT" });
    await access(path.join(this.tokens.projectDir, ".pi", "pi-claude-marketplace", "state.json"));
  },
);

// WR-03: a change to the staged skill directory after the install, such as
// one a pull of a repository that commits it brings: an edited `SKILL.md`, an
// edited script that a context command runs, or an added file.
Given(
  "the line {string} was appended to the file {string} of the staged project skill {string}",
  async function (this: ScenarioWorld, line: string, file: string, skill: string) {
    const target = path.join(
      this.tokens.projectDir,
      ".pi",
      "pi-claude-marketplace",
      "resources",
      "skills",
      skill,
      file,
    );
    await mkdir(path.dirname(target), { recursive: true });
    await appendFile(target, `\n${line}\n`, "utf8");
    const appended = `\n${line}\n`;
    assert.strictEqual((await readFile(target, "utf8")).slice(-appended.length), appended);
  },
);

// WR-02: content this version did not write, such as a later layout.
Given(
  "the user's record of project skill installs was replaced with this text:",
  async function (this: ScenarioWorld, text: string) {
    const record = projectInstallsRecord(this);
    await mkdir(path.dirname(record), { recursive: true });
    await writeFile(record, text, "utf8");
    assert.strictEqual(await readFile(record, "utf8"), text);
  },
);

Then(
  "the user's record of project skill installs holds this text:",
  async function (this: ScenarioWorld, text: string) {
    assert.strictEqual(await readFile(projectInstallsRecord(this), "utf8"), text);
  },
);
