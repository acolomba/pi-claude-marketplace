import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectMarketplaceRecordsByScope } from "../../extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts";
import { saveConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import {
  locationsFor,
  type ScopedLocations,
} from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";
import type { TestContext } from "node:test";

interface TestScopes {
  readonly cwd: string;
  readonly project: ScopedLocations;
  readonly root: string;
  readonly user: ScopedLocations;
}

async function makeTestScopes(t: TestContext, prefix: string): Promise<TestScopes> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const cwd = path.join(root, "project");
  const hadAgentDirectory = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = path.join(root, "user");
  await mkdir(cwd, { recursive: true });
  t.after(async () => {
    if (hadAgentDirectory && previousAgentDirectory !== undefined) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    await rm(root, { recursive: true, force: true });
  });

  return {
    cwd,
    project: locationsFor("project", cwd),
    root,
    user: locationsFor("user", cwd),
  };
}

function marketplaceRecord(
  scope: Scope,
  marketplace: string,
  root: string,
): ExtensionState["marketplaces"][string] {
  return {
    name: marketplace,
    scope,
    source: {
      kind: "path",
      raw: `./${scope}-${marketplace}`,
      logical: `./${scope}-${marketplace}`,
    },
    addedFromCwd: path.join(root, `${scope}-added-from`),
    manifestPath: path.join(root, `${scope}-${marketplace}.json`),
    marketplaceRoot: path.join(root, `${scope}-${marketplace}`),
    plugins: {},
  };
}

async function seedState(
  locations: ScopedLocations,
  marketplaces: ExtensionState["marketplaces"],
): Promise<void> {
  await saveState(locations.extensionRoot, { schemaVersion: 2, marketplaces });
}

async function seedConfig(
  locations: ScopedLocations,
  config: ScopeConfig,
  target: "base" | "local" = "base",
): Promise<void> {
  const filePath = target === "base" ? locations.configJsonPath : locations.configLocalJsonPath;
  await saveConfig(filePath, config, locations.scopeRoot);
}

async function seedMalformedFile(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}

test("returns an empty list when both scope states are absent", async (t) => {
  // arrange
  const { cwd } = await makeTestScopes(t, "scope-fanout-empty-");

  // act
  const records = await collectMarketplaceRecordsByScope({
    cwd,
    scope: undefined,
    marketplace: "missing",
  });

  // assert
  assert.deepStrictEqual(records, []);
});

test("reads only an explicit project scope and applies missing-config defaults", async (t) => {
  // arrange
  const { cwd, project, root, user } = await makeTestScopes(t, "scope-fanout-explicit-");
  await seedState(project, { alpha: marketplaceRecord("project", "alpha", root) });
  await seedMalformedFile(user.stateJsonPath, "user scope must not be read");

  // act
  const records = await collectMarketplaceRecordsByScope({
    cwd,
    scope: "project",
    marketplace: "alpha",
  });

  // assert
  assert.deepStrictEqual(records, [
    {
      scope: "project",
      record: {
        name: "alpha",
        scope: "project",
        source: {
          kind: "path",
          raw: "./project-alpha",
          logical: "./project-alpha",
        },
        addedFromCwd: path.join(root, "project-added-from"),
        manifestPath: path.join(root, "project-alpha.json"),
        marketplaceRoot: path.join(root, "project-alpha"),
        plugins: {},
      },
      autoupdate: false,
      declaredEnabled: undefined,
    },
  ]);
});

