import assert from "node:assert/strict";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
    local ? locations.configLocalJsonPath : locations.configJsonPath,
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
  readonly shared: string | undefined;
  readonly local: string | undefined;
}> {
  return {
    state: await readOptionalBytes(locations.stateJsonPath),
    shared: await readOptionalBytes(locations.configJsonPath),
    local: await readOptionalBytes(locations.configLocalJsonPath),
  };
}

async function recordAndDeclare(
  locations: ScopedLocations,
  cwd: string,
  layer: "shared" | "local",
): Promise<void> {
  await saveMarketplaces(locations, [marketplaceRecord("mp", locations.scope, cwd)]);
  await writeConfig(
    locations,
    { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } },
    layer === "local",
  );
}

const DECLARED_LOCALLY_REFUSAL = [
  "Some operations have failed.",
  "",
  "⊘ mp [project] (failed)",
  "  ⊘ mp (failed) {marketplace declared locally}",
  "    cause: The marketplace mp is declared only in claude-plugins.local.json. Run the command again with --local.",
].join("\n");

const SHARED_FLIP_BYTES =
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
      assert.equal(await readFile(locations.configJsonPath, "utf8"), expectedConfigBytes);
      assert.equal(await readOptionalBytes(locations.configLocalJsonPath), undefined);
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
    assert.equal(await readFile(locations.configJsonPath, "utf8"), expectedConfigBytes);
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
    const configBefore = await configSnapshot(locations.configJsonPath);
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
    assert.deepEqual(await configSnapshot(locations.configJsonPath), configBefore);
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
    const configBefore = await configSnapshot(locations.configJsonPath);
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
    assert.deepEqual(await configSnapshot(locations.configJsonPath), configBefore);
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
    assert.equal(await readFile(locations.configJsonPath, "utf8"), expectedConfigBytes);
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
    assert.equal(await readOptionalBytes(projectLocations.configJsonPath), undefined);
    assert.equal(await readOptionalBytes(userLocations.stateJsonPath), undefined);
    assert.equal(await readOptionalBytes(userLocations.configJsonPath), undefined);
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
    assert.equal(await readOptionalBytes(projectLocations.configJsonPath), undefined);
    assert.equal(
      await readFile(userLocations.configJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "only": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(userLocations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("reports a named marketplace absent from both implicit scopes", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const boundary = notificationBoundary({
      message:
        "A marketplace operation has failed.\n\n⊘ missing-mp [project] (failed) {marketplace not added}",
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

test("LAYER-02: a local flip writes an explicit value into a local entry that has none", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "user", cwd)]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { base: { source: "./base", autoupdate: false } },
    });
    await writeConfig(
      locations,
      { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } },
      true,
    );
    const baseBytes = await readFile(locations.configJsonPath, "utf8");
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({ message: "● mp [user] <no autoupdate>" });
    const expectedLocalBytes = [
      "{",
      '  "schemaVersion": 1,',
      '  "marketplaces": {',
      '    "mp": {',
      '      "source": "./src",',
      '      "autoupdate": false',
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
      name: "mp",
      enable: false,
      scope: "user",
      cwd,
      local: true,
    });

    // assert
    assert.equal(await readFile(locations.configJsonPath, "utf8"), baseBytes);
    assert.equal(await readFile(locations.configLocalJsonPath, "utf8"), expectedLocalBytes);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
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
    assert.equal(await readOptionalBytes(locations.configJsonPath), undefined);
    assert.equal(await readOptionalBytes(locations.configLocalJsonPath), undefined);
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
      const configBefore = await configSnapshot(locations.configJsonPath);
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
      assert.deepEqual(await configSnapshot(locations.configJsonPath), configBefore);
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
    await writeFile(locations.configJsonPath, "{ malformed", "utf8");
    const configBytes = await readFile(locations.configJsonPath, "utf8");
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
    assert.equal(await readFile(locations.configJsonPath, "utf8"), configBytes);
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
      locations.configLocalJsonPath,
      JSON.stringify({ schemaVersion: 2, marketplaces: {} }),
      "utf8",
    );
    const configBytes = await readFile(locations.configLocalJsonPath, "utf8");
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
    assert.equal(await readFile(locations.configLocalJsonPath, "utf8"), configBytes);
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
    await mkdir(locations.configLocalJsonPath, { recursive: true });
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
    assert.equal((await stat(locations.configLocalJsonPath)).isDirectory(), true);
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
      await readFile(locations.configJsonPath, "utf8"),
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
    assert.equal(await readOptionalBytes(locations.configJsonPath), undefined);
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
    const configBytes = await readFile(locations.configJsonPath, "utf8");
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const failedBoundary = notificationBoundary({
      matches: (message) => {
        const escapedScopeRoot = locations.scopeRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(
          `^Some operations have failed\\.\\n\\n⊘ mp \\[project\\] \\(failed\\)\\n  ⊘ mp \\(failed\\) \\{not found\\}\\n    cause: EACCES: permission denied, open '${escapedScopeRoot}/claude-plugins\\.json\\.[0-9]+'$`,
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

    const configAfterFailure = await readFile(locations.configJsonPath, "utf8");
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
      await readFile(locations.configJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(failedBoundary.ctx);
    verify(failedBoundary.ui);
    verify(retryBoundary.ctx);
    verify(retryBoundary.ui);
  });
});

test("retains a committed project flip when the user scope is locked and converges on retry", async () => {
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
    const userConfigBytes = await readFile(userLocations.configJsonPath, "utf8");
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
        "⊘ shared [user] (failed)",
        "  ⊘ shared (failed) {lock held}",
        `    cause: Another pi-claude-marketplace operation is in progress for user scope (${userLocations.stateLockFile}). Retry after it completes. -> Lock file is already being held`,
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
    const projectConfigAfterFailure = await readFile(projectLocations.configJsonPath, "utf8");
    const userConfigAfterFailure = await readFile(userLocations.configJsonPath, "utf8");
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
      await readFile(userLocations.configJsonPath, "utf8"),
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

test("LAYER-02: a shared flip writes only the shared entry while the local file also declares it", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "shared");
    await writeConfig(
      locations,
      { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } },
      true,
    );
    const localBefore = await configSnapshot(locations.configLocalJsonPath);
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
    assert.equal(await readFile(locations.configJsonPath, "utf8"), SHARED_FLIP_BYTES);
    assert.deepEqual(await configSnapshot(locations.configLocalJsonPath), localBefore);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

const layerRefusalCases = [
  {
    label: "a flip without --local on a marketplace only the local file declares",
    declaringLayer: "local" as const,
    local: false,
    expectedMessage: DECLARED_LOCALLY_REFUSAL,
  },
  {
    label: "a flip with --local on a marketplace only the shared file declares",
    declaringLayer: "shared" as const,
    local: true,
    expectedMessage: [
      "Some operations have failed.",
      "",
      "⊘ mp [project] (failed)",
      "  ⊘ mp (failed) {marketplace declared in shared config}",
      "    cause: The marketplace mp is declared only in claude-plugins.json. Run the command again without --local.",
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
    await writeFile(locations.configLocalJsonPath, "{ malformed", "utf8");
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
    await recordAndDeclare(userLocations, cwd, "shared");
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
      shared: SHARED_FLIP_BYTES,
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
        message: DECLARED_LOCALLY_REFUSAL,
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
    label: "a shared entry without a value as already off",
    layer: "shared" as const,
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
        layer === "local" ? locations.configLocalJsonPath : locations.configJsonPath;
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
    label: "turns off a marketplace the shared file has on",
    entry: { source: "./src", autoupdate: true },
    expectedMessage: "● mp [project] <no autoupdate>\n\nMarketplace noautoupdate: 1 success",
    expectedBytes:
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": false\n    }\n  },\n  "plugins": {}\n}\n',
  },
  {
    label: "reports a shared entry without a value as already off",
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
      const configBytes = await readFile(locations.configJsonPath, "utf8");
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
      assert.equal(await readFile(locations.configJsonPath, "utf8"), expectedBytes ?? configBytes);
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("CFG-03: an unnamed --local flip over an invalid local file fails and writes nothing", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "shared");
    await writeFile(locations.configLocalJsonPath, "{ malformed", "utf8");
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

test("D-06: an unnamed flip sets the value in every layer that declares each marketplace", async () => {
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
      shared: [
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
      local: [
        "{",
        '  "schemaVersion": 1,',
        '  "marketplaces": {',
        '    "tools": {',
        '      "source": "./tools",',
        '      "autoupdate": true',
        "    }",
        "  },",
        '  "plugins": {}',
        "}",
        "",
      ].join("\n"),
    });
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

const sharedOnUnnamedCases = [
  {
    label: "writes the explicit value into a local entry that has none",
    localEntry: { source: "./src" },
    expectedMessage: "● mp [project] <autoupdate>\n\nMarketplace autoupdate: 1 success",
    expectedLocal:
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": true\n    }\n  },\n  "plugins": {}\n}\n',
  },
  {
    label: "reports already autoupdate when every declaring layer has it on",
    localEntry: { source: "./src", autoupdate: true },
    expectedMessage:
      "● mp [project] <autoupdate> {already autoupdate}\n\nMarketplace autoupdate: 1 success",
    expectedLocal: undefined,
  },
] as const;

for (const { label, localEntry, expectedMessage, expectedLocal } of sharedOnUnnamedCases) {
  test(`D-07: an unnamed enable over a shared value that is on ${label}`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
      await writeConfig(locations, {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./src", autoupdate: true } },
      });
      await writeConfig(locations, { schemaVersion: 1, marketplaces: { mp: localEntry } }, true);
      const sharedBefore = await configSnapshot(locations.configJsonPath);
      const localBytes = await readFile(locations.configLocalJsonPath, "utf8");
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
      assert.deepEqual(await configSnapshot(locations.configJsonPath), sharedBefore);
      assert.equal(
        await readFile(locations.configLocalJsonPath, "utf8"),
        expectedLocal ?? localBytes,
      );
      verify(boundary.ctx);
      verify(boundary.ui);
    });
  });
}

test("D-09: an unnamed --local flip changes only the local file and skips what it does not declare", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [
      marketplaceRecord("extras", "project", cwd, pathSource("./extras")),
      marketplaceRecord("mp", "project", cwd),
    ]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { extras: { source: "./extras" }, mp: { source: "./src" } },
    });
    await writeConfig(
      locations,
      { schemaVersion: 1, marketplaces: { mp: { source: "./src" } } },
      true,
    );
    const sharedBefore = await configSnapshot(locations.configJsonPath);
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
    assert.deepEqual(await configSnapshot(locations.configJsonPath), sharedBefore);
    assert.equal(
      await readFile(locations.configLocalJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./src",\n      "autoupdate": false\n    }\n  },\n  "plugins": {}\n}\n',
    );
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("CFG-03: an unnamed flip without --local over an invalid local file fails and writes nothing", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "shared");
    await writeFile(locations.configLocalJsonPath, "{ malformed", "utf8");
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

test("D-09: an unnamed --local flip reads only the local file", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "local");
    await writeFile(locations.configJsonPath, "{ malformed", "utf8");
    const sharedBytes = await readFile(locations.configJsonPath, "utf8");
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
      local: true,
    });

    // assert
    assert.equal(await readFile(locations.configJsonPath, "utf8"), sharedBytes);
    assert.equal(await readFile(locations.configLocalJsonPath, "utf8"), SHARED_FLIP_BYTES);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("D-08-07: reports a marketplace named constructor as not added when no record owns the name", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await recordAndDeclare(locations, cwd, "shared");
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
