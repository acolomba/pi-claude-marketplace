import type {
  McpConfigFileNotice,
  McpConfigNoticeSection,
  McpCredentialsBlankedNotice,
  McpLeftoverRemovedNotice,
  McpMigrationFileUnreadableRow,
  McpMigrationLeftRow,
  McpMigrationMovedRow,
  McpMigrationRemovedRow,
  McpMigrationRow,
  McpMigrationStoppedRow,
  McpOverrideKeptNotice,
  McpToolRulesUnenforcedNotice,
  McpVariablesMissingNotice,
  RenderedMcpConfigNotice,
} from "./notification-types.ts";

/**
 * shared/notification-mcp.ts -- the text of the MCP config notices and the
 * reload migration notice (AFILE-04, AMIG-03). Resolve hands it folded,
 * deduplicated, sorted, and redacted values; the text strategy in
 * notification-grammar.ts returns what it composes. It imports neither the
 * dispatcher nor resolve.
 *
 * A line names the scope, the file basename, the plugin, the server, and
 * override field names, environment variable names, or tool permission field
 * names only, so it carries no absolute path and no value (AVAR-05). Plugin,
 * server, and marketplace names and migration details come from plugin or
 * config files, so `printable` escapes their control and format characters
 * and their line and paragraph separators.
 */

const MCP_CONFIG_NOTICE_SUMMARIES = {
  "comments-dropped": "MCP config comments removed.",
  "left-unchanged": "MCP config left unchanged.",
  "override-kept": "MCP server override kept.",
  "variables-missing": "MCP server variables not set.",
  "credentials-blanked": "MCP server credentials withheld.",
  "tool-rules-unenforced": "MCP server tool rules not enforced.",
  "leftover-removed": "Old MCP server settings removed.",
} as const satisfies Record<McpConfigNoticeSection, string>;

const MCP_MIGRATION_MOVED_SUMMARY = "Plugin MCP servers moved from mcp.json to mcp-adapter.json.";
const MCP_MIGRATION_REMOVED_SUMMARY = "Plugin MCP servers removed from mcp.json.";
const MCP_MIGRATION_STOPPED_SUMMARY = "Plugin MCP servers in mcp.json need attention.";
const MCP_MIGRATION_COST_LINE =
  "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.";

/** A control, a format character such as a bidi control, or a line or paragraph separator. */
const ESCAPED_CODE_POINT = /^[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]$/u;

/** `\u` and four lowercase hex digits for each UTF-16 code unit of `char`. */
function codeUnitEscapes(char: string): string {
  let escaped = "";
  for (let index = 0; index < char.length; index += 1) {
    // A one-unit slice keeps a surrogate half apart from its pair, so
    // `codePointAt` reads the code unit, not the astral code point.
    const unit = Number(char.slice(index, index + 1).codePointAt(0));
    escaped += String.raw`\u${unit.toString(16).padStart(4, "0")}`;
  }

  return escaped;
}

/**
 * AMIG-03: escapes each control, format, line separator and paragraph
 * separator code point, so a file-derived name cannot move the cursor, end a
 * line, or reorder the text around it in the notice.
 */
function printable(text: string): string {
  return Array.from(text, (char) =>
    ESCAPED_CODE_POINT.test(char) ? codeUnitEscapes(char) : char,
  ).join("");
}

function mcpConfigFileLine(notice: McpConfigFileNotice): string {
  return notice.kind === "comments-dropped"
    ? `The ${notice.scope}-scope ${notice.file} was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.`
    : `The ${notice.scope}-scope ${notice.file} is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.`;
}

function mcpOverrideKeptLine(notice: McpOverrideKeptNotice): string {
  return `${printable(notice.plugin)} now provides "${printable(notice.server)}" in the ${notice.scope}-scope ${notice.file}. Your override for "${printable(notice.server)}" is kept, but these fields of it stop applying: ${notice.fields.map(printable).join(", ")}. It comes back when you uninstall or disable ${printable(notice.plugin)}.`;
}

