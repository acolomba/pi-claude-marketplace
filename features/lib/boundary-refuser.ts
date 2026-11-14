import { fileURLToPath } from "node:url";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * A harness extension that stands in for another Pi extension which ends a
 * run that an earlier handler asked to continue. A profile Pi loads it after
 * the real extension, so Pi runs its `agent_before_settle` handler last, and
 * Pi takes its `continue: false` as the outcome of every boundary.
 */
export const BOUNDARY_REFUSER_EXTENSION = fileURLToPath(import.meta.url);

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function boundaryRefuser(pi: ExtensionAPI): void {
  pi.on("agent_before_settle", () => ({ continue: false }));
}
