import { softDepStatus } from "../platform/pi-api.ts";

import { causeChainTrailer } from "./errors.ts";
import {
  composeMarketplaceBlock,
  composePluginLinesWith,
  composeReconcileAppliedBody,
  renderMarketplaceInfo,
  renderMarketplaceInfoCascade,
  renderMarketplaceNotAdded,
  renderMpHeader,
  renderPluginInfo,
  renderPluginInfoCascade,
} from "./notification-grammar.ts";
import {
  composeTally,
  composeWithSummary,
  foldTallyAndHint,
  isInfoKind,
  RELOAD_HINT_TRAILER,
  shouldEmitReloadHint,
  UPDATE_NO_OP_HEADLINE,
} from "./notification-summary.ts";
import { redactCauseChain } from "./redact-absolute-paths.ts";

import type { StandaloneKind } from "./notification-summary.ts";
import type {
  CascadeNotificationMessage,
  NotificationMessage,
  PluginNotificationMessage,
  ReconcileAppliedCascadeMessage,
  Severity,
  UsageErrorMessage,
} from "./notification-types.ts";
import type { Scope } from "./types.ts";
import type { NotificationContext, SoftDepStatus, PiInventory } from "../platform/pi-api.ts";

/**
 * shared/notification-dispatch.ts -- the SOLE sanctioned ctx.ui.notify call
 * site and the
 * single source of truth for the structured-notification surface. Severity is
 * a caller-stamped per-row field (`Severity`): each producer stamps every row's
 * `severity`, and `computeSeverity` takes the numeric MAX over the rows (SEV-02)
 * to derive the magic-string `"info" | "warning" | "error"` second arg the Pi
 * API's `notify(msg, type?)` accepts -- NOT content inference. The standalone
 * info-surface kinds (`marketplace-not-added`, `plugin-info`, and the read-only
 * info/cascade kinds) carry no per-row severity array, so they keep a tiny
 * kind->severity map. The fallow rule `architecture/notify-chokepoint`
 * excludes this file, so it needs no inline suppression.
 *
 * Public API:
 *
 *  - notify(ctx, pi, NotificationMessage)
 *  Single state-change entry. Renders the marketplace/plugin tree
 *  to a single string and routes through ctx.ui.notify with computed
 *  severity, a computed reload-hint trailer, and a single
 *  softDepStatus(pi) probe at entry threaded through the renderer so
 *  per-row {requires pi-subagents} / {requires pi-mcp-adapter} markers are
 *  injected at render time.
 *  - notifyUsageError(ctx, UsageErrorMessage)
 *  Argv-validation errors. On-the-wire string is
 *  `${message.message}\n\n${message.usage}` at "error" severity
 *  (SNM-13).
 *  - notifyMcpConfigNotices(ctx, McpConfigNotice[])
 *  One warning per MCP config notice kind, rendered from the shared
 *  `mcpConfigNoticeSections` (AFILE-04, AVAR-04).
 *  - notifyMcpMigration(ctx, McpMigrationReport)
 *  The one reload migration notice for both scopes, with the same MCP config
 *  lines inside its body (AMIG-03).
 *
 * Closed-set source of truth: the `Reason`, `StatusToken`, `PluginStatus` and
 * `MarketplaceStatus` literal-union vocabularies live in
 * `notification-types.ts`. No `MARKERS` / `PATTERN_CLASSES`
 * vocabularies sit alongside them: the `<autoupdate>` / `<no autoupdate>` chevron
 * tokens are written as literals at their render sites in `renderMpHeader`,
 * and the pattern-class labels only ever named message shapes in prose. The
 * `compare-name-scope.ts` owns the single per-scope row-order policy across
 * every list-rendering surface.
 *
 * Callers import vocabulary from `notification-types.ts` and rendering or
 * dispatch behavior directly from this file. No barrel re-exports.
 */

/**
 * Emit one summary-composed payload at the sole Pi notification boundary.
 *
 * Module-private: the state-change dispatch paths -- `notify`,
 * `emitContextCascade`, `emitUpdateNoOpCascade`, and
 * `emitReconcileAppliedContextCascade` (the latter three via the shared
 * `emitCascadeWith` helper) -- route through it, so those paths' emitted
 * bytes and one-call-per-invocation discipline are this seam's contract. The
 * remaining public functions (`notifyUsageError`, `notifyUsageInfo`,
 * `notifyDiagnostic`, `notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap`,
 * `notifyMcpConfigNotices`, `makeRawNotifyFn`) carry no summary/tally/reload-hint
 * to compose, so they call `ctx.ui.notify` directly instead. `notifyMcpMigration`
 * writes its own summary line and reload hint, so it calls `ctx.ui.notify`
 * directly too.
 */
function emitWithSummary(
  ctx: NotificationContext,
  message: NotificationMessage,
  body: string,
): void {
  const notification = composeWithSummary(message, body);
  if (notification.length === 1) {
    ctx.ui.notify(notification[0]);
  } else {
    ctx.ui.notify(notification[0], notification[1]);
  }
}

/**
 * Usage error notify (ES-3 primitive). Surfaces a usage-style error at
 * `error` severity with the relevant Usage block appended after a blank
 * line. The on-the-wire string is
 * `${message.message}\n\n${message.usage}` (SNM-13). The blank
 * line between message and Usage block is part of the user contract;
 * `tests/shared/notification-dispatch.test.ts` asserts it byte-for-byte
 * (the SNM-13 case).
 */
