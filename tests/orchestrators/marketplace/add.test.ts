import assert from "node:assert/strict";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { addMarketplace } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { buildAuthCallbacks } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import {
  resetCompletionCache,
  getMarketplaceNames,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  MarketplaceDuplicateNameError,
  UnsupportedSourceError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";

import type {
  DeviceCodeResponse,
  PollResult,
} from "../../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { GitCredentials } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function fixtureMarketplaceDir(
  name: "valid-marketplace" | "invalid-manifest" | "empty-marketplace",
): string {
  return path.join(path.dirname(new URL(import.meta.url).pathname), "_fixtures", name);
}

interface CredentialAdapterOptions {
  readonly store?: ReadonlyMap<string, GitCredentials>;
}

function makeMockCredentialOps(initial: CredentialAdapterOptions = {}) {
  const credentials = createCredentialOpsFake({
    boundary: "memory",
    credentials: [...(initial.store ?? new Map<string, GitCredentials>()).entries()],
  });

  return {
    credOps: credentials.credentialOps,
    state: {
      get fillCalls() {
        return credentials.calls.fill;
      },
      get approveCalls() {
        return credentials.calls.approve.map(({ host, credential: cred }) => ({ host, cred }));
      },
    },
  };
}

interface DeviceFlowAdapterOptions {
  readonly deviceCode?: DeviceCodeResponse;
  readonly pollQueue?: readonly PollResult[];
}

function makeMockDeviceFlowHttp(initial: DeviceFlowAdapterOptions = {}) {
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: initial.deviceCode ?? {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    ...(initial.pollQueue === undefined ? {} : { pollResponses: initial.pollQueue }),
  });

  return {
    http: deviceFlow.http,
    state: {
      get requestCodeCalls() {
        return deviceFlow.calls.requestCode;
      },
    },
  };
}

interface GitOpsAdapterOptions {
  readonly fixtureSourceDir?: string;
  readonly cloneThrows?: unknown;
  readonly onClone?: (directory: string) => Promise<void>;
}

const ALLOWED_MARKETPLACE_REMOTES = [
  "https://github.com/anthropics/claude-plugins-official.git",
  "https://github.com/owner/repo.git",
  "https://gitlab.example.com/team/mp.git",
  "https://gitlab.example.com/team/private-mp.git",
  "https://gitlab.example.com/team/missing-mp.git",
  "https://gitlab.example.com/team/flaky-mp.git",
  "https://gitlab.example.com/team/gone-mp.git",
  "https://GitHub.com/acme/mp.git",
  "https://gitlab.com/team/mp.git",
] as const;

function makeMockGitOps(initial: GitOpsAdapterOptions = {}) {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: ALLOWED_MARKETPLACE_REMOTES,
    ...(initial.fixtureSourceDir === undefined
      ? {}
      : {
          cloneFixture: {
            boundary: "local" as const,
            sourceDir: initial.fixtureSourceDir,
          },
        }),
  });
  const gitOps: GitOps = {
    ...git.gitOps,
    async clone(options) {
      const { auth, ...authlessOptions } = options;
      await git.gitOps.clone(authlessOptions);
      await initial.onClone?.(options.dir);
      if (Object.hasOwn(initial, "cloneThrows")) {
        throw initial.cloneThrows;
      }

      if (auth !== undefined) {
        Object.assign(git.state.calls.clone.at(-1) ?? {}, { auth });
      }
    },
  };

  return {
    gitOps,
    state: {
      get cloneCalls() {
        return git.state.calls.clone;
      },
      get fetchCalls() {
        return git.state.calls.fetch;
      },
      get forceUpdateRefCalls() {
        return git.state.calls.forceUpdateRef;
      },
      get checkoutCalls() {
        return git.state.calls.checkout;
      },
      get resolveRefCalls() {
        return git.state.calls.resolveRef;
      },
    },
  };
}

interface NotifyRecord {
  message: string;
  severity?: string;
}

type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

function makeCtx(expectedNotifications = 1): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  let notificationCalls = 0;
  if (expectedNotifications > 0) {
    when(() => ctx.ui)
      .thenReturn(ui)
      .times(expectedNotifications);
    when(() => pi.getAllTools())
      .thenReturn([])
      .times(expectedNotifications === 2 ? 2 : expectedNotifications * 2);
    when(() => ui.notify)
      .thenReturn((message, severity) => {
        notifications.push(severity === undefined ? { message } : { message, severity });
        notificationCalls += 1;
        if (notificationCalls === expectedNotifications) {
          verify(ctx);
          verify(pi);
          verify(ui);
        }
      })
      .times(expectedNotifications);
  } else {
    verify(ctx);
    verify(pi);
    verify(ui);
  }

  return { ctx, pi, notifications };
}

function httpError(statusCode: number): Error {
  return Object.assign(new Error(`HTTP Error: ${statusCode}`), {
    code: "HttpError",
    data: { statusCode },
  });
}

async function withTmpScope<T>(
  fn: (env: { cwd: string; locations: ScopedLocations }) => Promise<T>,
): Promise<T> {
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-add-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  try {
    return await fn({ cwd, locations });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test("MA-5: github source clones, validates, renames, mutates state, emits V2 success message with NO reload-hint trailer (SNM-33 / D-22-01)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // gitOps.clone called exactly once with correct URL.
    // assert
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    assert.equal(cloneCall.url, "https://github.com/anthropics/claude-plugins-official.git");

    // State has the recorded marketplace under the manifest's `name` field
    // (the fixture's `name` is "valid-marketplace").
    const persisted = await loadState(locations.extensionRoot);
    assert.ok("valid-marketplace" in persisted.marketplaces);
    const recorded = persisted.marketplaces["valid-marketplace"];
    assert.ok(recorded);
    assert.equal(recorded.scope, "project");

    // Exactly one notification, byte-for-byte; default severity (info; no
    // 2nd arg per D-16-11).
    assert.equal(notifications.length, 1);
    const note = notifications[0];
    assert.ok(note);
    // SNM-33 / D-22-01: the catalog collapses github + path source onto one
    // `(added)` shape. A marketplace record is not a Pi-visible resource, so
    // NO `/reload` trailer.
    assert.equal(note.message, "● valid-marketplace [project] (added)");
    assert.equal(note.severity, undefined);
    // SNM-33 / D-22-01: empty-plugins add never triggers the reload-hint.
    assert.equal(note.message.includes("/reload to pick up changes"), false);
  });
});

test("MA-5: github HTTPS source with #ref clones the canonical repo URL at that ref", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://github.com/anthropics/claude-plugins-official#main",
      gitOps,
    });

    // assert
    assert.equal(state.cloneCalls.length, 1);
    assert.deepEqual(
      {
        url: state.cloneCalls[0]?.url,
        ref: state.cloneCalls[0]?.ref,
        singleBranch: state.cloneCalls[0]?.singleBranch,
      },
      {
        url: "https://github.com/anthropics/claude-plugins-official.git",
        ref: "main",
        singleBranch: true,
      },
    );
  });
});

