import { addMarketplace as defaultAddMarketplace } from "../../orchestrators/marketplace/add.ts";
import { type InstallPluginOptions } from "../../orchestrators/plugin/install-flow.ts";
import {
  narrowResolverReasons,
  PROMOTED_ROW_REASONS,
} from "../../orchestrators/plugin/install.messaging.ts";
import {
  createEnableOperation,
  createInstallOperation,
} from "../../orchestrators/plugin/operations.ts";
import { buildScopeSatisfactionVerdict } from "../../orchestrators/reconcile/dependency-verdict.ts";
import { enabledRowFromOutcome } from "../../orchestrators/reconcile/notify.ts";
import { marketplaceSourceClaims, planReconcile } from "../../orchestrators/reconcile/plan.ts";
import { loadConfig, type PluginConfigEntry } from "../../persistence/config-io.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import {
  writeBatchedConfigEntries,
  writePluginConfigEntry,
  type BatchedConfigPatch,
} from "../../persistence/config-write-back.ts";
import { locationsFor, type ScopedLocations } from "../../persistence/locations.ts";
import {
  isRecordedButDisabled,
  loadState as defaultLoadState,
  type ExtensionState,
  type PluginInstallRecord,
} from "../../persistence/state-io.ts";
import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import { declaredDependencies } from "../../shared/concerns/soft-dep.ts";
import {
  ConcurrentInstallError,
  DependencyCascadeError,
  errorMessage,
  hasFetchedUrlCause,
  InstallMarketplaceAddError,
  PluginShapeError,
  rethrowInvalidGitHubBaseUrl,
  StateLockHeldError,
} from "../../shared/errors.ts";
import { classifyGitHostFailure } from "../../shared/git-failure-classifiers.ts";
import { notifyDiagnostic, notifyMcpConfigNotices } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import {
  type MarketplaceStatus,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyInstalledMessage,
  type PluginSkippedMessage,
  type PluginUnavailableMessage,
} from "../../shared/notification-types.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { ownValue, setOwn } from "../../shared/own-key.ts";
import { redactAbsolutePaths, redactCauseChain } from "../../shared/redact-absolute-paths.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { IMPORT_CONTEXT, type ImportMsg } from "./execute.messaging.ts";
import { buildClaudeImportPlan } from "./marketplaces.ts";
import { loadMergedClaudeSettingsForScope as defaultLoadSettings } from "./settings.ts";

import type {
  ClaudeSettingsReadOptions,
  ImportDiagnostic,
  ImportDiagnosticCode,
  MergedClaudeSettingsResult,
  PlannedPluginImport,
} from "./types.ts";
import type {
  AddMarketplaceOptions,
  AddMarketplaceOutcome,
} from "../../orchestrators/marketplace/add.ts";
import type {
  EnableDegradationSignals,
  EnableDisablePluginOptions,
  EnableDisablePluginOutcome,
} from "../../orchestrators/plugin/enable-disable.ts";
import type { InstallHooksRouting } from "../../orchestrators/plugin/install-disable-cascade.ts";
import type { ReconcilePlan } from "../../orchestrators/reconcile/types.ts";
import type {
  InstallPluginOutcome,
  MovedDependency,
  UpdateDependencyRow,
} from "../../orchestrators/types.ts";
import type { MergedConfig } from "../../persistence/config-merge.ts";
import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { McpConfigNotice } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { RollbackPartial } from "../../transaction/phase-ledger.ts";

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
  /** The installed version, which the installed rows of `install` and `enable` show too. */
  readonly version?: string;
  /**
   * CMC-13 / MSG-SD-1..3: per-row soft-dep predicate inputs propagated
   * from `InstallPluginOutcome.installed`. REQUIRED (mirrors D-01) so the
   * cascade-row build site cannot read `undefined` and silently render the
   * marker as `false` (NFR-7).
   */
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  /**
   * D-04-07: the entry named a record that arrived as another plugin's
   * dependency, and the install promoted it rather than installing anew, as
   * its outcome reports. A promotion moves nothing on disk unless it
   * re-materialized a disabled record, so this row's reload hint follows
   * `resourcesChanged` where a fresh install's is unconditional. Omitted for a
   * fresh install.
   */
  readonly promoted?: true;
  /**
   * D-04-07: the promoted record was disabled, so the promotion re-materialized
   * it and enabled it, as the enable verb does. The post-pass then declares it
   * with the enable path's own `enabled: true`: the disable verb left
   * `{ enabled: false }` under the same key, and a bare key merged over that
   * entry would keep the file asking the next reload to disable what this
   * import enabled. Omitted otherwise.
   */
  readonly reenabled?: true;
  /**
   * IMP-10: the degradation signals of an enable, present only on the enable
   * path. They select reconcile's enable row, so a re-enabled partial record
   * reads `(partially-installed)` as it does on a reload. LCCODE-01: the
   * staged-kind facts live only in the required `declares*` members, so the
   * two cannot disagree.
   */
  readonly enableSignals?: Omit<
    EnableDegradationSignals,
    "stagedAgents" | "stagedMcpServers" | "stagedWorkflows"
  >;
  readonly declaresWorkflows: boolean;
}

export interface PluginSkipOutcome {
  readonly kind: "plugin-skip";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly ref: string;
  readonly reason: "already-installed";
}

/**
 * IMP-08: an `uninstallable` warning carries the reasons `install` renders for
 * the same resolver verdict, so its row cannot fall back to a generic token.
 */
export type ImportWarningOutcome = {
  readonly kind: "plugin-warning";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly ref: string;
  readonly cause?: string;
} & (
  | { readonly reason: "unmappable-marketplace-source" }
  | { readonly reason: "marketplace-failed" }
  | { readonly reason: "unavailable" }
  | { readonly reason: "uninstallable"; readonly reasons: readonly ContentReason[] }
);

export interface MarketplaceFailureOutcome {
  readonly kind: "marketplace-failure";
  readonly scope: Scope;
  readonly marketplace: string;
  /**
   * IMP-07: `"lock-held"` marks a scope another process held locked, at the
   * read pass or at the add itself; its cause row carries `{lock held}`.
   */
  readonly reason: "add-failed" | "lock-held";
  readonly cause: string;
  /**
   * GHB-01 / GHB-04: the redacted, rebuilt onward cause chain beyond `cause`'s
   * head, present only when the GitHub base override rewrote the URL the add
   * fetched, so the rendered cause line ends with that URL. IMP-07: a held
   * lock carries the lock error's own onward chain. Omitted for every other
   * failure, whose row renders `cause` alone.
   */
  readonly causeChain?: Error;
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
  /**
   * RESV-06: `"dependency-failed"` marks a `DependencyCascadeError` throw (a
   * cascade closure/constraint/member failure), so the row renders
   * `{dependency failed}`. IMP-09: `"unexpected-failure"` is a failure no
   * other arm classifies; its row carries `runtimeReason` or no reason at all.
   */
  readonly reason: "unexpected-failure" | "dependency-failed" | "lock-held" | "not-installed";
  /**
   * IMP-09: the reason `install` reads off the same unclassified error -- the
   * reason of the marketplace add an install ran, or the git host's answer.
   * Omitted when the error carries neither.
   */
  readonly runtimeReason?: ContentReason;
  readonly cause: string;
  /**
   * T-55-02-02 / T-53-02-02: the redacted, rebuilt onward cause chain beyond
   * `cause`'s head, present only when the failure's `Error` itself carries
   * one. `buildImportNotificationMarketplaces` threads it onto the rendered
   * row's `Error.cause` so the notification grammar's cause-chain walker
   * renders the chain exactly once, the way
   * `orchestrators/reconcile/apply.ts::redactedDependencyCascadeError`
   * rebuilds a dependency's own ledger failure. Omitted when `error` carries
   * no onward cause (`exactOptionalPropertyTypes`).
   */
  readonly causeChain?: Error;
  /**
   * MIM-03 / D-PL6-03: the undo steps the failed install or enable could not
   * finish, as install's failed row lists them. Each cause is already
   * redacted (D-PL6-12). Omitted when every undo finished.
   */
  readonly rollbackPartial?: PluginFailedMessage["rollbackPartial"];
  /**
   * MIM-03 / D-PL6-04: the dependency of a `"dependency-failed"` outcome whose
   * rollback could not finish, by its `plugin@marketplace` key, with its
   * redacted rollback phases. Its cause is the outcome's own `cause` and
   * `causeChain`. The cascade then shows the dependency's row as install does,
   * beside the plugin's bare `{dependency failed}` row. Omitted when the
   * dependency's undo finished.
   */
  readonly failedDependency?: {
    readonly key: string;
    readonly rollbackPartial: NonNullable<PluginFailedMessage["rollbackPartial"]>;
  };
}

/**
 * UPD-DEP-D1 / WR-N5: a dependency an install changed for the plugin it
 * named -- installed, enabled, moved, or the one that failed -- reported
 * under that plugin's marketplace by its full key, as `install` reports it.
 */
interface DependencyChangeOutcome {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly row: UpdateDependencyRow;
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
  /**
   * WR-N5: the dependency changes the installs reported, in install order.
   * The cascade shows them, and the returned result leaves them off.
   */
  dependencyChanges: DependencyChangeOutcome[];
  /**
   * AFILE-04: the MCP config notices the installs returned, in install order.
   * `importClaudeSettings` shows them after the cascade and leaves them off
   * the returned result.
   */
  mcpConfigNotices: McpConfigNotice[];
}

