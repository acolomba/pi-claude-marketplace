// orchestrators/plugin/staging-diagnostics.ts
//
// The staging-diagnostic renderer every staging verb and cascade calls after
// its rows (D-PL1-07). A LEAF module: it imports only the shared notify,
// redaction and staging-warning vocabulary, so `marketplace/update.messaging.ts`
// can reach it without pulling the `plugin/shared.ts` hub graph under a
// marketplace ledger (D-v1.0-01-11).

import { notifyDiagnostic } from "../../shared/notification-dispatch.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { partitionStagingWarnings } from "../../shared/staging-warnings.ts";

import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { DiscoveryWarning, StagingWarning } from "../../shared/staging-warnings.ts";
import type { Scope } from "../../shared/types.ts";

/** One plugin's staging warnings, both halves, under the verb that staged them. */
export interface StagingDiagnostic {
  readonly plugin: string;
  readonly scope: Scope;
  /** D-PL1-06: the seven staging verbs. */
  readonly verb:
    | "installed"
    | "updated"
    | "reinstalled"
    | "enabled"
    | "install failed"
    | "update failed"
    | "reinstall failed";
  readonly warnings: readonly StagingWarning[];
}

/**
 * D-PL1-07: the one placement rule every staging verb and cascade calls after
 * its own rows and before its MCP config notices. Each entry renders as one
 * diagnostic, in entry order, and an entry with no discovery warning renders
 * nothing.
 *
 * D-PL1-08: it shows the discovery half only. The hygiene half stays on the
 * orchestrated payload (D-19-01).
 */
export function surfaceStagingDiagnostics(
  ctx: NotificationContext,
  run: NotificationRun,
  diagnostics: readonly StagingDiagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    surfaceDiscoveryWarnings(ctx, run, {
      ...diagnostic,
      warnings: partitionStagingWarnings(diagnostic.warnings).discovery,
    });
  }
}

/**
 * D-141-03 / D-141-05: render the discovery half to a standalone user, after
 * the verb's own row.
 *
 * The seam is `notifyDiagnostic`, the same sanctioned second-notify channel
 * the reconcile pass uses; the verb's row itself stays exactly one
 * `MarketplaceNotificationMessage` (IL-2).
 *
 * NFR-9: a discovery warning embeds the absolute component directory it
 * walked, so it goes through `redactAbsolutePaths` before it reaches the
 * user, exactly as the reconcile composer does.
 *
 * WGATE-01: the header counts the lines and states nothing about what became
 * of the components they name. It cannot: two of the families routed into this
 * array report a component that WAS materialized -- a workflow script the host
 * engine will refuse to load, and one that installs under a name it does not
 * declare -- so a header claiming a disposal would contradict the lines
 * directly beneath it. "Note" is the word the read-only `info` surface already
 * prints for the same facts, so the two surfaces name them the same way.
 *
 * D-PL1-05: the header names the plugin's scope in brackets, as the row
 * grammar `<name> [scope]` does. D-PL1-06: the verb is one of the seven
 * staging verbs.
 *
 * D-PL1-04: `warnings` takes discovery warnings only, so a hygiene warning
 * cannot reach a standalone diagnostic without a compile error.
 */
export function surfaceDiscoveryWarnings(
  ctx: NotificationContext,
  run: NotificationRun,
  args: Omit<StagingDiagnostic, "warnings"> & { readonly warnings: readonly DiscoveryWarning[] },
): void {
  if (args.warnings.length === 0) {
    return;
  }

  const lines = args.warnings.map((w) => redactAbsolutePaths(w.message));
  const subject = `Plugin "${args.plugin}" [${args.scope}] ${args.verb}`;
  const header =
    lines.length === 1
      ? `${subject}; 1 declared component has a note.`
      : `${subject}; ${lines.length.toString()} declared components have notes.`;
  notifyDiagnostic(ctx, run, header, lines);
}
