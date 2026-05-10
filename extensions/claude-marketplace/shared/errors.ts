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