test("MA-6 / ATTR-07: pre-existing non-empty sources/<name>/ renders (failed) {stale clone} on the marketplace subject", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    // Pre-create the final dir with a marker file so pathExists returns true.
    const finalDir = await locations.sourceCloneDir("valid-marketplace");
    await mkdir(finalDir, { recursive: true });
    await writeFile(path.join(finalDir, ".stale"), "x");

    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // ATTR-07: no raw throw -- the precondition routes through notify.
    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    const note = notifications[0];
    // assert
    assert.ok(note);
    // Post-manifest failure: subject is the derived marketplace name (A2).
    // notify() prepends the UXG-07 summary line for error severity.
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {stale clone}",
    );
    assert.equal(note.severity, "error");
  });
});

test("MA-8 / ATTR-07: duplicate name in same scope renders (failed) {duplicate name}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps: gitOps1 } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // First add succeeds.
    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps1,
    });

    const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
    const { gitOps: gitOps2 } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // ATTR-07: second add for same name routes through notify, no raw throw.
    await addMarketplace({
      ctx: ctx2,
      pi: pi2,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps2,
    });

    const note = n2[0];
    // assert
    assert.ok(note);
    // Post-manifest failure: subject is the derived marketplace name (A2).
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {duplicate name}",
    );
    assert.equal(note.severity, "error");
  });
});

test("MA-9 / ATTR-07: invalid manifest after clone renders (failed) {invalid manifest}; cleanupStaging still runs", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("invalid-manifest"),
    });

    // ATTR-07: no raw throw escapes -- the precondition routes through notify.
    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // (1) Routed through notify as a structured (failed) {invalid manifest} row.
    //     Pre-name failure (manifest unreadable, so no derived name) -> subject
    //     is the raw source string (A2).
    const note = notifications[0];
    // assert
    assert.ok(note, "addMarketplace should notify on invalid manifest");
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n" +
        "⊘ anthropics/claude-plugins-official [project] (failed) {invalid manifest}",
    );
    assert.equal(note.severity, "error");

    // (2) The clone DID happen (NFR-5 not violated for github source).
    assert.equal(state.cloneCalls.length, 1);

    // (3) State rollback: no marketplace recorded (guard rolled back).
    const persisted = await loadState(locations.extensionRoot);
    assert.equal(
      Object.keys(persisted.marketplaces).length,
      0,
      "state must NOT contain the partial marketplace",
    );

    // (4) cleanupStaging from addGithubInGuard's catch STILL ran
    //     before the failed row was emitted -- no staging-dir leak. If
    //     cleanupStaging succeeded, the parent sources-staging/ dir is gone or
    //     contains no leftover uuid subdirs.
    const sourcesStagingRoot = path.join(locations.extensionRoot, "sources-staging");
    const stagingExists = await pathExists(sourcesStagingRoot);
    if (stagingExists) {
      const remaining = await readdir(sourcesStagingRoot);
      assert.equal(
        remaining.length,
        0,
        `MA-9: cleanupStaging must run before the failed row -- no staging leak. ` +
          `Got remaining=${JSON.stringify(remaining)}`,
      );
    }
    // If sources-staging dir doesn't exist at all, cleanup succeeded fully (acceptable).
  });
});

test("classifies an invalid manifest through a staging-cleanup leak and preserves the leaked tree", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    let stagingRoot = "";
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("invalid-manifest"),
      onClone: async (directory) => {
        stagingRoot = path.dirname(directory);
        await chmod(stagingRoot, 0o555);
      },
    });

    // act
    try {
      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      });
    } finally {
      if (stagingRoot !== "") {
        await chmod(stagingRoot, 0o755);
      }
    }

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n" +
          "⊘ anthropics/claude-plugins-official [project] (failed) {invalid manifest}",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      state.cloneCalls.map(({ url }) => url),
      ["https://github.com/anthropics/claude-plugins-official.git"],
    );
    assert.deepStrictEqual(await readdir(stagingRoot), [
      state.cloneCalls[0]?.dir === undefined ? "" : path.basename(state.cloneCalls[0].dir),
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      marketplaces: {},
    });
  });
});

test("MA-10 / ATTR-07: unknown source kind renders (failed) {unsupported source}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps();

    // ATTR-07: no raw throw -- the unsupported-source precondition routes
    // through notify on the raw source subject (pre-clone, pre-name -> A2).
    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "git@github.com:foo/bar.git",
      gitOps,
    });

    const note = notifications[0];
    // assert
    assert.ok(note);
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n" +
        "⊘ git@github.com:foo/bar.git [project] (failed) {unsupported source}",
    );
    assert.equal(note.severity, "error");

    // NFR-5: unsupported source NEVER reached gitOps.clone.
    assert.equal(state.cloneCalls.length, 0);
  });
});

for (const source of [
  {
    kind: "git-subdir",
    raw: "https://github.com/owner/repo",
    url: "https://github.com/owner/repo",
    path: "plugins/example",
  },
  { kind: "npm", raw: "example-package", package: "example-package" },
] as const) {
  test(`rejects a marketplace-level ${source.kind} source without external calls`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, pi, notifications } = makeCtx(0);
      const { gitOps, state } = makeMockGitOps();
      const expectedError = new UnsupportedSourceError(
        `Cannot add marketplace from "[object Object]": unsupported source kind ${source.kind}`,
      );

      // act
      const outcome = await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        // @ts-expect-error Marketplace add defensively rejects object-only plugin source kinds at runtime.
        rawSource: source,
        gitOps,
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepStrictEqual(outcome, {
        status: "failed",
        reason: "unsupported source",
        error: expectedError,
        cause: expectedError.message,
      });
      assert.deepStrictEqual(notifications, []);
      assert.deepStrictEqual(state, {
        checkoutCalls: [],
        cloneCalls: [],
        fetchCalls: [],
        forceUpdateRefCalls: [],
        resolveRefCalls: [],
      });
      assert.deepStrictEqual(await loadState(locations.extensionRoot), {
        schemaVersion: 2,
        marketplaces: {},
      });
    });
  });
}

test("NFR-5: path-source add never calls gitOps", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    // Set up a local marketplace fixture by copying the valid-marketplace fixture
    // into a non-pi-claude-marketplace location and pointing rawSource at it.
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-local-"));
    try {
      const fixtureSrc = fixtureMarketplaceDir("valid-marketplace");
      await cp(fixtureSrc, localMpDir, { recursive: true });

      const { gitOps, state } = makeMockGitOps();

      // Use absolute path so domain/source.ts classifies as path source.
      // act
      await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: localMpDir, gitOps });

      // Zero gitOps calls (NFR-5).
      // assert
      assert.equal(state.cloneCalls.length, 0);
      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.forceUpdateRefCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
      assert.equal(state.resolveRefCalls.length, 0);

      // State updated; success notification emitted.
      const persisted = await loadState(locations.extensionRoot);
      assert.ok("valid-marketplace" in persisted.marketplaces);
      const note = notifications[0];
      assert.ok(note);
      // SNM-33 / D-22-01: a path-source add emits the same `(added)` shape
      // as github-source, with NO `/reload` trailer (a marketplace record is
      // not a Pi-visible resource). The `<autoupdate>` marker is irrelevant
      // here -- it does not appear on the (added) arm.
      assert.equal(note.message, "● valid-marketplace [project] (added)");
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("accepts a path marketplace through the offline default Git port", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const localMarketplace = await mkdtemp(path.join(cwd, "default-git-marketplace-"));
    await cp(fixtureMarketplaceDir("valid-marketplace"), localMarketplace, { recursive: true });
    const { ctx, pi, notifications } = makeCtx(0);

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: localMarketplace,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, { status: "added", name: "valid-marketplace" });
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(Object.keys((await loadState(locations.extensionRoot)).marketplaces), [
      "valid-marketplace",
    ]);
  });
});

