// tests/edge/args-schema.test.ts
//
// Schema-driven `parseCommandArgs` validator coverage. The validator is
// independent of `ExtensionContext` -- callers inject a `notifyError`
// closure. These tests wire a spy in place of the closure and assert
// both the spy's calls and the return shape.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseCommandArgs,
  type PositionalSpec,
} from "../../extensions/claude-marketplace/edge/args-schema.ts";

function makeNotifyErrorSpy(): {
  notifyError: (message: string) => void;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    notifyError: (m: string): void => {
      calls.push(m);
    },
    calls,
  };
}

test("parseCommandArgs :: required positional missing emits usage via notifyError and returns undefined", () => {
  const { notifyError, calls } = makeNotifyErrorSpy();
  const schema = {
    positional: [{ name: "ref" }] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin install <ref>",
  };
  const result = parseCommandArgs("", schema, notifyError);
  assert.equal(result, undefined);
  assert.deepEqual(calls, ["Usage: /claude:plugin install <ref>"]);
});

test("parseCommandArgs :: optional positional missing returns parsed with property undefined", () => {
  const { notifyError, calls } = makeNotifyErrorSpy();
  const schema = {
    positional: [
      { name: "name" },
      { name: "extra", required: false },
    ] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin marketplace update [<name>]",
  };
  const result = parseCommandArgs("my-marketplace", schema, notifyError);
  assert.deepEqual(calls, []);
  assert.notEqual(result, undefined);
  assert.equal(result?.name, "my-marketplace");
  assert.equal(result?.extra, undefined);
});

test("parseCommandArgs :: tokenizer throw routes through notifyError + returns undefined", () => {
  const { notifyError, calls } = makeNotifyErrorSpy();
  const schema = {
    positional: [{ name: "ref" }] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin install <ref>",
  };
  const result = parseCommandArgs("--scope foo", schema, notifyError);
  assert.equal(result, undefined);
  assert.equal(calls.length, 1);
  assert.match(calls[0] ?? "", /^Invalid --scope value: "foo"\. Must be "user" or "project"\.$/);
});

test("parseCommandArgs :: typed return shape (compile-time check)", () => {
  const { notifyError } = makeNotifyErrorSpy();
  const schema = {
    positional: [
      { name: "marketplace" },
      { name: "plugin", required: false },
    ] as const satisfies readonly PositionalSpec[],
    usage: "usage",
  };
  const result = parseCommandArgs("mp1 plug1 --scope user", schema, notifyError);
  assert.notEqual(result, undefined);
  // Required positional => string at type level. Runtime confirms.
  const marketplace: string = result!.marketplace;
  // Optional positional => string | undefined. Runtime returns a string here.
  const plugin: string | undefined = result!.plugin;
  // scope is always optional.
  const scope: "user" | "project" | undefined = result!.scope;
  assert.equal(marketplace, "mp1");
  assert.equal(plugin, "plug1");
  assert.equal(scope, "user");
});
