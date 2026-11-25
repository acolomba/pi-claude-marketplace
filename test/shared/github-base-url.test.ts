import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InvalidGitHubBaseUrlError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  gitHubAddressOf,
  gitHubInsteadOfPairs,
  gitHubOverrideHost,
  gitHubWireUrl,
} from "../../extensions/pi-claude-marketplace/shared/github-base-url.ts";

import { setGitHubBaseUrl } from "./github-base-url-environment.ts";

const GITHUB_URL = "https://github.com/acme/tools.git";

const EXPECTED_MESSAGES = {
  "not-a-url": "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL is not a valid URL.",
  scheme: "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must use the https scheme.",
  userinfo: "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must not contain a user name or password.",
  query: "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must not contain a query.",
  fragment: "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must not contain a fragment.",
  "equals-sign": "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must not contain an equals sign.",
} as const;

describe("gitHubWireUrl", () => {
  for (const { state, value } of [
    { state: "unset", value: undefined },
    { state: "empty", value: "" },
  ]) {
    test(`returns a github.com URL unchanged when the variable is ${state}`, (t) => {
      // arrange
      setGitHubBaseUrl(t, value);

      // act
      const wireUrl = gitHubWireUrl(GITHUB_URL);

      // assert
      assert.strictEqual(wireUrl, GITHUB_URL);
    });
  }

  for (const { base, url, expectedWireUrl } of [
    {
      base: "https://mirror.example",
      url: GITHUB_URL,
      expectedWireUrl: "https://mirror.example/acme/tools.git",
    },
    {
      base: "https://mirror.example",
      url: "https://github.com/acme/tools",
      expectedWireUrl: "https://mirror.example/acme/tools",
    },
    {
      base: "https://mirror.example/git",
      url: GITHUB_URL,
      expectedWireUrl: "https://mirror.example/git/acme/tools.git",
    },
    {
      base: "https://mirror.example/git/",
      url: GITHUB_URL,
      expectedWireUrl: "https://mirror.example/git/acme/tools.git",
    },
    {
      base: "https://mirror.example/git//",
      url: GITHUB_URL,
      expectedWireUrl: "https://mirror.example/git/acme/tools.git",
    },
    {
      base: "https://Mirror.Example:443/git/",
      url: GITHUB_URL,
      expectedWireUrl: "https://mirror.example/git/acme/tools.git",
    },
    {
      base: "https://127.0.0.1:8443",
      url: GITHUB_URL,
      expectedWireUrl: "https://127.0.0.1:8443/acme/tools.git",
    },
    {
      base: "https://[::1]:9/",
      url: GITHUB_URL,
      expectedWireUrl: "https://[::1]:9/acme/tools.git",
    },
    {
      base: "HTTPS://mirror.example",
      url: GITHUB_URL,
      expectedWireUrl: "https://mirror.example/acme/tools.git",
    },
  ]) {
    test(`GHB-01: sends ${url} to ${expectedWireUrl} under base ${base}`, (t) => {
      // arrange
      setGitHubBaseUrl(t, base);

      // act
      const wireUrl = gitHubWireUrl(url);

      // assert
      assert.strictEqual(wireUrl, expectedWireUrl);
    });
  }

  for (const { url, expectedWireUrl } of [
    { url: "git@github.com:acme/ghp.git", expectedWireUrl: "https://mirror.example/acme/ghp.git" },
    {
      url: "https://GitHub.com/acme/tools.git",
      expectedWireUrl: "https://mirror.example/acme/tools.git",
    },
    {
      url: "https://www.github.com/Acme/Tools/",
      expectedWireUrl: "https://mirror.example/Acme/Tools/",
    },
    {
      url: "https://github.com:443/acme/tools.git",
      expectedWireUrl: "https://mirror.example/acme/tools.git",
    },
    {
      url: "ssh://git@github.com/acme/tools.git",
      expectedWireUrl: "https://mirror.example/acme/tools.git",
    },
    {
      url: "git+ssh://git@ssh.github.com:443/acme/tools",
      expectedWireUrl: "https://mirror.example/acme/tools",
    },
    {
      url: "git@ssh.github.com:/acme/tools.GIT",
      expectedWireUrl: "https://mirror.example/acme/tools.GIT",
    },
  ]) {
    test(`D-SG-21: sends the GitHub spelling ${url} to ${expectedWireUrl}`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "https://mirror.example");

      // act
      const wireUrl = gitHubWireUrl(url);

      // assert
      assert.strictEqual(wireUrl, expectedWireUrl);
    });
  }

  for (const url of [
    "https://github.com.evil.example/acme/tools.git",
    "https://evil.example/github.com/acme/tools.git",
    "https://gitlab.com/acme/tools.git",
    "https://github.com",
    "https://mirror.example/acme/tools.git",
    "ssh+git://git@github.com/acme/tools",
    "git@gitlab.example:acme/tools.git",
  ]) {
    test(`returns ${url} unchanged because it is no GitHub address`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "https://mirror.example");

      // act
      const wireUrl = gitHubWireUrl(url);

      // assert
      assert.strictEqual(wireUrl, url);
    });
  }

  test("does not read an invalid variable for a URL outside github.com", (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");

    // act
    const wireUrl = gitHubWireUrl("https://gitlab.com/acme/tools.git");

    // assert
    assert.strictEqual(wireUrl, "https://gitlab.com/acme/tools.git");
  });

  test("reads the variable again on every call", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://a.example");
    const firstWireUrl = gitHubWireUrl(GITHUB_URL);
    setGitHubBaseUrl(t, "https://b.example");

    // act
    const secondWireUrl = gitHubWireUrl(GITHUB_URL);

    // assert
    assert.deepStrictEqual(
      [firstWireUrl, secondWireUrl],
      ["https://a.example/acme/tools.git", "https://b.example/acme/tools.git"],
    );
  });

  for (const { base, problem } of [
    { base: "http://mirror.example", problem: "scheme" },
    { base: "ftp://mirror.example", problem: "scheme" },
    { base: "https://user:secret@mirror.example", problem: "userinfo" },
    { base: "https://:secret@mirror.example", problem: "userinfo" },
    { base: "https://user@mirror.example", problem: "userinfo" },
    { base: "https://mirror.example/git?a=1", problem: "query" },
    { base: "https://mirror.example/?", problem: "query" },
    { base: "https://mirror.example/#", problem: "fragment" },
    { base: "https://mirror.example/git#main", problem: "fragment" },
    { base: "https://", problem: "not-a-url" },
    { base: "   ", problem: "not-a-url" },
    { base: "https://mirror.example:0x", problem: "not-a-url" },
    { base: "http://user:secret@mirror.example/?a#b", problem: "scheme" },
    { base: "https://h.example/a=b", problem: "equals-sign" },
    { base: "https://a=b.example", problem: "equals-sign" },
  ] as const) {
    test(`GHB-03: refuses base ${JSON.stringify(base)} for its ${problem} without echoing it`, (t) => {
      // arrange
      setGitHubBaseUrl(t, base);

      // act & assert
      assert.throws(
        () => gitHubWireUrl(GITHUB_URL),
        (error: unknown) => {
          assert.ok(error instanceof InvalidGitHubBaseUrlError);
          assert.deepStrictEqual(
            {
              name: error.name,
              variable: error.variable,
              problem: error.problem,
              message: error.message,
            },
            {
              name: "InvalidGitHubBaseUrlError",
              variable: "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
              problem,
              message: EXPECTED_MESSAGES[problem],
            },
          );
          return true;
        },
      );
    });
  }
});

