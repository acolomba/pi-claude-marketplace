import { parsePluginSource, sourceLogical } from "../../domain/source.ts";
import { addMarketplace as defaultAddMarketplace } from "../../orchestrators/marketplace/add.ts";
import {
  installPlugin as defaultInstallPlugin,
  type InstallPluginOptions,
  type InstallPluginOutcome,
} from "../../orchestrators/plugin/install.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState as defaultLoadState, type ExtensionState } from "../../persistence/state-io.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { cascadeSummary } from "../../presentation/cascade-summary.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { compareByNameThenScope } from "../../presentation/sort.ts";
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
import type {
  MarketplaceRow,
  PluginCascadeRow,
  SoftDepProbe,
} from "../../presentation/compact-line.ts";
import type { Reason } from "../../shared/grammar/reasons.ts";
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

/**
 * Plan 13-02a-01 / CMC-27: Compose the Claude-import body via the Wave 1
 * cascade primitives. The `Claude plugin import summary` preamble is
 * preserved verbatim; per-marketplace cascade blocks render via
 * `cascadeSummary` with marketplace headers carrying their own
 * `(added)` / `(skipped) {already installed}` / `(failed) {source
 * mismatch}` status tokens, and indented plugin rows with
 * `(installed)` / `(skipped)` / `(unavailable)` / `(failed)` statuses.
 *
 * Severity is aggregated per-marketplace via cascadeSeverity (returned
 * by cascadeSummary) and ORed across all marketplaces; the result drives
 * notifySuccess vs notifyWarning (MSG-SR-4..6 -- notifyError is NEVER
 * used for cascade summaries).
 *
 * The `probe` argument defaults to companions-loaded so callers that
 * don't have a Pi handle (legacy formatClaudeImportSummary signature)
 * still produce sensible output; production callers pass the real probe.
 */
const PREAMBLE = "Claude plugin import summary";
const DEFAULT_PROBE: SoftDepProbe = { piSubagentsLoaded: true, piMcpAdapterLoaded: true };

interface ImportCascadeInput {
  readonly key: string;
  readonly marketplace: MarketplaceRow;
  readonly rows: PluginCascadeRow[];
}

export function formatClaudeImportSummary(
  result: ClaudeImportExecutionResult,
  probe: SoftDepProbe = DEFAULT_PROBE,
): string {
  const { body } = composeImportSummary(result, probe);
  const hint = reloadHint(
    result.installedPlugins.filter((o) => o.resourcesChanged).map((o) => o.plugin),
  );
  return appendReloadHint(body, hint);
}

interface ComposedImport {
  readonly body: string;
  readonly severity: "success" | "warning";
}

function composeImportSummary(
  result: ClaudeImportExecutionResult,
  probe: SoftDepProbe,
): ComposedImport {
  // Build per-(scope, marketplace) cascade blocks from the result arrays.
  // The marketplace blocks render in deterministic order via
  // compareByNameThenScope (name primary case-insensitive, scope secondary
  // project-before-user per MSG-GR-3).
  const byMp = new Map<string, ImportCascadeInput>();
  enumerateMarketplaceBlocks(result, byMp);

  // "Already up to date" confirmation line: surfaces under the preamble
  // when nothing was actually added or installed (skipped rows do not
  // count as changes). The legacy formatter emitted this verbatim
  // alongside the (now-retired) `Skipped existing items:` partition
  // body; the cascade body below still renders the skipped rows, but
  // the confirmation line stays as the operator's "nothing actually
  // happened" signal.
  const upToDateNotice =
    !anyChanges(result) && !hasWarnings(result) ? "Import already up to date." : "";

  // Top-level orphan signal: diagnostics that don't tie to a marketplace
  // (settings-read-error, etc.) get surfaced as a bare line beneath the
  // preamble. Keeps the cascade body clean per CMC-27.
  const orphanLines = orphanDiagnosticLines(result);

  const blocks = [...byMp.values()].sort((a, b) =>
    compareByNameThenScope(a.marketplace, b.marketplace),
  );

  const segments: string[] = [];
  let aggregatedSeverity: "success" | "warning" = "success";
  for (const block of blocks) {
    const { message, severity } = cascadeSummary({
      marketplace: block.marketplace,
      rows: block.rows,
      probe,
    });
    segments.push(message);
    if (severity === "warning") {
      aggregatedSeverity = "warning";
    }
  }

  // Orphan diagnostic lines are warning-severity by construction
  // (loadState errors block the scope; settings-parse errors block
  // the import for that scope). Pin severity accordingly.
  if (orphanLines.length > 0) {
    aggregatedSeverity = "warning";
  }

  // Source-mismatch: surface the diagnostic line beneath the failing
  // marketplace header so the user sees the reason inline (catalog
  // lines 525-540). The line lives in `result.sourceMismatches[].cause`.
  const cascadeBodyWithDiagnostics = spliceSourceMismatchDiagnostics(segments, blocks, result);

  const sections: string[] = [PREAMBLE];
  if (upToDateNotice !== "") {
    sections.push(upToDateNotice);
  }

  for (const line of orphanLines) {
    sections.push(line);
  }

  if (cascadeBodyWithDiagnostics !== "") {
    sections.push(cascadeBodyWithDiagnostics);
  }

  return { body: sections.join("\n\n"), severity: aggregatedSeverity };
}

