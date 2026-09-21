// bridges/skills/unstage.ts
//
// Remove previously-staged skill dirs by name. Idempotent: ENOENT on a name
// is silently treated as already-removed. Skills have no on-disk index and
// no foreign-content marker (D-06: skills dir is owned end-to-end by name).

import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { UnstageSkillsInput, UnstageSkillsResult } from "./types.ts";

/** Removes one validated, contained skill tree. */
export interface SkillsUnstageRemover {
  readonly removeTree: (target: string) => Promise<void>;
}

/**
 * Per-name `rm({recursive:true})` loop. Names are validated with
 * `assertSafeName` (defense-in-depth -- callers should already have
 * validated, but state.json corruption could surface bad names) and routed
 * through `assertPathInside` to refuse traversal escapes.
 *
 * `removedNames` lists names whose target dir existed pre-call (via the
 * `pathExists` lstat-based, non-symlink-following check BEFORE rm) AND whose
 * `remover.removeTree` call resolved without throwing. A post-call ENOENT
 * (TOCTOU race) is treated the same as a pre-call miss and excluded from
 * `removedNames` -- even if `removeTree` performed the removal itself before
 * reporting ENOENT. `removedNames` therefore reflects `removeTree`'s own
 * success signal, not a guaranteed record of every directory actually
 * removed.
 */
export function createUnstagePluginSkills(
  remover: SkillsUnstageRemover,
): (input: UnstageSkillsInput) => Promise<UnstageSkillsResult> {
  return async function unstagePluginSkills(
    input: UnstageSkillsInput,
  ): Promise<UnstageSkillsResult> {
    const removed: string[] = [];

    for (const name of input.previousSkillNames) {
      assertSafeName(name, "skill name to unstage");
      const dir = path.join(input.locations.skillsTargetDir, name);
      await assertPathInside(input.locations.skillsTargetDir, dir, "skill to unstage");

      if (!(await pathExists(dir))) {
        // ENOENT path -- idempotent skip.
        continue;
      }

      try {
        await remover.removeTree(dir);
        removed.push(name);
      } catch (err) {
        // force:true silences ENOENT, but a TOCTOU race could land us here
        // anyway -- treat ENOENT as already-removed for symmetry with the
        // pre-check skip above.
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          throw err;
        }
      }
    }

    return {
      removedNames: Object.freeze(removed),
      warnings: Object.freeze([]),
    };
  };
}
