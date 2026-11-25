import assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { DEFAULT_GIT_OPS } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import {
  canonicalCloneUrl,
  materializeMarketplaceTagClone,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  materializePluginCommitCopy,
  materializeUnpinnedSource,
  resolveGitPluginRootWithSubdir,
  resolveGitSubdirRoot,
  resolvePluginPin,
  seedSameRepoPluginMirrors,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  GitCommandError,
  PinnedCommitMissingError,
  PluginMirrorInUseError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { MISSING_OID } from "../../platform/git-ops-contract.ts";
import { checkoutFailure, createGitOpsFake } from "../../platform/git-ops-fake.ts";
import {
  createGitTestRepository,
  gitTestCheckout,
  initGitTestCheckout,
} from "../../platform/git-test-repository.ts";
import {
  hermeticGitProcess,
  recordingGitProcess,
  systemGitOps,
} from "../../platform/system-git-ops.ts";
import { setGitHubBaseUrl } from "../../shared/github-base-url-environment.ts";
import { marketplaceRecord, pluginRecord } from "../scope-state-seeds.ts";

import type {
  GitBackedSource,
  GitSubdirSource,
  UrlSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { RenameOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts";
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

      // A clone of a ref checks out the commit the remote advertises for it.
      const refOid = options.ref === undefined ? undefined : git.state.remoteRefs[options.ref];
      if (refOid !== undefined) {
        git.state.head = refOid;
      }
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
      return (
        (await git.gitOps.resolveRef(options)) ??
        git.state.remoteRefs[options.ref] ??
        (options.ref === "refs/remotes/origin/HEAD"
          ? git.state.remoteRefs["refs/remotes/origin/main"]
          : undefined)
      );
    },
    async resolveRemoteRef(options) {
      return git.gitOps.resolveRemoteRef(options);
    },
  };

  return {
    gitOps,
    state: Object.assign(git.state, {
      cloneCalls: git.state.calls.clone,
      checkoutCalls: git.state.calls.checkout,
      resolveRefCalls: git.state.calls.resolveRef,
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
    resolveAuth: publicCloneAuth,
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
  const created: string[] = [];

  const cloneRoot = await materializePluginClone({
    resolveAuth: publicCloneAuth,
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
    onCloneCreated: (key) => created.push(key),
  });

  assert.ok(
    cloneRoot.includes(`${path.sep}plugin-clones${path.sep}`),
    `expected cloneRoot under plugin-clones/, got ${cloneRoot}`,
  );
  assert.equal(state.cloneCalls.length, 1, "MURL-09: exactly one clone attempt");
  assert.equal(state.cloneCalls[0]?.url, "https://example.com/repo");
  assert.equal(
    state.cloneCalls[0]?.noCheckout,
    true,
    "SG-TRN-02: the pinned clone checks nothing out",
  );
  assert.equal(state.checkoutCalls.length, 1, "exactly one checkout");
  assert.equal(state.checkoutCalls[0]!.ref, PIN_40, "checkout pins the sha");
  assert.deepStrictEqual(created, [pluginCloneKey("https://example.com/repo", PIN_40)]);
});

void test("PURL-04: a second materialize of the same url+sha triggers zero additional clones (dedup)", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();

  const first = await materializePluginClone({
    resolveAuth: publicCloneAuth,
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });
  const second = await materializePluginClone({
    resolveAuth: publicCloneAuth,
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
    resolveAuth: publicCloneAuth,
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });

  assert.equal(cloneRoot, keyDir, "returns the warm cache dir");
});

void test("NFR-5: a warm cache returns without building the auth bundle", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();
  const keyDir = await locations.pluginCloneDir(pluginCloneKey("https://example.com/repo", PIN_40));
  await mkdir(keyDir, { recursive: true });

  // act
  const cloneRoot = await materializePluginClone({
    resolveAuth: () => {
      throw new Error("a warm cache never builds the auth bundle");
    },
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    gitOps,
  });

  // assert
  assert.strictEqual(cloneRoot, keyDir);
  assert.deepStrictEqual(state.cloneCalls, []);
});

void test("a cold key whose auth bundle cannot be built fails before any clone", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();
  const refusal = new Error("the auth bundle cannot be built");

  // act & assert
  await assert.rejects(
    materializePluginClone({
      resolveAuth: () => {
        throw refusal;
      },
      locations,
      cloneUrl: "https://example.com/repo",
      networkUrl: "https://example.com/repo",
      pin: PIN_40,
      gitOps,
    }),
    (error: unknown) => error === refusal,
  );
  assert.deepStrictEqual(state.cloneCalls, []);
});

void test("C5: sha wins over ref -- the clone names no branch, the commit fetch takes the ref, and the checkout pins the sha", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();

  await materializePluginClone({
    resolveAuth: publicCloneAuth,
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin: PIN_40,
    ref: "v2.0.0",
    gitOps,
  });

  assert.deepStrictEqual(
    {
      clone: state.cloneCalls.map(({ ref, singleBranch, noCheckout }) => ({
        ref,
        singleBranch,
        noCheckout,
      })),
      fetchCommit: state.calls.fetchCommit.map(({ sha, ref }) => ({ sha, ref })),
      checkout: state.checkoutCalls.map(({ ref }) => ref),
    },
    {
      clone: [{ ref: undefined, singleBranch: undefined, noCheckout: true }],
      fetchCommit: [{ sha: PIN_40, ref: "v2.0.0" }],
      checkout: [PIN_40],
    },
  );
});

/** INR-03 / INR-06: the typed missing-pin error, with no library advice chained under it. */
function isPinnedCommitMissing(err: unknown, pin: string): boolean {
  return err instanceof PinnedCommitMissingError && err.sha === pin && err.cause === undefined;
}

/** The ladder's git calls of one pinned clone, in the order they ran. */
function orderedGitOps(gitOps: GitOps): { readonly gitOps: GitOps; readonly order: string[] } {
  const order: string[] = [];
  return {
    order,
    gitOps: {
      ...gitOps,
      clone: (options) => {
        order.push(`clone noCheckout=${String(options.noCheckout)} ref=${String(options.ref)}`);
        return gitOps.clone(options);
      },
      fetchCommit: (options) => {
        order.push(`fetchCommit ${options.sha} ref=${String(options.ref)}`);
        return gitOps.fetchCommit(options);
      },
      checkout: (options) => {
        order.push(`checkout ${options.ref}`);
        return gitOps.checkout(options);
      },
      resolveRef: (options) => {
        order.push(`resolveRef ${options.ref}`);
        return gitOps.resolveRef(options);
      },
    },
  };
}

/** Materializes `pin` of `https://example.com/repo` with `gitOps`, `ref` as the source's ref. */
function materializeExamplePin(
  locations: ScopedLocations,
  gitOps: GitOps,
  pin: string,
  ref?: string,
): Promise<string> {
  return materializePluginClone({
    resolveAuth: publicCloneAuth,
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    pin,
    ...(ref !== undefined && { ref }),
    gitOps,
  });
}

/** The staging directory of the first clone, which must be gone after a failure (MA-9). */
async function assertStagingRemoved(state: { readonly cloneCalls: readonly { dir: string }[] }) {
  const stagingDir = state.cloneCalls[0]!.dir;
  await assert.rejects(() => stat(stagingDir), { code: "ENOENT" });
}

void test("SG-TRN-02, C5: a pinned clone runs the ladder: a no-checkout clone, the commit fetch with the ref, the checkout, then the HEAD check", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const base = createGitOps();
  const { gitOps, order } = orderedGitOps(base.gitOps);

  // act
  await materializeExamplePin(locations, gitOps, PIN_40, "v2.0.0");

  // assert
  assert.deepStrictEqual(order, [
    "clone noCheckout=true ref=undefined",
    `fetchCommit ${PIN_40} ref=v2.0.0`,
    `checkout ${PIN_40}`,
    "resolveRef HEAD",
  ]);
});

void test("SG-TRN-02: a pin the remote holds is fetched before its checkout", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps({ remoteRefs: { "refs/remotes/origin/main": PIN_40 } });

  // act
  await materializeExamplePin(locations, gitOps, PIN_40);

  // assert
  assert.deepStrictEqual(
    { fetched: state.localRefs[PIN_40], checkouts: state.checkoutCalls.map(({ ref }) => ref) },
    { fetched: PIN_40, checkouts: [PIN_40] },
  );
});

void test("SG-TRN-02: a mixed-case pin is fetched, checked out, and compared lower-cased", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const base = createGitOps();
  const { gitOps, order } = orderedGitOps(base.gitOps);
  const mixedCase = `${PIN_40.slice(0, 20).toUpperCase()}${PIN_40.slice(20)}`;

  // act
  const cloneRoot = await materializeExamplePin(locations, gitOps, mixedCase);

  // assert
  assert.deepStrictEqual(
    { order, cloneRoot },
    {
      order: [
        "clone noCheckout=true ref=undefined",
        `fetchCommit ${PIN_40} ref=undefined`,
        `checkout ${PIN_40}`,
        "resolveRef HEAD",
      ],
      cloneRoot: await locations.pluginCloneDir(
        pluginCloneKey("https://example.com/repo", mixedCase),
      ),
    },
  );
});

void test("SG-TRN-02: a HEAD other than the pin fails as pin-mismatch and leaves no staging directory", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const base = createGitOps();
  const gitOps: GitOps = {
    ...base.gitOps,
    resolveRef: () => Promise.resolve(PIN2_40),
  };

  // act
  const materializing = materializeExamplePin(locations, gitOps, PIN_40);

  // assert
  await assert.rejects(materializing, (error: unknown) => {
    assert.ok(error instanceof GitCommandError);
    assert.deepStrictEqual(
      { kind: error.kind, operation: error.operation },
      { kind: "pin-mismatch", operation: "rev-parse --verify" },
    );
    return true;
  });
  await assertStagingRemoved(base.state);
  assert.equal(
    await pathExists(
      await locations.pluginCloneDir(pluginCloneKey("https://example.com/repo", PIN_40)),
    ),
    false,
  );
});

void test("INR-03: a checkout that finds no commit after the ladder is a commit the host lacks", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const base = createGitOps();
  const gitOps: GitOps = {
    ...base.gitOps,
    async checkout(options): Promise<void> {
      await Promise.resolve();
      throw checkoutFailure(options.ref);
    },
  };

  // act
  const materializing = materializeExamplePin(locations, gitOps, PIN_40, "v1.5.5");

  // assert
  await assert.rejects(materializing, (err: unknown) => isPinnedCommitMissing(err, PIN_40));
  await assertStagingRemoved(base.state);
});

