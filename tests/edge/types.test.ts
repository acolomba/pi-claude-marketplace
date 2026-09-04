// Owner for edge/types.ts (MOD-09).
//
// D-116-11: the module is type-only, so this owner holds `satisfies` bindings
// and `@ts-expect-error` negatives, no runtime case, and no import of the test
// runner at all. `node --test` runs it with zero cases and the direct-coverage
// gate reports the pair as type-only, because a type-only module emits no
// JavaScript to measure.
//
// The one contract `EdgeDeps` carries is its required-versus-optional split:
// `gitOps` and `pluginUpdate` are required, `importClaudeSettings` is optional.
// D-116-12: this owner does NOT enumerate the member set and does NOT assert the
// module's export surface. A test observes shape; whether a member is READ
// belongs to the call graph, which no test of the type can reach, and an unused
// export is already `fallow dead-code`'s question.
//
// The stub member types are imported from the same modules edge/types.ts
// imports them from, so a change to either injected seam is a compile error
// here rather than a silently stale hand-copy. Neither `GitOps` nor
// `PluginUpdateFn` is re-pinned: `PluginUpdateFn`'s own contract is owned by
// tests/orchestrators/types.test.ts and `GitOps` by its own pair.
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
import type { PluginUpdateFn } from "../../extensions/pi-claude-marketplace/orchestrators/types.ts";

const gitOps = {
  checkout: () => Promise.resolve(),
  clone: () => Promise.resolve(),
  currentBranch: () => Promise.resolve("main"),
  fetch: () => Promise.resolve(),
  forceUpdateRef: () => Promise.resolve(),
  resolveRef: () => Promise.resolve("a1b2c3d"),
  resolveRemoteRef: () => Promise.resolve("a1b2c3d"),
} satisfies GitOps;

const pluginUpdate = (() =>
  Promise.resolve({
    declaresAgents: false,
    declaresMcp: false,
    fromVersion: "1.0.0",
    name: "formatter",
    partition: "unchanged",
    toVersion: "1.0.0",
  })) satisfies PluginUpdateFn;

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

// The optional-member proof: the bundle is complete without the import hook.
void ({ gitOps, pluginUpdate } satisfies EdgeDeps);
void ({ gitOps, importClaudeSettings, pluginUpdate } satisfies EdgeDeps);

// @ts-expect-error the edge dependency bundle carries both required members
void ({} satisfies EdgeDeps);

void ({
  pluginUpdate,
  // @ts-expect-error the edge dependency bundle always carries its git operations
} satisfies EdgeDeps);

void ({
  gitOps,
  // @ts-expect-error the edge dependency bundle always carries its plugin update seam
} satisfies EdgeDeps);

const importWithWrongParameter = (_scope: string): Promise<ClaudeImportExecutionResult> =>
  Promise.resolve(IMPORT_RESULT);

void ({
  gitOps,
  pluginUpdate,
  // @ts-expect-error the import hook takes the import orchestrator's options bundle
  importClaudeSettings: importWithWrongParameter,
} satisfies EdgeDeps);

const importWithWrongReturn = (_opts: ImportClaudeSettingsOptions): Promise<string> =>
  Promise.resolve("imported");

void ({
  gitOps,
  pluginUpdate,
  // @ts-expect-error the import hook resolves the import orchestrator's execution result
  importClaudeSettings: importWithWrongReturn,
} satisfies EdgeDeps);

function proveEdgeDepsReadonly(deps: EdgeDeps): void {
  // @ts-expect-error the injected git operations are readonly
  deps.gitOps = gitOps;
  // @ts-expect-error the injected plugin update seam is readonly
  deps.pluginUpdate = pluginUpdate;
  // @ts-expect-error the injected import hook is readonly
  deps.importClaudeSettings = importClaudeSettings;
}

void proveEdgeDepsReadonly;
