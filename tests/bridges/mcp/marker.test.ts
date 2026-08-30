import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CLAUDE_MARKETPLACE_MARKER_KEY,
  buildMarker,
  readMarker,
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

describe("readMarker", () => {
  test("returns the complete marker from an owned per-server entry", () => {
    // arrange
    const server = {
      command: "node",
      args: ["server.mjs"],
      _piClaudeMarketplace: {
        plugin: "search-tools",
        marketplace: "official-marketplace",
      },
    };
    const expectedMarker = {
      plugin: "search-tools",
      marketplace: "official-marketplace",
    };

    // act
    const marker = readMarker(server);

    // assert
    assert.deepStrictEqual(marker, expectedMarker);
  });
});