void test("SG-TRN-02: a commit fetch that fails other than by a missing commit propagates with no checkout", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const base = createGitOps();
  const failure = new GitCommandError(
    { kind: "network" },
    { operation: "fetch --depth", exitCode: 128 },
  );
  const gitOps: GitOps = {
    ...base.gitOps,
    fetchCommit: () => Promise.reject(failure),
  };

  // act
  const materializing = materializeExamplePin(locations, gitOps, PIN_40);

  // assert
  await assert.rejects(materializing, (error: unknown) => error === failure);
  assert.deepStrictEqual(base.state.checkoutCalls, []);
  await assertStagingRemoved(base.state);
});

void test("SG-TRN-02: a checkout that fails another way rethrows unchanged", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const base = createGitOps();
  const gitOps: GitOps = {
    ...base.gitOps,
    async checkout(): Promise<void> {
      await Promise.resolve();
      throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    },
  };

  // act
  const materializing = materializeExamplePin(locations, gitOps, PIN_40, "v1.5.5");

  // assert
  await assert.rejects(materializing, /EACCES/);
  await assertStagingRemoved(base.state);
});

void test("PROV-03: the commit fetch threads the auth bundle so a private pin authenticates", async (t) => {
  // arrange
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
  const { gitOps, state } = createGitOps();

  // act
  await materializePluginClone({
    locations,
    cloneUrl: "https://gitlab.example.com/o/r",
    networkUrl: "https://gitlab.example.com/o/r",
    pin: PIN_40,
    gitOps,
    resolveAuth: () => auth,
  });

  // assert
  assert.strictEqual(state.calls.fetchCommit[0]?.auth, auth);
});

/**
 * SG-TRN-02: a `file://` repository whose default branch `main` holds three
 * commits, and whose branch `dev`, forked at `main`'s last commit, holds two
 * more. `devOnly` is the first `dev` commit, which no ref advertises.
 */
async function ladderRemote(t: TestContext): Promise<{
  readonly url: string;
  readonly second: string;
  readonly devOnly: string;
}> {
  const repository = await createGitTestRepository(t, { boundary: "local" });
  const second = await repository.commit([{ filepath: "two.txt", contents: "two\n" }], "two");
  await repository.commit([{ filepath: "three.txt", contents: "three\n" }], "three");
  await repository.run("checkout", "-q", "-b", "dev");
  const devOnly = await repository.commit([{ filepath: "dev.txt", contents: "dev\n" }], "dev");
  await repository.commit([{ filepath: "dev2.txt", contents: "dev2\n" }], "dev2");
  await repository.run("checkout", "-q", "main");
  return { url: `file://${repository.dir}`, second, devOnly };
}

/** Materializes `pin` of `url` on system git, recording each git operation. */
async function materializeOnSystemGit(
  t: TestContext,
  args: { readonly url: string; readonly pin: string; readonly ref?: string },
  variables: NodeJS.ProcessEnv = {},
): Promise<{ readonly materializing: Promise<string>; readonly operations: () => string[] }> {
  const locations = await freshLocations(t);
  const recorded = recordingGitProcess(await hermeticGitProcess(t, variables));
  return {
    materializing: materializePluginClone({
      resolveAuth: publicCloneAuth,
      locations,
      cloneUrl: args.url,
      networkUrl: args.url,
      pin: args.pin,
      ...(args.ref !== undefined && { ref: args.ref }),
      gitOps: systemGitOps(recorded.gitProcess),
    }),
    operations: () =>
      recorded.requests.map((request) =>
        [request.subcommand, ...(request.options ?? []).slice(0, 1)].join(" "),
      ),
  };
}

/** The operations of the ladder up to the commit fetch's first rung. */
const LADDER_START = ["clone --depth", "config --local", "fetch --depth"] as const;

void test("SG-TRN-02: real git reaches an older default-branch pin with the SHA fetch alone", async (t) => {
  // arrange
  const remote = await ladderRemote(t);
  const run = await materializeOnSystemGit(t, { url: remote.url, pin: remote.second });

  // act
  const cloneRoot = await run.materializing;

  // assert
  assert.deepStrictEqual(
    {
      operations: run.operations(),
      head: await gitTestCheckout(cloneRoot).run("rev-parse", "HEAD"),
      two: await readFile(path.join(cloneRoot, "two.txt"), "utf8"),
    },
    {
      operations: [...LADDER_START, "checkout -f", "rev-parse --verify"],
      head: remote.second,
      two: "two\n",
    },
  );
});

void test("SG-TRN-02: real git reaches a pin only on the source's ref after the unshallow rung", async (t) => {
  // arrange
  const remote = await ladderRemote(t);
  const run = await materializeOnSystemGit(
    t,
    { url: remote.url, pin: remote.devOnly, ref: "dev" },
    // Protocol v0 refuses a want of a commit no ref advertises, as such a host does.
    { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "protocol.version", GIT_CONFIG_VALUE_0: "0" },
  );

  // act
  const cloneRoot = await run.materializing;

  // assert
  assert.deepStrictEqual(
    {
      operations: run.operations(),
      head: await gitTestCheckout(cloneRoot).run("rev-parse", "HEAD"),
    },
    {
      operations: [
        ...LADDER_START,
        "rev-parse --is-shallow-repository",
        "fetch --unshallow",
        "checkout -f",
        "rev-parse --verify",
      ],
      head: remote.devOnly,
    },
  );
});

void test("INR-03: real git ends an unknown pin in a commit the host lacks after the rungs", async (t) => {
  // arrange
  const remote = await ladderRemote(t);
  const run = await materializeOnSystemGit(t, { url: remote.url, pin: MISSING_OID });

  // act & assert
  await assert.rejects(run.materializing, (err: unknown) =>
    isPinnedCommitMissing(err, MISSING_OID),
  );
  assert.deepStrictEqual(run.operations(), [
    ...LADDER_START,
    "rev-parse --is-shallow-repository",
    "fetch --unshallow",
    "checkout -f",
  ]);
});

// Measured on git 2.43.0: a depth-1 clone of a one-commit repository still
// writes `.git/shallow`, so the ladder runs the unshallow rung, which succeeds,
// and only then reads the missing commit. A complete clone, which skips the
// rung, comes only from a clone without `--depth`.
void test("INR-03: a depth-1 clone of a one-commit repository is shallow, so real git runs the unshallow rung and ends the same way", async (t) => {
  // arrange
  const repository = await createGitTestRepository(t, { boundary: "local" });
  const run = await materializeOnSystemGit(t, {
    url: `file://${repository.dir}`,
    pin: MISSING_OID,
  });

  // act & assert
  await assert.rejects(run.materializing, (err: unknown) =>
    isPinnedCommitMissing(err, MISSING_OID),
  );
  assert.deepStrictEqual(run.operations(), [
    ...LADDER_START,
    "rev-parse --is-shallow-repository",
    "fetch --unshallow",
    "checkout -f",
  ]);
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
    resolveAuth: () => auth,
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
    resolveAuth: publicCloneAuth,
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
      resolveAuth: publicCloneAuth,
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
        resolveAuth: publicCloneAuth,
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

void test("D-77-05: resolvePluginPin refuses a ref the remote does not advertise", async () => {
  // arrange
  const { gitOps } = createGitOps({ remoteHead: PIN_40 });
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/repo#dev",
    url: "https://example.com/repo",
    ref: "dev",
  };

  // act & assert
  await assert.rejects(() => resolvePluginPin({ source, gitOps }), {
    name: "Error",
    message: 'remote https://example.com/repo has no ref "dev"',
  });
});

void test("D-77-05: resolvePluginPin refuses a remote that advertises no HEAD", async () => {
  // arrange
  const { gitOps: baseGitOps } = createGitOps();
  const gitOps: GitOps = { ...baseGitOps, resolveRemoteRef: () => Promise.resolve(undefined) };
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/repo",
    url: "https://example.com/repo",
  };

  // act & assert
  await assert.rejects(() => resolvePluginPin({ source, gitOps }), {
    name: "Error",
    message: "remote https://example.com/repo advertised no HEAD ref",
  });
});

void test("GHB-01: resolvePluginPin names the base URL when the base advertises no HEAD", async (t) => {
  // arrange
  setGitHubBaseUrl(t, "https://git.example.invalid");
  const { gitOps: baseGitOps } = createGitOps();
  const gitOps: GitOps = { ...baseGitOps, resolveRemoteRef: () => Promise.resolve(undefined) };

  // act & assert
  await assert.rejects(() => resolvePluginPin({ source: githubSource("owner/repo"), gitOps }), {
    name: "Error",
    message: "remote https://git.example.invalid/owner/repo.git advertised no HEAD ref",
  });
});

