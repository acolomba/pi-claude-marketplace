import assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import lockfile from "proper-lockfile";
import { mock, verify, when } from "strong-mock";

import { NO_STORED_CREDENTIAL_CAUSE } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import {
  addMarketplace as addMarketplaceWithCache,
  addMarketplaceToState,
  notifyAddFailure,
  parseAddableSource,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { loadConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { buildAuthCallbacks } from "../../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";
import { listRemotes } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  CleanupLeakError,
  FetchedUrlCause,
  HostedManifestFetchError,
  HostedManifestHttpError,
  InvalidGitHubBaseUrlError,
  InvalidMarketplaceManifestError,
  MarketplaceDuplicateNameError,
  StaleSourceCloneError,
  StateLockHeldError,
  UnremovableLeftoverCloneError,
  UnsupportedSourceError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  createRemovalOps,
  pathExists,
} from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { openNotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { setGitHubBaseUrl } from "../../shared/github-base-url-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";
import {
  stateLockHeldCause as lockHeldCause,
  whileStateLockHeld as whileLockHeld,
} from "../state-lock.ts";

import type {
  DeviceCodeResponse,
  PollResult,
} from "../../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import type {
  AddMarketplaceOptions,
  AddMarketplaceOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import type { HostedManifestFetch } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts";
import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type {
  ScopeDependencyInstallFn,
  ScopeDependencyInstallResult,
  ScopeDependencyInstallRow,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { AuthAttemptResult } from "../../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";
import type {
  GitCredentials,
  ListRemotesResult,
} from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

type FailedAddOutcome = Extract<AddMarketplaceOutcome, { status: "failed" }>;

const VALID_MANIFEST_JSON = JSON.stringify({
  name: "valid-marketplace",
  owner: { name: "Phase 4 Tests" },
  plugins: [
    {
      name: "hello",
      source: "./plugins/hello",
      description: "Hello plugin (test fixture)",
      version: "1.0.0",
    },
  ],
});

void ({
  status: "failed",
  reason: "duplicate name",
  error: new Error("duplicate marketplace"),
  cause: "duplicate marketplace",
} satisfies AddMarketplaceOutcome);

void ({
  status: "failed",
  reason: "stale clone",
  error: new Error("existing clone"),
  cause: "existing clone",
} satisfies AddMarketplaceOutcome);

// The public add outcome deliberately accepts the shared reason vocabulary.
void ("plugins remain" satisfies FailedAddOutcome["reason"]);

// @ts-expect-error failed add outcomes retain the closed shared reason vocabulary
void ("unknown add failure" satisfies FailedAddOutcome["reason"]);

void ({ status: "unchanged", name: "tools" } satisfies AddMarketplaceOutcome);

function fixtureMarketplaceDir(
  name: "valid-marketplace" | "invalid-manifest" | "empty-marketplace",
): string {
  return path.join(path.dirname(new URL(import.meta.url).pathname), "_fixtures", name);
}

interface CredentialAdapterOptions {
  readonly store?: ReadonlyMap<string, GitCredentials>;
}

function createCredentialOps(initial: CredentialAdapterOptions = {}) {
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

function createDeviceFlowHttp(initial: DeviceFlowAdapterOptions = {}) {
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
  readonly listRemotesResult?: ListRemotesResult;
}

// D-2-01: only a `kind: "github"` source gets the `.git` suffix -- every
// other host is admitted at exactly the verbatim path the parser produces.
const ALLOWED_MARKETPLACE_REMOTES = [
  "https://github.com/anthropics/claude-plugins-official.git",
  "https://github.com/owner/repo.git",
  "https://gitlab.example.com/team/mp",
  "https://gitlab.example.com/team/private-mp",
  "https://gitlab.example.com/team/missing-mp",
  "https://gitlab.example.com/team/flaky-mp",
  "https://gitlab.example.com/team/gone-mp",
  "https://github.com/acme/mp.git",
  "https://gitlab.com/team/mp",
  // D-2-01: the `.git` a user typed survives onto the wire. Only the suffixed
  // form is admitted, so sending the `.git`-stripped cache-key identity instead
  // is refused by the fake as well as caught by the by-value assertion.
  "https://gitlab.example.com/team/suffixed-mp.git",
  // D-2-02: stands in for a host that serves ONLY its `.git`-suffixed path --
  // admitted here suffixed so a verbatim (non-github) request is refused.
  "https://gitlab.example.com/team/git-only-mp.git",
] as const;

function createGitOps(initial: GitOpsAdapterOptions = {}) {
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
    ...(initial.listRemotesResult === undefined
      ? {}
      : { listRemotesResult: initial.listRemotesResult }),
  });
  const gitOps: GitOps = {
    ...git.gitOps,
    async clone(options) {
      await git.gitOps.clone(options);
      await initial.onClone?.(options.dir);
      if (Object.hasOwn(initial, "cloneThrows")) {
        throw initial.cloneThrows;
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

type TestAddMarketplaceOptions = Omit<AddMarketplaceOptions, "completionCache">;

const completionCachesByGitOps = new WeakMap<GitOps, ReturnType<typeof createCompletionCache>>();

type CompletionInvalidationCall =
  | {
      readonly kind: "names";
      readonly cachePath: string;
      readonly scope: "project" | "user";
    }
  | {
      readonly kind: "plugins";
      readonly cachePath: string;
      readonly scope: "project" | "user";
      readonly marketplace: string;
    };

interface CompletionCacheRecorderOptions {
  readonly failAt?: CompletionInvalidationCall["kind"];
  readonly onCall?: (call: CompletionInvalidationCall) => Promise<void>;
}

function createCompletionCacheRecorder(options: CompletionCacheRecorderOptions = {}): {
  readonly cache: CompletionCache;
  readonly calls: readonly CompletionInvalidationCall[];
  clearCalls(): void;
} {
  const delegate = createCompletionCache();
  const calls: CompletionInvalidationCall[] = [];
  const record = async (call: CompletionInvalidationCall): Promise<void> => {
    calls.push(call);
    await options.onCall?.(call);
    if (options.failAt === call.kind) {
      throw new Error(`${call.kind} cache hygiene failed`);
    }
  };

  const cache: CompletionCache = {
    getPluginIndex: (cachePath, scope, marketplace, rebuild, getOptions) =>
      delegate.getPluginIndex(cachePath, scope, marketplace, rebuild, getOptions),
    invalidateMarketplaceCache: (scope, marketplace) => {
      delegate.invalidateMarketplaceCache(scope, marketplace);
    },
    async invalidateMarketplaceNames(cachePath, scope) {
      await record({ kind: "names", cachePath, scope });
      await delegate.invalidateMarketplaceNames(cachePath, scope);
    },
    async dropMarketplaceCache(cachePath, scope, marketplace) {
      await record({ kind: "plugins", cachePath, scope, marketplace });
      await delegate.dropMarketplaceCache(cachePath, scope, marketplace);
    },
  };

  return {
    cache,
    calls,
    clearCalls(): void {
      calls.length = 0;
    },
  };
}

function completionCacheFor(
  opts: TestAddMarketplaceOptions,
): ReturnType<typeof createCompletionCache> {
  if (opts.gitOps === undefined) {
    return createCompletionCache();
  }

  const existing = completionCachesByGitOps.get(opts.gitOps);
  if (existing !== undefined) {
    return existing;
  }

  const created = createCompletionCache();
  completionCachesByGitOps.set(opts.gitOps, created);
  return created;
}

function addMarketplace(
  opts: TestAddMarketplaceOptions & { notifications: { mode: "orchestrated" } },
): Promise<AddMarketplaceOutcome>;
function addMarketplace(
  opts: TestAddMarketplaceOptions,
): Promise<AddMarketplaceOutcome | undefined>;
function addMarketplace(
  opts: TestAddMarketplaceOptions,
): Promise<AddMarketplaceOutcome | undefined> {
  return addMarketplaceWithCache({ ...opts, completionCache: completionCacheFor(opts) });
}

/**
 * The strict context boundary, sized to the emissions the case promises.
 * D-05: every emission renders from the run's snapshot, so no tool inventory
 * is present to probe.
 */
function makeCtx(
  expectedNotifications = 1,
  expectedModeReads = expectedNotifications,
): {
  ctx: ExtensionContext;
  run: NotificationRun;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  let notificationCalls = 0;
  if (expectedNotifications > 0) {
    when(() => ctx.mode)
      .thenReturn("tui")
      .times(expectedModeReads);
    when(() => ctx.ui)
      .thenReturn(ui)
      .times(expectedNotifications);
    when(() => ui.notify)
      .thenReturn((message, severity) => {
        notifications.push(severity === undefined ? { message } : { message, severity });
        notificationCalls += 1;
        if (notificationCalls === expectedNotifications) {
          verify(ctx);
          verify(ui);
        }
      })
      .times(expectedNotifications);
  } else {
    verify(ctx);
    verify(ui);
  }

  return { ctx, run: runWithNothingLoaded(), notifications };
}

function httpError(statusCode: number): Error {
  return Object.assign(new Error(`HTTP Error: ${statusCode}`), {
    code: "HttpError",
    data: { statusCode },
  });
}

function refNotFoundError(ref: string): Error {
  return Object.assign(new Error(`Could not find ${ref}.`), {
    code: "NotFoundError",
    name: "NotFoundError",
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

/** The ownership marker `marketplace add` writes into every clone it creates (Q-01). */
const OWNERSHIP_MARKER = path.join(".git", "pi-claude-marketplace.json");

const OWNERSHIP_MARKER_BYTES = '{\n  "generatedBy": "pi-claude-marketplace"\n}\n';

/**
 * Seeds `sources/valid-marketplace/` with a `.leftover-sentinel` file. An
 * owned leftover also carries the ownership marker, written by hand.
 */
async function arrangeLeftover(
  locations: ScopedLocations,
  options: { readonly owned: boolean },
): Promise<string> {
  const finalDir = await locations.sourceCloneDir("valid-marketplace");
  await mkdir(finalDir, { recursive: true });
  await writeFile(path.join(finalDir, ".leftover-sentinel"), "x");
  if (options.owned) {
    await mkdir(path.join(finalDir, ".git"), { recursive: true });
    await writeFile(path.join(finalDir, OWNERSHIP_MARKER), OWNERSHIP_MARKER_BYTES);
  }

  return finalDir;
}

test("MA-5: github source clones, validates, renames, mutates state, emits V2 success message with NO reload-hint trailer (SNM-33 / D-22-01)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
    const { ctx, run } = makeCtx();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "https://github.com/anthropics/claude-plugins-official#main",
      gitOps,
    });

    // assert
    assert.equal(state.cloneCalls.length, 1);
    assert.deepStrictEqual(
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
    const { ctx, run, notifications } = makeCtx();
    // Pre-create the final dir with a marker file so pathExists returns true.
    const finalDir = await locations.sourceCloneDir("valid-marketplace");
    await mkdir(finalDir, { recursive: true });
    await writeFile(path.join(finalDir, ".stale"), "x");

    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // ATTR-07: no raw throw -- the precondition routes through notify.
    // act
    await addMarketplace({
      ctx,
      run,
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

interface Ma12RecognizedOrigin {
  readonly rawSource: string;
  readonly origin: string;
}

// MA-12 / Q-03: an owned leftover is recognized when its origin names the
// source, with the host compared case-insensitively and github spellings
// folded through the parser.
const MA12_RECOGNIZED_ORIGINS: readonly Ma12RecognizedOrigin[] = [
  {
    rawSource: "anthropics/claude-plugins-official",
    origin: "https://github.com/anthropics/claude-plugins-official.git",
  },
  {
    rawSource: "anthropics/claude-plugins-official",
    origin: "https://GitHub.com/anthropics/claude-plugins-official",
  },
  {
    rawSource: "anthropics/claude-plugins-official",
    origin: "https://www.github.com/anthropics/claude-plugins-official.git",
  },
  {
    rawSource: "https://gitlab.example.com/team/mp",
    origin: "https://GitLab.Example.com/team/mp",
  },
];

for (const { rawSource, origin } of MA12_RECOGNIZED_ORIGINS) {
  test(`MA-12 / Q-03: an owned leftover whose origin is ${origin} recovers for ${rawSource}`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run, notifications } = makeCtx();
      const finalDir = await arrangeLeftover(locations, { owned: true });
      const { gitOps } = createGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
        listRemotesResult: { kind: "origin", url: origin },
      });

      // act
      await addMarketplace({ ctx, run, scope: "project", cwd, rawSource, gitOps });

      // assert
      assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
      const persisted = await loadState(locations.extensionRoot);
      assert.strictEqual(persisted.marketplaces["valid-marketplace"]?.marketplaceRoot, finalDir);
      assert.strictEqual(await pathExists(path.join(finalDir, ".leftover-sentinel")), false);
      assert.strictEqual(
        await readFile(path.join(finalDir, OWNERSHIP_MARKER), "utf8"),
        OWNERSHIP_MARKER_BYTES,
      );
    });
  });
}

test("GHB-02 / D-02: an owned leftover with a canonical origin recovers under the override", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    const { ctx, run, notifications } = makeCtx();
    const finalDir = await arrangeLeftover(locations, { owned: true });
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      listRemotesResult: {
        kind: "origin",
        url: "https://github.com/anthropics/claude-plugins-official.git",
      },
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    const persisted = await loadState(locations.extensionRoot);
    assert.strictEqual(persisted.marketplaces["valid-marketplace"]?.marketplaceRoot, finalDir);
    assert.strictEqual(await pathExists(path.join(finalDir, ".leftover-sentinel")), false);
  });
});

test("MA-13 / WR-03: a leftover without the ownership marker refuses as stale clone and stays on disk", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const finalDir = await arrangeLeftover(locations, { owned: false });
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      listRemotesResult: {
        kind: "origin",
        url: "https://github.com/anthropics/claude-plugins-official.git",
      },
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {stale clone}",
        severity: "error",
      },
    ]);
    assert.strictEqual(await pathExists(path.join(finalDir, ".leftover-sentinel")), true);
    assert.strictEqual(await pathExists(path.join(finalDir, OWNERSHIP_MARKER)), false);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
  });
});

test("Q-01: a successful add leaves the ownership marker in the clone", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const finalDir = await locations.sourceCloneDir("valid-marketplace");

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // assert
    assert.strictEqual(
      await readFile(path.join(finalDir, OWNERSHIP_MARKER), "utf8"),
      OWNERSHIP_MARKER_BYTES,
    );
  });
});

test("Q-01 / NFR-10: a staging clone whose .git is a symlink refuses the marker write", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx(0);
    const outside = path.join(cwd, "outside");
    await mkdir(outside);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      onClone: async (directory) => {
        await rm(path.join(directory, ".git"), { recursive: true, force: true });
        await symlink(outside, path.join(directory, ".git"));
      },
    });

    // act & assert
    await assert.rejects(
      addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      }),
      SymlinkRefusedError,
    );
    assert.deepStrictEqual(await readdir(outside), []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
    assert.strictEqual(
      await pathExists(await locations.sourceCloneDir("valid-marketplace")),
      false,
    );
  });
});

test("IN-06: a destination that disappears before recognition reads it proceeds to the rename", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const finalDir = await arrangeLeftover(locations, { owned: false });
    const gitOps: GitOps = {
      ...createGitOps({ fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace") }).gitOps,
      async listRemotes({ dir }) {
        await rm(dir, { recursive: true, force: true });
        return { kind: "not-a-repo" };
      },
    };

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    const persisted = await loadState(locations.extensionRoot);
    assert.strictEqual(persisted.marketplaces["valid-marketplace"]?.marketplaceRoot, finalDir);
  });
});

// MA-13: every non-matching listRemotes arm of an owned leftover still refuses
// as stale clone, and the leftover tree stays on disk. The path compares
// exactly (D-3-01), so a near-miss origin refuses exactly like a foreign tree.

interface Ma13RefusalArm {
  readonly title: string;
  readonly listRemotesResult: ListRemotesResult;
}

const MA13_REFUSAL_ARMS: readonly Ma13RefusalArm[] = [
  {
    title: "origin names a different repository",
    listRemotesResult: {
      kind: "origin",
      url: "https://github.com/anthropics/other-repo.git",
    },
  },
  {
    // The whole-string-equality guard: one extra trailing character defeats
    // a prefix match.
    title: "origin is the source identity plus one extra trailing character",
    listRemotesResult: {
      kind: "origin",
      url: "https://github.com/anthropics/claude-plugins-officialx",
    },
  },
  {
    // D-3-01: the path compares exactly, so an owner letter-case difference
    // refuses even where the host folds.
    title: "origin differs from the identity only by owner letter case",
    listRemotesResult: {
      kind: "origin",
      url: "https://github.com/Anthropics/claude-plugins-official.git",
    },
  },
  {
    title: "origin is an ssh-form remote",
    listRemotesResult: {
      kind: "origin",
      url: "git@github.com:anthropics/claude-plugins-official.git",
    },
  },
  {
    title: "origin is a garbage string",
    listRemotesResult: { kind: "origin", url: "not a url" },
  },
  {
    // canonicalCloneUrl is always a non-empty https:// string, so an empty
    // origin can only fail to match.
    title: "origin is the empty string",
    listRemotesResult: { kind: "origin", url: "" },
  },
  {
    title: "no remote is named origin",
    listRemotesResult: { kind: "no-origin" },
  },
] as const;

for (const { title, listRemotesResult } of MA13_REFUSAL_ARMS) {
  test(`MA-13: ${title} still refuses as stale clone`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run, notifications } = makeCtx();
      const finalDir = await arrangeLeftover(locations, { owned: true });

      const { gitOps } = createGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
        listRemotesResult,
      });

      // act
      await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      });

      // assert
      const note = notifications[0];
      assert.ok(note);
      assert.equal(
        note.message,
        "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {stale clone}",
      );
      assert.equal(note.severity, "error");
      assert.equal(await pathExists(path.join(finalDir, ".leftover-sentinel")), true);
    });
  });
}

// MA-13: a destination whose `.git/config` cannot be read refuses with the
// read failure's own reason on the marketplace subject, and the tree stays on
// disk. A read failure is never reported as a stale clone.

interface Ma13UnreadableArm {
  readonly listRemotesResult: ListRemotesResult;
  readonly reason: string;
}

