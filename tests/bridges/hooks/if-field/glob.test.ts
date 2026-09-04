import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  compileBashGlob,
  compilePathGlob,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts";

describe("compileBashGlob", () => {
  test("preserves literal, slash, globstar, and star tokens in source order", () => {
    // arrange
    const expectedMetadata = {
      raw: "git/**/re*port",
      tokens: [
        { kind: "literal", text: "git" },
        { kind: "slash" },
        { kind: "globstar" },
        { kind: "slash" },
        { kind: "literal", text: "re" },
        { kind: "star" },
        { kind: "literal", text: "port" },
      ],
      trailingWordBoundary: false,
      isCommandNameOnly: false,
    };
    const expectedMatches = {
      nested: true,
      missingSegment: false,
      wrongTail: false,
    };

    // act
    const bashGlob = compileBashGlob("git/**/re*port");
    const metadata = {
      raw: bashGlob.raw,
      tokens: bashGlob.tokens,
      trailingWordBoundary: bashGlob.trailingWordBoundary,
      isCommandNameOnly: bashGlob.isCommandNameOnly,
    };
    const matches = {
      nested: bashGlob.test("git/a/b/report"),
      missingSegment: bashGlob.test("git/report"),
      wrongTail: bashGlob.test("git/a/b/review"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("normalizes trailing colon sugar to a command word boundary", () => {
    // arrange
    const expectedMetadata = {
      raw: "ls:*",
      tokens: [{ kind: "literal", text: "ls " }, { kind: "star" }],
      trailingWordBoundary: true,
      isCommandNameOnly: true,
    };
    const expectedMatches = {
      commandOnly: true,
      arguments: true,
      pathArgument: true,
      longerCommand: false,
    };

    // act
    const bashGlob = compileBashGlob("ls:*");
    const metadata = {
      raw: bashGlob.raw,
      tokens: bashGlob.tokens,
      trailingWordBoundary: bashGlob.trailingWordBoundary,
      isCommandNameOnly: bashGlob.isCommandNameOnly,
    };
    const matches = {
      commandOnly: bashGlob.test("ls"),
      arguments: bashGlob.test("ls -la"),
      pathArgument: bashGlob.test("ls /var/log"),
      longerCommand: bashGlob.test("lsof"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("keeps a non-trailing colon literal", () => {
    // arrange
    const expectedMetadata = {
      raw: "git:* push",
      tokens: [
        { kind: "literal", text: "git:" },
        { kind: "star" },
        { kind: "literal", text: " push" },
      ],
      trailingWordBoundary: false,
      isCommandNameOnly: false,
    };
    const expectedMatches = {
      literalColon: true,
      missingColon: false,
    };

    // act
    const bashGlob = compileBashGlob("git:* push");
    const metadata = {
      raw: bashGlob.raw,
      tokens: bashGlob.tokens,
      trailingWordBoundary: bashGlob.trailingWordBoundary,
      isCommandNameOnly: bashGlob.isCommandNameOnly,
    };
    const matches = {
      literalColon: bashGlob.test("git:any push"),
      missingColon: bashGlob.test("git push"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("allows an unbounded command-name star to consume command suffixes", () => {
    // arrange
    const expectedMetadata = {
      raw: "ls*",
      tokens: [{ kind: "literal", text: "ls" }, { kind: "star" }],
      trailingWordBoundary: false,
      isCommandNameOnly: false,
    };
    const expectedMatches = {
      zeroCharacters: true,
      commandSuffix: true,
    };

    // act
    const bashGlob = compileBashGlob("ls*");
    const metadata = {
      raw: bashGlob.raw,
      tokens: bashGlob.tokens,
      trailingWordBoundary: bashGlob.trailingWordBoundary,
      isCommandNameOnly: bashGlob.isCommandNameOnly,
    };
    const matches = {
      zeroCharacters: bashGlob.test("ls"),
      commandSuffix: bashGlob.test("lsof"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("matches an exact slash-bearing command name only", () => {
    // arrange
    const expectedMetadata = {
      raw: "bin/status",
      tokens: [
        { kind: "literal", text: "bin" },
        { kind: "slash" },
        { kind: "literal", text: "status" },
      ],
      trailingWordBoundary: false,
      isCommandNameOnly: true,
    };
    const expectedMatches = {
      exact: true,
      differentSeparator: false,
      trailingArgument: false,
    };

    // act
    const bashGlob = compileBashGlob("bin/status");
    const metadata = {
      raw: bashGlob.raw,
      tokens: bashGlob.tokens,
      trailingWordBoundary: bashGlob.trailingWordBoundary,
      isCommandNameOnly: bashGlob.isCommandNameOnly,
    };
    const matches = {
      exact: bashGlob.test("bin/status"),
      differentSeparator: bashGlob.test("bin status"),
      trailingArgument: bashGlob.test("bin/status now"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("returns a finite empty matcher for an empty pattern", () => {
    // arrange
    const expectedMetadata = {
      raw: "",
      tokens: [],
      trailingWordBoundary: false,
      isCommandNameOnly: false,
    };
    const expectedMatches = {
      empty: true,
      nonempty: false,
    };

    // act
    const bashGlob = compileBashGlob("");
    const metadata = {
      raw: bashGlob.raw,
      tokens: bashGlob.tokens,
      trailingWordBoundary: bashGlob.trailingWordBoundary,
      isCommandNameOnly: bashGlob.isCommandNameOnly,
    };
    const matches = {
      empty: bashGlob.test(""),
      nonempty: bashGlob.test("git"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("returns false when a star cannot satisfy its trailing literal", () => {
    // arrange
    const expectedMetadata = {
      raw: "a*b",
      tokens: [{ kind: "literal", text: "a" }, { kind: "star" }, { kind: "literal", text: "b" }],
      trailingWordBoundary: false,
      isCommandNameOnly: false,
    };
    const expectedMatches = {
      matchingTail: true,
      missingTail: false,
    };

    // act
    const bashGlob = compileBashGlob("a*b");
    const metadata = {
      raw: bashGlob.raw,
      tokens: bashGlob.tokens,
      trailingWordBoundary: bashGlob.trailingWordBoundary,
      isCommandNameOnly: bashGlob.isCommandNameOnly,
    };
    const matches = {
      matchingTail: bashGlob.test("acb"),
      missingTail: bashGlob.test("ac"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("returns false when exported token metadata becomes sparse at runtime", () => {
    // arrange
    const bashGlob = compileBashGlob("git");
    Reflect.deleteProperty(bashGlob.tokens, "0");
    const expectedMatch = false;

    // act
    const matches = bashGlob.test("git");

    // assert
    assert.strictEqual(matches, expectedMatch);
  });

  test("rejects an unknown exported token discriminant at runtime", () => {
    // arrange
    const bashGlob = compileBashGlob("git");
    Reflect.set(bashGlob.tokens, 0, { kind: "unknown" });
    const testCorruptedTokens = () => bashGlob.test("git");

    // act & assert
    assert.throws(
      testCorruptedTokens,
      new Error('unreachable HookExecResult arm: {"kind":"unknown"}'),
    );
  });
});

describe("compilePathGlob", () => {
  test("compiles a normalized contained path glob into complete metadata", () => {
    // arrange
    const expectedMetadata = {
      raw: "./src/**/report-*.ts",
      anchor: { kind: "cwd" },
      absoluteBase: "/workspace/project",
      tokens: [
        { kind: "literal", text: "src" },
        { kind: "slash" },
        { kind: "globstar" },
        { kind: "slash" },
        { kind: "literal", text: "report-" },
        { kind: "star" },
        { kind: "literal", text: ".ts" },
      ],
    };
    const expectedMatches = {
      contained: true,
      outsideBase: false,
    };

    // act
    const pathGlob = compilePathGlob("./src/**/report-*.ts", {
      homedir: "/home/reader",
      cwd: "/workspace/./project",
      projectRoot: "/workspace/root",
    });
    const metadata = {
      raw: pathGlob.raw,
      anchor: pathGlob.anchor,
      absoluteBase: pathGlob.absoluteBase,
      tokens: pathGlob.tokens,
    };
    const matches = {
      contained: pathGlob.testAbsolute("/workspace/project/src/deep/report-one.ts"),
      outsideBase: pathGlob.testAbsolute("/workspace/other/src/deep/report-one.ts"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  for (const { title, raw, expectedMetadata, paths, expectedMatches } of [
    {
      title: "resolves a double slash before the project-root arm",
      raw: "//var/**",
      expectedMetadata: {
        raw: "//var/**",
        anchor: { kind: "filesystem-root" },
        absoluteBase: "",
        tokens: [
          { kind: "slash" },
          { kind: "literal", text: "var" },
          { kind: "slash" },
          { kind: "globstar" },
        ],
      },
      paths: {
        zeroSegments: "/var/",
        multipleSegments: "/var/log/app.log",
        wrongRoot: "/tmp/var/log/app.log",
      },
      expectedMatches: {
        zeroSegments: true,
        multipleSegments: true,
        wrongRoot: false,
      },
    },
    {
      title: "resolves a tilde slash to the normalized home base",
      raw: "~/notes/*.md",
      expectedMetadata: {
        raw: "~/notes/*.md",
        anchor: { kind: "home" },
        absoluteBase: "/home/reader",
        tokens: [
          { kind: "literal", text: "notes" },
          { kind: "slash" },
          { kind: "star" },
          { kind: "literal", text: ".md" },
        ],
      },
      paths: {
        directChild: "/home/reader/notes/readme.md",
        nestedChild: "/home/reader/notes/deep/readme.md",
        outsideBase: "/home/other/notes/readme.md",
      },
      expectedMatches: {
        directChild: true,
        nestedChild: false,
        outsideBase: false,
      },
    },
    {
      title: "resolves dot slash to the normalized cwd base",
      raw: "./src/*.ts",
      expectedMetadata: {
        raw: "./src/*.ts",
        anchor: { kind: "cwd" },
        absoluteBase: "/workspace/project",
        tokens: [
          { kind: "literal", text: "src" },
          { kind: "slash" },
          { kind: "star" },
          { kind: "literal", text: ".ts" },
        ],
      },
      paths: {
        directChild: "/workspace/project/src/main.ts",
        nestedChild: "/workspace/project/src/deep/main.ts",
        siblingPrefix: "/workspace/project-copy/src/main.ts",
      },
      expectedMatches: {
        directChild: true,
        nestedChild: false,
        siblingPrefix: false,
      },
    },
    {
      title: "resolves a single leading slash to the normalized project base",
      raw: "/docs/**",
      expectedMetadata: {
        raw: "/docs/**",
        anchor: { kind: "project-root" },
        absoluteBase: "/workspace/root",
        tokens: [{ kind: "literal", text: "docs" }, { kind: "slash" }, { kind: "globstar" }],
      },
      paths: {
        zeroSegments: "/workspace/root/docs/",
        multipleSegments: "/workspace/root/docs/api/reference.md",
        filesystemRoot: "/docs/api/reference.md",
      },
      expectedMatches: {
        zeroSegments: true,
        multipleSegments: true,
        filesystemRoot: false,
      },
    },
    {
      title: "resolves a slash-bearing bare pattern to cwd",
      raw: "src/**",
      expectedMetadata: {
        raw: "src/**",
        anchor: { kind: "cwd" },
        absoluteBase: "/workspace/project",
        tokens: [{ kind: "literal", text: "src" }, { kind: "slash" }, { kind: "globstar" }],
      },
      paths: {
        zeroSegments: "/workspace/project/src/",
        multipleSegments: "/workspace/project/src/a/b.ts",
        outsideBase: "/workspace/other/src/a/b.ts",
      },
      expectedMatches: {
        zeroSegments: true,
        multipleSegments: true,
        outsideBase: false,
      },
    },
    {
      title: "resolves a bare name to an any-depth cwd scan",
      raw: ".env",
      expectedMetadata: {
        raw: ".env",
        anchor: { kind: "gitignore-bare" },
        absoluteBase: "/workspace/project",
        tokens: [{ kind: "literal", text: ".env" }],
      },
      paths: {
        root: "/workspace/project/.env",
        nested: "/workspace/project/deep/nested/.env",
        differentName: "/workspace/project/deep/.env.local",
        siblingPrefix: "/workspace/project-copy/.env",
      },
      expectedMatches: {
        root: true,
        nested: true,
        differentName: false,
        siblingPrefix: false,
      },
    },
  ]) {
    test(title, () => {
      // arrange
      const expectedCompiledMetadata = expectedMetadata;
      const expectedPathMatches = expectedMatches;

      // act
      const pathGlob = compilePathGlob(raw, {
        homedir: "/home/reader/../reader",
        cwd: "/workspace/project/../project",
        projectRoot: "/workspace/root/../root",
      });
      const compiledMetadata = {
        raw: pathGlob.raw,
        anchor: pathGlob.anchor,
        absoluteBase: pathGlob.absoluteBase,
        tokens: pathGlob.tokens,
      };
      const pathMatches = Object.fromEntries(
        Object.entries(paths).map(([name, absolutePath]) => [
          name,
          pathGlob.testAbsolute(absolutePath),
        ]),
      );

      // assert
      assert.deepStrictEqual(compiledMetadata, expectedCompiledMetadata);
      assert.deepStrictEqual(pathMatches, expectedPathMatches);
    });
  }

  test("keeps anchor precedence stable when normalized bases are equal", () => {
    // arrange
    const expectedMetadata = [
      {
        raw: "~/home.txt",
        anchor: { kind: "home" },
        absoluteBase: "/same/base",
        tokens: [{ kind: "literal", text: "home.txt" }],
      },
      {
        raw: "./cwd.txt",
        anchor: { kind: "cwd" },
        absoluteBase: "/same/base",
        tokens: [{ kind: "literal", text: "cwd.txt" }],
      },
      {
        raw: "/project.txt",
        anchor: { kind: "project-root" },
        absoluteBase: "/same/base",
        tokens: [{ kind: "literal", text: "project.txt" }],
      },
      {
        raw: "dir/file.txt",
        anchor: { kind: "cwd" },
        absoluteBase: "/same/base",
        tokens: [
          { kind: "literal", text: "dir" },
          { kind: "slash" },
          { kind: "literal", text: "file.txt" },
        ],
      },
      {
        raw: "bare.txt",
        anchor: { kind: "gitignore-bare" },
        absoluteBase: "/same/base",
        tokens: [{ kind: "literal", text: "bare.txt" }],
      },
    ];

    // act
    const metadata = ["~/home.txt", "./cwd.txt", "/project.txt", "dir/file.txt", "bare.txt"].map(
      (raw) => {
        const pathGlob = compilePathGlob(raw, {
          homedir: "/same/./base",
          cwd: "/same/./base",
          projectRoot: "/same/./base",
        });
        return {
          raw: pathGlob.raw,
          anchor: pathGlob.anchor,
          absoluteBase: pathGlob.absoluteBase,
          tokens: pathGlob.tokens,
        };
      },
    );

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
  });

  test("accepts an empty pattern and empty anchor base without throwing", () => {
    // arrange
    const expectedMetadata = {
      raw: "",
      anchor: { kind: "gitignore-bare" },
      absoluteBase: "",
      tokens: [],
    };
    const expectedMatches = {
      emptyPath: true,
      rootSeparator: true,
      namedPath: false,
    };

    // act
    const pathGlob = compilePathGlob("", {
      homedir: "",
      cwd: "",
      projectRoot: "",
    });
    const metadata = {
      raw: pathGlob.raw,
      anchor: pathGlob.anchor,
      absoluteBase: pathGlob.absoluteBase,
      tokens: pathGlob.tokens,
    };
    const matches = {
      emptyPath: pathGlob.testAbsolute(""),
      rootSeparator: pathGlob.testAbsolute("/"),
      namedPath: pathGlob.testAbsolute("/file.txt"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("keeps star matches inside one adjacent path segment", () => {
    // arrange
    const expectedMetadata = {
      raw: "./*/file",
      anchor: { kind: "cwd" },
      absoluteBase: "/workspace/project",
      tokens: [{ kind: "star" }, { kind: "slash" }, { kind: "literal", text: "file" }],
    };
    const expectedMatches = {
      zeroCharacters: true,
      oneSegment: true,
      multipleSegments: false,
      missingTail: false,
    };

    // act
    const pathGlob = compilePathGlob("./*/file", {
      homedir: "/home/reader",
      cwd: "/workspace/project",
      projectRoot: "/workspace/root",
    });
    const metadata = {
      raw: pathGlob.raw,
      anchor: pathGlob.anchor,
      absoluteBase: pathGlob.absoluteBase,
      tokens: pathGlob.tokens,
    };
    const matches = {
      zeroCharacters: pathGlob.testAbsolute("/workspace/project//file"),
      oneSegment: pathGlob.testAbsolute("/workspace/project/src/file"),
      multipleSegments: pathGlob.testAbsolute("/workspace/project/src/deep/file"),
      missingTail: pathGlob.testAbsolute("/workspace/project/src/other"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("matches adjacent globstars across zero and multiple segments", () => {
    // arrange
    const expectedMetadata = {
      raw: "./**/**",
      anchor: { kind: "cwd" },
      absoluteBase: "/workspace/project",
      tokens: [{ kind: "globstar" }, { kind: "slash" }, { kind: "globstar" }],
    };
    const expectedMatches = {
      zeroSegments: true,
      multipleSegments: true,
      missingSeparator: false,
    };

    // act
    const pathGlob = compilePathGlob("./**/**", {
      homedir: "/home/reader",
      cwd: "/workspace/project",
      projectRoot: "/workspace/root",
    });
    const metadata = {
      raw: pathGlob.raw,
      anchor: pathGlob.anchor,
      absoluteBase: pathGlob.absoluteBase,
      tokens: pathGlob.tokens,
    };
    const matches = {
      zeroSegments: pathGlob.testAbsolute("/workspace/project//"),
      multipleSegments: pathGlob.testAbsolute("/workspace/project/a/b/c"),
      missingSeparator: pathGlob.testAbsolute("/workspace/project/single"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("tokenizes a globstar followed immediately by a star", () => {
    // arrange
    const expectedMetadata = {
      raw: "./***/file",
      anchor: { kind: "cwd" },
      absoluteBase: "/workspace/project",
      tokens: [
        { kind: "globstar" },
        { kind: "star" },
        { kind: "slash" },
        { kind: "literal", text: "file" },
      ],
    };
    const expectedMatches = {
      segment: true,
      noSlash: false,
    };

    // act
    const pathGlob = compilePathGlob("./***/file", {
      homedir: "/home/reader",
      cwd: "/workspace/project",
      projectRoot: "/workspace/root",
    });
    const metadata = {
      raw: pathGlob.raw,
      anchor: pathGlob.anchor,
      absoluteBase: pathGlob.absoluteBase,
      tokens: pathGlob.tokens,
    };
    const matches = {
      segment: pathGlob.testAbsolute("/workspace/project/segment/file"),
      noSlash: pathGlob.testAbsolute("/workspace/project/file"),
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
    assert.deepStrictEqual(matches, expectedMatches);
  });

  test("rejects an unknown exported anchor discriminant at runtime", () => {
    // arrange
    const pathGlob = compilePathGlob("file.txt", {
      homedir: "/home/reader",
      cwd: "/workspace/project",
      projectRoot: "/workspace/root",
    });
    Reflect.set(pathGlob.anchor, "kind", "unknown");
    const testCorruptedAnchor = () => pathGlob.testAbsolute("/workspace/project/file.txt");

    // act & assert
    assert.throws(
      testCorruptedAnchor,
      new Error('unreachable HookExecResult arm: {"kind":"unknown"}'),
    );
  });
});