void test("MURL-08 / PURL-04: materializePluginClone forwards the caller's wire url and keys the dir off the identity url", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = createGitOps();
  const cloneUrl = "https://gitlab.example.com/o/r";
  const wireUrl = "https://gitlab.example.com/o/r.git";

  const cloneRoot = await materializePluginClone({
    resolveAuth: publicCloneAuth,
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
        resolveAuth: publicCloneAuth,
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

// A default-branch mirror double: the double's clone seeds refs/heads/main and
// HEAD, the remote's HEAD is the same commit, so a warm mirror is current.
// HEAD reads back MIRROR_HEAD.
function mirrorGitOps(): ReturnType<typeof createGitOps> {
  return createGitOps({
    head: MIRROR_HEAD,
    localRefs: { "refs/heads/main": MIRROR_HEAD },
    remoteRefs: { "refs/remotes/origin/HEAD": MIRROR_HEAD },
  });
}

void test("MIRR-01: mirror ABSENT materializes into staging then renames to plugin-clones/<bare-key>/ and returns HEAD without a refresh", async (t) => {
  const locations = await freshLocations(t);
  const { gitOps, state } = mirrorGitOps();
  const created: string[] = [];

  const { pluginRoot, resolvedSha } = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
    onCloneCreated: (key) => created.push(key),
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
  assert.equal(
    state.resolveRemoteRefCalls.length,
    0,
    "a just-cloned mirror is not checked against the remote again",
  );
  // The mirror tracks a moving ref -- it MUST NOT checkout a fixed 40-hex pin.
  assert.ok(
    !state.checkoutCalls.some((c) => /^[a-f0-9]{40}$/i.test(c.ref)),
    "no fixed-pin (40-hex) checkout on the mirror create path",
  );
  assert.equal(resolvedSha, MIRROR_HEAD, "resolvedSha comes from resolveRef(HEAD)");
  assert.deepStrictEqual(created, [bareKey]);
});

void test("D-SG-10 / NFR-3: a cold mirror clone removes the staging directory an interrupted clone of its key left", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const { gitOps, state } = mirrorGitOps();
  const key = pluginMirrorKey("https://example.com/repo");
  const stagingDir = await locations.pluginMirrorStagingDir(key);
  await mkdir(stagingDir, { recursive: true });
  await writeFile(path.join(stagingDir, "half-written"), "left by a killed clone\n");

  // act
  const { pluginRoot } = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
  });

  // assert
  assert.deepStrictEqual(
    {
      pluginRoot,
      cloneDirs: state.cloneCalls.map(({ dir }) => dir),
      leftover: await pathExists(path.join(pluginRoot, "half-written")),
      staging: await entriesOf(path.dirname(stagingDir)),
    },
    {
      pluginRoot: await locations.pluginCloneDir(key),
      cloneDirs: [stagingDir],
      leftover: false,
      staging: [],
    },
  );
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

void test("MIRR-02 / D-SG-10: a warm mirror at the remote's commit is checked with one ls-remote and not cloned again", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const { gitOps, state } = mirrorGitOps();
  const mirrorArgs = {
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
  };
  await materializeOrRefreshPluginMirror(mirrorArgs);

  // act
  const second = await materializeOrRefreshPluginMirror(mirrorArgs);

  // assert
  assert.deepStrictEqual(
    {
      clones: state.cloneCalls.length,
      checks: state.resolveRemoteRefCalls,
      resolvedSha: second.resolvedSha,
    },
    {
      clones: 1,
      checks: [{ url: "https://example.com/repo", auth: mirrorArgs.auth }],
      resolvedSha: MIRROR_HEAD,
    },
  );
});

const MIRROR_COMMIT_A = "a".repeat(40);
const MIRROR_COMMIT_B = "b".repeat(40);

/** A mirror tree whose `tree.txt` names `revision`, with a readable `.git/HEAD`. */
async function writeMirrorTree(dir: string, revision: string): Promise<void> {
  await mkdir(path.join(dir, ".git"), { recursive: true });
  await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
  await writeFile(path.join(dir, "tree.txt"), `${revision}\n`);
}

/**
 * D-SG-10: a warm mirror at commit A in `plugin-clones/<key>`, and a remote
 * whose clone writes the tree of `remoteHead`, the commit its `HEAD` names.
 */
async function warmMirror(
  t: TestContext,
  options: { readonly remoteHead: string; readonly cloneError?: Error },
): Promise<{
  readonly locations: ScopedLocations;
  readonly mirrorRoot: string;
  readonly backupDir: string;
  readonly git: ReturnType<typeof createGitOpsFake>;
}> {
  const locations = await freshLocations(t);
  const key = pluginMirrorKey("https://example.com/repo");
  const mirrorRoot = await locations.pluginCloneDir(key);
  await writeMirrorTree(mirrorRoot, "A");
  const remote = await mkdtemp(path.join(tmpdir(), "clone-cache-remote-"));
  t.after(() => rm(remote, { recursive: true, force: true }));
  await writeMirrorTree(remote, options.remoteHead === MIRROR_COMMIT_A ? "A" : "B");
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: ALLOWED_CLONE_CACHE_REMOTES,
    initialOid: MIRROR_COMMIT_A,
    remoteHead: options.remoteHead,
    cloneFixture: { boundary: "local", sourceDir: remote },
    ...(options.cloneError === undefined ? {} : { cloneError: options.cloneError }),
  });
  return { locations, mirrorRoot, backupDir: await locations.pluginCloneBackupDir(key), git };
}

async function treeOf(mirrorRoot: string): Promise<string> {
  return readFile(path.join(mirrorRoot, "tree.txt"), "utf8");
}

async function entriesOf(dir: string): Promise<string[]> {
  return (await pathExists(dir)) ? (await readdir(dir)).sort() : [];
}

function warmMirrorArgs(
  mirror: Awaited<ReturnType<typeof warmMirror>>,
  overrides: { readonly renameOps?: RenameOps } = {},
): Parameters<typeof materializeOrRefreshPluginMirror>[0] {
  return {
    auth: publicCloneAuth(),
    locations: mirror.locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps: mirror.git.gitOps,
    ...overrides,
  };
}

void test("D-SG-10: a warm mirror whose remote moved is cloned into staging and swapped in through its backup", async (t) => {
  // arrange
  const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_B });

  // act
  const refreshed = await materializeOrRefreshPluginMirror(warmMirrorArgs(mirror));

  // assert
  assert.deepStrictEqual(
    {
      refreshed,
      refReads: mirror.git.state.calls.resolveRef,
      checks: mirror.git.state.calls.resolveRemoteRef.map(({ url, ref }) => ({ url, ref })),
      cloneDirs: mirror.git.state.calls.clone.map(({ dir }) => dir),
      tree: await treeOf(mirror.mirrorRoot),
      backups: await entriesOf(path.dirname(mirror.backupDir)),
      staging: await entriesOf(path.join(mirror.locations.extensionRoot, "sources-staging")),
      gitEntries: await entriesOf(path.join(mirror.mirrorRoot, ".git")),
    },
    {
      refreshed: { pluginRoot: mirror.mirrorRoot, resolvedSha: MIRROR_COMMIT_B },
      refReads: [
        { dir: mirror.mirrorRoot, ref: "HEAD" },
        { dir: mirror.mirrorRoot, ref: "HEAD" },
      ],
      checks: [{ url: "https://example.com/repo", ref: undefined }],
      cloneDirs: [
        await mirror.locations.pluginMirrorStagingDir(pluginMirrorKey("https://example.com/repo")),
      ],
      tree: "B\n",
      backups: [],
      staging: [],
      gitEntries: ["HEAD"],
    },
  );
});

void test("D-SG-10: a warm mirror with a ref asks the remote for that ref and re-clones that branch alone", async (t) => {
  // arrange
  const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_B });

  // act
  await materializeOrRefreshPluginMirror({ ...warmMirrorArgs(mirror), ref: "main" });

  // assert
  assert.deepStrictEqual(
    {
      checks: mirror.git.state.calls.resolveRemoteRef.map(({ ref }) => ref),
      clones: mirror.git.state.calls.clone.map(({ ref, singleBranch }) => ({ ref, singleBranch })),
    },
    { checks: ["main"], clones: [{ ref: "main", singleBranch: true }] },
  );
});

void test("D-SG-10: a warm mirror at the remote's commit is left as it is with no clone and no write", async (t) => {
  // arrange
  const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_A });

  // act
  const refreshed = await materializeOrRefreshPluginMirror(warmMirrorArgs(mirror));

  // assert
  assert.deepStrictEqual(
    {
      refreshed,
      clones: mirror.git.state.calls.clone,
      tree: await treeOf(mirror.mirrorRoot),
      extensionRoot: await entriesOf(mirror.locations.extensionRoot),
    },
    {
      refreshed: { pluginRoot: mirror.mirrorRoot, resolvedSha: MIRROR_COMMIT_A },
      clones: [],
      tree: "A\n",
      extensionRoot: ["plugin-clones"],
    },
  );
});

void test("D-SG-10 / MA-9: a failed re-clone leaves the mirror untouched, removes its staging, and reaches the caller", async (t) => {
  // arrange
  const cloneError = new GitCommandError(
    { kind: "network" },
    { operation: "clone --depth", exitCode: 128 },
  );
  const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_B, cloneError });

  // act & assert
  await assert.rejects(
    materializeOrRefreshPluginMirror(warmMirrorArgs(mirror)),
    (error: unknown) => error === cloneError,
  );
  assert.deepStrictEqual(
    {
      tree: await treeOf(mirror.mirrorRoot),
      staging: await entriesOf(path.join(mirror.locations.extensionRoot, "sources-staging")),
      backups: await entriesOf(path.dirname(mirror.backupDir)),
    },
    { tree: "A\n", staging: [], backups: [] },
  );
});

void test("D-SG-10: an unreachable remote re-clones the mirror, and that clone's failure is the check's", async (t) => {
  // arrange
  const unreachable = new GitCommandError(
    { kind: "network" },
    { operation: "ls-remote", exitCode: 128 },
  );
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));
  await writeMirrorTree(mirrorRoot, "A");
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: ALLOWED_CLONE_CACHE_REMOTES,
    initialOid: MIRROR_COMMIT_A,
    resolveRemoteRefError: unreachable,
    cloneError: new Error("the re-clone fails too"),
  });

  // act & assert
  await assert.rejects(
    materializeOrRefreshPluginMirror({
      auth: publicCloneAuth(),
      locations,
      cloneUrl: "https://example.com/repo",
      networkUrl: "https://example.com/repo",
      gitOps: git.gitOps,
    }),
    (error: unknown) => error === unreachable,
  );
  assert.deepStrictEqual(
    { clones: git.state.calls.clone.length, tree: await treeOf(mirrorRoot) },
    { clones: 1, tree: "A\n" },
  );
});

for (const code of ["EBUSY", "EPERM", "EACCES"]) {
  void test(`D-SG-10 / SG-TRN-03: a mirror that cannot be moved aside with ${code} fails, is never kept, and leaves no staging`, async (t) => {
    // arrange
    const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_B });
    const renameError = Object.assign(new Error(`${code}: rename refused`), {
      code,
      syscall: "rename",
    });
    const renameOps: RenameOps = {
      rename: (from, to) =>
        from === mirror.mirrorRoot ? Promise.reject(renameError) : rename(from, to),
    };

    // act & assert
    await assert.rejects(
      materializeOrRefreshPluginMirror(warmMirrorArgs(mirror, { renameOps })),
      (error: unknown) => {
        assert.ok(error instanceof PluginMirrorInUseError);
        assert.deepStrictEqual(
          { code: error.code, cause: error.cause },
          { code: code === "EACCES" ? "EACCES" : "EPERM", cause: renameError },
        );
        return true;
      },
    );
    assert.deepStrictEqual(
      {
        tree: await treeOf(mirror.mirrorRoot),
        staging: await entriesOf(path.join(mirror.locations.extensionRoot, "sources-staging")),
        backups: await entriesOf(path.dirname(mirror.backupDir)),
      },
      { tree: "A\n", staging: [], backups: [] },
    );
  });
}

