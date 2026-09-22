import assert from "node:assert/strict";
import * as fs from "node:fs";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  isUpdatePreflightOutcome,
  preparePluginUpdate,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type {
  AuthAttemptResult,
  CredentialOps,
  DeviceFlowHttp,
} from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type {
  PreparePluginUpdateOptions,
  UpdateCloneCacheSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function pluginRecord(version: string, enabled = true): PluginRecord {
  return {
    version,
    resolvedSource: "/previous/plugin",
    compatibility: { installable: true, notes: [], supported: ["skills"], unsupported: [] },
    resources: {
      skills: ["hello:tool"],
      prompts: ["hello:deploy"],
      agents: ["hello:bot"],
      mcpServers: ["hello:server"],
      hooks: ["hello"],
    },
    enabled,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

interface SeedOptions {
  readonly installed?: PluginRecord;
  readonly declared?: boolean;
  readonly version?: string;
  readonly source?: unknown;
}

async function seedUpdate(options: SeedOptions = {}): Promise<{
  readonly cwd: string;
  readonly locations: ReturnType<typeof locationsFor>;
  readonly pluginRoot: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "update-preflight-"));
  const marketplaceRoot = path.join(cwd, "marketplace");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: options.version ?? "2.0.0" }),
  );
  await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), "---\nname: tool\n---\n");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins:
        options.declared === false
          ? []
          : [
              {
                name: "hello",
                source: options.source ?? "./plugins/hello",
                version: options.version ?? "2.0.0",
              },
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
        source: pathSource("./marketplace"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: options.installed === undefined ? {} : { hello: options.installed },
      },
    },
  });
  return { cwd, locations, pluginRoot };
}

async function prepare(
  seed: Awaited<ReturnType<typeof seedUpdate>>,
  options: {
    readonly partial?: boolean;
    readonly cloneCacheSeam?: UpdateCloneCacheSeam;
    readonly constraintGate?: PreparePluginUpdateOptions["constraintGate"];
    readonly pathPinProbe?: PreparePluginUpdateOptions["pathPinProbe"];
    readonly constraintTagMemo?: PreparePluginUpdateOptions["constraintTagMemo"];
    readonly constraintMarketplaceTagMemo?: PreparePluginUpdateOptions["constraintMarketplaceTagMemo"];
    readonly cleanupClones?: () => Promise<void>;
    readonly ctx?: NotificationContext;
    readonly credentialOps?: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  } = {},
) {
  return preparePluginUpdate({
    plugin: "hello",
    marketplace: "mp",
    scope: "project",
    locations: seed.locations,
    cleanupClones: options.cleanupClones ?? (async () => {}),
    ...(options.partial === true && { partial: true }),
    ...(options.cloneCacheSeam !== undefined && { cloneCacheSeam: options.cloneCacheSeam }),
    ...(options.constraintGate !== undefined && { constraintGate: options.constraintGate }),
    ...(options.pathPinProbe !== undefined && { pathPinProbe: options.pathPinProbe }),
    ...(options.constraintTagMemo !== undefined && {
      constraintTagMemo: options.constraintTagMemo,
    }),
    ...(options.constraintMarketplaceTagMemo !== undefined && {
      constraintMarketplaceTagMemo: options.constraintMarketplaceTagMemo,
    }),
    ...(options.ctx !== undefined && { ctx: options.ctx }),
    ...(options.credentialOps !== undefined && { credentialOps: options.credentialOps }),
    ...(options.deviceFlowHttp !== undefined && { deviceFlowHttp: options.deviceFlowHttp }),
    ...(options.authMemo !== undefined && { authMemo: options.authMemo }),
  });
}

