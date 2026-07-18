import assert from "node:assert/strict";
import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pluginMirrorKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { githubSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type {
  GitSubdirSource,
  UrlSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

const PIN_40 = "1234567890abcdef1234567890abcdef12345678";
const PIN2_40 = "abcdef1234567890abcdef1234567890abcdef12";

async function freshLocations(): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), "clone-cache-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

// The mock GitOps stub gains a `resolveRemoteRef` method mirroring the new
// GitOps interface primitive (D-77-05): unpinned resolution returns the
// configured remote HEAD; a given ref resolves via the remoteResolveMap. The
// mock records every call so the materialize tests below can assert
// resolveRemoteRef fires ONLY on the unpinned path.

void test("D-77-05: mock resolveRemoteRef resolves an unpinned url to the configured remote HEAD", async () => {
  const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const { gitOps, state } = makeMockGitOps({ remoteHead: HEAD });

  const sha = await gitOps.resolveRemoteRef({ url: "https://example.com/repo" });

  assert.equal(sha, HEAD);
  assert.deepEqual(state.resolveRemoteRefCalls, [{ url: "https://example.com/repo" }]);
});

void test("D-77-05: mock resolveRemoteRef resolves a named ref via the remoteResolveMap", async () => {
  const TAG_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const { gitOps, state } = makeMockGitOps({
    remoteHead: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    remoteResolveMap: { "v1.0.0": TAG_SHA },
  });

  const sha = await gitOps.resolveRemoteRef({ url: "https://example.com/repo", ref: "v1.0.0" });

  assert.equal(sha, TAG_SHA);
  assert.deepEqual(state.resolveRemoteRefCalls, [
    { url: "https://example.com/repo", ref: "v1.0.0" },
  ]);
});

void test("D-77-05: mock resolveRemoteRef throws when resolveRemoteRefThrows is set (offline)", async () => {
  const { gitOps } = makeMockGitOps({
    resolveRemoteRefThrows: new Error("offline"),
  });

  await assert.rejects(
    () => gitOps.resolveRemoteRef({ url: "https://example.com/repo" }),
    /offline/,
  );
});

void test("PROV-03: mock resolveRemoteRef records a threaded auth bundle so an unpinned private HEAD resolution can authenticate (Q1)", async () => {
  const HEAD = "cccccccccccccccccccccccccccccccccccccccc";
  const { gitOps, state } = makeMockGitOps({ remoteHead: HEAD });

  const auth = {
    credentialOps: {
      fill: async (): Promise<null> => Promise.resolve(null),
      approve: async (): Promise<void> => Promise.resolve(),
      reject: async (): Promise<void> => Promise.resolve(),
    },
    host: "gitlab.example.com",
    onAuthRequired: async (): Promise<{ ok: false; reason: string; authAttempted: true }> =>
      Promise.resolve({ ok: false, reason: "no", authAttempted: true }),
  };

  const sha = await gitOps.resolveRemoteRef({ url: "https://gitlab.example.com/o/r", auth });

  assert.equal(sha, HEAD);
  assert.equal(state.resolveRemoteRefCalls.length, 1);
  assert.equal(
    state.resolveRemoteRefCalls[0]?.auth,
    auth,
    "auth bundle must be recorded by reference",
  );
  assert.equal(state.resolveRemoteRefCalls[0]?.auth?.host, "gitlab.example.com");
});

void test("PURL-02/04: materializePluginClone clones into staging, checks out the pin, returns a plugin-clones path", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = makeMockGitOps();

  const cloneRoot = await materializePluginClone({
    locations,
    cloneUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });

  assert.ok(
    cloneRoot.includes(`${path.sep}plugin-clones${path.sep}`),
    `expected cloneRoot under plugin-clones/, got ${cloneRoot}`,
  );
  assert.equal(state.cloneCalls.length, 1, "exactly one clone");
  assert.equal(state.checkoutCalls.length, 1, "exactly one checkout");
  assert.equal(state.checkoutCalls[0]!.ref, PIN_40, "checkout pins the sha");
});

