// Owner for edge/types.ts (MOD-09).
//
// D-116-11: the module is type-only, so this owner holds `satisfies` bindings
// and `@ts-expect-error` negatives, no runtime case, and no import of the test
// runner at all. `node --test` runs it with zero cases and the direct-coverage
// gate reports the pair as type-only, because a type-only module emits no
// JavaScript to measure.
//
// The one contract `EdgeDeps` carries is its required-versus-optional split:
// the completion cache, the MCP status reader, the git/update operations, the
// reconcile apply step and the missing-dependency step are required, while
// `importClaudeSettings` is optional. The hooks runtime stays at its direct
// root-to-bridge boundary because edge cannot import bridge contracts.
// D-116-12: this owner does NOT enumerate the member set and does NOT assert the
// module's export surface. A test observes shape; whether a member is READ
// belongs to the call graph, which no test of the type can reach, and an unused
// export is already `fallow dead-code`'s question.
//
// The stub member types are imported from the same modules edge/types.ts
// imports them from, so a change to an injected seam is a compile error here
// rather than a silently stale hand-copy. The collaborator contracts are not
// re-pinned; their own source-test pairs own those details.
//
// D-116-13: every negative sits on the line its diagnostic actually lands on. A
// multi-line `satisfies` reports on its CLOSING line, so those markers sit after
// the last property, immediately before the closing brace; a single-line
// `satisfies` and a property-type mismatch report on their own line, so those
// markers sit directly above.
//
// No exhaustiveness claim: the module declares one interface and holds no
// switch, so a missing-arm plant has no target here.