describe("gitHubInsteadOfPairs", () => {
  for (const { state, value } of [
    { state: "unset", value: undefined },
    { state: "empty", value: "" },
  ]) {
    test(`D-SG-16: gives a github.com URL no pair when the variable is ${state}`, (t) => {
      // arrange
      setGitHubBaseUrl(t, value);

      // act
      const pairs = gitHubInsteadOfPairs(GITHUB_URL);

      // assert
      assert.deepStrictEqual(pairs, []);
    });
  }

  for (const base of ["https://127.0.0.1:4443/base/", "https://127.0.0.1:4443/base//"]) {
    test(`D-SG-16: rewrites https://github.com/ to base ${base} as one insteadOf pair`, (t) => {
      // arrange
      setGitHubBaseUrl(t, base);

      // act
      const pairs = gitHubInsteadOfPairs(GITHUB_URL);

      // assert
      assert.deepStrictEqual(pairs, [
        "url.https://127.0.0.1:4443/base/.insteadOf=https://github.com/",
      ]);
    });
  }

  for (const { url, expectedPair } of [
    {
      url: "git@github.com:acme/ghp.git",
      expectedPair: "url.https://127.0.0.1:4443/base/.insteadOf=git@github.com:",
    },
    {
      url: "org-1@GitHub.com:acme/ghp.git",
      expectedPair: "url.https://127.0.0.1:4443/base/.insteadOf=org-1@GitHub.com:",
    },
    {
      url: "git@ssh.github.com:/acme/ghp.git",
      expectedPair: "url.https://127.0.0.1:4443/base/.insteadOf=git@ssh.github.com:/",
    },
    {
      url: "ssh://git@github.com/acme/ghp.git",
      expectedPair: "url.https://127.0.0.1:4443/base/.insteadOf=ssh://git@github.com/",
    },
    {
      url: "git+ssh://git@ssh.github.com:443/acme/ghp",
      expectedPair: "url.https://127.0.0.1:4443/base/.insteadOf=git+ssh://git@ssh.github.com:443/",
    },
    {
      url: "https://www.github.com/acme/ghp",
      expectedPair: "url.https://127.0.0.1:4443/base/.insteadOf=https://www.github.com/",
    },
  ]) {
    test(`D-SG-21: rewrites the prefix of ${url} to the base as its own pair`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "https://127.0.0.1:4443/base");

      // act
      const pairs = gitHubInsteadOfPairs(url);

      // assert
      assert.deepStrictEqual(pairs, [expectedPair]);
    });
  }

  test("D-SG-21: gives an scp GitHub address no pair while the variable is unset", (t) => {
    // arrange
    setGitHubBaseUrl(t, undefined);

    // act
    const pairs = gitHubInsteadOfPairs("git@github.com:acme/ghp.git");

    // assert
    assert.deepStrictEqual(pairs, []);
  });

  for (const url of ["https://gitlab.com/x.git", "git@gitlab.example:acme/ghp.git"]) {
    test(`GHB-04: gives ${url} no pair and does not read an invalid variable`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "http://mirror.example");

      // act
      const pairs = gitHubInsteadOfPairs(url);

      // assert
      assert.deepStrictEqual(pairs, []);
    });
  }

  for (const url of [GITHUB_URL, "git@github.com:acme/ghp.git"]) {
    test(`GHB-03: refuses a base with an equals sign for ${url}, which would break the config key`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "https://h.example/a=b");

      // act & assert
      assert.throws(
        () => gitHubInsteadOfPairs(url),
        (error: unknown) => {
          assert.ok(error instanceof InvalidGitHubBaseUrlError);
          assert.strictEqual(error.problem, "equals-sign");
          return true;
        },
      );
    });
  }
});