export interface ImportDeps {
  readonly loadSettings?: (
    scope: Scope,
    opts: ClaudeSettingsReadOptions,
  ) => Promise<MergedClaudeSettingsResult>;
  readonly loadState?: (scope: Scope, cwd: string) => Promise<ExtensionState>;
  readonly addMarketplace?: (
    opts: AddMarketplaceOptions,
  ) => Promise<AddMarketplaceOutcome | undefined>;
  readonly installPlugin?: (opts: InstallPluginOptions) => Promise<InstallPluginOutcome>;
  readonly setPluginEnabled?: (
    opts: EnableDisablePluginOptions & { notifications: { mode: "orchestrated" } },
  ) => Promise<EnableDisablePluginOutcome>;
}

export interface ImportClaudeSettingsOptions {
  readonly ctx: ExtensionContext;
  /**
   * D-05 / D-07: the command's run. The import cascade, the nested
   * marketplace adds, and the nested plugin installs read its one
   * soft-dependency snapshot.
   */
  readonly run: NotificationRun;
  readonly cwd: string;
  readonly selectedScopes: readonly Scope[];
  readonly hooksRouting: InstallHooksRouting;
  readonly completionCache: CompletionCache;
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
    dependencyChanges: [],
    changedResources: false,
    mcpConfigNotices: [],
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

  return async (scope, cwd) => defaultLoadState(locationsFor(scope, cwd).extensionRoot);
}

function settingsLoader(
  deps: ImportDeps | undefined,
): (scope: Scope, opts: ClaudeSettingsReadOptions) => Promise<MergedClaudeSettingsResult> {
  return deps?.loadSettings ?? defaultLoadSettings;
}

function addMarketplaceFn(
  deps: ImportDeps | undefined,
): (opts: AddMarketplaceOptions) => Promise<AddMarketplaceOutcome | undefined> {
  return deps?.addMarketplace ?? defaultAddMarketplace;
}

function installPluginFn(
  deps: ImportDeps | undefined,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
): (opts: InstallPluginOptions) => Promise<InstallPluginOutcome> {
  return deps?.installPlugin ?? createInstallOperation(hooksRouting, completionCache);
}

function setPluginEnabledFn(
  deps: ImportDeps | undefined,
  hooksRouting: InstallHooksRouting,
): NonNullable<ImportDeps["setPluginEnabled"]> {
  return deps?.setPluginEnabled ?? createEnableOperation(hooksRouting);
}

function pluginsForMarketplace(
  plugins: readonly PlannedPluginImport[],
  marketplace: string,
): readonly PlannedPluginImport[] {
  return plugins.filter((plugin) => plugin.ref.marketplace === marketplace);
}

function warningBase(
  plugin: PlannedPluginImport,
  cause?: string,
): Omit<Extract<ImportWarningOutcome, { reason: "unavailable" }>, "reason"> {
  return {
    kind: "plugin-warning",
    scope: plugin.scope,
    plugin: plugin.ref.plugin,
    marketplace: plugin.ref.marketplace,
    ref: refLabel(plugin),
    ...(cause !== undefined && { cause }),
  };
}

function pushPluginWarning(
  result: MutableImportResult,
  plugin: PlannedPluginImport,
  reason: Exclude<ImportWarningOutcome["reason"], "uninstallable">,
  cause?: string,
): void {
  result.warnings.push({ ...warningBase(plugin, cause), reason });
}

