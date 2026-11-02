import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  materializePluginCommitCopy,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { probeInstallClone } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts";
import {
  authorizeMissingDependency,
  buildInstallLedgerOptions,
  catalogLookup,
  collectInstalledKeys,
  dependencyLedgerOptions,
  installMcpConfigNoticesMember,
  loadInstallRootAllowlist,
  memberLedgerPin,
  settleAddedMarketplaces,
  sharedCascadeOptions,
  trackInstallAdds,
  unwrapCascade,
  withMcpConfigNotices,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts";
import { DEFAULT_MARKETPLACE_ADD } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  DEFAULT_STATE,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  DependencyCascadeError,
  InvalidMarketplaceManifestError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { runPhases } from "../../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import { makeCtx } from "./install-flow-fixture.ts";
import { seedMarketplaceRecord } from "./marketplace-seed.ts";

import type {
  AuthAttemptResult,
  CredentialOps,
  DeviceFlowHttp,
} from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type {
  AddedMarketplaces,
  MarketplaceAddSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/carried-marketplace-adds.ts";
import type {
  CascadeMarketplaceTagProbe,
  CascadeTagProbe,
  ResolvedCascadeMember,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import type { CascadeFailureSink } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts";
import type { InstallFailureCapture } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import type { InstallPluginOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { McpConfigNotice } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

const transaction = { runPhases, withLockedStateTransaction };
const REMOVAL_OPS = { rm: () => Promise.resolve() };

function member(overrides: Partial<ResolvedCascadeMember> = {}): ResolvedCascadeMember {
  return {
    key: "dep@mp",
    name: "dep",
    marketplace: "mp",
    requiredBy: "app@mp",
    ranges: [],
    ...overrides,
  };
}

async function temporaryCwd(t: TestContext, prefix: string): Promise<string> {
  const { cwd } = await createHermeticEnvironment(t, prefix);
  return cwd;
}

async function seedCatalogRecord(
  cwd: string,
  marketplace: string,
  catalog: Record<string, unknown>,
): Promise<MarketplaceRecord> {
  const record = await seedMarketplaceRecord({ cwd, marketplace, plugins: {}, scope: "project" });
  await writeFile(record.manifestPath, JSON.stringify({ name: marketplace, ...catalog }));
  return record;
}

function emptyCapture(): InstallFailureCapture {
  return { rollbackPartials: [], version: undefined };
}

test("builds member ledger options from shared and member inputs", () => {
  // arrange
  const { ctx, run } = makeCtx();
  const credentialOps: CredentialOps = {
    fill: () => Promise.resolve(null),
    approve: () => Promise.resolve(),
    reject: () => Promise.resolve(),
  };
  const deviceFlowHttp: DeviceFlowHttp = {
    requestCode: () =>
      Promise.resolve({
        device_code: "device",
        user_code: "code",
        verification_uri: "https://example.test",
        expires_in: 900,
        interval: 5,
      }),
    pollToken: () => Promise.resolve({ kind: "expired_token" }),
  };
  const authMemo = new Map<string, AuthAttemptResult>();
  const cloneCacheSeam = {
    resolvePluginPin,
    materializePluginClone,
    materializeOrRefreshPluginMirror,
    materializePluginCommitCopy,
  };
  const cloneCandidates = new Set<string>();
  const directoryPin = { range: "^1", declared: "^1", requiredBy: ["app@mp"] };
  const addedMarketplaces: AddedMarketplaces = [];

  // act
  const options = buildInstallLedgerOptions(
    {
      ctx,
      run,
      mapModel: true,
      partial: true,
      ledgerAdmission: "refresh",
      credentialOps,
      deviceFlowHttp,
      authMemo,
      cloneCacheSeam,
    },
    {},
    {
      scope: "project",
      cwd: "/project",
      marketplace: "mp",
      plugin: "dep",
      sourcePin: "abc123",
      resolvedVersion: "1.2.3",
      directoryPin,
      provenance: "dependency",
      pinVersion: "1.2.3",
      marketplaceAdd: DEFAULT_MARKETPLACE_ADD,
      addedMarketplaces,
      cloneCandidates,
      cloneProbe: probeInstallClone,
    },
    REMOVAL_OPS,
  );

  // assert
  assert.deepStrictEqual(options, {
    ctx,
    run,
    scope: "project",
    cwd: "/project",
    marketplace: "mp",
    plugin: "dep",
    sourcePinOverride: "abc123",
    resolvedVersion: "1.2.3",
    directoryPin,
    provenance: "dependency",
    mapModel: true,
    partial: true,
    ledgerAdmission: "refresh",
    pinVersionOverride: "1.2.3",
    cloneCacheSeam,
    cloneCandidates,
    cloneProbe: probeInstallClone,
    removalOps: REMOVAL_OPS,
    env: {},
    credentialOps,
    deviceFlowHttp,
    authMemo,
    marketplaceAdd: DEFAULT_MARKETPLACE_ADD,
    addedMarketplaces,
  });
});

test("builds member ledger options with only the required inputs", () => {
  // arrange
  const { ctx, run } = makeCtx();
  const addedMarketplaces: AddedMarketplaces = [];

  // act
  const options = buildInstallLedgerOptions(
    { ctx, run },
    {},
    {
      scope: "user",
      cwd: "/project",
      marketplace: "mp",
      plugin: "app",
      marketplaceAdd: DEFAULT_MARKETPLACE_ADD,
      addedMarketplaces,
    },
    REMOVAL_OPS,
  );

  // assert
  assert.deepStrictEqual(options, {
    ctx,
    run,
    scope: "user",
    cwd: "/project",
    marketplace: "mp",
    plugin: "app",
    cloneProbe: probeInstallClone,
    removalOps: REMOVAL_OPS,
    env: {},
    marketplaceAdd: DEFAULT_MARKETPLACE_ADD,
    addedMarketplaces,
  });
});

async function stateLocations(t: TestContext): Promise<ScopedLocations> {
  const cwd = await temporaryCwd(t, "install-cascade-adds-");
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, structuredClone(DEFAULT_STATE));
  return locations;
}

test("keeps the default add seam when no seam is supplied", () => {
  // act
  const adds = trackInstallAdds(transaction, undefined);

  // assert
  assert.strictEqual(adds.marketplaceAdd.settle, DEFAULT_MARKETPLACE_ADD.settle);
});

test("moves a saved marketplace addition to the committed list", async (t) => {
  // arrange
  const locations = await stateLocations(t);
  const adds = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);

  // act
  await adds.lockOwner.withLockedStateTransaction(locations, async (tx) => {
    adds.addedMarketplaces.push({
      marketplace: "saved",
      rawSource: "./saved",
      cloneDir: undefined,
    });
    await tx.save();
  });

  // assert
  assert.deepStrictEqual(adds.addedMarketplaces, []);
  assert.deepStrictEqual(adds.committedAdds, [
    { marketplace: "saved", rawSource: "./saved", cloneDir: undefined },
  ]);
});

test("discards the additions of a body that returns without saving", async (t) => {
  // arrange
  const locations = await stateLocations(t);
  const adds = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);

  // act
  await adds.lockOwner.withLockedStateTransaction(locations, () => {
    adds.addedMarketplaces.push({
      marketplace: "unsaved",
      rawSource: "./unsaved",
      cloneDir: undefined,
    });
    return Promise.resolve();
  });

  // assert
  assert.deepStrictEqual(adds.committedAdds, []);
  assert.deepStrictEqual(adds.addedMarketplaces, [
    { marketplace: "unsaved", rawSource: "./unsaved", cloneDir: undefined },
  ]);
});

test("rethrows the error of a body that adds a marketplace and throws", async (t) => {
  // arrange
  const locations = await stateLocations(t);
  const adds = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);
  const stopped = new Error("stopped");

  // act & assert
  await assert.rejects(
    adds.lockOwner.withLockedStateTransaction(locations, () => {
      adds.addedMarketplaces.push({
        marketplace: "thrown",
        rawSource: "./thrown",
        cloneDir: undefined,
      });
      return Promise.reject(stopped);
    }),
    stopped,
  );
  assert.deepStrictEqual(adds.committedAdds, []);
});

