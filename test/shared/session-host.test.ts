// Owner for shared/session-host.ts.
//
// RELOADCMD-D1: the one predicate that decides whether this Pi process takes
// later commands, and the one place that picks the command an instruction to
// reload names. Each host below is a literal of Pi's one field, so a case
// states the whole input it reads; the terminal case proves that the terminal
// reads no host field at all.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  acceptsLaterCommands,
  reloadCommandFor,
} from "../../extensions/pi-claude-marketplace/shared/session-host.ts";

describe("acceptsLaterCommands", () => {
  test("a host with a UI accepts later commands (RELOADCMD-D1)", () => {
    // act
    const accepts = acceptsLaterCommands({ hasUI: true });

    // assert
    assert.strictEqual(accepts, true);
  });

  test("a host without a UI accepts no later commands (RELOADCMD-D1)", () => {
    // act
    const accepts = acceptsLaterCommands({ hasUI: false });

    // assert
    assert.strictEqual(accepts, false);
  });
});

describe("reloadCommandFor", () => {
  test("Pi's terminal names Pi's own /reload (RELOADCMD-D1)", () => {
    // act
    const command = reloadCommandFor("tui", { hasUI: true });

    // assert
    assert.strictEqual(command, "/reload");
  });

  test("rpc, which has no /reload, names the extension's reload (RELOADCMD-D1)", () => {
    // act
    const command = reloadCommandFor("rpc", { hasUI: true });

    // assert
    assert.strictEqual(command, "/claude:plugin reload");
  });

  for (const mode of ["print", "json"]) {
    test(`a one-shot run in ${mode} mode names no reload (RELOADCMD-D1)`, () => {
      // act
      const command = reloadCommandFor(mode, { hasUI: false });

      // assert
      assert.strictEqual(command, undefined);
    });
  }

  test("Pi's terminal names /reload without reading the host (RELOADCMD-D1)", () => {
    // arrange
    const host = {
      get hasUI(): boolean {
        throw new Error("the terminal reads no host field");
      },
    };

    // act
    const command = reloadCommandFor("tui", host);

    // assert
    assert.strictEqual(command, "/reload");
  });
});
