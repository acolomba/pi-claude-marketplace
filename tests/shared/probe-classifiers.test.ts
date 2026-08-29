import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InvalidMarketplaceManifestError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  narrowProbeError,
  narrowResolverNotes,
  narrowUnsupportedKinds,
  type ResolverNoteReason,
  type UnsupportedReason,
} from "../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";

describe("narrowResolverNotes", () => {
  test("classifies an invalid hooks JSON note as unsupported hooks", () => {
    // arrange
    const notes = ["hooks.json is not valid JSON: Unexpected token n"];
    const expectedReasons = ["unsupported hooks"] satisfies readonly ResolverNoteReason[];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, expectedReasons);
  });

  test("classifies a hooks schema failure as unsupported hooks", () => {
    // arrange
    const notes = ["hooks.json failed schema validation: PreToolUse[0].command must be a string"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported hooks"]);
  });

  test("classifies an unsupported hooks note as unsupported hooks", () => {
    // arrange
    const notes = ["unsupported hooks: regex matcher detected"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported hooks"]);
  });

  test("classifies a malformed hooks wrapper as unsupported hooks", () => {
    // arrange
    const notes = ["malformed hooks.json: hooks.json is not valid JSON: Unexpected token"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported hooks"]);
  });

  test("does not classify a free-form hooks mention as unsupported hooks", () => {
    // arrange
    const notes = ["contains lspServers / hooks mentioned elsewhere"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["lsp"]);
  });

  test("classifies an lspServers note as lsp", () => {
    // arrange
    const notes = ["contains lspServers"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["lsp"]);
  });

  test("classifies an unmatched note as unsupported source", () => {
    // arrange
    const notes = ["source dir does not exist"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported source"]);
  });

  test("returns no reasons for no notes", () => {
    // arrange
    const notes: string[] = [];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, []);
  });

  test("deduplicates invalid hooks JSON notes by classification", () => {
    // arrange
    const notes = ["hooks.json is not valid JSON: foo", "hooks.json is not valid JSON: bar"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported hooks"]);
  });

  test("deduplicates malformed hooks wrappers without adding a fallback", () => {
    // arrange
    const notes = [
      "malformed hooks.json: hooks.json is not valid JSON: Unexpected token",
      "malformed hooks.json: unsupported hooks: regex matcher in PreToolUse",
    ];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported hooks"]);
  });

  test("classifies a malformed MCP reference as malformed mcp", () => {
    // arrange
    const notes = ['malformed mcp reference: file not found: "x.mcp.json"'];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["malformed mcp"]);
  });

  test("classifies an inline malformed mcpServers note as unsupported source", () => {
    // arrange
    const notes = ["malformed mcpServers: shape mismatch"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported source"]);
  });

  test("deduplicates malformed MCP references by classification", () => {
    // arrange
    const notes = [
      'malformed mcp reference: file not found: "x.mcp.json"',
      "malformed mcp reference: missing top-level mcpServers wrapper",
    ];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["malformed mcp"]);
  });

  test("prefers a malformed MCP prefix over an embedded lspServers token", () => {
    // arrange
    const notes = ['malformed mcp reference: file not found: "config/lspServers/servers.mcp.json"'];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["malformed mcp"]);
  });
});

describe("narrowUnsupportedKinds", () => {
  test("classifies hooks as unsupported hooks", () => {
    // arrange
    const kinds = ["hooks"];
    const expectedReasons = ["unsupported hooks"] satisfies readonly UnsupportedReason[];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, expectedReasons);
  });

  test("classifies hooks and lspServers independently", () => {
    // arrange
    const kinds = ["hooks", "lspServers"];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported hooks", "lsp"]);
  });

  test("deduplicates repeated hooks kinds", () => {
    // arrange
    const kinds = ["hooks", "hooks"];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported hooks"]);
  });

  test("classifies a non-carve-out kind as unsupported component", () => {
    // arrange
    const kinds = ["monitors"];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported component"]);
  });

  test("classifies lspServers before a non-carve-out kind", () => {
    // arrange
    const kinds = ["lspServers", "monitors"];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, ["lsp", "unsupported component"]);
  });
});

describe("narrowProbeError", () => {
  test("classifies EACCES as permission denied", () => {
    // arrange
    const error = new Error("EACCES: permission denied");
    (error as NodeJS.ErrnoException).code = "EACCES";

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "permission denied");
  });

  test("classifies EPERM as permission denied", () => {
    // arrange
    const error = new Error("EPERM: operation not permitted");
    (error as NodeJS.ErrnoException).code = "EPERM";

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "permission denied");
  });

  test("classifies ENOENT as source missing", () => {
    // arrange
    const error = new Error("ENOENT: no such file or directory");
    (error as NodeJS.ErrnoException).code = "ENOENT";

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "source missing");
  });

  test("classifies ENOTDIR as source missing", () => {
    // arrange
    const error = new Error("ENOTDIR: not a directory");
    (error as NodeJS.ErrnoException).code = "ENOTDIR";

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "source missing");
  });

  test("classifies a SyntaxError as unparseable", () => {
    // arrange
    const error = new SyntaxError("Unexpected token in JSON");

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "unparseable");
  });

  test("classifies a schema-invalid marketplace manifest as invalid manifest", () => {
    // arrange
    const error = new InvalidMarketplaceManifestError("marketplace schema invalid");

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "invalid manifest");
  });

  test("classifies a marketplace manifest with a SyntaxError cause as unparseable", () => {
    // arrange
    const error = new InvalidMarketplaceManifestError("malformed marketplace JSON", {
      cause: new SyntaxError("Unexpected token"),
    });

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "unparseable");
  });

  test("classifies a generic Error as unreadable", () => {
    // arrange
    const error = new Error("probe failed");

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "unreadable");
  });

  for (const { thrown, label } of [
    { thrown: "string throw", label: "a string" },
    { thrown: 42, label: "a number" },
    { thrown: undefined, label: "undefined" },
  ] as const) {
    test(`classifies ${label} as unreadable`, () => {
      // arrange
      const error = thrown;

      // act
      const reason = narrowProbeError(error);

      // assert
      assert.strictEqual(reason, "unreadable");
    });
  }
});
