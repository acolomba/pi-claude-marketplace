import { parsePluginSource, sourceLogical } from "../../domain/source.ts";
import { addMarketplace as defaultAddMarketplace } from "../../orchestrators/marketplace/add.ts";
import {
  installPlugin as defaultInstallPlugin,
  type InstallPluginOptions,
  type InstallPluginOutcome,
} from "../../orchestrators/plugin/install.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState as defaultLoadState, type ExtensionState } from "../../persistence/state-io.ts";
import { ConcurrentInstallError, errorMessage, PluginShapeError } from "../../shared/errors.ts";
import { compareByNameThenScope, notify } from "../../shared/notify.ts";

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
import type {
  Dependency,
  MarketplaceNotificationMessage,
  MarketplaceStatus,
  PluginFailedMessage,
  PluginInstalledMessage,
  PluginNotificationMessage,
  PluginSkippedMessage,
  PluginUnavailableMessage,
  Reason,
} from "../../shared/notify.ts";
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
  /**
   * CMC-13 / MSG-SD-1..3: per-row soft-dep predicate inputs propagated
   * from `InstallPluginOutcome.installed`. REQUIRED (mirrors D-01) so the
   * cascade-row build site cannot read `undefined` and silently render the
   * marker as `false` (NFR-7).
   */
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
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

// Advisory warnings (marketplace-failed / unmappable-marketplace-source /
// orphan diagnostics) are dropped: the marketplace status row already
// carries the structural signal. notify() owns severity, reload-hint,
// and soft-dep markers.

interface MarketplaceBlock {
  readonly key: string;
  readonly name: string;
  readonly scope: Scope;
  status?: MarketplaceStatus;
  reasons?: readonly Reason[];
  plugins: PluginNotificationMessage[];
}

function ensureMarketplaceBlock(
  byMp: Map<string, MarketplaceBlock>,
  scope: Scope,
  marketplaceName: string,
): MarketplaceBlock {
  const key = `${scope}:${marketplaceName}`;
  const existing = byMp.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const block: MarketplaceBlock = {
    key,
    name: marketplaceName,
    scope,
    plugins: [],
  };
  byMp.set(key, block);
  return block;
}

function importWarningReason(reason: ImportWarningOutcome["reason"]): Reason {
  switch (reason) {
    case "unavailable":
    case "uninstallable":
      return "no longer installable";
    case "marketplace-failed":
      return "not found";
    case "unmappable-marketplace-source":
      return "unsupported source";
  }
}

function dependenciesFromInstalled(o: PluginInstalledOutcome): readonly Dependency[] {
  const deps: Dependency[] = [];
  if (o.declaresAgents) {
    deps.push("agents");
  }

  if (o.declaresMcp) {
    deps.push("mcp");
  }

  // defense-in-depth: typed readonly + runtime freeze (codebase convention)
  return Object.freeze(deps);
}

/**
 * Converts a `ClaudeImportExecutionResult` into the
 * `MarketplaceNotificationMessage[]` payload for `notify()`.
 *
 * Outcome mapping: added -> "added"; already-present -> "updated";
 * marketplace failure or source mismatch -> "failed"; installed plugin ->
 * PluginInstalledMessage; already-installed plugin -> PluginSkippedMessage
 * with "already installed"; failed/unavailable plugin -> PluginFailedMessage
 * or PluginUnavailableMessage. Advisory-only warnings and orphan diagnostics
 * are silently dropped (the marketplace status row already carries the
 * structural signal).
 *
 * Iteration order: `compareByNameThenScope` (name primary
 * case-insensitive, scope secondary project-before-user). Per-plugin
 * `scope?` is omitted -- every row's scope matches its marketplace's scope
 * by construction, so `notify()` orphan-folds the bracket.
 */