const MA13_UNREADABLE_ARMS: readonly Ma13UnreadableArm[] = [
  { listRemotesResult: { kind: "permission-denied" }, reason: "permission denied" },
  { listRemotesResult: { kind: "unreadable" }, reason: "unreadable" },
];

for (const { listRemotesResult, reason } of MA13_UNREADABLE_ARMS) {
  test(`MA-13: a destination whose config read reports ${listRemotesResult.kind} refuses as ${reason}`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run, notifications } = makeCtx();
      const finalDir = await arrangeLeftover(locations, { owned: true });

      const { gitOps } = createGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
        listRemotesResult,
      });

      // act
      await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {${reason}}`,
          severity: "error",
        },
      ]);
      assert.equal(await pathExists(path.join(finalDir, ".leftover-sentinel")), true);
    });
  });
}

const ORIGIN_WITHOUT_URL_CONFIG =
  '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n';

// WR-11: git fetches from the first url, and the last one is the source
// identity plus `.git`.
const ORIGIN_WITH_TWO_URLS_CONFIG =
  '[remote "origin"]\n\turl = https://github.com/anthropics/other-repo.git\n\turl = https://github.com/anthropics/claude-plugins-official.git\n';

// The fake's canned `listRemotesResult` cannot express a url-less origin
// section and skips the config read that decides a multi-url origin (WR-11).
// This helper composes the real `listRemotes` so it reads the given
// `.git/config` in the destination. The destination carries the ownership
// marker, so each refusal comes from the config shape alone.
async function arrangeLeftoverWithOriginConfig(
  locations: ScopedLocations,
  config: string,
): Promise<{ finalDir: string; configPath: string; gitOps: GitOps }> {
  const finalDir = await locations.sourceCloneDir("valid-marketplace");
  const configPath = path.join(finalDir, ".git", "config");
  await mkdir(path.join(finalDir, ".git"), { recursive: true });
  await writeFile(configPath, config);
  await writeFile(path.join(finalDir, OWNERSHIP_MARKER), OWNERSHIP_MARKER_BYTES);
  const gitOps: GitOps = {
    ...createGitOps({ fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace") }).gitOps,
    listRemotes,
  };

  return { finalDir, configPath, gitOps };
}

interface LeftoverOriginConfig {
  readonly title: string;
  readonly config: string;
}

const LEFTOVER_ORIGIN_CONFIGS: readonly LeftoverOriginConfig[] = [
  {
    title: "MA-13 / ATTR-07: a leftover whose origin section names no url refuses as stale clone",
    config: ORIGIN_WITHOUT_URL_CONFIG,
  },
  {
    title: "MA-13 / WR-11: a leftover whose origin section names two urls refuses as stale clone",
    config: ORIGIN_WITH_TWO_URLS_CONFIG,
  },
];

for (const { title, config } of LEFTOVER_ORIGIN_CONFIGS) {
  test(title, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run, notifications } = makeCtx();
      const { configPath, gitOps } = await arrangeLeftoverWithOriginConfig(locations, config);

      // act
      const outcome = await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      });

      // assert
      assert.strictEqual(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {stale clone}",
          severity: "error",
        },
      ]);
      assert.strictEqual(await readFile(configPath, "utf8"), config);
      assert.deepStrictEqual(await loadState(locations.extensionRoot), {
        schemaVersion: 3,
        marketplaces: {},
      });
    });
  });
}

test("MA-13 / RECON-03: orchestrated mode reports a leftover whose origin section names no url as stale clone", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(0);
    const { finalDir, configPath, gitOps } = await arrangeLeftoverWithOriginConfig(
      locations,
      ORIGIN_WITHOUT_URL_CONFIG,
    );

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "stale clone",
      error: new StaleSourceCloneError(finalDir, "valid-marketplace"),
      cause: `stale source clone at ${finalDir}`,
    });
    assert.deepStrictEqual(notifications, []);
    assert.strictEqual(await readFile(configPath, "utf8"), ORIGIN_WITHOUT_URL_CONFIG);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
  });
});

test("MA-8: a matching leftover still yields (failed) {duplicate name}, not {stale clone}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { gitOps: gitOps1 } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps1,
    });

    const { ctx: ctx2, run: run2, notifications: n2 } = makeCtx();
    // A second source whose manifest declares the same name. The leftover's
    // origin MATCHES that source -- recognition would accept it -- but MA-8's
    // duplicate-name check (step 3) runs BEFORE recognition (step 4), so a
    // matching leftover never overrides it.
    const { gitOps: gitOps2 } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      listRemotesResult: { kind: "origin", url: "https://github.com/owner/repo.git" },
    });
    await addMarketplace({
      ctx: ctx2,
      run: run2,
      scope: "project",
      cwd,
      rawSource: "owner/repo",
      gitOps: gitOps2,
    });

    // assert
    const note = n2[0];
    assert.ok(note);
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {duplicate name}",
    );
    assert.equal(note.severity, "error");
  });
});

// MA-14: a RECOGNIZED leftover (owned, origin matches) whose removal itself
// leaks still fails as stale clone, and no partially-removed destination is
// recorded. The fault is a stub on `fs.promises.rm`, which the composition
// root's removal operations call, so the cases hold for any user, root too.

interface UnremovableLeftover {
  readonly finalDir: string;
  readonly gitOps: GitOps;
  /** The staging directory the add cloned into. */
  readonly stagingDir: () => string;
}

/**
 * Seeds an owned leftover whose origin matches the source, and makes
 * `fs.promises.rm` fail with EACCES on that leftover and, when
 * `faultStaging` holds, on the staging directory the add clones into. Every
 * other path is removed for real.
 */
async function arrangeUnremovableLeftover(
  t: TestContext,
  locations: ScopedLocations,
  options: { readonly faultStaging: boolean },
): Promise<UnremovableLeftover> {
  const finalDir = await arrangeLeftover(locations, { owned: true });
  const faulted = new Set([finalDir]);
  let cloneDir: string | undefined;
  t.mock.method(fs.promises, "rm", async (target: fs.PathLike, rmOptions?: fs.RmOptions) => {
    if (faulted.has(String(target))) {
      throw Object.assign(new Error(`EACCES: permission denied, rm '${String(target)}'`), {
        code: "EACCES",
      });
    }

    await rm(target, rmOptions);
  });
  const { gitOps } = createGitOps({
    fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    listRemotesResult: {
      kind: "origin",
      url: "https://github.com/anthropics/claude-plugins-official.git",
    },
    onClone: async (directory) => {
      cloneDir = directory;
      if (options.faultStaging) {
        faulted.add(directory);
      }

      await Promise.resolve();
    },
  });

  return {
    finalDir,
    gitOps,
    stagingDir: () => {
      assert.ok(cloneDir !== undefined, "the add never cloned");
      return cloneDir;
    },
  };
}

const UNREMOVABLE_LEFTOVER_NOTIFICATION = {
  message:
    "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {stale clone}\n\n    failed to clean up marketplace leftover clone at valid-marketplace: EACCES: permission denied, rm 'valid-marketplace'",
  severity: "error",
};

for (const { kind, faultStaging } of [
  { kind: "the leftover", faultStaging: false },
  { kind: "the leftover and the staging clone", faultStaging: true },
]) {
  test(`MA-14 / WR-02: standalone mode names only the leftover cleanup failure when removing ${kind} fails`, async (t) => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run, notifications } = makeCtx();
      const { finalDir, gitOps } = await arrangeUnremovableLeftover(t, locations, {
        faultStaging,
      });

      // act
      await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
      });

      // assert
      assert.deepStrictEqual(notifications, [UNREMOVABLE_LEFTOVER_NOTIFICATION]);
      assert.deepStrictEqual(await loadState(locations.extensionRoot), {
        schemaVersion: 3,
        marketplaces: {},
      });
      assert.strictEqual(await pathExists(path.join(finalDir, ".leftover-sentinel")), true);
    });
  });
}

test("MA-14: orchestrated mode carries the leftover cleanup failure in the cause", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(0);
    const { finalDir, gitOps } = await arrangeUnremovableLeftover(t, locations, {
      faultStaging: false,
    });
    const leak = `failed to clean up marketplace leftover clone at ${finalDir}: EACCES: permission denied, rm '${finalDir}'`;
    const cause = `stale source clone at ${finalDir} (additionally: ${leak})`;

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "stale clone",
      error: new CleanupLeakError(
        new UnremovableLeftoverCloneError(finalDir, "valid-marketplace", leak),
        leak,
      ),
      cause,
    });
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
    assert.strictEqual(await pathExists(path.join(finalDir, ".leftover-sentinel")), true);
  });
});

test("MA-14: orchestrated mode joins both cleanup failures behind one Error.cause level", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(0);
    const { finalDir, gitOps, stagingDir } = await arrangeUnremovableLeftover(t, locations, {
      faultStaging: true,
    });
    const leak = `failed to clean up marketplace leftover clone at ${finalDir}: EACCES: permission denied, rm '${finalDir}'`;

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    const staging = stagingDir();
    const cause = `stale source clone at ${finalDir} (additionally: ${leak}; failed to clean up marketplace clone staging at ${staging}: EACCES: permission denied, rm '${staging}')`;
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "stale clone",
      error: new CleanupLeakError(
        new UnremovableLeftoverCloneError(finalDir, "valid-marketplace", leak),
        `${leak}; failed to clean up marketplace clone staging at ${staging}: EACCES: permission denied, rm '${staging}'`,
      ),
      cause,
    });
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
    assert.strictEqual(await pathExists(path.join(finalDir, ".leftover-sentinel")), true);
  });
});

test("MPA-01: a same-source add into the declaring layer is skipped as already added before any clone and returns unchanged when orchestrated", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx(0);
    const { gitOps: gitOps1 } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const { ctx: ctx2, run: run2, notifications: n2 } = makeCtx(0);
    const { gitOps: gitOps2, state: gitState2 } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const declaration = makeCtx();
    const standalone = makeCtx();
    const completionCache = createCompletionCacheRecorder();

    // act
    const added = await addMarketplaceWithCache({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps1,
      notifications: { mode: "orchestrated" },
      completionCache: completionCache.cache,
    });
    completionCache.clearCalls();

    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const unchanged = await addMarketplaceWithCache({
      ctx: ctx2,
      run: run2,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps2,
      notifications: { mode: "orchestrated" },
      completionCache: completionCache.cache,
    });
    const configAfterOrchestrated = await pathExists(locations.baseConfigJsonPath);
    await addMarketplace({
      ctx: declaration.ctx,
      run: declaration.run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps2,
    });
    const configBeforeStandalone = await readFile(locations.baseConfigJsonPath, "utf8");
    await addMarketplace({
      ctx: standalone.ctx,
      run: standalone.run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps2,
    });

    // assert
    assert.deepStrictEqual(added, { status: "added", name: "valid-marketplace" });
    assert.deepStrictEqual(unchanged, { status: "unchanged", name: "valid-marketplace" });
    assert.deepStrictEqual(n2, []);
    assert.deepStrictEqual(declaration.notifications, [
      { message: "● valid-marketplace [project] (added)" },
    ]);
    assert.deepStrictEqual(standalone.notifications, [
      { message: "● valid-marketplace [project] (skipped) {already added}" },
    ]);
    assert.deepStrictEqual(gitState2.cloneCalls, []);
    assert.deepStrictEqual(completionCache.calls, []);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.strictEqual(configAfterOrchestrated, false);
    assert.strictEqual(
      await readFile(locations.baseConfigJsonPath, "utf8"),
      configBeforeStandalone,
    );
  });
});

test("accepts a path marketplace with an allowed dependency marketplace", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "allowed-marketplace");
    const manifestDirectory = path.join(marketplaceRoot, ".claude-plugin");
    await mkdir(manifestDirectory, { recursive: true });
    await writeFile(
      path.join(manifestDirectory, "marketplace.json"),
      JSON.stringify({
        name: "allowed-marketplace",
        plugins: [],
        allowCrossMarketplaceDependenciesOn: ["tools"],
      }),
    );
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state } = createGitOps();

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: marketplaceRoot, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● allowed-marketplace [project] (added)" }]);
    assert.deepStrictEqual(Object.keys((await loadState(locations.extensionRoot)).marketplaces), [
      "allowed-marketplace",
    ]);
    assert.deepStrictEqual(state.cloneCalls, []);
  });
});

/** Writes a path marketplace whose manifest declares `name` and no plugins. */
async function writeNamedPathMarketplace(cwd: string, name: string): Promise<string> {
  const marketplaceRoot = path.join(cwd, "named-marketplace");
  const manifestDirectory = path.join(marketplaceRoot, ".claude-plugin");
  await mkdir(manifestDirectory, { recursive: true });
  await writeFile(
    path.join(manifestDirectory, "marketplace.json"),
    JSON.stringify({ name, plugins: [] }),
  );
  return marketplaceRoot;
}

for (const { name, refusal } of [
  {
    name: "claude-plugins-v2",
    refusal: "Marketplace name impersonates an official Anthropic/Claude marketplace",
  },
  {
    name: "NPM",
    refusal:
      'Marketplace name "npm" is reserved for plugins installed from an npm registry (`<package>@npm`); remove this marketplace and add it again under another name',
  },
  {
    name: "claudeai-tools",
    refusal:
      'Cannot add marketplace "claudeai-tools": names starting with "claudeai-" are reserved for marketplaces hosted on claude.ai.',
  },
  {
    name: "claude.code.plugins",
    refusal:
      '"claude.code.plugins" is another spelling of "claude-code-plugins", a reserved marketplace name.',
  },
  {
    name: "constructor",
    refusal:
      'Cannot add marketplace "constructor": Claude Code reserves this name and cannot register a marketplace under it. The name is set by "name" in the marketplace\'s marketplace.json; ask its maintainer to change it.',
  },
]) {
  test(`D-PL5-28: refuses a path marketplace whose manifest declares ${name} with Claude Code's sentence`, async (t) => {
    await createHermeticEnvironment(t, "mp-add-refused-name-home-");
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const marketplaceRoot = await writeNamedPathMarketplace(cwd, name);
      const { ctx, run, notifications } = makeCtx();
      const { gitOps } = createGitOps();

      // act
      await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: marketplaceRoot, gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "Some operations have failed.\n\n" +
            `⊘ ${marketplaceRoot} [project] (failed)\n` +
            `  ⊘ ${marketplaceRoot} (failed) {invalid manifest}\n` +
            `    cause: ${refusal}`,
          severity: "error",
        },
      ]);
      assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces, {});
    });
  });
}

test("MPA-01 / D-PL5-28: a constructor marketplace an earlier version recorded is still already added", async (t) => {
  await createHermeticEnvironment(t, "mp-add-constructor-dup-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = await writeNamedPathMarketplace(cwd, "constructor");
    await saveState(locations.extensionRoot, {
      schemaVersion: 3,
      marketplaces: {
        constructor: {
          name: "constructor",
          scope: "project" as const,
          source: { kind: "path", raw: marketplaceRoot, logical: marketplaceRoot },
          addedFromCwd: cwd,
          manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot,
          plugins: {},
        },
      },
    });
    await writeFile(
      locations.baseConfigJsonPath,
      declaredMarketplaceBytes("constructor", marketplaceRoot),
    );
    const { ctx, run, notifications } = makeCtx();

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: marketplaceRoot,
      gitOps: createGitOps().gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● constructor [project] (skipped) {already added}" },
    ]);
    assert.deepStrictEqual(Object.keys((await loadState(locations.extensionRoot)).marketplaces), [
      "constructor",
    ]);
  });
});

test("D-08-07: refuses a path marketplace named __proto__ as an invalid manifest", async (t) => {
  await createHermeticEnvironment(t, "mp-add-proto-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = await writeNamedPathMarketplace(cwd, "__proto__");
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps();

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: marketplaceRoot, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n" +
          `⊘ ${marketplaceRoot} [project] (failed) {invalid manifest}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces, {});
  });
});

test("D-08-07: refuses a cloned marketplace named __proto__ as an invalid manifest", async (t) => {
  await createHermeticEnvironment(t, "mp-add-proto-clone-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const fixtureSourceDir = await writeNamedPathMarketplace(cwd, "__proto__");
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({ fixtureSourceDir });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n" +
          "⊘ anthropics/claude-plugins-official [project] (failed) {invalid manifest}",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces, {});
  });
});

test("MKT-01: refuses a path marketplace named claude-plugins-official with Claude Code's sentence", async (t) => {
  await createHermeticEnvironment(t, "mp-add-reserved-path-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = await writeNamedPathMarketplace(cwd, "claude-plugins-official");
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps();

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: marketplaceRoot, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          `⊘ ${marketplaceRoot} [project] (failed)\n` +
          `  ⊘ ${marketplaceRoot} (failed) {invalid manifest}\n` +
          "    cause: The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization.",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces, {});
    assert.deepStrictEqual(await readdir(locations.scopeRoot, { recursive: true }), [
      "pi-claude-marketplace",
    ]);
  });
});

test("MKT-01: refuses a reserved name cloned from another github owner and leaves no clone", async (t) => {
  await createHermeticEnvironment(t, "mp-add-reserved-github-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const fixtureSourceDir = await writeNamedPathMarketplace(cwd, "healthcare");
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({ fixtureSourceDir });

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: "acme/mp", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          "⊘ acme/mp [project] (failed)\n" +
          "  ⊘ acme/mp (failed) {invalid manifest}\n" +
          "    cause: The name 'healthcare' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name.",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces, {});
    assert.deepStrictEqual((await readdir(locations.scopeRoot, { recursive: true })).sort(), [
      "pi-claude-marketplace",
      path.join("pi-claude-marketplace", "sources-staging"),
    ]);
  });
});

test("MKT-01: records a reserved name cloned from the anthropics organization", async (t) => {
  await createHermeticEnvironment(t, "mp-add-reserved-anthropics-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const fixtureSourceDir = await writeNamedPathMarketplace(cwd, "claude-plugins-official");
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({ fixtureSourceDir });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● claude-plugins-official [project] (added)" },
    ]);
    assert.deepStrictEqual(Object.keys((await loadState(locations.extensionRoot)).marketplaces), [
      "claude-plugins-official",
    ]);
  });
});

test("MKT-01: orchestrated mode fails a reserved name as an invalid manifest", async (t) => {
  await createHermeticEnvironment(t, "mp-add-reserved-orchestrated-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = await writeNamedPathMarketplace(cwd, "Claude-Plugin-Directory");
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps } = createGitOps();
    const expectedCause =
      "The name 'Claude-Plugin-Directory' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization.";

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: marketplaceRoot,
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.ok(outcome.status === "failed");
    assert.strictEqual(outcome.reason, "invalid manifest");
    assert.ok(outcome.error instanceof InvalidMarketplaceManifestError);
    assert.strictEqual(outcome.error.message, expectedCause);
    assert.strictEqual(outcome.cause, expectedCause);
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces, {});
  });
});

test("rejects a path marketplace with a scalar dependency allowlist", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "invalid-allowlist");
    const manifestDirectory = path.join(marketplaceRoot, ".claude-plugin");
    await mkdir(manifestDirectory, { recursive: true });
    await writeFile(
      path.join(manifestDirectory, "marketplace.json"),
      JSON.stringify({
        name: "invalid-allowlist",
        plugins: [],
        allowCrossMarketplaceDependenciesOn: "tools",
      }),
    );
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state } = createGitOps();

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: marketplaceRoot, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n" +
          `⊘ ${marketplaceRoot} [project] (failed) {invalid manifest}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces, {});
    assert.deepStrictEqual(state.cloneCalls, []);
  });
});

