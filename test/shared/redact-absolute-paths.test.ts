import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import {
  causeChainTrailer,
  ManualRecoveryError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  redactAbsolutePaths,
  redactCauseChain,
  redactedRollbackPartials,
  splitDependencyPartials,
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
      name: "redacts a quoted POSIX path containing spaces",
      input: "unlink '/private dir/secret.json'",
      expected: "unlink 'secret.json'",
    },
    {
      name: "redacts the whole quoted POSIX path with a spaced intermediate directory",
      input: "unlink '/Users/Jane Doe/private/plugin/secret.json'",
      expected: "unlink 'secret.json'",
    },
    {
      name: "keeps the Unicode basename of a quoted path",
      input: 'read "/資料/秘密 フォルダ/設定 文書.json"',
      expected: 'read "設定 文書.json"',
    },
    {
      name: "finds a quoted path after an apostrophe in prose",
      input: "can't unlink '/private dir/secret.json'",
      expected: "can't unlink 'secret.json'",
    },
    {
      name: "redacts an ordinary UNC path",
      input: String.raw`unlink \\server\private\secret.json`,
      expected: "unlink secret.json",
    },
    {
      name: "redacts a quoted UNC path containing spaces and Unicode",
      input: String.raw`unlink '\\server\private share\秘密\secret file.json'`,
      expected: "unlink 'secret file.json'",
    },
    {
      name: "redacts a quoted extended UNC path containing spaces",
      input: String.raw`unlink '\\?\UNC\server\private share\secret file.json'`,
      expected: "unlink 'secret file.json'",
    },
    {
      name: "redacts a quoted Windows path containing an apostrophe",
      input: String.raw`read "C:\Users\Jane's files\秘密\secret file.json"`,
      expected: 'read "secret file.json"',
    },
    {
      name: "preserves quoted URLs and single-segment JSON pointers",
      input: 'invalid "/schemaVersion" at "https://example.test/a/b" or "file:///a/b"',
      expected: 'invalid "/schemaVersion" at "https://example.test/a/b" or "file:///a/b"',
    },
    {
      name: "preserves non-path prose and quoted relative paths",
      input: 'read "private files/config.json" after the user says "try again"',
      expected: 'read "private files/config.json" after the user says "try again"',
    },
    {
      name: "preserves a single-segment JSON pointer",
      input: "invalid /schemaVersion detail",
      expected: "invalid /schemaVersion detail",
    },
    {
      name: "preserves a URL whose scheme satisfies the drive-letter and POSIX path shapes",
      input: "invalid https://github.com/org/repo.git detail",
      expected: "invalid https://github.com/org/repo.git detail",
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
  test("redacts every quoted cause and structured leaked path containing spaces or UNC prefixes", () => {
    // arrange
    const leaks = [
      "/private dir/秘密/skill one",
      String.raw`\\server\private share\skill two`,
      "relative-skill",
    ];
    const failure = new ManualRecoveryError("read '/private dir/秘密/config.json'", leaks, {
      cause: new Error(String.raw`copy '\\server\private share\stage.json'`, {
        cause: new Error('unlink "/Users/Jane Doe/秘密/data.txt"'),
      }),
    });

    // act
    const rebuilt = redactCauseChain(failure);

    // assert
    assert.deepStrictEqual(
      rebuilt,
      new ManualRecoveryError("read 'config.json'", ["skill one", "skill two", "relative-skill"], {
        cause: new Error("copy 'stage.json'", { cause: new Error('unlink "data.txt"') }),
      }),
    );
    assert.equal(
      causeChainTrailer(rebuilt),
      "cause: read 'config.json' -> copy 'stage.json' -> unlink \"data.txt\"",
    );
  });

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

  test("keeps a manual-recovery link with its leaked paths redacted", () => {
    // arrange
    const error = new Error("install failed at /srv/state/plugin.json", {
      cause: new ManualRecoveryError("undo failed at /srv/skills/alpha", [
        "/srv/skills/alpha",
        "/srv/skills/beta",
      ]),
    });

    // act
    const rebuilt = redactCauseChain(error);

    // assert
    assert.deepStrictEqual(
      rebuilt,
      new Error("install failed at plugin.json", {
        cause: new ManualRecoveryError("undo failed at alpha", ["alpha", "beta"]),
      }),
    );
  });

  test("keeps a manual-recovery head with no cause, its leaked paths redacted", () => {
    // arrange
    const error = new ManualRecoveryError("undo failed at /srv/skills/alpha", [
      "/srv/skills/alpha",
    ]);

    // act
    const rebuilt = redactCauseChain(error);

    // assert
    assert.deepStrictEqual(rebuilt, new ManualRecoveryError("undo failed at alpha", ["alpha"]));
  });
});

describe("redactedRollbackPartials", () => {
  test("rebuilds each cause with its paths cut and drops the raw message", () => {
    // arrange
    const partials = [
      { phase: "skills", msg: "raw", cause: new Error("unlink '/srv/a/b/data.txt'") },
      { phase: "agents", msg: "raw" },
    ];

    // act
    const redacted = redactedRollbackPartials(partials);

    // assert
    assert.deepStrictEqual(redacted, [
      { phase: "skills", cause: new Error("unlink 'data.txt'") },
      { phase: "agents" },
    ]);
  });
});

describe("splitDependencyPartials", () => {
  test("keeps the dependency's own phases apart from another member's undo", () => {
    // arrange
    const partials = [
      { phase: "skills" },
      { phase: "lib@mp" },
      { phase: "sibling@mp" },
      { phase: "app@mp" },
    ];

    // act
    const split = splitDependencyPartials("lib@mp", partials);

    // assert
    assert.deepStrictEqual(split, {
      dependency: [{ phase: "skills" }, { phase: "lib@mp" }],
      others: [{ phase: "sibling@mp" }, { phase: "app@mp" }],
    });
  });
});
