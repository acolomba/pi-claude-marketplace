// orchestrators/plugin/operations.ts
//
// Production composition owner for the plugin operations. Each flow module
// keeps its semantic factory and its injected transaction contract; this owner
// is the single place that binds those contracts to the concrete Node
// implementations, so a command boundary asks for an operation rather than
// assembling one.

import { runPhases } from "../../transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { createInstallPlugin } from "./install-flow.ts";

import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type { InstallTransaction } from "./install-flow.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";

// The one concrete binding of install's semantic transaction contract. It is
// module-private so no caller can pass a half-real transaction: the only way to
// reach the production ledger and state lock is through the operation below.
const INSTALL_TRANSACTION: InstallTransaction = {
  runPhases: (...args) => runPhases(...args),
  withLockedStateTransaction: (...args) => withLockedStateTransaction(...args),
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
