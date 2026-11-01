import assert from "node:assert/strict";
import { test } from "node:test";

import { withCommandRecord } from "../../../extensions/pi-claude-marketplace/bridges/commands/command-record.ts";

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
