import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ensureGitSuffix,
  githubSource,
  parsePluginSource,
  pathSource,
  samePlannedSource,
  sourceLogical,
  type ParsedSource,
  type SamePlannedSourceResult,
} from "../../extensions/pi-claude-marketplace/domain/source.ts";

interface ParseCase {
  readonly name: string;
  readonly raw: unknown;
  readonly source: ParsedSource;
}

interface SourceComparisonCase {
  readonly name: string;
  readonly stored: unknown;
  readonly plannedRaw: string;
  readonly sourceOutcome: SamePlannedSourceResult;
}

const FULL_SHA = "0123456789abcdef0123456789abcdef01234567";

const PARSE_CASES: readonly ParseCase[] = [
  {
    name: "preserves a bare tilde path",
    raw: "~",
    source: { kind: "path", raw: "~", logical: "~" },
  },
  {
    name: "preserves a home-relative path",
    raw: "~/foo/bar",
    source: { kind: "path", raw: "~/foo/bar", logical: "~/foo/bar" },
  },
  {
    name: "preserves a dot-relative path",
    raw: "./pkg",
    source: { kind: "path", raw: "./pkg", logical: "./pkg" },
  },
  {
    name: "preserves a parent-relative path",
    raw: "../up",
    source: { kind: "path", raw: "../up", logical: "../up" },
  },
  {
    name: "preserves an absolute path",
    raw: "/etc/foo",
    source: { kind: "path", raw: "/etc/foo", logical: "/etc/foo" },
  },
  {
    name: "parses an owner and repository shorthand",
    raw: "anthropics/claude-plugins-official",
    source: {
      kind: "github",
      raw: "anthropics/claude-plugins-official",
      owner: "anthropics",
      repo: "claude-plugins-official",
    },
  },
  {
    name: "parses an owner and repository shorthand with a reference",
    raw: "acme/tools@v2.0",
    source: {
      kind: "github",
      raw: "acme/tools@v2.0",
      owner: "acme",
      repo: "tools",
      ref: "v2.0",
    },
  },
  {
    name: "parses a GitHub URL",
    raw: "https://github.com/o/r",
    source: {
      kind: "github",
      raw: "https://github.com/o/r",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "removes the Git suffix from GitHub identity",
    raw: "https://github.com/o/r.git",
    source: {
      kind: "github",
      raw: "https://github.com/o/r.git",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "preserves a GitHub reference",
    raw: "https://github.com/o/r#main",
    source: {
      kind: "github",
      raw: "https://github.com/o/r#main",
      owner: "o",
      repo: "r",
      ref: "main",
    },
  },
  {
    name: "removes a trailing slash from GitHub identity",
    raw: "https://github.com/o/r/",
    source: {
      kind: "github",
      raw: "https://github.com/o/r/",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "drops an empty GitHub reference after a Git suffix",
    raw: "https://github.com/o/r.git#",
    source: {
      kind: "github",
      raw: "https://github.com/o/r.git#",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "drops an empty GitHub reference",
    raw: "https://github.com/o/r#",
    source: {
      kind: "github",
      raw: "https://github.com/o/r#",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "normalizes an object URL on github.com to a GitHub source",
    raw: {
      source: "url",
      url: "https://github.com/obra/superpowers.git",
      sha: "abc1234def5678abc1234def5678abc1234def56",
    },
    source: {
      kind: "github",
      raw: "https://github.com/obra/superpowers.git",
      owner: "obra",
      repo: "superpowers",
      sha: "abc1234def5678abc1234def5678abc1234def56",
    },
  },
  {
    name: "parses a generic object URL with a reference",
    raw: { source: "url", url: "https://gitlab.com/acme/mp.git", ref: "main" },
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp.git",
      url: "https://gitlab.com/acme/mp",
      ref: "main",
    },
  },
  {
    name: "parses a generic URL with a Git suffix and reference",
    raw: "https://gitlab.com/acme/mp.git#main",
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp.git#main",
      url: "https://gitlab.com/acme/mp",
      ref: "main",
    },
  },
  {
    name: "parses a generic URL without a reference",
    raw: "https://gitlab.com/acme/mp",
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp",
      url: "https://gitlab.com/acme/mp",
    },
  },
  {
    name: "removes the Git suffix from generic URL identity",
    raw: "https://gitlab.com/acme/mp.git",
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp.git",
      url: "https://gitlab.com/acme/mp",
    },
  },
  {
    name: "parses a Git subdirectory object",
    raw: { source: "git-subdir", url: "https://github.com/o/r.git", path: "plugins/p" },
    source: {
      kind: "git-subdir",
      raw: "https://github.com/o/r.git",
      url: "https://github.com/o/r.git",
      path: "plugins/p",
    },
  },
  {
    name: "parses an npm object",
    raw: { source: "npm", package: "@scope/plugin", version: "1.2.3" },
    source: {
      kind: "npm",
      raw: "@scope/plugin",
      package: "@scope/plugin",
      version: "1.2.3",
    },
  },
  {
    name: "preserves an npm registry",
    raw: {
      source: "npm",
      package: "@scope/pkg",
      registry: "https://registry.example.com",
    },
    source: {
      kind: "npm",
      raw: "@scope/pkg",
      package: "@scope/pkg",
      registry: "https://registry.example.com",
    },
  },
  {
    name: "parses a stored path from its raw field",
    raw: { kind: "path", raw: "./local" },
    source: { kind: "path", raw: "./local", logical: "./local" },
  },
  {
    name: "parses a stored path from its logical fallback",
    raw: { kind: "path", logical: "~/local" },
    source: { kind: "path", raw: "~/local", logical: "~/local" },
  },
  {
    name: "parses a stored GitHub source",
    raw: { kind: "github", raw: "o/r", ref: "main" },
    source: { kind: "github", raw: "o/r", owner: "o", repo: "r", ref: "main" },
  },
  {
    name: "parses a stored URL source",
    raw: { kind: "url", url: "https://example.com/p.git" },
    source: {
      kind: "url",
      raw: "https://example.com/p.git",
      url: "https://example.com/p",
    },
  },
  {
    name: "parses a stored Git subdirectory source",
    raw: {
      kind: "git-subdir",
      url: "https://github.com/o/r.git",
      path: "plugins/p",
      ref: "main",
    },
    source: {
      kind: "git-subdir",
      raw: "https://github.com/o/r.git",
      url: "https://github.com/o/r.git",
      path: "plugins/p",
      ref: "main",
    },
  },
  {
    name: "parses a stored npm source",
    raw: { kind: "npm", package: "@scope/plugin" },
    source: { kind: "npm", raw: "@scope/plugin", package: "@scope/plugin" },
  },
  {
    name: "reconstructs a stored unknown source",
    raw: { kind: "unknown", raw: "stored-raw", reason: "stored-reason" },
    source: { kind: "unknown", raw: "stored-raw", reason: "stored-reason" },
  },
  {
    name: "parses a GitHub discriminator object",
    raw: { source: "github", repo: "o/r", sha: FULL_SHA },
    source: {
      kind: "github",
      raw: "o/r",
      owner: "o",
      repo: "r",
      sha: FULL_SHA,
    },
  },
  {
    name: "accepts a full lowercase commit SHA",
    raw: { source: "url", url: "https://gitlab.com/acme/mp", sha: FULL_SHA },
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp",
      url: "https://gitlab.com/acme/mp",
      sha: FULL_SHA,
    },
  },
  {
    name: "drops an abbreviated commit SHA",
    raw: { source: "url", url: "https://gitlab.com/acme/mp", sha: "abc1234" },
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp",
      url: "https://gitlab.com/acme/mp",
    },
  },
  {
    name: "lowercases a full uppercase commit SHA",
    raw: {
      source: "git-subdir",
      url: "https://example.com/mono",
      path: "plugins/p",
      sha: FULL_SHA.toUpperCase(),
    },
    source: {
      kind: "git-subdir",
      raw: "https://example.com/mono",
      url: "https://example.com/mono",
      path: "plugins/p",
      sha: FULL_SHA,
    },
  },
  {
    name: "drops a traversal-shaped commit SHA",
    raw: { source: "github", repo: "o/r", sha: "../../../../etc/passwd" },
    source: { kind: "github", raw: "o/r", owner: "o", repo: "r" },
  },
];

