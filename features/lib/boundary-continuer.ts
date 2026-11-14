import { fileURLToPath } from "node:url";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * A harness extension that stands in for another Pi extension which continues
 * a run that would settle, as pi-subagents does for a result the model has not
 * read. A profile Pi loads it before the real extension, so Pi runs its
 * `agent_before_settle` handler first, and the real extension's handler sees
 * `continue: true`. It continues the first such boundary once, with one
 * hidden message, and lets every later boundary settle.
 */
export const BOUNDARY_CONTINUER_EXTENSION = fileURLToPath(import.meta.url);

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function boundaryContinuer(pi: ExtensionAPI): void {
  let continued = false;
  pi.on("agent_before_settle", (event) => {
    if (continued) {
      return undefined;
    }

    continued = true;
    return {
      entries: [
        ...event.entries,
        {
          type: "custom_message",
          customType: "harness-boundary-continuer",
          content: "go on",
          display: false,
        },
      ],
      continue: true,
    };
  });
}
