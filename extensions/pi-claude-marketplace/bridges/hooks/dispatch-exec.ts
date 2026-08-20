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
// Whitelist note: this is the second of exactly THREE sanctioned
// `node:child_process` import sites in the extension tree (the first being
// `platform/git-credential.ts`; the third is the async-rewake registry at
// `bridges/hooks/async-rewake/registry.ts`). The architecture-test gate at
// `tests/architecture/no-shell-out.test.ts` enforces the 3-element set;
// adding a fourth file requires an explicit edit there + an update to the
// sibling "exactly three files" assertion, with justification in the
// docstring header.

import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

import { isDispatchableEvent } from "../../domain/components/hook-events.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";

import { spawnAndRegister } from "./async-rewake/registry.ts";
import { installTimerLadder } from "./exec-timer.ts";
import { prepareHookEnv } from "./hook-env.ts";
import { translate as translatePostCompact } from "./payloads/post-compact.ts";
import { translate as translatePostToolUseFailure } from "./payloads/post-tool-use-failure.ts";
import { translate as translatePostToolUse } from "./payloads/post-tool-use.ts";
import { translate as translatePreCompact } from "./payloads/pre-compact.ts";
import { translate as translatePreToolUse } from "./payloads/pre-tool-use.ts";
import { translate as translateSessionEnd } from "./payloads/session-end.ts";
import { translate as translateSessionStart } from "./payloads/session-start.ts";
import { translate as translateStopFailure } from "./payloads/stop-failure.ts";
import { translate as translateStop } from "./payloads/stop.ts";
import { translate as translateUserPromptSubmit } from "./payloads/user-prompt-submit.ts";
import { planSpawn, serializeWithTruncation } from "./spawn-helpers.ts";
import { resolveTimeoutSeconds } from "./timeout.ts";
import { buildTranslationContext, type TranslationContext } from "./translation-context.ts";
import { parseHookStdout } from "./wire-protocol.ts";

import type { SpawnDeps } from "./async-rewake/registry.ts";
import type { HookExecResult } from "./exec-result.ts";
import type { RoutingEntry } from "./routing-state.ts";
import type { DispatchableEvent } from "../../domain/components/hook-events.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

// planSpawn + serializeWithTruncation are shared with
// `async-rewake/registry.ts` via ./spawn-helpers.ts -- both sites build the
// same `child_process.spawn` invocation against the same `RoutingEntry` shape
// and both serialize stdin under the same EXEC-02 cap, so a single source of
// truth keeps the two execution paths from drifting. The cap itself
// (`STDIN_TRUNCATION_BYTES`) is module-private to spawn-helpers.ts, applied
// only inside `serializeWithTruncation`; neither execution site names it.
/** EXEC-02: hard stdout buffer cap; overflow kills + noop. */
const STDOUT_MAX_BYTES = 1024 * 1024;
/** EXEC-02: hard stderr buffer cap; overflow kills + noop. */
const STDERR_MAX_BYTES = 64 * 1024;

// ──────────────────────────────────────────────────────────────────────────
// Translator dispatch table (PAYL-01 / D-60-04)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Key the per-event translators by `DispatchableEvent` (the subset of
 * `BucketAEvent` whose translators are wired; D-87-04). The dispatcher
 * casts the runtime `event: unknown` to the per-translator argument
 * shape at the call site; each translator's typed signature is
 * preserved at compile time, narrowed by the `entry.claudeEvent`
 * discriminator. `Stop` / `StopFailure` receive the synthetic event the
 * settle handler assembles rather than a raw Pi event.
 */
const TRANSLATORS: Record<DispatchableEvent, (event: never, ctx: TranslationContext) => unknown> = {
  SessionStart: translateSessionStart,
  UserPromptSubmit: translateUserPromptSubmit,
  PreToolUse: translatePreToolUse,
  PostToolUse: translatePostToolUse,
  PostToolUseFailure: translatePostToolUseFailure,
  PreCompact: translatePreCompact,
  PostCompact: translatePostCompact,
  SessionEnd: translateSessionEnd,
  Stop: translateStop,
  StopFailure: translateStopFailure,
};