function buildImportNotificationMarketplaces(
  result: ClaudeImportExecutionResult,
): readonly MarketplaceNotificationMessage[] {
  const byMp = new Map<string, MarketplaceBlock>();

  // Marketplace-level outcomes: set status on the (scope, marketplace) tuple.
  for (const o of result.addedMarketplaces) {
    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    block.status = "added";
  }

  for (const o of result.skippedExistingMarketplaces) {
    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    block.status = "updated";
  }

  for (const o of result.marketplaceFailures) {
    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    block.status = "failed";
  }

  // Source-mismatch supersedes any prior status (the import for that
  // marketplace effectively failed); dependent plugin rows accumulate as
  // PluginFailedMessage children under the (failed) header.
  for (const o of result.sourceMismatches) {
    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    block.status = "failed";
    block.reasons = ["source mismatch"] as const;
  }

  // Plugin rows -- orphan-fold contract: per-row `scope?` is OMITTED
  // because the row's scope matches its marketplace's scope by
  // construction (the import cascade groups outcomes by their owning scope).
  for (const o of result.installedPlugins) {
    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    const row: PluginInstalledMessage = {
      status: "installed",
      name: o.plugin,
      dependencies: dependenciesFromInstalled(o),
    };
    block.plugins.push(row);
  }

  for (const o of result.skippedExistingPlugins) {
    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    const row: PluginSkippedMessage = {
      status: "skipped",
      name: o.plugin,
      reasons: ["already installed"] as const,
    };
    block.plugins.push(row);
  }

  for (const o of result.sourceMismatches) {
    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    const row: PluginFailedMessage = {
      status: "failed",
      name: o.plugin,
      reasons: ["source mismatch"] as const,
    };
    block.plugins.push(row);
  }

  for (const o of result.unexpectedPluginFailures) {
    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    const row: PluginFailedMessage = {
      status: "failed",
      name: o.plugin,
      reasons: ["not in manifest"] as const,
    };
    block.plugins.push(row);
  }

  for (const o of result.warnings) {
    // A1 DROP: marketplace-failed / unmappable-marketplace-source warnings
    // have no V2 representation (the failing marketplace's own status: "failed"
    // carries the structural signal; advisory-only warnings are silenced).
    if (o.reason === "marketplace-failed" || o.reason === "unmappable-marketplace-source") {
      continue;
    }

    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    const row: PluginUnavailableMessage = {
      status: "unavailable",
      name: o.plugin,
      reasons: [importWarningReason(o.reason)],
    };
    block.plugins.push(row);
  }

  // A2 DROP: result.diagnostics (orphan + per-marketplace) have no V2
  // representation. The in-memory record stays on the returned result;
  // Pi runtime debug logs preserve diagnostic visibility.

  // : orchestrator owns iteration order; notify does NOT sort.
  // Project-before-user tie-break per MSG-GR-3 via compareByNameThenScope.
  // defense-in-depth: typed readonly + runtime freeze (codebase convention)
  return Object.freeze(
    [...byMp.values()]
      .sort((a, b) => compareByNameThenScope(a, b))
      .map(
        (block): MarketplaceNotificationMessage => ({
          name: block.name,
          scope: block.scope,
          ...(block.status !== undefined && { status: block.status }),
          ...(block.reasons !== undefined && { reasons: block.reasons }),
          // defense-in-depth: typed readonly + runtime freeze (codebase convention)
          plugins: Object.freeze(block.plugins),
        }),
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
        pi: opts.pi,
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

    // WR-02 (gap closure, Plan 20-05): catch unexpected installPlugin throws
    // and route them to result.unexpectedPluginFailures matching
    // dispatchFailedOutcome's shape; per-scope loop continues and the final
    // notify() at the end of importClaudeSettings still fires.
    let outcome: InstallPluginOutcome;
    try {
      outcome = await installPlugin({
        ctx: opts.ctx,
        pi: opts.pi,
        scope: plugin.scope,
        cwd: opts.cwd,
        marketplace: plugin.ref.marketplace,
        plugin: plugin.ref.plugin,
        notifications: { mode: "orchestrated" },
      });
    } catch (err) {
      result.unexpectedPluginFailures.push({
        kind: "plugin-failure",
        scope: plugin.scope,
        plugin: plugin.ref.plugin,
        marketplace: plugin.ref.marketplace,
        ref: refLabel(plugin),
        reason: "unexpected-failure",
        cause: errorMessage(err),
      });
      continue;
    }

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
          declaresAgents: outcome.declaresAgents,
          declaresMcp: outcome.declaresMcp,
        });
        result.changedResources ||= outcome.resourcesChanged;
        // Surface any post-commit warnings collected in orchestrated mode.
        for (const w of outcome.postCommitWarnings ?? []) {
          pushDiagnostic(result, plugin.scope, "post-install-warning", w, {
            ref: refLabel(plugin),
          });
        }

        break;
      case "failed":
        // Collapsed `status: "failed"` carries the typed Error directly.
        // Narrow on `instanceof PluginShapeError` + `.kind` to recover
        // the specific failure class; everything else falls through to
        // the unexpected-failure bucket.
        dispatchFailedOutcome(result, plugin, outcome.error, outcome.cause);
        break;
    }
  }
}

