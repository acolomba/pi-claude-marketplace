import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  readCommandRecord,
  withCommandRecord,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/command-record.ts";

describe("withCommandRecord", () => {
  test("D-CF3-06 / D-PG11-01 adds the install-time record as the last frontmatter key, its members in a fixed order", () => {
    // arrange
    const frontmatter = { description: "Greets." };

    // act
    const recorded = withCommandRecord(frontmatter, {
      pluginRoot: "/p",
      pluginData: "/d",
      claudeName: "demo:demo-lint",
    });

    // assert
    assert.deepStrictEqual(
      {
        frontmatter: recorded,
        keys: Object.keys(recorded),
        recordKeys: Object.keys(recorded["pi-claude-marketplace"] as object),
      },
      {
        frontmatter: {
          description: "Greets.",
          "pi-claude-marketplace": {
            pluginRoot: "/p",
            pluginData: "/d",
            claudeName: "demo:demo-lint",
          },
        },
        keys: ["description", "pi-claude-marketplace"],
        recordKeys: ["pluginRoot", "pluginData", "claudeName"],
      },
    );
  });

  test("D-CF3-06 / D-PG11-01 replaces an author value under the record key, a planted Claude Code name included, instead of merging it", () => {
    // arrange
    const frontmatter = {
      "pi-claude-marketplace": { claudeName: "other:lint", pluginRoot: "/author", extra: "kept?" },
      description: "Greets.",
    };

    // act
    const recorded = withCommandRecord(frontmatter, {
      pluginRoot: "/p",
      pluginData: "/d",
      claudeName: "demo:demo-lint",
    });

    // assert
    assert.deepStrictEqual(
      {
        frontmatter: recorded,
        keys: Object.keys(recorded),
        recordKeys: Object.keys(recorded["pi-claude-marketplace"] as object),
      },
      {
        frontmatter: {
          description: "Greets.",
          "pi-claude-marketplace": {
            pluginRoot: "/p",
            pluginData: "/d",
            claudeName: "demo:demo-lint",
          },
        },
        keys: ["description", "pi-claude-marketplace"],
        recordKeys: ["pluginRoot", "pluginData", "claudeName"],
      },
    );
  });
});

describe("readCommandRecord", () => {
  test("D-CF3-06 / D-PG11-01 reads the plugin root and data of a record staged without a Claude Code name", () => {
    // arrange
    const frontmatter = {
      description: "Greets.",
      "pi-claude-marketplace": { pluginRoot: "/p", pluginData: "/d" },
    };

    // act
    const record = readCommandRecord(frontmatter);

    // assert
    assert.deepStrictEqual(record, { pluginRoot: "/p", pluginData: "/d", claudeName: undefined });
  });

  test("D-PG11-01 reads the Claude Code name install stored", () => {
    // arrange
    const frontmatter = {
      description: "Lints.",
      "pi-claude-marketplace": { pluginRoot: "/p", pluginData: "/d", claudeName: "demo:demo-lint" },
    };

    // act
    const record = readCommandRecord(frontmatter);

    // assert
    assert.deepStrictEqual(record, {
      pluginRoot: "/p",
      pluginData: "/d",
      claudeName: "demo:demo-lint",
    });
  });

  for (const { title, stored } of [
    { title: "a missing record key", stored: {} },
    { title: "a string under the record key", stored: { "pi-claude-marketplace": "/p" } },
    { title: "a list under the record key", stored: { "pi-claude-marketplace": ["/p", "/d"] } },
    {
      title: "a record without its data member",
      stored: { "pi-claude-marketplace": { pluginRoot: "/p" } },
    },
    {
      title: "a record whose data member is not a string",
      stored: { "pi-claude-marketplace": { pluginRoot: "/p", pluginData: 3 } },
    },
    {
      title: "a record whose Claude Code name is not a string",
      stored: { "pi-claude-marketplace": { pluginRoot: "/p", pluginData: "/d", claudeName: 3 } },
    },
    {
      title: "a record with a member install never writes",
      stored: { "pi-claude-marketplace": { pluginRoot: "/p", pluginData: "/d", names: [] } },
    },
  ]) {
    test(`D-CF3-06 reads no record from ${title}`, () => {
      // arrange
      const frontmatter: Readonly<Record<string, unknown>> = { description: "Greets.", ...stored };

      // act
      const record = readCommandRecord(frontmatter);

      // assert
      assert.strictEqual(record, undefined);
    });
  }
});