test("classifies a missing marketplace without reading a manifest", async (t) => {
  // arrange
  const cwd = await mkdtemp(path.join(tmpdir(), "update-preflight-missing-marketplace-"));
  t.after(() => rm(cwd, { force: true, recursive: true }));
  const locations = locationsFor("project", cwd);

  // act
  const outcome = await preparePluginUpdate({
    plugin: "hello",
    marketplace: "missing",
    scope: "project",
    locations,
    cleanupClones: async () => {},
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    notes: ['marketplace "missing" not found in project scope'],
    reasons: ["not in manifest"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("distinguishes an undeclared target from a declared uninstalled target", async (t) => {
  // arrange
  const undeclared = await seedUpdate({ declared: false });
  const uninstalled = await seedUpdate();
  t.after(() =>
    Promise.all(
      [undeclared.cwd, uninstalled.cwd].map((cwd) => rm(cwd, { force: true, recursive: true })),
    ),
  );

  // act
  const undeclaredOutcome = await prepare(undeclared);
  const uninstalledOutcome = await prepare(uninstalled);

  // assert
  assert.deepStrictEqual(undeclaredOutcome, {
    partition: "failed",
    name: "hello",
    notes: ["not in manifest"],
    reasons: ["not in manifest"],
    declaresAgents: false,
    declaresMcp: false,
  });
  assert.deepStrictEqual(uninstalledOutcome, {
    partition: "skipped",
    name: "hello",
    notes: ["not installed"],
    reasons: ["not installed"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("retains the recorded version when the refreshed manifest drops the plugin", async (t) => {
  // arrange
  const seed = await seedUpdate({ declared: false, installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));

  // act
  const outcome = await prepare(seed);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    fromVersion: "1.0.0",
    notes: ["not in manifest"],
    reasons: ["not in manifest"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("returns an exact unchanged outcome for an enabled current plugin", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("2.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const before = await readFile(seed.locations.stateJsonPath, "utf8");

  // act
  const outcome = await prepare(seed);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "unchanged",
    name: "hello",
    fromVersion: "2.0.0",
    toVersion: "2.0.0",
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
  });
  assert.strictEqual(await readFile(seed.locations.stateJsonPath, "utf8"), before);
});

test("returns the complete prepared candidate for a version transition", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));

  // act
  const prepared = await prepare(seed);

  // assert -- the WHOLE prepared value, so a member added to
  // `PreparedPluginUpdate` cannot slip past this case the way `constraint`
  // did. `resolvedSha` is absent rather than `undefined`: a path source is
  // spread in only when a commit resolved.
  assert.ok(!("partition" in prepared));
  assert.deepStrictEqual(prepared, {
    state: prepared.state,
    record: pluginRecord("1.0.0"),
    entry: { name: "hello", source: "./plugins/hello", version: "2.0.0" },
    installable: prepared.installable,
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    constraint: undefined,
  });
  assert.strictEqual(prepared.installable.pluginRoot, seed.pluginRoot);
  assert.deepStrictEqual(prepared.state.marketplaces.mp?.plugins.hello, pluginRecord("1.0.0"));
});

test("D-10-15: the current-copy fallback reaches the prepared update's disclosure slot", async (t) => {
  // arrange -- a path-source verdict that admitted with no pin after
  // falling back to the marketplace's current copy. `update-row.ts` reads
  // `fellBackToCurrentCopy` off this slot to stamp `{dependency current
  // copy}`, and the prepared update is its only channel from here.
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const disclosure = 'constrained to the combined range (>=1.0.0) -- required by "alpha@mp"';
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: ">=1.0.0",
      holders: [{ key: "alpha@mp", range: ">=1.0.0", disabled: false }],
      fellBackToCurrentCopy: true,
      disclosure,
    });

  // act
  const prepared = await prepare(seed, { constraintGate });

  // assert
  assert.ok(!("partition" in prepared));
  assert.deepStrictEqual(prepared.constraint, { disclosure, fellBackToCurrentCopy: true });
  assert.strictEqual(prepared.toVersion, "2.0.0");
});

test("D-10-03: the gate runs after triage and before candidate resolution", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const throwingCloneSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => {
      throw new Error("clone seam must not be reached");
    },
    materializePluginClone: () => {
      throw new Error("clone seam must not be reached");
    },
    materializeOrRefreshPluginMirror: () => {
      throw new Error("clone seam must not be reached");
    },
  };
  const heldCause = 'the declared ranges admit no version in common -- required by "other@mp"';

  // act
  const outcome = await prepare(seed, {
    cloneCacheSeam: throwingCloneSeam,
    constraintGate: () => Promise.resolve({ kind: "held", cause: heldCause }),
  });

  // assert -- the throwing seam was never reached: the gate's held verdict
  // returns before `makeUpdateCloneProbe` is even composed.
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    fromVersion: "1.0.0",
    notes: [heldCause],
    reasons: ["dependents constrain"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("UPDT-02: a held update writes nothing and repeats byte-identically", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const heldCause = 'the declared ranges admit no version in common -- required by "other@mp"';
  const heldGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({ kind: "held", cause: heldCause });
  const before = await loadState(seed.locations.extensionRoot);

  // act
  const first = await prepare(seed, { constraintGate: heldGate });
  const second = await prepare(seed, { constraintGate: heldGate });
  const after = await loadState(seed.locations.extensionRoot);

  // assert
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(after, before);
});

test("UPDT-01: a pinned verdict skips the post-fetch guard entirely", async (t) => {
  // arrange -- the pin's own version ("9.9.9") would fail the range if stage
  // two ran, but a pin was selected FROM the range by stage one, so the
  // check must not run at all.
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0"), version: "9.9.9" });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const pathPinProbe: PreparePluginUpdateOptions["pathPinProbe"] = () =>
    Promise.resolve({ kind: "materialized", pluginRoot: seed.pluginRoot, resolvedSha: "pin-oid" });
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: "<=2.0.0",
      holders: [{ key: "alpha@mp", range: "<=2.0.0", disabled: false }],
      pin: { oid: "pin-oid", version: "9.9.9" },
      fellBackToCurrentCopy: false,
      disclosure: "already the highest version the combined range admits",
    });

  // act
  const outcome = await prepare(seed, { constraintGate, pathPinProbe });

  // assert -- proceeds to a prepared update rather than a stage-two hold.
  assert.ok(!("partition" in outcome));
  assert.strictEqual(outcome.toVersion, "9.9.9");
});

test("UPDT-01: a no-tag repository is still gated by the post-fetch guard", async (t) => {
  // arrange -- the manifest and the plugin's own materialized version both
  // resolve to "5.0.0", outside the range a no-satisfying-tag `admits`
  // verdict (no `pin`) folds from its declared dependents.
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0"), version: "5.0.0" });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: "<=2.0.0",
      holders: [{ key: "alpha@mp", range: "<=2.0.0", disabled: false }],
      fellBackToCurrentCopy: false,
      disclosure: "already the highest version the combined range admits",
    });

  // act
  const outcome = await prepare(seed, { constraintGate });

  // assert -- stage two re-checks the derived "5.0.0" against the SAME
  // range, holds, and names the one holder whose own range rejects it.
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    fromVersion: "1.0.0",
    notes: [
      'version 5.0.0 falls outside what the combined range admits (<=2.0.0) -- required by "alpha@mp"',
    ],
    reasons: ["dependents constrain"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("UPDT-01: a no-tag repository proceeds when the fetched version satisfies the range", async (t) => {
  // arrange -- the manifest and the plugin's own materialized version both
  // resolve to "1.5.0", inside the range a no-satisfying-tag `admits`
  // verdict (no `pin`) folds from its declared dependents.
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0"), version: "1.5.0" });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: "<=2.0.0",
      holders: [{ key: "alpha@mp", range: "<=2.0.0", disabled: false }],
      fellBackToCurrentCopy: false,
      disclosure: "already the highest version the combined range admits",
    });

  // act
  const outcome = await prepare(seed, { constraintGate });

  // assert -- stage two admits "1.5.0" against the SAME range, so the update
  // proceeds to a prepared candidate rather than a stage-two hold.
  assert.ok(!("partition" in outcome));
  assert.strictEqual(outcome.toVersion, "1.5.0");
});

test("UPDT-02: a stage-two hold writes nothing and repeats byte-identically", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0"), version: "5.0.0" });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: "<=2.0.0",
      holders: [{ key: "alpha@mp", range: "<=2.0.0", disabled: false }],
      fellBackToCurrentCopy: false,
      disclosure: "already the highest version the combined range admits",
    });
  const before = await loadState(seed.locations.extensionRoot);

  // act
  const first = await prepare(seed, { constraintGate });
  const second = await prepare(seed, { constraintGate });
  const after = await loadState(seed.locations.extensionRoot);

  // assert
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(after, before);
});