void test("PURL-04: a second materialize of the same url+sha triggers zero additional clones (dedup)", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = makeMockGitOps();

  const first = await materializePluginClone({
    locations,
    cloneUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });
  const second = await materializePluginClone({
    locations,
    cloneUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });

  assert.equal(second, first, "same cloneRoot returned");
  assert.equal(state.cloneCalls.length, 1, "no second clone");
  assert.equal(state.checkoutCalls.length, 1, "no second checkout");
});

void test("PURL-02: a warm cache returns offline even when gitOps.clone throws", async () => {
  const locations = await freshLocations();
  // Pre-create the key dir so the warm-cache short-circuit fires.
  const { gitOps } = makeMockGitOps({ cloneThrows: new Error("network down") });
  const keyDir = await locations.pluginCloneDir(
    // Recompute the key the same way the seam does, via a first (throwing-free)
    // materialize would -- but here we pre-seed the dir directly.
    (await import("../../../extensions/pi-claude-marketplace/domain/clone-key.ts")).pluginCloneKey(
      "https://example.com/repo",
      PIN_40,
    ),
  );
  await mkdir(keyDir, { recursive: true });
  await writeFile(path.join(keyDir, "marker"), "warm");

  const cloneRoot = await materializePluginClone({
    locations,
    cloneUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });

  assert.equal(cloneRoot, keyDir, "returns the warm cache dir");
});

void test("Pitfall: sha wins over ref -- checkout pins the sha, clone singleBranch uses the ref", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = makeMockGitOps();

  await materializePluginClone({
    locations,
    cloneUrl: "https://example.com/repo",
    pin: PIN_40,
    ref: "v2.0.0",
    gitOps,
  });

  assert.equal(state.checkoutCalls[0]!.ref, PIN_40, "checkout uses the sha pin, not the ref");
  assert.equal(state.cloneCalls[0]!.ref, "v2.0.0", "clone ref-hint uses the ref");
  assert.equal(state.cloneCalls[0]!.singleBranch, true, "singleBranch set when ref given");
});

// A 40-hex pin the singleBranch ref-hint clone never fetched: checkout throws
// CommitNotFetchedError until a full (all-heads) fetch pulls the commit local.
// This is the shape where a manifest's sha field moved ahead of a stale ref
// hint, so the pinned commit sits outside the ref hint's history.
const PIN_OUTSIDE_CLOSURE = "30287f5e3f122a646d1ac5ca3ab96e130c52a3ad";

function commitNotFetchedError(ref: string): Error {
  const err = new Error(
    `Failed to checkout "${ref}" because commit ${ref} is not available locally.`,
  );
  err.name = "CommitNotFetchedError";
  return err;
}

void test("PURL-04: a pin outside the ref-hint closure triggers ONE full fetch then retries the checkout to success", async () => {
  const locations = await freshLocations();
  const base = makeMockGitOps();
  let fullyFetched = false;
  const checkouts: string[] = [];
  const gitOps = {
    ...base.gitOps,
    async fetch(opts: Parameters<typeof base.gitOps.fetch>[0]): Promise<void> {
      await base.gitOps.fetch(opts);
      // A full fetch (no ref) rides the clone's wildcard refspec and pulls
      // every head, so the previously-absent pinned commit is now local.
      if (opts.ref === undefined) {
        fullyFetched = true;
      }
    },
    async checkout(opts: Parameters<typeof base.gitOps.checkout>[0]): Promise<void> {
      checkouts.push(opts.ref);
      if (opts.ref === PIN_OUTSIDE_CLOSURE && !fullyFetched) {
        throw commitNotFetchedError(opts.ref);
      }

      await Promise.resolve();
    },
  };

  const cloneRoot = await materializePluginClone({
    locations,
    cloneUrl: "https://example.com/repo",
    pin: PIN_OUTSIDE_CLOSURE,
    ref: "v1.5.5",
    gitOps,
  });

  assert.ok(
    cloneRoot.includes(`${path.sep}plugin-clones${path.sep}`),
    `expected cloneRoot under plugin-clones/, got ${cloneRoot}`,
  );
  assert.equal(base.state.fetchCalls.length, 1, "exactly one recovery fetch");
  assert.equal(
    base.state.fetchCalls[0]!.ref,
    undefined,
    "recovery fetch pulls every head (no ref -> wildcard refspec)",
  );
  assert.deepEqual(
    checkouts,
    [PIN_OUTSIDE_CLOSURE, PIN_OUTSIDE_CLOSURE],
    "checkout attempted, failed, then retried once after the fetch",
  );
});

