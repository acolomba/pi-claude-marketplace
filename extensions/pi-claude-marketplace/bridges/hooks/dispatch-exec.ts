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
//      "args defined" not "args non-empty". The exec form gets the three
//      path variables substituted into `command` and `args` (D-CF5-15).
//   5. Arm the SIGTERM -> 5s -> SIGKILL ladder (EXEC-02). `ladder.cancel()`
//      runs from the shared `settle()` closure, which both `child.once(
//      "close", ...)` and `child.once("error", ...)` call, to close the
//      TOCTOU window against the timer firing on a recycled pid.
//   6. Collect the whole of stdout and stderr through `./stream-text.ts`. As
//      in Claude Code, no size limit applies, so a JSON answer of any size
//      decides (EXEC-02).
//   7. Stream stdin: attach `child.stdin.on("error", hookDebugLog)` BEFORE
//      `child.stdin.end(payload)` so an EPIPE from a fast-exiting child
//      cannot escape as an unhandled exception.
//   8. On `close`, route stderr through `hookDebugLog` (EXEC-03 sole sink;
//      NO `ctx.ui.notify`) then return `parseHookStdout(code, stdout,
//      stderr, entry.claudeEvent)`, unless the hook failed and sets `onFailure: "block"`
//      (D-CF5-18, `./on-failure.ts`): then a start failure (`error`), an exit
//      other than 0 and 2, a timeout, or broken JSON stdout is a block. A JSON
//      deny still wins over that block.
//
// Never-throws contract: every error path resolves to `{ kind: "noop" }` +
// `hookDebugLog`, or to the onFailure block when the hook asks for one. The
// outer `try/catch` wraps setup and spawn-time errors (ENOENT, containment
// violation, etc.) so the composite handler never crashes against malformed
// configs; a hook that cannot start blocks under `onFailure: "block"`.
//
// Whitelist note: this is one of exactly FIVE sanctioned
// `node:child_process` import sites in the extension tree (the others are
// `platform/git-credential.ts`, the async-rewake registry at
// `bridges/hooks/async-rewake/registry.ts`, `platform/package-manager.ts`,
// and `platform/prompt-shell.ts`).
// The architecture-test gate at `test/architecture/no-shell-out.test.ts`
// enforces the 5-element set; adding a sixth file requires an explicit edit
// there + an update to the sibling "exactly five files" assertion, with
// justification in the docstring header.

import { spawn } from "node:child_process";

import { locationsFor } from "../../persistence/locations.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";

import { spawnAndRegister } from "./async-rewake/registry.ts";
import { installTimerLadder } from "./exec-timer.ts";
import { hookPathVars, prepareHookEnv } from "./hook-env.ts";
import { onFailureBlock } from "./on-failure.ts";
import { translatePostCompact } from "./payloads/post-compact.ts";
import { translatePostToolUseFailure } from "./payloads/post-tool-use-failure.ts";
import { translatePostToolUse } from "./payloads/post-tool-use.ts";
import { translatePreCompact } from "./payloads/pre-compact.ts";
import { translatePreToolUse } from "./payloads/pre-tool-use.ts";
import { translateSessionEnd } from "./payloads/session-end.ts";
import { translateSessionStart } from "./payloads/session-start.ts";
import { translateStopFailure } from "./payloads/stop-failure.ts";
import { translateStop } from "./payloads/stop.ts";
import { translateUserPromptSubmit } from "./payloads/user-prompt-submit.ts";
import { planSpawn, serializeWithTruncation } from "./spawn-helpers.ts";
import { collectStreamText } from "./stream-text.ts";
import { resolveTimeoutSeconds } from "./timeout.ts";
import { buildTranslationContext, type TranslationContext } from "./translation-context.ts";
import { parseHookStdout } from "./wire-protocol.ts";

