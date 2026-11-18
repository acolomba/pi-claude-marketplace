import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CLAUDE_MARKETPLACE_MARKER_KEY,
  buildMarker,
  defaultFieldsOf,
  malformedMarkerMember,
  isOwnedBy,
  keptOverrideOf,
  markerObjectOf,
  markerOwnerOf,
  pluginSetFieldsOf,
  withheldOf,
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

  test("D-PG1-13: writes default fields after plugin-set fields and before the kept override", () => {
    // arrange
    const keptOverride = { disabled: true };

    // act
    const marker = buildMarker("deploy-tools", "team-marketplace", {
      pluginSetFields: ["disabled"],
      defaultFields: { requestTimeoutMs: 1800000 },
      keptOverride,
    });

    // assert
    assert.strictEqual(
      JSON.stringify(marker),
      '{"plugin":"deploy-tools","marketplace":"team-marketplace","pluginSetFields":["disabled"],"defaultFields":{"requestTimeoutMs":1800000},"keptOverride":{"disabled":true}}',
    );
  });

  test("D-PG9-03: writes string and boolean defaults after plugin-set fields and before the kept override", () => {
    // arrange
    const keptOverride = { disabled: true };

    // act
    const marker = buildMarker("deploy-tools", "team-marketplace", {
      pluginSetFields: ["disabled"],
      defaultFields: { requestTimeoutMs: 1800000, lifecycle: "lazy-keep-alive", openUi: false },
      keptOverride,
    });

    // assert
    assert.strictEqual(
      JSON.stringify(marker),
      '{"plugin":"deploy-tools","marketplace":"team-marketplace","pluginSetFields":["disabled"],"defaultFields":{"requestTimeoutMs":1800000,"lifecycle":"lazy-keep-alive","openUi":false},"keptOverride":{"disabled":true}}',
    );
  });

  test("D-PG1-13: omits default fields when the record is empty", () => {
    // act
    const marker = buildMarker("deploy-tools", "team-marketplace", { defaultFields: {} });

    // assert
    assert.deepStrictEqual(marker, { plugin: "deploy-tools", marketplace: "team-marketplace" });
  });
});