const UNKNOWN_PARSE_CASES: readonly ParseCase[] = [
  {
    name: "rejects a Git scp-form source",
    raw: "git@github.com:o/r.git",
    source: {
      kind: "unknown",
      raw: "git@github.com:o/r.git",
      reason:
        "git@github.com:o/r.git is not supported; git@host: scp-form URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects an SSH URL",
    raw: "ssh://git@github.com/o/r",
    source: {
      kind: "unknown",
      raw: "ssh://git@github.com/o/r",
      reason:
        "ssh://git@github.com/o/r is not supported; ssh:// URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects an HTTP URL",
    raw: "http://host/repo",
    source: {
      kind: "unknown",
      raw: "http://host/repo",
      reason:
        "http://host/repo is not supported; http:// URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects an unsupported URL scheme",
    raw: "ftp://host/repo",
    source: {
      kind: "unknown",
      raw: "ftp://host/repo",
      reason:
        "ftp://host/repo is not supported; this URL scheme URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects a GitHub browser tree URL with a canonical hint",
    raw: "https://github.com/o/r/tree/main",
    source: {
      kind: "unknown",
      raw: "https://github.com/o/r/tree/main",
      reason:
        "https://github.com/o/r/tree/main is a browser URL; use https://github.com/o/r#main instead",
    },
  },
  {
    name: "rejects a per-user tilde path",
    raw: "~user/foo",
    source: {
      kind: "unknown",
      raw: "~user/foo",
      reason: "per-user tilde (~user/...) is not supported; use ~/...",
    },
  },
  {
    name: "rejects a bare word",
    raw: "foo",
    source: {
      kind: "unknown",
      raw: "foo",
      reason: "non-relative string source foo cannot be classified",
    },
  },
  {
    name: "rejects a shorthand with several slashes",
    raw: "foo/bar/baz",
    source: {
      kind: "unknown",
      raw: "foo/bar/baz",
      reason: "non-relative string source foo/bar/baz cannot be classified",
    },
  },
  {
    name: "rejects an empty string",
    raw: "",
    source: {
      kind: "unknown",
      raw: "",
      reason: "non-relative string source  cannot be classified",
    },
  },
  {
    name: "rejects a shorthand with an empty repository",
    raw: "foo/",
    source: {
      kind: "unknown",
      raw: "foo/",
      reason: "foo/ owner/repo halves must be non-empty",
    },
  },
  {
    name: "rejects an incomplete GitHub URL",
    raw: "https://github.com/onlyone",
    source: {
      kind: "unknown",
      raw: "https://github.com/onlyone",
      reason: "https://github.com/onlyone must be https://github.com/<owner>/<repo>[.git][#<ref>]",
    },
  },
  {
    name: "rejects a reference without an owner and repository pair",
    raw: "foo@v1.0",
    source: {
      kind: "unknown",
      raw: "foo@v1.0",
      reason: "non-relative string source foo@v1.0 cannot be classified",
    },
  },
  {
    name: "rejects an object URL without a URL field",
    raw: { source: "url" },
    source: {
      kind: "unknown",
      raw: '{"source":"url"}',
      reason: "url source is missing url",
    },
  },
  {
    name: "rejects a Git subdirectory object without a path",
    raw: { source: "git-subdir", url: "https://example.com/o/r.git" },
    source: {
      kind: "unknown",
      raw: '{"source":"git-subdir","url":"https://example.com/o/r.git"}',
      reason: "git-subdir source is missing url or path",
    },
  },
  {
    name: "rejects a Git subdirectory object without a URL or path",
    raw: { source: "git-subdir" },
    source: {
      kind: "unknown",
      raw: '{"source":"git-subdir"}',
      reason: "git-subdir source is missing url or path",
    },
  },
  {
    name: "rejects an npm object without a package",
    raw: { source: "npm" },
    source: {
      kind: "unknown",
      raw: '{"source":"npm"}',
      reason: "npm source is missing package",
    },
  },
  {
    name: "rejects a stored path without raw or logical text",
    raw: { kind: "path" },
    source: {
      kind: "unknown",
      raw: '{"kind":"path"}',
      reason: "path source is missing raw",
    },
  },
  {
    name: "rejects a stored GitHub source without raw text",
    raw: { kind: "github" },
    source: {
      kind: "unknown",
      raw: '{"kind":"github"}',
      reason: "github source is missing raw",
    },
  },
  {
    name: "rejects a stored GitHub source whose raw text is a path",
    raw: { kind: "github", raw: "./local-path" },
    source: {
      kind: "unknown",
      raw: "./local-path",
      reason: "github source repo is not owner/repo",
    },
  },
  {
    name: "preserves the parser reason for an invalid stored GitHub shorthand",
    raw: { kind: "github", raw: "not-a-source" },
    source: {
      kind: "unknown",
      raw: "not-a-source",
      reason: "non-relative string source not-a-source cannot be classified",
    },
  },
  {
    name: "uses the stored unknown reason fallback",
    raw: { kind: "unknown", raw: "stored-raw", reason: 42 },
    source: {
      kind: "unknown",
      raw: "stored-raw",
      reason: "unknown source missing reason",
    },
  },
  {
    name: "uses the complete object as a stored unknown raw fallback",
    raw: { kind: "unknown", raw: 42, reason: "stored-reason" },
    source: {
      kind: "unknown",
      raw: '{"kind":"unknown","raw":42,"reason":"stored-reason"}',
      reason: "stored-reason",
    },
  },
  {
    name: "rejects an unrecognized stored source kind",
    raw: { kind: "future-kind" },
    source: {
      kind: "unknown",
      raw: '{"kind":"future-kind"}',
      reason: "unrecognized source kind: future-kind",
    },
  },
  {
    name: "rejects a GitHub discriminator without a repository",
    raw: { source: "github" },
    source: {
      kind: "unknown",
      raw: '{"source":"github"}',
      reason: "github source is missing repo",
    },
  },
  {
    name: "rejects an unrecognized source discriminator",
    raw: { source: "future-discriminator" },
    source: {
      kind: "unknown",
      raw: '{"source":"future-discriminator"}',
      reason: "unrecognized source kind: future-discriminator",
    },
  },
  {
    name: "rejects an object without a source discriminator",
    raw: { url: "https://example.com" },
    source: {
      kind: "unknown",
      raw: '{"url":"https://example.com"}',
      reason: "object source is missing source discriminator",
    },
  },
];

const INVALID_INPUT_CASES: readonly ParseCase[] = [
  {
    name: "rejects null at the exported parse boundary",
    raw: null,
    source: {
      kind: "unknown",
      raw: "null",
      reason: "source must be a string or object",
    },
  },
  {
    name: "rejects a boolean at the exported parse boundary",
    raw: true,
    source: {
      kind: "unknown",
      raw: "true",
      reason: "source must be a string or object",
    },
  },
  {
    name: "rejects a number at the exported parse boundary",
    raw: 42,
    source: {
      kind: "unknown",
      raw: "42",
      reason: "source must be a string or object",
    },
  },
  {
    name: "rejects an unstructured object at the exported parse boundary",
    raw: {},
    source: {
      kind: "unknown",
      raw: "{}",
      reason: "object source is missing source discriminator",
    },
  },
  {
    name: "rejects an empty array at the exported parse boundary",
    raw: [],
    source: {
      kind: "unknown",
      raw: "",
      reason: "source must be a string or object",
    },
  },
  {
    name: "rejects a non-empty array at the exported parse boundary",
    raw: ["source"],
    source: {
      kind: "unknown",
      raw: "source",
      reason: "source must be a string or object",
    },
  },
];

describe("parsePluginSource", () => {
  for (const { name, raw, source } of [
    ...PARSE_CASES,
    ...UNKNOWN_PARSE_CASES,
    ...INVALID_INPUT_CASES,
  ]) {
    test(name, () => {
      // arrange
      const expectedSource = source;

      // act
      const parsedSource = parsePluginSource(raw);

      // assert
      assert.deepStrictEqual(parsedSource, expectedSource);
    });
  }
});

describe("pathSource", () => {
  for (const invalidPath of ["", "   ", 42]) {
    test("rejects " + JSON.stringify(invalidPath) + " as an empty path", () => {
      // arrange
      const expectedError = {
        name: "Error",
        message: "Path source must be a non-empty string.",
      };

      // act
      const createPathSource = () => {
        Reflect.apply(pathSource, undefined, [invalidPath]);
      };

      // assert
      assert.throws(createPathSource, expectedError);
    });
  }

  test("returns a complete path source", () => {
    // arrange
    const expectedSource: ParsedSource = { kind: "path", raw: "~/x", logical: "~/x" };

    // act
    const parsedSource = pathSource("~/x");

    // assert
    assert.deepStrictEqual(parsedSource, expectedSource);
  });
});

describe("githubSource", () => {
  test("returns a complete GitHub source", () => {
    // arrange
    const raw = "anthropics/claude-plugins-official";
    const expectedSource: ParsedSource = {
      kind: "github",
      raw,
      owner: "anthropics",
      repo: "claude-plugins-official",
    };

    // act
    const parsedSource = githubSource(raw);

    // assert
    assert.deepStrictEqual(parsedSource, expectedSource);
  });

  for (const { raw, message } of [
    { raw: "./local", message: "Not a github source: ./local -- wrong kind: path" },
    {
      raw: "not-a-source",
      message:
        "Not a github source: not-a-source -- non-relative string source not-a-source cannot be classified",
    },
  ]) {
    test("rejects " + raw + " as a non-GitHub source", () => {
      // arrange
      const expectedError = { name: "Error", message };

      // act
      const createGithubSource = () => githubSource(raw);

      // assert
      assert.throws(createGithubSource, expectedError);
    });
  }
});

describe("samePlannedSource", () => {
  const comparisons: readonly SourceComparisonCase[] = [
    {
      name: "matches equal GitHub sources",
      stored: { kind: "github", raw: "acme/tools", owner: "acme", repo: "tools" },
      plannedRaw: "acme/tools",
      sourceOutcome: "same",
    },
    {
      name: "distinguishes GitHub references",
      stored: {
        kind: "github",
        raw: "acme/tools#v1",
        owner: "acme",
        repo: "tools",
        ref: "v1",
      },
      plannedRaw: "acme/tools#v2",
      sourceOutcome: "different",
    },
    {
      name: "matches equal path sources",
      stored: { kind: "path", raw: "./local", logical: "./local" },
      plannedRaw: "./local",
      sourceOutcome: "same",
    },
    {
      name: "distinguishes unequal logical paths",
      stored: { kind: "path", raw: "./plugins/b", logical: "./plugins/b" },
      plannedRaw: "./plugins/a",
      sourceOutcome: "different",
    },
    {
      name: "distinguishes adjacent path text",
      stored: { kind: "path", raw: "./plugins/a", logical: "./plugins/a" },
      plannedRaw: "./plugins/ab",
      sourceOutcome: "different",
    },
    {
      name: "distinguishes recognized source kinds",
      stored: { kind: "path", raw: "./local", logical: "./local" },
      plannedRaw: "acme/tools",
      sourceOutcome: "different",
    },
    {
      name: "matches canonical URL identities",
      stored: {
        kind: "url",
        raw: "https://gitlab.com/acme/mp",
        url: "https://gitlab.com/acme/mp",
      },
      plannedRaw: "https://gitlab.com/acme/mp.git",
      sourceOutcome: "same",
    },
    {
      name: "distinguishes URL references",
      stored: {
        kind: "url",
        raw: "https://gitlab.com/acme/mp#main",
        url: "https://gitlab.com/acme/mp",
        ref: "main",
      },
      plannedRaw: "https://gitlab.com/acme/mp#dev",
      sourceOutcome: "different",
    },
    {
      name: "distinguishes Git subdirectory sources from invalid planned text",
      stored: {
        kind: "git-subdir",
        raw: "https://example.com/repo.git",
        url: "https://example.com/repo.git",
        path: "plugins/a",
      },
      plannedRaw: '{"source":"git-subdir"}',
      sourceOutcome: "different",
    },
    {
      name: "distinguishes npm sources from shorthand text",
      stored: { kind: "npm", raw: "@scope/pkg", package: "@scope/pkg", version: "1.2.3" },
      plannedRaw: "npm:@scope/pkg@1.2.3",
      sourceOutcome: "different",
    },
    {
      name: "reports an unrecognized stored source",
      stored: { kind: "future-thing", raw: "x" },
      plannedRaw: "acme/tools",
      sourceOutcome: "unknown-stored",
    },
  ];

  for (const { name, stored, plannedRaw, sourceOutcome } of comparisons) {
    test(name, () => {
      // arrange
      const expectedOutcome = sourceOutcome;

      // act
      const comparison = samePlannedSource(stored, plannedRaw);

      // assert
      assert.strictEqual(comparison, expectedOutcome);
    });
  }
});

describe("sourceLogical", () => {
  const labels: readonly {
    name: string;
    source: ParsedSource;
    logical: string;
  }[] = [
    {
      name: "returns a path logical value",
      source: { kind: "path", raw: "~/projects/local-mp", logical: "~/projects/local-mp" },
      logical: "~/projects/local-mp",
    },
    {
      name: "builds a GitHub URL without a reference",
      source: { kind: "github", raw: "acme/tools", owner: "acme", repo: "tools" },
      logical: "https://github.com/acme/tools",
    },
    {
      name: "builds a GitHub URL with a reference",
      source: {
        kind: "github",
        raw: "acme/tools#v1",
        owner: "acme",
        repo: "tools",
        ref: "v1",
      },
      logical: "https://github.com/acme/tools#v1",
    },
    {
      name: "returns a URL without a reference",
      source: {
        kind: "url",
        raw: "https://example.com/p",
        url: "https://example.com/p",
      },
      logical: "https://example.com/p",
    },
    {
      name: "returns a URL with a reference",
      source: {
        kind: "url",
        raw: "https://example.com/p#v1",
        url: "https://example.com/p",
        ref: "v1",
      },
      logical: "https://example.com/p#v1",
    },
    {
      name: "builds a Git subdirectory label without a reference",
      source: {
        kind: "git-subdir",
        raw: "https://example.com/repo.git",
        url: "https://example.com/repo.git",
        path: "plugins/p",
      },
      logical: "https://example.com/repo.git/plugins/p",
    },
    {
      name: "builds a Git subdirectory label with a reference",
      source: {
        kind: "git-subdir",
        raw: "https://example.com/repo.git",
        url: "https://example.com/repo.git",
        path: "plugins/p",
        ref: "main",
      },
      logical: "https://example.com/repo.git#main/plugins/p",
    },
    {
      name: "builds an npm label without a version",
      source: { kind: "npm", raw: "@scope/pkg", package: "@scope/pkg" },
      logical: "npm:@scope/pkg",
    },
    {
      name: "builds an npm label with a version",
      source: { kind: "npm", raw: "@scope/pkg", package: "@scope/pkg", version: "1.2.3" },
      logical: "npm:@scope/pkg@1.2.3",
    },
    {
      name: "returns the raw text for an unknown source",
      source: { kind: "unknown", raw: "future-source", reason: "future source" },
      logical: "future-source",
    },
  ];

  for (const { name, source, logical } of labels) {
    test(name, () => {
      // arrange
      const expectedLogical = logical;

      // act
      const sourceLabel = sourceLogical(source);

      // assert
      assert.strictEqual(sourceLabel, expectedLogical);
    });
  }
});

describe("ensureGitSuffix", () => {
  for (const { url, cloneUrl } of [
    { url: "https://gitlab.com/o/r", cloneUrl: "https://gitlab.com/o/r.git" },
    { url: "https://gitlab.com/o/r.git", cloneUrl: "https://gitlab.com/o/r.git" },
    { url: "https://gitlab.com/o/r/", cloneUrl: "https://gitlab.com/o/r.git" },
    { url: "https://gitlab.com/o/r///", cloneUrl: "https://gitlab.com/o/r.git" },
    { url: "https://gitlab.com/o/r.git/", cloneUrl: "https://gitlab.com/o/r.git" },
  ]) {
    test("normalizes " + url + " for Git transport", () => {
      // arrange
      const expectedCloneUrl = cloneUrl;

      // act
      const normalizedCloneUrl = ensureGitSuffix(url);

      // assert
      assert.strictEqual(normalizedCloneUrl, expectedCloneUrl);
    });
  }
});
