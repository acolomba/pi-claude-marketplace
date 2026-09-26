// platform/workflow-home.ts
//
// WPTH-04: the host workflow engine derives its storage root from the home
// directory as `~/.pi/workflows` and honors NO environment override and no
// settings key -- its settings record carries behavioral keys only. Honoring
// the variable that relocates this extension's OWN user-scope root would
// therefore put artifacts where the engine never looks, so this module
// deliberately reads no environment at all. That is the one place the two
// roots disagree, and the disagreement is the engine's rule, not ours.
//
// The engine's rooting rule, transcribed so a future reader can diff it against
// an upgraded release without unpacking the tarball:
// `@quintinshaw/pi-dynamic-workflows@3.10.1 dist/workflow-paths.js` declares
// `WORKFLOW_HOME_RELATIVE_DIR = ".pi/workflows"` and joins it onto `homedir()`.
//
// This is the SOLE import site for that root, mirroring the position
// `getAgentDir` occupies in `pi-api.ts` for `scopeRoot`. The root is a pure
// function of `os.homedir()` and this module holds no mutable module-level
// state, so a test relocates storage by assigning `HOME` after registering the
// restore with `t.after()`: `os.homedir()` re-reads the variable on every call
// and caches nothing.
//
// No Pi package is imported here, so the `pi-api.ts` peer-import chokepoint is
// not engaged by this module living in `platform/`.

import os from "node:os";
import path from "node:path";

/** `<homedir>/.pi/workflows` -- the host engine's storage root. */
export function workflowHomeDir(): string {
  return path.join(os.homedir(), ".pi", "workflows");
}
