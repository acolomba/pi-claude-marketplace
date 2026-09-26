import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";

import { MarketplaceNotAddedSignal } from "./shared.ts";

import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

/** Reads one scope's recorded state. */
type LoadScopeState = (scope: Scope) => Promise<ExtensionState>;

/** The scope a marketplace or plugin target resolves to. */
interface ResolvedTargetScope {
  readonly scope: Scope;
}

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
  /**
   * State reader for every scope lookup. Production callers omit it and get
   * `loadState`; tests use it to change a scope's state between the scope
   * resolution and the target expansion without racing a real writer.
   */
  readonly loadState?: typeof loadState;
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
  const readState = options.loadState ?? loadState;
  const load: LoadScopeState = (scope) => readState(locationsFor(scope, options.cwd).extensionRoot);
  const targets =
    options.target.kind === "all"
      ? await selectAllTargets(load, options.scope)
      : await selectMarketplaceTargets(load, options.scope, options.target);
  return { cardinality, targets };
}

async function selectAllTargets(
  load: LoadScopeState,
  explicitScope: Scope | undefined,
): Promise<readonly SelectedReinstallTarget[]> {
  const scopes: readonly Scope[] =
    explicitScope === undefined ? ["project", "user"] : [explicitScope];
  const targets: SelectedReinstallTarget[] = [];
  for (const scope of scopes) {
    targets.push(...(await installedTargetsForScope(load, scope)));
  }

  return sortTargets(targets);
}

async function installedTargetsForScope(
  load: LoadScopeState,
  scope: Scope,
): Promise<readonly SelectedReinstallTarget[]> {
  const state = await load(scope);
  return Object.entries(state.marketplaces).flatMap(([marketplace, record]) =>
    Object.keys(record.plugins).map((plugin) => ({ plugin, marketplace, scope })),
  );
}

async function selectMarketplaceTargets(
  load: LoadScopeState,
  explicitScope: Scope | undefined,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
): Promise<readonly SelectedReinstallTarget[]> {
  const resolved = await resolveMarketplaceScope(load, explicitScope, target);
  const state = await load(resolved.scope);
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
  load: LoadScopeState,
  explicitScope: Scope | undefined,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
): Promise<ResolvedTargetScope> {
  if (target.kind === "plugin") {
    return resolvePluginMarketplaceScope(load, explicitScope, target);
  }

  return resolveMarketplaceTargetScope(load, explicitScope, target.marketplace);
}

async function resolvePluginMarketplaceScope(
  load: LoadScopeState,
  explicitScope: Scope | undefined,
  target: Extract<ReinstallPluginsTarget, { kind: "plugin" }>,
): Promise<ResolvedTargetScope> {
  if (explicitScope !== undefined) {
    return resolveExplicitPluginScope(load, explicitScope, target);
  }

  const [projectState, userState] = await Promise.all([load("project"), load("user")]);
  const projectRecord = projectState.marketplaces[target.marketplace];
  const userRecord = userState.marketplaces[target.marketplace];
  if (projectRecord?.plugins[target.plugin] !== undefined) {
    return { scope: "project" };
  }

  if (userRecord?.plugins[target.plugin] !== undefined) {
    return { scope: "user" };
  }

  if (projectRecord !== undefined) {
    return { scope: "project" };
  }

  if (userRecord !== undefined) {
    return { scope: "user" };
  }

  throw new MarketplaceNotAddedSignal(target.marketplace);
}

async function resolveExplicitPluginScope(
  load: LoadScopeState,
  explicitScope: Scope,
  target: Extract<ReinstallPluginsTarget, { kind: "plugin" }>,
): Promise<ResolvedTargetScope> {
  const requestedState = await load(explicitScope);
  const requestedRecord = requestedState.marketplaces[target.marketplace];
  if (requestedRecord !== undefined) {
    return { scope: explicitScope };
  }

  const otherScope = explicitScope === "project" ? "user" : "project";
  const otherState = await load(otherScope);
  const otherRecord = otherState.marketplaces[target.marketplace];
  throw new MarketplaceNotAddedSignal(
    target.marketplace,
    explicitScope,
    otherRecord === undefined ? undefined : { scope: explicitScope, plugin: target.plugin },
  );
}

async function resolveMarketplaceTargetScope(
  load: LoadScopeState,
  explicitScope: Scope | undefined,
  marketplace: string,
): Promise<ResolvedTargetScope> {
  if (explicitScope !== undefined) {
    const requestedState = await load(explicitScope);
    const requestedRecord = requestedState.marketplaces[marketplace];
    if (requestedRecord !== undefined) {
      return { scope: explicitScope };
    }

    const otherScope = explicitScope === "project" ? "user" : "project";
    await load(otherScope);
    throw new MarketplaceNotAddedSignal(marketplace, explicitScope);
  }

  const [userState, projectState] = await Promise.all([load("user"), load("project")]);
  const projectRecord = projectState.marketplaces[marketplace];
  if (projectRecord !== undefined) {
    return { scope: "project" };
  }

  const userRecord = userState.marketplaces[marketplace];
  if (userRecord !== undefined) {
    return { scope: "user" };
  }

  throw new MarketplaceNotAddedSignal(marketplace);
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
