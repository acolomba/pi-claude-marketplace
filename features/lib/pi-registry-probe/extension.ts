/**
 * @fileoverview The registry probe: a Pi extension that reports Pi's tools
 * and slash commands as a custom entry, so a step reads Pi's registries
 * without a model (D-CF1-17, HAR-04).
 *
 * Every profile Pi loads this file with `--extension`. Its command appends
 * one entry with every tool, the active tool names, and every slash command,
 * each projected to plain JSON records in Pi's order. It filters nothing and
 * removes no duplicate, so a step sees exactly what Pi offers.
 */

import { REGISTRY_PROBE_COMMAND, REGISTRY_PROBE_ENTRY } from "./snapshot.ts";

import type { RegistrySnapshot } from "./snapshot.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function snapshotOf(pi: ExtensionAPI): RegistrySnapshot {
  return {
    allTools: pi.getAllTools().map((tool) => ({
      name: tool.name,
      source: tool.sourceInfo.source,
      path: tool.sourceInfo.path,
    })),
    activeTools: pi.getActiveTools(),
    commands: pi.getCommands().map((command) => ({
      name: command.name,
      description: command.description ?? null,
      source: command.source,
      path: command.sourceInfo.path,
    })),
  };
}

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function registryProbe(pi: ExtensionAPI): void {
  pi.registerCommand(REGISTRY_PROBE_COMMAND, {
    description: "Report Pi's tools and slash commands for the behavioral tests.",
    handler: () => {
      pi.appendEntry(REGISTRY_PROBE_ENTRY, snapshotOf(pi));
      return Promise.resolve();
    },
  });
}
