// presentation/compact-line.ts
//
// Wave 1 keystone: the typed `RowSpec` discriminated union AND the
// grammar-aware `renderRow` composer that owns MSG-GR-1 token order,
// MSG-GR-2 `@<marketplace>` carve-out, MSG-GR-4 reasons-block formatting,
// MSG-GR-5 `<marker>` slot, MSG-IC-1..3 icon discipline, MSG-PL-4 / CMC-09
// `(upgradable)` list-only constraint, MSG-PL-6 scope-bracket carve-out,
// and MSG-SD-1..3 per-row soft-dep marker injection.
//
// Per D-13-05 every Wave 2 sub-wave constructs `RowSpec` values from
// validated orchestrator state and routes them through `renderRow`. The
// renderer is a pure transform with no I/O; per D-13-07 it consumes the
// soft-dep companion-loaded predicate as an INJECTED `SoftDepProbe`
// dependency (structurally identical to `platform/pi-api.ts::SoftDepStatus`,
// re-declared locally so this module imports nothing from `platform/`).
//
// Discriminant choice: explicit `kind` literal field per RESEARCH.md A1.
// Departs from the inferred-union codebase precedent at
// `presentation/plugin-list.ts:45` because:
//   (a) the union has 9 variants and meaningful per-variant fields
//       (only PluginInlineRow has `marketplace`, only MarketplaceRow has
//       `outcomeClass`, only RollbackChild has `phaseLabel`);
//   (b) Phase 14's drift guard greps for `kind: "<...>"` to map emission
//       sites back to the catalog rendered states;
//   (c) the renderer's main switch narrows cleanly on `row.kind` and
//       enforces exhaustiveness via `assertNever` (shared/errors.ts:12).
//
// Structural enforcement summary:
//   - PluginInlineUninstalledRow has NO declaresAgents/Mcp fields, so the
//     renderer cannot emit `{requires pi-subagents}` / `{requires pi-mcp}`
//     on a `(uninstalled)` row (MSG-SD-3 / D-13-07).
//   - PluginInlineRow.status / PluginCascadeRow.status exclude
//     `"upgradable"` via `Extract<StatusToken, ...>`, so callers cannot
//     route `(upgradable)` through any surface but `PluginListRow`
//     (MSG-PL-4 / CMC-09).
//   - EmptyToken.token is restricted to `"no marketplaces" | "no plugins"`;
//     the renderer emits the bare token only (no icon, no scope brackets)
//     per MSG-ER-1 / CMC-10.
//
// MSG-IC-1..3 icon discipline:
//   - `ICON_INSTALLED = "●"` for (installed)/(updated)/(upgradable)/(reinstalled)
//     plus trivial (skipped) {up-to-date} no-ops where the plugin remains
//     installed.
//   - `ICON_AVAILABLE = "○"` for (available)/(uninstalled).
//   - `ICON_UNINSTALLABLE = "⊘"` for (failed)/(rollback failed)/
//     (manual recovery)/(unavailable) AND for (skipped) failure-cascade
//     children where the plugin is NOT installed (e.g. {source mismatch}).
//   - Marketplace rows dispatch on `outcomeClass`: "ok" -> ●; "failure" -> ⊘.
// The three icon constants are file-private here -- they migrated from
// `presentation/plugin-list.ts` because compact-line.ts is now the
// second consumer (D-CMC-07 promotion criterion satisfied per D-13-15).

import { assertNever } from "../shared/errors.ts";

import type { Reason } from "../shared/grammar/reasons.ts";
import type { StatusToken } from "../shared/grammar/status-tokens.ts";

// ---------------------------------------------------------------------------
// File-private icon constants. Single source for MSG-IC-1..3 across surfaces.
// ---------------------------------------------------------------------------

const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Scope = "user" | "project";

/**
 * Soft-dep probe shape consumed by `renderRow` as an injected dependency.
 *
 * Structurally identical to `platform/pi-api.ts::SoftDepStatus`; declared
 * locally to keep the D-11 layering clean (presentation does not import
 * platform/ directly; the orchestrator constructs the probe via
 * `softDepStatus(pi)` and passes it in).
 */
export interface SoftDepProbe {
  readonly piSubagentsLoaded: boolean;
  readonly piMcpAdapterLoaded: boolean;
}

/**
 * Plugin row on a SINGLE-PLUGIN inline surface (install / uninstall single-
 * shot, bootstrap single-plugin, single-target update). Carries the
 * `@<marketplace>` token (MSG-GR-2 inline form). `status` excludes
 * `"upgradable"` (MSG-PL-4 / CMC-09 list-only) and `"uninstalled"`
 * (uninstalled rows route through `PluginInlineUninstalledRow` which has
 * no soft-dep fields per MSG-SD-3).
 */