test("logs a clone it cannot remove after a body that returns without saving", async (t) => {
  // arrange
  const locations = await stateLocations(t);
  const lockedDir = path.join(path.dirname(locations.extensionRoot), "locked");
  const cloneDir = path.join(lockedDir, "clone");
  await mkdir(cloneDir, { recursive: true });
  await writeFile(path.join(cloneDir, "kept"), "x");
  await chmod(lockedDir, 0o500);
  const logged = captureDebugLog(t);
  const adds = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);

  // act
  try {
    await adds.lockOwner.withLockedStateTransaction(locations, () => {
      adds.addedMarketplaces.push({ marketplace: "leaked", rawSource: "./leaked", cloneDir });
      return Promise.resolve();
    });
  } finally {
    await chmod(lockedDir, 0o755);
  }

  // assert
  assert.strictEqual(logged.length, 1);
  assert.match(
    logged[0] ?? "",
    /install saved no state; failed to clean up marketplace final clone/u,
  );
});

test("settles saved marketplaces in list order", async () => {
  // arrange
  const settled: string[] = [];
  const seam: MarketplaceAddSeam = {
    ...DEFAULT_MARKETPLACE_ADD,
    settle: ({ name }) => {
      settled.push(name);
      return Promise.resolve();
    },
  };
  const locations = locationsFor("project", "/project");

  // act
  await settleAddedMarketplaces(
    [
      { marketplace: "first", rawSource: "./first", cloneDir: undefined },
      { marketplace: "second", rawSource: "./second", cloneDir: undefined },
    ],
    seam,
    locations,
    createCompletionCache(),
  );

  // assert
  assert.deepStrictEqual(settled, ["first", "second"]);
});

