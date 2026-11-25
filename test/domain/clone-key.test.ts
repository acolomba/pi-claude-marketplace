import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canonicalCloneUrl,
  gitHubRepositoriesMatch,
  networkCloneUrl,
  originMatchesSource,
  pluginCloneKey,
  pluginMirrorKey,
} from "../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";

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

  test("GHB-02 / D-01: keeps the github.com identity with the override set", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example/git");
    const source = {
      kind: "github",
      raw: "acme/tools",
      owner: "acme",
      repo: "tools",
    } as const satisfies GitHubSource;

    // act
    const cloneUrl = canonicalCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://github.com/acme/tools");
  });

  test("D-SG-23: keys a github source by its own owner and repo spelling, unfolded", () => {
    // arrange
    const source = {
      kind: "github",
      raw: "Acme/Tools",
      owner: "Acme",
      repo: "Tools",
    } as const satisfies GitHubSource;

    // act
    const cloneUrl = canonicalCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://github.com/Acme/Tools");
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

  test("GHB-02 / D-01: returns the github.com URL with the override set", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example/git");
    const source = {
      kind: "github",
      raw: "acme/tools",
      owner: "acme",
      repo: "tools",
    } as const satisfies GitHubSource;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://github.com/acme/tools.git");
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
  const GITHUB_ACME_TOOLS = {
    kind: "github",
    raw: "acme/tools",
    owner: "acme",
    repo: "tools",
  } as const satisfies GitHubSource;
  const UNFOLDED_GITHUB = {
    kind: "github",
    raw: "a_b/c",
    owner: "a_b",
    repo: "c",
  } as const satisfies GitHubSource;
  const SCP_MP = {
    kind: "url",
    raw: "git@gitlab.example:team/mp.git",
    url: "git@gitlab.example:team/mp",
  } as const satisfies UrlSource;

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
    {
      originUrl: "https://github.com/Anthropics/claude-plugins-official.git",
      source: OFFICIAL,
    },
    { originUrl: "git@github.com:anthropics/claude-plugins-official.git", source: OFFICIAL },
    { originUrl: "git@github.com:acme/tools.git", source: GITHUB_ACME_TOOLS },
    { originUrl: "ssh://git@github.com/Acme/Tools", source: GITHUB_ACME_TOOLS },
    { originUrl: "https://github.com:8443/o/r", source: GITHUB_O_R },
    { originUrl: "https://github.com/a_b/c.git", source: UNFOLDED_GITHUB },
    { originUrl: "git@gitlab.example:team/mp.git", source: SCP_MP },
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
      kind: "an ssh-form remote of another repository",
      originUrl: "git@github.com:acme/other.git",
      source: GITHUB_ACME_TOOLS,
    },
    {
      kind: "a GitHub address for a non-GitHub source",
      originUrl: "https://github.com/team/mp.git",
      source: GITLAB_MP,
    },
    {
      kind: "the https form of an scp non-GitHub source",
      originUrl: "https://gitlab.example/team/mp.git",
      source: SCP_MP,
    },
    { kind: "a string that is not a url", originUrl: "not a url", source: OFFICIAL },
    { kind: "the empty string", originUrl: "", source: OFFICIAL },
    { kind: "a local path", originUrl: "/srv/git/claude-plugins-official", source: OFFICIAL },
    { kind: "a url that does not parse", originUrl: "https://exa mple/team/mp", source: GITLAB_MP },
  ];

  test("GHB-02 / D-01: recognizes the github.com origin with the override set", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example/git");
    const source = {
      kind: "github",
      raw: "acme/tools",
      owner: "acme",
      repo: "tools",
    } as const satisfies GitHubSource;

    // act
    const matches = originMatchesSource("https://github.com/acme/tools.git", source);

    // assert
    assert.strictEqual(matches, true);
  });

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

describe("gitHubRepositoriesMatch", () => {
  for (const spelling of [
    "https://github.com/acme/tools.git",
    "https://www.github.com/Acme/Tools/",
    "http://github.com/acme/tools",
    "git+https://github.com/acme/tools",
    "git://github.com/acme/tools",
    "ssh://git@github.com/acme/tools.git",
    "git+ssh://git@ssh.github.com:443/acme/tools",
    "git@github.com:Acme/Tools.git",
    "org-1@github.com:acme/tools.git",
    "git@ssh.github.com:/acme/tools.GIT",
  ]) {
    test(`D-SG-23: folds ${spelling} to the github source acme/tools`, () => {
      // act
      const matches = gitHubRepositoriesMatch(spelling, "https://github.com/acme/tools");

      // assert
      assert.strictEqual(matches, true);
    });
  }

  for (const { identity, other, expectedMatch } of [
    {
      identity: "https://github.com/acme/tools",
      other: "git@github.com:Acme/Tools.git",
      expectedMatch: true,
    },
    {
      identity: "https://github.com/acme/tools",
      other: "https://github.com/acme/other",
      expectedMatch: false,
    },
    {
      identity: "https://github.com/acme/tools",
      other: "https://gitlab.example/acme/tools",
      expectedMatch: false,
    },
    {
      identity: "https://gitlab.example/acme/tools",
      other: "git@github.com:acme/tools.git",
      expectedMatch: false,
    },
    {
      identity: "https://gitlab.example/acme/tools",
      other: "https://gitlab.example/acme/tools",
      expectedMatch: undefined,
    },
  ] as const) {
    test(`D-SG-23: compares ${identity} with ${other} as ${String(expectedMatch)}`, () => {
      // act
      const matches = gitHubRepositoriesMatch(identity, other);

      // assert
      assert.strictEqual(matches, expectedMatch);
    });
  }
});
