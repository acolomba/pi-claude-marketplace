import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  NO_STORED_CREDENTIAL_CAUSE,
  authBundleFor,
} from "../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import { InvalidGitHubBaseUrlError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";

describe("authBundleFor", () => {
  test("gives every address the same production credential surface", () => {
    // act
    const gitHubBundle = authBundleFor("https://github.com/acme/tools.git", "github");
    const gitLabBundle = authBundleFor("https://gitlab.com/team/plugin.git", "url");

    // assert
    assert.deepStrictEqual(Object.keys(gitHubBundle.credentialOps), ["fill", "approve", "reject"]);
    assert.strictEqual(gitLabBundle.credentialOps, gitHubBundle.credentialOps);
  });

  for (const { cloneUrl, kind, host } of [
    { cloneUrl: "not a valid URL", kind: "github", host: "github.com" },
    { cloneUrl: "https://github.com/acme/tools.git", kind: "github", host: "github.com" },
    { cloneUrl: "git@github.com:acme/tools", kind: "url", host: "github.com" },
    { cloneUrl: "ssh://git@GitHub.com/acme/tools.git", kind: "url", host: "github.com" },
    { cloneUrl: "ssh+git://git@github.com/acme/tools.git", kind: "url", host: "github.com" },
    { cloneUrl: "https://www.github.com/acme/tools", kind: "url", host: "github.com" },
    {
      cloneUrl: "https://github.com/acme/tools.git#plugin",
      kind: "git-subdir",
      host: "github.com",
    },
    { cloneUrl: "https://gitlab.com/team/plugin.git", kind: "url", host: "gitlab.com" },
    {
      cloneUrl: "https://git.example:8443/team/repository.git#plugin",
      kind: "git-subdir",
      host: "git.example:8443",
    },
    { cloneUrl: "git@git.example:team/plugin.git", kind: "url", host: "git.example" },
    { cloneUrl: "git@127.0.0.1:acme/tools", kind: "url", host: "127.0.0.1" },
    { cloneUrl: "git@[::1]:acme/tools.git", kind: "git-subdir", host: "[::1]" },
    { cloneUrl: "git@[::1", kind: "url", host: "[::1" },
    { cloneUrl: "git@host.example", kind: "url", host: "host.example" },
  ] as const) {
    test(`GAUTH-03 / D-SG-17 / D-SG-23: binds the ${kind} address ${cloneUrl} to ${host} with no override`, (t) => {
      // arrange
      setGitHubBaseUrl(t, undefined);

      // act
      const { credentialOps: _credentialOps, ...binding } = authBundleFor(cloneUrl, kind);

      // assert
      assert.deepStrictEqual(binding, { kind: "stored-credential", host });
    });
  }

  for (const { cloneUrl, kind, host } of [
    { cloneUrl: "not a valid URL", kind: "github", host: "mirror.example:8443" },
    { cloneUrl: "git@github.com:acme/tools", kind: "url", host: "mirror.example:8443" },
    { cloneUrl: "ssh://git@GitHub.com/acme/tools.git", kind: "url", host: "mirror.example:8443" },
    {
      cloneUrl: "ssh+git://git@github.com/acme/tools.git",
      kind: "url",
      host: "mirror.example:8443",
    },
    { cloneUrl: "https://www.github.com/acme/tools", kind: "url", host: "mirror.example:8443" },
    {
      cloneUrl: "https://github.com/acme/tools.git#plugin",
      kind: "git-subdir",
      host: "mirror.example:8443",
    },
    {
      cloneUrl: "git@ssh.github.com:/acme/tools.git",
      kind: "git-subdir",
      host: "mirror.example:8443",
    },
    { cloneUrl: "https://gitlab.com/team/plugin.git", kind: "url", host: "gitlab.com" },
    { cloneUrl: "git@git.example:team/plugin.git", kind: "url", host: "git.example" },
  ] as const) {
    test(`GHB-02 / D-SG-21: binds the ${kind} address ${cloneUrl} to ${host} under the override`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "https://mirror.example:8443/git");

      // act
      const { credentialOps: _credentialOps, ...binding } = authBundleFor(cloneUrl, kind);

      // assert
      assert.deepStrictEqual(binding, { kind: "stored-credential", host });
    });
  }

  for (const { cloneUrl, kind } of [
    { cloneUrl: "https://github.com/acme/tools.git", kind: "github" },
    { cloneUrl: "git@github.com:acme/tools", kind: "url" },
    { cloneUrl: "https://github.com/acme/tools.git#plugin", kind: "git-subdir" },
  ] as const) {
    test(`GHB-03: throws the typed error for the ${kind} address ${cloneUrl} under an invalid override`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "http://mirror.example");

      // act & assert
      assert.throws(
        () => authBundleFor(cloneUrl, kind),
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
  }

  for (const { base, host } of [
    { base: "https://github.com/mirror", host: "github.com" },
    { base: "https://gitlab.com/mirror", host: "gitlab.com" },
  ]) {
    test(`D-04: binds a GitHub source under a ${base} base to ${host}`, (t) => {
      // arrange
      setGitHubBaseUrl(t, base);

      // act
      const { credentialOps: _credentialOps, ...binding } = authBundleFor(
        "https://github.com/acme/tools.git",
        "github",
      );

      // assert
      assert.deepStrictEqual(binding, { kind: "stored-credential", host });
    });
  }

  test("GHB-04: binds a url address outside GitHub under an invalid override", (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");

    // act
    const { credentialOps: _credentialOps, ...binding } = authBundleFor(
      "https://gitlab.example.com:8443/acme/tools",
      "url",
    );

    // assert
    assert.deepStrictEqual(binding, { kind: "stored-credential", host: "gitlab.example.com:8443" });
  });
});

describe("NO_STORED_CREDENTIAL_CAUSE", () => {
  test("names the host and the command that stores a credential for it", () => {
    // arrange
    const host = "git.example:8443";

    // act
    const cause = NO_STORED_CREDENTIAL_CAUSE(host);

    // assert
    assert.strictEqual(
      cause,
      "no credential was obtained for git.example:8443; store one with: printf " +
        "'protocol=https\\nhost=git.example:8443\\nusername=<user>\\npassword=<token>\\n\\n' " +
        "| git credential approve",
    );
  });
});
