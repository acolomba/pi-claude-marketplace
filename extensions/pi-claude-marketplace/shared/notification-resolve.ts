import { softDepMarkers } from "./concerns/soft-dep.ts";
import { hookDebugLog } from "./debug-log.ts";
import { errorMessage, manualRecoveryLeaks, serializeCauseChain } from "./errors.ts";
import { isLeftRow, isMovedRow, isRemovedRow, mcpConfigNoticeLine } from "./notification-mcp.ts";
import {
  buildSummaryLine,
  computeSeverity,
  countRowsBySeverity,
  shouldEmitReloadHint,
} from "./notification-summary.ts";
import { redactCredentials } from "./redact-credentials.ts";

import type { Dependency } from "./concerns/soft-dep.ts";
import type { SerializedCauseChain } from "./errors.ts";
import type {
  BackgroundUpdatePlugin,
  BackgroundUpdateSurface,
  CascadeNotificationMessage,
  MarketplaceNotAddedMessage,
  MarketplaceNotificationMessage,
  McpConfigNotice,
  McpConfigNoticeSection,
  McpConfigNoticesSurface,
  McpMigrationLeftRow,
  McpMigrationMovedRow,
  McpMigrationRemovedRow,
  McpMigrationRow,
  McpMigrationSurface,
  McpOverrideKeptNotice,
  McpOverrideRestoredNotice,
  NotificationMessage,
  PluginFailedMessage,
  PluginNotificationMessage,
  RawSurface,
  Reason,
  ReconcileAbortedSurface,
  RenderedMcpConfigNotice,
  Severity,
  WithPlugins,
} from "./notification-types.ts";
import type { SoftDepStatus } from "../platform/pi-api.ts";

/**
 * PMOD-01: the single resolve step upstream of the text strategy. It turns a
 * `NotificationMessage` into the envelope facts every emission needs before any
 * text is composed.
 *
 * D-09: the envelope is a plain readonly model. It is not the wire schema and
 * imports no schema library, so an internal refactor here never changes a wire
 * contract.
 *
 * D-10: severity, the composed summary line, `needsReload`, `needsApply`, the
 * numeric tally, and the update no-op flag are resolved here, once. The text
 * strategy (`formatEnvelopeArguments` in notification-grammar.ts) reads the
 * summary line verbatim and composes the tally sentence, the no-op headline,
 * and the reload and apply trailers from these facts.
 *
 * D-11: `resolveRows` serializes each failed row's cause chain, manual-recovery
 * leaks, and rollback phases here, once, and the remedy cause a realized
 * `disabled`, `uninstalled`, or update `skipped` row carries. No resolved row carries a live
 * `Error`, so the text strategy formats failure detail without walking one.
 *
 * D-10: each row's hint and the `marketplace-not-added` reason token are chosen
 * here as data. The text strategy maps a hint id to its frozen literal.
 *
 * D-12: each row's final reasons are composed here: its content reasons, then
 * the `{requires ...}` soft-dependency markers its command's marker policy
 * allows for the row's status.
 */

/**
 * OUT-03 / UGRM-02: the success category of a tally. Without `verb` it renders
 * as `success` / `successes`; with one (the update override) it renders the
 * verb for every count.
 */
export interface ResolvedTallySuccess {
  readonly count: number;
  readonly verb?: string;
}

/**
 * OUT-03 / OUT-04: the trailing per-operation tally of a plural cascade.
 * `label` is the operation name. A zero `failures` or `warnings` count and an
 * absent `success` each omit their category.
 */
export interface ResolvedTally {
  readonly label: string;
  readonly failures: number;
  readonly warnings: number;
  readonly success?: ResolvedTallySuccess;
}

/** An envelope that emits at info severity and carries no summary line. */
export interface InfoEnvelope {
  readonly severity: "info";
  readonly needsReload: boolean;
  readonly needsApply: boolean;
  readonly noOp: boolean;
  readonly tally?: ResolvedTally;
}

/**
 * An envelope that emits at warning or error severity. `summary` is the
 * composed sentence the text strategy prepends as its own block (GRAM-01).
 */
export interface AttentionEnvelope {
  readonly severity: "warning" | "error";
  readonly summary: string;
  readonly needsReload: boolean;
  readonly needsApply: boolean;
  readonly noOp: boolean;
  readonly tally?: ResolvedTally;
}

/** The resolved envelope of one notification, discriminated by `severity`. */
export type ResolvedEnvelope = InfoEnvelope | AttentionEnvelope;

/** The severity-independent envelope facts. */
interface EnvelopeFacts {
  readonly needsReload: boolean;
  readonly needsApply: boolean;
  readonly noOp: boolean;
  readonly tally?: ResolvedTally;
}

