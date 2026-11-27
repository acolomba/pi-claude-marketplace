import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify } from "strong-mock";

import {
  DEFAULT_CREDENTIAL_OPS,
  NO_STORED_CREDENTIAL_CAUSE,
  authBundleFor,
  buildAuthForHost,
  buildCloneAuth,
  buildGitHubAuth,
  buildStoredCredentialAuth,
  hostFromCloneUrl,
} from "../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import { createCredentialOps } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import { InvalidGitHubBaseUrlError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { CredentialGit } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type {
  ExtensionContext,
  NotificationContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

describe("DEFAULT_CREDENTIAL_OPS", () => {
  test("composes the platform credential protocol without launching a process", () => {
    // arrange
    const runs: unknown[] = [];
    const git: CredentialGit = (action) => {
      runs.push(action);
      throw new Error("composing the default credential ops must not run git");
    };

    const composed = createCredentialOps({ git, timeoutMs: 5_000 });

    // act
    const productionOps = DEFAULT_CREDENTIAL_OPS;

    // assert
    assert.deepStrictEqual(Object.keys(productionOps), Object.keys(composed));
    assert.deepStrictEqual(Object.keys(productionOps), ["fill", "approve", "reject"]);
    assert.deepStrictEqual(runs, []);
  });
});

describe("hostFromCloneUrl", () => {
  test("canonicalizes a GitHub source without parsing its clone URL", () => {
    // arrange
    const cloneUrl = "not a valid URL";

    // act
    const host = hostFromCloneUrl(cloneUrl, "github");

    // assert
    assert.strictEqual(host, "github.com");
  });

  test("extracts the host from a URL source", () => {
    // arrange
    const cloneUrl = "https://gitlab.com/team/plugin.git";

    // act
    const host = hostFromCloneUrl(cloneUrl, "url");

    // assert
    assert.strictEqual(host, "gitlab.com");
  });

  test("preserves the port in a git-subdir source host", () => {
    // arrange
    const cloneUrl = "https://git.example:8443/team/repository.git#plugin";

    // act
    const host = hostFromCloneUrl(cloneUrl, "git-subdir");

    // assert
    assert.strictEqual(host, "git.example:8443");
  });

  for (const { cloneUrl, expectedHost } of [
    { cloneUrl: "git@127.0.0.1:acme/tools", expectedHost: "127.0.0.1" },
    { cloneUrl: "git@[::1]:acme/tools.git", expectedHost: "[::1]" },
    { cloneUrl: "git@[::1", expectedHost: "[::1" },
    { cloneUrl: "git@host.example", expectedHost: "host.example" },
  ]) {
    test(`D-SG-17: binds the scp address ${cloneUrl} to ${expectedHost}`, () => {
      // act
      const host = hostFromCloneUrl(cloneUrl, "url");

      // assert
      assert.strictEqual(host, expectedHost);
    });
  }

  test("GHB-02: binds a GitHub source to the override host", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");

    // act
    const host = hostFromCloneUrl("https://github.com/acme/tools.git", "github");

    // assert
    assert.strictEqual(host, "mirror.example:8443");
  });

  test("D-09: binds a github.com git-subdir url to the override host", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");

    // act
    const host = hostFromCloneUrl("https://github.com/acme/tools.git#plugin", "git-subdir");

    // assert
    assert.strictEqual(host, "mirror.example:8443");
  });

  for (const cloneUrl of [
    "git@github.com:acme/tools",
    "ssh://git@GitHub.com/acme/tools.git",
    "https://www.github.com/acme/tools",
  ]) {
    test(`D-SG-23: binds the GitHub url address ${cloneUrl} to github.com`, (t) => {
      // arrange
      setGitHubBaseUrl(t, undefined);

      // act
      const host = hostFromCloneUrl(cloneUrl, "url");

      // assert
      assert.strictEqual(host, "github.com");
    });

    test(`D-SG-21: binds the GitHub url address ${cloneUrl} to the override host`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "https://mirror.example:8443/git");

      // act
      const host = hostFromCloneUrl(cloneUrl, "url");

      // assert
      assert.strictEqual(host, "mirror.example:8443");
    });
  }

  test("D-SG-21: binds a GitHub git-subdir scp address to the override host", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");

    // act
    const host = hostFromCloneUrl("git@ssh.github.com:/acme/tools.git", "git-subdir");

    // assert
    assert.strictEqual(host, "mirror.example:8443");
  });

  test("a url source host ignores an invalid override", (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");

    // act
    const host = hostFromCloneUrl("https://gitlab.example.com/acme/tools", "url");

    // assert
    assert.strictEqual(host, "gitlab.example.com");
  });
});

