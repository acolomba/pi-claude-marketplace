// bridges/skills/index.ts
//
// Public surface barrel for the skills bridge. Internal underscore-prefixed
// fields on the staged variant of PreparedSkillsStaging are NOT re-exported
// from this module; orchestrators MUST treat the prepared object as opaque
// (D-01 opaque-handle discipline). The PreparedSkillsStaging type is exposed
// so callers can declare it in signatures, but consuming code MUST narrow on
// `kind` and pass the value to commitPreparedSkills / abortPreparedSkills
// rather than reading the internal fields.

export {
  abortPreparedSkills,
  assertNoSkillCollisions,
  commitPreparedSkills,
  finalizeSkillsReplacement,
  prepareStageSkills,
  replacePreparedSkills,
  rollbackSkillsReplacement,
} from "./stage.ts";
export { unstagePluginSkills } from "./unstage.ts";
export { discoverPluginSkills } from "./discover.ts";
export { rewriteFrontmatterName } from "./rewrite-frontmatter.ts";

export type {
  DiscoveredSkill,
  PreparedSkillsStaging,
  SkillsReplacement,
  StagedSkillRecord,
  StageSkillsCommitResult,
  StageSkillsInput,
  UnstageSkillsInput,
  UnstageSkillsResult,
} from "./types.ts";
