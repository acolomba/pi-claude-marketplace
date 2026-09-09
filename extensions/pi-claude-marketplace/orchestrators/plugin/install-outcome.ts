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
import type { RollbackPartial, runPhases } from "../../transaction/phase-ledger.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { InstallPluginOutcome } from "../types.ts";
import type { InstallCloneCacheSeam, probeInstallClone } from "./install-clone-probe.ts";
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
  readonly cloneProbe?: typeof probeInstallClone;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/** Transaction operation required by the guard-free ledger. */
export interface InstallLedgerTransaction {
  readonly runPhases: typeof runPhases;
}

/** Failure details captured before a formatted ledger error is rethrown. */
export interface InstallFailureCapture {
  rollbackPartials: readonly RollbackPartial[];
  version: string | undefined;
}

/** Readonly facts exposed after a completed ledger run. */
export interface InstallLedgerSummary {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly resolved: MaterializablePlugin;
  readonly version: string;
  readonly pluginDataDir: string;
  readonly frontmatterDegradations: readonly {
    readonly kind: DegradeKind;
    readonly generatedName: string;
    readonly parseError: string;
  }[];
  readonly stagedSkillNames: readonly string[];
  readonly stagedCommandNames: readonly string[];
  readonly stagedAgentNames: readonly string[];
  readonly stagedMcpServerNames: readonly string[];
  readonly bridgeWarnings: readonly string[];
  readonly discoveryWarnings: readonly string[];
  readonly agentForeignFailures: readonly {
    readonly generatedName: string;
    readonly reason: string;
  }[];
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
  transaction?: InstallLedgerTransaction,
): Promise<InstallLedgerResult> {
  const result = await executeInstallLedger(state, locations, options, capture, transaction);
  if (result.kind === "marketplace-absent") {
    return result;
  }

  return { kind: "installed", summary: toInstallLedgerSummary(result.installCtx) };
}

/** Project the completed ledger context onto its caller-facing summary. */
function toInstallLedgerSummary(context: InstallLedgerContext): InstallLedgerSummary {
  return {
    locations: context.locations,
    cwd: context.cwd,
    marketplace: context.marketplace,
    plugin: context.plugin,
    resolved: context.resolved,
    version: context.version,
    pluginDataDir: context.pluginDataDir,
    frontmatterDegradations: context.frontmatterDegradations,
    stagedSkillNames: context.stagedSkillNames,
    stagedCommandNames: context.stagedCommandNames,
    stagedAgentNames: context.stagedAgentNames,
    stagedMcpServerNames: context.stagedMcpServerNames,
    bridgeWarnings: context.bridgeWarnings,
    discoveryWarnings: context.discoveryWarnings,
    agentForeignFailures: context.agentForeignFailures,
  };
}

/** Projects a completed ledger summary into the public installed outcome. */
export function installedPluginOutcome(
  summary: InstallLedgerSummary,
  postCommitWarnings: readonly string[],
  landedDisabled: boolean,
): InstallPluginOutcome {
  const stagedAny =
    summary.stagedSkillNames.length > 0 ||
    summary.stagedCommandNames.length > 0 ||
    summary.stagedAgentNames.length > 0 ||
    summary.stagedMcpServerNames.length > 0;
  const degradedKinds = Array.from(
    new Set(summary.frontmatterDegradations.map((degradation) => degradation.kind)),
  );

  return {
    status: "installed",
    version: summary.version,
    resourcesChanged: !landedDisabled && stagedAny,
    declaresAgents: summary.stagedAgentNames.length > 0,
    declaresMcp: summary.stagedMcpServerNames.length > 0,
    ...(landedDisabled && { landedDisabled: true as const }),
    ...(postCommitWarnings.length > 0 && { postCommitWarnings: [...postCommitWarnings] }),
    ...(summary.resolved.state === "partially-available" && {
      unsupported: [...summary.resolved.unsupported],
    }),
    ...(summary.resolved.orphanRewake === true && { orphanRewake: true }),
    ...(degradedKinds.length > 0 && { degradedKinds }),
  };
}
