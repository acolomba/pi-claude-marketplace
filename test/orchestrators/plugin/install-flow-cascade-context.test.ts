import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  materializePluginCommitCopy,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
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
import { runPhases } from "../../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";

import { makeCtx } from "./install-flow-fixture.ts";
import { seedMarketplaceRecord } from "./marketplace-seed.ts";

import type {
  AuthAttemptResult,
  CredentialOps,
  DeviceFlowHttp,
} from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { MarketplaceAddSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/carried-marketplace-adds.ts";
import type {
  CascadeMarketplaceTagProbe,
  CascadeTagProbe,
  ResolvedCascadeMember,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import type { CascadeFailureSink } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts";
import type { InstallFailureCapture } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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

  // act
  const options = buildInstallLedgerOptions(
    {
      ctx,
      run,
      mapModel: true,
      partial: true,
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
      directoryPin: { range: "^1", declared: "^1", requiredBy: ["app@mp"] },
      provenance: "dependency",
      pinVersion: "1.2.3",
      marketplaceAdd: DEFAULT_MARKETPLACE_ADD,
      addedMarketplaces: [],
    },
    REMOVAL_OPS,
  );

  // assert
  assert.strictEqual(options.ctx, ctx);
  assert.strictEqual(options.run, run);
  assert.strictEqual(options.sourcePinOverride, "abc123");
  assert.strictEqual(options.resolvedVersion, "1.2.3");
  assert.strictEqual(options.pinVersionOverride, "1.2.3");
  assert.strictEqual(options.mapModel, true);
  assert.strictEqual(options.partial, true);
  assert.strictEqual(options.credentialOps, credentialOps);
  assert.strictEqual(options.deviceFlowHttp, deviceFlowHttp);
  assert.strictEqual(options.authMemo, authMemo);
  assert.strictEqual(options.cloneCacheSeam, cloneCacheSeam);
  assert.strictEqual(options.removalOps, REMOVAL_OPS);
});

test("tracks saved, unsaved, thrown, and leaked marketplace additions", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "install-cascade-adds-"));
  const lockedDir = path.join(cwd, "locked");
  try {
    // arrange
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, structuredClone(DEFAULT_STATE));

    // act
    const saved = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);
    const defaulted = trackInstallAdds(transaction, undefined);
    await saved.lockOwner.withLockedStateTransaction(locations, async (tx) => {
      saved.addedMarketplaces.push({
        marketplace: "saved",
        rawSource: "./saved",
        cloneDir: undefined,
      });
      await tx.save();
    });
    const unsaved = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);
    await unsaved.lockOwner.withLockedStateTransaction(locations, () => {
      unsaved.addedMarketplaces.push({
        marketplace: "unsaved",
        rawSource: "./unsaved",
        cloneDir: undefined,
      });
      return Promise.resolve();
    });
    const thrown = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);
    await assert.rejects(
      thrown.lockOwner.withLockedStateTransaction(locations, () => {
        thrown.addedMarketplaces.push({
          marketplace: "thrown",
          rawSource: "./thrown",
          cloneDir: undefined,
        });
        return Promise.reject(new Error("stopped"));
      }),
      /stopped/u,
    );
    const cloneDir = path.join(lockedDir, "clone");
    await mkdir(cloneDir, { recursive: true });
    await writeFile(path.join(cloneDir, "kept"), "x");
    await chmod(lockedDir, 0o500);
    const logged = captureDebugLog(t);
    const leaked = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);
    await leaked.lockOwner.withLockedStateTransaction(locations, () => {
      leaked.addedMarketplaces.push({
        marketplace: "leaked",
        rawSource: "./leaked",
        cloneDir,
      });
      return Promise.resolve();
    });

    // assert
    assert.deepStrictEqual(saved.addedMarketplaces, []);
    assert.strictEqual(defaulted.marketplaceAdd.settle, DEFAULT_MARKETPLACE_ADD.settle);
    assert.deepStrictEqual(saved.committedAdds, [
      { marketplace: "saved", rawSource: "./saved", cloneDir: undefined },
    ]);
    assert.deepStrictEqual(unsaved.addedMarketplaces, [
      { marketplace: "unsaved", rawSource: "./unsaved", cloneDir: undefined },
    ]);
    assert.deepStrictEqual(thrown.addedMarketplaces, [
      { marketplace: "thrown", rawSource: "./thrown", cloneDir: undefined },
    ]);
    assert.strictEqual(logged.length, 1);
    assert.match(
      logged[0] ?? "",
      /install saved no state; failed to clean up marketplace final clone/u,
    );
  } finally {
    await chmod(lockedDir, 0o755).catch(() => {});
    await rm(cwd, { recursive: true, force: true });
  }
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