void test("PURL-04: a pin reachable within the ref-hint closure stays on the fast path with no recovery fetch", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = makeMockGitOps();

  await materializePluginClone({
    locations,
    cloneUrl: "https://example.com/repo",
    pin: PIN_40,
    ref: "v2.0.0",
    gitOps,
  });

  assert.equal(state.checkoutCalls.length, 1, "single checkout, no retry");
  assert.equal(state.fetchCalls.length, 0, "no recovery fetch when the pin is already present");
});

void test("PURL-04: a still-unreachable pin fails clean after the retry (fetch does not make it appear)", async () => {
  const locations = await freshLocations();
  const base = makeMockGitOps();
  const gitOps = {
    ...base.gitOps,
    async checkout(opts: Parameters<typeof base.gitOps.checkout>[0]): Promise<void> {
      // The commit is genuinely absent from the remote: the recovery fetch
      // cannot make it appear, so both attempts throw CommitNotFetchedError.
      if (opts.ref === PIN_OUTSIDE_CLOSURE) {
        throw commitNotFetchedError(opts.ref);
      }

      await Promise.resolve();
    },
  };

  await assert.rejects(
    () =>
      materializePluginClone({
        locations,
        cloneUrl: "https://example.com/repo",
        pin: PIN_OUTSIDE_CLOSURE,
        ref: "v1.5.5",
        gitOps,
      }),
    /is not available locally/,
    "the original CommitNotFetchedError survives the fail-clean fold",
  );
  assert.equal(base.state.fetchCalls.length, 1, "exactly one recovery fetch was attempted");
});

void test("PURL-04: a NO-ref clone whose checkout throws CommitNotFetchedError fails immediately with zero recovery fetches", async () => {
  const locations = await freshLocations();
  const base = makeMockGitOps();
  const gitOps = {
    ...base.gitOps,
    async checkout(opts: Parameters<typeof base.gitOps.checkout>[0]): Promise<void> {
      // A no-ref clone already fetched every head, so an absent commit is
      // genuinely unreachable -- the recovery guard must not fire.
      await Promise.resolve();
      throw commitNotFetchedError(opts.ref);
    },
  };

  await assert.rejects(
    () =>
      materializePluginClone({
        locations,
        cloneUrl: "https://example.com/repo",
        pin: PIN_OUTSIDE_CLOSURE,
        gitOps,
      }),
    /is not available locally/,
    "the CommitNotFetchedError rethrows through the fail-clean fold",
  );
  assert.equal(base.state.fetchCalls.length, 0, "the no-ref arm never attempts a recovery fetch");
  const stagingDir = base.state.cloneCalls[0]!.dir;
  await assert.rejects(
    () => stat(stagingDir),
    { code: "ENOENT" },
    "staging dir no longer exists after rejection (MA-9)",
  );
});

void test("PURL-04: a ref-hint clone whose checkout throws a NON-CommitNotFetchedError does NOT trigger the recovery fetch", async () => {
  const locations = await freshLocations();
  const base = makeMockGitOps();
  const gitOps = {
    ...base.gitOps,
    async checkout(): Promise<void> {
      // EACCES-shaped failure: a plain Error name, so the recovery guard must
      // not read it as a pin outside the ref-hint closure.
      await Promise.resolve();
      throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    },
  };

  await assert.rejects(
    () =>
      materializePluginClone({
        locations,
        cloneUrl: "https://example.com/repo",
        pin: PIN_40,
        ref: "v1.5.5",
        gitOps,
      }),
    /EACCES/,
    "the original non-CommitNotFetchedError rethrows unchanged",
  );
  assert.equal(
    base.state.fetchCalls.length,
    0,
    "a non-CommitNotFetchedError checkout throw never fetches",
  );
  const stagingDir = base.state.cloneCalls[0]!.dir;
  await assert.rejects(
    () => stat(stagingDir),
    { code: "ENOENT" },
    "staging dir no longer exists after rejection (MA-9)",
  );
});

