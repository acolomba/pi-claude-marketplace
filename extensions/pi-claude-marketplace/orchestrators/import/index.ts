export { extractEnabledPluginRefs, parseEnabledPluginRef } from "./refs.ts";
export {
  loadMergedClaudeSettingsForScope,
  mergeClaudeSettings,
  resolveClaudeSettingsPaths,
} from "./settings.ts";

export type {
  ClaudeSettingsPaths,
  ClaudeSettingsReadOptions,
  EnabledPluginRef,
  EnabledPluginRefsResult,
  ImportDiagnostic,
  MergedClaudeSettings,
  MergedClaudeSettingsResult,
  ParseEnabledPluginRefResult,
} from "./types.ts";
