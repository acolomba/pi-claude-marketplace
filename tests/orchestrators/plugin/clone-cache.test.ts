import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import * as git from "isomorphic-git";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { githubSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  canonicalCloneUrl,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolveGitPluginRootWithSubdir,
  resolveGitSubdirRoot,
  resolvePluginPin,
  seedSameRepoPluginMirrors,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";

import type {
  GitBackedSource,
  GitSubdirSource,
  UrlSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type {
  GitAuthBundle,
  GitOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const PIN_40 = "1234567890abcdef1234567890abcdef12345678";
const PIN2_40 = "abcdef1234567890abcdef1234567890abcdef12";
const DEFAULT_CLONE_OID = "0000000000000000000000000000000000000001";

interface GitOpsAdapterOptions {
  readonly checkoutThrows?: Error;
  readonly remoteHead?: string;
  readonly remoteResolveMap?: Readonly<Record<string, string>>;
  readonly resolveRemoteRefThrows?: Error;
  readonly cloneThrows?: Error;
  readonly head?: string;
  readonly localRefs?: Readonly<Record<string, string>>;
  readonly remoteRefs?: Readonly<Record<string, string>>;
}

const ALLOWED_CLONE_CACHE_REMOTES = [
  "https://example.com/mono",
  "https://example.com/mono.git",
  "https://example.com/repo",
  "https://github.com/owner/repo.git",
  "https://gitlab.example.com/o/r",
  "https://gitlab.example.com/o/r.git",
] as const;

function createGitOps(initial: GitOpsAdapterOptions = {}) {
  const normalizedRemoteRefs = Object.fromEntries(
    Object.entries(initial.remoteRefs ?? {}).map(([ref, oid]) => [
      ref.replace(/^refs\/remotes\/[^/]+\//, ""),
      oid,
    ]),
  );
  const initialOid = initial.head ?? "";
  const remoteHead = initial.remoteHead ?? initial.head ?? "";
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: ALLOWED_CLONE_CACHE_REMOTES,
    initialOid,
    remoteHead,
    remoteRefs: {
      ...normalizedRemoteRefs,
      ...(initial.remoteRefs ?? {}),
      ...(initial.remoteResolveMap ?? {}),
    },
    ...(initial.localRefs === undefined ? {} : { localRefs: initial.localRefs }),
    ...(initial.cloneThrows === undefined ? {} : { cloneError: initial.cloneThrows }),
    ...(initial.resolveRemoteRefThrows === undefined
      ? {}
      : { resolveRemoteRefError: initial.resolveRemoteRefThrows }),
  });

  for (const ref of Object.keys(git.state.localRefs)) {
    Reflect.deleteProperty(git.state.localRefs, ref);
  }

  Object.assign(git.state.localRefs, initial.localRefs ?? {});
  git.state.head = initialOid;
  git.state.branch = Object.keys(git.state.localRefs).includes("refs/heads/main")
    ? "main"
    : undefined;

  const gitOps: GitOps = {
    ...git.gitOps,
    async clone(options) {
      await git.gitOps.clone(options);
      await mkdir(options.dir, { recursive: true });

      if (initial.head === undefined && initial.localRefs === undefined) {
        git.state.localRefs["refs/heads/main"] = DEFAULT_CLONE_OID;
        git.state.head = DEFAULT_CLONE_OID;
        git.state.branch = "main";
      }
    },
    async fetch(options) {
      await git.gitOps.fetch(options);
    },
    async checkout(options) {
      if (initial.checkoutThrows !== undefined) {
        throw initial.checkoutThrows;
      }

      try {
        await git.gitOps.checkout(options);
      } catch (error) {
        const remoteOid =
          git.state.remoteRefs[options.ref] ??
          git.state.remoteRefs[`refs/remotes/origin/${options.ref}`];
        if (remoteOid !== undefined) {
          git.state.head = remoteOid;
          git.state.branch = undefined;
          return;
        }

        throw error;
      }
    },
    async resolveRef(options) {
      try {
        return await git.gitOps.resolveRef(options);
      } catch (error) {
        const remoteOid =
          git.state.remoteRefs[options.ref] ??
          (options.ref === "refs/remotes/origin/HEAD"
            ? git.state.remoteRefs["refs/remotes/origin/main"]
            : undefined);
        if (remoteOid !== undefined) {
          return remoteOid;
        }

        throw error;
      }
    },
    async resolveRemoteRef(options) {
      return git.gitOps.resolveRemoteRef(options);
    },
  };

  return {
    gitOps,
    state: Object.assign(git.state, {
      cloneCalls: git.state.calls.clone,
      fetchCalls: git.state.calls.fetch,
      forceUpdateRefCalls: git.state.calls.forceUpdateRef,
      checkoutCalls: git.state.calls.checkout,
      resolveRefCalls: git.state.calls.resolveRef,
      currentBranchCalls: git.state.calls.currentBranch,
      resolveRemoteRefCalls: git.state.calls.resolveRemoteRef,
    }),
  };
}

/** A stored-credential bundle for a clone the remote never challenges. */
function publicCloneAuth(): GitAuthBundle {
  return {
    kind: "stored-credential",
    credentialOps: {
      fill: () => Promise.reject(new Error("a public clone never consults the helper")),
      approve: () => Promise.reject(new Error("a public clone never stores a credential")),
      reject: () => Promise.reject(new Error("a public clone never evicts a credential")),
    },
    host: "example.com",
  };
}

async function freshLocations(t: TestContext): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), "clone-cache-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

void test("PURL-02: a warm cache uses the default git surface without making a git call", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/warm-default";
  const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, PIN_40));
  await mkdir(cloneRoot, { recursive: true });
  await writeFile(path.join(cloneRoot, "sentinel"), "warm\n");

  // act
  const materialized = await materializePluginClone({
    auth: publicCloneAuth(),
    locations,
    cloneUrl,
    networkUrl: cloneUrl,
    pin: PIN_40,
  });

  // assert
  assert.equal(materialized, cloneRoot);
  assert.equal(await pathExists(path.join(cloneRoot, "sentinel")), true);
});

