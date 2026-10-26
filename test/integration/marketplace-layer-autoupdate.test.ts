// test/integration/marketplace-layer-autoupdate.test.ts
//
// Autoupdate flips across a scope's two config layers (LAYER-02, D-MF-03),
// through the flip orchestrator, both config files, the state file, the add
// orchestrator that creates the records, and the list's merged read. Each
// marketplace is a local directory added as a path source.

import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { setMarketplaceAutoupdate } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts";
import { loadMarketplaceListEntries } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts";
import {
  loadConfig,
  saveConfig,
} from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createNotificationBoundary } from "../edge/notification-boundary.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationBoundary } from "../edge/notification-boundary.ts";

interface ProjectScope {
  readonly cwd: string;
  readonly locations: ScopedLocations;
  readonly marketplacesRoot: string;
}

/** A project scope in a case-owned Pi environment, with `names` published as directories. */
async function projectScope(
  t: TestContext,
  prefix: string,
  names: readonly string[],
): Promise<ProjectScope> {
  const { cwd, root } = await createHermeticEnvironment(t, prefix);
  const marketplacesRoot = path.join(root, "marketplaces");
  for (const name of names) {
    const manifestDir = path.join(marketplacesRoot, name, ".claude-plugin");

    await mkdir(manifestDir, { recursive: true });

    await writeFile(
      path.join(manifestDir, "marketplace.json"),
      JSON.stringify({ name, plugins: [] }),
    );
  }

  return { cwd, locations: locationsFor("project", cwd), marketplacesRoot };
}

async function addTo(
  scope: ProjectScope,
  boundary: NotificationBoundary,
  name: string,
  local: boolean,
): Promise<void> {
  await addMarketplace({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: scope.cwd,
    completionCache: createCompletionCache(),
    rawSource: path.join(scope.marketplacesRoot, name),
    local,
  });
}

async function flip(
  scope: ProjectScope,
  boundary: NotificationBoundary,
  request: { readonly enable: boolean; readonly name?: string; readonly local?: boolean },
): Promise<void> {
  await setMarketplaceAutoupdate({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: scope.cwd,
    ...request,
  });
}

/** The bytes and mtime of a file, or `undefined` when it does not exist. */
async function fileSnapshot(
  filePath: string,
): Promise<{ readonly bytes: string; readonly mtimeNs: bigint } | undefined> {
  if (!(await pathExists(filePath))) {
    return undefined;
  }

  const metadata = await stat(filePath, { bigint: true });
  return { bytes: await readFile(filePath, "utf8"), mtimeNs: metadata.mtimeNs };
}

async function scopeSnapshot(locations: ScopedLocations): Promise<readonly unknown[]> {
  return [
    await fileSnapshot(locations.stateJsonPath),
    await fileSnapshot(locations.baseConfigJsonPath),
    await fileSnapshot(locations.localConfigJsonPath),
  ];
}

/** The `autoupdate` value each layer config gives `name`, and the list's merged value. */
async function autoupdateReadings(
  scope: ProjectScope,
  name: string,
): Promise<{ readonly base: unknown; readonly local: unknown; readonly listed: unknown }> {
  const base = await loadConfig(scope.locations.baseConfigJsonPath);
  const local = await loadConfig(scope.locations.localConfigJsonPath);
  const entries = await loadMarketplaceListEntries({ cwd: scope.cwd, scope: "project" });
  const block = entries.find((entry) => entry.record.name === name)?.block;
  return {
    base: base.status === "valid" ? base.config.marketplaces?.[name]?.autoupdate : undefined,
    local: local.status === "valid" ? local.config.marketplaces?.[name]?.autoupdate : undefined,
    listed: block !== undefined && "details" in block ? block.details?.autoupdate : undefined,
  };
}

const ADDED_TOOLS = { message: "● tools [project] (added)" };

test("D-09: a recorded marketplace neither layer declares is not added to a named flip", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-autoupdate-undeclared-", ["tools"]);
  const boundary = createNotificationBoundary(2);
  await addTo(scope, boundary, "tools", false);
  await saveConfig(
    scope.locations.baseConfigJsonPath,
    { schemaVersion: 1, marketplaces: {} },
    scope.locations.scopeRoot,
  );
  const snapshotBefore = await scopeSnapshot(scope.locations);

  // act
  await flip(scope, boundary, { enable: true, name: "tools" });

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED_TOOLS,
    {
      message:
        "A marketplace operation has failed.\n\n⊘ tools [project] (failed) {marketplace not added}",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await scopeSnapshot(scope.locations), snapshotBefore);
  boundary.verifyBoundary();
});

