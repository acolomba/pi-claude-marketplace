import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CLAUDE_MARKETPLACE_MARKER_KEY,
  buildMarker,
  isOwnedBy,
  keptOverrideOf,
  pluginSetFieldsOf,
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

  test("MC-5: appends a kept override as the marker's last member", () => {
    // arrange
    const keptOverride = { disabled: true, env: { TOKEN: "stub-secret" } };

    // act
    const marker = buildMarker("deploy-tools", "team-marketplace", { keptOverride });

    // assert
    assert.strictEqual(
      JSON.stringify(marker),
      '{"plugin":"deploy-tools","marketplace":"team-marketplace","keptOverride":{"disabled":true,"env":{"TOKEN":"stub-secret"}}}',
    );
    assert.strictEqual(marker.keptOverride, keptOverride);
  });

  test("MC-5: writes no keptOverride member when no override is given", () => {
    // arrange
    const expectedKeys = ["plugin", "marketplace"];

    // act
    const marker = buildMarker("deploy-tools", "team-marketplace", { keptOverride: undefined });

    // assert
    assert.deepStrictEqual(Object.keys(marker), expectedKeys);
  });

  test("ANAME-07: places the plugin-set field names after marketplace and before the kept override", () => {
    // arrange
    const parts = {
      keptOverride: { requestTimeoutMs: 5000, disabled: true },
      pluginSetFields: ["requestTimeoutMs"],
    };

    // act
    const marker = buildMarker("deploy-tools", "team-marketplace", parts);

    // assert
    assert.strictEqual(
      JSON.stringify(marker),
      '{"plugin":"deploy-tools","marketplace":"team-marketplace","pluginSetFields":["requestTimeoutMs"],"keptOverride":{"requestTimeoutMs":5000,"disabled":true}}',
    );
  });

  test("ANAME-07: writes no pluginSetFields member for an empty name list", () => {
    // act
    const marker = buildMarker("deploy-tools", "team-marketplace", { pluginSetFields: [] });

    // assert
    assert.strictEqual(
      JSON.stringify(marker),
      '{"plugin":"deploy-tools","marketplace":"team-marketplace"}',
    );
  });
});

describe("pluginSetFieldsOf", () => {
  test("ANAME-07: returns the names an owned entry's marker lists", () => {
    // arrange
    const server = {
      command: "node",
      requestTimeoutMs: 60000,
      _piClaudeMarketplace: {
        plugin: "search-tools",
        marketplace: "official",
        pluginSetFields: ["requestTimeoutMs"],
      },
    };

    // act
    const fields = pluginSetFieldsOf(server);

    // assert
    assert.deepStrictEqual(fields, ["requestTimeoutMs"]);
  });

  for (const { description, server } of [
    {
      description: "a marker without pluginSetFields",
      server: { _piClaudeMarketplace: { plugin: "search-tools", marketplace: "official" } },
    },
    {
      description: "a non-array pluginSetFields",
      server: {
        _piClaudeMarketplace: {
          plugin: "search-tools",
          marketplace: "official",
          pluginSetFields: "requestTimeoutMs",
        },
      },
    },
    {
      description: "a pluginSetFields array holding a number",
      server: {
        _piClaudeMarketplace: {
          plugin: "search-tools",
          marketplace: "official",
          pluginSetFields: ["requestTimeoutMs", 7],
        },
      },
    },
    {
      description: "an inherited pluginSetFields",
      server: {
        _piClaudeMarketplace: Object.assign(
          Object.create({ pluginSetFields: ["requestTimeoutMs"] }),
          { plugin: "search-tools", marketplace: "official" },
        ) as unknown,
      },
    },
    { description: "an entry without a marker", server: { requestTimeoutMs: 60000 } },
  ] satisfies ReadonlyArray<{ description: string; server: unknown }>) {
    test(`ANAME-07: returns no names for ${description}`, () => {
      // act
      const fields = pluginSetFieldsOf(server);

      // assert
      assert.deepStrictEqual(fields, []);
    });
  }

  test("ANAME-07: a malformed pluginSetFields leaves the marker's kept override readable", () => {
    // arrange
    const server = {
      _piClaudeMarketplace: {
        plugin: "search-tools",
        marketplace: "official",
        pluginSetFields: [7],
        keptOverride: { disabled: true },
      },
    };

    // act
    const parsed = {
      fields: pluginSetFieldsOf(server),
      keptOverride: keptOverrideOf(server),
      owned: isOwnedBy(server, "search-tools", "official"),
    };

    // assert
    assert.deepStrictEqual(parsed, {
      fields: [],
      keptOverride: { disabled: true },
      owned: true,
    });
  });
});

describe("keptOverrideOf", () => {
  test("AFILE-06: returns the override an owned entry's marker keeps", () => {
    // arrange
    const keptOverride = { disabled: true, env: { TOKEN: "stub-secret" } };
    const server = {
      command: "node",
      _piClaudeMarketplace: { plugin: "search-tools", marketplace: "official", keptOverride },
    };

    // act
    const override = keptOverrideOf(server);

    // assert
    assert.strictEqual(override, keptOverride);
    assert.deepStrictEqual(override, { disabled: true, env: { TOKEN: "stub-secret" } });
  });

  for (const { description, marker } of [
    {
      description: "no keptOverride member",
      marker: { plugin: "search-tools", marketplace: "official" },
    },
    {
      description: "a null keptOverride",
      marker: { plugin: "search-tools", marketplace: "official", keptOverride: null },
    },
    {
      description: "an array keptOverride",
      marker: {
        plugin: "search-tools",
        marketplace: "official",
        keptOverride: [{ disabled: true }],
      },
    },
    {
      description: "a string keptOverride",
      marker: { plugin: "search-tools", marketplace: "official", keptOverride: "disabled" },
    },
    {
      description: "an inherited keptOverride",
      marker: Object.assign(Object.create({ keptOverride: { disabled: true } }), {
        plugin: "search-tools",
        marketplace: "official",
      }) as unknown,
    },
    {
      description: "a marker without plugin",
      marker: { marketplace: "official", keptOverride: { disabled: true } },
    },
  ] satisfies ReadonlyArray<{ description: string; marker: unknown }>) {
    test(`AFILE-06: returns undefined for ${description}`, () => {
      // arrange
      const server = { command: "node", _piClaudeMarketplace: marker };

      // act
      const override = keptOverrideOf(server);

      // assert
      assert.strictEqual(override, undefined);
    });
  }
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

  for (const { description, keptOverride } of [
    { description: "an object", keptOverride: { disabled: true } },
    { description: "a string", keptOverride: "disabled" },
  ] satisfies ReadonlyArray<{ description: string; keptOverride: unknown }>) {
    test(`MC-5: a keptOverride member holding ${description} leaves ownership unchanged`, () => {
      // arrange
      const server = {
        command: "node",
        _piClaudeMarketplace: {
          plugin: "search-tools",
          marketplace: "official-marketplace",
          keptOverride,
        },
      };

      // act
      const ownership = {
        owner: isOwnedBy(server, "search-tools", "official-marketplace"),
        otherPlugin: isOwnedBy(server, "deploy-tools", "official-marketplace"),
      };

      // assert
      assert.deepStrictEqual(ownership, { owner: true, otherPlugin: false });
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
