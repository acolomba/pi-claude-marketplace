import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canonicalCloneUrl,
  networkCloneUrl,
  originMatchesSource,
  pluginCloneKey,
  pluginMirrorKey,
} from "../../extensions/pi-claude-marketplace/domain/clone-key.ts";

import type {
  GitHubSource,
  UrlSource,
} from "../../extensions/pi-claude-marketplace/domain/source.ts";

describe("pluginCloneKey", () => {
  test("returns the same clone key for identical URL and SHA inputs", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const cloneKeys = [
      pluginCloneKey(canonicalUrl, fullSha),
      pluginCloneKey(canonicalUrl, fullSha),
    ];

    // assert
    assert.deepStrictEqual(cloneKeys, ["97393e7e6b5a-a1b2c3d4e5f6", "97393e7e6b5a-a1b2c3d4e5f6"]);
  });

  test("changes the URL half after a one-character canonical URL change", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";
    const adjacentCanonicalUrl = "https://github.com/o/s";
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const cloneKeys = {
      canonical: pluginCloneKey(canonicalUrl, fullSha),
      adjacent: pluginCloneKey(adjacentCanonicalUrl, fullSha),
    };

    // assert
    assert.deepStrictEqual(cloneKeys, {
      canonical: "97393e7e6b5a-a1b2c3d4e5f6",
      adjacent: "360941761bef-a1b2c3d4e5f6",
    });
  });

  test("changes the SHA half after a one-character resolved commit change", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const adjacentFullSha = "a1b2c3d4e5f7a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const cloneKeys = {
      canonical: pluginCloneKey(canonicalUrl, fullSha),
      adjacent: pluginCloneKey(canonicalUrl, adjacentFullSha),
    };

    // assert
    assert.deepStrictEqual(cloneKeys, {
      canonical: "97393e7e6b5a-a1b2c3d4e5f6",
      adjacent: "97393e7e6b5a-a1b2c3d4e5f7",
    });
  });

  test("hashes the caller's URL verbatim", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r.git";
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const cloneKey = pluginCloneKey(canonicalUrl, fullSha);

    // assert
    assert.strictEqual(cloneKey, "bc3fbd4dd8db-a1b2c3d4e5f6");
  });
});

describe("pluginMirrorKey", () => {
  test("returns the same mirror key for an identical URL", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";

    // act
    const mirrorKeys = [pluginMirrorKey(canonicalUrl), pluginMirrorKey(canonicalUrl)];

    // assert
    assert.deepStrictEqual(mirrorKeys, ["97393e7e6b5a", "97393e7e6b5a"]);
  });

  test("changes after a one-character canonical URL change", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";
    const adjacentCanonicalUrl = "https://github.com/o/s";

    // act
    const mirrorKeys = {
      canonical: pluginMirrorKey(canonicalUrl),
      adjacent: pluginMirrorKey(adjacentCanonicalUrl),
    };

    // assert
    assert.deepStrictEqual(mirrorKeys, {
      canonical: "97393e7e6b5a",
      adjacent: "360941761bef",
    });
  });

  test("hashes the caller's URL verbatim", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r.git";

    // act
    const mirrorKey = pluginMirrorKey(canonicalUrl);

    // assert
    assert.strictEqual(mirrorKey, "bc3fbd4dd8db");
  });
});

describe("canonicalCloneUrl", () => {
  test("builds a GitHub repository URL", () => {
    // arrange
    const source = {
      kind: "github",
      raw: "o/r",
      owner: "o",
      repo: "r",
    } as const;

    // act
    const cloneUrl = canonicalCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://github.com/o/r");
  });

  test("returns a URL source without changing it", () => {
    // arrange
    const source = {
      kind: "url",
      raw: "https://gitlab.com/acme/mp.git",
      url: "https://gitlab.com/acme/mp",
    } as const;

    // act
    const cloneUrl = canonicalCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://gitlab.com/acme/mp");
  });

  test("returns a git-subdir repository root without its plugin path", () => {
    // arrange
    const source = {
      kind: "git-subdir",
      raw: "https://example.com/mono",
      url: "https://example.com/mono",
      path: "plugins/p",
    } as const;

    // act
    const cloneUrl = canonicalCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://example.com/mono");
  });
});

