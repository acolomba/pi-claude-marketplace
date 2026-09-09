import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";

import { MarketplaceNotAddedSignal } from "./shared.ts";

import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

/** Target selected by the three public plugin-reinstall invocation forms. */
export type ReinstallPluginsTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };

/** One installed plugin selected for reinstall. */
export interface SelectedReinstallTarget {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

/** Inputs used to expand a reinstall request against recorded state. */
export interface SelectReinstallTargetsOptions {
  readonly cwd: string;
  readonly scope?: Scope;
  readonly target: ReinstallPluginsTarget;
}

/** Exact target expansion and invocation-form cardinality for a reinstall request. */
export interface ReinstallTargetSelection {
  readonly cardinality: "single" | "plural";
  readonly targets: readonly SelectedReinstallTarget[];
}

/** Selects deterministic reinstall targets without network access. */
export async function selectReinstallTargets(
  options: SelectReinstallTargetsOptions,
): Promise<ReinstallTargetSelection> {
  const cardinality = options.target.kind === "plugin" ? "single" : "plural";
  const targets =
    options.target.kind === "all"
      ? await selectAllTargets(options.cwd, options.scope)
      : await selectMarketplaceTargets(options.cwd, options.scope, options.target);
  return { cardinality, targets };
}

async function selectAllTargets(
  cwd: string,
  explicitScope: Scope | undefined,
): Promise<readonly SelectedReinstallTarget[]> {
  const scopes: readonly Scope[] =
    explicitScope === undefined ? ["project", "user"] : [explicitScope];
  const targets: SelectedReinstallTarget[] = [];
  for (const scope of scopes) {
    targets.push(...(await installedTargetsForScope(cwd, scope)));
  }

  return sortTargets(targets);
}

async function installedTargetsForScope(
  cwd: string,
  scope: Scope,
): Promise<readonly SelectedReinstallTarget[]> {
  const state = await loadState(locationsFor(scope, cwd).extensionRoot);
  return Object.entries(state.marketplaces).flatMap(([marketplace, record]) =>
    Object.keys(record.plugins).map((plugin) => ({ plugin, marketplace, scope })),
  );
}

async function selectMarketplaceTargets(
  cwd: string,
  explicitScope: Scope | undefined,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
): Promise<readonly SelectedReinstallTarget[]> {
  const resolved = await resolveMarketplaceScope(cwd, explicitScope, target);
  const state = await loadScopeState(cwd, resolved.scope);
  const record = state.marketplaces[target.marketplace];
  if (record === undefined) {
    throw new MarketplaceNotAddedSignal(target.marketplace, explicitScope);
  }

  const plugins = target.kind === "plugin" ? [target.plugin] : Object.keys(record.plugins);
  return sortTargets(
    plugins.map((plugin) => ({ plugin, marketplace: target.marketplace, scope: resolved.scope })),
  );
}

async function resolveMarketplaceScope(
  cwd: string,
  explicitScope: Scope | undefined,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
): Promise<{ readonly scope: Scope; readonly record: MarketplaceRecord }> {
  if (target.kind === "plugin") {
    return resolvePluginMarketplaceScope(cwd, explicitScope, target);
  }

  return resolveMarketplaceTargetScope(cwd, explicitScope, target.marketplace);
}

async function resolvePluginMarketplaceScope(
  cwd: string,
  explicitScope: Scope | undefined,
  target: Extract<ReinstallPluginsTarget, { kind: "plugin" }>,
): Promise<{ readonly scope: Scope; readonly record: MarketplaceRecord }> {
  if (explicitScope !== undefined) {
    return resolveExplicitPluginScope(cwd, explicitScope, target);
  }

  const [projectState, userState] = await Promise.all([
    loadScopeState(cwd, "project"),
    loadScopeState(cwd, "user"),
  ]);
  const projectRecord = projectState.marketplaces[target.marketplace];
  const userRecord = userState.marketplaces[target.marketplace];
  if (projectRecord?.plugins[target.plugin] !== undefined) {
    return { scope: "project", record: projectRecord };
  }

  if (userRecord?.plugins[target.plugin] !== undefined) {
    return { scope: "user", record: userRecord };
  }

  if (projectRecord !== undefined) {
    return { scope: "project", record: projectRecord };
  }

  if (userRecord !== undefined) {
    return { scope: "user", record: userRecord };
  }

  throw new MarketplaceNotAddedSignal(target.marketplace);
}

async function resolveExplicitPluginScope(
  cwd: string,
  explicitScope: Scope,
  target: Extract<ReinstallPluginsTarget, { kind: "plugin" }>,
): Promise<{ readonly scope: Scope; readonly record: MarketplaceRecord }> {
  const requestedState = await loadScopeState(cwd, explicitScope);
  const requestedRecord = requestedState.marketplaces[target.marketplace];
  if (requestedRecord !== undefined) {
    return { scope: explicitScope, record: requestedRecord };
  }

  const otherScope = explicitScope === "project" ? "user" : "project";
  const otherState = await loadScopeState(cwd, otherScope);
  const otherRecord = otherState.marketplaces[target.marketplace];
  throw new MarketplaceNotAddedSignal(
    target.marketplace,
    explicitScope,
    otherRecord === undefined ? undefined : { scope: explicitScope, plugin: target.plugin },
  );
}

async function resolveMarketplaceTargetScope(
  cwd: string,
  explicitScope: Scope | undefined,
  marketplace: string,
): Promise<{ readonly scope: Scope; readonly record: MarketplaceRecord }> {
  if (explicitScope !== undefined) {
    const requestedState = await loadScopeState(cwd, explicitScope);
    const requestedRecord = requestedState.marketplaces[marketplace];
    if (requestedRecord !== undefined) {
      return { scope: explicitScope, record: requestedRecord };
    }

    const otherScope = explicitScope === "project" ? "user" : "project";
    await loadScopeState(cwd, otherScope);
    throw new MarketplaceNotAddedSignal(marketplace, explicitScope);
  }

  const [userState, projectState] = await Promise.all([
    loadScopeState(cwd, "user"),
    loadScopeState(cwd, "project"),
  ]);
  const projectRecord = projectState.marketplaces[marketplace];
  if (projectRecord !== undefined) {
    return { scope: "project", record: projectRecord };
  }

  const userRecord = userState.marketplaces[marketplace];
  if (userRecord !== undefined) {
    return { scope: "user", record: userRecord };
  }

  throw new MarketplaceNotAddedSignal(marketplace);
}

async function loadScopeState(cwd: string, scope: Scope): Promise<ExtensionState> {
  return loadState(locationsFor(scope, cwd).extensionRoot);
}

function sortTargets(
  targets: readonly SelectedReinstallTarget[],
): readonly SelectedReinstallTarget[] {
  return Object.freeze(
    [...targets].sort((first, second) => {
      const marketplaceDifference = compareByNameThenScope(
        { name: first.marketplace, scope: first.scope },
        { name: second.marketplace, scope: second.scope },
      );
      if (marketplaceDifference !== 0) {
        return marketplaceDifference;
      }

      return compareByNameThenScope(
        { name: first.plugin, scope: first.scope },
        { name: second.plugin, scope: second.scope },
      );
    }),
  );
}
