import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/**
 * Catalog fixtures for the plugin apply command surface. APL-01 / D-08: its
 * change rows are the `reconcile-applied-cascade` states; this module holds
 * the advisory an apply with nothing to change emits.
 */
export const PLUGIN_APPLY_FIXTURES: FixtureMap = {
  "/claude:plugin apply": {
    "nothing-to-change": {
      pi: piWithBothLoaded(),
      message: { kind: "reconcile-pending-empty", command: "apply" },
    },
  },
};