/** The severity and summary line of a warning or error envelope. */
interface Attention {
  readonly severity: "warning" | "error";
  readonly summary: string;
}

/** The message fields the tally reads. */
interface TallySource {
  readonly label?: string;
  readonly cardinality?: "single" | "plural";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
  readonly tally?: { readonly verb: string; readonly count: number };
}

/**
 * Resolves the envelope of `message`. SEV-02 severity comes from the stamped
 * rows (or the standalone kind map); an info result carries no summary line,
 * and a warning or error result carries the D-10 summary sentence.
 * `needsReload` is the RLD-02 OR-reduce of the row stamps; a standalone kind
 * answers false, except the committed prune warning and the
 * `reconcile-applied-cascade` that reads its rows (D-08). Only a cascade and a
 * `reconcile-applied-cascade` carry a tally. APL-04 / D-14: `needsApply` is true only for a cascade whose
 * message sets it.
 */
export function resolveEnvelope(message: NotificationMessage): ResolvedEnvelope {
  const attention = resolveAttention(message);
  const needsReload = shouldEmitReloadHint(message);
  const needsApply =
    (message.kind === undefined || message.kind === "cascade") && message.needsApply === true;
  const tally =
    message.kind === undefined ||
    message.kind === "cascade" ||
    message.kind === "reconcile-applied-cascade"
      ? resolveTally(message)
      : undefined;

  return assembleEnvelope(
    attention,
    tally === undefined
      ? { needsReload, needsApply, noOp: false }
      : { needsReload, needsApply, noOp: false, tally },
  );
}

/**
 * UGRM-01: resolves the envelope of a bulk update that realized no transition.
 * Severity and the summary line resolve as for any cascade. The no-op headline
 * takes the tally's place, so there is no tally and no reload trailer.
 */
export function resolveUpdateNoOpEnvelope(message: CascadeNotificationMessage): ResolvedEnvelope {
  return assembleEnvelope(resolveAttention(message), {
    needsReload: false,
    needsApply: false,
    noOp: true,
  });
}

/** The severity and summary line of `message`, or `undefined` at info. */
function resolveAttention(message: NotificationMessage): Attention | undefined {
  const severity = computeSeverity(message);
  if (severity === undefined) {
    return undefined;
  }

  return { severity, summary: buildSummaryLine(message, severity) };
}

function assembleEnvelope(
  attention: Attention | undefined,
  facts: EnvelopeFacts,
): ResolvedEnvelope {
  return attention === undefined ? { ...facts, severity: "info" } : { ...facts, ...attention };
}

/**
 * OUT-03 / OUT-04 / D-04: the tally of a structurally PLURAL cascade. It is
 * absent for a single-target operation (never a row-count heuristic), for a
 * message with no operation label, and when no category is present. Per OUT-03
 * the tally resolves at every severity, so a successful bulk import still
 * reports `Plugin import: 3 successes`.
 *
 * D-03: failures and warnings count the marketplace rows AND the plugin rows
 * whose stamped severity is error or warning, uniformly across both subjects.
 */
function resolveTally(message: TallySource): ResolvedTally | undefined {
  if (message.cardinality !== "plural" || message.label === undefined) {
    return undefined;
  }

  const errorCount = countRowsBySeverity(message.marketplaces, "error");
  const warningCount = countRowsBySeverity(message.marketplaces, "warning");
  const failures = errorCount.plugins + errorCount.marketplaces;
  const warnings = warningCount.plugins + warningCount.marketplaces;
  const success = resolveTallySuccess(message, failures + warnings);

  if (success !== undefined) {
    return { label: message.label, failures, warnings, success };
  }

  if (failures === 0 && warnings === 0) {
    return undefined;
  }

  return { label: message.label, failures, warnings };
}

/**
 * The success category of the tally, or `undefined` when it is omitted.
 * `otherCount` is the number of failure and warning rows.
 */
function resolveTallySuccess(
  message: TallySource,
  otherCount: number,
): ResolvedTallySuccess | undefined {
  if (message.tally !== undefined) {
    // UGRM-02: the update override owns the success category. Its count is
    // realized transitions only, and a count of 0 contributes nothing: the
    // never-silent no-op headline is the orchestrator's job, so a failure-only
    // cascade stays e.g. `1 failure`.
    return message.tally.count > 0
      ? { count: message.tally.count, verb: message.tally.verb }
      : undefined;
  }

  // OUT-03 / OUT-06 / D-03: the default success count covers OPERATION rows.
  // A BARE marketplace header -- one with neither a `status` (a realized
  // marketplace outcome) nor a stamped `severity` -- is a grouping label, not an
  // operation, so it does not count. The `info` row count includes bare headers
  // through its `?? "info"` default, so subtract them. A marketplace row WITH a
  // `status` is a real marketplace operation and counts.
  const successRows = countRowsBySeverity(message.marketplaces, "info");
  const bareHeaders = message.marketplaces.filter(
    (mp) => mp.severity === undefined && mp.status === undefined,
  ).length;
  const count = successRows.plugins + successRows.marketplaces - bareHeaders;

  // An empty result omits the success category. A populated result with no
  // other category reports zero successes.
  if (count > 0 || (message.marketplaces.length > 0 && otherCount === 0)) {
    return { count };
  }

  return undefined;
}

