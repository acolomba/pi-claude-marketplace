import { fileURLToPath } from "node:url";

import Type from "typebox";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** The absolute path of the extension that provides two case-sensitive custom tools. */
export const HOOK_CASE_TOOLS_EXTENSION = fileURLToPath(import.meta.url);

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function hookCaseTools(pi: ExtensionAPI): void {
  for (const name of ["Bash", "Read"]) {
    pi.registerTool({
      name,
      label: `Custom ${name}`,
      description: `A custom ${name} tool for hook scenarios.`,
      parameters: Type.Object({ query: Type.String() }),
      execute: () =>
        Promise.resolve({
          content: [{ type: "text", text: "public" }],
          details: { secret: "OLD_DETAILS" },
          structuredContent: { secret: "OLD_STRUCTURED" },
        }),
    });
  }
}