export interface PluginInlineRow {
  readonly kind: "plugin-inline";
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly version?: string;
  readonly status: Extract<
    StatusToken,
    "installed" | "updated" | "failed" | "rollback failed" | "unavailable"
  >;
  readonly reasons?: readonly Reason[];
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}

/**
 * Plugin row in the single-plugin uninstall result form. Structurally has
 * no `declaresAgents`/`declaresMcp` fields: MSG-SD-3 forbids the soft-dep
 * marker on `(uninstalled)` rows, and forcing that constraint at the type
 * level prevents misuse at every callsite.
 */
export interface PluginInlineUninstalledRow {
  readonly kind: "plugin-inline-uninstalled";
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly version?: string;
}

/**
 * Plugin row inside a marketplace-headed cascade (update / reinstall /
 * import / mp remove children). NO `marketplace` field -- inherited from
 * the cascade header per MSG-GR-2 carve-out. `status` includes
 * `"reinstalled"` (D-13-20) but excludes `"upgradable"` (list-only).
 */
export interface PluginCascadeRow {
  readonly kind: "plugin-cascade";
  readonly name: string;
  readonly scope: Scope;
  readonly version?: string;
  readonly status: Extract<
    StatusToken,
    | "installed"
    | "updated"
    | "uninstalled"
    | "skipped"
    | "failed"
    | "available"
    | "unavailable"
    | "reinstalled"
    | "rollback failed"
  >;
  readonly reasons?: readonly Reason[];
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}

// NOTE: `PluginCascadeRow.status` intentionally excludes "upgradable" to
// enforce MSG-PL-4 / CMC-09 structurally -- `(upgradable)` is list-only and
// must never appear on update / reinstall / import / mp remove cascade rows
// (those use `(updated)` / `(reinstalled)` / `(installed)` / `(skipped)`
// instead). This narrows the plan's action-paragraph status set per the
// plan's must-have invariant: "`(upgradable)` is structurally constrained
// to `PluginListRow.status` only". Test
// `tests/presentation/compact-line.test.ts` locks this with
// `@ts-expect-error`. (Rule 1 deviation: the plan action paragraph at
// task 3 listed "upgradable" in the cascade row's status set, which
// contradicted the same plan's must-haves and the test in the behavior
// section; the must-haves win.)

/**
 * Plugin row on the `/claude:plugin list` surface. `(upgradable)` is
 * STRUCTURALLY constrained to this variant only (MSG-PL-4 / CMC-09);
 * `(available)` and `(unavailable)` omit the `[<scope>]` token per
 * MSG-PL-6 carve-out, applied inside `renderPluginList`.
 */
export interface PluginListRow {
  readonly kind: "plugin-list";
  readonly name: string;
  readonly scope: Scope;
  readonly version?: string;
  readonly status: Extract<StatusToken, "installed" | "upgradable" | "available" | "unavailable">;
  readonly reasons?: readonly Reason[];
  readonly description?: string;
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}

/**
 * Marketplace row / header. The `<marker>` slot (MSG-GR-5) is the closed
 * set `"autoupdate" | "no autoupdate"`. `status` is optional (a bare
 * marketplace label header has no status); `outcomeClass` drives the
 * MSG-IC-3 icon dispatch (`"ok"` -> ●; `"failure"` -> ⊘).
 */
export interface MarketplaceRow {
  readonly kind: "marketplace";
  readonly name: string;
  readonly scope: Scope;
  readonly marker?: "autoupdate" | "no autoupdate";
  readonly status?: Extract<StatusToken, "added" | "removed" | "updated" | "skipped" | "failed">;
  readonly reasons?: readonly Reason[];
  readonly outcomeClass: "ok" | "failure";
}

/**
 * Bare-token compact line for the empty cases (MSG-ER-1 / CMC-10):
 * `(no plugins)` and `(no marketplaces)`. No icon, no name, no brackets.
 */
export interface EmptyToken {
  readonly kind: "empty";
  readonly token: Extract<StatusToken, "no marketplaces" | "no plugins">;
}

/**
 * System-level manual-recovery anchor line (MSG-MR-1 / MSG-MR-2).
 * `resource` is a plain string -- the resource name (e.g. "agent index",
 * "state.json"). NO `@<marketplace>` and NO `[<scope>]` slot apply;
 * `(manual recovery)` always carries a reasons block.
 */
export interface ManualRecoveryLine {
  readonly kind: "manual-recovery";
  readonly resource: string;
  readonly reasons: readonly Reason[];
  readonly orphanDetails?: readonly string[];
}

/**
 * Indented child row beneath a `(failed) {rollback partial}` parent
 * (MSG-RP-1). The renderer emits at the bare compact-line level
 * (`<phaseLabel> (status) {reasons}` without a leading icon); the parent
 * composer (`presentation/rollback-partial.ts`, separate plan) applies
 * indentation when stitching child rows under the failed parent.
 */