void test("PROV-03: the recovery fetch threads the auth bundle so a private pin outside the ref-hint closure authenticates", async () => {
  const locations = await freshLocations();
  const auth = {
    credentialOps: {
      fill: async (): Promise<null> => Promise.resolve(null),
      approve: async (): Promise<void> => Promise.resolve(),
      reject: async (): Promise<void> => Promise.resolve(),
    },
    host: "gitlab.example.com",
    onAuthRequired: async (): Promise<{ ok: false; reason: string; authAttempted: true }> =>
      Promise.resolve({ ok: false, reason: "no", authAttempted: true }),
  };
  const base = makeMockGitOps();
  let fullyFetched = false;
  const gitOps = {
    ...base.gitOps,
    async fetch(opts: Parameters<typeof base.gitOps.fetch>[0]): Promise<void> {
      await base.gitOps.fetch(opts);
      if (opts.ref === undefined) {
        fullyFetched = true;
      }
    },
    async checkout(opts: Parameters<typeof base.gitOps.checkout>[0]): Promise<void> {
      if (opts.ref === PIN_OUTSIDE_CLOSURE && !fullyFetched) {
        throw commitNotFetchedError(opts.ref);
      }

      await Promise.resolve();
    },
  };

  await materializePluginClone({
    locations,
    cloneUrl: "https://gitlab.example.com/o/r",
    pin: PIN_OUTSIDE_CLOSURE,
    ref: "v1.5.5",
    gitOps,
    auth,
  });

  assert.equal(base.state.fetchCalls.length, 1, "exactly one recovery fetch");
  assert.equal(
    base.state.fetchCalls[0]!.auth,
    auth,
    "auth bundle threaded into the recovery fetch by reference",
  );
});

void test("PROV-02/PROV-03: materializePluginClone with NO auth records a cloneCall whose auth is undefined (public-only, byte-identical)", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = makeMockGitOps();

  await materializePluginClone({
    locations,
    cloneUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });

  assert.equal(state.cloneCalls.length, 1, "exactly one clone");
  assert.equal(state.cloneCalls[0]!.auth, undefined, "public path threads no auth bundle");
});

void test("PROV-03: materializePluginClone with an auth bundle threads it to gitOps.clone", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = makeMockGitOps();

  const auth = {
    credentialOps: {
      fill: async (): Promise<null> => Promise.resolve(null),
      approve: async (): Promise<void> => Promise.resolve(),
      reject: async (): Promise<void> => Promise.resolve(),
    },
    host: "gitlab.example.com",
    onAuthRequired: async (): Promise<{ ok: false; reason: string; authAttempted: true }> =>
      Promise.resolve({ ok: false, reason: "no", authAttempted: true }),
  };

  await materializePluginClone({
    locations,
    cloneUrl: "https://gitlab.example.com/o/r",
    pin: PIN_40,
    gitOps,
    auth,
  });

  assert.equal(state.cloneCalls.length, 1, "exactly one clone");
  assert.equal(
    state.cloneCalls[0]!.auth,
    auth,
    "auth bundle threaded to gitOps.clone by reference",
  );
});

void test("Pitfall: an EEXIST/ENOTEMPTY rename is a warm-cache win (no rethrow)", async () => {
  const locations = await freshLocations();
  const { pluginCloneKey } =
    await import("../../../extensions/pi-claude-marketplace/domain/clone-key.ts");
  const keyDir = await locations.pluginCloneDir(pluginCloneKey("https://example.com/repo", PIN_40));

  // A concurrent winner materializes the key dir AFTER our presence check but
  // BEFORE our rename. Simulate by creating the (non-empty) key dir inside the
  // checkout callback -- the step that runs between presence-check and rename.
  const base = makeMockGitOps();
  const racingGitOps = {
    ...base.gitOps,
    async checkout(opts: { dir: string; ref: string }): Promise<void> {
      await base.gitOps.checkout(opts);
      await mkdir(keyDir, { recursive: true });
      await writeFile(path.join(keyDir, "winner"), "peer");
    },
  };

  const cloneRoot = await materializePluginClone({
    locations,
    cloneUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps: racingGitOps,
  });

  assert.equal(cloneRoot, keyDir, "EEXIST/ENOTEMPTY rename returns the winner's cache dir");
});