void test("D-77-04: a pinned source uses the default git surface without remote resolution", async () => {
  // arrange
  const source: UrlSource = {
    kind: "url",
    raw: `https://example.com/pinned.git#${PIN_40}`,
    sha: PIN_40,
    url: "https://example.com/pinned",
  };

  // act
  const resolved = await resolvePluginPin({ source });

  // assert
  assert.deepEqual(resolved, {
    cloneUrl: "https://example.com/pinned",
    pin: PIN_40,
  });
});

void test("PURL-02/04: materializePluginClone clones into staging, checks out the pin, returns a plugin-clones path", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();

  const cloneRoot = await materializePluginClone({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });

  assert.ok(
    cloneRoot.includes(`${path.sep}plugin-clones${path.sep}`),
    `expected cloneRoot under plugin-clones/, got ${cloneRoot}`,
  );
  assert.equal(state.cloneCalls.length, 1, "MURL-09: exactly one clone attempt");
  assert.equal(state.cloneCalls[0]?.url, "https://example.com/repo");
  assert.equal(state.checkoutCalls.length, 1, "exactly one checkout");
  assert.equal(state.checkoutCalls[0]!.ref, PIN_40, "checkout pins the sha");
});

void test("PURL-04: a second materialize of the same url+sha triggers zero additional clones (dedup)", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();

  const first = await materializePluginClone({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });
  const second = await materializePluginClone({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });

  assert.equal(second, first, "same cloneRoot returned");
  assert.equal(state.cloneCalls.length, 1, "no second clone");
  assert.equal(state.checkoutCalls.length, 1, "no second checkout");
});

void test("PURL-02: a warm cache returns offline even when gitOps.clone throws", async (t) => {
  const locations = await freshLocations(t);
  // Pre-create the key dir so the warm-cache short-circuit fires.
  const { gitOps } = createGitOps({ cloneThrows: new Error("network down") });
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
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });

  assert.equal(cloneRoot, keyDir, "returns the warm cache dir");
});

