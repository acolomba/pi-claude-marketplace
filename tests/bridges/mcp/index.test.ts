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
import {
  abortPreparedMcp as peerAbortPreparedMcp,
  commitPreparedMcp as peerCommitPreparedMcp,
  finalizeMcpReplacement as peerFinalizeMcpReplacement,
  prepareStageMcpServers as peerPrepareStageMcpServers,
  replacePreparedMcp as peerReplacePreparedMcp,
  rollbackMcpReplacement as peerRollbackMcpReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/stage.ts";
import { resolvePluginMcpServers as peerResolvePluginMcpServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/parse.ts";
import { unstageMcpServers as peerUnstageMcpServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/unstage.ts";

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
