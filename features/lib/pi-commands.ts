/**
 * @fileoverview Runs `/claude:plugin` commands and new sessions in the run's headless Pi.
 *
 * In RPC mode the extension appends each result as a `claude-plugin` custom
 * entry (JOUT-01), so a step reads structured payloads and never parses
 * text. A command, or a new session, returns every payload it emits, in
 * emission order, each validated against the published payload schema
 * (DRV-01). State persists between commands through the sandbox directories,
 * as it does between two Pi sessions of one user. A plain message returns the
 * payloads that follow it in the session, such as a background update's.
 */

import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  CASCADE_PAYLOAD_SCHEMA,
  NOTIFICATION_PAYLOAD_SCHEMA,
} from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";

import type { PiProcess, RpcExchange } from "./pi-process.ts";

/** Any payload a command can emit, told apart by its `kind`. */
export type NotificationPayload = Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA>;

/** The payload of most plugin and marketplace commands. */
export type CascadePayload = Type.Static<typeof CASCADE_PAYLOAD_SCHEMA>;

/** One skill a new session offers as a `/skill:<name>` command. */
export interface OfferedSkill {
  readonly command: string;
  readonly description: string;
}

/** What a new session offers and the payloads it emits, such as its reconcile report. */
export interface SessionReport {
  readonly skills: readonly OfferedSkill[];
  readonly payloads: readonly NotificationPayload[];
}

const PAYLOAD_VALIDATOR = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

// The part of Pi's `get_commands` response that the skill steps read.
const COMMANDS_VALIDATOR = Compile(
  Type.Object({
    success: Type.Literal(true),
    data: Type.Object({
      commands: Type.Array(
        Type.Object({ name: Type.String(), description: Type.String(), source: Type.String() }),
      ),
    }),
  }),
);

// The part of one session entry that the session payloads come from.
const SESSION_ENTRY = Type.Object({
  type: Type.String(),
  customType: Type.Optional(Type.String()),
  data: Type.Optional(Type.Unknown()),
});

type SessionEntry = Type.Static<typeof SESSION_ENTRY>;

// The part of Pi's `get_entries` response that the session payloads come from.
const ENTRIES_VALIDATOR = Compile(
  Type.Object({
    success: Type.Literal(true),
    data: Type.Object({ entries: Type.Array(SESSION_ENTRY) }),
  }),
);

// The sandbox Pi waits no delay before the background update, so the wait
// covers the marketplace refresh, the plugin updates, and the quiet window
// below. It stays below the 30-second step timeout, so a missing result fails
// with its own message.
const BACKGROUND_RESULT_TIMEOUT_MS = 20_000;

const BACKGROUND_RESULT_POLL_MS = 100;

// The first payload after the message does not mean that the background
// update has finished, so the driver reads on until the payload count has
// stayed the same for this long. A later payload, such as a second notice,
// then reaches the step instead of being dropped (DRV-01).
const BACKGROUND_RESULT_QUIET_MS = 1_000;

// What a request reports beyond its own result: neither an extension error
// nor a dialog is ever expected.
function assertQuiet(exchange: RpcExchange): void {
  assert.deepStrictEqual(
    { extensionErrors: exchange.extensionErrors, dialogs: exchange.dialogs },
    { extensionErrors: [], dialogs: [] },
  );
}

// The extension's payloads among `entries`, each valid against the payload
// schema (DRV-01).
function claudePluginPayloads(
  entries: ReadonlyArray<{ readonly customType?: string; readonly data?: unknown }>,
): NotificationPayload[] {
  return entries
    .filter((entry) => entry.customType === "claude-plugin")
    .map(({ data: payload }) => {
      assert.ok(
        PAYLOAD_VALIDATOR.Check(payload),
        JSON.stringify(PAYLOAD_VALIDATOR.Errors(payload)),
      );
      return payload;
    });
}

// The custom entries of the current session of `pi`, in session order: the
// entries the extension appends its payloads as.
async function readCustomEntries(pi: PiProcess): Promise<readonly SessionEntry[]> {
  const read = await pi.request({ type: "get_entries" });
  assertQuiet(read);
  const entries = read.response;
  assert.ok(ENTRIES_VALIDATOR.Check(entries), JSON.stringify(ENTRIES_VALIDATOR.Errors(entries)));
  return entries.data.entries.filter((entry) => entry.type === "custom");
}

/**
 * Runs `command` as a prompt in `pi`. Asserts that Pi handled it as an
 * extension command and that it emitted at least one payload, each valid
 * against the payload schema, and returns them all in emission order. None is
 * dropped, merged, or reordered, so an extra or a missing payload reaches the
 * step that reads them (DRV-01).
 */
