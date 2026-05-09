import assert from "node:assert/strict";
import test from "node:test";

import claudeMarketplaceExtension from "../../extensions/claude-marketplace/index.ts";

/**
 * Plan 04 regression guard: index.ts loads cleanly, exports a default
 * function, and registers exactly the expected Pi surface.
 *
 * Phase 1 deliberately registers ZERO LLM tools (per RESEARCH.md Open
 * Question 3). If a future PR re-adds `pi.registerTool(...)` here, this
 * test fails -- preventing accidental regression to the legacy stub
 * behavior.
 */

interface RegistrationLog {
  type: "command" | "event" | "tool";
  name: string;
}

function makePiMock(log: RegistrationLog[]): unknown {
  return {
    registerCommand(name: string) {
      log.push({ type: "command", name });
    },
    registerTool(tool: { name: string }) {
      log.push({ type: "tool", name: tool.name });
    },
    on(event: string) {
      log.push({ type: "event", name: event });
    },
  };
}

test("default export is a function", () => {
  assert.equal(typeof claudeMarketplaceExtension, "function");
});

test("registers exactly 1 command (claude:plugin), 1 event (resources_discover), 0 tools", () => {
  const log: RegistrationLog[] = [];
  const pi = makePiMock(log);
  claudeMarketplaceExtension(pi as never);

  const commands = log.filter((e) => e.type === "command");
  const events = log.filter((e) => e.type === "event");
  const tools = log.filter((e) => e.type === "tool");

  assert.equal(commands.length, 1, `expected exactly 1 command, got ${JSON.stringify(commands)}`);
  assert.equal(commands[0]!.name, "claude:plugin");
  assert.equal(events.length, 1, `expected exactly 1 event handler, got ${JSON.stringify(events)}`);
  assert.equal(events[0]!.name, "resources_discover");
  assert.equal(
    tools.length,
    0,
    `Phase 1 must register 0 LLM tools (Phase 6 lands them); got ${JSON.stringify(tools)}`,
  );
});
