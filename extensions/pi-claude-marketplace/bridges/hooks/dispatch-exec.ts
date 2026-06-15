// bridges/hooks/dispatch-exec.ts -- hooks-bridge execution layer
// (EXEC-01..04 + PAYL-01 wiring + HOOK-05 env vars + D-60-01 / D-60-06).
//
// `dispatchHookExec(entry, event, ctx)` is the seam the composite handler
// in `dispatch.ts` fires once per routing-entry that survives the matcher
// filter. The body:
//
//   1. Build a `TranslationContext` from the dispatch-time `ExtensionContext`
//      and select the per-event payload translator keyed by
//      `entry.claudeEvent` (PAYL-01 / D-60-04).
//   2. Serialize the translated payload to JSON, truncating at 256 KB with a
//      top-level `_truncated: true` marker (EXEC-02 stdin cap).
//   3. Prepare the env: `process.env` + `CLAUDE_PROJECT_DIR`,
//      `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` (HOOK-05; containment-
//      guarded via `assertPathInside` per NFR-10) + (SessionStart only)
//      `CLAUDE_ENV_FILE = <dataRoot>/_shared/claude-env-<sessionId>.env`
//      (D-60-06). `CLAUDE_CODE_REMOTE` is intentionally UNSET (Pi runs
//      locally).
//   4. Pick exec-form vs shell-form per EXEC-04: `entry.handlerDecl.args
//      !== undefined` -> `spawn(command, args, { ..., shell: false })`;
//      otherwise -> `spawn(command, [], { ..., shell: entry.handlerDecl.shell
//      ?? true })`. Note: `args: []` is exec-form -- the discriminator is
//      "args defined" not "args non-empty".
//   5. Arm the SIGTERM -> 5s -> SIGKILL ladder (EXEC-02). Attach
//      `child.once("exit", ladder.cancel)` AND `child.once("error",
//      ladder.cancel)` to close the TOCTOU window against the timer
//      firing on a recycled pid.
//   6. Stream stdout / stderr with manual caps (1 MB / 64 KB) -- maxBuffer
//      does NOT apply to `spawn`, so on overflow the dispatcher kills the
//      child and falls back to `{ kind: "noop" }`.
//   7. Stream stdin: attach `child.stdin.on("error", hookDebugLog)` BEFORE
//      `child.stdin.end(payload)` so an EPIPE from a fast-exiting child
//      cannot escape as an unhandled exception.
//   8. On `close`, route stderr through `hookDebugLog` (EXEC-03 sole sink;
//      NO `ctx.ui.notify`) then return `parseHookStdout(code, stdout,
//      stderr)`.
//
// Never-throws contract: every error path resolves to `{ kind: "noop" }` +
// `hookDebugLog`. The outer `try/catch` wraps spawn-time errors (ENOENT,
// containment violation, etc.) so the composite handler reducer never
// crashes against malformed configs.
//
// Whitelist note: this is the second of exactly TWO sanctioned
// `node:child_process` import sites in the extension tree (the first being
// `platform/git-credential.ts`). The architecture-test gate at
// `tests/architecture/no-shell-out.test.ts` enforces the 2-element set;
// adding a third file requires an explicit edit there + an update to the
// sibling "exactly two files" assertion, with justification in the docstring
// header.

import { spawn } from "node:child_process";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

import { locationsFor } from "../../persistence/locations.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { installTimerLadder } from "./exec-timer.ts";
import { translate as translatePostCompact } from "./payloads/post-compact.ts";
import { translate as translatePostToolUseFailure } from "./payloads/post-tool-use-failure.ts";
import { translate as translatePostToolUse } from "./payloads/post-tool-use.ts";
import { translate as translatePreCompact } from "./payloads/pre-compact.ts";
import { translate as translatePreToolUse } from "./payloads/pre-tool-use.ts";
import { translate as translateSessionEnd } from "./payloads/session-end.ts";
import { translate as translateSessionStart } from "./payloads/session-start.ts";
import { translate as translateUserPromptSubmit } from "./payloads/user-prompt-submit.ts";
import { buildTranslationContext, type TranslationContext } from "./translation-context.ts";
import { parseHookStdout } from "./wire-protocol.ts";

import type { RoutingEntry } from "./event-router.ts";
import type { HookExecResult } from "./exec-result.ts";
import type { BucketAEvent } from "../../domain/components/hook-events.ts";
import type { ExtensionContext } from "../../platform/pi-api.ts";

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

