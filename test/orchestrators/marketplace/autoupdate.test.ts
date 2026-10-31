import assert from "node:assert/strict";
import { chmod, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";
import { It, mock, verify, when } from "strong-mock";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { setMarketplaceAutoupdate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { ScopeConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

interface ExactNotification {
  readonly message: string;
  readonly severity?: "error" | "info" | "warning";
}

interface MatchedNotification {
  readonly matches: (message: string) => boolean;
  readonly severity: "error" | "info" | "warning";
}

type NotificationExpectation = ExactNotification | MatchedNotification;
type MarketplaceRecord = ExtensionState["marketplaces"][string];

/**
 * The strict context boundary for one emission. D-05: the emission renders
 * from the run's snapshot, so no tool inventory is present to probe.
 */
function notificationBoundary(expectation: NotificationExpectation): {
  readonly ctx: ExtensionContext;
  readonly run: NotificationRun;
  readonly ui: ExtensionContext["ui"];
} {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  when(() => ctx.mode)
    .thenReturn("tui")
    .once();
  when(() => ctx.ui)
    .thenReturn(ui)
    .once();
  if ("message" in expectation) {
    if (expectation.severity === undefined) {
      when(() => {
        ui.notify(expectation.message);
      }).thenReturn(undefined);
    } else {
      when(() => {
        ui.notify(expectation.message, expectation.severity);
      }).thenReturn(undefined);
    }
  } else {
    when(() => {
      ui.notify(It.matches(expectation.matches), expectation.severity);
    }).thenReturn(undefined);
  }

  return { ctx, run: runWithNothingLoaded(), ui };
}

function marketplaceRecord(
  name: string,
  scope: "project" | "user",
  cwd: string,
  source: MarketplaceRecord["source"] = pathSource("./src"),
  plugins: Readonly<Record<string, PluginInstallRecord>> = {},
): MarketplaceRecord {
  return {
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, `${name}.marketplace.json`),
    marketplaceRoot: path.join(cwd, `${name}-root`),
    name,
    plugins,
    scope,
    source,
  };
}

async function saveMarketplaces(
  locations: ScopedLocations,
  records: readonly MarketplaceRecord[],
): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: Object.fromEntries(records.map((record) => [record.name, record])),
  });
}

async function writeConfig(
  locations: ScopedLocations,
  config: ScopeConfig,
  local = false,
): Promise<void> {
  await saveConfig(
    local ? locations.localConfigJsonPath : locations.baseConfigJsonPath,
    config,
    locations.scopeRoot,
  );
}

async function readOptionalBytes(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function configSnapshot(filePath: string): Promise<{
  readonly bytes: string;
  readonly inode: bigint;
  readonly mtimeNs: bigint;
}> {
  const [bytes, metadata] = await Promise.all([
    readFile(filePath, "utf8"),
    stat(filePath, { bigint: true }),
  ]);
  return { bytes, inode: metadata.ino, mtimeNs: metadata.mtimeNs };
}

async function scopeBytes(locations: ScopedLocations): Promise<{
  readonly state: string | undefined;
  readonly base: string | undefined;
  readonly local: string | undefined;
}> {
  return {
    state: await readOptionalBytes(locations.stateJsonPath),
    base: await readOptionalBytes(locations.baseConfigJsonPath),
    local: await readOptionalBytes(locations.localConfigJsonPath),
  };
}

async function recordAndDeclare(
  locations: ScopedLocations,
  cwd: string,
  layer: "base" | "local",
): Promise<void> {
  await saveMarketplaces(locations, [marketplaceRecord("mp", locations.scope, cwd)]);
  await writeConfig(
    locations,
    { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } },
    layer === "local",
  );
}

const IN_LOCAL_LAYER_ONLY_REFUSAL = [
  "Some operations have failed.",
  "",
  "⊘ mp [project] (failed)",
  "  ⊘ mp (failed) {marketplace in local layer only}",
  "    cause: The marketplace mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
].join("\n");

const BASE_FLIP_BYTES =
  '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n';

async function withHermeticHome<T>(
  fn: (environment: { readonly cwd: string; readonly home: string }) => Promise<T>,
): Promise<T> {
  return withHermeticEnvironment("mp-autoupdate-", fn);
}

const oneRowInvocationCases = [
  {
    expectedMessage: "● mp [project] <autoupdate>",
    invocation: { name: "mp", scope: "project" as const },
    label: "named invocation stays structurally single and omits the tally",
  },
  {
    expectedMessage: "● mp [project] <autoupdate>\n\nMarketplace autoupdate: 1 success",
    invocation: { scope: "project" as const },
    label: "unnamed invocation stays structurally plural and retains its tally",
  },
] as const;

