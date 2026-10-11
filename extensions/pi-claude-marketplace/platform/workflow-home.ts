// platform/workflow-home.ts
//
// WPTH-04: the storage root of the host workflow engine. This module copies
// the engine's own rule, so the bridge writes envelopes where the engine reads
// them. The rule, transcribed from `src/workflow-paths.ts` in
// `@quintinshaw/pi-dynamic-workflows@3.14.0`
// (QuintinShaw/pi-dynamic-workflows#238): when `PI_CODING_AGENT_DIR` is
// truthy, the root is `join(getAgentDir(), "workflows")`. Otherwise it is
// `WORKFLOW_HOME_RELATIVE_DIR = ".pi/workflows"` joined onto `homedir()`.
//
// The engine checks the value for truthiness, so an empty value selects the
// home default. `getAgentDir` is the Pi function the engine calls, and this
// extension takes its user-scope root from the same function through
// `pi-api.ts`. It expands a leading `~`, so both sides turn one value into one
// root. Engine releases before 3.14.0 ignore the variable and always use
// `~/.pi/workflows`.
//
// This module is the only source of that root, as `getAgentDir` is for
// `scopeRoot`. It reads the environment the engine reads and holds no state.
// `os.homedir()` and `getAgentDir()` read their variables on every call, so a
// test relocates storage by setting `HOME` and `PI_CODING_AGENT_DIR` after it
// registers their restore with `t.after()`.

import os from "node:os";
import path from "node:path";

import { getAgentDir } from "./pi-api.ts";

/**
 * The host engine's storage root: `<agent dir>/workflows` when
 * `PI_CODING_AGENT_DIR` is non-empty, else `<homedir>/.pi/workflows`.
 */
export function workflowHomeDir(): string {
  // Not redundant with `getAgentDir`'s own check: the unset default here is
  // `~/.pi/workflows`, not `<default agent dir>/workflows`.
  if (process.env.PI_CODING_AGENT_DIR) {
    return path.join(getAgentDir(), "workflows");
  }

  return path.join(os.homedir(), ".pi", "workflows");
}