test("loads root policy and handles an absent marketplace", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "install-cascade-policy-"));
  try {
    // arrange
    const record = await seedMarketplaceRecord({
      cwd,
      marketplace: "mp",
      plugins: {},
      scope: "project",
    });
    const catalog = JSON.parse(await readFile(record.manifestPath, "utf8")) as object;
    await writeFile(
      record.manifestPath,
      JSON.stringify({ ...catalog, allowCrossMarketplaceDependenciesOn: ["tools"] }),
    );

    // act
    const policy = await loadInstallRootAllowlist(() => Promise.resolve(record), "mp", "app");
    const missing = await loadInstallRootAllowlist(
      () => Promise.resolve(undefined),
      "missing",
      "app",
    );

    // assert
    assert.deepStrictEqual([...policy], ["tools"]);
    assert.deepStrictEqual([...missing], []);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("authorizes same-marketplace and allowed foreign declarations", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "install-cascade-authorize-"));
  try {
    // arrange
    const record = await seedMarketplaceRecord({
      cwd,
      marketplace: "source",
      plugins: {},
      scope: "project",
    });
    const catalog = JSON.parse(await readFile(record.manifestPath, "utf8")) as object;
    await writeFile(
      record.manifestPath,
      JSON.stringify({ ...catalog, allowCrossMarketplaceDependenciesOn: ["target"] }),
    );
    const state: ExtensionState = {
      schemaVersion: 3,
      marketplaces: { source: record },
    };

    // act
    const same = await authorizeMissingDependency({
      scope: "project",
      cwd,
      marketplace: "target",
      state,
      declarers: ["root@target"],
    });
    const foreign = await authorizeMissingDependency({
      scope: "project",
      cwd,
      marketplace: "target",
      state,
      declarers: ["invalid", "root@source"],
    });
    const refused = await authorizeMissingDependency({
      scope: "project",
      cwd,
      marketplace: "other",
      state,
      declarers: ["root@missing", "root@source"],
    });
    await writeFile(
      record.manifestPath,
      JSON.stringify({
        name: "source",
        allowCrossMarketplaceDependenciesOn: "target",
        plugins: [],
      }),
    );

    // assert
    assert.strictEqual(same, true);
    assert.strictEqual(foreign, true);
    assert.strictEqual(refused, false);
    await assert.rejects(
      authorizeMissingDependency({
        scope: "project",
        cwd,
        marketplace: "target",
        state,
        declarers: ["root@source"],
      }),
      /allowCrossMarketplaceDependenciesOn/u,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("catalog lookup returns found, absent, and thrown outcomes", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "install-cascade-catalog-"));
  try {
    // arrange
    const record = await seedMarketplaceRecord({
      cwd,
      marketplace: "mp",
      plugins: {},
      scope: "project",
    });
    const pluginRoot = path.join(record.marketplaceRoot, "plugins", "app");
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "app", version: "1.0.0", dependencies: ["dep"] }),
    );
    await writeFile(
      record.manifestPath,
      JSON.stringify({
        name: "mp",
        plugins: [{ name: "app", source: "./plugins/app", dependencies: ["dep"] }],
      }),
    );
    const sink: CascadeFailureSink = { mcpConfigNotices: [] };
    const resolved: string[] = [];
    const lookup = catalogLookup(
      () => Promise.resolve(record),
      locationsFor("project", cwd),
      sink,
      resolved,
    );
    const missingRecord = catalogLookup(
      () => Promise.resolve(undefined),
      locationsFor("project", cwd),
      sink,
    );
    const error = new Error("catalog failed");
    const failedSink: CascadeFailureSink = { mcpConfigNotices: [] };
    const failed = catalogLookup(
      () => Promise.reject(error),
      locationsFor("project", cwd),
      failedSink,
      ["prior@mp"],
    );

    // act
    const found = await lookup({ key: "app@mp", name: "app", marketplace: "mp" });
    const absent = await lookup({ key: "missing@mp", name: "missing", marketplace: "mp" });
    const absentRecord = await missingRecord({ key: "app@mp", name: "app", marketplace: "mp" });

    // assert
    assert.deepStrictEqual(found, { kind: "found", dependencies: [{ name: "dep" }] });
    assert.deepStrictEqual(absent, { kind: "absent" });
    assert.deepStrictEqual(absentRecord, { kind: "absent" });
    await assert.rejects(failed({ key: "app@mp", name: "app", marketplace: "mp" }), error);
    assert.deepStrictEqual(resolved, ["app@mp", "missing@mp"]);
    assert.deepStrictEqual(failedSink.subject, {
      kind: "member",
      key: "app@mp",
      error,
      rollbackPartials: [],
      unmaterialized: ["prior@mp"],
    });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("builds shared cascade options with both tag probes", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "install-cascade-shared-"));
  try {
    // arrange
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
      capture: { rollbackPartials: [], version: undefined },
      transaction,
      removalOps: REMOVAL_OPS,
    });

    // assert
    assert.strictEqual(options.tagProbe, tagProbe);
    assert.strictEqual(options.marketplaceTagProbe, marketplaceTagProbe);
    assert.deepStrictEqual([...options.installedKeys], []);
    assert.deepStrictEqual([...options.rootAllowedMarketplaces], []);
    assert.ok(options.knownMarketplaces.has("mp"));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("projects member pins and dependency ledger options", () => {
  // arrange
  const pinned = member({
    pin: { oid: "abc123", version: "1.2.3" },
    directoryPin: { range: "^1", declared: "^1", requiredBy: ["app@mp"] },
  });
  const previewed = member({ previewedCommit: "def456" });
  const plain = member();
  const { ctx, run } = makeCtx();
  const adds = trackInstallAdds(transaction, DEFAULT_MARKETPLACE_ADD);
  const optionsFor = dependencyLedgerOptions(
    { ctx, run },
    {},
    { scope: "project", cwd: "/project", adds, removalOps: REMOVAL_OPS },
  );

  // act
  const pinnedOptions = optionsFor(pinned);

  // assert
  assert.deepStrictEqual(memberLedgerPin(pinned), {
    sourcePin: "abc123",
    resolvedVersion: "1.2.3",
  });
  assert.deepStrictEqual(memberLedgerPin(previewed), { sourcePin: "def456" });
  assert.deepStrictEqual(memberLedgerPin(plain), {});
  assert.strictEqual(pinnedOptions.sourcePinOverride, "abc123");
  assert.strictEqual(pinnedOptions.resolvedVersion, "1.2.3");
  assert.strictEqual(pinnedOptions.provenance, "dependency");
  assert.deepStrictEqual(pinnedOptions.directoryPin, {
    range: "^1",
    declared: "^1",
    requiredBy: ["app@mp"],
  });
});

