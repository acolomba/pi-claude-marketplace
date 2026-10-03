import { RAW_SURFACE_SEVERITY } from "./notification-resolve.ts";

import type { HookSummaryEntry } from "./concerns/hooks.ts";
import type { SerializedCauseChain } from "./errors.ts";
import type { CascadePresentation, NotificationPresentation } from "./notification-present.ts";
import type {
  ResolvedEnvelope,
  ResolvedFailure,
  ResolvedMarketplace,
  ResolvedRawSurface,
  ResolvedRow,
  ResolvedTally,
} from "./notification-resolve.ts";
import type {
  MarketplaceDetails,
  MarketplaceInfoMessage,
  PluginInfoComponentsResolved,
  PluginInfoMessage,
  PluginInfoRow,
  PluginStatus,
  RetainedWorkflowStaging,
} from "./notification-types.ts";
import type { CASCADE_PAYLOAD_SCHEMA, NOTIFICATION_PAYLOAD_SCHEMA } from "./notification-wire.ts";
import type { Scope } from "./types.ts";
import type Type from "typebox";

/**
 * shared/notification-json.ts -- the JSON strategy, a format-only peer of the
 * text strategy (JOUT-02). It converts one presentation, or one resolved raw
 * surface, into a plain payload whose type is the static type of the wire
 * union.
 *
 * D-03: the payload is built field by field. No model object is spread into
 * it, so a model field the wire does not declare never reaches it.
 * WIRE-03 / D-02: closed-set tokens are copied verbatim, and token lists keep
 * the order resolve composed. WIRE-04: an optional field is absent when the
 * model has no value for it, never `undefined` or `null`, and every array is
 * copied in model order. D-12: nothing here validates a payload.
 */

/**
 * Converts a presentation or a resolved raw surface into its wire payload
 * (JOUT-02, D-01..D-04). A cascade presentation yields the cascade payload, so
 * a caller reads its `marketplaces` without a branch.
 */