test("success criterion 3: an unconstrained plugin's outcome is identical with and without a real gate", async (t) => {
  // arrange -- one seed, called twice: the run under test genuinely executes
  // candidate resolution both times (this scenario resolves a fresh
  // `PreparedPluginUpdate`, not a persisted `unchanged` short-circuit), so
  // this is not a value compared to itself.
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));

  // act -- the first run omits `constraintGate` entirely (production
  // default: the real `evaluateUpdateConstraint`, walking a state that
  // declares no dependent for "hello"); the second injects a double that
  // always answers `unconstrained` without walking anything.
  const withRealGate = await prepare(seed);
  const withDoubledGate = await prepare(seed, {
    constraintGate: () => Promise.resolve({ kind: "unconstrained" }),
  });

  // assert
  assert.deepStrictEqual(withRealGate, withDoubledGate);
});

test("reads a partitioned preflight answer as a finished outcome", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("2.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const unchanged = await prepare(seed);

  // act
  const finished = isUpdatePreflightOutcome(unchanged);
  const partition = finished ? unchanged.partition : undefined;

  // assert
  assert.strictEqual(finished, true);
  assert.strictEqual(partition, "unchanged");
});

test("reads a prepared candidate as unfinished so the update flow swaps it", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const candidate = await prepare(seed);

  // act
  const finished = isUpdatePreflightOutcome(candidate);
  const transition = finished
    ? undefined
    : { from: candidate.fromVersion, to: candidate.toVersion };

  // assert
  assert.strictEqual(finished, false);
  assert.deepStrictEqual(transition, { from: "1.0.0", to: "2.0.0" });
});

test("keeps an unsupported candidate skipped with and without partial permission", async (t) => {
  // arrange
  const source = { source: "npm", package: "example" };
  const strictSeed = await seedUpdate({ installed: pluginRecord("1.0.0"), source });
  const partialSeed = await seedUpdate({ installed: pluginRecord("1.0.0"), source });
  t.after(() =>
    Promise.all(
      [strictSeed.cwd, partialSeed.cwd].map((cwd) =>
        rm(cwd, {
          force: true,
          recursive: true,
        }),
      ),
    ),
  );

  // act
  const strictOutcome = await prepare(strictSeed);
  const partialOutcome = await prepare(partialSeed, { partial: true });

  // assert
  for (const outcome of [strictOutcome, partialOutcome]) {
    assert.ok("partition" in outcome);
    assert.strictEqual(outcome.partition, "skipped");
    assert.deepStrictEqual(outcome.reasons, ["no longer installable"]);
  }
});

test("keeps an unexpected resolve failure skipped as no-longer-installable, carrying the raw error", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  const manifestPath = path.join(seed.pluginRoot, ".claude-plugin", "plugin.json");
  t.after(async () => {
    await chmod(manifestPath, 0o644).catch(() => undefined);
    await rm(seed.cwd, { force: true, recursive: true });
  });
  // Neither a classified git-transport failure nor the resolver's typed
  // `PluginShapeError` -- a raw EACCES reading the marketplace-side
  // plugin.json, which `readManifest` deliberately leaves unwrapped so it
  // keeps its identity. Exercises `resolveUpdateCandidate`'s unclassified
  // fallback (still "no longer installable" to the caller, but logged for
  // diagnosis rather than silently folded into the typed shape).
  //
  // UPDT-02: the SAME unreadable file also trips the constraint gate's own
  // fail-closed declaration walk (D-10-05), which now runs first -- an
  // unconstrained double bypasses it so this case still exercises
  // `resolveUpdateCandidate`'s fallback, the behavior under test here.
  await chmod(manifestPath, 0o000);

  // act
  const outcome = await prepare(seed, {
    constraintGate: () => Promise.resolve({ kind: "unconstrained" }),
  });

  // assert
  assert.ok("partition" in outcome);
  assert.strictEqual(outcome.partition, "skipped");
  assert.deepStrictEqual(outcome.reasons, ["no longer installable"]);
  assert.match(outcome.notes[0] ?? "", /EACCES/);
});