/** IMP-06: a settings plugin the scope already holds, reported `skipped {already installed}`. */
function pushAlreadyInstalled(result: MutableImportResult, plugin: PlannedPluginImport): void {
  result.skippedExistingPlugins.push({
    kind: "plugin-skip",
    scope: plugin.scope,
    plugin: plugin.ref.plugin,
    marketplace: plugin.ref.marketplace,
    ref: refLabel(plugin),
    reason: "already-installed",
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

/**
 * The marketplace-level statuses the import path assigns, narrowed out of the
 * wide `MarketplaceStatus` set. Assigning any other token is a compile error at
 * the assignment site instead of a runtime signal at render time -- the same
 * narrowing `orchestrators/reconcile/notify.ts` applies to its own block type.
 */
type ImportBlockStatus = Extract<MarketplaceStatus, "added" | "skipped" | "failed">;

/**
 * A marketplace header awaiting render. `status` is REQUIRED, which makes a
 * STATUSLESS HEADER unconstructible: every marketplace that reaches the cascade
 * carries a marketplace-level outcome, because a marketplace whose plugins were
 * allowed to run was either recorded (`added`), already present (`skipped`), or
 * failed (`failed`).
 *
 * WR-04: that is the whole of what the type enforces. It does NOT prevent the
 * opposite shape -- a HEADERLESS ROW, i.e. a key in the sibling `rowsByMp` map
 * with no entry in `byMp`. The render pass iterates `byMp` and looks rows up by
 * key, so such rows would never be visited and would vanish without trace. What
 * actually rules that out is an invariant spanning four functions, not a type:
 * every `pushMarketplaceRow` call site is reachable only for a plugin in
 * `scopePlan.pluginsToInstall` whose marketplace passed the usable-marketplace gate, and
 * `scopedPlan` (`import/marketplaces.ts`) plans the marketplace of every plugin
 * in `pluginsToInstall` under one scope, so every row key has a header.
 * D-PL6-01: `marketplacesToEnsure` also holds the extra known marketplaces no
 * plugin names, whose headers have no rows. A loud check here would be an arm
 * no input can reach.
 */
interface MarketplaceBlock {
  readonly key: string;
  readonly name: string;
  readonly scope: Scope;
  status: ImportBlockStatus;
  /**
   * The cause row for a `status: "failed"` block whose failure came from
   * `result.marketplaceFailures` (a marketplace add attempt, an
   * already-present marketplace whose stored source the planner could not
   * classify, a source mismatch no plugin row carries (D-PL6-09), or a held
   * lock) -- undefined otherwise, e.g. for a source mismatch whose per-plugin
   * child rows already carry the mismatch reason.
   */
  failure?: MarketplaceBlockFailure;
}

/** IMP-07: the cause row's reasons travel with its cause; a held lock reads `lock held`. */
interface MarketplaceBlockFailure {
  readonly cause: Error;
  readonly reasons: readonly ContentReason[];
}

function setMarketplaceStatus(
  byMp: Map<string, MarketplaceBlock>,
  scope: Scope,
  marketplaceName: string,
  status: ImportBlockStatus,
  failure?: MarketplaceBlockFailure,
): void {
  const key = `${scope}:${marketplaceName}`;
  const existing = byMp.get(key);
  if (existing === undefined) {
    byMp.set(key, {
      key,
      name: marketplaceName,
      scope,
      status,
      ...(failure !== undefined && { failure }),
    });
    return;
  }

  existing.status = status;
}

function pushMarketplaceRow(
  rowsByMp: Map<string, ImportMsg[]>,
  scope: Scope,
  marketplaceName: string,
  row: ImportMsg,
): void {
  const key = `${scope}:${marketplaceName}`;
  const existing = rowsByMp.get(key);
  if (existing === undefined) {
    rowsByMp.set(key, [row]);
    return;
  }

  existing.push(row);
}

/**
 * The two warnings that reach a cascade row. D-05: the advisory
 * `marketplace-failed` / `unmappable-marketplace-source` warnings are dropped
 * before this point (the failing marketplace's own `(failed)` header carries
 * their structural signal), so this function never sees them. The
 * parameter is narrowed to the warnings that survive, which makes routing a new
 * reason to a row a compile error at the call site.
 */
type RenderedWarning = Extract<ImportWarningOutcome, { reason: "unavailable" | "uninstallable" }>;

// A plugin the marketplace does not list takes the `not in manifest` reason
// that `install`, `marketplace update`, and `list` give it. IMP-08: a plugin
// that cannot be installed takes the narrowed reasons `install` gives it.
function importWarningReasons(warning: RenderedWarning): readonly ContentReason[] {
  switch (warning.reason) {
    case "unavailable":
      return ["not in manifest"];
    case "uninstallable":
      return warning.reasons;
  }
}

/**
 * WR-03: the row's cause as one Error. The outcome's `cause` carries the head
 * text, always populated; wrapping it in an Error lets the depth-5 cause-chain
 * trailer emit a diagnostic line instead of discarding the message.
 * T-55-02-02 / T-53-02-02: `causeChain` (when present) becomes that Error's
 * OWN `.cause` rather than being re-embedded in the head text, so the trailer
 * walker renders the onward chain exactly once instead of a second time over a
 * pre-flattened string.
 */
function failureCause(
  outcome: Pick<UnexpectedPluginFailureOutcome | MarketplaceFailureOutcome, "cause" | "causeChain">,
): Error {
  return outcome.causeChain === undefined
    ? new Error(outcome.cause)
    : new Error(outcome.cause, { cause: outcome.causeChain });
}

/**
 * Maps an `UnexpectedPluginFailureOutcome` onto its rendered reasons. IMP-09:
 * an unclassified failure carries the reasons `install`'s runtime-throw row
 * carries -- its git host's answer, or none -- so `{not in manifest}` stays
 * the reason of a plugin the marketplace does not list.
 */
function unexpectedFailureReasons(
  outcome: UnexpectedPluginFailureOutcome,
): readonly ContentReason[] {
  switch (outcome.reason) {
    case "unexpected-failure":
      return outcome.runtimeReason === undefined ? [] : [outcome.runtimeReason];
    case "dependency-failed":
      return ["dependency failed"];
    case "lock-held":
      return ["lock held"];
    case "not-installed":
      return ["not installed"];
  }
}

/**
 * The rows of a plugin that failed for a reason no other bucket classifies.
 * MIM-03 / D-PL6-03: a rollback that could not finish lists its phases, as
 * install's row does. D-PL6-04: a dependency whose rollback could not finish
 * gets its own row, with the cause and the phases, beside the plugin's bare
 * `{dependency failed}` row, the two ordered by name as install orders them.
 */
function unexpectedFailureRows(o: UnexpectedPluginFailureOutcome): readonly PluginFailedMessage[] {
  if (o.failedDependency === undefined) {
    return [unexpectedFailureRow(o)];
  }

  const dependency: PluginFailedMessage = {
    status: "failed",
    name: o.failedDependency.key,
    reasons: ["rollback partial"],
    cause: failureCause(o),
    rollbackPartial: o.failedDependency.rollbackPartial,
    severity: "error",
    needsReload: false,
  };
  const requested: PluginFailedMessage = {
    status: "failed",
    name: o.plugin,
    reasons: ["dependency failed"],
    severity: "error",
    needsReload: false,
  };
  return [dependency, requested].sort((a, b) =>
    compareByNameThenScope({ name: a.name, scope: o.scope }, { name: b.name, scope: o.scope }),
  );
}

function unexpectedFailureRow(o: UnexpectedPluginFailureOutcome): PluginFailedMessage {
  return {
    status: "failed",
    name: o.plugin,
    reasons: unexpectedFailureReasons(o),
    // IMP-09: install's authentication row is bare, so this one is too.
    ...(o.runtimeReason !== "authentication required" && { cause: failureCause(o) }),
    ...(o.rollbackPartial !== undefined && { rollbackPartial: o.rollbackPartial }),
    // D-03/D-06: an unexpected import failure -> error, no reload.
    severity: "error",
    needsReload: false,
  };
}

/**
 * The row of an installed plugin. IMP-10: an enable takes the row reconcile
 * renders for the same re-enable, so a partial record reads
 * `(partially-installed)`.
 */
function installedRow(
  o: PluginInstalledOutcome,
): PluginInstalledMessage | PluginPartiallyInstalledMessage {
  if (o.enableSignals !== undefined) {
    return enabledRowFromOutcome({
      kind: "plugin-enabled",
      scope: o.scope,
      marketplace: o.marketplace,
      plugin: o.plugin,
      ...(o.version !== undefined && { version: o.version }),
      ...o.enableSignals,
      ...(o.declaresAgents && { stagedAgents: true }),
      ...(o.declaresMcp && { stagedMcpServers: true }),
      ...(o.declaresWorkflows && { stagedWorkflows: true }),
    });
  }

  return {
    status: "installed",
    name: o.plugin,
    ...(o.version !== undefined && { version: o.version }),
    dependencies: declaredDependencies(o),
    // D-04-07: a promotion's brace is the standalone row's -- the record was
    // here before, and this command promoted it.
    ...(o.promoted === true && { reasons: PROMOTED_ROW_REASONS }),
    // D-03/D-06: realized install transition -> info, reloads Pi resources.
    // A promotion (D-04-07) reloads only when it re-materialized the record.
    severity: "info",
    needsReload: o.promoted !== true || o.resourcesChanged,
  };
}

/** IMP-07: the cause row of a marketplace failure names a held lock. */
function marketplaceFailureReasons(
  reason: MarketplaceFailureOutcome["reason"],
): readonly ContentReason[] {
  switch (reason) {
    case "add-failed":
      return [];
    case "lock-held":
      return ["lock held"];
  }
}

/**
 * Converts a `ClaudeImportExecutionResult` into the
 * `MarketplaceNotificationMessage[]` payload for `notify()`.
 *
 * Outcome mapping: added -> "added"; already-present -> "skipped" with
 * "already added" (IMP-06);
 * marketplace failure or source mismatch -> "failed"; installed plugin ->
 * PluginInstalledMessage, or reconcile's enable row for an enable (IMP-10); already-installed plugin -> PluginSkippedMessage
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
  dependencyChanges: readonly DependencyChangeOutcome[],
): Plural<MarketplaceRows<ImportMsg>> {
  const byMp = new Map<string, MarketplaceBlock>();
  const rowsByMp = new Map<string, ImportMsg[]>();

  // Marketplace-level outcomes: set status on the (scope, marketplace) tuple.
  for (const o of result.addedMarketplaces) {
    setMarketplaceStatus(byMp, o.scope, o.marketplace, "added");
  }

  for (const o of result.skippedExistingMarketplaces) {
    setMarketplaceStatus(byMp, o.scope, o.marketplace, "skipped");
  }

  for (const o of result.marketplaceFailures) {
    setMarketplaceStatus(byMp, o.scope, o.marketplace, "failed", {
      cause: failureCause(o),
      reasons: marketplaceFailureReasons(o.reason),
    });
  }

  // Source-mismatch supersedes any prior status (the import for that
  // marketplace effectively failed); dependent plugin rows accumulate as
  // PluginFailedMessage children under the (failed) header. The mp-level
  // `failed` arm carries NO `reasons` (D-46-03a): `renderMpHeader`'s failed
  // arm renders only `(failed)` and the source-mismatch reason rides the
  // child `PluginFailedMessage` row below.
  for (const o of result.sourceMismatches) {
    setMarketplaceStatus(byMp, o.scope, o.marketplace, "failed");
  }

  // Plugin rows -- orphan-fold contract: per-row `scope?` is OMITTED
  // because the row's scope matches its marketplace's scope by
  // construction (the import cascade groups outcomes by their owning scope).
  for (const o of result.installedPlugins) {
    pushMarketplaceRow(rowsByMp, o.scope, o.marketplace, installedRow(o));
  }

  for (const o of result.skippedExistingPlugins) {
    const row: PluginSkippedMessage = {
      status: "skipped",
      name: o.plugin,
      reasons: ["already installed"] as const,
      // D-03/D-06: `already installed` is a benign idempotent skip -> info,
      // no reload.
      severity: "info",
      needsReload: false,
    };
    pushMarketplaceRow(rowsByMp, o.scope, o.marketplace, row);
  }

  for (const o of result.sourceMismatches) {
    const row: PluginFailedMessage = {
      status: "failed",
      name: o.plugin,
      reasons: ["source mismatch"] as const,
      // D-03/D-06: a source-mismatch import row -> error, no reload.
      severity: "error",
      needsReload: false,
    };
    pushMarketplaceRow(rowsByMp, o.scope, o.marketplace, row);
  }

  for (const o of result.unexpectedPluginFailures) {
    for (const row of unexpectedFailureRows(o)) {
      pushMarketplaceRow(rowsByMp, o.scope, o.marketplace, row);
    }
  }

  // UPD-DEP-D1 / WR-N5: the dependencies each install changed, after the
  // plugins' own rows.
  for (const o of dependencyChanges) {
    pushMarketplaceRow(rowsByMp, o.scope, o.marketplace, o.row);
  }

  for (const o of result.warnings) {
    // marketplace-failed / unmappable-marketplace-source warnings
    // have no notification representation (the failing marketplace's own
    // status: "failed" carries the structural signal; advisory-only warnings
    // are silenced).
    if (o.reason === "marketplace-failed" || o.reason === "unmappable-marketplace-source") {
      continue;
    }

    const row: PluginUnavailableMessage = {
      status: "unavailable",
      name: o.plugin,
      reasons: importWarningReasons(o),
      // WR-02: import unavailable/dependency rows are actionable -- the user
      // cannot complete the install without addressing them -> warning. Without
      // the stamp `cascadeSeverity` defaults them to `info`, so the envelope
      // never bumps to `warning` and the summary line never shows. No reload.
      severity: "warning",
      needsReload: false,
    };
    pushMarketplaceRow(rowsByMp, o.scope, o.marketplace, row);
  }

  // result.diagnostics (orphan + per-marketplace) have no representation IN
  // THE CASCADE built here. The in-memory record stays on the returned
  // result; `importClaudeSettings` surfaces it separately via the sanctioned
  // `notifyDiagnostic` seam once this cascade has been notified.

  // orchestrator owns iteration order; notify does NOT sort.
  // Project-before-user tie-break per MSG-GR-3 via compareByNameThenScope.
  // defense-in-depth: typed readonly + runtime freeze (codebase convention)
  return Object.freeze(
    [...byMp.values()]
      .sort((a, b) => compareByNameThenScope(a, b))
      // WR-04: the `?? []` is the no-rows case (a marketplace added with no
      // plugins), NOT a silent absorber for orphan rows -- see the
      // `MarketplaceBlock` doc comment for the invariant that makes a
      // headerless row unreachable.
      .map((block) => blockToMarketplaceMessage(block, rowsByMp.get(block.key) ?? [])),
  );
}

/**
 * Construct the concrete per-status `MarketplaceNotificationMessage` arm
 * (TYPE-04 / D-46-03) for an accumulated `MarketplaceBlock` and its rows.
 *
 * D-05: the switch runs over the closed `ImportBlockStatus` union alone, so
 * TypeScript proves it exhaustive and a fourth member fails to compile here.
 * The import path assigns only these three tokens, and a statusless header
 * is unconstructible because `status` is required, so no `default: throw` or
 * `case undefined:` arm is needed.
 */
function blockToMarketplaceMessage(
  block: MarketplaceBlock,
  rows: readonly ImportMsg[],
): MarketplaceRows<ImportMsg> {
  const name = block.name;
  const scope = block.scope;
  // defense-in-depth: typed readonly + runtime freeze (codebase convention)
  const plugins = Object.freeze(rows);
  switch (block.status) {
    case "added":
      return { name, scope, status: "added", plugins };
    case "skipped":
      // IMP-06: the marketplace was already recorded with the settings' source,
      // so nothing changed. Unstamped, like `marketplace update`'s
      // `(skipped) {up-to-date}`, so the cascade stays info.
      return { name, scope, status: "skipped", reasons: ["already added"], plugins };
    case "failed": {
      // D-03: a failed import marketplace block -> error.
      if (block.failure === undefined) {
        return { name, scope, status: "failed", severity: "error", plugins };
      }

      // MarketplaceNotificationMessage carries no `cause` field (mirrors
      // marketplace/update.ts's `refreshOneMarketplace`); a marketplace
      // add-failure block has no plugin child rows of its own (the
      // dependent-plugin warnings are silenced -- the header alone blocks
      // them), so the cause would otherwise never reach the user. Surface it
      // via a synthetic failed child row -- the same "reasons: [] and cause:
      // err" recipe this module's own `dispatchFailedOutcome` fallback uses
      // for `unexpectedPluginFailures` -- so the depth-5 cause-chain trailer
      // renders it.
      const causeRow: PluginFailedMessage = {
        status: "failed",
        name,
        reasons: block.failure.reasons,
        cause: block.failure.cause,
        severity: "error",
        needsReload: false,
      };
      // defense-in-depth: typed readonly + runtime freeze (codebase convention)
      return {
        name,
        scope,
        status: "failed",
        severity: "error",
        plugins: Object.freeze([causeRow, ...plugins]),
      };
    }
  }
}

type ScopedImportPlan = ReturnType<typeof buildClaudeImportPlan>["scopes"][number];

/**
 * D-05: every patch this module builds carries BOTH halves, so the optional
 * fields of `BatchedConfigPatch` made each read site take a `?? {}` fallback
 * nothing could ever reach. Requiring both halves here removes those dead
 * fallbacks while staying assignable to the persistence contract.
 */
type ImportConfigPatch = Required<BatchedConfigPatch>;

/** Why a marketplace will not be usable this run, as its failure row carries it. */
interface MarketplaceFailure {
  readonly reason: MarketplaceFailureOutcome["reason"];
  readonly cause: string;
  readonly causeChain?: Error;
}

/**
 * WR-07: shared failure bookkeeping for a marketplace that will not be
 * usable this run -- a fresh add that did not record (typed failed outcome OR
 * unexpected throw, from `addOnePlannedMarketplace`), an already-present
 * marketplace whose stored source the planner could not classify, a source
 * mismatch no plugin row carries (D-PL6-09), or a scope another process held
 * locked at the read pass (IMP-07): block dependent plugin installs and
 * attribute the cause on both the marketplace row and each dependent plugin's
 * warning row.
 */
function recordMarketplaceAddFailure(
  result: MutableImportResult,
  blockedMarketplaces: Set<string>,
  scopePlan: ScopedImportPlan,
  marketplace: ScopedImportPlan["marketplacesToEnsure"][number],
  failure: MarketplaceFailure,
): void {
  blockedMarketplaces.add(marketplace.marketplace);
  result.marketplaceFailures.push({
    kind: "marketplace-failure",
    scope: marketplace.scope,
    marketplace: marketplace.marketplace,
    reason: failure.reason,
    cause: failure.cause,
    ...(failure.causeChain !== undefined && { causeChain: failure.causeChain }),
  });
  for (const plugin of pluginsForMarketplace(scopePlan.pluginsToInstall, marketplace.marketplace)) {
    pushPluginWarning(result, plugin, "marketplace-failed", failure.cause);
  }
}

/**
 * IMP-07: a held lock renders the way every other lock-held row does -- the
 * lock error's own message and its onward chain, unredacted, because the
 * path it names is the scope's own lock file.
 */
function lockHeldFailure(error: StateLockHeldError): MarketplaceFailure {
  return {
    reason: "lock-held",
    cause: error.message,
    ...(error.cause instanceof Error && { causeChain: error.cause }),
  };
}

type PlannedMarketplace = ScopedImportPlan["marketplacesToEnsure"][number];
type PlannedPlugin = ScopedImportPlan["pluginsToInstall"][number];
type PlannedMismatch = ReconcilePlan["sourceMismatches"][number];
type SettledMismatch = Extract<PlannedMismatch, { cause: "source-mismatch" | "unknown-stored" }>;

/**
 * IMP-05: settle a planned marketplace the reconcile planner reported as a
 * source mismatch, recording the blocked outcome directly on `result` /
 * `blockedMarketplaces`.
 */
function recordPlannedMismatch(
  result: MutableImportResult,
  blockedMarketplaces: Set<string>,
  scopePlan: ScopedImportPlan,
  marketplace: PlannedMarketplace,
  mismatch: SettledMismatch,
): void {
  switch (mismatch.cause) {
    case "unknown-stored":
      // The stored source record is in an unrecognized format (e.g. a
      // hand-edited state.json). Block dependent plugins and emit a clear
      // diagnostic rather than a misleading source-mismatch message.
      //
      // WR-06: the marketplace also takes a `(failed)` header. A diagnostic
      // alone carries no marketplace-blocking / severity signal, so on its own
      // this arm rendered `(no marketplaces)` with no severity argument -- info,
      // the token for "the desired state was reached" -- while a marketplace
      // and every plugin it declares were skipped over an actionable data
      // problem. Routing
      // through the shared add-failure bookkeeping reuses the existing
      // `marketplaceFailures -> setMarketplaceStatus("failed")` path with no new
      // vocabulary, and silences the dependent plugins' advisory rows the same
      // way a genuine add failure does.
      recordMarketplaceAddFailure(result, blockedMarketplaces, scopePlan, marketplace, {
        reason: "add-failed",
        cause: "unrecognized stored source format",
      });
      pushDiagnostic(
        result,
        marketplace.scope,
        "unrecognized-stored-source",
        `Marketplace "${marketplace.marketplace}" has an unrecognized stored source format. Verify state.json or remove and re-add the marketplace.`,
        { marketplace: marketplace.marketplace },
      );
      return;
    case "source-mismatch": {
      const cause = `Existing marketplace source ${mismatch.recordedSource} does not match Claude settings source ${marketplace.source}.`;
      const plugins = pluginsForMarketplace(scopePlan.pluginsToInstall, marketplace.marketplace);
      if (plugins.length === 0) {
        // D-PL6-09: no plugin row would carry the mismatch, so the
        // marketplace takes the `(failed)` block and cause row the
        // `unknown-stored` arm gives it.
        recordMarketplaceAddFailure(result, blockedMarketplaces, scopePlan, marketplace, {
          reason: "add-failed",
          cause,
        });
        return;
      }

      blockedMarketplaces.add(marketplace.marketplace);
      for (const plugin of plugins) {
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

      return;
    }
  }
}

/**
 * The import-result bucket ONE planned plugin landed in.
 *
 * CR-01: this exists so `installOnePlannedPlugin` can declare a value-returning
 * signature. TypeScript checks a `switch` for exhaustiveness only when the
 * declared return type forces a value on every path; a `void` function's switch
 * with a missing arm compiles clean. Naming the bucket makes the outcome switch
 * below TS2366-checked.
 */
type PlannedPluginBucket = "install-failed" | "installed" | "skipped" | "unexpected-failure";

/**
 * Record the outcome of installing ONE planned plugin and answer with the
 * result bucket it was recorded in.
 *
 * WR-02: an unexpected `installPlugin` throw is pushed onto
 * `result.unexpectedPluginFailures` directly in the `catch` block below --
 * it deliberately DUPLICATES `dispatchFailedOutcome`'s `unexpected-failure`
 * shape rather than calling it, because a throw out of `installPlugin`
 * itself (unlike its typed `{status: "failed"}` outcome) has no
 * `PluginShapeError` / `ConcurrentInstallError` to narrow on. Either way the
 * per-scope loop continues and the terminal `notify()` still fires.
 *
 * CR-01: the returned bucket is what the caller discards, not what it acts on --
 * every consumer reads the populated `result` buckets instead. The declared
 * return type is the mechanism: see `PlannedPluginBucket`.
 *
 * @param promoting D-04-07: the recorded dependency this entry promotes, when
 *   the scope's snapshot already recorded it as one. ENBL-07: a partially
 *   installed record was accepted in that shape when the cascade wrote it, so
 *   the settings that name it consent to the record as it stands, not to a new
 *   degradation; the promotion's `--partial` gate reads that consent here.
 *   Import never installs a fresh plugin partially, so the flag is set for no
 *   other entry. The record also says whether the promotion enables it.
 *   Whether the install promoted at all is read off its outcome, not this
 *   record: the snapshot is taken once per scope, so a dependency an earlier
 *   entry's cascade recorded in this same import has no record here and is
 *   promoted at lock time.
 */
async function installOnePlannedPlugin(
  opts: ImportClaudeSettingsOptions,
  result: MutableImportResult,
  plugin: PlannedPlugin,
  promoting?: PluginInstallRecord,
): Promise<PlannedPluginBucket> {
  const installPlugin = installPluginFn(opts.deps, opts.hooksRouting, opts.completionCache);
  let outcome: InstallPluginOutcome;
  try {
    outcome = await installPlugin({
      ctx: opts.ctx,
      run: opts.run,
      scope: plugin.scope,
      cwd: opts.cwd,
      marketplace: plugin.ref.marketplace,
      plugin: plugin.ref.plugin,
      notifications: { mode: "orchestrated" },
      ...(promoting !== undefined && !promoting.compatibility.installable && { partial: true }),
    });
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
    // The orchestrated install returns a typed outcome for every failure
    // except an invalid GitHub base override, which the line above rethrows so
    // the whole import fails (GHB-03). An install that fails on it after
    // leaving a rollback partial or an MCP config rewrite (AFILE-04) returns
    // its failed outcome instead, so the import continues past that plugin,
    // and a later target that reads the base ends it. Anything else is a
    // defensive arm; it takes the same redacted head-plus-chain route as a
    // returned failure so no path can leak through it either.
    pushUnexpectedFailure(
      result,
      plugin,
      "unexpected-failure",
      err instanceof Error ? err : new Error(errorMessage(err)),
    );
    return "unexpected-failure";
  }

  // AFILE-04: both arms carry notices; a failed install can still have
  // rewritten the MCP config through a dependency that committed first.
  result.mcpConfigNotices.push(...(outcome.mcpConfigNotices ?? []));
  pushDependencyChanges(result, plugin, outcome);

  // CR-01: a third `InstallPluginOutcome` arm must become a compile error here,
  // not get counted as a successful install in the cascade totals. The
  // mechanism is the DECLARED RETURN TYPE, not the switch: TypeScript proves a
  // switch exhaustive only when the return type forces a value on every path,
  // so this same switch inside a `void` function would let a third arm fall
  // through, record the plugin in no bucket, render no cascade row, and
  // under-count the `Import: N successes` tally with every gate green. D-05:
  // the union has exactly the two arms below, so a default arm would be
  // unreachable dead code; TS2366 and the `switch-exhaustiveness-check` lint
  // rule on a missing arm enforce exhaustiveness instead.
  switch (outcome.status) {
    case "failed":
      // The collapsed `failed` status carries the typed Error directly. Narrow
      // on `instanceof PluginShapeError` plus `.kind` to recover the specific
      // failure class; everything else falls through to the unexpected bucket.
      dispatchFailedOutcome(result, plugin, outcome.error, outcome.cause, {
        rollbackPartials: outcome.rollbackPartials ?? [],
      });
      return "install-failed";
    case "installed":
      result.installedPlugins.push({
        kind: "plugin-installed",
        scope: plugin.scope,
        plugin: plugin.ref.plugin,
        marketplace: plugin.ref.marketplace,
        ref: refLabel(plugin),
        reason: "installed",
        resourcesChanged: outcome.resourcesChanged,
        ...(outcome.version !== undefined && { version: outcome.version }),
        declaresAgents: outcome.declaresAgents,
        declaresMcp: outcome.declaresMcp,
        ...(outcome.promoted === true && { promoted: true }),
        ...(promoting !== undefined && isRecordedButDisabled(promoting) && { reenabled: true }),
        declaresWorkflows: outcome.declaresWorkflows,
      });
      result.changedResources ||= outcome.resourcesChanged;
      for (const w of outcome.postCommitWarnings ?? []) {
        pushDiagnostic(result, plugin.scope, "post-install-warning", w, { ref: refLabel(plugin) });
      }

      return "installed";
  }
}

/**
 * UPD-DEP-D1 / WR-N5 / WR-3: every dependency change an install reported,
 * success or failure, as a row beside the plugin's own: each move, then each
 * dependency the install after a plan added with the plugin. A change that
 * landed changed resources, as the plugin's own install does.
 */
function pushDependencyChanges(
  result: MutableImportResult,
  plugin: PlannedPlugin,
  outcome: InstallPluginOutcome,
): void {
  const changes: readonly MovedDependency[] = [
    ...(outcome.movedDependencies ?? []),
    ...(outcome.status === "installed" ? (outcome.dependencyInstalls ?? []) : []),
  ];
  for (const entry of changes) {
    result.dependencyChanges.push({
      scope: plugin.scope,
      marketplace: plugin.ref.marketplace,
      row: entry.row,
    });
    result.changedResources ||= entry.row.status !== "failed";
  }
}

/**
 * LCCODE-01: an enable's degradation facts only. The staged-kind facts go to
 * the outcome's `declares*` members, and `installedRow` reads them from there.
 */
function enableDegradation(
  signals: EnableDegradationSignals,
): NonNullable<PluginInstalledOutcome["enableSignals"]> {
  return {
    ...(signals.unsupported !== undefined && { unsupported: signals.unsupported }),
    ...(signals.orphanRewake === true && { orphanRewake: true }),
    ...(signals.degradedKinds !== undefined && { degradedKinds: signals.degradedKinds }),
  };
}

/**
 * IMP-05 / D-06: enable ONE planned plugin the scope records disabled, through
 * the enable operation reconcile drives for its `pluginsToEnable` bucket, and
 * answer with the result bucket it was recorded in.
 *
 * An enable re-materializes the record through the install ledger, so the row
 * is the one reconcile renders for the same transition: `(installed)`, or
 * `(partially-installed)` for a partial record (IMP-10). The
 * outcome is marked `reenabled`: the disable verb left `{ enabled: false }`
 * under this key, and the post-pass declares it `{ enabled: true }` the way
 * the enable path does. A failure takes the install failure's ladder, so a
 * held lock reads `lock held`. The `skipped` arm is a race another process
 * won; `disabled` cannot answer an enable, and reads as the already-enabled
 * skip.
 */
async function enableOnePlannedPlugin(
  opts: ImportClaudeSettingsOptions,
  result: MutableImportResult,
  plugin: PlannedPlugin,
): Promise<PlannedPluginBucket> {
  const setPluginEnabled = setPluginEnabledFn(opts.deps, opts.hooksRouting);
  let outcome: EnableDisablePluginOutcome;
  try {
    outcome = await setPluginEnabled({
      ctx: opts.ctx,
      run: opts.run,
      cwd: opts.cwd,
      marketplace: plugin.ref.marketplace,
      plugin: plugin.ref.plugin,
      enable: true,
      scope: plugin.scope,
      notifications: { mode: "orchestrated" },
    });
  } catch (err) {
    // The same defensive arm as the install's: an invalid GitHub base override
    // ends the import (GHB-03), anything else becomes this plugin's row.
    rethrowInvalidGitHubBaseUrl(err);
    pushUnexpectedFailure(
      result,
      plugin,
      "unexpected-failure",
      err instanceof Error ? err : new Error(errorMessage(err)),
    );
    return "unexpected-failure";
  }

  switch (outcome.status) {
    case "enabled":
      result.mcpConfigNotices.push(...(outcome.mcpConfigNotices ?? []));
      result.installedPlugins.push({
        kind: "plugin-installed",
        scope: plugin.scope,
        plugin: plugin.ref.plugin,
        marketplace: plugin.ref.marketplace,
        ref: refLabel(plugin),
        reason: "installed",
        resourcesChanged: true,
        ...(outcome.version !== undefined && { version: outcome.version }),
        declaresAgents: outcome.stagedAgents === true,
        declaresMcp: outcome.stagedMcpServers === true,
        reenabled: true,
        enableSignals: enableDegradation(outcome),
        declaresWorkflows: outcome.stagedWorkflows === true,
      });
      result.changedResources = true;
      return "installed";
    case "failed":
      // AFILE-04: a failed enable can still have rewritten the MCP config.
      result.mcpConfigNotices.push(...(outcome.mcpConfigNotices ?? []));
      dispatchFailedOutcome(result, plugin, outcome.error, outcome.cause, {
        rollbackPartials: outcome.rollbackPartials ?? [],
      });
      return "install-failed";
    case "skipped":
      // A race another process won: the record is enabled already, or gone.
      if (outcome.reason === "not installed") {
        pushUnexpectedFailure(
          result,
          plugin,
          "not-installed",
          new Error(`${refLabel(plugin)} is not installed in the ${plugin.scope} scope.`),
        );
        return "unexpected-failure";
      }

      pushAlreadyInstalled(result, plugin);
      return "skipped";
    case "disabled":
      pushAlreadyInstalled(result, plugin);
      return "skipped";
  }
}

/**
 * WR-07: add ONE planned marketplace in ORCHESTRATED mode and dispatch on the
 * typed outcome.
 *
 * Standalone mode is wrong here: a classified precondition failure (duplicate
 * name, stale clone, invalid manifest, unsupported source, source missing)
 * does NOT throw there -- it fires its own standalone notify, which breaks
 * import's one-cascade-per-command discipline, and returns undefined instead
 * of the typed outcome this function dispatches on.
 */
async function addOnePlannedMarketplace(
  opts: ImportClaudeSettingsOptions,
  result: MutableImportResult,
  blockedMarketplaces: Set<string>,
  scopePlan: ScopedImportPlan,
  marketplace: PlannedMarketplace,
): Promise<void> {
  const addMarketplace = addMarketplaceFn(opts.deps);
  try {
    const outcome = await addMarketplace({
      ctx: opts.ctx,
      run: opts.run,
      scope: marketplace.scope,
      cwd: opts.cwd,
      rawSource: marketplace.source,
      completionCache: opts.completionCache,
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
      return;
    }

    recordMarketplaceAddFailure(
      result,
      blockedMarketplaces,
      scopePlan,
      marketplace,
      addFailure(outcome),
    );
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
    // Defensive: orchestrated mode coerces classified failures into typed
    // outcomes, and the line above rethrows an invalid GitHub base override so
    // the whole import fails (GHB-03). Only a genuinely unexpected throw is
    // recorded here.
    recordMarketplaceAddFailure(result, blockedMarketplaces, scopePlan, marketplace, {
      reason: "add-failed",
      cause: errorMessage(err),
    });
  }
}

/**
 * The failure row of an add that did not record. IMP-07: an add another
 * process's lock stopped carries `lock held` and the lock error's chain.
 */
function addFailure(
  outcome: Exclude<AddMarketplaceOutcome, { status: "added" }> | undefined,
): MarketplaceFailure {
  if (outcome === undefined) {
    return {
      reason: "add-failed",
      cause: "addMarketplace returned no outcome in orchestrated mode",
    };
  }

  if (outcome.error instanceof StateLockHeldError) {
    return lockHeldFailure(outcome.error);
  }

  const causeChain = fetchedUrlCauseChain(outcome.error);
  return {
    reason: "add-failed",
    cause: outcome.cause,
    ...(causeChain !== undefined && { causeChain }),
  };
}

/**
 * GHB-01 / GHB-04: the onward cause chain of a failed add, redacted like
 * `pushUnexpectedFailure`'s, when the GitHub base override rewrote the URL the
 * add fetched. Any other failure yields `undefined`, so its row keeps the head
 * cause alone.
 */
function fetchedUrlCauseChain(error: Error): Error | undefined {
  return hasFetchedUrlCause(error) ? redactCauseChain(error.cause) : undefined;
}

/**
 * IMP-05 / D-01: the desired state a scope's settings name -- each planned
 * marketplace with its settings source, and each enabled plugin enabled -- in
 * the merged-config shape reconcile's planner reads.
 */
function desiredConfigFor(scopePlan: ScopedImportPlan): MergedConfig {
  const marketplaces: MergedConfig["marketplaces"] = {};
  for (const marketplace of scopePlan.marketplacesToEnsure) {
    setOwn(marketplaces, marketplace.marketplace, {
      entry: { source: marketplace.source },
      source: "base",
    });
  }

  const plugins: MergedConfig["plugins"] = {};
  for (const plugin of scopePlan.pluginsToInstall) {
    setOwn(plugins, `${plugin.ref.plugin}@${plugin.ref.marketplace}`, {
      entry: { enabled: true },
      source: "base",
    });
  }

  return { marketplaces, plugins };
}

type ImportReadPass =
  | {
      readonly kind: "planned";
      readonly state: ExtensionState;
      readonly plan: ReconcilePlan;
      /**
       * D-PL6-02: each settings marketplace the scope records under exactly
       * one other name, mapped to that recorded name.
       */
      readonly claims: ReadonlyMap<string, string>;
      /**
       * CR-01: each recorded marketplace the scope's config claims, mapped to
       * the name the config declares it under.
       */
      readonly configNames: ReadonlyMap<string, string>;
    }
  | { readonly kind: "lock-held"; readonly error: StateLockHeldError };

/**
 * CR-01: the name the scope's merged config uses for each recorded
 * marketplace it claims, by its own name or by a one-to-one source claim, read
 * with the planner's own claim rule. A claim is one-to-one, so each recorded
 * name maps to one declared name.
 */
function configNamesByRecorded(
  config: MergedConfig["marketplaces"],
  recorded: ExtensionState["marketplaces"],
): ReadonlyMap<string, string> {
  return new Map(
    [...marketplaceSourceClaims(config, recorded)].map(([declared, record]) => [record, declared]),
  );
}

/** CR-01: the name the post-pass declares a marketplace and its plugins under. */
function declaredNameFor(configNames: ReadonlyMap<string, string>, marketplace: string): string {
  return configNames.get(marketplace) ?? marketplace;
}

/**
 * IMP-05 / IMP-07: reconcile's read pass, with the settings as the desired
 * state. It holds the scope lock while it reads the state snapshot and plans
 * against it with reconcile's own planner, saves nothing, and returns before
 * any operation runs, so a held lock fails the scope with nothing changed. As
 * in reconcile, the apply pass then runs with no outer lock, because each
 * operation takes the scope lock itself and the lock is not re-entrant
 * (CR-01).
 */
async function readPassForImport(
  opts: ImportClaudeSettingsOptions,
  scopePlan: ScopedImportPlan,
): Promise<ImportReadPass> {
  const loadState = stateLoader(opts.deps);
  const scope = scopePlan.scope;
  try {
    const locations = locationsFor(scope, opts.cwd);
    return await withLockedStateTransaction(
      locations,
      async (tx): Promise<ImportReadPass> => {
        // LOAD-01 / D-06-04: computed inside the lock, as reconcile's read
        // pass computes it, so it reads the same snapshot the planner sees.
        const verdict = await buildScopeSatisfactionVerdict({ state: tx.state, locations });
        const desired = desiredConfigFor(scopePlan);
        // D-PL6-10: the planner's own claim rule, read from the same snapshot.
        const claims = marketplaceSourceClaims(desired.marketplaces, tx.state.marketplaces);
        // D-PL6-02: a recorded name the settings declare themselves, planned
        // or not, is never another settings name's alias.
        const settingsNames = new Set(scopePlan.settingsMarketplaces);
        const config = await loadMergedScopeConfig(locations);
        return {
          kind: "planned",
          state: tx.state,
          plan: planReconcile(desired, tx.state, scope, verdict),
          claims: new Map(
            [...claims].filter(
              ([declared, recorded]) => declared !== recorded && !settingsNames.has(recorded),
            ),
          ),
          configNames: configNamesByRecorded(config.merged.marketplaces, tx.state.marketplaces),
        };
      },
      { loadState: async () => loadState(scope, opts.cwd) },
    );
  } catch (err) {
    if (err instanceof StateLockHeldError) {
      return { kind: "lock-held", error: err };
    }

    throw err;
  }
}

function pushSkippedPluginWarnings(result: MutableImportResult, scopePlan: ScopedImportPlan): void {
  for (const skipped of scopePlan.skippedPlugins) {
    pushPluginWarning(
      result,
      { scope: skipped.scope, ref: skipped.ref },
      "unmappable-marketplace-source",
      skipped.reason,
    );
  }
}

/**
 * Import builds every plugin key from a parsed `plugin@marketplace` ref and
 * declares every marketplace its plugins name, so of the planner's four
 * mismatch causes only these two can name a settings marketplace.
 */
function plannedMismatchFor(plan: ReconcilePlan, marketplace: string): SettledMismatch | undefined {
  return plan.sourceMismatches.find(
    (mismatch): mismatch is SettledMismatch =>
      (mismatch.cause === "source-mismatch" || mismatch.cause === "unknown-stored") &&
      mismatch.marketplace === marketplace,
  );
}

/**
 * D-PL6-02: the scope plan with each claimed settings marketplace renamed to
 * the name the scope records it under. The marketplace keeps the settings
 * source, and each plugin ref under it names the recorded marketplace in both
 * `marketplace` and `raw`, so every outcome and config key names one plugin.
 * Only one-to-one claims are in `claims`, and the read pass drops every claim
 * of a name the settings declare, planned or not, so a recorded name is never
 * a settings name and two entries cannot collide.
 */
function aliasedScopePlan(
  scopePlan: ScopedImportPlan,
  claims: ReadonlyMap<string, string>,
): ScopedImportPlan {
  return {
    ...scopePlan,
    marketplacesToEnsure: scopePlan.marketplacesToEnsure.map((marketplace) => ({
      ...marketplace,
      marketplace: claims.get(marketplace.marketplace) ?? marketplace.marketplace,
    })),
    pluginsToInstall: scopePlan.pluginsToInstall.map((plugin) => {
      const recorded = claims.get(plugin.ref.marketplace);
      return recorded === undefined
        ? plugin
        : {
            ...plugin,
            ref: { ...plugin.ref, marketplace: recorded, raw: `${plugin.ref.plugin}@${recorded}` },
          };
    }),
  };
}

/**
 * IMP-05 / IMP-06: settle the settings' marketplaces against the plan, in
 * this order. A planner source mismatch, a conflicted source claim included,
 * blocks the marketplace before anything is added (D-PL6-09). A name the
 * scope records, the recorded name of a claimed settings marketplace included,
 * is reported as a skip. Any other marketplace is added. D-PL6-02 supersedes
 * lifecycle-coverage D-07, which added a claimed settings marketplace under
 * its settings name and failed it as a duplicate. Answers the names whose
 * plugins may run.
 */
async function ensurePlannedMarketplaces(
  opts: ImportClaudeSettingsOptions,
  result: MutableImportResult,
  scopePlan: ScopedImportPlan,
  read: Extract<ImportReadPass, { kind: "planned" }>,
): Promise<ReadonlySet<string>> {
  const blockedMarketplaces = new Set<string>();
  for (const marketplace of scopePlan.marketplacesToEnsure) {
    const mismatch = plannedMismatchFor(read.plan, marketplace.marketplace);
    if (mismatch !== undefined) {
      recordPlannedMismatch(result, blockedMarketplaces, scopePlan, marketplace, mismatch);
    } else if (ownValue(read.state.marketplaces, marketplace.marketplace) === undefined) {
      // eslint-disable-next-line no-await-in-loop -- each add locks the scope (retries: 0)
      await addOnePlannedMarketplace(opts, result, blockedMarketplaces, scopePlan, marketplace);
    } else {
      result.skippedExistingMarketplaces.push({
        kind: "marketplace-skip",
        scope: marketplace.scope,
        marketplace: marketplace.marketplace,
        reason: "already-present",
      });
    }
  }

  return new Set(
    scopePlan.marketplacesToEnsure
      .map((marketplace) => marketplace.marketplace)
      .filter((name) => !blockedMarketplaces.has(name)),
  );
}

/**
 * IMP-05: settle the settings' plugins, in settings order. A plugin the scope
 * does not record is installed; one the plan's enable bucket names is enabled
 * (D-06); any other recorded plugin is reported `skipped {already installed}`
 * (IMP-06) and never reinstalled. The read pass hands the planner reconcile's
 * own satisfaction verdict, so a record the load-time dependency check holds
 * down is not in the enable bucket and stays a skip (LOAD-02).
 *
 * D-04-07 / D-03: a record that arrived as another plugin's dependency is not
 * a skip, although the planner reads it as steady state. The imported settings
 * naming it IS the user asking for it by name, so it goes to the install,
 * whose orchestrated promotion arm flips the record to a direct install.
 */
async function applyPlannedPlugins(
  opts: ImportClaudeSettingsOptions,
  result: MutableImportResult,
  scopePlan: ScopedImportPlan,
  read: Extract<ImportReadPass, { kind: "planned" }>,
  usable: ReadonlySet<string>,
): Promise<void> {
  const enableKeys = new Set(
    read.plan.pluginsToEnable.map((op) => `${op.plugin}@${op.marketplace}`),
  );
  for (const plugin of scopePlan.pluginsToInstall) {
    if (!usable.has(plugin.ref.marketplace)) {
      continue;
    }

    const record = ownValue(
      ownValue(read.state.marketplaces, plugin.ref.marketplace)?.plugins,
      plugin.ref.plugin,
    );
    if (record === undefined || record.provenance === "dependency") {
      // eslint-disable-next-line no-await-in-loop -- each install locks the scope (retries: 0)
      await installOnePlannedPlugin(opts, result, plugin, record);
    } else if (enableKeys.has(`${plugin.ref.plugin}@${plugin.ref.marketplace}`)) {
      // eslint-disable-next-line no-await-in-loop -- each enable locks the scope (retries: 0)
      await enableOnePlannedPlugin(opts, result, plugin);
    } else {
      pushAlreadyInstalled(result, plugin);
    }
  }
}

/**
 * IMP-05: one scope of the import, on reconcile's path -- the locked read pass
 * plans the settings against the recorded state, then the marketplace and
 * plugin buckets run, then the config post-pass declares what landed. A scope
 * whose settings name nothing takes no lock, so a pristine scope stays
 * untouched.
 */
async function executeScopedPlan(
  opts: ImportClaudeSettingsOptions,
  result: MutableImportResult,
  scopePlan: ScopedImportPlan,
): Promise<void> {
  if (scopePlan.marketplacesToEnsure.length === 0) {
    pushSkippedPluginWarnings(result, scopePlan);
    return;
  }

  let read: ImportReadPass;
  try {
    read = await readPassForImport(opts, scopePlan);
  } catch (err) {
    pushDiagnostic(
      result,
      scopePlan.scope,
      "settings-read-error",
      `Cannot read ${scopePlan.scope} scope state: ${errorMessage(err)}`,
    );
    return;
  }

  if (read.kind === "lock-held") {
    // IMP-07 / D-08: nothing ran, so nothing changed. Every marketplace the
    // settings name fails with the lock error; their plugins are silenced as
    // under any marketplace failure, and there is nothing to declare.
    const blockedMarketplaces = new Set<string>();
    for (const marketplace of scopePlan.marketplacesToEnsure) {
      recordMarketplaceAddFailure(
        result,
        blockedMarketplaces,
        scopePlan,
        marketplace,
        lockHeldFailure(read.error),
      );
    }

    pushSkippedPluginWarnings(result, scopePlan);
    return;
  }

  const aliased = aliasedScopePlan(scopePlan, read.claims);
  const usable = await ensurePlannedMarketplaces(opts, result, aliased, read);
  pushSkippedPluginWarnings(result, aliased);
  await applyPlannedPlugins(opts, result, aliased, read, usable);

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
  await writeBatchedConfigForScope(opts, result, aliased, read.configNames);
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
 * Target: import does NOT support `--local` (the flag is per-command and not
 * on the import surface), so the batch targets `locations.baseConfigJsonPath`.
 * The one exception is a re-enabled
 * promotion whose key the local config declares: its `{ enabled: true }` goes
 * to the local config (`stampReenabledWhereLocalDeclares`) and the batch
 * keeps the bare key.
 *
 * Source: verbatim `rawSource` from `scopePlan.marketplacesToEnsure` keyed by
 * marketplace name, preserving the `samePlannedSource` contract.
 *
 * CR-01: each marketplace and plugin key names the marketplace the way the
 * scope's config already names it (`configNames`). A config that reaches a
 * recorded marketplace through another name is the planner's steady state, so
 * the post-pass keeps that name rather than declaring the recorded name beside
 * it, which would leave the other name claiming nothing.
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
  configNames: ReadonlyMap<string, string>,
): Promise<void> {
  const scope = scopePlan.scope;
  const { ensure, repair } = buildBatchedPatchForScope(result, scopePlan, configNames);
  if (isEmptyPatch(ensure) && isEmptyPatch(repair)) {
    return;
  }

  const locations = locationsFor(scope, opts.cwd);
  const targetConfigPath = locations.baseConfigJsonPath;

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
      const baseEnsure = await stampReenabledWhereLocalDeclares(
        locations,
        result,
        ensure,
        configNames,
      );
      // WR-01: repairs apply ONLY when the key is absent from the loaded
      // config (already-declared entries are untouched -- byte stability).
      const batch = mergeEnsureAndRepairs(baseEnsure, repair, current);
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
      "settings-write-error",
      `Failed to write ${scope} scope claude-plugins.json batched post-pass: ${errorMessage(err)}`,
    );
  }
}

/**
 * D-04-07 / D-103-16: the enable path writes `{ enabled: true }` to the config
 * that declares the key, and the disable verb's `{ enabled: false }` may live
 * in the local config, whose explicit `enabled` wins over the base entry's
 * (LAYER-09) -- a stamp in the base config alone would leave the merged view
 * disabled. So a re-enabled entry the local config declares is stamped there,
 * through the single-entry writer (which adds no `marketplaces` key to a
 * config that declares none), and its base patch drops to the bare key so the
 * base declaration still exists. The local config is re-read per stamp so each
 * write sees the one before it; an absent, invalid, or non-declaring local
 * config leaves the base patch as built. Runs under the scope lock, before
 * the base batch is written.
 */
async function stampReenabledWhereLocalDeclares(
  locations: ScopedLocations,
  result: MutableImportResult,
  ensure: ImportConfigPatch,
  configNames: ReadonlyMap<string, string>,
): Promise<ImportConfigPatch> {
  const plugins = { ...ensure.plugins };
  for (const installed of result.installedPlugins) {
    if (installed.scope !== locations.scope || installed.reenabled !== true) {
      continue;
    }

    const marketplace = declaredNameFor(configNames, installed.marketplace);
    const key = `${installed.plugin}@${marketplace}`;
    // eslint-disable-next-line no-await-in-loop -- each stamp reads the previous stamp's write
    const localCfg = await loadConfig(locations.localConfigJsonPath);
    if (localCfg.status !== "valid" || ownValue(localCfg.config.plugins, key) === undefined) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- read-modify-write of the local config file
    await writePluginConfigEntry(
      localCfg.config,
      locations.localConfigJsonPath,
      locations.scopeRoot,
      installed.plugin,
      marketplace,
      { enabled: true },
    );
    setOwn(plugins, key, {});
  }

  return { ...ensure, plugins };
}

function buildBatchedPatchForScope(
  result: MutableImportResult,
  scopePlan: ScopedImportPlan,
  configNames: ReadonlyMap<string, string>,
): { ensure: ImportConfigPatch; repair: ImportConfigPatch } {
  // Map marketplace name -> verbatim rawSource so the batched patch records
  // `source: rawSource` exactly as the user/Claude settings declared it
  // (`samePlannedSource` contract).
  const rawSourceByName = new Map<string, string>();
  for (const mp of scopePlan.marketplacesToEnsure) {
    rawSourceByName.set(mp.marketplace, mp.source);
  }

  const marketplaces: ImportConfigPatch["marketplaces"] = {};
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

    setOwn(marketplaces, declaredNameFor(configNames, added.marketplace), { source: rawSource });
  }

  const plugins: Record<string, Partial<PluginConfigEntry>> = {};
  for (const installed of result.installedPlugins) {
    if (installed.scope !== scopePlan.scope) {
      continue;
    }

    const key = `${installed.plugin}@${declaredNameFor(configNames, installed.marketplace)}`;
    // D-04-07: a promotion that enabled a disabled record declares it the way
    // the enable path does; every other install declares the bare key.
    setOwn(plugins, key, installed.reenabled === true ? { enabled: true } : {});
  }

  return {
    ensure: { marketplaces, plugins },
    repair: buildRepairPatchForScope(result, scopePlan, rawSourceByName, configNames),
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
  configNames: ReadonlyMap<string, string>,
): ImportConfigPatch {
  const marketplaces: ImportConfigPatch["marketplaces"] = {};
  for (const skipped of result.skippedExistingMarketplaces) {
    if (skipped.scope !== scopePlan.scope) {
      continue;
    }

    const rawSource = rawSourceByName.get(skipped.marketplace);
    if (rawSource === undefined) {
      continue;
    }

    setOwn(marketplaces, declaredNameFor(configNames, skipped.marketplace), { source: rawSource });
  }

  const plugins: Record<string, Record<string, never>> = {};
  for (const skipped of result.skippedExistingPlugins) {
    if (skipped.scope !== scopePlan.scope) {
      continue;
    }

    setOwn(plugins, `${skipped.plugin}@${declaredNameFor(configNames, skipped.marketplace)}`, {});
  }

  return { marketplaces, plugins };
}

interface LoadedConfig {
  marketplaces?: Record<string, unknown>;
  plugins?: Record<string, unknown>;
}

/**
 * LAYER-06 / D-MF-03: a layer never declares a plugin without its
 * marketplace, so a repaired plugin key is written only when the batch or the
 * loaded file declares the marketplace (the part after the key's last `@`). A
 * repair that cannot name the marketplace is dropped, and the next import or
 * load reports the record as it stands.
 */
function declaresMarketplaceOf(
  key: string,
  batchMarketplaces: ImportConfigPatch["marketplaces"],
  current: LoadedConfig,
): boolean {
  const marketplace = key.slice(key.lastIndexOf("@") + 1);
  return (
    ownValue(batchMarketplaces, marketplace) !== undefined ||
    ownValue(current.marketplaces, marketplace) !== undefined
  );
}

/**
 * WR-01: merge the always-written `ensure` patch with the subset of `repair`
 * entries whose keys are ABSENT from the loaded config. Already-declared
 * keys are dropped so the all-declared steady state stays byte-stable
 * (RECON-05) -- the post-pass then skips the save entirely when nothing
 * remains.
 */
function mergeEnsureAndRepairs(
  ensure: ImportConfigPatch,
  repair: ImportConfigPatch,
  current: LoadedConfig,
): ImportConfigPatch {
  const marketplaces = { ...ensure.marketplaces };
  for (const [name, patch] of Object.entries(repair.marketplaces)) {
    if (
      ownValue(current.marketplaces, name) === undefined &&
      ownValue(marketplaces, name) === undefined
    ) {
      setOwn(marketplaces, name, patch);
    }
  }

  const plugins = { ...ensure.plugins };
  for (const [key, patch] of Object.entries(repair.plugins)) {
    if (
      ownValue(current.plugins, key) === undefined &&
      ownValue(plugins, key) === undefined &&
      declaresMarketplaceOf(key, marketplaces, current)
    ) {
      setOwn(plugins, key, patch);
    }
  }

  return { marketplaces, plugins };
}

function isEmptyPatch(batch: ImportConfigPatch): boolean {
  return Object.keys(batch.marketplaces).length === 0 && Object.keys(batch.plugins).length === 0;
}

/**
 * Push ONE `UnexpectedPluginFailureOutcome`, rendering `error` exactly once:
 * the head is `redactAbsolutePaths(errorMessage(error))` and the onward
 * chain (when `error` carries one) is `redactCauseChain(error.cause)` --
 * mirroring `orchestrators/reconcile/apply.ts::redactedDependencyCascadeError`.
 * Keeping the head and the chain as separate fields, rather than a single
 * pre-joined `head + trailer` string, is what lets
 * `buildImportNotificationMarketplaces` rebuild ONE `Error` with a real
 * `.cause` link for the notification grammar to walk, instead of the walker
 * re-rendering an already-flattened trailer embedded in the head text.
 * MIM-03 / D-PL6-12: the rollback partials are redacted the same way.
 */
function pushUnexpectedFailure(
  result: MutableImportResult,
  plugin: PlannedPluginImport,
  reason: UnexpectedPluginFailureOutcome["reason"],
  error: Error,
  rollbackPartials: readonly RollbackPartial[] = [],
): void {
  const causeChain = redactCauseChain(error.cause);
  const runtimeReason =
    reason === "unexpected-failure" ? runtimeFailureReason(error, rollbackPartials) : undefined;
  result.unexpectedPluginFailures.push({
    kind: "plugin-failure",
    scope: plugin.scope,
    plugin: plugin.ref.plugin,
    marketplace: plugin.ref.marketplace,
    ref: refLabel(plugin),
    reason,
    ...(runtimeReason !== undefined && { runtimeReason }),
    cause: redactAbsolutePaths(errorMessage(error)),
    ...(causeChain !== undefined && { causeChain }),
    ...(rollbackPartials.length > 0 && partialMember(error, rollbackPartials)),
  });
}

/**
 * MIM-03: where the redacted rollback phases ride. A dependency's partial
 * names the dependency (D-PL6-04); any other names the plugin (D-PL6-03).
 */
function partialMember(
  error: Error,
  rollbackPartials: readonly RollbackPartial[],
): Pick<UnexpectedPluginFailureOutcome, "rollbackPartial" | "failedDependency"> {
  const rollbackPartial = redactedRollbackPartials(rollbackPartials);
  return error instanceof DependencyCascadeError
    ? { failedDependency: { key: error.key, rollbackPartial } }
    : { rollbackPartial };
}

/**
 * MIM-03 / D-PL6-12 / T-55-02-02: the rollback phases as a failed row shows
 * them, each cause rebuilt through `redactCauseChain` so no absolute path
 * reaches the row.
 */
function redactedRollbackPartials(
  partials: readonly RollbackPartial[],
): NonNullable<PluginFailedMessage["rollbackPartial"]> {
  return partials.map((partial) => {
    const cause = redactCauseChain(partial.cause);
    return { phase: partial.phase, ...(cause !== undefined && { cause }) };
  });
}

/**
 * IMP-09: the reason `install`'s failure row gives an error its shape ladder
 * leaves unclassified: a rollback that could not finish (REC-06, install's
 * row names it first), the reason of the marketplace add the install ran
 * (LAYER-07), or the git host's answer.
 */
function runtimeFailureReason(
  error: Error,
  rollbackPartials: readonly RollbackPartial[],
): ContentReason | undefined {
  if (rollbackPartials.length > 0) {
    return "rollback partial";
  }

  return error instanceof InstallMarketplaceAddError ? error.reason : classifyGitHostFailure(error);
}

/**
 * Recover the semantic dispatch from the typed `Error` in the collapsed
 * `status: "failed"` outcome. `PluginShapeError.kind === "already-installed"`
 * and `ConcurrentInstallError` both route to the skip bucket;
 * `not-in-manifest` and `(no-)not-installable` route to the
 * unavailable / uninstallable warnings, carrying the caller's pre-formatted
 * `cause` text verbatim (`ImportWarningOutcome.cause` has no rendered
 * cause-chain slot, so there is nothing to double-render there); a
 * `DependencyCascadeError` (RESV-06) routes to `unexpectedPluginFailures`
 * with `reason: "dependency-failed"`; everything else lands there with
 * `reason: "unexpected-failure"`. Both `unexpectedPluginFailures` pushes go
 * through `pushUnexpectedFailure`, which derives its head and cause chain
 * from `error` directly rather than from the pre-formatted `cause` string.
 *
 * Mirrors the instanceof ladder in
 * `orchestrators/reconcile/apply-outcomes.ts::classifyOrchestratorThrow`,
 * which checks `DependencyCascadeError` first for the same reason.
 */
function dispatchFailedOutcome(
  result: MutableImportResult,
  plugin: PlannedPluginImport,
  error: Error,
  cause: string,
  options: { readonly rollbackPartials: readonly RollbackPartial[] },
): void {
  if (error instanceof DependencyCascadeError) {
    pushUnexpectedFailure(result, plugin, "dependency-failed", error, options.rollbackPartials);
    return;
  }

  if (error instanceof ConcurrentInstallError) {
    pushAlreadyInstalled(result, plugin);
    return;
  }

  if (error instanceof StateLockHeldError) {
    // IMP-07 / D-09: another process took the lock after the read pass.
    const { cause, causeChain } = lockHeldFailure(error);
    result.unexpectedPluginFailures.push({
      kind: "plugin-failure",
      scope: plugin.scope,
      plugin: plugin.ref.plugin,
      marketplace: plugin.ref.marketplace,
      ref: refLabel(plugin),
      reason: "lock-held",
      cause,
      ...(causeChain !== undefined && { causeChain }),
    });
    return;
  }

  if (error instanceof PluginShapeError) {
    // Switch on `error.shape.kind` for compile-time exhaustiveness.
    switch (error.shape.kind) {
      case "already-installed":
        pushAlreadyInstalled(result, plugin);
        return;
      case "not-in-manifest":
        pushPluginWarning(result, plugin, "unavailable", cause);
        return;
      case "not-installable":
      case "no-longer-installable":
        // IMP-08: install's own narrowing, so a fresh import reads what
        // `install` reads for the same plugin.
        result.warnings.push({
          ...warningBase(plugin, cause),
          reason: "uninstallable",
          reasons: narrowResolverReasons(
            error.shape.reasons,
            error.shape.unsupportedKinds,
            error.shape.partialable,
          ),
        });
        return;
    }
  }

  pushUnexpectedFailure(result, plugin, "unexpected-failure", error, options.rollbackPartials);
}

/**
 * Surfaces `result.diagnostics` (malformed/unreadable settings and config
 * files, unmappable marketplace sources, post-install warnings, etc.) that
 * have no representation in the marketplace/plugin cascade. Routes through
 * the sanctioned `notifyDiagnostic` seam (S2 / PR #51) -- the same
 * post-cascade notify exception `reconcile/apply.ts`'s
 * `surfacePostCommitWarnings` uses -- so these facts reach the user instead
 * of staying in-memory-only on the returned result.
 */
function surfaceImportDiagnostics(
  ctx: ImportClaudeSettingsOptions["ctx"],
  run: NotificationRun,
  diagnostics: readonly ImportDiagnostic[],
): void {
  if (diagnostics.length === 0) {
    return;
  }

  const lines = diagnostics.map((d) => d.message);
  const header =
    lines.length === 1
      ? "1 import diagnostic surfaced."
      : `${lines.length.toString()} import diagnostics surfaced.`;
  notifyDiagnostic(ctx, run, header, lines);
}

/**
 * Imports enabled plugins and their marketplaces from Claude settings into
 * every selected scope: merges each scope's settings, plans the marketplaces
 * to ensure and plugins to install, runs that plan per scope, emits one
 * notification cascade for the whole run, then surfaces any accumulated
 * `result.diagnostics` via the sanctioned second-notify seam (see
 * `surfaceImportDiagnostics`).
 */
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
    // eslint-disable-next-line no-await-in-loop -- each scope plan appends to the shared result arrays
    await executeScopedPlan(opts, result, scopePlan);
  }

  // D-20-02 / D-19-02: cascade construction
  // mirrors the reinstall outcome recipe at
  // orchestrators/plugin/reinstall-record.ts; execute.ts substitutes the
  // import-cascade variant set (added / updated / failed marketplaces).
  // Truly catastrophic throws bubble to Pi runtime -- better for debugging
  // than a polished error message that masks the bug. The inner
  // executeScopedPlan try/catch covers expected loadState failures.
  // D-12 / OUT-07: the import cascade is bulk (one import touches many
  // marketplaces) -> Plural row cardinality. D-02: thread IMPORT_CONTEXT + the
  // rows through notifyWithContext, so import's rows resolve through its own
  // row policies (MOD-03).
  const { mcpConfigNotices, dependencyChanges, ...executionResult } = result;
  const marketplaces: Plural<MarketplaceRows<ImportMsg>> = buildImportNotificationMarketplaces(
    executionResult,
    dependencyChanges,
  );
  // OUT-04 / D-04: import is a plural (bulk) operation -> emit the trailing
  // per-operation tally under the `Import` label.
  notifyWithContext(opts.ctx, opts.run, IMPORT_CONTEXT, marketplaces, undefined, "plural");
  surfaceImportDiagnostics(opts.ctx, opts.run, result.diagnostics);
  notifyMcpConfigNotices(opts.ctx, opts.run, mcpConfigNotices);

  return executionResult;
}