void test("D-SG-10 / NFR-3: a backup beside a mirror without its .git/HEAD is restored before the check", async (t) => {
  // arrange
  const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_A });
  await mkdir(path.dirname(mirror.backupDir), { recursive: true });
  await rename(mirror.mirrorRoot, mirror.backupDir);
  await mkdir(mirror.mirrorRoot, { recursive: true });
  await writeFile(path.join(mirror.mirrorRoot, "tree.txt"), "half\n");

  // act
  const refreshed = await materializeOrRefreshPluginMirror(warmMirrorArgs(mirror));

  // assert
  assert.deepStrictEqual(
    {
      refreshed,
      clones: mirror.git.state.calls.clone,
      tree: await treeOf(mirror.mirrorRoot),
      backups: await entriesOf(path.dirname(mirror.backupDir)),
    },
    {
      refreshed: { pluginRoot: mirror.mirrorRoot, resolvedSha: MIRROR_COMMIT_A },
      clones: [],
      tree: "A\n",
      backups: [],
    },
  );
});

void test("D-SG-10 / NFR-3: a backup beside a valid mirror is removed and the mirror kept", async (t) => {
  // arrange
  const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_A });
  await writeMirrorTree(mirror.backupDir, "old");

  // act
  await materializeOrRefreshPluginMirror(warmMirrorArgs(mirror));

  // assert
  assert.deepStrictEqual(
    {
      tree: await treeOf(mirror.mirrorRoot),
      backups: await entriesOf(path.dirname(mirror.backupDir)),
    },
    { tree: "A\n", backups: [] },
  );
});

void test("D-SG-10: a second refresh right after a replacing one is current, checks once, and writes nothing", async (t) => {
  // arrange
  const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_B });
  await materializeOrRefreshPluginMirror(warmMirrorArgs(mirror));
  const checksBefore = mirror.git.state.calls.resolveRemoteRef.length;

  // act
  const second = await materializeOrRefreshPluginMirror(warmMirrorArgs(mirror));

  // assert
  assert.deepStrictEqual(
    {
      second,
      checks: mirror.git.state.calls.resolveRemoteRef.length - checksBefore,
      clones: mirror.git.state.calls.clone.length,
      extensionRoot: await entriesOf(mirror.locations.extensionRoot),
    },
    {
      second: { pluginRoot: mirror.mirrorRoot, resolvedSha: MIRROR_COMMIT_B },
      checks: 1,
      clones: 1,
      extensionRoot: ["plugin-clones", "plugin-clones-backup", "sources-staging"],
    },
  );
});

/** Saves a record whose plugin root is `resolvedSource` into the scope's state. */
async function saveRecordAt(locations: ScopedLocations, resolvedSource: string): Promise<void> {
  const state: ExtensionState = {
    schemaVersion: 3,
    marketplaces: {
      mp: marketplaceRecord("mp", "project", locations.extensionRoot, {
        legacy: pluginRecord(resolvedSource, true),
      }),
    },
  };
  await saveState(locations.extensionRoot, state);
}

void test("D-PL9-10: a mirror swap carries the packages of an installed root inside the mirror", async (t) => {
  // arrange
  const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_B });
  await mkdir(path.join(mirror.mirrorRoot, "node_modules", "dep"), { recursive: true });
  await writeFile(path.join(mirror.mirrorRoot, "node_modules", "dep", "index.js"), "old\n");
  await saveRecordAt(mirror.locations, mirror.mirrorRoot);

  // act
  await materializeOrRefreshPluginMirror(warmMirrorArgs(mirror));

  // assert
  assert.deepStrictEqual(
    {
      tree: await treeOf(mirror.mirrorRoot),
      packages: await readFile(
        path.join(mirror.mirrorRoot, "node_modules", "dep", "index.js"),
        "utf8",
      ),
    },
    { tree: "B\n", packages: "old\n" },
  );
});

void test("D-PL9-10: a state file that cannot be read carries nothing and the swap still runs", async (t) => {
  // arrange
  const mirror = await warmMirror(t, { remoteHead: MIRROR_COMMIT_B });
  await mkdir(path.join(mirror.mirrorRoot, "node_modules"), { recursive: true });
  await writeFile(mirror.locations.stateJsonPath, "{ not json");

  // act
  await materializeOrRefreshPluginMirror(warmMirrorArgs(mirror));

  // assert
  assert.deepStrictEqual(
    { tree: await treeOf(mirror.mirrorRoot), root: await entriesOf(mirror.mirrorRoot) },
    { tree: "B\n", root: [".git", "tree.txt"] },
  );
});

void test("D-18-04: a present mirror read with refresh: false keeps its HEAD and asks the remote nothing", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const { gitOps, state } = mirrorGitOps();
  await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
  });
  const clonesAfterFirst = state.cloneCalls.length;

  // act
  const second = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
    refresh: false,
  });

  // assert
  assert.deepStrictEqual(
    {
      checks: state.resolveRemoteRefCalls,
      clones: state.cloneCalls.length - clonesAfterFirst,
      second,
    },
    {
      checks: [],
      clones: 0,
      second: {
        pluginRoot: await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo")),
        resolvedSha: MIRROR_HEAD,
      },
    },
  );
});

void test("D-18-04 / REI-04: refresh: false answers the declared ref's last fetch, not the commit checked out for another ref", async (t) => {
  // arrange
  const releaseSha = "0123456789abcdef0123456789abcdef01234567";
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));
  await mkdir(mirrorRoot, { recursive: true });
  const { gitOps, state } = createGitOps({
    head: MIRROR_HEAD,
    localRefs: {
      "refs/heads/main": MIRROR_HEAD,
      "refs/remotes/origin/release": releaseSha,
    },
  });

  // act
  const mirror = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    ref: "release",
    gitOps,
    refresh: false,
  });

  // assert
  assert.deepStrictEqual(
    {
      mirror,
      clones: state.cloneCalls,
      checks: state.resolveRemoteRefCalls,
      checkouts: state.checkoutCalls,
    },
    {
      mirror: { pluginRoot: mirrorRoot, resolvedSha: releaseSha },
      clones: [],
      checks: [],
      checkouts: [],
    },
  );
});

/** The staging parent of every clone call, so a re-clone is checked by where it went. */
function cloneParents(state: ReturnType<typeof createGitOps>["state"]): string[] {
  return state.cloneCalls.map(({ dir }) => path.dirname(dir));
}

void test("D-18-04: refresh: false refreshes a declared ref the mirror never fetched, as a cache miss", async (t) => {
  // arrange
  const devSha = "89abcdef0123456789abcdef0123456789abcdef";
  const auth = publicCloneAuth();
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));
  await mkdir(mirrorRoot, { recursive: true });
  const { gitOps, state } = createGitOps({
    head: MIRROR_HEAD,
    localRefs: { "refs/heads/main": MIRROR_HEAD },
    remoteRefs: { dev: devSha },
  });

  // act
  const mirror = await materializeOrRefreshPluginMirror({
    auth,
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    ref: "dev",
    gitOps,
    refresh: false,
  });

  // assert
  assert.deepStrictEqual(
    { mirror, checks: state.resolveRemoteRefCalls, clones: cloneParents(state) },
    {
      mirror: { pluginRoot: mirrorRoot, resolvedSha: devSha },
      checks: [{ url: "https://example.com/repo", ref: "dev", auth }],
      clones: [path.join(locations.extensionRoot, "sources-staging")],
    },
  );
});

void test("GLK-08 / D-PL7-10: refresh: false answers a declared tag from the mirror's local tag, with no network", async (t) => {
  // arrange
  const tagSha = "fedcba9876543210fedcba9876543210fedcba98";
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));
  await mkdir(mirrorRoot, { recursive: true });
  const { gitOps, state } = createGitOps({
    head: MIRROR_HEAD,
    localRefs: { "refs/heads/main": MIRROR_HEAD, "refs/tags/v2.0.0": tagSha },
  });

  // act
  const mirror = await materializeOrRefreshPluginMirror({
    auth: publicCloneAuth(),
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    ref: "v2.0.0",
    gitOps,
    refresh: false,
  });

  // assert
  assert.deepStrictEqual(
    {
      mirror,
      refReads: state.resolveRefCalls,
      clones: state.cloneCalls,
      checks: state.resolveRemoteRefCalls,
    },
    {
      mirror: { pluginRoot: mirrorRoot, resolvedSha: tagSha },
      refReads: [
        { dir: mirrorRoot, ref: "refs/remotes/origin/v2.0.0" },
        { dir: mirrorRoot, ref: "refs/tags/v2.0.0" },
      ],
      clones: [],
      checks: [],
    },
  );
});

void test("GLK-08 / D-PL7-10: refresh: false refreshes a declared ref the mirror holds no commit tag for, as a cache miss", async (t) => {
  // arrange
  const tagSha = "fedcba9876543210fedcba9876543210fedcba98";
  const auth = publicCloneAuth();
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));
  await mkdir(mirrorRoot, { recursive: true });
  const { gitOps, state } = createGitOps({
    head: "0123456789abcdef0123456789abcdef01234567",
    localRefs: { "refs/heads/main": "0123456789abcdef0123456789abcdef01234567" },
    remoteRefs: { "v2.0.0": tagSha },
  });

  // act
  const mirror = await materializeOrRefreshPluginMirror({
    auth,
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    ref: "v2.0.0",
    gitOps,
    refresh: false,
  });

  // assert
  assert.deepStrictEqual(
    { mirror, checks: state.resolveRemoteRefCalls, clones: cloneParents(state) },
    {
      mirror: { pluginRoot: mirrorRoot, resolvedSha: tagSha },
      checks: [{ url: "https://example.com/repo", ref: "v2.0.0", auth }],
      clones: [path.join(locations.extensionRoot, "sources-staging")],
    },
  );
});

void test("GLK-08 / D-PL7-10: refresh: false propagates a local tag read that fails for a reason other than a missing tag", async (t) => {
  // arrange
  const readFailure = Object.assign(new Error("EIO: i/o error, read"), { code: "EIO" });
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));
  await mkdir(mirrorRoot, { recursive: true });
  const { gitOps: baseGitOps, state } = createGitOps({
    head: MIRROR_HEAD,
    localRefs: { "refs/heads/main": MIRROR_HEAD },
  });
  const gitOps: GitOps = {
    ...baseGitOps,
    resolveRef: (options) =>
      options.ref === "refs/tags/v2.0.0"
        ? Promise.reject(readFailure)
        : baseGitOps.resolveRef(options),
  };

  // act & assert
  await assert.rejects(
    materializeOrRefreshPluginMirror({
      auth: publicCloneAuth(),
      locations,
      cloneUrl: "https://example.com/repo",
      networkUrl: "https://example.com/repo",
      ref: "v2.0.0",
      gitOps,
      refresh: false,
    }),
    (error: unknown) => error === readFailure,
  );
  assert.deepStrictEqual(
    { clones: state.cloneCalls, checks: state.resolveRemoteRefCalls },
    { clones: [], checks: [] },
  );
});