void test("MA-9: a clone failure cleans staging and rethrows with the leak suffix appended", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = makeMockGitOps({ cloneThrows: new Error("clone boom") });

  await assert.rejects(
    () =>
      materializePluginClone({
        locations,
        cloneUrl: "https://example.com/repo",
        pin: PIN_40,
        gitOps,
      }),
    /clone boom/,
    "the original clone error is preserved, not masked",
  );
  const stagingDir = state.cloneCalls[0]!.dir;
  await assert.rejects(
    () => stat(stagingDir),
    { code: "ENOENT" },
    "staging dir no longer exists after rejection",
  );
});

void test("D-77-05: resolvePluginPin resolves an unpinned source's remote HEAD to the pin", async () => {
  const HEAD = "cccccccccccccccccccccccccccccccccccccccc";
  const { gitOps, state } = makeMockGitOps({ remoteHead: HEAD });
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/repo",
    url: "https://example.com/repo",
  };

  const resolved = await resolvePluginPin({ source, gitOps });

  assert.equal(resolved.cloneUrl, "https://example.com/repo");
  assert.equal(resolved.pin, HEAD, "unpinned pin = remote HEAD");
  assert.equal(resolved.ref, undefined);
  assert.equal(
    state.resolveRemoteRefCalls.length,
    1,
    "resolveRemoteRef fired on the unpinned path",
  );
});

void test("PROV-03 (Q1): resolvePluginPin forwards an auth bundle into resolveRemoteRef for an unpinned private HEAD resolution", async () => {
  const HEAD = "ffffffffffffffffffffffffffffffffffffffff";
  const { gitOps, state } = makeMockGitOps({ remoteHead: HEAD });
  const auth = {
    credentialOps: {
      fill: async (): Promise<null> => Promise.resolve(null),
      approve: async (): Promise<void> => Promise.resolve(),
      reject: async (): Promise<void> => Promise.resolve(),
    },
    host: "gitlab.example.com",
    onAuthRequired: async (): Promise<{ ok: false; reason: string; authAttempted: true }> =>
      Promise.resolve({ ok: false, reason: "no", authAttempted: true }),
  };
  const source: UrlSource = {
    kind: "url",
    raw: "https://gitlab.example.com/o/r",
    url: "https://gitlab.example.com/o/r",
  };

  const resolved = await resolvePluginPin({ source, gitOps, auth });

  assert.equal(resolved.pin, HEAD);
  assert.equal(state.resolveRemoteRefCalls.length, 1);
  assert.equal(
    state.resolveRemoteRefCalls[0]?.auth,
    auth,
    "the auth bundle threads into resolveRemoteRef by reference",
  );
});

void test("PROV-02: resolvePluginPin with NO auth records a bare resolveRemoteRef call (public-only, byte-identical)", async () => {
  const { gitOps, state } = makeMockGitOps({ remoteHead: PIN_40 });
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/repo",
    url: "https://example.com/repo",
  };

  await resolvePluginPin({ source, gitOps });

  assert.deepEqual(state.resolveRemoteRefCalls, [{ url: "https://example.com/repo" }]);
});

void test("Pitfall: resolvePluginPin does NOT call resolveRemoteRef when a sha is set", async () => {
  const { gitOps, state } = makeMockGitOps({
    remoteHead: "dddddddddddddddddddddddddddddddddddddddd",
  });
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/repo",
    url: "https://example.com/repo",
    sha: PIN2_40,
  };

  const resolved = await resolvePluginPin({ source, gitOps });

  assert.equal(resolved.pin, PIN2_40, "pin = the source sha");
  assert.equal(state.resolveRemoteRefCalls.length, 0, "no remote resolution when sha is pinned");
});

