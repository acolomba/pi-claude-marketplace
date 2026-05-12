// presentation/plugin-list.ts
//
// PL-1..7 top-level plugin list pure formatter. D-06 orchestrator+presentation
// split: orchestrators/plugin/list.ts (Plan 05-08) owns state-reads and
// manifest soft-fail; this file owns rendering only.
//
// Per D-11, presentation/ does NOT import from persistence/. The payload
// interfaces below are declared LOCALLY as structural minima of the
// orchestrator's payload shape -- the orchestrator constructs the payload
// and passes it in.
//
// Layout per PRD §5.3.1 PL-1..7:
//   [warning] <reason>                           <- PL-6 (zero or more, first)
//   user scope                                   <- group header per scope
//     <marketplace>[ [autoupdate]]               <- PL-7 marketplace header
//       <icon> <name> [(version)] [upgradable] [-- notes]
//         <description truncated at column 66>
//   project scope
//     ...

// PL-4 icon table (PRD §5.3.1). Kept PRIVATE; the renderer maps status -> icon.
const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";

// Column-66 description truncation per PRD §5.3.1.
// D-06 corollary: PRIVATE to this file -- NOT promoted to a shared text-utils
// helper unless a third consumer arrives. Strings longer than 66 chars are
// sliced to 63 chars and suffixed with "...", landing exactly at column 66.
const MAX_LINE_COLUMN = 66;

function truncateColumn66(s: string): string {
  if (s.length <= MAX_LINE_COLUMN) {
    return s;
  }

  return s.slice(0, MAX_LINE_COLUMN - 3) + "...";
}

/**
 * Status of a plugin from the renderer's perspective. The orchestrator
 * classifies each plugin into one of these buckets before constructing
 * the payload; the renderer simply maps to an icon.
 */
export type PluginRenderStatus = "installed" | "available" | "uninstallable";

/**
 * Plugin row in the rendered list.
 *
 * - `version` is the recorded installed version OR the manifest version --
 *   the orchestrator decides which to surface; the renderer just prints it.
 * - `upgradable` is the orchestrator's PL-5 plain string-compare result.
 *   This file does NOT do version math.
 * - `description` is rendered on a second indented line, truncated at
 *   column 66.
 * - `notes` are appended inline after the head line with a `-- ` prefix
 *   (e.g., "not installable: <reason>" for uninstallable plugins).
 */
export interface PluginListEntry {
  readonly name: string;
  readonly status: PluginRenderStatus;
  readonly version?: string;
  readonly upgradable?: boolean;
  readonly description?: string;
  readonly notes?: readonly string[];
}

/**
 * Per-marketplace block. `autoupdate` drives the PL-7 `[autoupdate]` tag
 * in the marketplace header.
 */
export interface PluginListMarketplace {
  readonly name: string;
  readonly scope: "user" | "project";
  readonly autoupdate: boolean;
  readonly plugins: readonly PluginListEntry[];
}

/**
 * Top-level payload the orchestrator passes to {@link renderPluginList}.
 */
export interface PluginListPayload {
  readonly marketplaces: readonly PluginListMarketplace[];
}

function iconFor(status: PluginRenderStatus): string {
  switch (status) {
    case "installed":
      return ICON_INSTALLED;
    case "available":
      return ICON_AVAILABLE;
    case "uninstallable":
      return ICON_UNINSTALLABLE;
  }
}

function renderPluginEntry(p: PluginListEntry): string {
  const head: string[] = [iconFor(p.status), p.name];
  if (p.version !== undefined) {
    head.push(`(${p.version})`);
  }

  if (p.upgradable === true) {
    head.push("upgradable");
  }

  // Notes (e.g., "not installable: <reason>") appear after head, single line.
  if (p.notes !== undefined && p.notes.length > 0) {
    head.push(`-- ${p.notes.join("; ")}`);
  }

  const lines: string[] = [`  ${head.join(" ")}`];
  if (p.description !== undefined && p.description.length > 0) {
    lines.push(`    ${truncateColumn66(p.description)}`);
  }

  return lines.join("\n");
}

/**
 * D-06 pure formatter for the top-level plugin list.
 *
 * Takes a structured payload + a parallel warnings array (manifest load
 * failures collected by the orchestrator per PL-6) and returns the rendered
 * string. The orchestrator calls
 * `notifySuccess(ctx, renderPluginList(payload, warnings))`.
 *
 * Empty case (PL-1 / PL-2): a byte-stable sentinel `"No plugins configured."`
 * is returned when there are neither marketplaces nor warnings to surface.
 */
export function renderPluginList(
  payload: PluginListPayload,
  warnings: readonly string[] = [],
): string {
  if (payload.marketplaces.length === 0 && warnings.length === 0) {
    return "No plugins configured.";
  }

  const out: string[] = [];

  // PL-6 warnings first (before any marketplace header), one line each.
  for (const w of warnings) {
    out.push(`[warning] ${w}`);
  }

  // Group by scope: user marketplaces first, then project (mirrors
  // marketplace-list.ts's scope ordering for visual consistency).
  const byScope: Record<"user" | "project", PluginListMarketplace[]> = {
    user: [],
    project: [],
  };
  for (const mp of payload.marketplaces) {
    byScope[mp.scope].push(mp);
  }

  for (const scope of ["user", "project"] as const) {
    const mps = byScope[scope];
    if (mps.length === 0) {
      continue;
    }

    out.push(`${scope} scope`);
    for (const mp of mps) {
      appendMarketplaceBlock(out, mp);
    }
  }

  return out.join("\n");
}

function appendMarketplaceBlock(out: string[], mp: PluginListMarketplace): void {
  const tag = mp.autoupdate ? " [autoupdate]" : "";
  out.push(`  ${mp.name}${tag}`);
  if (mp.plugins.length === 0) {
    out.push("    (no plugins)");
    return;
  }

  for (const p of mp.plugins) {
    out.push(renderPluginEntry(p));
  }
}