describe("gitHubAddressOf", () => {
  for (const { address, prefix } of [
    { address: "https://github.com/acme/tools.git", prefix: "https://github.com/" },
    { address: "https://www.github.com/Acme/Tools/", prefix: "https://www.github.com/" },
    { address: "http://github.com/acme/tools", prefix: "http://github.com/" },
    { address: "git+https://github.com/acme/tools", prefix: "git+https://github.com/" },
    { address: "git+http://github.com./acme/tools", prefix: "git+http://github.com./" },
    { address: "git://github.com/acme/tools", prefix: "git://github.com/" },
    { address: "ssh://git@github.com/acme/tools.git", prefix: "ssh://git@github.com/" },
    {
      address: "git+ssh://git@ssh.github.com:443/acme/tools",
      prefix: "git+ssh://git@ssh.github.com:443/",
    },
    { address: "https://github.com/acme/tools?tab=readme", prefix: "https://github.com/" },
    { address: "git@github.com:Acme/Tools.git", prefix: "git@github.com:" },
    { address: "org-1@github.com:acme/tools.git", prefix: "org-1@github.com:" },
    { address: "github.com:acme/tools", prefix: "github.com:" },
    { address: "git@ssh.github.com:/acme/tools.GIT", prefix: "git@ssh.github.com:/" },
  ]) {
    test(`D-SG-23: folds ${address} to acme/tools after ${prefix}`, () => {
      // arrange
      const expectedAddress = { prefix, repository: "acme/tools" };

      // act
      const gitHubAddress = gitHubAddressOf(address);

      // assert
      assert.deepStrictEqual(gitHubAddress, expectedAddress);
    });
  }

  for (const { address, reason } of [
    { address: "ssh+git://git@github.com/acme/tools", reason: "ssh+git is no folding protocol" },
    { address: "https://gitlab.com/acme/tools", reason: "its host is not GitHub" },
    { address: "https://ssh.github.com/acme/tools", reason: "ssh.github.com serves only ssh" },
    { address: "https://github.com/acme", reason: "its path has one segment" },
    { address: "https://github.com/acme/tools/extra", reason: "its path has three segments" },
    { address: "https://github.com/-acme/tools", reason: "its owner starts with a dash" },
    { address: "https://github.com/acme/tools/.", reason: "its path ends in /." },
    { address: "https://github.com/acme/..", reason: "its path ends in /.." },
    { address: "https://github.com", reason: "it has no path" },
    { address: "https://github.com?acme/tools", reason: "a query follows its authority" },
    { address: "https://git%68ub.com/acme/tools", reason: "its host is percent-encoded" },
    { address: "https://[::1]/acme/tools", reason: "it holds a bracket" },
    { address: "git@github.com:acme/[tools]", reason: "it holds a bracket" },
    { address: "https://github.com\\@evil.example/acme/tools", reason: "it holds a backslash" },
    { address: "https://gïthub.com/acme/tools", reason: "its host is not ASCII" },
    { address: "https://github.com/acme/tools\u0000", reason: "it holds a control character" },
    { address: "https://github.com/acme%00/tools", reason: "it holds %00" },
    { address: "acme:x@github.com/acme/tools", reason: "its scp @ follows its colon" },
    { address: "evil.example/x:acme/tools", reason: "a / precedes its scp colon" },
    { address: "git@git%68ub.com:acme/tools", reason: "its scp host is percent-encoded" },
    { address: "git@gitlab.example:acme/tools.git", reason: "its scp host is not GitHub" },
    { address: "acme/tools", reason: "it is a bare owner/repo" },
    { address: "http://", reason: "it is no URL" },
  ]) {
    test(`D-SG-23: folds no repository from ${JSON.stringify(address)} because ${reason}`, () => {
      // act
      const gitHubAddress = gitHubAddressOf(address);

      // assert
      assert.strictEqual(gitHubAddress, undefined);
    });
  }

  test("reads no variable, so an invalid base does not affect the fold", (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");

    // act
    const gitHubAddress = gitHubAddressOf("git@github.com:acme/tools.git");

    // assert
    assert.deepStrictEqual(gitHubAddress, { prefix: "git@github.com:", repository: "acme/tools" });
  });
});