test("MA-9 / MPA-02: a malformed manifest after clone renders (failed) {unparseable}; cleanupStaging still runs", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("invalid-manifest"),
    });

    // ATTR-07: no raw throw escapes -- the precondition routes through notify.
    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    // (1) Routed through notify as a structured (failed) {unparseable} row.
    //     Pre-name failure (manifest unreadable, so no derived name) -> subject
    //     is the raw source string (A2).
    const note = notifications[0];
    // assert
    assert.ok(note, "addMarketplace should notify on invalid manifest");
    assert.equal(
      note.message,
      "A marketplace operation has failed.\n\n" +
        "⊘ anthropics/claude-plugins-official [project] (failed) {unparseable}",
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

test("classifies a malformed manifest through a staging-cleanup leak and preserves the leaked tree", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    let stagingRoot = "";
    const { gitOps, state } = createGitOps({
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
        run,
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
          "⊘ anthropics/claude-plugins-official [project] (failed) {unparseable}",
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
      schemaVersion: 3,
      marketplaces: {},
    });
  });
});

test("MA-10 / ATTR-07: unknown source kind renders (failed) {unsupported source}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state } = createGitOps();

    // ATTR-07: no raw throw -- the unsupported-source precondition routes
    // through notify on the raw source subject (pre-clone, pre-name -> A2).
    // act
    await addMarketplace({
      ctx,
      run,
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
      const { ctx, run, notifications } = makeCtx(0);
      const { gitOps, state } = createGitOps();
      const expectedError = new UnsupportedSourceError(
        `Cannot add marketplace from "[object Object]": unsupported source kind ${source.kind}`,
      );

      // act
      const outcome = await addMarketplace({
        ctx,
        run,
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
        schemaVersion: 3,
        marketplaces: {},
      });
    });
  });
}

test("NFR-5: path-source add never calls gitOps", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    // Set up a local marketplace fixture by copying the valid-marketplace fixture
    // into a non-pi-claude-marketplace location and pointing rawSource at it.
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-local-"));
    try {
      const fixtureSrc = fixtureMarketplaceDir("valid-marketplace");
      await cp(fixtureSrc, localMpDir, { recursive: true });

      const { gitOps, state } = createGitOps();

      // Use absolute path so domain/source.ts classifies as path source.
      // act
      await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: localMpDir, gitOps });

      // Zero gitOps calls (NFR-5).
      // assert
      assert.equal(state.cloneCalls.length, 0);
      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.forceUpdateRefCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
      assert.equal(state.resolveRefCalls.length, 0);

      // State updated; success notification emitted.
      const persisted = await loadState(locations.extensionRoot);
      const record = persisted.marketplaces["valid-marketplace"];
      assert.ok(record);
      const { lastUpdatedAt, ...stableRecord } = record;
      assert.deepStrictEqual(stableRecord, {
        name: "valid-marketplace",
        scope: "project",
        source: { kind: "path", raw: localMpDir, logical: localMpDir },
        addedFromCwd: cwd,
        manifestPath: path.join(localMpDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: localMpDir,
        plugins: {},
        lastSuccessfulManifest: VALID_MANIFEST_JSON,
      });
      assert.match(lastUpdatedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
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
    const { ctx, run, notifications } = makeCtx(0);

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
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
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps, state } = createGitOps();
    const originalDirname = path.dirname.bind(path);
    t.mock.method(path, "dirname", (value: string) => {
      if (value === locations.baseConfigJsonPath) {
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
        run,
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
      schemaVersion: 3,
      marketplaces: {},
    });
  });
});

test("MA-3: path source accepts a direct path to marketplace.json (not just the directory)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-local-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });
      const directManifestPath = path.join(localMpDir, ".claude-plugin", "marketplace.json");
      const { gitOps } = createGitOps();

      // act
      await addMarketplace({
        ctx,
        run,
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

for (const manifestDirectory of [".claude-plugin", "catalog"]) {
  test(`resolves a relative ${manifestDirectory} file against the supplied working directory`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const marketplaceRoot = path.join(cwd, "local");
      const manifestPath = path.join(marketplaceRoot, manifestDirectory, "marketplace.json");
      await mkdir(path.dirname(manifestPath), { recursive: true });
      const comparisonJson = '{"name":"tools","plugins":[],"vendor":{"enabled":true}}';
      await writeFile(manifestPath, comparisonJson);
      const rawSource = `./local/${manifestDirectory}/marketplace.json`;
      const { ctx, run, notifications } = makeCtx();
      const gitOps = mock<GitOps>({ name: "unused git operations" });

      // act
      await addMarketplace({ ctx, run, scope: "project", cwd, rawSource, gitOps });
      const persisted = await loadState(locations.extensionRoot);

      // assert
      const record = persisted.marketplaces.tools;
      assert.ok(record);
      const { lastUpdatedAt, ...stableRecord } = record;
      assert.deepStrictEqual(stableRecord, {
        name: "tools",
        scope: "project",
        source: { kind: "path", raw: rawSource, logical: rawSource },
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {},
        lastSuccessfulManifest: comparisonJson,
      });
      assert.match(lastUpdatedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      assert.deepStrictEqual(notifications, [{ message: "● tools [project] (added)" }]);
      verify(gitOps);
    });
  });
}

test("MA-4: tilde paths are preserved verbatim in stored source.raw", async () => {
  // We don't actually resolve the tilde to a real homedir -- just verify
  // the parser's source.raw is preserved (the actual disk read happens
  // through ParsedSource.resolved, which expandTilde already handled).
  // This test documents the contract; the parser test in
  // test/domain/source.test.ts is the deeper coverage.
  // arrange
  const { pathSource } = await import("../../../extensions/pi-claude-marketplace/domain/source.ts");
  // act
  const source = pathSource("~/projects/local-mp");
  // assert
  assert.equal(source.raw, "~/projects/local-mp"); // verbatim
});

test("CR-02 / MA-4: ~/path is expanded against $HOME for the on-disk probe; source.raw stays verbatim", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    // Stand up a hermetic HOME containing the fixture so that
    // "~/projects/local-mp" resolves to a real directory.
    const { home } = await createHermeticEnvironment(t, "mp-add-home-");
    const tildeRelDir = path.join("projects", "local-mp");
    const localMpDir = path.join(home, tildeRelDir);
    await mkdir(path.dirname(localMpDir), { recursive: true });
    await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

    const { gitOps, state } = createGitOps();
    // act
    await addMarketplace({
      ctx,
      run,
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
  });
});

test("MA-2 / SC-5 / CMC-30: orchestrator accepts scope='project'; success row carries `[project]` scope bracket", async () => {
  // The edge layer defaults --scope to "user". This test
  // confirms the orchestrator threads the value through verbatim.
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // Use project scope so we get a real tmp scope root; the assertion
    // is just that the scope is reflected in the success row's
    // `[<scope>]` token per the compact-line grammar (MSG-GR-1).
    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: "owner/repo", gitOps });
    const note = notifications[0];
    // assert
    assert.ok(note);
    assert.ok(note.message.includes("[project]"));
  });
});

test("D-03-INV :: add invalidates marketplace-names cache for the new scope", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const cachePath = locations.marketplaceNamesCacheFile;
    const unrelatedPath = path.join(locations.cacheDir, "unrelated.json");
    const unrelatedBytes = '{"preserved":true}\n';
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, '{"schemaVersion":2,"names":["stale-mp"]}\n', "utf8");
    await writeFile(unrelatedPath, unrelatedBytes, "utf8");

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });
    const persisted = await loadState(locations.extensionRoot);
    const recorded = persisted.marketplaces["valid-marketplace"];
    assert.ok(recorded);
    const { lastUpdatedAt, ...stableRecord } = recorded;
    const config = await loadConfig(locations.baseConfigJsonPath);
    const tree = (await readdir(locations.scopeRoot, { recursive: true })).sort();
    const sourceRoot = await locations.sourceCloneDir("valid-marketplace");

    // assert
    assert.strictEqual(outcome, undefined);
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    assert.deepStrictEqual(
      { ...persisted, marketplaces: { "valid-marketplace": stableRecord } },
      {
        schemaVersion: 3,
        marketplaces: {
          "valid-marketplace": {
            name: "valid-marketplace",
            scope: "project",
            source: {
              kind: "github",
              raw: "anthropics/claude-plugins-official",
              owner: "anthropics",
              repo: "claude-plugins-official",
            },
            addedFromCwd: cwd,
            manifestPath: path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: sourceRoot,
            plugins: {},
            lastSuccessfulManifest: VALID_MANIFEST_JSON,
          },
        },
      },
    );
    assert.match(lastUpdatedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.deepStrictEqual(config, {
      status: "valid",
      filePath: locations.baseConfigJsonPath,
      config: {
        schemaVersion: 1,
        marketplaces: {
          "valid-marketplace": { source: "anthropics/claude-plugins-official" },
        },
      },
    });
    assert.deepStrictEqual(tree, [
      "claude-plugins.json",
      "pi-claude-marketplace",
      path.join("pi-claude-marketplace", "cache"),
      path.join("pi-claude-marketplace", "cache", "unrelated.json"),
      path.join("pi-claude-marketplace", "sources"),
      path.join("pi-claude-marketplace", "sources-staging"),
      path.join("pi-claude-marketplace", "sources", "valid-marketplace"),
      path.join("pi-claude-marketplace", "sources", "valid-marketplace", ".claude-plugin"),
      path.join(
        "pi-claude-marketplace",
        "sources",
        "valid-marketplace",
        ".claude-plugin",
        "marketplace.json",
      ),
      path.join("pi-claude-marketplace", "sources", "valid-marketplace", ".git"),
      path.join(
        "pi-claude-marketplace",
        "sources",
        "valid-marketplace",
        ".git",
        "pi-claude-marketplace.json",
      ),
      path.join("pi-claude-marketplace", "state.json"),
    ]);
    await assert.rejects(() => readFile(cachePath, "utf8"), { code: "ENOENT" });
    assert.strictEqual(await readFile(unrelatedPath, "utf8"), unrelatedBytes);
  });
});

test("invalidates names before the plugin index only after the add is durable", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    let durableAtFirstInvalidation = false;
    const recorder = createCompletionCacheRecorder({
      onCall: async (call) => {
        if (call.kind !== "names") {
          return;
        }

        const persisted = await loadState(locations.extensionRoot);
        const config = await loadConfig(locations.baseConfigJsonPath);
        durableAtFirstInvalidation =
          persisted.marketplaces["valid-marketplace"] !== undefined &&
          config.status === "valid" &&
          config.config.marketplaces?.["valid-marketplace"]?.source ===
            "anthropics/claude-plugins-official" &&
          (await pathExists(await locations.sourceCloneDir("valid-marketplace")));
      },
    });

    // act
    const outcome = await addMarketplaceWithCache({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      completionCache: recorder.cache,
    });

    // assert
    assert.strictEqual(outcome, undefined);
    assert.strictEqual(durableAtFirstInvalidation, true);
    assert.deepStrictEqual(recorder.calls, [
      {
        kind: "names",
        cachePath: locations.marketplaceNamesCacheFile,
        scope: "project",
      },
      {
        kind: "plugins",
        cachePath: await locations.pluginCacheFile("valid-marketplace"),
        scope: "project",
        marketplace: "valid-marketplace",
      },
    ]);
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
  });
});

test("does not invalidate an unchanged add through the same cache owner", async () => {
  const localMarketplace = await mkdtemp(path.join(tmpdir(), "mp-add-duplicate-"));
  try {
    await cp(fixtureMarketplaceDir("valid-marketplace"), localMarketplace, { recursive: true });
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const firstBoundary = makeCtx(0);
      const secondBoundary = makeCtx(0);
      const { gitOps } = createGitOps();
      const recorder = createCompletionCacheRecorder();
      const firstOutcome = await addMarketplaceWithCache({
        ctx: firstBoundary.ctx,
        run: firstBoundary.run,
        scope: "project",
        cwd,
        rawSource: localMarketplace,
        gitOps,
        completionCache: recorder.cache,
        notifications: { mode: "orchestrated" },
      });
      recorder.clearCalls();
      const stateBeforeDuplicate = await readFile(locations.stateJsonPath, "utf8");
      const configBeforeDuplicate = await loadConfig(locations.baseConfigJsonPath);
      const treeBeforeDuplicate = (await readdir(locations.scopeRoot, { recursive: true })).sort();

      // act
      const duplicateOutcome = await addMarketplaceWithCache({
        ctx: secondBoundary.ctx,
        run: secondBoundary.run,
        scope: "project",
        cwd,
        rawSource: localMarketplace,
        gitOps,
        completionCache: recorder.cache,
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepStrictEqual(firstOutcome, { status: "added", name: "valid-marketplace" });
      assert.deepStrictEqual(duplicateOutcome, {
        status: "unchanged",
        name: "valid-marketplace",
      });

      assert.deepStrictEqual(recorder.calls, []);
      assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBeforeDuplicate);
      assert.deepStrictEqual(await loadConfig(locations.baseConfigJsonPath), configBeforeDuplicate);
      assert.deepStrictEqual(
        (await readdir(locations.scopeRoot, { recursive: true })).sort(),
        treeBeforeDuplicate,
      );
      assert.deepStrictEqual(firstBoundary.notifications, []);
      assert.deepStrictEqual(secondBoundary.notifications, []);
    });
  } finally {
    await rm(localMarketplace, { recursive: true, force: true });
  }
});

test("does not invalidate when source validation fails before commit", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps } = createGitOps();
    const recorder = createCompletionCacheRecorder();
    const missingSource = path.join(cwd, "missing-marketplace");

    // act
    const outcome = await addMarketplaceWithCache({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: missingSource,
      gitOps,
      completionCache: recorder.cache,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.strictEqual(outcome.status, "failed");
    if (outcome.status === "failed") {
      assert.strictEqual(outcome.reason, "source missing");
    }

    assert.deepStrictEqual(recorder.calls, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
    assert.deepStrictEqual(await loadConfig(locations.baseConfigJsonPath), {
      status: "absent",
    });
    assert.deepStrictEqual(notifications, []);
  });
});

test("swallows each cache hygiene failure without rewriting the durable add", async (t) => {
  for (const failAt of ["names", "plugins"] as const) {
    await t.test(failAt, async () => {
      await withTmpScope(async ({ cwd, locations }) => {
        // arrange
        const { ctx, run, notifications } = makeCtx();
        const { gitOps } = createGitOps({
          fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
        });
        let committedStateBytes: string | undefined;
        let committedConfigBytes: string | undefined;
        let committedTree: string[] | undefined;
        const recorder = createCompletionCacheRecorder({
          failAt,
          onCall: async (call) => {
            if (call.kind !== "names") {
              return;
            }

            committedStateBytes = await readFile(locations.stateJsonPath, "utf8");
            committedConfigBytes = await readFile(locations.baseConfigJsonPath, "utf8");
            committedTree = (await readdir(locations.scopeRoot, { recursive: true })).sort();
          },
        });

        // act
        const outcome = await addMarketplaceWithCache({
          ctx,
          run,
          scope: "project",
          cwd,
          rawSource: "anthropics/claude-plugins-official",
          gitOps,
          completionCache: recorder.cache,
        });

        // assert
        assert.strictEqual(outcome, undefined);
        assert.notStrictEqual(committedStateBytes, undefined);
        assert.notStrictEqual(committedConfigBytes, undefined);
        assert.notStrictEqual(committedTree, undefined);
        assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), committedStateBytes);
        assert.strictEqual(
          await readFile(locations.baseConfigJsonPath, "utf8"),
          committedConfigBytes,
        );
        assert.deepStrictEqual(
          (await readdir(locations.scopeRoot, { recursive: true })).sort(),
          committedTree,
        );
        assert.deepStrictEqual(
          recorder.calls.map((call) => call.kind),
          failAt === "names" ? ["names"] : ["names", "plugins"],
        );
        assert.strictEqual(
          await pathExists(await locations.sourceCloneDir("valid-marketplace")),
          true,
        );
        assert.deepStrictEqual(notifications, [
          { message: "● valid-marketplace [project] (added)" },
        ]);
      });
    });
  }
});

test("keeps a committed path add successful when marketplace-name cache cleanup fails", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const localMarketplace = await mkdtemp(path.join(cwd, "cache-failure-marketplace-"));
    await cp(fixtureMarketplaceDir("valid-marketplace"), localMarketplace, { recursive: true });
    await mkdir(locations.marketplaceNamesCacheFile, { recursive: true });
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps, state } = createGitOps();

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
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
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps, state } = createGitOps();

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
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
    const { ctx, run, notifications } = makeCtx();
    const socketPath = path.join(tmpdir(), `mp-add-sock-${process.pid}.sock`);
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.on("error", reject);
      server.listen(socketPath, resolve);
    });
    try {
      const { gitOps } = createGitOps();
      // act
      await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: socketPath, gitOps });

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
        // already gone
      });
    }
  });
});

