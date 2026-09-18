import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import { causeChainTrailer } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  redactAbsolutePaths,
  redactCauseChain,
} from "../../extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts";

describe("redactAbsolutePaths", () => {
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
});

describe("redactCauseChain", () => {
  for (const { name, input } of [
    { name: "undefined", input: undefined },
    { name: "null", input: null },
  ] as const) {
    test(`returns undefined for a(n) ${name} error`, () => {
      // arrange
      const errorInput = input;

      // act
      const rebuilt = redactCauseChain(errorInput);

      // assert
      assert.strictEqual(rebuilt, undefined);
    });
  }

  test("rebuilds a three-link chain with every message redacted", () => {
    // arrange
    const error = new Error("install failed at /srv/state/plugin.json", {
      cause: new Error("staging failed at /var/lib/marketplace/manifest.json", {
        cause: new Error("leaf failure at /home/user/.pi/cache/entry.json"),
      }),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(error));

    // assert
    assert.strictEqual(
      trailer,
      "cause: install failed at plugin.json -> staging failed at manifest.json -> leaf failure at entry.json",
    );
  });

  test("marks the fifth rebuilt link when the original chain runs longer", () => {
    // arrange
    const error = new Error("link-1 at /a/b/one.json", {
      cause: new Error("link-2 at /a/b/two.json", {
        cause: new Error("link-3 at /a/b/three.json", {
          cause: new Error("link-4 at /a/b/four.json", {
            cause: new Error("link-5 at /a/b/five.json", {
              cause: new Error("link-6 at /a/b/six.json"),
            }),
          }),
        }),
      }),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(error));

    // assert
    assert.strictEqual(
      trailer,
      "cause: link-1 at one.json -> link-2 at two.json -> link-3 at three.json -> " +
        "link-4 at four.json -> link-5 at five.json (truncated)",
    );
  });

  test("stops at one rebuilt link for a self-referencing cause", () => {
    // arrange
    const error = new Error("loop at /srv/private/loop.json");
    error.cause = error;

    // act
    const trailer = causeChainTrailer(redactCauseChain(error));

    // assert
    assert.strictEqual(trailer, "cause: loop at loop.json");
  });

  test("redacts a non-Error link via the same coercions causeChainTrailer uses", () => {
    // arrange
    const stringCause = new Error("outer at /srv/a/b.json", { cause: "inner at /srv/c/d.json" });
    const objectCause = new Error("outer at /srv/a/b.json", { cause: { detail: "inner" } });

    // act
    const trailers = [
      causeChainTrailer(redactCauseChain(stringCause)),
      causeChainTrailer(redactCauseChain(objectCause)),
    ];

    // assert
    assert.deepStrictEqual(trailers, [
      "cause: outer at b.json -> inner at d.json",
      "cause: outer at b.json -> [object Object]",
    ]);
  });
});
