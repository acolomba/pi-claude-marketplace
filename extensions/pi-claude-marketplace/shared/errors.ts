/** Normalize a thrown `unknown` to its message text, since `instanceof Error`
 *  narrowing must be repeated everywhere a caught value is interpolated. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Exhaustiveness check helper for discriminated unions.
 * Call in the `default` case of a switch to get a compile-time error if a new
 * variant is added without updating the switch.
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

/**
 * MSG-CC-1 (CMC-18): depth-5 Error.cause walker rendered as
 * `cause: <l1> -> <l2> -> ... [(truncated)]`. Returns `""` when `err` is
 * `undefined` or `null` so callers can compose `body + (trailer === "" ? "" :
 * "\n\n" + trailer)` without extra guards.
 *
 * Walker contract (relocated from orchestrators/marketplace/shared.ts's
 * legacy depth-5 walker):
 *   - Depth bound 5 prevents pathological cycles (T-13-04 DoS mitigation).
 *   - Cycle detection: `current.cause !== current` -- an Error whose own
 *     `.cause` is itself terminates the walk at depth 1.
 *   - Non-Error fallback: `string` causes render verbatim; any other
 *     `unknown` cause renders via `Object.prototype.toString.call(c)` (so a
 *     `{x: 1}` cause renders as `[object Object]`, never `[object Object]`
 *     with `String()` coercion that the ESLint rule
 *     `@typescript-eslint/no-base-to-string` forbids on unknown-with-toString).
 *   - When the loop exits at the depth bound AND the chain continues
 *     (`current` is still non-null/undefined and would have walked further),
 *     append ` (truncated)` to the LAST link.
 *
 * NFR-9: surfaces only `Error.message` (or `String`/
 * `Object.prototype.toString` fallback for non-Error). No `.stack`, no
 * absolute paths. `shared/notify.ts` consumes this walker via
 * `renderIndentedCauseChain` so the trailer lands automatically below every
 * failed / manual-recovery plugin row.
 *
 * Single canonical implementation in `shared/errors.ts` (D-11 layering).
 */
export function causeChainTrailer(err: unknown): string {
  if (err === undefined || err === null) {
    return "";
  }

  const PREFIX = "cause: ";
  const JOINER = " -> ";
  const MAX_DEPTH = 5;
  const links: string[] = [];
  let current: unknown = err;
  let truncated = false;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    links.push(linkMessage(current));
    if (current instanceof Error && current.cause !== undefined && current.cause !== current) {
      current = current.cause;
      if (depth === MAX_DEPTH - 1) {
        // We just consumed the depth-bound slot but `current` still has more
        // chain to walk. Mark the rendered output truncated.
        truncated = true;
      }
    } else {
      break;
    }
  }

  if (truncated) {
    links[links.length - 1] = `${links.at(-1)} (truncated)`;
  }

  return `${PREFIX}${links.join(JOINER)}`;
}

function linkMessage(c: unknown): string {
  if (c instanceof Error) {
    return c.message;
  }

  if (typeof c === "string") {
    return c;
  }

  return Object.prototype.toString.call(c);
}

/**
 * Compose `errorMessage(err) [\n\n${causeChainTrailer(err)}]` for outcome
 * `notes` aggregated outside the notify path. The `notify` renderer trails
 * the cause chain automatically below the plugin row; this helper exists for
 * outcome-aggregation callsites (orchestrators/marketplace/update.ts,
 * orchestrators/plugin/reinstall.ts, orchestrators/plugin/update.ts) that
 * need the same text without going through the notify channel.
 *
 * Single canonical implementation here is the source of truth -- if the
 * cause-chain trailer contract changes (depth bound, separator, trimming
 * rule), the change lands once.
 */