test("D-09: an unnamed flip gives no row to a recorded marketplace no layer declares while a declared one flips", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-autoupdate-sibling-", ["tools", "extras"]);
  const boundary = createNotificationBoundary(3);
  await addTo(scope, boundary, "tools", false);
  await addTo(scope, boundary, "extras", false);
  await saveConfig(
    scope.locations.baseConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: { extras: { source: path.join(scope.marketplacesRoot, "extras") } },
    },
    scope.locations.scopeRoot,
  );

  // act
  await flip(scope, boundary, { enable: true });

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED_TOOLS,
    { message: "● extras [project] (added)" },
    { message: "● extras [project] <autoupdate>\n\nMarketplace autoupdate: 1 success" },
  ]);
  assert.deepStrictEqual(await loadConfig(scope.locations.baseConfigJsonPath), {
    status: "valid",
    filePath: scope.locations.baseConfigJsonPath,
    config: {
      schemaVersion: 1,
      marketplaces: {
        extras: { source: path.join(scope.marketplacesRoot, "extras"), autoupdate: true },
      },
      plugins: {},
    },
  });
  boundary.verifyBoundary();
});

const refusalCases = [
  {
    label: "without --local on a marketplace only the local config declares",
    addedLocally: true,
    reason: "marketplace in local layer only",
    cause:
      "The marketplace tools is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
  },
  {
    label: "with --local on a marketplace only the base config declares",
    addedLocally: false,
    reason: "marketplace in base layer only",
    cause:
      "The marketplace tools is declared only in the base config (claude-plugins.json). Run the command again without --local.",
  },
] as const;

for (const { label, addedLocally, reason, cause } of refusalCases) {
  test(`LAYER-02: a named flip ${label} is refused and changes no file`, async (t) => {
    // arrange
    const scope = await projectScope(t, "mp-layer-autoupdate-refused-", ["tools"]);
    const boundary = createNotificationBoundary(2);
    await addTo(scope, boundary, "tools", addedLocally);
    const snapshotBefore = await scopeSnapshot(scope.locations);

    // act
    await flip(scope, boundary, { enable: true, name: "tools", local: !addedLocally });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      ADDED_TOOLS,
      {
        message: `Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ tools (failed) {${reason}}\n    cause: ${cause}`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await scopeSnapshot(scope.locations), snapshotBefore);
    boundary.verifyBoundary();
  });
}

test("CFG-03: a named flip whose target layer is silent while the config of the other layer is invalid changes no file", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-autoupdate-unreadable-", ["tools"]);
  const boundary = createNotificationBoundary(2);
  await addTo(scope, boundary, "tools", true);
  await writeFile(scope.locations.localConfigJsonPath, "{ malformed", "utf8");
  const snapshotBefore = await scopeSnapshot(scope.locations);

  // act
  await flip(scope, boundary, { enable: true, name: "tools" });

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED_TOOLS,
    {
      message:
        'Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ tools (failed) {invalid manifest}\n    cause: Config file "claude-plugins.local.json" failed schema validation.',
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await scopeSnapshot(scope.locations), snapshotBefore);
  boundary.verifyBoundary();
});

test("D-07: the list reads the base value a local entry without one inherits, then the local override", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-autoupdate-merged-", ["tools"]);
  const boundary = createNotificationBoundary(4);
  await addTo(scope, boundary, "tools", false);
  await addTo(scope, boundary, "tools", true);

  // act
  await flip(scope, boundary, { enable: true });
  const afterEnable = await autoupdateReadings(scope, "tools");
  await flip(scope, boundary, { enable: false, name: "tools", local: true });
  const afterOverride = await autoupdateReadings(scope, "tools");

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED_TOOLS,
    ADDED_TOOLS,
    { message: "● tools [project] <autoupdate>\n\nMarketplace autoupdate: 1 success" },
    { message: "● tools [project] <no autoupdate>" },
  ]);
  assert.deepStrictEqual(afterEnable, { base: true, local: undefined, listed: true });
  assert.deepStrictEqual(afterOverride, { base: true, local: false, listed: false });
  boundary.verifyBoundary();
});
