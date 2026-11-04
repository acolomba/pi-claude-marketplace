import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import { recordedMcpServers } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";

import type { LegacyServersReader } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts";
import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

function installRecord(resolvedSource = "/abs/plugin-root"): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: ["mcpServers"], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-11-04T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
  };
}

describe("recordedMcpServers", () => {
  test("MREC-01: returns the recorded servers and bundle without calling the legacy reader", async () => {
    // arrange
    const record: PluginInstallRecord = {
      ...installRecord(),
      mcpServerConfigs: [
        { name: "a", config: { command: "node", args: ["a.js"] } },
        { name: "b", config: { type: "http", url: "https://mcp.example.com" } },
      ],
      mcpBundle: true,
    };
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });

    // act
    const recorded = await recordedMcpServers(record, reader);

    // assert
    assert.deepStrictEqual(recorded, {
      kind: "recorded",
      servers: [
        { name: "a", config: { command: "node", args: ["a.js"] } },
        { name: "b", config: { type: "http", url: "https://mcp.example.com" } },
      ],
      bundle: true,
    });
    verify(reader);
  });

  test("MREC-01: reads a present empty list as no servers without calling the legacy reader", async () => {
    // arrange
    const record: PluginInstallRecord = { ...installRecord(), mcpServerConfigs: [] };
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });

    // act
    const recorded = await recordedMcpServers(record, reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "recorded", servers: [], bundle: false });
    verify(reader);
  });

  test("MREC-02: re-resolves a record that predates the field through the legacy reader", async () => {
    // arrange
    const record = installRecord();
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });
    when(() => reader(installRecord())).thenResolve({
      servers: [{ name: "a", config: { command: "node" } }],
      bundle: true,
    });

    // act
    const recorded = await recordedMcpServers(record, reader);

    // assert
    assert.deepStrictEqual(recorded, {
      kind: "re-resolved",
      servers: [{ name: "a", config: { command: "node" } }],
      bundle: true,
    });
    verify(reader);
  });

  test("MREC-02: reads a legacy reader that rejects as unreadable", async () => {
    // arrange
    const record = installRecord();
    const reader = mock<LegacyServersReader>({ exactParams: true, name: "legacy reader" });
    when(() => reader(installRecord())).thenReject(new Error("manifest gone"));

    // act
    const recorded = await recordedMcpServers(record, reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    verify(reader);
  });

  test("MREC-02: reads a legacy reader that throws as unreadable", async () => {
    // arrange
    const record = installRecord();
    const reader: LegacyServersReader = () => {
      throw new Error("plugin root gone");
    };

    // act
    const recorded = await recordedMcpServers(record, reader);

    // assert
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
  });
});
