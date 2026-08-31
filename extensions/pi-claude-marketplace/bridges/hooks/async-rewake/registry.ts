// extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
//
// Bridge-owned asyncRewake registry. Spawns hook children detached-but-in-
// parent-process-group, holds them in an in-memory Map keyed by a UUID
// dispatchId, watches each child for exit code 2, and on exit-2 injects
// (`rewakeMessage` + body) into Pi's model context via pi.sendMessage with
// `display: false` matching Claude Code's <system-reminder> semantic.
//
// This is the THIRD of exactly THREE sanctioned `node:child_process` import
// sites in the extension tree (closed-set whitelist at
// tests/architecture/no-shell-out.test.ts). Adding a FOURTH site requires
// amending the whitelist set AND the sibling assertion in the SAME commit
// (D-58-01 atomic-supersession). The first two sites are
// platform/git-credential.ts (AUTH-08) and bridges/hooks/dispatch-exec.ts
// (EXEC-01..04 sync path). This site (HOOK-06 / EXEC-05 / D-62-01) diverges
// from the sync site: `detached: false` + the parent does NOT await child
// exit; a per-child handler watches for code 2 and triggers the HOOK-06
// injection contract via `pi.sendMessage({ customType: "claude-hook-rewake",
// display: false, ... }, { deliverAs })`.
//
// Responsibility boundary: this module owns the synchronous spawn +
// register step, the per-child exit handler (HOOK-06 inject + IL-2
// EXEMPTION notify), the `/reload` SIGKILL walk, and the orphan-reap
// pass that drains the persisted PID table at factory entry (D-62-05).
// It does NOT own the dispatcher decision to take the async branch -- the
// composite handler in `dispatch.ts` (wired in a follow-up plan) calls
// `spawnAndRegister` once per `asyncRewake: true` routing entry and
// folds `{ kind: "noop" }` into its reducer.
//
// IL-2 EXEMPTION (T-62-09): the single sanctioned runtime notify call
// in the entire `bridges/hooks/async-rewake/` subtree is the
// `rewakeSummary` surface inside `onChildExit`, routed through
// `notifyAsyncRewakeSummary` in `shared/notify.ts` so the eslint
// `no-restricted-syntax` ctx.ui.notify gate stays GREEN here.
// Runtime notify is otherwise forbidden in bridge code; the exemption
// exists because `rewakeSummary` is the upstream-mandated UI status
// surface declared in the plugin author's hook handler. Every other
// failure / completion path routes through `hookDebugLog` (OBS-01).

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { isDispatchableEvent } from "../../../domain/components/hook-events.ts";
import { hookDebugLog } from "../../../shared/debug-log.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyAsyncRewakeSummary } from "../../../shared/notify.ts";
import { installTimerLadder, type TimerLadder } from "../exec-timer.ts";
import { prepareHookEnv } from "../hook-env.ts";
import { translate as translatePostCompact } from "../payloads/post-compact.ts";
import { translate as translatePostToolUseFailure } from "../payloads/post-tool-use-failure.ts";
import { translate as translatePostToolUse } from "../payloads/post-tool-use.ts";
import { translate as translatePreCompact } from "../payloads/pre-compact.ts";
import { translate as translatePreToolUse } from "../payloads/pre-tool-use.ts";
import { translate as translateSessionEnd } from "../payloads/session-end.ts";
import { translate as translateSessionStart } from "../payloads/session-start.ts";
import { translate as translateStopFailure } from "../payloads/stop-failure.ts";
import { translate as translateStop } from "../payloads/stop.ts";
import { translate as translateUserPromptSubmit } from "../payloads/user-prompt-submit.ts";
import { currentEpoch, type RoutingEntry } from "../routing-state.ts";
import { planSpawn, serializeWithTruncation } from "../spawn-helpers.ts";
import { resolveTimeoutSeconds } from "../timeout.ts";
import { buildTranslationContext, type TranslationContext } from "../translation-context.ts";

