import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { harnessDirectory } from "./turn-records.ts";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** A read-only handler loaded after the production hook bridge. */
export const HOOK_RESULT_OBSERVER_EXTENSION = fileURLToPath(import.meta.url);
export const HOOK_RESULT_OBSERVER_LOG = "hook-result-observer.jsonl";

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function hookResultObserver(pi: ExtensionAPI): void {
  pi.on("tool_result", (event) => {
    const record = {
      toolName: event.toolName,
      content: event.content,
      details: event.details ?? null,
      structuredContent: event.structuredContent ?? null,
      isError: event.isError,
    };
    const file = path.join(harnessDirectory(process.env.HOME ?? ""), HOOK_RESULT_OBSERVER_LOG);
    appendFileSync(file, `${JSON.stringify(record)}\n`);
    return undefined;
  });
}
