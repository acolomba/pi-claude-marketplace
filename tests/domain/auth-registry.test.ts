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
  test("exposes the complete GitHub descriptor data", () => {
    // arrange
    const expectedDescriptor = {
      id: "github",
      deviceCodeUrl: "https://github.com/login/device/code",
      tokenUrl: "https://github.com/login/oauth/access_token",
      clientId: "Ov23liNcyK08uGdU0mMl",
      scope: "repo",
    };

    // act
    const descriptor = {
      id: GITHUB_PROVIDER.id,
      deviceCodeUrl: GITHUB_PROVIDER.deviceCodeUrl,
      tokenUrl: GITHUB_PROVIDER.tokenUrl,
      clientId: GITHUB_PROVIDER.clientId,
      scope: GITHUB_PROVIDER.scope,
    };

    // assert
    assert.deepStrictEqual(descriptor, expectedDescriptor);
  });

  test("matches github.com", () => {
    // arrange
    const host = "github.com";

    // act
    const matches = GITHUB_PROVIDER.hostMatch(host);

    // assert
    assert.strictEqual(matches, true);
  });

  for (const host of [
    "api.github.com",
    "sub.github.com",
    "github.com.example",
    "GitHub.com",
    "github.com:8443",
  ]) {
    test(`does not match ${host}`, () => {
      // arrange
      const remoteHost = host;

      // act
      const matches = GITHUB_PROVIDER.hostMatch(remoteHost);

      // assert
      assert.strictEqual(matches, false);
    });
  }

  test("maps an access token to x-access-token credentials", () => {
    // arrange
    const accessToken = "github-token";

    // act
    const credentials = GITHUB_PROVIDER.credentialFrom(accessToken);

    // assert
    assert.deepStrictEqual(credentials, {
      username: "x-access-token",
      password: "github-token",
    });
  });
});

describe("GITLAB_PROVIDER", () => {
  test("exposes the complete GitLab descriptor data", () => {
    // arrange
    const expectedDescriptor = {
      id: "gitlab",
      deviceCodeUrl: "https://gitlab.com/oauth/authorize_device",
      tokenUrl: "https://gitlab.com/oauth/token",
      clientId: "bb5b5605c21f02f3b41991e3d5f713488b4f0c5cf969de8f7d82f2811f99192d",
      scope: "read_repository",
    };

    // act
    const descriptor = {
      id: GITLAB_PROVIDER.id,
      deviceCodeUrl: GITLAB_PROVIDER.deviceCodeUrl,
      tokenUrl: GITLAB_PROVIDER.tokenUrl,
      clientId: GITLAB_PROVIDER.clientId,
      scope: GITLAB_PROVIDER.scope,
    };

    // assert
    assert.deepStrictEqual(descriptor, expectedDescriptor);
  });

  test("matches gitlab.com", () => {
    // arrange
    const host = "gitlab.com";

    // act
    const matches = GITLAB_PROVIDER.hostMatch(host);

    // assert
    assert.strictEqual(matches, true);
  });

  for (const host of [
    "api.gitlab.com",
    "sub.gitlab.com",
    "gitlab.example.com",
    "GitLab.com",
    "gitlab.com:8443",
  ]) {
    test(`does not match ${host}`, () => {
      // arrange
      const remoteHost = host;

      // act
      const matches = GITLAB_PROVIDER.hostMatch(remoteHost);

      // assert
      assert.strictEqual(matches, false);
    });
  }

  test("maps an access token to oauth2 credentials", () => {
    // arrange
    const accessToken = "gitlab-token";

    // act
    const credentials = GITLAB_PROVIDER.credentialFrom(accessToken);

    // assert
    assert.deepStrictEqual(credentials, {
      username: "oauth2",
      password: "gitlab-token",
    });
  });
});

describe("findProviderForHost", () => {
  test("returns the GitHub provider for github.com", () => {
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

  test("returns undefined when no provider claims the host", () => {
    // arrange
    const host = "git.example";

    // act
    const provider = findProviderForHost(host);

    // assert
    assert.strictEqual(provider, undefined);
  });
});