export interface RollbackChild {
  readonly kind: "rollback-child";
  readonly phaseLabel: string;
  readonly status: Extract<StatusToken, "failed" | "rollback failed">;
  readonly reasons: readonly Reason[];
}

/**
 * Entity-shaped non-cascade error line (MSG-NC-1 / CMC-34).
 * Examples: `⊘ unknown@claude-plugins-official (failed) {not found}`;
 * `⊘ hookify [user] (unavailable) {hooks}`.
 */
export interface EntityErrorRow {
  readonly kind: "entity-error";
  readonly name: string;
  readonly marketplace?: string;
  readonly scope?: Scope;
  readonly status: Extract<StatusToken, "failed" | "unavailable">;
  readonly reasons: readonly Reason[];
}

export type RowSpec =
  | PluginInlineRow
  | PluginInlineUninstalledRow
  | PluginCascadeRow
  | PluginListRow
  | MarketplaceRow
  | EmptyToken
  | ManualRecoveryLine
  | RollbackChild
  | EntityErrorRow;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Pure transform: a `RowSpec` value plus the injected `SoftDepProbe`
 * returns the rendered compact-line string. The renderer owns MSG-GR-1
 * token order; orchestrators never hand-format tokens (D-13-05).
 */
export function renderRow(row: RowSpec, probe: SoftDepProbe): string {
  switch (row.kind) {
    case "plugin-inline":
      return renderPluginInline(row, probe);
    case "plugin-inline-uninstalled":
      return renderPluginInlineUninstalled(row);
    case "plugin-cascade":
      return renderPluginCascade(row, probe);
    case "plugin-list":
      return renderPluginList(row, probe);
    case "marketplace":
      return renderMarketplace(row);
    case "empty":
      return renderEmpty(row);
    case "manual-recovery":
      return renderManualRecovery(row);
    case "rollback-child":
      return renderRollbackChild(row);
    case "entity-error":
      return renderEntityError(row);
    default:
      return assertNever(row);
  }
}

// ---------------------------------------------------------------------------
// Per-variant renderers (file-private)
// ---------------------------------------------------------------------------

function renderPluginInline(row: PluginInlineRow, probe: SoftDepProbe): string {
  const reasons = composeReasons(row.reasons, row.declaresAgents, row.declaresMcp, probe);
  const icon = iconForPluginRow(row.status, isTrivialSkip(row.status, row.reasons));
  return joinTokens([
    icon,
    `${row.name}@${row.marketplace}`,
    `[${row.scope}]`,
    renderVersion(row.version),
    `(${row.status})`,
    reasons,
  ]);
}

function renderPluginInlineUninstalled(row: PluginInlineUninstalledRow): string {
  return joinTokens([
    ICON_AVAILABLE,
    `${row.name}@${row.marketplace}`,
    `[${row.scope}]`,
    renderVersion(row.version),
    "(uninstalled)",
  ]);
}

function renderPluginCascade(row: PluginCascadeRow, probe: SoftDepProbe): string {
  const reasons = composeReasons(row.reasons, row.declaresAgents, row.declaresMcp, probe);
  const icon = iconForPluginRow(row.status, isTrivialSkip(row.status, row.reasons));
  return joinTokens([
    icon,
    row.name,
    `[${row.scope}]`,
    renderVersion(row.version),
    `(${row.status})`,
    reasons,
  ]);
}

function renderPluginList(row: PluginListRow, probe: SoftDepProbe): string {
  const reasons = composeReasons(row.reasons, row.declaresAgents, row.declaresMcp, probe);
  const icon = iconForPluginRow(row.status, false);
  // MSG-PL-6 carve-out: omit [<scope>] when status is (available) or (unavailable).
  const scopeSlot =
    row.status === "available" || row.status === "unavailable" ? "" : `[${row.scope}]`;
  return joinTokens([
    icon,
    row.name,
    scopeSlot,
    renderVersion(row.version),
    `(${row.status})`,
    reasons,
  ]);
}

function renderMarketplace(row: MarketplaceRow): string {
  const reasons = composeReasons(row.reasons, false, false, NO_PROBE_NEEDED);
  const icon = iconForMarketplace(row.outcomeClass);
  const markerSlot = row.marker === undefined ? "" : `<${row.marker}>`;
  const statusSlot = row.status === undefined ? "" : `(${row.status})`;
  return joinTokens([icon, row.name, `[${row.scope}]`, markerSlot, statusSlot, reasons]);
}

function renderEmpty(row: EmptyToken): string {
  // MSG-ER-1 / CMC-10: bare parenthesised token, no icon, no name, no brackets.
  return `(${row.token})`;
}

