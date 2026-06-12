import { parsePluginSource, samePlannedSource, sourceLogical } from "../../domain/source.ts";
import { addMarketplace as defaultAddMarketplace } from "../../orchestrators/marketplace/add.ts";
import {
  installPlugin as defaultInstallPlugin,
  type InstallPluginOptions,
  type InstallPluginOutcome,
} from "../../orchestrators/plugin/install.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import {
  writeBatchedConfigEntries,
  type BatchedConfigPatch,
} from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState as defaultLoadState, type ExtensionState } from "../../persistence/state-io.ts";
import { ConcurrentInstallError, errorMessage, PluginShapeError } from "../../shared/errors.ts";
import { compareByNameThenScope, notify } from "../../shared/notify.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { buildClaudeImportPlan } from "./marketplaces.ts";
import { loadMergedClaudeSettingsForScope as defaultLoadSettings } from "./settings.ts";

import type {
  ImportDiagnostic,
  ImportDiagnosticCode,
  MergedClaudeSettingsResult,
  PlannedPluginImport,
} from "./types.ts";
import type {
  AddMarketplaceOptions,
  AddMarketplaceOutcome,
} from "../../orchestrators/marketplace/add.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  ContentReason,
  Dependency,
  MarketplaceNotificationMessage,
  MarketplaceStatus,
  PluginFailedMessage,
  PluginInstalledMessage,
  PluginNotificationMessage,
  PluginSkippedMessage,
  PluginUnavailableMessage,
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
  readonly addMarketplace?: (
    opts: AddMarketplaceOptions,
  ) => Promise<AddMarketplaceOutcome | undefined>;
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