import type { EdgeDeps } from "../../extensions/pi-claude-marketplace/edge/types.ts";
import type {
  ClaudeImportExecutionResult,
  ImportClaudeSettingsOptions,
} from "../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";
import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ApplyReconcileOptions } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type {
  PluginUpdateFn,
  ScopeDependencyInstallFn,
} from "../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { McpStatusReader } from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";
import type { CompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

const gitOps = {
  checkout: () => Promise.resolve(),
  clone: () => Promise.resolve(),
  currentBranch: () => Promise.resolve("main"),
  fetch: () => Promise.resolve(),
  forceUpdateRef: () => Promise.resolve(),
  resolveRef: () => Promise.resolve("a1b2c3d"),
  resolveRemoteRef: () => Promise.resolve("a1b2c3d"),
  listRemotes: () => Promise.resolve({ kind: "not-a-repo" }),
} satisfies GitOps;

const pluginUpdate = (() =>
  Promise.resolve({
    constraint: undefined,
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    fromVersion: "1.0.0",
    name: "formatter",
    partition: "unchanged",
    toVersion: "1.0.0",
  })) satisfies PluginUpdateFn;

const beginPluginUpdateRun = (): PluginUpdateFn => pluginUpdate;

const mcpStatus = { lookup: () => "no-snapshot" } satisfies McpStatusReader;

const applyReconcile = (_opts: ApplyReconcileOptions): Promise<void> => Promise.resolve();

const installMissingDependencies = (() =>
  Promise.resolve({ rows: [], mcpConfigNotices: [] })) satisfies ScopeDependencyInstallFn;

const IMPORT_RESULT = {
  addedMarketplaces: [],
  changedResources: false,
  diagnostics: [],
  installedPlugins: [],
  marketplaceFailures: [],
  skippedExistingMarketplaces: [],
  skippedExistingPlugins: [],
  sourceMismatches: [],
  unexpectedPluginFailures: [],
  warnings: [],
} satisfies ClaudeImportExecutionResult;

const importClaudeSettings = (
  _opts: ImportClaudeSettingsOptions,
): Promise<ClaudeImportExecutionResult> => Promise.resolve(IMPORT_RESULT);

function proveEdgeDepsShape(completionCache: CompletionCache): void {
  // The optional-member proof: the bundle is complete without the import hook.
  void ({
    applyReconcile,
    beginPluginUpdateRun,
    completionCache,
    gitOps,
    installMissingDependencies,
    mcpStatus,
  } satisfies EdgeDeps);
  void ({
    applyReconcile,
    beginPluginUpdateRun,
    completionCache,
    gitOps,
    importClaudeSettings,
    installMissingDependencies,
    mcpStatus,
  } satisfies EdgeDeps);

  // @ts-expect-error the edge dependency bundle carries all required members
  void ({} satisfies EdgeDeps);

  void ({
    applyReconcile,
    beginPluginUpdateRun,
    completionCache,
    installMissingDependencies,
    mcpStatus,
    // @ts-expect-error the edge dependency bundle always carries its git operations
  } satisfies EdgeDeps);

  void ({
    applyReconcile,
    completionCache,
    gitOps,
    installMissingDependencies,
    mcpStatus,
    // @ts-expect-error the edge dependency bundle always carries its plugin update run factory
  } satisfies EdgeDeps);

  void ({
    applyReconcile,
    beginPluginUpdateRun,
    gitOps,
    installMissingDependencies,
    mcpStatus,
    // @ts-expect-error the edge dependency bundle always carries its completion cache
  } satisfies EdgeDeps);

  void ({
    applyReconcile,
    beginPluginUpdateRun,
    completionCache,
    gitOps,
    installMissingDependencies,
    // @ts-expect-error the edge dependency bundle always carries its MCP status reader
  } satisfies EdgeDeps);

  void ({
    beginPluginUpdateRun,
    completionCache,
    gitOps,
    installMissingDependencies,
    mcpStatus,
    // @ts-expect-error the edge dependency bundle always carries its reconcile apply step (APL-01)
  } satisfies EdgeDeps);

  void ({
    applyReconcile,
    beginPluginUpdateRun,
    completionCache,
    gitOps,
    mcpStatus,
    // @ts-expect-error the edge dependency bundle always carries its missing-dependency step (D-PL2-09)
  } satisfies EdgeDeps);

  const applyWithWrongParameter = (_scope: string): Promise<void> => Promise.resolve();

  void ({
    beginPluginUpdateRun,
    completionCache,
    gitOps,
    installMissingDependencies,
    mcpStatus,
    // @ts-expect-error the reconcile apply step takes the reconcile apply options bundle
    applyReconcile: applyWithWrongParameter,
  } satisfies EdgeDeps);

  const importWithWrongParameter = (_scope: string): Promise<ClaudeImportExecutionResult> =>
    Promise.resolve(IMPORT_RESULT);

  void ({
    applyReconcile,
    beginPluginUpdateRun,
    completionCache,
    gitOps,
    installMissingDependencies,
    mcpStatus,
    // @ts-expect-error the import hook takes the import orchestrator's options bundle
    importClaudeSettings: importWithWrongParameter,
  } satisfies EdgeDeps);

  const importWithWrongReturn = (_opts: ImportClaudeSettingsOptions): Promise<string> =>
    Promise.resolve("imported");

  void ({
    applyReconcile,
    beginPluginUpdateRun,
    completionCache,
    gitOps,
    installMissingDependencies,
    mcpStatus,
    // @ts-expect-error the import hook resolves the import orchestrator's execution result
    importClaudeSettings: importWithWrongReturn,
  } satisfies EdgeDeps);
}

void proveEdgeDepsShape;

function proveEdgeDepsReadonly(deps: EdgeDeps, completionCache: CompletionCache): void {
  // @ts-expect-error the injected completion cache is readonly
  deps.completionCache = completionCache;
  // @ts-expect-error the injected git operations are readonly
  deps.gitOps = gitOps;
  // @ts-expect-error the injected plugin update run factory is readonly
  deps.beginPluginUpdateRun = beginPluginUpdateRun;
  // @ts-expect-error the injected import hook is readonly
  deps.importClaudeSettings = importClaudeSettings;
  // @ts-expect-error the injected MCP status reader is readonly
  deps.mcpStatus = mcpStatus;
  // @ts-expect-error the injected reconcile apply step is readonly
  deps.applyReconcile = applyReconcile;
  // @ts-expect-error the injected missing-dependency step is readonly
  deps.installMissingDependencies = installMissingDependencies;
}

void proveEdgeDepsReadonly;
