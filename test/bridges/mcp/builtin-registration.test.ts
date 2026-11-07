import assert from "node:assert/strict";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import { syncBuiltinRegistrations } from "../../../extensions/pi-claude-marketplace/bridges/mcp/builtin-registration.ts";

import type {
  McpServerConfig,
  PiMcpRegistry,
  RegisteredMcpServer,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type DebugLog = (detail: string) => void;

function stdioConfig(command: string): McpServerConfig {
  return { command, exposure: "deferred" };
}

function listed(name: string, config: McpServerConfig): RegisteredMcpServer {
  return { name, config, extensionPath: "/extensions/owner.ts" };
}

type NoteKind = "fresh" | "replaced" | "refused";

/** Registration notes that record each `[serverName, kind]` they receive. */
function noteRecorder(): {
  readonly notes: Readonly<Record<NoteKind, (serverName: string) => void>>;
  readonly noted: [string, NoteKind][];
} {
  const noted: [string, NoteKind][] = [];
  return {
    notes: {
      replaced: (serverName) => noted.push([serverName, "replaced"]),
      fresh: (serverName) => noted.push([serverName, "fresh"]),
      refused: (serverName) => noted.push([serverName, "refused"]),
    },
    noted,
  };
}

test("BLT-01: registers each desired server Pi does not list", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers()).thenReturn([]);
  when(() => {
    registry.registerMcpServer("plugin_demo_a", stdioConfig("a"));
  }).thenReturn(undefined);
  when(() => {
    registry.registerMcpServer("plugin_demo_b", stdioConfig("b"));
  }).thenReturn(undefined);
  const desired = new Map([
    ["plugin_demo_a", stdioConfig("a")],
    ["plugin_demo_b", stdioConfig("b")],
  ]);
  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, desired, log, notes);

  // assert
  assert.deepStrictEqual(noted, [
    ["plugin_demo_a", "fresh"],
    ["plugin_demo_b", "fresh"],
  ]);
  verify(registry);
  verify(log);
});

test("MSEL-02: skips a server whose listed config has the same JSON and replaces a changed one", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers()).thenReturn([
    listed("plugin_demo_same", stdioConfig("same")),
    listed("plugin_demo_changed", stdioConfig("old")),
  ]);
  when(() => {
    registry.registerMcpServer("plugin_demo_changed", stdioConfig("new"));
  }).thenReturn(undefined);
  const desired = new Map([
    ["plugin_demo_same", stdioConfig("same")],
    ["plugin_demo_changed", stdioConfig("new")],
  ]);
  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, desired, log, notes);

  // assert
  assert.deepStrictEqual(noted, [["plugin_demo_changed", "replaced"]]);
  verify(registry);
  verify(log);
});

test("MSEL-02: re-registers a config whose keys Pi lists in another order", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  const reordered: McpServerConfig = { exposure: "deferred", command: "a" };
  when(() => registry.getMcpServers()).thenReturn([listed("plugin_demo_a", reordered)]);
  when(() => {
    registry.registerMcpServer("plugin_demo_a", stdioConfig("a"));
  }).thenReturn(undefined);

  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, new Map([["plugin_demo_a", stdioConfig("a")]]), log, notes);

  // assert
  assert.deepStrictEqual(noted, [["plugin_demo_a", "replaced"]]);
  verify(registry);
  verify(log);
});

test("BLT-06: unregisters a listed plugin server the desired set lacks and leaves other names", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers()).thenReturn([
    listed("plugin_gone_s", stdioConfig("gone")),
    listed("github", stdioConfig("gh")),
  ]);
  when(() => {
    registry.unregisterMcpServer("plugin_gone_s");
  }).thenReturn(undefined);

  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, new Map(), log, notes);

  // assert
  assert.deepStrictEqual(noted, [["plugin_gone_s", "fresh"]]);
  verify(registry);
  verify(log);
});

test("BLT-06: unregisters before it registers, then registers in desired order", () => {
  // arrange
  const calls: string[] = [];
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers()).thenReturn([listed("plugin_old-s", stdioConfig("old"))]);
  // eslint-disable-next-line @typescript-eslint/unbound-method -- strong-mock records the call order through the method reference
  when(() => registry.unregisterMcpServer).thenReturn((name) => {
    calls.push(`unregister ${name}`);
  });
  // eslint-disable-next-line @typescript-eslint/unbound-method -- strong-mock records the call order through the method reference
  when(() => registry.registerMcpServer)
    .thenReturn((name) => {
      calls.push(`register ${name}`);
    })
    .twice();
  const desired = new Map([
    ["plugin_old_s", stdioConfig("new")],
    ["plugin_demo_b", stdioConfig("b")],
  ]);

  const notes = {
    replaced: (serverName: string): void => {
      calls.push(`replaced ${serverName}`);
    },
    fresh: (serverName: string): void => {
      calls.push(`fresh ${serverName}`);
    },
    refused: (serverName: string): void => {
      calls.push(`refused ${serverName}`);
    },
  };

  // act
  syncBuiltinRegistrations(registry, desired, log, notes);

  // assert
  assert.deepStrictEqual(calls, [
    "unregister plugin_old-s",
    "fresh plugin_old-s",
    "register plugin_old_s",
    "fresh plugin_old_s",
    "register plugin_demo_b",
    "fresh plugin_demo_b",
  ]);
  verify(registry);
  verify(log);
});

