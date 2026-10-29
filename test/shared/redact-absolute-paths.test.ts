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

const EMBEDDED_QUOTE_BOUNDARY_CASES = [
  { platform: "POSIX", root: "/tmp", separator: "/" },
  { platform: "drive", root: String.raw`C:\private`, separator: "\\" },
  { platform: "UNC", root: String.raw`\\server\private`, separator: "\\" },
].flatMap(({ platform, root, separator }) =>
  [
    { quoteName: "single quote", quote: "'" },
    { quoteName: "double quote", quote: '"' },
  ].flatMap(({ quoteName, quote }) =>
    [
      { boundaryName: "space", boundary: " " },
      { boundaryName: "tab", boundary: "\t" },
      { boundaryName: "line break", boundary: "\n" },
      { boundaryName: "Unicode space", boundary: "\u00a0" },
      { boundaryName: "comma", boundary: "," },
      { boundaryName: "semicolon", boundary: ";" },
      { boundaryName: "colon", boundary: ":" },
      { boundaryName: "dot", boundary: "." },
      { boundaryName: "closing parenthesis", boundary: ")" },
      { boundaryName: "closing bracket", boundary: "]" },
      { boundaryName: "closing brace", boundary: "}" },
    ].map(({ boundaryName, boundary }) => ({
      platform,
      root,
      separator,
      quoteName,
      quote,
      boundaryName,
      boundary,
    })),
  ),
);

const SEPARATOR_ADJACENT_QUOTE_CASES = [
  { platform: "POSIX", root: "/", separator: "/" },
  { platform: "drive", root: "C:\\", separator: "\\" },
  { platform: "UNC", root: "\\\\server\\share\\", separator: "\\" },
].flatMap(({ platform, root, separator }) =>
  [
    { quoteName: "single quote", quote: "'" },
    { quoteName: "double quote", quote: '"' },
  ].flatMap(({ quoteName, quote }) =>
    [
      { positionName: "root", componentCount: 0 },
      { positionName: "first directory separator", componentCount: 1 },
      { positionName: "nested directory separator", componentCount: 2 },
    ].map(({ positionName, componentCount }) => ({
      platform,
      root,
      separator,
      quoteName,
      quote,
      positionName,
      componentCount,
    })),
  ),
);