void test("GLK-08 / D-PL7-10: refresh: false with no declared ref and no default-branch tracking ref refreshes without a tag read", async (t) => {
  // arrange
  const auth = publicCloneAuth();
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));
  await mkdir(mirrorRoot, { recursive: true });
  const { gitOps: baseGitOps, state } = createGitOps({
    head: MIRROR_HEAD,
    localRefs: { "refs/heads/main": MIRROR_HEAD },
  });
  // The mirror has no default-branch tracking ref.
  const refReads: string[] = [];
  const gitOps: GitOps = {
    ...baseGitOps,
    resolveRef: (options) => {
      refReads.push(options.ref);
      return options.ref === "refs/remotes/origin/HEAD"
        ? Promise.resolve(undefined)
        : baseGitOps.resolveRef(options);
    },
  };

  // act
  const mirror = await materializeOrRefreshPluginMirror({
    auth,
    locations,
    cloneUrl: "https://example.com/repo",
    networkUrl: "https://example.com/repo",
    gitOps,
    refresh: false,
  });

  // assert
  assert.deepStrictEqual(
    { mirror, refReads, clones: state.cloneCalls, checks: state.resolveRemoteRefCalls },
    {
      mirror: { pluginRoot: mirrorRoot, resolvedSha: MIRROR_HEAD },
      refReads: ["refs/remotes/origin/HEAD", "HEAD", "HEAD"],
      clones: [],
      checks: [{ url: "https://example.com/repo", auth }],
    },
  );
});

void test("D-18-04: refresh: false propagates a mirror ref read that fails for a reason other than a missing ref", async (t) => {
  // arrange
  const readFailure = Object.assign(new Error("EIO: i/o error, read"), { code: "EIO" });
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey("https://example.com/repo"));
  await mkdir(mirrorRoot, { recursive: true });
  const { gitOps: baseGitOps, state } = createGitOps({ head: MIRROR_HEAD });
  const gitOps: GitOps = { ...baseGitOps, resolveRef: () => Promise.reject(readFailure) };

  // act & assert
  await assert.rejects(
    materializeOrRefreshPluginMirror({
      auth: publicCloneAuth(),
      locations,
      cloneUrl: "https://example.com/repo",
      networkUrl: "https://example.com/repo",
      gitOps,
      refresh: false,
    }),
    (error: unknown) => error === readFailure,
  );
  assert.deepStrictEqual(
    { clones: state.cloneCalls, checks: state.resolveRemoteRefCalls },
    { clones: [], checks: [] },
  );
});

void test("SG-TRN-01: a mirror whose HEAD names no commit fails as a missing local ref", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const { gitOps: baseGitOps } = mirrorGitOps();
  const gitOps: GitOps = {
    ...baseGitOps,
    resolveRef: (options) =>
      options.ref === "HEAD" ? Promise.resolve(undefined) : baseGitOps.resolveRef(options),
  };

  // act & assert
  await assert.rejects(
    materializeOrRefreshPluginMirror({
      auth: publicCloneAuth(),
      locations,
      cloneUrl: "https://example.com/repo",
      networkUrl: "https://example.com/repo",
      gitOps,
    }),
    (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { failure: error.failure, operation: error.operation },
        { failure: { kind: "local-ref-missing" }, operation: "rev-parse --verify" },
      );
      return true;
    },
  );
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

void test("PROV-03: a private mirror forwards auth through its clone and its freshness check", async (t) => {
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

  const mirrorArgs = {
    locations,
    cloneUrl: "https://gitlab.example.com/o/r",
    networkUrl: "https://gitlab.example.com/o/r",
    gitOps,
    auth,
  };

  // act
  await materializeOrRefreshPluginMirror(mirrorArgs);
  const mirror = await materializeOrRefreshPluginMirror(mirrorArgs);

  // assert
  assert.deepEqual(mirror, {
    pluginRoot: await locations.pluginCloneDir(pluginMirrorKey("https://gitlab.example.com/o/r")),
    resolvedSha: MIRROR_HEAD,
  });
  assert.equal(state.cloneCalls[0]?.auth, auth);
  assert.equal(state.resolveRemoteRefCalls[0]?.auth, auth);
});

void test("MIRR-02 / D-SG-10: the default git surface re-clones a warm mirror it cannot read and a failed clone leaves the mirror", async (t) => {
  // arrange
  const unreachableUrl = "https://127.0.0.1:9/repo";
  const locations = await freshLocations(t);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(unreachableUrl));
  await mkdir(mirrorRoot, { recursive: true });
  await writeFile(path.join(mirrorRoot, "tree.txt"), "A\n");
  let refreshError: unknown;

  // act
  try {
    await materializeOrRefreshPluginMirror({
      auth: publicCloneAuth(),
      locations,
      cloneUrl: unreachableUrl,
      networkUrl: unreachableUrl,
    });
  } catch (error) {
    refreshError = error;
  }

  // assert
  assert.ok(refreshError instanceof GitCommandError, String(refreshError));
  assert.deepStrictEqual(
    {
      operation: refreshError.operation,
      tree: await treeOf(mirrorRoot),
      staging: await entriesOf(path.join(locations.extensionRoot, "sources-staging")),
    },
    { operation: "clone --depth", tree: "A\n", staging: [] },
  );
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
  assert.equal(
    base.state.resolveRemoteRefCalls.length,
    1,
    "the winner's tree is checked against the remote",
  );
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

void test("D-SG-10 / D-18-04: real git moves a warm mirror to its branch's new commit, then answers it offline and stays current", async (t) => {
  // arrange
  const remote = await ladderRemote(t);
  const locations = await freshLocations(t);
  const recorded = recordingGitProcess(await hermeticGitProcess(t));
  const mirrorArgs = {
    auth: publicCloneAuth(),
    locations,
    cloneUrl: remote.url,
    networkUrl: remote.url,
    ref: "dev",
    gitOps: systemGitOps(recorded.gitProcess),
  };
  await materializeOrRefreshPluginMirror(mirrorArgs);
  const repository = gitTestCheckout(new URL(remote.url).pathname);
  await repository.run("checkout", "-q", "dev");
  await writeFile(path.join(repository.dir, "dev3.txt"), "dev3\n");
  const moved = await repository.commitPaths("dev3", ["dev3.txt"]);
  const operationsBefore = recorded.requests.length;

  // act
  const refreshed = await materializeOrRefreshPluginMirror(mirrorArgs);
  const offline = await materializeOrRefreshPluginMirror({ ...mirrorArgs, refresh: false });
  const operationsBeforeAgain = recorded.requests.length;
  const again = await materializeOrRefreshPluginMirror(mirrorArgs);

  // assert
  const operationsOf = (start: number, end: number) =>
    recorded.requests.slice(start, end).map((request) => request.subcommand);
  assert.deepStrictEqual(
    {
      refreshed: refreshed.resolvedSha,
      offline: offline.resolvedSha,
      again: again.resolvedSha,
      dev3: await readFile(path.join(refreshed.pluginRoot, "dev3.txt"), "utf8"),
      againOperations: operationsOf(operationsBeforeAgain, recorded.requests.length),
      refreshOperations: operationsOf(operationsBefore, operationsBeforeAgain).includes("clone"),
    },
    {
      refreshed: moved,
      offline: moved,
      again: moved,
      dev3: "dev3\n",
      againOperations: ["rev-parse", "ls-remote", "rev-parse"],
      refreshOperations: true,
    },
  );
});

const GITHUB_REPO_URL = "https://github.com/owner/repo";
const OTHER_REPO_URL = "https://other.example.com/different";

async function buildMarketplaceCheckout(
  t: TestContext,
  options: {
    originUrl?: string;
    plugins: unknown[];
  },
): Promise<string> {
  const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-marketplace-"));
  t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));
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
  const checkout = await initGitTestCheckout(
    marketplaceRoot,
    options.originUrl === undefined ? {} : { origin: options.originUrl },
  );
  await checkout.commitPaths("initial marketplace", [
    ".claude-plugin/marketplace.json",
    "plugins/foo/.claude-plugin/plugin.json",
  ]);
  return marketplaceRoot;
}

/**
 * Tags the checkout's `HEAD` with the lightweight tag `name` and returns the
 * tagged commit id. `rev-parse` and `tag` write neither `.git/HEAD` nor
 * `.git/index`, so a `gitStateSnapshot` taken before the tag stays comparable.
 */
async function tagMarketplaceHead(marketplaceRoot: string, name: string): Promise<string> {
  const checkout = gitTestCheckout(marketplaceRoot);
  const tagOid = await checkout.run("rev-parse", "HEAD");
  await checkout.run("tag", name, tagOid);
  return tagOid;
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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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
  const mirror = gitTestCheckout(mirrorRoot);
  const mirrorHead = await mirror.run("rev-parse", "HEAD");
  const originUrl: unknown = await mirror.run("config", "--get", "remote.origin.url");

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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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

for (const originUrl of ["git@github.com:Owner/Repo.git", "ssh://git@github.com/owner/repo"]) {
  void test(`D-SG-23: a path marketplace whose origin is ${originUrl} seeds the github plugin owner/repo`, async (t) => {
    // arrange
    const locations = await freshLocations(t);
    const marketplaceRoot = await buildMarketplaceCheckout(t, {
      originUrl,
      plugins: [{ name: "github", source: "owner/repo" }],
    });
    await saveMarketplace(locations, marketplaceRoot, marketplaceRoot);

    // act
    await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
    const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

    // assert
    assert.equal(await pathExists(mirrorRoot), true);
  });
}

void test("D-SG-23: a path marketplace whose ssh origin names another GitHub repository seeds nothing", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: "git@github.com:owner/other.git",
    plugins: [{ name: "github", source: "owner/repo" }],
  });
  await saveMarketplace(locations, marketplaceRoot, marketplaceRoot);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.equal(await pathExists(mirrorRoot), false);
});