/** EXEC-02: default 600s timeout; per-handler `timeout` overrides. */
const DEFAULT_TIMEOUT_MS = 600_000;
/** EXEC-02: stdin payload cap before `_truncated: true` marker injection. */
const STDIN_TRUNCATION_BYTES = 256 * 1024;
/** EXEC-02: hard stdout buffer cap; overflow kills + noop. */
const STDOUT_MAX_BYTES = 1024 * 1024;
/** EXEC-02: hard stderr buffer cap; overflow kills + noop. */
const STDERR_MAX_BYTES = 64 * 1024;

// ──────────────────────────────────────────────────────────────────────────
// Translator dispatch table (PAYL-01 / D-60-04)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Key the 8 per-event translators by `BucketAEvent`. The dispatcher
 * casts the runtime `event: unknown` to the per-translator argument
 * shape at the call site; each translator's typed signature is
 * preserved at compile time, narrowed by the `entry.claudeEvent`
 * discriminator.
 */
const TRANSLATORS: Record<BucketAEvent, (event: never, ctx: TranslationContext) => unknown> = {
  SessionStart: translateSessionStart,
  UserPromptSubmit: translateUserPromptSubmit,
  PreToolUse: translatePreToolUse,
  PostToolUse: translatePostToolUse,
  PostToolUseFailure: translatePostToolUseFailure,
  PreCompact: translatePreCompact,
  PostCompact: translatePostCompact,
  SessionEnd: translateSessionEnd,
};

// ──────────────────────────────────────────────────────────────────────────
// Test seam (mirrors `_setExecutorForTest` in dispatch.ts)
// ──────────────────────────────────────────────────────────────────────────

type SpawnImpl = typeof spawn;
let activeSpawn: SpawnImpl = spawn;

/**
 * Test-only seam: substitute the `spawn` implementation for the duration
 * of a unit test so mock fixtures can pin EXEC-01..04 invariants without
 * touching the real OS. Bridge-internal -- NOT re-exported from
 * `bridges/hooks/index.ts`.
 */
export function _setSpawnForTest(impl: SpawnImpl): void {
  activeSpawn = impl;
}

/** Reset the spawn seam to the production binding. */
export function _resetSpawnForTest(): void {
  activeSpawn = spawn;
}

// ──────────────────────────────────────────────────────────────────────────
// Public surface
// ──────────────────────────────────────────────────────────────────────────

/**
 * EXEC-01..04 + PAYL-01 + HOOK-05 + D-60-01 + D-60-06 execution layer.
 *
 * NEVER throws. Every error / overflow / timeout / parse failure path
 * resolves to `{ kind: "noop" }` + `hookDebugLog`. The composite handler
 * reducer (lands in a follow-up plan) folds the returned arms across the
 * bucket and dispatches to the per-Pi-event adapter (D-60-03).
 */
