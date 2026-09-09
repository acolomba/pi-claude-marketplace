import assert from "node:assert/strict";
import test from "node:test";

import type * as PluginResolverOwner from "../../extensions/pi-claude-marketplace/domain/plugin-resolver.ts";

type OwnerShape = typeof PluginResolverOwner;

test("resolves a local plugin through the public composition owner", async () => {
  // arrange
  let owner: OwnerShape | undefined;

  // act & assert
  await assert.doesNotReject(async () => {
    owner = await import("../../extensions/pi-claude-marketplace/domain/plugin-resolver.ts");
  }, "plugin-resolver.ts is absent");
  assert.ok(owner !== undefined);
  const resolvedPlugin = await owner.resolveStrict(
    { name: "alpha", source: "./alpha" },
    {
      marketplaceRoot: "/marketplace",
      statKind: (candidate) =>
        Promise.resolve(candidate === "/marketplace/alpha" ? "dir" : null),
    },
  );

  // assert
  assert.deepStrictEqual(resolvedPlugin, {
    state: "installable",
    installable: true,
    name: "alpha",
    pluginRoot: "/marketplace/alpha",
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
    defaultEnabled: true,
  });
});