// `samePlannedSource` lives in `domain/source.ts` so the pure
// `orchestrators/reconcile/plan.ts` can import it without dragging this
// module's effectful transitive closure.

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
): (opts: AddMarketplaceOptions) => Promise<AddMarketplaceOutcome | undefined> {
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

function importWarningReason(reason: ImportWarningOutcome["reason"]): ContentReason {
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
  // PluginFailedMessage children under the (failed) header. The mp-level
  // `failed` arm carries NO `reasons` (D-46-03a): `renderMpHeader`'s failed
  // arm renders only `(failed)` and the source-mismatch reason rides the
  // child `PluginFailedMessage` row below.
  for (const o of result.sourceMismatches) {
    const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
    block.status = "failed";
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
    // marketplace-failed / unmappable-marketplace-source warnings
    // have no notification representation (the failing marketplace's own
    // status: "failed" carries the structural signal; advisory-only warnings
    // are silenced).
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

  // result.diagnostics (orphan + per-marketplace) have no notification
  // representation. The in-memory record stays on the returned result;
  // Pi runtime debug logs preserve diagnostic visibility.

  // orchestrator owns iteration order; notify does NOT sort.
  // Project-before-user tie-break per MSG-GR-3 via compareByNameThenScope.
  // defense-in-depth: typed readonly + runtime freeze (codebase convention)
  return Object.freeze(
    [...byMp.values()].sort((a, b) => compareByNameThenScope(a, b)).map(blockToMarketplaceMessage),
  );
}

/**
 * Construct the concrete per-status `MarketplaceNotificationMessage` arm
 * (TYPE-04 / D-46-03) for an accumulated `MarketplaceBlock`. The import path
 * only ever sets `status` to `"added"` / `"updated"` / `"failed"` (or leaves
 * it absent for the list/inventory arm), so the switch needs exactly those
 * arms; a future status added to the import path becomes a compile error at
 * `assertNever`. (The full B-6 reducer cleanup, TYPE-F3, is deferred
 * post-v1.10.)
 */
function blockToMarketplaceMessage(block: MarketplaceBlock): MarketplaceNotificationMessage {
  const name = block.name;
  const scope = block.scope;
  // defense-in-depth: typed readonly + runtime freeze (codebase convention)
  const plugins = Object.freeze(block.plugins);
  switch (block.status) {
    case "added":
      return { name, scope, status: "added", plugins };
    case "updated":
      return { name, scope, status: "updated", plugins };
    case "failed":
      return { name, scope, status: "failed", plugins };
    case undefined:
      return { name, scope, plugins };
    default:
      // The import path never produces "removed" / "skipped" / autoupdate
      // statuses; an unhandled status is a producer-contract violation.
      throw new Error(`unexpected import marketplace status: ${block.status}`);
  }
}

type ScopedImportPlan = ReturnType<typeof buildClaudeImportPlan>["scopes"][number];

/**
 * WR-07: shared failure bookkeeping for a marketplace add
 * that did not record (typed failed outcome OR unexpected throw): block
 * dependent plugin installs and attribute the cause on both the marketplace
 * row and each dependent plugin's warning row.
 */
function recordMarketplaceAddFailure(
  result: MutableImportResult,
  blockedMarketplaces: Set<string>,
  scopePlan: ScopedImportPlan,
  marketplace: ScopedImportPlan["marketplacesToEnsure"][number],
  cause: string,
): void {
  blockedMarketplaces.add(marketplace.marketplace);
  result.marketplaceFailures.push({
    kind: "marketplace-failure",
    scope: marketplace.scope,
    marketplace: marketplace.marketplace,
    reason: "add-failed",
    cause,
  });
  for (const plugin of pluginsForMarketplace(scopePlan.pluginsToInstall, marketplace.marketplace)) {
    pushPluginWarning(result, plugin, "marketplace-failed", cause);
  }
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
      switch (sourceMatch) {
        case "unknown-stored":
          // The stored source record is in an unrecognized format (e.g.
          // manually edited state.json). Block dependent plugins and emit a
          // clear diagnostic rather than a misleading source-mismatch
          // message.
          blockedMarketplaces.add(marketplace.marketplace);
          pushDiagnostic(
            result,
            marketplace.scope,
            "unrecognized-stored-source",
            `Marketplace "${marketplace.marketplace}" has an unrecognized stored source format. Verify state.json or remove and re-add the marketplace.`,
            { marketplace: marketplace.marketplace },
          );
          break;
        case "same":
          result.skippedExistingMarketplaces.push({
            kind: "marketplace-skip",
            scope: marketplace.scope,
            marketplace: marketplace.marketplace,
            reason: "already-present",
          });
          break;
        case "different": {
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

          break;
        }
      }

      continue;
    }

    // WR-07: drive the add in ORCHESTRATED mode and
    // dispatch on the typed outcome. In standalone mode a classified
    // precondition failure (duplicate name, stale clone, invalid manifest,
    // unsupported source, source missing) does NOT throw -- it fires its own
    // standalone notify (breaking import's one-cascade-per-command
    // discipline) and returns undefined, so the import recorded the
    // marketplace as (added), never blocked its dependent plugins, and each
    // install then failed with a misleading reason.
    try {
      const outcome = await addMarketplace({
        ctx: opts.ctx,
        pi: opts.pi,
        scope: marketplace.scope,
        cwd: opts.cwd,
        rawSource: marketplace.source,
        notifications: { mode: "orchestrated" },
        ...(opts.gitOps !== undefined && { gitOps: opts.gitOps }),
      });
      if (outcome?.status === "added") {
        result.addedMarketplaces.push({
          kind: "marketplace-added",
          scope: marketplace.scope,
          marketplace: marketplace.marketplace,
          reason: "added",
        });
      } else {
        recordMarketplaceAddFailure(
          result,
          blockedMarketplaces,
          scopePlan,
          marketplace,
          outcome?.cause ?? "addMarketplace returned no outcome in orchestrated mode",
        );
      }
    } catch (err) {
      // Defensive: orchestrated mode coerces classified failures into typed
      // outcomes, so only a genuinely unexpected throw lands here.
      recordMarketplaceAddFailure(
        result,
        blockedMarketplaces,
        scopePlan,
        marketplace,
        errorMessage(err),
      );
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

    // WR-02: catch unexpected installPlugin throws
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

  // WB-03: after all per-entry orchestrated-mode addMarketplace
  // + installPlugin calls complete for THIS scope, run a per-scope batched
  // post-pass under ONE withLockedStateTransaction. Per-entry orchestrators
  // SKIPPED their own write-back (WR-09 orchestrated-mode discipline) so the
  // post-pass owns the ONLY write to claude-plugins.json for the import
  // command.
  //
  // WR-01: the post-pass also REPAIRS missing config
  // declarations for already-present (skipped) entries. If a previous
  // import's post-pass failed (the defensive catch below records a
  // diagnostic and moves on), state carries entries the config never
  // declared -- and without the repair, a re-run would skip them as
  // "already-present" while the next reconcile plans the undeclared
  // marketplace for REMOVAL and its plugins for UNINSTALL. The repair makes
  // a re-run converge CONSTRUCTIVELY (re-declare what import installed)
  // instead of destructively.
  await writeBatchedConfigForScope(opts, result, scopePlan);
}

/**
 * WB-03: per-scope batched post-pass.
 *
 * Reads back `result` for entries WHOSE scope matches this scope, builds a
 * `BatchedConfigPatch` (one entry per successful addedMarketplaces + one per
 * successful installedPlugins), and writes the patch under ONE
 * withLockedStateTransaction with exactly ONE saveConfig call.
 *
 * WR-01: skip outcomes (`skippedExistingMarketplaces` /
 * `skippedExistingPlugins`) are included as REPAIR candidates -- written
 * ONLY when the loaded config does not already declare the key (the
 * key-absence gate preserves RECON-05 byte stability for the all-declared
 * steady state). This makes a previously failed post-pass converge
 * constructively on the next import run instead of leaving
 * recorded-but-undeclared entries the reconcile planner would tear down.
 *
 * Target: import does NOT support `--local` (per RESEARCH project structure;
 * the flag is per-command and not on the import surface), so the post-pass
 * targets `locations.configJsonPath` unconditionally.
 *
 * Source: verbatim `rawSource` from `scopePlan.marketplacesToEnsure` keyed by
 * marketplace name, preserving the `samePlannedSource` contract.
 *
 * CFG-03: invalid claude-plugins.json aborts THIS scope's post-pass but does
 * NOT throw -- other scopes' post-passes still run. State was already saved
 * by per-entry orchestrators; this post-pass writes only the config.
 *
 * Empty batch (no successful additions AND no missing-declaration repairs):
 * SKIP entirely (RECON-05 byte-stable).
 */
async function writeBatchedConfigForScope(
  opts: ImportClaudeSettingsOptions,
  result: MutableImportResult,
  scopePlan: ScopedImportPlan,
): Promise<void> {
  const scope = scopePlan.scope;
  const { ensure, repair } = buildBatchedPatchForScope(result, scopePlan);
  if (isEmptyPatch(ensure) && isEmptyPatch(repair)) {
    return;
  }

  const locations = locationsFor(scope, opts.cwd);
  const targetConfigPath = locations.configJsonPath;

  try {
    await withLockedStateTransaction(locations, async () => {
      const cfg = await loadConfig(targetConfigPath);
      if (cfg.status === "invalid") {
        // CFG-03: per-scope abort. Surface as a diagnostic; do not save.
        pushDiagnostic(
          result,
          scope,
          "settings-read-error",
          `Cannot write ${scope} scope claude-plugins.json: existing file is invalid.`,
        );
        return;
      }

      const current = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 as const };
      // WR-01: repairs apply ONLY when the key is absent from the loaded
      // config (already-declared entries are untouched -- byte stability).
      const batch = mergeEnsureAndRepairs(ensure, repair, current);
      if (isEmptyPatch(batch)) {
        // Everything already declared -- no write, mtime stable (RECON-05).
        return;
      }

      await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, batch);
      // NO tx.save() -- state was already committed by per-entry
      // orchestrators inside their own withStateGuard / withLockedStateTransaction
      // closures. The bounded race between the last per-entry lock release and
      // this batched-save lock acquire converges via the WR-01 repair pass:
      // a re-run of import re-declares any entry the failed write left
      // undeclared (constructive convergence, not a reconcile teardown).
    });
  } catch (err) {
    // Defensive: a write-back failure (disk full, EACCES, lock contention)
    // does not abort the import command result -- per-entry orchestrators
    // already committed state. Surface as a per-scope diagnostic.
    pushDiagnostic(
      result,
      scope,
      "settings-read-error",
      `Failed to write ${scope} scope claude-plugins.json batched post-pass: ${errorMessage(err)}`,
    );
  }
}

