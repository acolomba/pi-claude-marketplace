import assert from "node:assert/strict";
import test from "node:test";

import {
  probeDependencyTags,
  type DependencyTagListingSeam,
  type DependencyTagProbeOptions,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts";
import {
  GitCommandError,
  InvalidGitHubBaseUrlError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { setGitHubBaseUrl, setPreferHttps } from "../../shared/github-base-url-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type {
  GitBackedSource,
  GitHubSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { CredentialOps } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { RemoteTag } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { TestContext } from "node:test";

// D-2-01: a url source is queried at the URL as typed, with no `.git` added.
const PLUGIN_REPO_URL = "https://example.com/formatter";

const GITHUB_DEPENDENCY = {
  kind: "github",
  raw: "acme/ghd",
  owner: "acme",
  repo: "ghd",
} satisfies GitHubSource;

// D-SG-20: the two addresses a github owner/repo dependency's tags are listed at.
const GHD_SSH_URL = "git@github.com:acme/ghd.git";
const GHD_HTTPS_URL = "https://github.com/acme/ghd.git";

/** Clears both triggers that force https, so a case reads the default transport. */
function unforced(t: TestContext): void {
  setGitHubBaseUrl(t, undefined);
  setPreferHttps(t, undefined);
}

for (const mode of ["json", "rpc"]) {
  test(`delivers constrained tag authentication through the parent run in ${mode}`, async (t) => {
    // arrange
    setGitHubBaseUrl(t, undefined);
    setPreferHttps(t, "1");
    const capture = createJsonCapture();
    const ctx = {
      mode,
      hasUI: mode === "tui" || mode === "rpc",
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode: {
        device_code: "tag-secret",
        user_code: "TAGS-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 0,
      },
      pollResponses: [
        { kind: "success", accessToken: "token-secret", tokenType: "bearer", scope: "repo" },
      ],
    });
    const seam: DependencyTagListingSeam = {
      async listRemoteTags(options) {
        assert.ok(options.auth?.kind === "device-flow");
        await options.auth.onAuthRequired();
        return [{ name: "formatter--v1.4.0", oid: "tag-oid" }];
      },
    };

    // act
    const outcome = await probeDependencyTags({
      pluginName: "formatter",
      range: "^1.0.0",
      source: { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" },
      seam,
      auth: { ...auth(), ctx, run, deviceFlowHttp: deviceFlow.http },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "pinned",
      tag: "formatter--v1.4.0",
      oid: "tag-oid",
      version: "1.4.0",
    });
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "device-flow-prompt",
          severity: "info",
          needsReload: false,
          verificationUri: "https://github.com/login/device",
          userCode: "TAGS-1234",
        },
      },
    ]);
    capture.assertValid();
  });
}

function auth(): DependencyTagProbeOptions["auth"] {
  const ctx: NotificationContext = { mode: "tui", hasUI: true, ui: { notify: () => undefined } };
  const credentialOps: CredentialOps = {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
  return { ctx, run: runWithNothingLoaded(), credentialOps };
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
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag" });
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
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag" });
});