// ATTR-07 (S5e): a path source that does not exist (ENOENT) renders
// (failed) {source missing} on the raw source subject (pre-name).
test("ATTR-07: a missing path source (ENOENT) renders (failed) {source missing}", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const missingDir = path.join(tmpdir(), `mp-add-absent-${process.pid}-${Date.now()}`, "nope");
    const { gitOps, state } = createGitOps();

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: missingDir, gitOps });

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

test("D-PL5-18: a path marketplace whose manifest is a directory renders (failed) {unreadable}", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "dir-manifest");
    await mkdir(path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"), {
      recursive: true,
    });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state } = createGitOps();

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: marketplaceRoot,
      gitOps,
    });

    // assert
    assert.strictEqual(outcome, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message: `A marketplace operation has failed.\n\n⊘ ${marketplaceRoot} [project] (failed) {unreadable}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces, {});
    assert.strictEqual(await pathExists(locations.baseConfigJsonPath), false);
    assert.deepStrictEqual(state.cloneCalls, []);
  });
});

test("MPA-01 (path source): a same-source add in the same scope is skipped as already added", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx: ctx1, run: run1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-dup-path-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });

      const { gitOps: gitOps1 } = createGitOps();
      // act
      await addMarketplace({
        ctx: ctx1,
        run: run1,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2, run: run2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = createGitOps();
      await addMarketplace({
        ctx: ctx2,
        run: run2,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps2,
      });

      // assert
      assert.deepStrictEqual(n2, [
        { message: "● valid-marketplace [project] (skipped) {already added}" },
      ]);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

// expandTildePath returns os.homedir() exactly when rawSource is bare '~'.
test("CR-02 / expandTildePath: bare '~' resolves to os.homedir() exactly", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { home } = await createHermeticEnvironment(t, "mp-add-baretilde-");
    // Copy valid-marketplace fixture directly into the hermetic HOME
    // so '~' (which resolves to home) is the marketplace root.
    await cp(fixtureMarketplaceDir("valid-marketplace"), home, { recursive: true });

    const { gitOps } = createGitOps();
    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: "~", gitOps });

    const persisted = await loadState(locations.extensionRoot);
    // assert
    assert.ok("valid-marketplace" in persisted.marketplaces);
    const recorded = persisted.marketplaces["valid-marketplace"];
    assert.ok(recorded);
    // marketplaceRoot must be the hermetic HOME (os.homedir() at call time).
    assert.equal(recorded.marketplaceRoot, home);
  });
});

// CMP-1: same marketplace name may exist independently in user and project scopes.
// The duplicate-name guard (MA-8) is scope-local only.
test("CMP-1: same marketplace name in user scope and project scope are independent (cross-scope add succeeds)", async (t) => {
  await createHermeticEnvironment(t, "mp-add-cmp1-home-");
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx: ctx1, run: run1, notifications: n1 } = makeCtx();
    const { gitOps: gitOps1 } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // act
    await addMarketplace({
      ctx: ctx1,
      run: run1,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: gitOps1,
    });
    // assert
    assert.equal(n1[0]?.severity, undefined, "project-scope add emits no error");

    const { ctx: ctx2, run: run2, notifications: n2 } = makeCtx();
    const { gitOps: gitOps2 } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    // Same marketplace name but user scope -- MUST NOT throw MarketplaceDuplicateNameError.
    await addMarketplace({
      ctx: ctx2,
      run: run2,
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
});

// -----------------------------------------------------------------------
// AUTH-01 auth-wiring tests
// -----------------------------------------------------------------------

test("AUTH-01 add: credentialOps.fill HIT bypasses Device Flow and clones with the auth bundle", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();

    // Pre-seed a stored credential for github.com so fill returns a HIT.
    const { credOps: credentialOps, state: credState } = createCredentialOps({
      store: new Map([["github.com", { username: "x-access-token", password: "stored-token" }]]),
    });

    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
    const credentials = await cbs.onAuth("https://github.com/owner/repo.git");
    assert.deepStrictEqual(credentials, { username: "x-access-token", password: "stored-token" });

    // fill consulted exactly once via the onAuth call above.
    assert.equal(credState.fillCalls.length, 1);
    assert.equal(credState.fillCalls[0]?.host, "github.com");

    // No Device Flow prompt emitted: only the post-add success notification.
    assert.equal(
      notifications.filter((n) => n.message.startsWith("Open ")).length,
      0,
      "Device Flow prompt must NOT fire on a fill HIT",
    );
  });
});

test("AUTH-01 add: credentialOps.fill MISS triggers Device Flow which produces a token via initiateDeviceFlow", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(2, 3);

    // Empty store -> fill returns null (MISS).
    const { credOps: credentialOps, state: credState } = createCredentialOps();

    // Device Flow http mock: immediate success poll.
    const { http: deviceFlowHttp } = createDeviceFlowHttp({
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

    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
    const credentials = await cbs.onAuth("https://github.com/owner/repo.git");
    assert.deepStrictEqual(
      credentials,
      { username: "x-access-token", password: "gho_test_token_AUTH01" },
      "Device Flow must produce the mocked token",
    );

    // The Device Flow prompt must carry the byte-exact catalog text.
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
    const { ctx, run } = makeCtx();

    const { credOps: credentialOps } = createCredentialOps();

    const { http: deviceFlowHttp } = createDeviceFlowHttp();

    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
    assert.equal(state.cloneCalls[0]?.auth?.kind, "device-flow");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// RECON-03: orchestrated-mode coverage
// ───────────────────────────────────────────────────────────────────────────

test("RECON-03 orchestrated mode -- github source success returns { status: 'added' } with ZERO notify calls", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
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
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state } = createGitOps();

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
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

const NO_GIT_CALLS = {
  checkoutCalls: [],
  cloneCalls: [],
  fetchCalls: [],
  forceUpdateRefCalls: [],
  resolveRefCalls: [],
};

test("FLR-02: an add under a held state lock reports lock held and clones nothing", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(1);
    const { gitOps, state } = createGitOps();

    // act
    const outcome = await whileLockHeld(locations, () =>
      addMarketplace({ ctx, run, scope: "project", cwd, rawSource: "owner/repo", gitOps }),
    );

    // assert
    assert.strictEqual(outcome, undefined);
    assert.deepStrictEqual(notifications, [
      {
        message: `Some operations have failed.\n\n⊘ owner/repo [project] (failed)\n  ⊘ owner/repo (failed) {lock held}\n    cause: ${lockHeldCause(locations)} -> Lock file is already being held`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(state, NO_GIT_CALLS);
    assert.deepStrictEqual(
      [await pathExists(locations.stateJsonPath), await pathExists(locations.baseConfigJsonPath)],
      [false, false],
    );
  });
});

test("FLR-02: an orchestrated add under a held state lock returns lock held and clones nothing", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps, state } = createGitOps();

    // act
    const outcome = await whileLockHeld(locations, () =>
      addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "owner/repo",
        gitOps,
        notifications: { mode: "orchestrated" },
      }),
    );

    // assert
    assert.ok(outcome.status === "failed");
    const { error, ...failure } = outcome;
    assert.deepStrictEqual(failure, {
      status: "failed",
      reason: "lock held",
      cause: lockHeldCause(locations),
    });
    assert.ok(error instanceof StateLockHeldError);
    assert.deepStrictEqual([error.scope, error.lockPath], ["project", locations.stateLockFile]);
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(state, NO_GIT_CALLS);
    assert.deepStrictEqual(
      [await pathExists(locations.stateJsonPath), await pathExists(locations.baseConfigJsonPath)],
      [false, false],
    );
  });
});

test("FLR-02: a lock-held add's JSON child row takes the source as typed as its id", async (t) => {
  await createHermeticEnvironment(t, "mp-add-lock-held-json-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const capture = createJsonCapture();
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    when(() => ctx.mode)
      .thenReturn("json")
      .once();
    const inventory = mock<
      Pick<Parameters<typeof openNotificationRun>[0], "getAllTools" | "getCommands">
    >({ exactParams: true, name: "inventory" });
    when(() => inventory.getAllTools())
      .thenReturn([])
      .times(3);
    when(() => inventory.getCommands())
      .thenReturn([])
      .once();
    const run = openNotificationRun(
      {
        getAllTools: () => inventory.getAllTools(),
        getCommands: () => inventory.getCommands(),
        appendEntry: capture.entrySink.appendEntry,
      },
      { kind: "command", commandId: "plugin", invocationId: "test-run" },
    );
    const { gitOps, state } = createGitOps();

    // act
    await whileLockHeld(locations, () =>
      addMarketplace({ ctx, run, scope: "project", cwd, rawSource: "owner/repo", gitOps }),
    );

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "cascade",
          severity: "error",
          needsReload: false,
          summary: "Some operations have failed.",
          marketplaces: [
            {
              name: "owner/repo",
              scope: "project",
              status: "failed",
              plugins: [
                {
                  status: "failed",
                  name: "owner/repo",
                  id: "owner/repo",
                  reasons: ["lock held"],
                  scope: "project",
                  cause: {
                    causeChain: [lockHeldCause(locations), "Lock file is already being held"],
                    truncated: false,
                  },
                  leaks: [],
                  rollbackPartial: [],
                },
              ],
            },
          ],
        },
      },
    ]);
    capture.assertValid();
    assert.deepStrictEqual(state, NO_GIT_CALLS);
    verify(inventory);
    verify(ctx);
  });
});

test("orchestrated mode normalizes a non-Error opaque failure without mutation", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps, state } = createGitOps();
    const originalBasename = path.basename.bind(path);
    t.mock.method(path, "basename", (value: string, suffix?: string) => {
      if (value === locations.baseConfigJsonPath) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- this case proves the public unknown-throw normalizer.
        throw "opaque add failure";
      }

      return suffix === undefined ? originalBasename(value) : originalBasename(value, suffix);
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "owner/repo",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    // D-PL5-16: an unforeseen failure reads `unreadable`, not `unparseable`.
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "unreadable",
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
      schemaVersion: 3,
      marketplaces: {},
    });
  });
});

for (const { title, failure } of [
  {
    title: "an unforeseen ENOENT failure",
    failure: Object.assign(new Error("opaque ENOENT failure"), { code: "ENOENT" }),
  },
  {
    title: "an ENOENT failure behind two cleanup leaks",
    failure: new CleanupLeakError(
      new CleanupLeakError(
        Object.assign(new Error("opaque ENOENT failure"), { code: "ENOENT" }),
        "first leak",
      ),
      "second leak",
    ),
  },
]) {
  test(`D-PL5-16: orchestrated mode reads ${title} as source missing`, async (t) => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run } = makeCtx(0);
      const { gitOps } = createGitOps();
      const originalBasename = path.basename.bind(path);
      t.mock.method(path, "basename", (value: string, suffix?: string) => {
        if (value === locations.baseConfigJsonPath) {
          throw failure;
        }

        return suffix === undefined ? originalBasename(value) : originalBasename(value, suffix);
      });

      // act
      const outcome = await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "owner/repo",
        gitOps,
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepStrictEqual(outcome, {
        status: "failed",
        reason: "source missing",
        error: failure,
        cause: failure.message,
      });
    });
  });
}

test("D-PL5-16 / MPA-02: orchestrated mode still reads a malformed manifest as unparseable", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx(0);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("invalid-manifest"),
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.strictEqual(outcome.status, "failed");
    assert.strictEqual(outcome.reason, "unparseable");
    assert.ok(outcome.error instanceof InvalidMarketplaceManifestError);
  });
});

test(
  "normalizes a structurally classified exotic throw in orchestrated mode",
  { timeout: 1_000 },
  async (t) => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const duplicate = new MarketplaceDuplicateNameError("valid-marketplace", "project");
      const exoticDuplicate = new Proxy(duplicate, {
        getPrototypeOf: () => MarketplaceDuplicateNameError.prototype,
      });
      const { ctx, run, notifications } = makeCtx(0);
      const { gitOps, state } = createGitOps();
      const originalBasename = path.basename.bind(path);
      t.mock.method(path, "basename", (value: string, suffix?: string) => {
        if (value === locations.baseConfigJsonPath) {
          throw exoticDuplicate;
        }

        return suffix === undefined ? originalBasename(value) : originalBasename(value, suffix);
      });

      // act
      const outcome = await addMarketplace({
        ctx,
        run,
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
        error: exoticDuplicate,
        cause: duplicate.message,
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
        schemaVersion: 3,
        marketplaces: {},
      });
    });
  },
);

test(
  "cleans the final clone when state-record construction fails after rename",
  { timeout: 1_000 },
  async (t) => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run, notifications } = makeCtx(0);
      const { gitOps, state } = createGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      });
      let presentsAsError = true;
      const stateMutationFailure = new Proxy(
        {},
        {
          getPrototypeOf: () => {
            if (presentsAsError) {
              presentsAsError = false;
              return Error.prototype;
            }

            return null;
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
        run,
        scope: "project",
        cwd,
        rawSource: "anthropics/claude-plugins-official",
        gitOps,
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepStrictEqual(outcome, {
        status: "failed",
        reason: "unreadable",
        error: new Error("[object Object]"),
        cause: "[object Object]",
      });
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
        schemaVersion: 3,
        marketplaces: {},
      });
    });
  },
);

test("RECON-03 orchestrated mode -- duplicate-name (path source) returns typed MarketplaceDuplicateNameError, no notifications", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx: ctx1, run: run1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-orch-dup-"));
    const conflictingMpDir = await mkdtemp(path.join(tmpdir(), "mp-orch-conflict-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });
      await cp(fixtureMarketplaceDir("valid-marketplace"), conflictingMpDir, { recursive: true });

      const { gitOps: gitOps1 } = createGitOps();
      // Seed the duplicate via a standalone add.
      // act
      await addMarketplace({
        ctx: ctx1,
        run: run1,
        scope: "project",
        cwd,
        rawSource: conflictingMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2, run: run2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = createGitOps();
      const outcome = await addMarketplace({
        ctx: ctx2,
        run: run2,
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
      await rm(conflictingMpDir, { recursive: true, force: true });
    }
  });
});

test("RECON-03 orchestrated mode -- rethrowPreconditionErrors still rethrows typed precondition (bootstrap contract preserved)", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx: ctx1, run: run1 } = makeCtx();
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-orch-rethrow-"));
    const conflictingMpDir = await mkdtemp(path.join(tmpdir(), "mp-orch-rethrow-conflict-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });
      await cp(fixtureMarketplaceDir("valid-marketplace"), conflictingMpDir, { recursive: true });

      const { gitOps: gitOps1 } = createGitOps();
      // act
      await addMarketplace({
        ctx: ctx1,
        run: run1,
        scope: "project",
        cwd,
        rawSource: localMpDir,
        gitOps: gitOps1,
      });

      const { ctx: ctx2, run: run2, notifications: n2 } = makeCtx();
      const { gitOps: gitOps2 } = createGitOps();

      // assert
      await assert.rejects(
        addMarketplace({
          ctx: ctx2,
          run: run2,
          scope: "project",
          cwd,
          rawSource: conflictingMpDir,
          gitOps: gitOps2,
          rethrowPreconditionErrors: true,
          notifications: { mode: "orchestrated" },
        }),
        (err: unknown) => err instanceof MarketplaceDuplicateNameError,
      );

      assert.equal(n2.length, 0, "orchestrated mode must not fire notifications");
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
      await rm(conflictingMpDir, { recursive: true, force: true });
    }
  });
});

test("RECON-03 standalone-default mode -- omitted notifications option remains byte-identical to today (regression guard)", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // The same call without `notifications` -- must return void and fire one
    // byte-identical notify, matching the "MA-5: github source clones,
    // validates, renames, mutates state, emits V2 success message with NO
    // reload-hint trailer (SNM-33 / D-22-01)" standalone test above.
    // act
    const outcome = await addMarketplace({
      ctx,
      run,
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
    const { ctx, run } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });

    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    const cfg = await loadConfig(locations.baseConfigJsonPath);
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

    // The local config MUST NOT have been touched on the base-target path.
    const localCfg = await loadConfig(locations.localConfigJsonPath);
    assert.equal(localCfg.status, "absent");
  });
});

test("WB-01: --local routes the write to claude-plugins.local.json and never touches the base config", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      local: true,
    });

    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    const localCfg = await loadConfig(locations.localConfigJsonPath);
    // assert
    assert.equal(localCfg.status, "valid");
    if (localCfg.status === "valid") {
      assert.equal(
        localCfg.config.marketplaces?.["valid-marketplace"]?.source,
        "anthropics/claude-plugins-official",
      );
    }

    // The base config MUST be untouched.
    const baseCfg = await loadConfig(locations.baseConfigJsonPath);
    assert.equal(baseCfg.status, "absent");
  });
});

/** The bytes an add writes into a config file that declares only `name`. */
function declaredMarketplaceBytes(name: string, source: string): string {
  return `{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "${name}": {\n      "source": "${source}"\n    }\n  }\n}\n`;
}

for (const { declaredLayer, targetLayer, firstLocal, secondLocal } of [
  { declaredLayer: "base", targetLayer: "local", firstLocal: false, secondLocal: true },
  { declaredLayer: "local", targetLayer: "base", firstLocal: true, secondLocal: false },
]) {
  test(`LAYER-01: declares a path marketplace the ${declaredLayer} layer holds in the ${targetLayer} layer with no clone and no state write`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const marketplaceRoot = await writeNamedPathMarketplace(cwd, "tools");
      const { gitOps, state: gitState } = createGitOps();
      const first = makeCtx();
      await addMarketplace({
        ctx: first.ctx,
        run: first.run,
        scope: "project",
        cwd,
        rawSource: marketplaceRoot,
        gitOps,
        local: firstLocal,
      });
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      const { ctx, run, notifications } = makeCtx();

      // act
      await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: marketplaceRoot,
        gitOps,
        local: secondLocal,
      });

      // assert
      assert.deepStrictEqual(notifications, [{ message: "● tools [project] (added)" }]);
      assert.strictEqual(
        await readFile(locations.baseConfigJsonPath, "utf8"),
        declaredMarketplaceBytes("tools", marketplaceRoot),
      );
      assert.strictEqual(
        await readFile(locations.localConfigJsonPath, "utf8"),
        declaredMarketplaceBytes("tools", marketplaceRoot),
      );
      assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
      assert.deepStrictEqual(gitState.cloneCalls, []);
    });
  });
}

test("LAYER-01 / WR-06: a relative path typed in another directory adds that directory, not the recorded marketplace", async (t) => {
  // arrange: the user scope records `./named-marketplace` as typed in `first`.
  const { root } = await createHermeticEnvironment(t, "mp-add-relative-");
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  await writeNamedPathMarketplace(first, "tools");
  await mkdir(second, { recursive: true });
  const startupCwd = process.cwd();
  t.after(() => {
    process.chdir(startupCwd);
  });
  process.chdir(first);
  const firstAdd = makeCtx();
  await addMarketplace({
    ctx: firstAdd.ctx,
    run: firstAdd.run,
    scope: "user",
    cwd: first,
    rawSource: "./named-marketplace",
  });
  const userLocations = locationsFor("user", first);
  const stateBefore = await readFile(userLocations.stateJsonPath, "utf8");
  process.chdir(second);
  const { ctx, run, notifications } = makeCtx();

  // act
  await addMarketplace({
    ctx,
    run,
    scope: "user",
    cwd: second,
    rawSource: "./named-marketplace",
    local: true,
  });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A marketplace operation has failed.\n\n⊘ ./named-marketplace [user] (failed) {source missing}",
      severity: "error",
    },
  ]);
  assert.strictEqual(await pathExists(userLocations.localConfigJsonPath), false);
  assert.strictEqual(await readFile(userLocations.stateJsonPath, "utf8"), stateBefore);
});

test("LAYER-01: declares a github marketplace in the local layer with only the clone of the first add", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { gitOps, state: gitState } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const first = makeCtx();
    await addMarketplace({
      ctx: first.ctx,
      run: first.run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx();
    const redeclareGitOps: GitOps = {
      ...gitOps,
      listRemotes: () => Promise.reject(new Error("the re-declaration inspects no clone")),
    };

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps: redeclareGitOps,
      local: true,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    assert.strictEqual(
      await readFile(locations.baseConfigJsonPath, "utf8"),
      declaredMarketplaceBytes("valid-marketplace", "anthropics/claude-plugins-official"),
    );
    assert.strictEqual(
      await readFile(locations.localConfigJsonPath, "utf8"),
      declaredMarketplaceBytes("valid-marketplace", "anthropics/claude-plugins-official"),
    );
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(
      gitState.cloneCalls.map((call) => call.url),
      ["https://github.com/anthropics/claude-plugins-official.git"],
    );
    assert.deepStrictEqual(
      [
        gitState.fetchCalls,
        gitState.forceUpdateRefCalls,
        gitState.checkoutCalls,
        gitState.resolveRefCalls,
      ],
      [[], [], [], []],
    );
  });
});

test("LAYER-01: declares a marketplace the scope records but no layer declares, keeping its record", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = await writeNamedPathMarketplace(cwd, "tools");
    await saveState(locations.extensionRoot, {
      schemaVersion: 3,
      marketplaces: {
        tools: {
          name: "tools",
          scope: "project",
          source: { kind: "path", raw: marketplaceRoot, logical: marketplaceRoot },
          addedFromCwd: cwd,
          manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot,
          plugins: {},
        },
      },
    });
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state: gitState } = createGitOps();

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: marketplaceRoot, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● tools [project] (added)" }]);
    assert.strictEqual(
      await readFile(locations.baseConfigJsonPath, "utf8"),
      declaredMarketplaceBytes("tools", marketplaceRoot),
    );
    assert.strictEqual(await pathExists(locations.localConfigJsonPath), false);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(gitState.cloneCalls, []);
  });
});

test("LAYER-01: a failed re-declaration write keeps the recorded clone and state", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const first = makeCtx();
    await addMarketplace({
      ctx: first.ctx,
      run: first.run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
    });
    const cloneDir = await locations.sourceCloneDir("valid-marketplace");
    const cloneEntriesBefore = (await readdir(cloneDir, { recursive: true })).sort();
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const { ctx, run } = makeCtx(0);
    // A read-only scope root refuses the atomic write of the absent local config.
    await chmod(locations.scopeRoot, 0o500);

    // act & assert
    try {
      await assert.rejects(
        addMarketplace({
          ctx,
          run,
          scope: "project",
          cwd,
          rawSource: "anthropics/claude-plugins-official",
          gitOps,
          local: true,
        }),
        { code: "EACCES" },
      );
    } finally {
      await chmod(locations.scopeRoot, 0o755);
    }

    assert.deepStrictEqual(
      (await readdir(cloneDir, { recursive: true })).sort(),
      cloneEntriesBefore,
    );
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
  });
});

const GITHUB_SOURCE = "anthropics/claude-plugins-official";

/** An installed plugin record the D-PL5-17 repair must keep. */
const INSTALLED_HELLO: ExtensionState["marketplaces"][string]["plugins"][string] = {
  version: "1.0.0",
  resolvedSource: "/plugins/hello",
  compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
  resources: { skills: [], prompts: [], agents: [], hooks: [], mcpServers: [], workflows: [] },
  enabled: true,
  provenance: "explicit",
  installedAt: "2026-08-31T12:00:00.000Z",
  updatedAt: "2026-08-31T12:00:00.000Z",
};

/**
 * D-PL5-17: records the github marketplace `valid-marketplace` with an
 * installed plugin and stale manifest metadata, then deletes its checkout.
 */
async function arrangeLostCheckout(
  cwd: string,
  locations: ScopedLocations,
): Promise<ExtensionState["marketplaces"][string]> {
  const first = makeCtx();
  await addMarketplace({
    ctx: first.ctx,
    run: first.run,
    scope: "project",
    cwd,
    rawSource: GITHUB_SOURCE,
    gitOps: createGitOps({ fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace") }).gitOps,
  });
  const state = await loadState(locations.extensionRoot);
  const recorded = state.marketplaces["valid-marketplace"];
  assert.ok(recorded);
  const record = {
    ...recorded,
    lastUpdatedAt: "2026-01-01T00:00:00.000Z",
    lastSuccessfulManifest: "{}",
    plugins: { hello: INSTALLED_HELLO },
  };
  await saveState(locations.extensionRoot, {
    ...state,
    marketplaces: { "valid-marketplace": record },
  });
  await rm(record.marketplaceRoot, { recursive: true });
  return record;
}

test("D-PL5-17: re-adding a github marketplace whose checkout is gone re-clones it and keeps its plugins", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const record = await arrangeLostCheckout(cwd, locations);
    const configBefore = await readFile(locations.baseConfigJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state: gitState } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: GITHUB_SOURCE, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    assert.deepStrictEqual(
      gitState.cloneCalls.map((call) => call.url),
      ["https://github.com/anthropics/claude-plugins-official.git"],
    );
    const repaired = (await loadState(locations.extensionRoot)).marketplaces["valid-marketplace"];
    assert.ok(repaired);
    const { lastUpdatedAt, lastSuccessfulManifest } = repaired;
    assert.deepStrictEqual(repaired, { ...record, lastUpdatedAt, lastSuccessfulManifest });
    assert.notStrictEqual(lastUpdatedAt, record.lastUpdatedAt);
    assert.deepStrictEqual(
      JSON.parse(lastSuccessfulManifest ?? ""),
      JSON.parse(VALID_MANIFEST_JSON),
    );
    assert.strictEqual(await pathExists(record.manifestPath), true);
    assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), configBefore);
    assert.strictEqual(await pathExists(locations.localConfigJsonPath), false);
  });
});

test("D-PL5-17: a repair into a layer that does not declare the marketplace declares it there", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const record = await arrangeLostCheckout(cwd, locations);
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: GITHUB_SOURCE,
      gitOps,
      local: true,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    assert.strictEqual(
      await readFile(locations.localConfigJsonPath, "utf8"),
      declaredMarketplaceBytes("valid-marketplace", GITHUB_SOURCE),
    );
    assert.deepStrictEqual(
      (await loadState(locations.extensionRoot)).marketplaces["valid-marketplace"]?.plugins,
      record.plugins,
    );
    assert.strictEqual(await pathExists(record.marketplaceRoot), true);
  });
});

test("D-PL5-17: a re-clone that declares another name fails as a source mismatch and changes nothing", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    await arrangeLostCheckout(cwd, locations);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("empty-marketplace"),
    });

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: GITHUB_SOURCE, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `A marketplace operation has failed.\n\n⊘ ${GITHUB_SOURCE} [project] (failed) {source mismatch}`,
        severity: "error",
      },
    ]);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(
      [
        await readdir(path.join(locations.extensionRoot, "sources")),
        await readdir(path.join(locations.extensionRoot, "sources-staging")),
      ],
      [[], []],
    );
  });
});

test("D-PL5-17 / WR-07: a repair whose state save fails removes the new checkout", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const record = await arrangeLostCheckout(cwd, locations);
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      onClone: async () => {
        await rm(locations.stateJsonPath);
        await mkdir(locations.stateJsonPath);
      },
    });

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: GITHUB_SOURCE, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `A marketplace operation has failed.\n\n⊘ ${GITHUB_SOURCE} [project] (failed) {unreadable}`,
        severity: "error",
      },
    ]);
    assert.strictEqual(await pathExists(record.marketplaceRoot), false);
  });
});

for (const kind of ["dir", "file"] as const) {
  test(`D-PL5-17: re-adding a ${kind} marketplace whose manifest is gone fails as source missing`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const marketplaceRoot = await writeNamedPathMarketplace(cwd, "tools");
      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      const rawSource = kind === "dir" ? marketplaceRoot : manifestPath;
      const first = makeCtx();
      await addMarketplace({ ctx: first.ctx, run: first.run, scope: "project", cwd, rawSource });
      await rm(manifestPath);
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      const configBefore = await readFile(locations.baseConfigJsonPath, "utf8");
      const { ctx, run, notifications } = makeCtx();

      // act
      await addMarketplace({ ctx, run, scope: "project", cwd, rawSource });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `A marketplace operation has failed.\n\n⊘ ${rawSource} [project] (failed) {source missing}`,
          severity: "error",
        },
      ]);
      assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
      assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), configBefore);
    });
  });
}

test("D-PL5-17 / WR-09: an orchestrated add never repairs a recorded marketplace", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const record = await arrangeLostCheckout(cwd, locations);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const { ctx, run } = makeCtx(0);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: GITHUB_SOURCE,
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.strictEqual(outcome.status, "failed");
    assert.strictEqual(outcome.reason, "duplicate name");
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.strictEqual(await pathExists(record.marketplaceRoot), false);
  });
});

test("WR-09 / T-56-02-01: orchestrated-mode add SKIPS config write-back (neither base nor local config is created)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, { status: "added", name: "valid-marketplace" });
    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    assert.equal((await loadConfig(locations.baseConfigJsonPath)).status, "absent");
    assert.equal((await loadConfig(locations.localConfigJsonPath)).status, "absent");
  });
});

test("CFG-03 / T-56-02-05: --local path with an invalid config aborts the add; basename-only cause; state untouched", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // Seed an invalid claude-plugins.local.json (malformed JSON).
    // arrange
    const { writeFile } = await import("node:fs/promises");
    await writeFile(locations.localConfigJsonPath, "{ not valid json", "utf8");

    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
      !note.message.includes(locations.localConfigJsonPath),
      `must NOT leak absolute localConfigJsonPath, got: ${note.message}`,
    );

    // State was NOT mutated (the marketplace record was never recorded).
    const persisted = await loadState(locations.extensionRoot);
    assert.equal(Object.keys(persisted.marketplaces).length, 0);
  });
});

test("WR-07: config write failure after the clone rename cleans up the final clone (retry never hits {stale clone})", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // Valid pre-existing config so the CFG-03 pre-check passes -- the
    // failure must land AFTER addGithubInGuard renamed the clone into its
    // final sources/<name>/ path.
    await writeFile(locations.baseConfigJsonPath, JSON.stringify({ schemaVersion: 1 }), "utf8");
    // Read-only scope root: saveConfig's tmp+rename write into scopeRoot
    // fails with EACCES, while everything under extensionRoot (state lock,
    // sources/, sources-staging/) stays writable.
    await chmod(locations.scopeRoot, 0o555);

    let threw = false;
    try {
      // act
      await addMarketplace({
        ctx,
        run,
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
    const firstBoundary = makeCtx();
    const firstGit = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      onClone: async () => {
        await mkdir(locations.stateJsonPath, { recursive: true });
      },
    });
    const firstCache = createCompletionCacheRecorder();

    // act
    const firstOutcome = await addMarketplaceWithCache({
      ctx: firstBoundary.ctx,
      run: firstBoundary.run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps: firstGit.gitOps,
      completionCache: firstCache.cache,
    });

    const configAfterFailure = await readFile(locations.baseConfigJsonPath, "utf8");
    const finalClone = await locations.sourceCloneDir("valid-marketplace");
    const finalCloneAfterFailure = await pathExists(finalClone);
    await rm(locations.stateJsonPath, { recursive: true, force: true });
    const secondBoundary = makeCtx();
    const secondGit = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const secondOutcome = await addMarketplace({
      ctx: secondBoundary.ctx,
      run: secondBoundary.run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps: secondGit.gitOps,
    });

    // assert
    assert.strictEqual(firstOutcome, undefined);
    assert.deepStrictEqual(firstCache.calls, []);
    assert.strictEqual(finalCloneAfterFailure, false);
    assert.strictEqual(
      configAfterFailure,
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "valid-marketplace": {\n      "source": "https://gitlab.example.com/team/mp"\n    }\n  }\n}\n',
    );
    assert.strictEqual(secondOutcome, undefined);
    assert.deepStrictEqual(secondBoundary.notifications, [
      { message: "● valid-marketplace [project] (added)" },
    ]);
    // D-PL5-18: the save's EISDIR reads `unreadable`, as `list` and `info` read it.
    assert.deepStrictEqual(firstBoundary.notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n⊘ https://gitlab.example.com/team/mp [project] (failed) {unreadable}",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      firstGit.state.cloneCalls.map(({ url }) => url),
      ["https://gitlab.example.com/team/mp"],
    );
    assert.deepStrictEqual(
      secondGit.state.cloneCalls.map(({ url }) => url),
      ["https://gitlab.example.com/team/mp"],
    );
    assert.deepStrictEqual(Object.keys((await loadState(locations.extensionRoot)).marketplaces), [
      "valid-marketplace",
    ]);
    assert.strictEqual(await pathExists(finalClone), true);
  });
});

type ReplacedRecord = ExtensionState["marketplaces"][string];
type ReplacedPlugin = ReplacedRecord["plugins"][string];

function replacedPlugin(name: string): ReplacedPlugin {
  return {
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    resolvedSource: `/marketplaces/plugins/${name}`,
    resources: { agents: [], hooks: [], mcpServers: [], prompts: [], skills: [], workflows: [] },
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: "1.0.0",
  };
}

function replacedPlugins(): ReplacedRecord["plugins"] {
  return { alpha: replacedPlugin("alpha"), beta: replacedPlugin("beta") };
}

/** Writes a path marketplace at `directory` whose manifest declares `name` and no plugins. */
async function writePathMarketplaceAt(directory: string, name: string): Promise<string> {
  await mkdir(path.join(directory, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(directory, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ name, plugins: [] }),
  );
  return directory;
}

/** D-PL6-19: a scope that records `tools` from the path marketplace at `root`. */
async function seedPathRecord(
  locations: ScopedLocations,
  cwd: string,
  root: string,
): Promise<ExtensionState> {
  const state: ExtensionState = {
    schemaVersion: 3,
    marketplaces: {
      tools: {
        name: "tools",
        scope: "project",
        source: { kind: "path", raw: root, logical: root },
        addedFromCwd: cwd,
        manifestPath: path.join(root, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: root,
        plugins: replacedPlugins(),
      },
    },
  };
  await saveState(locations.extensionRoot, state);
  return state;
}

/**
 * D-PL6-19: a scope that records `valid-marketplace` from the github source
 * `owner/repo`, with its clone at `sources/valid-marketplace/` holding a
 * sentinel file.
 */
async function seedGithubRecord(
  locations: ScopedLocations,
  cwd: string,
): Promise<{ readonly state: ExtensionState; readonly cloneDir: string }> {
  const cloneDir = await locations.sourceCloneDir("valid-marketplace");
  await mkdir(cloneDir, { recursive: true });
  await writeFile(path.join(cloneDir, ".old-clone-sentinel"), "old");
  const state: ExtensionState = {
    schemaVersion: 3,
    marketplaces: {
      "valid-marketplace": {
        name: "valid-marketplace",
        scope: "project",
        source: { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" },
        addedFromCwd: cwd,
        manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: cloneDir,
        plugins: replacedPlugins(),
      },
    },
  };
  await saveState(locations.extensionRoot, state);
  return { state, cloneDir };
}

async function stagingEntries(locations: ScopedLocations): Promise<string[]> {
  return readdir(path.dirname(await locations.sourcesStagingDir("probe")));
}

test("D-PL6-19: an add that replaces a recorded path marketplace records the new directory and keeps its plugins", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-path-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const oldRoot = await writePathMarketplaceAt(path.join(cwd, "old-tools"), "tools");
    const newRoot = await writePathMarketplaceAt(path.join(cwd, "new-tools"), "tools");
    await seedPathRecord(locations, cwd, oldRoot);
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps } = createGitOps();

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: newRoot,
      gitOps,
      notifications: { mode: "orchestrated" },
      replaceRecorded: "tools",
    });

    // assert
    assert.deepStrictEqual(outcome, { status: "added", name: "tools" });
    const { lastUpdatedAt, ...record } =
      (await loadState(locations.extensionRoot)).marketplaces["tools"] ?? {};
    assert.deepStrictEqual(record, {
      name: "tools",
      scope: "project",
      source: { kind: "path", raw: newRoot, logical: newRoot },
      addedFromCwd: cwd,
      manifestPath: path.join(newRoot, ".claude-plugin", "marketplace.json"),
      marketplaceRoot: newRoot,
      lastSuccessfulManifest: JSON.stringify({ name: "tools", plugins: [] }),
      plugins: replacedPlugins(),
    });
    assert.match(lastUpdatedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.strictEqual(
      await readFile(path.join(oldRoot, ".claude-plugin", "marketplace.json"), "utf8"),
      JSON.stringify({ name: "tools", plugins: [] }),
    );
    assert.strictEqual(await pathExists(locations.baseConfigJsonPath), false);
    assert.deepStrictEqual(notifications, []);
  });
});

test("D-PL6-19: an add that replaces a recorded github marketplace swaps its clone and keeps its plugins", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-github-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { cloneDir } = await seedGithubRecord(locations, cwd);
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
      replaceRecorded: "valid-marketplace",
    });

    // assert
    assert.deepStrictEqual(outcome, { status: "added", name: "valid-marketplace" });
    const { lastUpdatedAt, ...record } =
      (await loadState(locations.extensionRoot)).marketplaces["valid-marketplace"] ?? {};
    assert.deepStrictEqual(record, {
      name: "valid-marketplace",
      scope: "project",
      source: {
        kind: "github",
        raw: "anthropics/claude-plugins-official",
        owner: "anthropics",
        repo: "claude-plugins-official",
      },
      addedFromCwd: cwd,
      manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
      marketplaceRoot: cloneDir,
      lastSuccessfulManifest: VALID_MANIFEST_JSON,
      plugins: replacedPlugins(),
    });
    assert.match(lastUpdatedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.strictEqual(await pathExists(path.join(cloneDir, ".old-clone-sentinel")), false);
    assert.strictEqual(
      await readFile(path.join(cloneDir, OWNERSHIP_MARKER), "utf8"),
      OWNERSHIP_MARKER_BYTES,
    );
    assert.deepStrictEqual(await stagingEntries(locations), []);
    assert.deepStrictEqual(notifications, []);
  });
});

test("D-PL6-19: an add whose new manifest names another marketplace fails as an invalid manifest and keeps the record and clone", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-renamed-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { state, cloneDir } = await seedGithubRecord(locations, cwd);
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      onClone: async (directory) => {
        await writeFile(
          path.join(directory, ".claude-plugin", "marketplace.json"),
          JSON.stringify({ name: "other", plugins: [] }),
        );
      },
    });
    const message =
      'marketplace.json names the marketplace "other", not "valid-marketplace", which it replaces';

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
      replaceRecorded: "valid-marketplace",
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "invalid manifest",
      error: new InvalidMarketplaceManifestError(message),
      cause: message,
    });
    assert.deepStrictEqual(await loadState(locations.extensionRoot), state);
    assert.strictEqual(await readFile(path.join(cloneDir, ".old-clone-sentinel"), "utf8"), "old");
    assert.strictEqual(await pathExists(await locations.sourceCloneDir("other")), false);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    assert.deepStrictEqual(notifications, []);
  });
});

test("D-PL6-19: an add whose new directory names another marketplace fails as an invalid manifest and keeps the record", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-path-renamed-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const oldRoot = await writePathMarketplaceAt(path.join(cwd, "old-tools"), "tools");
    const newRoot = await writePathMarketplaceAt(path.join(cwd, "new-tools"), "other");
    const state = await seedPathRecord(locations, cwd, oldRoot);
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps } = createGitOps();
    const message =
      'marketplace.json names the marketplace "other", not "tools", which it replaces';

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: newRoot,
      gitOps,
      notifications: { mode: "orchestrated" },
      replaceRecorded: "tools",
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "invalid manifest",
      error: new InvalidMarketplaceManifestError(message),
      cause: message,
    });
    assert.deepStrictEqual(await loadState(locations.extensionRoot), state);
    assert.deepStrictEqual(notifications, []);
  });
});

test("D-PL6-19: a replaced clone that cannot be removed after the save leaves the replace added", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-cleanup-leak-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    await seedGithubRecord(locations, cwd);
    const stagingRoot = path.dirname(await locations.sourcesStagingDir("probe"));
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    t.mock.method(fs.promises, "rm", async (target: fs.PathLike, rmOptions?: fs.RmOptions) => {
      if (path.dirname(String(target)) === stagingRoot) {
        throw Object.assign(new Error(`EACCES: permission denied, rm '${String(target)}'`), {
          code: "EACCES",
        });
      }

      await rm(target, rmOptions);
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
      replaceRecorded: "valid-marketplace",
    });

    // assert
    assert.deepStrictEqual(outcome, { status: "added", name: "valid-marketplace" });
    const [setAside, ...others] = await stagingEntries(locations);
    assert.deepStrictEqual(others, []);
    assert.deepStrictEqual(await readdir(path.join(stagingRoot, setAside ?? "")), [
      ".old-clone-sentinel",
    ]);
    assert.deepStrictEqual(notifications, []);
  });
});

test("D-PL6-19: an add whose clone fails puts the replaced clone back and keeps the record", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-clone-fails-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { state, cloneDir } = await seedGithubRecord(locations, cwd);
    const { ctx, run, notifications } = makeCtx(0);
    const cloneFailure = httpError(404);
    let cloneAtFetch: string | undefined;
    const { gitOps } = createGitOps({
      cloneThrows: cloneFailure,
      onClone: async () => {
        cloneAtFetch = await readFile(path.join(cloneDir, ".old-clone-sentinel"), "utf8");
      },
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
      replaceRecorded: "valid-marketplace",
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "source missing",
      error: cloneFailure,
      cause: "HTTP Error: 404",
    });
    assert.deepStrictEqual(await loadState(locations.extensionRoot), state);
    assert.strictEqual(cloneAtFetch, "old", "the replaced clone stays in place while fetching");
    assert.strictEqual(await readFile(path.join(cloneDir, ".old-clone-sentinel"), "utf8"), "old");
    assert.deepStrictEqual(notifications, []);
  });
});

/**
 * D-PL6-19: makes the state save after the swap fail. The clone hook moves
 * `state.json` aside and leaves a directory in its place; `restore` puts the
 * saved file back so the case can read it.
 */
function failSaveAfterClone(locations: ScopedLocations): {
  readonly onClone: () => Promise<void>;
  readonly restore: () => Promise<void>;
} {
  const saved = `${locations.stateJsonPath}.saved`;
  return {
    onClone: async () => {
      await fs.promises.rename(locations.stateJsonPath, saved);
      await mkdir(locations.stateJsonPath);
    },
    restore: async () => {
      await rm(locations.stateJsonPath, { recursive: true, force: true });
      await fs.promises.rename(saved, locations.stateJsonPath);
    },
  };
}

test("D-PL6-19: a save that fails after the swap removes the new clone and puts the replaced clone back", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-save-fails-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { state, cloneDir } = await seedGithubRecord(locations, cwd);
    const { ctx, run, notifications } = makeCtx(0);
    const saveFault = failSaveAfterClone(locations);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      onClone: saveFault.onClone,
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
      replaceRecorded: "valid-marketplace",
    });
    await saveFault.restore();

    // assert
    assert.ok(outcome.status === "failed");
    assert.ok(outcome.error instanceof Error && "code" in outcome.error);
    assert.deepStrictEqual(
      { reason: outcome.reason, code: outcome.error.code, cause: outcome.cause },
      { reason: "unreadable", code: "EISDIR", cause: outcome.error.message },
    );
    assert.deepStrictEqual(await loadState(locations.extensionRoot), state);
    assert.deepStrictEqual((await readdir(cloneDir)).sort(), [".old-clone-sentinel"]);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    assert.deepStrictEqual(notifications, []);
  });
});

test("D-PL6-19: a path add that replaces a github marketplace puts the clone back when its write-back fails", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-path-write-back-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { state, cloneDir } = await seedGithubRecord(locations, cwd);
    const newRoot = await writePathMarketplaceAt(path.join(cwd, "new-mp"), "valid-marketplace");
    const { ctx, run } = makeCtx(0);
    const { gitOps } = createGitOps();
    // A read-only scope root refuses the atomic write of the absent base config.
    await chmod(locations.scopeRoot, 0o500);

    // act & assert
    try {
      await assert.rejects(
        addMarketplace({
          ctx,
          run,
          scope: "project",
          cwd,
          rawSource: newRoot,
          gitOps,
          replaceRecorded: "valid-marketplace",
        }),
        { code: "EACCES" },
      );
    } finally {
      await chmod(locations.scopeRoot, 0o755);
    }

    assert.deepStrictEqual(await loadState(locations.extensionRoot), state);
    assert.deepStrictEqual((await readdir(cloneDir)).sort(), [".old-clone-sentinel"]);
    assert.deepStrictEqual(await stagingEntries(locations), []);
  });
});

test("D-PL6-19: a restore that cannot finish appends its leak to the failure", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-restore-leak-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { cloneDir } = await seedGithubRecord(locations, cwd);
    const { ctx, run, notifications } = makeCtx(0);
    const saveFault = failSaveAfterClone(locations);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      onClone: saveFault.onClone,
    });
    t.mock.method(fs.promises, "rm", async (target: fs.PathLike, rmOptions?: fs.RmOptions) => {
      if (String(target) === cloneDir) {
        throw Object.assign(new Error(`EACCES: permission denied, rm '${cloneDir}'`), {
          code: "EACCES",
        });
      }

      await rm(target, rmOptions);
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      notifications: { mode: "orchestrated" },
      replaceRecorded: "valid-marketplace",
    });
    await saveFault.restore();

    // assert
    const [setAside] = await stagingEntries(locations);
    assert.ok(setAside !== undefined, "the replaced clone stays set aside");
    const setAsideDir = path.join(
      path.dirname(await locations.sourcesStagingDir("probe")),
      setAside,
    );
    const restoreFailure = await fs.promises.rename(setAsideDir, cloneDir).then(
      () => "the restore target was free",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    assert.ok(outcome.status === "failed");
    assert.ok(outcome.error instanceof CleanupLeakError);
    assert.deepStrictEqual(
      outcome.cause,
      `${outcome.error.cause.message} (additionally: ` +
        `failed to clean up marketplace final clone ${cloneDir} at ${cloneDir}: ` +
        `EACCES: permission denied, rm '${cloneDir}'; ` +
        `failed to restore marketplace clone ${setAsideDir} to ${cloneDir}: ${restoreFailure})`,
    );
    assert.deepStrictEqual(notifications, []);
  });
});

test("D-PL6-19: an add that replaces a marketplace the scope no longer records adds it with no plugins", async (t) => {
  await createHermeticEnvironment(t, "mp-add-replace-gone-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const newRoot = await writePathMarketplaceAt(path.join(cwd, "new-tools"), "tools");
    const { ctx, run, notifications } = makeCtx(0);
    const { gitOps } = createGitOps();

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: newRoot,
      gitOps,
      notifications: { mode: "orchestrated" },
      replaceRecorded: "tools",
    });

    // assert
    assert.deepStrictEqual(outcome, { status: "added", name: "tools" });
    const { lastUpdatedAt, ...record } =
      (await loadState(locations.extensionRoot)).marketplaces["tools"] ?? {};
    assert.deepStrictEqual(record, {
      name: "tools",
      scope: "project",
      source: { kind: "path", raw: newRoot, logical: newRoot },
      addedFromCwd: cwd,
      manifestPath: path.join(newRoot, ".claude-plugin", "marketplace.json"),
      marketplaceRoot: newRoot,
      lastSuccessfulManifest: JSON.stringify({ name: "tools", plugins: [] }),
      plugins: {},
    });
    assert.match(lastUpdatedAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.deepStrictEqual(notifications, []);
  });
});

test("MURL-08 / D-2-01: url source with a typed .git suffix clones the suffixed URL and stores the suffix-less identity", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/suffixed-mp.git",
      gitOps,
    });

    // assert
    assert.equal(state.cloneCalls.length, 1);
    assert.equal(state.cloneCalls[0]?.url, "https://gitlab.example.com/team/suffixed-mp.git");
    assert.deepStrictEqual(
      Object.values((await loadState(locations.extensionRoot)).marketplaces).map(
        (marketplace) => marketplace.source,
      ),
      [
        {
          kind: "url",
          raw: "https://gitlab.example.com/team/suffixed-mp.git",
          url: "https://gitlab.example.com/team/suffixed-mp",
        },
      ],
    );
  });
});

test("MURL-08: url source clones the URL as typed, with a bundle bound to its host", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps,
      credentialOps,
    });

    // D-2-01 / D-2-03: the clone URL derives from source.raw via
    // networkCloneUrl -- no github.com reconstruction and no `.git`
    // decoration beyond what the user typed.
    // assert
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    assert.equal(cloneCall.url, "https://gitlab.example.com/team/mp");
    // GAUTH-03: the clone carries a bundle keyed on the source's own host.
    assert.deepStrictEqual(cloneCall.auth, {
      credentialOps,
      host: "gitlab.example.com",
      kind: "stored-credential",
    });
  });
});

test("MURL-01: url source with a #ref clones at that ref with singleBranch and the same host-keyed bundle", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp#v1.0",
      gitOps,
      credentialOps,
    });

    // assert
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    assert.deepStrictEqual(
      {
        url: cloneCall.url,
        ref: cloneCall.ref,
        singleBranch: cloneCall.singleBranch,
      },
      {
        url: "https://gitlab.example.com/team/mp",
        ref: "v1.0",
        singleBranch: true,
      },
    );
    // GAUTH-03: the bundle rides the pinned-ref arm too.
    assert.deepStrictEqual(cloneCall.auth, {
      credentialOps,
      host: "gitlab.example.com",
      kind: "stored-credential",
    });
  });
});

test("MURL-01: after a successful url add, state records source.kind === 'url' and the clone lands at sources/<name>/", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
    const { ctx, run, notifications } = makeCtx();
    // Duck-typed isomorphic-git HttpError shape: code === "HttpError",
    // data.statusCode carries the HTTP status.
    const httpErr = Object.assign(new Error("HTTP 401 from clone"), {
      code: "HttpError",
      data: { statusCode: 401 },
    });
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpErr,
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
    const { ctx, run, notifications } = makeCtx();
    const httpErr = httpError(403);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpErr,
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpError(404),
    });

    // act
    await addMarketplace({
      ctx,
      run,
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

test("ADD-09: a clone of a ref the remote lacks renders (failed) {source missing} named by the typed source", async (t) => {
  await createHermeticEnvironment(t, "mp-add-missing-ref-home-");
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: refNotFoundError("stable"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp#stable",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n" +
          "⊘ https://gitlab.example.com/team/mp#stable [project] (failed) {source missing}",
        severity: "error",
      },
    ]);
  });
});

test("ADD-09 orchestrated mode -- a clone of a ref the remote lacks returns the source-missing outcome without notifying", async (t) => {
  await createHermeticEnvironment(t, "mp-add-missing-ref-orchestrated-home-");
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(0);
    const cloneThrows = refNotFoundError("stable");
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows,
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp#stable",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "source missing",
      error: cloneThrows,
      cause: "Could not find stable.",
    });
    assert.deepStrictEqual(notifications, []);
  });
});

for (const statusCode of [408, 429, 500, 503]) {
  test(`ADD-10: a clone the host answers with HTTP ${statusCode} renders {network error} with the status on the fetched URL`, async (t) => {
    await createHermeticEnvironment(t, "mp-add-host-http-home-");
    await withTmpScope(async ({ cwd }) => {
      // arrange
      const { ctx, run, notifications } = makeCtx();
      const { gitOps } = createGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
        cloneThrows: httpError(statusCode),
      });

      // act
      await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "https://gitlab.example.com/team/flaky-mp",
        gitOps,
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "Some operations have failed.\n\n" +
            "⊘ https://gitlab.example.com/team/flaky-mp [project] (failed)\n" +
            "  ⊘ https://gitlab.example.com/team/flaky-mp (failed) {network error}\n" +
            `    cause: ${statusCode} on https://gitlab.example.com/team/flaky-mp -> HTTP Error: ${statusCode}`,
          severity: "error",
        },
      ]);
    });
  });
}