export function notifyUsageError(ctx: NotificationContext, message: UsageErrorMessage): void {
  ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error");
}

/**
 * Surfaces usage documentation at "info" severity (for explicit help requests).
 */
export function notifyUsageInfo(ctx: NotificationContext, usage: string): void {
  ctx.ui.notify(usage, "info");
}

/**
 * S2 / PR #51: post-cascade hygiene warnings out-of-band notification seam.
 *
 * Surfaces post-state-commit warnings (data-dir mkdir deferred,
 * completion-cache refresh deferred, agent foreign-content preserved,
 * bridge-side soft warnings) that have no representation in the
 * `MarketplaceNotificationMessage` cascade body. The reconcile apply
 * pass collects these from `InstallPluginOutcome.postCommitWarnings`
 * across the install bucket and fires this helper exactly once -- a
 * sanctioned exception to the per-cascade single-notify discipline
 * (RECON-04 / IL-2) that mirrors `import/execute.ts`'s `pushDiagnostic`
 * channel.
 *
 * The on-the-wire form is `${header}\n\n${lines.join("\n")}` at
 * `"warning"` severity. The header counts the per-warning lines so the
 * operator sees both the total and the per-warning detail without
 * re-flowing the cascade body. Standalone-mode commands swallow these
 * per D-19-01; orchestrated-mode (cascade) callers use this seam.
 */
export function notifyDiagnostic(
  ctx: NotificationContext,
  header: string,
  lines: readonly string[],
): void {
  if (lines.length === 0) {
    return;
  }

  ctx.ui.notify(`${header}\n\n${lines.join("\n")}`, "warning");
}

/**
 * T-62-09 IL-2 EXEMPTION: surfaces the `rewakeSummary` UI message at
 * `"info"` severity from the asyncRewake exit handler. This is the
 * single sanctioned runtime notify call originating from
 * `bridges/hooks/async-rewake/registry.ts`; the exemption exists
 * because `rewakeSummary` is the upstream Claude-Code-mandated UI
 * status surface declared in the plugin author's hook handler -- the
 * hooks bridge does not have a structured `NotificationMessage` arm
 * for it (HOOK-06).
 *
 * Empty strings are silently ignored so the caller can pass an
 * `entry.rewakeSummary` field unconditionally without a guard.
 */
export function notifyAsyncRewakeSummary(ctx: NotificationContext, summary: string): void {
  if (summary.length === 0) {
    return;
  }

  ctx.ui.notify(summary, "info");
}

/**
 * STOP-07 / D-88-01 IL-2 bridge seam: the one-shot Stop-hook override-cap
 * warning. The settle dispatcher (`bridges/hooks/settle.ts`) fires this
 * exactly once when Stop hooks drive 8 consecutive bridge re-entries -- block
 * decisions and additionalContext continuations share one consecutive
 * re-entry counter (D-88-08) -- the loop protection suppresses the 8th
 * re-entry and surfaces this warning so a livelocking hook is visible to the
 * user rather than silently overridden (the transparency prohibition behind
 * D-88-01). Warning severity per the tri-state model: the turn DID end (the
 * protection worked) but the plugin's block desire was deliberately
 * suppressed, so the user should notice.
 *
 * On-the-wire form mirrors `notifyDiagnostic`: a non-empty summary first line
 * ("Stop hook override cap reached.") followed by a `\n\n` separator and a
 * detail block naming the plugin and stating the 8-consecutive-re-entry /
 * turn-ended-despite-active-block fact. The host UI prepends the `Warning:` label
 * to the summary line (the same shape `notifyDiagnostic` /
 * `notifyAsyncRewakeSummary` already ship without tripping the notify-grammar
 * invariant, which only walks structured `NotificationMessage` fixtures). The
 * literal `8` is the fixed override cap (STOP-07); it is duplicated here rather
 * than imported from the bridge layer so `shared/` does not depend on
 * `bridges/`. The byte form is locked by
 * `tests/architecture/hooks-cap-notify.test.ts` against the
 * `stop-override-cap` block in `docs/output-catalog.md`.
 */
export function notifyStopHookOverrideCap(ctx: NotificationContext, pluginId: string): void {
  ctx.ui.notify(
    `Stop hook override cap reached.\n\n\`${pluginId}\`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.`,
    "warning",
  );
}

/**
 * AFILE-04 / AFILE-02: one fact about an MCP config file that a command
 * rewrote or left alone. The MCP bridge reports it and the orchestrator
 * routes it to `notifyMcpConfigNotices` after its own row.
 */
export interface McpConfigFileNotice {
  readonly kind: "comments-dropped" | "left-unchanged";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json" | "mcp.json";
}

/**
 * AFILE-06: a stage replaced a user's marker-less override with the plugin's
 * entry and keeps the override in that entry's marker. `fields` lists the
 * override's fields that stop applying while the plugin provides `server`, in
 * the override's key order. It names fields, never their values.
 */
export interface McpOverrideKeptNotice {
  readonly kind: "override-kept";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
  readonly fields: readonly string[];
}

/**
 * AFILE-01 / AFILE-06: an unstage wrote a kept override back as a marker-less
 * entry. It renders nothing. It cancels an earlier override-kept notice for
 * the same scope, file and server, so a command that keeps and then writes
 * back an override shows no warning for it.
 */