export async function dispatchHookExec(
  entry: RoutingEntry,
  event: unknown,
  ctx: ExtensionContext,
): Promise<HookExecResult> {
  try {
    const transCtx = buildTranslationContext(ctx);
    const stdinPayload = buildPayload(entry.claudeEvent, event, transCtx);
    const stdinJson = serializeWithTruncation(stdinPayload);
    const env = await prepareEnv(entry, transCtx);
    return await spawnAndCollect(entry, env, stdinJson);
  } catch (err) {
    hookDebugLog(`exec: caught (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`);
    return { kind: "noop" };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Translator dispatch
// ──────────────────────────────────────────────────────────────────────────

function buildPayload(
  claudeEvent: BucketAEvent,
  event: unknown,
  transCtx: TranslationContext,
): unknown {
  const translator = TRANSLATORS[claudeEvent];
  // Defensive narrowing: an unknown event arrives here as `unknown`; the
  // per-translator argument shape was already validated at the dispatch
  // router (composite handler) before fan-out. The `as never` cast is the
  // dispatcher's bridge between the per-event closed set and the
  // translator's typed signature.
  return translator(event as never, transCtx);
}

// ──────────────────────────────────────────────────────────────────────────
// Stdin payload serialization with 256 KB truncation marker
// ──────────────────────────────────────────────────────────────────────────

/**
 * EXEC-02: cap the serialized stdin payload at 256 KB. When the raw JSON
 * exceeds the cap, re-serialize with a top-level `_truncated: true`
 * marker (Research Discretion: top-level placement preferred so a hook
 * author can detect truncation without knowing per-event nesting). The
 * marker takes precedence over the cap -- the JSON with the marker may
 * itself exceed the cap by a few bytes (marker overshoot <= 20 bytes by
 * construction), but the contract is honored.
 *
 * CR-02: cap comparison measures UTF-8 bytes (`Buffer.byteLength(...,
 * "utf8")`), not UTF-16 code units (`String.prototype.length`). For a
 * pure-ASCII payload the two are equal; for CJK / accented / emoji
 * payloads the byte count is 2-4x the code-unit count, so measuring code
 * units would silently relax the documented 256 KB stdin cap.
 *
 * WR-02: the `_truncated: true` marker is assigned LAST so a payload key
 * named `_truncated` cannot override it via spread order (defense in
 * depth; no v1.13 translator emits this key today).
 */
function serializeWithTruncation(payload: unknown): string {
  const raw = JSON.stringify(payload);
  if (Buffer.byteLength(raw, "utf8") <= STDIN_TRUNCATION_BYTES) {
    return raw;
  }

  // Inject the top-level marker by re-wrapping. When the payload is a
  // plain object (the only shape the 8 translators emit), assign the
  // marker AFTER the spread so a payload-supplied `_truncated` key
  // cannot win.
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const marked: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
    marked._truncated = true;
    return JSON.stringify(marked);
  }

  // Defensive arm: non-object payloads (shouldn't happen for v1.13
  // translators) get wrapped under a synthetic envelope so the marker
  // is still observable at the top level.
  return JSON.stringify({ payload, _truncated: true });
}

// ──────────────────────────────────────────────────────────────────────────
// HOOK-05 env construction + D-60-06 _shared CLAUDE_ENV_FILE
// ──────────────────────────────────────────────────────────────────────────

async function prepareEnv(
  entry: RoutingEntry,
  transCtx: TranslationContext,
): Promise<NodeJS.ProcessEnv> {
  const loc = locationsFor(entry.scope, transCtx.cwd);

  const pluginRoot = path.join(loc.extensionRoot, "plugins", entry.pluginId);
  await assertPathInside(loc.extensionRoot, pluginRoot, "CLAUDE_PLUGIN_ROOT");

  const pluginData = path.join(loc.dataRoot, entry.pluginId);
  await assertPathInside(loc.dataRoot, pluginData, "CLAUDE_PLUGIN_DATA");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: transCtx.cwd,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_DATA: pluginData,
  };

  if (entry.claudeEvent === "SessionStart") {
    const envFile = path.join(loc.dataRoot, "_shared", `claude-env-${transCtx.sessionId}.env`);
    await assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE");
    env.CLAUDE_ENV_FILE = envFile;
  }

  // CLAUDE_CODE_REMOTE is intentionally NOT set (HOOK-05 -- Pi runs
  // locally; documented absence is the upstream-parity contract).
  return env;
}

// ──────────────────────────────────────────────────────────────────────────
// Spawn + stream-and-collect
// ──────────────────────────────────────────────────────────────────────────

interface SpawnPlan {
  readonly command: string;
  readonly args: readonly string[];
  readonly shell: boolean | string;
}

/**
 * EXEC-04: `entry.handlerDecl.args !== undefined` -> exec-form
 * `spawn(command, args, { shell: false })`. Otherwise -> shell-form
 * `spawn(command, [], { shell: entry.handlerDecl.shell ?? true })`.
 * `args: []` is the exec-form arm -- the discriminator is "args
 * defined", not "args non-empty".
 */
function planSpawn(entry: RoutingEntry): SpawnPlan {
  const command = entry.handlerDecl.command ?? "";
  const argsField = entry.handlerDecl.args;

  if (Array.isArray(argsField)) {
    const args: string[] = (argsField as readonly unknown[]).map((a): string =>
      typeof a === "string" ? a : JSON.stringify(a),
    );
    return { command, args, shell: false };
  }

  const shellField = entry.handlerDecl.shell;
  const shell: boolean | string = typeof shellField === "string" ? shellField : true;
  return { command, args: [], shell };
}