/** D-11: one rollback phase that failed to undo, with its serialized cause. */
export interface ResolvedRollbackPhase {
  readonly phase: string;
  readonly cause?: SerializedCauseChain;
}

/**
 * D-11 / PMOD-03: the failure detail of a failed or manual-recovery row, the
 * remedy cause of a realized `disabled`, `uninstalled`, or update `skipped`
 * row, or the constraint disclosure of an `updated` or `reinstalled` row
 * (D-10-13 / D-10-17a).
 * `cause` is absent when the row carries no cause. `leaks` names the paths the
 * user must clean up by hand. `rollbackPartial` lists the phases whose undo
 * failed; it is empty on a manual-recovery row.
 */
export interface ResolvedFailure {
  readonly cause?: SerializedCauseChain;
  readonly leaks: readonly string[];
  readonly rollbackPartial: readonly ResolvedRollbackPhase[];
}

/**
 * D-10: the remediation hint a row carries, as an id. The text strategy maps
 * each id to its frozen trailer literal.
 */
export type RowHint =
  "partial-install" | "partial-update" | "catalog-partial-update" | "stale-gate-update" | "enable";

/**
 * The per-row facts `resolveRows` adds to a producer row. `reasons` is the
 * final reason list: the row's content reasons, then its soft-dependency
 * markers.
 */
export interface ResolvedRowFacts {
  readonly reasons: readonly Reason[];
  readonly failure?: ResolvedFailure;
  readonly hint?: RowHint;
  readonly missingPolicy?: true;
}

/**
 * A producer row with its reasons, dependencies, live failure detail, and hint
 * flags replaced by resolved facts. The conditional distributes over the row
 * union, so each member keeps its own `status` discriminant.
 */
export type ResolvedRow<M extends PluginNotificationMessage = PluginNotificationMessage> =
  M extends unknown
    ? Omit<
        M,
        | "reasons"
        | "dependencies"
        | "cause"
        | "rollbackPartial"
        | "partialHint"
        | "catalogHint"
        | "enableHint"
      > &
        ResolvedRowFacts
    : never;

/** Semantic reason inclusion for a command's plugin row. */
export interface RowPolicy {
  readonly markers: boolean;
  readonly contentReasons: boolean;
}

/** Runtime lookup of command policies; absent entries produce diagnostic rows. */
export type RowPolicyMap = Readonly<
  Partial<Record<PluginNotificationMessage["status"], RowPolicy>>
>;

/** The central notification path's complete row policy. */
export const CENTRAL_ROW_POLICY = {
  installed: { markers: true, contentReasons: true },
  updated: { markers: true, contentReasons: true },
  reinstalled: { markers: true, contentReasons: true },
  "partially-installed": { markers: true, contentReasons: true },
  uninstalled: { markers: false, contentReasons: true },
  disabled: { markers: false, contentReasons: true },
  available: { markers: false, contentReasons: false },
  remote: { markers: false, contentReasons: false },
  unavailable: { markers: false, contentReasons: true },
  "partially-available": { markers: false, contentReasons: true },
  upgradable: { markers: false, contentReasons: true },
  "partially-upgradable": { markers: false, contentReasons: true },
  failed: { markers: false, contentReasons: true },
  skipped: { markers: false, contentReasons: true },
  "manual recovery": { markers: false, contentReasons: true },
  "will install": { markers: false, contentReasons: false },
  "will uninstall": { markers: false, contentReasons: true },
  "will enable": { markers: false, contentReasons: false },
  "will disable": { markers: false, contentReasons: false },
  "will update": { markers: false, contentReasons: true },
} as const satisfies Record<PluginNotificationMessage["status"], RowPolicy>;

/** A marketplace row whose plugin rows are resolved. */
export type ResolvedMarketplace = WithPlugins<MarketplaceNotificationMessage, ResolvedRow>;

/**
 * A writable view of a row's own `severity` slot. The slot's type is read off
 * the declared field rather than spelled again here, so a change to the
 * severity vocabulary reaches the one localized write in `resolveRows` instead
 * of being asserted past by a hand-written literal. A mapped type declares no
 * members of its own.
 */