export interface McpOverrideRestoredNotice {
  readonly kind: "override-restored";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json" | "mcp.json";
  readonly server: string;
}

/**
 * AVAR-04: a staged plugin server references environment variables that are
 * unset and have no `:-` default. `names` lists them once each, in first-seen
 * order. It names variables, never their values.
 */
export interface McpVariablesMissingNotice {
  readonly kind: "variables-missing";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
  readonly names: readonly string[];
}

/**
 * AVAR-04 / AVAR-05: a staged plugin server's `url` or `headers` references
 * deny-listed credential variables that were set at install, and the entry
 * carries empty values in their place. `names` lists them once each, in
 * first-seen order. It names variables, never their values.
 */
export interface McpCredentialsBlankedNotice {
  readonly kind: "credentials-blanked";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
  readonly names: readonly string[];
}

/**
 * ANAME-07 / AMIG-01: a staged plugin server declares tool permission rules
 * that pi-mcp-adapter does not enforce. `fields` lists the field names in
 * table order. It names fields, never tool names or policy values.
 */
export interface McpToolRulesUnenforcedNotice {
  readonly kind: "tool-rules-unenforced";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
  readonly fields: readonly string[];
}

/**
 * AMIG-01: a stage removed a marker-less entry pi-mcp-adapter had written
 * under `server`, the old name of a plugin server whose `mcp.json` entry the
 * command removed: an override stub or the panel's direct-tools copy.
 */
export interface McpLeftoverRemovedNotice {
  readonly kind: "leftover-removed";
  readonly scope: Scope;
  readonly file: "mcp-adapter.json";
  readonly plugin: string;
  readonly server: string;
}

/**
 * AFILE-04 / AFILE-06 / AVAR-04 / ANAME-07 / AMIG-01: one MCP config fact a
 * command routes to `notifyMcpConfigNotices`.
 */
export type McpConfigNotice =
  | McpConfigFileNotice
  | McpOverrideKeptNotice
  | McpOverrideRestoredNotice
  | McpVariablesMissingNotice
  | McpCredentialsBlankedNotice
  | McpToolRulesUnenforcedNotice
  | McpLeftoverRemovedNotice;

function mcpConfigFileLine(notice: McpConfigFileNotice): string {
  return notice.kind === "comments-dropped"
    ? `The ${notice.scope}-scope ${notice.file} was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.`
    : `The ${notice.scope}-scope ${notice.file} is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.`;
}

function mcpOverrideKeptLine(notice: McpOverrideKeptNotice): string {
  return `${notice.plugin} now provides "${notice.server}" in the ${notice.scope}-scope ${notice.file}. Your override for "${notice.server}" is kept, but these fields of it stop applying: ${notice.fields.join(", ")}. It comes back when you uninstall or disable ${notice.plugin}.`;
}

function mcpVariablesMissingLine(notice: McpVariablesMissingNotice): string {
  return `Server "${notice.server}" from ${notice.plugin} in the ${notice.scope}-scope ${notice.file} uses environment variables that were not set at install: ${notice.names.join(", ")}.`;
}

function isVariablesMissing(notice: McpConfigNotice): notice is McpVariablesMissingNotice {
  return notice.kind === "variables-missing";
}

function mcpCredentialsBlankedLine(notice: McpCredentialsBlankedNotice): string {
  return `Server "${notice.server}" from ${notice.plugin} in the ${notice.scope}-scope ${notice.file} references credential variables that Claude Code never sends to a remote server: ${notice.names.join(", ")}. They were written as empty values.`;
}

function isCredentialsBlanked(notice: McpConfigNotice): notice is McpCredentialsBlankedNotice {
  return notice.kind === "credentials-blanked";
}

function mcpToolRulesUnenforcedLine(notice: McpToolRulesUnenforcedNotice): string {
  return `Server "${notice.server}" from ${notice.plugin} in the ${notice.scope}-scope ${notice.file} declares tool permission rules that pi-mcp-adapter does not enforce: ${notice.fields.join(", ")}. Its tools run without these rules.`;
}

function isToolRulesUnenforced(notice: McpConfigNotice): notice is McpToolRulesUnenforcedNotice {
  return notice.kind === "tool-rules-unenforced";
}

function mcpLeftoverRemovedLine(notice: McpLeftoverRemovedNotice): string {
  return `Removed "${printable(notice.server)}" from the ${notice.scope}-scope ${notice.file}: pi-mcp-adapter had written it under the old name of a server from ${notice.plugin}, for example for /mcp-adapter disable, and it no longer applies.`;
}

function isLeftoverRemoved(notice: McpConfigNotice): notice is McpLeftoverRemovedNotice {
  return notice.kind === "leftover-removed";
}

function mcpConfigFileLines(
  notices: readonly McpConfigNotice[],
  kind: McpConfigFileNotice["kind"],
): string[] {
  const lines: string[] = [];
  for (const notice of notices) {
    if (notice.kind === kind) {
      lines.push(mcpConfigFileLine(notice));
    }
  }

  return lines;
}

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

