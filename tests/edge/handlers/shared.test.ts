// Shared edge scanner unit tests.
//
// Covers the `extractLocalFlag` scanner living at edge/handlers/shared.ts
// (cross-cutting; marketplace/ and plugin/ subtrees continue to host their
// domain-specific shared.ts files separately).
//
// Position-independence is the load-bearing property -- WR-02 corrected a
// regression where `enable --local foo@mp` failed with a misleading message
// because `--local` was being passed as a positional to the downstream
// parser. The lifted scanner removes `--local` from the residualArgs so
// flag position cannot change the outcome.

import assert from "node:assert/strict";
import { test } from "node:test";

import { extractLocalFlag } from "../../../extensions/pi-claude-marketplace/edge/handlers/shared.ts";

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionCommandContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd: "/tmp",
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionCommandContext;
  return { ctx, notifications };
}

const USAGE =
  "Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]";

test("extractLocalFlag --local first: --local --scope user foo@bar", () => {
  const { ctx } = makeCtx();
  const got = extractLocalFlag("--local --scope user foo@bar", ctx, USAGE);
  assert.deepEqual(got, { local: true, residualArgs: "--scope user foo@bar" });
});

test("extractLocalFlag --local last: --scope user foo@bar --local", () => {
  const { ctx } = makeCtx();
  const got = extractLocalFlag("--scope user foo@bar --local", ctx, USAGE);
  assert.deepEqual(got, { local: true, residualArgs: "--scope user foo@bar" });
});

test("extractLocalFlag --local middle: foo@bar --local --scope user", () => {
  const { ctx } = makeCtx();
  const got = extractLocalFlag("foo@bar --local --scope user", ctx, USAGE);
  assert.deepEqual(got, { local: true, residualArgs: "foo@bar --scope user" });
});

test("extractLocalFlag no --local: foo@bar --scope user", () => {
  const { ctx } = makeCtx();
  const got = extractLocalFlag("foo@bar --scope user", ctx, USAGE);
  assert.deepEqual(got, { local: false, residualArgs: "foo@bar --scope user" });
});

test("extractLocalFlag empty args returns { local: false, residualArgs: '' }", () => {
  const { ctx } = makeCtx();
  const got = extractLocalFlag("", ctx, USAGE);
  assert.deepEqual(got, { local: false, residualArgs: "" });
});

test("extractLocalFlag unknown flag triggers notifyUsageError and returns undefined", () => {
  const { ctx, notifications } = makeCtx();
  const got = extractLocalFlag("foo@bar --bogus", ctx, USAGE);
  assert.equal(got, undefined);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]!.severity, "error");
  assert.match(notifications[0]!.message, /Unknown flag: "--bogus"\./);
  assert.match(notifications[0]!.message, /Usage: \/claude:plugin enable/);
});