type WritableRowSeverity = { -readonly [K in "severity"]?: PluginNotificationMessage[K] };

/**
 * Resolves ordered row facts; an absent own policy marks a diagnostic and floors input severity.
 *
 * PMOD-04 / D-07: every block name is redacted, because a failed `marketplace
 * add` names its block after the source the user typed, URL userinfo included.
 * Every plugin row name is redacted too, because a hand-edited `enabledPlugins`
 * key names a pending or failed row after whatever precedes its last `@` (see
 * `redactRowName`).
 */
export function resolveRows(
  marketplaces: readonly MarketplaceNotificationMessage[],
  snapshot: SoftDepStatus,
  rowPolicies: RowPolicyMap,
): readonly ResolvedMarketplace[] {
  return marketplaces.map((mp) => ({
    ...mp,
    name: redactCredentials(mp.name),
    plugins: mp.plugins.map((row) => {
      const policy = Object.hasOwn(rowPolicies, row.status) ? rowPolicies[row.status] : undefined;
      if (policy === undefined) {
        floorMissingArmSeverity(row);
      }

      const resolved = resolveRow(row, (content, dependencies) =>
        composeRowReasons(
          policy?.contentReasons === false ? [] : (content ?? []),
          policy?.markers === true ? (dependencies ?? []) : [],
          snapshot,
        ),
      );
      // An out-of-band row can arrive without a string `name`; it keeps that shape.
      const name: unknown = resolved.name;
      const redacted =
        typeof name === "string" ? { ...resolved, name: redactRowName(name) } : resolved;
      return policy === undefined ? { ...redacted, missingPolicy: true } : redacted;
    }),
  }));
}

/**
 * PMOD-04 / D-07: redacts a plugin row name with the `@` that follows it in
 * its `plugin@marketplace` subject restored. A last-`@` split can consume the
 * `@` that ends URL userinfo: the key
 * `foo@https://alice:s3cret@github.com/o/r.git` names the row
 * `foo@https://alice:s3cret`, which reads as `foo@https://***`. A trailing
 * `scheme://host:port` has the same shape, so it is masked too.
 */
function redactRowName(name: string): string {
  return redactCredentials(`${name}@`).slice(0, -1);
}

/**
 * Composes a row's content reasons, then the markers `dependencies` call for.
 * `dependencies` is empty when the row's marker policy is off.
 */
function composeRowReasons(
  content: readonly Reason[],
  dependencies: readonly Dependency[],
  snapshot: SoftDepStatus,
): readonly Reason[] {
  return [
    ...content,
    ...softDepMarkers(
      dependencies.includes("agents"),
      dependencies.includes("mcp"),
      dependencies.includes("workflows"),
      snapshot,
    ),
  ];
}

/**
 * Composes the final reasons of a row from its content reasons and its
 * declared dependencies; either is `undefined` when the row has none.
 */
type ReasonComposer = (
  content: readonly Reason[] | undefined,
  dependencies: readonly Dependency[] | undefined,
) => readonly Reason[];

function floorMissingArmSeverity(row: PluginNotificationMessage): void {
  // The field is declared `readonly`; this single localized write is the seam
  // that lets a row with no row policy contribute its severity.
  try {
    (row as WritableRowSeverity).severity = "error";
  } catch (err) {
    // A frozen/sealed out-of-band row rejects the write in ESM strict mode.
    // Keep whatever severity was already stamped.
    hookDebugLog(`resolveRows: severity write rejected for frozen row: ${errorMessage(err)}`);
  }
}

/**
 * The resolved copy of `row`: its content reasons and dependencies replaced by
 * the final `reasons` from `compose`, and its failure detail and hint flags by
 * resolved facts. A row whose status no branch names (an out-of-band row, or a
 * pending-tense row) keeps its own keys and gains `reasons`.
 */
