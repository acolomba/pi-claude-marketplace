import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/**
 * test/architecture/no-factory-time-probe.test.ts -- the extension factory reads
 * none of Pi's tool, command, or MCP-server inventory.
 *
 * The invariant (MSEL-01):
 *   Pi loads its extensions one after another and emits no event until every
 *   one has loaded. `session_start` comes first, then `resources_discover`.
 *   So the only code of this extension that runs before the others have loaded
 *   is the factory and the module top level. Neither may call `getCommands`,
 *   `getAllTools`, `getActiveTools`, or `getMcpServers`. The active MCP
 *   implementation and every companion verdict come from a snapshot taken in
 *   an event handler.
 *
 *   The cost of losing it: a factory-time read sees an inventory without the
 *   extensions that load after this one. pi-mcp-adapter, pi-subagents, or the
 *   workflow engine would read as absent, and the active MCP implementation
 *   could read as `builtin` or `none` while the adapter is in fact loaded. A
 *   registration made on that answer is an extension error Pi reports
 *   (MSEL-03).
 *
 * How it is checked:
 *   A static scan cannot follow a probe through indirect calls, so the case
 *   runs the real factory against a recording Pi. Module-level code has no
 *   `pi`, so the factory run reaches every path that could read the inventory
 *   too early. Then the case runs the `session_start` handlers the factory
 *   registered and requires at least one read there, so the case proves the
 *   probe moved to `session_start`, not that the extension stopped probing.
 */

/** The inventory reads the ban covers. */
const INVENTORY_READS = new Set(["getCommands", "getAllTools", "getActiveTools", "getMcpServers"]);

/** The process variables the factory and `session_start` set, restored after the case. */
const TOUCHED_ENV = [
  "CLAUDECODE",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_PROJECT_DIR",
  "CLAUDE_SESSION_ID",
  "PI_CLAUDE_MARKETPLACE_EMPTY",
] as const;

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

interface RecordingPi {
  readonly pi: ExtensionAPI;
  readonly inventoryReads: string[];
  readonly handlers: (event: string) => readonly Handler[];
}

/** A Pi whose every method does nothing, except `on`, which keeps the handler, and the inventory reads, which record. */
function createRecordingPi(): RecordingPi {
  const inventoryReads: string[] = [];
  const handlers = new Map<string, Handler[]>();
  const events = {
    on: () => () => undefined,
    emit: () => undefined,
  };
  const pi = new Proxy(
    {},
    {
      get(_target, property): unknown {
        if (typeof property !== "string") {
          return undefined;
        }

        if (property === "events") {
          return events;
        }

        if (property === "on") {
          return (event: string, handler: Handler): void => {
            handlers.set(event, [...(handlers.get(event) ?? []), handler]);
          };
        }

        if (INVENTORY_READS.has(property)) {
          return (): readonly never[] => {
            inventoryReads.push(property);
            return [];
          };
        }

        return () => undefined;
      },
    },
  ) as ExtensionAPI;
  return { pi, inventoryReads, handlers: (event) => handlers.get(event) ?? [] };
}

/** A minimal `rpc` session context in `cwd`, in a project Pi trusts. */
function sessionContext(cwd: string): ExtensionContext {
  const known = new Map<string, unknown>([
    ["cwd", cwd],
    ["mode", "rpc"],
    ["hasUI", false],
    ["sessionManager", SessionManager.inMemory(cwd, { id: "factory-probe-session" })],
    ["isProjectTrusted", () => true],
    ["ui", new Proxy({}, { get: () => () => undefined })],
  ]);
  return new Proxy(
    {},
    {
      get(_target, property): unknown {
        return typeof property === "string" ? known.get(property) : undefined;
      },
    },
  ) as ExtensionContext;
}

/** Restores each touched process variable after the case, deleting one that was absent. */
function restoreTouchedEnv(t: TestContext): void {
  for (const key of TOUCHED_ENV) {
    const previous = process.env[key];
    t.after(() => {
      if (previous === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = previous;
      }
    });
  }
}

test("MSEL-01: the extension factory reads no inventory, and session_start does", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "factory-probe-");
  restoreTouchedEnv(t);
  const recording = createRecordingPi();

  // act
  await claudeMarketplaceExtension(recording.pi);
  const factoryReads = [...recording.inventoryReads];
  for (const handler of recording.handlers("session_start")) {
    // Pi runs session_start handlers one after another, in registration order.
    await handler({ type: "session_start", reason: "startup" }, sessionContext(cwd));
  }

  // assert
  assert.deepStrictEqual(factoryReads, []);
  assert.ok(
    recording.inventoryReads.length > 0,
    "no session_start handler read the inventory, so the probe ban proves nothing",
  );
});