export function toWirePayload(
  presentation: CascadePresentation,
): Type.Static<typeof CASCADE_PAYLOAD_SCHEMA>;
export function toWirePayload(
  source: NotificationPresentation | ResolvedRawSurface,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA>;
export function toWirePayload(
  source: NotificationPresentation | ResolvedRawSurface,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA> {
  return "envelope" in source ? wirePresentation(source) : wireRawSurface(source);
}

/** JOUT-02: the payload of one structured presentation, one arm per kind. */
function wirePresentation(
  presentation: NotificationPresentation,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA> {
  switch (presentation.kind) {
    case "cascade":
      return wireCascade(presentation);
    case "reconcile-applied-cascade":
      return {
        schemaVersion: 1,
        kind: "reconcile-applied-cascade",
        ...wireEnvelope(presentation.envelope),
        ...wireTallyField(presentation.envelope),
        marketplaces: presentation.marketplaces.map((mp) => wireBlock(mp)),
      };
    case "marketplace-info":
      return {
        schemaVersion: 1,
        kind: "marketplace-info",
        ...wireEnvelope(presentation.envelope),
        ...wireMarketplaceInfo(presentation.message),
      };
    case "plugin-info":
      return {
        schemaVersion: 1,
        kind: "plugin-info",
        ...wireEnvelope(presentation.envelope),
        ...wirePluginInfo(presentation.message),
      };
    case "marketplace-info-cascade":
      return {
        schemaVersion: 1,
        kind: "marketplace-info-cascade",
        ...wireEnvelope(presentation.envelope),
        blocks: presentation.message.blocks.map((block) => wireMarketplaceInfo(block)),
      };
    case "plugin-info-cascade":
      return {
        schemaVersion: 1,
        kind: "plugin-info-cascade",
        ...wireEnvelope(presentation.envelope),
        blocks: presentation.message.blocks.map((block) => wirePluginInfo(block)),
      };
    case "marketplace-not-added":
      return {
        schemaVersion: 1,
        kind: "marketplace-not-added",
        ...wireEnvelope(presentation.envelope),
        name: presentation.message.name,
        ...(presentation.message.scope === undefined ? {} : { scope: presentation.message.scope }),
        reasons: [presentation.reason],
      };
    case "reconcile-pending-empty":
      return {
        schemaVersion: 1,
        kind: "reconcile-pending-empty",
        ...wireEnvelope(presentation.envelope),
        ...wireAdvisories(presentation.message),
      };
    case "prune-empty":
      return {
        schemaVersion: 1,
        kind: "prune-empty",
        ...wireEnvelope(presentation.envelope),
        scope: presentation.message.scope,
      };
    case "prune-committed-warning":
      return {
        schemaVersion: 1,
        kind: "prune-committed-warning",
        ...wireEnvelope(presentation.envelope),
        scope: presentation.scope,
        ...(presentation.cause === undefined ? {} : { cause: wireCause(presentation.cause) }),
      };
  }
}

/**
 * D-01 / D-02: the payload of one resolved raw surface. Its severity comes from
 * `RAW_SURFACE_SEVERITY`, the table the text strategy reads (PMOD-01). A raw
 * kind never needs a reload and carries no `summary`; the rewake summary is
 * copied verbatim into `text` (D-08).
 */
function wireRawSurface(
  surface: ResolvedRawSurface,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA> {
  const envelope = {
    schemaVersion: 1,
    severity: RAW_SURFACE_SEVERITY[surface.kind],
    needsReload: false,
  } as const;

  switch (surface.kind) {
    case "usage-error":
      return { ...envelope, kind: surface.kind, message: surface.message, usage: surface.usage };
    case "usage-info":
      return { ...envelope, kind: surface.kind, usage: surface.usage };
    case "diagnostic":
      return { ...envelope, kind: surface.kind, header: surface.header, lines: [...surface.lines] };
    case "device-flow-prompt":
      return {
        ...envelope,
        kind: surface.kind,
        verificationUri: surface.verificationUri,
        userCode: surface.userCode,
      };
    case "async-rewake-summary":
      return { ...envelope, kind: surface.kind, text: surface.summary };
    case "stop-override-cap":
      return { ...envelope, kind: surface.kind, pluginId: surface.pluginId, cap: surface.cap };
    case "reconcile-aborted":
      return { ...envelope, kind: surface.kind, causeMessage: surface.causeMessage };
    case "plugin-path-skipped":
      return { ...envelope, kind: surface.kind, scope: surface.scope, reason: surface.reason };
  }
}

/** D-04: the cascade payload, with its advisory lines and retained workflows. */
function wireCascade(
  presentation: CascadePresentation,
): Type.Static<typeof CASCADE_PAYLOAD_SCHEMA> {
  return {
    schemaVersion: 1,
    kind: "cascade",
    ...wireEnvelope(presentation.envelope),
    ...wireTallyField(presentation.envelope),
    ...noOpField(presentation.envelope.noOp),
    marketplaces: presentation.marketplaces.map((mp) => wireBlock(mp)),
    ...wireAdvisories(presentation),
  };
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
  };
}

/** OUT-03: the tally of a cascade-family envelope, when it carries one. */
function wireTallyField(envelope: ResolvedEnvelope) {
  return envelope.tally === undefined ? {} : { tally: wireTally(envelope.tally) };
}

/** WR-06: the advisory lines and retained workflows, each when present. */
function wireAdvisories(carrier: {
  readonly advisories?: readonly string[];
  readonly retainedWorkflows?: readonly RetainedWorkflowStaging[];
}) {
  return {
    ...(carrier.advisories === undefined ? {} : { advisories: [...carrier.advisories] }),
    ...(carrier.retainedWorkflows === undefined
      ? {}
      : {
          retainedWorkflows: carrier.retainedWorkflows.map((workflow) =>
            wireRetainedWorkflow(workflow),
          ),
        }),
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
    ...("details" in mp ? { details: wireDetails(mp.details) } : {}),
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

/** WIRE-04: a marketplace's details; `lastUpdatedAt` whenever the model has it. */
function wireDetails(details: MarketplaceDetails) {
  return {
    autoupdate: details.autoupdate,
    ...(details.lastUpdatedAt === undefined ? {} : { lastUpdatedAt: details.lastUpdatedAt }),
  };
}

/**
 * D-04: the marketplace-info body. The source arm follows `sourceKind`; a path
 * source keeps the absolute path its text line shows.
 */
function wireMarketplaceInfo(message: MarketplaceInfoMessage) {
  return {
    name: message.name,
    scope: message.scope,
    details: wireDetails(message.details),
    source: wireSource(message.source),
    ...(message.description === undefined ? {} : { description: message.description }),
    ...(message.allowedMarketplaces === undefined
      ? {}
      : { allowedMarketplaces: [...message.allowedMarketplaces] }),
  };
}

function wireSource(source: MarketplaceInfoMessage["source"]) {
  switch (source.sourceKind) {
    case "github":
      return {
        sourceKind: source.sourceKind,
        owner: source.owner,
        repo: source.repo,
        ...refField(source.ref),
      };
    case "url":
      return { sourceKind: source.sourceKind, url: source.url, ...refField(source.ref) };
    case "path":
      return { sourceKind: source.sourceKind, absPath: source.absPath };
  }
}

function refField(ref: string | undefined): { readonly ref?: string } {
  return ref === undefined ? {} : { ref };
}

/** D-04: the plugin-info body: the marketplace header facts and the row. */
function wirePluginInfo(message: PluginInfoMessage) {
  return {
    marketplaceName: message.marketplaceName,
    marketplaceScope: message.marketplaceScope,
    marketplaceDetails: wireDetails(message.marketplaceDetails),
    plugin: wirePluginInfoRow(message.plugin, message),
  };
}

/**
 * WIRE-04 / WIRE-06: one plugin-info row. `id` is the plugin name, `@`, and the
 * marketplace name. `componentsResolved` selects the arm; only a resolved row
 * carries `components`.
 */
function wirePluginInfoRow(plugin: PluginInfoRow, message: PluginInfoMessage) {
  const fields = {
    status: plugin.status,
    name: plugin.name,
    id: `${plugin.name}@${message.marketplaceName}`,
    reasons: plugin.reasons === undefined ? [] : [...plugin.reasons],
    ...wireScope(plugin, message.marketplaceScope),
    ...versionField(plugin.version),
    ...(plugin.description === undefined ? {} : { description: plugin.description }),
    ...(plugin.notes === undefined ? {} : { notes: [...plugin.notes] }),
    ...(plugin.dependencies === undefined ? {} : { dependencies: [...plugin.dependencies] }),
  };
  return plugin.componentsResolved
    ? {
        ...fields,
        componentsResolved: plugin.componentsResolved,
        components: wireComponents(plugin.components),
      }
    : { ...fields, componentsResolved: plugin.componentsResolved };
}

function wireComponents(components: PluginInfoComponentsResolved["components"]) {
  return {
    ...(components.agents === undefined ? {} : { agents: [...components.agents] }),
    ...(components.commands === undefined ? {} : { commands: [...components.commands] }),
    ...(components.hooks === undefined
      ? {}
      : { hooks: components.hooks.map((entry) => wireHookEntry(entry)) }),
    ...(components.mcp === undefined ? {} : { mcp: [...components.mcp] }),
    ...(components.skills === undefined ? {} : { skills: [...components.skills] }),
    ...(components.workflows === undefined ? {} : { workflows: [...components.workflows] }),
  };
}

/** One `hooks:` entry: a lenient entry keeps its marker and support flag. */
function wireHookEntry(entry: HookSummaryEntry) {
  if ("kind" in entry) {
    return {
      kind: entry.kind,
      event: entry.event,
      supported: entry.supported,
      ...(entry.matcher === undefined ? {} : { matcher: entry.matcher }),
    };
  }

  return { event: entry.event, ...("matcher" in entry ? { matcher: entry.matcher } : {}) };
}

/**
 * D-04: an install-scoped row carries its own scope, or the block's when it
 * has none. A catalogue row carries no scope; its block names it.
 */
function wireScope(
  row: { readonly status: PluginStatus; readonly scope?: Scope },
  blockScope: Scope,
): { readonly scope?: Scope } {
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