test("D-MB-12 / D-MB-29: a refused registration is logged with its name and Pi's message, noted as refused, and the rest register", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers()).thenReturn([]);
  when(() => {
    registry.registerMcpServer("plugin_demo_a", stdioConfig("a"));
  }).thenThrow(
    new Error('MCP server "plugin_demo_a" is already registered by extension "other.ts"'),
  );
  when(() => {
    registry.registerMcpServer("plugin_demo_b", stdioConfig("b"));
  }).thenReturn(undefined);
  when(() => {
    log(
      'MCP server plugin_demo_a not registered: MCP server "plugin_demo_a" is already registered by extension "other.ts"',
    );
  }).thenReturn(undefined);
  const desired = new Map([
    ["plugin_demo_a", stdioConfig("a")],
    ["plugin_demo_b", stdioConfig("b")],
  ]);
  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, desired, log, notes);

  // assert
  assert.deepStrictEqual(noted, [
    ["plugin_demo_a", "refused"],
    ["plugin_demo_b", "fresh"],
  ]);
  verify(registry);
  verify(log);
});

test("D-MB-12: a refused removal is logged with its name and Pi's message, noted as nothing, and the rest still change", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers()).thenReturn([
    listed("plugin_gone_a", stdioConfig("a")),
    listed("plugin_gone_b", stdioConfig("b")),
  ]);
  when(() => {
    registry.unregisterMcpServer("plugin_gone_a");
  }).thenThrow(new Error("runtime is stale"));
  when(() => {
    registry.unregisterMcpServer("plugin_gone_b");
  }).thenReturn(undefined);
  when(() => {
    registry.registerMcpServer("plugin_demo_c", stdioConfig("c"));
  }).thenReturn(undefined);
  when(() => {
    log("MCP server plugin_gone_a not unregistered: runtime is stale");
  }).thenReturn(undefined);
  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, new Map([["plugin_demo_c", stdioConfig("c")]]), log, notes);

  // assert
  assert.deepStrictEqual(noted, [
    ["plugin_gone_b", "fresh"],
    ["plugin_demo_c", "fresh"],
  ]);
  verify(registry);
  verify(log);
});

test("D-MB-12: a removal Pi refused is tried again by the next sync", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers())
    .thenReturn([listed("plugin_gone_a", stdioConfig("a"))])
    .twice();
  when(() => {
    registry.unregisterMcpServer("plugin_gone_a");
  }).thenThrow(new Error("runtime is stale"));
  when(() => {
    registry.unregisterMcpServer("plugin_gone_a");
  }).thenReturn(undefined);
  when(() => {
    log("MCP server plugin_gone_a not unregistered: runtime is stale");
  }).thenReturn(undefined);
  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, new Map(), log, notes);
  const notedAfterFirstSync = [...noted];
  syncBuiltinRegistrations(registry, new Map(), log, notes);

  // assert
  assert.deepStrictEqual(notedAfterFirstSync, []);
  assert.deepStrictEqual(noted, [["plugin_gone_a", "fresh"]]);
  verify(registry);
  verify(log);
});

test("D-MB-12: a name in the retained set is not unregistered", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers()).thenReturn([
    listed("plugin_kept_s", stdioConfig("kept")),
    listed("plugin_gone_s", stdioConfig("gone")),
  ]);
  when(() => {
    registry.unregisterMcpServer("plugin_gone_s");
  }).thenReturn(undefined);
  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, new Map(), log, notes, new Set(["plugin_kept_s"]));

  // assert
  assert.deepStrictEqual(noted, [["plugin_gone_s", "fresh"]]);
  verify(registry);
  verify(log);
});

test("D-MB-29: a refused replacement of a listed name unregisters the old registration", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers()).thenReturn([listed("plugin_demo_a", stdioConfig("old"))]);
  when(() => {
    registry.registerMcpServer("plugin_demo_a", stdioConfig("a"));
  }).thenThrow(new Error("config refused"));
  when(() => {
    log("MCP server plugin_demo_a not registered: config refused");
  }).thenReturn(undefined);
  when(() => {
    registry.unregisterMcpServer("plugin_demo_a");
  }).thenReturn(undefined);
  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, new Map([["plugin_demo_a", stdioConfig("a")]]), log, notes);

  // assert
  assert.deepStrictEqual(noted, [
    ["plugin_demo_a", "fresh"],
    ["plugin_demo_a", "refused"],
  ]);
  verify(registry);
  verify(log);
});

test("D-MB-29: a refused replacement whose old registration cannot be removed logs both", () => {
  // arrange
  const registry = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
  const log = mock<DebugLog>({ exactParams: true, name: "debug log" });
  when(() => registry.getMcpServers()).thenReturn([listed("plugin_demo_a", stdioConfig("old"))]);
  when(() => {
    registry.registerMcpServer("plugin_demo_a", stdioConfig("a"));
  }).thenThrow(new Error("config refused"));
  when(() => {
    log("MCP server plugin_demo_a not registered: config refused");
  }).thenReturn(undefined);
  when(() => {
    registry.unregisterMcpServer("plugin_demo_a");
  }).thenThrow(new Error("runtime is stale"));
  when(() => {
    log("MCP server plugin_demo_a not unregistered: runtime is stale");
  }).thenReturn(undefined);
  const { notes, noted } = noteRecorder();

  // act
  syncBuiltinRegistrations(registry, new Map([["plugin_demo_a", stdioConfig("a")]]), log, notes);

  // assert
  assert.deepStrictEqual(noted, [["plugin_demo_a", "refused"]]);
  verify(registry);
  verify(log);
});
