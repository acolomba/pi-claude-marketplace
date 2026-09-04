// Complete relative inventory of one scope root, shared by the install,
// reinstall, and uninstall retry proofs, by the bootstrap idempotence proof,
// and by the reconcile owners. It defines the tree-inventory contract those
// proofs assert against, so it lives in one module rather than once per test
// file.
//
// `readdir` is bound here at module load, before any case installs a mock, for
// two reasons: a walk must never record itself into the schedule of a case
// that observes `readdir` (uninstall's clone-reclaim scan does), and a walk
// must report the real tree even while a case has a refusal armed.

import { createRequire } from "node:module";
import path from "node:path";

import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

const inventoryFs = createRequire(import.meta.url)(
  "node:fs/promises",
) as typeof import("node:fs/promises");
const inventoryReaddir = inventoryFs.readdir.bind(inventoryFs);

/**
 * Every path under `root`, relative to it and separated by `/` on every
 * platform, sorted by directory then by name. Directories carry a trailing
 * slash. The advisory lock file is excluded because its presence depends on
 * lock timing rather than on any orchestrator's mutation ledger. A root that
 * does not exist yields an empty inventory rather than throwing.
 */
export async function retryTree(root: string): Promise<readonly string[]> {
  if (!(await pathExists(root))) {
    return [];
  }

  const entries: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const children = await inventoryReaddir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const absolute = path.join(directory, child.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (relative === "pi-claude-marketplace/.state-lock") {
        continue;
      }

      entries.push(child.isDirectory() ? `${relative}/` : relative);
      if (child.isDirectory()) {
        await visit(absolute);
      }
    }
  };

  await visit(root);
  return entries;
}