import {
  pidTablePath,
  readPidTable,
  unlinkPidTable,
  writePidTable,
  type PidTableEntry,
} from "./pid-table.ts";
import { RingBuffer, STDERR_CAP_BYTES, STDOUT_CAP_BYTES } from "./ring-buffer.ts";

import type { BucketAEvent, DispatchableEvent } from "../../../domain/components/hook-events.ts";
import type { ScopedLocations } from "../../../persistence/locations.ts";
import type { ExtensionAPI, ExtensionContext } from "../../../platform/pi-api.ts";

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-62-05 marker env var. Mirrored into every spawned child's env so the
 * orphan-reap pass can probe `/proc/<pid>/environ` on Linux and refuse
 * to SIGKILL a stranger process that may have inherited a recycled pid.
 */
export const MARKER_ENV = "PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH" as const;

/** HOOK-06: separator between `rewakeMessage` and the captured body. */
const BODY_SEPARATOR = "\n\n";

/** D-62-04: prefix prepended when the ring buffer dropped bytes. */
const TRUNCATED_PREFIX = "[…truncated]\n";

/** HOOK-06: custom-message type for the exit-2 injection. */
const REWAKE_CUSTOM_TYPE = "claude-hook-rewake" as const;

// ──────────────────────────────────────────────────────────────────────────
// Translator dispatch (PAYL-01 reuse; mirrors dispatch-exec.ts)
// ──────────────────────────────────────────────────────────────────────────

const TRANSLATORS: Record<DispatchableEvent, (event: never, ctx: TranslationContext) => unknown> = {
  SessionStart: translateSessionStart,
  UserPromptSubmit: translateUserPromptSubmit,
  PreToolUse: translatePreToolUse,
  PostToolUse: translatePostToolUse,
  PostToolUseFailure: translatePostToolUseFailure,
  PreCompact: translatePreCompact,
  PostCompact: translatePostCompact,
  SessionEnd: translateSessionEnd,
  // Stop / StopFailure never take the async-rewake path (they have no async
  // Pi surface); the entries satisfy the `Record` totality and are inert.
  Stop: translateStop,
  StopFailure: translateStopFailure,
};

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per-child in-memory registry row. Readonly fields are populated at
 * `spawnAndRegister` time and never mutate; the ring-buffer handles ARE
 * mutable internally (write() appends bytes) but the entry's reference
 * to them is fixed.
 */
export interface AsyncRewakeEntry {
  readonly dispatchId: string;
  readonly pid: number;
  readonly scope: "user" | "project";
  readonly marketplace: string;
  readonly pluginId: string;
  readonly claudeEvent: BucketAEvent;
  readonly spawnedAt: string;
  readonly rewakeMessage: string | undefined;
  readonly rewakeSummary: string | undefined;
  readonly child: ChildProcess;
  readonly ladder: TimerLadder;
  readonly stdoutBuffer: RingBuffer;
  readonly stderrBuffer: RingBuffer;
  readonly capturedEpoch: number;
  readonly loc: ScopedLocations;
}

// ──────────────────────────────────────────────────────────────────────────
// Module state
//
// The registry Map, per-table persistence chains, and default orphan probes are
// the only module-level cells left here. The `spawn` implementation and dispatchId generator
// used to be mutable cells behind `_set*ForTest` / `_reset*ForTest` setters;
// both are now parameters (`SpawnDeps` below), which `dispatchHookExec` in
// `dispatch-exec.ts` threads through from its own `deps` argument.
// ──────────────────────────────────────────────────────────────────────────

const asyncRewakeRegistry = new Map<string, AsyncRewakeEntry>();
const pidTableOperations = new Map<string, Promise<void>>();

/**
 * The two process probes the orphan reap needs: a liveness/kill signal and a
 * `/proc/<pid>/environ` reader. Injected rather than called directly so a test
 * can drive the D-62-05 reap deterministically -- SIGKILL against a live
 * stranger pid, and a `/proc` read on a non-Linux host, are both unavailable
 * to a unit test. Production never passes them: `reapOrphans`, `isPidAlive`
 * and `readProcEnvironMarker` all default to `DEFAULT_ORPHAN_PROBES`, and
 * `event-router.ts`'s sole `reapOrphans(loc)` call takes that default.
 *
 * Exported because `reapOrphans` names it in its signature (a caller that
 * substitutes probes has to be able to name the shape it is passing).
 */
