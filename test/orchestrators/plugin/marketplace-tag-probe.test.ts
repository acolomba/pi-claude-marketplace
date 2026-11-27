import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { probeMarketplaceTags } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts";
import { InvalidGitHubBaseUrlError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createGitTestRepository } from "../../platform/git-test-repository.ts";
import { setGitHubBaseUrl, setPreferHttps } from "../../shared/github-base-url-environment.ts";

import type { ReleaseTagCandidate } from "../../../extensions/pi-claude-marketplace/domain/release-tag.ts";
import type {
  MarketplaceTagListingSeam,
  MarketplaceTagProbeOptions,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts";
import type {
  ListLocalTagsOptions,
  ListRemoteTagsOptions,
  RemoteTag,
} from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type { TestContext } from "node:test";

const MARKETPLACE_ROOT = "/marketplace/checkout";
const DIRECTORY_SOURCE = "/home/user/acme-marketplace";
const URL_SOURCE = "https://example.com/acme/marketplace.git";
const GITHUB_SOURCE = "acme/marketplace";

// D-SG-20: the two addresses a github owner/repo marketplace's tags are listed at.
const GITHUB_SSH_URL = "git@github.com:acme/marketplace.git";
const GITHUB_HTTPS_URL = "https://github.com/acme/marketplace.git";

/** Clears both triggers that force https, so a case reads the default transport. */
function unforced(t: TestContext): void {
  setGitHubBaseUrl(t, undefined);
  setPreferHttps(t, undefined);
}

interface FakeSeamOptions {
  readonly tags?: readonly RemoteTag[];
  readonly listingThrows?: Error;
}

interface FakeSeam {
  readonly seam: MarketplaceTagListingSeam;
  readonly remoteCalls: ListRemoteTagsOptions[];
  readonly localCalls: ListLocalTagsOptions[];
}

function createFakeSeam(options: FakeSeamOptions = {}): FakeSeam {
  const remoteCalls: ListRemoteTagsOptions[] = [];
  const localCalls: ListLocalTagsOptions[] = [];
  const answer = (): Promise<RemoteTag[]> =>
    Promise.resolve().then(() => {
      if (options.listingThrows !== undefined) {
        throw options.listingThrows;
      }

      return [...(options.tags ?? [])];
    });

  const seam: MarketplaceTagListingSeam = {
    listRemoteTags: (opts) => {
      remoteCalls.push(opts);
      return answer();
    },
    listLocalTags: (opts) => {
      localCalls.push(opts);
      return answer();
    },
  };

  return { seam, remoteCalls, localCalls };
}

function options(overrides: Partial<MarketplaceTagProbeOptions>): MarketplaceTagProbeOptions {
  return {
    pluginName: "formatter",
    marketplaceRoot: MARKETPLACE_ROOT,
    marketplaceSource: DIRECTORY_SOURCE,
    range: "^2.0.0",
    ...overrides,
  };
}

describe("probeMarketplaceTags on a directory marketplace", () => {
  test("TAGS-01: pins the highest satisfying tag off the marketplace repository's local listing", async () => {
    // arrange
    const fake = createFakeSeam({
      tags: [
        { name: "formatter--v1.0.0", oid: "oid-1" },
        { name: "formatter--v2.1.0", oid: "oid-2" },
      ],
    });

    // act
    const result = await probeMarketplaceTags(options({ seam: fake.seam }));

    // assert
    assert.deepStrictEqual(
      { result, localCalls: fake.localCalls, remoteCalls: fake.remoteCalls },
      {
        result: { kind: "pinned", tag: "formatter--v2.1.0", oid: "oid-2", version: "2.1.0" },
        localCalls: [{ dir: MARKETPLACE_ROOT }],
        remoteCalls: [],
      },
    );
  });

  test("a repository with zero tags yields the no-match arm", async () => {
    const fake = createFakeSeam({ tags: [] });

    const result = await probeMarketplaceTags(options({ seam: fake.seam }));

    assert.deepStrictEqual(result, { kind: "no-matching-tag" });
  });

  test("a repository whose only tags carry another plugin's prefix yields the no-match arm", async () => {
    const fake = createFakeSeam({ tags: [{ name: "other--v9.9.9", oid: "oid-9" }] });

    const result = await probeMarketplaceTags(options({ seam: fake.seam }));

    assert.deepStrictEqual(result, { kind: "no-matching-tag" });
  });

  test("a listing throw returns the tag-listing-failed arm", async () => {
    const err = new Error("read failed");
    const fake = createFakeSeam({ listingThrows: err });

    const result = await probeMarketplaceTags(options({ seam: fake.seam }));

    assert.deepStrictEqual(result, { kind: "tag-listing-failed", cause: err });
  });

  test("wraps a listing throw that is not an Error before carrying it on the failure arm", async () => {
    const notAnError: unknown = "not an Error object";
    const seam: MarketplaceTagListingSeam = {
      listRemoteTags: () => Promise.resolve([]),
      // Thrown rather than handed to Promise.reject so a non-Error failure --
      // the case the probe must wrap -- needs no cast to express.
      listLocalTags: () => {
        throw notAnError;
      },
    };

    const result = await probeMarketplaceTags(options({ seam }));

    assert.deepStrictEqual(result, {
      kind: "tag-listing-failed",
      cause: new Error("not an Error object"),
    });
  });

  test("D-10-18: two probes for two plugin names against the same root list once", async () => {
    const fake = createFakeSeam({
      tags: [
        { name: "formatter--v1.0.0", oid: "oid-1" },
        { name: "linter--v1.0.0", oid: "oid-2" },
      ],
    });
    const tagMemo = new Map<string, readonly ReleaseTagCandidate[]>();

    await probeMarketplaceTags(options({ pluginName: "formatter", seam: fake.seam, tagMemo }));
    await probeMarketplaceTags(options({ pluginName: "linter", seam: fake.seam, tagMemo }));

    assert.deepStrictEqual(
      { calls: fake.localCalls.length, keys: [...tagMemo.keys()] },
      { calls: 1, keys: [MARKETPLACE_ROOT] },
    );
  });

  test("D-10-18: a failed listing is never memoized, so a later attempt re-lists instead of replaying the error", async () => {
    const err = new Error("transient");
    const failing = createFakeSeam({ listingThrows: err });
    const tagMemo = new Map<string, readonly ReleaseTagCandidate[]>();

    const first = await probeMarketplaceTags(options({ seam: failing.seam, tagMemo }));
    assert.deepStrictEqual(first, { kind: "tag-listing-failed", cause: err });
    assert.deepStrictEqual([...tagMemo], []);

    const recovered = createFakeSeam({ tags: [{ name: "formatter--v1.0.0", oid: "oid-1" }] });
    const second = await probeMarketplaceTags(
      options({ seam: recovered.seam, tagMemo, range: "^1.0.0" }),
    );

    assert.deepStrictEqual(second, {
      kind: "pinned",
      tag: "formatter--v1.0.0",
      oid: "oid-1",
      version: "1.0.0",
    });
    assert.strictEqual(recovered.localCalls.length, 1);
  });

  test("a failure that overlaps a concurrent success does not evict the successful entry", async () => {
    // The exact race CR-03 named: two probes for the SAME root both miss the
    // memo before either finishes; the successful one runs to completion and
    // SETS the memo FIRST, and only then does the failing one reach its own
    // catch. A `memo.delete` in that catch would remove the entry the success
    // just wrote.
    const tagMemo = new Map<string, readonly ReleaseTagCandidate[]>();
    let releaseFailure: () => void = () => {
      throw new Error("releaseFailure called before assignment");
    };

    const failureGate = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    const failing: MarketplaceTagListingSeam = {
      listRemoteTags: () => Promise.resolve([]),
      listLocalTags: async () => {
        await failureGate;
        throw new Error("transient");
      },
    };
    const succeeding = createFakeSeam({ tags: [{ name: "formatter--v1.0.0", oid: "oid-1" }] });

    const failPromise = probeMarketplaceTags(options({ seam: failing, tagMemo }));
    const successResult = await probeMarketplaceTags(
      options({ seam: succeeding.seam, tagMemo, range: "^1.0.0" }),
    );
    assert.strictEqual(successResult.kind, "pinned");

    releaseFailure();
    const failResult = await failPromise;
    assert.strictEqual(failResult.kind, "tag-listing-failed");

    const spy = createFakeSeam();
    await probeMarketplaceTags(options({ seam: spy.seam, tagMemo }));
    assert.strictEqual(
      spy.localCalls.length,
      0,
      "the successful entry must survive a concurrent, later-failing probe",
    );
  });

  test("D-SG-09: with no seam supplied, reads a real local repository's tags with system git", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("tag", "-a", "-m", "release", "formatter--v1.0.0", repository.initialOid);

    // act
    const result = await probeMarketplaceTags(
      options({ marketplaceRoot: repository.dir, range: "^1.0.0" }),
    );

    // assert
    assert.deepStrictEqual(result, {
      kind: "pinned",
      tag: "formatter--v1.0.0",
      oid: repository.initialOid,
      version: "1.0.0",
    });
  });
});

