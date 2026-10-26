import assert from "node:assert/strict";
import test from "node:test";

import { InvalidGitHubBaseUrlError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { resolveCommandError } from "../../extensions/pi-claude-marketplace/shared/notification-command-error.ts";

for (const root of [
  "\\",
  "C:\\",
  "C:/",
  "\\\\host\\share\\",
  "\\\\?\\UNC\\host\\share\\",
  "\\\\?\\C:\\",
  "/",
  "//host/share/",
  "file:///",
]) {
  for (const { directory, ambiguous } of [
    { directory: "ClientLedger", ambiguous: false },
    { directory: "PrivateVault", ambiguous: false },
    { directory: "Client Ledger 用户", ambiguous: false },
    { directory: "O'ClientLedger", ambiguous: true },
    { directory: "'ClientLedger'", ambiguous: true },
    { directory: '"ClientLedger"', ambiguous: true },
    { directory: "<ClientLedger>", ambiguous: true },
    { directory: "\nClientLedger", ambiguous: true },
    { directory: "\r\nClientLedger", ambiguous: true },
    { directory: "\tClientLedger", ambiguous: true },
    { directory: "\u2028ClientLedger", ambiguous: true },
    { directory: "\u2029ClientLedger", ambiguous: true },
  ]) {
    for (const quote of ["", "'", '"', "`"]) {
      test(`root-form matrix: ${JSON.stringify({ root, directory, quote })}`, () => {
        // arrange
        const separator = root.includes("\\") ? "\\" : "/";
        const localPath = `${root}${directory}${separator}secret.json`;
        const message = `open ${quote}${localPath}${quote}`;
        const safeMessage = ambiguous
          ? "Command failure details omitted."
          : `open ${quote}[path]${quote}`;

        // act
        const presentation = resolveCommandError(new Error(message, { cause: "unchanged" }), true);

        // assert
        assert.deepStrictEqual(presentation, {
          kind: "internal-error",
          severity: "error",
          needsReload: true,
          summary: "Command failed unexpectedly.",
          cause: { causeChain: [safeMessage, "unchanged"], truncated: false },
        });
      });
    }
  }
}

for (const localPath of [
  "/tmp/review-absent/'Confidential Client'/secret.json",
  "/tmp/review-absent/O'Connor/secret.json",
  "/tmp/review-absent/\nConfidential Client/secret.json",
  "/Users/<Confidential Client>/secret.json",
  '/Users/"Confidential Client"/secret.json',
  "/Users/`Confidential Client`/secret.json",
  "/Users/\r\nConfidential Client/secret.json",
  "/Users/\tConfidential Client/secret.json",
  "C:\\Users\\O'Connor\\secret.json",
  "\\\\server\\'Confidential Client'\\secret.json",
  "file:///Users/<Confidential Client>/secret.json",
]) {
  for (const message of [localPath, `open '${localPath}'`, `open "${localPath}"`]) {
    test(`omits ambiguous path details from ${JSON.stringify(message)}`, () => {
      // arrange
      const cause = new Error(message, { cause: new Error("unchanged cause") });

      // act
      const presentation = resolveCommandError(cause, true);

      // assert
      assert.deepStrictEqual(presentation, {
        kind: "internal-error",
        severity: "error",
        needsReload: true,
        summary: "Command failed unexpectedly.",
        cause: {
          causeChain: ["Command failure details omitted.", "unchanged cause"],
          truncated: false,
        },
      });
      assert.strictEqual(JSON.stringify(presentation).includes("Confidential Client"), false);
      assert.strictEqual(JSON.stringify(presentation).includes("Connor"), false);
    });
  }
}

for (const localPath of [
  "/Private Data/client/secret.json",
  "/用户/秘密/config.json",
  "C:\\Private Data\\client\\secret.json",
  "C:\\用户\\秘密\\config.json",
  "C://Private Data/秘密/config.json",
  "//server/Private Data/秘密.json",
  "/private/work/config.json",
  "/secret.json",
  "file:///Private Data/秘密/config.json",
  "\\\\server\\Private Data\\秘密.json",
]) {
  for (const { message, safeMessage } of [
    { message: `ENOENT: open "${localPath}"`, safeMessage: 'ENOENT: open "[path]"' },
    { message: `open '${localPath}' failed`, safeMessage: "open '[path]' failed" },
    { message: `failed at:${localPath}`, safeMessage: "failed at:[path]" },
    { message: `failed at ${localPath}`, safeMessage: "failed at [path]" },
  ]) {
    test(`hides the complete local path in ${message}`, () => {
      // arrange
      const cause = new Error(message, { cause: new Error(message) });

      // act
      const presentation = resolveCommandError(cause, true);

      // assert
      assert.deepStrictEqual(presentation, {
        kind: "internal-error",
        severity: "error",
        needsReload: true,
        summary: "Command failed unexpectedly.",
        cause: { causeChain: [safeMessage, safeMessage], truncated: false },
      });
      assert.strictEqual(
        JSON.stringify(presentation).includes(JSON.stringify(localPath).slice(1, -1)),
        false,
      );
    });
  }
}

for (const { title, cause, causeChain } of [
  {
    title: "unterminated path quote",
    cause: "open '/private/work/config.json",
    causeChain: ["Command failure details omitted."],
  },
  {
    title: "backtick-wrapped path",
    cause: "open `/private/work/config.json`",
    causeChain: ["open `[path]`"],
  },
  {
    title: "remote URL before a local path",
    cause: 'https://user:private@host/repo failed at "/Private Data/config.json"',
    causeChain: ['https://***@host/repo failed at "[path]"'],
  },
  {
    title: "URL-like text inside a local path",
    cause: "/Private Data/https://host/Confidential Client/secret.json",
    causeChain: ["[path]"],
  },
  {
    title: "Unicode line separator in a path",
    cause: "/Users/\u2028Confidential Client/secret.json",
    causeChain: ["Command failure details omitted."],
  },
  {
    title: "Unicode paragraph separator in a path",
    cause: "/Users/\u2029Confidential Client/secret.json",
    causeChain: ["Command failure details omitted."],
  },
  {
    title: "nested credentials",
    cause: new Error("https://user:secret@host/repo", {
      cause: new Error("Bearer secret123 ghp_abcdefghijklmnop x-access-token:private"),
    }),
    causeChain: ["https://***@host/repo", "Bearer *** *** x-access-token:***"],
  },
  { title: "POSIX path", cause: "/private/work/config.json", causeChain: ["[path]"] },
  { title: "Windows path", cause: "C:\\private\\work\\config.json", causeChain: ["[path]"] },
  { title: "bare UNC root", cause: "\\\\server", causeChain: ["[path]"] },
  { title: "UNC share", cause: "\\\\server\\share\\config.json", causeChain: ["[path]"] },
  { title: "file URL", cause: "file:///private/work/config.json", causeChain: ["[path]"] },
  {
    title: "single-slash file URL",
    cause: "file:/private/work/config.json",
    causeChain: ["[path]"],
  },
  { title: "plain string", cause: "failed", causeChain: ["failed"] },
  {
    title: "arbitrary object",
    cause: {
      secret: "private",
      toString() {
        throw new Error("Must not stringify");
      },
    },
    causeChain: ["[object Object]"],
  },
]) {
  test(`resolves ${title} to bounded plain facts`, () => {
    // arrange
    const needsReload = false;

    // act
    const presentation = resolveCommandError(cause, needsReload);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "internal-error",
      severity: "error",
      needsReload: false,
      summary: "Command failed unexpectedly.",
      cause: { causeChain, truncated: false },
    });
  });
}