/**
 * Recover the semantic dispatch from the typed `Error` in the collapsed
 * `status: "failed"` outcome. `PluginShapeError.kind === "already-installed"`
 * and `ConcurrentInstallError` both route to the skip bucket;
 * `not-in-manifest` and `(no-)not-installable` route to the
 * unavailable / uninstallable warnings; everything else lands in
 * `unexpectedPluginFailures`.
 */
function dispatchFailedOutcome(
  result: MutableImportResult,
  plugin: PlannedPluginImport,
  error: Error,
  cause: string,
): void {
  if (error instanceof ConcurrentInstallError) {
    result.skippedExistingPlugins.push({
      kind: "plugin-skip",
      scope: plugin.scope,
      plugin: plugin.ref.plugin,
      marketplace: plugin.ref.marketplace,
      ref: refLabel(plugin),
      reason: "already-installed",
    });
    return;
  }

  if (error instanceof PluginShapeError) {
    // Switch on `error.shape.kind` for compile-time exhaustiveness.
    switch (error.shape.kind) {
      case "already-installed":
        result.skippedExistingPlugins.push({
          kind: "plugin-skip",
          scope: plugin.scope,
          plugin: plugin.ref.plugin,
          marketplace: plugin.ref.marketplace,
          ref: refLabel(plugin),
          reason: "already-installed",
        });
        return;
      case "not-in-manifest":
        pushPluginWarning(result, plugin, "unavailable", cause);
        return;
      case "not-installable":
      case "no-longer-installable":
        pushPluginWarning(result, plugin, "uninstallable", cause);
        return;
    }
  }

  result.unexpectedPluginFailures.push({
    kind: "plugin-failure",
    scope: plugin.scope,
    plugin: plugin.ref.plugin,
    marketplace: plugin.ref.marketplace,
    ref: refLabel(plugin),
    reason: "unexpected-failure",
    cause,
  });
}

export async function importClaudeSettings(
  opts: ImportClaudeSettingsOptions,
): Promise<ClaudeImportExecutionResult> {
  const result = emptyResult();
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

  // Plan 20-02 / D-20-02 (strict D-19-02 mirror): V2 cascade construction
  // mirrors the Plan 19-04 reinstall.ts recipe at
  // orchestrators/plugin/reinstall.ts; execute.ts substitutes the
  // import-cascade variant set (added / updated / failed marketplaces
  // Truly catastrophic throws bubble to Pi runtime -- better for debugging
  // than a polished error message that masks the bug. The inner
  // executeScopedPlan try/catch covers expected loadState failures.
  const marketplaces = buildImportNotificationMarketplaces(result);
  notify(opts.ctx, opts.pi, { marketplaces });

  return result;
}
