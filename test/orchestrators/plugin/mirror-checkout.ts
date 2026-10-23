/**
 * A gitOps wrapper for tests whose fake clone writes no `.git` and whose fake
 * checkout writes no files: the mirror gets the `.git` a real clone leaves, and
 * a checkout into a work tree that holds only `.git` copies the URL-keyed
 * mirror's tree, as a real checkout of a copied mirror `.git` writes the
 * commit's tree (GIT-01, `materializePluginCommitCopy`).
 */

import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { pluginMirrorKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { materializePluginCommitCopy } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

function checkoutWritesMirrorTree(gitOps: GitOps, mirrorRoot: string): GitOps {
  return {
    ...gitOps,
    async checkout(options) {
      await gitOps.checkout(options);
      const entries = await readdir(options.dir);
      if (
        options.dir === mirrorRoot ||
        entries.some((entry) => entry !== ".git") ||
        !(await pathExists(mirrorRoot))
      ) {
        return;
      }

      const tree = (await readdir(mirrorRoot)).filter((entry) => entry !== ".git");
      await Promise.all(
        tree.map((entry) =>
          cp(path.join(mirrorRoot, entry), path.join(options.dir, entry), { recursive: true }),
        ),
      );
    },
  };
}

/** `materializePluginCommitCopy` over `gitOps`, its checkout writing the mirror's tree. */
export async function materializeCommitCopyWith(
  gitOps: GitOps,
  args: Parameters<typeof materializePluginCommitCopy>[0],
): Promise<string> {
  const mirrorRoot = await args.locations.pluginCloneDir(pluginMirrorKey(args.cloneUrl));
  if (await pathExists(mirrorRoot)) {
    await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
  }

  return materializePluginCommitCopy({
    ...args,
    gitOps: checkoutWritesMirrorTree(gitOps, mirrorRoot),
  });
}