test("normalizes a non-Error config-write throw after a path mutation", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const localMarketplace = await mkdtemp(path.join(cwd, "config-throw-marketplace-"));
    await cp(fixtureMarketplaceDir("valid-marketplace"), localMarketplace, { recursive: true });
    const { ctx, pi, notifications } = makeCtx(0);
    const { gitOps, state } = makeMockGitOps();
    const originalDirname = path.dirname.bind(path);
    t.mock.method(path, "dirname", (value: string) => {
      if (value === locations.configJsonPath) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- the public boundary accepts unknown throws from persistence.
        throw "config writer stopped";
      }

      return originalDirname(value);
    });
    let thrown: unknown;

    // act
    try {
      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: localMarketplace,
        gitOps,
      });
    } catch (error) {
      thrown = error;
    }

    // assert
    assert.deepStrictEqual(thrown, new Error("config writer stopped"));
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(state, {
      checkoutCalls: [],
      cloneCalls: [],
      fetchCalls: [],
      forceUpdateRefCalls: [],
      resolveRefCalls: [],
    });
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      marketplaces: {},
    });
  });
});

test("MA-3: path source accepts a direct path to marketplace.json (not just the directory)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-local-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });
      const directManifestPath = path.join(localMpDir, ".claude-plugin", "marketplace.json");
      const { gitOps } = makeMockGitOps();

      // act
      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: directManifestPath,
        gitOps,
      });

      const persisted = await loadState(locations.extensionRoot);
      // assert
      assert.ok("valid-marketplace" in persisted.marketplaces);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("MA-4: tilde paths are preserved verbatim in stored source.raw", async () => {
  // We don't actually resolve the tilde to a real homedir -- just verify
  // the parser's source.raw is preserved (the actual disk read happens
  // through ParsedSource.resolved, which expandTilde already handled).
  // This test documents the contract; the parser test in
  // tests/domain/source.test.ts is the deeper coverage.
  // arrange
  const { pathSource } = await import("../../../extensions/pi-claude-marketplace/domain/source.ts");
  // act
  const source = pathSource("~/projects/local-mp");
  // assert
  assert.equal(source.raw, "~/projects/local-mp"); // verbatim
});

test("CR-02 / MA-4: ~/path is expanded against $HOME for the on-disk probe; source.raw stays verbatim", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    // Stand up a hermetic HOME containing the fixture so that
    // "~/projects/local-mp" resolves to a real directory.
    const originalHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), "mp-add-home-"));
    process.env.HOME = home;
    try {
      const tildeRelDir = path.join("projects", "local-mp");
      const localMpDir = path.join(home, tildeRelDir);
      await mkdir(path.dirname(localMpDir), { recursive: true });
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps, state } = makeMockGitOps();
      // act
      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: `~/${tildeRelDir}`,
        gitOps,
      });

      // NFR-5: path source MUST NOT touch gitOps.
      // assert
      assert.equal(state.cloneCalls.length, 0);
      assert.equal(state.fetchCalls.length, 0);

      // State updated; success notification emitted.
      const persisted = await loadState(locations.extensionRoot);
      assert.ok("valid-marketplace" in persisted.marketplaces);
      const recorded = persisted.marketplaces["valid-marketplace"];
      assert.ok(recorded);
      // SP-7 / MA-4: source.raw must keep the verbatim "~" form.
      const src = recorded.source as { kind: string; raw: string };
      assert.equal(src.raw, `~/${tildeRelDir}`);
      // marketplaceRoot is the EXPANDED on-disk path so update/list can read it.
      assert.equal(recorded.marketplaceRoot, localMpDir);

      const note = notifications[0];
      assert.ok(note);
      // SNM-33 / D-22-01: path-source collapses onto the canonical
      // `(added)` shape; empty-plugins add never emits the reload-hint.
      assert.equal(note.message, "● valid-marketplace [project] (added)");
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      await rm(home, { recursive: true, force: true });
    }
  });
});

test("MA-2 / SC-5 / CMC-30: orchestrator accepts scope='project'; success row carries `[project]` scope bracket", async () => {
  // The edge layer defaults --scope to "user". This test
  // confirms the orchestrator threads the value through verbatim.
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // Use project scope so we get a real tmp scope root; the assertion
    // is just that the scope is reflected in the success row's
    // `[<scope>]` token per the compact-line grammar (MSG-GR-1).
    // act
    await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: "owner/repo", gitOps });
    const note = notifications[0];
    // assert
    assert.ok(note);
    assert.ok(note.message.includes("[project]"));
  });
});

test("D-03-INV :: add invalidates marketplace-names cache for the new scope", async () => {
  // addMarketplace wires invalidateMarketplaceNames + invalidateMarketplaceCache
  // into its post-state-commit window. To prove the invalidation
  // fires, we:
  //   1. resetCompletionCache() to isolate from prior test pollution.
  //   2. Warm the in-memory marketplace-names map by calling
  //      getMarketplaceNames(...) once with a sentinel rebuild that returns
  //      a deliberately stale shape and writes the cache file.
  //   3. Run addMarketplace -- this MUST clear the in-memory entry and unlink
  //      the stale on-disk cache file.
  //   4. Call getMarketplaceNames again with a different rebuild that
  //      increments a counter; the increment proves memory was cleared
  //      and the file was removed, i.e. the orchestrator routed through the
  //      invalidation call site rather than rehydrating stale disk data.
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    resetCompletionCache();
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // Pre-warm: rebuild returns a stale shape so we can detect "served from
    // memory" vs. "rebuild ran again".
    let rebuildCount = 0;
    const cachePath = locations.marketplaceNamesCacheFile;
    await getMarketplaceNames(cachePath, "project", () => {
      rebuildCount += 1;
      return Promise.resolve(["stale-mp"]);
    });
    // assert
    assert.equal(rebuildCount, 1, "initial warm-up triggers rebuild exactly once");

    // Sanity: second call served from memory (no rebuild).
    await getMarketplaceNames(cachePath, "project", () => {
      rebuildCount += 1;
      return Promise.resolve(["never-invoked"]);
    });
    assert.equal(rebuildCount, 1, "memory hit on second call -- no rebuild");

    // Run addMarketplace -- D-03-INV must fire invalidateMarketplaceNames.
    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // Post-add: memory is dropped AND file is absent. The next read MUST
    // re-invoke the rebuild closure. Without disk invalidation, stale
    // marketplace-names.json would serve "stale-mp" and counter would stay 1.
    await getMarketplaceNames(cachePath, "project", () => {
      rebuildCount += 1;
      return Promise.resolve(["valid-marketplace"]);
    });
    assert.equal(rebuildCount, 2, "post-invalidation read re-invokes rebuild");
  });
});