export function composeErrorWithCauseChain(err: unknown): string {
  const trailer = causeChainTrailer(err);
  return trailer === "" ? errorMessage(err) : `${errorMessage(err)}\n\n${trailer}`;
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

/** D-14 / MU-5: marketplace update failure preserves the retry-hint slot per MU-5. */
export class MarketplaceUpdateError extends Error {
  readonly retryHint: string;
  constructor(message: string, opts: { cause?: unknown; retryHint?: string } = {}) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause });
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
    const conflictLines = conflicts.map((c) => `  - ${c}`).join("\n");
    super(`Cross-plugin name conflict:\n${conflictLines}`);
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
 * `undo` chain; `formatRollbackError` returns the structured rollback
 * result and the orchestrator composes the final user message via the
 * V2 `notify(ctx, NotificationMessage)` path (`shared/notify.ts`).
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
 * D-08 fail-fast cross-process state lock contention.
 *
 * Thrown by `transaction/with-state-guard.ts` before loading state when
 * another Pi process already owns this scope's `.state-lock` sentinel.
 */
export class StateLockHeldError extends Error {
  readonly scope: "user" | "project";
  readonly lockPath: string;
  constructor(scope: "user" | "project", lockPath: string, options?: ErrorOptions) {
    super(
      `Another pi-claude-marketplace operation is in progress for ${scope} scope (${lockPath}). Retry after it completes.`,
      options,
    );
    this.name = "StateLockHeldError";
    this.scope = scope;
    this.lockPath = lockPath;
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
 * originating error for the depth-5 `causeChainTrailer` walk.
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

/**
 * CMC-16: structured manual-recovery signal for the bridge-replacement
 * leak path.
 *
 * Bridges (`bridges/{skills,commands,agents}/stage.ts`) throw this
 * when a rollback of a partially-completed `replace*Internal` swap
 * leaks files / directories the caller must clean up by hand. The
 * manual-recovery anchor is NOT embedded in `.message` -- per
 * MSG-MR-1 / MSG-MR-2 the manual-recovery row is composed at the notify
 * boundary in `shared/notify.ts`. Bridges produce STRUCTURED data
 * (`.leaks`); the orchestrator (`orchestrators/plugin/reinstall.ts` reason
 * narrowing and the cascade-row mapper) type-checks the Error instead of
 * substring-matching the message text. `shared/notify.ts` reads `.leaks`
 * directly to name the leaked paths on the rendered row (AS-7).
 *
 * `Error.cause` is set via the standard `ErrorOptions` bag (mirrors the
 * `PluginUpdatePhase3Error` precedent above) so the depth-5
 * `causeChainTrailer` walker surfaces the originating bridge error to the
 * user below the manual-recovery row.
 */
export class ManualRecoveryError extends Error {
  readonly leaks: readonly string[];
  constructor(message: string, leaks: readonly string[], options?: ErrorOptions) {
    super(message, options);
    this.name = "ManualRecoveryError";
    this.leaks = leaks;
  }
}

/**
 * Discriminated typed error replacing the free-text `Error.message`
 * parsing previously used in install / update / remove / reinstall catch
 * sites. Closes the systemic v1.3 pattern hole that the
 * `ManualRecoveryError` refactor missed in additional catch sites beyond
 * install, and eliminates the SonarCloud `typescript:S5852` ReDoS hotspot
 * at the legacy regex (previously `/is not installable:\s*(.+)$/`) that
 * has since been removed.
 *
 * Discriminated by `kind`:
 *   - `"not-in-manifest"`     -- PI-3, thrown from `installPlugin`
 *   - `"already-installed"`   -- PI-5, thrown from `installPlugin`
 *   - `"not-installable"`     -- PR-6, thrown from `requireInstallable`
 *                                with `op = "install"`
 *   - `"no-longer-installable"` -- PR-6, thrown from `requireInstallable`
 *                                with `op = "update"`
 * The downstream consumer is `classifyEntityShapeError` (install.ts).
 *
 * The constructor is the SINGLE SOURCE OF TRUTH for the `.message` text. The
 * exact byte-equal forms (preserved so existing
 * `err.message.includes("is not installable")` / regex assertions stay green):
 *
 *   not-in-manifest:        `Plugin "<plugin>" not found in marketplace "<marketplace>".`
 *   already-installed:      `Plugin "<plugin>" is already installed in marketplace "<marketplace>".`
 *   not-installable:        `Plugin "<plugin>" is not installable: <reasons.join("; ")>`
 *   no-longer-installable:  `Plugin "<plugin>" is no longer installable: <reasons.join("; ")>`
 *
 * `reasons` on the (not-)installable variants is `readonly string[]` and
 * NOT `readonly Reason[]`. The resolver populates `r.notes` with free-form
 * strings (`"contains hooks"`, `"source dir does not exist"`,
 * `"declares dependencies that must be installed manually"`, etc.) -- the
 * closed `Reason` set lives one layer up at the renderer boundary. The
 * `classifyEntityShapeError` consumer in `orchestrators/plugin/install.ts`
 * narrows these strings to closed-set `Reason` members. Carrying the raw
 * strings here preserves byte-equal `.message` text (the resolver's notes
 * are joined verbatim) and removes the regex re-parse path entirely.
 *
 * `Error.cause` flows through `ErrorOptions` (mirrors `ManualRecoveryError`
 * / `PluginUpdatePhase3Error` precedents) so the depth-5
 * `causeChainTrailer` walker still surfaces the originating error.
 */
export type PluginShapeErrorShape =
  | { readonly kind: "not-in-manifest"; readonly plugin: string; readonly marketplace: string }
  | { readonly kind: "already-installed"; readonly plugin: string; readonly marketplace: string }
  | {
      readonly kind: "not-installable";
      readonly plugin: string;
      readonly reasons: readonly string[];
    }
  | {
      readonly kind: "no-longer-installable";
      readonly plugin: string;
      readonly reasons: readonly string[];
    };

export type PluginShapeErrorKind = PluginShapeErrorShape["kind"];

export class PluginShapeError extends Error {
  /**
   * The full discriminated shape is exposed as a single `readonly` field
   * so consumers narrow on `e.shape.kind` without non-null assertions.
   * The shape
   * itself was discarded). The pre-C4 mirror fields are retired.
   *
   * Reading `e.shape` returns the same object the constructor received,
   * including the discriminator and every shape-specific field
   * (`marketplace` / `reasons`) without optionality. Consumers narrow
   * on `e.shape.kind` to recover the variant.
   */
  readonly shape: PluginShapeErrorShape;
  readonly kind: PluginShapeErrorKind;
  readonly plugin: string;

  constructor(shape: PluginShapeErrorShape, options?: ErrorOptions) {
    super(buildPluginShapeMessage(shape), options);
    this.name = "PluginShapeError";
    this.shape = shape;
    // `kind` and `plugin` are kept as convenience top-level shortcuts
    // because they appear on EVERY shape variant; the
    // shape-specific fields (marketplace / reasons) are NOT mirrored.
    this.kind = shape.kind;
    this.plugin = shape.plugin;
  }
}

function buildPluginShapeMessage(shape: PluginShapeErrorShape): string {
  switch (shape.kind) {
    case "not-in-manifest":
      return `Plugin "${shape.plugin}" not found in marketplace "${shape.marketplace}".`;
    case "already-installed":
      return `Plugin "${shape.plugin}" is already installed in marketplace "${shape.marketplace}".`;
    case "not-installable":
      return `Plugin "${shape.plugin}" is not installable: ${shape.reasons.join("; ")}`;
    case "no-longer-installable":
      return `Plugin "${shape.plugin}" is no longer installable: ${shape.reasons.join("; ")}`;
    default:
      return assertNever(shape);
  }
}

export interface ResourcesDiscoverFailure {
  readonly scope: "user" | "project";
  readonly kind: "skills" | "prompts";
  readonly path: string;
  readonly cause: unknown;
}

/**
 * SK-5 / D-12 aggregate error for Pi's resources_discover event.
 *
 * The discovery aggregator attempts every per-scope/per-kind disk read before
 * throwing. `failures` preserves the complete failure set for tests and callers;
 * `Error.cause` carries the first failure cause so existing cause-chain formatters
 * still have a useful root cause to display.
 */
export class AggregateResourcesDiscoverError extends Error {
  readonly failures: readonly ResourcesDiscoverFailure[];
  constructor(failures: readonly ResourcesDiscoverFailure[]) {
    const details = failures
      .map(
        (failure) =>
          `${failure.scope}/${failure.kind} at ${failure.path}: ${errorMessage(failure.cause)}`,
      )
      .join("; ");
    super(`Failed to discover Pi resources: ${details}`, {
      cause: failures[0]?.cause,
    });
    this.name = "AggregateResourcesDiscoverError";
    this.failures = Object.freeze([...failures]);
  }
}
