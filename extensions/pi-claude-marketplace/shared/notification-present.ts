import { serializeCauseChain } from "./errors.ts";
import {
  CENTRAL_ROW_POLICY,
  resolveEnvelope,
  resolveNotAddedReason,
  resolveRows,
  resolveUpdateNoOpEnvelope,
} from "./notification-resolve.ts";
import { redactCauseChain } from "./redact-absolute-paths.ts";
import { redactCredentials } from "./redact-credentials.ts";

import type { SerializedCauseChain } from "./errors.ts";
import type {
  ResolvedEnvelope,
  ResolvedMarketplace,
  RowPolicyMap,
} from "./notification-resolve.ts";
import type { NotificationRun, NotificationSnapshot } from "./notification-run.ts";
import type {
  CascadeNotificationMessage,
  MarketplaceInfoCascadeMessage,
  MarketplaceInfoMessage,
  MarketplaceNotAddedMessage,
  NotificationMessage,
  PluginInfoCascadeMessage,
  PluginInfoMessage,
  PruneEmptyMessage,
  Reason,
  ReconcileAppliedCascadeMessage,
  ReconcilePendingEmptyMessage,
  RetainedWorkflowStaging,
} from "./notification-types.ts";
import type { Scope } from "./types.ts";

/**
 * shared/notification-present.ts -- the presentation step (JOUT-02, PMOD-01,
 * PMOD-03). Each emission entry point resolves its rows and envelope once into
 * one value that both strategies format: the text strategy in
 * notification-dispatch.ts and the JSON strategy in notification-json.ts. No
 * live `Error` crosses it; resolve has already serialized every cause.
 *
 * PMOD-04 / D-07: the free-text fields resolve does not reach are redacted
 * here, so neither strategy reads a credential: a url-source marketplace
 * `url`, advisory lines, plugin-info names and `notes`, and the marketplace-not-added
 * `name`, the marketplace name the user typed.
 */

/** A resolved cascade: its envelope, its blocks, and its advisory lines. */
export interface CascadePresentation {
  readonly kind: "cascade";
  readonly envelope: ResolvedEnvelope;
  readonly marketplaces: readonly ResolvedMarketplace[];
  readonly advisories?: readonly string[];
  readonly retainedWorkflows?: readonly RetainedWorkflowStaging[];
}

/** RECON-04: a resolved reconcile-applied cascade. It carries no advisory lines. */
export interface ReconcileAppliedPresentation {
  readonly kind: "reconcile-applied-cascade";
  readonly envelope: ResolvedEnvelope;
  readonly marketplaces: readonly ResolvedMarketplace[];
}

/**
 * The union of every structured presentation: one member per
 * `NotificationMessage` kind. An info kind carries its resolved envelope and
 * its model message, which holds no live `Error`. The not-added kind adds its
 * resolved reason. The committed prune warning carries its scope and its
 * serialized cause instead of the message, whose `cause` is a live `Error`.
 */
export type NotificationPresentation =
  | CascadePresentation
  | ReconcileAppliedPresentation
  | {
      readonly kind: "marketplace-info";
      readonly envelope: ResolvedEnvelope;
      readonly message: MarketplaceInfoMessage;
    }
  | {
      readonly kind: "plugin-info";
      readonly envelope: ResolvedEnvelope;
      readonly message: PluginInfoMessage;
    }
  | {
      readonly kind: "marketplace-info-cascade";
      readonly envelope: ResolvedEnvelope;
      readonly message: MarketplaceInfoCascadeMessage;
    }
  | {
      readonly kind: "plugin-info-cascade";
      readonly envelope: ResolvedEnvelope;
      readonly message: PluginInfoCascadeMessage;
    }
  | {
      readonly kind: "marketplace-not-added";
      readonly envelope: ResolvedEnvelope;
      readonly message: MarketplaceNotAddedMessage;
      readonly reason: Reason;
    }
  | {
      readonly kind: "reconcile-pending-empty";
      readonly envelope: ResolvedEnvelope;
      readonly message: ReconcilePendingEmptyMessage;
    }
  | {
      readonly kind: "prune-empty";
      readonly envelope: ResolvedEnvelope;
      readonly message: PruneEmptyMessage;
    }
  | {
      readonly kind: "prune-committed-warning";
      readonly envelope: ResolvedEnvelope;
      readonly scope: Scope;
      readonly cause?: SerializedCauseChain;
    };

/**
 * JOUT-02 / PMOD-01: the total presentation of `message`, resolved once for
 * both strategies. A cascade and an applied reconcile resolve their rows under
 * the central row policy. Every other kind does its own reads first, then
 * resolves its envelope: the not-added reason, and the committed prune
 * warning's cause, serialized once over its redacted chain (NFR-9), so no
 * live `Error` crosses the presentation.
 */
