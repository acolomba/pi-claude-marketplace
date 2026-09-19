import { lstat, readlink } from "node:fs/promises";

import { createPathSafetyGuard } from "./path-containment.ts";

import type { PathSafetyInspector } from "./path-containment.ts";
import type { Stats } from "node:fs";

export { PathContainmentError, SymlinkRefusedError } from "./path-containment.ts";

const NODE_PATH_SAFETY_INSPECTOR: PathSafetyInspector = {
  lstat: async (target: string): Promise<Stats> => lstat(target),
  readlink: async (target: string): Promise<string> => readlink(target),
};

const NODE_PATH_SAFETY_GUARD = createPathSafetyGuard(NODE_PATH_SAFETY_INSPECTOR);

/** Refuse path traversal and symlinks using the Node filesystem inspector. */
export const assertPathInside = NODE_PATH_SAFETY_GUARD.assertPathInside;
