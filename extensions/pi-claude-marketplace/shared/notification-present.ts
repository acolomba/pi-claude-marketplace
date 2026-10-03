import { resolveEnvelope, resolveRows } from "./notification-resolve.ts";

import type {
  ResolvedEnvelope,
  ResolvedMarketplace,
  RowPolicyMap,
} from "./notification-resolve.ts";
import type { NotificationRun } from "./notification-run.ts";
import type { CascadeNotificationMessage, RetainedWorkflowStaging } from "./notification-types.ts";

/**
 * shared/notification-present.ts -- the presentation step (JOUT-02, PMOD-01,
 * PMOD-03). Each emission entry point resolves its rows and envelope once into
 * one value that both strategies format: the text strategy in
 * notification-dispatch.ts and the JSON strategy in notification-json.ts. No
 * live `Error` crosses it; resolve has already serialized every cause.
 */

/** A resolved cascade: its envelope, its blocks, and its advisory lines. */
export interface CascadePresentation {
  readonly kind: "cascade";
  readonly envelope: ResolvedEnvelope;
  readonly marketplaces: readonly ResolvedMarketplace[];
  readonly advisories?: readonly string[];
  readonly retainedWorkflows?: readonly RetainedWorkflowStaging[];
}

/**
 * The union of every structured presentation. Each emission entry point that
 * gains a presentation widens it.
 */
export type NotificationPresentation = CascadePresentation;

/**
 * Presents a cascade under `rowPolicies` and the run's soft-dependency
 * snapshot. The rows resolve before the envelope: `resolveRows` floors the
 * severity of a row with no policy, and the envelope reads that severity.
 */
export function presentCascade(
  run: NotificationRun,
  message: CascadeNotificationMessage,
  rowPolicies: RowPolicyMap,
): CascadePresentation {
  const marketplaces = resolveRows(message.marketplaces, run.softDeps, rowPolicies);
  const envelope = resolveEnvelope(message);
  return {
    kind: "cascade",
    envelope,
    marketplaces,
    ...(message.advisories === undefined ? {} : { advisories: message.advisories }),
    ...(message.retainedWorkflows === undefined
      ? {}
      : { retainedWorkflows: message.retainedWorkflows }),
  };
}