test("preserves same-name project-before-user rows and explicit config values", async (t) => {
  // arrange
  const { cwd, project, root, user } = await makeTestScopes(t, "scope-fanout-order-");
  await seedState(project, { shared: marketplaceRecord("project", "shared", root) });
  await seedState(user, { shared: marketplaceRecord("user", "shared", root) });
  await seedConfig(project, {
    schemaVersion: 1,
    marketplaces: { shared: { source: "./project-shared", autoupdate: true } },
    plugins: { "tool@shared": { enabled: true } },
  });
  await seedConfig(user, {
    schemaVersion: 1,
    marketplaces: { shared: { source: "./user-shared", autoupdate: false } },
    plugins: { "tool@shared": { enabled: false } },
  });

  // act
  const records = await collectMarketplaceRecordsByScope({
    cwd,
    scope: undefined,
    marketplace: "shared",
    pluginKey: "tool@shared",
  });

  // assert
  assert.deepStrictEqual(records, [
    {
      scope: "project",
      record: {
        name: "shared",
        scope: "project",
        source: {
          kind: "path",
          raw: "./project-shared",
          logical: "./project-shared",
        },
        addedFromCwd: path.join(root, "project-added-from"),
        manifestPath: path.join(root, "project-shared.json"),
        marketplaceRoot: path.join(root, "project-shared"),
        plugins: {},
      },
      autoupdate: true,
      declaredEnabled: true,
    },
    {
      scope: "user",
      record: {
        name: "shared",
        scope: "user",
        source: {
          kind: "path",
          raw: "./user-shared",
          logical: "./user-shared",
        },
        addedFromCwd: path.join(root, "user-added-from"),
        manifestPath: path.join(root, "user-shared.json"),
        marketplaceRoot: path.join(root, "user-shared"),
        plugins: {},
      },
      autoupdate: false,
      declaredEnabled: false,
    },
  ]);
});

test("returns undefined declaration state for absent and omitted enabled values", async (t) => {
  // arrange
  const { cwd, project, root } = await makeTestScopes(t, "scope-fanout-declaration-");
  await seedState(project, { alpha: marketplaceRecord("project", "alpha", root) });
  await seedConfig(project, {
    schemaVersion: 1,
    marketplaces: { alpha: { source: "./project-alpha" } },
    plugins: { "default@alpha": {} },
  });

  // act
  const absent = await collectMarketplaceRecordsByScope({
    cwd,
    scope: "project",
    marketplace: "alpha",
    pluginKey: "absent@alpha",
  });
  const omitted = await collectMarketplaceRecordsByScope({
    cwd,
    scope: "project",
    marketplace: "alpha",
    pluginKey: "default@alpha",
  });

  // assert
  assert.deepStrictEqual(absent, [
    {
      scope: "project",
      record: {
        name: "alpha",
        scope: "project",
        source: {
          kind: "path",
          raw: "./project-alpha",
          logical: "./project-alpha",
        },
        addedFromCwd: path.join(root, "project-added-from"),
        manifestPath: path.join(root, "project-alpha.json"),
        marketplaceRoot: path.join(root, "project-alpha"),
        plugins: {},
      },
      autoupdate: false,
      declaredEnabled: undefined,
    },
  ]);
  assert.deepStrictEqual(omitted, [
    {
      scope: "project",
      record: {
        name: "alpha",
        scope: "project",
        source: {
          kind: "path",
          raw: "./project-alpha",
          logical: "./project-alpha",
        },
        addedFromCwd: path.join(root, "project-added-from"),
        manifestPath: path.join(root, "project-alpha.json"),
        marketplaceRoot: path.join(root, "project-alpha"),
        plugins: {},
      },
      autoupdate: false,
      declaredEnabled: undefined,
    },
  ]);
});

test("skips an absent marketplace before malformed config files are relevant", async (t) => {
  // arrange
  const { cwd, project, root } = await makeTestScopes(t, "scope-fanout-skip-");
  await seedState(project, { other: marketplaceRecord("project", "other", root) });
  await seedMalformedFile(project.configJsonPath, "malformed base config");
  await seedMalformedFile(project.configLocalJsonPath, "malformed local config");

  // act
  const records = await collectMarketplaceRecordsByScope({
    cwd,
    scope: "project",
    marketplace: "missing",
    pluginKey: "tool@missing",
  });

  // assert
  assert.deepStrictEqual(records, []);
});

