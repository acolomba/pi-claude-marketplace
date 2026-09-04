import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  findProviderForHost,
  GITHUB_PROVIDER,
  GITLAB_PROVIDER,
  type GitAuthProvider,
} from "../../extensions/pi-claude-marketplace/domain/auth-registry.ts";

void ({
  id: "provider",
  hostMatch: (host: string) => host === "git.example",
  deviceCodeUrl: "https://git.example/device",
  tokenUrl: "https://git.example/token",
  clientId: "client-id",
  scope: "read",
  credentialFrom: (accessToken: string) => ({ username: "oauth2", password: accessToken }),
} satisfies GitAuthProvider);
// @ts-expect-error A provider supplies its credential mapping.
const incompleteProvider: GitAuthProvider = {
  id: "provider",
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

describe("GITLAB_PROVIDER", () => {
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
    const descriptor = {
      id: GITLAB_PROVIDER.id,
      host: { name: "gitlab.com", matches: GITLAB_PROVIDER.hostMatch("gitlab.com") },
      deviceCodeUrl: GITLAB_PROVIDER.deviceCodeUrl,
      tokenUrl: GITLAB_PROVIDER.tokenUrl,
      clientId: GITLAB_PROVIDER.clientId,
      scope: GITLAB_PROVIDER.scope,
      credentialsByEnvironment: {
        GITLAB_TOKEN: GITLAB_PROVIDER.credentialFrom("GITLAB_TOKEN"),
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

  test("returns the GitLab provider for gitlab.com", () => {
    // arrange
    const host = "gitlab.com";

    // act
    const provider = findProviderForHost(host);

    // assert
    assert.strictEqual(provider, GITLAB_PROVIDER);
  });

  for (const host of ["", "GitHub.com", "GitLab.com", "githvb.com", "gitlab.cam"]) {
    test(`returns undefined for unknown host ${JSON.stringify(host)}`, () => {
      // arrange
      const remoteHost = host;

      // act
      const provider = findProviderForHost(remoteHost);

      // assert
      assert.strictEqual(provider, undefined);
    });
  }
});
