import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  findProviderForHost,
  GITHUB_PROVIDER,
  type DeviceFlowProvider,
  type GitAuthProvider,
} from "../../extensions/pi-claude-marketplace/domain/auth-registry.ts";

void ({
  id: "provider",
  kind: "device-flow",
  hostMatch: (host: string) => host === "git.example",
  deviceCodeUrl: "https://git.example/device",
  tokenUrl: "https://git.example/token",
  clientId: "client-id",
  scope: "read",
  credentialFrom: (accessToken: string) => ({ username: "oauth2", password: accessToken }),
} satisfies GitAuthProvider);
// @ts-expect-error A provider supplies its credential mapping.
const incompleteProvider: DeviceFlowProvider = {
  id: "provider",
  kind: "device-flow",
  hostMatch: () => true,
  deviceCodeUrl: "https://git.example/device",
  tokenUrl: "https://git.example/token",
  clientId: "client-id",
  scope: "read",
};
void incompleteProvider;

describe("GITHUB_PROVIDER", () => {
  test("exposes the complete GitHub descriptor", () => {
    // arrange
    const expectedDescriptor = {
      id: "github",
      host: { name: "github.com", matches: true },
      deviceCodeUrl: "https://github.com/login/device/code",
      tokenUrl: "https://github.com/login/oauth/access_token",
      clientId: "Ov23liNcyK08uGdU0mMl",
      scope: "repo",
      credentialsByEnvironment: {
        GH_TOKEN: { username: "x-access-token", password: "GH_TOKEN" },
        GITHUB_TOKEN: { username: "x-access-token", password: "GITHUB_TOKEN" },
      },
    };

    // act
    const descriptor = {
      id: GITHUB_PROVIDER.id,
      host: { name: "github.com", matches: GITHUB_PROVIDER.hostMatch("github.com") },
      deviceCodeUrl: GITHUB_PROVIDER.deviceCodeUrl,
      tokenUrl: GITHUB_PROVIDER.tokenUrl,
      clientId: GITHUB_PROVIDER.clientId,
      scope: GITHUB_PROVIDER.scope,
      credentialsByEnvironment: {
        GH_TOKEN: GITHUB_PROVIDER.credentialFrom("GH_TOKEN"),
        GITHUB_TOKEN: GITHUB_PROVIDER.credentialFrom("GITHUB_TOKEN"),
      },
    };

    // assert
    assert.deepStrictEqual(descriptor, expectedDescriptor);
  });
});

describe("GitLab provider lookup", () => {
  test("exposes the complete GitLab descriptor", () => {
    // arrange
    const expectedDescriptor = {
      id: "gitlab",
      host: { name: "gitlab.com", matches: true },
      deviceCodeUrl: "https://gitlab.com/oauth/authorize_device",
      tokenUrl: "https://gitlab.com/oauth/token",
      clientId: "bb5b5605c21f02f3b41991e3d5f713488b4f0c5cf969de8f7d82f2811f99192d",
      scope: "read_repository",
      credentialsByEnvironment: {
        GITLAB_TOKEN: { username: "oauth2", password: "GITLAB_TOKEN" },
      },
    };

    // act
    const gitlabProvider = findProviderForHost("gitlab.com");
    assert.ok(gitlabProvider !== undefined);
    if (gitlabProvider.kind !== "device-flow") {
      assert.fail("gitlab.com must resolve to a device-flow provider");
    }

    const descriptor = {
      id: gitlabProvider.id,
      host: { name: "gitlab.com", matches: gitlabProvider.hostMatch("gitlab.com") },
      deviceCodeUrl: gitlabProvider.deviceCodeUrl,
      tokenUrl: gitlabProvider.tokenUrl,
      clientId: gitlabProvider.clientId,
      scope: gitlabProvider.scope,
      credentialsByEnvironment: {
        GITLAB_TOKEN: gitlabProvider.credentialFrom("GITLAB_TOKEN"),
      },
    };

    // assert
    assert.deepStrictEqual(descriptor, expectedDescriptor);
  });
});

describe("findProviderForHost", () => {
  test("returns the exact GitHub descriptor for github.com", () => {
    // arrange
    const host = "github.com";

    // act
    const provider = findProviderForHost(host);

    // assert
    assert.strictEqual(provider, GITHUB_PROVIDER);
  });

  const hostileHosts = [
    "",
    "GitHub.com",
    "GitLab.com",
    "evilgithub.com",
    "github.com.evil",
    "api.github.com",
    "github.com:443",
    "githvb.com",
    "evilgitlab.com",
    "gitlab.com.evil",
    "api.gitlab.com",
    "gitlab.com:443",
    "gitlab.cam",
  ] as const;

  for (const host of hostileHosts) {
    test(`returns undefined for unknown host ${JSON.stringify(host)}`, () => {
      // arrange
      const remoteHost = host;

      // act
      const provider = findProviderForHost(remoteHost);

      // assert
      assert.strictEqual(provider, undefined);
    });
  }

  test("keeps the GitHub and GitLab provider predicates disjoint", () => {
    // arrange
    const githubHost = "github.com";
    const gitlabHost = "gitlab.com";

    // act
    const gitlabProvider = findProviderForHost(gitlabHost);
    assert.ok(gitlabProvider !== undefined);
    const githubClaimsGitLab = GITHUB_PROVIDER.hostMatch(gitlabHost);
    const gitlabClaimsGitHub = gitlabProvider.hostMatch(githubHost);

    // assert
    assert.strictEqual(githubClaimsGitLab, false);
    assert.strictEqual(gitlabClaimsGitHub, false);
  });
});

describe("Gitea provider lookup (GAUTH-03)", () => {
  test("gitea.nucleix.io resolves to the stored-credential descriptor", () => {
    // arrange
    const host = "gitea.nucleix.io";

    // act
    const provider = findProviderForHost(host);

    // assert
    assert.strictEqual(provider?.kind, "stored-credential");
    assert.strictEqual(provider?.id, "gitea");
    assert.strictEqual(findProviderForHost(host), provider, "lookup is a stable registry hit");
  });

  const hostileHosts = [
    "evil-gitea.nucleix.io",
    "gitea.nucleix.io.evil.com",
    "gitea.nucleix.io:8443",
    "gitea.example.com",
    "Gitea.nucleix.io",
  ] as const;

  for (const host of hostileHosts) {
    test(`claims no lookalike host ${JSON.stringify(host)}`, () => {
      // arrange
      const remoteHost = host;

      // act
      const provider = findProviderForHost(remoteHost);

      // assert
      assert.strictEqual(provider, undefined);
    });
  }

  test("a stored-credential provider carries no Device Flow fields", () => {
    // arrange
    const provider = findProviderForHost("gitea.nucleix.io");
    assert.ok(provider !== undefined);
    const descriptor = provider as unknown as Record<string, unknown>;

    // assert
    assert.strictEqual("deviceCodeUrl" in descriptor, false);
    assert.strictEqual("clientId" in descriptor, false);
    assert.strictEqual("credentialFrom" in descriptor, false);
  });

  test("the registry kinds are disjoint per host", () => {
    // arrange
    const giteaHost = "gitea.nucleix.io";
    const githubHost = "github.com";

    // act
    const giteaProvider = findProviderForHost(giteaHost);
    const githubProvider = findProviderForHost(githubHost);

    // assert
    assert.strictEqual(giteaProvider?.kind, "stored-credential");
    assert.strictEqual(githubProvider?.kind, "device-flow");
  });
});