void test("SEED-02: a path marketplace without an origin remote leaves the clone cache empty", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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
  t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));
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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [
      gitSubdirEntry("pinned", GITHUB_REPO_URL, { sha: PIN_40 }),
      gitSubdirEntry("unpinned", GITHUB_REPO_URL),
    ],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);
  const checkoutError = checkoutFailure(PIN_40);
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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
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

void test("D-SEED-01: a same-repository git-subdir source whose url ends in .git seeds the mirror under its own url", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const pluginUrl = `${GITHUB_REPO_URL}.git`;
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [gitSubdirEntry("subdir", pluginUrl)],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const pluginMirror = await locations.pluginCloneDir(pluginMirrorKey(pluginUrl));
  const marketplaceMirror = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.deepStrictEqual(
    {
      pluginMirror: await pathExists(pluginMirror),
      marketplaceMirror: await pathExists(marketplaceMirror),
      staging: await stagingEntries(locations),
    },
    { pluginMirror: true, marketplaceMirror: false, staging: [] },
  );
});

void test("D-SEED-01: a pinned same-repository git-subdir source whose url ends in .git seeds the per-commit clone under its own url", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const pluginUrl = `${GITHUB_REPO_URL}.git`;
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [gitSubdirEntry("subdir", pluginUrl, { sha: PIN_40 })],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);
  const { gitOps, state } = createGitOps();

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace", gitOps });
  const pluginClone = await locations.pluginCloneDir(pluginCloneKey(pluginUrl, PIN_40));
  const marketplaceClone = await locations.pluginCloneDir(pluginCloneKey(GITHUB_REPO_URL, PIN_40));

  // assert
  assert.deepStrictEqual(
    {
      pluginClone: await pathExists(pluginClone),
      marketplaceClone: await pathExists(marketplaceClone),
      checkouts: state.checkoutCalls.map(({ ref }) => ref),
      staging: await stagingEntries(locations),
    },
    { pluginClone: true, marketplaceClone: false, checkouts: [PIN_40], staging: [] },
  );
});

for (const suffix of ["/", ".git/"]) {
  void test(`D-SEED-01: a same-repository git-subdir source whose url ends in ${suffix} seeds the mirror under its own url`, async (t) => {
    // arrange
    const locations = await freshLocations(t);
    const pluginUrl = `${GITHUB_REPO_URL}${suffix}`;
    const marketplaceRoot = await buildMarketplaceCheckout(t, {
      originUrl: GITHUB_REPO_URL,
      plugins: [gitSubdirEntry("subdir", pluginUrl)],
    });
    await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);

    // act
    await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
    const pluginMirror = await locations.pluginCloneDir(pluginMirrorKey(pluginUrl));
    const marketplaceMirror = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

    // assert
    assert.deepStrictEqual(
      {
        pluginMirror: await pathExists(pluginMirror),
        marketplaceMirror: await pathExists(marketplaceMirror),
        staging: await stagingEntries(locations),
      },
      { pluginMirror: true, marketplaceMirror: false, staging: [] },
    );
  });
}

void test("D-SEED-01: a git-subdir source whose url drops one of the two .git suffixes of the marketplace origin stays cold", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const pluginUrl = "https://git.example.com/o/r";
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: "https://git.example.com/o/r.git.git",
    plugins: [gitSubdirEntry("subdir", pluginUrl)],
  });
  await saveMarketplace(locations, marketplaceRoot, marketplaceRoot);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const pluginMirror = await locations.pluginCloneDir(pluginMirrorKey(pluginUrl));

  // assert
  assert.deepStrictEqual(
    { pluginMirror: await pathExists(pluginMirror), staging: await stagingEntries(locations) },
    { pluginMirror: false, staging: [] },
  );
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

void test("PURL-03: a materialized git subdirectory resolves beneath the clone root", async (t) => {
  // arrange
  const cloneRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-subdir-"));
  t.after(() => rm(cloneRoot, { recursive: true, force: true }));
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

void test("PURL-03: an escaping git subdirectory preserves the complete containment result", async (t) => {
  // arrange
  const cloneRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-escape-"));
  t.after(() => rm(cloneRoot, { recursive: true, force: true }));
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

void test("PURL-03: a missing git subdirectory preserves the complete missing result", async (t) => {
  // arrange
  const cloneRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-missing-"));
  t.after(() => rm(cloneRoot, { recursive: true, force: true }));
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

/** `.git/HEAD` and `.git/index` bytes, for a before/after untouched-clone proof. */
async function gitStateSnapshot(
  root: string,
): Promise<{ head: Buffer; index: Buffer | undefined }> {
  const head = await readFile(path.join(root, ".git", "HEAD"));
  let index: Buffer | undefined;
  try {
    index = await readFile(path.join(root, ".git", "index"));
  } catch {
    index = undefined;
  }

  return { head, index };
}

void test("materializeMarketplaceTagClone: materializes the tag's tree without mutating the marketplace clone's own git state", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  const before = await gitStateSnapshot(marketplaceRoot);
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");
  const created: string[] = [];

  // act
  const tagClone = await materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: marketplaceRoot,
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/foo"),
    tagOid,
    onCloneCreated: (key) => created.push(key),
  });

  // assert
  assert.equal(tagClone.kind, "materialized");
  if (tagClone.kind === "materialized") {
    assert.equal(tagClone.resolvedSha, tagOid);
    const pluginJson: unknown = JSON.parse(
      await readFile(path.join(tagClone.pluginRoot, ".claude-plugin", "plugin.json"), "utf8"),
    );
    assert.deepEqual(pluginJson, { name: "foo" });
  }

  const after = await gitStateSnapshot(marketplaceRoot);
  assert.deepEqual(after, before);
  assert.deepStrictEqual(created, [pluginCloneKey(GITHUB_REPO_URL, tagOid)]);
});

void test("materializeMarketplaceTagClone: a warm-cache key skips re-copy and re-checkout entirely", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");
  const key = pluginCloneKey(GITHUB_REPO_URL, tagOid);
  const dest = await locations.pluginCloneDir(key);
  await mkdir(dest, { recursive: true });
  await mkdir(path.join(dest, "plugins", "foo", ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(dest, "plugins", "foo", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "sentinel" }),
  );

  // act
  const tagClone = await materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: marketplaceRoot,
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/foo"),
    tagOid,
  });

  // assert: the sentinel content proves the warm key was never overwritten.
  assert.equal(tagClone.kind, "materialized");
  if (tagClone.kind === "materialized") {
    const pluginJson: unknown = JSON.parse(
      await readFile(path.join(tagClone.pluginRoot, ".claude-plugin", "plugin.json"), "utf8"),
    );
    assert.deepEqual(pluginJson, { name: "sentinel" });
  }

  assert.deepEqual(await stagingEntries(locations), []);
});

void test("materializeMarketplaceTagClone: a failed checkout cleans staging and rethrows with the leak suffix appended (MA-9)", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");
  const checkoutError = new Error("checkout failed");
  const gitOps: GitOps = {
    ...DEFAULT_GIT_OPS,
    checkout: () => Promise.reject(checkoutError),
  };

  // act & assert
  await assert.rejects(
    materializeMarketplaceTagClone({
      locations,
      marketplaceRoot,
      marketplaceSource: marketplaceRoot,
      marketplaceName: "marketplace",
      pathSource: pathSource("./plugins/foo"),
      tagOid,
      gitOps,
    }),
    (err: unknown) => err === checkoutError,
  );
  assert.deepEqual(await stagingEntries(locations), []);
});

void test("materializeMarketplaceTagClone: an unreadable marketplace gitdir cleans staging instead of leaking it", async (t) => {
  // arrange: the marketplace root's `.git` is gone by the time the copy runs
  // (WR-04's exact shape -- missing or unreadable), so the `cp` into staging
  // throws before any checkout is attempted.
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");
  await rm(path.join(marketplaceRoot, ".git"), { recursive: true, force: true });

  // act & assert
  await assert.rejects(
    materializeMarketplaceTagClone({
      locations,
      marketplaceRoot,
      marketplaceSource: marketplaceRoot,
      marketplaceName: "marketplace",
      pathSource: pathSource("./plugins/foo"),
      tagOid,
    }),
    { code: "ENOENT" },
  );
  assert.deepEqual(await stagingEntries(locations), []);
});

void test("materializeMarketplaceTagClone: a checkout failure that also fails to clean up staging carries the leak annotation (MA-9)", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");
  const checkoutError = new Error("checkout failed");
  let stagingParent = "";
  const gitOps: GitOps = {
    ...DEFAULT_GIT_OPS,
    checkout: async (options) => {
      stagingParent = path.dirname(options.dir);
      // Deny write on the staging dir's parent so cleanupStaging's own `rm`
      // fails too, forcing appendLeakToError's leak branch instead of its
      // pass-through branch.
      await chmod(stagingParent, 0o500);
      throw checkoutError;
    },
  };

  // act
  let materializeError: unknown;
  try {
    await materializeMarketplaceTagClone({
      locations,
      marketplaceRoot,
      marketplaceSource: marketplaceRoot,
      marketplaceName: "marketplace",
      pathSource: pathSource("./plugins/foo"),
      tagOid,
      gitOps,
    });
  } catch (error) {
    materializeError = error;
  } finally {
    await chmod(stagingParent, 0o700);
  }

  // assert
  assert.ok(materializeError instanceof Error);
  assert.match(
    materializeError.message,
    /^checkout failed \(additionally: failed to clean up marketplace tag clone staging at .*: EACCES/,
  );
  assert.strictEqual(materializeError.cause, checkoutError);
});

void test("materializeMarketplaceTagClone: no directory at the path source's relative path resolves the missing-subdir arm (D-07-08)", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");

  // act
  const tagClone = await materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: marketplaceRoot,
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/missing"),
    tagOid,
  });

  // assert
  assert.equal(tagClone.kind, "missing-subdir");
  // WR-07: the detail must name the source kind the user actually used
  // (`path`), not `git-subdir` -- a kind this install never touched.
  assert.ok(tagClone.kind === "missing-subdir");
  assert.match(tagClone.detail, /^path path "/u);
  assert.doesNotMatch(tagClone.detail, /git-subdir/u);
});

void test("materializeMarketplaceTagClone: a marketplace checkout with no discoverable origin remote still derives a key (RESEARCH A2)", async (t) => {
  // arrange: no `originUrl`, so `deriveMarketplaceUrl` finds no origin remote.
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, { plugins: [] });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");

  // act
  const tagClone = await materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: marketplaceRoot,
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/foo"),
    tagOid,
  });

  // assert: materialization still succeeds off the name-keyed fallback.
  assert.equal(tagClone.kind, "materialized");
});

