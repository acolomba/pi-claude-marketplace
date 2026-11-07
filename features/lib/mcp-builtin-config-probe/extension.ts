/**
 * @fileoverview The built-in MCP config probe: a Pi extension that reports
 * the config of every MCP server an extension registered with Pi, as a custom
 * entry, so a step reads the values Pi holds for a plugin server (BLT-02,
 * P2-DC-17).
 *
 * A profile Pi loads this file through `extraExtensions` (P2-DC-24). Its
 * command appends one entry with each registered server's name and whole
 * config, in Pi's order. It filters nothing, so a step sees exactly what Pi
 * holds.
 */

import { MCP_BUILTIN_CONFIG_PROBE_COMMAND, MCP_BUILTIN_CONFIG_PROBE_ENTRY } from "./snapshot.ts";

import type { RegisteredConfigs } from "./snapshot.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function registeredConfigsOf(pi: ExtensionAPI): RegisteredConfigs {
  return pi.getMcpServers().map((server) => ({ name: server.name, config: { ...server.config } }));
}

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function mcpBuiltinConfigProbe(pi: ExtensionAPI): void {
  pi.registerCommand(MCP_BUILTIN_CONFIG_PROBE_COMMAND, {
    description:
      "Report the config of every MCP server registered with Pi for the behavioral tests.",
    handler: () => {
      pi.appendEntry(MCP_BUILTIN_CONFIG_PROBE_ENTRY, registeredConfigsOf(pi));
      return Promise.resolve();
    },
  });
}
