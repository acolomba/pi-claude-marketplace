/**
 * @fileoverview Runs `/claude:plugin` commands and new sessions in the run's headless Pi.
 *
 * In RPC mode the extension appends each result as a `claude-plugin` custom
 * entry (JOUT-01), so a step reads structured payloads and never parses
 * text. A command returns every payload it emits, in emission order, each
 * validated against the published payload schema (DRV-01). State persists
 * between commands through the sandbox directories, as it does between two
 * Pi sessions of one user.
 */

import assert from "node:assert/strict";

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

// What a request reports beyond its own result: neither an extension error
// nor a dialog is ever expected.
function assertQuiet(exchange: RpcExchange): void {
  assert.deepStrictEqual(
    { extensionErrors: exchange.extensionErrors, dialogs: exchange.dialogs },
    { extensionErrors: [], dialogs: [] },
  );
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
  const payloads = exchange.entries
    .filter((entry) => entry.customType === "claude-plugin")
    .map((entry) => entry.data);
  assert.notDeepStrictEqual(payloads, [], `${command} emitted no claude-plugin payload`);
  return payloads.map((payload) => {
    assert.ok(PAYLOAD_VALIDATOR.Check(payload), JSON.stringify(PAYLOAD_VALIDATOR.Errors(payload)));
    return payload;
  });
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
 * Starts a new session in `pi` and returns every skill it offers, in Pi's
 * order. A new session rebuilds the extension runtime and discovers its
 * resources again, which is what makes installed plugins visible, as
 * `/reload` does.
 */
export async function startSession(pi: PiProcess): Promise<readonly OfferedSkill[]> {
  const started = await pi.request({ type: "new_session" });
  assertQuiet(started);
  assert.deepStrictEqual(started.response.data, { cancelled: false });
  const listed = await pi.request({ type: "get_commands" });
  assertQuiet(listed);
  const { response } = listed;
  assert.ok(
    COMMANDS_VALIDATOR.Check(response),
    JSON.stringify(COMMANDS_VALIDATOR.Errors(response)),
  );
  return response.data.commands
    .filter((command) => command.source === "skill")
    .map(({ name, description }) => ({ command: `/${name}`, description }));
}