describe("authBundleFor", () => {
  test("gives every address the production credential surface", () => {
    // act
    const bundles = [
      authBundleFor("https://github.com/acme/tools.git", "github"),
      authBundleFor("https://gitlab.com/team/plugin.git", "url"),
    ];

    // assert
    assert.deepStrictEqual(
      bundles.map((bundle) => bundle.credentialOps),
      [DEFAULT_CREDENTIAL_OPS, DEFAULT_CREDENTIAL_OPS],
    );
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
    { cloneUrl: "git@[::1]:acme/tools.git", kind: "git-subdir", host: "[::1]" },
  ] as const) {
    test(`GAUTH-03 / D-SG-23: binds the ${kind} address ${cloneUrl} to ${host} with no override`, (t) => {
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
describe("buildAuthForHost", () => {
  for (const host of ["github.com", "gitlab.com", "git.example.invalid"]) {
    for (const mode of ["print", "json", "rpc", "tui"]) {
      test(`D-SG-27: binds ${host} to its stored credential on a ${mode} command run without signing in`, async () => {
        // arrange
        const ui = mock<NotificationContext["ui"]>({ exactParams: true, name: "UI" });
        const credentials = createCredentialOpsFake({
          boundary: "memory",
          credentials: [[host, { username: "stored", password: "secret" }]],
        });
        const auth = buildAuthForHost({
          host,
          ctx: { mode, hasUI: mode === "tui" || mode === "rpc", ui },
          run: runWithNothingLoaded(),
          credentialOps: credentials.credentialOps,
        });

        // act
        const credential = await auth.credentialOps.fill(auth.host);

        // assert
        assert.deepStrictEqual(auth, {
          kind: "stored-credential",
          credentialOps: credentials.credentialOps,
          host,
        });
        assert.deepStrictEqual(credential, { username: "stored", password: "secret" });
        assert.deepStrictEqual(credentials.calls, { fill: [{ host }], approve: [], reject: [] });
        verify(ui);
      });
    }
  }

  test("GAUTH-03: binds an unregistered host's stored credential to a bundle with no sign-in", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [["git.example.invalid", { username: "user", password: "stored-credential" }]],
    });
    const auth = buildAuthForHost({
      host: "git.example.invalid",
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    });

    // act
    const credential = await auth.credentialOps.fill(auth.host);

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "git.example.invalid",
    });
    assert.deepStrictEqual(credential, { username: "user", password: "stored-credential" });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: "git.example.invalid" }],
      approve: [],
      reject: [],
    });
    verify(ctx);
  });

  for (const host of ["github.com", "gitlab.com", "git.example.invalid"]) {
    test(`GAUTH-04 / D-SG-27: offers no sign-in on ${host} when its helper is empty`, async () => {
      // arrange
      const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
      const credentials = createCredentialOpsFake({ boundary: "memory" });
      const auth = buildAuthForHost({
        host,
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
      });

      // act
      const credential = await auth.credentialOps.fill(auth.host);

      // assert
      assert.deepStrictEqual(auth, {
        kind: "stored-credential",
        credentialOps: credentials.credentialOps,
        host,
      });
      assert.strictEqual(credential, null);
      assert.deepStrictEqual(credentials.calls, {
        fill: [{ host }],
        approve: [],
        reject: [],
      });
      verify(ctx);
    });
  }

  for (const host of ["github.com", "git.example.invalid"]) {
    test(`CR-01 / GAUTH-04: binds ${host} to the bundle that keeps a rejected credential`, () => {
      // arrange
      const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
      const irreplaceable = { username: "user", password: "self-hosted-token" };
      const credentials = createCredentialOpsFake({
        boundary: "memory",
        credentials: [[host, irreplaceable]],
      });

      // act
      const auth = buildAuthForHost({
        host,
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
      });

      // assert
      assert.deepStrictEqual(auth, {
        kind: "stored-credential",
        credentialOps: credentials.credentialOps,
        host,
      });
      assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
      assert.deepStrictEqual(credentials.storedCredential(host), irreplaceable);
      verify(ctx);
    });
  }

  test("AAP-02 / D-13: returns a stored-credential bundle for a registry host to a load run without notifying", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const { commandState: _commandState, ...snapshot } = runWithNothingLoaded();

    // act
    const auth = buildAuthForHost({
      host: "github.com",
      credentialOps: credentials.credentialOps,
      ctx,
      run: { ...snapshot, origin: { kind: "load" } },
    });

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "github.com",
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });
});