// ──────────────────────────────────────────────────────────────────────────
// Public surface
// ──────────────────────────────────────────────────────────────────────────

/**
 * EXEC-01..04 + PAYL-01 + HOOK-05 + D-60-01 + D-60-06 execution layer.
 *
 * NEVER throws. Every error / overflow / timeout / parse failure path
 * resolves to `{ kind: "noop" }` + `hookDebugLog`. The composite handler
 * reducer folds the returned arms across the bucket and dispatches to the
 * per-Pi-event adapter (D-60-03).
 *
 * `deps` is the spawn injection point, shared verbatim with
 * `spawnAndRegister` (see `SpawnDeps` in `async-rewake/registry.ts`) and
 * forwarded to it unchanged on the async branch. Production callers omit it
 * and take `child_process.spawn` plus `randomUUID`; a test passes a recording
 * stub so the exec arms are observable without spawning anything. Injection is
 * deliberate: CONVENTIONS.md rules out a module-global `_set*ForTest` seam,
 * which is what this parameter replaced.
 */
export async function dispatchHookExec(
  entry: RoutingEntry,
  event: unknown,
  ctx: ExtensionContext,
  pi?: ExtensionAPI,
  deps: SpawnDeps = {},
): Promise<HookExecResult> {
  const spawnImpl = deps.spawnImpl ?? spawn;
  // HOOK-06 / EXEC-05 / D-62-01: asyncRewake delegation. Strict `=== true`
  // discriminator (HOOK-03 lenient stance: any non-`true` value -- including
  // a string `"yes"` -- flows to the sync EXEC-01..04 path). The reducer
  // cannot distinguish a sync `{kind:"noop"}` from this async-spawned
  // `{kind:"noop"}`, so D-60-02 first-block-wins / mutate-compose / stop
  // semantics are preserved across mixed declaration-order interleave
  // (D-62-02). `spawnAndRegister` is itself fire-and-forget -- the
  // spawn + register step is awaited; the child's exit is NOT.
  //
  // `pi` is optional in the signature for in-tree test ergonomics (the
  // 4 pre-existing test harnesses that call `dispatchHookExec` directly
  // never exercise the async arm), but production callers in
  // `dispatch.ts` always thread the live `ExtensionAPI` through. When
  // the async arm fires without `pi`, the registry call is skipped and
  // the noop arm logged -- never throw.
  if (entry.handlerDecl.asyncRewake === true) {
    if (pi === undefined) {
      hookDebugLog(
        `async-rewake: pi missing on async dispatch (${entry.pluginId}/${entry.claudeEvent}); skipping spawn`,
      );
      return { kind: "noop" };
    }

    try {
      const loc = locationsFor(entry.scope, ctx.cwd);
      await spawnAndRegister(entry, event, ctx, pi, loc, deps);
    } catch (err) {
      hookDebugLog(
        `async-rewake: spawnAndRegister threw (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
      );
    }

    return { kind: "noop" };
  }

  // D-87-04: narrow the admitted `BucketAEvent` to the dispatchable subset
  // before indexing the translator tables. Every admitted event now has a
  // translator (`Stop` / `StopFailure` are dispatched here by the settle
  // handler), so this arm is a defensive belt against a future admission that
  // outruns its translator -- log + noop rather than a type error.
  if (!isDispatchableEvent(entry.claudeEvent)) {
    hookDebugLog(
      `exec: ${entry.claudeEvent} is admitted but not dispatchable (${entry.pluginId}); noop`,
    );
    return { kind: "noop" };
  }

  try {
    const transCtx = buildTranslationContext(ctx);
    const stdinPayload = buildPayload(entry.claudeEvent, event, transCtx);
    const stdinJson = serializeWithTruncation(stdinPayload);
    const env = await prepareEnv(entry, transCtx);
    return await spawnAndCollect(entry, env, stdinJson, spawnImpl);
  } catch (err) {
    hookDebugLog(`exec: caught (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`);
    return { kind: "noop" };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Translator dispatch
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per-event required-field set used by `buildPayload`'s defensive runtime
 * probe (WR-03).  The dispatch router upstream (`dispatch.ts` composite
 * handler) already narrows by `entry.claudeEvent`, so this check is a
 * belt-over-suspenders that converts a silent envelope-corruption bug
 * (router lands the wrong event shape on the wrong translator) into an
 * observable `hookDebugLog` signal under
 * `PI_CLAUDE_MARKETPLACE_DEBUG=1`.  The translator still runs after a
 * probe miss so the never-throws contract is preserved -- the goal is
 * diagnostic, not blocking.
 */
const REQUIRED_EVENT_FIELDS: Record<DispatchableEvent, readonly string[]> = {
  SessionStart: [],
  UserPromptSubmit: ["text"],
  PreToolUse: ["toolName", "input"],
  PostToolUse: ["toolName", "input"],
  PostToolUseFailure: ["toolName", "input"],
  PreCompact: [],
  PostCompact: [],
  SessionEnd: [],
  Stop: [],
  StopFailure: [],
};

function buildPayload(
  claudeEvent: DispatchableEvent,
  event: unknown,
  transCtx: TranslationContext,
): unknown {
  const translator = TRANSLATORS[claudeEvent];
  // WR-03: defensive runtime probe.  The `as never` cast crossing the
  // unknown-event boundary is necessary (the per-translator argument
  // shape is per-event and the runtime `event` is `unknown`), but if a
  // future routing bug or a Pi peer-dep shape change lands a wrong-
  // shaped event in the wrong translator, JSON.stringify silently elides
  // the missing fields and the child process receives a partial envelope
  // with no diagnostic.  Probe the required-field set under
  // `PI_CLAUDE_MARKETPLACE_DEBUG=1` so a corrupted envelope is at least
  // observable in the debug seam.  The translator still runs after a
  // miss -- the never-throws contract is preserved (the user-visible
  // surface is a translator-emitted JSON envelope; a missing field is
  // not the bridge's problem to refuse).
  const required = REQUIRED_EVENT_FIELDS[claudeEvent];
  if (event === null || typeof event !== "object") {
    hookDebugLog(
      `buildPayload: ${claudeEvent} event is ${event === null ? "null" : typeof event}, not an object; partial envelope likely`,
    );
  } else if (required.length > 0) {
    const obj = event as Record<string, unknown>;
    for (const field of required) {
      if (!(field in obj)) {
        hookDebugLog(
          `buildPayload: ${claudeEvent} event missing required field "${field}"; partial envelope likely`,
        );
      }
    }
  }

  return translator(event as never, transCtx);
}

// ──────────────────────────────────────────────────────────────────────────
// HOOK-05 env construction + D-60-06 _shared CLAUDE_ENV_FILE
// ──────────────────────────────────────────────────────────────────────────

async function prepareEnv(
  entry: RoutingEntry,
  transCtx: TranslationContext,
): Promise<NodeJS.ProcessEnv> {
  return prepareHookEnv(entry, transCtx, locationsFor(entry.scope, transCtx.cwd));
}

// ──────────────────────────────────────────────────────────────────────────
// Spawn + stream-and-collect
// ──────────────────────────────────────────────────────────────────────────

async function spawnAndCollect(
  entry: RoutingEntry,
  env: NodeJS.ProcessEnv,
  stdinJson: string,
  spawnImpl: typeof spawn = spawn,
): Promise<HookExecResult> {
  const plan = planSpawn(entry);
  const timeoutSeconds = resolveTimeoutSeconds({
    raw: entry.handlerDecl.timeout,
    event: entry.claudeEvent,
    pluginId: entry.pluginId,
    // This lane awaits the child, so the turn waits with it.
    lane: "blocking",
  });
  const ladderLabel = `${entry.pluginId}/${entry.claudeEvent}`;

  const child = spawnImpl(plan.command, [...plan.args], {
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

    let ladder = installTimerLadder(child, timeoutSeconds, ladderLabel);

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
    // `timeoutSeconds + 5s` (605 s on most events, less on the ones
    // `./timeout.ts` lowers) for the original ladder to escalate.
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

      // 0 seconds: SIGTERM already went out synchronously above. The fresh
      // ladder re-sends it immediately (harmless) and, five seconds later,
      // escalates to SIGKILL for a child that ignored it.
      ladder = installTimerLadder(child, 0, ladderLabel);
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
