import type { SoftDepStatus } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

/** Returns a fresh notification run whose snapshot is `softDeps`. */
export function runWithSoftDeps(softDeps: SoftDepStatus): NotificationRun {
  return {
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    commandState: { hasOutcome: false, needsReload: false, settled: false, delivery: "open" },
    softDeps: { ...softDeps },
    entrySink: {
      appendEntry(): never {
        throw new Error("A text-only notification run cannot append entries");
      },
    },
  };
}

/** Returns a fresh notification run whose snapshot reports no companion loaded. */
export function runWithNothingLoaded(): NotificationRun {
  return runWithSoftDeps({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  });
}

/** Returns a fresh notification run whose snapshot reports every companion loaded. */
export function runWithAllLoaded(): NotificationRun {
  return runWithSoftDeps({
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: true,
  });
}
