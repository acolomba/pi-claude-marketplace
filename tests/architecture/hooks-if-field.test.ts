import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addPluginConfigToCache,
  rebuildRoutingTables,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import {
  compileIfPredicate,
  MATCH_ALL_IF,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import {
  resetRoutingState,
  routingTableEntries,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { parseHooksConfig } from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

test("parseHooksConfig side-map flows into RoutingEntry predicates in declaration order", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } as const;
  const raw = JSON.stringify({
    PreToolUse: [
      {
        matcher: "",
        hooks: [
          { type: "command", command: "echo bash", if: "Bash(git *)" },
          { type: "command", command: "echo always" },
        ],
      },
      {
        matcher: "Read|Edit",
        hooks: [
          { type: "command", command: "echo path", if: "Read(src/**)" },
          { type: "command", command: "echo mcp", if: "mcp__files__read" },
        ],
      },
    ],
  });
  const resolvedSource = asAbsolutePluginRoot("/workspace/plugin");
  const expectedRows = [
    {
      scope: "project",
      marketplace: "verified-marketplace",
      pluginId: "verified-plugin",
      resolvedSource: "/workspace/plugin",
      claudeEvent: "PreToolUse",
      matcherKind: "match-all",
      rawMatcher: "",
      handlerDecl: { type: "command", command: "echo bash", if: "Bash(git *)" },
      declarationIndex: 0,
      predicateKind: "bash",
    },
    {
      scope: "project",
      marketplace: "verified-marketplace",
      pluginId: "verified-plugin",
      resolvedSource: "/workspace/plugin",
      claudeEvent: "PreToolUse",
      matcherKind: "match-all",
      rawMatcher: "",
      handlerDecl: { type: "command", command: "echo always" },
      declarationIndex: 1,
      predicateKind: "match-all",
    },
    {
      scope: "project",
      marketplace: "verified-marketplace",
      pluginId: "verified-plugin",
      resolvedSource: "/workspace/plugin",
      claudeEvent: "PreToolUse",
      matcherKind: "tool-set",
      rawMatcher: "Read|Edit",
      handlerDecl: { type: "command", command: "echo path", if: "Read(src/**)" },
      declarationIndex: 2,
      predicateKind: "path-tool",
    },
    {
      scope: "project",
      marketplace: "verified-marketplace",
      pluginId: "verified-plugin",
      resolvedSource: "/workspace/plugin",
      claudeEvent: "PreToolUse",
      matcherKind: "tool-set",
      rawMatcher: "Read|Edit",
      handlerDecl: { type: "command", command: "echo mcp", if: "mcp__files__read" },
      declarationIndex: 3,
      predicateKind: "mcp-literal",
    },
  ];

  // act
  const parsed = parseHooksConfig(raw, compileContext, compileIfPredicate);
  if (!parsed.ok) {
    throw new Error(`fixture did not parse: ${parsed.reason}`);
  }

  addPluginConfigToCache(
    "project",
    "verified-marketplace",
    "verified-plugin",
    resolvedSource,
    parsed.value,
    parsed.ifPredicates,
  );
  rebuildRoutingTables();
  const rows = routingTableEntries().get("PreToolUse") ?? [];
  const actualRows = rows.map((row) => ({
    scope: row.scope,
    marketplace: row.marketplace,
    pluginId: row.pluginId,
    resolvedSource: row.resolvedSource,
    claudeEvent: row.claudeEvent,
    matcherKind: row.matcher.kind,
    rawMatcher: row.rawMatcher,
    handlerDecl: row.handlerDecl,
    declarationIndex: row.declarationIndex,
    predicateKind: row.ifPredicate.kind,
  }));

  // assert
  assert.deepStrictEqual(actualRows, expectedRows);
  assert.strictEqual(rows[0]?.ifPredicate, parsed.ifPredicates.get("PreToolUse|0|0"));
  assert.strictEqual(rows[1]?.ifPredicate, MATCH_ALL_IF);
  assert.strictEqual(rows[2]?.ifPredicate, parsed.ifPredicates.get("PreToolUse|1|0"));
  assert.strictEqual(rows[3]?.ifPredicate, parsed.ifPredicates.get("PreToolUse|1|1"));
});