test("refreshes a disabled pin without materializing its recorded resources", async (t) => {
  // arrange
  const record = pluginRecord("1.0.0", false);
  const seed = await seedUpdate({ installed: record });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));

  // act
  const outcome = await prepare(seed);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    notes: [],
    reasons: ["already disabled"],
    declaresAgents: false,
    declaresMcp: false,
  });
  const refreshed = (await loadState(seed.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.strictEqual(refreshed?.version, "2.0.0");
  assert.strictEqual(refreshed?.resolvedSource, seed.pluginRoot);
  assert.deepStrictEqual(refreshed?.resources, record.resources);
  assert.strictEqual(refreshed?.enabled, false);
});

test("WR-01: refreshing a disabled path-source pin drops a stale resolvedSha the record should no longer claim", async (t) => {
  // arrange: a STALE `resolvedSha` on the record, as a `path`-source record
  // could carry from a prior tag-pinned install/update. This refresh's
  // re-resolution goes through the plain `resolveStrict` path (no tag probe,
  // no pin), so it produces no sha of its own -- the old one must not survive.
  const record = { ...pluginRecord("1.0.0", false), resolvedSha: "stale-sha-from-a-prior-tag-pin" };
  const seed = await seedUpdate({ installed: record });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));

  // act
  await prepare(seed);

  // assert
  const refreshed = (await loadState(seed.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.ok(refreshed !== undefined);
  assert.strictEqual(refreshed.resolvedSha, undefined);
  assert.strictEqual(Object.hasOwn(refreshed, "resolvedSha"), false);
});

test("WR-02: clears a stale resolvedSha even when nothing else about the disabled pin changed", async (t) => {
  // arrange: version, resolvedSource and compatibility all already match what
  // this refresh would produce -- the stale sha is the ONLY thing that
  // differs, which is the one case the WR-01 clear must still catch.
  const seed = await seedUpdate({ installed: pluginRecord("2.0.0", false) });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const state = await loadState(seed.locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record !== undefined);
  record.resolvedSource = seed.pluginRoot;
  record.resolvedSha = "stale-sha-from-a-prior-tag-pin";
  await saveState(seed.locations.extensionRoot, state);

  // act
  await prepare(seed);

  // assert
  const refreshed = (await loadState(seed.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.ok(refreshed !== undefined);
  assert.strictEqual(refreshed.resolvedSha, undefined);
  assert.strictEqual(Object.hasOwn(refreshed, "resolvedSha"), false);
});

test("does not rewrite an unchanged disabled pin", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("2.0.0", false) });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const state = await loadState(seed.locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record !== undefined);
  record.resolvedSource = seed.pluginRoot;
  await saveState(seed.locations.extensionRoot, state);
  const before = await readFile(seed.locations.stateJsonPath, "utf8");

  // act
  const outcome = await prepare(seed);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "unchanged",
    name: "hello",
    fromVersion: "2.0.0",
    toVersion: "2.0.0",
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
  });
  assert.strictEqual(await readFile(seed.locations.stateJsonPath, "utf8"), before);
});

test("admits a partial candidate only with explicit partial permission", async (t) => {
  // arrange
  const strictSeed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  const partialSeed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() =>
    Promise.all(
      [strictSeed.cwd, partialSeed.cwd].map((cwd) => rm(cwd, { force: true, recursive: true })),
    ),
  );
  for (const seed of [strictSeed, partialSeed]) {
    await writeFile(
      path.join(seed.pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "hello",
        version: "2.0.0",
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      }),
    );
  }

  // act
  const strictOutcome = await prepare(strictSeed);
  const partialOutcome = await prepare(partialSeed, { partial: true });

  // assert
  assert.ok("partition" in strictOutcome);
  assert.strictEqual(strictOutcome.partition, "skipped");
  assert.deepStrictEqual(strictOutcome.reasons, ["unsupported component"]);
  assert.strictEqual(strictOutcome.partialUpgradable, true);
  assert.ok(!("partition" in partialOutcome));
  assert.strictEqual(partialOutcome.installable.state, "partially-available");
});

test("prepares pinned and unpinned URL clones with their exact resolved sha", async (t) => {
  // arrange
  const pinnedSha = "1111111111111111111111111111111111111111";
  const unpinnedSha = "2222222222222222222222222222222222222222";
  const pinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "url", url: "https://example.com/pinned", sha: pinnedSha },
  });
  const unpinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "url", url: "https://example.com/unpinned" },
  });
  t.after(() =>
    Promise.all([pinned.cwd, unpinned.cwd].map((cwd) => rm(cwd, { force: true, recursive: true }))),
  );
  const pinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({
        cloneUrl: "https://example.com/pinned",
        pin: pinnedSha,
      }),
    materializePluginClone: () => Promise.resolve(pinned.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const unpinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: () =>
      Promise.resolve({
        pluginRoot: unpinned.pluginRoot,
        resolvedSha: unpinnedSha,
      }),
  };

  // act
  const pinnedPrepared = await prepare(pinned, { cloneCacheSeam: pinnedSeam });
  const unpinnedPrepared = await prepare(unpinned, { cloneCacheSeam: unpinnedSeam });

  // assert
  assert.ok(!("partition" in pinnedPrepared));
  assert.strictEqual(pinnedPrepared.resolvedSha, pinnedSha);
  assert.strictEqual(pinnedPrepared.toVersion, "sha-111111111111");
  assert.ok(!("partition" in unpinnedPrepared));
  assert.strictEqual(unpinnedPrepared.resolvedSha, unpinnedSha);
  assert.strictEqual(unpinnedPrepared.toVersion, "sha-222222222222");
});

