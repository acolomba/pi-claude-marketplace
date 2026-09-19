import assert from "node:assert/strict";
import test from "node:test";

import {
  probeDependencyTags,
  type DependencyTagListingSeam,
  type DependencyTagProbeOptions,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts";

import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { CredentialOps } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { RemoteTag } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const PLUGIN_REPO_URL = "https://example.com/formatter.git";

function auth(): DependencyTagProbeOptions["auth"] {
  const ctx: NotificationContext = { ui: { notify: () => undefined } };
  const credentialOps: CredentialOps = {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
  return { ctx, credentialOps };
}

/** The dependency's own git source repository. */
function pluginSource(): GitBackedSource {
  return {
    kind: "url",
    raw: "https://example.com/formatter",
    url: "https://example.com/formatter",
  };
}

/** The repository the dependency's marketplace itself lives in. */
function marketplaceSource(): GitBackedSource {
  return {
    kind: "url",
    raw: "https://example.com/acme-marketplace",
    url: "https://example.com/acme-marketplace",
  };
}

function advertising(tags: readonly RemoteTag[], queried: string[]): DependencyTagListingSeam {
  return {
    listRemoteTags(options) {
      queried.push(options.url);
      return Promise.resolve([...tags]);
    },
  };
}

function failingWith(error: unknown, queried: string[]): DependencyTagListingSeam {
  return {
    listRemoteTags(options) {
      queried.push(options.url);
      // Thrown rather than handed to Promise.reject so a non-Error transport
      // failure -- the case the probe must wrap -- needs no cast to express.
      return Promise.resolve().then(() => {
        throw error;
      });
    },
  };
}

test("pins a satisfying release tag to the object id it resolves to", async () => {
  // arrange
  const queried: string[] = [];
  const seam = advertising([{ name: "formatter--v1.4.0", oid: "aaa1" }], queried);

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: "^1.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "pinned",
    tag: "formatter--v1.4.0",
    oid: "aaa1",
    version: "1.4.0",
  });
  assert.deepStrictEqual(queried, [PLUGIN_REPO_URL]);
});

test("pins the highest satisfying version when several tags satisfy the range", async () => {
  // arrange
  const queried: string[] = [];
  const seam = advertising(
    [
      { name: "formatter--v1.0.0", oid: "aaa1" },
      { name: "formatter--v3.1.0", oid: "bbb2" },
      { name: "formatter--v2.5.0", oid: "ccc3" },
    ],
    queried,
  );

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: ">=1.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "pinned",
    tag: "formatter--v3.1.0",
    oid: "bbb2",
    version: "3.1.0",
  });
});

test("skips a prefixed tag whose version part is not a version and pins its sibling", async () => {
  // arrange
  const queried: string[] = [];
  const seam = advertising(
    [
      { name: "formatter--vnightly", oid: "aaa1" },
      { name: "formatter--v1.4.0", oid: "bbb2" },
    ],
    queried,
  );

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: "^1.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "pinned",
    tag: "formatter--v1.4.0",
    oid: "bbb2",
    version: "1.4.0",
  });
});

test("never considers a tag that carries a satisfying version without the release prefix", async () => {
  // arrange
  const queried: string[] = [];
  const seam = advertising(
    [
      { name: "other--v2.0.0", oid: "aaa1" },
      { name: "v2.0.0", oid: "bbb2" },
      { name: "formatter-2.0.0", oid: "ccc3" },
    ],
    queried,
  );

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: "^2.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag", range: "^2.0.0" });
});

test("reports no matching tag for a repository advertising no tags at all", async () => {
  // arrange
  const queried: string[] = [];
  const seam = advertising([], queried);

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: "^2.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag", range: "^2.0.0" });
});

test("reports no matching tag with the rendered range when no advertised version satisfies", async () => {
  // arrange
  const queried: string[] = [];
  const seam = advertising(
    [
      { name: "formatter--v1.0.0", oid: "aaa1" },
      { name: "formatter--v1.5.0", oid: "bbb2" },
    ],
    queried,
  );

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: ">=3.0.0 <4.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag", range: ">=3.0.0 <4.0.0" });
});

test("reports the no-match arm when the query ran against the dependency's own source", async () => {
  // arrange
  const queried: string[] = [];
  const seam = advertising([{ name: "formatter--v1.0.0", oid: "aaa1" }], queried);

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: ">=9.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag", range: ">=9.0.0" });
  assert.deepStrictEqual(queried, [PLUGIN_REPO_URL]);
});

