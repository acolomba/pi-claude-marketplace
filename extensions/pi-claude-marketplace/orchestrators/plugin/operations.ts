// orchestrators/plugin/operations.ts
//
// Production composition owner for the plugin operations. Each flow module
// keeps its semantic factory and its injected transaction contract; this owner
// is the single place that binds those contracts to the concrete Node
// implementations, so a command boundary asks for an operation rather than
// assembling one.

import { runPhases } from "../../transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { createSetPluginEnabled } from "./enable-disable.ts";
import { createInstallPlugin } from "./install-flow.ts";
import { runInstallLedger } from "./install-outcome.ts";
import { createReinstallPlugin } from "./reinstall-flow.ts";
import { REAL_REINSTALL_TRANSACTION } from "./reinstall-replace.ts";
import { selectDeclaringConfigWriteTarget, writeAdoptingConfigEntries } from "./shared.ts";
import { createUninstallPlugin, REAL_UNINSTALL_TRANSACTION } from "./uninstall.ts";

import type {
  EnableDisableHooksRouting,
  EnableDisableTransaction,
  SetPluginEnabledOperation,
} from "./enable-disable.ts";
import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type { InstallTransaction } from "./install-flow.ts";
import type { ReinstallHooksRouting, ReinstallPluginFn } from "./reinstall-flow.ts";
import type { UninstallHooksRouting, UninstallPluginOperation } from "./uninstall.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";

// The one concrete binding of install's semantic transaction contract. It is
// module-private so no caller can pass a half-real transaction: the only way to
// reach the production ledger and state lock is through the operation below.
const INSTALL_TRANSACTION: InstallTransaction = {
  runPhases: (...args) => runPhases(...args),
  withLockedStateTransaction: (...args) => withLockedStateTransaction(...args),
};

// The one concrete binding of enable/disable's semantic transaction contract,
// module-private for the same reason as `INSTALL_TRANSACTION`. Every member is
// a capability another module owns, so the whole binding lives here.
//
// `runInstallLedger` is the guard-FREE ledger body: the enable branch calls it
// while already holding this scope's `withLockedStateTransaction` lock, and
// `proper-lockfile` is configured `retries: 0` and is not re-entrant, so a
// second guard on the same lock file would self-deadlock (`ELOCKED` ->
// `StateLockHeldError`).
const ENABLE_DISABLE_TRANSACTION: EnableDisableTransaction = {
  cascadeUnstagePlugin,
  runInstallLedger,
  selectConfigWriteTarget: selectDeclaringConfigWriteTarget,
  withLockedStateTransaction,
  writeConfigEntries: writeAdoptingConfigEntries,
};

/**
 * Composes the install operation from its production transaction owners and the
 * caller's routing and completion-cache owners. Constructing the operation runs
 * no work of its own -- only invoking the returned operation does.
 */
export function createInstallOperation(
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
): ReturnType<typeof createInstallPlugin> {
  return createInstallPlugin(INSTALL_TRANSACTION, hooksRouting, completionCache);
}

/**
 * Composes the enable/disable operation from its production transaction owners
 * and the caller's routing owner. Constructing the operation runs no work of
 * its own -- only invoking the returned operation does.
 */
export function createEnableOperation(
  hooksRouting: EnableDisableHooksRouting,
): SetPluginEnabledOperation {
  return createSetPluginEnabled(ENABLE_DISABLE_TRANSACTION, hooksRouting);
}

/**
 * Composes the uninstall operation from its production transaction owner and
 * the caller's routing and completion-cache owners. Constructing the operation
 * runs no work of its own -- only invoking the returned operation does.
 *
 * Uninstall's binding is the one this module imports rather than builds: three
 * of its six members are steps of the uninstall algorithm itself, private to
 * `uninstall.ts`, and exporting them to reassemble the binding here would leak
 * that module's internals to every importer (D-03).
 */
export function createUninstallOperation(
  hooksRouting: UninstallHooksRouting,
  completionCache: CompletionCache,
): UninstallPluginOperation {
  return createUninstallPlugin(REAL_UNINSTALL_TRANSACTION, hooksRouting, completionCache);
}

/**
 * Composes the single-plugin reinstall operation from its production
 * transaction owner and the caller's routing and completion-cache owners.
 * Constructing the operation runs no work of its own -- only invoking the
 * returned operation does.
 *
 * Reinstall's binding is imported rather than built here for the same reason as
 * uninstall's: five of `REAL_REINSTALL_TRANSACTION`'s six members are steps of
 * reinstall's own prepare/replace/compensate schedule, private to
 * `reinstall-replace.ts`, so this module imports the bound object and never its
 * parts (D-03). The binding names no network capability, which is what keeps
 * this module inside the network-free gate while composing an operation that
 * materializes artifacts (NFR-5: reinstall reads the cached manifest only).
 */
export function createReinstallOperation(
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
): ReinstallPluginFn {
  return createReinstallPlugin(REAL_REINSTALL_TRANSACTION, hooksRouting, completionCache);
}
