import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  abortPreparedMcp,
  commitPreparedMcp,
  finalizeMcpReplacement,
  prepareStageMcpServers,
  replacePreparedMcp,
  resolvePluginMcpServers,
  rollbackMcpReplacement,
  unstageMcpServers,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/index.ts";
import type {
  McpReplacement,
  PreparedMcpStaging,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/index.ts";
import {
  abortPreparedMcp as peerAbortPreparedMcp,
  commitPreparedMcp as peerCommitPreparedMcp,
  finalizeMcpReplacement as peerFinalizeMcpReplacement,
  prepareStageMcpServers as peerPrepareStageMcpServers,
  replacePreparedMcp as peerReplacePreparedMcp,
  rollbackMcpReplacement as peerRollbackMcpReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/stage.ts";
import { resolvePluginMcpServers as peerResolvePluginMcpServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/parse.ts";
import type {
  McpReplacement as PeerMcpReplacement,
  PreparedMcpStaging as PeerPreparedMcpStaging,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/types.ts";
import { unstageMcpServers as peerUnstageMcpServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/unstage.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type PreparedNoop = Extract<PreparedMcpStaging, { kind: "noop" }>;
type PreparedStaged = Extract<PreparedMcpStaging, { kind: "staged" }>;
type ReplacementNoop = Extract<McpReplacement, { kind: "noop" }>;
type ReplacementReplaced = Extract<McpReplacement, { kind: "replaced" }>;

void (true satisfies Same<PreparedMcpStaging, PeerPreparedMcpStaging>);
void (true satisfies Same<McpReplacement, PeerMcpReplacement>);
void (true satisfies Same<PreparedNoop["kind"], "noop">);
void (true satisfies Same<PreparedStaged["kind"], "staged">);
void (true satisfies Same<ReplacementNoop["prepared"], PreparedNoop>);
void (true satisfies Same<ReplacementReplaced["prepared"], PreparedStaged>);
void (true satisfies Same<keyof ReplacementNoop, "kind" | "prepared">);
void (true satisfies Same<keyof ReplacementReplaced, "kind" | "prepared">);

describe("MCP barrel runtime bindings", () => {
  test("re-exports abortPreparedMcp from the stage module", () => {
    // arrange
    const expectedAbortPreparedMcp = peerAbortPreparedMcp;

    // act
    const boundaryAbortPreparedMcp = abortPreparedMcp;

    // assert
    assert.strictEqual(boundaryAbortPreparedMcp, expectedAbortPreparedMcp);
  });

  test("re-exports commitPreparedMcp from the stage module", () => {
    // arrange
    const expectedCommitPreparedMcp = peerCommitPreparedMcp;

    // act
    const boundaryCommitPreparedMcp = commitPreparedMcp;

    // assert
    assert.strictEqual(boundaryCommitPreparedMcp, expectedCommitPreparedMcp);
  });

  test("re-exports finalizeMcpReplacement from the stage module", () => {
    // arrange
    const expectedFinalizeMcpReplacement = peerFinalizeMcpReplacement;

    // act
    const boundaryFinalizeMcpReplacement = finalizeMcpReplacement;

    // assert
    assert.strictEqual(boundaryFinalizeMcpReplacement, expectedFinalizeMcpReplacement);
  });

  test("re-exports prepareStageMcpServers from the stage module", () => {
    // arrange
    const expectedPrepareStageMcpServers = peerPrepareStageMcpServers;

    // act
    const boundaryPrepareStageMcpServers = prepareStageMcpServers;

    // assert
    assert.strictEqual(boundaryPrepareStageMcpServers, expectedPrepareStageMcpServers);
  });

  test("re-exports replacePreparedMcp from the stage module", () => {
    // arrange
    const expectedReplacePreparedMcp = peerReplacePreparedMcp;

    // act
    const boundaryReplacePreparedMcp = replacePreparedMcp;

    // assert
    assert.strictEqual(boundaryReplacePreparedMcp, expectedReplacePreparedMcp);
  });

  test("re-exports rollbackMcpReplacement from the stage module", () => {
    // arrange
    const expectedRollbackMcpReplacement = peerRollbackMcpReplacement;

    // act
    const boundaryRollbackMcpReplacement = rollbackMcpReplacement;

    // assert
    assert.strictEqual(boundaryRollbackMcpReplacement, expectedRollbackMcpReplacement);
  });

  test("re-exports unstageMcpServers from the unstage module", () => {
    // arrange
    const expectedUnstageMcpServers = peerUnstageMcpServers;

    // act
    const boundaryUnstageMcpServers = unstageMcpServers;

    // assert
    assert.strictEqual(boundaryUnstageMcpServers, expectedUnstageMcpServers);
  });

  test("re-exports resolvePluginMcpServers from the parse module", () => {
    // arrange
    const expectedResolvePluginMcpServers = peerResolvePluginMcpServers;

    // act
    const boundaryResolvePluginMcpServers = resolvePluginMcpServers;

    // assert
    assert.strictEqual(boundaryResolvePluginMcpServers, expectedResolvePluginMcpServers);
  });
});