function registerSeparatorAdjacentQuoteCases(): void {
  for (const {
    platform,
    root,
    separator,
    quoteName,
    quote,
    positionName,
    componentCount,
  } of SEPARATOR_ADJACENT_QUOTE_CASES) {
    test(`fails closed for a ${platform} path with a ${quoteName} after its ${positionName}`, () => {
      // arrange
      const directories = ["private", "cache"];
      const prefix =
        root +
        directories.slice(0, componentCount).join(separator) +
        (componentCount === 0 ? "" : separator);
      const suffix = directories.slice(componentCount).join(separator) + separator + "secret.json";
      const input = `open ${quote}${prefix}${quote}${suffix}${quote}`;

      // act
      const text = redactAbsolutePaths(input);

      // assert
      assert.strictEqual(text, `open ${quote}[redacted path]`);
    });
  }
}

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
      name: "redacts a filesystem diagnostic with an apostrophe before a space",
      input: "ENOENT: no such file or directory, open '/tmp/O' Brien/秘密/secret.json'",
      expected: "ENOENT: no such file or directory, open 'secret.json'",
    },
    {
      name: "keeps separate filesystem rename paths with internal quotes",
      input:
        "ENOENT: no such file or directory, rename '/tmp/O' Brien/a.json' -> '/tmp/D' Angelo/b.json'",
      expected: "ENOENT: no such file or directory, rename 'a.json' -> 'b.json'",
    },
    {
      name: "keeps a rename separator inside an open diagnostic path",
      input: "ENOENT: no such file or directory, open '/tmp/private' -> 'dir/secret.json'",
      expected: "ENOENT: no such file or directory, open 'secret.json'",
    },
    {
      name: "preserves relative paths in filesystem diagnostics",
      input: "ENOENT: no such file or directory, open 'private files/O' Brien/config.json'",
      expected: "ENOENT: no such file or directory, open 'private files/O' Brien/config.json'",
    },
    {
      name: "fails closed for a single-quoted path with an internal apostrophe",
      input: "open '/tmp/O'Brien/private dir/秘密/secret.json'",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed after an apostrophe followed by a space",
      input: "unlink '/tmp/O' Brien/秘密/secret.json'",
      expected: "unlink '[redacted path]",
    },
    {
      name: "fails closed for a multi-word component after an apostrophe",
      input: "unlink '/tmp/O' Mary Jane/秘密/secret.json'",
      expected: "unlink '[redacted path]",
    },
    {
      name: "fails closed for an embedded quote before a balanced later value",
      input: "open '/tmp/O' Brien/private/secret.json 'x'",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for an embedded double quote before a balanced later value",
      input: String.raw`open "C:\private\O" Brien\secret.json "x"`,
      expected: 'open "[redacted path]',
    },
    {
      name: "fails closed for an embedded UNC quote before a balanced later value",
      input: String.raw`open '\\server\private\O' Brien\secret.json 'x'`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed when four matching quotes follow the opener",
      input: "open '/tmp/O' Brien/private/secret.json 'x' tail '",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed before later single-quoted diagnostic text",
      input: "open '/tmp/private/file.json' failed; see docs/errors 'E_READ'",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a POSIX path before a bare unmatched quote",
      input: "open '/tmp/private/file.json' docs/errors '",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a drive path before an unmatched quoted token",
      input: String.raw`open 'C:\private\file.json' docs/errors 'unclosed`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a UNC path before a relative value and unmatched quote",
      input: String.raw`open '\\server\private\file.json' docs/errors 'x/y' tail 'unclosed`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed before slash-bearing prose and an unmatched quote",
      input: "open '/tmp/private/file.json' help/guide '",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed before a relative value, slash-bearing prose, and an unmatched quote",
      input: "open '/tmp/private/file.json' value 'rel/path' help/guide '",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a double-quoted POSIX path before a bare unmatched quote",
      input: 'open "/tmp/private/file.json" docs/errors "',
      expected: 'open "[redacted path]',
    },
    {
      name: "fails closed for a double-quoted drive path before an unmatched quoted token",
      input: String.raw`open "C:\private\file.json" docs/errors "unclosed`,
      expected: 'open "[redacted path]',
    },
    {
      name: "fails closed for a double-quoted UNC path before a relative value and unmatched quote",
      input: String.raw`open "\\server\private\file.json" docs/errors "x/y" tail "unclosed`,
      expected: 'open "[redacted path]',
    },
    {
      name: "fails closed before a later relative value and local suffix",
      input: "open '/tmp/private/file.json' value 'x/y' docs/errors '",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a drive path before a later relative value and local suffix",
      input: String.raw`open 'C:\private\file.json' value 'x/y' failed; see '`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a UNC path before a later relative value and local suffix",
      input: String.raw`open '\\server\private\file.json' value 'x/y' docs/errors '`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed when a POSIX path contains a local suffix",
      input: "open '/tmp/O' docs/errors /private/secret.json'",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed when a drive path contains a local suffix",
      input: String.raw`open "C:\private\O" failed; see \hidden\secret.json"`,
      expected: 'open "[redacted path]',
    },
    {
      name: "fails closed when a UNC path contains a local suffix",
      input: String.raw`open "\\server\private\O" docs/errors \hidden\secret.json"`,
      expected: 'open "[redacted path]',
    },
    {
      name: "fails closed for a drive path before later single-quoted text",
      input: String.raw`open 'C:\private\file.json' failed; see docs/errors 'E_READ'`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a UNC path before later single-quoted text",
      input: String.raw`open '\\server\private\file.json' failed; see docs/errors 'E_READ'`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed before immediate prose and a quoted value",
      input: "open '/tmp/private/file.json' docs/errors 'E_READ'",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a drive path before a quoted value",
      input: String.raw`open 'C:\private\file.json' docs/errors 'E_READ'`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a UNC path before a quoted value",
      input: String.raw`open '\\server\private\file.json' docs/errors 'E_READ'`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed before separate paths with internal apostrophes",
      input: "rename '/tmp/O'Brien/a.json' -> '/tmp/D'Angelo/b.json'",
      expected: "rename '[redacted path]",
    },
    {
      name: "fails closed for double-quoted paths with internal double quotes",
      input: 'read "/tmp/a"b/private/secret.json", then "/tmp/c"d/other.json"',
      expected: 'read "[redacted path]',
    },
    {
      name: "fails closed for a quoted basename containing an apostrophe",
      input: "can't open '/tmp/O'Brien/secret's file.json' today",
      expected: "can't open '[redacted path]",
    },
    {
      name: "fails closed before punctuation and later quoted values",
      input: "read '/tmp/O'Brien/a.json'); use 'relative/file' or 'https://example.test/a/b'",
      expected: "read '[redacted path]",
    },
    {
      name: "redacts a quoted POSIX path containing spaces",
      input: "unlink '/private dir/secret.json'",
      expected: "unlink 'secret.json'",
    },
    {
      name: "redacts an unquoted state path containing spaces",
      input:
        "state.json at /tmp/private user/.pi/pi-claude-marketplace/state.json is not valid JSON: bad input",
      expected: "state.json at state.json is not valid JSON: bad input",
    },
    {
      name: "redacts an unquoted failed-read path containing spaces",
      input: "Failed to read /tmp/private user/.pi/pi-claude-marketplace/state.json: EACCES",
      expected: "Failed to read state.json: EACCES",
    },
    {
      name: "redacts an unquoted failed-write path containing spaces",
      input:
        "Failed to write /tmp/private user/.pi/pi-claude-marketplace/claude-plugins.json: EACCES",
      expected: "Failed to write claude-plugins.json: EACCES",
    },
    {
      name: "redacts a held state-lock path containing spaces",
      input:
        "Another pi-claude-marketplace operation is in progress for project scope " +
        "(/tmp/private user/.pi/pi-claude-marketplace/.state-lock). Retry after it completes.",
      expected:
        "Another pi-claude-marketplace operation is in progress for project scope " +
        "(.state-lock). Retry after it completes.",
    },
    {
      name: "redacts a compromised state-lock path containing spaces",
      input:
        "The user scope state lock (/tmp/private user/.pi/agent/pi-claude-marketplace/.state-lock) " +
        "was lost before the operation finished. Run the command again.",
      expected:
        "The user scope state lock (.state-lock) was lost before the operation finished. " +
        "Run the command again.",
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
      name: "preserves a quoted single-segment JSON pointer",
      input: 'invalid "/schemaVersion"',
      expected: 'invalid "/schemaVersion"',
    },
    {
      name: "preserves a quoted drive root with no basename",
      input: String.raw`invalid "C:\"`,
      expected: String.raw`invalid "C:\"`,
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
      name: "fails closed for an absolute path with no closing quote",
      input: "read '/tmp/private/secret.json",
      expected: "read '[redacted path]",
    },
    {
      name: "fails closed for an unclosed path with an embedded apostrophe",
      input: "read '/tmp/O'Brien/private/secret.json",
      expected: "read '[redacted path]",
    },
    {
      name: "fails closed for an unclosed path after a spaced apostrophe",
      input: "open '/tmp/O' Brien/private/secret.json",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for an unclosed drive path after a spaced double quote",
      input: String.raw`open "C:\private\O" Brien\secret.json`,
      expected: 'open "[redacted path]',
    },
    {
      name: "fails closed for an unclosed UNC path after a spaced apostrophe",
      input: String.raw`open '\\server\private\O' Brien\secret.json`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for an unclosed POSIX path before slash-bearing prose",
      input: "open '/tmp/private/file.json failed; see docs/errors",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for an unclosed drive path before slash-bearing prose",
      input: String.raw`open 'C:\private\file.json failed; see docs/errors`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for an unclosed UNC path before slash-bearing prose",
      input: String.raw`open '\\server\private\file.json failed; see docs/errors`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for an unclosed path with internal spaces",
      input: "open '/tmp/O Brien/private/secret.json",
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for an unclosed drive path with Unicode spaces",
      input: "open 'C:\\private\\O\u00a0Brien\\secret.json",
      expected: "open '[redacted path]",
    },
    {
      name: "elides a delimiter-like suffix after an unclosed path",
      input: "open '/tmp/private/file.json;see=docs/errors",
      expected: "open '[redacted path]",
    },
    {
      name: "elides every delimiter-like suffix after an unclosed path",
      input: "open '/tmp/private/file.json;see=docs/errors failed; later",
      expected: "open '[redacted path]",
    },
    {
      name: "does not trust a failed delimiter inside an unclosed path",
      input: "open '/tmp/private failed; hidden/secret.json",
      expected: "open '[redacted path]",
    },
    {
      name: "does not trust a no-space delimiter inside an unclosed drive path",
      input: String.raw`open 'C:\private;see=hidden\secret.json`,
      expected: "open '[redacted path]",
    },
    {
      name: "fails closed for a UNC path followed by a quoted value",
      input: String.raw`open '\\server\private;see=hidden\secret.json' docs/errors 'x'`,
      expected: "open '[redacted path]",
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

  for (const { platform, absolutePath } of [
    { platform: "POSIX", absolutePath: "/tmp/private/file.json" },
    { platform: "drive", absolutePath: String.raw`C:\private\file.json` },
    { platform: "UNC", absolutePath: String.raw`\\server\private\file.json` },
  ] as const) {
    for (const { boundary, quotedValue } of [
      { boundary: "space", quotedValue: " hidden" },
      { boundary: "tab", quotedValue: "\thidden" },
      { boundary: "line break", quotedValue: "\nhidden" },
      { boundary: "Unicode space", quotedValue: "\u00a0hidden" },
      { boundary: "comma", quotedValue: ",hidden" },
      { boundary: "semicolon", quotedValue: ";hidden" },
      { boundary: "colon", quotedValue: ":E_READ" },
      { boundary: "dot", quotedValue: ".hidden" },
      { boundary: "closing parenthesis", quotedValue: ")hidden" },
      { boundary: "closing bracket", quotedValue: "]hidden" },
      { boundary: "closing brace", quotedValue: "}hidden" },
    ] as const) {
      test(`fails closed for a ${platform} path before a ${boundary} quoted value`, () => {
        // arrange
        const input = `open '${absolutePath}' docs/errors '${quotedValue}'`;

        // act
        const text = redactAbsolutePaths(input);

        // assert
        assert.strictEqual(text, "open '[redacted path]");
      });
    }
  }

  for (const { platform, root, separator } of [
    { platform: "POSIX", root: "/tmp", separator: "/" },
    { platform: "drive", root: String.raw`C:\private`, separator: "\\" },
    { platform: "UNC", root: String.raw`\\server\private`, separator: "\\" },
  ] as const) {
    for (const { quoteName, quote } of [
      { quoteName: "single quotes", quote: "'" },
      { quoteName: "double quotes", quote: '"' },
    ] as const) {
      for (const { behavior, embeddedQuotes, component, expected } of [
        {
          behavior: "redacts",
          embeddedQuotes: "no embedded quote",
          component: "private files",
          expected: ({ trailingWhitespace }: { trailingWhitespace: string }) =>
            `open ${quote}secret.json${trailingWhitespace}${quote}`,
        },
        {
          behavior: "fails closed for",
          embeddedQuotes: "one embedded quote",
          component: `O${quote} Brien`,
          expected: () => `open ${quote}[redacted path]`,
        },
        {
          behavior: "fails closed for",
          embeddedQuotes: "multiple embedded quotes",
          component: `O${quote} Brien${quote}s files`,
          expected: () => `open ${quote}[redacted path]`,
        },
      ] as const) {
        for (const { trailingName, trailingWhitespace } of [
          { trailingName: "no trailing whitespace", trailingWhitespace: "" },
          { trailingName: "a trailing space", trailingWhitespace: " " },
          { trailingName: "a trailing tab", trailingWhitespace: "\t" },
          { trailingName: "a trailing Unicode space", trailingWhitespace: "\u00a0" },
        ] as const) {
          test(`${behavior} a ${platform} path in ${quoteName} with ${embeddedQuotes} and ${trailingName}`, () => {
            // arrange
            const absolutePath =
              root + separator + component + separator + "秘密" + separator + "secret.json";
            const input = `open ${quote}${absolutePath}${trailingWhitespace}${quote}`;

            // act
            const text = redactAbsolutePaths(input);

            // assert
            assert.strictEqual(text, expected({ trailingWhitespace }));
          });
        }
      }
    }
  }

  for (const {
    platform,
    root,
    separator,
    quoteName,
    quote,
    boundaryName,
    boundary,
  } of EMBEDDED_QUOTE_BOUNDARY_CASES) {
    test(`fails closed for a ${platform} path whose embedded ${quoteName} precedes a ${boundaryName}`, () => {
      // arrange
      const absolutePath =
        root +
        separator +
        `O${quote}${boundary}Brien` +
        separator +
        "秘密" +
        separator +
        "secret.json";
      const input = `open ${quote}${absolutePath}${quote}`;

      // act
      const text = redactAbsolutePaths(input);

      // assert
      assert.strictEqual(text, `open ${quote}[redacted path]`);
    });
  }

  registerSeparatorAdjacentQuoteCases();

  test("bounds an unclosed path before a later quoted value and URL", () => {
    // arrange
    const input =
      "open '/tmp/private/file.json failed; value 'x' docs/errors " +
      "https://example.test/docs/errors";

    // act
    const text = redactAbsolutePaths(input);

    // assert
    assert.strictEqual(text, "open '[redacted path]");
  });

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
  test("fails closed for a quoted cause after an apostrophe followed by a space", () => {
    // arrange
    const failure = new Error("unlink '/tmp/O' Brien/秘密/secret.json'");

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: unlink '[redacted path]");
    assert.doesNotMatch(trailer, /Brien\/秘密\/secret\.json/u);
  });

  test("fails closed before later quoted text in a cause chain", () => {
    // arrange
    const failure = new Error("open '/tmp/private/file.json' failed; see docs/errors 'E_READ'");

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: open '[redacted path]");
  });

  test("fails closed for ambiguous quote boundaries in a cause chain", () => {
    // arrange
    const failure = new Error("unlink '/tmp/O' Mary Jane/秘密/secret.json'", {
      cause: new Error("open '/tmp/private/file.json' docs/errors 'E_READ'"),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: unlink '[redacted path] -> open '[redacted path]");
  });

  test("fails closed before punctuation-prefixed quoted values", () => {
    // arrange
    const failure = new Error("open '/tmp/private/file.json' docs/errors '.hidden'", {
      cause: new Error("open 'C:\\private\\file.json' docs/errors ':E_READ'", {
        cause: new Error("open '\\\\server\\private\\file.json' docs/errors ' E_READ'"),
      }),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(
      trailer,
      "cause: open '[redacted path] -> open '[redacted path] -> open '[redacted path]",
    );
  });

  test("fails closed for multi-quote and trailing-space paths across a cause chain", () => {
    // arrange
    const failure = new Error("open '/tmp/O' Brien's files/秘密/secret.json'", {
      cause: new Error('open "C:\\private\\O" Brien"s files\\秘密\\secret.json"', {
        cause: new Error("open '\\\\server\\private\\O' Mary Jane\\秘密\\secret.json '"),
      }),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(
      trailer,
      "cause: open '[redacted path] -> open \"[redacted path] -> open '[redacted path]",
    );
  });

  test("fails closed for embedded quotes before Unicode space and punctuation", () => {
    // arrange
    const failure = new Error("open '/tmp/O'\u00a0Brien/秘密/secret.json'", {
      cause: new Error('open "C:\\private\\O",Brien\\秘密\\secret.json"'),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: open '[redacted path] -> open \"[redacted path]");
  });

  test("fails closed for unclosed cause paths before slash-bearing prose", () => {
    // arrange
    const failure = new Error("open '/tmp/private/file.json failed; see docs/errors", {
      cause: new Error("open 'C:\\private\\file.json failed; value 'x' docs/errors"),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: open '[redacted path] -> open '[redacted path]");
  });

  test("fails closed for an unclosed cause path with internal spaces", () => {
    // arrange
    const failure = new Error("open '/tmp/O Brien/private/secret.json");

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: open '[redacted path]");
    assert.doesNotMatch(trailer, /O Brien|private|secret\.json/u);
  });

  test("fails closed for a cause path before later unmatched quoted fragments", () => {
    // arrange
    const failure = new Error("open '/tmp/private/file.json' docs/errors '", {
      cause: new Error("open 'C:\\private\\file.json' docs/errors 'x/y' tail 'unclosed"),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: open '[redacted path] -> open '[redacted path]");
  });

  test("fails closed for embedded quotes and arbitrary slash prose in a cause chain", () => {
    // arrange
    const failure = new Error("open '/tmp/O' Brien/private/secret.json", {
      cause: new Error("open '/tmp/private/file.json' help/guide '"),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: open '[redacted path] -> open '[redacted path]");
  });

  test("fails closed when an embedded path quote precedes a balanced value", () => {
    // arrange
    const failure = new Error("open '/tmp/O' Brien/private/secret.json 'x'", {
      cause: new Error(String.raw`open "C:\private\O" Brien\secret.json "x"`),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: open '[redacted path] -> open \"[redacted path]");
  });

  test("fails closed when later quoted fragments resemble path delimiters", () => {
    // arrange
    const failure = new Error("open '/tmp/private/file.json' value 'x/y' docs/errors '", {
      cause: new Error("open 'C:\\private\\O' docs/errors \\hidden\\secret.json'"),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: open '[redacted path] -> open '[redacted path]");
  });

  test("fails closed for separator-adjacent quotes across a cause chain", () => {
    // arrange
    const failure = new Error("open '/tmp/'private/secret.json'", {
      cause: new Error(String.raw`open "C:\private\"cache\secret.json"`),
    });

    // act
    const trailer = causeChainTrailer(redactCauseChain(failure));

    // assert
    assert.strictEqual(trailer, "cause: open '[redacted path] -> open \"[redacted path]");
  });

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