test("reports no matching tag when no advertised version satisfies", async () => {
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
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag" });
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
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag" });
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
  assert.deepStrictEqual(outcome, { kind: "no-matching-tag" });
  assert.deepStrictEqual(queried, ["https://example.com/acme-marketplace"]);
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

test("rethrows an invalid GitHub base URL instead of returning the failure arm", async () => {
  // arrange
  const invalid = new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme");
  const seam = failingWith(new Error("listing failed", { cause: invalid }), []);

  // act
  const probing = probeDependencyTags({
    pluginName: "formatter",
    source: pluginSource(),
    range: "^1.0.0",
    seam,
    auth: auth(),
  });

  // assert
  await assert.rejects(probing, (error: unknown) => error === invalid);
});

test("classifies an unreachable host on the failure arm", async () => {
  // arrange
  const queried: string[] = [];
  const transportFailure = new GitCommandError(
    { kind: "network", curlCode: 6 },
    { operation: "ls-remote", exitCode: 128 },
  );
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

for (const { statusCode, kind, classification } of [
  { statusCode: 404, kind: "repository-not-found", classification: "source missing" },
  { statusCode: 503, kind: "network", classification: "network error" },
] as const) {
  test(`classifies a host HTTP ${statusCode} on the listing as ${classification} (GLK-01)`, async () => {
    // arrange
    const queried: string[] = [];
    const hostFailure = new GitCommandError(
      { kind, httpStatus: statusCode },
      { operation: "ls-remote", exitCode: 128 },
    );
    const seam = failingWith(hostFailure, queried);

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
      cause: hostFailure,
      classification,
    });
    assert.ok(outcome.kind === "tag-listing-failed");
    assert.strictEqual(outcome.cause, hostFailure);
  });
}

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

test("threads the host credential bundle into the listing for a private source", async (t) => {
  // arrange
  setGitHubBaseUrl(t, undefined);
  setPreferHttps(t, "1");
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
  assert.deepStrictEqual([...tagMemo], []);
  assert.deepStrictEqual(second, first);
  assert.deepStrictEqual(queried, [PLUGIN_REPO_URL, PLUGIN_REPO_URL]);
});

test("D-SG-20: lists a github owner/repo dependency's tags over ssh and memoizes them under that address", async (t) => {
  // arrange
  unforced(t);
  const queried: string[] = [];
  const seam = advertising([{ name: "ghd--v1.0.0", oid: "aaa1" }], queried);
  const tagMemo = new Map<string, readonly RemoteTag[]>();

  // act
  const outcome = await probeDependencyTags({
    pluginName: "ghd",
    source: GITHUB_DEPENDENCY,
    range: "^1.0.0",
    seam,
    tagMemo,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(
    { outcome, queried, memo: [...tagMemo.keys()] },
    {
      outcome: { kind: "pinned", tag: "ghd--v1.0.0", oid: "aaa1", version: "1.0.0" },
      queried: [GHD_SSH_URL],
      memo: [GHD_SSH_URL],
    },
  );
});

test("D-SG-20: serves a github owner/repo dependency from a listing memoized under its ssh address", async (t) => {
  // arrange
  unforced(t);
  const queried: string[] = [];
  const seam = advertising([], queried);
  const tagMemo = new Map<string, readonly RemoteTag[]>([
    [GHD_SSH_URL, [{ name: "ghd--v1.2.0", oid: "bbb2" }]],
    [GHD_HTTPS_URL, [{ name: "ghd--v1.0.0", oid: "aaa1" }]],
  ]);

  // act
  const outcome = await probeDependencyTags({
    pluginName: "ghd",
    source: GITHUB_DEPENDENCY,
    range: "^1.0.0",
    seam,
    tagMemo,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(
    { outcome, queried },
    { outcome: { kind: "pinned", tag: "ghd--v1.2.0", oid: "bbb2", version: "1.2.0" }, queried: [] },
  );
});

/** A listing seam that answers each address with its own tags or failure. */
function answeringPerUrl(
  answers: ReadonlyMap<string, readonly RemoteTag[] | Error>,
  queried: string[],
): DependencyTagListingSeam {
  return {
    listRemoteTags(options) {
      queried.push(options.url);
      const answer = answers.get(options.url);
      return Promise.resolve().then(() => {
        if (answer === undefined || answer instanceof Error) {
          throw answer ?? new Error(`no answer for ${options.url}`);
        }

        return [...answer];
      });
    },
  };
}

const SSH_DENIED = new GitCommandError(
  { kind: "ssh-auth", detail: "publickey" },
  { operation: "ls-remote", exitCode: 128 },
);

test("D-SG-20: retries a github dependency's failed ssh listing once over https, and a later probe of the repository reads that answer with no ssh attempt", async (t) => {
  // arrange
  unforced(t);
  const queried: string[] = [];
  const seam = answeringPerUrl(
    new Map<string, readonly RemoteTag[] | Error>([
      [GHD_SSH_URL, SSH_DENIED],
      [
        GHD_HTTPS_URL,
        [
          { name: "ghd--v1.0.0", oid: "aaa1" },
          { name: "ghd--v2.0.0", oid: "bbb2" },
        ],
      ],
    ]),
    queried,
  );
  const tagMemo = new Map<string, readonly RemoteTag[]>();
  const probe = (range: string) =>
    probeDependencyTags({
      pluginName: "ghd",
      source: GITHUB_DEPENDENCY,
      range,
      seam,
      tagMemo,
      auth: auth(),
    });

  // act
  const first = await probe("^1.0.0");
  const second = await probe("^2.0.0");

  // assert
  assert.deepStrictEqual(
    { first, second, queried },
    {
      first: { kind: "pinned", tag: "ghd--v1.0.0", oid: "aaa1", version: "1.0.0" },
      second: { kind: "pinned", tag: "ghd--v2.0.0", oid: "bbb2", version: "2.0.0" },
      queried: [GHD_SSH_URL, GHD_HTTPS_URL],
    },
  );
});

test("D-SG-20: reports the https attempt's cause and classification when a github dependency's listing fails over both", async (t) => {
  // arrange
  unforced(t);
  const queried: string[] = [];
  const unreachable = new GitCommandError(
    { kind: "network", curlCode: 6 },
    { operation: "ls-remote", exitCode: 128 },
  );
  const seam = answeringPerUrl(
    new Map<string, readonly RemoteTag[] | Error>([
      [GHD_SSH_URL, SSH_DENIED],
      [GHD_HTTPS_URL, unreachable],
    ]),
    queried,
  );
  const tagMemo = new Map<string, readonly RemoteTag[]>();

  // act
  const outcome = await probeDependencyTags({
    pluginName: "ghd",
    source: GITHUB_DEPENDENCY,
    range: "^1.0.0",
    seam,
    tagMemo,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(
    { outcome, queried, memo: [...tagMemo] },
    {
      outcome: {
        kind: "tag-listing-failed",
        cause: unreachable,
        classification: "network unreachable",
      },
      queried: [GHD_SSH_URL, GHD_HTTPS_URL],
      memo: [],
    },
  );
});

for (const { trigger, force } of [
  {
    trigger: "CLAUDE_CODE_PLUGIN_PREFER_HTTPS",
    force: (t: TestContext) => {
      setPreferHttps(t, "1");
    },
  },
  {
    trigger: "the github base override",
    force: (t: TestContext) => {
      setGitHubBaseUrl(t, "https://mirror.example/base");
    },
  },
]) {
  test(`D-SG-20, D-SG-21: lists a github dependency once over https with no ssh attempt under ${trigger}`, async (t) => {
    // arrange
    unforced(t);
    force(t);
    const queried: string[] = [];
    const seam = failingWith(SSH_DENIED, queried);

    // act
    const outcome = await probeDependencyTags({
      pluginName: "ghd",
      source: GITHUB_DEPENDENCY,
      range: "^1.0.0",
      seam,
      auth: auth(),
    });

    // assert
    assert.deepStrictEqual(
      { outcome, queried },
      {
        outcome: {
          kind: "tag-listing-failed",
          cause: SSH_DENIED,
          classification: "authentication required",
        },
        queried: [GHD_HTTPS_URL],
      },
    );
  });
}

for (const failure of [
  new GitCommandError({ kind: "git-missing", detail: "not-found" }, { operation: "lookup" }),
  new GitCommandError({ kind: "aborted" }, { operation: "ls-remote" }),
]) {
  test(`D-SG-20: does not retry a github dependency's ssh listing that failed as ${failure.kind}`, async (t) => {
    // arrange
    unforced(t);
    const queried: string[] = [];
    const seam = failingWith(failure, queried);

    // act
    const outcome = await probeDependencyTags({
      pluginName: "ghd",
      source: GITHUB_DEPENDENCY,
      range: "^1.0.0",
      seam,
      auth: auth(),
    });

    // assert
    assert.deepStrictEqual(
      { cause: outcome.kind === "tag-listing-failed" ? outcome.cause : outcome, queried },
      { cause: failure, queried: [GHD_SSH_URL] },
    );
  });
}

for (const { name, source, url } of [
  {
    name: "a github source spelled as an https URL",
    source: { kind: "github", raw: "https://github.com/acme/ghd", owner: "acme", repo: "ghd" },
    url: GHD_HTTPS_URL,
  },
  {
    name: "a url source",
    source: { kind: "url", raw: GHD_SSH_URL, url: GHD_SSH_URL },
    url: GHD_SSH_URL,
  },
  {
    name: "a git-subdir url",
    source: { kind: "git-subdir", raw: GHD_SSH_URL, url: GHD_SSH_URL, path: "plugins/ghd" },
    url: GHD_SSH_URL,
  },
  {
    name: "a git-subdir owner/repo shorthand",
    source: { kind: "git-subdir", raw: "acme/ghd", url: "acme/ghd", path: "plugins/ghd" },
    url: GHD_SSH_URL,
  },
] satisfies readonly { name: string; source: GitBackedSource; url: string }[]) {
  test(`D-SG-20: lists ${name} once at ${url} and does not retry its failure`, async (t) => {
    // arrange
    unforced(t);
    const queried: string[] = [];
    const seam = failingWith(SSH_DENIED, queried);

    // act
    const outcome = await probeDependencyTags({
      pluginName: "ghd",
      source,
      range: "^1.0.0",
      seam,
      auth: auth(),
    });

    // assert
    assert.deepStrictEqual(
      { kind: outcome.kind, queried },
      { kind: "tag-listing-failed", queried: [url] },
    );
  });
}
