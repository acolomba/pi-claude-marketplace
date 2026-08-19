/** Normalize a thrown `unknown` to its message text, since `instanceof Error`
 *  narrowing must be repeated everywhere a caught value is interpolated. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Structural predicate for `NodeJS.ErrnoException`. The `.code` property is
 * what every errno-dispatching narrower keys on, and `instanceof` cannot see
 * it because Node throws plain `Error` objects with the field attached.
 *
 * One definition: byte-identical copies previously sat in `uninstall.ts` and
 * `marketplace/remove.ts`, each private to its own narrower.
 */
export function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return (
    err instanceof Error && "code" in err && typeof (err as { code?: unknown }).code === "string"
  );
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
 * Depth bound shared by every `Error.cause` walk in the codebase (T-13-04 DoS
 * mitigation). One constant rather than a literal per walker: three walkers
 * previously each declared their own `MAX_DEPTH = 5` and each documented
 * itself as "mirroring" the others, which is a contract maintained by comment.
 */
const CAUSE_CHAIN_MAX_DEPTH = 5;

/** Whether a chain link carries a further, non-self-referencing cause. */
function hasOnwardCause(err: unknown): boolean {
  return err instanceof Error && err.cause !== undefined && err.cause !== err;
}

/**
 * Walk an `Error.cause` chain, yielding each link including the head.
 *
 * The SOLE traversal primitive: the depth bound and the self-reference cycle
 * guard live here once, so a change to either lands in one place. Callers
 * differ only in what they look for -- `causeChainTrailer` renders every link,
 * `findManualRecoveryError` takes the first link of a class, and
 * `manualRecoveryLeaks` takes the first link that carries a payload.
 *
 * Stops after `CAUSE_CHAIN_MAX_DEPTH` links, or earlier when a link has no
 * onward cause or its `.cause` references itself.
 */
function* causeChain(err: unknown): Generator {
  let current: unknown = err;
  for (let depth = 0; depth < CAUSE_CHAIN_MAX_DEPTH; depth++) {
    yield current;
    if (!hasOnwardCause(current)) {
      return;
    }

    current = (current as Error).cause;
  }
}

/**
 * MSG-CC-1 (CMC-18): depth-5 Error.cause walker rendered as
 * `cause: <l1> -> <l2> -> ... [(truncated)]`. Returns `""` when `err` is
 * `undefined` or `null` so callers can compose `body + (trailer === "" ? "" :
 * "\n\n" + trailer)` without extra guards.
 *
 * Walker contract:
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
  const links = [...causeChain(err)];
  // The walk stops either because the chain ended or because it hit the depth
  // bound. Only the second case leaves the LAST yielded link still carrying an
  // onward cause, which is exactly the truncation condition -- so it is read
  // off the walk's result rather than tracked inside a hand-rolled loop.
  const rendered = links.map(linkMessage);
  if (hasOnwardCause(links.at(-1))) {
    rendered[rendered.length - 1] = `${rendered.at(-1)} (truncated)`;
  }

  return `${PREFIX}${rendered.join(JOINER)}`;
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

/**
 * MA-6: stale source clone refusal. The absolute path is the canonical hint.
 *
 * `mpName` (D-48-A / ATTR-07) carries the derived marketplace name so the
 * `marketplace add` entrypoint can render the `(failed) {stale clone}` row on
 * the marketplace SUBJECT (the stale clone is detected post-manifest, so the
 * name is known). Optional to preserve existing two-arg-less call sites.
 */
export class StaleSourceCloneError extends Error {
  readonly absPath: string;
  readonly mpName?: string;
  constructor(absPath: string, mpName?: string) {
    super(`stale source clone at ${absPath}`);
    this.name = "StaleSourceCloneError";
    this.absPath = absPath;
    if (mpName !== undefined) {
      this.mpName = mpName;
    }
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
 * D-48-B: typed marketplace-manifest parse/validation failure.
 *
 * Thrown by `domain/manifest.ts::loadMarketplaceManifestUncached` for BOTH
 * malformed JSON (formerly a bare `SyntaxError` from `JSON.parse`) and a
 * schema-invalid manifest (formerly a bare `Error("marketplace.json schema
 * invalid: ...")`). Giving the failure a typed class lets consumers narrow on
 * `instanceof` instead of substring-matching the message text or sniffing for
 * `SyntaxError`:
 *   - `orchestrators/marketplace/add.ts::classifyAddError` -> `invalid manifest`
 *     (ATTR-07).
 *   - `orchestrators/marketplace/update.ts::reasonsFromCascadeError` ->
 *     `invalid manifest` (ATTR-10), so a path-source manifest failure never
 *     falls back to the lying `network unreachable` default (NFR-5).
 *
 * The original `SyntaxError` (when one originated the failure) is preserved via
 * `Error.cause` so the depth-5 `causeChainTrailer` walker still surfaces the
 * root parse error. The manifest negative-cache (`domain/manifest-cache.ts`)
 * re-throws the SAME instance until the file's (mtimeMs, size) changes -- a
 * typed instance survives that re-throw unchanged (D-48-B A1).
 */
export class InvalidMarketplaceManifestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidMarketplaceManifestError";
  }
}

