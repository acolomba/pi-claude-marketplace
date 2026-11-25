import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  preferHttps,
  upstreamFlagIsTrue,
} from "../../extensions/pi-claude-marketplace/shared/upstream-flag.ts";

describe("upstreamFlagIsTrue", () => {
  for (const value of ["1", "true", "yes", "on", "TRUE", " Yes ", "On\n"]) {
    test(`D-SG-15: reads ${JSON.stringify(value)} as true`, () => {
      // arrange
      const env = { CLAUDE_CODE_PLUGIN_EXAMPLE: value };

      // act
      const flag = upstreamFlagIsTrue("CLAUDE_CODE_PLUGIN_EXAMPLE", env);

      // assert
      assert.strictEqual(flag, true);
    });
  }

  for (const value of ["", "0", "false", "no", "off", "enabled", "y", "1 2"]) {
    test(`D-SG-15: reads ${JSON.stringify(value)} as false`, () => {
      // arrange
      const env = { CLAUDE_CODE_PLUGIN_EXAMPLE: value };

      // act
      const flag = upstreamFlagIsTrue("CLAUDE_CODE_PLUGIN_EXAMPLE", env);

      // assert
      assert.strictEqual(flag, false);
    });
  }

  test("D-SG-15: reads an unset variable as false", () => {
    // arrange
    const env = { CLAUDE_CODE_PLUGIN_OTHER: "1" };

    // act
    const flag = upstreamFlagIsTrue("CLAUDE_CODE_PLUGIN_EXAMPLE", env);

    // assert
    assert.strictEqual(flag, false);
  });
});

describe("preferHttps", () => {
  for (const { value, preferred } of [
    { value: "on", preferred: true },
    { value: "off", preferred: false },
  ]) {
    test(`D-SG-24: reads CLAUDE_CODE_PLUGIN_PREFER_HTTPS=${value} as ${preferred}`, () => {
      // arrange
      const env = { CLAUDE_CODE_PLUGIN_PREFER_HTTPS: value };

      // act
      const prefers = preferHttps(env);

      // assert
      assert.strictEqual(prefers, preferred);
    });
  }

  test("D-SG-24: reads no other variable", () => {
    // arrange
    const env = { CLAUDE_CODE_PLUGIN_PREFERS_HTTPS: "1", CLAUDE_CODE_REMOTE: "1" };

    // act
    const prefers = preferHttps(env);

    // assert
    assert.strictEqual(prefers, false);
  });
});