void test("Pitfall: sha wins over ref -- checkout pins the sha, clone singleBranch uses the ref", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();

  await materializePluginClone({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
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

void test("PURL-04: a pin outside the ref-hint closure triggers ONE full fetch then retries the checkout to success", async (t) => {
  const locations = await freshLocations(t);
  const base = createGitOps();
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
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
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

void test("PURL-04: a pin reachable within the ref-hint closure stays on the fast path with no recovery fetch", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();

  await materializePluginClone({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    ref: "v2.0.0",
    gitOps,
  });

  assert.equal(state.checkoutCalls.length, 1, "single checkout, no retry");
  assert.equal(state.fetchCalls.length, 0, "no recovery fetch when the pin is already present");
});

void test("PURL-04: a still-unreachable pin fails clean after the retry (fetch does not make it appear)", async (t) => {
  const locations = await freshLocations(t);
  const base = createGitOps();
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
        auth: publicCloneAuth(),
        locations,
        cloneUrl: "https://example.com/repo",
        networkUrl: "https://example.com/repo",
        pin: PIN_OUTSIDE_CLOSURE,
        ref: "v1.5.5",
        gitOps,
      }),
    /is not available locally/,
    "the original CommitNotFetchedError survives the fail-clean fold",
  );
  assert.equal(base.state.fetchCalls.length, 1, "exactly one recovery fetch was attempted");
});

void test("PURL-04: a NO-ref clone whose checkout throws CommitNotFetchedError fails immediately with zero recovery fetches", async (t) => {
  const locations = await freshLocations(t);
  const base = createGitOps();
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
        auth: publicCloneAuth(),
        locations,
        cloneUrl: "https://example.com/repo",
        networkUrl: "https://example.com/repo",
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

void test("PURL-04: a ref-hint clone whose checkout throws a NON-CommitNotFetchedError does NOT trigger the recovery fetch", async (t) => {
  const locations = await freshLocations(t);
  const base = createGitOps();
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
        auth: publicCloneAuth(),
        locations,
        cloneUrl: "https://example.com/repo",
        networkUrl: "https://example.com/repo",
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

void test("PROV-03: the recovery fetch threads the auth bundle so a private pin outside the ref-hint closure authenticates", async (t) => {
  const locations = await freshLocations(t);
  const auth: GitAuthBundle = {
    credentialOps: {
      fill: async (): Promise<null> => Promise.resolve(null),
      approve: async (): Promise<void> => Promise.resolve(),
      reject: async (): Promise<void> => Promise.resolve(),
    },
    host: "gitlab.example.com",
    kind: "stored-credential",
  };
  const base = createGitOps();
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
    networkUrl: "https://gitlab.example.com/o/r",
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

void test("PROV-03: materializePluginClone with an auth bundle threads it to gitOps.clone", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();

  const auth: GitAuthBundle = {
    credentialOps: {
      fill: async (): Promise<null> => Promise.resolve(null),
      approve: async (): Promise<void> => Promise.resolve(),
      reject: async (): Promise<void> => Promise.resolve(),
    },
    host: "gitlab.example.com",
    kind: "stored-credential",
  };

  await materializePluginClone({
    locations,
    cloneUrl: "https://gitlab.example.com/o/r",
    networkUrl: "https://gitlab.example.com/o/r",
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

void test("Pitfall: an EEXIST/ENOTEMPTY rename is a warm-cache win (no rethrow)", async (t) => {
  const locations = await freshLocations(t);
  const { pluginCloneKey } =
    await import("../../../extensions/pi-claude-marketplace/domain/clone-key.ts");
  const keyDir = await locations.pluginCloneDir(pluginCloneKey("https://example.com/repo", PIN_40));

  // A concurrent winner materializes the key dir AFTER our presence check but
  // BEFORE our rename. Simulate by creating the (non-empty) key dir inside the
  // checkout callback -- the step that runs between presence-check and rename.
  const base = createGitOps();
  const racingGitOps = {
    ...base.gitOps,
    async checkout(opts: { dir: string; ref: string }): Promise<void> {
      await base.gitOps.checkout(opts);
      await mkdir(keyDir, { recursive: true });
      await writeFile(path.join(keyDir, "winner"), "peer");
    },
  };

  const cloneRoot = await materializePluginClone({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps: racingGitOps,
  });

  assert.equal(cloneRoot, keyDir, "EEXIST/ENOTEMPTY rename returns the winner's cache dir");
});

void test("MA-9: a non-race promotion failure cleans staging and preserves the rename error", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const base = createGitOps();
  const gitOps: GitOps = {
    ...base.gitOps,
    async checkout(options): Promise<void> {
      await base.gitOps.checkout(options);
      await rm(options.dir, { force: true, recursive: true });
    },
  };
  let promotionError: unknown;

  // act
  try {
    await materializePluginClone({
      auth: publicCloneAuth(),
      locations,
      cloneUrl: "https://example.com/repo",
      networkUrl: "https://example.com/repo",
      pin: PIN_40,
      gitOps,
    });
  } catch (error) {
    promotionError = error;
  }

  // assert
  assert.ok(promotionError instanceof Error);
  assert.match(promotionError.message, /ENOENT/);
  assert.deepEqual(await stagingEntries(locations), []);
});

void test("MA-9: a clone failure cleans staging and rethrows with the leak suffix appended", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps({ cloneThrows: new Error("clone boom") });

  await assert.rejects(
    () =>
      materializePluginClone({
        auth: publicCloneAuth(),
        locations,
        cloneUrl: "https://example.com/repo",
        networkUrl: "https://example.com/repo",
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
  const { gitOps, state } = createGitOps({ remoteHead: HEAD });
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
  const { gitOps, state } = createGitOps({ remoteHead: HEAD });
  const auth: GitAuthBundle = {
    credentialOps: {
      fill: async (): Promise<null> => Promise.resolve(null),
      approve: async (): Promise<void> => Promise.resolve(),
      reject: async (): Promise<void> => Promise.resolve(),
    },
    host: "gitlab.example.com",
    kind: "stored-credential",
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
  const { gitOps, state } = createGitOps({ remoteHead: PIN_40 });
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/repo",
    url: "https://example.com/repo",
  };

  await resolvePluginPin({ source, gitOps });

  assert.equal(state.resolveRemoteRefCalls.length, 1, "MURL-09: exactly one attempt");
  assert.deepEqual(state.resolveRemoteRefCalls, [{ url: "https://example.com/repo" }]);
});

void test("Pitfall: resolvePluginPin does NOT call resolveRemoteRef when a sha is set", async () => {
  const { gitOps, state } = createGitOps({
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
  const { gitOps, state } = createGitOps({
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

void test("PROV-03: resolvePluginPin forwards auth while resolving a named private ref", async () => {
  // arrange
  const refPin = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0";
  const { gitOps, state } = createGitOps({ remoteResolveMap: { private: refPin } });
  const auth: GitAuthBundle = {
    credentialOps: {
      approve: async (): Promise<void> => Promise.resolve(),
      fill: async (): Promise<null> => Promise.resolve(null),
      reject: async (): Promise<void> => Promise.resolve(),
    },
    host: "gitlab.example.com",
    kind: "stored-credential",
  };
  const source: UrlSource = {
    kind: "url",
    raw: "https://gitlab.example.com/o/r#private",
    ref: "private",
    url: "https://gitlab.example.com/o/r",
  };

  // act
  const resolved = await resolvePluginPin({ source, gitOps, auth });

  // assert
  assert.deepEqual(resolved, {
    cloneUrl: "https://gitlab.example.com/o/r",
    pin: refPin,
    ref: "private",
  });
  assert.deepEqual(state.resolveRemoteRefCalls, [
    { auth, ref: "private", url: "https://gitlab.example.com/o/r" },
  ]);
});

void test("D-77-06: resolvePluginPin reconstructs the canonical github url", async () => {
  const { gitOps } = createGitOps({ remoteHead: PIN_40 });
  const source = githubSource("owner/repo");

  const resolved = await resolvePluginPin({ source, gitOps });

  assert.equal(resolved.cloneUrl, "https://github.com/owner/repo");
  assert.equal(resolved.pin, PIN_40);
});

void test("D-77-04: resolvePluginPin returns the git-subdir url verbatim as the clone url", async () => {
  const { gitOps } = createGitOps({ remoteHead: PIN_40 });
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

void test("MURL-08 / PURL-09: resolvePluginPin sends the url as typed and still returns the canonical cache-key identity", async () => {
  const { gitOps, state } = createGitOps({ remoteHead: PIN_40 });
  const source: UrlSource = {
    kind: "url",
    raw: "https://gitlab.example.com/o/r.git",
    url: "https://gitlab.example.com/o/r",
  };

  const resolved = await resolvePluginPin({ source, gitOps });

  assert.equal(
    state.resolveRemoteRefCalls[0]?.url,
    "https://gitlab.example.com/o/r.git",
    "the wire url is sent as typed, keeping the user's .git decision",
  );
  assert.equal(
    resolved.cloneUrl,
    "https://gitlab.example.com/o/r",
    "the returned cloneUrl stays the cache-key identity form",
  );
});

void test("MURL-08 / PURL-04: resolvePluginPin sends the git-subdir url to the wire verbatim, suffix and all", async () => {
  const { gitOps, state } = createGitOps({ remoteHead: PIN_40 });
  const source: GitSubdirSource = {
    kind: "git-subdir",
    raw: "https://example.com/mono.git",
    url: "https://example.com/mono.git",
    path: "packages/plugin-a",
  };

  const resolved = await resolvePluginPin({ source, gitOps });

  assert.equal(state.resolveRemoteRefCalls[0]?.url, "https://example.com/mono.git");
  assert.equal(resolved.cloneUrl, "https://example.com/mono.git");
});

void test("MURL-01 / PURL-09: resolvePluginPin sends the suffixed github url and returns the suffix-less canonical one", async () => {
  const { gitOps, state } = createGitOps({ remoteHead: PIN_40 });
  const source = githubSource("owner/repo");

  const resolved = await resolvePluginPin({ source, gitOps });

  assert.equal(state.resolveRemoteRefCalls[0]?.url, "https://github.com/owner/repo.git");
  assert.equal(resolved.cloneUrl, "https://github.com/owner/repo");
});

void test("MURL-09: resolvePluginPin makes exactly one resolveRemoteRef attempt and a 404 keeps its original identity", async () => {
  const notFound = Object.assign(new Error("HTTP Error: 404"), {
    code: "HttpError",
    data: { statusCode: 404 },
  });
  const { gitOps, state } = createGitOps({ resolveRemoteRefThrows: notFound });
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/repo",
    url: "https://example.com/repo",
  };

  await assert.rejects(
    () => resolvePluginPin({ source, gitOps }),
    (error: unknown) => error === notFound,
  );
  assert.equal(state.resolveRemoteRefCalls.length, 1, "no retry after the 404");
  assert.equal(state.resolveRemoteRefCalls[0]?.url, "https://example.com/repo");
});

void test("MURL-08 / PURL-04: materializePluginClone forwards the caller's wire url and keys the dir off the identity url", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();
  const cloneUrl = "https://gitlab.example.com/o/r";
  const wireUrl = "https://gitlab.example.com/o/r.git";

  const cloneRoot = await materializePluginClone({
    auth: publicCloneAuth(),
    locations,
    cloneUrl,
    networkUrl: wireUrl,
    pin: PIN_40,
    gitOps,
  });

  assert.equal(state.cloneCalls[0]?.url, wireUrl, "the caller's wire url reaches the network");
  assert.equal(
    cloneRoot,
    await locations.pluginCloneDir(pluginCloneKey(cloneUrl, PIN_40)),
    "the disk key hashes the identity url, not the wire url",
  );
});

void test("MURL-09: materializePluginClone makes exactly one clone attempt and a 401 keeps its original identity", async (t) => {
  const locations = await freshLocations(t);
  const unauthorized = Object.assign(new Error("HTTP Error: 401"), {
    code: "HttpError",
    data: { statusCode: 401 },
  });
  const { gitOps, state } = createGitOps({ cloneThrows: unauthorized });

  await assert.rejects(
    () =>
      materializePluginClone({
        auth: publicCloneAuth(),
        locations,
        cloneUrl: "https://example.com/repo",
        networkUrl: "https://example.com/repo",
        pin: PIN_40,
        gitOps,
      }),
    (error: unknown) => error === unauthorized,
  );
  assert.equal(state.cloneCalls.length, 1, "no retry after the 401");
  assert.equal(state.cloneCalls[0]?.url, "https://example.com/repo");
});

const MIRROR_HEAD = "fedcba9876543210fedcba9876543210fedcba98";

// A default-branch mirror mock: the mock's clone seeds refs/heads/main + head;
// refreshGitHubClone's default-branch form (ref undefined) needs
// refs/remotes/origin/HEAD to resolve, so seed remoteRefs accordingly. HEAD
// reads back MIRROR_HEAD.
function mirrorGitOps(): ReturnType<typeof createGitOps> {
  return createGitOps({
    head: MIRROR_HEAD,
    localRefs: { "refs/heads/main": MIRROR_HEAD },
    remoteRefs: { "refs/remotes/origin/HEAD": MIRROR_HEAD },
  });
}

void test("MIRR-01/02: mirror ABSENT materializes into staging then renames to plugin-clones/<bare-key>/, refreshes, returns HEAD", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = mirrorGitOps();

  const { pluginRoot, resolvedSha } = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
  });

  const bareKey = pluginMirrorKey("https://example.com/repo");
  assert.ok(
    pluginRoot.includes(`${path.sep}plugin-clones${path.sep}`),
    `expected pluginRoot under plugin-clones/, got ${pluginRoot}`,
  );
  assert.equal(path.basename(pluginRoot), bareKey, "mirror root last segment is the bare key");
  assert.match(path.basename(pluginRoot), /^[0-9a-f]{12}$/, "bare 12-hex key, no sha suffix");
  assert.equal(state.cloneCalls.length, 1, "MURL-09: exactly one clone attempt");
  assert.equal(state.cloneCalls[0]?.url, "https://example.com/repo");
  // The mirror tracks a moving ref -- it MUST NOT checkout a fixed 40-hex pin.
  assert.ok(
    !state.checkoutCalls.some((c) => /^[a-f0-9]{40}$/i.test(c.ref)),
    "no fixed-pin (40-hex) checkout on the mirror create path",
  );
  assert.equal(resolvedSha, MIRROR_HEAD, "resolvedSha comes from resolveRef(HEAD)");
});

void test("MURL-08 / PURL-04: materializeOrRefreshPluginMirror forwards the caller's wire url and keys the mirror off the identity url", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = mirrorGitOps();
  const cloneUrl = "https://gitlab.example.com/o/r";
  const wireUrl = "https://gitlab.example.com/o/r.git";

  const { pluginRoot } = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl,
    networkUrl: wireUrl,
    gitOps,
  });

  assert.equal(state.cloneCalls[0]?.url, wireUrl, "the caller's wire url reaches the network");
  assert.equal(
    pluginRoot,
    await locations.pluginCloneDir(pluginMirrorKey(cloneUrl)),
    "the mirror key hashes the identity url, not the wire url",
  );
});

void test("MURL-09: materializeOrRefreshPluginMirror makes exactly one clone attempt and a 404 keeps its original identity", async (t) => {
  const locations = await freshLocations(t);
  const notFound = Object.assign(new Error("HTTP Error: 404"), {
    code: "HttpError",
    data: { statusCode: 404 },
  });
  const { gitOps, state } = createGitOps({ cloneThrows: notFound });

  await assert.rejects(
    () =>
      materializeOrRefreshPluginMirror({
        auth: publicCloneAuth(),
        locations,
        cloneUrl: "https://example.com/repo",
        networkUrl: "https://example.com/repo",
        gitOps,
      }),
    (error: unknown) => error === notFound,
  );
  assert.equal(state.cloneCalls.length, 1, "no retry after the 404");
  assert.equal(state.cloneCalls[0]?.url, "https://example.com/repo");
});

void test("MIRR-02: mirror PRESENT (warm) refreshes in place via refreshGitHubClone rather than short-circuiting", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = mirrorGitOps();

  await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
  });
  const fetchesAfterFirst = state.fetchCalls.length;
  const clonesAfterFirst = state.cloneCalls.length;

  const second = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
  });

  assert.equal(state.cloneCalls.length, clonesAfterFirst, "warm mirror does NOT re-clone");
  assert.ok(
    state.fetchCalls.length > fetchesAfterFirst,
    "warm mirror refreshes: refreshGitHubClone fetched again",
  );
  assert.equal(second.resolvedSha, MIRROR_HEAD);
});

void test("MIRR-02: two successive calls both succeed; the second refreshes rather than throwing (idempotent)", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps } = mirrorGitOps();

  const first = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
  });
  const second = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
  });

  assert.equal(second.pluginRoot, first.pluginRoot, "same bare-key mirror root");
  assert.equal(second.resolvedSha, MIRROR_HEAD);
});

