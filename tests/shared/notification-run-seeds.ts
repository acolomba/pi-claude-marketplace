import type { SoftDepStatus } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

/** Returns a fresh notification run whose snapshot is `softDeps`. */
export function runWithSoftDeps(softDeps: SoftDepStatus): NotificationRun {
  return { softDeps: { ...softDeps } };
}

/** Returns a fresh notification run whose snapshot reports no companion loaded. */
export function runWithNothingLoaded(): NotificationRun {
  return {
    softDeps: { piSubagentsLoaded: false, piMcpAdapterLoaded: false, workflowEngineLoaded: false },
  };
}

/** Returns a fresh notification run whose snapshot reports every companion loaded. */
export function runWithAllLoaded(): NotificationRun {
  return {
    softDeps: { piSubagentsLoaded: true, piMcpAdapterLoaded: true, workflowEngineLoaded: true },
  };
}