/** One recorded tag-copy git operation, its directory read as staging or not. */
interface TagCopyOperation {
  readonly op: string;
  readonly inStaging: boolean;
  readonly copied: boolean;
  readonly sha?: string;
  readonly ref?: string;
  readonly unshallow?: boolean;
  readonly fromCopiedGitDir?: boolean;
  readonly auth?: GitAuthBundle;
}

/**
 * GitOps over the production checkout that records the tag copy's fetch and
 * checkout, each with whether its directory is a staging copy holding `.git`.
 */
function recordingTagCopyGitOps(
  locations: ScopedLocations,
  fetchCommit: GitOps["fetchCommit"] = () => Promise.resolve(),
): { readonly gitOps: GitOps; readonly operations: TagCopyOperation[] } {
  const operations: TagCopyOperation[] = [];
  const where = async (dir: string): Promise<Pick<TagCopyOperation, "copied" | "inStaging">> => ({
    inStaging: dir.startsWith(path.join(locations.extensionRoot, "sources-staging")),
    copied: await pathExists(path.join(dir, ".git", "HEAD")),
  });
  return {
    operations,
    gitOps: {
      ...DEFAULT_GIT_OPS,
      async fetchCommit(opts) {
        operations.push({
          op: "fetchCommit",
          ...(await where(opts.dir)),
          sha: opts.sha,
          ...(opts.unshallow !== undefined && { unshallow: opts.unshallow }),
          ...(opts.auth !== undefined && { auth: opts.auth }),
        });
        return fetchCommit(opts);
      },
      async checkout(opts) {
        operations.push({
          op: "checkout",
          ...(await where(opts.dir)),
          ref: opts.ref,
          ...(opts.fromCopiedGitDir !== undefined && { fromCopiedGitDir: opts.fromCopiedGitDir }),
        });
        return DEFAULT_GIT_OPS.checkout(opts);
      },
    },
  };
}

void test("D-SG-09: a github marketplace's tag copy fetches only the tag's commit into the copy with its host's bundle, then checks it out", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");
  const recorded = recordingTagCopyGitOps(locations);
  const auth = publicCloneAuth();
  const authRequests: unknown[] = [];

  // act
  const tagClone = await materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: githubSource("owner/repo"),
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/foo"),
    tagOid,
    gitOps: recorded.gitOps,
    resolveAuth: (cloneUrl, kind) => {
      authRequests.push([cloneUrl, kind]);
      return auth;
    },
  });

  // assert
  assert.deepStrictEqual(
    { kind: tagClone.kind, operations: recorded.operations, authRequests },
    {
      kind: "materialized",
      operations: [
        { op: "fetchCommit", inStaging: true, copied: true, sha: tagOid, unshallow: false, auth },
        { op: "checkout", inStaging: true, copied: true, ref: tagOid, fromCopiedGitDir: true },
      ],
      authRequests: [[GITHUB_REPO_URL, "github"]],
    },
  );
});

void test("D-SG-09: a url marketplace's tag copy with no auth builder fetches without a bundle", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: OTHER_REPO_URL,
    plugins: [],
  });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");
  const recorded = recordingTagCopyGitOps(locations);

  // act
  await materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: OTHER_REPO_URL,
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/foo"),
    tagOid,
    gitOps: recorded.gitOps,
  });

  // assert
  assert.deepStrictEqual(
    recorded.operations.map(({ op, auth }) => [op, auth]),
    [
      ["fetchCommit", undefined],
      ["checkout", undefined],
    ],
  );
});

void test("D-SG-09: a directory marketplace's tag copy fetches nothing and builds no bundle", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");
  const recorded = recordingTagCopyGitOps(locations);

  // act
  const tagClone = await materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: marketplaceRoot,
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/foo"),
    tagOid,
    gitOps: recorded.gitOps,
    resolveAuth: () => {
      throw new Error("a directory marketplace builds no bundle");
    },
  });

  // assert
  assert.deepStrictEqual(
    { kind: tagClone.kind, operations: recorded.operations.map(({ op }) => op) },
    { kind: "materialized", operations: ["checkout"] },
  );
});

void test("D-SG-09, MA-9: a failed tag fetch cleans staging, checks nothing out, and rethrows", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  const tagOid = await tagMarketplaceHead(marketplaceRoot, "foo--v1.0.0");
  const fetchError = new GitCommandError({ kind: "network" }, { operation: "fetch --depth" });
  const recorded = recordingTagCopyGitOps(locations, () => Promise.reject(fetchError));

  // act
  const materializing = materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: GITHUB_REPO_URL,
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/foo"),
    tagOid,
    gitOps: recorded.gitOps,
  });

  // assert
  await assert.rejects(materializing, (err: unknown) => err === fetchError);
  assert.deepStrictEqual(
    {
      operations: recorded.operations.map(({ op }) => op),
      staging: await stagingEntries(locations),
      promoted: await pathExists(
        await locations.pluginCloneDir(pluginCloneKey(GITHUB_REPO_URL, tagOid)),
      ),
    },
    { operations: ["fetchCommit"], staging: [], promoted: false },
  );
});

void test("D-SG-09: real git gives a depth-1 marketplace clone's tag copy the tree of an older tagged commit", async (t) => {
  // arrange: the release tag names an older commit than the branch head, so
  // a depth-1 clone of the marketplace repository does not hold it.
  const upstream = await createGitTestRepository(t, { boundary: "local" });
  const tagged = await upstream.commit(
    [
      {
        filepath: ".claude-plugin/marketplace.json",
        contents: '{"name":"marketplace","plugins":[]}',
      },
      {
        filepath: "plugins/foo/.claude-plugin/plugin.json",
        contents: '{"name":"foo","version":"1.0.0"}',
      },
    ],
    "release foo 1.0.0",
  );
  await upstream.run("tag", "-a", "-m", "foo 1.0.0", "foo--v1.0.0", tagged);
  await upstream.commit(
    [
      {
        filepath: "plugins/foo/.claude-plugin/plugin.json",
        contents: '{"name":"foo","version":"2.0.0"}',
      },
    ],
    "foo 2.0.0",
  );
  const parent = await mkdtemp(path.join(tmpdir(), "clone-cache-tag-copy-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const marketplaceRoot = path.join(parent, "marketplace");
  const recorded = recordingGitProcess(await hermeticGitProcess(t));
  const gitOps = systemGitOps(recorded.gitProcess);
  await gitOps.clone({ dir: marketplaceRoot, url: `file://${upstream.dir}` });
  const locations = await freshLocations(t);
  recorded.requests.splice(0);

  // act
  const tagClone = await materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: "https://example.com/acme/marketplace.git",
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/foo"),
    tagOid: tagged,
    gitOps,
    resolveAuth: publicCloneAuth,
  });

  // assert
  assert.ok(tagClone.kind === "materialized");
  assert.deepStrictEqual(
    {
      plugin: await readFile(
        path.join(tagClone.pluginRoot, ".claude-plugin", "plugin.json"),
        "utf8",
      ),
      operations: recorded.requests.map((request) =>
        [request.subcommand, ...(request.options ?? []).slice(0, 1)].join(" "),
      ),
      marketplaceHead: await gitTestCheckout(marketplaceRoot).run("rev-parse", "HEAD"),
    },
    {
      plugin: '{"name":"foo","version":"1.0.0"}',
      operations: [
        "config --local",
        "fetch --depth",
        "config --local",
        "config --local",
        "config --local",
        "checkout -f",
      ],
      marketplaceHead: await upstream.run("rev-parse", "HEAD"),
    },
  );
});

/**
 * Seeds the URL-keyed mirror of `cloneUrl` with a `.git` holding a config and
 * an index, and one untracked work-tree file, returning its root.
 */
async function seedMirror(locations: ScopedLocations, cloneUrl: string): Promise<string> {
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
  await writeFile(path.join(mirrorRoot, ".git", "config"), "mirror config");
  await writeFile(path.join(mirrorRoot, ".git", "index"), "mirror index");
  await writeFile(path.join(mirrorRoot, "plugin.txt"), "untracked mirror file");
  return mirrorRoot;
}

/** A fake gitOps whose first checkout rejects with `failure`. */
function failingFirstCheckout(failure: Error): {
  readonly gitOps: GitOps;
  readonly state: ReturnType<typeof createGitOps>["state"];
} {
  let checkouts = 0;
  const { gitOps: inner, state } = createGitOps({ remoteRefs: { [PIN_40]: PIN_40 } });
  return {
    gitOps: {
      ...inner,
      checkout(options) {
        checkouts += 1;
        return checkouts === 1 ? Promise.reject(failure) : inner.checkout(options);
      },
    },
    state,
  };
}

void test("GIT-01: a present per-commit copy uses the default git surface without a git call", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  const copyRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, PIN_40));
  await mkdir(copyRoot, { recursive: true });

  // act
  const result = await materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl: cloneUrl,
    sha: PIN_40,
    resolveAuth: () => assert.fail("a present copy never builds clone auth"),
  });

  // assert
  assert.strictEqual(result, copyRoot);
});

void test("GIT-01: a per-commit copy checks the commit out of the mirror's .git alone, offline", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  const mirrorRoot = await seedMirror(locations, cloneUrl);
  const { gitOps, state } = createGitOps({ remoteRefs: { [PIN_40]: PIN_40 } });
  const created: string[] = [];

  // act
  const result = await materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl: cloneUrl,
    sha: PIN_40,
    gitOps,
    resolveAuth: () => assert.fail("a mirror copy never builds clone auth"),
    onCloneCreated: (key) => created.push(key),
  });

  // assert
  assert.strictEqual(result, await locations.pluginCloneDir(pluginCloneKey(cloneUrl, PIN_40)));
  assert.strictEqual(await readFile(path.join(result, ".git", "config"), "utf8"), "mirror config");
  assert.strictEqual(await pathExists(path.join(result, ".git", "index")), false);
  assert.strictEqual(await pathExists(path.join(result, "plugin.txt")), false);
  assert.strictEqual(
    await readFile(path.join(mirrorRoot, "plugin.txt"), "utf8"),
    "untracked mirror file",
  );
  assert.deepStrictEqual(
    state.checkoutCalls.map((call) => call.ref),
    [PIN_40],
  );
  assert.strictEqual(state.cloneCalls.length, 0);
  assert.deepStrictEqual(await readdir(path.join(locations.extensionRoot, "sources-staging")), []);
  assert.deepStrictEqual(created, [pluginCloneKey(cloneUrl, PIN_40)]);
});