test("ADD-10: a GitHub clone the host answers with HTTP 502 names the github.com wire URL", async (t) => {
  await createHermeticEnvironment(t, "mp-add-host-http-github-home-");
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpError(502),
    });

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource: "acme/mp", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          "⊘ acme/mp [project] (failed)\n" +
          "  ⊘ acme/mp (failed) {network error}\n" +
          "    cause: 502 on https://github.com/acme/mp.git -> HTTP Error: 502",
        severity: "error",
      },
    ]);
  });
});

test("ADD-10: a failed git add's JSON child row takes the source as typed as its id", async (t) => {
  await createHermeticEnvironment(t, "mp-add-host-http-json-home-");
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const capture = createJsonCapture();
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    when(() => ctx.mode)
      .thenReturn("json")
      .once();
    const inventory = mock<
      Pick<Parameters<typeof openNotificationRun>[0], "getAllTools" | "getCommands">
    >({ exactParams: true, name: "inventory" });
    when(() => inventory.getAllTools())
      .thenReturn([])
      .times(3);
    when(() => inventory.getCommands())
      .thenReturn([])
      .once();
    const run = openNotificationRun(
      {
        getAllTools: () => inventory.getAllTools(),
        getCommands: () => inventory.getCommands(),
        appendEntry: capture.entrySink.appendEntry,
      },
      { kind: "command", commandId: "plugin", invocationId: "test-run" },
    );
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpError(503),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/flaky-mp",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "cascade",
          severity: "error",
          needsReload: false,
          summary: "Some operations have failed.",
          marketplaces: [
            {
              name: "https://gitlab.example.com/team/flaky-mp",
              scope: "project",
              status: "failed",
              plugins: [
                {
                  status: "failed",
                  name: "https://gitlab.example.com/team/flaky-mp",
                  id: "https://gitlab.example.com/team/flaky-mp",
                  reasons: ["network error"],
                  scope: "project",
                  cause: {
                    causeChain: [
                      "503 on https://gitlab.example.com/team/flaky-mp",
                      "HTTP Error: 503",
                    ],
                    truncated: false,
                  },
                  leaks: [],
                  rollbackPartial: [],
                },
              ],
            },
          ],
        },
      },
    ]);
    capture.assertValid();
    verify(inventory);
    verify(ctx);
  });
});