function resolveRow(row: PluginNotificationMessage, compose: ReasonComposer): ResolvedRow {
  if (row.status === "failed") {
    const { cause, rollbackPartial, partialHint, reasons, ...rest } = row;
    return {
      ...rest,
      reasons: compose(reasons, undefined),
      ...hintFor(partialHint, "stale-gate-update"),
      failure: resolveFailure(cause, rollbackPartial ?? []),
    };
  }

  if (row.status === "manual recovery") {
    const { cause, reasons, ...rest } = row;
    return { ...rest, reasons: compose(reasons, undefined), failure: resolveFailure(cause, []) };
  }

  if (row.status === "unavailable" || row.status === "partially-available") {
    const { partialHint, reasons, ...rest } = row;
    return {
      ...rest,
      reasons: compose(reasons, undefined),
      ...hintFor(partialHint, "partial-install"),
    };
  }

  if (row.status === "partially-upgradable") {
    // D-24: a producer sets at most one of the two hint flags.
    const { partialHint, catalogHint, reasons, ...rest } = row;
    return {
      ...rest,
      reasons: compose(reasons, undefined),
      ...hintFor(partialHint, "partial-update"),
      ...hintFor(catalogHint, "catalog-partial-update"),
    };
  }

  if (row.status === "disabled") {
    const { enableHint, reasons, cause, ...rest } = row;
    return {
      ...rest,
      reasons: compose(reasons, undefined),
      ...hintFor(enableHint, "enable"),
      ...remedyFailure(cause),
    };
  }

  if (row.status === "uninstalled") {
    const { reasons, cause, ...rest } = row;
    return { ...rest, reasons: compose(reasons, undefined), ...remedyFailure(cause) };
  }

  if (row.status === "skipped" && "cause" in row) {
    const { reasons, cause, ...rest } = row;
    return { ...rest, reasons: compose(reasons, undefined), ...remedyFailure(cause) };
  }

  if (
    row.status === "updated" ||
    row.status === "reinstalled" ||
    row.status === "partially-installed"
  ) {
    const { reasons, dependencies, cause, ...rest } = row;
    return { ...rest, reasons: compose(reasons, dependencies), ...remedyFailure(cause) };
  }

  if ("dependencies" in row) {
    const { reasons, dependencies, ...rest } = row;
    return { ...rest, reasons: compose(reasons, dependencies) };
  }

  if ("reasons" in row) {
    const { reasons, ...rest } = row;
    return { ...rest, reasons: compose(reasons, undefined) };
  }

  return { ...row, reasons: compose(undefined, undefined) };
}

/**
 * LOAD-01 / LOAD-03 / UPDT-02 / D-10-13: the `failure` member of a realized
 * `disabled`, `uninstalled`, `updated`, `reinstalled`, or `partially-installed`
 * row, or of an update `skipped` row, whose producer set a remedy or disclosure
 * `cause`, or no member. The cause names plugin identifiers, which only the
 * cause line may interpolate. A row without one keeps its byte-frozen form.
 */
function remedyFailure(cause: Error | undefined): Pick<ResolvedRowFacts, "failure"> {
  return cause === undefined ? {} : { failure: resolveFailure(cause, []) };
}

/** The `hint` member for a row whose producer set `flag`, or no member. */
function hintFor(flag: boolean | undefined, hint: RowHint): Pick<ResolvedRowFacts, "hint"> {
  return flag === true ? { hint } : {};
}

function resolveFailure(
  cause: Error | undefined,
  rollbackPartial: NonNullable<PluginFailedMessage["rollbackPartial"]>,
): ResolvedFailure {
  const chain = serializeCauseChain(cause);
  return {
    ...(chain === undefined ? {} : { cause: chain }),
    leaks: manualRecoveryLeaks(cause).map((leak) => redactCredentials(leak)),
    rollbackPartial: rollbackPartial.map((entry) => {
      const phaseChain = serializeCauseChain(entry.cause);
      return phaseChain === undefined
        ? { phase: entry.phase }
        : { phase: entry.phase, cause: phaseChain };
    }),
  };
}

/**
 * CMP-4 / SCOPE-01: pick the structural token the `{...}` brace carries.
 *
 * The qualified token REPLACES the plain one rather than joining it -- "the
 * container does not exist" and "it exists, but not in the scope you targeted"
 * are competing claims about one subject, so a brace carrying both would state
 * both.
 *
 * A qualified token requires a `scope`, which is what the `[scope]` bracket
 * renders from. An ABSENT bracket means the caller consulted BOTH scopes and
 * both missed (D-03), so there is no other scope left to be present in and the
 * plain token is the only truthful one.
 *
 * The scope word names the scope that MISSED, matching the bracket beside it.
 */
export function resolveNotAddedReason(message: MarketplaceNotAddedMessage): Reason {
  if (message.presentInOtherScope !== true || message.scope === undefined) {
    return "marketplace not added";
  }

  return message.scope === "user"
    ? "marketplace not added to user scope"
    : "marketplace not added to project scope";
}

/**
 * PMOD-01: the one place a raw kind's severity is decided. The text strategy
 * and the JSON strategy both read it, so the two cannot disagree. The
 * migration notice's severity depends on its rows, so resolve decides it and
 * carries it on `ResolvedMcpMigration`.
 */
