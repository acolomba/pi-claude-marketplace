// bridges/skills/unstage.ts
//
// Remove previously-staged skill dirs by name. Idempotent: ENOENT on a name
// is silently treated as already-removed. Skills have no on-disk index and
// no foreign-content marker (D-06: skills dir is owned end-to-end by name).

import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { errorMessage } from "../../shared/errors.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { ProjectSkillLedger } from "./project-installs.ts";
import type { UnstageSkillsInput, UnstageSkillsResult } from "./types.ts";

/** Removes one validated, contained skill tree. */
export interface SkillsUnstageRemover {
  readonly removeTree: (target: string) => Promise<void>;
}

/**
 * D-CF2-13: drops the unstaged names of a project-scope unstage from the
 * user's project ledger. A stale entry only names a file this user once
 * installed, so a ledger that cannot be written becomes a warning and never
 * blocks the removal.
 */
async function forgetProjectSkills(
  ledger: ProjectSkillLedger,
  input: UnstageSkillsInput,
): Promise<readonly string[]> {
  if (input.locations.scope !== "project" || input.previousSkillNames.length === 0) {
    return [];
  }

  try {
    await ledger.update({
      projectPath: path.dirname(input.locations.scopeRoot),
      forget: input.previousSkillNames,
      remember: new Map(),
    });
    return [];
  } catch (err) {
    return [`could not update the project skill ledger: ${errorMessage(err)}`];
  }
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
 * removed. At project scope the loop then drops the names from the user's
 * project ledger (`forgetProjectSkills`), and `warnings` reports a ledger it
 * could not update.
 */
export function createUnstagePluginSkills(
  remover: SkillsUnstageRemover,
  ledger: ProjectSkillLedger,
): (input: UnstageSkillsInput) => Promise<UnstageSkillsResult> {
  return async function unstagePluginSkills(
    input: UnstageSkillsInput,
  ): Promise<UnstageSkillsResult> {
    const removed: string[] = [];

    for (const name of input.previousSkillNames) {
      assertSafeName(name, "skill name to unstage");
      const dir = path.join(input.locations.skillsTargetDir, name);
      // eslint-disable-next-line no-await-in-loop -- the first containment or removal failure stops the rest
      await assertPathInside(input.locations.skillsTargetDir, dir, "skill to unstage");

      // eslint-disable-next-line no-await-in-loop -- the first containment or removal failure stops the rest
      if (!(await pathExists(dir))) {
        // ENOENT path -- idempotent skip.
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop -- the first containment or removal failure stops the rest
        await remover.removeTree(dir);
        // fallow-ignore-next-line code-duplication -- reviewed: the commands and skills bridges keep the same shape on purpose, and the fallow boundary zones forbid one bridge from importing the other
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
      warnings: Object.freeze([...(await forgetProjectSkills(ledger, input))]),
    };
  };
}