test("keeps a committed path add successful when marketplace-name cache cleanup fails", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const localMarketplace = await mkdtemp(path.join(cwd, "cache-failure-marketplace-"));
    await cp(fixtureMarketplaceDir("valid-marketplace"), localMarketplace, { recursive: true });
    await mkdir(locations.marketplaceNamesCacheFile, { recursive: true });
    const { ctx, pi, notifications } = makeCtx(0);
    const { gitOps, state } = makeMockGitOps();

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: localMarketplace,
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, { status: "added", name: "valid-marketplace" });
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(state, {
      checkoutCalls: [],
      cloneCalls: [],
      fetchCalls: [],
      forceUpdateRefCalls: [],
      resolveRefCalls: [],
    });
    assert.strictEqual((await readdir(locations.marketplaceNamesCacheFile)).length, 0);
    assert.deepStrictEqual(Object.keys((await loadState(locations.extensionRoot)).marketplaces), [
      "valid-marketplace",
    ]);
  });
});

test("keeps a committed path add successful when post-commit mirror seeding cannot reread its manifest", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const combinedStateAndManifest = {
      schemaVersion: 2,
      marketplaces: {},
      name: "state-backed-marketplace",
      plugins: [],
    };
    await writeFile(locations.stateJsonPath, `${JSON.stringify(combinedStateAndManifest)}\n`);
    await mkdir(path.join(locations.scopeRoot, ".git"), { recursive: true });
    await writeFile(
      path.join(locations.scopeRoot, ".git", "config"),
      '[remote "origin"]\n  url = https://example.com/state-backed.git\n',
    );
    const { ctx, pi, notifications } = makeCtx(0);
    const { gitOps, state } = makeMockGitOps();

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: locations.stateJsonPath,
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, { status: "added", name: "state-backed-marketplace" });
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(state, {
      checkoutCalls: [],
      cloneCalls: [],
      fetchCalls: [],
      forceUpdateRefCalls: [],
      resolveRefCalls: [],
    });
    const persisted = await loadState(locations.extensionRoot);
    assert.deepStrictEqual(Object.keys(persisted.marketplaces), ["state-backed-marketplace"]);
    assert.strictEqual(
      persisted.marketplaces["state-backed-marketplace"]?.manifestPath,
      locations.stateJsonPath,
    );
    assert.strictEqual("name" in persisted, false);
    assert.strictEqual("plugins" in persisted, false);
  });
});

// ATTR-07 (S5e): a path that exists but is neither a file nor a directory
// (a Unix domain socket) is an unusable source -> (failed) {source missing}.
test("ATTR-07: a Unix domain socket path renders (failed) {source missing}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const socketPath = path.join(tmpdir(), `mp-add-sock-${process.pid}.sock`);
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.on("error", reject);
      server.listen(socketPath, resolve);
    });
    try {
      const { gitOps } = makeMockGitOps();
      // act
      await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: socketPath, gitOps });

      const note = notifications[0];
      // assert
      assert.ok(note);
      // Pre-name failure (no readable manifest) -> subject is the raw source.
      assert.equal(
        note.message,
        `A marketplace operation has failed.\n\n⊘ ${socketPath} [project] (failed) {source missing}`,
      );
      assert.equal(note.severity, "error");
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      await unlink(socketPath).catch(() => {
        /* already gone */
      });
    }
  });
});

// ATTR-07 (S5e): a path source that does not exist (ENOENT) renders
// (failed) {source missing} on the raw source subject (pre-name).
test("ATTR-07: a missing path source (ENOENT) renders (failed) {source missing}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const missingDir = path.join(tmpdir(), `mp-add-absent-${process.pid}-${Date.now()}`, "nope");
    const { gitOps, state } = makeMockGitOps();

    // act
    await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: missingDir, gitOps });

    const note = notifications[0];
    // assert
    assert.ok(note);
    assert.equal(
      note.message,
      `A marketplace operation has failed.\n\n⊘ ${missingDir} [project] (failed) {source missing}`,
    );
    assert.equal(note.severity, "error");
    // NFR-5: a path source never touches gitOps.
    assert.equal(state.cloneCalls.length, 0);
  });
});

// ATTR-07 (path source): second path-source add of the same name renders the
// structured (failed) {duplicate name} row, not a raw throw.
test("MA-8 (path source) / ATTR-07: duplicate name in same scope renders (failed) {duplicate name}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx: ctx1, pi: pi1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-dup-path-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps: gitOps1 } = makeMockGitOps();
      // act
      await addMarketplace({
        ctx: ctx1,
        pi: pi1,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = makeMockGitOps();
      await addMarketplace({
        ctx: ctx2,
        pi: pi2,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps2,
      });

      const note = n2[0];
      // assert
      assert.ok(note);
      // Post-manifest failure -> subject is the derived marketplace name (A2).
      assert.equal(
        note.message,
        "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {duplicate name}",
      );
      assert.equal(note.severity, "error");
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

// expandTildePath returns os.homedir() exactly when rawSource is bare '~'.
test("CR-02 / expandTildePath: bare '~' resolves to os.homedir() exactly", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const originalHome = process.env.HOME;
    const home = await mkdtemp(path.join(tmpdir(), "mp-add-baretilde-"));
    process.env.HOME = home;
    try {
      // Copy valid-marketplace fixture directly into the hermetic HOME
      // so '~' (which resolves to home) is the marketplace root.
      await cp(fixtureMarketplaceDir("valid-marketplace"), home, { recursive: true });

      const { gitOps } = makeMockGitOps();
      // act
      await addMarketplace({ ctx, pi, scope: "project", cwd, rawSource: "~", gitOps });

      const persisted = await loadState(locations.extensionRoot);
      // assert
      assert.ok("valid-marketplace" in persisted.marketplaces);
      const recorded = persisted.marketplaces["valid-marketplace"];
      assert.ok(recorded);
      // marketplaceRoot must be the hermetic HOME (os.homedir() at call time).
      assert.equal(recorded.marketplaceRoot, home);
    } finally {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      await rm(home, { recursive: true, force: true });
    }
  });
});

