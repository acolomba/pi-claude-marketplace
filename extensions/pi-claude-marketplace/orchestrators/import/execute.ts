import { parsePluginSource, sourceLogical } from "../../domain/source.ts";
import { addMarketplace as defaultAddMarketplace } from "../../orchestrators/marketplace/add.ts";
import {
  installPlugin as defaultInstallPlugin,
  type InstallPluginOptions,
  type InstallPluginOutcome,
} from "../../orchestrators/plugin/install.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState as defaultLoadState, type ExtensionState } from "../../persistence/state-io.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";

import { buildClaudeImportPlan } from "./marketplaces.ts";
import { loadMergedClaudeSettingsForScope as defaultLoadSettings } from "./settings.ts";

import type {
  ImportDiagnostic,
  ImportDiagnosticCode,
  MergedClaudeSettingsResult,
  PlannedPluginImport,
} from "./types.ts";
import type { AddMarketplaceOptions } from "../../orchestrators/marketplace/add.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

export interface MarketplaceAddedOutcome {
  readonly kind: "marketplace-added";
  readonly scope: Scope;
  readonly marketplace: string;
  readonly reason: "added";
}

export interface MarketplaceSkipOutcome {
  readonly kind: "marketplace-skip";
  readonly scope: Scope;
  readonly marketplace: string;
  readonly reason: "already-present";
}

export interface PluginInstalledOutcome {
  readonly kind: "plugin-installed";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly ref: string;
  readonly reason: "installed";
  readonly resourcesChanged: boolean;
}

export interface PluginSkipOutcome {
  readonly kind: "plugin-skip";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly ref: string;
  readonly reason: "already-installed";
}

export interface ImportWarningOutcome {
  readonly kind: "plugin-warning";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly ref: string;
  readonly reason:
    | "unmappable-marketplace-source"
    | "marketplace-failed"
    | "unavailable"
    | "uninstallable";
  readonly cause?: string;
}

export interface MarketplaceFailureOutcome {
  readonly kind: "marketplace-failure";
  readonly scope: Scope;
  readonly marketplace: string;
  readonly reason: "add-failed";
  readonly cause: string;
}

export interface SourceMismatchOutcome {
  readonly kind: "source-mismatch";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly ref: string;
  readonly reason: "source-mismatch";
  readonly cause: string;
}

export interface UnexpectedPluginFailureOutcome {
  readonly kind: "plugin-failure";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly ref: string;
  readonly reason: "unexpected-failure";
  readonly cause: string;
}

// Public readonly result shape. Internal mutation uses MutableImportResult.
export interface ClaudeImportExecutionResult {
  readonly addedMarketplaces: readonly MarketplaceAddedOutcome[];
  readonly installedPlugins: readonly PluginInstalledOutcome[];
  readonly skippedExistingMarketplaces: readonly MarketplaceSkipOutcome[];
  readonly skippedExistingPlugins: readonly PluginSkipOutcome[];
  readonly warnings: readonly ImportWarningOutcome[];
  readonly marketplaceFailures: readonly MarketplaceFailureOutcome[];
  readonly sourceMismatches: readonly SourceMismatchOutcome[];
  readonly unexpectedPluginFailures: readonly UnexpectedPluginFailureOutcome[];
  readonly diagnostics: readonly ImportDiagnostic[];
  readonly changedResources: boolean;
}

// Module-private builder with mutable arrays for accumulation.
interface MutableImportResult {
  addedMarketplaces: MarketplaceAddedOutcome[];
  installedPlugins: PluginInstalledOutcome[];
  skippedExistingMarketplaces: MarketplaceSkipOutcome[];
  skippedExistingPlugins: PluginSkipOutcome[];
  warnings: ImportWarningOutcome[];
  marketplaceFailures: MarketplaceFailureOutcome[];
  sourceMismatches: SourceMismatchOutcome[];
  unexpectedPluginFailures: UnexpectedPluginFailureOutcome[];
  diagnostics: ImportDiagnostic[];
  changedResources: boolean;
}

interface ImportDeps {
  readonly loadSettings?: (
    scope: Scope,
    opts: { cwd: string },
  ) => Promise<MergedClaudeSettingsResult>;
  readonly loadState?: (scope: Scope, cwd: string) => Promise<ExtensionState>;
  readonly addMarketplace?: (opts: AddMarketplaceOptions) => Promise<void>;
  readonly installPlugin?: (opts: InstallPluginOptions) => Promise<InstallPluginOutcome>;
}

export interface ImportClaudeSettingsOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly cwd: string;
  readonly selectedScopes: readonly Scope[];
  readonly gitOps?: AddMarketplaceOptions["gitOps"];
  readonly deps?: ImportDeps;
}

