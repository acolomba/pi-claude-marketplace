import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import {
  type ResolveContext,
  type ResolvedPlugin,
  requireInstallable,
  requirePartialInstallable,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";
import { PluginShapeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

const marketplaceRoot = "/abs/marketplace";
const localRoot = path.resolve(marketplaceRoot, "./local");

function resolveContext(
  files: Record<string, "dir" | "file" | { contents: string }>,
): ResolveContext {
  return {
    marketplaceRoot,
    statKind(filePath) {
      const entry = files[filePath];

      if (entry === undefined) {
        return Promise.resolve(null);
      }

      return Promise.resolve(entry === "dir" ? "dir" : "file");
    },
    readFileText(filePath) {
      const entry = files[filePath];

      if (typeof entry === "object") {
        return Promise.resolve(entry.contents);
      }

      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    },
  };
}

function pluginEntry(overrides: Record<string, unknown> = {}): PluginEntry {
  return { name: "p1", source: "./local", ...overrides };
}

test("resolveStrict returns a complete installable result with a true materializability flag", async () => {
  // arrange
  const context = resolveContext({ [localRoot]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry(), context);

  // assert
  assert.deepStrictEqual(resolvedPlugin, {
    state: "installable",
    installable: true,
    name: "p1",
    pluginRoot: localRoot,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
    defaultEnabled: true,
  });
});

test("resolveStrict returns a complete partially-available result with a true materializability flag", async () => {
  // arrange
  const context = resolveContext({ [localRoot]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ themes: ["dark"] }), context);

  // assert
  assert.deepStrictEqual(resolvedPlugin, {
    state: "partially-available",
    installable: true,
    name: "p1",
    pluginRoot: localRoot,
    supported: [],
    unsupported: ["themes"],
    notes: ["contains themes"],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
    defaultEnabled: true,
  });
});

test("resolveStrict returns the minimal unavailable result with a false materializability flag", async () => {
  // arrange
  const context = resolveContext({});

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./missing" }), context);

  // assert
  assert.deepStrictEqual(resolvedPlugin, {
    state: "unavailable",
    installable: false,
    name: "p1",
    notes: ["source dir does not exist: /abs/marketplace/missing"],
  });
});

test("requirePartialInstallable admits both true arms and exposes pluginRoot", async () => {
  // arrange
  const context = resolveContext({ [localRoot]: "dir" });
  const installablePlugin: ResolvedPlugin = await resolveStrict(pluginEntry(), context);
  const partialPlugin: ResolvedPlugin = await resolveStrict(
    pluginEntry({ themes: ["dark"] }),
    context,
  );

  // act
  requirePartialInstallable(installablePlugin);
  requirePartialInstallable(partialPlugin);

  // assert
  assert.deepStrictEqual(
    [installablePlugin.pluginRoot, partialPlugin.pluginRoot],
    [localRoot, localRoot],
  );
});

test("requirePartialInstallable rejects the false arm with a typed install error", async () => {
  // arrange
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./missing" }),
    resolveContext({}),
  );

  // act & assert
  assert.throws(
    () => requirePartialInstallable(resolvedPlugin),
    (error: unknown) => {
      assert.ok(error instanceof PluginShapeError);
      assert.deepStrictEqual(error.shape, {
        kind: "not-installable",
        plugin: "p1",
        reasons: ["source dir does not exist: /abs/marketplace/missing"],
        partialable: false,
      });
      return true;
    },
  );
});

test("requireInstallable admits the installable true arm", async () => {
  // arrange
  const resolvedPlugin: ResolvedPlugin = await resolveStrict(
    pluginEntry(),
    resolveContext({ [localRoot]: "dir" }),
  );

  // act
  requireInstallable(resolvedPlugin);

  // assert
  assert.strictEqual(resolvedPlugin.pluginRoot, localRoot);
});

test("requireInstallable rejects the partial true arm with its secondary detail", async () => {
  // arrange
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ themes: ["dark"] }),
    resolveContext({ [localRoot]: "dir" }),
  );

  // act & assert
  assert.throws(
    () => requireInstallable(resolvedPlugin),
    (error: unknown) => {
      assert.ok(error instanceof PluginShapeError);
      assert.deepStrictEqual(error.shape, {
        kind: "not-installable",
        plugin: "p1",
        reasons: ["contains themes"],
        partialable: true,
        unsupportedKinds: ["themes"],
      });
      return true;
    },
  );
});

test("requireInstallable rejects the unavailable false arm before secondary state detail", async () => {
  // arrange
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./missing" }),
    resolveContext({}),
  );

  // act & assert
  assert.throws(
    () => requireInstallable(resolvedPlugin, "update"),
    (error: unknown) => {
      assert.ok(error instanceof PluginShapeError);
      assert.deepStrictEqual(error.shape, {
        kind: "no-longer-installable",
        plugin: "p1",
        reasons: ["source dir does not exist: /abs/marketplace/missing"],
        partialable: false,
        unsupportedKinds: [],
      });
      return true;
    },
  );
});