test("collects each installed plugin key", () => {
  // arrange
  const state: ExtensionState = {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp"),
        addedFromCwd: "/project",
        manifestPath: "/project/mp/.claude-plugin/marketplace.json",
        marketplaceRoot: "/project/mp",
        plugins: {
          app: {
            version: "1.0.0",
            enabled: true,
            provenance: "explicit",
            resolvedSource: "/project/mp/app",
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              hooks: [],
              mcpServers: [],
              workflows: [],
            },
            compatibility: {
              installable: true,
              notes: [],
              supported: [],
              unsupported: [],
            },
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };

  // act
  const keys = collectInstalledKeys(state);

  // assert
  assert.deepStrictEqual([...keys], ["app@mp"]);
});

test("reads the root allowlist from the cached manifest", async (t) => {
  // arrange
  const cwd = await temporaryCwd(t, "install-cascade-policy-");
  const record = await seedCatalogRecord(cwd, "mp", {
    plugins: [],
    allowCrossMarketplaceDependenciesOn: ["tools"],
  });

  // act
  const allowlist = await loadInstallRootAllowlist(() => Promise.resolve(record), "mp", "app");

  // assert
  assert.deepStrictEqual([...allowlist], ["tools"]);
});

test("reads an empty root allowlist when the marketplace is absent", async () => {
  // act
  const allowlist = await loadInstallRootAllowlist(
    () => Promise.resolve(undefined),
    "missing",
    "app",
  );

  // assert
  assert.deepStrictEqual([...allowlist], []);
});

async function authorizationFixture(
  t: TestContext,
  catalog: Record<string, unknown>,
): Promise<{ cwd: string; state: ExtensionState }> {
  const cwd = await temporaryCwd(t, "install-cascade-authorize-");
  const record = await seedCatalogRecord(cwd, "source", catalog);
  return { cwd, state: { schemaVersion: 3, marketplaces: { source: record } } };
}

test("authorizes a dependency declared from its own marketplace without reading a policy", async (t) => {
  // arrange
  const { cwd, state } = await authorizationFixture(t, { plugins: [] });

  // act
  const authorized = await authorizeMissingDependency({
    scope: "project",
    cwd,
    marketplace: "target",
    state,
    declarers: ["root@target"],
  });

  // assert
  assert.strictEqual(authorized, true);
});

test("authorizes a dependency a foreign declarer's marketplace allows", async (t) => {
  // arrange
  const { cwd, state } = await authorizationFixture(t, {
    plugins: [],
    allowCrossMarketplaceDependenciesOn: ["target"],
  });

  // act
  const authorized = await authorizeMissingDependency({
    scope: "project",
    cwd,
    marketplace: "target",
    state,
    declarers: ["invalid", "root@source"],
  });

  // assert
  assert.strictEqual(authorized, true);
});

test("refuses a dependency no declaring marketplace allows", async (t) => {
  // arrange
  const { cwd, state } = await authorizationFixture(t, {
    plugins: [],
    allowCrossMarketplaceDependenciesOn: ["target"],
  });

  // act
  const authorized = await authorizeMissingDependency({
    scope: "project",
    cwd,
    marketplace: "other",
    state,
    declarers: ["root@missing", "root@source"],
  });

  // assert
  assert.strictEqual(authorized, false);
});

test("rethrows the policy error of a declaring marketplace whose manifest is malformed", async (t) => {
  // arrange
  const { cwd, state } = await authorizationFixture(t, {
    plugins: [],
    allowCrossMarketplaceDependenciesOn: "target",
  });

  // act & assert
  await assert.rejects(
    authorizeMissingDependency({
      scope: "project",
      cwd,
      marketplace: "target",
      state,
      declarers: ["root@source"],
    }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidMarketplaceManifestError);
      assert.match(error.message, /allowCrossMarketplaceDependenciesOn/u);
      return true;
    },
  );
});