function emptyResult(): MutableImportResult {
  return {
    addedMarketplaces: [],
    installedPlugins: [],
    skippedExistingMarketplaces: [],
    skippedExistingPlugins: [],
    warnings: [],
    marketplaceFailures: [],
    sourceMismatches: [],
    unexpectedPluginFailures: [],
    diagnostics: [],
    changedResources: false,
  };
}

function refLabel(plugin: PlannedPluginImport): string {
  return plugin.ref.raw;
}

function samePlannedSource(stored: unknown, plannedRaw: string): boolean | "unknown-stored" {
  const planned = parsePluginSource(plannedRaw);
  const current = parsePluginSource(stored);

  // Treat unrecognized stored source as a special sentinel so callers can
  // emit a meaningful diagnostic rather than a generic source-mismatch.
  if (current.kind === "unknown") {
    return "unknown-stored";
  }

  if (planned.kind !== current.kind) {
    return false;
  }

  switch (planned.kind) {
    case "github":
      return (
        current.kind === "github" &&
        planned.owner === current.owner &&
        planned.repo === current.repo &&
        planned.ref === current.ref
      );
    case "path":
      return current.kind === "path" && planned.logical === current.logical;
    /* c8 ignore next 3 -- import planner only generates path/github sources */
    case "url":
    case "git-subdir":
    case "npm":
      return sourceLogical(planned) === sourceLogical(current);
  }
}

function stateLoader(
  deps: ImportDeps | undefined,
): (scope: Scope, cwd: string) => Promise<ExtensionState> {
  if (deps?.loadState !== undefined) {
    return deps.loadState;
  }

  /* c8 ignore next -- production path; unit tests always inject deps.loadState */
  return async (scope, cwd) => defaultLoadState(locationsFor(scope, cwd).extensionRoot);
}

function settingsLoader(
  deps: ImportDeps | undefined,
): (scope: Scope, opts: { cwd: string }) => Promise<MergedClaudeSettingsResult> {
  return deps?.loadSettings ?? defaultLoadSettings;
}

function addMarketplaceFn(
  deps: ImportDeps | undefined,
): (opts: AddMarketplaceOptions) => Promise<void> {
  return deps?.addMarketplace ?? defaultAddMarketplace;
}

function installPluginFn(
  deps: ImportDeps | undefined,
): (opts: InstallPluginOptions) => Promise<InstallPluginOutcome> {
  return deps?.installPlugin ?? (async (opts) => defaultInstallPlugin(opts));
}

function pluginsForMarketplace(
  plugins: readonly PlannedPluginImport[],
  marketplace: string,
): readonly PlannedPluginImport[] {
  return plugins.filter((plugin) => plugin.ref.marketplace === marketplace);
}

function hasWarnings(result: ClaudeImportExecutionResult): boolean {
  return (
    result.warnings.length > 0 ||
    result.marketplaceFailures.length > 0 ||
    result.sourceMismatches.length > 0 ||
    result.unexpectedPluginFailures.length > 0 ||
    result.diagnostics.length > 0
  );
}

function anyChanges(result: ClaudeImportExecutionResult): boolean {
  return result.addedMarketplaces.length > 0 || result.installedPlugins.length > 0;
}

function pushPluginWarning(
  result: MutableImportResult,
  plugin: PlannedPluginImport,
  reason: ImportWarningOutcome["reason"],
  cause?: string,
): void {
  result.warnings.push({
    kind: "plugin-warning",
    scope: plugin.scope,
    plugin: plugin.ref.plugin,
    marketplace: plugin.ref.marketplace,
    ref: refLabel(plugin),
    reason,
    ...(cause !== undefined && { cause }),
  });
}

function pushDiagnostic(
  result: MutableImportResult,
  scope: Scope,
  code: ImportDiagnosticCode,
  message: string,
  extra?: { ref?: string; marketplace?: string },
): void {
  result.diagnostics.push({
    severity: "warning",
    scope,
    code,
    message,
    ...extra,
  });
}

function appendOutcomeLines(lines: string[], title: string, items: readonly string[]): void {
  if (items.length === 0) {
    return;
  }

  lines.push(`${title}:`);
  for (const item of items) {
    lines.push(`- ${item}`);
  }
}

function causeSuffix(cause: string | undefined): string {
  return cause === undefined ? "" : ` - ${cause}`;
}

