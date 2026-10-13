/**
 * @fileoverview Runs one `/claude:plugin` command in a headless Pi and returns its JSON result.
 *
 * Each call starts the repository's own Pi CLI in RPC mode with the real
 * extension loaded. In RPC mode the extension appends each result as a
 * `claude-plugin` custom entry (JOUT-01), so a step reads structured payloads
 * and never parses text. State persists between calls through the sandbox
 * directories, as it does between two Pi sessions of one user.
 */

import assert from "node:assert/strict";

import { Compile } from "typebox/compile";

import { CASCADE_PAYLOAD_SCHEMA } from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";
import { runRpcSession } from "../../tests/e2e/_rpc.ts";

import type { RpcSandbox } from "../../tests/e2e/_rpc.ts";
import type { Type } from "typebox";

/** The payload every plugin and marketplace command emits. */
export type CascadePayload = Type.Static<typeof CASCADE_PAYLOAD_SCHEMA>;

const CASCADE_VALIDATOR = Compile(CASCADE_PAYLOAD_SCHEMA);
const STEP_ID = "command";

/**
 * Runs `command` as the only prompt of a new Pi session in `sandbox`.
 * Asserts that Pi exits cleanly and that the command emits exactly one
 * schema-valid cascade payload, and returns that payload.
 */
export async function runCommand(sandbox: RpcSandbox, command: string): Promise<CascadePayload> {
  const session = await runRpcSession({
    sandbox,
    steps: [{ id: STEP_ID, type: "prompt", message: command }],
  });
  assert.deepStrictEqual(
    { exitCode: session.exitCode, timedOut: session.timedOut, errors: session.extensionErrors },
    { exitCode: 0, timedOut: false, errors: [] },
    session.stderr,
  );
  // Entries appended before the prompt come from the load pass, not from the command.
  const payloads = session.entries
    .filter((entry) => entry.after === STEP_ID && entry.customType === "claude-plugin")
    .map((entry) => entry.data);
  assert.strictEqual(payloads.length, 1, JSON.stringify(payloads));
  const [payload] = payloads;
  assert.ok(CASCADE_VALIDATOR.Check(payload), JSON.stringify(payload));
  return payload;
}
