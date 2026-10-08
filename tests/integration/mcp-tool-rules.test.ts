// ANAME-07 / AMIG-01: a remote server whose only gap is a Claude Code tool
// permission rule works under pi-mcp-adapter, which has no per-tool rule. A
// real install therefore writes the server without the rule fields, keeps the
// plugin installable, and warns that the rules are not enforced.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedMcpPlugin } from "./mcp-plugin-seed.ts";

test("ANAME-07: a plugin whose http server declares tool permission rules installs and warns that they are not enforced", async () => {
  await withHermeticEnvironment("mcp-tool-rules-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["project"], {
      type: "http",
      url: "https://example.test/mcp",
      tools: [{ name: "rule-tool-a7", permission_policy: "always_deny" }],
      toolPermissions: { "rule-tool-b7": "blocked" },
    });
    const locations = locationsFor("project", cwd);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const installed = makeCtx();

    // act
    await createInstallOperation(
      hooksRouting,
      createCompletionCache(),
    )({ ...installed.session, scope: "project", cwd, marketplace: "mp", plugin: "hello" });
    const adapter: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));
    const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"];

    // assert
    assert.deepStrictEqual(adapter, {
      mcpServers: {
        plugin_hello_srv_: {
          url: "https://example.test/mcp",
          directTools: "search",
          toolPrefix: "mcp",
          _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
        },
      },
    });
    assert.deepStrictEqual(
      {
        installable: record?.compatibility.installable,
        mcpServers: record?.resources.mcpServers,
        unsupported: record?.compatibility.unsupported,
      },
      { installable: true, mcpServers: ["srv"], unsupported: [] },
    );
    assert.deepStrictEqual(installed.notifications.at(-1), {
      severity: "warning",
      message:
        "MCP server tool rules not enforced.\n\n" +
        'Server "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: tools[].permission_policy, toolPermissions. Its tools run without these rules.',
    });
    assert.deepStrictEqual(
      installed.notifications.filter(({ message }) =>
        ["rule-tool-a7", "rule-tool-b7", "always_deny"].some((secret) => message.includes(secret)),
      ),
      [],
    );
  });
});
