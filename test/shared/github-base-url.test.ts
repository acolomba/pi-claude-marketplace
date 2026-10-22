import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InvalidGitHubBaseUrlError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
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

  for (const url of [
    "https://GitHub.com/acme/tools.git",
    "https://www.github.com/acme/tools.git",
    "https://github.com:443/acme/tools.git",
    "https://github.com.evil.example/acme/tools.git",
    "https://evil.example/github.com/acme/tools.git",
    "https://gitlab.com/acme/tools.git",
    "https://github.com",
    "https://mirror.example/acme/tools.git",
  ]) {
    test(`returns ${url} unchanged because it lacks the exact github.com prefix`, (t) => {
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