test("uses valid local declarations after a malformed base config", async (t) => {
  // arrange
  const { cwd, project, root } = await makeTestScopes(t, "scope-fanout-base-failure-");
  await seedState(project, { alpha: marketplaceRecord("project", "alpha", root) });
  await seedMalformedFile(project.configJsonPath, "malformed base config");
  await seedConfig(
    project,
    {
      schemaVersion: 1,
      marketplaces: { alpha: { source: "./local-alpha", autoupdate: true } },
      plugins: { "tool@alpha": { enabled: true } },
    },
    "local",
  );

  // act
  const records = await collectMarketplaceRecordsByScope({
    cwd,
    scope: "project",
    marketplace: "alpha",
    pluginKey: "tool@alpha",
  });

  // assert
  assert.deepStrictEqual(records, [
    {
      scope: "project",
      record: {
        name: "alpha",
        scope: "project",
        source: {
          kind: "path",
          raw: "./project-alpha",
          logical: "./project-alpha",
        },
        addedFromCwd: path.join(root, "project-added-from"),
        manifestPath: path.join(root, "project-alpha.json"),
        marketplaceRoot: path.join(root, "project-alpha"),
        plugins: {},
      },
      autoupdate: true,
      declaredEnabled: true,
    },
  ]);
});

test("uses valid base declarations when the local config is malformed", async (t) => {
  // arrange
  const { cwd, project, root } = await makeTestScopes(t, "scope-fanout-local-failure-");
  await seedState(project, { alpha: marketplaceRecord("project", "alpha", root) });
  await seedConfig(project, {
    schemaVersion: 1,
    marketplaces: { alpha: { source: "./base-alpha", autoupdate: true } },
    plugins: { "tool@alpha": { enabled: false } },
  });
  await seedMalformedFile(project.configLocalJsonPath, "malformed local config");

  // act
  const records = await collectMarketplaceRecordsByScope({
    cwd,
    scope: "project",
    marketplace: "alpha",
    pluginKey: "tool@alpha",
  });

  // assert
  assert.deepStrictEqual(records, [
    {
      scope: "project",
      record: {
        name: "alpha",
        scope: "project",
        source: {
          kind: "path",
          raw: "./project-alpha",
          logical: "./project-alpha",
        },
        addedFromCwd: path.join(root, "project-added-from"),
        manifestPath: path.join(root, "project-alpha.json"),
        marketplaceRoot: path.join(root, "project-alpha"),
        plugins: {},
      },
      autoupdate: true,
      declaredEnabled: false,
    },
  ]);
});

test("rejects a first-scope state failure before reading user scope", async (t) => {
  // arrange
  const { cwd, project, root, user } = await makeTestScopes(t, "scope-fanout-first-error-");
  await seedMalformedFile(
    project.stateJsonPath,
    JSON.stringify({ schemaVersion: 99, marketplaces: {} }),
  );
  await seedState(user, { alpha: marketplaceRecord("user", "alpha", root) });

  // act and assert
  await assert.rejects(
    collectMarketplaceRecordsByScope({
      cwd,
      scope: undefined,
      marketplace: "alpha",
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(
        error.message,
        `state.json at ${project.stateJsonPath} has an unsupported schema version`,
      );
      return true;
    },
  );
});

test("rejects a later user-scope state failure after reading project scope", async (t) => {
  // arrange
  const { cwd, project, root, user } = await makeTestScopes(t, "scope-fanout-later-error-");
  await seedState(project, { alpha: marketplaceRecord("project", "alpha", root) });
  await seedMalformedFile(
    user.stateJsonPath,
    JSON.stringify({ schemaVersion: 99, marketplaces: {} }),
  );

  // act and assert
  await assert.rejects(
    collectMarketplaceRecordsByScope({
      cwd,
      scope: undefined,
      marketplace: "alpha",
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(
        error.message,
        `state.json at ${user.stateJsonPath} has an unsupported schema version`,
      );
      return true;
    },
  );
});