function enumerateMarketplaceBlocks(
  result: ClaudeImportExecutionResult,
  byMp: Map<string, ImportCascadeInput>,
): void {
  // Marketplace headers come from added / skipped-existing / failed /
  // source-mismatch records. Each yields one MarketplaceRow.
  for (const o of result.addedMarketplaces) {
    ensureBlock(byMp, o.scope, o.marketplace, {
      status: "added",
      outcomeClass: "ok",
      // The source kind isn't carried on the added outcome; the import
      // planner records it indirectly via the plugin's source mapping.
      // We omit the autoupdate marker for now (Wave 3 catalog UAT is the
      // binding verification; sub-wave 2c will revisit github-source
      // marker propagation if needed).
    });
  }

  for (const o of result.skippedExistingMarketplaces) {
    ensureBlock(byMp, o.scope, o.marketplace, {
      status: "skipped",
      reasons: ["already installed"],
      outcomeClass: "ok",
    });
  }

  for (const o of result.marketplaceFailures) {
    ensureBlock(byMp, o.scope, o.marketplace, {
      status: "failed",
      reasons: ["not found"],
      outcomeClass: "failure",
    });
  }

  // Source-mismatch records carry the marketplace identity via the
  // dependent plugin's ref. Group dependent plugins by mp+scope and
  // synthesize a (failed) {source mismatch} header. addedMarketplaces
  // entries for the same mp would have already inserted an entry; the
  // failure shape supersedes (the source-mismatch path is mutually
  // exclusive with addMarketplace success).
  for (const o of result.sourceMismatches) {
    upsertSourceMismatchHeader(byMp, o.scope, o.marketplace);
  }

  // Plugin rows -- map each install / skip / warning / failure to a
  // PluginCascadeRow under its marketplace header. If no header exists
  // for this plugin's marketplace (e.g. installed against an existing
  // marketplace whose header wasn't in addedMarketplaces), synthesize a
  // bare label header so the plugin still renders under its marketplace.
  // CMC-13 / MSG-SD-1..3: predicates propagated from install outcome
  for (const o of result.installedPlugins) {
    const block = ensureBareHeader(byMp, o.scope, o.marketplace);
    block.rows.push({
      kind: "plugin-cascade",
      name: o.plugin,
      scope: o.scope,
      status: "installed",
      declaresAgents: o.declaresAgents,
      declaresMcp: o.declaresMcp,
    });
  }

  for (const o of result.skippedExistingPlugins) {
    const block = ensureBareHeader(byMp, o.scope, o.marketplace);
    block.rows.push({
      kind: "plugin-cascade",
      name: o.plugin,
      scope: o.scope,
      status: "skipped",
      reasons: ["already installed"],
    });
  }

  for (const o of result.sourceMismatches) {
    const block = ensureBareHeader(byMp, o.scope, o.marketplace);
    block.rows.push({
      kind: "plugin-cascade",
      name: o.plugin,
      scope: o.scope,
      status: "skipped",
      reasons: ["source mismatch"],
    });
  }

  for (const o of result.unexpectedPluginFailures) {
    const block = ensureBareHeader(byMp, o.scope, o.marketplace);
    block.rows.push({
      kind: "plugin-cascade",
      name: o.plugin,
      scope: o.scope,
      status: "failed",
      reasons: ["not in manifest"],
    });
  }

  for (const o of result.warnings) {
    const block = ensureBareHeader(byMp, o.scope, o.marketplace);
    block.rows.push({
      kind: "plugin-cascade",
      name: o.plugin,
      scope: o.scope,
      status: importWarningStatus(o.reason),
      reasons: [importWarningReason(o.reason)],
    });
  }
}

