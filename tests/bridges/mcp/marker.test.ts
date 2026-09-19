import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CLAUDE_MARKETPLACE_MARKER_KEY,
  buildMarker,
  isOwnedBy,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/marker.ts";

describe("CLAUDE_MARKETPLACE_MARKER_KEY", () => {
  test("keeps the exact per-server ownership key", () => {
    // arrange
    const expectedMarkerKey = "_piClaudeMarketplace";

    // act
    const markerKey = CLAUDE_MARKETPLACE_MARKER_KEY;

    // assert
    assert.strictEqual(markerKey, expectedMarkerKey);
  });
});

describe("buildMarker", () => {
  test("returns the complete plugin and marketplace identity", () => {
    // arrange
    const plugin = "deploy-tools";
    const marketplace = "team-marketplace";
    const expectedMarker = {
      plugin: "deploy-tools",
      marketplace: "team-marketplace",
    };

    // act
    const marker = buildMarker(plugin, marketplace);

    // assert
    assert.deepStrictEqual(marker, expectedMarker);
  });
});

describe("isOwnedBy", () => {
  test("recognizes only the complete identity of an owned per-server entry", () => {
    // arrange
    const server = {
      command: "node",
      args: ["server.mjs"],
      _piClaudeMarketplace: {
        plugin: "search-tools",
        marketplace: "official-marketplace",
      },
    };
    // act
    const ownership = {
      exact: isOwnedBy(server, "search-tools", "official-marketplace"),
      differentPlugin: isOwnedBy(server, "deploy-tools", "official-marketplace"),
      differentMarketplace: isOwnedBy(server, "search-tools", "team-marketplace"),
      reversed: isOwnedBy(server, "official-marketplace", "search-tools"),
    };

    // assert
    assert.deepStrictEqual(ownership, {
      exact: true,
      differentPlugin: false,
      differentMarketplace: false,
      reversed: false,
    });
  });

  for (const { description, server } of [
    { description: "null", server: null },
    { description: "an array", server: [] },
    { description: "a primitive", server: "mcp-server" },
    { description: "a server without the marker key", server: { command: "node" } },
    { description: "a null marker", server: { _piClaudeMarketplace: null } },
    { description: "an array marker", server: { _piClaudeMarketplace: [] } },
    { description: "a primitive marker", server: { _piClaudeMarketplace: "owned" } },
    {
      description: "a marker without plugin",
      server: { _piClaudeMarketplace: { marketplace: "official-marketplace" } },
    },
    {
      description: "a marker without marketplace",
      server: { _piClaudeMarketplace: { plugin: "search-tools" } },
    },
    {
      description: "a marker with a non-string plugin",
      server: {
        _piClaudeMarketplace: { plugin: 7, marketplace: "official-marketplace" },
      },
    },
    {
      description: "a marker with a non-string marketplace",
      server: {
        _piClaudeMarketplace: { plugin: "search-tools", marketplace: false },
      },
    },
  ] satisfies ReadonlyArray<{ description: string; server: unknown }>) {
    test(`refuses ownership for ${description}`, () => {
      // arrange
      const expectedOwnership = false;

      // act
      const owned = isOwnedBy(server, "search-tools", "official-marketplace");

      // assert
      assert.strictEqual(owned, expectedOwnership);
    });
  }

  test("refuses ownership when the marker key is inherited", () => {
    // arrange
    const server: unknown = Object.create({
      _piClaudeMarketplace: {
        plugin: "search-tools",
        marketplace: "official-marketplace",
      },
    });
    const expectedOwnership = false;

    // act
    const owned = isOwnedBy(server, "search-tools", "official-marketplace");

    // assert
    assert.strictEqual(owned, expectedOwnership);
  });

  for (const { description, marker } of [
    {
      description: "plugin",
      marker: Object.assign(Object.create({ plugin: "search-tools" }), {
        marketplace: "official-marketplace",
      }) as unknown,
    },
    {
      description: "marketplace",
      marker: Object.assign(Object.create({ marketplace: "official-marketplace" }), {
        plugin: "search-tools",
      }) as unknown,
    },
  ] satisfies ReadonlyArray<{ description: string; marker: unknown }>) {
    test(`refuses ownership when the marker ${description} field is inherited`, () => {
      // arrange
      const server = { _piClaudeMarketplace: marker };
      const expectedOwnership = false;

      // act
      const owned = isOwnedBy(server, "search-tools", "official-marketplace");

      // assert
      assert.strictEqual(owned, expectedOwnership);
    });
  }

  test("returns true for the exact plugin and marketplace owner", () => {
    // arrange
    const server = {
      _piClaudeMarketplace: {
        plugin: "search-tools",
        marketplace: "official-marketplace",
      },
    };
    const plugin = "search-tools";
    const marketplace = "official-marketplace";
    const expectedOwnership = true;

    // act
    const owned = isOwnedBy(server, plugin, marketplace);

    // assert
    assert.strictEqual(owned, expectedOwnership);
  });

  for (const { description, server, plugin, marketplace } of [
    {
      description: "a different plugin",
      server: {
        _piClaudeMarketplace: {
          plugin: "search-tools",
          marketplace: "official-marketplace",
        },
      },
      plugin: "deploy-tools",
      marketplace: "official-marketplace",
    },
    {
      description: "a different marketplace",
      server: {
        _piClaudeMarketplace: {
          plugin: "search-tools",
          marketplace: "official-marketplace",
        },
      },
      plugin: "search-tools",
      marketplace: "team-marketplace",
    },
    {
      description: "a missing marker key",
      server: { command: "node" },
      plugin: "search-tools",
      marketplace: "official-marketplace",
    },
    {
      description: "a partial marker",
      server: { _piClaudeMarketplace: { plugin: "search-tools" } },
      plugin: "search-tools",
      marketplace: "official-marketplace",
    },
    {
      description: "an array",
      server: [],
      plugin: "search-tools",
      marketplace: "official-marketplace",
    },
    {
      description: "null",
      server: null,
      plugin: "search-tools",
      marketplace: "official-marketplace",
    },
    {
      description: "a primitive",
      server: 17,
      plugin: "search-tools",
      marketplace: "official-marketplace",
    },
    {
      description: "a malformed field type",
      server: {
        _piClaudeMarketplace: {
          plugin: "search-tools",
          marketplace: 17,
        },
      },
      plugin: "search-tools",
      marketplace: "official-marketplace",
    },
  ] satisfies ReadonlyArray<{
    description: string;
    server: unknown;
    plugin: string;
    marketplace: string;
  }>) {
    test(`returns false for ${description}`, () => {
      // arrange
      const expectedOwnership = false;

      // act
      const owned = isOwnedBy(server, plugin, marketplace);

      // assert
      assert.strictEqual(owned, expectedOwnership);
    });
  }

  test("returns false when the marker key is inherited", () => {
    // arrange
    const server: unknown = Object.create({
      _piClaudeMarketplace: {
        plugin: "search-tools",
        marketplace: "official-marketplace",
      },
    });
    const plugin = "search-tools";
    const marketplace = "official-marketplace";
    const expectedOwnership = false;

    // act
    const owned = isOwnedBy(server, plugin, marketplace);

    // assert
    assert.strictEqual(owned, expectedOwnership);
  });

  test("returns false when marker fields are inherited", () => {
    // arrange
    const marker: unknown = Object.create({
      plugin: "search-tools",
      marketplace: "official-marketplace",
    });
    const server = { _piClaudeMarketplace: marker };
    const plugin = "search-tools";
    const marketplace = "official-marketplace";
    const expectedOwnership = false;

    // act
    const owned = isOwnedBy(server, plugin, marketplace);

    // assert
    assert.strictEqual(owned, expectedOwnership);
  });
});