for (const { length, truncated } of [
  { length: 5, truncated: false },
  { length: 7, truncated: true },
]) {
  test(`bounds a ${length}-link cause chain with truncated ${truncated}`, () => {
    // arrange
    let cause = new Error(`link-${length}`);
    for (let index = length - 1; index > 0; index--) {
      cause = new Error(`link-${index}`, { cause });
    }

    // act
    const presentation = resolveCommandError(cause, false);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "internal-error",
      severity: "error",
      needsReload: false,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: ["link-1", "link-2", "link-3", "link-4", "link-5"], truncated },
    });
  });
}

test("terminates a self-referencing cause without marking it truncated", () => {
  // arrange
  const cause = new Error("self");
  cause.cause = cause;

  // act
  const presentation = resolveCommandError(cause, false);

  // assert
  assert.deepStrictEqual(presentation, {
    kind: "internal-error",
    severity: "error",
    needsReload: false,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["self"], truncated: false },
  });
});

test("bounds a multi-error cycle using the existing depth semantics", () => {
  // arrange
  const cause = new Error("first");
  cause.cause = new Error("second", { cause });

  // act
  const presentation = resolveCommandError(cause, false);

  // assert
  assert.deepStrictEqual(presentation, {
    kind: "internal-error",
    severity: "error",
    needsReload: false,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["first", "second", "first", "second", "first"], truncated: true },
  });
});

