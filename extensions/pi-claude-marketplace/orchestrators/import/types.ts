import type { Scope } from "../../shared/types.ts";

export type ImportDiagnosticCode =
  | "malformed-enabled-plugin-ref"
  | "malformed-plugin-ref"
  | "non-boolean-enabled-plugin"
  | "unmappable-marketplace-source"
  | "settings-read-error"
  | "malformed-json"
  | "invalid-claude-config-dir"
  | "unrecognized-stored-source"
  | "post-install-warning";

export interface ImportDiagnostic {
  readonly severity: "warning" | "error";
  readonly scope: Scope;
  readonly code: ImportDiagnosticCode;
  readonly message: string;
  readonly path?: string;
  readonly ref?: string;
  readonly marketplace?: string;
}

export interface ClaudeSettingsPaths {
  readonly basePath: string;
  readonly localPath: string;
}

export interface ClaudeSettingsReadOptions {
  readonly cwd?: string;
  readonly claudeConfigDir?: string;
}

export interface MergedClaudeSettings {
  readonly enabledPlugins: Record<string, unknown>;
  readonly extraKnownMarketplaces: Record<string, unknown>;
}

export interface MergedClaudeSettingsResult {
  readonly paths: ClaudeSettingsPaths;
  readonly settings: MergedClaudeSettings;
  readonly diagnostics: readonly ImportDiagnostic[];
}

export interface EnabledPluginRef {
  readonly plugin: string;
  readonly marketplace: string;
  readonly raw: string;
}

export type ParseEnabledPluginRefResult =
  | { readonly ok: true; readonly ref: EnabledPluginRef }
  | { readonly ok: false; readonly reason: string };

export interface EnabledPluginRefsResult {
  readonly refs: readonly EnabledPluginRef[];
  readonly diagnostics: readonly ImportDiagnostic[];
}

export interface PlannedMarketplaceSource {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly source: string;
}

export interface PlannedPluginImport {
  readonly scope: Scope;
  readonly ref: EnabledPluginRef;
}

export interface SkippedPluginImport {
  readonly scope: Scope;
  readonly ref: EnabledPluginRef;
  readonly reason: "unmappable-marketplace-source";
}

export interface MarketplaceSourcePlanResult {
  readonly marketplacesToEnsure: readonly PlannedMarketplaceSource[];
  readonly diagnostics: readonly ImportDiagnostic[];
  readonly unmappableMarketplaces: readonly string[];
}

export interface ScopedClaudeImportPlanInput {
  readonly scope: Scope;
  readonly settings: MergedClaudeSettings;
}

export interface ScopedClaudeImportPlan {
  readonly scope: Scope;
  readonly marketplacesToEnsure: readonly PlannedMarketplaceSource[];
  readonly pluginsToInstall: readonly PlannedPluginImport[];
  readonly skippedPlugins: readonly SkippedPluginImport[];
  readonly diagnostics: readonly ImportDiagnostic[];
}

export interface ClaudeImportPlan {
  readonly scopes: readonly ScopedClaudeImportPlan[];
  readonly diagnostics: readonly ImportDiagnostic[];
}
