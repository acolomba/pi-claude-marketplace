/**
 * @fileoverview Writes the workflows of a published plugin: one script per
 * workflow, at `workflows/<name>.js` inside the plugin (HAR-07).
 *
 * The script is what the workflow engine runs: an exported `meta` with the
 * workflow's name and description as its first statement, then a statement
 * body that ends in a `return`, never an `export default`.
 */

import path from "node:path";

import { writePublishedPluginFile } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";

/** A workflow of a plugin: its name, its description, and the text its script returns. */
export interface PluginWorkflow {
  readonly name: string;
  readonly description: string;
  readonly returns: string;
}

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