async function catalogFixture(t: TestContext): Promise<{
  cwd: string;
  record: MarketplaceRecord;
}> {
  const cwd = await temporaryCwd(t, "install-cascade-catalog-");
  const record = await seedCatalogRecord(cwd, "mp", {
    plugins: [{ name: "app", source: "./plugins/app", dependencies: ["dep"] }],
  });
  const pluginRoot = path.join(record.marketplaceRoot, "plugins", "app");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "app", version: "1.0.0", dependencies: ["dep"] }),
  );
  return { cwd, record };
}

test("catalog lookup returns the dependencies a listed plugin declares", async (t) => {
  // arrange
  const { cwd, record } = await catalogFixture(t);
  const resolved: string[] = [];
  const lookup = catalogLookup(
    () => Promise.resolve(record),
    locationsFor("project", cwd),
    { mcpConfigNotices: [] },
    resolved,
  );

  // act
  const found = await lookup({ key: "app@mp", name: "app", marketplace: "mp" });

  // assert
  assert.deepStrictEqual(found, { kind: "found", dependencies: [{ name: "dep" }] });
  assert.deepStrictEqual(resolved, ["app@mp"]);
});

test("catalog lookup reports a plugin the catalog does not list as absent", async (t) => {
  // arrange
  const { cwd, record } = await catalogFixture(t);
  const lookup = catalogLookup(() => Promise.resolve(record), locationsFor("project", cwd), {
    mcpConfigNotices: [],
  });

  // act
  const absent = await lookup({ key: "missing@mp", name: "missing", marketplace: "mp" });

  // assert
  assert.deepStrictEqual(absent, { kind: "absent" });
});

test("catalog lookup reports a marketplace without a record as absent", async (t) => {
  // arrange
  const cwd = await temporaryCwd(t, "install-cascade-catalog-");
  const lookup = catalogLookup(() => Promise.resolve(undefined), locationsFor("project", cwd), {
    mcpConfigNotices: [],
  });

  // act
  const absent = await lookup({ key: "app@mp", name: "app", marketplace: "mp" });

  // assert
  assert.deepStrictEqual(absent, { kind: "absent" });
});

test("catalog lookup names the failing member on the sink before it rethrows", async (t) => {
  // arrange
  const cwd = await temporaryCwd(t, "install-cascade-catalog-");
  const error = new Error("catalog failed");
  const sink: CascadeFailureSink = { mcpConfigNotices: [] };
  const lookup = catalogLookup(() => Promise.reject(error), locationsFor("project", cwd), sink, [
    "prior@mp",
  ]);

  // act & assert
  await assert.rejects(lookup({ key: "app@mp", name: "app", marketplace: "mp" }), error);
  assert.deepStrictEqual(sink.subject, {
    kind: "member",
    key: "app@mp",
    error,
    rollbackPartials: [],
    unmaterialized: ["prior@mp"],
  });
});

