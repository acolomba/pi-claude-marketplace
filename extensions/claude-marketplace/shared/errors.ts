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
