// bridges/skills/index.ts
//
// Public surface barrel for the skills bridge. Internal underscore-prefixed
// fields on the staged variant of PreparedSkillsStaging are NOT re-exported
// from this module; orchestrators MUST treat the prepared object as opaque
// (D-01 opaque-handle discipline). The PreparedSkillsStaging type is exposed
// so callers can declare it in signatures, but consuming code MUST narrow on
// `kind` and pass the value to commitPreparedSkills / abortPreparedSkills
// rather than reading the internal fields.

import { rm } from "node:fs/promises";

import { createUnstagePluginSkills } from "./unstage.ts";

import type { SkillsUnstageRemover } from "./unstage.ts";

export {
  abortPreparedSkills,
  commitPreparedSkills,
  finalizeSkillsReplacement,
  prepareStageSkills,
  replacePreparedSkills,
  rollbackSkillsReplacement,
} from "./stage.ts";
export { discoverPluginSkills } from "./discover.ts";

export type { PreparedSkillsStaging, SkillsReplacement } from "./types.ts";

const NODE_SKILLS_UNSTAGE_REMOVER: SkillsUnstageRemover = {
  async removeTree(target: string): Promise<void> {
    await rm(target, { recursive: true, force: true });
  },
};

/** Removes recorded skill trees through the Node filesystem adapter. */
export const unstagePluginSkills = createUnstagePluginSkills(NODE_SKILLS_UNSTAGE_REMOVER);
