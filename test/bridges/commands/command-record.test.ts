import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  readCommandRecord,
  withCommandRecord,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/command-record.ts";

describe("withCommandRecord", () => {
  test("D-CF3-06 adds the install-time record as the last frontmatter key", () => {
    // arrange
    const frontmatter = { description: "Greets." };

    // act
    const recorded = withCommandRecord(frontmatter, { pluginRoot: "/p", pluginData: "/d" });

    // assert
    assert.deepStrictEqual(
      { frontmatter: recorded, keys: Object.keys(recorded) },
      {
        frontmatter: {
          description: "Greets.",
          "pi-claude-marketplace": { pluginRoot: "/p", pluginData: "/d" },
        },
        keys: ["description", "pi-claude-marketplace"],
      },
    );
  });

  test("D-CF3-06 replaces an author value under the record key instead of merging it", () => {
    // arrange
    const frontmatter = {
      "pi-claude-marketplace": { pluginRoot: "/author", extra: "kept?" },
      description: "Greets.",
    };

    // act
    const recorded = withCommandRecord(frontmatter, { pluginRoot: "/p", pluginData: "/d" });

    // assert
    assert.deepStrictEqual(
      { frontmatter: recorded, keys: Object.keys(recorded) },
      {
        frontmatter: {
          description: "Greets.",
          "pi-claude-marketplace": { pluginRoot: "/p", pluginData: "/d" },
        },
        keys: ["description", "pi-claude-marketplace"],
      },
    );
  });
});

describe("readCommandRecord", () => {
  test("D-CF3-06 reads the plugin root and data install stored", () => {
    // arrange
    const frontmatter = {
      description: "Greets.",
      "pi-claude-marketplace": { pluginRoot: "/p", pluginData: "/d" },
    };

    // act
    const record = readCommandRecord(frontmatter);

    // assert
    assert.deepStrictEqual(record, { pluginRoot: "/p", pluginData: "/d" });
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