describe("gitHubOverrideHost", () => {
  for (const { state, value } of [
    { state: "unset", value: undefined },
    { state: "empty", value: "" },
  ]) {
    test(`returns no host when the variable is ${state}`, (t) => {
      // arrange
      setGitHubBaseUrl(t, value);

      // act
      const host = gitHubOverrideHost();

      // assert
      assert.strictEqual(host, undefined);
    });
  }

  for (const { base, expectedHost } of [
    { base: "https://mirror.example:443/git", expectedHost: "mirror.example" },
    { base: "https://mirror.example:8443/git", expectedHost: "mirror.example:8443" },
    { base: "https://[::1]:9/", expectedHost: "[::1]:9" },
    { base: "https://Mirror.Example", expectedHost: "mirror.example" },
  ]) {
    test(`GHB-02: binds base ${base} to host ${expectedHost}`, (t) => {
      // arrange
      setGitHubBaseUrl(t, base);

      // act
      const host = gitHubOverrideHost();

      // assert
      assert.strictEqual(host, expectedHost);
    });
  }

  test("GHB-03: refuses an invalid base with the typed error", (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");

    // act & assert
    assert.throws(
      () => gitHubOverrideHost(),
      (error: unknown) => {
        assert.ok(error instanceof InvalidGitHubBaseUrlError);
        assert.deepStrictEqual(
          { variable: error.variable, problem: error.problem },
          { variable: "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", problem: "scheme" },
        );
        return true;
      },
    );
  });
});
