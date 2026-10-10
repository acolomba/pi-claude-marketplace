// tests/architecture/mcp-migration-notice.test.ts
//
// Byte-equality lock for the reload migration notice (AMIG-01, AMIG-03,
// AMIG-04). `notifyMcpMigration` calls ctx.ui.notify directly, outside the
// structured NotificationMessage entrypoint, so the catalog-uat walk never
// drives it. This lock reads the `mcp-migration-moved`,
// `mcp-migration-stopped`, `mcp-migration-left-in-place`,
// `mcp-migration-removed` and `mcp-migration-unfinished` blocks from
// docs/output-catalog.md and asserts that the seam emits each one byte for
// byte, in one call at the documented severity, with a summary line followed
// by a blank line.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { notifyMcpMigration } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";

import { readCatalogBlock } from "./catalog-block.ts";

import type { NotificationContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { McpMigrationReport } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";

interface CatalogReportRow {
  readonly state: string;
  readonly severity: "info" | "warning";
  readonly report: McpMigrationReport;
}

// Each catalog block documents the report named beside it.
const CATALOG_REPORT_ROWS: readonly CatalogReportRow[] = [
  {
    state: "mcp-migration-moved",
    severity: "warning",
    report: {
      rows: [
        {
          kind: "moved",
          scope: "user",
          plugin: "acme",
          marketplace: "official",
          from: "slack",
          to: "plugin_acme_slack_",
        },
        {
          kind: "moved",
          scope: "project",
          plugin: "acme",
          marketplace: "official",
          from: "github",
          to: "plugin_acme_github_",
        },
      ],
      notices: [
        {
          kind: "variables-missing",
          scope: "project",
          file: "mcp-adapter.json",
          plugin: "acme",
          server: "plugin_acme_github_",
          names: ["GITHUB_TOKEN"],
        },
      ],
    },
  },
  {
    state: "mcp-migration-stopped",
    severity: "warning",
    report: {
      rows: [
        { kind: "stopped", scope: "user", detail: "state.json is locked by another Pi process" },
      ],
      notices: [],
    },
  },
  {
    state: "mcp-migration-left-in-place",
    severity: "warning",
    report: {
      rows: [
        { kind: "file-unreadable", scope: "project", file: "mcp-adapter.json" },
        {
          kind: "unowned",
          scope: "project",
          plugin: "gone",
          marketplace: "mp",
          servers: ["orphan"],
        },
        {
          kind: "source-unreadable",
          scope: "user",
          plugin: "acme",
          marketplace: "official",
          servers: ["github", "slack"],
        },
        {
          kind: "collision",
          scope: "user",
          plugin: "dbtools",
          marketplace: "official",
          servers: ["db"],
          key: "plugin_dbtools_db_",
          source: "the user-scope mcp-adapter.json",
        },
        {
          kind: "marketplace-unreadable",
          scope: "user",
          plugin: "legacy",
          marketplace: "official",
          servers: ["tool"],
        },
        {
          kind: "source-outdated",
          scope: "user",
          plugin: "moved",
          marketplace: "official",
          servers: ["mod"],
        },
        {
          kind: "not-listed",
          scope: "user",
          plugin: "retired",
          marketplace: "official",
          servers: ["old"],
        },
      ],
      notices: [],
    },
  },
  {
    state: "mcp-migration-removed",
    severity: "warning",
    report: {
      rows: [
        {
          kind: "removed",
          scope: "user",
          plugin: "broken",
          marketplace: "mp",
          server: "bad",
          cause: "malformed",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "live",
          cause: "unsupported-feature",
          feature: "ws",
        },
        {
          kind: "moved",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          from: "srv",
          to: "plugin_hello_srv_",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "gone",
          cause: "not-declared",
        },
      ],
      notices: [
        {
          kind: "leftover-removed",
          scope: "project",
          file: "mcp-adapter.json",
          plugin: "hello",
          server: "srv",
        },
      ],
    },
  },
  {
    state: "mcp-migration-unfinished",
    severity: "warning",
    report: {
      rows: [
        {
          kind: "unfinished",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          servers: ["srv"],
          file: "mcp.json",
          detail: "permission denied",
        },
      ],
      notices: [],
    },
  },
];

type NotifyArguments = [message: string, severity?: string];

function emit(t: TestContext, report: McpMigrationReport): readonly NotifyArguments[] {
  const notify = t.mock.fn<(...args: NotifyArguments) => void>();
  const ctx: NotificationContext = { ui: { notify } };
  notifyMcpMigration(ctx, report);
  return notify.mock.calls.map((call) => call.arguments);
}

for (const { state, severity, report } of CATALOG_REPORT_ROWS) {
  test(`AMIG-03: the ${state} notice is one ${severity}-severity call`, (t) => {
    // act
    const calls = emit(t, report);

    // assert
    assert.deepStrictEqual(
      calls.map((args) => args[1]),
      [severity],
    );
  });

  test(`AMIG-03: the ${state} notice opens with a summary line and a blank line`, (t) => {
    // act
    const [message] = emit(t, report)[0] ?? [""];

    // assert
    assert.match(message, /^[^\n]+\n\n[^\n]/);
  });

  test(`AMIG-03: the ${state} notice is byte-equal to its catalog block`, async (t) => {
    // arrange
    const expectedMessage = await readCatalogBlock(state);

    // act
    const [message] = emit(t, report)[0] ?? [""];

    // assert
    assert.strictEqual(message, expectedMessage);
  });
}