describe("buildStoredCredentialAuth", () => {
  test("binds a stored-credential bundle to the host without any credential I/O", () => {
    // arrange
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildStoredCredentialAuth("git.example.invalid", credentials.credentialOps);

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "git.example.invalid",
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  });

  test("D-3-04: binds a github.com helper miss to a bundle with no sign-in", async () => {
    // arrange
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const auth = buildStoredCredentialAuth("github.com", credentials.credentialOps);

    // act
    const credential = await auth.credentialOps.fill(auth.host);

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "github.com",
    });
    assert.strictEqual(credential, null);
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: "github.com" }],
      approve: [],
      reject: [],
    });
  });
});

describe("buildGitHubAuth", () => {
  test("GHB-02: returns a stored-credential bundle for the override host", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildGitHubAuth({
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    });

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "mirror.example:8443",
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });

  for (const { base, host } of [
    { base: "https://github.com/mirror", host: "github.com" },
    { base: "https://gitlab.com/mirror", host: "gitlab.com" },
  ]) {
    test(`D-04: binds a ${base} base to its host's stored credential`, (t) => {
      // arrange
      setGitHubBaseUrl(t, base);
      const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
      const credentials = createCredentialOpsFake({ boundary: "memory" });

      // act
      const auth = buildGitHubAuth({
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
      });

      // assert
      assert.deepStrictEqual(auth, {
        kind: "stored-credential",
        credentialOps: credentials.credentialOps,
        host,
      });
      verify(ctx);
    });
  }

  test("D-SG-27: returns the github.com stored-credential bundle when unset", (t) => {
    // arrange
    setGitHubBaseUrl(t, undefined);
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildGitHubAuth({
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    });

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "github.com",
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });

  test("GHB-03: throws the typed error for an invalid override", (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act & assert
    assert.throws(
      () =>
        buildGitHubAuth({
          credentialOps: credentials.credentialOps,
          ctx,
          run: runWithNothingLoaded(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof InvalidGitHubBaseUrlError);
        assert.deepStrictEqual(
          { variable: error.variable, problem: error.problem },
          { variable: "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", problem: "scheme" },
        );
        return true;
      },
    );
    verify(ctx);
  });
});

describe("buildCloneAuth", () => {
  test("binds a GitHub source to the github.com stored credential without parsing its clone URL", (t) => {
    // arrange
    setGitHubBaseUrl(t, undefined);
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildCloneAuth("not a valid URL", "github", {
      ctx,
      run: runWithNothingLoaded(),
      credentialOps: credentials.credentialOps,
    });

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "github.com",
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });

  test("D-SG-27: binds a gitlab.com url source to its stored credential", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [["gitlab.com", { username: "oauth2", password: "stored-secret" }]],
    });
    const authOptions = {
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    };
    const auth = buildCloneAuth("https://gitlab.com/team/plugin.git", "url", authOptions);

    // act
    const credential = await auth.credentialOps.fill(auth.host);

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "gitlab.com",
    });
    assert.deepStrictEqual(credential, {
      username: "oauth2",
      password: "stored-secret",
    });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: "gitlab.com" }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(Object.keys(authOptions), ["credentialOps", "ctx", "run"]);
    verify(ctx);
  });

  for (const { clone, kind, cloneUrl } of [
    { clone: "GHB-02: a GitHub", kind: "github", cloneUrl: "https://github.com/acme/tools.git" },
    {
      clone: "D-09: a github.com git-subdir",
      kind: "git-subdir",
      cloneUrl: "https://github.com/acme/tools.git#plugin",
    },
  ] as const) {
    test(`${clone} clone under the override gets the override-host stored credential`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "https://mirror.example:8443/git");
      const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
      const credentials = createCredentialOpsFake({ boundary: "memory" });

      // act
      const auth = buildCloneAuth(cloneUrl, kind, {
        ctx,
        run: runWithNothingLoaded(),
        credentialOps: credentials.credentialOps,
      });

      // assert
      assert.deepStrictEqual(auth, {
        kind: "stored-credential",
        credentialOps: credentials.credentialOps,
        host: "mirror.example:8443",
      });
      verify(ctx);
    });
  }

  test("binds an unregistered port-bearing git-subdir host to its own bundle", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildCloneAuth(
      "https://gitlab.com:8443/team/repository.git#plugin",
      "git-subdir",
      { ctx, run: runWithNothingLoaded(), credentialOps: credentials.credentialOps },
    );

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "gitlab.com:8443",
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });
});
