/**
 * @fileoverview Steps about the MCP servers a new revision of a git plugin
 * repository declares, which a fetch reads under the active MCP
 * implementation (P3-DC-25).
 */

import assert from "node:assert/strict";

import { Given } from "@cucumber/cucumber";

import { runGit } from "../../lib/hermetic-git.ts";
import { pushPluginFile } from "../../lib/mcp-verdict-git.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the git repository {string} adds this .mcp.json to the plugin {string}:",
  async function (this: ScenarioWorld, name: string, plugin: string, text: string) {
    const before = this.requireGitRepository(name);
    const { repository, pushedPath } = await pushPluginFile(before, plugin, ".mcp.json", text);
    this.recordGitRepository(repository);
    const { bareRepository, gitHome, revisions } = repository;
    assert.deepStrictEqual(
      {
        main: await runGit(bareRepository, gitHome, "rev-parse", "main"),
        file: await runGit(bareRepository, gitHome, "show", `main:${pushedPath}`),
      },
      { main: revisions.at(-1), file: text.trim() },
    );
    assert.notStrictEqual(revisions.at(-1), before.revisions.at(-1));
  },
);
