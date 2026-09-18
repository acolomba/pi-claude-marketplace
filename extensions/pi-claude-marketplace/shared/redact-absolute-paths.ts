/**
 * Collapses absolute paths in diagnostic text to their basenames.
 *
 * Single-segment JSON pointers remain unchanged because a match requires an
 * internal separator after the absolute-path prefix.
 */
export function redactAbsolutePaths(text: string): string {
  const absolutePath = /(?:[A-Za-z]:[\\/]|\\\\\?\\|\/)[\w./\\~-]+[\\/][\w./\\~-]+/g;
  return text.replace(absolutePath, (match) => {
    const lastSeparator = Math.max(match.lastIndexOf("/"), match.lastIndexOf("\\"));
    return lastSeparator < 0 ? match : match.slice(lastSeparator + 1);
  });
}

/**
 * Depth bound mirrored from `shared/errors.ts`'s module-private
 * `CAUSE_CHAIN_MAX_DEPTH` (T-13-04 DoS mitigation), copied rather than
 * imported since the source constant is not exported there. Keeps this
 * walker's cap in lockstep with `causeChainTrailer`'s own cap, so a chain
 * longer than the bound reports truncated the same way here as it would
 * there.
 */
const CAUSE_CHAIN_MAX_DEPTH = 5;

/**
 * Whether a chain link is an `Error` carrying a further, non-self-referencing
 * cause. Mirrors `shared/errors.ts`'s module-private `hasOnwardCause`.
 */
function hasOnwardCause(err: unknown): err is Error {
  return err instanceof Error && err.cause !== undefined && err.cause !== err;
}

/**
 * One link's display text. Mirrors `shared/errors.ts`'s module-private
 * `linkMessage` for the `Error` and non-`Error` arms (an `Error` renders its
 * message, a string renders verbatim, anything else renders through
 * `Object.prototype.toString`); the `CleanupContextError`-specific arm is not
 * reproduced here, since a dependency's ledger failure never carries one.
 */
function linkText(link: unknown): string {
  if (link instanceof Error) {
    return link.message;
  }

  if (typeof link === "string") {
    return link;
  }

  return Object.prototype.toString.call(link);
}

/** Yields each chain link from `error`, stopping at `maxDepth` or the chain's own end. */
function* causeChainLinks(error: unknown, maxDepth: number): Generator {
  let current: unknown = error;
  for (let depth = 0; depth < maxDepth; depth++) {
    yield current;
    if (!hasOnwardCause(current)) {
      return;
    }

    current = current.cause;
  }
}

/**
 * Rebuilds an `Error.cause` chain as plain `Error`s whose messages are
 * `redactAbsolutePaths`-redacted, walking no deeper than `causeChainTrailer`
 * (`shared/errors.ts`) would. When the source chain continues past the depth
 * bound, the last rebuilt link keeps a real (never-rendered) onward cause, so
 * a later `causeChainTrailer` pass over the rebuilt chain still appends its
 * truncation marker.
 *
 * T-55-02-02 / T-53-02-02: `causeChainTrailer` walks `.cause` without
 * redacting, so a nested cause carrying an absolute path (e.g. a
 * dependency's own ledger failure, RESV-06) must be rebuilt through this
 * helper before it rides a user-visible row -- see
 * `orchestrators/reconcile/apply.ts`.
 *
 * Returns `undefined` for a `null`/`undefined` `error` so callers can spread
 * `{ cause: redactCauseChain(x) }` only when `x` is present
 * (`exactOptionalPropertyTypes`).
 */
export function redactCauseChain(
  error: unknown,
  maxDepth: number = CAUSE_CHAIN_MAX_DEPTH,
): Error | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }

  const links = [...causeChainLinks(error, maxDepth)];
  const truncated = hasOnwardCause(links.at(-1));

  let chain: Error | undefined = truncated
    ? new Error("(cause chain continues beyond the depth bound)")
    : undefined;
  for (const message of links.map((link) => redactAbsolutePaths(linkText(link))).reverse()) {
    chain = chain === undefined ? new Error(message) : new Error(message, { cause: chain });
  }

  return chain;
}
