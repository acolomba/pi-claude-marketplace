import {
  CAUSE_CHAIN_MAX_DEPTH,
  hasOnwardCause,
  linkMessage,
  ManualRecoveryError,
} from "./errors.ts";

/**
 * Collapses absolute paths in diagnostic text to their basenames.
 *
 * Single-segment JSON pointers remain unchanged because a match requires an
 * internal separator after the absolute-path prefix.
 *
 * WR-04: a match may not START immediately after a word character, a colon or
 * a separator, because a URL scheme satisfies both the drive-letter form
 * (`s:/` of `https://`) and the POSIX form (the slashes after it) -- so an
 * unanchored match turned `https://github.com/org/repo.git` into
 * `httprepo.git`, mangling a token that is not a local path at all. The same
 * anchor means a path embedded in a `file://` URL is left alone; nothing in
 * this extension composes one, and a mangled URL is worse for diagnosis than
 * an unredacted one.
 */
export function redactAbsolutePaths(text: string): string {
  const stateLock = text
    .replace(
      /(Another pi-claude-marketplace operation is in progress for (?:user|project) scope \()((?:[A-Za-z]:[\\/]|\\\\(?:\?\\)?|\/).*?[\\/]\.state-lock)(\)\. Retry after it completes\.)/gs,
      (_match: string, prefix: string, lockPath: string, suffix: string) =>
        prefix + pathBasename(lockPath) + suffix,
    )
    .replace(
      /(The (?:user|project) scope state lock \()((?:[A-Za-z]:[\\/]|\\\\(?:\?\\)?|\/).*?[\\/]\.state-lock)(\) was lost before the operation finished\. Run the command again\.)/gs,
      (_match: string, prefix: string, lockPath: string, suffix: string) =>
        prefix + pathBasename(lockPath) + suffix,
    );
  const unquoted = stateLock
    .replace(
      /(\bstate\.json at )((?:[A-Za-z]:[\\/]|\\\\(?:\?\\)?|\/).*?[\\/]state\.json)(?= (?:is not valid JSON|has an unsupported schema version|failed schema validation))/gs,
      (_match: string, prefix: string, filePath: string) => prefix + pathBasename(filePath),
    )
    .replace(
      /(\bFailed to (?:read|write) )((?:[A-Za-z]:[\\/]|\\\\(?:\?\\)?|\/).*?)(?=: )/gs,
      (_match: string, prefix: string, filePath: string) => prefix + pathBasename(filePath),
    );
  // Node errno messages end with one quoted path or two separated by "' -> '".
  // Their paths can contain unescaped quotes followed by spaces or punctuation.
  const diagnostic = unquoted.replace(
    /(\bE[A-Z0-9]+: [^,\r\n]+, [a-z][a-z0-9_]* )'.+'$/s,
    (match: string, prefix: string) => {
      const field = match.slice(prefix.length + 1, -1);
      const paths = /, (?:rename|copyfile|link|symlink) $/.test(prefix)
        ? field.split("' -> '")
        : [field];
      return (
        prefix +
        "'" +
        paths
          .map((filePath) =>
            /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(filePath) ? pathBasename(filePath) : filePath,
          )
          .join("' -> '") +
        "'"
      );
    },
  );
  const quoted = redactQuotedAbsolutePaths(diagnostic);
  const absolutePath =
    /(?<![\w:/\\])(?:[A-Za-z]:[\\/]|\\\\(?:\?\\)?|\/)[\w./\\~-]+[\\/][\w./\\~-]+/g;
  return quoted.replace(absolutePath, (match) => pathBasename(match));
}

function isQuotedPathBoundary(character: string | undefined): boolean {
  return character === undefined || /[\s,;:.)\]}]/u.test(character);
}