void test("MIRR-01: ref-set mirror clones singleBranch with the ref hint and tracks it (no fixed-pin checkout)", async (t) => {
  const locations = await freshLocations(t);
  const TAG_HEAD = "0011223344556677889900112233445566778899";
  const { gitOps, state } = createGitOps({
    head: TAG_HEAD,
    localRefs: { "refs/heads/main": TAG_HEAD },
    remoteRefs: { "refs/remotes/origin/v2.0.0": TAG_HEAD },
  });

  const { resolvedSha } = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
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

void test("PROV-03: a private mirror forwards auth through clone and refresh fetch", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const { gitOps, state } = mirrorGitOps();
  const auth: GitAuthBundle = {
    credentialOps: {
      approve: async (): Promise<void> => Promise.resolve(),
      fill: async (): Promise<null> => Promise.resolve(null),
      reject: async (): Promise<void> => Promise.resolve(),
    },
    host: "gitlab.example.com",
    kind: "stored-credential",
  };

  // act
  const result = await materializeOrRefreshPluginMirror({
    locations,
    cloneUrl: "https://gitlab.example.com/o/r",
    networkUrl: "https://gitlab.example.com/o/r",
    gitOps,
    auth,
  });

  // assert
  assert.deepEqual(result, {
    pluginRoot: await locations.pluginCloneDir(pluginMirrorKey("https://gitlab.example.com/o/r")),
    resolvedSha: MIRROR_HEAD,
  });
  assert.equal(state.cloneCalls[0]?.auth, auth);
  assert.equal(state.fetchCalls[0]?.auth, auth);
});

void test("MIRR-02: the default git surface fails locally on an invalid warm mirror", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));
  await mkdir(mirrorRoot, { recursive: true });
  let refreshError: unknown;

  // act
  try {
    await materializeOrRefreshPluginMirror({
      auth: publicCloneAuth(),
      locations,
      cloneUrl: "https://example.com/repo",
      networkUrl: "https://example.com/repo",
    });
  } catch (error) {
    refreshError = error;
  }

  // assert
  assert.ok(refreshError instanceof Error);
  assert.deepEqual(
    { message: refreshError.message, name: refreshError.name },
    { message: "Could not find HEAD.", name: "NotFoundError" },
  );
  assert.equal(await pathExists(mirrorRoot), true);
});