/**
 * AFILE-04 / AFILE-02 / AFILE-06 / AVAR-04 / ANAME-07 / AMIG-01: the MCP config
 * lines of a notice list, one section per kind in the order comments-dropped,
 * left-unchanged, override-kept, variables-missing, credentials-blanked,
 * tool-rules-unenforced, leftover-removed. Each section holds its summary and
 * its distinct lines in first-seen order, and may be empty.
 * An override-kept line stands only when no later override-restored notice
 * for the same scope, file and server cancels it. An override-restored notice
 * renders nothing. `notifyMcpConfigNotices` and `notifyMcpMigration` both
 * render from these sections, so their lines cannot drift.
 */
function mcpConfigNoticeSections(
  notices: readonly McpConfigNotice[],
): ReadonlyArray<readonly [summary: string, lines: readonly string[]]> {
  const sections: ReadonlyArray<readonly [summary: string, lines: readonly string[]]> = [
    ["MCP config comments removed.", mcpConfigFileLines(notices, "comments-dropped")],
    ["MCP config left unchanged.", mcpConfigFileLines(notices, "left-unchanged")],
    [
      "MCP server override kept.",
      standingOverrideNotices(notices).map((notice) => mcpOverrideKeptLine(notice)),
    ],
    [
      "MCP server variables not set.",
      notices.filter(isVariablesMissing).map((notice) => mcpVariablesMissingLine(notice)),
    ],
    [
      "MCP server credentials withheld.",
      notices.filter(isCredentialsBlanked).map((notice) => mcpCredentialsBlankedLine(notice)),
    ],
    [
      "MCP server tool rules not enforced.",
      notices.filter(isToolRulesUnenforced).map((notice) => mcpToolRulesUnenforcedLine(notice)),
    ],
    [
      "Old MCP server settings removed.",
      notices.filter(isLeftoverRemoved).map((notice) => mcpLeftoverRemovedLine(notice)),
    ],
  ];
  return sections.map(([summary, lines]) => [summary, [...new Set(lines)]] as const);
}

/**
 * AFILE-04 / AFILE-02 / AFILE-06 / AVAR-04 / ANAME-07 / AMIG-01 IL-2 seam: the
 * one surface for MCP config notices. Bridges report the facts and orchestrators
 * call this after their own row. It sends one `"warning"` notification per
 * non-empty `mcpConfigNoticeSections` section, in section order: a summary
 * line, a blank line, then the section's lines. An empty list sends nothing.
 * A line names the scope, the file basename, the plugin, the server, and
 * override field names, environment variable names or tool permission field
 * names only, so it carries no absolute path, no field value, no variable
 * value and no tool name (AVAR-05). A leftover's old name is read from a
 * config file, so its control characters are escaped. The host UI prepends
 * the `Warning:` label to the summary line. The byte form is locked by
 * `tests/architecture/mcp-config-notices.test.ts` against the
 * `mcp-comments-dropped`, `mcp-config-left-unchanged`, `mcp-override-kept`,
 * `mcp-variables-missing`, `mcp-credentials-blanked`,
 * `mcp-tool-rules-unenforced` and `mcp-leftover-removed` blocks in
 * `docs/output-catalog.md`. The reload
 * migration renders the same sections inside its one notice instead
 * (`notifyMcpMigration`).
 */
export function notifyMcpConfigNotices(
  ctx: NotificationContext,
  notices: readonly McpConfigNotice[],
): void {
  for (const [summary, lines] of mcpConfigNoticeSections(notices)) {
    if (lines.length > 0) {
      ctx.ui.notify(`${summary}\n\n${lines.join("\n")}`, "warning");
    }
  }
}

/** AMIG-01 / AMIG-03: a server the reload moved from `mcp.json` to `mcp-adapter.json`. */
export interface McpMigrationMovedRow {
  readonly kind: "moved";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  /** The server's key in `mcp.json`, its declared name. */
  readonly from: string;
  /** The server's key in `mcp-adapter.json` (ANAME-01). */
  readonly to: string;
}

/** AMIG-01 / AMIG-03: a scope or plugin whose move stopped, with a path-free detail. */
export interface McpMigrationStoppedRow {
  readonly kind: "stopped";
  readonly scope: Scope;
  readonly detail: string;
}

/**
 * AMIG-04: a plugin's marked `mcp.json` entries that no install record in
 * this scope owns. `servers` holds the old names in file order.
 */
export interface McpMigrationUnownedRow {
  readonly kind: "unowned";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
}

/**
 * AMIG-01: an installed plugin whose source cannot be read offline, so its
 * entries stay under their old names until a reinstall or the next reload.
 */
export interface McpMigrationSourceUnreadableRow {
  readonly kind: "source-unreadable";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
}

/**
 * AMIG-01: an installed plugin that its marketplace manifest no longer lists,
 * or lists in a form that is not valid. A reinstall reads the same manifest,
 * so the remedy is a marketplace update or an uninstall.
 */
export interface McpMigrationNotListedRow {
  readonly kind: "not-listed";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
}

/**
 * AMIG-01: an installed plugin whose new key another config source already
 * defines in full, so none of its servers moved. `key` is that source's key
 * and `source` a scope-and-file label, never an absolute path.
 */
export interface McpMigrationCollisionRow {
  readonly kind: "collision";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
  readonly key: string;
  readonly source: string;
}

/** AMIG-01: a scope config file that does not parse, so nothing in the scope moved. */
export interface McpMigrationFileUnreadableRow {
  readonly kind: "file-unreadable";
  readonly scope: Scope;
  readonly file: "mcp.json" | "mcp-adapter.json";
}

