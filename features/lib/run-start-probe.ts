import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { harnessDirectory } from "./turn-records.ts";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * A harness extension that logs one line for each run start. Pi raises
 * `before_agent_start` once per run, and `agent_start` once per model loop,
 * so a run that an extension continues raises more `agent_start` events
 * than run starts.
 */
export const RUN_START_PROBE_EXTENSION = fileURLToPath(import.meta.url);
export const RUN_STARTS_LOG = "run-starts.jsonl";

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function runStartProbe(pi: ExtensionAPI): void {
  pi.on("before_agent_start", (event) => {
    const file = path.join(harnessDirectory(process.env.HOME ?? ""), RUN_STARTS_LOG);
    appendFileSync(file, `${JSON.stringify({ messageType: event.messageType })}\n`);
    return undefined;
  });
}
