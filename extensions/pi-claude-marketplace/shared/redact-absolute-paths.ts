import { CAUSE_CHAIN_MAX_DEPTH, hasOnwardCause, linkMessage } from "./errors.ts";

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
 * Yields each chain link from `error`, stopping at `CAUSE_CHAIN_MAX_DEPTH` or
 * the chain's own end. Reuses `shared/errors.ts`'s `hasOnwardCause` so this
 * walker's cycle guard and onward-cause test can never drift from
 * `causeChainTrailer`'s.
 */
function* causeChainLinks(error: unknown): Generator {
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_CHAIN_MAX_DEPTH; depth++) {
    yield current;
    // `hasOnwardCause` already proved this instanceof check true; repeating
    // it narrows `current` for `.cause` without an `as Error` cast.
    if (!hasOnwardCause(current) || !(current instanceof Error)) {
      return;
    }

    current = current.cause;
  }
}

/**
 * Rebuilds an `Error.cause` chain as plain `Error`s whose messages are
 * `redactAbsolutePaths`-redacted, walking exactly as deep as `causeChainTrailer`
 * (`shared/errors.ts`) does. The two bounds are the same constant on purpose:
 * when the source chain continues past it, the last rebuilt link keeps a real
 * onward cause that the trailer never renders, so a later `causeChainTrailer`
 * pass over the rebuilt chain appends its truncation marker instead of
 * printing that sentinel as a link.
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
export function redactCauseChain(error: unknown): Error | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }

  const links = [...causeChainLinks(error)];
  const truncated = hasOnwardCause(links.at(-1));

  let chain: Error | undefined = truncated
    ? new Error("(cause chain continues beyond the depth bound)")
    : undefined;
  for (const message of links.map((link) => redactAbsolutePaths(linkMessage(link))).reverse()) {
    chain = chain === undefined ? new Error(message) : new Error(message, { cause: chain });
  }

  return chain;
}