/**
 * AMIG-01: why the reload removed a server's `mcp.json` entry without moving
 * it: the plugin no longer declares it, the plugin is disabled, the server
 * needs a feature pi-mcp-adapter cannot run, or the plugin's MCP config is
 * not valid.
 */
export type McpMigrationRemovalCause =
  "not-declared" | "disabled" | "unsupported-feature" | "malformed";

/**
 * AMIG-01 / AMIG-03: a server whose `mcp.json` entry the reload removed and
 * did not write to `mcp-adapter.json`. `server` is its old name; `feature`
 * names the blocking feature, set only for an `unsupported-feature` cause.
 */
export interface McpMigrationRemovedRow {
  readonly kind: "removed";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly server: string;
  readonly cause: McpMigrationRemovalCause;
  readonly feature?: string;
}

/**
 * AMIG-02: a plugin whose servers the reload wrote to `mcp-adapter.json` but
 * could not remove from `mcp.json`, so both files hold them until the next
 * reload. `detail` carries no absolute path.
 */
export interface McpMigrationUnfinishedRow {
  readonly kind: "unfinished";
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
  readonly detail: string;
}

/** AMIG-03: one row of the reload migration notice. */
export type McpMigrationRow =
  | McpMigrationMovedRow
  | McpMigrationRemovedRow
  | McpMigrationStoppedRow
  | McpMigrationUnownedRow
  | McpMigrationNotListedRow
  | McpMigrationSourceUnreadableRow
  | McpMigrationCollisionRow
  | McpMigrationFileUnreadableRow
  | McpMigrationUnfinishedRow;

/** A row whose servers stay in `mcp.json`. */
type McpMigrationLeftRow = Exclude<McpMigrationRow, McpMigrationMovedRow | McpMigrationRemovedRow>;

/** AMIG-03: everything one reload's migration reports, across both scopes. */
export interface McpMigrationReport {
  readonly rows: readonly McpMigrationRow[];
  /** The MCP config facts of the files the migration wrote. */
  readonly notices: readonly McpConfigNotice[];
}

const MCP_MIGRATION_MOVED_SUMMARY = "Plugin MCP servers moved from mcp.json to mcp-adapter.json.";
const MCP_MIGRATION_REMOVED_SUMMARY = "Plugin MCP servers removed from mcp.json.";
const MCP_MIGRATION_STOPPED_SUMMARY = "Plugin MCP servers in mcp.json need attention.";
const MCP_MIGRATION_COST_LINE =
  "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.";

/** Whether a UTF-16 code unit is a C0 control, DEL, or a C1 control. */
function isControlCodeUnit(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

/**
 * AMIG-03: writes each C0 or C1 control character as `\u` and four
 * lowercase hex digits, so a name read from a config file cannot move the
 * cursor or end a line in the notice.
 */
function printable(text: string): string {
  return Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    return isControlCodeUnit(code) ? `\\u${code.toString(16).padStart(4, "0")}` : char;
  }).join("");
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

function isMovedRow(row: McpMigrationRow): row is McpMigrationMovedRow {
  return row.kind === "moved";
}

function isRemovedRow(row: McpMigrationRow): row is McpMigrationRemovedRow {
  return row.kind === "removed";
}

function isLeftRow(row: McpMigrationRow): row is McpMigrationLeftRow {
  return row.kind !== "moved" && row.kind !== "removed";
}

function movedRowLine(row: McpMigrationMovedRow): string {
  return `  ${printable(row.from)} -> ${row.to} (${printable(row.plugin)}) [${row.scope}]`;
}

function removalReason(row: McpMigrationRemovedRow): string {
  const plugin = printable(row.plugin);
  switch (row.cause) {
    case "not-declared":
      return `${plugin} no longer declares it.`;
    case "disabled":
      return `${plugin} is disabled.`;
    case "unsupported-feature": {
      const feature = row.feature === undefined ? "" : ` ${printable(row.feature)}`;
      return `{unsupported mcp}${feature}: pi-mcp-adapter cannot run it.`;
    }

    case "malformed":
      return `{malformed mcp}: ${plugin}'s MCP config is not valid, so none of its servers are installed.`;
  }
}

function removedRowLine(row: McpMigrationRemovedRow): string {
  return `  ${printable(row.server)} (${printable(row.plugin)}) [${row.scope}] ${removalReason(row)}`;
}

/** Whether a removal makes the notice a warning: a dropped or malformed server (AMIG-03). */
function isWarningRemoval(row: McpMigrationRemovedRow): boolean {
  return row.cause === "unsupported-feature" || row.cause === "malformed";
}

/** An owner row's prefix: its old names, plugin and scope. */
function ownerRowPrefix(
  row: Exclude<McpMigrationLeftRow, McpMigrationStoppedRow | McpMigrationFileUnreadableRow>,
): string {
  return `  ${row.servers.map(printable).join(", ")} (${printable(row.plugin)}) [${row.scope}]`;
}