test("ADD-10 orchestrated mode -- a host HTTP 500 returns the network-error outcome without notifying", async (t) => {
  await createHermeticEnvironment(t, "mp-add-host-http-orchestrated-home-");
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(0);
    const cloneThrows = httpError(500);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows,
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/flaky-mp",
      gitOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "network error",
      error: cloneThrows,
      cause: "HTTP Error: 500",
    });
    assert.deepStrictEqual(notifications, []);
  });
});

test("D-76-09 orchestrated mode -- a gone repository returns the source-missing outcome without notifying", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(0);
    const cloneThrows = httpError(410);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows,
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
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
    const { ctx, run, notifications } = makeCtx();
    // A denied/expired Device Flow (or a poll network error) makes
    // platform/git.ts's onAuth return `{ cancel: true }`, which
    // isomorphic-git throws as `UserCanceledError` -- NOT an HttpError
    // 401/403 and NOT a network errno.
    const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: authError,
    });

    // No raw throw past addMarketplace -- the standalone path must route
    // through notify() (IL-2).
    // act
    await addMarketplace({
      ctx,
      run,
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
    const { ctx, run, notifications } = makeCtx();
    const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: authError,
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
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
    const { ctx, run } = makeCtx();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
    // github.com runs the provider's Device Flow on a helper miss.
    assert.equal(cloneCall.auth.kind, "device-flow");
    assert.ok(
      buildAuthCallbacks(cloneCall.auth),
      "github auth bundle must be buildAuthCallbacks-compatible",
    );
  });
});

