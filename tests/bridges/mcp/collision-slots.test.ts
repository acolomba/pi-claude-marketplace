import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  MCP_COLLISION_SLOTS,
  loadEffectiveServerNames,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts";

// MC-4 / RN-5 -- four-slot enumeration + first-declarer-wins.

test("MC-4 MCP_COLLISION_SLOTS returns 4 paths in user-contract order", () => {
  const cwd = "/tmp/test-cwd-xyz";
  const slots = MCP_COLLISION_SLOTS(cwd);
  assert.equal(slots.length, 4, "exactly four slots");

  const [slot0, slot1, slot2, slot3] = slots;
  // Slot 0: shared-global -- ~/.config/mcp/mcp.json
  assert.ok(
    slot0!.endsWith(path.join(".config", "mcp", "mcp.json")),
    `slot[0] should end with .config/mcp/mcp.json, got ${String(slot0)}`,
  );
  // Slot 1: pi-user-scope -- ~/.pi/agent/mcp.json
  assert.ok(
    slot1!.endsWith(path.join(".pi", "agent", "mcp.json")),
    `slot[1] should end with .pi/agent/mcp.json, got ${String(slot1)}`,
  );
  // Slot 2: shared-project -- <cwd>/.mcp.json
  assert.equal(slot2, path.join(cwd, ".mcp.json"));
  // Slot 3: pi-project-scope -- <cwd>/.pi/mcp.json
  assert.equal(slot3, path.join(cwd, ".pi", "mcp.json"));
});

test("MC-4 MCP_COLLISION_SLOTS returns frozen array", () => {
  const slots = MCP_COLLISION_SLOTS("/tmp");
  assert.ok(Object.isFrozen(slots), "slot array must be frozen");
});

test("MC-4 loadEffectiveServerNames returns empty Map when no slots present", async () => {
  // mkdtemp under tmp -- no .mcp.json or .pi/mcp.json present.
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-slots-"));
  try {
    const map = await loadEffectiveServerNames(cwd);
    // Note: we cannot assert the global ~/.config/mcp/mcp.json or
    // ~/.pi/agent/mcp.json don't exist on the test host. But we CAN
    // assert the map doesn't include the cwd-shaped slots.
    assert.ok(map instanceof Map);
    assert.ok(!map.has("__test_no_such_server__"));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("MC-4 loadEffectiveServerNames first-declarer-wins across slots", async () => {
  // We can only meaningfully test the cwd-shaped slots (slots 2 and 3)
  // without polluting the user's $HOME -- so put the same server name in
  // both and assert slot 2 wins (slot 2 is enumerated before slot 3).
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-slots-"));
  try {
    const slot2Path = path.join(cwd, ".mcp.json");
    const slot3Path = path.join(cwd, ".pi", "mcp.json");

    await writeFile(slot2Path, JSON.stringify({ mcpServers: { dup: { command: "from-slot-2" } } }));
    await mkdir(path.dirname(slot3Path), { recursive: true });
    await writeFile(slot3Path, JSON.stringify({ mcpServers: { dup: { command: "from-slot-3" } } }));

    const map = await loadEffectiveServerNames(cwd);
    const owner = map.get("dup");
    assert.equal(owner, slot2Path, `slot 2 must win, got owner=${String(owner)}`);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("MC-4 loadEffectiveServerNames silently skips malformed JSON in a slot", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-slots-"));
  try {
    const slot2Path = path.join(cwd, ".mcp.json");
    const slot3Path = path.join(cwd, ".pi", "mcp.json");

    // Slot 2 is malformed -- should be silently skipped.
    await writeFile(slot2Path, "not json {{");
    await mkdir(path.dirname(slot3Path), { recursive: true });
    await writeFile(slot3Path, JSON.stringify({ mcpServers: { only: {} } }));

    const map = await loadEffectiveServerNames(cwd);
    // "only" lives in slot 3; slot 2 was silently skipped.
    assert.equal(map.get("only"), slot3Path);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("MC-4 loadEffectiveServerNames silently skips ENOENT in a slot", async () => {
  // No files at all -- should not throw, just return whatever the
  // user's $HOME slots happen to declare (which we don't assert about).
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-slots-"));
  try {
    const map = await loadEffectiveServerNames(cwd);
    assert.ok(map instanceof Map);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("MC-4 loadEffectiveServerNames accepts both wrapped and unwrapped slot files", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-slots-"));
  try {
    const slot2Path = path.join(cwd, ".mcp.json");
    const slot3Path = path.join(cwd, ".pi", "mcp.json");

    // Slot 2: wrapped form.
    await writeFile(slot2Path, JSON.stringify({ mcpServers: { wrapped: { command: "x" } } }));
    // Slot 3: unwrapped form.
    await mkdir(path.dirname(slot3Path), { recursive: true });
    await writeFile(slot3Path, JSON.stringify({ unwrapped: { command: "y" } }));

    const map = await loadEffectiveServerNames(cwd);
    assert.equal(map.get("wrapped"), slot2Path, "wrapped form recognized");
    assert.equal(map.get("unwrapped"), slot3Path, "unwrapped form recognized");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("MC-4 loadEffectiveServerNames silently skips top-level non-object in a slot", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-slots-"));
  try {
    const slot2Path = path.join(cwd, ".mcp.json");
    await writeFile(slot2Path, JSON.stringify(["a", "b"]));
    const map = await loadEffectiveServerNames(cwd);
    // No throw, no entries from slot 2.
    assert.ok(map instanceof Map);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