for (const scenario of oneRowInvocationCases) {
  test(`one rendered row: ${scenario.label}`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      const disabledPlugin: PluginInstallRecord = {
        compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
        enabled: false,
        provenance: "explicit",
        installedAt: "2026-01-01T00:00:00.000Z",
        resolvedSource: "/fixture/plugins/example",
        resources: {
          agents: [],
          hooks: [],
          mcpServers: [],
          prompts: [],
          skills: [],
          workflows: [],
        },
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: "1.0.0",
      };
      await saveMarketplaces(locations, [
        marketplaceRecord("mp", "project", cwd, pathSource("./src"), {
          example: disabledPlugin,
        }),
      ]);
      await writeConfig(locations, { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } });
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const boundary = notificationBoundary({ message: scenario.expectedMessage });
      const expectedConfigBytes = [
        "{",
        '  "schemaVersion": 1,',
        '  "marketplaces": {',
        '    "mp": {',
        '      "source": "./src",',
        '      "autoupdate": true',
        "    }",
        "  },",
        '  "plugins": {}',
        "}",
        "",
      ].join("\n");

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        enable: true,
        cwd,
        ...scenario.invocation,
      });

      // assert
      assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), expectedConfigBytes);
      assert.equal(await readOptionalBytes(locations.localConfigJsonPath), undefined);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("disables one project marketplace when base config is enabled", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { mp: { source: "./src", autoupdate: true } },
      plugins: { "example@mp": { enabled: false } },
    });
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: "● mp [project] <no autoupdate>",
    });
    const expectedConfigBytes = [
      "{",
      '  "schemaVersion": 1,',
      '  "marketplaces": {',
      '    "mp": {',
      '      "source": "./src",',
      '      "autoupdate": false',
      "    }",
      "  },",
      '  "plugins": {',
      '    "example@mp": {',
      '      "enabled": false',
      "    }",
      "  }",
      "}",
      "",
    ].join("\n");

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: false,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), expectedConfigBytes);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("reports an already-enabled base entry without changing bytes or metadata", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { mp: { source: "./src", autoupdate: true } },
    });
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const configBefore = await configSnapshot(locations.baseConfigJsonPath);
    const boundary = notificationBoundary({
      message: "● mp [project] <autoupdate> {already autoupdate}",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await configSnapshot(locations.baseConfigJsonPath), configBefore);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("reports an already-disabled base entry without changing bytes or metadata", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { mp: { source: "./src", autoupdate: false } },
    });
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const configBefore = await configSnapshot(locations.baseConfigJsonPath);
    const boundary = notificationBoundary({
      message: "● mp [project] <no autoupdate> {already no autoupdate}",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: false,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await configSnapshot(locations.baseConfigJsonPath), configBefore);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("enables all project marketplaces in changed-before-unchanged order with one atomic batch", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [
      marketplaceRecord("already", "project", cwd, pathSource("./already")),
      marketplaceRecord("to-flip", "project", cwd, pathSource("./to-flip")),
    ]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: {
        already: { source: "./already", autoupdate: true },
        "to-flip": { source: "./to-flip" },
      },
    });
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: [
        "● to-flip [project] <autoupdate>",
        "",
        "● already [project] <autoupdate> {already autoupdate}",
        "",
        "Marketplace autoupdate: 2 successes",
      ].join("\n"),
    });
    const expectedConfigBytes = [
      "{",
      '  "schemaVersion": 1,',
      '  "marketplaces": {',
      '    "already": {',
      '      "source": "./already",',
      '      "autoupdate": true',
      "    },",
      '    "to-flip": {',
      '      "source": "./to-flip",',
      '      "autoupdate": true',
      "    }",
      "  },",
      '  "plugins": {}',
      "}",
      "",
    ].join("\n");

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), expectedConfigBytes);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("reports an empty implicit two-scope inventory without creating files", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    const boundary = notificationBoundary({
      message: "(no marketplaces)",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: true,
      cwd,
    });

    // assert
    assert.equal(await readOptionalBytes(projectLocations.stateJsonPath), undefined);
    assert.equal(await readOptionalBytes(projectLocations.baseConfigJsonPath), undefined);
    assert.equal(await readOptionalBytes(userLocations.stateJsonPath), undefined);
    assert.equal(await readOptionalBytes(userLocations.baseConfigJsonPath), undefined);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("AU-06: an unscoped unnamed flip reports only the scope that holds a marketplace and creates nothing in the other", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    await saveMarketplaces(userLocations, [marketplaceRecord("only", "user", cwd)]);
    await writeConfig(userLocations, {
      schemaVersion: 1,
      marketplaces: { only: { source: "./src" } },
    });
    const boundary = notificationBoundary({
      message: "● only [user] <autoupdate>\n\nMarketplace autoupdate: 1 success",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: true,
      cwd,
    });

    // assert
    assert.equal(
      await readFile(userLocations.baseConfigJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "only": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readOptionalBytes(projectLocations.stateJsonPath), undefined);
    assert.equal(await readOptionalBytes(projectLocations.baseConfigJsonPath), undefined);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("finds a named user marketplace after an implicit project miss", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    await saveMarketplaces(userLocations, [marketplaceRecord("only", "user", cwd)]);
    await writeConfig(userLocations, {
      schemaVersion: 1,
      marketplaces: { only: { source: "./src" } },
    });
    const stateBytes = await readFile(userLocations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({ message: "● only [user] <autoupdate>" });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "only",
      enable: true,
      cwd,
    });

    // assert
    assert.equal(await readOptionalBytes(projectLocations.baseConfigJsonPath), undefined);
    assert.equal(
      await readFile(userLocations.baseConfigJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "only": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(userLocations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("AU-08: reports a named marketplace absent from both implicit scopes", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const boundary = notificationBoundary({
      message:
        "A marketplace operation has failed.\n\n⊘ missing-mp (failed) {marketplace not added}",
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "missing-mp",
      enable: true,
      cwd,
    });

    // assert
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("reports a named marketplace absent from an explicit user scope", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const boundary = notificationBoundary({
      message:
        "A marketplace operation has failed.\n\n⊘ missing-mp [user] (failed) {marketplace not added}",
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "missing-mp",
      enable: false,
      scope: "user",
      cwd,
    });

    // assert
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

const scopedMissCases = [
  {
    holding: "project",
    requested: "user",
    expectedMessage:
      "A marketplace operation has failed.\n\n⊘ mp [user] (failed) {marketplace not added to user scope}",
  },
  {
    holding: "user",
    requested: "project",
    expectedMessage:
      "A marketplace operation has failed.\n\n⊘ mp [project] (failed) {marketplace not added to project scope}",
  },
] as const;

for (const { holding, requested, expectedMessage } of scopedMissCases) {
  test(`SCOPE-01: a flip with --scope ${requested} while only the ${holding} scope records the marketplace reports it not added to the ${requested} scope`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const holdingLocations = locationsFor(holding, cwd);
      const requestedLocations = locationsFor(requested, cwd);
      await saveMarketplaces(holdingLocations, [marketplaceRecord("mp", holding, cwd)]);
      const holdingBytes = await scopeBytes(holdingLocations);
      const boundary = notificationBoundary({ message: expectedMessage, severity: "error" });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        name: "mp",
        enable: true,
        scope: requested,
        cwd,
      });

      // assert
      assert.deepEqual(await scopeBytes(holdingLocations), holdingBytes);
      assert.deepEqual(await scopeBytes(requestedLocations), {
        state: undefined,
        base: undefined,
        local: undefined,
      });
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

const inheritedNamedLocalCases = [
  {
    label: "inherits off from a base config that does not declare it",
    enable: false,
    base: { base: { source: "./base", autoupdate: false } },
    expectedMessage: "● mp [user] <no autoupdate> {already no autoupdate}",
    expectedLocal: undefined,
  },
  {
    label: "inherits off from a base entry without a value",
    enable: false,
    base: { mp: { source: "./src" } },
    expectedMessage: "● mp [user] <no autoupdate> {already no autoupdate}",
    expectedLocal: undefined,
  },
  {
    label: "inherits off from a base entry that has it off",
    enable: false,
    base: { mp: { source: "./src", autoupdate: false } },
    expectedMessage: "● mp [user] <no autoupdate> {already no autoupdate}",
    expectedLocal: undefined,
  },
  {
    label: "inherits on from a base entry that has it on",
    enable: true,
    base: { mp: { source: "./src", autoupdate: true } },
    expectedMessage: "● mp [user] <autoupdate> {already autoupdate}",
    expectedLocal: undefined,
  },
  {
    label: "writes an explicit off over a base entry that has it on",
    enable: false,
    base: { mp: { source: "./src", autoupdate: true } },
    expectedMessage: "● mp [user] <no autoupdate>",
    expectedLocal:
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": false\n    }\n  },\n  "plugins": {}\n}\n',
  },
] as const;

for (const { label, enable, base, expectedMessage, expectedLocal } of inheritedNamedLocalCases) {
  test(`LAYER-02: a named --local ${enable ? "enable" : "disable"} of a local entry without a value ${label}`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("user", cwd);
      await recordAndDeclare(locations, cwd, "local");
      await writeConfig(locations, { schemaVersion: 1, marketplaces: base });
      const bytesBefore = await scopeBytes(locations);
      const boundary = notificationBoundary({ message: expectedMessage });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        name: "mp",
        enable,
        scope: "user",
        cwd,
        local: true,
      });

      // assert
      assert.deepEqual(await scopeBytes(locations), {
        ...bytesBefore,
        local: expectedLocal ?? bytesBefore.local,
      });
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("LAYER-02: a named --local disable of a local entry without a value and no base config reports already no autoupdate", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    await recordAndDeclare(locations, cwd, "local");
    const bytesBefore = await scopeBytes(locations);
    const boundary = notificationBoundary({
      message: "● mp [user] <no autoupdate> {already no autoupdate}",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: false,
      scope: "user",
      cwd,
      local: true,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), { ...bytesBefore, base: undefined });
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("orchestrated enable preserves semantic output while suppressing config write-back", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({ message: "● mp [project] <autoupdate>" });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.equal(await readOptionalBytes(locations.baseConfigJsonPath), undefined);
    assert.equal(await readOptionalBytes(locations.localConfigJsonPath), undefined);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

const orchestratedConfiguredCases = [
  {
    label: "a named",
    invocation: { name: "mp" },
    expectedMessage: "● mp [project] <autoupdate>",
  },
  {
    label: "an unnamed",
    invocation: {},
    expectedMessage: "● mp [project] <autoupdate>\n\nMarketplace autoupdate: 1 success",
  },
] as const;

for (const { label, invocation, expectedMessage } of orchestratedConfiguredCases) {
  test(`WR-09: ${label} orchestrated enable reports the flip and keeps the configured opposite value`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
      await writeConfig(locations, {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./configured", autoupdate: false } },
      });
      const configBefore = await configSnapshot(locations.baseConfigJsonPath);
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const boundary = notificationBoundary({ message: expectedMessage });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        enable: true,
        scope: "project",
        cwd,
        notifications: { mode: "orchestrated" },
        ...invocation,
      });

      // assert
      assert.deepEqual(await configSnapshot(locations.baseConfigJsonPath), configBefore);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

const undeclaredUnnamedCases = [
  { label: "a standalone", notifications: undefined },
  { label: "an orchestrated", notifications: { mode: "orchestrated" as const } },
] as const;

for (const { label, notifications } of undeclaredUnnamedCases) {
  test(`D-09: ${label} unnamed flip gives no row to a recorded marketplace no layer declares`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
      const bytesBefore = await scopeBytes(locations);
      const boundary = notificationBoundary({ message: "(no marketplaces)" });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        enable: true,
        scope: "project",
        cwd,
        ...(notifications !== undefined && { notifications }),
      });

      // assert
      assert.deepEqual(await scopeBytes(locations), bytesBefore);
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("rejects malformed base config with a basename-only failure and unchanged state", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    await writeFile(locations.baseConfigJsonPath, "{ malformed", "utf8");
    const configBytes = await readFile(locations.baseConfigJsonPath, "utf8");
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: [
        "Some operations have failed.",
        "",
        "⊘ mp [project] (failed)",
        "  ⊘ mp (failed) {invalid manifest}",
        '    cause: Config file "claude-plugins.json" failed schema validation.',
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), configBytes);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("rejects schema-invalid local config with a basename-only failure and unchanged state", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    await writeFile(
      locations.localConfigJsonPath,
      JSON.stringify({ schemaVersion: 2, marketplaces: {} }),
      "utf8",
    );
    const configBytes = await readFile(locations.localConfigJsonPath, "utf8");
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: [
        "Some operations have failed.",
        "",
        "⊘ mp [project] (failed)",
        "  ⊘ mp (failed) {invalid manifest}",
        '    cause: Config file "claude-plugins.local.json" failed schema validation.',
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
      local: true,
    });

    // assert
    assert.equal(await readFile(locations.localConfigJsonPath, "utf8"), configBytes);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("rejects a local config read failure without replacing the directory", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    await mkdir(locations.localConfigJsonPath, { recursive: true });
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: [
        "Some operations have failed.",
        "",
        "⊘ mp [project] (failed)",
        "  ⊘ mp (failed) {invalid manifest}",
        '    cause: Config file "claude-plugins.local.json" failed schema validation.',
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
      local: true,
    });

    // assert
    assert.equal((await stat(locations.localConfigJsonPath)).isDirectory(), true);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("reports a held named scope lock and succeeds after the lock is released", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    await writeConfig(locations, { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } });
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const release = await lockfile.lock(locations.extensionRoot, {
      lockfilePath: locations.stateLockFile,
      realpath: false,
    });
    const blockedBoundary = notificationBoundary({
      message: [
        "Some operations have failed.",
        "",
        "⊘ mp [project] (failed)",
        "  ⊘ mp (failed) {lock held}",
        `    cause: Another pi-claude-marketplace operation is in progress for project scope (${locations.stateLockFile}). Retry after it completes. -> Lock file is already being held`,
      ].join("\n"),
      severity: "error",
    });
    const retryBoundary = notificationBoundary({ message: "● mp [project] <autoupdate>" });

    // act
    await setMarketplaceAutoupdate({
      ctx: blockedBoundary.ctx,
      run: blockedBoundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });
    await release();
    await setMarketplaceAutoupdate({
      ctx: retryBoundary.ctx,
      run: retryBoundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(
      await readFile(locations.baseConfigJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(blockedBoundary.ctx);
    verify(blockedBoundary.ui);
    verify(retryBoundary.ctx);
    verify(retryBoundary.ui);
  });
});

test("reports a held unnamed scope lock against the unknown aggregate subject", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    const release = await lockfile.lock(locations.extensionRoot, {
      lockfilePath: locations.stateLockFile,
      realpath: false,
    });
    const boundary = notificationBoundary({
      message: [
        "Some operations have failed.",
        "",
        "⊘ (unknown) [project] (failed)",
        "  ⊘ (unknown) (failed) {lock held}",
        `    cause: Another pi-claude-marketplace operation is in progress for project scope (${locations.stateLockFile}). Retry after it completes. -> Lock file is already being held`,
        "",
        "Marketplace noautoupdate: 2 failures",
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: false,
      scope: "project",
      cwd,
    });
    await release();

    // assert
    assert.equal(await readOptionalBytes(locations.baseConfigJsonPath), undefined);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("keeps the config bytes after an atomic write refusal and converges on retry", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    await writeConfig(locations, { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } });
    const configBytes = await readFile(locations.baseConfigJsonPath, "utf8");
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const failedBoundary = notificationBoundary({
      matches: (message) => {
        const escapedScopeRoot = locations.scopeRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(
          `^Some operations have failed\\.\\n\\n⊘ mp \\[project\\] \\(failed\\)\\n  ⊘ mp \\(failed\\) \\{permission denied\\}\\n    cause: EACCES: permission denied, open '${escapedScopeRoot}/claude-plugins\\.json\\.[0-9]+'$`,
        ).test(message);
      },
      severity: "error",
    });
    const retryBoundary = notificationBoundary({ message: "● mp [project] <autoupdate>" });

    // act
    await chmod(locations.scopeRoot, 0o500);
    try {
      await setMarketplaceAutoupdate({
        ctx: failedBoundary.ctx,
        run: failedBoundary.run,
        name: "mp",
        enable: true,
        scope: "project",
        cwd,
      });
    } finally {
      await chmod(locations.scopeRoot, 0o700);
    }

    const configAfterFailure = await readFile(locations.baseConfigJsonPath, "utf8");
    await setMarketplaceAutoupdate({
      ctx: retryBoundary.ctx,
      run: retryBoundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(configAfterFailure, configBytes);
    assert.equal(
      await readFile(locations.baseConfigJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(failedBoundary.ctx);
    verify(failedBoundary.ui);
    verify(retryBoundary.ctx);
    verify(retryBoundary.ui);
  });
});

test("reports a committed project flip beside the failure when the user scope is locked and converges on retry", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    await saveMarketplaces(projectLocations, [marketplaceRecord("shared", "project", cwd)]);
    await saveMarketplaces(userLocations, [marketplaceRecord("shared", "user", cwd)]);
    const declaration: ScopeConfig = {
      schemaVersion: 1,
      marketplaces: { shared: { source: "./src" } },
    };
    await writeConfig(projectLocations, declaration);
    await writeConfig(userLocations, declaration);
    const userConfigBytes = await readFile(userLocations.baseConfigJsonPath, "utf8");
    const projectStateBytes = await readFile(projectLocations.stateJsonPath, "utf8");
    const userStateBytes = await readFile(userLocations.stateJsonPath, "utf8");
    const release = await lockfile.lock(userLocations.extensionRoot, {
      lockfilePath: userLocations.stateLockFile,
      realpath: false,
    });
    const partialBoundary = notificationBoundary({
      message: [
        "Some operations have failed.",
        "",
        "● shared [project] <autoupdate>",
        "",
        "⊘ shared [user] (failed)",
        "  ⊘ shared (failed) {lock held}",
        `    cause: Another pi-claude-marketplace operation is in progress for user scope (${userLocations.stateLockFile}). Retry after it completes. -> Lock file is already being held`,
        "",
        "Marketplace autoupdate: 2 failures, 1 success",
      ].join("\n"),
      severity: "error",
    });
    const retryBoundary = notificationBoundary({
      message: [
        "● shared [project] <autoupdate> {already autoupdate}",
        "",
        "● shared [user] <autoupdate>",
      ].join("\n"),
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: partialBoundary.ctx,
      run: partialBoundary.run,
      name: "shared",
      enable: true,
      cwd,
    });
    const projectConfigAfterFailure = await readFile(projectLocations.baseConfigJsonPath, "utf8");
    const userConfigAfterFailure = await readFile(userLocations.baseConfigJsonPath, "utf8");
    await release();
    await setMarketplaceAutoupdate({
      ctx: retryBoundary.ctx,
      run: retryBoundary.run,
      name: "shared",
      enable: true,
      cwd,
    });

    // assert
    assert.equal(
      projectConfigAfterFailure,
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "shared": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(userConfigAfterFailure, userConfigBytes);
    assert.equal(
      await readFile(userLocations.baseConfigJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "shared": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(projectLocations.stateJsonPath, "utf8"), projectStateBytes);
    assert.equal(await readFile(userLocations.stateJsonPath, "utf8"), userStateBytes);
    verify(partialBoundary.ctx);
    verify(partialBoundary.ui);
    verify(retryBoundary.ctx);
    verify(retryBoundary.ui);
  });
});

test("D-06: an unnamed flip whose local write fails reports the marketplaces the base write already flipped", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange: the local config is a link, which the config writer refuses to
    // replace, so the base write lands and the local write fails.
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [
      marketplaceRecord("extras", "project", cwd),
      marketplaceRecord("mp", "project", cwd),
    ]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { extras: { source: "./extras" }, mp: { source: "./src" } },
    });
    const localTarget = path.join(home, "claude-plugins.local.json");
    await writeFile(
      localTarget,
      '{"schemaVersion":1,"marketplaces":{"mp":{"source":"./src","autoupdate":false}}}\n',
    );
    await symlink(localTarget, locations.localConfigJsonPath);
    const notifications: string[] = [];
    const boundary = notificationBoundary({
      matches: (message) => {
        notifications.push(message);
        return true;
      },
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      [
        "Some operations have failed.",
        "",
        "● extras [project] <autoupdate>",
        "",
        "⊘ (unknown) [project] (failed)",
        "  ⊘ (unknown) (failed) {unreadable}",
        `    cause: saveConfig contains symlink ${locations.localConfigJsonPath} -> ${localTarget} (parent: ${locations.scopeRoot}, target: ${locations.localConfigJsonPath}).`,
        "",
        "Marketplace autoupdate: 2 failures, 1 success",
      ].join("\n"),
    ]);
    assert.deepStrictEqual(
      [await readFile(locations.baseConfigJsonPath, "utf8"), await readFile(localTarget, "utf8")],
      [
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "extras": {\n      "source": "./extras",\n      "autoupdate": true\n    },\n    "mp": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
        '{"schemaVersion":1,"marketplaces":{"mp":{"source":"./src","autoupdate":false}}}\n',
      ],
    );
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("LAYER-02: a base flip writes only the base entry while the local config also declares it", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "base");
    await writeConfig(
      locations,
      { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } },
      true,
    );
    const localBefore = await configSnapshot(locations.localConfigJsonPath);
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({ message: "● mp [project] <autoupdate>" });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), BASE_FLIP_BYTES);
    assert.deepEqual(await configSnapshot(locations.localConfigJsonPath), localBefore);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

const layerRefusalCases = [
  {
    label: "a flip without --local on a marketplace only the local config declares",
    declaringLayer: "local" as const,
    local: false,
    expectedMessage: IN_LOCAL_LAYER_ONLY_REFUSAL,
  },
  {
    label: "a flip with --local on a marketplace only the base config declares",
    declaringLayer: "base" as const,
    local: true,
    expectedMessage: [
      "Some operations have failed.",
      "",
      "⊘ mp [project] (failed)",
      "  ⊘ mp (failed) {marketplace in base layer only}",
      "    cause: The marketplace mp is declared only in the base config (claude-plugins.json). Run the command again without --local.",
    ].join("\n"),
  },
] as const;

for (const { label, declaringLayer, local, expectedMessage } of layerRefusalCases) {
  test(`LAYER-02: refuses ${label} and writes nothing`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await recordAndDeclare(locations, cwd, declaringLayer);
      const bytesBefore = await scopeBytes(locations);
      const boundary = notificationBoundary({ message: expectedMessage, severity: "error" });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        name: "mp",
        enable: true,
        scope: "project",
        cwd,
        ...(local && { local: true }),
      });

      // assert
      assert.deepEqual(await scopeBytes(locations), bytesBefore);
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("SCOPE-01: an unscoped flip both scopes miss names no scope, even when one scope records the marketplace", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const userLocations = locationsFor("user", cwd);
    await saveMarketplaces(userLocations, [marketplaceRecord("mp", "user", cwd)]);
    const boundary = notificationBoundary({
      message: "A marketplace operation has failed.\n\n⊘ mp (failed) {marketplace not added}",
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      cwd,
    });

    // assert
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("D-09: reports a recorded marketplace neither config layer declares as not added and writes nothing", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    const bytesBefore = await scopeBytes(locations);
    const boundary = notificationBoundary({
      message:
        "A marketplace operation has failed.\n\n⊘ mp [project] (failed) {marketplace not added}",
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), bytesBefore);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("CFG-03: names the unreadable other layer when the target layer does not declare the marketplace", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { base: { source: "./base" } },
    });
    await writeFile(locations.localConfigJsonPath, "{ malformed", "utf8");
    const bytesBefore = await scopeBytes(locations);
    const boundary = notificationBoundary({
      message: [
        "Some operations have failed.",
        "",
        "⊘ mp [project] (failed)",
        "  ⊘ mp (failed) {invalid manifest}",
        '    cause: Config file "claude-plugins.local.json" failed schema validation.',
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), bytesBefore);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("D-09: an unscoped flip reports only the scope it changed when the other scope refuses", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    await recordAndDeclare(projectLocations, cwd, "local");
    await recordAndDeclare(userLocations, cwd, "base");
    const projectBefore = await scopeBytes(projectLocations);
    const userStateBytes = await readFile(userLocations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({ message: "● mp [user] <autoupdate>" });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "mp",
      enable: true,
      cwd,
    });

    // assert
    assert.deepEqual(await scopeBytes(projectLocations), projectBefore);
    assert.deepEqual(await scopeBytes(userLocations), {
      state: userStateBytes,
      base: BASE_FLIP_BYTES,
      local: undefined,
    });
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

const unscopedRefusalCases = [
  { label: "refused in both scopes", userLayer: "local" as const },
  { label: "that the user scope does not record", userLayer: undefined },
] as const;

for (const { label, userLayer } of unscopedRefusalCases) {
  test(`D-09: an unscoped flip ${label} reports the project refusal`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const projectLocations = locationsFor("project", cwd);
      const userLocations = locationsFor("user", cwd);
      await recordAndDeclare(projectLocations, cwd, "local");
      if (userLayer !== undefined) {
        await recordAndDeclare(userLocations, cwd, userLayer);
      }

      const projectBefore = await scopeBytes(projectLocations);
      const userBefore = await scopeBytes(userLocations);
      const boundary = notificationBoundary({
        message: IN_LOCAL_LAYER_ONLY_REFUSAL,
        severity: "error",
      });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        name: "mp",
        enable: true,
        cwd,
      });

      // assert
      assert.deepEqual(await scopeBytes(projectLocations), projectBefore);
      assert.deepEqual(await scopeBytes(userLocations), userBefore);
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

const targetLayerIdempotencyCases = [
  {
    label: "a base entry without a value as already off",
    layer: "base" as const,
    entry: { source: "./src" },
  },
  {
    label: "a local entry that is already off",
    layer: "local" as const,
    entry: { source: "./src", autoupdate: false },
  },
] as const;

for (const { label, layer, entry } of targetLayerIdempotencyCases) {
  test(`D-07: reads ${label} and writes nothing`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
      await writeConfig(
        locations,
        { schemaVersion: 1, marketplaces: { mp: entry } },
        layer === "local",
      );
      const targetPath =
        layer === "local" ? locations.localConfigJsonPath : locations.baseConfigJsonPath;
      const targetBefore = await configSnapshot(targetPath);
      const boundary = notificationBoundary({
        message: "● mp [project] <no autoupdate> {already no autoupdate}",
      });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        name: "mp",
        enable: false,
        scope: "project",
        cwd,
        ...(layer === "local" && { local: true }),
      });

      // assert
      assert.deepEqual(await configSnapshot(targetPath), targetBefore);
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

const unnamedDisableCases = [
  {
    label: "turns off a marketplace the base config has on",
    entry: { source: "./src", autoupdate: true },
    expectedMessage: "● mp [project] <no autoupdate>\n\nMarketplace noautoupdate: 1 success",
    expectedBytes:
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": false\n    }\n  },\n  "plugins": {}\n}\n',
  },
  {
    label: "reports a base entry without a value as already off",
    entry: { source: "./src" },
    expectedMessage:
      "● mp [project] <no autoupdate> {already no autoupdate}\n\nMarketplace noautoupdate: 1 success",
    expectedBytes: undefined,
  },
] as const;

for (const { label, entry, expectedMessage, expectedBytes } of unnamedDisableCases) {
  test(`unnamed disable ${label}`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
      await writeConfig(locations, { schemaVersion: 1, marketplaces: { mp: entry } });
      const configBytes = await readFile(locations.baseConfigJsonPath, "utf8");
      const boundary = notificationBoundary({ message: expectedMessage });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        enable: false,
        scope: "project",
        cwd,
      });

      // assert
      assert.equal(
        await readFile(locations.baseConfigJsonPath, "utf8"),
        expectedBytes ?? configBytes,
      );
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("CFG-03: an unnamed --local flip over an invalid local config fails and writes nothing", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "base");
    await writeFile(locations.localConfigJsonPath, "{ malformed", "utf8");
    const bytesBefore = await scopeBytes(locations);
    const boundary = notificationBoundary({
      message: [
        "Some operations have failed.",
        "",
        "⊘ (unknown) [project] (failed)",
        "  ⊘ (unknown) (failed) {invalid manifest}",
        '    cause: Config file "claude-plugins.local.json" failed schema validation.',
        "",
        "Marketplace autoupdate: 2 failures",
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: true,
      scope: "project",
      cwd,
      local: true,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), bytesBefore);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("D-06: an unnamed flip sets the base value and leaves a local entry without a value to inherit it", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [
      marketplaceRecord("extras", "project", cwd, pathSource("./extras")),
      marketplaceRecord("tools", "project", cwd, pathSource("./tools")),
    ]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { extras: { source: "./extras" }, tools: { source: "./tools" } },
    });
    await writeConfig(
      locations,
      { schemaVersion: 1, marketplaces: { tools: { source: "./tools" } } },
      true,
    );
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const localBytes = await readFile(locations.localConfigJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: [
        "● extras [project] <autoupdate>",
        "",
        "● tools [project] <autoupdate>",
        "",
        "Marketplace autoupdate: 2 successes",
      ].join("\n"),
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), {
      state: stateBytes,
      base: [
        "{",
        '  "schemaVersion": 1,',
        '  "marketplaces": {',
        '    "extras": {',
        '      "source": "./extras",',
        '      "autoupdate": true',
        "    },",
        '    "tools": {',
        '      "source": "./tools",',
        '      "autoupdate": true',
        "    }",
        "  },",
        '  "plugins": {}',
        "}",
        "",
      ].join("\n"),
      local: localBytes,
    });
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

const baseOnUnnamedCases = [
  {
    label: "leaves a local entry without a value to inherit it",
    localEntry: { source: "./src" },
    expectedMessage:
      "● mp [project] <autoupdate> {already autoupdate}\n\nMarketplace autoupdate: 1 success",
    expectedLocal: undefined,
  },
  {
    label: "reports already autoupdate when every declaring layer has it on",
    localEntry: { source: "./src", autoupdate: true },
    expectedMessage:
      "● mp [project] <autoupdate> {already autoupdate}\n\nMarketplace autoupdate: 1 success",
    expectedLocal: undefined,
  },
  {
    label: "writes a local entry whose own value is off",
    localEntry: { source: "./src", autoupdate: false },
    expectedMessage: "● mp [project] <autoupdate>\n\nMarketplace autoupdate: 1 success",
    expectedLocal: BASE_FLIP_BYTES,
  },
] as const;

for (const { label, localEntry, expectedMessage, expectedLocal } of baseOnUnnamedCases) {
  test(`D-07: an unnamed enable over a base value that is on ${label}`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
      await writeConfig(locations, {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./src", autoupdate: true } },
      });
      await writeConfig(locations, { schemaVersion: 1, marketplaces: { mp: localEntry } }, true);
      const baseBefore = await configSnapshot(locations.baseConfigJsonPath);
      const localBytes = await readFile(locations.localConfigJsonPath, "utf8");
      const boundary = notificationBoundary({ message: expectedMessage });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        enable: true,
        scope: "project",
        cwd,
      });

      // assert
      assert.deepEqual(await configSnapshot(locations.baseConfigJsonPath), baseBefore);
      assert.equal(
        await readFile(locations.localConfigJsonPath, "utf8"),
        expectedLocal ?? localBytes,
      );
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("D-MF-03: an unnamed enable writes a local entry the base config does not declare", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "local");
    const bytesBefore = await scopeBytes(locations);
    const boundary = notificationBoundary({
      message: "● mp [project] <autoupdate>\n\nMarketplace autoupdate: 1 success",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), {
      state: bytesBefore.state,
      base: undefined,
      local: BASE_FLIP_BYTES,
    });
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("D-MF-03: an unnamed disable writes the base entry and leaves a local entry without a value to inherit it", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "local");
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { mp: { source: "./src", autoupdate: true } },
    });
    const bytesBefore = await scopeBytes(locations);
    const boundary = notificationBoundary({
      message: "● mp [project] <no autoupdate>\n\nMarketplace noautoupdate: 1 success",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: false,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), {
      ...bytesBefore,
      base: '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": false\n    }\n  },\n  "plugins": {}\n}\n',
    });
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

const officialDefaultNamedCases = [
  {
    name: "claude-plugins-official",
    enable: true,
    expectedMessage: "● claude-plugins-official [project] <autoupdate> {already autoupdate}",
    expectedBase: undefined,
  },
  {
    name: "claude-plugins-official",
    enable: false,
    expectedMessage: "● claude-plugins-official [project] <no autoupdate>",
    expectedBase:
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "claude-plugins-official": {\n      "source": "./src",\n      "autoupdate": false\n    }\n  },\n  "plugins": {}\n}\n',
  },
  {
    name: "knowledge-work-plugins",
    enable: true,
    expectedMessage: "● knowledge-work-plugins [project] <autoupdate>",
    expectedBase:
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "knowledge-work-plugins": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
  },
] as const;

for (const { name, enable, expectedMessage, expectedBase } of officialDefaultNamedCases) {
  test(`D-PL8-07: a named ${enable ? "enable" : "disable"} of ${name} without a base value judges the default for the name`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await saveMarketplaces(locations, [marketplaceRecord(name, "project", cwd)]);
      await writeConfig(locations, {
        schemaVersion: 1,
        marketplaces: { [name]: { source: "./src" } },
      });
      const bytesBefore = await scopeBytes(locations);
      const boundary = notificationBoundary({ message: expectedMessage });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        name,
        enable,
        scope: "project",
        cwd,
      });

      // assert
      assert.deepEqual(await scopeBytes(locations), {
        ...bytesBefore,
        base: expectedBase ?? bytesBefore.base,
      });
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

const officialDefaultInheritedCases = [
  { label: "a base config that does not declare it", base: {} },
  {
    label: "a base entry without a value",
    base: { "claude-plugins-official": { source: "./src" } },
  },
] as const;

for (const { label, base } of officialDefaultInheritedCases) {
  test(`D-PL8-07: a named --local enable of an official local entry without a value over ${label} inherits the default`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await saveMarketplaces(locations, [
        marketplaceRecord("claude-plugins-official", "project", cwd),
      ]);
      await writeConfig(
        locations,
        { schemaVersion: 1, marketplaces: { "claude-plugins-official": { source: "./src" } } },
        true,
      );
      await writeConfig(locations, { schemaVersion: 1, marketplaces: base });
      const bytesBefore = await scopeBytes(locations);
      const boundary = notificationBoundary({
        message: "● claude-plugins-official [project] <autoupdate> {already autoupdate}",
      });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        name: "claude-plugins-official",
        enable: true,
        scope: "project",
        cwd,
        local: true,
      });

      // assert
      assert.deepEqual(await scopeBytes(locations), bytesBefore);
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("D-PL8-07: an unnamed enable leaves an official local entry the base config does not declare on its default", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [
      marketplaceRecord("claude-plugins-official", "project", cwd),
    ]);
    await writeConfig(
      locations,
      { schemaVersion: 1, marketplaces: { "claude-plugins-official": { source: "./src" } } },
      true,
    );
    const bytesBefore = await scopeBytes(locations);
    const boundary = notificationBoundary({
      message:
        "● claude-plugins-official [project] <autoupdate> {already autoupdate}\n\nMarketplace autoupdate: 1 success",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), bytesBefore);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("D-09: an unnamed --local flip changes only the local config and skips what it does not declare", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [
      marketplaceRecord("extras", "project", cwd, pathSource("./extras")),
      marketplaceRecord("mp", "project", cwd),
    ]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { extras: { source: "./extras" }, mp: { source: "./src", autoupdate: true } },
    });
    await writeConfig(
      locations,
      { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } },
      true,
    );
    const baseBefore = await configSnapshot(locations.baseConfigJsonPath);
    const boundary = notificationBoundary({
      message: "● mp [project] <no autoupdate>\n\nMarketplace noautoupdate: 1 success",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: false,
      scope: "project",
      cwd,
      local: true,
    });

    // assert
    assert.deepEqual(await configSnapshot(locations.baseConfigJsonPath), baseBefore);
    assert.equal(
      await readFile(locations.localConfigJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": false\n    }\n  },\n  "plugins": {}\n}\n',
    );
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("CFG-03: an unnamed flip without --local over an invalid local config fails and writes nothing", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "base");
    await writeFile(locations.localConfigJsonPath, "{ malformed", "utf8");
    const bytesBefore = await scopeBytes(locations);
    const boundary = notificationBoundary({
      message: [
        "Some operations have failed.",
        "",
        "⊘ (unknown) [project] (failed)",
        "  ⊘ (unknown) (failed) {invalid manifest}",
        '    cause: Config file "claude-plugins.local.json" failed schema validation.',
        "",
        "Marketplace autoupdate: 2 failures",
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), bytesBefore);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

const invalidBaseValuedLocalCases = [
  {
    title:
      "CFG-03: an unnamed --local flip of a local entry with a value ignores an invalid base config",
    invocation: {},
    expectedMessage: "● mp [project] <autoupdate>\n\nMarketplace autoupdate: 1 success",
  },
  {
    title:
      "CFG-03: a named --local flip of a local entry with a value ignores an invalid base config",
    invocation: { name: "mp" },
    expectedMessage: "● mp [project] <autoupdate>",
  },
] as const;

for (const { title, invocation, expectedMessage } of invalidBaseValuedLocalCases) {
  test(title, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
      await writeConfig(
        locations,
        { schemaVersion: 1, marketplaces: { mp: { source: "./src", autoupdate: false } } },
        true,
      );
      await writeFile(locations.baseConfigJsonPath, "{ malformed", "utf8");
      const bytesBefore = await scopeBytes(locations);
      const boundary = notificationBoundary({ message: expectedMessage });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        enable: true,
        scope: "project",
        cwd,
        local: true,
        ...invocation,
      });

      // assert
      assert.deepEqual(await scopeBytes(locations), { ...bytesBefore, local: BASE_FLIP_BYTES });
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

const invalidBaseInheritedCases = [
  {
    title:
      "CFG-03: an unnamed --local flip that needs the value of an invalid base config fails and writes nothing",
    invocation: {},
    expectedMessage: [
      "Some operations have failed.",
      "",
      "⊘ (unknown) [project] (failed)",
      "  ⊘ (unknown) (failed) {invalid manifest}",
      '    cause: Config file "claude-plugins.json" failed schema validation.',
      "",
      "Marketplace autoupdate: 2 failures",
    ].join("\n"),
  },
  {
    title:
      "CFG-03: a named --local flip that needs the value of an invalid base config fails and writes nothing",
    invocation: { name: "mp" },
    expectedMessage: [
      "Some operations have failed.",
      "",
      "⊘ mp [project] (failed)",
      "  ⊘ mp (failed) {invalid manifest}",
      '    cause: Config file "claude-plugins.json" failed schema validation.',
    ].join("\n"),
  },
] as const;

for (const { title, invocation, expectedMessage } of invalidBaseInheritedCases) {
  test(title, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await recordAndDeclare(locations, cwd, "local");
      await writeFile(locations.baseConfigJsonPath, "{ malformed", "utf8");
      const bytesBefore = await scopeBytes(locations);
      const boundary = notificationBoundary({ message: expectedMessage, severity: "error" });

      // act
      await setMarketplaceAutoupdate({
        ctx: boundary.ctx,
        run: boundary.run,
        enable: true,
        scope: "project",
        cwd,
        local: true,
        ...invocation,
      });

      // assert
      assert.deepEqual(await scopeBytes(locations), bytesBefore);
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("D-08-07: reports a marketplace named constructor as not added when no record owns the name", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "base");
    const bytesBefore = await scopeBytes(locations);
    const boundary = notificationBoundary({
      message:
        "A marketplace operation has failed.\n\n⊘ constructor [project] (failed) {marketplace not added}",
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      run: boundary.run,
      name: "constructor",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await scopeBytes(locations), bytesBefore);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});