function renderManualRecovery(row: ManualRecoveryLine): string {
  const reasons = composeReasons(row.reasons, false, false, NO_PROBE_NEEDED);
  return joinTokens([ICON_UNINSTALLABLE, row.resource, "(manual recovery)", reasons]);
}

function renderRollbackChild(row: RollbackChild): string {
  const reasons = composeReasons(row.reasons, false, false, NO_PROBE_NEEDED);
  // Bare compact level -- no leading icon. The parent composer applies
  // indentation when stitching child rows under the failed parent line.
  return joinTokens([row.phaseLabel, `(${row.status})`, reasons]);
}

function renderEntityError(row: EntityErrorRow): string {
  const reasons = composeReasons(row.reasons, false, false, NO_PROBE_NEEDED);
  const subject = row.marketplace === undefined ? row.name : `${row.name}@${row.marketplace}`;
  const scopeSlot = row.scope === undefined ? "" : `[${row.scope}]`;
  return joinTokens([ICON_UNINSTALLABLE, subject, scopeSlot, `(${row.status})`, reasons]);
}

// ---------------------------------------------------------------------------
// Icon dispatchers (file-private)
// ---------------------------------------------------------------------------

function iconForPluginRow(status: StatusToken, trivialSkip: boolean): string {
  switch (status) {
    case "installed":
    case "updated":
    case "upgradable":
    case "reinstalled":
      return ICON_INSTALLED;
    case "available":
    case "uninstalled":
      return ICON_AVAILABLE;
    case "skipped":
      // Catalog precedent: trivial skip ({up-to-date}/{already installed})
      // means the plugin remains installed -- ●. Non-trivial skip (e.g.
      // {source mismatch}) is a failure-cascade child -- the plugin is NOT
      // installed; ⊘.
      return trivialSkip ? ICON_INSTALLED : ICON_UNINSTALLABLE;
    case "failed":
    case "rollback failed":
    case "manual recovery":
    case "unavailable":
      return ICON_UNINSTALLABLE;
    // Task 260525-cjr C7: the remaining StatusToken members
    // (`added`/`removed`/`no marketplaces`/`no plugins`) never reach a
    // plugin row STRUCTURALLY: every PluginInlineRow / PluginCascadeRow /
    // PluginListRow narrows `status` via `Extract<StatusToken, ...>` so
    // the unreachable tokens are excluded at the type level. Enumerate
    // each explicitly (instead of the previous permissive `default ->
    // ⊘` fallthrough) and end with `assertNever(status as never)` so a
    // future StatusToken addition fails at compile time inside this
    // switch rather than silently degrading to ⊘ -- catching the
    // missing case at the chokepoint the renderer owns.
    case "added":
    case "removed":
    case "no marketplaces":
    case "no plugins":
      return ICON_UNINSTALLABLE;
    default:
      return assertNever(status);
  }
}

function iconForMarketplace(outcomeClass: "ok" | "failure"): string {
  return outcomeClass === "ok" ? ICON_INSTALLED : ICON_UNINSTALLABLE;
}

function isTrivialSkip(status: StatusToken, reasons: readonly Reason[] | undefined): boolean {
  if (status !== "skipped" || reasons?.length !== 1) {
    return false;
  }

  return reasons[0] === "up-to-date" || reasons[0] === "already installed";
}

// ---------------------------------------------------------------------------
// Slot composition helpers (file-private)
// ---------------------------------------------------------------------------

const NO_PROBE_NEEDED: SoftDepProbe = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

/**
 * MSG-GR-4 + MSG-SD-1..2 per-row soft-dep injection point.
 *
 * Starts from the caller-provided reasons array; appends
 * `"requires pi-subagents"` iff (declaresAgents AND !probe.piSubagentsLoaded);
 * appends `"requires pi-mcp"` iff (declaresMcp AND !probe.piMcpAdapterLoaded);
 * joins with `", "` and wraps in `{}`. Returns `""` when the resulting array
 * is empty (MSG-GR-4 forbids emitting an empty `{}`).
 */
function composeReasons(
  reasons: readonly Reason[] | undefined,
  declaresAgents: boolean | undefined,
  declaresMcp: boolean | undefined,
  probe: SoftDepProbe,
): string {
  const composed: string[] = reasons === undefined ? [] : [...reasons];

  if (declaresAgents === true && !probe.piSubagentsLoaded) {
    composed.push("requires pi-subagents");
  }

  if (declaresMcp === true && !probe.piMcpAdapterLoaded) {
    composed.push("requires pi-mcp");
  }

  if (composed.length === 0) {
    return "";
  }

  return `{${composed.join(", ")}}`;
}

function renderVersion(version: string | undefined): string {
  if (version === undefined || version === "") {
    return "";
  }

  return `v${version}`;
}

function joinTokens(parts: readonly string[]): string {
  return parts.filter((p) => p !== "").join(" ");
}