// CMP-1: same marketplace name may exist independently in user and project scopes.
// The duplicate-name guard (MA-8) is scope-local only.
test("CMP-1: same marketplace name in user scope and project scope are independent (cross-scope add succeeds)", async () => {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "mp-add-cmp1-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    await withTmpScope(async ({ cwd }) => {
      // arrange
      const { ctx: ctx1, pi: pi1, notifications: n1 } = makeCtx();
      const { gitOps: gitOps1 } = makeMockGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      });
      // act
      await addMarketplace({
        ctx: ctx1,
        pi: pi1,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps: gitOps1,
      });
      // assert
      assert.equal(n1[0]?.severity, undefined, "project-scope add emits no error");

      const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = makeMockGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      });
      // Same marketplace name but user scope -- MUST NOT throw MarketplaceDuplicateNameError.
      await addMarketplace({
        ctx: ctx2,
        pi: pi2,
        scope: "user",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps: gitOps2,
      });
      assert.equal(n2[0]?.severity, undefined, "user-scope add of same name emits no error");

      const projectState = await loadState(locationsFor("project", cwd).extensionRoot);
      const userState = await loadState(locationsFor("user", cwd).extensionRoot);
      assert.ok(
        projectState.marketplaces["valid-marketplace"] !== undefined,
        "project scope has record",
      );
      assert.ok(
        userState.marketplaces["valid-marketplace"] !== undefined,
        "user scope has independent record",
      );
    });
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// AUTH-01 auth-wiring tests
// -----------------------------------------------------------------------

test("AUTH-01 add: credentialOps.fill HIT bypasses Device Flow and clones with the auth bundle", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();

    // Pre-seed a stored credential for github.com so fill returns a HIT.
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps({
      store: new Map([["github.com", { username: "x-access-token", password: "stored-token" }]]),
    });

    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      credentialOps,
    });

    // auth bundle must be forwarded to gitOps.clone.
    // assert
    assert.equal(state.cloneCalls.length, 1);
    assert.ok(state.cloneCalls[0]?.auth !== undefined, "auth bundle must be present on clone call");

    // Verify bundle shape.
    const recordedAuth = state.cloneCalls[0].auth;
    assert.equal(recordedAuth.host, "github.com");
    assert.equal(
      recordedAuth.credentialOps,
      credentialOps,
      "credentialOps should be reference-equal",
    );

    // Exercise the recorded auth bundle: fill HIT returns the stored credential.
    const cbs = buildAuthCallbacks(recordedAuth);
    const result = await cbs.onAuth("https://github.com/owner/repo.git");
    assert.deepEqual(result, { username: "x-access-token", password: "stored-token" });

    // fill consulted exactly once via the onAuth call above.
    assert.equal(credState.fillCalls.length, 1);
    assert.equal(credState.fillCalls[0]?.host, "github.com");

    // No Device Flow prompt emitted: only the post-add success notification.
    assert.equal(
      notifications.filter((n) => n.message.startsWith("Open ")).length,
      0,
      "Device Flow notifyFn must NOT fire on a fill HIT",
    );
  });
});

test("AUTH-01 add: credentialOps.fill MISS triggers Device Flow which produces a token via initiateDeviceFlow", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx(2);

    // Empty store -> fill returns null (MISS).
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();

    // Device Flow http mock: immediate success poll.
    const { http: deviceFlowHttp } = makeMockDeviceFlowHttp({
      deviceCode: {
        device_code: "MOCK_DEVICE_CODE",
        user_code: "ABCD-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 0,
      },
      pollQueue: [
        {
          kind: "success",
          accessToken: "gho_test_token_AUTH01",
          tokenType: "bearer",
          scope: "repo",
        },
      ],
    });

    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      credentialOps,
      deviceFlowHttp,
    });

    // auth bundle must be forwarded.
    // assert
    assert.equal(state.cloneCalls.length, 1);
    const recordedAuth = state.cloneCalls[0]?.auth;
    assert.ok(recordedAuth !== undefined, "auth bundle must be forwarded to gitOps.clone");

    // Exercise the miss path: buildAuthCallbacks -> fill miss -> onAuthRequired
    // -> initiateDeviceFlow (with the injected http mock) -> success.
    const cbs = buildAuthCallbacks(recordedAuth);
    const result = await cbs.onAuth("https://github.com/owner/repo.git");
    assert.equal(
      result.password,
      "gho_test_token_AUTH01",
      "Device Flow must produce the mocked token",
    );

    // Device Flow notifyFn must have emitted the byte-exact catalog prompt.
    assert.ok(
      notifications.some(
        (n) =>
          n.message === "Open https://github.com/login/device and enter: ABCD-1234" &&
          n.severity === "info",
      ),
      "Device Flow must emit the exact catalog byte-form prompt with info severity",
    );

    // approve called once by initiateDeviceFlow on success.
    assert.equal(
      credState.approveCalls.length,
      1,
      "credentialOps.approve must be called on success",
    );

    // fill called once (the onAuth miss that triggered Device Flow).
    assert.equal(credState.fillCalls.length, 1, "fill called once on the onAuth miss");
    assert.equal(credState.fillCalls[0]?.host, "github.com");
  });
});

test("AUTH-01 add: the GitAuthBundle is forwarded by reference into gitOps.clone (no re-bundling)", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi } = makeCtx();

    const { credOps: credentialOps } = makeMockCredentialOps();

    const { http: deviceFlowHttp } = makeMockDeviceFlowHttp();

    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      credentialOps,
      deviceFlowHttp,
    });

    // assert
    assert.equal(state.cloneCalls.length, 1);
    assert.equal(state.cloneCalls[0]?.auth?.host, "github.com");
    assert.equal(
      state.cloneCalls[0]?.auth?.credentialOps,
      credentialOps,
      "credentialOps must be reference-equal (no re-bundling)",
    );
    assert.equal(
      typeof state.cloneCalls[0]?.auth?.onAuthRequired,
      "function",
      "onAuthRequired must be a function",
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// RECON-03: orchestrated-mode coverage
// ───────────────────────────────────────────────────────────────────────────

test("RECON-03 orchestrated mode -- github source success returns { status: 'added' } with ZERO notify calls", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.ok(outcome, "orchestrated mode must return an outcome");
    assert.equal(outcome.status, "added");
    if (outcome.status === "added") {
      assert.equal(outcome.name, "valid-marketplace");
    }
  });
});

test("RECON-03 orchestrated mode -- unsupported source returns { status: 'failed', reason: 'unsupported source' } with ZERO notify calls", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps();

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "git@github.com:foo/bar.git",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.equal(state.cloneCalls.length, 0, "NFR-5: unsupported source never touches gitOps");
    assert.ok(outcome);
    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
      assert.equal(outcome.reason, "unsupported source");
      assert.ok(outcome.error instanceof Error);
      assert.ok(typeof outcome.cause === "string" && outcome.cause.length > 0);
    }
  });
});

test("orchestrated mode normalizes a non-Error opaque failure without mutation", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx(0);
    const { gitOps, state } = makeMockGitOps();
    t.mock.method(path, "basename", () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- this case proves the public unknown-throw normalizer.
      throw "opaque add failure";
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "owner/repo",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "unparseable",
      error: new Error("opaque add failure"),
      cause: "opaque add failure",
    });
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(state, {
      checkoutCalls: [],
      cloneCalls: [],
      fetchCalls: [],
      forceUpdateRefCalls: [],
      resolveRefCalls: [],
    });
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      marketplaces: {},
    });
  });
});