void test("MIRR-03: a concurrent create losing the rename race treats the winner's dir as the warm mirror (no throw)", async (t) => {
  const locations = await freshLocations(t);
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
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps: racingGitOps,
  });

  assert.equal(pluginRoot, keyDir, "returns the winner's mirror dir");
  assert.equal(resolvedSha, MIRROR_HEAD, "still reads HEAD from the winner's tree");
});

void test("MIRR-01/03: a clone failure cleans staging and rethrows the original error", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps({ cloneThrows: new Error("mirror clone boom") });

  await assert.rejects(
    () =>
      materializeOrRefreshPluginMirror({
        auth: publicCloneAuth(),
        locations,
        cloneUrl: "https://example.com/repo",
        networkUrl: "https://example.com/repo",
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

const GITHUB_REPO_URL = "https://github.com/owner/repo";
const OTHER_REPO_URL = "https://other.example.com/different";

async function buildMarketplaceCheckout(options: {
  originUrl?: string;
  plugins: unknown[];
}): Promise<string> {
  const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-marketplace-"));
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(marketplaceRoot, "plugins", "foo", ".claude-plugin"), {
    recursive: true,
  });
  await writeFile(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ name: "marketplace", plugins: options.plugins }),
  );
  await writeFile(
    path.join(marketplaceRoot, "plugins", "foo", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "foo" }),
  );
  await git.init({ fs, dir: marketplaceRoot, defaultBranch: "main" });
  if (options.originUrl !== undefined) {
    await git.addRemote({ fs, dir: marketplaceRoot, remote: "origin", url: options.originUrl });
  }

  await git.add({ fs, dir: marketplaceRoot, filepath: ".claude-plugin/marketplace.json" });
  await git.add({ fs, dir: marketplaceRoot, filepath: "plugins/foo/.claude-plugin/plugin.json" });
  await git.commit({
    fs,
    dir: marketplaceRoot,
    message: "initial marketplace",
    author: { email: "test@example.com", name: "test" },
  });
  return marketplaceRoot;
}