async function spawnAndCollect(
  entry: RoutingEntry,
  env: NodeJS.ProcessEnv,
  stdinJson: string,
): Promise<HookExecResult> {
  const plan = planSpawn(entry);
  const timeoutMsRaw = entry.handlerDecl.timeout;
  const timeoutMs = typeof timeoutMsRaw === "number" ? timeoutMsRaw : DEFAULT_TIMEOUT_MS;

  const child = activeSpawn(plan.command, [...plan.args], {
    cwd: env.CLAUDE_PROJECT_DIR,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: plan.shell,
  });

  return await new Promise<HookExecResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let overflowed = false;
    let settled = false;

    let ladder = installTimerLadder(child, timeoutMs);

    const settle = (result: HookExecResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      ladder.cancel();
      resolve(result);
    };

    // WR-01 / WR-07: when overflow fires, detach the stream `data`
    // listeners so a child that keeps writing cannot keep growing the
    // accumulator (unbounded heap growth + GC pressure until the SIGKILL
    // tail of the original ladder fires). Also cancel the original
    // SIGTERM/SIGKILL ladder and arm a tight escalation -- the child
    // has demonstrated misbehavior, so SIGTERM fires synchronously and
    // SIGKILL fires after the 5s grace rather than waiting up to
    // `timeoutMs + 5s` (default 605 s) for the original ladder to
    // escalate.
    const handleOverflow = (which: "stdout" | "stderr"): void => {
      if (overflowed) {
        return;
      }

      overflowed = true;
      hookDebugLog(
        `exec: ${which} overflow (${entry.pluginId}/${entry.claudeEvent}); killing child`,
      );
      child.stdout.removeAllListeners("data");
      child.stdout.removeAllListeners("end");
      child.stderr.removeAllListeners("data");
      child.stderr.removeAllListeners("end");
      ladder.cancel();
      // SIGTERM synchronously so observers (and the architecture-test
      // spawn-spy assertion) see the kill request even when the child
      // exits before the next macrotask tick. The fresh ladder still
      // arms the SIGKILL escalation 5s out for a child that ignores
      // SIGTERM.
      if (!child.killed) {
        child.kill("SIGTERM");
      }

      ladder = installTimerLadder(child, 0);
    };

    accumulateStream(
      child.stdout,
      STDOUT_MAX_BYTES,
      (chunk) => {
        stdout += chunk;
      },
      () => {
        handleOverflow("stdout");
      },
    );

    accumulateStream(
      child.stderr,
      STDERR_MAX_BYTES,
      (chunk) => {
        stderr += chunk;
      },
      () => {
        handleOverflow("stderr");
      },
    );

    child.once("error", (err) => {
      hookDebugLog(
        `exec: spawn error (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
      );
      settle({ kind: "noop" });
    });

    child.once("close", (code) => {
      if (overflowed) {
        settle({ kind: "noop" });
        return;
      }

      // EXEC-03: stderr sole-sink through hookDebugLog. NO ctx.ui.notify.
      if (stderr.length > 0) {
        hookDebugLog(`exec: stderr (${entry.pluginId}/${entry.claudeEvent}): ${stderr.trim()}`);
      }

      settle(parseHookStdout(code, stdout, stderr));
    });

    // EPIPE defense: attach the error listener BEFORE write so a child
    // that exits before reading stdin doesn't surface as an unhandled
    // exception. `child.stdin` is non-null because the dispatcher opens
    // stdio: ["pipe", "pipe", "pipe"].
    child.stdin.on("error", (err) => {
      hookDebugLog(
        `exec: stdin error (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
      );
    });
    child.stdin.end(stdinJson);
  });
}

/**
 * WR-05: decode incoming Buffers through a `StringDecoder` so a multi-
 * byte UTF-8 sequence that straddles a chunk boundary is reassembled
 * rather than rendered as `U+FFFD` replacement characters. The decoder's
 * tail (`decoder.end()`) is flushed on stream `end` so any final partial
 * sequence is not silently dropped. Direct per-buffer `chunk.toString
 * ("utf8")` would corrupt non-ASCII strings whose code-point bytes
 * happen to land on a chunk boundary -- the downstream JSON parser
 * (wire-protocol) would silently propagate the U+FFFD into string
 * values without failing `JSON.parse`.
 *
 * CR-02: cap accounting measures UTF-8 bytes (`Buffer.byteLength(...,
 * "utf8")`), not UTF-16 code units (`String.prototype.length`), so the
 * documented "stdout 1 MB / stderr 64 KB" guarantees hold for multi-byte
 * payloads.
 */
function accumulateStream(
  stream: NodeJS.ReadableStream | null,
  cap: number,
  onChunk: (chunk: string) => void,
  onOverflow: () => void,
): void {
  if (stream === null) {
    return;
  }

  const decoder = new StringDecoder("utf8");
  let accumulated = 0;
  stream.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : decoder.write(chunk);
    accumulated += Buffer.byteLength(text, "utf8");
    if (accumulated > cap) {
      onOverflow();
      return;
    }

    onChunk(text);
  });
  stream.on("end", () => {
    const tail = decoder.end();
    if (tail !== "") {
      onChunk(tail);
    }
  });
}
