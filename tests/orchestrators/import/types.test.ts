import type {
  ClaudeImportPlan,
  ClaudeSettingsPaths,
  ClaudeSettingsReadOptions,
  EnabledPluginRef,
  EnabledPluginRefsResult,
  ImportDiagnostic,
  ImportDiagnosticCode,
  MarketplaceSourcePlanResult,
  MergedClaudeSettings,
  MergedClaudeSettingsResult,
  ParseEnabledPluginRefResult,
  PlannedMarketplaceSource,
  PlannedPluginImport,
  ScopedClaudeImportPlan,
  ScopedClaudeImportPlanInput,
  SkippedPluginImport,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/types.ts";

void ("invalid-claude-config-dir" satisfies ImportDiagnosticCode);
void ("malformed-enabled-plugin-ref" satisfies ImportDiagnosticCode);
void ("malformed-json" satisfies ImportDiagnosticCode);
void ("malformed-plugin-ref" satisfies ImportDiagnosticCode);
void ("non-boolean-enabled-plugin" satisfies ImportDiagnosticCode);
void ("post-install-warning" satisfies ImportDiagnosticCode);
void ("settings-read-error" satisfies ImportDiagnosticCode);
void ("unmappable-marketplace-source" satisfies ImportDiagnosticCode);
void ("unrecognized-stored-source" satisfies ImportDiagnosticCode);

const importDiagnostic: ImportDiagnostic = {
  severity: "warning",
  scope: "user",
  code: "post-install-warning",
  message: "reload the imported plugin",
  path: "/home/user/.claude/settings.json",
  ref: "formatter@official",
  marketplace: "official",
} satisfies ImportDiagnostic;
void importDiagnostic;

const claudeSettingsPaths: ClaudeSettingsPaths = {
  basePath: "/home/user/.claude/settings.json",
  localPath: "/work/project/.claude/settings.local.json",
} satisfies ClaudeSettingsPaths;
void claudeSettingsPaths;

const claudeSettingsReadOptions: ClaudeSettingsReadOptions = {
  cwd: "/work/project",
  claudeConfigDir: "/home/user/.claude",
} satisfies ClaudeSettingsReadOptions;
void claudeSettingsReadOptions;
void ({} satisfies ClaudeSettingsReadOptions);

const mergedClaudeSettings: MergedClaudeSettings = {
  enabledPlugins: {
    "formatter@official": true,
  },
  extraKnownMarketplaces: {
    official: {
      source: "https://github.com/example/official.git",
    },
  },
} satisfies MergedClaudeSettings;
void mergedClaudeSettings;

const mergedClaudeSettingsResult: MergedClaudeSettingsResult = {
  paths: {
    basePath: "/home/user/.claude/settings.json",
    localPath: "/work/project/.claude/settings.local.json",
  },
  settings: {
    enabledPlugins: {
      "formatter@official": true,
    },
    extraKnownMarketplaces: {
      official: {
        source: "https://github.com/example/official.git",
      },
    },
  },
  diagnostics: [
    {
      severity: "warning",
      scope: "project",
      code: "malformed-json",
      message: "ignored malformed project settings",
      path: "/work/project/.claude/settings.local.json",
    },
  ],
} satisfies MergedClaudeSettingsResult;
void mergedClaudeSettingsResult;

const enabledPluginRef: EnabledPluginRef = {
  plugin: "formatter",
  marketplace: "official",
  raw: "formatter@official",
} satisfies EnabledPluginRef;
void enabledPluginRef;

const parsedEnabledPluginRef: ParseEnabledPluginRefResult = {
  ok: true,
  ref: {
    plugin: "formatter",
    marketplace: "official",
    raw: "formatter@official",
  },
} satisfies ParseEnabledPluginRefResult;
void parsedEnabledPluginRef;

const rejectedEnabledPluginRef: ParseEnabledPluginRefResult = {
  ok: false,
  reason: "missing marketplace separator",
} satisfies ParseEnabledPluginRefResult;
void rejectedEnabledPluginRef;

const enabledPluginRefsResult: EnabledPluginRefsResult = {
  refs: [
    {
      plugin: "formatter",
      marketplace: "official",
      raw: "formatter@official",
    },
  ],
  diagnostics: [
    {
      severity: "error",
      scope: "project",
      code: "malformed-enabled-plugin-ref",
      message: "ignored malformed enabled plugin reference",
      ref: "formatter",
    },
  ],
} satisfies EnabledPluginRefsResult;
void enabledPluginRefsResult;

const plannedMarketplaceSource: PlannedMarketplaceSource = {
  scope: "project",
  marketplace: "official",
  source: "https://github.com/example/official.git",
} satisfies PlannedMarketplaceSource;
void plannedMarketplaceSource;

const plannedPluginImport: PlannedPluginImport = {
  scope: "user",
  ref: {
    plugin: "formatter",
    marketplace: "official",
    raw: "formatter@official",
  },
} satisfies PlannedPluginImport;
void plannedPluginImport;

const skippedPluginImport: SkippedPluginImport = {
  scope: "project",
  ref: {
    plugin: "formatter",
    marketplace: "retired",
    raw: "formatter@retired",
  },
  reason: "unmappable-marketplace-source",
} satisfies SkippedPluginImport;
void skippedPluginImport;

const marketplaceSourcePlanResult: MarketplaceSourcePlanResult = {
  marketplacesToEnsure: [
    {
      scope: "user",
      marketplace: "official",
      source: "https://github.com/example/official.git",
    },
  ],
  diagnostics: [
    {
      severity: "warning",
      scope: "user",
      code: "unmappable-marketplace-source",
      message: "skipped retired marketplace",
      marketplace: "retired",
    },
  ],
  unmappableMarketplaces: ["retired"],
} satisfies MarketplaceSourcePlanResult;
void marketplaceSourcePlanResult;

const scopedClaudeImportPlanInput: ScopedClaudeImportPlanInput = {
  scope: "user",
  settings: {
    enabledPlugins: {
      "formatter@official": true,
    },
    extraKnownMarketplaces: {
      official: {
        source: "https://github.com/example/official.git",
      },
    },
  },
} satisfies ScopedClaudeImportPlanInput;
void scopedClaudeImportPlanInput;

const scopedClaudeImportPlan: ScopedClaudeImportPlan = {
  scope: "project",
  marketplacesToEnsure: [
    {
      scope: "project",
      marketplace: "official",
      source: "https://github.com/example/official.git",
    },
  ],
  pluginsToInstall: [
    {
      scope: "project",
      ref: {
        plugin: "formatter",
        marketplace: "official",
        raw: "formatter@official",
      },
    },
  ],
  skippedPlugins: [
    {
      scope: "project",
      ref: {
        plugin: "legacy",
        marketplace: "retired",
        raw: "legacy@retired",
      },
      reason: "unmappable-marketplace-source",
    },
  ],
  diagnostics: [
    {
      severity: "error",
      scope: "project",
      code: "unrecognized-stored-source",
      message: "could not recognize a stored marketplace source",
      marketplace: "retired",
    },
  ],
} satisfies ScopedClaudeImportPlan;
void scopedClaudeImportPlan;

const claudeImportPlan: ClaudeImportPlan = {
  scopes: [
    {
      scope: "user",
      marketplacesToEnsure: [
        {
          scope: "user",
          marketplace: "official",
          source: "https://github.com/example/official.git",
        },
      ],
      pluginsToInstall: [
        {
          scope: "user",
          ref: {
            plugin: "formatter",
            marketplace: "official",
            raw: "formatter@official",
          },
        },
      ],
      skippedPlugins: [],
      diagnostics: [],
    },
  ],
  diagnostics: [
    {
      severity: "warning",
      scope: "user",
      code: "post-install-warning",
      message: "reload to pick up imported plugins",
    },
  ],
} satisfies ClaudeImportPlan;
void claudeImportPlan;

type IsMutableArray<T extends readonly unknown[]> = T extends unknown[] ? true : false;

// @ts-expect-error diagnostic codes have a closed vocabulary
void ("invalid-diagnostic" satisfies ImportDiagnosticCode);
// @ts-expect-error diagnostics always carry a message
void ({ severity: "error", scope: "user", code: "malformed-json" } satisfies ImportDiagnostic);
// @ts-expect-error import diagnostics reject the unsupported local scope
void ({ ...importDiagnostic, scope: "local" } satisfies ImportDiagnostic);
// @ts-expect-error exact optional properties reject an explicitly undefined diagnostic path
void ({ ...importDiagnostic, path: undefined } satisfies ImportDiagnostic);
// @ts-expect-error settings paths always identify the local settings file
void ({ basePath: "/home/user/.claude/settings.json" } satisfies ClaudeSettingsPaths);
// @ts-expect-error exact optional properties reject an explicitly undefined cwd
void ({ cwd: undefined } satisfies ClaudeSettingsReadOptions);
// @ts-expect-error merged settings always expose known marketplaces
void ({ enabledPlugins: {} } satisfies MergedClaudeSettings);
void ({
  paths: claudeSettingsPaths,
  settings: mergedClaudeSettings,
  // @ts-expect-error merged settings results always expose diagnostics
} satisfies MergedClaudeSettingsResult);
// @ts-expect-error enabled plugin references always retain their raw spelling
void ({ plugin: "formatter", marketplace: "official" } satisfies EnabledPluginRef);
void ({
  ok: true,
  ref: enabledPluginRef,
  // @ts-expect-error successful parse results cannot carry a failure reason
  reason: "unexpected",
} satisfies ParseEnabledPluginRefResult);
void ({
  ok: false,
  reason: "malformed",
  // @ts-expect-error failed parse results cannot carry a parsed reference
  ref: enabledPluginRef,
} satisfies ParseEnabledPluginRefResult);
// @ts-expect-error enabled reference results always expose diagnostics
void ({ refs: [] } satisfies EnabledPluginRefsResult);
void ({
  // @ts-expect-error marketplace source plans reject unsupported scopes
  scope: "local",
  marketplace: "official",
  source: "https://example.test",
} satisfies PlannedMarketplaceSource);
// @ts-expect-error planned plugin imports always carry a parsed reference
void ({ scope: "user" } satisfies PlannedPluginImport);
void ({
  scope: "project",
  ref: enabledPluginRef,
  // @ts-expect-error skipped imports have one closed reason
  reason: "disabled",
} satisfies SkippedPluginImport);
// @ts-expect-error marketplace source results always expose unmappable names
void ({ marketplacesToEnsure: [], diagnostics: [] } satisfies MarketplaceSourcePlanResult);
// @ts-expect-error scoped import inputs always carry merged settings
void ({ scope: "user" } satisfies ScopedClaudeImportPlanInput);
void ({
  scope: "project",
  marketplacesToEnsure: [],
  pluginsToInstall: [],
  diagnostics: [],
  // @ts-expect-error scoped plans always expose skipped imports
} satisfies ScopedClaudeImportPlan);
// @ts-expect-error complete import plans always expose aggregate diagnostics
void ({ scopes: [] } satisfies ClaudeImportPlan);

// @ts-expect-error merged result diagnostics are a readonly array
void (true satisfies IsMutableArray<MergedClaudeSettingsResult["diagnostics"]>);
// @ts-expect-error enabled references are a readonly array
void (true satisfies IsMutableArray<EnabledPluginRefsResult["refs"]>);
// @ts-expect-error enabled reference diagnostics are a readonly array
void (true satisfies IsMutableArray<EnabledPluginRefsResult["diagnostics"]>);
// @ts-expect-error marketplace plans are a readonly array
void (true satisfies IsMutableArray<MarketplaceSourcePlanResult["marketplacesToEnsure"]>);
// @ts-expect-error unmappable marketplace names are a readonly array
void (true satisfies IsMutableArray<MarketplaceSourcePlanResult["unmappableMarketplaces"]>);
// @ts-expect-error scoped plan marketplaces are a readonly array
void (true satisfies IsMutableArray<ScopedClaudeImportPlan["marketplacesToEnsure"]>);
// @ts-expect-error scoped plan plugins are a readonly array
void (true satisfies IsMutableArray<ScopedClaudeImportPlan["pluginsToInstall"]>);
// @ts-expect-error scoped plan skipped entries are a readonly array
void (true satisfies IsMutableArray<ScopedClaudeImportPlan["skippedPlugins"]>);
// @ts-expect-error scoped plan diagnostics are a readonly array
void (true satisfies IsMutableArray<ScopedClaudeImportPlan["diagnostics"]>);
// @ts-expect-error complete import plan scopes are a readonly array
void (true satisfies IsMutableArray<ClaudeImportPlan["scopes"]>);
// @ts-expect-error complete import plan diagnostics are a readonly array
void (true satisfies IsMutableArray<ClaudeImportPlan["diagnostics"]>);
