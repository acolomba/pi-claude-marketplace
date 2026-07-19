import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import {
  installPlugin,
  type InstallCloneCacheSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../../helpers/device-flow-mock.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { GitAuthBundle } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const GIT_SOURCE_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}

async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "install-auth-home-"));
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

/** Real seam over a mock gitOps -- the production `buildAuthForHost` runs inside install. */
function seamWith(gitOps: GitOps): InstallCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
  };
}

/**
 * Wrap a seam so the `auth` bundle passed into `materializePluginClone` is
 * recorded. This is the assertion surface for "install threaded the bundle".
 */
function capturingSeam(inner: InstallCloneCacheSeam): {
  seam: InstallCloneCacheSeam;
  captured: { auth: GitAuthBundle | undefined; count: number };
} {
  const captured: { auth: GitAuthBundle | undefined; count: number } = {
    auth: undefined,
    count: 0,
  };
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin: inner.resolvePluginPin,
    materializePluginClone: (args) => {
      captured.auth = args.auth;
      captured.count += 1;
      return inner.materializePluginClone(args);
    },
    materializeOrRefreshPluginMirror: inner.materializeOrRefreshPluginMirror,
  };
  return { seam, captured };
}

async function seedGitSourceMarketplace(opts: {
  cwd: string;
  marketplaceRoot: string;
  marketplaceName: string;
  pluginName: string;
  source: Record<string, unknown>;
  fixtureRepoDir: string;
}): Promise<void> {
  await mkdir(path.join(opts.fixtureRepoDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(opts.fixtureRepoDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: opts.pluginName, version: "9.9.9" }),
  );
  const skillDir = path.join(opts.fixtureRepoDir, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHello.\n`);

  await mkdir(path.join(opts.marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(opts.marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: opts.marketplaceName,
      plugins: [{ name: opts.pluginName, source: opts.source }],
    }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      [opts.marketplaceName]: {
        name: opts.marketplaceName,
        scope: "project",
        source: pathSource(`./${path.basename(opts.marketplaceRoot)}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot: opts.marketplaceRoot,
        plugins: {},
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

void test("PROV-03 / D-79-01: a git-source install on a provider host (github.com) threads a host-keyed auth bundle to materializePluginClone", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-auth-prov03-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "gh",
        source: { source: "github", repo: "org/repo", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { seam, captured } = capturingSeam(seamWith(gitOps));
      // Credential miss so a real clone WOULD trigger Device Flow -- the mock
      // gitOps never invokes onAuthRequired, but the bundle must still be built
      // and threaded because the host has a registered provider.
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { http: deviceFlowHttp } = makeMockDeviceFlowHttp();
      const { ctx, pi } = makeCtx();

      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gh",
        cloneCacheSeam: seam,
        credentialOps,
        deviceFlowHttp,
      });

      assert.equal(captured.count, 1, "the clone probe ran once");
      assert.ok(captured.auth !== undefined, "a provider host builds an auth bundle");
      assert.equal(captured.auth.host, "github.com", "the bundle is keyed on the provider host");
      assert.equal(
        typeof captured.auth.onAuthRequired,
        "function",
        "the bundle carries the provider Device Flow trigger",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

void test("PROV-02: a git-source install on a no-provider host threads NO auth bundle and clones authless", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-auth-prov02-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "pub",
        source: { source: "url", url: "https://gitlab.example.com/o/r", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });

      const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { seam, captured } = capturingSeam(seamWith(gitOps));
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { ctx, pi } = makeCtx();

      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "pub",
        cloneCacheSeam: seam,
        credentialOps,
      });

      assert.equal(captured.count, 1, "the clone probe ran once");
      assert.equal(
        captured.auth,
        undefined,
        "no provider claims the host -> no auth bundle (PROV-02, no cross-host leak)",
      );
      assert.equal(gitState.cloneCalls.length, 1, "the public clone still ran");
      assert.equal(gitState.cloneCalls[0]?.auth, undefined, "the clone carried no auth");

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.ok(
        after.marketplaces["mp"]?.plugins["pub"] !== undefined,
        "the public git-source install succeeded",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

void test("D-79-02: two installs sharing one authMemo on the same provider host run the Device Flow exactly once", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-auth-memo-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      // Two plugins on the SAME provider host (github.com), different repos so
      // each install materializes its own clone.
      await mkdir(path.join(fixtureRepoDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(fixtureRepoDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "unused", version: "9.9.9" }),
      );
      const marketplaceRoot = path.join(cwd, "mp-src");
      await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
      const skillDir = path.join(fixtureRepoDir, "skills", "greet");
      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHi.\n`);
      const OTHER_SHA = "b2c3d4e5f60718293a4b5c6d7e8f901234567890";
      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [
            { name: "gh1", source: { source: "github", repo: "org/one", sha: GIT_SOURCE_SHA } },
            { name: "gh2", source: { source: "github", repo: "org/two", sha: OTHER_SHA } },
          ],
        }),
      );
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await saveState(locations.extensionRoot, {
        schemaVersion: 2,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./mp-src"),
            addedFromCwd: cwd,
            manifestPath,
            marketplaceRoot,
            plugins: {},
          },
        },
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { seam, captured } = capturingSeam(seamWith(gitOps));
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { http: deviceFlowHttp, state: dfState } = makeMockDeviceFlowHttp({
        pollQueue: [
          { kind: "success", accessToken: "tok-abc", tokenType: "bearer", scope: "repo" },
        ],
      });
      const authMemo = new Map();
      const { ctx, pi } = makeCtx();

      const common = {
        ctx,
        pi,
        scope: "project" as const,
        cwd,
        marketplace: "mp",
        cloneCacheSeam: seam,
        credentialOps,
        deviceFlowHttp,
        authMemo,
      };
      await installPlugin({ ...common, plugin: "gh1" });
      const firstBundle = captured.auth;
      await installPlugin({ ...common, plugin: "gh2" });
      const secondBundle = captured.auth;

      assert.ok(
        firstBundle !== undefined && secondBundle !== undefined,
        "both installs built bundles",
      );
      // The mock gitOps never invokes onAuthRequired, so drive the memo directly:
      // simulate two 401 challenges (one per bulk item) against the shared memo.
      await firstBundle.onAuthRequired();
      await secondBundle.onAuthRequired();

      assert.equal(
        dfState.requestCodeCalls.length,
        1,
        "the Device Flow ran AT MOST ONCE across the two items (D-79-02 once-per-host memo)",
      );
      assert.equal(
        authMemo.get("github.com") !== undefined,
        true,
        "the memo recorded the host result",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

void test("PROV-04: a git-source install on a no-provider host whose clone 401s renders bare (failed) {authentication required} with NO cause line", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-auth-prov04-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "priv",
        source: { source: "url", url: "https://gitlab.example.com/o/private", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });

      // Duck-typed isomorphic-git HttpError: code === "HttpError", data.statusCode.
      const httpErr = Object.assign(new Error("HTTP 401 from clone"), {
        code: "HttpError",
        data: { statusCode: 401 },
      });
      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        cloneThrows: httpErr,
      });
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { ctx, pi, notifications } = makeCtx();

      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "priv",
        cloneCacheSeam: seamWith(gitOps),
        credentialOps,
      });

      const note = notifications.find((n) => n.severity === "error");
      assert.ok(note, "a 401 clone challenge must render an error");
      assert.ok(
        note.message.includes("(failed) {authentication required}"),
        `expected the bare authentication-required row, got: ${note.message}`,
      );
      // Amended D-79-03: NO no-provider cause line on the install subject row.
      assert.equal(
        note.message.includes("no auth provider is registered for"),
        false,
        "the plugin install row shows no cause line (amended D-79-03)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

void test("NFR-3: a git-source install whose clone throws a NETWORK errno renders the bare (failed) row with a cause line, NOT {authentication required}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-net-fail-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "netless",
        source: { source: "url", url: "https://gitlab.example.com/o/r", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });

      // A network-class transport failure stays OUTSIDE install's auth-only
      // narrowing: the row is the bare `(failed)` (no reasons brace) and the
      // raw error text rides the cause-chain trailer.
      const netErr = new Error("connect ENETUNREACH 10.0.0.1:443") as NodeJS.ErrnoException;
      netErr.code = "ENETUNREACH";
      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        cloneThrows: netErr,
      });
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { ctx, pi, notifications } = makeCtx();

      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "netless",
        cloneCacheSeam: seamWith(gitOps),
        credentialOps,
      });

      const note = notifications.find((n) => n.severity === "error");
      assert.ok(note, "a network-failed clone must render an error");
      assert.match(note.message, /netless \(failed\)/, "the bare failed row names the plugin");
      assert.equal(
        note.message.includes("{authentication required}"),
        false,
        "a network errno is NOT narrowed to the auth reason by install",
      );
      assert.ok(
        note.message.includes("ENETUNREACH"),
        "the raw network error text rides the cause-chain trailer",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

void test("NFR-3: a git-source install whose clone seam throws a NON-Error value renders the bare (failed) row without a synthesized cause", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-nonerror-fail-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "oddball",
        source: { source: "url", url: "https://gitlab.example.com/o/r", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const inner = seamWith(gitOps);
      const seam: InstallCloneCacheSeam = {
        resolvePluginPin: inner.resolvePluginPin,
        materializePluginClone: () => {
          // A non-Error throw (bad citizen dependency): install must still
          // fail clean with the bare row -- no crash, no fabricated reason.
          throw "disk exploded"; // eslint-disable-line @typescript-eslint/only-throw-error
        },
        materializeOrRefreshPluginMirror: inner.materializeOrRefreshPluginMirror,
      };
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { ctx, pi, notifications } = makeCtx();

      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "oddball",
        cloneCacheSeam: seam,
        credentialOps,
      });

      const note = notifications.find((n) => n.severity === "error");
      assert.ok(note, "a non-Error throw must still render an error row");
      assert.match(note.message, /oddball \(failed\)/, "the bare failed row names the plugin");
      assert.equal(
        note.message.includes("{authentication required}"),
        false,
        "a non-Error throw is never narrowed to the auth reason",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

void test("device-flow auth failure: a clone throw shaped UserCanceledError renders (failed) {authentication required}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-auth-usercanceled-"));
    try {
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSourceMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "priv",
        source: { source: "github", repo: "org/private", sha: GIT_SOURCE_SHA },
        fixtureRepoDir,
      });

      // An unsuccessful device-flow auth (denied / expired / poll network
      // error) makes platform/git.ts's onAuth return `{ cancel: true }`, which
      // isomorphic-git throws as `UserCanceledError` -- NOT HttpError 401/403.
      const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        cloneThrows: authError,
      });
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { http: deviceFlowHttp } = makeMockDeviceFlowHttp();
      const { ctx, pi, notifications } = makeCtx();

      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "priv",
        cloneCacheSeam: seamWith(gitOps),
        credentialOps,
        deviceFlowHttp,
      });

      const note = notifications.find((n) => n.severity === "error");
      assert.ok(note, "an unsuccessful device-flow auth must render an error");
      assert.ok(
        note.message.includes("(failed) {authentication required}"),
        `expected the authentication-required row, got: ${note.message}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