async function saveMarketplace(
  locations: ScopedLocations,
  marketplaceRoot: string,
  source: unknown,
): Promise<void> {
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      marketplace: {
        addedFromCwd: "/workspace",
        manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot,
        name: "marketplace",
        plugins: {},
        scope: "project",
        source,
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

function gitSubdirEntry(
  name: string,
  url: string,
  extra: Readonly<Record<string, unknown>> = {},
): unknown {
  return {
    name,
    source: { path: "plugins/foo", source: "git-subdir", url, ...extra },
  };
}

async function stagingEntries(locations: ScopedLocations): Promise<string[]> {
  try {
    return (await readdir(path.join(locations.extensionRoot, "sources-staging"))).sort();
  } catch {
    return [];
  }
}

void test("SEED-01/03: same-repository git source kinds seed once in manifest order and unrelated kinds stay cold", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: GITHUB_REPO_URL,
    plugins: [
      { name: "url", source: GITHUB_REPO_URL },
      gitSubdirEntry("subdir", GITHUB_REPO_URL),
      { name: "github", source: "owner/repo" },
      { name: "local", source: "./plugins/foo" },
      { name: "other", source: OTHER_REPO_URL },
    ],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));
  const otherRoot = await locations.pluginCloneDir(pluginMirrorKey(OTHER_REPO_URL));
  const mirrorHead = await git.resolveRef({ fs, dir: mirrorRoot, ref: "HEAD" });
  const originUrl: unknown = await git.getConfig({
    fs,
    dir: mirrorRoot,
    path: "remote.origin.url",
  });

  // assert
  assert.match(mirrorHead, /^[0-9a-f]{40}$/);
  assert.equal(originUrl, GITHUB_REPO_URL);
  assert.equal(await pathExists(mirrorRoot), true);
  assert.equal(await pathExists(otherRoot), false);
  assert.deepEqual(await stagingEntries(locations), []);
});