export interface OrphanProbes {
  readonly killProbe: (pid: number, sig: number | NodeJS.Signals) => void;
  readonly environReader: (pid: number) => Promise<string>;
}

const DEFAULT_ORPHAN_PROBES: OrphanProbes = {
  killProbe: (pid, sig) => {
    process.kill(pid, sig);
  },
  environReader: (pid) => readFile(`/proc/${pid}/environ`, "utf8"),
};

// ──────────────────────────────────────────────────────────────────────────
// Public surface: spawnAndRegister
// ──────────────────────────────────────────────────────────────────────────

/**
 * Dependencies the spawn path takes from its caller. Both default to the
 * production implementation; tests supply their own instead of rewriting
 * module state.
 */
export interface SpawnDeps {
  readonly spawnImpl?: typeof spawn;
  readonly dispatchId?: () => string;
  readonly pidTableWriter?: typeof writePidTable;
}

/**
 * EXEC-05 / HOOK-06 / D-62-01 spawn + register seam. Resolves once the
 * in-memory entry is recorded AND the PID-table write has been issued;
 * the child's exit is observed asynchronously by the per-child handler
 * installed inside this function. Never throws -- every error arm
 * resolves with `hookDebugLog` so the composite-handler reducer's
 * `{ kind: "noop" }` arm is the only observable downstream effect.
 *
 * The signature accepts the dispatching `pi: ExtensionAPI` alongside
 * `ctx: ExtensionContext` because `sendMessage` lives on `ExtensionAPI`
 * in the installed peer-dep snapshot; passing both lets the exit handler
 * close over `pi.sendMessage` while keeping `notifyAsyncRewakeSummary`
 * (the IL-2-exempt notify seam) and `ctx.isIdle()` available on `ctx`.
 */
