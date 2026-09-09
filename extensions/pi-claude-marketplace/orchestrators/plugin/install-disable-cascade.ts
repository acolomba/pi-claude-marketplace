import { toDisabledRecord } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { malformedReasonsForKinds } from "../../shared/notify-reasons.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import { applyPartialCascadeFold } from "./shared.ts";

import type { InstallMsg } from "./install.messaging.ts";
import type { HooksRouting } from "../../bridges/hooks/index.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { DegradeKind } from "../../shared/notify-reasons.ts";
import type { Scope } from "../../shared/types.ts";
import type { UnstageOutcome } from "../marketplace/shared.ts";

/** Hooks route effects required by install at its durable-state boundary. */
export type InstallHooksRouting = Pick<
  HooksRouting,
  "readAndCachePluginHooks" | "rebuildRoutingTables" | "removePluginConfigFromCache"
>;

/** Inputs needed to disable the record written by the install ledger. */
export interface FreshInstallDisableOptions {
  readonly state: ExtensionState;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly marketplace: string;
  readonly plugin: string;
}

/** Result of the materialize-then-disable cascade. */
export type FreshInstallDisableResult =
  | { readonly ok: true; readonly removeRoutes: true }
  | { readonly ok: false; readonly cause: Error; readonly removeRoutes: boolean };

/** Facts used to compose the exact install-disabled notification row. */
export interface InstallDisabledRowOptions {
  readonly plugin: string;
  readonly version: string;
  readonly resolution:
    | { readonly state: "installable"; readonly unsupported: readonly string[] }
    | { readonly state: "partially-available"; readonly unsupported: readonly string[] };
  readonly frontmatterDegradations: readonly { readonly kind: DegradeKind }[];
}

/** Disabled-install operations bound to one routing and cascade owner. */
export interface InstallDisableCascadeOwner {
  disableFreshInstall(options: FreshInstallDisableOptions): Promise<FreshInstallDisableResult>;
  dropRoutesAfterSave(scope: Scope, marketplace: string, plugin: string): void;
  composeDisabledRow(options: InstallDisabledRowOptions): InstallMsg;
}

type MarketplaceStateRecord = ExtensionState["marketplaces"][string];
/** Installed record supplied to the injected cascade collaborator. */
export type InstallDisableCascadePluginRecord =
  ExtensionState["marketplaces"][string]["plugins"][string];

type FailedUnstageOutcome = UnstageOutcome & {
  readonly ok: false;
  readonly cause: Error;
};

function isFailedUnstageOutcome(outcome: UnstageOutcome): outcome is FailedUnstageOutcome {
  return !outcome.ok;
}

function locateFreshlyInstalledRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
):
  | {
      readonly marketplace: MarketplaceStateRecord;
      readonly installed: InstallDisableCascadePluginRecord;
    }
  | undefined {
  const marketplaceRecord = state.marketplaces[marketplace];
  const installed = marketplaceRecord?.plugins[plugin];
  if (marketplaceRecord === undefined || installed === undefined) {
    return undefined;
  }

  return { marketplace: marketplaceRecord, installed };
}

function foldFailedDisableCascade(
  installed: InstallDisableCascadePluginRecord,
  cascade: FailedUnstageOutcome,
  now: () => string,
): FreshInstallDisableResult {
  applyPartialCascadeFold(installed, cascade.dropped);
  installed.updatedAt = now();
  return {
    ok: false,
    cause: cascade.cause,
    removeRoutes: cascade.dropped.hooks.length > 0,
  };
}

function disabledRow(options: InstallDisabledRowOptions): InstallMsg {
  const malformedReasons = malformedReasonsForKinds(
    options.frontmatterDegradations.map((degradation) => degradation.kind),
  );
  const droppedReasons =
    options.resolution.state === "partially-available"
      ? narrowUnsupportedKinds(options.resolution.unsupported)
      : [];
  return {
    status: "disabled",
    name: options.plugin,
    version: options.version,
    reasons: ["installs disabled", ...malformedReasons, ...droppedReasons],
    severity: options.frontmatterDegradations.length > 0 ? "warning" : "info",
    needsReload: false,
    enableHint: true,
  };
}

/**
 * Binds disabled-install state, row, and route effects to explicit collaborators.
 *
 * The install transaction calls `disableFreshInstall` before saving and calls
 * `dropRoutesAfterSave` only after the shrunken state is durable. Keeping those
 * operations separate preserves the existing fail-clean ordering.
 */
export function composeInstallDisableCascade(dependencies: {
  readonly hooksRouting: InstallHooksRouting;
  readonly now: () => string;
  readonly unstagePlugin: (
    plugin: string,
    marketplace: string,
    locations: ScopedLocations,
    installedPlugin: InstallDisableCascadePluginRecord,
  ) => Promise<UnstageOutcome>;
}): InstallDisableCascadeOwner {
  return {
    async disableFreshInstall(options): Promise<FreshInstallDisableResult> {
      const target = locateFreshlyInstalledRecord(
        options.state,
        options.marketplace,
        options.plugin,
      );
      if (target === undefined) {
        return {
          ok: false,
          cause: new Error(
            `installPlugin: internal error -- the state phase left no record for plugin "${options.plugin}" to disable.`,
          ),
          removeRoutes: false,
        };
      }

      const cascade = await dependencies.unstagePlugin(
        options.plugin,
        options.marketplace,
        options.locations,
        target.installed,
      );
      if (isFailedUnstageOutcome(cascade)) {
        return foldFailedDisableCascade(target.installed, cascade, dependencies.now);
      }

      target.marketplace.plugins[options.plugin] = toDisabledRecord(
        target.installed,
        dependencies.now(),
      );
      return { ok: true, removeRoutes: true };
    },

    dropRoutesAfterSave(scope, marketplace, plugin): void {
      try {
        dependencies.hooksRouting.removePluginConfigFromCache(scope, marketplace, plugin);
        dependencies.hooksRouting.rebuildRoutingTables();
      } catch (error: unknown) {
        hookDebugLog(
          `install: hooks cache/routing drop failed for install-disabled ${plugin}@${marketplace}: ${errorMessage(error)} -- this plugin's hooks may keep dispatching in the running process until the next /reload rebuilds the routing table from state.json`,
        );
      }
    },

    composeDisabledRow(options): InstallMsg {
      return disabledRow(options);
    },
  };
}