test("carries MCP notices only when they exist", () => {
  // arrange
  const direct = makeCtx();
  const orchestrated = makeCtx();
  const notice = {
    kind: "comments-dropped" as const,
    scope: "project" as const,
    file: "mcp-adapter.json" as const,
  };
  const outcome = {
    status: "failed" as const,
    error: new Error("stopped"),
    cause: "stopped",
  };

  // act
  const directOutcome = withMcpConfigNotices(direct.ctx, direct.run, false, outcome, [notice]);
  const orchestratedOutcome = withMcpConfigNotices(
    orchestrated.ctx,
    orchestrated.run,
    true,
    outcome,
    [],
  );

  // assert
  assert.deepStrictEqual(installMcpConfigNoticesMember([]), {});
  assert.deepStrictEqual(installMcpConfigNoticesMember([notice]), {
    mcpConfigNotices: [notice],
  });
  assert.deepStrictEqual(directOutcome, { ...outcome, mcpConfigNotices: [notice] });
  assert.deepStrictEqual(orchestratedOutcome, outcome);
  assert.strictEqual(direct.notifications.length, 1);
  assert.deepStrictEqual(orchestrated.notifications, []);
});

test("unwraps success and routes every cascade failure", () => {
  // arrange
  const successCapture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
  const successSink = { mcpConfigNotices: [] };

  // act
  const planned = unwrapCascade({ kind: "planned" }, successCapture, "app@mp", successSink);
  const absent = unwrapCascade(
    { kind: "marketplace-absent" },
    successCapture,
    "app@mp",
    successSink,
  );

  // assert
  assert.deepStrictEqual(planned, { kind: "planned" });
  assert.strictEqual(absent, undefined);

  const closureSink: CascadeFailureSink = { mcpConfigNotices: [] };
  assert.throws(
    () =>
      unwrapCascade(
        {
          kind: "closure-failed",
          failure: {
            ok: false,
            reason: "not-found",
            key: "dep@mp",
            requiredBy: "app@mp",
            unmaterialized: [],
          },
        },
        { rollbackPartials: [], version: undefined },
        "app@mp",
        closureSink,
      ),
    /dep@mp/u,
  );
  assert.strictEqual(closureSink.subject?.kind, "closure");

  const constraintSink: CascadeFailureSink = { mcpConfigNotices: [] };
  assert.throws(
    () =>
      unwrapCascade(
        {
          kind: "constraint-failed",
          failure: {
            kind: "range-conflict",
            why: "contradictory-declarations",
            key: "dep@mp",
            range: "^1 and ^2",
            detail: "ranges do not overlap",
            unmaterialized: [],
          },
        },
        { rollbackPartials: [], version: undefined },
        "app@mp",
        constraintSink,
      ),
    /dep@mp/u,
  );
  assert.strictEqual(constraintSink.subject?.kind, "constraint");

  const error = new Error("member failed");
  const memberCapture: InstallFailureCapture = {
    rollbackPartials: [{ phase: "skills", msg: "undo failed", cause: new Error("undo failed") }],
    version: "1.0.0",
  };
  const memberSink: CascadeFailureSink = { mcpConfigNotices: [] };
  assert.throws(
    () =>
      unwrapCascade(
        {
          kind: "member-failed",
          key: "app@mp",
          error,
          rollbackPartials: [{ phase: "commands", msg: "undo two", cause: new Error("undo two") }],
          unmaterialized: ["dep@mp"],
          mcpConfigNotices: [],
        },
        memberCapture,
        "app@mp",
        memberSink,
      ),
    error,
  );
  assert.deepStrictEqual(
    memberCapture.rollbackPartials.map(({ phase }) => phase),
    ["skills", "commands"],
  );
  assert.deepStrictEqual(memberSink.subject, {
    kind: "member",
    key: "app@mp",
    error,
    version: "1.0.0",
    rollbackPartials: memberCapture.rollbackPartials,
    unmaterialized: ["dep@mp"],
  });

  const rootOnlySink: CascadeFailureSink = { mcpConfigNotices: [] };
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
        { rollbackPartials: [], version: undefined },
        "app@mp",
        rootOnlySink,
      ),
    error,
  );
  assert.strictEqual(rootOnlySink.subject, undefined);
});