void test("GIT-01: a real per-commit copy holds the commit's tree with relative symlinks and no untracked file", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await mkdir(path.join(mirrorRoot, "shared"), { recursive: true });
  await mkdir(path.join(mirrorRoot, "skills"), { recursive: true });
  await writeFile(path.join(mirrorRoot, "shared", "tool.txt"), "first");
  await fs.promises.symlink("../shared", path.join(mirrorRoot, "skills", "link"));
  const mirror = await initGitTestCheckout(mirrorRoot);
  const sha = await mirror.commitPaths("first", ["shared/tool.txt", "skills/link"]);
  await writeFile(path.join(mirrorRoot, "shared", "tool.txt"), "edited in the mirror");
  await writeFile(path.join(mirrorRoot, "untracked.txt"), "untracked");

  // act
  const result = await materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl: cloneUrl,
    sha,
    resolveAuth: () => assert.fail("a mirror copy never builds clone auth"),
  });

  // assert
  assert.strictEqual(await readFile(path.join(result, "shared", "tool.txt"), "utf8"), "first");
  assert.strictEqual(await fs.promises.readlink(path.join(result, "skills", "link")), "../shared");
  assert.strictEqual(await pathExists(path.join(result, "untracked.txt")), false);
});

/**
 * D-SG-11: makes the URL-keyed mirror of `cloneUrl` a system-git clone of a
 * repository whose one commit holds `README.md` and the relative symlink
 * `link`, and returns the mirror root and that commit.
 */
async function seedSymlinkMirror(
  t: TestContext,
  locations: ScopedLocations,
  cloneUrl: string,
): Promise<{ readonly mirrorRoot: string; readonly sha: string }> {
  const source = await mkdtemp(path.join(tmpdir(), "clone-cache-symlink-source-"));
  t.after(() => rm(source, { recursive: true, force: true }));
  await writeFile(path.join(source, "README.md"), "# linked\n");
  await fs.promises.symlink("README.md", path.join(source, "link"));
  const sha = await (await initGitTestCheckout(source)).commitPaths("link", ["README.md", "link"]);
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await gitTestCheckout(source).run("clone", "-q", source, mirrorRoot);
  return { mirrorRoot, sha };
}

/** Whether `file` is a symlink, its target when it is one, and the local `core.` key names. */
async function linkAndCoreKeys(
  root: string,
  file: string,
): Promise<{ readonly symlink: boolean; readonly target?: string; readonly keys: string[] }> {
  const filePath = path.join(root, file);
  const listed = await gitTestCheckout(root).run("config", "--local", "--name-only", "--list");
  const keys = listed.split("\n").filter((key) => key.startsWith("core."));
  return (await fs.promises.lstat(filePath)).isSymbolicLink()
    ? { symlink: true, target: await fs.promises.readlink(filePath), keys }
    : { symlink: false, keys };
}

void test("SG-MIG-01: a per-commit copy of an old clone unsets its clone keys and writes the symlink as a link", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  const { mirrorRoot, sha } = await seedSymlinkMirror(t, locations, cloneUrl);
  const mirror = gitTestCheckout(mirrorRoot);
  await mirror.run("config", "core.symlinks", "false");
  await mirror.run("config", "core.ignorecase", "true");
  await mirror.run("config", "core.filemode", "false");

  // act
  const copyRoot = await materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl: cloneUrl,
    sha,
    resolveAuth: () => assert.fail("a mirror copy never builds clone auth"),
  });

  // assert
  assert.deepStrictEqual(await linkAndCoreKeys(copyRoot, "link"), {
    symlink: true,
    target: "README.md",
    keys: ["core.repositoryformatversion", "core.bare", "core.logallrefupdates"],
  });
});

void test("SG-MIG-01: a per-commit copy of a clone without the clone keys checks out the same tree", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  const { mirrorRoot, sha } = await seedSymlinkMirror(t, locations, cloneUrl);
  await gitTestCheckout(mirrorRoot).run("config", "--unset", "core.filemode");

  // act
  const copyRoot = await materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl: cloneUrl,
    sha,
    resolveAuth: () => assert.fail("a mirror copy never builds clone auth"),
  });

  // assert
  assert.deepStrictEqual(await linkAndCoreKeys(copyRoot, "link"), {
    symlink: true,
    target: "README.md",
    keys: ["core.repositoryformatversion", "core.bare", "core.logallrefupdates"],
  });
});

void test("GIT-01: a mirror that lacks the named ref falls back to a clone of it", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  await seedMirror(locations, cloneUrl);
  const { gitOps, state } = failingFirstCheckout(checkoutFailure("release"));

  // act
  const result = await materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl: cloneUrl,
    sha: PIN_40,
    gitOps,
    resolveAuth: publicCloneAuth,
  });

  // assert
  assert.strictEqual(result, await locations.pluginCloneDir(pluginCloneKey(cloneUrl, PIN_40)));
  assert.strictEqual(state.cloneCalls.length, 1);
  assert.deepStrictEqual(await readdir(path.join(locations.extensionRoot, "sources-staging")), []);
});

void test("GIT-01: a mirror that lacks the commit falls back to a clone of it", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  await seedMirror(locations, cloneUrl);
  const { gitOps, state } = failingFirstCheckout(checkoutFailure(PIN_40));

  // act
  await materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl: cloneUrl,
    sha: PIN_40,
    gitOps,
    resolveAuth: publicCloneAuth,
  });

  // assert
  assert.strictEqual(state.cloneCalls.length, 1);
});

void test("GIT-01: any other checkout failure propagates without a clone", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  await seedMirror(locations, cloneUrl);
  const failure = new Error("disk full");
  const { gitOps, state } = failingFirstCheckout(failure);

  // act & assert
  await assert.rejects(
    materializePluginCommitCopy({
      locations,
      cloneUrl,
      networkUrl: cloneUrl,
      sha: PIN_40,
      gitOps,
      resolveAuth: publicCloneAuth,
    }),
    (error: unknown) => error === failure,
  );
  assert.strictEqual(state.cloneCalls.length, 0);
  assert.deepStrictEqual(await readdir(path.join(locations.extensionRoot, "sources-staging")), []);
});

void test("GIT-01: with no mirror the per-commit copy is cloned at the commit", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  const { gitOps, state } = createGitOps({ remoteRefs: { [PIN_40]: PIN_40 } });

  // act
  const result = await materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl: cloneUrl,
    sha: PIN_40,
    gitOps,
    resolveAuth: publicCloneAuth,
  });

  // assert
  assert.strictEqual(result, await locations.pluginCloneDir(pluginCloneKey(cloneUrl, PIN_40)));
  assert.strictEqual(state.cloneCalls.length, 1);
  assert.deepStrictEqual(
    state.checkoutCalls.map((call) => call.ref),
    [PIN_40],
  );
});

void test("GIT-01: a mirror that cannot be copied fails the copy and leaves no staging", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const cloneUrl = "https://example.com/repo";
  const mirrorRoot = await seedMirror(locations, cloneUrl);
  await chmod(path.join(mirrorRoot, ".git", "config"), 0o000);
  const { gitOps, state } = createGitOps();

  // act & assert
  await assert.rejects(
    materializePluginCommitCopy({
      locations,
      cloneUrl,
      networkUrl: cloneUrl,
      sha: PIN_40,
      gitOps,
      resolveAuth: publicCloneAuth,
    }),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "EACCES",
  );
  assert.strictEqual(state.cloneCalls.length, 0);
  assert.deepStrictEqual(await readdir(path.join(locations.extensionRoot, "sources-staging")), []);
});

void test("GIT-04: a tag clone checks out a directory that holds only a symlink", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [],
  });
  await mkdir(path.join(marketplaceRoot, "plugins", "foo", "linked"), { recursive: true });
  await fs.promises.symlink(
    "../.claude-plugin",
    path.join(marketplaceRoot, "plugins", "foo", "linked", "manifest"),
  );
  const tagOid = await gitTestCheckout(marketplaceRoot).commitPaths("symlink-only directory", [
    "plugins/foo/linked/manifest",
  ]);

  // act
  const tagClone = await materializeMarketplaceTagClone({
    locations,
    marketplaceRoot,
    marketplaceSource: marketplaceRoot,
    marketplaceName: "marketplace",
    pathSource: pathSource("./plugins/foo"),
    tagOid,
  });

  // assert
  assert.ok(tagClone.kind === "materialized");
  assert.strictEqual(
    await fs.promises.readlink(path.join(tagClone.pluginRoot, "linked", "manifest")),
    "../.claude-plugin",
  );
});

void test("GIT-04: an unpinned source copies the mirror's commit and anchors its subdir", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const copyRoot = path.join(locations.extensionRoot, "copy");
  await mkdir(path.join(copyRoot, "plugins", "one"), { recursive: true });
  const calls: unknown[] = [];
  const source: GitSubdirSource = {
    kind: "git-subdir",
    raw: "https://example.com/mono.git",
    url: "https://example.com/mono",
    path: "plugins/one",
    ref: "main",
  };
  const auth = publicCloneAuth();
  const created: string[] = [];
  const steps = {
    materializeOrRefreshPluginMirror: (
      args: Parameters<typeof materializeOrRefreshPluginMirror>[0],
    ) => {
      calls.push({ step: "mirror", ref: args.ref, refresh: args.refresh, auth: args.auth });
      args.onCloneCreated?.("mirror");
      return Promise.resolve({ pluginRoot: "unused", resolvedSha: PIN_40 });
    },
    materializePluginCommitCopy: (args: Parameters<typeof materializePluginCommitCopy>[0]) => {
      calls.push({ step: "copy", sha: args.sha, auth: args.resolveAuth() });
      args.onCloneCreated?.("copy");
      return Promise.resolve(copyRoot);
    },
  };
  await materializeUnpinnedSource(steps, { locations, source, auth, refresh: false });
  calls.splice(0);

  // act
  const result = await materializeUnpinnedSource(steps, {
    locations,
    source,
    auth,
    refresh: false,
    onCloneCreated: (key) => created.push(key),
  });

  // assert
  assert.deepStrictEqual(result, {
    kind: "materialized",
    pluginRoot: path.join(copyRoot, "plugins", "one"),
    resolvedSha: PIN_40,
  });
  assert.deepStrictEqual(calls, [
    { step: "mirror", ref: "main", refresh: false, auth },
    { step: "copy", sha: PIN_40, auth },
  ]);
  assert.deepStrictEqual(created, ["mirror", "copy"]);
});
