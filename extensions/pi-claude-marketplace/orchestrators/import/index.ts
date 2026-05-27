export {
  importClaudeSettings,
  type ClaudeImportExecutionResult,
  type ImportWarningOutcome,
  type MarketplaceFailureOutcome,
  type PluginInstalledOutcome,
  type PluginSkipOutcome,
  type SourceMismatchOutcome,
  type UnexpectedPluginFailureOutcome,
} from "./execute.ts";
export { buildClaudeImportPlan, planMarketplaceSourcesForRefs } from "./marketplaces.ts";
export { extractEnabledPluginRefs, parseEnabledPluginRef } from "./refs.ts";
export {
  loadMergedClaudeSettingsForScope,
  mergeClaudeSettings,
  resolveClaudeSettingsPaths,
} from "./settings.ts";

export type {
  ClaudeSettingsPaths,
  ClaudeSettingsReadOptions,
  ClaudeImportPlan,
  EnabledPluginRef,
  EnabledPluginRefsResult,
  ImportDiagnostic,
  MarketplaceSourcePlanResult,
  MergedClaudeSettings,
  MergedClaudeSettingsResult,
  ParseEnabledPluginRefResult,
  PlannedMarketplaceSource,
  PlannedPluginImport,
  ScopedClaudeImportPlan,
  ScopedClaudeImportPlanInput,
  SkippedPluginImport,
} from "./types.ts";