export async function runCommandPayloads(
  pi: PiProcess,
  command: string,
): Promise<readonly NotificationPayload[]> {
  const exchange = await pi.request({ type: "prompt", message: command });
  assertQuiet(exchange);
  assert.deepStrictEqual(exchange.response.data, { disposition: "handled" }, command);
  const payloads = claudePluginPayloads(exchange.entries);
  assert.notDeepStrictEqual(payloads, [], `${command} emitted no claude-plugin payload`);
  return payloads;
}

/**
 * Runs `command` as `runCommandPayloads` does, asserts that it emitted exactly
 * one payload and that the payload is a cascade, and returns it.
 */
export async function runCommand(pi: PiProcess, command: string): Promise<CascadePayload> {
  const payloads = await runCommandPayloads(pi, command);
  const [payload] = payloads;
  if (payloads.length !== 1 || payload?.kind !== "cascade") {
    assert.fail(`${command} did not emit exactly one cascade: ${JSON.stringify(payloads)}`);
  }

  return payload;
}

/**
 * Starts a new session in `pi` and returns what `readSession` reads from it.
 * A new session rebuilds the extension runtime and discovers its resources
 * again, which is what makes installed plugins visible, as `/reload` does.
 */
export async function startSession(pi: PiProcess): Promise<SessionReport> {
  const started = await pi.request({ type: "new_session" });
  assertQuiet(started);
  assert.deepStrictEqual(started.response.data, { cancelled: false });
  // Pi's RPC `new_session` binds the extension twice and subscribes to the
  // session only after the first bind (rpc-mode.js, the `new_session` case),
  // so the stream misses the first reconcile pass and repeats a lasting
  // failure. The session's own entries hold both passes, duplicates kept.
  return readSession(pi);
}

/**
 * Returns every skill the current session of `pi` offers, in Pi's order, and
 * every payload the session emitted, in session order, each valid against the
 * payload schema (DRV-01). A session may emit none. The first session of a
 * Pi that has just started holds the payloads of its startup, such as its
 * reconcile report.
 */
export async function readSession(pi: PiProcess): Promise<SessionReport> {
  const listed = await pi.request({ type: "get_commands" });
  assertQuiet(listed);
  const { response } = listed;
  assert.ok(
    COMMANDS_VALIDATOR.Check(response),
    JSON.stringify(COMMANDS_VALIDATOR.Errors(response)),
  );
  const skills = response.data.commands
    .filter((command) => command.source === "skill")
    .map(({ name, description }) => ({ command: `/${name}`, description }));
  return { skills, payloads: claudePluginPayloads(await readCustomEntries(pi)) };
}

/**
 * Sends `message` as a plain prompt in `pi` and returns every payload that
 * follows it in the session, in session order, each valid against the payload
 * schema (DRV-01). The sandbox Pi has no model, so it refuses the prompt, but
 * only after its input handlers ran, and one of them arms the background
 * update. The background update appends its payloads after Pi has answered,
 * so this reads the session's entries until at least one payload follows the
 * message and no new one has arrived for `BACKGROUND_RESULT_QUIET_MS`. It
 * fails when that does not happen within `BACKGROUND_RESULT_TIMEOUT_MS`.
 */
export async function sendMessage(
  pi: PiProcess,
  message: string,
): Promise<readonly NotificationPayload[]> {
  const before = (await readCustomEntries(pi)).length;
  const exchange = await pi.request({ type: "prompt", message });
  assertQuiet(exchange);
  const { command, success } = exchange.response;
  assert.deepStrictEqual({ command, success }, { command: "prompt", success: false }, message);
  const deadline = Date.now() + BACKGROUND_RESULT_TIMEOUT_MS;
  let payloads: readonly NotificationPayload[] = [];
  let quietSince = Date.now();
  for (;;) {
    const read = claudePluginPayloads((await readCustomEntries(pi)).slice(before));
    if (read.length !== payloads.length) {
      payloads = read;
      quietSince = Date.now();
    } else if (payloads.length > 0 && Date.now() - quietSince >= BACKGROUND_RESULT_QUIET_MS) {
      return payloads;
    }

    if (Date.now() >= deadline) {
      assert.fail(
        `the claude-plugin results that followed the message ${JSON.stringify(message)} did not settle within ${BACKGROUND_RESULT_TIMEOUT_MS} ms: ${JSON.stringify(payloads)}`,
      );
    }

    await delay(BACKGROUND_RESULT_POLL_MS);
  }
}