function mcpVariablesMissingLine(notice: McpVariablesMissingNotice): string {
  return `Server "${printable(notice.server)}" from ${printable(notice.plugin)} in the ${notice.scope}-scope ${notice.file} uses environment variables that were not set at install: ${notice.names.join(", ")}.`;
}

function mcpCredentialsBlankedLine(notice: McpCredentialsBlankedNotice): string {
  return `Server "${printable(notice.server)}" from ${printable(notice.plugin)} in the ${notice.scope}-scope ${notice.file} references credential variables that Claude Code never sends to a remote server: ${notice.names.join(", ")}. They were written as empty values.`;
}

function mcpToolRulesUnenforcedLine(notice: McpToolRulesUnenforcedNotice): string {
  return `Server "${printable(notice.server)}" from ${printable(notice.plugin)} in the ${notice.scope}-scope ${notice.file} declares tool permission rules that pi-mcp-adapter does not enforce: ${notice.fields.join(", ")}. Its tools run without these rules.`;
}

function mcpLeftoverRemovedLine(notice: McpLeftoverRemovedNotice): string {
  return `Removed "${printable(notice.server)}" from the ${notice.scope}-scope ${notice.file}: pi-mcp-adapter had written it under the old name of a server from ${printable(notice.plugin)}, for example for /mcp-adapter disable, and it no longer applies.`;
}

/**
 * AFILE-04 / AFILE-06 / AVAR-04 / ANAME-07 / AMIG-01: the one line a notice
 * renders. Resolve also keys duplicate removal on it, so two notices that
 * read the same render once.
 */
export function mcpConfigNoticeLine(notice: RenderedMcpConfigNotice): string {
  switch (notice.kind) {
    case "comments-dropped":
    case "left-unchanged":
      return mcpConfigFileLine(notice);
    case "override-kept":
      return mcpOverrideKeptLine(notice);
    case "variables-missing":
      return mcpVariablesMissingLine(notice);
    case "credentials-blanked":
      return mcpCredentialsBlankedLine(notice);
    case "tool-rules-unenforced":
      return mcpToolRulesUnenforcedLine(notice);
    case "leftover-removed":
      return mcpLeftoverRemovedLine(notice);
  }
}

/**
 * AFILE-04: one notice section as text: its summary line, a blank line, then
 * one line per notice. The host UI prepends the `Warning:` label to the
 * summary line. `test/architecture/mcp-config-notices.test.ts` locks the
 * bytes against the catalog blocks in `docs/output-catalog.md`.
 */