function leftRowLine(row: McpMigrationLeftRow): string {
  switch (row.kind) {
    case "stopped":
      return `  The ${row.scope}-scope move stopped: ${printable(row.detail)}. The next /reload tries again.`;
    case "file-unreadable":
      return `  The ${row.scope}-scope ${row.file} is not a valid MCP config, so nothing in this scope moved. Fix it, then run /reload.`;
    case "unowned":
      return `${ownerRowPrefix(row)} No plugin installed in the ${row.scope} scope owns it. Install ${printable(row.plugin)}@${printable(row.marketplace)} or remove it from mcp.json.`;
    case "not-listed":
      return `${ownerRowPrefix(row)} The ${printable(row.marketplace)} marketplace no longer lists ${printable(row.plugin)} in a valid form. Run /claude:plugin marketplace update ${printable(row.marketplace)}, or /claude:plugin uninstall ${printable(row.plugin)}@${printable(row.marketplace)} to remove it.`;
    case "source-unreadable":
      return `${ownerRowPrefix(row)} The plugin source is not available offline. Run /claude:plugin reinstall ${printable(row.plugin)}@${printable(row.marketplace)} to move it.`;
    case "collision":
      return `${ownerRowPrefix(row)} ${printable(row.key)} is already defined in the ${printable(row.source)}, so no server of ${printable(row.plugin)} moved. Remove or rename that server, then run /reload.`;
    case "unfinished":
      return `${ownerRowPrefix(row)} The new entries are written, but mcp.json could not be updated: ${printable(row.detail)}. The next /reload finishes the move.`;
  }
}

/** The rows of one notice, each kind in its render order. */
interface McpMigrationSortedRows {
  readonly moved: readonly McpMigrationMovedRow[];
  readonly removed: readonly McpMigrationRemovedRow[];
  readonly left: readonly McpMigrationLeftRow[];
}

/** A titled section, or nothing when it has no line. */
function titledSection<T>(title: string, rows: readonly T[], line: (row: T) => string): string[] {
  return rows.length > 0 ? [title, ...rows.map(line)] : [];
}

/** The notice body in its fixed order (AMIG-03). */
function mcpMigrationLines(
  rows: McpMigrationSortedRows,
  notices: readonly McpConfigNotice[],
): string[] {
  const { moved, removed, left } = rows;
  return [
    ...titledSection("Moved to mcp-adapter.json:", moved, movedRowLine),
    ...titledSection("Removed from mcp.json:", removed, removedRowLine),
    ...titledSection("Left in mcp.json:", left, leftRowLine),
    ...(moved.length > 0 ? [MCP_MIGRATION_COST_LINE] : []),
    ...mcpConfigNoticeSections(notices).flatMap(([, lines]) => lines),
    ...(moved.length > 0 || removed.length > 0 ? [RELOAD_HINT_TRAILER] : []),
  ];
}

/** The summary line: attention when a row stays, else what changed. */
function mcpMigrationSummary(rows: McpMigrationSortedRows): string {
  if (rows.left.length > 0) {
    return MCP_MIGRATION_STOPPED_SUMMARY;
  }

  return rows.moved.length > 0 ? MCP_MIGRATION_MOVED_SUMMARY : MCP_MIGRATION_REMOVED_SUMMARY;
}

/**
 * Whether a notice makes the migration notice a warning: a leftover removed,
 * or a moved server with an unset variable, a withheld credential or tool
 * rules not enforced. `notifyMcpConfigNotices` sends these at `"warning"` on
 * every other staging path (ANAME-07, AVAR-04).
 */
function isWarningNotice(notice: McpConfigNotice): boolean {
  return (
    isLeftoverRemoved(notice) ||
    isVariablesMissing(notice) ||
    isCredentialsBlanked(notice) ||
    isToolRulesUnenforced(notice)
  );
}

/** `"warning"` when a row stays, a server was dropped, or a notice warns (AMIG-03). */
function mcpMigrationSeverity(
  rows: McpMigrationSortedRows,
  notices: readonly McpConfigNotice[],
): "info" | "warning" {
  const warns =
    rows.left.length > 0 || rows.removed.some(isWarningRemoval) || notices.some(isWarningNotice);
  return warns ? "warning" : "info";
}

/**
 * AMIG-01 / AMIG-03 / AMIG-04 IL-2 seam: the one migration notice per reload,
 * covering both scopes. With no row it sends nothing. Otherwise it sends one
 * notification: a summary line, a blank line, the moved rows, the removed
 * rows with their reason, the rows left in `mcp.json` (stopped,
 * file-unreadable, unowned, not-listed, source-unreadable, collision,
 * unfinished), then, when a row moved, the cost line, then the lines of every
 * `mcpConfigNoticeSections` section, then, when a row moved or was removed,
 * the reload hint. Moved and removed rows sort project before user, then by
 * plugin, then by old name; left rows by scope, then plugin, then first old
 * name (a stopped row by its detail, a file row before the plugin rows), in
 * code-unit order. Severity is `"warning"` when a row was left in place, a
 * server was removed as unsupported or malformed, a leftover was removed, or
 * a moved server has an unset variable, a withheld credential or tool rules
 * not enforced, and `"info"` otherwise: a server removed because its plugin
 * no longer declares it or is disabled does not by itself warn. A row names
 * old names, the adapter key, the plugin, the marketplace and the
 * scope, and every control character in a file-derived string is escaped; a
 * detail or source label carries no absolute path. The byte form is locked
 * by `tests/architecture/mcp-migration-notice.test.ts` against the
 * `mcp-migration-moved`, `mcp-migration-stopped`,
 * `mcp-migration-left-in-place`, `mcp-migration-removed` and
 * `mcp-migration-unfinished` blocks in `docs/output-catalog.md`.
 */
