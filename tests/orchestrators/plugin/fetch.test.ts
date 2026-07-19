import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { fetchPlugins } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../../helpers/device-flow-mock.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { FetchCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// FTCH-01/02/04/06/07 coverage for the fetch orchestrator:
//
//   Single shape (pl@mp): a cold git plugin materializes ONCE, then a
//     post-fetch status row renders (NOT an install).
//   No-op (path): a path-source plugin renders (skipped) {up-to-date} at info
//     severity and makes ZERO git calls (network-free, FTCH-02).
//   No-op (pinned-warm): a pinned git source whose clone is already
//     materialized renders (skipped) {up-to-date} and makes ZERO git calls
//     (network-free, FTCH-04).
//   Unpinned-warm refresh: an unpinned git source with a warm mirror DOES call
//     the mirror-refresh seam (the refresh is the consented fetch) and renders
//     the fresh row.
//   Bulk (@mp): enumerates the manifest's fetchable entries; a per-plugin fetch
//     that throws is captured as a failed row (at error severity) and the sweep
//     continues; the output carries a summary line + tally.
//   Manifest soft-fail: ONE corrupt marketplace.json degrades to an mp-level
//     (failed) block; healthy marketplaces in the same sweep still fetch.
//   Failure narrowing: an HttpError 401 and a UserCanceledError both classify
//     as {authentication required}, never {source missing}.
//   Reasoned rows: an unsupported component renders (partially-available) with
//     its exact dropped-kind reason; a structurally-broken tree renders
//     (unavailable) with its exact structural reason.
//   Dual scope: a bare fetch with scope omitted enumerates BOTH scopes and
//     orders same-name blocks project-first.
//   Auth once-per-host (FTCH-06): a bulk sweep of two plugins on the same
//     private host triggers the device flow at most once (authMemo spans it).

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;
  const pi = {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}

async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "fetch-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn();
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}

/**
 * Wrap the real clone-cache entrypoints with the mock gitOps, and count each
 * arm's invocations so a no-op path can assert ZERO git calls and a fetch path
 * can assert exactly one materialize/refresh. Mirrors update.test.ts's
 * `seamWith`, plus per-arm call counters.
 */
interface SeamSpy {
  readonly seam: FetchCloneCacheSeam;
  readonly counts: { clone: number; mirror: number; pin: number };
}

function seamSpy(gitOps: GitOps): SeamSpy {
  const counts = { clone: 0, mirror: 0, pin: 0 };
  const seam: FetchCloneCacheSeam = {
    resolvePluginPin: (args) => {
      counts.pin += 1;
      return resolvePluginPin({ ...args, gitOps });
    },
    materializePluginClone: (args) => {
      counts.clone += 1;
      return materializePluginClone({ ...args, gitOps });
    },
    materializeOrRefreshPluginMirror: (args) => {
      counts.mirror += 1;
      return materializeOrRefreshPluginMirror({ ...args, gitOps });
    },
  };
  return { seam, counts };
}

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