function buildBatchedPatchForScope(
  result: MutableImportResult,
  scopePlan: ScopedImportPlan,
): { ensure: BatchedConfigPatch; repair: BatchedConfigPatch } {
  // Map marketplace name -> verbatim rawSource so the batched patch records
  // `source: rawSource` exactly as the user/Claude settings declared it
  // (`samePlannedSource` contract).
  const rawSourceByName = new Map<string, string>();
  for (const mp of scopePlan.marketplacesToEnsure) {
    rawSourceByName.set(mp.marketplace, mp.source);
  }

  const marketplaces: Record<string, { source: string }> = {};
  for (const added of result.addedMarketplaces) {
    if (added.scope !== scopePlan.scope) {
      continue;
    }

    const rawSource = rawSourceByName.get(added.marketplace);
    if (rawSource === undefined) {
      // Defensive: should not happen -- every addedMarketplaces entry
      // originated from a marketplacesToEnsure entry. Skip rather than
      // synthesize a wrong source.
      continue;
    }

    marketplaces[added.marketplace] = { source: rawSource };
  }

  const plugins: Record<string, Record<string, never>> = {};
  for (const installed of result.installedPlugins) {
    if (installed.scope !== scopePlan.scope) {
      continue;
    }

    const key = `${installed.plugin}@${installed.marketplace}`;
    plugins[key] = {};
  }

  return {
    ensure: { marketplaces, plugins },
    repair: buildRepairPatchForScope(result, scopePlan, rawSourceByName),
  };
}

