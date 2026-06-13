import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts";
import { cleanupStaging } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { ExtensionAPI } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/**
 * Regression guard: index.ts loads cleanly, exports a default
 * function, and registers exactly the expected Pi surface.
 */

interface RegistrationLog {
  type: "command" | "event" | "tool";
  name: string;
}

interface MockPi {
  readonly pi: ExtensionAPI;
  readonly commands: Map<string, unknown>;
  readonly events: Map<string, ((event: unknown) => unknown)[]>;
  readonly tools: Map<string, unknown>;
}

function makePiMock(log: RegistrationLog[]): MockPi {
  const commands = new Map<string, unknown>();
  const events = new Map<string, ((event: unknown) => unknown)[]>();
  const tools = new Map<string, unknown>();

  const pi = {
    registerCommand(name: string, options: unknown) {
      log.push({ type: "command", name });
      commands.set(name, options);
    },
    registerTool(tool: { name: string }) {
      log.push({ type: "tool", name: tool.name });
      tools.set(tool.name, tool);
    },
    on(event: string, handler: (event: unknown) => unknown) {
      log.push({ type: "event", name: event });
      const handlers = events.get(event) ?? [];
      handlers.push(handler);
      events.set(event, handlers);
    },

    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;

  return { pi, commands, events, tools };
}

test("default export is a function", () => {
  assert.equal(typeof claudeMarketplaceExtension, "function");
});

test("registers command, read-only tools, session_start, and resources_discover exactly once", () => {
  const log: RegistrationLog[] = [];
  const { pi } = makePiMock(log);
  claudeMarketplaceExtension(pi);

  const commands = log.filter((e) => e.type === "command");
  const events = log.filter((e) => e.type === "event");
  const tools = log.filter((e) => e.type === "tool");

  assert.equal(commands.length, 1, `expected exactly 1 command, got ${JSON.stringify(commands)}`);
  assert.equal(commands[0]!.name, "claude:plugin");
  assert.deepEqual(events.map((e) => e.name).sort(), ["resources_discover", "session_start"]);
  assert.equal(
    tools.length,
    2,
    `Pi entry point must register 2 read-only LLM tools; got ${JSON.stringify(tools)}`,
  );
  assert.deepEqual(tools.map((e) => e.name).sort(), [
    "pi_claude_marketplace_list",
    "pi_claude_marketplace_plugin_list",
  ]);
});

test("resources_discover handler resolves project cwd at invocation time", async () => {
  const log: RegistrationLog[] = [];
  const { pi, events } = makePiMock(log);
  claudeMarketplaceExtension(pi);

  const handlers = events.get("resources_discover") ?? [];
  assert.equal(handlers.length, 1, "exactly one resources_discover handler");

  const eventCwd = await mkdtemp(path.join(os.tmpdir(), "index-smoke-event-cwd-"));
  const processCwd = await mkdtemp(path.join(os.tmpdir(), "index-smoke-process-cwd-"));
  try {
    const projectPromptDir = path.join(
      eventCwd,
      ".pi",
      "pi-claude-marketplace",
      "resources",
      "prompts",
    );
    const projectPrompt = path.join(projectPromptDir, "cwd-captured.md");
    await mkdir(projectPromptDir, { recursive: true });
    await writeFile(projectPrompt, "# cwd captured\n");

    const wrongPromptDir = path.join(
      processCwd,
      ".pi",
      "pi-claude-marketplace",
      "resources",
      "prompts",
    );
    const wrongPrompt = path.join(wrongPromptDir, "process-cwd.md");
    await mkdir(wrongPromptDir, { recursive: true });
    await writeFile(wrongPrompt, "# process cwd\n");

    const result = await handlers[0]!({
      cwd: eventCwd,
      reason: "reload",
      type: "resources_discover",
    });
    assert.ok(
      typeof result === "object" &&
        result !== null &&
        "promptPaths" in result &&
        Array.isArray(result.promptPaths),
    );
    const promptPaths = result.promptPaths as string[];
    assert.ok(
      promptPaths.some((promptPath) =>
        promptPath.endsWith(
          path.join(".pi", "pi-claude-marketplace", "resources", "prompts", "cwd-captured.md"),
        ),
      ),
      `expected invocation-time cwd prompt in ${JSON.stringify(result.promptPaths)}`,
    );
    assert.equal(
      promptPaths.some((promptPath) => promptPath.endsWith("process-cwd.md")),
      false,
      `expected process cwd not to be used in ${JSON.stringify(result.promptPaths)}`,
    );
  } finally {
    await cleanupStaging(eventCwd, "test-cleanup");
    await cleanupStaging(processCwd, "test-cleanup");
  }
});
