// orchestrators/plugin/operations.ts
//
// Production composition owner for the plugin operations. Each flow module
// keeps its semantic factory and its injected read or transaction contract;
// this owner binds those contracts to the concrete Node implementations, so a
// command boundary asks for an operation rather than assembling one.
//
// Reinstall is the exception, and the user-facing verb takes the other path.
// `reinstall-flow.ts` binds `REAL_REINSTALL_TRANSACTION` a second time in its
// module-private `createNodeReinstallPlugin`, which feeds the exported bulk
// `createNodeReinstallPlugins` that `edge/register.ts` calls for
// `/claude:plugin reinstall`. `createReinstallOperation` below binds the same
// transaction for the single-plugin form `reconcile/backfill.ts` takes. The two
// bodies are identical and nothing holds them in step, so a change made to one
// binding reaches only that binding's callers.
//
// The two read commands are bound as values rather than behind a factory: they
// take no routing or completion-cache owner from their caller, so there is
// nothing left for a caller to supply once the filesystem and status
// capabilities are bound here.

import { readdir, readFile, stat } from "node:fs/promises";

import { runPhases } from "../../transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { createSetPluginEnabled } from "./enable-disable.ts";
import { createFetchPlugins } from "./fetch.ts";
import { makePresenceProbe, probeManifestEntry } from "./git-source-probe.ts";
import { createGetPluginInfo } from "./info.ts";
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
import type { FetchStatus } from "./fetch.ts";
import type { PluginInfoReader } from "./info.ts";
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

// The one concrete binding of fetch's status capability. Both members are the
// fs-only probes `git-source-probe.ts` owns, which is what keeps this
// composition inside the network-free gate: fetch reaches git only through the
// clone-cache seam it defaults internally, never through anything named here
// (NFR-5).
const NODE_FETCH_STATUS: FetchStatus = { makePresenceProbe, probeManifestEntry };

/**
 * Fetches plugins through the Node-backed status capability. Reaching the value
 * runs no work of its own -- only invoking it does.
 */
export const fetchPlugins = createFetchPlugins(NODE_FETCH_STATUS);

// The one concrete binding of info's read-only filesystem capability. Text
// reads are UTF-8 and directory listings carry Node directory entries, because
// info classifies component files by their entry kind.
const NODE_PLUGIN_INFO_READER: PluginInfoReader = {
  isRegularFile: async (filePath) => (await stat(filePath)).isFile(),
  readTextFile: (filePath) => readFile(filePath, "utf8"),
  listDirectory: (directoryPath) => readdir(directoryPath, { withFileTypes: true }),
};

/**
 * Reads plugin information through the Node-backed reader capability. Reaching
 * the value runs no work of its own -- only invoking it does.
 */
export const getPluginInfo = createGetPluginInfo(NODE_PLUGIN_INFO_READER);