test("UPDT-01: a tag-pinned update records the tag's version, not a sha", async (t) => {
  // arrange -- the pin comes from the constraint gate's `admits` verdict,
  // distinct from an entry source that already carries its own `sha`.
  const pinnedSha = "5555555555555555555555555555555555555555";
  const seed = await seedUpdate({
    installed: pluginRecord("1.0.0"),
    source: { source: "url", url: "https://example.com/tagged" },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({ cloneUrl: "https://example.com/tagged", pin: pinnedSha }),
    materializePluginClone: () => Promise.resolve(seed.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: "^1.0.0",
      holders: [],
      pin: { oid: pinnedSha, version: "1.2.0" },
      fellBackToCurrentCopy: false,
      disclosure: "already the highest version the combined range admits",
    });

  // act
  const prepared = await prepare(seed, { cloneCacheSeam, constraintGate });

  // assert -- the pin's own version reached `toVersion`, not a sha- derived
  // pseudo-version, even though the RIGHT commit resolved (`resolvedSha`).
  assert.ok(!("partition" in prepared));
  assert.strictEqual(prepared.resolvedSha, pinnedSha);
  assert.strictEqual(prepared.toVersion, "1.2.0");
  assert.doesNotMatch(prepared.toVersion, /^sha-/);
});

test("D-10-20: a constraint pin overrides the entry's own declared sha", async (t) => {
  // arrange -- the manifest entry names commit X; the gate selects a tag at
  // a different commit. Upstream's `updatePluginOp` rewrites the entry
  // source with the selected tag for `url` / `git-subdir` / `github` without
  // reading the entry's own `sha`, so the dependents' ranges outrank it.
  const entrySha = "7777777777777777777777777777777777777777";
  const tagOid = "8888888888888888888888888888888888888888";
  const seed = await seedUpdate({
    installed: pluginRecord("1.0.0"),
    source: { source: "url", url: "https://example.com/tagged", sha: entrySha },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const resolvedSources: GitBackedSource[] = [];
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: ({ source }) => {
      resolvedSources.push(source);
      return Promise.resolve({
        cloneUrl: "https://example.com/tagged",
        pin: source.sha ?? "unpinned",
      });
    },
    materializePluginClone: () => Promise.resolve(seed.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: "^1.0.0",
      holders: [],
      pin: { oid: tagOid, version: "1.2.0" },
      fellBackToCurrentCopy: false,
      disclosure: "already the highest version the combined range admits",
    });

  // act
  const prepared = await prepare(seed, { cloneCacheSeam, constraintGate });

  // assert -- the resolver saw the TAG's commit, not the entry's, and the
  // record moves to the tag's own version.
  assert.deepStrictEqual(
    resolvedSources.map((source) => source.sha),
    [tagOid],
  );
  assert.ok(!("partition" in prepared));
  assert.strictEqual(prepared.resolvedSha, tagOid);
  assert.strictEqual(prepared.toVersion, "1.2.0");
});

test("UPDT-01: a second update of a tag-pinned plugin is unchanged", async (t) => {
  // arrange -- the recorded version already equals the pin's own version.
  const pinnedSha = "6666666666666666666666666666666666666666";
  const seed = await seedUpdate({
    installed: pluginRecord("1.2.0"),
    source: { source: "url", url: "https://example.com/tagged" },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({ cloneUrl: "https://example.com/tagged", pin: pinnedSha }),
    materializePluginClone: () => Promise.resolve(seed.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: "^1.0.0",
      holders: [],
      pin: { oid: pinnedSha, version: "1.2.0" },
      fellBackToCurrentCopy: false,
      disclosure: "already the highest version the combined range admits",
    });
  const before = await readFile(seed.locations.stateJsonPath, "utf8");

  // act
  const outcome = await prepare(seed, { cloneCacheSeam, constraintGate });
  const after = await readFile(seed.locations.stateJsonPath, "utf8");

  // assert -- the same tag is selected on the second run, `toVersion` equals
  // the recorded version, and no record is written.
  assert.deepStrictEqual(outcome, {
    partition: "unchanged",
    name: "hello",
    fromVersion: "1.2.0",
    toVersion: "1.2.0",
    declaresAgents: false,
    declaresMcp: false,
    // D-10-13: the pinned verdict's own disclosure, read from the SAME
    // `verdict` local -- present even though nothing changed on disk.
    constraint: {
      disclosure: "already the highest version the combined range admits",
      fellBackToCurrentCopy: false,
    },
  });
  assert.strictEqual(after, before);
});

test("UPDT-01: a path-source pin materializes through the marketplace's own tag clone", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const pinOid = "path-tag-oid";
  const calls: Parameters<NonNullable<PreparePluginUpdateOptions["pathPinProbe"]>>[0][] = [];
  const pathPinProbe: PreparePluginUpdateOptions["pathPinProbe"] = (args) => {
    calls.push(args);
    return Promise.resolve({
      kind: "materialized",
      pluginRoot: seed.pluginRoot,
      resolvedSha: pinOid,
    });
  };

  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: "^1.0.0",
      holders: [],
      pin: { oid: pinOid, version: "1.2.0" },
      fellBackToCurrentCopy: false,
      disclosure: "already the highest version the combined range admits",
    });

  // act
  const prepared = await prepare(seed, { constraintGate, pathPinProbe });

  // assert -- the SAME facts the marketplace record already carries, and the
  // pin's own oid as `tagOid`; never a re-derived marketplace URL.
  assert.ok(!("partition" in prepared));
  assert.strictEqual(prepared.resolvedSha, pinOid);
  assert.strictEqual(prepared.toVersion, "1.2.0");
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0]?.tagOid, pinOid);
  assert.strictEqual(calls[0]?.marketplaceRoot, path.join(seed.cwd, "marketplace"));
  assert.strictEqual(calls[0]?.marketplaceName, "mp");
  assert.deepStrictEqual(calls[0]?.marketplaceSource, pathSource("./marketplace"));
});

