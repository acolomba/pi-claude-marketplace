import { RAW_SURFACE_SEVERITY } from "./notification-resolve.ts";
import { isPendingPluginRow } from "./notification-types.ts";

import type { HookSummaryEntry } from "./concerns/hooks.ts";
import type { SerializedCauseChain } from "./errors.ts";
import type { CommandErrorPresentation } from "./notification-command-error.ts";
import type { CascadePresentation, NotificationPresentation } from "./notification-present.ts";
import type {
  ResolvedEnvelope,
  ResolvedFailure,
  ResolvedMarketplace,
  ResolvedRawSurface,
  ResolvedRow,
  ResolvedTally,
} from "./notification-resolve.ts";
import type { NotificationOrigin } from "./notification-run.ts";
import type {
  BackgroundUpdatePlugin,
  MarketplaceDetails,
  MarketplaceInfoMessage,
  McpMigrationRow,
  McpServerSummaryEntry,
  PendingPluginStatus,
  PluginInfoComponentsResolved,
  PluginInfoMessage,
  PluginInfoRow,
  PluginStatus,
  RenderedMcpConfigNotice,
  RetainedWorkflowStaging,
  RevisionMoveFields,
  VersionCommits,
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
  origin: NotificationOrigin,
): Type.Static<typeof CASCADE_PAYLOAD_SCHEMA>;
export function toWirePayload(
  source: CommandErrorPresentation,
  origin: Extract<NotificationOrigin, { kind: "command" }>,
): Extract<Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA>, { kind: "internal-error" }>;
export function toWirePayload(
  source: NotificationPresentation | ResolvedRawSurface,
  origin: NotificationOrigin,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA>;
export function toWirePayload(
  source: NotificationPresentation | ResolvedRawSurface | CommandErrorPresentation,
  origin: NotificationOrigin,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA> {
  if (source.kind === "internal-error") {
    if (origin.kind !== "command") {
      throw new TypeError("Internal errors require command origin.");
    }

    return {
      schemaVersion: 1,
      kind: source.kind,
      origin: { kind: origin.kind, commandId: origin.commandId, invocationId: origin.invocationId },
      severity: source.severity,
      needsReload: source.needsReload,
      summary: source.summary,
      cause: wireCause(source.cause),
    };
  }

  return "envelope" in source ? wirePresentation(source, origin) : wireRawSurface(source, origin);
}

/** JOUT-02: the payload of one structured presentation, one arm per kind. */
function wirePresentation(
  presentation: NotificationPresentation,
  origin: NotificationOrigin,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA> {
  switch (presentation.kind) {
    case "cascade":
      return wireCascade(presentation, origin);
    case "reconcile-applied-cascade":
      return {
        schemaVersion: 1,
        kind: "reconcile-applied-cascade",
        ...wireEnvelope(presentation.envelope, origin),
        ...wireTallyField(presentation.envelope),
        marketplaces: toWireMarketplaces(presentation.marketplaces),
      };
    case "marketplace-info":
      return {
        schemaVersion: 1,
        kind: "marketplace-info",
        ...wireEnvelope(presentation.envelope, origin),
        ...wireMarketplaceInfo(presentation.message),
      };
    case "plugin-info":
      return {
        schemaVersion: 1,
        kind: "plugin-info",
        ...wireEnvelope(presentation.envelope, origin),
        ...wirePluginInfo(presentation.message),
      };
    case "marketplace-info-cascade":
      return {
        schemaVersion: 1,
        kind: "marketplace-info-cascade",
        ...wireEnvelope(presentation.envelope, origin),
        blocks: presentation.message.blocks.map((block) => wireMarketplaceInfo(block)),
      };
    case "plugin-info-cascade":
      return {
        schemaVersion: 1,
        kind: "plugin-info-cascade",
        ...wireEnvelope(presentation.envelope, origin),
        blocks: presentation.message.blocks.map((block) => wirePluginInfo(block)),
      };
    case "marketplace-not-added":
      return {
        schemaVersion: 1,
        kind: "marketplace-not-added",
        ...wireEnvelope(presentation.envelope, origin),
        name: presentation.message.name,
        ...(presentation.message.scope === undefined ? {} : { scope: presentation.message.scope }),
        reasons: [presentation.reason],
      };
    case "reconcile-pending-empty":
      return {
        schemaVersion: 1,
        kind: "reconcile-pending-empty",
        ...wireEnvelope(presentation.envelope, origin),
        ...wireAdvisories(presentation.message),
      };
    case "prune-empty":
      return {
        schemaVersion: 1,
        kind: "prune-empty",
        ...wireEnvelope(presentation.envelope, origin),
        scope: presentation.message.scope,
      };
    case "prune-committed-warning":
      return {
        schemaVersion: 1,
        kind: "prune-committed-warning",
        ...wireEnvelope(presentation.envelope, origin),
        scope: presentation.scope,
        ...(presentation.cause === undefined ? {} : { cause: wireCause(presentation.cause) }),
      };
  }
}

/**
 * D-01 / D-02: the payload of one resolved raw surface. Its severity comes from
 * `RAW_SURFACE_SEVERITY`, the table the text strategy reads (PMOD-01), except
 * the migration notice's, which resolve decides. The migration notice needs a
 * reload when resolve says so, and the background update notice always does
 * (D-PL8-11); every other raw kind never does. A raw kind carries no `summary`; the
 * rewake summary is copied verbatim into `text` (D-08).
 */
function wireRawSurface(
  surface: ResolvedRawSurface,
  origin: NotificationOrigin,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA> {
  if (surface.kind === "mcp-migration") {
    return {
      schemaVersion: 1,
      kind: surface.kind,
      origin: wireOrigin(origin),
      severity: surface.severity,
      needsReload: surface.needsReload,
      rows: surface.rows.map((row) => wireMigrationRow(row)),
      notices: surface.notices.map((notice) => wireNotice(notice)),
    };
  }

  const envelope = {
    schemaVersion: 1,
    origin: wireOrigin(origin),
    severity: RAW_SURFACE_SEVERITY[surface.kind],
    needsReload: false,
  } as const;

  switch (surface.kind) {
    case "usage-error":
      return { ...envelope, kind: surface.kind, message: surface.message, usage: surface.usage };
    case "usage-info":
      return { ...envelope, kind: surface.kind, usage: surface.usage };
    case "autoapply-status":
      return {
        ...envelope,
        kind: surface.kind,
        enabled: surface.enabled,
        ...(surface.source !== undefined && {
          source: { scope: surface.source.scope, file: surface.source.file },
        }),
        files: surface.files.map((file) => ({
          scope: file.scope,
          file: file.file,
          ...(file.value !== undefined && { value: file.value }),
        })),
        ...(surface.set !== undefined && {
          set: { scope: surface.set.scope, file: surface.set.file, value: surface.set.value },
        }),
      };
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
    case "mcp-config-notices":
      return {
        ...envelope,
        kind: surface.kind,
        notices: surface.notices.map((notice) => wireNotice(notice)),
      };
    case "background-update":
      return {
        ...envelope,
        needsReload: true,
        kind: surface.kind,
        plugins: surface.plugins.map((plugin) => wireBackgroundUpdatePlugin(plugin)),
      };
  }
}

/** D-PL8-10 / D-03: one updated install, field by field (WIRE-04). */
function wireBackgroundUpdatePlugin(plugin: BackgroundUpdatePlugin) {
  return {
    name: plugin.name,
    marketplace: plugin.marketplace,
    scope: plugin.scope,
    ...(plugin.fromVersion === undefined ? {} : { fromVersion: plugin.fromVersion }),
    toVersion: plugin.toVersion,
  };
}

/** AFILE-04: one config notice, field by field. */
function wireNotice(notice: RenderedMcpConfigNotice) {
  switch (notice.kind) {
    case "comments-dropped":
    case "left-unchanged":
      return { kind: notice.kind, scope: notice.scope, file: notice.file };
    case "override-kept":
    case "tool-rules-unenforced":
      return { kind: notice.kind, ...wireNoticeSubject(notice), fields: [...notice.fields] };
    case "variables-missing":
    case "credentials-blanked":
      return { kind: notice.kind, ...wireNoticeSubject(notice), names: [...notice.names] };
    case "leftover-removed":
      return { kind: notice.kind, ...wireNoticeSubject(notice) };
  }
}

function wireNoticeSubject(notice: Extract<RenderedMcpConfigNotice, { readonly plugin: string }>) {
  return { scope: notice.scope, file: notice.file, plugin: notice.plugin, server: notice.server };
}

/** AMIG-03: one migration row, field by field. */
function wireMigrationRow(row: McpMigrationRow) {
  switch (row.kind) {
    case "moved":
      return {
        kind: row.kind,
        scope: row.scope,
        plugin: row.plugin,
        marketplace: row.marketplace,
        from: row.from,
        to: row.to,
      };
    case "removed":
      return {
        kind: row.kind,
        scope: row.scope,
        plugin: row.plugin,
        marketplace: row.marketplace,
        server: row.server,
        cause: row.cause,
        ...(row.feature === undefined ? {} : { feature: row.feature }),
      };
    case "stopped":
      return { kind: row.kind, scope: row.scope, detail: row.detail };
    case "file-unreadable":
      return { kind: row.kind, scope: row.scope, file: row.file };
    case "collision":
      return { kind: row.kind, ...wireRowOwner(row), key: row.key, source: row.source };
    case "unfinished":
      return { kind: row.kind, ...wireRowOwner(row), file: row.file, detail: row.detail };
    case "unowned":
    case "not-listed":
    case "source-unreadable":
    case "source-outdated":
    case "marketplace-unreadable":
      return { kind: row.kind, ...wireRowOwner(row) };
  }
}

function wireRowOwner(row: Extract<McpMigrationRow, { readonly servers: readonly string[] }>) {
  return {
    scope: row.scope,
    plugin: row.plugin,
    marketplace: row.marketplace,
    servers: [...row.servers],
  };
}

/** D-04: the cascade payload, with its advisory lines and retained workflows. */
function wireCascade(
  presentation: CascadePresentation,
  origin: NotificationOrigin,
): Type.Static<typeof CASCADE_PAYLOAD_SCHEMA> {
  return {
    schemaVersion: 1,
    kind: "cascade",
    ...wireEnvelope(presentation.envelope, origin),
    ...wireTallyField(presentation.envelope),
    ...noOpField(presentation.envelope.noOp),
    ...needsApplyField(presentation.envelope.needsApply),
    marketplaces: toWireMarketplaces(presentation.marketplaces),
    ...wireAdvisories(presentation),
  };
}

/**
 * WIRE-05: `summary` rides warning and error envelopes only. It is the
 * envelope's resolved sentence, copied verbatim.
 */
function wireEnvelope(envelope: ResolvedEnvelope, origin: NotificationOrigin) {
  return {
    origin: wireOrigin(origin),
    severity: envelope.severity,
    needsReload: envelope.needsReload,
    ...(envelope.severity === "info" ? {} : { summary: envelope.summary }),
  };
}

/** Projects only the fields declared by the root's wire branch. */
function wireOrigin(origin: NotificationOrigin): NotificationOrigin {
  if (origin.kind === "command") {
    return { kind: origin.kind, commandId: origin.commandId, invocationId: origin.invocationId };
  }

  return { kind: origin.kind };
}

/** Projects resolved marketplace blocks for notification and tool payloads. */
export function toWireMarketplaces(
  marketplaces: readonly ResolvedMarketplace[],
): Type.Static<typeof CASCADE_PAYLOAD_SCHEMA>["marketplaces"] {
  return marketplaces.map((mp) => wireBlock(mp));
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

/** APL-04 / D-14: `needsApply` is present only when a pending list holds a change. */
function needsApplyField(needsApply: boolean): { readonly needsApply?: true } {
  return needsApply ? { needsApply: true } : {};
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
 * WIRE-04 / WIRE-06: one row. `id` comes from `rowId`. `reasons` is always
 * present. `missingPolicy` is resolve-internal and has no wire field.
 */
function wireRow(row: ResolvedRow, mp: ResolvedMarketplace) {
  return {
    status: row.status,
    name: row.name,
    id: rowId(row, mp),
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
 * WIRE-04 / WIRE-06: a row's id, in one of three forms. A row whose subject is
 * a marketplace (ADD-10: the child row of a failed `marketplace add`) uses its
 * name alone, because it names no plugin. A cascade member row is named by its
 * `<plugin>@<marketplace>` key (RESV-06), which names a dependency's own
 * marketplace, so a name that carries an `@` is already the id. Any other row
 * joins its name, `@`, and the block name, verbatim. The name is the redacted
 * one `resolveRows` gave the row.
 */
function rowId(row: ResolvedRow, mp: ResolvedMarketplace): string {
  if ("marketplaceSubject" in row || row.name.includes("@")) {
    return row.name;
  }

  return `${row.name}@${mp.name}`;
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
        ...(plugin.requires === undefined
          ? {}
          : {
              requires: plugin.requires.map(({ companion, missing }) => ({ companion, missing })),
            }),
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
    ...(components.mcp === undefined
      ? {}
      : { mcp: components.mcp.map((entry) => wireMcpServer(entry)) }),
    ...(components.skills === undefined ? {} : { skills: [...components.skills] }),
    ...(components.workflows === undefined ? {} : { workflows: [...components.workflows] }),
  };
}

/** ANAME-01 / AVAR-04 / ASTAT-01: one MCP server entry, field by field. */
function wireMcpServer(entry: McpServerSummaryEntry) {
  return {
    name: entry.name,
    ...(entry.unsupportedFeature === undefined
      ? {}
      : { unsupportedFeature: entry.unsupportedFeature }),
    ...(entry.unsetVariables === undefined ? {} : { unsetVariables: [...entry.unsetVariables] }),
    ...(entry.withheldVariables === undefined
      ? {}
      : { withheldVariables: [...entry.withheldVariables] }),
    ...(entry.status === undefined ? {} : { status: entry.status }),
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
 * D-04: the catalogue statuses, whose rows carry no scope; their block names
 * it. A TOTAL map, so a new status is classified before it reaches the wire.
 */
const CATALOGUE_STATUS = {
  available: true,
  remote: true,
  unavailable: true,
  "partially-available": true,
  installed: false,
  updated: false,
  reinstalled: false,
  uninstalled: false,
  disabled: false,
  upgradable: false,
  "partially-installed": false,
  "partially-upgradable": false,
  failed: false,
  skipped: false,
  "manual recovery": false,
  "will install": false,
  "will uninstall": false,
  "will enable": false,
  "will disable": false,
  "will update": false,
} as const satisfies Record<PluginStatus, boolean>;

/**
 * D-04: an install-scoped row carries its own scope, or the block's when it
 * has none. A catalogue row carries no scope; its block names it.
 */
function wireScope(
  row: { readonly status: PluginStatus; readonly scope?: Scope },
  blockScope: Scope,
): { readonly scope?: Scope } {
  return CATALOGUE_STATUS[row.status] ? {} : { scope: ownScopeOr(row.scope, blockScope) };
}

/** The row's own scope, or the block's when the row names none. */
function ownScopeOr(scope: Scope | undefined, blockScope: Scope): Scope {
  return scope ?? blockScope;
}

/** The version fields a row puts on the wire. */
interface WireVersionFields {
  readonly version?: string;
  readonly from?: string;
  readonly to?: string;
  readonly fromCommit?: string;
  readonly toCommit?: string;
}

/**
 * D-04: the raw version, or `from` and `to` on an updated or will-update row.
 * The groups follow `pluginVersion`: a manual-recovery row and every pending
 * row but `will uninstall` and `will update` carry none. UPR-03: a reinstalled,
 * partially installed, or failed row whose revision moved adds `from` beside
 * its `version`. The switch splits at the pending partition, as
 * `pluginVersion` does, to stay under the cyclomatic ceiling.
 */
function wireVersion(row: ResolvedRow): WireVersionFields {
  return isPendingPluginRow(row) ? pendingWireVersion(row) : settledWireVersion(row);
}

function pendingWireVersion(
  row: Extract<ResolvedRow, { readonly status: PendingPluginStatus }>,
): WireVersionFields {
  switch (row.status) {
    case "will uninstall":
      return versionField(row.version);
    case "will update":
      return { from: row.from, to: row.to, ...commitFields(row.commits) };
    case "will install":
    case "will enable":
    case "will disable":
      return {};
  }
}

function settledWireVersion(
  row: Exclude<ResolvedRow, { readonly status: PendingPluginStatus }>,
): WireVersionFields {
  switch (row.status) {
    case "installed":
    case "uninstalled":
    case "disabled":
    case "available":
    case "remote":
    case "unavailable":
    case "partially-available":
    case "upgradable":
    case "partially-upgradable":
    case "skipped":
      return versionField(row.version);
    case "reinstalled":
    case "partially-installed":
    case "failed":
      return { ...versionField(row.version), ...moveFields(row) };
    case "updated":
      return { from: row.from, to: row.to, ...commitFields(row.commits) };
    case "manual recovery":
      return {};
  }
}

function versionField(version: string | undefined): { readonly version?: string } {
  return version === undefined ? {} : { version };
}

/** UPR-03: `from` and the commits of a row whose revision moved, absent otherwise. */
function moveFields(row: RevisionMoveFields): {
  readonly from?: string;
  readonly fromCommit?: string;
  readonly toCommit?: string;
} {
  return { ...(row.from === undefined ? {} : { from: row.from }), ...commitFields(row.commits) };
}

/** UPR-02: the full commits of a same-version move, absent when the row has none. */
function commitFields(commits: VersionCommits | undefined): {
  readonly fromCommit?: string;
  readonly toCommit?: string;
} {
  return commits === undefined ? {} : { fromCommit: commits.from, toCommit: commits.to };
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