export function formatClaudeImportSummary(result: ClaudeImportExecutionResult): string {
  const lines = ["Claude plugin import summary"];

  if (!anyChanges(result) && !hasWarnings(result)) {
    lines.push("Import already up to date.");
  }

  appendOutcomeLines(
    lines,
    "Added marketplaces",
    result.addedMarketplaces.map((o) => `${o.scope}: ${o.marketplace}`),
  );
  appendOutcomeLines(
    lines,
    "Installed plugins",
    result.installedPlugins.map((o) => `${o.scope}: ${o.ref}`),
  );
  appendOutcomeLines(lines, "Skipped existing items", [
    ...result.skippedExistingMarketplaces.map((o) => `${o.scope}: ${o.marketplace} (${o.reason})`),
    ...result.skippedExistingPlugins.map((o) => `${o.scope}: ${o.ref} (${o.reason})`),
  ]);
  appendOutcomeLines(lines, "Warnings", [
    ...result.diagnostics.map((d) => {
      const subject = d.ref ?? d.marketplace ?? d.path ?? d.code;
      return `${d.scope}: ${subject} (${d.code}) - ${d.message}`;
    }),
    ...result.warnings.map((o) => `${o.scope}: ${o.ref} (${o.reason})${causeSuffix(o.cause)}`),
    ...result.marketplaceFailures.map(
      (o) => `${o.scope}: ${o.marketplace} (${o.reason}) - ${o.cause}`,
    ),
    ...result.sourceMismatches.map((o) => `${o.scope}: ${o.ref} (${o.reason}) - ${o.cause}`),
    ...result.unexpectedPluginFailures.map(
      (o) => `${o.scope}: ${o.ref} (${o.reason}) - ${o.cause}`,
    ),
  ]);

  const body = lines.join("\n");
  if (!result.changedResources) {
    return body;
  }

  return appendReloadHint(
    body,
    reloadHint(
      "load",
      result.installedPlugins.filter((o) => o.resourcesChanged).map((o) => o.plugin),
    ),
  );
}