function continuesQuotedPath(text: string, quote: string, quoteIndex: number): boolean {
  const nextCharacter = text[quoteIndex + 1];
  if (nextCharacter !== " " && nextCharacter !== "\t") {
    return false;
  }

  const nextQuote = text.indexOf(quote, quoteIndex + 1);
  if (nextQuote < 0 || !isQuotedPathBoundary(text[nextQuote + 1])) {
    return false;
  }

  const continuation = text.slice(quoteIndex + 1, nextQuote);
  return /^[ \t][^'"\r\n]*[/\\]/u.test(continuation);
}

function quotedPathEnd(text: string, quote: string, fromIndex: number): number | undefined {
  let quoteIndex = text.indexOf(quote, fromIndex);
  while (quoteIndex >= 0) {
    if (
      isQuotedPathBoundary(text[quoteIndex + 1]) &&
      !continuesQuotedPath(text, quote, quoteIndex)
    ) {
      return quoteIndex;
    }

    quoteIndex = text.indexOf(quote, quoteIndex + 1);
  }

  return undefined;
}

function redactQuotedAbsolutePaths(text: string): string {
  const opening = /(['"])(?:[A-Za-z]:[\\/]|\\\\|\/)/g;
  let redacted = "";
  let copiedThrough = 0;
  let match = opening.exec(text);
  while (match !== null) {
    const quote = text.charAt(match.index);
    const end = quotedPathEnd(text, quote, opening.lastIndex);
    if (end === undefined) {
      opening.lastIndex = match.index + 1;
      match = opening.exec(text);
      continue;
    }

    const candidate = text.slice(match.index + 1, end);
    if (/^(?:[A-Za-z]:[\\/]|\\\\|\/).*[/\\][^/\\]+$/s.test(candidate)) {
      redacted += text.slice(copiedThrough, match.index) + quote + pathBasename(candidate) + quote;
      copiedThrough = end + 1;
      opening.lastIndex = copiedThrough;
    } else {
      opening.lastIndex = match.index + 1;
    }

    match = opening.exec(text);
  }

  return redacted + text.slice(copiedThrough);
}

/** Takes the last path segment for either filesystem convention. */
function pathBasename(filePath: string): string {
  const lastSeparator = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return lastSeparator < 0 ? filePath : filePath.slice(lastSeparator + 1);
}

/** Redacts a structured leak without guessing where spaces end its path. */
function redactedLeak(leak: string): string {
  return /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(leak) ? pathBasename(leak) : redactAbsolutePaths(leak);
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
 * `redactAbsolutePaths`-redacted. A `ManualRecoveryError` link stays one, with
 * each leaked path redacted the same way, so a redacted row still names what
 * the user must clean up (AS-7, D-PL6-20). The walk goes exactly as deep as
 * `causeChainTrailer` (`shared/errors.ts`) does. The two bounds are the same
 * constant on purpose: when the source chain continues past it, the last
 * rebuilt link keeps a real onward cause that the trailer never renders, so a
 * later `causeChainTrailer` pass over the rebuilt chain appends its truncation
 * marker instead of printing that sentinel as a link.
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
export function redactCauseChain(error: Error): Error;
export function redactCauseChain(error: unknown): Error | undefined;
export function redactCauseChain(error: unknown): Error | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }

  const links = [...causeChainLinks(error)];
  const truncated = hasOnwardCause(links.at(-1));

  let chain: Error | undefined = truncated
    ? new Error("(cause chain continues beyond the depth bound)")
    : undefined;
  links.reverse();
  for (const link of links) {
    const message = redactAbsolutePaths(linkMessage(link));
    const options = chain === undefined ? undefined : { cause: chain };
    chain =
      link instanceof ManualRecoveryError
        ? new ManualRecoveryError(
            message,
            link.leaks.map((leak) => redactedLeak(leak)),
            options,
          )
        : new Error(message, options);
  }

  return chain;
}

/**
 * MIM-03 / D-PL6-12: the undo steps a failed install could not finish, each
 * cause rebuilt through `redactCauseChain` and the raw ledger message dropped,
 * so no row shows an absolute path.
 */
export function redactedRollbackPartials(
  partials: readonly { readonly phase: string; readonly cause?: Error }[],
): { readonly phase: string; readonly cause?: Error }[] {
  return partials.map((partial) => {
    const cause = redactCauseChain(partial.cause);
    return { phase: partial.phase, ...(cause !== undefined && { cause }) };
  });
}

/**
 * MIM-03 / D-PL6-05: splits the undo steps of a failed dependency cascade by
 * the plugin they belong to. The cascade ledger names each of its phases by a
 * member key (`name@marketplace`) and the member's own install ledger names
 * its phases by a bare component, so a phase that holds an `@` and is not the
 * failed dependency's key is the undo of another member that had already been
 * materialized.
 */
export function splitDependencyPartials<P extends { readonly phase: string }>(
  dependencyKey: string,
  partials: readonly P[],
): { readonly dependency: readonly P[]; readonly others: readonly P[] } {
  const isOther = (partial: P): boolean =>
    partial.phase.includes("@") && partial.phase !== dependencyKey;
  return {
    dependency: partials.filter((partial) => !isOther(partial)),
    others: partials.filter(isOther),
  };
}
