import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify } from "strong-mock";

import { createBuiltinMcpStatusReader } from "../../extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts";

import type {
  PiInventory,
  PiMcpRegistry,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// A strict Pi mock with no expectations fails on the first read, so each case
// proves that neither building the reader nor a lookup reads Pi (MSEL-01: the
// factory builds the reader before every extension has loaded).
for (const serverName of ["plugin_alpha_api", "plugin_alpha_my-api", ""]) {
  test(`BLT-05 / MSEL-01: the built-in status reader answers no-snapshot for "${serverName}" and reads nothing from Pi`, () => {
    // arrange
    const pi = mock<Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">>({
      exactParams: true,
      name: "pi",
    });
    const reader = createBuiltinMcpStatusReader(pi);

    // act
    const answer = reader.lookup(serverName);

    // assert
    assert.strictEqual(answer, "no-snapshot");
    verify(pi);
  });
}
