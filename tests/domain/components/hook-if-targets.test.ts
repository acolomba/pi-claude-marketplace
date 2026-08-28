import assert from "node:assert/strict";
import test from "node:test";

import { IF_PREFIX_TARGETS } from "../../../extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts";

test("maps every permission prefix to its complete Pi target", () => {
  // arrange
  const expectedTargets = {
    Bash: {
      piEvents: new Set(["bash"]),
      extractTarget: "command",
    },
    Read: {
      piEvents: new Set(["read", "grep", "find", "ls"]),
      extractTarget: "path",
    },
    Edit: {
      piEvents: new Set(["edit", "write"]),
      extractTarget: "path",
    },
    Write: {
      piEvents: new Set(["write"]),
      extractTarget: "path",
    },
  };

  // act
  const targets = IF_PREFIX_TARGETS;

  // assert
  assert.deepStrictEqual(targets, expectedTargets);
});

test("publishes permission prefixes in matching precedence", () => {
  // arrange
  const expectedPrefixes = ["Bash", "Read", "Edit", "Write"];

  // act
  const prefixes = Object.keys(IF_PREFIX_TARGETS);

  // assert
  assert.deepStrictEqual(prefixes, expectedPrefixes);
});
