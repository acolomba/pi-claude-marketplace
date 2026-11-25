import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InvalidMarketplaceManifestError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  narrowKindNotes,
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

  test("SRC-01: classifies a missing source directory as source missing", () => {
    // arrange
    const notes = ["source dir does not exist: /mp/plugins/ghost"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["source missing"]);
  });

  test("D-PL2-24: classifies a manifest link outside its boundary as unreadable manifest", () => {
    // arrange
    const notes = ["plugin manifest resolves outside the plugin directory"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unreadable manifest"]);
  });

  test("classifies an unmatched note as unsupported source", () => {
    // arrange
    const notes = ["unsupported source kind: npm"];

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

  test("ANAME-07: classifies a malformed MCP server note as malformed mcp", () => {
    // arrange
    const notes = ['malformed mcp server "db": /timeout: must be integer'];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["malformed mcp"]);
  });

  test("ANAME-07: prefers a malformed MCP server prefix over an author-controlled lspServers name", () => {
    // arrange
    const notes = ['malformed mcp server "lspServers": /timeout: must be integer'];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["malformed mcp"]);
  });

  test("ANAME-07: does not match a malformed MCP server prefix without its trailing space", () => {
    // arrange
    const notes = ["malformed mcp servers: shape mismatch"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported source"]);
  });

  for (const key of ["mode", "lspServers", "source"]) {
    test(`D-PG10-05: classifies a malformed userConfig note naming ${key} as invalid manifest`, () => {
      // arrange
      const notes = [`malformed userConfig: userConfig option "${key}" is not an object`];

      // act
      const reasons = narrowResolverNotes(notes);

      // assert
      assert.deepStrictEqual(reasons, ["invalid manifest"]);
    });
  }

  test("D-PG10-06: classifies an unset userConfig note naming lspServers as options not set", () => {
    // arrange
    const notes = ["required userConfig options have no default: lspServers, source"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["options not set"]);
  });

  test("D-PG10-06: classifies an unset userConfig note beside a malformed one on the source axis", () => {
    // arrange
    const notes = [
      'malformed userConfig: userConfig option "mode" is not an object',
      "required userConfig options have no default: token",
    ];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["invalid manifest", "unsupported source"]);
  });

  test("D-90-05: classifies a lone mod kind note as unsupported component", () => {
    // arrange
    const notes = ["contains mod"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported component"]);
  });

  test("SURF-01: classifies a kind note beside a structural note as unsupported source", () => {
    // arrange
    const notes = ['malformed mcp reference: file not found: "x.mcp.json"', "contains monitors"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["malformed mcp", "unsupported source"]);
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

  test("deduplicates repeated equal notes", () => {
    // arrange
    const notes = ["contains lspServers", "contains lspServers"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["lsp"]);
  });

  test("does not match a malformed MCP prefix that is one character short", () => {
    // arrange
    const notes = ["malformed mcp referenc"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported source"]);
  });

  test("matches a malformed MCP prefix with an adjacent suffix character", () => {
    // arrange
    const notes = ["malformed mcp referencex"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["malformed mcp"]);
  });

  test("prefers an unsupported hooks prefix over an embedded lspServers token", () => {
    // arrange
    const notes = ["unsupported hooks: contains lspServers"];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported hooks"]);
  });

  test("prefers a malformed MCP prefix over an embedded lspServers token", () => {
    // arrange
    const notes = ['malformed mcp reference: file not found: "config/lspServers/servers.mcp.json"'];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, ["malformed mcp"]);
  });

  test("preserves the first-seen order of distinct classifications", () => {
    // arrange
    const notes = [
      "unsupported source kind: npm",
      "unsupported hooks: regex matcher detected",
      "contains lspServers",
      'malformed mcp reference: file not found: "x.mcp.json"',
      "another unmatched note",
    ];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, [
      "unsupported source",
      "unsupported hooks",
      "lsp",
      "malformed mcp",
    ]);
  });
});

describe("narrowKindNotes", () => {
  for (const { notes, reasons } of [
    { notes: ["contains lspServers"], reasons: ["lsp"] },
    { notes: ["contains mod"], reasons: ["unsupported component"] },
    { notes: ["contains themes"], reasons: ["unsupported component"] },
    { notes: ["contains hooks"], reasons: ["unsupported hooks"] },
    { notes: ["contains mcpServers"], reasons: ["unsupported mcp"] },
    {
      notes: ["required userConfig options have no default: token"],
      reasons: ["options not set"],
    },
    { notes: ["contains hooks", "contains lspServers"], reasons: ["unsupported hooks", "lsp"] },
    { notes: ["contains monitors", "contains themes"], reasons: ["unsupported component"] },
  ] satisfies readonly {
    readonly notes: readonly string[];
    readonly reasons: readonly UnsupportedReason[];
  }[]) {
    test(`D-90-05: maps the kind notes ${notes.join(" and ")} to ${reasons.join(" and ")}`, () => {
      // arrange
      const expectedReasons = reasons;

      // act
      const kindReasons = narrowKindNotes(notes);

      // assert
      assert.deepStrictEqual(kindReasons, expectedReasons);
    });
  }

  for (const { label, notes } of [
    { label: "no notes", notes: [] },
    {
      label: "a kind note beside a structural note",
      notes: ['malformed mcp reference: file not found: "x.mcp.json"', "contains monitors"],
    },
    { label: "a note that only starts like a kind note", notes: ["contains two words"] },
  ] satisfies readonly { readonly label: string; readonly notes: readonly string[] }[]) {
    test(`SURF-01: gives no kind reasons for ${label}`, () => {
      // arrange
      const expectedReasons = undefined;

      // act
      const kindReasons = narrowKindNotes(notes);

      // assert
      assert.strictEqual(kindReasons, expectedReasons);
    });
  }
});

describe("narrowUnsupportedKinds", () => {
  test("returns no reasons for no kinds", () => {
    // arrange
    const kinds: string[] = [];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, []);
  });

  test("ANAME-07: classifies mcpServers as unsupported mcp", () => {
    // arrange
    const kinds = ["mcpServers"];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported mcp"]);
  });

  test("D-PG10-06: classifies userConfig as options not set", () => {
    // arrange
    const kinds = ["userConfig"];
    const expectedReasons = ["options not set"] satisfies readonly UnsupportedReason[];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, expectedReasons);
  });

  test("D-PG10-06: classifies themes and userConfig in kind order", () => {
    // arrange
    const kinds = ["themes", "userConfig"];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported component", "options not set"]);
  });

  test("classifies hooks as unsupported hooks", () => {
    // arrange
    const kinds = ["hooks"];
    const expectedReasons = ["unsupported hooks"] satisfies readonly UnsupportedReason[];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, expectedReasons);
  });

  test("WINV-03: a stray workflows kind in a legacy record falls through to unsupported component", () => {
    // arrange
    const kinds = ["workflows"];
    const expectedReasons = ["unsupported component"] satisfies readonly UnsupportedReason[];

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

  test("classifies a one-character lspServers near miss as unsupported component", () => {
    // arrange
    const kinds = ["lspServer"];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported component"]);
  });

  test("preserves the first-seen order of distinct kind classifications", () => {
    // arrange
    const kinds = ["monitors", "hooks", "lspServers", "themes", "hooks"];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, ["unsupported component", "unsupported hooks", "lsp"]);
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

  test("classifies a marketplace manifest with a generic cause as invalid manifest", () => {
    // arrange
    const error = new InvalidMarketplaceManifestError("marketplace schema invalid", {
      cause: new Error("schema validation failed"),
    });

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "invalid manifest");
  });

  test("does not classify a nested SyntaxError cause as unparseable", () => {
    // arrange
    const error = new InvalidMarketplaceManifestError("marketplace schema invalid", {
      cause: new Error("schema validation failed", {
        cause: new SyntaxError("Unexpected token"),
      }),
    });

    // act
    const reason = narrowProbeError(error);

    // assert
    assert.strictEqual(reason, "invalid manifest");
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