void test("SEED-02: a path marketplace derives its canonical URL from the local origin config", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: GITHUB_REPO_URL,
    plugins: [gitSubdirEntry("subdir", GITHUB_REPO_URL)],
  });
  await saveMarketplace(locations, marketplaceRoot, marketplaceRoot);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.equal(await pathExists(mirrorRoot), true);
});

void test("SEED-02: a path marketplace without an origin remote leaves the clone cache empty", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    plugins: [gitSubdirEntry("subdir", GITHUB_REPO_URL)],
  });
  await saveMarketplace(locations, marketplaceRoot, marketplaceRoot);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.equal(await pathExists(mirrorRoot), false);
});

void test("SEED-02: a path marketplace without git metadata leaves the clone cache empty", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-nongit-"));
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "marketplace",
      plugins: [gitSubdirEntry("subdir", GITHUB_REPO_URL)],
    }),
  );
  await saveMarketplace(locations, marketplaceRoot, marketplaceRoot);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.equal(await pathExists(mirrorRoot), false);
});

void test("SEED-02: an origin that is not a git source leaves the clone cache empty", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: "/local/checkout",
    plugins: [gitSubdirEntry("subdir", GITHUB_REPO_URL)],
  });
  await saveMarketplace(locations, marketplaceRoot, marketplaceRoot);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.equal(await pathExists(mirrorRoot), false);
});

void test("SEED-02: an unsupported stored marketplace source leaves the clone cache empty", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: GITHUB_REPO_URL,
    plugins: [gitSubdirEntry("subdir", GITHUB_REPO_URL)],
  });
  await saveMarketplace(locations, marketplaceRoot, {
    kind: "unknown",
    raw: "marketplace",
  });

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.equal(await pathExists(mirrorRoot), false);
});

void test("SEED-01: an absent marketplace name is a complete no-op", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: GITHUB_REPO_URL,
    plugins: [gitSubdirEntry("subdir", GITHUB_REPO_URL)],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "absent" });

  // assert
  assert.equal(await pathExists(path.join(locations.extensionRoot, "plugin-clones")), false);
});

void test("SEED-01: an existing mirror is preserved as a warm-cache win", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: GITHUB_REPO_URL,
    plugins: [gitSubdirEntry("subdir", GITHUB_REPO_URL)],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));
  await mkdir(mirrorRoot, { recursive: true });
  await writeFile(path.join(mirrorRoot, "sentinel"), "preserve\n");

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });

  // assert
  assert.equal(await pathExists(path.join(mirrorRoot, "sentinel")), true);
  assert.equal(
    await pathExists(path.join(mirrorRoot, ".claude-plugin", "marketplace.json")),
    false,
  );
});

void test("SEED-04: reachable pins seed per-SHA clones in exact manifest order", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: GITHUB_REPO_URL,
    plugins: [
      gitSubdirEntry("first", GITHUB_REPO_URL, { sha: PIN_40 }),
      gitSubdirEntry("second", GITHUB_REPO_URL, { sha: PIN2_40 }),
    ],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);
  const { gitOps, state } = createGitOps();

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace", gitOps });
  const firstRoot = await locations.pluginCloneDir(pluginCloneKey(GITHUB_REPO_URL, PIN_40));
  const secondRoot = await locations.pluginCloneDir(pluginCloneKey(GITHUB_REPO_URL, PIN2_40));

  // assert
  assert.equal(await pathExists(firstRoot), true);
  assert.equal(await pathExists(secondRoot), true);
  assert.deepEqual(
    state.checkoutCalls.map(({ ref }) => ref),
    [PIN_40, PIN2_40],
  );
  assert.deepEqual(await stagingEntries(locations), []);
});

void test("SEED-04: an unreachable pin is cleaned and a later unpinned entry still seeds", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: GITHUB_REPO_URL,
    plugins: [
      gitSubdirEntry("pinned", GITHUB_REPO_URL, { sha: PIN_40 }),
      gitSubdirEntry("unpinned", GITHUB_REPO_URL),
    ],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);
  const checkoutError = commitNotFetchedError(PIN_40);
  const { gitOps } = createGitOps({ checkoutThrows: checkoutError });

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace", gitOps });
  const pinnedRoot = await locations.pluginCloneDir(pluginCloneKey(GITHUB_REPO_URL, PIN_40));
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.equal(await pathExists(pinnedRoot), false);
  assert.equal(await pathExists(mirrorRoot), true);
  assert.deepEqual(await stagingEntries(locations), []);
});

