import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { redactAbsolutePaths } from "../../extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts";

test("exports absolute-path redaction from its named owner", () => {
  assert.equal(typeof redactAbsolutePaths, "function");
});

for (const { name, input, expected } of [
  {
    name: "redacts a POSIX absolute path to its basename",
    input: "invalid /srv/private/state/config.json detail",
    expected: "invalid config.json detail",
  },
  {
    name: "redacts a Windows drive path to its basename",
    input: String.raw`invalid C:\Users\alice\secret.json detail`,
    expected: "invalid secret.json detail",
  },
  {
    name: "redacts an extended UNC path to its basename",
    input: String.raw`invalid \\?\UNC\server\share\secret.json detail`,
    expected: "invalid secret.json detail",
  },
  {
    name: "preserves a safe relative path",
    input: "invalid configs/local.json detail",
    expected: "invalid configs/local.json detail",
  },
  {
    name: "preserves a single-segment JSON pointer",
    input: "invalid /schemaVersion detail",
    expected: "invalid /schemaVersion detail",
  },
  {
    name: "redacts multiple paths deterministically",
    input: String.raw`from /srv/private/a.json to C:\Users\alice\b.json`,
    expected: "from a.json to b.json",
  },
] as const) {
  test(name, () => {
    const text = redactAbsolutePaths(input);

    assert.equal(text, expected);
  });
}

test("repeated redaction is idempotent", () => {
  const input = String.raw`from /srv/private/a.json to C:\Users\alice\b.json`;

  const once = redactAbsolutePaths(input);
  const twice = redactAbsolutePaths(once);

  assert.equal(twice, once);
});

test("preserves a matched token when no separator can be selected", (t: TestContext) => {
  t.mock.method(String.prototype, "lastIndexOf", () => -1);

  const redacted = redactAbsolutePaths("/root/secret.txt");
  t.mock.restoreAll();

  assert.equal(redacted, "/root/secret.txt");
});