describe("probeMarketplaceTags on a git marketplace", () => {
  test("D-SG-09: a url marketplace lists its remote with the host's auth bundle and never reads the checkout", async () => {
    // arrange
    const fake = createFakeSeam({ tags: [{ name: "formatter--v2.0.0", oid: "oid-2" }] });

    // act
    const result = await probeMarketplaceTags(
      options({ seam: fake.seam, marketplaceSource: URL_SOURCE }),
    );

    // assert
    assert.deepStrictEqual(
      {
        result,
        urls: fake.remoteCalls.map((call) => call.url),
        bundles: fake.remoteCalls.map((call) => call.auth),
        localCalls: fake.localCalls,
      },
      {
        result: { kind: "pinned", tag: "formatter--v2.0.0", oid: "oid-2", version: "2.0.0" },
        urls: [URL_SOURCE],
        bundles: [{ host: "example.com" }],
        localCalls: [],
      },
    );
  });

  test("D-SG-09, D-SG-20: a github marketplace lists its ssh address and keys the memo under it", async (t) => {
    // arrange
    unforced(t);
    const fake = createFakeSeam({ tags: [{ name: "formatter--v2.0.0", oid: "oid-2" }] });
    const tagMemo = new Map<string, readonly ReleaseTagCandidate[]>();

    // act
    const result = await probeMarketplaceTags(
      options({ seam: fake.seam, marketplaceSource: GITHUB_SOURCE, tagMemo }),
    );

    // assert
    assert.deepStrictEqual(
      { result, urls: fake.remoteCalls.map((call) => call.url), memo: [...tagMemo.keys()] },
      {
        result: { kind: "pinned", tag: "formatter--v2.0.0", oid: "oid-2", version: "2.0.0" },
        urls: [GITHUB_SSH_URL],
        memo: [GITHUB_SSH_URL],
      },
    );
  });

  for (const { trigger, force, host } of [
    {
      trigger: "CLAUDE_CODE_PLUGIN_PREFER_HTTPS",
      force: (t: TestContext) => {
        setPreferHttps(t, "1");
      },
      host: "github.com",
    },
    {
      trigger: "the github base override",
      force: (t: TestContext) => {
        setGitHubBaseUrl(t, "https://mirror.example/base");
      },
      host: "mirror.example",
    },
  ]) {
    test(`D-SG-09, D-SG-21: a github marketplace lists its https wire URL once with its host's bundle under ${trigger}`, async (t) => {
      // arrange
      unforced(t);
      force(t);
      const fake = createFakeSeam({ tags: [{ name: "formatter--v2.0.0", oid: "oid-2" }] });
      const tagMemo = new Map<string, readonly ReleaseTagCandidate[]>();

      // act
      await probeMarketplaceTags(
        options({
          seam: fake.seam,
          marketplaceSource: GITHUB_SOURCE,
          tagMemo,
        }),
      );

      // assert
      assert.deepStrictEqual(
        {
          calls: fake.remoteCalls.map((call) => [call.url, call.auth?.host]),
          memo: [...tagMemo.keys()],
        },
        {
          calls: [[GITHUB_HTTPS_URL, host]],
          memo: [GITHUB_HTTPS_URL],
        },
      );
    });
  }

  test("TAGS-02, D-SG-20: a github marketplace's failed ssh listing is not retried over https", async (t) => {
    // arrange
    unforced(t);
    const err = new Error("Permission denied (publickey)");
    const fake = createFakeSeam({ listingThrows: err });

    // act
    const result = await probeMarketplaceTags(
      options({ seam: fake.seam, marketplaceSource: GITHUB_SOURCE }),
    );

    // assert
    assert.deepStrictEqual(
      { result, urls: fake.remoteCalls.map((call) => call.url) },
      { result: { kind: "tag-listing-failed", cause: err }, urls: [GITHUB_SSH_URL] },
    );
  });

  test("D-SG-09, D-10-18: two probes of one marketplace URL list once, keyed by the URL", async () => {
    const fake = createFakeSeam({
      tags: [
        { name: "formatter--v2.0.0", oid: "oid-2" },
        { name: "linter--v2.0.0", oid: "oid-3" },
      ],
    });
    const tagMemo = new Map<string, readonly ReleaseTagCandidate[]>();
    const probe = (pluginName: string) =>
      probeMarketplaceTags(
        options({ pluginName, seam: fake.seam, marketplaceSource: URL_SOURCE, tagMemo }),
      );

    await probe("formatter");
    await probe("linter");

    assert.deepStrictEqual(
      { calls: fake.remoteCalls.length, keys: [...tagMemo.keys()] },
      { calls: 1, keys: [URL_SOURCE] },
    );
  });

  test("D-10-18: a failed remote listing writes no memo entry", async () => {
    const err = new Error("network");
    const fake = createFakeSeam({ listingThrows: err });
    const tagMemo = new Map<string, readonly ReleaseTagCandidate[]>();

    const result = await probeMarketplaceTags(
      options({ seam: fake.seam, marketplaceSource: URL_SOURCE, tagMemo }),
    );

    assert.deepStrictEqual(
      { result, memo: [...tagMemo] },
      { result: { kind: "tag-listing-failed", cause: err }, memo: [] },
    );
  });

  test("GHB-03: an invalid GitHub base from the listing rethrows instead of folding into the fallback", async () => {
    const invalid = new InvalidGitHubBaseUrlError(
      "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
      "not-a-url",
    );
    const fake = createFakeSeam({
      listingThrows: new Error("listing failed", { cause: invalid }),
    });

    const probing = probeMarketplaceTags(
      options({ seam: fake.seam, marketplaceSource: GITHUB_SOURCE }),
    );

    await assert.rejects(probing, (error: unknown) => error === invalid);
  });

  test("SG-TRN-04: the highest satisfying version wins whatever order the listing prints, a tag at the bound included", async () => {
    const fake = createFakeSeam({
      tags: [
        { name: "formatter--v3.0.0", oid: "oid-3" },
        { name: "formatter--v2.0.0", oid: "oid-2" },
        { name: "formatter--v2.5.0", oid: "oid-25" },
        { name: "formatter--v1.9.0", oid: "oid-19" },
      ],
    });

    const highest = await probeMarketplaceTags(
      options({ seam: fake.seam, marketplaceSource: URL_SOURCE, range: ">=2.0.0 <3.0.0" }),
    );
    const atBound = await probeMarketplaceTags(
      options({ seam: fake.seam, marketplaceSource: URL_SOURCE, range: "<=1.9.0" }),
    );

    assert.deepStrictEqual(
      [highest, atBound],
      [
        { kind: "pinned", tag: "formatter--v2.5.0", oid: "oid-25", version: "2.5.0" },
        { kind: "pinned", tag: "formatter--v1.9.0", oid: "oid-19", version: "1.9.0" },
      ],
    );
  });
});

describe("probeMarketplaceTags on a hosted marketplace", () => {
  test("TAGS-02: a hosted catalog has no repository, so it fails the listing and calls nothing", async () => {
    const fake = createFakeSeam();

    const result = await probeMarketplaceTags(
      options({
        seam: fake.seam,
        marketplaceSource: "https://example.com/catalog/marketplace.json",
      }),
    );

    assert.deepStrictEqual(
      { result, calls: fake.remoteCalls.length + fake.localCalls.length },
      {
        result: {
          kind: "tag-listing-failed",
          cause: new Error("the marketplace has no git repository to read release tags from"),
        },
        calls: 0,
      },
    );
  });
});