test("builds shared cascade options with both tag probes", async (t) => {
  // arrange
  const cwd = await temporaryCwd(t, "install-cascade-shared-");
  const record = await seedMarketplaceRecord({
    cwd,
    marketplace: "mp",
    plugins: {},
    scope: "project",
  });
  const state: ExtensionState = { schemaVersion: 3, marketplaces: { mp: record } };
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, state);
  const { ctx, run } = makeCtx();
  const adds = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);
  const tagProbe: CascadeTagProbe = () => Promise.resolve({ kind: "no-matching-tag" });
  const marketplaceTagProbe: CascadeMarketplaceTagProbe = () =>
    Promise.resolve({ kind: "tag-listing-failed", cause: new Error("not called") });

  // act
  const options = await sharedCascadeOptions({
    opts: { ctx, run, tagProbe, marketplaceTagProbe },
    env: {},
    state,
    locations,
    root: {
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "app",
      rootKey: "app@mp",
    },
    adds,
    sink: { mcpConfigNotices: [] },
    capture: emptyCapture(),
    transaction,
    removalOps: REMOVAL_OPS,
  });

  // assert
  assert.strictEqual(options.tagProbe, tagProbe);
  assert.strictEqual(options.marketplaceTagProbe, marketplaceTagProbe);
  assert.deepStrictEqual([...options.installedKeys], []);
  assert.deepStrictEqual([...options.rootAllowedMarketplaces], []);
  assert.deepStrictEqual([...options.knownMarketplaces], ["mp"]);
});

test("projects a pinned member's commit and version", () => {
  // arrange
  const pinned = member({ pin: { oid: "abc123", version: "1.2.3" } });

  // act
  const pin = memberLedgerPin(pinned);

  // assert
  assert.deepStrictEqual(pin, { sourcePin: "abc123", resolvedVersion: "1.2.3" });
});

test("projects a previewed member's commit without a version", () => {
  // act
  const pin = memberLedgerPin(member({ previewedCommit: "def456" }));

  // assert
  assert.deepStrictEqual(pin, { sourcePin: "def456" });
});

test("projects no pin for a member the plan did not pin", () => {
  // act
  const pin = memberLedgerPin(member());

  // assert
  assert.deepStrictEqual(pin, {});
});

test("builds a dependency member's ledger options from its pin and directory range", () => {
  // arrange
  const directoryPin = { range: "^1", declared: "^1", requiredBy: ["app@mp"] };
  const pinned = member({ pin: { oid: "abc123", version: "1.2.3" }, directoryPin });
  const { ctx, run } = makeCtx();
  const adds = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);
  const cloneCandidates = new Set<string>();
  const optionsFor = dependencyLedgerOptions(
    { ctx, run },
    {},
    { scope: "project", cwd: "/project", adds, removalOps: REMOVAL_OPS, cloneCandidates },
  );

  // act
  const options = optionsFor(pinned);

  // assert
  assert.deepStrictEqual(options, {
    ctx,
    run,
    scope: "project",
    cwd: "/project",
    marketplace: "mp",
    plugin: "dep",
    sourcePinOverride: "abc123",
    resolvedVersion: "1.2.3",
    directoryPin,
    provenance: "dependency",
    cloneCandidates,
    cloneProbe: probeInstallClone,
    removalOps: REMOVAL_OPS,
    env: {},
    marketplaceAdd: adds.marketplaceAdd,
    addedMarketplaces: adds.addedMarketplaces,
  });
});

const MCP_NOTICE = {
  kind: "comments-dropped",
  scope: "project",
  file: "mcp-adapter.json",
} as const satisfies McpConfigNotice;
const FAILED_OUTCOME = {
  status: "failed",
  error: new Error("stopped"),
  cause: "stopped",
} as const satisfies InstallPluginOutcome;

test("omits the MCP notices member when there are no notices", () => {
  // act
  const member = installMcpConfigNoticesMember([]);

  // assert
  assert.deepStrictEqual(member, {});
});

test("carries the MCP notices member when there are notices", () => {
  // act
  const member = installMcpConfigNoticesMember([MCP_NOTICE]);

  // assert
  assert.deepStrictEqual(member, { mcpConfigNotices: [MCP_NOTICE] });
});

test("shows a standalone install's MCP notices and carries them on its outcome", () => {
  // arrange
  const { ctx, run, notifications } = makeCtx();

  // act
  const outcome = withMcpConfigNotices(ctx, run, false, FAILED_OUTCOME, [MCP_NOTICE]);

  // assert
  assert.deepStrictEqual(outcome, { ...FAILED_OUTCOME, mcpConfigNotices: [MCP_NOTICE] });
  assert.strictEqual(notifications.length, 1);
});