export async function spawnAndRegister(
  entry: RoutingEntry,
  event: unknown,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  loc: ScopedLocations,
  deps: SpawnDeps = {},
): Promise<void> {
  const spawnImpl = deps.spawnImpl ?? spawn;
  const makeDispatchId = deps.dispatchId ?? (() => randomUUID());
  const pidTableWriter = deps.pidTableWriter ?? writePidTable;
  // D-87-04: narrow the admitted event to the dispatchable subset before
  // indexing the translator table. `Stop` / `StopFailure` never reach this
  // path -- no Pi event routes them to an async-rewake spawn (their entries in
  // `TRANSLATORS` above are inert) -- so this arm is a defensive belt
  // (debug-log + return), not live behavior.
  if (!isDispatchableEvent(entry.claudeEvent)) {
    hookDebugLog(
      `async-rewake: ${entry.claudeEvent} is admitted but not dispatchable (${entry.pluginId}); skipping spawn`,
    );
    return;
  }

  try {
    const dispatchId = makeDispatchId();
    const capturedEpoch = currentEpoch();
    const transCtx = buildTranslationContext(ctx);
    const stdinPayload = TRANSLATORS[entry.claudeEvent](event as never, transCtx);
    const stdinJson = serializeWithTruncation(stdinPayload);
    const env = await prepareAsyncEnv(entry, transCtx, loc, dispatchId);
    const planValue = planSpawn(entry);
    const timeoutSeconds = resolveTimeoutSeconds({
      raw: entry.handlerDecl.timeout,
      event: entry.claudeEvent,
      pluginId: entry.pluginId,
      // This lane returns as soon as the child is registered, so upstream's
      // turn-blocking reductions do not apply -- see ../timeout.ts.
      lane: "background",
    });

    let child: ChildProcess;
    try {
      child = spawnImpl(planValue.command, [...planValue.args], {
        cwd: env.CLAUDE_PROJECT_DIR,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        shell: planValue.shell,
        detached: false,
      });
    } catch (err) {
      hookDebugLog(
        `async-rewake: spawn threw (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
      );
      return;
    }

    const pid = child.pid;
    if (pid === undefined) {
      hookDebugLog(`async-rewake: child has no pid (${entry.pluginId}/${entry.claudeEvent})`);
      try {
        child.kill("SIGKILL");
      } catch {
        // best-effort
      }

      return;
    }

    const stderrBuffer = new RingBuffer(STDERR_CAP_BYTES);
    const stdoutBuffer = new RingBuffer(STDOUT_CAP_BYTES);
    // Each `ChildProcess` is its own EventEmitter; its lifecycle listeners and
    // the owned-stream listeners live on their respective emitters. Node's default
    // `defaultMaxListeners = 10` applies per-instance, not across the
    // bridge, so no `setMaxListeners` adjustment is needed even for
    // large fan-ins.
    child.stderr?.on("data", (buf: Buffer) => {
      stderrBuffer.write(buf);
    });
    child.stdout?.on("data", (buf: Buffer) => {
      stdoutBuffer.write(buf);
    });

    const ladder = installTimerLadder(
      child,
      timeoutSeconds,
      `${entry.pluginId}/${entry.claudeEvent}`,
    );

    const rewakeMessageField = entry.handlerDecl.rewakeMessage;
    const rewakeSummaryField = entry.handlerDecl.rewakeSummary;
    const asyncEntry: AsyncRewakeEntry = {
      dispatchId,
      pid,
      scope: entry.scope,
      marketplace: entry.marketplace,
      pluginId: entry.pluginId,
      claudeEvent: entry.claudeEvent,
      spawnedAt: new Date().toISOString(),
      rewakeMessage: typeof rewakeMessageField === "string" ? rewakeMessageField : undefined,
      rewakeSummary: typeof rewakeSummaryField === "string" ? rewakeSummaryField : undefined,
      child,
      ladder,
      stdoutBuffer,
      stderrBuffer,
      capturedEpoch,
      loc,
    };

    asyncRewakeRegistry.set(dispatchId, asyncEntry);

    let exitOutcome:
      { readonly code: number | null; readonly signal: NodeJS.Signals | null } | undefined;
    let finalized = false;
    let stderrEnded = child.stderr === null || child.stderr.readableEnded;
    let stdoutEnded = child.stdout === null || child.stdout.readableEnded;

    const finalizeOnce = (
      outcome: { readonly code: number | null; readonly signal: NodeJS.Signals | null } | undefined,
    ): void => {
      if (finalized) {
        return;
      }

      finalized = true;
      finalizeChild(dispatchId, outcome, ctx, pi, pidTableWriter);
    };

    const finalizeAfterOwnedStreams = (): void => {
      if (exitOutcome !== undefined && stdoutEnded && stderrEnded) {
        finalizeOnce(exitOutcome);
      }
    };

    child.stderr?.once("end", () => {
      stderrEnded = true;
      finalizeAfterOwnedStreams();
    });
    child.stdout?.once("end", () => {
      stdoutEnded = true;
      finalizeAfterOwnedStreams();
    });
    child.once("exit", (code, signal) => {
      ladder.cancel();
      exitOutcome = { code, signal };
      finalizeAfterOwnedStreams();
    });
    child.once("close", (code, signal) => {
      ladder.cancel();
      finalizeOnce(exitOutcome ?? { code, signal });
    });
    child.once("error", (err) => {
      ladder.cancel();
      hookDebugLog(`async-rewake: child error dispatchId=${dispatchId}: ${errorMessage(err)}`);
      finalizeOnce(undefined);
    });

    // EPIPE defense: attach the stdin error listener BEFORE the write
    // so a child that exits before reading stdin cannot surface as an
    // unhandled exception. Mirrors the sync dispatch-exec.ts pattern.
    child.stdin?.on("error", (err) => {
      hookDebugLog(
        `async-rewake: stdin error (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
      );
    });
    child.stdin?.end(stdinJson);

    // Persist the PID table snapshot so a parent crash mid-spawn leaves
    // a recoverable record. Fire-and-forget at the body's tail -- the
    // sync spawn + register has already completed; awaiting here only
    // bounds the resolve latency on the I/O.
    await persistPidTableForLoc(loc, pidTableWriter);
  } catch (err) {
    hookDebugLog(
      `async-rewake: spawnAndRegister threw (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Per-child exit / error handlers
// ──────────────────────────────────────────────────────────────────────────

function finalizeChild(
  dispatchId: string,
  outcome: { readonly code: number | null; readonly signal: NodeJS.Signals | null } | undefined,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  pidTableWriter: typeof writePidTable,
): void {
  const entry = asyncRewakeRegistry.get(dispatchId);
  if (entry === undefined) {
    // Defensive guard for cleanup paths that removed the entry before a
    // terminal child event reached this closure.
    return;
  }

  asyncRewakeRegistry.delete(dispatchId);
  void persistPidTableForLoc(entry.loc, pidTableWriter);

  if (outcome === undefined) {
    return;
  }

  const { code, signal } = outcome;

  // D-62-03 / D-59-03 captured-epoch zombie defense. A slow child from
  // a prior `/reload` cycle must not inject into the freshly-hydrated
  // session.
  if (entry.capturedEpoch !== currentEpoch()) {
    hookDebugLog(
      `async-rewake: stale exit from prior load -- dispatchId=${dispatchId} ` +
        `capturedEpoch=${entry.capturedEpoch} currentEpoch=${currentEpoch()}`,
    );
    return;
  }

  // IL-2 EXEMPTION (T-62-09): `rewakeSummary` is the single sanctioned
  // runtime notify call originating from `bridges/hooks/async-rewake/`,
  // routed through the canonical `shared/notify.ts` seam. Fires
  // independently of exit code -- it is the upstream-mandated UI
  // status surface, not a success-only signal.
  if (entry.rewakeSummary !== undefined) {
    try {
      notifyAsyncRewakeSummary(ctx, entry.rewakeSummary);
    } catch (err) {
      hookDebugLog(`async-rewake: notify failed (${entry.pluginId}): ${errorMessage(err)}`);
    }
  }

  if (code !== 2) {
    hookDebugLog(
      `async-rewake: silent completion code=${code ?? "null"} signal=${signal ?? "null"} ` +
        `dispatchId=${dispatchId} plugin=${entry.pluginId}`,
    );
    return;
  }

  const { text: stderrText, truncated: stderrTrunc } = entry.stderrBuffer.read();
  const { text: stdoutText, truncated: stdoutTrunc } = entry.stdoutBuffer.read();
  const body = stderrText.length > 0 ? stderrText : stdoutText;
  if (body.length === 0) {
    hookDebugLog(`async-rewake: exit 2 with empty body -- no injection (${entry.pluginId})`);
    return;
  }

  const truncated = stderrText.length > 0 ? stderrTrunc : stdoutTrunc;
  const content = buildInjectionContent(entry.rewakeMessage, body, truncated);
  const lane: "nextTurn" | "followUp" = ctx.isIdle() ? "nextTurn" : "followUp";

  try {
    pi.sendMessage(
      {
        customType: REWAKE_CUSTOM_TYPE,
        content,
        display: false,
        details: {
          pluginId: entry.pluginId,
          dispatchId,
        },
      },
      { deliverAs: lane },
    );
  } catch (err) {
    hookDebugLog(`async-rewake: sendMessage threw (${entry.pluginId}): ${errorMessage(err)}`);
  }
}

/**
 * Compose the model-visible injection content. The truncated prefix is
 * prepended to the body BEFORE the rewakeMessage join so the marker
 * appears immediately before the surviving (oldest-tail) bytes -- the
 * correct framing for a "we lost some history" disclosure.
 */
function buildInjectionContent(
  rewakeMessage: string | undefined,
  body: string,
  truncated: boolean,
): string {
  const bodyWithMarker = truncated ? `${TRUNCATED_PREFIX}${body}` : body;
  if (rewakeMessage !== undefined && rewakeMessage.length > 0) {
    return `${rewakeMessage}${BODY_SEPARATOR}${bodyWithMarker}`;
  }

  return bodyWithMarker;
}

// ──────────────────────────────────────────────────────────────────────────
// /reload cleanup + orphan reap
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-62-05 `/reload` cleanup walk. Iterates the in-memory registry,
 * cancels each timer ladder, and SIGKILLs each tracked child
 * best-effort. Idempotent: repeated calls on an empty registry are
 * no-ops. The persisted PID table is NOT touched here -- the orphan
 * reap path is responsible for draining that surface.
 */
export function shutdownInMemoryChildren(): void {
  for (const entry of asyncRewakeRegistry.values()) {
    entry.ladder.cancel();
    try {
      entry.child.kill("SIGKILL");
    } catch {
      // best-effort: a child already dead, or a recycled pid, is fine
    }
  }

  asyncRewakeRegistry.clear();
}

/**
 * D-62-05 factory-entry orphan reap. Reads the per-scope PID table;
 * for each recorded PID, probes liveness via `kill(pid, 0)`; on Linux,
 * verifies `/proc/<pid>/environ` carries our marker matching the
 * recorded `dispatchId`; SIGKILLs owned PIDs and soft-skips strangers.
 * On non-Linux, soft-skips every alive PID (the conservative path --
 * NEVER kill a stranger). Always unlinks the PID table at the end so
 * the next process starts from a clean slate.
 *
 * `probes` is the injection point for that walk (see `OrphanProbes`): the
 * production caller in `event-router.ts` passes nothing and gets
 * `DEFAULT_ORPHAN_PROBES`, while a test supplies recording stubs so the
 * kill / marker-match / soft-skip arms are observable without a real child.
 */
export async function reapOrphans(
  loc: ScopedLocations,
  probes: OrphanProbes = DEFAULT_ORPHAN_PROBES,
): Promise<void> {
  await enqueuePidTableOperation(loc, async () => {
    const entries = await readPidTable(loc);
    for (const tableEntry of entries) {
      if (!isPidAlive(tableEntry.pid, probes)) {
        continue;
      }

      if (process.platform === "linux") {
        const marker = await readProcEnvironMarker(tableEntry.pid, probes);
        if (marker !== tableEntry.dispatchId) {
          hookDebugLog(
            `async-rewake: orphan ${tableEntry.pid} marker mismatch -- skipping ` +
              `(got=${marker ?? "(none)"} want=${tableEntry.dispatchId})`,
          );
          continue;
        }
      } else {
        hookDebugLog(
          `async-rewake: orphan ${tableEntry.pid} marker-check skipped (platform=${process.platform})`,
        );
        continue;
      }

      try {
        probes.killProbe(tableEntry.pid, "SIGKILL");
      } catch (err) {
        hookDebugLog(`async-rewake: orphan ${tableEntry.pid} kill failed: ${errorMessage(err)}`);
      }
    }

    await unlinkPidTable(loc);
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers (prepareEnv + persistence + probes)
//
// `planSpawn` and `serializeWithTruncation` live in `../spawn-helpers.ts`
// alongside the synchronous dispatch-exec path; the two execution sites
// share the same `RoutingEntry` shape and the same EXEC-02 stdin cap, so
// keeping a single source of truth prevents the exec-form discriminator
// and the truncation-marker placement from drifting.
// ──────────────────────────────────────────────────────────────────────────

/**
 * HOOK-05 env construction with the asyncRewake marker added on top.
 * Copy of `dispatch-exec.ts:prepareEnv` plus the
 * `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>` entry the
 * orphan-reap probe matches against. A v1.14+ lockstep-helper
 * extraction may consolidate the two if duplication becomes
 * load-bearing.
 *
 * Per-scope `loc` is supplied by the caller rather than derived from
 * `locationsFor(entry.scope, transCtx.cwd)` so user-scope (where `cwd`
 * is irrelevant) and project-scope agree on the same containment root
 * the dispatcher already chose.
 */
async function prepareAsyncEnv(
  entry: RoutingEntry,
  transCtx: TranslationContext,
  loc: ScopedLocations,
  dispatchId: string,
): Promise<NodeJS.ProcessEnv> {
  // The MARKER_ENV stamp is the only per-lane addition: async-rewake tags the
  // spawned child so a later reap can recognise its own dispatch.
  return prepareHookEnv(entry, transCtx, loc, { [MARKER_ENV]: dispatchId });
}

/**
 * Build a snapshot of the persisted PID table from the in-memory
 * registry filtered to the supplied scope/loc. Writes via the
 * `writePidTable` leaf (NFR-1 atomic). Never throws -- the leaf already
 * traps and `hookDebugLog`s its own failures.
 *
 * The shared `_shared/` dir gets a defensive `mkdir({ recursive: true })`
 * indirectly through `atomicWriteJson`'s internal directory creation
 * (verified at shared/atomic-json.ts:25), so a cold-start where the
 * directory does not yet exist is handled without an explicit
 * `ensureSharedDataDir` call here.
 */
function enqueuePidTableOperation(
  loc: ScopedLocations,
  operation: () => Promise<void>,
): Promise<void> {
  const key = pidTablePath(loc);
  const previous = pidTableOperations.get(key) ?? Promise.resolve();
  const operationPromise = previous
    .catch((err: unknown) => {
      hookDebugLog(`async-rewake: prior pid-table operation failed: ${errorMessage(err)}`);
    })
    .then(operation)
    .catch((err: unknown) => {
      hookDebugLog(`async-rewake: pid-table operation failed: ${errorMessage(err)}`);
    });
  const trackedPromise = operationPromise.finally(() => {
    if (pidTableOperations.get(key) === trackedPromise) {
      pidTableOperations.delete(key);
    }
  });

  pidTableOperations.set(key, trackedPromise);
  return trackedPromise;
}

async function persistPidTableForLoc(
  loc: ScopedLocations,
  pidTableWriter: typeof writePidTable = writePidTable,
): Promise<void> {
  await enqueuePidTableOperation(loc, async () => {
    const snapshot: PidTableEntry[] = [];
    for (const entry of asyncRewakeRegistry.values()) {
      if (entry.loc === loc || entry.loc.extensionRoot === loc.extensionRoot) {
        snapshot.push({
          pid: entry.pid,
          dispatchId: entry.dispatchId,
          scope: entry.scope,
          marketplace: entry.marketplace,
          plugin: entry.pluginId,
          spawnedAt: entry.spawnedAt,
        });
      }
    }

    await pidTableWriter(loc, snapshot);
  });
}

/**
 * Probe whether `pid` is alive without delivering a signal. `kill(pid,
 * 0)` returns silently on success, throws ESRCH for a dead/missing pid,
 * and throws EPERM for an alive-but-not-ours pid. EPERM returns `true`
 * because the marker-check step downstream will refuse to SIGKILL a
 * stranger anyway -- the net effect is "alive but won't be touched".
 */
function isPidAlive(pid: number, probes: OrphanProbes = DEFAULT_ORPHAN_PROBES): boolean {
  try {
    probes.killProbe(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ESRCH") {
      return false;
    }

    if (code === "EPERM") {
      return true;
    }

    return false;
  }
}

/**
 * Read the `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` marker from
 * `/proc/<pid>/environ` on Linux. Returns `undefined` on non-Linux, on
 * read failure, or when the marker is absent. Used by `reapOrphans`
 * to confirm a pid actually belongs to a child this extension spawned
 * (defense against pid recycling -- the OS may reuse a numeric pid for
 * an unrelated process between the table write and the reap).
 */
async function readProcEnvironMarker(
  pid: number,
  probes: OrphanProbes = DEFAULT_ORPHAN_PROBES,
): Promise<string | undefined> {
  try {
    const raw = await probes.environReader(pid);
    for (const pair of raw.split("\0")) {
      const eq = pair.indexOf("=");
      if (eq === -1) {
        continue;
      }

      if (pair.slice(0, eq) === MARKER_ENV) {
        return pair.slice(eq + 1);
      }
    }

    return undefined;
  } catch (err) {
    hookDebugLog(`async-rewake: /proc/${pid}/environ read failed: ${errorMessage(err)}`);
    return undefined;
  }
}