test("contains a throwing Error message without exposing the secondary failure", () => {
  // arrange
  const cause = new Error("failure");
  Object.defineProperty(cause, "message", {
    get() {
      throw new Error("private message");
    },
  });

  // act
  const presentation = resolveCommandError(cause, false);

  // assert
  assert.deepStrictEqual(presentation, {
    kind: "internal-error",
    severity: "error",
    needsReload: false,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["Unable to read command failure."], truncated: false },
  });
});

test("contains a throwing object string tag without exposing the secondary failure", () => {
  // arrange
  const cause = {
    get [Symbol.toStringTag](): string {
      throw new Error("private tag");
    },
  };

  // act
  const presentation = resolveCommandError(cause, false);

  // assert
  assert.deepStrictEqual(presentation, {
    kind: "internal-error",
    severity: "error",
    needsReload: false,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["Unable to read command failure."], truncated: false },
  });
});

for (const needsReload of [false, true]) {
  test(`resolves a command error with reload ${needsReload}`, () => {
    // arrange
    const cause = new Error("Failed at /private/work/config.json", { cause: new Error("nested") });

    // act
    const presentation = resolveCommandError(cause, needsReload);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "internal-error",
      severity: "error",
      needsReload,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: ["Failed at [path]", "nested"], truncated: false },
    });
  });
}

for (const cause of [null, undefined]) {
  test(`resolves thrown ${String(cause)} to a nonempty cause`, () => {
    // arrange
    const needsReload = false;

    // act
    const presentation = resolveCommandError(cause, needsReload);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "internal-error",
      severity: "error",
      needsReload: false,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: ["Unknown thrown value."], truncated: false },
    });
  });
}

test("contains a throwing cause accessor without serializing the secondary error", () => {
  // arrange
  class HostileError extends Error {
    override get cause(): unknown {
      throw new Error("secret");
    }
  }

  // act
  const presentation = resolveCommandError(new HostileError("failure"), true);

  // assert
  assert.deepStrictEqual(presentation, {
    kind: "internal-error",
    severity: "error",
    needsReload: true,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["Unable to read command failure."], truncated: false },
  });
});

test("GHB-03: a command failing on an invalid base reports the variable unredacted", () => {
  // arrange
  const invalid = new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme");

  // act
  const presentation = resolveCommandError(invalid, false);

  // assert
  assert.deepStrictEqual(presentation, {
    kind: "internal-error",
    severity: "error",
    needsReload: false,
    summary: "Command failed unexpectedly.",
    cause: {
      causeChain: ["PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must use the https scheme."],
      truncated: false,
    },
  });
});
