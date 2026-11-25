// Unit test for the late SessionStart ledger and its dispatch filter
// (HOOKLATESS-D1).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createLateSessionStartLedger,
  sessionStartRunsPlugin,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts";

import type { LateSessionStart } from "../../../extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts";
import type { ClaudeSessionStartEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts";
import type { SessionStartSource } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

const userDemo = { pluginId: "demo", marketplace: "fixtures", scope: "user" } as const;
const projectDemo = { pluginId: "demo", marketplace: "fixtures", scope: "project" } as const;
const projectAdded = { pluginId: "added", marketplace: "fixtures", scope: "project" } as const;
const userAdded = { pluginId: "added", marketplace: "fixtures", scope: "user" } as const;
const projectOther = { pluginId: "added", marketplace: "elsewhere", scope: "project" } as const;

describe("sessionStartRunsPlugin", () => {
  test("runs the hooks of every plugin when the event names no plugins (HOOKLATESS-D1)", () => {
    // arrange
    const event = { source: "startup" } satisfies ClaudeSessionStartEvent;

    // act
    const runs = sessionStartRunsPlugin(event, userDemo);

    // assert
    assert.strictEqual(runs, true);
  });

  test("runs the hooks of a plugin that the event names (HOOKLATESS-D1)", () => {
    // arrange
    const event = {
      source: "startup",
      newPluginsOnly: new Set(["added@fixtures"]),
    } satisfies ClaudeSessionStartEvent;

    // act
    const runs = sessionStartRunsPlugin(event, projectAdded);

    // assert
    assert.strictEqual(runs, true);
  });

  test("does not run the hooks of a plugin that the event does not name (HOOKLATESS-D1)", () => {
    // arrange
    const event = {
      source: "startup",
      newPluginsOnly: new Set(["added@fixtures"]),
    } satisfies ClaudeSessionStartEvent;

    // act
    const runs = sessionStartRunsPlugin(event, userDemo);

    // assert
    assert.strictEqual(runs, false);
  });

  test("does not run the hooks of a plugin of the same name from another marketplace (HOOKLATESS-D1)", () => {
    // arrange
    const event = {
      source: "startup",
      newPluginsOnly: new Set(["added@fixtures"]),
    } satisfies ClaudeSessionStartEvent;

    // act
    const runs = sessionStartRunsPlugin(event, projectOther);

    // assert
    assert.strictEqual(runs, false);
  });
});

describe("createLateSessionStartLedger", () => {
  test("owes no late run when no SessionStart dispatch was recorded (HOOKLATESS-D1)", () => {
    // arrange
    const ledger = createLateSessionStartLedger();

    // act
    const late = ledger.takeLateRun([userDemo, projectAdded]);

    // assert
    assert.strictEqual(late, undefined);
  });

  for (const source of ["startup", "resume", "fork"] satisfies readonly SessionStartSource[]) {
    test(`owes the plugins that gained a SessionStart route since a ${source} dispatch, with that source (HOOKLATESS-D1)`, () => {
      // arrange
      const ledger = createLateSessionStartLedger();
      ledger.recordDispatch(source, [userDemo]);

      // act
      const late = ledger.takeLateRun([userDemo, projectAdded]);

      // assert
      assert.deepStrictEqual(late, {
        source,
        plugins: new Set(["added@fixtures"]),
      } satisfies LateSessionStart);
    });
  }

  for (const source of ["clear", "compact"] satisfies readonly SessionStartSource[]) {
    test(`records nothing for a ${source} dispatch (HOOKLATESS-D1)`, () => {
      // arrange
      const ledger = createLateSessionStartLedger();
      ledger.recordDispatch(source, [userDemo]);

      // act
      const late = ledger.takeLateRun([userDemo, projectAdded]);

      // assert
      assert.strictEqual(late, undefined);
    });
  }

  test("owes no late run when no plugin gained a route (HOOKLATESS-D1)", () => {
    // arrange
    const ledger = createLateSessionStartLedger();
    ledger.recordDispatch("startup", [userDemo, projectAdded]);

    // act
    const late = ledger.takeLateRun([userDemo, projectAdded]);

    // assert
    assert.strictEqual(late, undefined);
  });

  test("does not owe a plugin that held a route in the other scope (HOOKLATESS-D1)", () => {
    // arrange
    const ledger = createLateSessionStartLedger();
    ledger.recordDispatch("startup", [userDemo]);

    // act
    const late = ledger.takeLateRun([projectDemo, projectAdded]);

    // assert
    assert.deepStrictEqual(late, {
      source: "startup",
      plugins: new Set(["added@fixtures"]),
    } satisfies LateSessionStart);
  });

  test("names a plugin with two new routes once (HOOKLATESS-D1)", () => {
    // arrange
    const ledger = createLateSessionStartLedger();
    ledger.recordDispatch("startup", []);

    // act
    const late = ledger.takeLateRun([projectAdded, userAdded]);

    // assert
    assert.deepStrictEqual(late, {
      source: "startup",
      plugins: new Set(["added@fixtures"]),
    } satisfies LateSessionStart);
  });

  test("owes a late run once (HOOKLATESS-D1)", () => {
    // arrange
    const ledger = createLateSessionStartLedger();
    ledger.recordDispatch("startup", [userDemo]);
    ledger.takeLateRun([userDemo, projectAdded]);

    // act
    const late = ledger.takeLateRun([userDemo, projectAdded]);

    // assert
    assert.strictEqual(late, undefined);
  });
});