export function notifyMcpMigration(ctx: NotificationContext, report: McpMigrationReport): void {
  if (report.rows.length === 0) {
    return;
  }

  const rows: McpMigrationSortedRows = {
    moved: report.rows.filter(isMovedRow).sort(compareMovedRows),
    removed: report.rows.filter(isRemovedRow).sort(compareRemovedRows),
    left: report.rows.filter(isLeftRow).sort(compareLeftRows),
  };
  const lines = mcpMigrationLines(rows, report.notices);
  ctx.ui.notify(
    `${mcpMigrationSummary(rows)}\n\n${lines.join("\n")}`,
    mcpMigrationSeverity(rows, report.notices),
  );
}

/**
 * Dispatcher for the standalone-dispatched arms of `notify()`. Centralizes the
 * per-variant body composition, then routes through the shared
 * `emitWithSummary` seam (GRAM-04) so error/warning standalone emissions carry
 * the summary line exactly like the cascade arm does. IL-2: one
 * `ctx.ui.notify` call per invocation (the seam performs it).
 */
function dispatchInfoMessage(
  ctx: NotificationContext,
  message: Extract<NotificationMessage, { kind: StandaloneKind }>,
  probe: SoftDepStatus,
): void {
  // Body composition per variant. The standalone renderers share the
  // same `(message, probe) => string` shape; severity is computed off
  // the discriminator via the shared `computeSeverity` ladder.
  let body: string;
  switch (message.kind) {
    case "marketplace-info":
      body = renderMarketplaceInfo(message, probe);
      break;
    case "plugin-info":
      body = renderPluginInfo(message, probe);
      break;
    case "marketplace-info-cascade":
      body = renderMarketplaceInfoCascade(message, probe);
      break;
    case "plugin-info-cascade":
      body = renderPluginInfoCascade(message, probe);
      break;
    case "marketplace-not-added":
      body = renderMarketplaceNotAdded(message, probe);
      break;
    case "reconcile-pending-empty":
      // DIFF-01 SC #2: catalog-locked free-form advisory body line. Hard-coded
      // here so the byte form cannot drift from `docs/output-catalog.md`'s
      // `empty-steady-state` state.
      body = foldAdvisories("Pending: next reload will apply 0 actions.", message.advisories);
      break;
    case "prune-empty":
      body = `Nothing to prune in ${message.scope} scope: no orphaned dependency installs were found.`;
      break;
    case "prune-committed-warning":
      body = foldTallyAndHint(
        `Prune committed in ${message.scope} scope.\n  ${causeChainTrailer(redactCauseChain(message.cause))}`,
        "",
        RELOAD_HINT_TRAILER,
      );
      break;
    case "reconcile-applied-cascade":
      // RECON-04: compose the same cascade body the cascade arm renders
      // (per-mp header + per-plugin row via the existing helpers). The
      // reload-hint trailer is structurally suppressed (the reconcile already
      // ran ON /reload); emitWithSummary handles the summary prepend at
      // error/warning severity. OUT-03/OUT-06/D-03/D-04: a reconcile apply is a
      // plural mixed-subject operation, so the trailing tally folds in after the
      // body (no reload-hint segment), mirroring the
      // `emitReconcileAppliedContextCascade` production path so the byte form is
      // identical whichever entry composes it.
      body = foldTallyAndHint(
        composeReconcileAppliedBody(message, probe),
        composeTally(message),
        "",
      );
      break;
  }

  emitWithSummary(ctx, message, body);
}

/**
 * Structured-notification entry point. Sole public surface for state-change
 * notifications (SNM-12). Severity, reload-hint, and soft-dep probe are
 * computed from contents at notify time (SNM-14, SNM-15, SNM-16).
 */
