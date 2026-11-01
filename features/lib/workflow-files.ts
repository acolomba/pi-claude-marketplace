/**
 * @fileoverview Writes the workflows of a published plugin, and reads what a
 * workflow command leaves in Pi's records (HAR-07, D-CF1-17).
 *
 * A workflow script is what the workflow engine runs: an exported `meta` with
 * the workflow's name and description as its first statement, then a
 * statement body that ends in a `return`, never an `export default`. The
 * script lives at `workflows/<name>.js` inside the plugin.
 *
 * The engine handles a workflow command itself, so Pi answers `handled` and
 * starts no model turn. A run appends progress entries to Pi's session, and Pi
 * prints each one as a record.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { promptDisposition } from "../../test/e2e/_rpc.ts";

import { writePublishedPluginFile } from "./published-marketplace.ts";
import { modelCallsOf } from "./scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "./turn-records.ts";

import type { PiProcess, RpcRecord } from "./pi-process.ts";
import type { PublishedMarketplace } from "./published-marketplace.ts";

/** A workflow of a plugin: its name, its description, and the text its script returns. */
export interface PluginWorkflow {
  readonly name: string;
  readonly description: string;
  readonly returns: string;
}

/**
 * What one workflow command left: the command as sent, the disposition Pi
 * reported for it, every record Pi printed from the command on, and the lines
 * each stand-in log gained, by file name. It has the shape of the world's
 * model turn.
 */
export interface WorkflowCommandTurn {
  readonly prompt: string;
  readonly disposition: string;
  readonly records: readonly RpcRecord[];
  readonly logs: ReadonlyMap<string, readonly unknown[]>;
}

const PROGRESS_ENTRY = "pi-dynamic-workflows:progress";

const DIALOG_METHODS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

/** Returns the text of the script of `workflow`: its `meta`, then a `return` of its value. */
export function workflowScriptText(workflow: PluginWorkflow): string {
  const meta = JSON.stringify({ name: workflow.name, description: workflow.description });
  return `export const meta = ${meta};\n\nreturn ${JSON.stringify(workflow.returns)};\n`;
}

/**
 * Writes `workflow` into the published plugin `plugin`, which must not hold
 * it yet, and returns the path of its script.
 */
export async function publishWorkflow(
  published: PublishedMarketplace,
  plugin: string,
  workflow: PluginWorkflow,
): Promise<string> {
  return writePublishedPluginFile(
    published,
    plugin,
    path.join("workflows", `${workflow.name}.js`),
    workflowScriptText(workflow),
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns the data of the progress entry the workflow engine appended in
 * `record`, or undefined for any other record.
 */
export function progressOf(record: RpcRecord): Readonly<Record<string, unknown>> | undefined {
  const { entry } = record;
  if (
    record.type !== "entry_appended" ||
    !isRecord(entry) ||
    entry.type !== "custom" ||
    entry.customType !== PROGRESS_ENTRY ||
    !isRecord(entry.data)
  ) {
    return undefined;
  }

  return entry.data;
}

// An extension error or a dialog after a workflow command is never expected.
function isRunFault(record: RpcRecord): boolean {
  return (
    record.type === "extension_error" ||
    (record.type === "extension_ui_request" &&
      typeof record.method === "string" &&
      DIALOG_METHODS.has(record.method))
  );
}

/**
 * Sends the workflow command `command` to `pi`, requires Pi to answer
 * `handled`, waits for `settle` with the index of the first record of the
 * command, and returns what the command left. Fails when Pi reports an
 * extension error or opens a dialog, or when the command called the model
 * whose logs `harness` holds.
 */
export async function sendWorkflowCommand(
  pi: PiProcess,
  harness: string,
  command: string,
  settle: (from: number) => Promise<unknown>,
): Promise<WorkflowCommandTurn> {
  const from = pi.recordCount();
  const lengths = await readLogLengths(harness);
  const { response } = await pi.request({ type: "prompt", message: command });
  assert.strictEqual(promptDisposition(response), "handled", JSON.stringify(response));
  await settle(from);
  const records = pi.recordsSince(from);
  assert.deepStrictEqual(records.filter(isRunFault), []);
  const logs = await readLogLinesSince(harness, lengths);
  assert.deepStrictEqual(modelCallsOf(logs), [], "the workflow command called the model");
  return { prompt: command, disposition: "handled", records, logs };
}