// The import workflow is intentionally linear: ensure marketplaces, record diagnostics,
// then install plugins while preserving per-item continuation semantics.
// eslint-disable-next-line sonarjs/cognitive-complexity
async function executeScopedPlan(
  opts: ImportClaudeSettingsOptions,
  result: MutableImportResult,
  scopePlan: ReturnType<typeof buildClaudeImportPlan>["scopes"][number],
): Promise<void> {
  const loadState = stateLoader(opts.deps);
  const addMarketplace = addMarketplaceFn(opts.deps);
  const installPlugin = installPluginFn(opts.deps);

  let state: ExtensionState;
  try {
    state = await loadState(scopePlan.scope, opts.cwd);
  } catch (err) {
    pushDiagnostic(
      result,
      scopePlan.scope,
      "settings-read-error",
      `Cannot read ${scopePlan.scope} scope state: ${errorMessage(err)}`,
    );
    return;
  }

  const blockedMarketplaces = new Set<string>();

  for (const marketplace of scopePlan.marketplacesToEnsure) {
    const existing = state.marketplaces[marketplace.marketplace];
    if (existing !== undefined) {
      const sourceMatch = samePlannedSource(existing.source, marketplace.source);
      if (sourceMatch === "unknown-stored") {
        // The stored source record is in an unrecognized format (e.g. manually
        // edited state.json). Block dependent plugins and emit a clear diagnostic
        // rather than a misleading source-mismatch message.
        blockedMarketplaces.add(marketplace.marketplace);
        pushDiagnostic(
          result,
          marketplace.scope,
          "unrecognized-stored-source",
          `Marketplace "${marketplace.marketplace}" has an unrecognized stored source format. Verify state.json or remove and re-add the marketplace.`,
          { marketplace: marketplace.marketplace },
        );
      } else if (sourceMatch) {
        result.skippedExistingMarketplaces.push({
          kind: "marketplace-skip",
          scope: marketplace.scope,
          marketplace: marketplace.marketplace,
          reason: "already-present",
        });
      } else {
        blockedMarketplaces.add(marketplace.marketplace);
        const cause = `Existing marketplace source ${sourceLogical(parsePluginSource(existing.source))} does not match Claude settings source ${marketplace.source}.`;
        for (const plugin of pluginsForMarketplace(
          scopePlan.pluginsToInstall,
          marketplace.marketplace,
        )) {
          result.sourceMismatches.push({
            kind: "source-mismatch",
            scope: plugin.scope,
            plugin: plugin.ref.plugin,
            marketplace: plugin.ref.marketplace,
            ref: refLabel(plugin),
            reason: "source-mismatch",
            cause,
          });
        }
      }

      continue;
    }

    try {
      await addMarketplace({
        ctx: opts.ctx,
        scope: marketplace.scope,
        cwd: opts.cwd,
        rawSource: marketplace.source,
        ...(opts.gitOps !== undefined && { gitOps: opts.gitOps }),
      });
      result.addedMarketplaces.push({
        kind: "marketplace-added",
        scope: marketplace.scope,
        marketplace: marketplace.marketplace,
        reason: "added",
      });
    } catch (err) {
      blockedMarketplaces.add(marketplace.marketplace);
      const cause = errorMessage(err);
      result.marketplaceFailures.push({
        kind: "marketplace-failure",
        scope: marketplace.scope,
        marketplace: marketplace.marketplace,
        reason: "add-failed",
        cause,
      });
      for (const plugin of pluginsForMarketplace(
        scopePlan.pluginsToInstall,
        marketplace.marketplace,
      )) {
        pushPluginWarning(result, plugin, "marketplace-failed", cause);
      }
    }
  }

  for (const skipped of scopePlan.skippedPlugins) {
    pushPluginWarning(
      result,
      { scope: skipped.scope, ref: skipped.ref },
      "unmappable-marketplace-source",
      skipped.reason,
    );
  }

  for (const plugin of scopePlan.pluginsToInstall) {
    if (blockedMarketplaces.has(plugin.ref.marketplace)) {
      continue;
    }

    const existingPlugin = state.marketplaces[plugin.ref.marketplace]?.plugins[plugin.ref.plugin];
    if (existingPlugin !== undefined) {
      result.skippedExistingPlugins.push({
        kind: "plugin-skip",
        scope: plugin.scope,
        plugin: plugin.ref.plugin,
        marketplace: plugin.ref.marketplace,
        ref: refLabel(plugin),
        reason: "already-installed",
      });
      continue;
    }

    const outcome = await installPlugin({
      ctx: opts.ctx,
      pi: opts.pi,
      scope: plugin.scope,
      cwd: opts.cwd,
      marketplace: plugin.ref.marketplace,
      plugin: plugin.ref.plugin,
      notifications: { mode: "orchestrated" },
    });

    switch (outcome.status) {
      case "installed":
        result.installedPlugins.push({
          kind: "plugin-installed",
          scope: plugin.scope,
          plugin: plugin.ref.plugin,
          marketplace: plugin.ref.marketplace,
          ref: refLabel(plugin),
          reason: "installed",
          resourcesChanged: outcome.resourcesChanged,
        });
        result.changedResources ||= outcome.resourcesChanged;
        // Surface any post-commit warnings collected in orchestrated mode.
        for (const w of outcome.postCommitWarnings ?? []) {
          pushDiagnostic(result, plugin.scope, "post-install-warning", w, {
            ref: refLabel(plugin),
          });
        }

        break;
      case "already-installed":
        result.skippedExistingPlugins.push({
          kind: "plugin-skip",
          scope: plugin.scope,
          plugin: plugin.ref.plugin,
          marketplace: plugin.ref.marketplace,
          ref: refLabel(plugin),
          reason: "already-installed",
        });
        break;
      case "unavailable":
        pushPluginWarning(result, plugin, "unavailable", outcome.cause);
        break;
      case "uninstallable":
        pushPluginWarning(result, plugin, "uninstallable", outcome.cause);
        break;
      case "unexpected-failure":
        result.unexpectedPluginFailures.push({
          kind: "plugin-failure",
          scope: plugin.scope,
          plugin: plugin.ref.plugin,
          marketplace: plugin.ref.marketplace,
          ref: refLabel(plugin),
          reason: "unexpected-failure",
          cause: outcome.cause,
        });
        break;
    }
  }
}

export async function importClaudeSettings(
  opts: ImportClaudeSettingsOptions,
): Promise<ClaudeImportExecutionResult> {
  const result = emptyResult();
  try {
    const loadSettings = settingsLoader(opts.deps);
    const settingsResults = await Promise.all(
      opts.selectedScopes.map(async (scope) => ({
        scope,
        loaded: await loadSettings(scope, { cwd: opts.cwd }),
      })),
    );

    for (const loaded of settingsResults) {
      result.diagnostics.push(...loaded.loaded.diagnostics);
    }

    const plan = buildClaudeImportPlan(
      settingsResults.map((entry) => ({ scope: entry.scope, settings: entry.loaded.settings })),
    );
    result.diagnostics.push(...plan.diagnostics);

    for (const scopePlan of plan.scopes) {
      await executeScopedPlan(opts, result, scopePlan);
    }
  } catch (err) {
    notifyError(opts.ctx, `Import failed: ${errorMessage(err)}`, err);
    return result;
  }

  const summary = formatClaudeImportSummary(result);
  if (result.unexpectedPluginFailures.length > 0) {
    notifyError(opts.ctx, summary);
  } else if (hasWarnings(result)) {
    notifyWarning(opts.ctx, summary);
  } else {
    notifySuccess(opts.ctx, summary);
  }

  return result;
}