void test("SEED-04: a concurrent winner preserves its clone and the losing staging tree is cleaned", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: GITHUB_REPO_URL,
    plugins: [gitSubdirEntry("pinned", GITHUB_REPO_URL, { sha: PIN_40 })],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);
  const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(GITHUB_REPO_URL, PIN_40));
  const base = createGitOps();
  const gitOps: GitOps = {
    ...base.gitOps,
    async checkout(options): Promise<void> {
      await base.gitOps.checkout(options);
      await mkdir(cloneRoot, { recursive: true });
      await writeFile(path.join(cloneRoot, "winner"), "peer\n");
    },
  };

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace", gitOps });

  // assert
  assert.equal(await pathExists(path.join(cloneRoot, "winner")), true);
  assert.deepEqual(await stagingEntries(locations), []);
});

void test("SEED-04: a later-call rename failure is isolated and the next entry still seeds", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout({
    originUrl: GITHUB_REPO_URL,
    plugins: [
      gitSubdirEntry("pinned", GITHUB_REPO_URL, { sha: PIN_40 }),
      gitSubdirEntry("unpinned", GITHUB_REPO_URL),
    ],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);
  const base = createGitOps();
  const gitOps: GitOps = {
    ...base.gitOps,
    async checkout(options): Promise<void> {
      await base.gitOps.checkout(options);
      await rm(options.dir, { force: true, recursive: true });
    },
  };

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace", gitOps });
  const pinnedRoot = await locations.pluginCloneDir(pluginCloneKey(GITHUB_REPO_URL, PIN_40));
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.equal(await pathExists(pinnedRoot), false);
  assert.equal(await pathExists(mirrorRoot), true);
  assert.deepEqual(await stagingEntries(locations), []);
});

void test("PURL-03: a non-subdirectory git source resolves to the clone root", async () => {
  // arrange
  const source: GitBackedSource = {
    kind: "url",
    raw: GITHUB_REPO_URL,
    url: GITHUB_REPO_URL,
  };

  // act
  const resolved = await resolveGitPluginRootWithSubdir(source, "/clone", PIN_40);

  // assert
  assert.deepEqual(resolved, {
    kind: "materialized",
    pluginRoot: "/clone",
    resolvedSha: PIN_40,
  });
});

void test("PURL-03: a materialized git subdirectory resolves beneath the clone root", async () => {
  // arrange
  const cloneRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-subdir-"));
  const pluginRoot = path.join(cloneRoot, "plugins", "foo");
  await mkdir(pluginRoot, { recursive: true });
  const source: GitSubdirSource = {
    kind: "git-subdir",
    path: "plugins/foo",
    raw: GITHUB_REPO_URL,
    url: GITHUB_REPO_URL,
  };

  // act
  const resolved = await resolveGitPluginRootWithSubdir(source, cloneRoot, PIN_40);

  // assert
  assert.deepEqual(resolved, { kind: "materialized", pluginRoot, resolvedSha: PIN_40 });
});

void test("PURL-03: an escaping git subdirectory preserves the complete containment result", async () => {
  // arrange
  const cloneRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-escape-"));
  const source: GitSubdirSource = {
    kind: "git-subdir",
    path: "../outside",
    raw: GITHUB_REPO_URL,
    url: GITHUB_REPO_URL,
  };

  // act
  const resolved = await resolveGitPluginRootWithSubdir(source, cloneRoot, PIN_40);

  // assert
  assert.deepEqual(resolved, {
    kind: "escapes",
    detail: `git-subdir path "../outside" escapes ${cloneRoot} (resolved: ${path.resolve(cloneRoot, "../outside")}).`,
  });
});

void test("PURL-03: a missing git subdirectory preserves the complete missing result", async () => {
  // arrange
  const cloneRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-missing-"));
  const source: GitSubdirSource = {
    kind: "git-subdir",
    path: "plugins/missing",
    raw: GITHUB_REPO_URL,
    url: GITHUB_REPO_URL,
  };

  // act
  const resolved = await resolveGitPluginRootWithSubdir(source, cloneRoot, PIN_40);

  // assert
  assert.deepEqual(resolved, {
    kind: "missing-subdir",
    detail: 'git-subdir path "plugins/missing" does not exist in the plugin clone',
  });
});

void test("PURL-03/07: clone-cache re-exports preserve canonical and subdirectory helper identity", () => {
  // arrange
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/repo.git",
    url: "https://example.com/repo.git",
  };

  // act
  const canonicalUrl = canonicalCloneUrl(source);
  const exportedSubdirResolver = resolveGitSubdirRoot;

  // assert
  assert.equal(canonicalUrl, "https://example.com/repo.git");
  assert.equal(exportedSubdirResolver.name, "resolveGitSubdirRoot");
});