test("normalizes a structurally classified exotic throw in orchestrated mode", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    let prototypeReads = 0;
    const exoticDuplicate = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          prototypeReads += 1;
          return prototypeReads <= 2 ? MarketplaceDuplicateNameError.prototype : null;
        },
      },
    );
    const { ctx, pi, notifications } = makeCtx(0);
    const { gitOps, state } = makeMockGitOps();
    t.mock.method(path, "basename", () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- an exotic thenable-free value exercises unknown-throw normalization.
      throw exoticDuplicate;
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "owner/repo",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "duplicate name",
      error: new Error("[object Object]"),
      cause: "[object Object]",
    });
    assert.strictEqual(prototypeReads, 5);
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(state, {
      checkoutCalls: [],
      cloneCalls: [],
      fetchCalls: [],
      forceUpdateRefCalls: [],
      resolveRefCalls: [],
    });
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      marketplaces: {},
    });
  });
});

test("cleans the final clone when state-record construction fails after rename", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx(0);
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    let prototypeReads = 0;
    const stateMutationFailure = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          prototypeReads += 1;
          return prototypeReads === 1 ? Error.prototype : null;
        },
      },
    );
    const originalJoin = path.join.bind(path);
    t.mock.method(path, "join", (...segments: string[]) => {
      if (
        segments.length === 3 &&
        segments[0]?.endsWith(`${path.sep}sources${path.sep}valid-marketplace`) === true &&
        segments[1] === ".claude-plugin" &&
        segments[2] === "marketplace.json"
      ) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- this failure proves the inner unknown-throw normalizer after rename.
        throw stateMutationFailure;
      }

      return originalJoin(...segments);
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "unparseable",
      error: new Error("[object Object]"),
      cause: "[object Object]",
    });
    assert.strictEqual(prototypeReads, 3);
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(
      state.cloneCalls.map(({ url }) => url),
      ["https://github.com/anthropics/claude-plugins-official.git"],
    );
    assert.strictEqual(
      await pathExists(await locations.sourceCloneDir("valid-marketplace")),
      false,
    );
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      marketplaces: {},
    });
  });
});

test("RECON-03 orchestrated mode -- duplicate-name (path source) returns typed MarketplaceDuplicateNameError, no notifications", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx: ctx1, pi: pi1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-orch-dup-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps: gitOps1 } = makeMockGitOps();
      // Seed the duplicate via a standalone add.
      // act
      await addMarketplace({
        ctx: ctx1,
        pi: pi1,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = makeMockGitOps();
      const outcome = await addMarketplace({
        ctx: ctx2,
        pi: pi2,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps2,
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.equal(n2.length, 0, "orchestrated mode must not fire notifications");
      assert.ok(outcome);
      assert.equal(outcome.status, "failed");
      if (outcome.status === "failed") {
        assert.equal(outcome.reason, "duplicate name");
        assert.ok(outcome.error instanceof MarketplaceDuplicateNameError);
      }
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("RECON-03 orchestrated mode -- rethrowPreconditionErrors still rethrows typed precondition (bootstrap contract preserved)", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx: ctx1, pi: pi1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-orch-rethrow-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps: gitOps1 } = makeMockGitOps();
      // act
      await addMarketplace({
        ctx: ctx1,
        pi: pi1,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2, pi: pi2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = makeMockGitOps();

      // assert
      await assert.rejects(
        addMarketplace({
          ctx: ctx2,
          pi: pi2,
          scope: "project",
          cwd,
          rawSource: localMpDir,
          gitOps: gitOps2,
          rethrowPreconditionErrors: true,
          notifications: { mode: "orchestrated" },
        }),
        (err: unknown) => err instanceof MarketplaceDuplicateNameError,
      );

      assert.equal(n2.length, 0, "orchestrated mode must not fire notifications");
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("RECON-03 standalone-default mode -- omitted notifications option remains byte-identical to today (regression guard)", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // The same call without `notifications` -- must return void and fire one
    // byte-identical notify, matching the standalone test at line 60.
    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // assert
    assert.equal(outcome, undefined, "standalone (omitted) returns void");
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.message, "● valid-marketplace [project] (added)");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WB-01 write-back, --local, WR-09, CFG-03
// ──────────────────────────────────────────────────────────────────────────

test("WB-01: standalone add writes the marketplace entry to claude-plugins.json (source verbatim)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    const cfg = await loadConfig(locations.configJsonPath);
    // assert
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    // PATTERNS §"Verbatim rawSource": source field MUST equal opts.rawSource
    // verbatim so the reconcile planner's `samePlannedSource` stays
    // a no-op on the next load.
    assert.equal(
      cfg.config.marketplaces?.["valid-marketplace"]?.source,
      "anthropics/claude-plugins-official",
    );

    // The local file MUST NOT have been touched on the base-target path.
    const localCfg = await loadConfig(locations.configLocalJsonPath);
    assert.equal(localCfg.status, "absent");
  });
});

test("WB-01: --local routes the write to claude-plugins.local.json and never touches the base file", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      local: true,
    });

    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    const localCfg = await loadConfig(locations.configLocalJsonPath);
    // assert
    assert.equal(localCfg.status, "valid");
    if (localCfg.status === "valid") {
      assert.equal(
        localCfg.config.marketplaces?.["valid-marketplace"]?.source,
        "anthropics/claude-plugins-official",
      );
    }

    // The base file MUST be untouched.
    const baseCfg = await loadConfig(locations.configJsonPath);
    assert.equal(baseCfg.status, "absent");
  });
});

test("WR-09 / T-56-02-01: orchestrated-mode add SKIPS config write-back (neither base nor local file is created)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepEqual(outcome, { status: "added", name: "valid-marketplace" });
    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    assert.equal((await loadConfig(locations.configJsonPath)).status, "absent");
    assert.equal((await loadConfig(locations.configLocalJsonPath)).status, "absent");
  });
});

test("CFG-03 / T-56-02-05: --local path with an invalid config aborts the add; basename-only cause; state untouched", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // Seed an invalid claude-plugins.local.json (malformed JSON).
    // arrange
    const { writeFile } = await import("node:fs/promises");
    await writeFile(locations.configLocalJsonPath, "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      local: true,
    });

    // ATTR-07: classifyAddError routes ConfigInvalidError -> {invalid manifest}.
    // assert
    assert.equal(notifications.length, 1);
    const note = notifications[0]!;
    assert.ok(
      note.message.includes("(failed) {invalid manifest}"),
      `expected (failed) {invalid manifest} row, got: ${note.message}`,
    );
    // T-56-02-05: the absolute path MUST NOT be leaked in the rendered cause.
    assert.ok(
      !note.message.includes(locations.configLocalJsonPath),
      `must NOT leak absolute configLocalJsonPath, got: ${note.message}`,
    );

    // State was NOT mutated (the marketplace record was never recorded).
    const persisted = await loadState(locations.extensionRoot);
    assert.equal(Object.keys(persisted.marketplaces).length, 0);
  });
});