test("UPDT-01: without an injected pathPinProbe, a path-source pin uses the real marketplace-tag clone", async (t) => {
  // arrange -- the REAL `materializeMarketplaceTagClone` default, with no
  // stand-in: the marketplace fixture becomes a real (initially tag-less)
  // git repository, matching what a marketplace root actually is in
  // production (the same shape `install-cascade.test.ts`'s own equivalent
  // fixture uses).
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const marketplaceRoot = path.join(seed.cwd, "marketplace");
  await git.init({ fs, dir: marketplaceRoot, defaultBranch: "main" });
  await git.add({ fs, dir: marketplaceRoot, filepath: ".claude-plugin/marketplace.json" });
  await git.add({ fs, dir: marketplaceRoot, filepath: "plugins/hello/.claude-plugin/plugin.json" });
  await git.add({ fs, dir: marketplaceRoot, filepath: "plugins/hello/skills/tool/SKILL.md" });
  const oid = await git.commit({
    fs,
    dir: marketplaceRoot,
    message: "seed marketplace",
    author: { name: "test", email: "test@example.com" },
  });
  await git.tag({ fs, dir: marketplaceRoot, ref: "hello--v1.2.0", object: oid });
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({
      kind: "admits",
      range: "^1.0.0",
      holders: [],
      pin: { oid, version: "1.2.0" },
      fellBackToCurrentCopy: false,
      disclosure: "already the highest version the combined range admits",
    });

  // act
  const prepared = await prepare(seed, { constraintGate });

  // assert
  assert.ok(!("partition" in prepared));
  assert.strictEqual(prepared.resolvedSha, oid);
  assert.strictEqual(prepared.toVersion, "1.2.0");
});

test("D-10-17: an unconstrained update supplies no path pin to the resolver", async (t) => {
  // arrange -- `resolveStrict` is a hard import with no injection seam of its
  // own (like every other orchestrator that calls it), so the resolver
  // context it receives cannot be captured directly from this test module.
  // A throwing `pathPinProbe` double is the negative control instead: an
  // unconstrained verdict supplies no `pin`, so `resolveUpdateCandidate`
  // never spreads `pathPluginPin` / `resolvePathPluginRoot` into the context
  // at all, and the path-pin arm can never be reached to call this double.
  // If a future change threaded a pin unconditionally, this case would fail
  // the instant the double fires, exactly as an `Object.hasOwn` check would.
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const pathPinProbe: PreparePluginUpdateOptions["pathPinProbe"] = () => {
    throw new Error("not expected: an unconstrained update supplies no pin to resolve");
  };

  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = () =>
    Promise.resolve({ kind: "unconstrained" });

  // act
  const prepared = await prepare(seed, { constraintGate, pathPinProbe });

  // assert -- resolves via the ordinary unpinned path, byte-identical to a
  // run with no gate involved at all.
  assert.ok(!("partition" in prepared));
  assert.strictEqual(prepared.toVersion, "2.0.0");
  assert.strictEqual(prepared.resolvedSha, undefined);
});

test("D-10-18: the run-scoped tag memos reach the gate as the SAME objects the caller supplied", async (t) => {
  // arrange -- proves the wiring `update-flow.ts` relies on: whatever memo
  // objects the caller threads in, the gate receives those SAME references,
  // never a copy or a freshly-allocated one.
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const constraintTagMemo = new Map<string, readonly []>();
  const constraintMarketplaceTagMemo = new Map<string, readonly []>();
  const received: { tagMemo: unknown; marketplaceTagMemo: unknown }[] = [];
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = (gateOptions) => {
    received.push({
      tagMemo: gateOptions.tagMemo,
      marketplaceTagMemo: gateOptions.marketplaceTagMemo,
    });
    return Promise.resolve({ kind: "unconstrained" });
  };

  // act
  await prepare(seed, { constraintGate, constraintTagMemo, constraintMarketplaceTagMemo });

  // assert
  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0]?.tagMemo, constraintTagMemo);
  assert.strictEqual(received[0]?.marketplaceTagMemo, constraintMarketplaceTagMemo);
});

test("the constraint gate call omits both tag memos when the caller supplies neither", async (t) => {
  // arrange -- the conditional spread in `constraintGateOptions` must add
  // NOTHING when no memo was threaded, exactly like every other optional
  // field on this call.
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const received: unknown[] = [];
  const constraintGate: PreparePluginUpdateOptions["constraintGate"] = (gateOptions) => {
    received.push(gateOptions);
    return Promise.resolve({ kind: "unconstrained" });
  };

  // act
  await prepare(seed, { constraintGate });

  // assert -- `received[0]` is always the object literal `constraintGate`
  // pushed above, never anything else.
  assert.strictEqual(Object.hasOwn(received[0] as object, "tagMemo"), false);
  assert.strictEqual(Object.hasOwn(received[0] as object, "marketplaceTagMemo"), false);
});