export const RAW_SURFACE_SEVERITY = {
  "usage-error": "error",
  "usage-info": "info",
  "autoapply-status": "info",
  diagnostic: "warning",
  "device-flow-prompt": "info",
  "mcp-config-notices": "warning",
  "async-rewake-summary": "info",
  "stop-override-cap": "warning",
  "reconcile-aborted": "error",
  "plugin-path-skipped": "warning",
  "background-update": "info",
} as const satisfies Record<Exclude<RawSurface["kind"], "mcp-migration">, Severity>;

/** D-13: a reconcile abort whose live cause has been serialized to text. */
export interface ResolvedReconcileAborted {
  readonly kind: "reconcile-aborted";
  readonly causeMessage: string;
}

/**
 * AMIG-03: the migration notice after resolve. `rows` hold the moved rows,
 * then the removed rows, then the rows left in `mcp.json`, each group sorted;
 * `notices` hold the folded notices in section order. `needsReload` is true
 * exactly when a row moved or was removed.
 */
export interface ResolvedMcpMigration {
  readonly kind: "mcp-migration";
  readonly rows: readonly McpMigrationRow[];
  readonly notices: readonly RenderedMcpConfigNotice[];
  readonly severity: Extract<Severity, "info" | "warning">;
  readonly needsReload: boolean;
}

/** D-13: a raw surface after resolve. No member carries a live thrown value. */
export type ResolvedRawSurface =
  | Exclude<RawSurface, ReconcileAbortedSurface | McpMigrationSurface>
  | ResolvedReconcileAborted
  | ResolvedMcpMigration;

/**
 * D-13 / PMOD-04: the one place a raw surface's live value becomes text, and
 * the place its thrown-message strings are redacted (D-07). A
 * `reconcile-aborted` cause becomes `errorMessage(cause)`: an Error's message,
 * or the string form of any other thrown value. That message, a
 * `plugin-path-skipped` reason, a `usage-error` message, and a `diagnostic`
 * header and lines can carry a thrown message, so each passes through
 * `redactCredentials`. The MCP kinds carry names and details read from plugin
 * and config files, so every free-text field of theirs passes through it too.
 * A `background-update` carries plugin names, marketplace names, and versions
 * read from records and catalogs, so each of those passes through it as well.
 * The usage text is static help and stays as written. Every other kind comes
 * back as the same object.
 */
export function resolveRawSurface(surface: RawSurface): ResolvedRawSurface {
  switch (surface.kind) {
    case "reconcile-aborted":
      return {
        kind: "reconcile-aborted",
        causeMessage: redactCredentials(errorMessage(surface.cause)),
      };
    case "plugin-path-skipped":
      return {
        kind: "plugin-path-skipped",
        scope: surface.scope,
        reason: redactCredentials(surface.reason),
      };
    case "usage-error":
      return {
        kind: "usage-error",
        message: redactCredentials(surface.message),
        usage: surface.usage,
      };
    case "diagnostic":
      return {
        kind: "diagnostic",
        header: redactCredentials(surface.header),
        lines: surface.lines.map((line) => redactCredentials(line)),
      };
    case "mcp-config-notices":
      return {
        kind: "mcp-config-notices",
        section: surface.section,
        notices: distinctNotices(surface.notices),
      };
    case "mcp-migration":
      return resolveMcpMigration(surface);
    case "background-update":
      return resolveBackgroundUpdate(surface);
    case "usage-info":
    case "autoapply-status":
    case "device-flow-prompt":
    case "async-rewake-summary":
    case "stop-override-cap":
      return surface;
  }
}

// AFILE-04 / AFILE-06 / AVAR-04 / ANAME-07 / AMIG-01: the section order of the
// config notices, in a standalone notice and inside the migration notice.
const MCP_CONFIG_NOTICE_SECTIONS: readonly McpConfigNoticeSection[] = [
  "comments-dropped",
  "left-unchanged",
  "override-kept",
  "variables-missing",
  "credentials-blanked",
  "tool-rules-unenforced",
  "leftover-removed",
];

function overrideKey(notice: McpOverrideKeptNotice | McpOverrideRestoredNotice): string {
  return JSON.stringify([notice.scope, notice.file, notice.server]);
}

/**
 * AFILE-06: the override-kept notices still standing after the list's
 * write-backs, in the order each server's notice was first set. A later keep
 * for the same scope, file and server replaces the earlier one, and a
 * restore removes it. The list is in the order the command wrote the files.
 */
function standingOverrideNotices(
  notices: readonly McpConfigNotice[],
): readonly McpOverrideKeptNotice[] {
  const standing = new Map<string, McpOverrideKeptNotice>();
  for (const notice of notices) {
    if (notice.kind === "override-kept") {
      standing.set(overrideKey(notice), notice);
    } else if (notice.kind === "override-restored") {
      standing.delete(overrideKey(notice));
    }
  }

  return [...standing.values()];
}