test("WR-07: config write failure after the clone rename cleans up the final clone (retry never hits {stale clone})", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // Valid pre-existing config so the CFG-03 pre-check passes -- the
    // failure must land AFTER addGithubInGuard renamed the clone into its
    // final sources/<name>/ path.
    await writeFile(locations.configJsonPath, JSON.stringify({ schemaVersion: 1 }), "utf8");
    // Read-only scope root: saveConfig's tmp+rename write into scopeRoot
    // fails with EACCES, while everything under extensionRoot (state lock,
    // sources/, sources-staging/) stays writable.
    await chmod(locations.scopeRoot, 0o555);

    let threw = false;
    try {
      // act
      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      });
    } catch {
      threw = true;
    } finally {
      await chmod(locations.scopeRoot, 0o755);
    }

    // The command failed (either a classified failure row or a rethrow).
    // assert
    assert.ok(
      threw || notifications.some((n) => n.severity === "error"),
      "config write failure must surface as a failure",
    );

    // WR-07: the committed final clone was cleaned up -- a retry must NOT
    // fail MA-6 {stale clone}.
    const finalDir = await locations.sourceCloneDir("valid-marketplace");
    assert.equal(await pathExists(finalDir), false, "final clone must be removed on write failure");

    // State was NOT persisted (no tx.save() ran).
    const persisted = await loadState(locations.extensionRoot);
    assert.equal(Object.keys(persisted.marketplaces).length, 0);
  });
});

test("cleans a URL clone after state-save failure and a second invocation converges", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const firstBoundary = makeCtx(0);
    const firstGit = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      onClone: async () => {
        await mkdir(locations.stateJsonPath, { recursive: true });
      },
    });
    let firstError: unknown;

    // act
    try {
      await addMarketplace({
        ctx: firstBoundary.ctx,
        pi: firstBoundary.pi,
        scope: "project",
        cwd,
        rawSource: "https://gitlab.example.com/team/mp",
        gitOps: firstGit.gitOps,
      });
    } catch (error) {
      firstError = error;
    }

    const configAfterFailure = await readFile(locations.configJsonPath, "utf8");
    const finalClone = await locations.sourceCloneDir("valid-marketplace");
    const finalCloneAfterFailure = await pathExists(finalClone);
    await rm(locations.stateJsonPath, { recursive: true, force: true });
    const secondBoundary = makeCtx();
    const secondGit = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const secondOutcome = await addMarketplace({
      ctx: secondBoundary.ctx,
      pi: secondBoundary.pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps: secondGit.gitOps,
    });

    // assert
    assert.ok(firstError instanceof Error);
    assert.strictEqual((firstError as NodeJS.ErrnoException).code, "EISDIR");
    assert.strictEqual(finalCloneAfterFailure, false);
    assert.strictEqual(
      configAfterFailure,
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "valid-marketplace": {\n      "source": "https://gitlab.example.com/team/mp"\n    }\n  }\n}\n',
    );
    assert.strictEqual(secondOutcome, undefined);
    assert.deepStrictEqual(secondBoundary.notifications, [
      { message: "● valid-marketplace [project] (added)" },
    ]);
    assert.deepStrictEqual(firstBoundary.notifications, []);
    assert.deepStrictEqual(
      firstGit.state.cloneCalls.map(({ url }) => url),
      ["https://gitlab.example.com/team/mp.git"],
    );
    assert.deepStrictEqual(
      secondGit.state.cloneCalls.map(({ url }) => url),
      ["https://gitlab.example.com/team/mp.git"],
    );
    assert.deepStrictEqual(Object.keys((await loadState(locations.extensionRoot)).marketplaces), [
      "valid-marketplace",
    ]);
    assert.strictEqual(await pathExists(finalClone), true);
  });
});

test("MURL-01: url source clones source.url `.git`-suffixed with NO auth key in the clone options", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps,
    });

    // D-76-06: the clone URL is source.url -- no github.com reconstruction.
    // MURL-01: the parser canonicalized the trailing `.git` off for identity
    // comparison, and `ensureGitSuffix` restores it for the wire.
    // assert
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    assert.equal(cloneCall.url, "https://gitlab.example.com/team/mp.git");
    // D-76-07: public-only -- the clone options object carries NO `auth` key.
    assert.equal(Object.hasOwn(cloneCall, "auth"), false);
    assert.equal(cloneCall.auth, undefined);
  });
});

test("MURL-01: url source with a #ref clones at that ref with singleBranch and still no auth", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp#v1.0",
      gitOps,
    });

    // assert
    assert.equal(state.cloneCalls.length, 1);
    assert.deepEqual(
      {
        url: state.cloneCalls[0]?.url,
        ref: state.cloneCalls[0]?.ref,
        singleBranch: state.cloneCalls[0]?.singleBranch,
      },
      {
        url: "https://gitlab.example.com/team/mp.git",
        ref: "v1.0",
        singleBranch: true,
      },
    );
    // D-76-07: still no auth key even with a ref.
    assert.equal(Object.hasOwn(state.cloneCalls[0] ?? {}, "auth"), false);
  });
});

test("MURL-01: after a successful url add, state records source.kind === 'url' and the clone lands at sources/<name>/", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps,
    });

    const persisted = await loadState(locations.extensionRoot);
    const recorded = persisted.marketplaces["valid-marketplace"];
    // assert
    assert.ok(recorded);
    assert.equal((recorded.source as { kind: string }).kind, "url");

    // The clone was renamed into its final sources/<derivedName>/ path.
    const finalDir = await locations.sourceCloneDir("valid-marketplace");
    assert.ok(await pathExists(finalDir), "clone must land at sources/<derivedName>/");
  });
});

test("D-76-08: a url clone throwing an HttpError with statusCode 401 renders (failed) {authentication required}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    // Duck-typed isomorphic-git HttpError shape: code === "HttpError",
    // data.statusCode carries the HTTP status.
    const httpErr = Object.assign(new Error("HTTP 401 from clone"), {
      code: "HttpError",
      data: { statusCode: 401 },
    });
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpErr,
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/private-mp",
      gitOps,
    });

    const note = notifications.find((n) => n.severity === "error");
    // assert
    assert.ok(note, "401 clone challenge must render an error");
    assert.ok(
      note.message.includes("(failed) {authentication required}"),
      `expected authentication-required row, got: ${note.message}`,
    );
    // Must NOT misclassify as unparseable or network unreachable.
    assert.equal(note.message.includes("{unparseable}"), false);
    assert.equal(note.message.includes("{network unreachable}"), false);
  });
});

test("D-76-08: a url clone HttpError with statusCode 403 also renders (failed) {authentication required}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const httpErr = httpError(403);
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpErr,
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/private-mp",
      gitOps,
    });

    const note = notifications.find((n) => n.severity === "error");
    // assert
    assert.ok(note);
    assert.ok(note.message.includes("(failed) {authentication required}"));
  });
});

test("D-76-09: a missing repository HttpError renders (failed) {source missing} via notify()", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpError(404),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/missing-mp",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n" +
          "⊘ https://gitlab.example.com/team/missing-mp [project] (failed) {source missing}",
        severity: "error",
      },
    ]);
  });
});