/**
 * WR-01: already-present (skipped) entries are REPAIR
 * candidates -- state carries them, so a missing config declaration is a
 * divergence the reconcile planner would resolve DESTRUCTIVELY (teardown).
 * The caller applies these only when the loaded config lacks the key.
 */
function buildRepairPatchForScope(
  result: MutableImportResult,
  scopePlan: ScopedImportPlan,
  rawSourceByName: ReadonlyMap<string, string>,
): BatchedConfigPatch {
  const marketplaces: Record<string, { source: string }> = {};
  for (const skipped of result.skippedExistingMarketplaces) {
    if (skipped.scope !== scopePlan.scope) {
      continue;
    }

    const rawSource = rawSourceByName.get(skipped.marketplace);
    if (rawSource === undefined) {
      continue;
    }

    marketplaces[skipped.marketplace] = { source: rawSource };
  }

  const plugins: Record<string, Record<string, never>> = {};
  for (const skipped of result.skippedExistingPlugins) {
    if (skipped.scope !== scopePlan.scope) {
      continue;
    }

    plugins[`${skipped.plugin}@${skipped.marketplace}`] = {};
  }

  return { marketplaces, plugins };
}

/**
 * WR-01: merge the always-written `ensure` patch with the subset of `repair`
 * entries whose keys are ABSENT from the loaded config. Already-declared
 * keys are dropped so the all-declared steady state stays byte-stable
 * (RECON-05) -- the post-pass then skips the save entirely when nothing
 * remains.
 */
function mergeEnsureAndRepairs(
  ensure: BatchedConfigPatch,
  repair: BatchedConfigPatch,
  current: { marketplaces?: Record<string, unknown>; plugins?: Record<string, unknown> },
): BatchedConfigPatch {
  const marketplaces = { ...ensure.marketplaces };
  for (const [name, patch] of Object.entries(repair.marketplaces ?? {})) {
    if (current.marketplaces?.[name] === undefined && marketplaces[name] === undefined) {
      marketplaces[name] = patch;
    }
  }

  const plugins = { ...ensure.plugins };
  for (const [key, patch] of Object.entries(repair.plugins ?? {})) {
    if (current.plugins?.[key] === undefined && plugins[key] === undefined) {
      plugins[key] = patch;
    }
  }

  return { marketplaces, plugins };
}

function isEmptyPatch(batch: BatchedConfigPatch): boolean {
  return (
    Object.keys(batch.marketplaces ?? {}).length === 0 &&
    Object.keys(batch.plugins ?? {}).length === 0
  );
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

  // D-20-02 / D-19-02: cascade construction
  // mirrors the reinstall.ts recipe at
  // orchestrators/plugin/reinstall.ts; execute.ts substitutes the
  // import-cascade variant set (added / updated / failed marketplaces).
  // Truly catastrophic throws bubble to Pi runtime -- better for debugging
  // than a polished error message that masks the bug. The inner
  // executeScopedPlan try/catch covers expected loadState failures.
  const marketplaces = buildImportNotificationMarketplaces(result);
  notify(opts.ctx, opts.pi, { marketplaces });

  return result;
}
