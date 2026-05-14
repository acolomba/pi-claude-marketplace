import type { Scope } from "../../shared/types.ts";

export interface ImportDiagnostic {
  readonly severity: "warning" | "error";
  readonly scope: Scope;
  readonly code: string;
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
