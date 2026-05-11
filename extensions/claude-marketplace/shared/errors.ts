/** Normalize a thrown `unknown` to its message text, since `instanceof Error`
 *  narrowing must be repeated everywhere a caught value is interpolated. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * If `leak` is non-undefined, return a new Error that names both `err` and
 * the leak so the user sees the original cause AND the manual-cleanup hint
 * in the same notification.
 *
 * Returns the unchanged error (wrapped to Error if needed) when `leak` is
 * undefined so call-sites can write `throw appendLeakToError(err, await
 * cleanupStaging(...))` regardless of whether cleanup actually leaked.
 */
export function appendLeakToError(err: unknown, leak: string | undefined): Error {
  const baseError = err instanceof Error ? err : new Error(String(err));
  if (leak === undefined) {
    return baseError;
  }

  return new Error(`${baseError.message} (additionally: ${leak})`, { cause: baseError });
}

/** Sequential `appendLeakToError` for multiple leak sources -- chains via Error.cause. */
export function appendLeaks(err: unknown, leaks: readonly (string | undefined)[]): Error {
  let wrapped = err instanceof Error ? err : new Error(String(err));
  for (const leak of leaks) {
    wrapped = appendLeakToError(wrapped, leak);
  }

  return wrapped;
}

/** MA-6: stale source clone refusal. The absolute path is the canonical hint. */
export class StaleSourceCloneError extends Error {
  readonly absPath: string;
  constructor(absPath: string) {
    super(`stale source clone at ${absPath}`);
    this.name = "StaleSourceCloneError";
    this.absPath = absPath;
  }
}

/** MA-8: duplicate marketplace name in chosen scope. */
export class MarketplaceDuplicateNameError extends Error {
  readonly mpName: string;
  readonly scope: "user" | "project";
  constructor(mpName: string, scope: "user" | "project") {
    super(`Marketplace "${mpName}" already exists in ${scope} scope.`);
    this.name = "MarketplaceDuplicateNameError";
    this.mpName = mpName;
    this.scope = scope;
  }
}

/** MR-1: marketplace not found in any of the specified scopes (single-scope or both). */
export class MarketplaceNotFoundError extends Error {
  readonly mpName: string;
  readonly scopes: readonly ("user" | "project")[];
  constructor(mpName: string, scopes: readonly ("user" | "project")[]) {
    super(
      `Marketplace "${mpName}" not found in ${scopes.length === 0 ? "any" : scopes.join(", ")} scope${scopes.length === 1 ? "" : "s"}.`,
    );
    this.name = "MarketplaceNotFoundError";
    this.mpName = mpName;
    this.scopes = scopes;
  }
}

/** MR-1: same name resolves in both user and project scopes; --scope required. */
export class MarketplaceAmbiguousScopeError extends Error {
  readonly mpName: string;
  constructor(mpName: string) {
    super(
      `Marketplace "${mpName}" exists in both user and project scopes. Use --scope user or --scope project to disambiguate.`,
    );
    this.name = "MarketplaceAmbiguousScopeError";
    this.mpName = mpName;
  }
}

/** D-14 / MU-5: marketplace update failure preserves the retry-hint slot per MU-5. */
export class MarketplaceUpdateError extends Error {
  readonly retryHint: string;
  constructor(message: string, opts: { cause?: unknown; retryHint?: string } = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "MarketplaceUpdateError";
    this.retryHint = opts.retryHint ?? "";
  }
}

/**
 * PI-6 / RN-3 cross-bridge name conflict at install/update time.
 *
 * Thrown by orchestrators/plugin/shared.ts::assertNoCrossPluginConflicts
 * BEFORE any disk write. The message lists every conflicting (kind, name,
 * owning-plugin) tuple in deterministic order: skills first, then commands,
 * then agents; alphabetical within each kind. MCP server names are
 * EXCLUDED per PRD §6.5 (MC-4 handles them at the bridge layer).
 */
export class CrossPluginConflictError extends Error {
  readonly conflicts: readonly string[];
  constructor(conflicts: readonly string[]) {
    super(`Cross-plugin name conflict:\n${conflicts.map((c) => `  - ${c}`).join("\n")}`);
    this.name = "CrossPluginConflictError";
    this.conflicts = conflicts;
  }
}

/**
 * PI-15 concurrent install detected at the state-guard save boundary.
 *
 * Thrown inside the `withStateGuard` closure of
 * orchestrators/plugin/install.ts when a re-read of state shows the plugin
 * record already exists (another process beat us to the commit). The outer
 * `runPhases` result unwinds the staged resources via the ledger's
 * `undo` chain; `formatRollbackError` composes the final user message.
 */
export class ConcurrentInstallError extends Error {
  readonly plugin: string;
  readonly marketplace: string;
  constructor(plugin: string, marketplace: string) {
    super(`Plugin "${plugin}" was installed concurrently in marketplace "${marketplace}".`);
    this.name = "ConcurrentInstallError";
    this.plugin = plugin;
    this.marketplace = marketplace;
  }
}

/**
 * PU-5 silent-converge sentinel for uninstall.
 *
 * Thrown inside the `withStateGuard` closure of
 * orchestrators/plugin/uninstall.ts when the plugin record is already
 * absent at re-load time (another process completed the uninstall first).
 * The caller catches this sentinel and returns success with no
 * user-visible notification per PRD §5.2.2 PU-5 verbatim semantics.
 */
export class ConcurrentUninstallError extends Error {
  readonly plugin: string;
  constructor(plugin: string) {
    super(`Plugin "${plugin}" already uninstalled.`);
    this.name = "ConcurrentUninstallError";
    this.plugin = plugin;
  }
}

/**
 * PUP-6 aggregate phase-3 failure for plugin update.
 *
 * Wraps the heterogeneous-undo phase-3a failures from update.ts's
 * hand-rolled 3-phase sequence. `failures` carries one entry per bridge
 * (`skills` | `commands` | `agents` | `mcp`) whose `commit*` threw. The
 * constructor's `message` argument typically embeds the
 * RECOVERY_PLUGIN_REINSTALL_PREFIX-composed recovery hint; the
 * `Error.cause` (passed via the options bag) carries the chained
 * originating error for `formatErrorWithCauses` depth-5 walk.
 */
export interface Phase3Failure {
  readonly phase: "skills" | "commands" | "agents" | "mcp";
  readonly msg: string;
  readonly cause: unknown;
}

export class PluginUpdatePhase3Error extends Error {
  readonly failures: readonly Phase3Failure[];
  constructor(message: string, failures: readonly Phase3Failure[], options?: ErrorOptions) {
    super(message, options);
    this.name = "PluginUpdatePhase3Error";
    this.failures = failures;
  }
}