test("leaves an orchestrated install's notices to its caller and omits an empty list", () => {
  // arrange
  const { ctx, run, notifications } = makeCtx();

  // act
  const outcome = withMcpConfigNotices(ctx, run, true, FAILED_OUTCOME, []);

  // assert
  assert.deepStrictEqual(outcome, FAILED_OUTCOME);
  assert.deepStrictEqual(notifications, []);
});

test("unwraps an installed cascade unchanged", () => {
  // act
  const planned = unwrapCascade({ kind: "planned" }, emptyCapture(), "app@mp", {
    mcpConfigNotices: [],
  });

  // assert
  assert.deepStrictEqual(planned, { kind: "planned" });
});

test("reports the marketplace-absent cascade as undefined", () => {
  // act
  const absent = unwrapCascade({ kind: "marketplace-absent" }, emptyCapture(), "app@mp", {
    mcpConfigNotices: [],
  });

  // assert
  assert.strictEqual(absent, undefined);
});

test("throws a closure failure's cause and records it on the sink", () => {
  // arrange
  const failure = {
    ok: false,
    reason: "not-found",
    key: "dep@mp",
    requiredBy: "app@mp",
    unmaterialized: [],
  } as const;
  const sink: CascadeFailureSink = { mcpConfigNotices: [] };

  // act & assert
  assert.throws(
    () => unwrapCascade({ kind: "closure-failed", failure }, emptyCapture(), "app@mp", sink),
    (error: unknown) => {
      assert.ok(error instanceof DependencyCascadeError);
      assert.strictEqual(error.key, "dep@mp");
      return true;
    },
  );
  assert.deepStrictEqual(sink.subject, { kind: "closure", failure });
});

test("throws a constraint failure's cause and records it on the sink", () => {
  // arrange
  const failure = {
    kind: "range-conflict",
    why: "contradictory-declarations",
    key: "dep@mp",
    range: "^1 and ^2",
    detail: "ranges do not overlap",
    unmaterialized: [],
  } as const;
  const sink: CascadeFailureSink = { mcpConfigNotices: [] };

  // act & assert
  assert.throws(
    () => unwrapCascade({ kind: "constraint-failed", failure }, emptyCapture(), "app@mp", sink),
    (error: unknown) => {
      assert.ok(error instanceof DependencyCascadeError);
      assert.strictEqual(error.key, "dep@mp");
      return true;
    },
  );
  assert.deepStrictEqual(sink.subject, { kind: "constraint", failure });
});

test("rethrows a failed member's error and merges its rollback partials after the root's own", () => {
  // arrange
  const error = new Error("member failed");
  const rootPartial = { phase: "skills", msg: "undo failed", cause: new Error("undo failed") };
  const memberPartial = { phase: "commands", msg: "undo two", cause: new Error("undo two") };
  const capture: InstallFailureCapture = {
    rollbackPartials: [rootPartial],
    version: "1.0.0",
  };
  const sink: CascadeFailureSink = { mcpConfigNotices: [] };

  // act & assert
  assert.throws(
    () =>
      unwrapCascade(
        {
          kind: "member-failed",
          key: "app@mp",
          error,
          rollbackPartials: [memberPartial],
          unmaterialized: ["dep@mp"],
          mcpConfigNotices: [],
        },
        capture,
        "app@mp",
        sink,
      ),
    error,
  );
  assert.deepStrictEqual(capture.rollbackPartials, [rootPartial, memberPartial]);
  assert.deepStrictEqual(sink.subject, {
    kind: "member",
    key: "app@mp",
    error,
    version: "1.0.0",
    rollbackPartials: capture.rollbackPartials,
    unmaterialized: ["dep@mp"],
  });
});

test("records no subject for a root-only member failure", () => {
  // arrange
  const error = new Error("member failed");
  const sink: CascadeFailureSink = { mcpConfigNotices: [] };

  // act & assert
  assert.throws(
    () =>
      unwrapCascade(
        {
          kind: "member-failed",
          key: "app@mp",
          error,
          rollbackPartials: [],
          unmaterialized: [],
          mcpConfigNotices: [],
        },
        emptyCapture(),
        "app@mp",
        sink,
      ),
    error,
  );
  assert.strictEqual(sink.subject, undefined);
});
