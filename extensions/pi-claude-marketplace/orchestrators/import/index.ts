export { importClaudeSettings } from "./execute.ts";
export { buildClaudeImportPlan, planMarketplaceSourcesForRefs } from "./marketplaces.ts";
export { extractEnabledPluginRefs, parseEnabledPluginRef } from "./refs.ts";
export {
  loadMergedClaudeSettingsForScope,
  mergeClaudeSettings,
  resolveClaudeSettingsPaths,
} from "./settings.ts";

export type { EnabledPluginRef } from "./types.ts";