function noticesOfSection(
  notices: readonly McpConfigNotice[],
  section: McpConfigNoticeSection,
): readonly RenderedMcpConfigNotice[] {
  if (section === "override-kept") {
    return standingOverrideNotices(notices);
  }

  return notices.filter((notice): notice is RenderedMcpConfigNotice => notice.kind === section);
}

/**
 * AFILE-04 / AFILE-06: a command's MCP config notices as one raw surface per
 * non-empty section, in section order. An override-kept notice stands only
 * when no later override-restored notice for the same scope, file and server
 * cancels it, and an override-restored notice is in no section.
 */
export function mcpConfigNoticeSurfaces(
  notices: readonly McpConfigNotice[],
): readonly McpConfigNoticesSurface[] {
  const surfaces: McpConfigNoticesSurface[] = [];
  for (const section of MCP_CONFIG_NOTICE_SECTIONS) {
    const sectionNotices = noticesOfSection(notices, section);
    if (sectionNotices.length > 0) {
      surfaces.push({ kind: "mcp-config-notices", section, notices: sectionNotices });
    }
  }

  return surfaces;
}

/**
 * PMOD-04: a notice with each name it carries redacted. Scope, file, and kind
 * are closed sets; plugin, server, field, and variable names come from files.
 */
function redactNotice(notice: RenderedMcpConfigNotice): RenderedMcpConfigNotice {
  switch (notice.kind) {
    case "comments-dropped":
    case "left-unchanged":
      return notice;
    case "override-kept":
    case "tool-rules-unenforced":
      return {
        ...notice,
        plugin: redactCredentials(notice.plugin),
        server: redactCredentials(notice.server),
        fields: notice.fields.map((field) => redactCredentials(field)),
      };
    case "variables-missing":
    case "credentials-blanked":
      return {
        ...notice,
        plugin: redactCredentials(notice.plugin),
        server: redactCredentials(notice.server),
        names: notice.names.map((name) => redactCredentials(name)),
      };
    case "leftover-removed":
      return {
        ...notice,
        plugin: redactCredentials(notice.plugin),
        server: redactCredentials(notice.server),
      };
  }
}

/**
 * AFILE-04: the redacted notices of one section, each distinct line once, in
 * first-seen order. Two notices are the same when they render the same line.
 */
function distinctNotices(
  notices: readonly RenderedMcpConfigNotice[],
): readonly RenderedMcpConfigNotice[] {
  const seen = new Set<string>();
  const distinct: RenderedMcpConfigNotice[] = [];
  for (const notice of notices.map((each) => redactNotice(each))) {
    const line = mcpConfigNoticeLine(notice);
    if (!seen.has(line)) {
      seen.add(line);
      distinct.push(notice);
    }
  }

  return distinct;
}

/** PMOD-04: an owner row with its plugin, marketplace, and old names redacted. */
function redactOwnerRow<
  Row extends {
    readonly plugin: string;
    readonly marketplace: string;
    readonly servers: readonly string[];
  },
>(row: Row): Row {
  return {
    ...row,
    plugin: redactCredentials(row.plugin),
    marketplace: redactCredentials(row.marketplace),
    servers: row.servers.map((server) => redactCredentials(server)),
  };
}

/** PMOD-04: a migration row with each name and detail it carries redacted. */
function redactMigrationRow(row: McpMigrationRow): McpMigrationRow {
  switch (row.kind) {
    case "moved":
      return {
        ...row,
        plugin: redactCredentials(row.plugin),
        marketplace: redactCredentials(row.marketplace),
        from: redactCredentials(row.from),
        to: redactCredentials(row.to),
      };
    case "removed":
      return {
        ...row,
        plugin: redactCredentials(row.plugin),
        marketplace: redactCredentials(row.marketplace),
        server: redactCredentials(row.server),
        ...(row.feature === undefined ? {} : { feature: redactCredentials(row.feature) }),
      };
    case "stopped":
      return { ...row, detail: redactCredentials(row.detail) };
    case "file-unreadable":
      return row;
    case "collision":
      return {
        ...redactOwnerRow(row),
        key: redactCredentials(row.key),
        source: redactCredentials(row.source),
      };
    case "unfinished":
      return { ...redactOwnerRow(row), detail: redactCredentials(row.detail) };
    case "unowned":
    case "not-listed":
    case "source-unreadable":
    case "source-outdated":
    case "marketplace-unreadable":
      return redactOwnerRow(row);
  }
}

/** Plain code-unit order: no locale, no normalization. */
function codeUnitOrder(left: string, right: string): number {
  return left < right ? -1 : Number(left > right);
}