test("classifies a clone transport failure without exposing a raw throw", async (t) => {
  // arrange
  const seed = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "url", url: "https://example.com/private" },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const transportError = new Error("offline") as NodeJS.ErrnoException;
  transportError.code = "ENETUNREACH";
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: () => Promise.reject(transportError),
  };

  // act
  const outcome = await prepare(seed, { cloneCacheSeam });

  // assert
  assert.ok("partition" in outcome);
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    fromVersion: "sha-000000000000",
    notes: ["offline"],
    reasons: ["network unreachable"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("swallows disabled clone cleanup failure after persisting the new pin", async (t) => {
  // arrange
  const sha = "3333333333333333333333333333333333333333";
  const record = { ...pluginRecord("sha-000000000000", false), resolvedSha: "0".repeat(40) };
  const seed = await seedUpdate({
    installed: record,
    source: { source: "url", url: "https://example.com/disabled", sha },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.resolve({ cloneUrl: "https://example.com/disabled", pin: sha }),
    materializePluginClone: () => Promise.resolve(seed.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };

  // act
  const outcome = await prepare(seed, {
    cloneCacheSeam,
    cleanupClones: () => Promise.reject(new Error("cleanup failed")),
  });

  // assert
  assert.ok("partition" in outcome);
  assert.strictEqual(outcome.partition, "skipped");
  const refreshed = (await loadState(seed.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.strictEqual(refreshed?.resolvedSha, sha);
  assert.strictEqual(refreshed?.version, "sha-333333333333");
});

test("cleans obsolete clones after persisting a disabled git pin", async (t) => {
  // arrange
  const sha = "3434343434343434343434343434343434343434";
  const record = { ...pluginRecord("sha-000000000000", false), resolvedSha: "0".repeat(40) };
  const seed = await seedUpdate({
    installed: record,
    source: { source: "url", url: "https://example.com/disabled-cleanup", sha },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({ cloneUrl: "https://example.com/disabled-cleanup", pin: sha }),
    materializePluginClone: () => Promise.resolve(seed.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  let cleanupCalls = 0;

  // act
  await prepare(seed, {
    cloneCacheSeam,
    cleanupClones: () => {
      cleanupCalls += 1;
      return Promise.resolve();
    },
  });

  // assert
  assert.strictEqual(cleanupCalls, 1);
});

test("WR-05: sweeps clones when a disabled refresh clears the record's resolvedSha to nothing", async (t) => {
  // arrange: the same shape WR-01 exercises -- a stale resolvedSha on a
  // `path`-source record whose re-resolution produces no sha of its own. The
  // old clone that sha protected is now orphaned, which is exactly the case
  // the sweep must not skip.
  const record = { ...pluginRecord("1.0.0", false), resolvedSha: "stale-sha-from-a-prior-tag-pin" };
  const seed = await seedUpdate({ installed: record });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  let cleanupCalls = 0;

  // act
  await prepare(seed, {
    cleanupClones: () => {
      cleanupCalls += 1;
      return Promise.resolve();
    },
  });

  // assert
  assert.strictEqual(cleanupCalls, 1);
});

test("passes authenticated clone context and refs through both clone arms", async (t) => {
  // arrange
  const sha = "4444444444444444444444444444444444444444";
  const pinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "github", repo: "org/repo", ref: "stable", sha },
  });
  const unpinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "github", repo: "org/repo", ref: "next" },
  });
  t.after(() =>
    Promise.all([pinned.cwd, unpinned.cwd].map((cwd) => rm(cwd, { force: true, recursive: true }))),
  );
  const credentialOps: CredentialOps = {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
  const ctx: NotificationContext = { ui: { notify: () => undefined } };
  const deviceFlowHttp: DeviceFlowHttp = {
    requestCode: () => Promise.reject(new Error("unexpected device flow")),
    pollToken: () => Promise.reject(new Error("unexpected device flow")),
  };
  const authMemo = new Map<string, AuthAttemptResult>();
  const pinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: (options) => {
      assert.strictEqual(options.auth?.host, "github.com");
      return Promise.resolve({ cloneUrl: "https://github.com/org/repo", pin: sha, ref: "stable" });
    },
    materializePluginClone: (options) => {
      assert.strictEqual(options.auth?.host, "github.com");
      assert.strictEqual(options.ref, "stable");
      return Promise.resolve(pinned.pluginRoot);
    },
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const unpinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: (options) => {
      assert.strictEqual(options.auth?.host, "github.com");
      assert.strictEqual(options.ref, "next");
      return Promise.resolve({ pluginRoot: unpinned.pluginRoot, resolvedSha: sha });
    },
  };

  // act
  const auth = { ctx, credentialOps, deviceFlowHttp, authMemo };
  const pinnedPrepared = await prepare(pinned, { cloneCacheSeam: pinnedSeam, ...auth });
  const unpinnedPrepared = await prepare(unpinned, { cloneCacheSeam: unpinnedSeam, ...auth });

  // assert
  assert.ok(!("partition" in pinnedPrepared));
  assert.strictEqual(pinnedPrepared.resolvedSha, sha);
  assert.ok(!("partition" in unpinnedPrepared));
  assert.strictEqual(unpinnedPrepared.resolvedSha, sha);
});

test("resolves pinned and unpinned git-subdir roots", async (t) => {
  // arrange
  const pinnedSha = "5555555555555555555555555555555555555555";
  const unpinnedSha = "6666666666666666666666666666666666666666";
  const pinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: {
      source: "git-subdir",
      url: "https://example.com/pinned-subdir",
      path: "plugins/hello",
      sha: pinnedSha,
    },
  });
  const unpinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: {
      source: "git-subdir",
      url: "https://example.com/unpinned-subdir",
      path: "plugins/hello",
    },
  });
  t.after(() =>
    Promise.all([pinned.cwd, unpinned.cwd].map((cwd) => rm(cwd, { force: true, recursive: true }))),
  );
  const pinnedRoot = path.join(pinned.cwd, "pinned-clone");
  const unpinnedRoot = path.join(unpinned.cwd, "unpinned-clone");
  await cp(pinned.pluginRoot, path.join(pinnedRoot, "plugins", "hello"), { recursive: true });
  await cp(unpinned.pluginRoot, path.join(unpinnedRoot, "plugins", "hello"), { recursive: true });
  const pinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({
        cloneUrl: "https://example.com/pinned-subdir",
        pin: pinnedSha,
      }),
    materializePluginClone: () => Promise.resolve(pinnedRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const unpinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: () =>
      Promise.resolve({
        pluginRoot: unpinnedRoot,
        resolvedSha: unpinnedSha,
      }),
  };

  // act
  const pinnedPrepared = await prepare(pinned, { cloneCacheSeam: pinnedSeam });
  const unpinnedPrepared = await prepare(unpinned, { cloneCacheSeam: unpinnedSeam });

  // assert
  assert.ok(!("partition" in pinnedPrepared));
  assert.strictEqual(
    pinnedPrepared.installable.pluginRoot,
    path.join(pinnedRoot, "plugins", "hello"),
  );
  assert.strictEqual(pinnedPrepared.resolvedSha, pinnedSha);
  assert.ok(!("partition" in unpinnedPrepared));
  assert.strictEqual(
    unpinnedPrepared.installable.pluginRoot,
    path.join(unpinnedRoot, "plugins", "hello"),
  );
  assert.strictEqual(unpinnedPrepared.resolvedSha, unpinnedSha);
});