describe("defaultFieldsOf", () => {
  test("D-PG1-13: reads the default values of a well-formed marker", () => {
    // arrange
    const fields = { requestTimeoutMs: 1800000 };
    const entry = {
      _piClaudeMarketplace: {
        plugin: "search-tools",
        marketplace: "official",
        defaultFields: fields,
      },
    };

    // act
    const defaults = defaultFieldsOf(entry);

    // assert
    assert.strictEqual(defaults, fields);
  });

  for (const { description, fields } of [
    { description: "a string default", fields: { lifecycle: "lazy-keep-alive" } },
    { description: "a boolean default", fields: { openUi: false } },
    {
      description: "number, string, and boolean defaults together",
      fields: { requestTimeoutMs: 1800000, lifecycle: "lazy-keep-alive", openUi: false },
    },
    { description: "a string where a number would be", fields: { requestTimeoutMs: "1800000" } },
  ] satisfies ReadonlyArray<{ description: string; fields: Record<string, unknown> }>) {
    test(`D-PG9-03: reads ${description} of a well-formed marker`, () => {
      // arrange
      const entry = {
        _piClaudeMarketplace: {
          plugin: "search-tools",
          marketplace: "official",
          defaultFields: fields,
        },
      };

      // act
      const defaults = defaultFieldsOf(entry);

      // assert
      assert.strictEqual(defaults, fields);
    });
  }

  for (const { description, defaultFields } of [
    { description: "a null value", defaultFields: { requestTimeoutMs: 1800000, openUi: null } },
    {
      description: "an object value",
      defaultFields: { requestTimeoutMs: 1800000, lifecycle: { mode: "lazy" } },
    },
    { description: "an array value", defaultFields: { requestTimeoutMs: [1800000] } },
    {
      description: "an own __proto__ key holding an object",
      defaultFields: JSON.parse('{"__proto__":{"requestTimeoutMs":1800000}}') as unknown,
    },
  ] satisfies ReadonlyArray<{ description: string; defaultFields: unknown }>) {
    test(`D-PG9-03: returns no defaults for a member holding ${description}`, () => {
      // arrange
      const entry = {
        _piClaudeMarketplace: { plugin: "search-tools", marketplace: "official", defaultFields },
      };

      // act
      const defaults = defaultFieldsOf(entry);

      // assert
      assert.deepStrictEqual(defaults, {});
    });
  }

  for (const { description, marker } of [
    {
      description: "an absent member",
      marker: { plugin: "search-tools", marketplace: "official" },
    },
    {
      description: "a null member",
      marker: { plugin: "search-tools", marketplace: "official", defaultFields: null },
    },
    {
      description: "an array member",
      marker: { plugin: "search-tools", marketplace: "official", defaultFields: [1800000] },
    },
    {
      description: "a string member",
      marker: {
        plugin: "search-tools",
        marketplace: "official",
        defaultFields: "requestTimeoutMs",
      },
    },
    {
      description: "an inherited member",
      marker: Object.assign(Object.create({ defaultFields: { requestTimeoutMs: 1800000 } }), {
        plugin: "search-tools",
        marketplace: "official",
      }) as unknown,
    },
    {
      description: "a malformed marker",
      marker: { marketplace: "official", defaultFields: { requestTimeoutMs: 1800000 } },
    },
  ] satisfies ReadonlyArray<{ description: string; marker: unknown }>) {
    test(`D-PG1-13: returns no defaults for ${description}`, () => {
      // arrange
      const entry = { _piClaudeMarketplace: marker };

      // act
      const defaults = defaultFieldsOf(entry);

      // assert
      assert.deepStrictEqual(defaults, {});
    });
  }
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

describe("malformedMarkerMember", () => {
  for (const { description, members, member } of [
    {
      description: "a pluginSetFields that is not an array",
      members: { pluginSetFields: "tasks" },
      member: "pluginSetFields",
    },
    {
      description: "a pluginSetFields with a number",
      members: { pluginSetFields: ["tasks", 1] },
      member: "pluginSetFields",
    },
    {
      description: "a defaultFields that is an array",
      members: { defaultFields: [] },
      member: "defaultFields",
    },
    {
      description: "a defaultFields member that is an array",
      members: { defaultFields: { requestTimeoutMs: 1800000, lifecycle: ["lazy-keep-alive"] } },
      member: "defaultFields",
    },
    {
      description: "a keptOverride that is null",
      members: { keptOverride: null },
      member: "keptOverride",
    },
    {
      description: "a withheld that is an array",
      members: { withheld: [] },
      member: "withheld",
    },
    {
      description: "a malformed defaultFields and keptOverride, the first of them",
      members: { keptOverride: null, defaultFields: [] },
      member: "defaultFields",
    },
  ] satisfies ReadonlyArray<{
    description: string;
    members: Record<string, unknown>;
    member: string;
  }>) {
    test(`D-PG9-03: names ${description}`, () => {
      // arrange
      const entry = {
        command: "plugin-command",
        _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog", ...members },
      };

      // act
      const malformed = malformedMarkerMember(entry);

      // assert
      assert.strictEqual(malformed, member);
    });
  }

  for (const { description, entry } of [
    {
      description: "a marker whose members this extension writes",
      entry: {
        _piClaudeMarketplace: {
          plugin: "acme",
          marketplace: "catalog",
          pluginSetFields: ["requestTimeoutMs"],
          defaultFields: { lifecycle: "lazy-keep-alive" },
          keptOverride: { disabled: true },
        },
      },
    },
    {
      description: "a marker with no member past its owner",
      entry: { _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" } },
    },
    {
      description: "a marker that names no owner",
      entry: { _piClaudeMarketplace: { plugin: 1, marketplace: "catalog", defaultFields: [] } },
    },
    { description: "an entry with no marker", entry: { command: "plugin-command" } },
  ] satisfies ReadonlyArray<{ description: string; entry: unknown }>) {
    test(`D-PG9-03: names no member of ${description}`, () => {
      // act
      const malformed = malformedMarkerMember(entry);

      // assert
      assert.strictEqual(malformed, undefined);
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

describe("markerOwnerOf", () => {
  test("AMIG-01: returns the plugin and marketplace of a well-formed marker", () => {
    // arrange
    const server = {
      command: "node",
      _piClaudeMarketplace: {
        plugin: "hello",
        marketplace: "mp",
        pluginSetFields: ["env"],
        keptOverride: { disabled: true },
      },
    };

    // act
    const owner = markerOwnerOf(server);

    // assert
    assert.deepStrictEqual(owner, { plugin: "hello", marketplace: "mp" });
  });

  for (const { description, server } of [
    { description: "a primitive", server: "srv" as unknown },
    {
      description: "an array",
      server: [{ _piClaudeMarketplace: { plugin: "a", marketplace: "b" } }],
    },
    { description: "an entry with no marker", server: { command: "node" } },
    { description: "a non-object marker", server: { _piClaudeMarketplace: "hello@mp" } },
    {
      description: "a marker with a non-string plugin",
      server: { _piClaudeMarketplace: { plugin: 7, marketplace: "mp" } },
    },
    {
      description: "a marker with inherited identity fields",
      server: {
        _piClaudeMarketplace: Object.create({ plugin: "hello", marketplace: "mp" }) as unknown,
      },
    },
  ]) {
    test(`AMIG-01: returns no owner for ${description}`, () => {
      // arrange
      const expectedOwner = undefined;

      // act
      const owner = markerOwnerOf(server);

      // assert
      assert.strictEqual(owner, expectedOwner);
    });
  }
});

describe("withheldOf", () => {
  test("D-PG10-25: returns the fields an owned entry's marker keeps while the load withholds it", () => {
    // arrange
    const server = {
      command: "node",
      disabled: true,
      _piClaudeMarketplace: {
        plugin: "acme",
        marketplace: "catalog",
        withheld: { disabled: false },
      },
    };

    // act
    const withheld = withheldOf(server);

    // assert
    assert.deepStrictEqual(withheld, { disabled: false });
  });

  for (const { description, marker } of [
    { description: "no withheld member", marker: { plugin: "acme", marketplace: "catalog" } },
    {
      description: "a withheld that is not an object",
      marker: { plugin: "acme", marketplace: "catalog", withheld: true },
    },
  ]) {
    test(`D-PG10-25: returns nothing for a marker with ${description}`, () => {
      // act
      const withheld = withheldOf({ command: "node", _piClaudeMarketplace: marker });

      // assert
      assert.strictEqual(withheld, undefined);
    });
  }
});

describe("markerObjectOf", () => {
  test("D-PG10-25: returns the marker object with every member it holds", () => {
    // arrange
    const marker = { plugin: "acme", marketplace: "catalog", extra: 1 };

    // act
    const object = markerObjectOf({ command: "node", _piClaudeMarketplace: marker });

    // assert
    assert.strictEqual(object, marker);
  });

  test("D-PG10-25: returns nothing for a marker that names no owner", () => {
    // act
    const object = markerObjectOf({ _piClaudeMarketplace: { plugin: 1, marketplace: "catalog" } });

    // assert
    assert.strictEqual(object, undefined);
  });
});
