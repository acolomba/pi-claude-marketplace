import assert from "node:assert/strict";
import test from "node:test";

import { commandNamespaceSeparator } from "../../extensions/pi-claude-marketplace/platform/os.ts";

import { setCasePlatform } from "./case-platform.ts";

for (const { platform, expectedSeparator } of [
  { platform: "win32", expectedSeparator: "-" },
  { platform: "darwin", expectedSeparator: ":" },
  { platform: "linux", expectedSeparator: ":" },
] satisfies { platform: NodeJS.Platform; expectedSeparator: string }[]) {
  test(`separates a command namespace with ${JSON.stringify(expectedSeparator)} on ${platform}`, (t) => {
    // arrange
    setCasePlatform(t, platform);

    // act
    const separator = commandNamespaceSeparator();

    // assert
    assert.strictEqual(separator, expectedSeparator);
  });
}