export function presentNotification(
  run: NotificationRun,
  message: NotificationMessage,
): NotificationPresentation {
  switch (message.kind) {
    case "reconcile-applied-cascade":
      return presentReconcileApplied(run, message, CENTRAL_ROW_POLICY);
    case "marketplace-info":
      return {
        kind: "marketplace-info",
        envelope: resolveEnvelope(message),
        message: redactMarketplaceInfo(message),
      };
    case "plugin-info":
      return {
        kind: "plugin-info",
        envelope: resolveEnvelope(message),
        message: redactPluginInfo(message),
      };
    case "marketplace-info-cascade":
      return {
        kind: "marketplace-info-cascade",
        envelope: resolveEnvelope(message),
        message: { ...message, blocks: redactBlocks(message.blocks, redactMarketplaceInfo) },
      };
    case "plugin-info-cascade":
      return {
        kind: "plugin-info-cascade",
        envelope: resolveEnvelope(message),
        message: { ...message, blocks: redactBlocks(message.blocks, redactPluginInfo) },
      };
    case "reconcile-pending-empty":
      return {
        kind: "reconcile-pending-empty",
        envelope: resolveEnvelope(message),
        message:
          message.advisories === undefined
            ? message
            : { ...message, advisories: redactLines(message.advisories) },
      };
    case "prune-empty":
      return { kind: "prune-empty", envelope: resolveEnvelope(message), message };
    case "marketplace-not-added": {
      const reason = resolveNotAddedReason(message);

      return {
        kind: "marketplace-not-added",
        envelope: resolveEnvelope(message),
        message: { ...message, name: redactCredentials(message.name) },
        reason,
      };
    }

    case "prune-committed-warning": {
      const cause = serializeCauseChain(redactCauseChain(message.cause));

      return {
        kind: "prune-committed-warning",
        envelope: resolveEnvelope(message),
        scope: message.scope,
        ...(cause === undefined ? {} : { cause }),
      };
    }

    case undefined:
    case "cascade":
      // The cascade arm presents after the switch, where `message` is
      // narrowed to the cascade message.
      break;
  }

  return presentCascade(run, message, CENTRAL_ROW_POLICY);
}

/**
 * PMOD-04: redact stored names and URL userinfo before either renderer reads
 * them. Keep the original message when neither field changes.
 */
function redactMarketplaceInfo(message: MarketplaceInfoMessage): MarketplaceInfoMessage {
  const name = redactCredentials(message.name);
  if (message.source.sourceKind !== "url") {
    return name === message.name ? message : { ...message, name };
  }

  const url = redactCredentials(message.source.url);
  if (name === message.name && url === message.source.url) {
    return message;
  }

  return { ...message, name, source: { ...message.source, url } };
}

/**
 * PMOD-04: names can carry stored credentials, and notes can quote a thrown
 * message. Redact both before either renderer reads them. Keep the original
 * message when no field changes.
 */
function redactPluginInfo(message: PluginInfoMessage): PluginInfoMessage {
  const { plugin } = message;
  const marketplaceName = redactCredentials(message.marketplaceName);
  const name = redactCredentials(plugin.name);
  const notesUnchanged =
    plugin.notes === undefined || plugin.notes.every((note) => redactCredentials(note) === note);
  if (marketplaceName === message.marketplaceName && name === plugin.name && notesUnchanged) {
    return message;
  }

  return {
    ...message,
    marketplaceName,
    plugin: {
      ...plugin,
      name,
      ...(plugin.notes === undefined ? {} : { notes: redactLines(plugin.notes) }),
    },
  };
}

/** Redacts each block of a non-empty info fan-out and keeps the order. */
function redactBlocks<Block>(
  blocks: readonly [Block, ...Block[]],
  redact: (block: Block) => Block,
): readonly [Block, ...Block[]] {
  const [first, ...rest] = blocks;
  return [redact(first), ...rest.map((block) => redact(block))];
}

/** PMOD-04: redacts each free-text line and keeps the order. */
function redactLines(lines: readonly string[]): readonly string[] {
  return lines.map((line) => redactCredentials(line));
}

/**
 * Presents a cascade under `rowPolicies` and the run's soft-dependency
 * snapshot. The rows resolve before the envelope: `resolveRows` floors the
 * severity of a row with no policy, and the envelope reads that severity.
 */
export function presentCascade(
  run: NotificationSnapshot,
  message: CascadeNotificationMessage,
  rowPolicies: RowPolicyMap,
): CascadePresentation {
  const marketplaces = resolveRows(message.marketplaces, run.softDeps, rowPolicies);
  const envelope = resolveEnvelope(message);
  return {
    kind: "cascade",
    envelope,
    marketplaces,
    ...(message.advisories === undefined ? {} : { advisories: redactLines(message.advisories) }),
    ...(message.retainedWorkflows === undefined
      ? {}
      : { retainedWorkflows: message.retainedWorkflows }),
  };
}

/**
 * UGRM-01: presents a bulk update that realized no transition. The rows resolve
 * before the envelope. The no-op envelope carries `noOp`, no tally, and no
 * reload trailer, and the presentation carries no advisory lines or retained
 * workflows.
 */
export function presentUpdateNoOp(
  run: NotificationRun,
  message: CascadeNotificationMessage,
  rowPolicies: RowPolicyMap,
): CascadePresentation {
  const marketplaces = resolveRows(message.marketplaces, run.softDeps, rowPolicies);
  const envelope = resolveUpdateNoOpEnvelope(message);
  return { kind: "cascade", envelope, marketplaces };
}

/**
 * RECON-04: presents an applied load-time reconcile under `rowPolicies`. The
 * rows resolve before the envelope, as in `presentCascade`.
 */
export function presentReconcileApplied(
  run: NotificationRun,
  message: ReconcileAppliedCascadeMessage,
  rowPolicies: RowPolicyMap,
): ReconcileAppliedPresentation {
  const marketplaces = resolveRows(message.marketplaces, run.softDeps, rowPolicies);
  const envelope = resolveEnvelope(message);
  return { kind: "reconcile-applied-cascade", envelope, marketplaces };
}
