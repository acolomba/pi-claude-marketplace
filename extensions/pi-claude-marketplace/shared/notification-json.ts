import type { SerializedCauseChain } from "./errors.ts";
import type { NotificationPresentation } from "./notification-present.ts";
import type {
  ResolvedEnvelope,
  ResolvedFailure,
  ResolvedMarketplace,
  ResolvedRow,
  ResolvedTally,
} from "./notification-resolve.ts";
import type { RetainedWorkflowStaging } from "./notification-types.ts";
import type { NOTIFICATION_PAYLOAD_SCHEMA } from "./notification-wire.ts";
import type { Scope } from "./types.ts";
import type Type from "typebox";

/**
 * shared/notification-json.ts -- the JSON strategy, a format-only peer of the
 * text strategy (JOUT-02). It converts one presentation into a plain payload
 * whose type is the static type of the wire union.
 *
 * D-03: the payload is built field by field. No model object is spread into
 * it, so a model field the wire does not declare never reaches it.
 * WIRE-03 / D-02: closed-set tokens are copied verbatim, and token lists keep
 * the order resolve composed. WIRE-04: an optional field is absent when the
 * model has no value for it, never `undefined` or `null`, and every array is
 * copied in model order. D-12: nothing here validates a payload.
 */

/** Converts a presentation into its wire payload (JOUT-02, D-01..D-04). */
export function toWirePayload(
  presentation: NotificationPresentation,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA> {
  switch (presentation.kind) {
    case "cascade":
      return {
        schemaVersion: 1,
        kind: "cascade",
        ...wireEnvelope(presentation.envelope),
        ...noOpField(presentation.envelope.noOp),
        marketplaces: presentation.marketplaces.map((mp) => wireBlock(mp)),
        ...(presentation.advisories === undefined
          ? {}
          : { advisories: [...presentation.advisories] }),
        ...(presentation.retainedWorkflows === undefined
          ? {}
          : {
              retainedWorkflows: presentation.retainedWorkflows.map((workflow) =>
                wireRetainedWorkflow(workflow),
              ),
            }),
      };
    case "reconcile-applied-cascade":
      return {
        schemaVersion: 1,
        kind: "reconcile-applied-cascade",
        ...wireEnvelope(presentation.envelope),
        marketplaces: presentation.marketplaces.map((mp) => wireBlock(mp)),
      };
  }
}

/**
 * WIRE-05: `summary` rides warning and error envelopes only. It is the
 * envelope's resolved sentence, copied verbatim.
 */
function wireEnvelope(envelope: ResolvedEnvelope) {
  return {
    severity: envelope.severity,
    needsReload: envelope.needsReload,
    ...(envelope.severity === "info" ? {} : { summary: envelope.summary }),
    ...(envelope.tally === undefined ? {} : { tally: wireTally(envelope.tally) }),
  };
}

/** D-04: `noOp` is present only on a no-op cascade envelope. */
function noOpField(noOp: boolean): { readonly noOp?: true } {
  return noOp ? { noOp: true } : {};
}

function wireTally(tally: ResolvedTally) {
  return {
    label: tally.label,
    failures: tally.failures,
    warnings: tally.warnings,
    ...(tally.success === undefined
      ? {}
      : {
          success: {
            count: tally.success.count,
            ...(tally.success.verb === undefined ? {} : { verb: tally.success.verb }),
          },
        }),
  };
}

function wireRetainedWorkflow(workflow: RetainedWorkflowStaging) {
  return {
    name: workflow.name,
    ...(workflow.envelopeCount === undefined ? {} : { envelopeCount: workflow.envelopeCount }),
  };
}

/** WIRE-04: one block; `marketplaces: []` and `plugins: []` stay empty arrays. */
function wireBlock(mp: ResolvedMarketplace) {
  return {
    name: mp.name,
    scope: mp.scope,
    ...(mp.status === undefined ? {} : { status: mp.status }),
    ...("details" in mp
      ? {
          details: {
            autoupdate: mp.details.autoupdate,
            ...(mp.details.lastUpdatedAt === undefined
              ? {}
              : { lastUpdatedAt: mp.details.lastUpdatedAt }),
          },
        }
      : {}),
    ...("reasons" in mp ? { reasons: [...mp.reasons] } : {}),
    plugins: mp.plugins.map((row) => wireRow(row, mp)),
  };
}

/**
 * WIRE-04 / WIRE-06: one row. `id` is the row name, `@`, and the block name,
 * verbatim. `reasons` is always present. `missingPolicy` is resolve-internal
 * and has no wire field.
 */
function wireRow(row: ResolvedRow, mp: ResolvedMarketplace) {
  return {
    status: row.status,
    name: row.name,
    id: `${row.name}@${mp.name}`,
    reasons: [...row.reasons],
    ...wireScope(row, mp.scope),
    ...wireVersion(row),
    ...("description" in row ? { description: row.description } : {}),
    ...("partial" in row ? { partial: row.partial } : {}),
    ...(row.hint === undefined ? {} : { hint: row.hint }),
    ...(row.failure === undefined ? {} : wireFailure(row.failure)),
  };
}

/**
 * D-04: an install-scoped row carries its own scope, or the block's when it
 * has none. A catalogue row carries no scope; its block names it.
 */
function wireScope(row: ResolvedRow, blockScope: Scope): { readonly scope?: Scope } {
  switch (row.status) {
    case "installed":
    case "updated":
    case "reinstalled":
    case "uninstalled":
    case "disabled":
    case "upgradable":
    case "partially-installed":
    case "partially-upgradable":
    case "failed":
    case "skipped":
    case "manual recovery":
    case "will install":
    case "will uninstall":
    case "will enable":
    case "will disable":
      return { scope: ownScopeOr(row.scope, blockScope) };
    case "available":
    case "remote":
    case "unavailable":
    case "partially-available":
      return {};
  }
}

/** The row's own scope, or the block's when the row names none. */
function ownScopeOr(scope: Scope | undefined, blockScope: Scope): Scope {
  return scope ?? blockScope;
}

/**
 * D-04: the raw version, or `from` and `to` on an updated row. The groups
 * follow `pluginVersion`: a manual-recovery or pending row carries none.
 */
function wireVersion(row: ResolvedRow): {
  readonly version?: string;
  readonly from?: string;
  readonly to?: string;
} {
  switch (row.status) {
    case "installed":
    case "reinstalled":
    case "uninstalled":
    case "disabled":
    case "available":
    case "remote":
    case "unavailable":
    case "partially-available":
    case "upgradable":
    case "partially-installed":
    case "partially-upgradable":
    case "failed":
    case "skipped":
      return versionField(row.version);
    case "updated":
      return { from: row.from, to: row.to };
    case "manual recovery":
    case "will install":
    case "will uninstall":
    case "will enable":
    case "will disable":
      return {};
  }
}

function versionField(version: string | undefined): { readonly version?: string } {
  return version === undefined ? {} : { version };
}

/** D-11: the serialized failure detail resolve set on a row. */
function wireFailure(failure: ResolvedFailure) {
  return {
    ...(failure.cause === undefined ? {} : { cause: wireCause(failure.cause) }),
    leaks: [...failure.leaks],
    rollbackPartial: failure.rollbackPartial.map((entry) => ({
      phase: entry.phase,
      ...(entry.cause === undefined ? {} : { cause: wireCause(entry.cause) }),
    })),
  };
}

function wireCause(cause: SerializedCauseChain) {
  return { causeChain: [...cause.causeChain], truncated: cause.truncated };
}