describe("networkCloneUrl", () => {
  test("appends .git to a GitHub repository URL", () => {
    // arrange
    const source = {
      kind: "github",
      raw: "o/r",
      owner: "o",
      repo: "r",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://github.com/o/r.git");
  });

  test("sends a suffix-less url source unchanged", () => {
    // arrange
    const source = {
      kind: "url",
      raw: "https://gitlab.example.com/team/mp",
      url: "https://gitlab.example.com/team/mp",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://gitlab.example.com/team/mp");
  });

  test("preserves a trailing .git the user typed, even though source.url stripped it", () => {
    // arrange
    const source = {
      kind: "url",
      raw: "https://gitlab.example.com/team/mp.git",
      url: "https://gitlab.example.com/team/mp",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://gitlab.example.com/team/mp.git");
  });

  test("drops a #<ref> fragment from a url source's raw", () => {
    // arrange
    const source = {
      kind: "url",
      raw: "https://gitlab.example.com/team/mp#v1.0",
      url: "https://gitlab.example.com/team/mp",
      ref: "v1.0",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://gitlab.example.com/team/mp");
  });

  test("drops trailing slashes from a url source's raw", () => {
    // arrange
    const source = {
      kind: "url",
      raw: "https://gitlab.example.com/team/mp///",
      url: "https://gitlab.example.com/team/mp",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://gitlab.example.com/team/mp");
  });

  test("keeps a trailing .git suffix and drops a #<ref> fragment together", () => {
    // arrange
    const source = {
      kind: "url",
      raw: "https://gitlab.example.com/team/mp.git#v1.0",
      url: "https://gitlab.example.com/team/mp",
      ref: "v1.0",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://gitlab.example.com/team/mp.git");
  });

  test("keeps a trailing .git suffix behind a path slash that precedes a #<ref> fragment", () => {
    // arrange
    const source = {
      kind: "url",
      raw: "https://gitlab.example.com/team/mp.git/#v1.0",
      url: "https://gitlab.example.com/team/mp",
      ref: "v1.0",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://gitlab.example.com/team/mp.git");
  });

  test("returns a git-subdir repository url verbatim, including a trailing .git", () => {
    // arrange
    const source = {
      kind: "git-subdir",
      raw: "https://example.com/mono.git",
      url: "https://example.com/mono.git",
      path: "plugins/p",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://example.com/mono.git");
  });

  test("drops a trailing slash and a #<ref> fragment from a git-subdir url", () => {
    // arrange
    const source = {
      kind: "git-subdir",
      raw: "https://example.com/mono/#main",
      url: "https://example.com/mono/#main",
      path: "plugins/p",
      ref: "main",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://example.com/mono");
  });

  test("returns the identical string for two consecutive calls with the same source", () => {
    // arrange
    const source = {
      kind: "url",
      raw: "https://gitlab.example.com/team/mp",
      url: "https://gitlab.example.com/team/mp",
    } as const;

    // act
    const cloneUrls = [networkCloneUrl(source), networkCloneUrl(source)];

    // assert
    assert.deepStrictEqual(cloneUrls, [
      "https://gitlab.example.com/team/mp",
      "https://gitlab.example.com/team/mp",
    ]);
  });
});

describe("originMatchesSource", () => {
  const OFFICIAL = {
    kind: "github",
    raw: "anthropics/claude-plugins-official",
    owner: "anthropics",
    repo: "claude-plugins-official",
  } as const satisfies GitHubSource;
  const GITLAB_MP = {
    kind: "url",
    raw: "https://gitlab.example.com/team/mp",
    url: "https://gitlab.example.com/team/mp",
  } as const satisfies UrlSource;
  const GITHUB_O_R = {
    kind: "github",
    raw: "o/r",
    owner: "o",
    repo: "r",
  } as const satisfies GitHubSource;

  const MATCHING_ORIGINS: ReadonlyArray<{
    readonly originUrl: string;
    readonly source: GitHubSource | UrlSource;
  }> = [
    { originUrl: "https://github.com/anthropics/claude-plugins-official.git", source: OFFICIAL },
    { originUrl: "https://GitHub.com/anthropics/claude-plugins-official", source: OFFICIAL },
    {
      originUrl: "https://www.github.com/anthropics/claude-plugins-official.git",
      source: OFFICIAL,
    },
    { originUrl: "https://GitLab.Example.com/team/mp.git", source: GITLAB_MP },
  ];

  for (const { originUrl, source } of MATCHING_ORIGINS) {
    test(`Q-03: recognizes origin ${originUrl} as the ${source.raw} source`, () => {
      // arrange
      const expectedMatch = true;

      // act
      const matches = originMatchesSource(originUrl, source);

      // assert
      assert.strictEqual(matches, expectedMatch);
    });
  }

  const FOREIGN_ORIGINS: ReadonlyArray<{
    readonly kind: string;
    readonly originUrl: string;
    readonly source: GitHubSource | UrlSource;
  }> = [
    {
      kind: "an owner that differs only by letter case",
      originUrl: "https://github.com/Anthropics/claude-plugins-official.git",
      source: OFFICIAL,
    },
    {
      kind: "another repository",
      originUrl: "https://github.com/anthropics/other-repo.git",
      source: OFFICIAL,
    },
    {
      kind: "the identity plus one trailing character",
      originUrl: "https://github.com/anthropics/claude-plugins-officialx",
      source: OFFICIAL,
    },
    {
      kind: "an ssh-form remote",
      originUrl: "git@github.com:anthropics/claude-plugins-official.git",
      source: OFFICIAL,
    },
    { kind: "a string that is not a url", originUrl: "not a url", source: OFFICIAL },
    { kind: "the empty string", originUrl: "", source: OFFICIAL },
    { kind: "a local path", originUrl: "/srv/git/claude-plugins-official", source: OFFICIAL },
    { kind: "a url that does not parse", originUrl: "https://exa mple/team/mp", source: GITLAB_MP },
    {
      kind: "an explicit non-default port",
      originUrl: "https://github.com:8443/o/r",
      source: GITHUB_O_R,
    },
  ];

  for (const { kind, originUrl, source } of FOREIGN_ORIGINS) {
    test(`Q-03: refuses an origin that is ${kind}`, () => {
      // arrange
      const expectedMatch = false;

      // act
      const matches = originMatchesSource(originUrl, source);

      // assert
      assert.strictEqual(matches, expectedMatch);
    });
  }
});
