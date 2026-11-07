/**
 * @fileoverview Stands in for another Pi extension whose tool makes Pi's tool
 * list unreadable to this extension (BLT-05): it registers one tool whose
 * namespace name throws when read.
 *
 * The tool's exposure is `hidden`, so Pi registers it but never offers or
 * runs it. Pi copies the namespace object into `getAllTools()` without
 * reading its name, and reads a namespace name only in tool search, in
 * codemode, and in its `/mcp` flows, which a status scenario does not run.
 * So the extension's built-in status reader is the only reader of the name.
 *
 * When Pi loads it, it registers the tool and logs one line to
 * `<harness dir>/unreadable-namespace-tool.jsonl`: the registration, or the
 * error Pi threw, which it does not pass on to Pi.
 */

import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Type from "typebox";

import { harnessDirectory } from "./turn-records.ts";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** The absolute path of this file, which a profile Pi loads as an extension. */
export const UNREADABLE_NAMESPACE_TOOL_EXTENSION = fileURLToPath(import.meta.url);

const LOG_FILE = "unreadable-namespace-tool.jsonl";
const TOOL_NAME = "unreadable_namespace_tool";

/** Returns the lines the extension logged in the harness directory `harness`. */
export async function readUnreadableNamespaceToolLog(harness: string): Promise<string[]> {
  return (await readFile(path.join(harness, LOG_FILE), "utf8")).trimEnd().split("\n");
}

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function unreadableNamespaceTool(pi: ExtensionAPI): void {
  let decision: object;
  try {
    pi.registerTool({
      name: TOOL_NAME,
      label: "Unreadable namespace tool",
      description: "A tool for the behavioral tests whose namespace cannot be read.",
      parameters: Type.Object({}),
      exposure: "hidden",
      namespace: {
        get name(): string {
          throw new Error("the namespace of the unreadable namespace tool cannot be read");
        },
      },
      execute: () => Promise.resolve({ content: [{ type: "text", text: "" }], details: {} }),
    });
    decision = { decision: "registered", tool: TOOL_NAME };
  } catch (error: unknown) {
    decision = {
      decision: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const log = path.join(harnessDirectory(process.env.HOME ?? ""), LOG_FILE);
  appendFileSync(log, `${JSON.stringify(decision)}\n`);
}