function importWarningStatus(reason: ImportWarningOutcome["reason"]): "unavailable" | "skipped" {
  switch (reason) {
    case "unavailable":
    case "uninstallable":
      return "unavailable";
    case "marketplace-failed":
    case "unmappable-marketplace-source":
      return "skipped";
  }
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

function ensureBlock(
  byMp: Map<string, ImportCascadeInput>,
  scope: Scope,
  marketplaceName: string,
  spec: {
    status?: MarketplaceRow["status"];
    reasons?: readonly Reason[];
    outcomeClass: "ok" | "failure";
  },
): ImportCascadeInput {
  const key = `${scope}:${marketplaceName}`;
  const existing = byMp.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const marketplace: MarketplaceRow = {
    kind: "marketplace",
    name: marketplaceName,
    scope,
    ...(spec.status !== undefined && { status: spec.status }),
    ...(spec.reasons !== undefined && { reasons: spec.reasons }),
    outcomeClass: spec.outcomeClass,
  };
  const entry: ImportCascadeInput = { key, marketplace, rows: [] };
  byMp.set(key, entry);
  return entry;
}

function ensureBareHeader(
  byMp: Map<string, ImportCascadeInput>,
  scope: Scope,
  marketplaceName: string,
): ImportCascadeInput {
  return ensureBlock(byMp, scope, marketplaceName, { outcomeClass: "ok" });
}

/**
 * Source-mismatch headers supersede whatever (added/skipped) header was
 * already registered for the same marketplace because the import for that
 * marketplace effectively failed; the dependent plugins below render as
 * `(skipped) {source mismatch}` children. Catalog lines 525-540.
 */
function upsertSourceMismatchHeader(
  byMp: Map<string, ImportCascadeInput>,
  scope: Scope,
  marketplaceName: string,
): void {
  const key = `${scope}:${marketplaceName}`;
  const existing = byMp.get(key);
  const marketplace: MarketplaceRow = {
    kind: "marketplace",
    name: marketplaceName,
    scope,
    status: "failed",
    reasons: ["source mismatch"],
    outcomeClass: "failure",
  };
  if (existing === undefined) {
    byMp.set(key, { key, marketplace, rows: [] });
    return;
  }

  // Replace the header; keep accumulated rows so dependent plugins still
  // render under the same block.
  byMp.set(key, { key, marketplace, rows: existing.rows });
}

/**
 * Surface free-text source-mismatch cause lines beneath their owning
 * marketplace header (catalog: the diagnostic sits indented 2 spaces
 * under the `⊘ <mp> [scope] (failed) {source mismatch}` header, before
 * the dependent plugin rows). cascadeSummary already produced the header
 * line; we splice the cause text after it.
 */
function spliceSourceMismatchDiagnostics(
  segments: readonly string[],
  blocks: readonly ImportCascadeInput[],
  result: ClaudeImportExecutionResult,
): string {
  if (result.sourceMismatches.length === 0) {
    return segments.join("\n\n");
  }

  // Map each block (by index) to the cause text of its first source-mismatch
  // dependent plugin (one cause per marketplace; the cause text is
  // identical for all dependent plugins of the same mp).
  const causeByBlockIdx = new Map<number, string>();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b === undefined) {
      continue;
    }

    if (b.marketplace.outcomeClass !== "failure") {
      continue;
    }

    const mismatch = result.sourceMismatches.find(
      (m) => m.scope === b.marketplace.scope && m.marketplace === b.marketplace.name,
    );
    if (mismatch !== undefined) {
      causeByBlockIdx.set(i, mismatch.cause);
    }
  }

  if (causeByBlockIdx.size === 0) {
    return segments.join("\n\n");
  }

  const updated = segments.map((segment, idx) => {
    const cause = causeByBlockIdx.get(idx);
    if (cause === undefined) {
      return segment;
    }

    // Splice the cause line after the header (first line) and before
    // any indented plugin rows.
    const lines = segment.split("\n");
    if (lines.length === 0) {
      return segment;
    }

    const header = lines[0] ?? "";
    const rest = lines.slice(1);
    return [header, `  ${cause}`, ...rest].join("\n");
  });

  return updated.join("\n\n");
}

function orphanDiagnosticLines(result: ClaudeImportExecutionResult): readonly string[] {
  const lines: string[] = [];
  for (const d of result.diagnostics) {
    // Diagnostics tied to a marketplace render inside the cascade above
    // (per-marketplace block); diagnostics without a marketplace tie --
    // including malformed-enabled-plugin-ref (which carries a `ref` but
    // can't be mapped back to a marketplace cascade because the ref is
    // unparseable) -- surface as bare lines under the preamble. This
    // preserves the legacy behavior of always rendering settings-parse
    // and ref-shape warnings.
    if (d.marketplace !== undefined) {
      continue;
    }

    const subject = d.ref ?? d.path ?? d.code;
    lines.push(`${d.scope}: ${subject} (${d.code}) - ${d.message}`);
  }

  return lines;
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

  // Plan 13-02a-01 / CMC-27 / MSG-SR-4..6: cascade summary severity is
  // restricted to "success" | "warning"; notifyError is forbidden on
  // cascade surfaces. The legacy 3-arm branch (notifyError on
  // unexpectedPluginFailures > 0) collapses to a 2-arm dispatch driven
  // by composeImportSummary's aggregated severity. Per-row failures
  // surface via the cascade row's `(failed)` token; the user sees the
  // failure structurally without a notifyError severity level.
  const probe = softDepStatus(opts.pi);
  const { body, severity } = composeImportSummary(result, probe);
  const hint = reloadHint(
    result.installedPlugins.filter((o) => o.resourcesChanged).map((o) => o.plugin),
  );
  const finalBody = appendReloadHint(body, hint);
  const dispatch = severity === "warning" ? notifyWarning : notifySuccess;
  dispatch(opts.ctx, finalBody);

  return result;
}