void test("D-77-05: resolvePluginPin resolves a ref (no sha) to its remote sha", async () => {
  const TAG = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0";
  const { gitOps, state } = makeMockGitOps({
    remoteHead: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    remoteResolveMap: { "v1.0.0": TAG },
  });
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/repo",
    url: "https://example.com/repo",
    ref: "v1.0.0",
  };

  const resolved = await resolvePluginPin({ source, gitOps });

  assert.equal(resolved.pin, TAG, "pin = the ref's resolved sha");
  assert.equal(resolved.ref, "v1.0.0", "ref returned as the fetch hint");
  assert.deepEqual(state.resolveRemoteRefCalls, [
    { url: "https://example.com/repo", ref: "v1.0.0" },
  ]);
});

void test("D-77-06: resolvePluginPin reconstructs the canonical github url", async () => {
  const { gitOps } = makeMockGitOps({ remoteHead: PIN_40 });
  const source = githubSource("owner/repo");

  const resolved = await resolvePluginPin({ source, gitOps });

  assert.equal(resolved.cloneUrl, "https://github.com/owner/repo");
  assert.equal(resolved.pin, PIN_40);
});

void test("D-77-04: resolvePluginPin returns the git-subdir url verbatim as the clone url", async () => {
  const { gitOps } = makeMockGitOps({ remoteHead: PIN_40 });
  const source: GitSubdirSource = {
    kind: "git-subdir",
    raw: "https://example.com/mono",
    url: "https://example.com/mono",
    path: "packages/plugin-a",
  };

  const resolved = await resolvePluginPin({ source, gitOps });

  // The clone url is the repo root; the subdir path is resolved later by the
  // resolver (git-subdir pluginRoot = cloneRoot + path).
  assert.equal(resolved.cloneUrl, "https://example.com/mono");
  assert.equal(resolved.pin, PIN_40);
});

const MIRROR_HEAD = "fedcba9876543210fedcba9876543210fedcba98";

// A default-branch mirror mock: the mock's clone seeds refs/heads/main + head;
// refreshGitHubClone's default-branch form (ref undefined) needs
// refs/remotes/origin/HEAD to resolve, so seed remoteRefs accordingly. HEAD
// reads back MIRROR_HEAD.
function mirrorGitOps(): ReturnType<typeof makeMockGitOps> {
  return makeMockGitOps({
    head: MIRROR_HEAD,
    localRefs: { "refs/heads/main": MIRROR_HEAD },
    remoteRefs: { "refs/remotes/origin/HEAD": MIRROR_HEAD },
  });
}

void test("MIRR-01/02: mirror ABSENT materializes into staging then renames to plugin-clones/<bare-key>/, refreshes, returns HEAD", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = mirrorGitOps();

  const { pluginRoot, resolvedSha } = await materializeOrRefreshPluginMirror({
    locations,
    cloneUrl: "https://example.com/repo",
    gitOps,
  });

  const bareKey = pluginMirrorKey("https://example.com/repo");
  assert.ok(
    pluginRoot.includes(`${path.sep}plugin-clones${path.sep}`),
    `expected pluginRoot under plugin-clones/, got ${pluginRoot}`,
  );
  assert.equal(path.basename(pluginRoot), bareKey, "mirror root last segment is the bare key");
  assert.match(path.basename(pluginRoot), /^[0-9a-f]{12}$/, "bare 12-hex key, no sha suffix");
  assert.equal(state.cloneCalls.length, 1, "exactly one clone on the cold mirror");
  // The mirror tracks a moving ref -- it MUST NOT checkout a fixed 40-hex pin.
  assert.ok(
    !state.checkoutCalls.some((c) => /^[a-f0-9]{40}$/i.test(c.ref)),
    "no fixed-pin (40-hex) checkout on the mirror create path",
  );
  assert.equal(resolvedSha, MIRROR_HEAD, "resolvedSha comes from resolveRef(HEAD)");
});

