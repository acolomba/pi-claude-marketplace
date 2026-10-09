import { serializeCauseChain } from "./errors.ts";

import type { SerializedCauseChain } from "./errors.ts";

const OMITTED_CAUSE = "Command failure details omitted.";

/** Resolved machine-only facts for an unexpected command failure. */
export interface CommandErrorPresentation {
  readonly kind: "internal-error";
  readonly severity: "error";
  readonly needsReload: boolean;
  readonly summary: "Command failed unexpectedly.";
  readonly cause: SerializedCauseChain;
}

/** Resolves arbitrary thrown values without exposing live errors or local paths. */
export function resolveCommandError(
  cause: unknown,
  needsReload: boolean,
): CommandErrorPresentation {
  return {
    kind: "internal-error",
    severity: "error",
    needsReload,
    summary: "Command failed unexpectedly.",
    cause: resolveCause(cause),
  };
}

function resolveCause(cause: unknown): SerializedCauseChain {
  try {
    const serialized = serializeCauseChain(cause);
    if (serialized === undefined) {
      return { causeChain: ["Unknown thrown value."], truncated: false };
    }

    return {
      causeChain: serialized.causeChain.map((message) => redactCommandPaths(message)),
      truncated: serialized.truncated,
    };
  } catch {
    // Thrown values can expose hostile message, cause, or string-tag accessors.
    return { causeChain: ["Unable to read command failure."], truncated: false };
  }
}

function redactCommandPaths(message: string): string {
  const locations = message.matchAll(/https?:\/\/[^\s"'`<>]+|file:\/|\b[a-z]:[\\/]|[\\/]/gi);
  for (const location of locations) {
    if (/^https?:/i.test(location[0])) {
      continue;
    }

    return redactPathTail(message.slice(0, location.index), message.slice(location.index));
  }

  return message;
}

function redactPathTail(prefix: string, tail: string): string {
  let pathText = tail;
  let suffix = "";
  const quote = prefix.at(-1);
  if (quote === '"' || quote === "'" || quote === "`") {
    const closingQuote = tail.indexOf(quote);
    if (closingQuote === -1) {
      return OMITTED_CAUSE;
    }

    pathText = tail.slice(0, closingQuote);
    suffix = tail.slice(closingQuote);
    // Only a fixed display suffix may survive a quoted path. Arbitrary text
    // after a quote can be part of a filename, including in Node errors.
    if (suffix !== quote && suffix !== `${quote} failed`) {
      return OMITTED_CAUSE;
    }
  }

  // Delimiters and control characters can be filename bytes. Suppress the
  // entire cause when its path cannot be removed without guessing boundaries.
  if (/["'`<>\p{Cc}\p{Zl}\p{Zp}]/u.test(pathText)) {
    return OMITTED_CAUSE;
  }

  return `${prefix}[path]${suffix}`;
}