test("reports the same no-match arm when the query ran against the marketplace repository", async () => {
  // arrange
  const queried: string[] = [];
  const seam = advertising([{ name: "formatter--v1.0.0", oid: "aaa1" }], queried);

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: marketplaceSource(),
    range: ">=9.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag", range: ">=9.0.0" });
  assert.deepStrictEqual(queried, ["https://example.com/acme-marketplace.git"]);
});

test("returns the failure arm for an unclassifiable listing throw instead of rejecting", async () => {
  // arrange
  const queried: string[] = [];
  const transportFailure = new Error("ref advertisement refused");
  const seam = failingWith(transportFailure, queried);

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: "^1.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "tag-listing-failed",
    cause: transportFailure,
    classification: undefined,
  });
});

test("classifies an unreachable host on the failure arm", async () => {
  // arrange
  const queried: string[] = [];
  const transportFailure = Object.assign(new Error("getaddrinfo ENOTFOUND example.com"), {
    code: "ENOTFOUND",
  });
  const seam = failingWith(transportFailure, queried);

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: "^1.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "tag-listing-failed",
    cause: transportFailure,
    classification: "network unreachable",
  });
});

test("wraps a listing throw that is not an Error before carrying it on the failure arm", async () => {
  // arrange
  const queried: string[] = [];
  const seam = failingWith("ref advertisement refused", queried);

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: "^1.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "tag-listing-failed",
    cause: new Error("ref advertisement refused"),
    classification: undefined,
  });
});

test("threads the host credential bundle into the listing for a private source", async () => {
  // arrange
  const queried: string[] = [];
  let bundled: boolean | undefined;
  const seam: DependencyTagListingSeam = {
    listRemoteTags(options) {
      queried.push(options.url);
      bundled = options.auth !== undefined;
      return Promise.resolve([{ name: "formatter--v2.0.0", oid: "aaa1" }]);
    },
  };

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: { kind: "github", raw: "acme/formatter", owner: "acme", repo: "formatter" },
    range: "^2.0.0",
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "pinned",
    tag: "formatter--v2.0.0",
    oid: "aaa1",
    version: "2.0.0",
  });
  assert.deepStrictEqual(queried, ["https://github.com/acme/formatter.git"]);
  assert.strictEqual(bundled, true);
});

test("serves a second query for the same repository from one listing call", async () => {
  // arrange
  const queried: string[] = [];
  const seam = advertising([{ name: "formatter--v1.4.0", oid: "aaa1" }], queried);
  const tagMemo = new Map<string, readonly RemoteTag[]>();
  const options: DependencyTagProbeOptions = {
    pluginName: "formatter",
    source: pluginSource(),
    range: "^1.0.0",
    seam,
    tagMemo,
    auth: auth(),
  };

  // act
  const first = await probeDependencyTags(options);
  const second = await probeDependencyTags(options);

  // assert
  assert.deepStrictEqual(first, {
    kind: "pinned",
    tag: "formatter--v1.4.0",
    oid: "aaa1",
    version: "1.4.0",
  });
  assert.deepStrictEqual(second, first);
  assert.deepStrictEqual(queried, [PLUGIN_REPO_URL]);
  assert.deepStrictEqual(
    [...tagMemo],
    [[PLUGIN_REPO_URL, [{ name: "formatter--v1.4.0", oid: "aaa1" }]]],
  );
});

test("serves a memoized listing without reaching the production seam", async () => {
  // arrange
  const tagMemo = new Map<string, readonly RemoteTag[]>([
    [PLUGIN_REPO_URL, [{ name: "formatter--v1.4.0", oid: "aaa1" }]],
  ]);

  // act
  const outcome = await probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: "^1.0.0",
    tagMemo,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "pinned",
    tag: "formatter--v1.4.0",
    oid: "aaa1",
    version: "1.4.0",
  });
});

test("a failed listing is never memoized, so a later attempt re-queries instead of replaying the error", async () => {
  // arrange
  const queried: string[] = [];
  const transportFailure = new Error("ref advertisement refused");
  const seam = failingWith(transportFailure, queried);
  const tagMemo = new Map<string, readonly RemoteTag[]>();
  const options: DependencyTagProbeOptions = {
    pluginName: "formatter",
    source: pluginSource(),
    range: "^1.0.0",
    seam,
    tagMemo,
    auth: auth(),
  };

  // act
  const first = await probeDependencyTags(options);
  const second = await probeDependencyTags(options);

  // assert
  assert.deepStrictEqual(first, {
    kind: "tag-listing-failed",
    cause: transportFailure,
    classification: undefined,
  });
  assert.strictEqual(tagMemo.has(PLUGIN_REPO_URL), false);
  assert.deepStrictEqual(second, first);
  assert.deepStrictEqual(queried, [PLUGIN_REPO_URL, PLUGIN_REPO_URL]);
});
