import assert from "node:assert/strict";
import * as fs from "node:fs";
import { describe, test } from "node:test";

import * as git from "isomorphic-git";

import { probeMarketplaceTags } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts";
import { createGitTestRepository } from "../../platform/git-test-repository.ts";

import type { ReleaseTagCandidate } from "../../../extensions/pi-claude-marketplace/domain/release-tag.ts";
import type {
  MarketplaceTagListingSeam,
  MarketplaceTagProbeOptions,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts";

const MARKETPLACE_ROOT = "/marketplace/checkout";

interface FakeSeamOptions {
  readonly tagsByName?: Readonly<Record<string, string>>;
  readonly listTagsThrows?: Error;
  readonly resolveTagOidThrowsFor?: string;
}

interface FakeSeam {
  readonly seam: MarketplaceTagListingSeam;
  readonly listTagsCalls: { dir: string }[];
  readonly resolveTagOidCalls: { dir: string; name: string }[];
}

function createFakeSeam(options: FakeSeamOptions = {}): FakeSeam {
  const listTagsCalls: { dir: string }[] = [];
  const resolveTagOidCalls: { dir: string; name: string }[] = [];
  const tagsByName = options.tagsByName ?? {};

  const seam: MarketplaceTagListingSeam = {
    listTags: (opts) => {
      listTagsCalls.push(opts);
      if (options.listTagsThrows !== undefined) {
        throw options.listTagsThrows;
      }

      return Promise.resolve(Object.keys(tagsByName));
    },
    resolveTagOid: (opts) => {
      resolveTagOidCalls.push(opts);
      if (options.resolveTagOidThrowsFor === opts.name) {
        throw new Error(`cannot peel ${opts.name}`);
      }

      return Promise.resolve(tagsByName[opts.name] ?? "");
    },
  };

  return { seam, listTagsCalls, resolveTagOidCalls };
}

function options(overrides: Partial<MarketplaceTagProbeOptions>): MarketplaceTagProbeOptions {
  return {
    pluginName: "formatter",
    marketplaceRoot: MARKETPLACE_ROOT,
    range: "^2.0.0",
    ...overrides,
  };
}

describe("probeMarketplaceTags", () => {
  test("TAGS-01: pins the highest satisfying tag off the marketplace clone's own local listing", async () => {
    // arrange
    const fake = createFakeSeam({
      tagsByName: { "formatter--v1.0.0": "oid-1", "formatter--v2.1.0": "oid-2" },
    });

    // act
    const result = await probeMarketplaceTags(options({ seam: fake.seam }));

    // assert
    assert.deepStrictEqual(result, {
      kind: "pinned",
      tag: "formatter--v2.1.0",
      oid: "oid-2",
      version: "2.1.0",
    });
  });

  test("a clone with zero tags yields the no-match arm", async () => {
    const fake = createFakeSeam({ tagsByName: {} });

    const result = await probeMarketplaceTags(options({ seam: fake.seam }));

    assert.deepStrictEqual(result, { kind: "no-matching-tag", range: "^2.0.0" });
  });

  test("a clone whose only tags carry another plugin's prefix yields the no-match arm", async () => {
    const fake = createFakeSeam({ tagsByName: { "other--v9.9.9": "oid-9" } });

    const result = await probeMarketplaceTags(options({ seam: fake.seam }));

    assert.deepStrictEqual(result, { kind: "no-matching-tag", range: "^2.0.0" });
  });

  test("D-07-10: every listed tag name's oid is resolved eagerly, before selection runs", async () => {
    const fake = createFakeSeam({
      tagsByName: { "formatter--v1.0.0": "oid-1", "formatter--v2.1.0": "oid-2" },
    });

    await probeMarketplaceTags(options({ seam: fake.seam }));

    assert.deepStrictEqual(fake.resolveTagOidCalls.map((c) => c.name).sort(), [
      "formatter--v1.0.0",
      "formatter--v2.1.0",
    ]);
  });

  test("a listing throw returns the tag-listing-failed arm and asks the seam nothing else", async () => {
    const err = new Error("read failed");
    const fake = createFakeSeam({ listTagsThrows: err });

    const result = await probeMarketplaceTags(options({ seam: fake.seam }));

    assert.deepStrictEqual(result, { kind: "tag-listing-failed", cause: err });
    assert.strictEqual(fake.resolveTagOidCalls.length, 0);
  });

  test("wraps a listing throw that is not an Error before carrying it on the failure arm", async () => {
    const notAnError: unknown = "not an Error object";
    const seam: MarketplaceTagListingSeam = {
      // Thrown rather than handed to Promise.reject so a non-Error failure --
      // the case the probe must wrap -- needs no cast to express.
      listTags: () => {
        throw notAnError;
      },
      resolveTagOid: () => Promise.resolve(""),
    };

    const result = await probeMarketplaceTags(options({ seam }));

    assert.deepStrictEqual(result, {
      kind: "tag-listing-failed",
      cause: new Error("not an Error object"),
    });
  });

  test("a peel throw for one tag returns the tag-listing-failed arm and stops without a second listing attempt", async () => {
    const fake = createFakeSeam({
      tagsByName: { "formatter--v1.0.0": "oid-1" },
      resolveTagOidThrowsFor: "formatter--v1.0.0",
    });

    const result = await probeMarketplaceTags(options({ seam: fake.seam }));

    assert.strictEqual(result.kind, "tag-listing-failed");
    assert.strictEqual(fake.listTagsCalls.length, 1);
  });

  test("two probes for two different plugin names against the same marketplaceRoot call listTags exactly once", async () => {
    const fake = createFakeSeam({
      tagsByName: { "formatter--v1.0.0": "oid-1", "linter--v1.0.0": "oid-2" },
    });
    const tagMemo = new Map<string, readonly ReleaseTagCandidate[]>();

    await probeMarketplaceTags(options({ pluginName: "formatter", seam: fake.seam, tagMemo }));
    await probeMarketplaceTags(options({ pluginName: "linter", seam: fake.seam, tagMemo }));

    assert.strictEqual(fake.listTagsCalls.length, 1);
  });

  test("a failed listing drops its memo entry so a later attempt re-lists instead of replaying the error", async () => {
    const err = new Error("transient");
    const failing = createFakeSeam({ listTagsThrows: err });
    const tagMemo = new Map<string, readonly ReleaseTagCandidate[]>();

    const first = await probeMarketplaceTags(options({ seam: failing.seam, tagMemo }));
    assert.deepStrictEqual(first, { kind: "tag-listing-failed", cause: err });

    const recovered = createFakeSeam({ tagsByName: { "formatter--v1.0.0": "oid-1" } });
    const second = await probeMarketplaceTags(
      options({ seam: recovered.seam, tagMemo, range: "^1.0.0" }),
    );

    assert.deepStrictEqual(second, {
      kind: "pinned",
      tag: "formatter--v1.0.0",
      oid: "oid-1",
      version: "1.0.0",
    });
  });

  test("with no seam supplied, falls through to the real listTags/resolveTagOid pair against a real local repository", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.tag({
      fs,
      dir: repository.dir,
      ref: "formatter--v1.0.0",
      object: repository.initialOid,
    });

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