export function notify(
  ctx: NotificationContext,
  pi: PiInventory,
  message: NotificationMessage,
): void {
  // Single soft-dep probe per invocation; threaded into every renderPluginRow
  // call inside composePluginLines below (cascade arm) and into the info-
  // surface renderers (which accept it for signature parity but do not use it
  // -- info messages never emit soft-dep markers).
  const probe = softDepStatus(pi);

  // Dispatch standalone-dispatched kinds through `dispatchInfoMessage` so the
  // cascade arm below stays under the cognitive-complexity budget. The single
  // `isInfoKind` guard (TYPE-03) is the one place that enumerates the
  // standalone set. The helper performs exactly ONE `ctx.ui.notify` call per
  // invocation (IL-2) and routes through the SAME `emitWithSummary` seam as the
  // cascade arm (GRAM-04): error/warning standalone kinds carry the summary
  // line, info kinds do not. The committed prune warning carries a reload hint.
  // After this branch, TypeScript narrows `message` to `CascadeNotificationMessage` via
  // the exhaustiveness switch below.
  if (isInfoKind(message)) {
    dispatchInfoMessage(ctx, message, probe);
    return;
  }

  // Exhaustiveness gate. After the standalone-arm return above, the only
  // legal residual `message.kind` values are `undefined` (back-compat)
  // or the explicit `"cascade"`. The switch has no default arm, so a
  // future standalone `kind` literal added without extending `isInfoKind`
  // becomes a type and lint error here.
  switch (message.kind) {
    case undefined:
    case "cascade":
      // Cascade body falls through below. RLD-05 / D-07: the disable
      // command's realized (disabled) rows stamp `needsReload: true`, so the
      // reload-hint is driven by the per-row stamp, not by a distinguishing
      // kind.
      break;
  }

  // Cascade body. Caller-supplied order honored end-to-end (no internal
  // sort). An empty top-level marketplaces array renders the
  // "(no marketplaces)" sentinel rather than the empty string; one blank
  // line between marketplace blocks.
  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
  const composed = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
  // WR-06: advisory body lines sit between the body and the tally.
  const body = foldAdvisories(composed, message.advisories);

  // OUT-03 / OUT-04 / D-04: PLURAL cardinality makes the per-operation tally
  // eligible. The tally sits AFTER the body and BEFORE the reload-hint trailer.
  // It is empty for an empty default result and for single-target / legacy
  // emissions.
  const tally = composeTally(message);

  // Compute reload-hint per the state-change trigger ladder and append it
  // with one blank line.
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";
  const withTally = foldTallyAndHint(body, tally, hint);

  // Emit through the shared summary seam (GRAM-04). At info severity the body
  // emits unchanged; at error/warning severity the summary is prepended as its
  // own block, with the tally + reload-hint already folded last:
  // `{summary}\n\n{cascade body}\n\n{tally}\n\n{reload-hint}` (UXG-07 / GRAM-01 /
  // OUT-03).
  emitWithSummary(ctx, message, withTally);
}

/**
 * AUTH-01 seam: create a raw notify callback bound to ctx.ui.notify for
 * use with domain-tier functions (e.g. initiateDeviceFlow) that require a
 * simple `(message, severity?) => void` callback rather than the structured
 * NotificationMessage surface. This is the ONLY sanctioned way to derive
 * a raw callback from ctx.ui.notify outside of notification-dispatch.ts itself --
 * all other code must use notify(ctx, pi, NotificationMessage) directly.
 */
export function makeRawNotifyFn(
  ctx: NotificationContext,
): (message: string, severity?: Severity) => void {
  return (message: string, severity?: Severity): void => {
    if (severity === undefined) {
      ctx.ui.notify(message);
    } else {
      ctx.ui.notify(message, severity);
    }
  };
}

/**
 * WR-06: append the message's advisory body lines as their own block, after the
 * composed body and BEFORE the tally and the reload-hint fold.
 *
 * The single render site for both carriers. A message shape that declares the
 * member gets the identical byte form whichever arm of a command produced it,
 * because the arms differ only in what they hand this function as `body`.
 */
function foldAdvisories(body: string, advisories: readonly string[] | undefined): string {
  const lines = advisories ?? [];
  return lines.length === 0 ? body : `${body}\n\n${lines.join("\n")}`;
}

function emitCascadeWith(
  ctx: NotificationContext,
  pi: PiInventory,
  message: CascadeNotificationMessage | ReconcileAppliedCascadeMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
  hint: string,
  // WR-06: caller-composed advisory body lines. Only the plain cascade carrier
  // declares them; the reconcile-applied carrier passes `undefined`, so the
  // member stays on the two shapes that can actually produce one.
  advisories: readonly string[] | undefined,
): void {
  const probe = softDepStatus(pi);
  const blocks = message.marketplaces.map((mp) => {
    const lines: string[] = [renderMpHeader(mp, probe)];
    for (const p of mp.plugins) {
      lines.push(...composePluginLinesWith(p, probe, mp.scope, renderPluginRowBody));
    }

    return lines.join("\n");
  });
  const composed = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
  // WR-06: advisory body lines sit between the body and the tally, exactly as
  // they do on the central dispatch, so a command that can emit either arm
  // renders the identical trailer from either one.
  const body = foldAdvisories(composed, advisories);
  const withTally = foldTallyAndHint(body, composeTally(message), hint);

  emitWithSummary(ctx, message, withTally);
}

/** Dispatch a state-change cascade with its stamped reload decision. */
export function emitContextCascade(
  ctx: NotificationContext,
  pi: PiInventory,
  message: CascadeNotificationMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
): void {
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";

  emitCascadeWith(ctx, pi, message, renderPluginRowBody, hint, message.advisories);
}

/** Dispatch the never-silent zero-transition update result. */
export function emitUpdateNoOpCascade(
  ctx: NotificationContext,
  pi: PiInventory,
  message: CascadeNotificationMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
): void {
  const probe = softDepStatus(pi);
  const blocks = message.marketplaces.map((mp) => {
    const lines: string[] = [renderMpHeader(mp, probe)];
    for (const p of mp.plugins) {
      lines.push(...composePluginLinesWith(p, probe, mp.scope, renderPluginRowBody));
    }

    return lines.join("\n");
  });
  const body = blocks.join("\n\n");
  const withHeadline = foldTallyAndHint(body, UPDATE_NO_OP_HEADLINE, "");

  emitWithSummary(ctx, message, withHeadline);
}

/** Dispatch an applied reconcile cascade without a redundant reload hint. */
export function emitReconcileAppliedContextCascade(
  ctx: NotificationContext,
  pi: PiInventory,
  message: ReconcileAppliedCascadeMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
): void {
  emitCascadeWith(ctx, pi, message, renderPluginRowBody, "", undefined);
}