export function composeMcpConfigNoticesText(
  section: McpConfigNoticeSection,
  notices: readonly RenderedMcpConfigNotice[],
): string {
  return `${MCP_CONFIG_NOTICE_SUMMARIES[section]}\n\n${notices.map((notice) => mcpConfigNoticeLine(notice)).join("\n")}`;
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

/** An owner row's prefix: its old names, plugin and scope. */
function ownerRowPrefix(
  row: Exclude<McpMigrationLeftRow, McpMigrationStoppedRow | McpMigrationFileUnreadableRow>,
): string {
  return `  ${row.servers.map(printable).join(", ")} (${printable(row.plugin)}) [${row.scope}]`;
}

/** A printable detail without its own final period, which the row adds. */
function sentenceBody(detail: string): string {
  return printable(detail).replace(/\.$/u, "");
}

function leftRowLine(row: McpMigrationLeftRow): string {
  switch (row.kind) {
    case "stopped":
      return `  The ${row.scope}-scope move stopped: ${sentenceBody(row.detail)}. The next /reload tries again.`;
    case "file-unreadable":
      return `  The ${row.scope}-scope ${row.file} is not a valid MCP config, so nothing in this scope moved. Fix it, then run /reload.`;
    case "unowned":
      return `${ownerRowPrefix(row)} No plugin installed in the ${row.scope} scope owns it. Install ${printable(row.plugin)}@${printable(row.marketplace)} or remove it from mcp.json.`;
    case "not-listed":
      return `${ownerRowPrefix(row)} The ${printable(row.marketplace)} marketplace no longer lists ${printable(row.plugin)} in a valid form. Run /claude:plugin marketplace update ${printable(row.marketplace)}, or /claude:plugin uninstall ${printable(row.plugin)}@${printable(row.marketplace)} to remove it.`;
    case "source-unreadable":
      return `${ownerRowPrefix(row)} The plugin source is not available offline. Run /claude:plugin reinstall ${printable(row.plugin)}@${printable(row.marketplace)} to move it.`;
    case "source-outdated":
      return `${ownerRowPrefix(row)} The cached source of ${printable(row.plugin)} has no plugin at its declared path. Run /claude:plugin update ${printable(row.plugin)}@${printable(row.marketplace)} to move it.`;
    case "marketplace-unreadable":
      return `${ownerRowPrefix(row)} The ${printable(row.marketplace)} marketplace copy cannot give the source of ${printable(row.plugin)}. Run /claude:plugin uninstall ${printable(row.plugin)}@${printable(row.marketplace)} to remove it, or /claude:plugin marketplace update ${printable(row.marketplace)} when the copy is out of date.`;
    case "collision":
      return `${ownerRowPrefix(row)} ${printable(row.key)} is already defined in ${printable(row.source)}, so no server of ${printable(row.plugin)} moved. Remove or rename that server, then run /reload.`;
    case "unfinished":
      return `${ownerRowPrefix(row)} The new entries are written, but ${row.file} could not be updated: ${sentenceBody(row.detail)}. The next /reload finishes the move.`;
  }
}

/** AMIG-03: whether a migration row is a moved server. */
export function isMovedRow(row: McpMigrationRow): row is McpMigrationMovedRow {
  return row.kind === "moved";
}

/** AMIG-03: whether a migration row is a server removed without a move. */
export function isRemovedRow(row: McpMigrationRow): row is McpMigrationRemovedRow {
  return row.kind === "removed";
}

/** AMIG-03: whether a migration row leaves its servers in `mcp.json`. */
export function isLeftRow(row: McpMigrationRow): row is McpMigrationLeftRow {
  return row.kind !== "moved" && row.kind !== "removed";
}

/** A titled section, or nothing when it has no line. */
function titledSection<T>(title: string, rows: readonly T[], line: (row: T) => string): string[] {
  return rows.length > 0 ? [title, ...rows.map(line)] : [];
}

/** The summary line: attention when a row stays, else what changed. */
function mcpMigrationSummary(moved: number, left: number): string {
  if (left > 0) {
    return MCP_MIGRATION_STOPPED_SUMMARY;
  }

  return moved > 0 ? MCP_MIGRATION_MOVED_SUMMARY : MCP_MIGRATION_REMOVED_SUMMARY;
}

/**
 * AMIG-01 / AMIG-03 / AMIG-04: the migration notice as text, without the
 * reload hint, which the text strategy appends when resolve sets
 * `needsReload`. A summary line, a blank line, then the moved rows, the
 * removed rows with their reason, the rows left in `mcp.json`, the cost line
 * when a row moved, and every notice line. `rows` arrive sorted moved, then
 * removed, then left, and `notices` in section order.
 * `test/architecture/mcp-migration-notice.test.ts` locks the bytes against
 * the catalog blocks in `docs/output-catalog.md`.
 */
export function composeMcpMigrationText(
  rows: readonly McpMigrationRow[],
  notices: readonly RenderedMcpConfigNotice[],
): string {
  const moved = rows.filter(isMovedRow);
  const left = rows.filter(isLeftRow);
  const lines = [
    ...titledSection("Moved to mcp-adapter.json:", moved, movedRowLine),
    ...titledSection("Removed from mcp.json:", rows.filter(isRemovedRow), removedRowLine),
    ...titledSection("Left in mcp.json:", left, leftRowLine),
    ...(moved.length > 0 ? [MCP_MIGRATION_COST_LINE] : []),
    ...notices.map((notice) => mcpConfigNoticeLine(notice)),
  ];
  return `${mcpMigrationSummary(moved.length, left.length)}\n\n${lines.join("\n")}`;
}