for (const { statusCode, reason } of [
  { statusCode: 429, reason: "network unreachable" },
  { statusCode: 500, reason: "network unreachable" },
]) {
  test(`D-76-09: a transient HTTP ${statusCode} clone failure renders (failed) {${reason}}`, async () => {
    await withTmpScope(async ({ cwd }) => {
      // arrange
      const { ctx, pi, notifications } = makeCtx();
      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
        cloneThrows: httpError(statusCode),
      });

      // act
      await addMarketplace({
        ctx,
        pi,
        scope: "project",
        cwd,
        rawSource: "https://gitlab.example.com/team/flaky-mp",
        gitOps,
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A marketplace operation has failed.\n\n" +
            `⊘ https://gitlab.example.com/team/flaky-mp [project] (failed) {${reason}}`,
          severity: "error",
        },
      ]);
    });
  });
}

test("D-76-09 orchestrated mode -- a gone repository returns the source-missing outcome without notifying", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx(0);
    const cloneThrows = httpError(410);
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows,
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/gone-mp",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "source missing",
      error: cloneThrows,
      cause: "HTTP Error: 410",
    });
    assert.deepStrictEqual(notifications, []);
  });
});

test("GAUTH-02: a declined/failed Device Flow (UserCanceledError) renders (failed) {authentication required} via notify(), not a raw throw or {unparseable}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    // A denied/expired Device Flow (or a poll network error) makes
    // platform/git.ts's onAuth return `{ cancel: true }`, which
    // isomorphic-git throws as `UserCanceledError` -- NOT an HttpError
    // 401/403 and NOT a network errno.
    const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: authError,
    });

    // No raw throw past addMarketplace -- the standalone path must route
    // through notify() (IL-2).
    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    const note = notifications.find((n) => n.severity === "error");
    // assert
    assert.ok(note, "a declined Device Flow must render a notify()-routed error");
    assert.ok(
      note.message.includes("(failed) {authentication required}"),
      `expected authentication-required row, got: ${note.message}`,
    );
    assert.equal(note.message.includes("{unparseable}"), false);
    assert.equal(note.message.includes("{network unreachable}"), false);
  });
});

test("GAUTH-02 orchestrated mode -- UserCanceledError returns { status: 'failed', reason: 'authentication required' }, not the mislabeled 'unparseable'", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: authError,
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.ok(outcome);
    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
      assert.equal(outcome.reason, "authentication required");
    }
  });
});

test("MURL-01 regression: github source is byte-identical -- Device Flow auth still constructed, cloneUrl still reconstructed", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // assert
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    // github: URL reconstructed to the canonical https://github.com/.git form.
    assert.equal(cloneCall.url, "https://github.com/anthropics/claude-plugins-official.git");
    // github: the Device Flow auth bundle IS constructed and passed through.
    assert.ok(cloneCall.auth, "github clone must carry an auth bundle");
    assert.equal(cloneCall.auth.host, "github.com");
    // Its callbacks are wired (buildAuthCallbacks-compatible shape).
    assert.equal(typeof cloneCall.auth.onAuthRequired, "function");
    assert.ok(
      buildAuthCallbacks({
        credentialOps: cloneCall.auth.credentialOps,
        host: cloneCall.auth.host,
        onAuthRequired: cloneCall.auth.onAuthRequired,
      }),
      "github auth bundle must be buildAuthCallbacks-compatible",
    );
  });
});

test("PROV-04 / D-79-03: a no-provider url add that 401s renders the bare (failed) {authentication required} row with NO cause line", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    // D-79-03: marketplace add keeps its no-child-rows invariant (D-01/D-10),
    // so the no-provider cause line renders ONLY on the update path's
    // cause-carrying child row -- the add row stays the bare closed-set token.
    const { credOps: credentialOps } = makeMockCredentialOps();
    const httpErr = Object.assign(new Error("HTTP 401 from clone"), {
      code: "HttpError",
      data: { statusCode: 401 },
    });
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpErr,
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/private-mp",
      gitOps,
      credentialOps,
    });

    const note = notifications.find((n) => n.severity === "error");
    // assert
    assert.ok(note, "401 clone challenge must render an error");
    assert.ok(
      note.message.includes("(failed) {authentication required}"),
      `expected authentication-required row, got: ${note.message}`,
    );
    // NO cause trailer and NO no-provider line on the add surface (D-79-03).
    assert.equal(note.message.includes("no auth provider is registered"), false);
    assert.equal(note.message.includes("cause:"), false);
  });
});

test("PROV-02: a public no-provider url add clones authless -- no auth key, no credential interaction, no Device Flow prompt", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { http: deviceFlowHttp, state: httpState } = makeMockDeviceFlowHttp();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps,
      credentialOps,
      deviceFlowHttp,
    });

    // No provider for gitlab.example.com -> buildAuthForHost yields undefined
    // -> the clone call carries NO auth key at all (PROV-02).
    // assert
    assert.equal(state.cloneCalls.length, 1);
    assert.equal(Object.hasOwn(state.cloneCalls[0] ?? {}, "auth"), false);
    // The public clone never touched the credential seam or the flow.
    assert.equal(credState.fillCalls.length, 0);
    assert.equal(httpState.requestCodeCalls.length, 0);
    assert.equal(
      notifications.filter((n) => n.message.startsWith("Open ")).length,
      0,
      "Device Flow prompt must NOT fire for a public no-provider url add",
    );
  });
});

test("PROV-01: a url add whose host case-folds to github.com carries the provider auth bundle on the clone", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const { credOps: credentialOps } = makeMockCredentialOps();

    // The case-sensitive github.com prefix check leaves this a `url` source,
    // but URL host parsing lowercases to github.com -- a provider-registered
    // host, so the url clone must thread the github auth bundle (unlike the
    // no-provider gitlab.example.com adds above).
    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://GitHub.com/acme/mp",
      gitOps,
      credentialOps,
    });

    // assert
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    assert.equal(cloneCall.url, "https://GitHub.com/acme/mp.git");
    assert.ok(cloneCall.auth, "provider-registered host must attach an auth bundle");
    assert.equal(cloneCall.auth.host, "github.com");
  });
});

test("GAUTH-02 / MURL-01: a gitlab.com url add clones .git-suffixed WITH the GitLab provider's auth bundle attached to the same clone call", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const { credOps: credentialOps } = makeMockCredentialOps();

    // Unlike the gitlab.example.com adds above (MURL-01, PROV-02), gitlab.com
    // is claimed by GITLAB_PROVIDER (exact-match hostMatch) -- the real
    // findProviderForHost/buildAuthForHost path (no mock auth registry) must
    // attach its auth bundle to the SAME clone call that carries the
    // `.git`-suffixed wire URL.
    // act
    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.com/team/mp",
      gitOps,
      credentialOps,
    });

    // assert
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    // MURL-01: ensureGitSuffix restores the `.git` suffix on the wire URL.
    assert.equal(cloneCall.url, "https://gitlab.com/team/mp.git");
    // GAUTH-02: gitlab.com is provider-registered -- the clone carries the
    // GitLab auth bundle, not the no-provider authless path.
    assert.ok(cloneCall.auth, "gitlab.com must attach the GitLab provider's auth bundle");
    assert.equal(cloneCall.auth.host, "gitlab.com");
  });
});
