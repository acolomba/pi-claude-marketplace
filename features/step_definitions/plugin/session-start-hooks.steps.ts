/**
 * @fileoverview Steps about plugin session start hooks: the hook a published plugin
 * declares and what it records in the project directory.
 *
 * A session start hook appends one JSON line per run to a project file, with
 * the `session_id` and `source` Claude Code gives it on stdin. The steps name
 * each session by the order it first appears in, because its id differs on
 * every run.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { writePublishedPluginFiles } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The hook script: it appends the session id and source of its stdin to the
// project file its first argument names.
const SESSION_START_SCRIPT = [
  'const fs = require("node:fs");',
  'const path = require("node:path");',
  'const input = JSON.parse(fs.readFileSync(0, "utf8"));',
  "const line = JSON.stringify({ session: input.session_id, source: input.source });",
  'fs.appendFileSync(path.join(process.env.CLAUDE_PROJECT_DIR, process.argv[2]), line + "\\n");',
  "",
].join("\n");

const SESSION_ORDINALS: readonly string[] = ["first", "second", "third", "fourth"];

Given(
  "the published plugin {string} of the marketplace {string} has a session start hook that records each run in the project file {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, file: string) {
    const hooks = {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: `node "\${CLAUDE_PLUGIN_ROOT}/session-start.cjs" ${file}`,
              },
            ],
          },
        ],
      },
    };
    const files = {
      "hooks/hooks.json": `${JSON.stringify(hooks, null, 2)}\n`,
      "session-start.cjs": SESSION_START_SCRIPT,
    };
    const published = this.requirePublished(name);
    await writePublishedPluginFiles(published, plugin, files);
    const folder = path.join(published.root, "plugins", plugin);
    const written = await Promise.all(
      Object.keys(files).map(async (entry) => [
        entry,
        await readFile(path.join(folder, entry), "utf8"),
      ]),
    );
    assert.deepStrictEqual(Object.fromEntries(written), files);
  },
);

Then(
  "the project file {string} records these session start hook runs:",
  async function (this: ScenarioWorld, file: string, table: DataTable) {
    const text = await readFile(path.join(this.tokens.projectDir, file), "utf8");
    const sessions: string[] = [];
    const rows = text
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => {
        const { session, source } = JSON.parse(line) as { session: string; source: string };
        if (!sessions.includes(session)) {
          sessions.push(session);
        }

        const ordinal = SESSION_ORDINALS[sessions.indexOf(session)];
        assert.ok(ordinal !== undefined, `more sessions than ${SESSION_ORDINALS.length}`);
        return [ordinal, source];
      });
    assert.deepStrictEqual([["session", "source"], ...rows], table.raw());
  },
);