test("GHB-02: a GitHub add under the override clones the canonical URL with the override-host stored credential", async (t) => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    assert.deepStrictEqual(
      state.cloneCalls.map(({ url, auth }) => ({ url, auth })),
      [
        {
          url: "https://github.com/anthropics/claude-plugins-official.git",
          auth: { kind: "stored-credential", credentialOps, host: "mirror.example:8443" },
        },
      ],
    );
  });
});

test("GHB-03: a standalone GitHub add fails the command on an invalid base", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    const { ctx, run } = makeCtx(0);
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act & assert
    await assert.rejects(
      () =>
        addMarketplace({
          ctx,
          run,
          scope: "project",
          cwd,
          rawSource: "anthropics/claude-plugins-official",
          gitOps,
        }),
      (error: unknown) => {
        assert.deepStrictEqual(
          error,
          new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
        );
        return true;
      },
    );
    assert.deepStrictEqual(state.cloneCalls, []);
    assert.equal(await pathExists(locations.stateJsonPath), false);
  });
});

test("GHB-03: an orchestrated GitHub add rethrows an invalid base instead of returning unparseable", async (t) => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    const { ctx, run } = makeCtx(0);
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act & assert
    await assert.rejects(
      () =>
        addMarketplace({
          ctx,
          run,
          scope: "project",
          cwd,
          rawSource: "anthropics/claude-plugins-official",
          gitOps,
          notifications: { mode: "orchestrated" },
        }),
      (error: unknown) => {
        assert.deepStrictEqual(
          error,
          new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
        );
        return true;
      },
    );
    assert.equal(await pathExists(locations.stateJsonPath), false);
  });
});

test("GHB-01: a GitHub add failing under the override names the fetched URL on a failed child row", async (t) => {
  await createHermeticEnvironment(t, "mp-add-fetched-url-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example/git");
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const cloneThrows = Object.assign(httpError(404), {
      cause: new FetchedUrlCause(
        "https://mirror.example/git/anthropics/claude-plugins-official.git",
      ),
    });
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows,
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          "⊘ anthropics/claude-plugins-official [project] (failed)\n" +
          "  ⊘ anthropics/claude-plugins-official (failed) {source missing}\n" +
          "    cause: HTTP Error: 404 -> fetched https://mirror.example/git/anthropics/claude-plugins-official.git",
        severity: "error",
      },
    ]);
    assert.equal(await pathExists(locations.stateJsonPath), false);
  });
});

test("GHB-01: an orchestrated GitHub add failing under the override still classifies the clone failure", async (t) => {
  await createHermeticEnvironment(t, "mp-add-fetched-url-orchestrated-home-");
  await withTmpScope(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example/git");
    const { ctx, run } = makeCtx(0);
    const { credOps: credentialOps } = createCredentialOps();
    const cloneThrows = Object.assign(httpError(404), {
      cause: new FetchedUrlCause(
        "https://mirror.example/git/anthropics/claude-plugins-official.git",
      ),
    });
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows,
    });

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "anthropics/claude-plugins-official",
      gitOps,
      credentialOps,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      reason: "source missing",
      error: cloneThrows,
      cause: "HTTP Error: 404",
    });
  });
});

test("D-79-03: a url add that 401s on a host with no Device Flow renders the bare (failed) {authentication required} row with NO cause line", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    // D-79-03 (amended): a url add that the GitHub base override did not
    // rewrite renders no child row (D-01/D-10, GHB-04), so the stored-credential
    // cause line renders ONLY on the update path's cause-carrying child row --
    // the add row stays the bare closed-set token.
    const { credOps: credentialOps } = createCredentialOps();
    const httpErr = Object.assign(new Error("HTTP 401 from clone"), {
      code: "HttpError",
      data: { statusCode: 401 },
    });
    const { gitOps } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows: httpErr,
    });

    // act
    await addMarketplace({
      ctx,
      run,
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
    // NO cause trailer and NO stored-credential line on the add surface. The
    // live constant is imported rather than spelled as a second literal, so
    // this assertion cannot outlive the text it polices.
    assert.equal(note.message.includes(NO_STORED_CREDENTIAL_CAUSE("gitlab.example.com")), false);
    assert.equal(note.message.includes("cause:"), false);
  });
});

test("PROV-02: a public url add on a host with no Device Flow carries its bundle but consults nothing -- no credential interaction, no Device Flow prompt", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps, state: credState } = createCredentialOps();
    const { http: deviceFlowHttp, state: httpState } = createDeviceFlowHttp();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: "https://gitlab.example.com/team/mp",
      gitOps,
      credentialOps,
      deviceFlowHttp,
    });

    // GAUTH-03: the clone carries a host-keyed bundle, and PROV-02's surviving
    // guarantee is that nothing in it is consulted until the server challenges.
    // assert
    assert.equal(state.cloneCalls.length, 1);
    const cloneCall = state.cloneCalls[0];
    assert.ok(cloneCall);
    assert.deepStrictEqual(cloneCall.auth, {
      credentialOps,
      host: "gitlab.example.com",
      kind: "stored-credential",
    });
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

test("PROV-01 / D-76-02: an add whose host case-folds to github.com clones as a github source with the provider auth bundle", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const { credOps: credentialOps } = createCredentialOps();

    // D-76-02: the parser folds the host's case, so this is a `github` source
    // and clones at the canonical github.com url with the GitHub provider's
    // bundle (unlike the no-provider gitlab.example.com adds above).
    // act
    await addMarketplace({
      ctx,
      run,
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
    assert.equal(cloneCall.url, "https://github.com/acme/mp.git");
    assert.ok(cloneCall.auth, "provider-registered host must attach an auth bundle");
    assert.equal(cloneCall.auth.host, "github.com");
    assert.equal(cloneCall.auth.kind, "device-flow");
  });
});

test("GAUTH-02 / MURL-08: a gitlab.com url add clones the URL as typed WITH the GitLab provider's auth bundle attached to the same clone call", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const { credOps: credentialOps } = createCredentialOps();

    // Unlike the gitlab.example.com adds above (MURL-08, PROV-02), gitlab.com
    // is claimed by GITLAB_PROVIDER (exact-match hostMatch) -- the real
    // findProviderForHost/buildAuthForHost path (no mock auth registry) must
    // attach its auth bundle to the SAME clone call that carries the
    // verbatim wire URL.
    // act
    await addMarketplace({
      ctx,
      run,
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
    // D-2-01: no `.git` is appended for a non-github host; the wire URL is
    // sent exactly as typed.
    assert.equal(cloneCall.url, "https://gitlab.com/team/mp");
    // GAUTH-02: the clone carries a bundle bound to gitlab.com, the host the
    // registry claims for the GitLab provider.
    assert.ok(cloneCall.auth, "gitlab.com must attach the GitLab provider's auth bundle");
    assert.equal(cloneCall.auth.host, "gitlab.com");
  });
});

// D-2-04: MURL-09 is re-aimed at the assertion that survives without a second
// attempt -- the URL sent is the URL typed modulo decoration stripping, and
// exactly one network attempt is made per operation. `rethrowPreconditionErrors`
// lets the original clone error reach this test, so its identity through the
// add seam is provable alongside the attempt count.
test("MURL-09: a 404 clone failure makes exactly one attempt and keeps its original identity", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const cloneThrows = httpError(404);
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows,
    });

    // act & assert
    await assert.rejects(
      addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "https://gitlab.example.com/team/missing-mp",
        gitOps,
        rethrowPreconditionErrors: true,
      }),
      (err: unknown) => err === cloneThrows,
    );
    assert.equal(cloneThrows.message, "HTTP Error: 404");
    assert.equal((cloneThrows as { code?: string }).code, "HttpError");
    assert.deepStrictEqual((cloneThrows as { data?: { statusCode: number } }).data, {
      statusCode: 404,
    });
    assert.equal(state.cloneCalls.length, 1);
    assert.equal(state.cloneCalls[0]?.url, "https://gitlab.example.com/team/missing-mp");
  });
});

test("MURL-09: a 401 clone failure makes exactly one attempt and keeps its original identity", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const cloneThrows = httpError(401);
    const { gitOps, state } = createGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      cloneThrows,
    });

    // act & assert
    await assert.rejects(
      addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "https://gitlab.example.com/team/private-mp",
        gitOps,
        rethrowPreconditionErrors: true,
      }),
      (err: unknown) => err === cloneThrows,
    );
    assert.equal(cloneThrows.message, "HTTP Error: 401");
    assert.equal((cloneThrows as { code?: string }).code, "HttpError");
    assert.deepStrictEqual((cloneThrows as { data?: { statusCode: number } }).data, {
      statusCode: 401,
    });
    assert.equal(state.cloneCalls.length, 1);
    assert.equal(state.cloneCalls[0]?.url, "https://gitlab.example.com/team/private-mp");
  });
});

// D-2-02: accepted regression -- a host that serves ONLY its `.git`-suffixed
// path 404s a verbatim request under D-2-01. The fake stands in for that host by
// admitting only the suffixed remote. What is observable here is the wire url and
// the attempt count: one attempt, at the URL as typed, and the failure reaches
// the caller rather than being retried behind a suffix.
test("MURL-09 / D-2-02: an add against a suffix-only port sends the verbatim URL once and fails", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx();
    const { gitOps, state } = createGitOps();

    // act & assert
    await assert.rejects(
      addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: "https://gitlab.example.com/team/git-only-mp",
        gitOps,
      }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        return true;
      },
    );
    assert.equal(state.cloneCalls.length, 1);
    assert.equal(state.cloneCalls[0]?.url, "https://gitlab.example.com/team/git-only-mp");
  });
});

for (const { rawSource, host } of [
  { rawSource: "anthropics/claude-plugins-official", host: "github.com" },
  { rawSource: "https://gitlab.com/team/mp", host: "gitlab.com" },
]) {
  test(`FTCH-06 / D-79-02: an add of ${rawSource} answers its auth challenge from the command's memo`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run } = makeCtx(0);
      const { credOps: credentialOps } = createCredentialOps();
      const { http: deviceFlowHttp, state: deviceFlowState } = createDeviceFlowHttp();
      const { gitOps, state } = createGitOps({
        fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
      });
      const remembered: AuthAttemptResult = { ok: false, reason: "declined earlier" };
      const snapshot: ExtensionState = { schemaVersion: 2, marketplaces: {} };

      // act
      await addMarketplaceToState({
        state: snapshot,
        locations,
        source: parseAddableSource(rawSource),
        cwd,
        ctx,
        run,
        removalOps: createRemovalOps(),
        credentialOps,
        deviceFlowHttp,
        gitOps,
        authMemo: new Map([[host, remembered]]),
      });
      const auth = state.cloneCalls[0]?.auth;
      assert.ok(auth?.kind === "device-flow");
      const attempt = await auth.onAuthRequired();

      // assert
      assert.equal(attempt, remembered);
      assert.deepStrictEqual(deviceFlowState.requestCodeCalls, []);
    });
  });
}

test("notifyAddFailure renders a caught add failure as the public add command does", () => {
  // arrange
  const { ctx, run, notifications } = makeCtx();

  // act
  notifyAddFailure(
    {
      ctx,
      run,
      scope: "user",
      cwd: "/unused",
      rawSource: "acme/tools",
      completionCache: createCompletionCache(),
    },
    httpError(404),
  );

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A marketplace operation has failed.\n\n⊘ acme/tools [user] (failed) {source missing}",
      severity: "error",
    },
  ]);
});

test("notifyAddFailure rethrows an error that is not an add precondition", () => {
  // arrange
  const { ctx, run } = makeCtx(0);
  const unexpected = new Error("unexpected");

  // act & assert
  assert.throws(
    () => {
      notifyAddFailure(
        {
          ctx,
          run,
          scope: "user",
          cwd: "/unused",
          rawSource: "acme/tools",
          completionCache: createCompletionCache(),
        },
        unexpected,
      );
    },
    (error: unknown) => error === unexpected,
  );
});

for (const code of ["EISDIR", "EIO", "EBADF"]) {
  test(`D-PL5-18: notifyAddFailure renders a ${code} failure as (failed) {unreadable}`, () => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const failure = Object.assign(new Error(`${code}: read failed`), { code });

    // act
    notifyAddFailure(
      {
        ctx,
        run,
        scope: "user",
        cwd: "/unused",
        rawSource: "acme/tools",
        completionCache: createCompletionCache(),
      },
      failure,
    );

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "A marketplace operation has failed.\n\n⊘ acme/tools [user] (failed) {unreadable}",
        severity: "error",
      },
    ]);
  });
}

for (const code of ["EACCES", "EPERM"]) {
  test(`MPA-02: notifyAddFailure rethrows a ${code} write failure instead of reading permission denied`, () => {
    // arrange
    const { ctx, run } = makeCtx(0);
    const refused = Object.assign(new Error(`${code}: write refused`), { code });

    // act & assert
    assert.throws(
      () => {
        notifyAddFailure(
          {
            ctx,
            run,
            scope: "user",
            cwd: "/unused",
            rawSource: "acme/tools",
            completionCache: createCompletionCache(),
          },
          refused,
        );
      },
      (error: unknown) => error === refused,
    );
  });
}

test("MPA-01 / D-03: a same-source add refuses as a duplicate name when the target layer declares the name with another source", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = await writeNamedPathMarketplace(cwd, "tools");
    const first = makeCtx();
    await addMarketplace({
      ctx: first.ctx,
      run: first.run,
      scope: "project",
      cwd,
      rawSource: marketplaceRoot,
      gitOps: createGitOps().gitOps,
    });
    await writeFile(
      locations.baseConfigJsonPath,
      JSON.stringify({ schemaVersion: 1, marketplaces: { tools: { source: "./elsewhere" } } }),
    );
    const { ctx, run, notifications } = makeCtx();

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: marketplaceRoot,
      gitOps: createGitOps().gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n⊘ tools [project] (failed) {duplicate name}",
        severity: "error",
      },
    ]);
  });
});

test("MPA-02: a path manifest nobody may read renders (failed) {permission denied}", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const marketplaceRoot = await writeNamedPathMarketplace(cwd, "tools");
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    await chmod(manifestPath, 0o000);
    const { ctx, run, notifications } = makeCtx();

    // act
    try {
      await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: marketplaceRoot,
        gitOps: createGitOps().gitOps,
      });
    } finally {
      await chmod(manifestPath, 0o644);
    }

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `A marketplace operation has failed.\n\n⊘ ${marketplaceRoot} [project] (failed) {permission denied}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual((await loadState(locations.extensionRoot)).marketplaces, {});
  });
});

const HOSTED_URL = "https://catalog.example/acme/marketplace.json";

/** The hosted ownership marker of a download of `url` (D-PL5-06). */
const HOSTED_MARKER = ".pi-claude-marketplace-hosted.json";

function hostedMarkerBytes(url: string): string {
  return `{\n  "generatedBy": "pi-claude-marketplace",\n  "url": "${url}"\n}\n`;
}

/**
 * A hosted catalog host that answers every download with `answer`: the bytes
 * of a catalog, or the error the download throws. It records each URL asked.
 */
function createHostedManifestFetch(answer: string | Error = VALID_MANIFEST_JSON): {
  readonly hostedManifestFetch: HostedManifestFetch;
  readonly urls: readonly string[];
} {
  const urls: string[] = [];
  return {
    hostedManifestFetch: (url) => {
      urls.push(url);
      return answer instanceof Error
        ? Promise.reject(answer)
        : Promise.resolve(Buffer.from(answer));
    },
    urls,
  };
}

/** Seeds `sources/valid-marketplace/` with a sentinel file and, when given, a hosted marker. */
async function arrangeHostedLeftover(
  locations: ScopedLocations,
  marker: string | undefined,
): Promise<string> {
  const finalDir = await locations.sourceCloneDir("valid-marketplace");
  await mkdir(finalDir, { recursive: true });
  await writeFile(path.join(finalDir, ".leftover-sentinel"), "x");
  if (marker !== undefined) {
    await writeFile(path.join(finalDir, HOSTED_MARKER), marker);
  }

  return finalDir;
}

test("MKT-02: a hosted add downloads the catalog once and records it like a clone", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const rawSource = `${HOSTED_URL}#latest`;
    const { ctx, run, notifications } = makeCtx();
    const { hostedManifestFetch, urls } = createHostedManifestFetch();
    const finalDir = await locations.sourceCloneDir("valid-marketplace");
    const manifestPath = path.join(finalDir, ".claude-plugin", "marketplace.json");

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource, hostedManifestFetch });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    assert.deepStrictEqual(urls, [HOSTED_URL]);
    const recorded = (await loadState(locations.extensionRoot)).marketplaces["valid-marketplace"];
    assert.ok(recorded);
    assert.deepStrictEqual(recorded, {
      lastUpdatedAt: recorded.lastUpdatedAt,
      name: "valid-marketplace",
      scope: "project",
      source: { kind: "hosted", raw: rawSource, url: HOSTED_URL },
      addedFromCwd: cwd,
      plugins: {},
      manifestPath,
      marketplaceRoot: finalDir,
      lastSuccessfulManifest: VALID_MANIFEST_JSON,
    });
    assert.deepStrictEqual(
      {
        catalog: await readFile(manifestPath, "utf8"),
        marker: await readFile(path.join(finalDir, HOSTED_MARKER), "utf8"),
        config: await readFile(locations.baseConfigJsonPath, "utf8"),
        staging: await readdir(path.join(locations.extensionRoot, "sources-staging")),
      },
      {
        catalog: VALID_MANIFEST_JSON,
        marker: hostedMarkerBytes(HOSTED_URL),
        config: declaredMarketplaceBytes("valid-marketplace", rawSource),
        staging: [],
      },
    );
  });
});