/**
 * ATTR-07 (D-48-C A3): typed unsupported-source refusal for `marketplace add`.
 *
 * Thrown by `orchestrators/marketplace/add.ts` when the parsed source kind is
 * `"unknown"` or a valid-but-unimplemented kind (`url` / `git-subdir` / `npm`).
 * Giving it a class keeps `classifyAddError` fully `instanceof`-driven so the
 * catch-all default can re-throw genuinely unexpected errors rather than
 * silently labeling them `unsupported source`.
 */
export class UnsupportedSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedSourceError";
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
 * `notify(ctx, NotificationMessage)` path (`shared/notify.ts`).
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
  readonly phase: "skills" | "commands" | "agents" | "hooks" | "mcp";
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
 * CMC-16 / F-5: wrap a thrown value as a `ManualRecoveryError` carrying
 * `leaks`, merging with any leak set the value already carries.
 *
 * Zero leaks is not a manual-recovery condition, so the value passes through
 * (normalized to an `Error`) rather than being promoted. When the value is
 * ALREADY a `ManualRecoveryError` -- a bridge threw one and an orchestrator
 * added its own leaks on top -- the two arrays are `Set`-deduped, which is the
 * F-5 no-double-count invariant: a `rollbackReplacements` cascade can
 * structurally re-report a leak the inner bridge already surfaced, and the
 * user must not be told to clean the same path twice.
 */
export function errorWithManualRecovery(err: unknown, leaks: readonly string[]): Error {
  if (leaks.length === 0) {
    return err instanceof Error ? err : new Error(errorMessage(err));
  }

  if (err instanceof ManualRecoveryError) {
    const merged = Object.freeze([...new Set([...err.leaks, ...leaks])]);
    return new ManualRecoveryError(err.message, merged, { cause: err });
  }

  const base = err instanceof Error ? err : new Error(errorMessage(err));
  return new ManualRecoveryError(base.message, leaks, { cause: base });
}

/**
 * CMC-16 / WR-01: find a `ManualRecoveryError` anywhere in the cause chain.
 *
 * Why a walk and not `instanceof`: `withScopeLock`
 * (`transaction/with-state-guard.ts`) wraps a body-thrown error in a plain
 * `new Error(..., { cause: body })` when BOTH the body throw AND `release`
 * throw. A bare `err instanceof ManualRecoveryError` at the orchestrator catch
 * then sees the plain wrapper and silently downgrades the cascade row's reason
 * from `{rollback partial}` to `{not in manifest}` via the `narrowReason`
 * fallback. Walking `.cause` recovers the class identity the wrapping
 * discarded, so the CMC-16 `failureClass: "manual-recovery"` tag survives the
 * release-also-failed path.
 */
export function findManualRecoveryError(err: unknown): ManualRecoveryError | undefined {
  for (const link of causeChain(err)) {
    if (link instanceof ManualRecoveryError) {
      return link;
    }
  }

  return undefined;
}

/**
 * AS-7: the leaked paths from the first `ManualRecoveryError` in the chain
 * that carries any, so a rendered manual-recovery row can name the files the
 * user must clean up by hand. Empty when the chain holds none.
 *
 * Distinct from `findManualRecoveryError` in its predicate, deliberately: an
 * outer wrapper can be a `ManualRecoveryError` with an EMPTY leak set over an
 * inner one that has the paths, and stopping at the outer would render a
 * manual-recovery row that names no file to recover. The class question and
 * the payload question have different answers on the same chain.
 */
export function manualRecoveryLeaks(err: unknown): readonly string[] {
  for (const link of causeChain(err)) {
    if (link instanceof ManualRecoveryError && link.leaks.length > 0) {
      return link.leaks;
    }
  }

  return [];
}

/**
 * Discriminated typed error for the install / update / remove / reinstall
 * catch sites. Consumers narrow on `kind` instead of parsing free-text
 * `Error.message`.
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
      // SEV-02 / D-69-03: three-way distinction the resolver loses at the
      // throw. `true` when the verdict is `partially-available` (force can
      // degrade-install it), `false` when `unavailable` (structural; force
      // cannot help). The render row points the user at `--partial` iff this
      // is `true`. Does NOT affect `buildPluginShapeMessage` bytes.
      readonly partialable: boolean;
      // IN-02 / RSTATE-05: the resolver's typed `unsupported[]` component-kind
      // list, carried alongside the free-form `reasons`. A partially-available
      // `partially-available` plugin whose only signal is `hooks` carries NO `contains`
      // note (hooks is not an UNSUPPORTED_COMPONENT_KINDS member), so the
      // failure-row composer reads this typed list -- not `reasons` -- to render
      // the same per-kind marker `list`/`info` emit via `narrowUnsupportedKinds`.
      // Empty for `unavailable` (structural) throws. Does NOT affect message bytes.
      readonly unsupportedKinds?: readonly string[];
    }
  | {
      readonly kind: "no-longer-installable";
      readonly plugin: string;
      readonly reasons: readonly string[];
      // SEV-02 / D-69-03: see `not-installable` -- same three-way partial hint.
      readonly partialable: boolean;
      // IN-02 / RSTATE-05: see `not-installable` -- typed unsupported-kind list.
      readonly unsupportedKinds?: readonly string[];
    };

export type PluginShapeErrorKind = PluginShapeErrorShape["kind"];

export class PluginShapeError extends Error {
  /**
   * The full discriminated shape is exposed as a single `readonly` field
   * so consumers narrow on `e.shape.kind` without non-null assertions.
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
