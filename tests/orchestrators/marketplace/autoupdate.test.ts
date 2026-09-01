import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";
import { It, mock, verify, when } from "strong-mock";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { setMarketplaceAutoupdate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ScopeConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

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

function notificationBoundary(expectation: NotificationExpectation): {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly ui: ExtensionContext["ui"];
} {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  when(() => ctx.ui)
    .thenReturn(ui)
    .once();
  when(() => pi.getAllTools())
    .thenReturn([])
    .twice();
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

  return { ctx, pi, ui };
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

async function withHermeticHome<T>(
  fn: (environment: { readonly cwd: string; readonly home: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "mp-autoupdate-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-autoupdate-cwd-"));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn({ cwd, home });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(home, { recursive: true, force: true, maxRetries: 10 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 10 });
  }
}

test("enables one project marketplace in the base config without rewriting state", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const disabledPlugin: PluginInstallRecord = {
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      enabled: false,
      installedAt: "2026-01-01T00:00:00.000Z",
      resolvedSource: "/fixture/plugins/example",
      resources: { agents: [], hooks: [], mcpServers: [], prompts: [], skills: [] },
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: "1.0.0",
    };
    await saveMarketplaces(locations, [
      marketplaceRecord("mp", "project", cwd, pathSource("./src"), {
        example: disabledPlugin,
      }),
    ]);
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: "● mp [project] <autoupdate>",
    });
    const expectedConfigBytes = [
      "{",
      '  "schemaVersion": 1,',
      '  "marketplaces": {',
      '    "mp": {',
      '      "autoupdate": true,',
      '      "source": "./src"',
      "    }",
      "  },",
      '  "plugins": {}',
      "}",
      "",
    ].join("\n");

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(await readFile(locations.configJsonPath, "utf8"), expectedConfigBytes);
    assert.equal(await readOptionalBytes(locations.configLocalJsonPath), undefined);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

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
      pi: boundary.pi,
      name: "mp",
      enable: false,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(await readFile(locations.configJsonPath, "utf8"), expectedConfigBytes);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
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
      pi: boundary.pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await configSnapshot(locations.configJsonPath), configBefore);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
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
      pi: boundary.pi,
      name: "mp",
      enable: false,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await configSnapshot(locations.configJsonPath), configBefore);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
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
      marketplaces: { already: { source: "./already", autoupdate: true } },
    });
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: [
        "● to-flip [project] <autoupdate>",
        "",
        "● already [project] <autoupdate> {already autoupdate}",
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
      '      "autoupdate": true,',
      '      "source": "./to-flip"',
      "    }",
      "  },",
      '  "plugins": {}',
      "}",
      "",
    ].join("\n");

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(await readFile(locations.configJsonPath, "utf8"), expectedConfigBytes);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("reports an empty implicit two-scope inventory without creating files", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    const boundary = notificationBoundary({ message: "(no marketplaces)" });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      enable: true,
      cwd,
    });

    // assert
    assert.equal(await readOptionalBytes(projectLocations.stateJsonPath), undefined);
    assert.equal(await readOptionalBytes(projectLocations.configJsonPath), undefined);
    assert.equal(await readOptionalBytes(userLocations.stateJsonPath), undefined);
    assert.equal(await readOptionalBytes(userLocations.configJsonPath), undefined);
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("finds a named user marketplace after an implicit project miss", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    await saveMarketplaces(userLocations, [marketplaceRecord("only", "user", cwd)]);
    const stateBytes = await readFile(userLocations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({ message: "● only [user] <autoupdate>" });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "only",
      enable: true,
      cwd,
    });

    // assert
    assert.equal(await readOptionalBytes(projectLocations.configJsonPath), undefined);
    assert.equal(
      await readFile(userLocations.configJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "only": {\n      "autoupdate": true,\n      "source": "./src"\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(userLocations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("reports a named marketplace absent from both implicit scopes", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const boundary = notificationBoundary({
      message: "A marketplace operation has failed.\n\n⊘ missing-mp [project] (failed) {not added}",
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "missing-mp",
      enable: true,
      cwd,
    });

    // assert
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("reports a named marketplace absent from an explicit user scope", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const boundary = notificationBoundary({
      message: "A marketplace operation has failed.\n\n⊘ missing-mp [user] (failed) {not added}",
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "missing-mp",
      enable: false,
      scope: "user",
      cwd,
    });

    // assert
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("writes a user marketplace only to the local config layer", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "user", cwd)]);
    await writeConfig(locations, {
      schemaVersion: 1,
      marketplaces: { base: { source: "./base", autoupdate: false } },
    });
    const baseBytes = await readFile(locations.configJsonPath, "utf8");
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({ message: "● mp [user] <autoupdate>" });
    const expectedLocalBytes = [
      "{",
      '  "schemaVersion": 1,',
      '  "marketplaces": {',
      '    "mp": {',
      '      "autoupdate": true,',
      '      "source": "./src"',
      "    }",
      "  },",
      '  "plugins": {}',
      "}",
      "",
    ].join("\n");

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "mp",
      enable: true,
      scope: "user",
      cwd,
      local: true,
    });

    // assert
    assert.equal(await readFile(locations.configJsonPath, "utf8"), baseBytes);
    assert.equal(await readFile(locations.configLocalJsonPath, "utf8"), expectedLocalBytes);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
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
      pi: boundary.pi,
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
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("orchestrated enable preserves an existing config source and opposite value", async () => {
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
    const boundary = notificationBoundary({ message: "● mp [project] <autoupdate>" });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.deepEqual(await configSnapshot(locations.configJsonPath), configBefore);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("standalone enable reports an unsynthesizable source without writing config", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [
      marketplaceRecord("odd", "project", cwd, { kind: "unknown" }),
    ]);
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: "A marketplace operation has failed.\n\n⊘ odd [project] (failed) {not found}",
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "odd",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(await readOptionalBytes(locations.configJsonPath), undefined);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("orchestrated enable reports an unsynthesizable source without writing config", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [
      marketplaceRecord("odd", "project", cwd, { kind: "unknown" }),
    ]);
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary({
      message: "A marketplace operation has failed.\n\n⊘ odd [project] (failed) {not found}",
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "odd",
      enable: true,
      scope: "project",
      cwd,
      notifications: { mode: "orchestrated" },
    });

    // assert
    assert.equal(await readOptionalBytes(locations.configJsonPath), undefined);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

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
        "  ⊘ mp (failed) {not found}",
        '    cause: Config file "claude-plugins.json" failed schema validation.',
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(await readFile(locations.configJsonPath, "utf8"), configBytes);
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(boundary.ctx);
    verify(boundary.pi);
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
        "  ⊘ mp (failed) {not found}",
        '    cause: Config file "claude-plugins.local.json" failed schema validation.',
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
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
    verify(boundary.pi);
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
        "  ⊘ mp (failed) {not found}",
        '    cause: Config file "claude-plugins.local.json" failed schema validation.',
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
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
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("reports a held named scope lock and succeeds after the lock is released", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
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
      pi: blockedBoundary.pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });
    await release();
    await setMarketplaceAutoupdate({
      ctx: retryBoundary.ctx,
      pi: retryBoundary.pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(
      await readFile(locations.configJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "autoupdate": true,\n      "source": "./src"\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(blockedBoundary.ctx);
    verify(blockedBoundary.pi);
    verify(blockedBoundary.ui);
    verify(retryBoundary.ctx);
    verify(retryBoundary.pi);
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
      ].join("\n"),
      severity: "error",
    });

    // act
    await setMarketplaceAutoupdate({
      ctx: boundary.ctx,
      pi: boundary.pi,
      enable: false,
      scope: "project",
      cwd,
    });
    await release();

    // assert
    assert.equal(await readOptionalBytes(locations.configJsonPath), undefined);
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("keeps config absent after an atomic write refusal and converges on retry", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await saveMarketplaces(locations, [marketplaceRecord("mp", "project", cwd)]);
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
        pi: failedBoundary.pi,
        name: "mp",
        enable: true,
        scope: "project",
        cwd,
      });
    } finally {
      await chmod(locations.scopeRoot, 0o700);
    }

    const configAfterFailure = await readOptionalBytes(locations.configJsonPath);
    await setMarketplaceAutoupdate({
      ctx: retryBoundary.ctx,
      pi: retryBoundary.pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // assert
    assert.equal(configAfterFailure, undefined);
    assert.equal(
      await readFile(locations.configJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "autoupdate": true,\n      "source": "./src"\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    verify(failedBoundary.ctx);
    verify(failedBoundary.pi);
    verify(failedBoundary.ui);
    verify(retryBoundary.ctx);
    verify(retryBoundary.pi);
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
      pi: partialBoundary.pi,
      name: "shared",
      enable: true,
      cwd,
    });
    const projectConfigAfterFailure = await readFile(projectLocations.configJsonPath, "utf8");
    const userConfigAfterFailure = await readOptionalBytes(userLocations.configJsonPath);
    await release();
    await setMarketplaceAutoupdate({
      ctx: retryBoundary.ctx,
      pi: retryBoundary.pi,
      name: "shared",
      enable: true,
      cwd,
    });

    // assert
    assert.equal(
      projectConfigAfterFailure,
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "shared": {\n      "autoupdate": true,\n      "source": "./src"\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(userConfigAfterFailure, undefined);
    assert.equal(
      await readFile(userLocations.configJsonPath, "utf8"),
      '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "shared": {\n      "autoupdate": true,\n      "source": "./src"\n    }\n  },\n  "plugins": {}\n}\n',
    );
    assert.equal(await readFile(projectLocations.stateJsonPath, "utf8"), projectStateBytes);
    assert.equal(await readFile(userLocations.stateJsonPath, "utf8"), userStateBytes);
    verify(partialBoundary.ctx);
    verify(partialBoundary.pi);
    verify(partialBoundary.ui);
    verify(retryBoundary.ctx);
    verify(retryBoundary.pi);
    verify(retryBoundary.ui);
  });
});
