/**
 * @fileoverview Runs a headless Pi session and returns what the user would see.
 *
 * Each call starts the repository's own Pi CLI in RPC mode with the real
 * extension loaded. In RPC mode the extension appends each result as a
 * `claude-plugin` custom entry (JOUT-01), so a step reads structured payloads
 * and never parses text. State persists between calls through the sandbox
 * directories, as it does between two Pi sessions of one user.
 */

import assert from "node:assert/strict";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { CASCADE_PAYLOAD_SCHEMA } from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";
import { runRpcSession } from "../../tests/e2e/_rpc.ts";

import type { RpcSandbox, RpcSessionResult } from "../../tests/e2e/_rpc.ts";

/** The payload every plugin and marketplace command emits. */
export type CascadePayload = Type.Static<typeof CASCADE_PAYLOAD_SCHEMA>;

/** One skill a new session offers as a `/skill:<name>` command. */
export interface OfferedSkill {
  readonly command: string;
  readonly description: string;
}

const CASCADE_VALIDATOR = Compile(CASCADE_PAYLOAD_SCHEMA);

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

const STEP_ID = "command";

function assertCleanExit(session: RpcSessionResult): void {
  assert.deepStrictEqual(
    { exitCode: session.exitCode, timedOut: session.timedOut, errors: session.extensionErrors },
    { exitCode: 0, timedOut: false, errors: [] },
    session.stderr,
  );
}

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
  assertCleanExit(session);
  // Entries appended before the prompt come from the load pass, not from the command.
  const payloads = session.entries
    .filter((entry) => entry.after === STEP_ID && entry.customType === "claude-plugin")
    .map((entry) => entry.data);
  assert.strictEqual(payloads.length, 1, JSON.stringify(payloads));
  const [payload] = payloads;
  assert.ok(CASCADE_VALIDATOR.Check(payload), JSON.stringify(CASCADE_VALIDATOR.Errors(payload)));
  return payload;
}

/**
 * Starts a new Pi session in `sandbox` and returns every skill it offers, in
 * Pi's order. A new session is what makes installed plugins visible, as
 * `/reload` does in a running one.
 */
export async function listSkills(sandbox: RpcSandbox): Promise<readonly OfferedSkill[]> {
  const session = await runRpcSession({ sandbox, steps: [{ id: STEP_ID, type: "get_commands" }] });
  assertCleanExit(session);
  const response = session.responses.get(STEP_ID);
  assert.ok(
    COMMANDS_VALIDATOR.Check(response),
    JSON.stringify(COMMANDS_VALIDATOR.Errors(response)),
  );
  return response.data.commands
    .filter((command) => command.source === "skill")
    .map(({ name, description }) => ({ command: `/${name}`, description }));
}