void test("MIRR-02: mirror PRESENT (warm) refreshes in place via refreshGitHubClone rather than short-circuiting", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = mirrorGitOps();

  await materializeOrRefreshPluginMirror({
    locations,
    cloneUrl: "https://example.com/repo",
    gitOps,
  });
  const fetchesAfterFirst = state.fetchCalls.length;
  const clonesAfterFirst = state.cloneCalls.length;

  const second = await materializeOrRefreshPluginMirror({
    locations,
    cloneUrl: "https://example.com/repo",
    gitOps,
  });

  assert.equal(state.cloneCalls.length, clonesAfterFirst, "warm mirror does NOT re-clone");
  assert.ok(
    state.fetchCalls.length > fetchesAfterFirst,
    "warm mirror refreshes: refreshGitHubClone fetched again",
  );
  assert.equal(second.resolvedSha, MIRROR_HEAD);
});

void test("MIRR-02: two successive calls both succeed; the second refreshes rather than throwing (idempotent)", async () => {
  const locations = await freshLocations();
  const { gitOps } = mirrorGitOps();

  const first = await materializeOrRefreshPluginMirror({
    locations,
    cloneUrl: "https://example.com/repo",
    gitOps,
  });
  const second = await materializeOrRefreshPluginMirror({
    locations,
    cloneUrl: "https://example.com/repo",
    gitOps,
  });

  assert.equal(second.pluginRoot, first.pluginRoot, "same bare-key mirror root");
  assert.equal(second.resolvedSha, MIRROR_HEAD);
});

void test("MIRR-01: ref-set mirror clones singleBranch with the ref hint and tracks it (no fixed-pin checkout)", async () => {
  const locations = await freshLocations();
  const TAG_HEAD = "0011223344556677889900112233445566778899";
  const { gitOps, state } = makeMockGitOps({
    head: TAG_HEAD,
    localRefs: { "refs/heads/main": TAG_HEAD },
    remoteRefs: { "refs/remotes/origin/v2.0.0": TAG_HEAD },
  });

  const { resolvedSha } = await materializeOrRefreshPluginMirror({
    locations,
    cloneUrl: "https://example.com/repo",
    ref: "v2.0.0",
    gitOps,
  });

  assert.equal(state.cloneCalls[0]!.ref, "v2.0.0", "clone ref-hint uses the ref");
  assert.equal(state.cloneCalls[0]!.singleBranch, true, "singleBranch set when ref given");
  assert.ok(
    !state.checkoutCalls.some((c) => /^[a-f0-9]{40}$/i.test(c.ref)),
    "no fixed 40-hex pin checkout on the ref-tracking mirror",
  );
  assert.equal(resolvedSha, TAG_HEAD);
});

void test("MIRR-03: a concurrent create losing the rename race treats the winner's dir as the warm mirror (no throw)", async () => {
  const locations = await freshLocations();
  const keyDir = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));

  // A concurrent winner materializes the mirror dir AFTER our presence check but
  // BEFORE our rename. The winning tree is byte-equivalent (same url) -- we must
  // clean staging, fall through to refresh, and read HEAD (no rethrow).
  const base = mirrorGitOps();
  let raced = false;
  const racingGitOps = {
    ...base.gitOps,
    async clone(opts: Parameters<typeof base.gitOps.clone>[0]): Promise<void> {
      await base.gitOps.clone(opts);
      if (!raced) {
        raced = true;
        await mkdir(keyDir, { recursive: true });
        await writeFile(path.join(keyDir, "winner"), "peer");
      }
    },
  };

  const { pluginRoot, resolvedSha } = await materializeOrRefreshPluginMirror({
    locations,
    cloneUrl: "https://example.com/repo",
    gitOps: racingGitOps,
  });

  assert.equal(pluginRoot, keyDir, "returns the winner's mirror dir");
  assert.equal(resolvedSha, MIRROR_HEAD, "still reads HEAD from the winner's tree");
});

void test("MIRR-01/03: a clone failure cleans staging and rethrows the original error", async () => {
  const locations = await freshLocations();
  const { gitOps, state } = makeMockGitOps({ cloneThrows: new Error("mirror clone boom") });

  await assert.rejects(
    () =>
      materializeOrRefreshPluginMirror({
        locations,
        cloneUrl: "https://example.com/repo",
        gitOps,
      }),
    /mirror clone boom/,
  );
  const stagingDir = state.cloneCalls[0]!.dir;
  await assert.rejects(
    () => stat(stagingDir),
    { code: "ENOENT" },
    "staging dir no longer exists after rejection (MA-9)",
  );
});
