import { serializeCauseChain } from "./errors.ts";

import type { SerializedCauseChain } from "./errors.ts";

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
  let quoted = message;
  for (const quote of ['"', "'", "`"]) {
    const quotedPath = new RegExp(
      `${quote}(?:file:/|[a-z]:[\\\\/]|\\\\\\\\|/)[^${quote}\\r\\n]*${quote}`,
      "gi",
    );
    quoted = quoted.replace(quotedPath, `${quote}[path]${quote}`);
  }

  // Unquoted paths can contain spaces. Mask through the next delimiter rather
  // than retain a suffix that could still name a private directory or file.
  // HTTP(S) URLs stay readable. Other prefixes cannot exempt a local path.
  return quoted.replace(
    /(https?:\/\/[^\s"'`<>]+)|(?:file:\/|\b[a-z]:[\\/]|\\\\|\/)[^\r\n"'`<>]*/gi,
    (_match, remoteUrl: string | undefined) => remoteUrl ?? "[path]",
  );
}
