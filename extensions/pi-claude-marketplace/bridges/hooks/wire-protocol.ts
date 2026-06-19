// bridges/hooks/wire-protocol.ts
//
// Wire-protocol parser that maps a child hook process's exit code +
// stdout + stderr to a `HookExecResult` (D-60-01). The Claude-shaped
// stdout JSON contract lives at `docs/research/claude-hook-config-syntax.md
// § 4`; this module is the sole site that knows the field names.
//
// EXEC-03: every diagnostic path here routes through `hookDebugLog`. The
// parser NEVER throws -- malformed JSON, unrecognized shapes, and
// signal-kill exit codes all map to `{ kind: "noop" }` so the dispatch
// reducer cannot crash on bad child output. The permissive default for
// non-zero / non-2 exits is the v1.13 stance (Research Open Q2); a
// future security-default revisit is v1.14+ scope.
//
// Wire-protocol branching:
//   - exit 2          -> block (stderr trimmed as reason)
//   - exit non-zero   -> noop (debug-log)
//   - signal-kill     -> noop (debug-log; `exitCode === null`)
//   - exit 0 + empty  -> noop
//   - exit 0 + non-JSON stdout -> noop (debug-log)
//   - exit 0 + JSON  -> normalize per § 4 (block / mutate / stop / noop)

import { hookDebugLog } from "../../shared/debug-log.ts";

import type { HookExecResult } from "./exec-result.ts";

/**
 * D-60-01 wire-protocol parse. Maps child exit code + stdout + stderr to
 * a `HookExecResult`. Pure function -- no I/O, no side effects beyond
 * `hookDebugLog` on each diagnostic arm. Never throws.
 */
export function parseHookStdout(
  exitCode: number | null,
  stdout: string,
  stderr: string,
): HookExecResult {
  if (exitCode === 2) {
    const reason = stderr.trim();
    return reason === "" ? { kind: "block" } : { kind: "block", reason };
  }

  if (exitCode !== 0) {
    hookDebugLog(
      `wire-protocol: non-zero exit (${exitCode === null ? "signal-kill" : String(exitCode)}); defaulting to noop`,
    );
    return { kind: "noop" };
  }

  const trimmed = stdout.trim();
  if (trimmed === "") {
    return { kind: "noop" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    hookDebugLog(
      `wire-protocol: JSON.parse failed (${err instanceof Error ? err.message : String(err)}); defaulting to noop`,
    );
    return { kind: "noop" };
  }

  return normalizeClaudeStdout(parsed);
}

/**
 * Map a parsed Claude-shaped stdout object to a `HookExecResult` per
 * `docs/research/claude-hook-config-syntax.md § 4`. Unknown root types,
 * unrecognized shapes, and missing fields all fall back to `noop` --
 * the parser is permissive by design (D-60-01 v1.13 stance).
 */
function normalizeClaudeStdout(parsed: unknown): HookExecResult {
  if (parsed === null || typeof parsed !== "object") {
    return { kind: "noop" };
  }

  const obj = parsed as Record<string, unknown>;

  const topLevel = matchTopLevelStopOrBlock(obj);
  if (topLevel !== null) {
    return topLevel;
  }

  const hso = obj.hookSpecificOutput;
  if (hso !== null && typeof hso === "object") {
    const nested = matchHookSpecificOutput(hso as Record<string, unknown>);
    if (nested !== null) {
      return nested;
    }
  }

  if (obj.suppressOutput === true) {
    return { kind: "noop", suppressOutput: true };
  }

  return { kind: "noop" };
}

/**
 * Top-level `continue: false` -> stop; top-level `decision: "block"` ->
 * block. Returns `null` when neither matches.
 */
function matchTopLevelStopOrBlock(obj: Record<string, unknown>): HookExecResult | null {
  if (obj.continue === false) {
    const stopReason = typeof obj.stopReason === "string" ? obj.stopReason : undefined;
    return stopReason === undefined ? { kind: "stop" } : { kind: "stop", stopReason };
  }

  if (obj.decision === "block") {
    const reason = typeof obj.reason === "string" ? obj.reason : undefined;
    return reason === undefined ? { kind: "block" } : { kind: "block", reason };
  }

  return null;
}

/**
 * `hookSpecificOutput.permissionDecision: "deny"` -> block; otherwise
 * accumulate mutate-shaped fields (`updatedInput`, `updatedToolOutput`,
 * `additionalContext`, `permissionDecision: "allow" | "ask"`). Returns
 * `null` when no mutate shape is present so the caller can fall through
 * to the `suppressOutput` / default-noop arms.
 */
function matchHookSpecificOutput(hso: Record<string, unknown>): HookExecResult | null {
  if (hso.permissionDecision === "deny") {
    const reason =
      typeof hso.permissionDecisionReason === "string" ? hso.permissionDecisionReason : undefined;
    return reason === undefined ? { kind: "block" } : { kind: "block", reason };
  }

  return buildMutateFromHso(hso);
}

/**
 * Collect the four mutate-shaped fields from `hookSpecificOutput` into
 * a `mutate` arm. Returns `null` when no field is present so the caller
 * falls through to the noop arms.
 */
function buildMutateFromHso(hso: Record<string, unknown>): HookExecResult | null {
  const mutate: Extract<HookExecResult, { kind: "mutate" }> = { kind: "mutate" };
  let hasMutate = false;

  if (hso.updatedInput !== undefined) {
    mutate.updatedInput = hso.updatedInput;
    hasMutate = true;
  }

  if (hso.updatedToolOutput !== undefined) {
    mutate.updatedToolOutput = hso.updatedToolOutput;
    hasMutate = true;
  }

  if (typeof hso.additionalContext === "string") {
    mutate.additionalContext = hso.additionalContext;
    hasMutate = true;
  }

  if (hso.permissionDecision === "allow" || hso.permissionDecision === "ask") {
    mutate.permissionDecision = hso.permissionDecision;
    if (typeof hso.permissionDecisionReason === "string") {
      mutate.permissionDecisionReason = hso.permissionDecisionReason;
    }

    hasMutate = true;
  }

  return hasMutate ? mutate : null;
}
