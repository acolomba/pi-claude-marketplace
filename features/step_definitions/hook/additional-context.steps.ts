/**
 * @fileoverview Steps about a hook's context that is too long for the model:
 * the saved file and the preview the model receives in its place
 * (PG-HOOK-14, D-PG5-15).
 *
 * A context string over 10,000 characters is saved whole to a file, and the
 * model receives Claude Code's `<persisted-output>` wrapper, which names the
 * file and holds a preview of its head. The step reads each such message of
 * the last model call of the turn, reads the file it names, and states the
 * facts of both as one row.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { type DataTable, Then } from "@cucumber/cucumber";

import { projectTokens } from "../../lib/run-tokens.ts";
import { callMessageRows, modelCallsOf } from "../../lib/scripted-model/script.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The bridge's context label, then the wrapper, exactly as Claude Code
// 2.1.323 builds it.
const SAVED_OUTPUT =
  /^(?<label>[^\n]+?): (?<wrapper><persisted-output>\nOutput too large \((?<size>[^)\n]+)\)\. Full output saved to: (?<path>[^\n]+)\n\nPreview \(first 2KB\):\n(?<preview>[\s\S]*)\n\.\.\.\n<\/persisted-output>)$/u;

// The longest text the model may receive for one hook's string (D-PG5-14).
const CONTEXT_LIMIT = 10_000;

// The saved file's name holds an id the bridge draws for each string.
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gu;

interface SavedOutput {
  readonly label: string;
  readonly wrapper: string;
  readonly size: string;
  readonly path: string;
  readonly preview: string;
}

// The parts of one model message that holds a saved hook output; fails on
// any other text.
function savedOutputOf(text: string): SavedOutput {
  const groups = SAVED_OUTPUT.exec(text)?.groups;
  const part = (name: string): string => {
    const value = groups?.[name];
    if (value === undefined) {
      assert.fail(`not a saved hook output: ${text.slice(0, 300)}`);
    }

    return value;
  };

  return {
    label: part("label"),
    wrapper: part("wrapper"),
    size: part("size"),
    path: part("path"),
    preview: part("preview"),
  };
}

Then(
  "the model receives these saved hook outputs:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const lastCall = modelCallsOf(this.requireTurn().logs).at(-1);
    if (lastCall === undefined) {
      assert.fail("the last turn made no model call");
    }

    const outputs = callMessageRows([lastCall])
      .filter(([, , text]) => text.includes("<persisted-output>"))
      .map(([, , text]) => savedOutputOf(text));
    const rows: string[][] = [];
    for (const { label, wrapper, size, path, preview } of outputs) {
      const saved = await readFile(path, "utf8");
      assert.strictEqual(saved.startsWith(preview), true, "the preview is not the file's head");
      assert.strictEqual(wrapper.length <= CONTEXT_LIMIT, true, `${wrapper.length} characters`);
      rows.push([
        label,
        size,
        projectTokens("text", path, this.tokens).replaceAll(UUID_PATTERN, "{uuid}"),
        String(preview.length),
        String(saved.length),
      ]);
    }

    assert.deepStrictEqual(
      [["label", "size", "path", "preview characters", "saved characters"], ...rows],
      table.raw(),
    );
    this.markTurnCompared();
  },
);
