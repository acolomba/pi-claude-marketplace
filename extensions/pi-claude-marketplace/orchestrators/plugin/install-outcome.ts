// orchestrators/plugin/install-outcome.ts
//
// Public outcome contract for the guard-free install ledger. The install hub
// owns phase construction; this module owns the caller-facing discriminant and
// projects the mutable ledger context onto the narrow readonly summary.

import { executeInstallLedger } from "./install.ts";

import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { DegradeKind } from "../../shared/notify-reasons.ts";
import type { Scope } from "../../shared/types.ts";
import type { RollbackPartial } from "../../transaction/phase-ledger.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { InstallCloneCacheSeam } from "./install-clone-probe.ts";
import type { InstallLedgerContext } from "./install.ts";

/** Controls how install orchestration surfaces notifications. */
export type InstallPluginNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

/** Inputs consumed by the guard-free install ledger. */
export interface InstallLedgerOptions {
  /** Context used only by the clone probe's authentication notification seam. */
  readonly ctx: NotificationContext;
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly mapModel?: boolean;
  readonly partial?: boolean;
  readonly pinVersionOverride?: string;
  readonly allowExistingRecord?: boolean;
  readonly cloneCacheSeam?: InstallCloneCacheSeam;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/** Failure details captured before a formatted ledger error is rethrown. */
export interface InstallFailureCapture {
  rollbackPartials: readonly RollbackPartial[];
  version: string | undefined;
}

/** Readonly facts exposed after a completed ledger run. */
export interface InstallLedgerSummary {
  readonly resolved: MaterializablePlugin;
  readonly frontmatterDegradations: readonly {
    readonly kind: DegradeKind;
    readonly generatedName: string;
    readonly parseError: string;
  }[];
  readonly stagedAgentNames: readonly string[];
  readonly stagedMcpServerNames: readonly string[];
}

/** Caller-facing result of the guard-free install ledger. */
export type InstallLedgerResult =
  | { readonly kind: "installed"; readonly summary: InstallLedgerSummary }
  | { readonly kind: "marketplace-absent" };

/**
 * Run install's phase ledger without acquiring a state lock.
 *
 * The caller owns locking and persistence. Failures preserve rollback details
 * through `capture`; success exposes only the immutable outcome projection.
 */
export async function runInstallLedger(
  state: ExtensionState,
  locations: ScopedLocations,
  options: InstallLedgerOptions,
  capture?: InstallFailureCapture,
): Promise<InstallLedgerResult> {
  const result = await executeInstallLedger(state, locations, options, capture);
  if (result.kind === "marketplace-absent") {
    return result;
  }

  return { kind: "installed", summary: toInstallLedgerSummary(result.installCtx) };
}

/** Project the completed ledger context onto its caller-facing summary. */
function toInstallLedgerSummary(context: InstallLedgerContext): InstallLedgerSummary {
  return {
    resolved: context.resolved,
    frontmatterDegradations: context.frontmatterDegradations,
    stagedAgentNames: context.stagedAgentNames,
    stagedMcpServerNames: context.stagedMcpServerNames,
  };
}