import type { SpawnDeps } from "./async-rewake/registry.ts";
import type { HookExecResult } from "./exec-result.ts";
import type { RoutingEntry } from "./routing-state.ts";
import type { HooksRuntime } from "./runtime.ts";
import type { DispatchableEvent } from "../../domain/components/hook-events.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { ClaudePluginVars } from "../../shared/vars.ts";

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
 * NEVER throws. Every error / timeout / parse failure path resolves to
 * `{ kind: "noop" }` + `hookDebugLog`, except that a hook with
 * `onFailure: "block"` turns a start failure, an unexpected exit, a timeout,
 * or broken JSON stdout into a block (D-CF5-18). The composite handler
 * runs the bucket in parallel, folds the returned arms in
 * routing order (D-CF5-09), and dispatches to the per-Pi-event adapter
 * (D-60-03).
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
  pi: ExtensionAPI | undefined,
  runtime: HooksRuntime,
  deps: SpawnDeps = {},
): Promise<HookExecResult> {
  const spawnImpl = deps.spawnImpl ?? spawn;
  // HOOK-06 / EXEC-05 / D-62-01 / D-BG-205: background delegation of an
  // `asyncRewake` or a plain `async` hook, which Claude Code runs in the
  // background, so its exit code and decisions decide nothing. Strict `=== true`
  // discriminator (HOOK-03 lenient stance: any non-`true` value -- including
  // a string `"yes"` -- flows to the sync EXEC-01..04 path). The fold
  // cannot distinguish a sync `{kind:"noop"}` from this async-spawned
  // `{kind:"noop"}`, so the D-CF5-09 fold (stop, then first block, then first
  // ask, then mutation) is preserved across mixed declaration-order interleave
  // (D-62-02). `spawnAndRegister` is itself fire-and-forget -- the
  // spawn + register step is awaited; the child's exit is NOT.
  //
  // `pi` is optional in the signature for in-tree test ergonomics (the
  // 4 pre-existing test harnesses that call `dispatchHookExec` directly
  // never exercise the async arm), but production callers in
  // `dispatch.ts` always thread the live `ExtensionAPI` through. When
  // the async arm fires without `pi`, the registry call is skipped and
  // the noop arm logged -- never throw.
  if (entry.handlerDecl.asyncRewake === true || entry.handlerDecl.async === true) {
    if (pi === undefined) {
      hookDebugLog(
        `async-rewake: pi missing on async dispatch (${entry.pluginId}/${entry.claudeEvent}); skipping spawn`,
      );
      return { kind: "noop" };
    }

    try {
      const loc = locationsFor(entry.scope, ctx.cwd);
      await spawnAndRegister(runtime, entry, event, ctx, pi, loc, deps);
    } catch (err) {
      hookDebugLog(
        `async-rewake: spawnAndRegister threw (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
      );
    }

    return { kind: "noop" };
  }

  try {
    const transCtx = buildTranslationContext(ctx);
    const stdinPayload = buildPayload(entry.claudeEvent, event, transCtx);
    const stdinJson = serializeWithTruncation(stdinPayload);
    const loc = locationsFor(entry.scope, transCtx.cwd);
    const env = await prepareHookEnv(entry, transCtx, loc);
    const vars = hookPathVars(entry, transCtx, loc);
    return await spawnAndCollect(entry, vars, env, stdinJson, spawnImpl);
  } catch (err) {
    hookDebugLog(`exec: caught (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`);
    // D-CF5-18: a hook that cannot start blocks when it sets onFailure "block".
    // The cause goes in as stderr, so the block reason ends with it.
    const noop: HookExecResult = { kind: "noop" };
    return (
      onFailureBlock(
        entry,
        {
          startFailed: true,
          timedOut: false,
          exitCode: null,
          stdout: "",
          stderr: redactAbsolutePaths(errorMessage(err)),
        },
        noop,
      ) ?? noop
    );
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
// Spawn + stream-and-collect
// ──────────────────────────────────────────────────────────────────────────

async function spawnAndCollect(
  entry: RoutingEntry,
  vars: ClaudePluginVars,
  env: NodeJS.ProcessEnv,
  stdinJson: string,
  spawnImpl: typeof spawn = spawn,
): Promise<HookExecResult> {
  const plan = planSpawn(entry, vars);
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
    let settled = false;

    const ladder = installTimerLadder(child, timeoutSeconds, ladderLabel);

    const settle = (result: HookExecResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      ladder.cancel();
      resolve(result);
    };

    const stdout = collectStreamText(child.stdout, (err) => {
      hookDebugLog(`exec: stdout error (${ladderLabel}): ${errorMessage(err)}`);
    });
    const stderr = collectStreamText(child.stderr, (err) => {
      hookDebugLog(`exec: stderr error (${ladderLabel}): ${errorMessage(err)}`);
    });

    child.once("error", (err) => {
      hookDebugLog(
        `exec: spawn error (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
      );
      // D-CF5-18: a hook that cannot start blocks when it sets onFailure "block".
      const noop: HookExecResult = { kind: "noop" };
      const failure = onFailureBlock(
        entry,
        { startFailed: true, timedOut: false, exitCode: null, stdout: "", stderr: stderr.text() },
        noop,
      );
      settle(failure ?? noop);
    });

    child.once("close", (code) => {
      const errText = stderr.text();
      // EXEC-03: stderr sole-sink through hookDebugLog. NO ctx.ui.notify.
      if (errText.length > 0) {
        hookDebugLog(`exec: stderr (${entry.pluginId}/${entry.claudeEvent}): ${errText.trim()}`);
      }

      const outText = stdout.text();
      const parsed = parseHookStdout(code, outText, errText, entry.claudeEvent);
      // D-CF5-18: a failed hook that sets onFailure "block" blocks whatever its
      // stdout says, except that a JSON deny keeps its own reason.
      const failure = onFailureBlock(
        entry,
        {
          startFailed: false,
          timedOut: ladder.fired(),
          exitCode: code,
          stdout: outText,
          stderr: errText,
        },
        parsed,
      );
      settle(failure ?? parsed);
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