/** Build the fixture plugin tree the mock clone copies into the cache. */
async function writeFixtureRepo(dir: string, name: string, version: string): Promise<void> {
  await mkdir(path.join(dir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(dir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name, version }),
  );
  const skillDir = path.join(dir, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHello ${version}.\n`);
}

/**
 * Seed a PATH-source marketplace in `project` scope whose manifest carries the
 * supplied entries. Returns the manifest/marketplace roots. Optional installed
 * records are NOT seeded (fetch enumerates the MANIFEST, not installed state).
 */
async function seedMarketplace(opts: {
  cwd: string;
  /** Extra keys (e.g. `lspServers`) flow into the manifest entry verbatim. */
  entries: { name: string; source: unknown; [key: string]: unknown }[];
  plugins?: Record<string, PluginRecord>;
}): Promise<{ marketplaceRoot: string; manifestPath: string }> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(manifestPath, JSON.stringify({ name: "mp", plugins: opts.entries }));

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: opts.plugins ?? {},
      },
    },
  });

  return { marketplaceRoot, manifestPath };
}

test("FTCH-01 single pl@mp on a cold pinned git plugin materializes once, then renders a post-fetch status row (not an install)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-single-cold-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const sha = "1111111111111111111111111111111111111111";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "gp", "1.0.0");

      await seedMarketplace({
        cwd,
        entries: [{ name: "gp", source: { source: "url", url: cloneUrl, sha } }],
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: spy.seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      assert.equal(spy.counts.clone, 1, "cold pinned source materializes exactly once");
      assert.equal(spy.counts.mirror, 0, "pinned source never routes through the mirror seam");

      const locations = locationsFor("project", cwd);
      const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, sha));
      const { pathExists } =
        await import("../../../extensions/pi-claude-marketplace/shared/fs-utils.ts");
      assert.equal(await pathExists(cloneRoot), true, "the clone is materialized in the cache");

      // The post-fetch row is a DERIVED status row, NOT an install cascade. The
      // fixture tree is a fully valid plugin, so the derived status is exactly
      // `(available)`.
      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /gp/, "the row names the fetched plugin");
      assert.match(
        body,
        /\(available\)/,
        "renders the post-fetch derived (available) row, not an (installed) row",
      );
      assert.doesNotMatch(body, /\(installed\)/, "fetch never installs");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-02 no-op path source renders (skipped) {up-to-date} at info severity and makes ZERO git calls", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-noop-path-"));
    try {
      // A path-source plugin: the plugin tree lives inside the marketplace root.
      const { marketplaceRoot } = await seedMarketplace({
        cwd,
        entries: [{ name: "pp", source: "./pp" }],
      });
      await writeFixtureRepo(path.join(marketplaceRoot, "pp"), "pp", "1.0.0");

      const { gitOps } = makeMockGitOps();
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "pp", marketplace: "mp" },
        cloneCacheSeam: spy.seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      assert.equal(spy.counts.clone, 0, "a path source never clones");
      assert.equal(spy.counts.mirror, 0, "a path source never refreshes a mirror");
      assert.equal(spy.counts.pin, 0, "a path source never resolves a pin");

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /\(skipped\)/, "a path no-op renders (skipped)");
      assert.match(body, /\{up-to-date\}/, "the no-op carries the up-to-date reason");
      // info severity: notify never stamps error/warning on a benign no-op.
      const bad = notifications.filter((n) => n.severity === "error" || n.severity === "warning");
      assert.equal(bad.length, 0, "a benign no-op is info severity");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-04 no-op pinned-warm clone renders (skipped) {up-to-date} and makes ZERO git calls (network-free)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-noop-pinned-warm-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const sha = "2222222222222222222222222222222222222222";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "gp", "1.0.0");

      await seedMarketplace({
        cwd,
        entries: [{ name: "gp", source: { source: "url", url: cloneUrl, sha } }],
      });

      // Pre-warm the per-sha clone cache so the presence probe sees it as
      // materialized -> the fetch is a no-op that must NOT touch the network.
      const locations = locationsFor("project", cwd);
      const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, sha));
      await mkdir(path.dirname(cloneRoot), { recursive: true });
      await cp(fixtureRepoDir, cloneRoot, { recursive: true });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: spy.seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      assert.equal(
        spy.counts.clone,
        0,
        "a warm pinned clone is never re-materialized (no network)",
      );
      assert.equal(spy.counts.mirror, 0, "a pinned source never routes through the mirror seam");

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /\(skipped\)/, "a warm pinned clone renders (skipped)");
      assert.match(body, /\{up-to-date\}/, "the no-op carries the up-to-date reason");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-01 unpinned-warm source refreshes its mirror (the refresh IS the consented fetch) and renders the fresh row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-unpinned-warm-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const headSha = "3333333333333333333333333333333333333333";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "gp", "1.0.0");

      await seedMarketplace({
        cwd,
        // Unpinned: no `sha` on the entry source.
        entries: [{ name: "gp", source: { source: "url", url: cloneUrl } }],
      });

      // Pre-warm the URL-keyed mirror with the fixture tree + a valid
      // detached-HEAD .git so the presence probe reads it as materialized; an
      // UNPINNED warm source must still refresh (unlike pinned-warm, a no-op).
      const locations = locationsFor("project", cwd);
      const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      await mkdir(path.dirname(mirrorDir), { recursive: true });
      await cp(fixtureRepoDir, mirrorDir, { recursive: true });
      await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
      await writeFile(path.join(mirrorDir, ".git", "HEAD"), `${headSha}\n`);

      // The refresh path fetches + reads refs/remotes/origin/main then HEAD;
      // seed those refs so the mock resolves cleanly (parity with the update
      // verb's unpinned-mirror test).
      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: headSha,
        localRefs: { "refs/heads/main": headSha },
        remoteRefs: { "refs/remotes/origin/main": headSha },
      });
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: spy.seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      assert.equal(
        spy.counts.mirror,
        1,
        "an unpinned warm source refreshes its mirror exactly once",
      );
      assert.equal(
        spy.counts.clone,
        0,
        "an unpinned source never routes through the per-sha clone seam",
      );

      const body = notifications.map((n) => n.message).join("\n");
      assert.doesNotMatch(body, /\(skipped\)/, "an unpinned source is NOT a no-op");
      // The refreshed mirror carries the valid fixture tree -> `(available)`.
      assert.match(body, /\(available\)/, "renders the fresh post-refresh (available) row");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-07 bulk @mp enumerates fetchable manifest entries; a per-plugin throw is a failed row and the sweep continues", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-bulk-tolerant-"));
    try {
      const okUrl = "https://example.com/org/ok";
      const badUrl = "https://example.com/org/bad";
      const okSha = "4444444444444444444444444444444444444444";
      const badSha = "5555555555555555555555555555555555555555";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "gp", "1.0.0");

      await seedMarketplace({
        cwd,
        entries: [
          { name: "ok", source: { source: "url", url: okUrl, sha: okSha } },
          { name: "bad", source: { source: "url", url: badUrl, sha: badSha } },
        ],
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, pi, notifications } = makeCtx();

      // A seam whose clone throws for the `bad` clone url (network unreachable),
      // succeeds for `ok`. The sweep must NOT abort on the `bad` throw.
      const counts = { clone: 0, mirror: 0, pin: 0 };
      const seam: FetchCloneCacheSeam = {
        resolvePluginPin: (args) => {
          counts.pin += 1;
          return resolvePluginPin({ ...args, gitOps });
        },
        materializePluginClone: (args) => {
          counts.clone += 1;
          if (args.cloneUrl === badUrl) {
            const err = new Error("mock: host unreachable") as NodeJS.ErrnoException;
            err.code = "ENETUNREACH";
            throw err;
          }

          return materializePluginClone({ ...args, gitOps });
        },
        materializeOrRefreshPluginMirror: (args) => {
          counts.mirror += 1;
          return materializeOrRefreshPluginMirror({ ...args, gitOps });
        },
      };

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      assert.equal(
        counts.clone,
        2,
        "the sweep attempts BOTH plugins (the bad throw did not abort it)",
      );

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /ok/, "the successful plugin renders a row");
      assert.match(body, /bad/, "the failed plugin renders a row");
      assert.match(body, /\(failed\)/, "the thrown per-plugin fetch is captured as a failed row");
      // The ok plugin's clone is the valid fixture tree -> `(available)`.
      assert.match(body, /\(available\)/, "the ok plugin renders its fresh (available) row");
      // Bulk form carries a trailing tally / summary line.
      assert.match(body, /Plugin fetch:/, "the bulk form renders the operation summary line");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-06 bulk sweep of two plugins on the same private host triggers the device flow at most once (authMemo spans the sweep)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-auth-once-"));
    try {
      // Two plugins on the SAME github host, both private (no stored cred ->
      // device flow). A single authMemo must cap the device flow at once.
      const shaA = "6666666666666666666666666666666666666666";
      const shaB = "7777777777777777777777777777777777777777";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "gp", "1.0.0");

      await seedMarketplace({
        cwd,
        entries: [
          { name: "a", source: { source: "github", repo: "acme/a", sha: shaA } },
          { name: "b", source: { source: "github", repo: "acme/b", sha: shaB } },
        ],
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      const cred = makeMockCredentialOps();
      const device = makeMockDeviceFlowHttp({
        pollQueue: [
          { kind: "success", accessToken: "gho_MOCK", tokenType: "bearer", scope: "repo" },
        ],
      });

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        cloneCacheSeam: spy.seam,
        credentialOps: cred.credOps,
        deviceFlowHttp: device.http,
      });

      assert.ok(
        device.state.requestCodeCalls.length <= 1,
        `device flow requestCode fired at most once across the sweep, got ${device.state.requestCodeCalls.length.toString()}`,
      );

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /a/, "plugin a renders a row");
      assert.match(body, /b/, "plugin b renders a row");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-07 bulk fetch with ONE corrupt marketplace.json degrades to an mp-level (failed) block and the healthy marketplace still fetches", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-corrupt-mp-"));
    try {
      const cloneUrl = "https://example.com/org/ok";
      const sha = "8888888888888888888888888888888888888888";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "okp", "1.0.0");

      // Two project-scope marketplaces: `good` carries a cold pinned git
      // plugin; `bad`'s marketplace.json is corrupt JSON.
      const goodRoot = path.join(cwd, "good-src");
      await mkdir(path.join(goodRoot, ".claude-plugin"), { recursive: true });
      const goodManifest = path.join(goodRoot, ".claude-plugin", "marketplace.json");
      await writeFile(
        goodManifest,
        JSON.stringify({
          name: "good",
          plugins: [{ name: "okp", source: { source: "url", url: cloneUrl, sha } }],
        }),
      );

      const badRoot = path.join(cwd, "bad-src");
      await mkdir(path.join(badRoot, ".claude-plugin"), { recursive: true });
      const badManifest = path.join(badRoot, ".claude-plugin", "marketplace.json");
      await writeFile(badManifest, "{ this is not json");

      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          good: {
            name: "good",
            scope: "project",
            source: pathSource("./good-src"),
            addedFromCwd: cwd,
            manifestPath: goodManifest,
            marketplaceRoot: goodRoot,
            plugins: {},
          },
          bad: {
            name: "bad",
            scope: "project",
            source: pathSource("./bad-src"),
            addedFromCwd: cwd,
            manifestPath: badManifest,
            marketplaceRoot: badRoot,
            plugins: {},
          },
        },
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "all" },
        cloneCacheSeam: spy.seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      assert.equal(
        spy.counts.clone,
        1,
        "the healthy marketplace's plugin still fetches (the corrupt manifest did not abort the sweep)",
      );

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /○ okp \(available\)/, "the healthy plugin renders its fresh row");
      // Corrupt JSON -> InvalidMarketplaceManifestError(SyntaxError cause) ->
      // narrowProbeError -> the closed-set `unparseable` reason on the
      // mp-level (failed) block.
      assert.match(
        body,
        /⊘ bad \[project\] \(failed\) \{unparseable\}/,
        "the corrupt marketplace renders an mp-level (failed) block with its narrowed reason",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-06 an HttpError 401 and a UserCanceledError both render (failed) {authentication required} at error severity, never {source missing}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-auth-narrow-"));
    try {
      const deniedUrl = "https://example.com/org/denied";
      const canceledUrl = "https://example.com/org/canceled";
      const shaA = "9999999999999999999999999999999999999999";
      const shaB = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      await seedMarketplace({
        cwd,
        entries: [
          { name: "denied", source: { source: "url", url: deniedUrl, sha: shaA } },
          { name: "canceled", source: { source: "url", url: canceledUrl, sha: shaB } },
        ],
      });

      const { gitOps } = makeMockGitOps();
      // The clone seam throws the isomorphic-git error shapes: a 401 HttpError
      // for `denied` and a UserCanceledError (onAuth returned { cancel: true })
      // for `canceled`.
      const seam: FetchCloneCacheSeam = {
        resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
        materializePluginClone: (args) => {
          if (args.cloneUrl === deniedUrl) {
            throw Object.assign(new Error("HTTP Error: 401 Unauthorized"), {
              code: "HttpError",
              data: { statusCode: 401 },
            });
          }

          throw Object.assign(new Error("The operation was canceled."), {
            code: "UserCanceledError",
          });
        },
        materializeOrRefreshPluginMirror: (args) =>
          materializeOrRefreshPluginMirror({ ...args, gitOps }),
      };

      const { ctx, pi, notifications } = makeCtx();
      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊘ denied \(failed\) \{authentication required\}/,
        "a 401 HttpError narrows to the auth reason",
      );
      assert.match(
        body,
        /⊘ canceled \(failed\) \{authentication required\}/,
        "a UserCanceledError (device flow terminated) narrows to the auth reason",
      );
      assert.doesNotMatch(body, /\{source missing\}/, "neither throw misclassifies");
      // GATE-01: a fetch that threw did not warm the cache -> the failed rows
      // stamp error and the cascade envelope MAX-reduces to error severity.
      assert.equal(
        notifications.some((n) => n.severity === "error"),
        true,
        "the failed rows raise the notification to error severity",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-01 a fetched plugin with an unsupported component renders (partially-available) with its exact dropped-kind reason", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-partial-reason-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const sha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "unsup", "1.0.0");

      // The manifest entry declares lspServers -> the resolver drops the
      // unsupported kind and lands on the partially-available arm.
      await seedMarketplace({
        cwd,
        entries: [
          {
            name: "unsup",
            source: { source: "url", url: cloneUrl, sha },
            lspServers: { ls: {} },
          },
        ],
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "unsup", marketplace: "mp" },
        cloneCacheSeam: spy.seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊖ unsup \(partially-available\) \{lsp\}/,
        "the dropped lspServers kind renders the exact closed-set `lsp` reason",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-01 a fetched git-subdir whose declared subdir is absent renders (unavailable) with its exact structural reason", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-unavailable-reason-"));
    try {
      const cloneUrl = "https://example.com/org/monorepo";
      const sha = "cccccccccccccccccccccccccccccccccccccccc";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      // The fixture repo has NO plugins/missing subdir -> the presence probe's
      // missing-subdir arm folds to the resolver's structural unavailable.
      await writeFixtureRepo(fixtureRepoDir, "subp", "1.0.0");

      await seedMarketplace({
        cwd,
        entries: [
          {
            name: "subp",
            source: { source: "git-subdir", url: cloneUrl, path: "plugins/missing", sha },
          },
        ],
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "subp", marketplace: "mp" },
        cloneCacheSeam: spy.seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊘ subp \(unavailable\) \{unsupported source\}/,
        "the missing-subdir structural note narrows to the exact closed-set reason",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("RSTA-01 a materialize that reports success while the cache stays cold renders the bare (remote) row with its manifest version", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-remote-row-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const sha = "dddddddddddddddddddddddddddddddddddddddd";

      await seedMarketplace({
        cwd,
        entries: [
          {
            name: "gp",
            source: { source: "url", url: cloneUrl, sha },
            version: "3.2.1",
            description: "A remote plugin.",
          },
        ],
      });

      // A seam that resolves WITHOUT writing anything into the cache (e.g. a
      // concurrent GC swept the clone between the seam return and the probe):
      // the post-fetch derived row must fall back to `(remote)` -- still
      // unmaterialized -- rather than over-claiming `(available)`.
      const seam: FetchCloneCacheSeam = {
        resolvePluginPin: () => Promise.resolve({ cloneUrl, pin: sha }),
        materializePluginClone: () => Promise.resolve(path.join(cwd, "never-written")),
        materializeOrRefreshPluginMirror: () =>
          Promise.resolve({ pluginRoot: path.join(cwd, "never-written"), resolvedSha: sha }),
      };

      const { ctx, pi, notifications } = makeCtx();
      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      const body = notifications.map((n) => n.message).join("\n");
      // D-80-03: the remote row is BARE -- no reasons brace -- and carries the
      // manifest version.
      assert.match(body, /◌ gp v3\.2\.1 \(remote\)/, "renders the bare (remote) row with version");
      assert.doesNotMatch(body, /\(available\)/, "a cold tree is never over-claimed available");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-01 a corrupt warm mirror (unreadable HEAD ref) renders (unavailable) {source missing} via the probe-error narrowing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-corrupt-mirror-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "gp", "1.0.0");

      await seedMarketplace({
        cwd,
        // Unpinned: routes through the mirror seam and the mirror-presence probe.
        entries: [{ name: "gp", source: { source: "url", url: cloneUrl } }],
      });

      // A warm mirror whose .git/HEAD is a symbolic ref with NO loose ref file
      // and NO packed-refs: the fs-only HEAD read throws, so the post-fetch
      // probe folds to `unavailable` and the reasoned re-resolve narrows the
      // SAME throw to its closed-set probe-error class.
      const locations = locationsFor("project", cwd);
      const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      await mkdir(path.dirname(mirrorDir), { recursive: true });
      await cp(fixtureRepoDir, mirrorDir, { recursive: true });
      await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
      await writeFile(path.join(mirrorDir, ".git", "HEAD"), "ref: refs/heads/main\n");

      // The refresh seam reports success but leaves the corrupt mirror as-is.
      const seam: FetchCloneCacheSeam = {
        resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps: makeMockGitOps().gitOps }),
        materializePluginClone: () => Promise.resolve(mirrorDir),
        materializeOrRefreshPluginMirror: () =>
          Promise.resolve({
            pluginRoot: mirrorDir,
            resolvedSha: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          }),
      };

      const { ctx, pi, notifications } = makeCtx();
      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊘ gp \(unavailable\) \{source missing\}/,
        "the probe throw narrows to the closed-set source-missing reason",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-07 non-transport materialize throws narrow to fs/permission reasons: EACCES -> {permission denied}; plain and non-Error throws -> {source missing}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-fs-narrow-"));
    try {
      const shaA = "1111111111111111111111111111111111111110";
      const shaB = "2222222222222222222222222222222222222220";
      const shaC = "3333333333333333333333333333333333333330";

      await seedMarketplace({
        cwd,
        entries: [
          { name: "eacces", source: { source: "url", url: "https://example.com/o/a", sha: shaA } },
          { name: "plain", source: { source: "url", url: "https://example.com/o/b", sha: shaB } },
          {
            name: "weird",
            source: { source: "url", url: "https://example.com/o/c", sha: shaC },
            version: "9.9.9",
          },
        ],
      });

      const seam: FetchCloneCacheSeam = {
        resolvePluginPin: (args) =>
          Promise.resolve({
            cloneUrl: args.source.kind === "github" ? "" : args.source.url,
            pin: "unused",
          }),
        materializePluginClone: (args) => {
          if (args.cloneUrl.endsWith("/a")) {
            const err = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
            err.code = "EACCES";
            throw err;
          }

          if (args.cloneUrl.endsWith("/b")) {
            throw new Error("clone corrupted");
          }

          // Non-Error throw: failedRow synthesizes the cause Error and the
          // narrowing falls through to the fail-clean source-missing default.
          throw "disk exploded"; // eslint-disable-line @typescript-eslint/only-throw-error
        },
        materializeOrRefreshPluginMirror: () =>
          Promise.resolve({ pluginRoot: "/unused", resolvedSha: shaA }),
      };

      const { ctx, pi, notifications } = makeCtx();
      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊘ eacces \(failed\) \{permission denied\}/,
        "an EACCES materialize throw narrows to permission denied",
      );
      assert.match(
        body,
        /⊘ plain \(failed\) \{source missing\}/,
        "an unrecognized Error folds to the fail-clean source-missing default",
      );
      assert.match(
        body,
        /⊘ weird v9\.9\.9 \(failed\) \{source missing\}/,
        "a non-Error throw folds to source missing and keeps the manifest version on the row",
      );
      assert.equal(
        notifications.some((n) => n.severity === "error"),
        true,
        "failed rows stamp error severity",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-06 unpinned github source with a ref threads BOTH the ref hint and the host-keyed auth bundle into the mirror seam", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-unpinned-ref-auth-"));
    try {
      const cloneUrl = "https://github.com/acme/priv";
      const headSha = "4444444444444444444444444444444444444440";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "gp", "1.0.0");

      await seedMarketplace({
        cwd,
        // Unpinned github source with a ref: no sha -> the mirror arm; ref ->
        // the singleBranch fetch hint; github.com -> a registered provider.
        entries: [{ name: "gp", source: { source: "github", repo: "acme/priv", ref: "main" } }],
      });

      // Pre-warm the mirror so the post-refresh probe reads a valid HEAD.
      const locations = locationsFor("project", cwd);
      const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      await mkdir(path.dirname(mirrorDir), { recursive: true });
      await cp(fixtureRepoDir, mirrorDir, { recursive: true });
      await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
      await writeFile(path.join(mirrorDir, ".git", "HEAD"), `${headSha}\n`);

      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: headSha,
        localRefs: { "refs/heads/main": headSha },
        remoteRefs: { "refs/remotes/origin/main": headSha },
      });
      const captured: { ref: string | undefined; authHost: string | undefined } = {
        ref: undefined,
        authHost: undefined,
      };
      const seam: FetchCloneCacheSeam = {
        resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
        materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
        materializeOrRefreshPluginMirror: (args) => {
          captured.ref = args.ref;
          captured.authHost = args.auth?.host;
          return materializeOrRefreshPluginMirror({ ...args, gitOps });
        },
      };

      const { ctx, pi, notifications } = makeCtx();
      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps: makeMockCredentialOps().credOps,
        deviceFlowHttp: makeMockDeviceFlowHttp().http,
      });

      assert.equal(captured.ref, "main", "the mirror refresh received the ref hint");
      assert.equal(
        captured.authHost,
        "github.com",
        "the provider host's auth bundle threaded into the mirror seam",
      );

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /\(available\)/, "the refreshed mirror renders the fresh row");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-01 pinned source with a ref forwards the resolved ref hint into the clone seam", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-pinned-ref-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const sha = "5555555555555555555555555555555555555550";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "gp", "1.0.0");

      await seedMarketplace({
        cwd,
        // Pinned sha PLUS a ref: resolvePluginPin returns the ref so the clone
        // uses it as the singleBranch fetch hint.
        entries: [{ name: "gp", source: { source: "url", url: cloneUrl, sha, ref: "v2" } }],
      });

      const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const captured: { ref: string | undefined } = { ref: undefined };
      const seam: FetchCloneCacheSeam = {
        resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
        materializePluginClone: (args) => {
          captured.ref = args.ref;
          return materializePluginClone({ ...args, gitOps });
        },
        materializeOrRefreshPluginMirror: (args) =>
          materializeOrRefreshPluginMirror({ ...args, gitOps }),
      };

      const { ctx, pi, notifications } = makeCtx();
      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      assert.equal(captured.ref, "v2", "the pinned clone received the ref hint");
      assert.equal(
        gitState.cloneCalls[0]?.singleBranch,
        true,
        "the ref hint drives a singleBranch clone",
      );

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /\(available\)/, "the pinned clone renders the fresh row");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-01 a github-source plugin with an unsupported component renders (partially-available) {lsp} (reasoned re-resolve on the github kind)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-github-partial-"));
    try {
      const sha = "6666666666666666666666666666666666666660";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeFixtureRepo(fixtureRepoDir, "lspy", "1.0.0");

      await seedMarketplace({
        cwd,
        entries: [
          {
            name: "lspy",
            source: { source: "github", repo: "acme/lspy", sha },
            lspServers: { ls: {} },
          },
        ],
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      await fetchPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "lspy", marketplace: "mp" },
        cloneCacheSeam: spy.seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊖ lspy \(partially-available\) \{lsp\}/,
        "the github-kind reasoned row carries the exact dropped-kind reason",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FTCH-07 bare fetch with scope omitted enumerates BOTH scopes and orders same-name blocks project-first", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fetch-dual-scope-"));
    try {
      // Project-scope marketplace `mp` with a path plugin.
      const { marketplaceRoot } = await seedMarketplace({
        cwd,
        entries: [{ name: "pp-project", source: "./pp-project" }],
      });
      await writeFixtureRepo(path.join(marketplaceRoot, "pp-project"), "pp-project", "1.0.0");

      // User-scope marketplace ALSO named `mp` (the same-name tie-break is the
      // project-first ordering under test).
      const userSrcRoot = path.join(cwd, "user-mp-src");
      await mkdir(path.join(userSrcRoot, ".claude-plugin"), { recursive: true });
      const userManifestPath = path.join(userSrcRoot, ".claude-plugin", "marketplace.json");
      await writeFile(
        userManifestPath,
        JSON.stringify({ name: "mp", plugins: [{ name: "pp-user", source: "./pp-user" }] }),
      );
      await writeFixtureRepo(path.join(userSrcRoot, "pp-user"), "pp-user", "1.0.0");

      const userLocations = locationsFor("user", cwd);
      await mkdir(userLocations.extensionRoot, { recursive: true });
      await saveState(userLocations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "user",
            source: pathSource(userSrcRoot),
            addedFromCwd: cwd,
            manifestPath: userManifestPath,
            marketplaceRoot: userSrcRoot,
            plugins: {},
          },
        },
      });

      const { gitOps } = makeMockGitOps();
      const spy = seamSpy(gitOps);
      const { ctx, pi, notifications } = makeCtx();

      // `scope` omitted: the enumeration spans project + user.
      await fetchPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "all" },
        cloneCacheSeam: spy.seam,
        credentialOps: makeMockCredentialOps().credOps,
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /pp-project/, "the project-scope marketplace's plugin renders");
      assert.match(body, /pp-user/, "the user-scope marketplace's plugin renders");

      const projectIdx = body.indexOf("mp [project]");
      const userIdx = body.indexOf("mp [user]");
      assert.ok(projectIdx !== -1, "the project-scope block renders its header");
      assert.ok(userIdx !== -1, "the user-scope block renders its header");
      assert.ok(projectIdx < userIdx, "same-name blocks order project-first");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