/** Project before user, then plugin, then old name, in code-unit order. */
function compareMovedRows(left: McpMigrationMovedRow, right: McpMigrationMovedRow): number {
  return (
    codeUnitOrder(left.scope, right.scope) ||
    codeUnitOrder(left.plugin, right.plugin) ||
    codeUnitOrder(left.from, right.from)
  );
}

/** Project before user, then plugin, then old name, in code-unit order. */
function compareRemovedRows(left: McpMigrationRemovedRow, right: McpMigrationRemovedRow): number {
  return (
    codeUnitOrder(left.scope, right.scope) ||
    codeUnitOrder(left.plugin, right.plugin) ||
    codeUnitOrder(left.server, right.server)
  );
}

/** The plugin and first-name sort keys of a left row; a stopped row sorts by its detail. */
function leftRowKeys(row: McpMigrationLeftRow): readonly [plugin: string, name: string] {
  switch (row.kind) {
    case "stopped":
      return [row.detail, ""];
    case "file-unreadable":
      return ["", row.file];
    case "unowned":
    case "not-listed":
    case "source-unreadable":
    case "source-outdated":
    case "marketplace-unreadable":
    case "collision":
    case "unfinished":
      return [row.plugin, row.servers.slice(0, 1).join("")];
  }
}

/** Project before user, then plugin, then first old name, in code-unit order. */
function compareLeftRows(left: McpMigrationLeftRow, right: McpMigrationLeftRow): number {
  const [leftPlugin, leftName] = leftRowKeys(left);
  const [rightPlugin, rightName] = leftRowKeys(right);
  return (
    codeUnitOrder(left.scope, right.scope) ||
    codeUnitOrder(leftPlugin, rightPlugin) ||
    codeUnitOrder(leftName, rightName)
  );
}

/** Whether a removal makes the notice a warning: a dropped or malformed server (AMIG-03). */
function isWarningRemoval(row: McpMigrationRemovedRow): boolean {
  return row.cause === "unsupported-feature" || row.cause === "malformed";
}

/**
 * Whether a notice makes the migration notice a warning: a leftover removed,
 * or a moved server with an unset variable, a withheld credential or tool
 * rules not enforced. A standalone section of these kinds is a warning too
 * (ANAME-07, AVAR-04).
 */
function isWarningNotice(notice: RenderedMcpConfigNotice): boolean {
  return (
    notice.kind === "leftover-removed" ||
    notice.kind === "variables-missing" ||
    notice.kind === "credentials-blanked" ||
    notice.kind === "tool-rules-unenforced"
  );
}

// PMOD-04: names and versions come from records and catalogs, so each string
// field is redacted; `fromVersion` stays absent when the row has none.
function resolveBackgroundUpdate(surface: BackgroundUpdateSurface): BackgroundUpdateSurface {
  return {
    kind: "background-update",
    plugins: surface.plugins.map((plugin): BackgroundUpdatePlugin => ({
      name: redactCredentials(plugin.name),
      marketplace: redactCredentials(plugin.marketplace),
      scope: plugin.scope,
      ...(plugin.fromVersion === undefined
        ? {}
        : { fromVersion: redactCredentials(plugin.fromVersion) }),
      toVersion: redactCredentials(plugin.toVersion),
    })),
  };
}

/**
 * AMIG-01 / AMIG-03 / AMIG-04: resolves the one migration notice per reload.
 * Moved and removed rows sort project before user, then by plugin, then by
 * old name; left rows by scope, then plugin, then first old name (a stopped
 * row by its detail, a file row before the plugin rows), in code-unit order.
 * The notices fold and deduplicate as a standalone section list does.
 * Severity is `"warning"` when a row was left in place, a server was removed
 * as unsupported or malformed, or a notice warns, and `"info"` otherwise: a
 * server removed because its plugin no longer declares it or is disabled does
 * not by itself warn.
 */
function resolveMcpMigration(surface: McpMigrationSurface): ResolvedMcpMigration {
  const rows = surface.rows.map((row) => redactMigrationRow(row));
  const moved = rows.filter(isMovedRow).sort(compareMovedRows);
  const removed = rows.filter(isRemovedRow).sort(compareRemovedRows);
  const left = rows.filter(isLeftRow).sort(compareLeftRows);
  const notices = mcpConfigNoticeSurfaces(surface.notices).flatMap((section) =>
    distinctNotices(section.notices),
  );
  const warns = left.length > 0 || removed.some(isWarningRemoval) || notices.some(isWarningNotice);
  return {
    kind: "mcp-migration",
    rows: [...moved, ...removed, ...left],
    notices,
    severity: warns ? "warning" : "info",
    needsReload: moved.length > 0 || removed.length > 0,
  };
}
