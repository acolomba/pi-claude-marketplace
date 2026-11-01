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
// fold cannot crash on bad child output.
//
// Wire-protocol branching (D-CF5-11, as Claude Code 2.1.316 reads a hook):
//   - exit 2          -> block; the reason is the stdout JSON's block or
//                        deny reason when it prints one, else the trimmed
//                        stderr, marked `fromStderr`
//   - exit non-zero   -> the stdout JSON object decides, as on exit 0, when
//                        stdout is one; else noop (debug-log)
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
    return exitTwoBlock(stdout, stderr);
  }

  if (exitCode !== 0) {
    return nonZeroExitResult(exitCode, stdout);
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

// The stdout JSON object a hook printed, or `undefined` when stdout is empty,
// not JSON, or JSON that is not an object. Quiet: the callers log the outcome.
function stdoutObject(stdout: string): object | undefined {
  try {
    const parsed: unknown = JSON.parse(stdout.trim());
    return parsed !== null && typeof parsed === "object" ? parsed : undefined;
  } catch {
    // Not JSON: the caller falls back to stderr or to noop.
    return undefined;
  }
}

/**
 * D-CF5-11: exit 2 blocks. The reason is the block or deny reason of the
 * stdout JSON when the hook printed one, else the trimmed stderr, which the
 * `fromStderr` marker labels so the adapter can show it after the hook's
 * command, as Claude Code does.
 */
function exitTwoBlock(stdout: string, stderr: string): HookExecResult {
  const parsed = stdoutObject(stdout);
  const decided = parsed === undefined ? undefined : normalizeClaudeStdout(parsed);
  if (decided?.kind === "block" && decided.reason !== undefined) {
    return { kind: "block", reason: decided.reason };
  }

  const reason = stderr.trim();
  return reason === ""
    ? { kind: "block", fromStderr: true }
    : { kind: "block", reason, fromStderr: true };
}

/**
 * D-CF5-11 / E15: on an exit other than 0 and 2, Claude Code ignores the exit
 * code when stdout is a JSON object, and its fields alone decide. A signal
 * kill, and plain or broken stdout, are a non-blocking error: noop.
 */
function nonZeroExitResult(exitCode: number | null, stdout: string): HookExecResult {
  const exit = exitCode === null ? "signal-kill" : String(exitCode);
  const parsed = exitCode === null ? undefined : stdoutObject(stdout);
  if (parsed === undefined) {
    hookDebugLog(`wire-protocol: non-zero exit (${exit}); defaulting to noop`);
    return { kind: "noop" };
  }

  hookDebugLog(`wire-protocol: non-zero exit (${exit}); applying its JSON output`);
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