test("classifies missing pinned and unpinned git-subdir roots", async (t) => {
  // arrange
  const sha = "7777777777777777777777777777777777777777";
  const pinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: {
      source: "git-subdir",
      url: "https://example.com/pinned-missing",
      path: "plugins/missing",
      sha,
    },
  });
  const unpinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: {
      source: "git-subdir",
      url: "https://example.com/unpinned-missing",
      path: "plugins/missing",
    },
  });
  t.after(() =>
    Promise.all([pinned.cwd, unpinned.cwd].map((cwd) => rm(cwd, { force: true, recursive: true }))),
  );
  const pinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({ cloneUrl: "https://example.com/pinned-missing", pin: sha }),
    materializePluginClone: () => Promise.resolve(pinned.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const unpinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: () =>
      Promise.resolve({
        pluginRoot: unpinned.pluginRoot,
        resolvedSha: sha,
      }),
  };

  // act
  const pinnedOutcome = await prepare(pinned, { cloneCacheSeam: pinnedSeam });
  const unpinnedOutcome = await prepare(unpinned, { cloneCacheSeam: unpinnedSeam });

  // assert
  for (const outcome of [pinnedOutcome, unpinnedOutcome]) {
    assert.ok("partition" in outcome);
    assert.strictEqual(outcome.partition, "skipped");
    assert.deepStrictEqual(outcome.reasons, ["no longer installable"]);
  }
});

test("keeps a concurrent disabled-plugin removal absent", async (t) => {
  // arrange
  const sha = "8888888888888888888888888888888888888888";
  const seed = await seedUpdate({
    installed: pluginRecord("sha-000000000000", false),
    source: { source: "url", url: "https://example.com/removed", sha },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  let releaseClone: (() => void) | undefined;
  const cloneBlocked = new Promise<void>((resolve) => {
    releaseClone = resolve;
  });
  let reportCloneStarted: (() => void) | undefined;
  const cloneStarted = new Promise<void>((resolve) => {
    reportCloneStarted = resolve;
  });
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.resolve({ cloneUrl: "https://example.com/removed", pin: sha }),
    materializePluginClone: async () => {
      reportCloneStarted?.();
      await cloneBlocked;
      return seed.pluginRoot;
    },
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };

  // act
  const preparation = prepare(seed, { cloneCacheSeam });
  await cloneStarted;
  const state = await loadState(seed.locations.extensionRoot);
  delete state.marketplaces.mp?.plugins.hello;
  await saveState(seed.locations.extensionRoot, state);
  releaseClone?.();
  const outcome = await preparation;

  // assert
  assert.ok("partition" in outcome);
  assert.strictEqual(outcome.partition, "skipped");
  const current = (await loadState(seed.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.strictEqual(current, undefined);
});

test("does not rewrite a concurrently converged disabled pin", async (t) => {
  // arrange
  const sha = "9999999999999999999999999999999999999999";
  const seed = await seedUpdate({
    installed: pluginRecord("sha-000000000000", false),
    source: { source: "url", url: "https://example.com/converged", sha },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  let releaseClone: (() => void) | undefined;
  const cloneBlocked = new Promise<void>((resolve) => {
    releaseClone = resolve;
  });
  let reportCloneStarted: (() => void) | undefined;
  const cloneStarted = new Promise<void>((resolve) => {
    reportCloneStarted = resolve;
  });
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({ cloneUrl: "https://example.com/converged", pin: sha }),
    materializePluginClone: async () => {
      reportCloneStarted?.();
      await cloneBlocked;
      return seed.pluginRoot;
    },
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };

  // act
  const preparation = prepare(seed, { cloneCacheSeam });
  await cloneStarted;
  const state = await loadState(seed.locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record !== undefined);
  record.version = "sha-999999999999";
  record.resolvedSource = seed.pluginRoot;
  record.resolvedSha = sha;
  record.compatibility = { installable: true, notes: [], supported: ["skills"], unsupported: [] };
  record.updatedAt = "concurrent-writer";
  await saveState(seed.locations.extensionRoot, state);
  const converged = await readFile(seed.locations.stateJsonPath, "utf8");
  releaseClone?.();
  const outcome = await preparation;

  // assert
  assert.ok("partition" in outcome);
  assert.strictEqual(outcome.partition, "skipped");
  assert.strictEqual(await readFile(seed.locations.stateJsonPath, "utf8"), converged);
});
