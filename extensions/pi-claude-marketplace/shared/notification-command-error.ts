import { serializeCauseChain } from "./errors.ts";
import { redactAbsolutePaths } from "./redact-absolute-paths.ts";

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
      causeChain: serialized.causeChain.map((message) =>
        redactAbsolutePaths(message.replace(/file:\/+[^\s"'<>]+|\\\\[^\s"'<>]+/gi, "[path]")),
      ),
      truncated: serialized.truncated,
    };
  } catch {
    // Thrown values can expose hostile message, cause, or string-tag accessors.
    return { causeChain: ["Unable to read command failure."], truncated: false };
  }
}
