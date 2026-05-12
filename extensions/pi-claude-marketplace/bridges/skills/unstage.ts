// bridges/skills/unstage.ts
//
// Remove previously-staged skill dirs by name. Idempotent: ENOENT on a name
// is silently treated as already-removed. Mirrors V1
// `agent/stage.ts::unstagePluginAgents` shape but simpler -- skills have
// no on-disk index and no foreign-content marker (D-06: skills dir is owned
// end-to-end by name).

import { rm } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { UnstageSkillsInput, UnstageSkillsResult } from "./types.ts";

/**
 * Per-name `rm({recursive:true})` loop. Names are validated with
 * `assertSafeName` (defense-in-depth -- callers should already have
 * validated, but state.json corruption could surface bad names) and routed
 * through `assertPathInside` to refuse traversal escapes.
 *
 * `removedNames` lists names whose target dir actually existed pre-call;
 * ENOENT names are silently skipped (idempotent unstage). The existence
 * check is `pathExists` (lstat-based, non-symlink-following) BEFORE rm so
 * the result faithfully reports work done rather than work attempted.
 */
export async function unstagePluginSkills(input: UnstageSkillsInput): Promise<UnstageSkillsResult> {
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
      await rm(dir, { recursive: true, force: true });
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
}