test("MA-12 / D-PL5-06: a hosted leftover marked with the same URL is replaced", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const finalDir = await arrangeHostedLeftover(locations, hostedMarkerBytes(HOSTED_URL));
    const { hostedManifestFetch } = createHostedManifestFetch();

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: HOSTED_URL,
      hostedManifestFetch,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    assert.deepStrictEqual(
      {
        sentinel: await pathExists(path.join(finalDir, ".leftover-sentinel")),
        recordedRoot: (await loadState(locations.extensionRoot)).marketplaces["valid-marketplace"]
          ?.marketplaceRoot,
      },
      { sentinel: false, recordedRoot: finalDir },
    );
  });
});

for (const { title, marker } of [
  { title: "no hosted marker", marker: undefined },
  {
    title: "a hosted marker for another URL",
    marker: hostedMarkerBytes("https://other.example/m.json"),
  },
]) {
  test(`MA-13 / D-PL5-06: a hosted leftover with ${title} refuses as stale clone and stays`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run, notifications } = makeCtx();
      const finalDir = await arrangeHostedLeftover(locations, marker);
      const { hostedManifestFetch } = createHostedManifestFetch();

      // act
      await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: HOSTED_URL,
        hostedManifestFetch,
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {stale clone}",
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(
        {
          sentinel: await pathExists(path.join(finalDir, ".leftover-sentinel")),
          staging: await readdir(path.join(locations.extensionRoot, "sources-staging")),
          state: await loadState(locations.extensionRoot),
          config: await pathExists(locations.baseConfigJsonPath),
        },
        {
          sentinel: true,
          staging: [],
          state: { schemaVersion: 3, marketplaces: {} },
          config: false,
        },
      );
    });
  });
}

test("D-PL5-20: addMarketplaceToState returns the download directory of a hosted source", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run } = makeCtx(0);
    const { hostedManifestFetch } = createHostedManifestFetch();
    const snapshot: ExtensionState = { schemaVersion: 3, marketplaces: {} };

    // act
    const added = await addMarketplaceToState({
      state: snapshot,
      locations,
      source: parseAddableSource(HOSTED_URL),
      cwd,
      ctx,
      run,
      removalOps: createRemovalOps(),
      hostedManifestFetch,
    });

    // assert
    const cloneDir = await locations.sourceCloneDir("valid-marketplace");
    assert.deepStrictEqual(added, { name: "valid-marketplace", cloneDir });
    assert.strictEqual(snapshot.marketplaces["valid-marketplace"]?.marketplaceRoot, cloneDir);
    assert.strictEqual(
      await readFile(path.join(cloneDir, ".claude-plugin", "marketplace.json"), "utf8"),
      VALID_MANIFEST_JSON,
    );
  });
});

/** The entry names of `dir`; an absent directory holds none. */
async function entriesOf(dir: string): Promise<readonly string[]> {
  return (await pathExists(dir)) ? readdir(dir) : [];
}

/** What a failed add may have left in the scope: records, config, and checkouts. */
async function scopeLeftovers(locations: ScopedLocations): Promise<unknown> {
  return {
    state: await loadState(locations.extensionRoot),
    config: await pathExists(locations.baseConfigJsonPath),
    sources: await entriesOf(path.join(locations.extensionRoot, "sources")),
    staging: await entriesOf(path.join(locations.extensionRoot, "sources-staging")),
  };
}

const NOTHING_LEFT = {
  state: { schemaVersion: 3, marketplaces: {} },
  config: false,
  sources: [],
  staging: [],
};

/** The bare failed-add row of a hosted add. */
function failedHostedRow(reason: string): string {
  return `A marketplace operation has failed.\n\n⊘ ${HOSTED_URL} [project] (failed) {${reason}}`;
}

/** The failed-add row of a hosted add whose child row carries `cause`. */
function failedHostedChildRow(reason: string, cause: string): string {
  return (
    "Some operations have failed.\n\n" +
    `⊘ ${HOSTED_URL} [project] (failed)\n` +
    `  ⊘ ${HOSTED_URL} (failed) {${reason}}\n` +
    `    cause: ${cause}`
  );
}

const HOSTED_FAILURES: readonly {
  readonly answer: string | Error;
  readonly reason: string;
  readonly message: string;
}[] = [
  {
    answer: new HostedManifestFetchError("network", `Could not connect to ${HOSTED_URL}`, {
      cause: new TypeError("fetch failed"),
    }),
    reason: "network unreachable",
    message: failedHostedChildRow(
      "network unreachable",
      `Could not connect to ${HOSTED_URL} -> fetch failed`,
    ),
  },
  {
    answer: new HostedManifestFetchError("unreadable", "too large"),
    reason: "unreadable",
    message: failedHostedChildRow("unreadable", "too large"),
  },
  {
    answer: new HostedManifestHttpError(HOSTED_URL, 404),
    reason: "source missing",
    message: failedHostedRow("source missing"),
  },
  {
    answer: new HostedManifestHttpError(HOSTED_URL, 410),
    reason: "source missing",
    message: failedHostedRow("source missing"),
  },
  {
    answer: new HostedManifestHttpError(HOSTED_URL, 401),
    reason: "authentication required",
    message: failedHostedRow("authentication required"),
  },
  {
    answer: new HostedManifestHttpError(HOSTED_URL, 403),
    reason: "authentication required",
    message: failedHostedRow("authentication required"),
  },
  { answer: "{", reason: "unparseable", message: failedHostedRow("unparseable") },
  {
    answer: '{"name":"tools"}',
    reason: "invalid manifest",
    message: failedHostedRow("invalid manifest"),
  },
];

for (const { answer, reason, message } of HOSTED_FAILURES) {
  const title = answer instanceof Error ? answer.message : answer;
  test(`D-PL5-10: a hosted download answering ${title} fails as ${reason} and leaves nothing`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run, notifications } = makeCtx();
      const { hostedManifestFetch } = createHostedManifestFetch(answer);

      // act
      await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: HOSTED_URL,
        hostedManifestFetch,
      });

      // assert
      assert.deepStrictEqual(notifications, [{ message, severity: "error" }]);
      assert.deepStrictEqual(await scopeLeftovers(locations), NOTHING_LEFT);
    });
  });

  test(`D-PL5-10: an orchestrated hosted download answering ${title} returns ${reason}`, async () => {
    await withTmpScope(async ({ cwd, locations }) => {
      // arrange
      const { ctx, run } = makeCtx(0);
      const { hostedManifestFetch } = createHostedManifestFetch(answer);

      // act
      const outcome = await addMarketplace({
        ctx,
        run,
        scope: "project",
        cwd,
        rawSource: HOSTED_URL,
        hostedManifestFetch,
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.strictEqual(outcome.status, "failed");
      assert.strictEqual(outcome.reason, reason);
      assert.deepStrictEqual(await scopeLeftovers(locations), NOTHING_LEFT);
    });
  });
}

test("D-PL5-10 / PMOD-04: a refused hosted URL with a password shows the refusal and masks the password", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const rawSource = "https://user:secret@catalog.example/acme/marketplace.json";
    const { ctx, run, notifications } = makeCtx();
    const { hostedManifestFetch } = createHostedManifestFetch(
      new HostedManifestFetchError(
        "unreadable",
        `Marketplace URL must not contain a user name or password: ${rawSource}`,
      ),
    );

    // act
    await addMarketplace({ ctx, run, scope: "project", cwd, rawSource, hostedManifestFetch });

    // assert
    const masked = "https://***@catalog.example/acme/marketplace.json";
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          `⊘ ${masked} [project] (failed)\n` +
          `  ⊘ ${masked} (failed) {unreadable}\n` +
          `    cause: Marketplace URL must not contain a user name or password: ${masked}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await scopeLeftovers(locations), NOTHING_LEFT);
  });
});

test("D-PL5-10 / ADD-10: a hosted download answering HTTP 500 renders {network error} with the status on the URL", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { hostedManifestFetch } = createHostedManifestFetch(
      new HostedManifestHttpError(HOSTED_URL, 500),
    );

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: HOSTED_URL,
      hostedManifestFetch,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          `⊘ ${HOSTED_URL} [project] (failed)\n` +
          `  ⊘ ${HOSTED_URL} (failed) {network error}\n` +
          `    cause: 500 on ${HOSTED_URL} -> HTTP 500 error while downloading marketplace from ${HOSTED_URL}. The marketplace file may not exist at this URL.`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await scopeLeftovers(locations), NOTHING_LEFT);
  });
});

test("D-PL5-17: re-adding a hosted marketplace whose download is gone downloads it again and keeps its plugins", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const first = makeCtx();
    await addMarketplace({
      ctx: first.ctx,
      run: first.run,
      scope: "project",
      cwd,
      rawSource: HOSTED_URL,
      hostedManifestFetch: createHostedManifestFetch().hostedManifestFetch,
    });
    const state = await loadState(locations.extensionRoot);
    const recorded = state.marketplaces["valid-marketplace"];
    assert.ok(recorded);
    const record = { ...recorded, plugins: { hello: INSTALLED_HELLO } };
    await saveState(locations.extensionRoot, {
      ...state,
      marketplaces: { "valid-marketplace": record },
    });
    await rm(record.marketplaceRoot, { recursive: true });
    const configBefore = await readFile(locations.baseConfigJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx();
    const { hostedManifestFetch, urls } = createHostedManifestFetch();

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: HOSTED_URL,
      hostedManifestFetch,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
    assert.deepStrictEqual(urls, [HOSTED_URL]);
    const repaired = (await loadState(locations.extensionRoot)).marketplaces["valid-marketplace"];
    assert.ok(repaired);
    assert.deepStrictEqual(repaired, { ...record, lastUpdatedAt: repaired.lastUpdatedAt });
    assert.deepStrictEqual(
      {
        catalog: await readFile(record.manifestPath, "utf8"),
        marker: await readFile(path.join(record.marketplaceRoot, HOSTED_MARKER), "utf8"),
        config: await readFile(locations.baseConfigJsonPath, "utf8"),
      },
      { catalog: VALID_MANIFEST_JSON, marker: hostedMarkerBytes(HOSTED_URL), config: configBefore },
    );
  });
});

test("MKT-01: refuses a hosted catalog that declares a reserved name and leaves nothing", async (t) => {
  await createHermeticEnvironment(t, "mp-add-reserved-hosted-home-");
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { hostedManifestFetch } = createHostedManifestFetch(
      JSON.stringify({ name: "claude-plugins-official", owner: { name: "acme" }, plugins: [] }),
    );

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: HOSTED_URL,
      hostedManifestFetch,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          `⊘ ${HOSTED_URL} [project] (failed)\n` +
          `  ⊘ ${HOSTED_URL} (failed) {invalid manifest}\n` +
          "    cause: The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization.",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await scopeLeftovers(locations), NOTHING_LEFT);
  });
});

// ---------------------------------------------------------------------------
// D-PL2-09: the missing-dependency step a standalone add runs after it records
// the marketplace, in the add's scope, for dependencies the added marketplace
// offers.
// ---------------------------------------------------------------------------

const DEPENDENCY_INSTALLED_ROW = {
  status: "installed",
  name: "lib@valid-marketplace",
  version: "1.0.0",
  dependencies: [],
  reasons: ["dependency installed"],
  severity: "info",
  needsReload: true,
} as const satisfies ScopeDependencyInstallRow;

interface DependencyInstallCall {
  readonly scope: Scope;
  readonly cwd: string;
  readonly selects: readonly boolean[];
  readonly recorded: boolean;
  readonly lockHeld: boolean;
}

/**
 * A recording missing-dependency step. Each call records the request, what
 * `select` answers for an entry of the added marketplace and one of another,
 * whether the add's record is already durable, and whether the scope lock is
 * held while the step runs.
 */
function recordingDependencyInstall(result: ScopeDependencyInstallResult): {
  readonly installMissingDependencies: ScopeDependencyInstallFn;
  readonly calls: DependencyInstallCall[];
} {
  const calls: DependencyInstallCall[] = [];
  const installMissingDependencies: ScopeDependencyInstallFn = async (request) => {
    const locations = locationsFor(request.scope, request.cwd);
    const state = await loadState(locations.extensionRoot);
    calls.push({
      scope: request.scope,
      cwd: request.cwd,
      selects: [
        request.select({ plugin: "lib", marketplace: "valid-marketplace", declarers: ["app@x"] }),
        request.select({ plugin: "lib", marketplace: "other", declarers: ["app@x"] }),
      ],
      recorded: Object.hasOwn(state.marketplaces, "valid-marketplace"),
      lockHeld: await lockfile.check(locations.extensionRoot, {
        lockfilePath: locations.stateLockFile,
        realpath: false,
      }),
    });
    return result;
  };

  return { installMissingDependencies, calls };
}

/** A missing-dependency step a case promises is never reached. */
function unreachedDependencyInstall(): ScopeDependencyInstallFn {
  return () => Promise.reject(new Error("the missing-dependency step must not run"));
}

test("D-PL2-09: a standalone add runs the missing-dependency step once, after its commit, and renders its rows under the added marketplace", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const step = recordingDependencyInstall({
      rows: [DEPENDENCY_INSTALLED_ROW],
      mcpConfigNotices: [],
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: fixtureMarketplaceDir("valid-marketplace"),
      installMissingDependencies: step.installMissingDependencies,
    });

    // assert
    assert.deepStrictEqual(step.calls, [
      { scope: "project", cwd, selects: [true, false], recorded: true, lockHeld: false },
    ]);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● valid-marketplace [project] (added)\n" +
          "  ● lib@valid-marketplace v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
  });
});

test("AFILE-04 / D-PL2-09: the MCP config notices of the step's installs follow the add's notification", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(2);
    const step = recordingDependencyInstall({
      rows: [DEPENDENCY_INSTALLED_ROW],
      mcpConfigNotices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: fixtureMarketplaceDir("valid-marketplace"),
      installMissingDependencies: step.installMissingDependencies,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● valid-marketplace [project] (added)\n" +
          "  ● lib@valid-marketplace v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "/reload to pick up changes",
      },
      {
        message:
          "MCP config comments removed.\n\n" +
          "The project-scope mcp-adapter.json was rewritten to update plugin MCP servers; " +
          "its JSONC comments were removed and everything else in it was kept.",
        severity: "warning",
      },
    ]);
  });
});

test("D-PL10-19: tagged hygiene warnings from dependency installs follow the add row", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx(2);
    const step = recordingDependencyInstall({
      rows: [DEPENDENCY_INSTALLED_ROW],
      stagingDiagnostics: [
        {
          plugin: "lib",
          scope: "project",
          verb: "installed",
          warnings: [{ kind: "hygiene", message: "[helper] dropped fields: color" }],
        },
      ],
      mcpConfigNotices: [],
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: fixtureMarketplaceDir("valid-marketplace"),
      installMissingDependencies: step.installMissingDependencies,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● valid-marketplace [project] (added)\n" +
          "  ● lib@valid-marketplace v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "/reload to pick up changes",
      },
      {
        message:
          'Plugin "lib" [project] installed; 1 staging warning.\n\n' +
          "[helper] dropped fields: color",
        severity: "warning",
      },
    ]);
  });
});

test("D-PL2-09: a step that throws still reports the committed add before the throw reaches the caller", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    // GHB-03: the one throw the dependency install lets through.
    const failure = new InvalidGitHubBaseUrlError(
      "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
      "not-a-url",
    );

    // act
    const added = addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: fixtureMarketplaceDir("valid-marketplace"),
      installMissingDependencies: () => Promise.reject(failure),
    });

    // assert
    await assert.rejects(added, (err) => err === failure);
    assert.deepStrictEqual(notifications, [{ message: "● valid-marketplace [project] (added)" }]);
  });
});

test("D-PL2-09: an add of a marketplace the scope already holds never runs the step", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const rawSource = fixtureMarketplaceDir("valid-marketplace");
    const first = makeCtx();
    await addMarketplace({ ctx: first.ctx, run: first.run, scope: "project", cwd, rawSource });
    const { ctx, run, notifications } = makeCtx();

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource,
      installMissingDependencies: unreachedDependencyInstall(),
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● valid-marketplace [project] (skipped) {already added}" },
    ]);
  });
});

test("D-PL2-09: a failed add never runs the step", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();

    const rawSource = fixtureMarketplaceDir("invalid-manifest");

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource,
      installMissingDependencies: unreachedDependencyInstall(),
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `A marketplace operation has failed.\n\n⊘ ${rawSource} [project] (failed) {unparseable}`,
        severity: "error",
      },
    ]);
  });
});

test("D-PL2-09: an orchestrated add never runs the step, because its caller runs its own", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run } = makeCtx(0);

    // act
    const outcome = await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: fixtureMarketplaceDir("valid-marketplace"),
      notifications: { mode: "orchestrated" },
      installMissingDependencies: unreachedDependencyInstall(),
    });

    // assert
    assert.deepStrictEqual(outcome, { status: "added", name: "valid-marketplace" });
  });
});

test("D-PL2-11: a refused dependency install raises the add's notification to error and keeps the (added) header", async () => {
  await withTmpScope(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const step = recordingDependencyInstall({
      rows: [
        {
          status: "failed",
          name: "lib@valid-marketplace",
          reasons: ["dependency failed"],
          cause: new Error(
            'Dependency "core@valid-marketplace" is not declared by its marketplace.',
          ),
          severity: "error",
          needsReload: false,
        },
      ],
      mcpConfigNotices: [],
    });

    // act
    await addMarketplace({
      ctx,
      run,
      scope: "project",
      cwd,
      rawSource: fixtureMarketplaceDir("valid-marketplace"),
      installMissingDependencies: step.installMissingDependencies,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● valid-marketplace [project] (added)\n" +
          "  ⊘ lib@valid-marketplace (failed) {dependency failed}\n" +
          '    cause: Dependency "core@valid-marketplace" is not declared by its marketplace.',
        severity: "error",
      },
    ]);
  });
});
