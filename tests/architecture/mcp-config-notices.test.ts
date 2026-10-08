// tests/architecture/mcp-config-notices.test.ts
//
// Byte-equality lock for the MCP config file notices (AFILE-04, AFILE-02).
// `notifyMcpConfigNotices` calls ctx.ui.notify directly, outside the structured
// NotificationMessage entrypoint, so the catalog-uat walk and the
// notify-grammar invariant never drive it. This dedicated lock reads the
// `mcp-comments-dropped`, `mcp-config-left-unchanged`, `mcp-override-kept`,
// `mcp-variables-missing`, `mcp-credentials-blanked` and
// `mcp-tool-rules-unenforced` blocks from docs/output-catalog.md and asserts
// that the seam emits each one byte for byte, in one warning-severity call,
// with a non-empty summary line followed by a blank line (AFILE-06, AVAR-04,
// AVAR-05, ANAME-07).

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { notifyMcpConfigNotices } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";

import { readCatalogBlock } from "./catalog-block.ts";

import type { NotificationContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { McpConfigNotice } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";

interface CatalogNoticeRow {
  readonly state: string;
  readonly notice: McpConfigNotice;
}

// Each catalog block documents the notice named beside it.
const CATALOG_NOTICE_ROWS: readonly CatalogNoticeRow[] = [
  {
    state: "mcp-comments-dropped",
    notice: { kind: "comments-dropped", scope: "user", file: "mcp-adapter.json" },
  },
  {
    state: "mcp-config-left-unchanged",
    notice: { kind: "left-unchanged", scope: "project", file: "mcp-adapter.json" },
  },
  {
    state: "mcp-override-kept",
    notice: {
      kind: "override-kept",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["requestTimeoutMs", "env"],
    },
  },
  {
    state: "mcp-variables-missing",
    notice: {
      kind: "variables-missing",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["DD_API_KEY", "DD_SITE"],
    },
  },
  {
    state: "mcp-credentials-blanked",
    notice: {
      kind: "credentials-blanked",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      names: ["ANTHROPIC_API_KEY"],
    },
  },
  {
    state: "mcp-tool-rules-unenforced",
    notice: {
      kind: "tool-rules-unenforced",
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "hello",
      server: "plugin_hello_srv_",
      fields: ["tools[].permission_policy", "toolPermissions"],
    },
  },
];

type NotifyArguments = [message: string, severity?: string];

function emit(t: TestContext, notice: McpConfigNotice): readonly NotifyArguments[] {
  const notify = t.mock.fn<(...args: NotifyArguments) => void>();
  const ctx: NotificationContext = { ui: { notify } };
  notifyMcpConfigNotices(ctx, [notice]);
  return notify.mock.calls.map((call) => call.arguments);
}

for (const { state, notice } of CATALOG_NOTICE_ROWS) {
  test(`AFILE-04: a ${notice.kind} notice is one warning-severity call`, (t) => {
    // act
    const calls = emit(t, notice);

    // assert
    assert.deepStrictEqual(
      calls.map((args) => args[1]),
      ["warning"],
    );
  });

  test(`AFILE-04: a ${notice.kind} notice opens with a summary line and a blank line`, (t) => {
    // act
    const [message] = emit(t, notice)[0] ?? [""];

    // assert
    assert.match(message, /^[^\n]+\n\n[^\n]/);
  });

  test(`AFILE-04: a ${notice.kind} notice is byte-equal to the catalog's ${state} block`, async (t) => {
    // arrange
    const expectedMessage = await readCatalogBlock(state);

    // act
    const [message] = emit(t, notice)[0] ?? [""];

    // assert
    assert.strictEqual(message, expectedMessage);
  });
}
