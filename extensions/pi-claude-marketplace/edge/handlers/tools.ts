// edge/handlers/tools.ts
//
// D-02: two read-only LLM tools exposed via `pi.registerTool`.
//
//   1. pi_claude_marketplace_list -- empty params; returns one line per
//      marketplace in `[<scope>] <name> -- <N> plugin(s) -- <source.logical>`
//      format, plus structured `details.marketplaces`.
//
//   2. pi_claude_marketplace_plugin_list -- D-02 extended params: optional
//      marketplace + scope + installed/available/unavailable filter booleans
//      (PL-1 union semantics). Returns rendered text + structured
//      `details.plugins`.
//
// BLOCK C: this file imports only from orchestrators/, presentation/, shared/
// (plus the edge sibling `args-schema.ts` -- not used here -- and the typebox
// runtime). The structured loaders `loadVisibleMarketplaces` and
// `loadPluginListPayload` were added to their respective orchestrators in
// this plan precisely to keep the tool execute bodies on the right side of
// the import boundary.
//
// BLOCK A: tools do NOT call ctx.ui.notify. LLM tools return
// `AgentToolResult` -- the agent surfaces results via its own UI channel,
// not the slash-command notify channel.
//
// Status semantics (D-09): state.json has NO plugin.installed
// boolean. Presence of `mp.plugins[name]` === installed. Per-marketplace
// plugin count for the list tool is `Object.keys(mp.plugins).length`.
//
// The LLM tool translates the `MarketplaceNotificationMessage[]` payload
// from `loadPluginListPayload` into a flat-line projection for the structured
// tool surface. The slash-command surface uses `notify()` directly.
// The `(upgradable)` plugin variant maps to `[installed]` on the tool surface
// (the plugin IS installed; the upgrade status is for the slash-command
// surface per MSG-PL-4).

import Type from "typebox";

import { sourceLogical } from "../../domain/source.ts";
import { loadVisibleMarketplaces } from "../../orchestrators/marketplace/shared.ts";
import { loadPluginListPayload } from "../../orchestrators/plugin/list.ts";

import type { ParsedSource } from "../../domain/source.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { PluginNotificationMessage } from "../../shared/notify.ts";

// ─── LLM tool parameter schemas (TypeBox) ─────────────────────────────────

const LIST_MARKETPLACES_PARAMS = Type.Object({});

const LIST_PLUGINS_PARAMS = Type.Object({
  marketplace: Type.Optional(Type.String({ description: "Marketplace name to list plugins for." })),
  scope: Type.Optional(
    Type.Union([Type.Literal("user"), Type.Literal("project")], {
      description: 'Scope to look in: "user" or "project". Default: both scopes.',
    }),
  ),
  installed: Type.Optional(
    Type.Boolean({ description: "Include plugins installed in state.json." }),
  ),
  available: Type.Optional(
    Type.Boolean({
      description: "Include manifest-declared plugins that are not installed but are installable.",
    }),
  ),
  unavailable: Type.Optional(
    Type.Boolean({
      description: "Include manifest-declared plugins that are not installable on this system.",
    }),
  ),
});

// ─── Tool 1: pi_claude_marketplace_list ──────────────────────────────────────

export function registerListMarketplacesTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "pi_claude_marketplace_list",
    label: "Claude Marketplace List",
    description: "List configured Claude plugin marketplaces.",
    promptSnippet:
      "Use pi_claude_marketplace_list to inspect configured Claude plugin marketplaces.",
    parameters: LIST_MARKETPLACES_PARAMS,
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      // BLOCK C boundary: loadVisibleMarketplaces is the
      // orchestrators/marketplace/shared.ts helper.
      // Returns {scope, record}[] across the requested scope set (both
      // here -- no scope filter on this tool).
      const visible = await loadVisibleMarketplaces({ cwd: ctx.cwd });

      if (visible.length === 0) {
        return {
          content: [{ type: "text", text: "No marketplaces configured." }],
          details: { marketplaces: [] },
        };
      }

      const lines: string[] = [];
      const marketplaces: {
        name: string;
        scope: "user" | "project";
        pluginCount: number;
        source: ParsedSource;
      }[] = [];
      for (const { scope, record } of visible) {
        const source = record.source as ParsedSource;
        const pluginCount = Object.keys(record.plugins).length;
        const logical = sourceLogical(source);
        // Line shape (D-02):
        //   [<scope>] <name> -- <N> plugin(s) -- <source.logical>
        lines.push(
          `[${scope}] ${record.name} -- ${pluginCount.toString()} plugin(s) -- ${logical}`,
        );
        marketplaces.push({ name: record.name, scope, pluginCount, source });
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { marketplaces },
      };
    },
  });
}

// ─── Tool 2: pi_claude_marketplace_plugin_list ───────────────────────────────

/**
 * The flat-line projection of a single plugin row for the LLM-tool surface.
 * The slash-command surface uses the catalog form via the renderer; the
 * tool surface keeps a stable, machine-friendly line shape so the agent
 * can pattern-match on `[installed]` / `[available]` / `[unavailable]`.
 *
 * The `(upgradable)` status maps to `[installed]` in this projection (the
 * plugin IS installed; the upgrade status is internal to the slash-command
 * surface per MSG-PL-4).
 */
type ToolPluginStatus = "installed" | "available" | "unavailable";

interface PluginRow {
  marketplace: string;
  scope: "user" | "project";
  name: string;
  status: ToolPluginStatus;
  version?: string;
  reasons?: readonly string[];
}

/**
 * Project the PluginNotificationMessage status set onto the tool's
 * three-bucket projection. The list-surface variants are
 * `installed | upgradable | available | unavailable`; only this subset
 * appears inside the `loadPluginListPayload` return shape (the orchestrator
 * builds list-only variants on the success path; the failure path emits a
 * `failed` row in a synthetic `(list)` marketplace which never traverses
 * this projection -- the tool's try/catch short-circuits to its error
 * branch before reaching here). The other plugin-status variants
 * (`updated` / `reinstalled` / `uninstalled` / `failed` / `skipped` /
 * `manual recovery`) are unreachable on this surface and an exhaustive
 * `assertNever`-style throw guards the invariant.
 */
function projectRowStatus(status: PluginNotificationMessage["status"]): ToolPluginStatus {
  switch (status) {
    // UAT G-21-01: the list orchestrator emits the list-only `present`
    // token for steady-state inventory rows; both `present` and `installed`
    // project to the same `installed` tool surface.
    case "present":
    case "installed":
    case "upgradable":
      return "installed";
    case "available":
      return "available";
    case "unavailable":
      return "unavailable";
    case "disabled":
      // D-54-01 / ENBL-04: a disabled plugin is recorded but its artefacts
      // are not materialized -- the LLM-tool projection treats it as not
      // currently usable, mirroring `unavailable`.
      return "unavailable";
    case "updated":
    case "reinstalled":
    case "uninstalled":
    case "failed":
    case "skipped":
    case "manual recovery":
    case "will install":
    case "will uninstall":
    case "will enable":
    case "will disable":
      throw new Error(
        `pi_claude_marketplace_plugin_list: unexpected plugin status "${status}" on list payload`,
      );
  }
}

function statusLabel(status: ToolPluginStatus): string {
  switch (status) {
    case "installed":
      return "[installed]";
    case "available":
      return "[available]";
    case "unavailable":
      return "[unavailable]";
  }
}

function renderPluginRow(row: PluginRow): string {
  const tag = statusLabel(row.status);
  const parts: string[] = [`  ${tag} ${row.name}`];
  if (row.version !== undefined) {
    parts.push(row.version);
  }

  if (row.reasons !== undefined && row.reasons.length > 0) {
    parts.push(`(${row.reasons.join(", ")})`);
  }

  return parts.join("  ");
}

function applyFilter(params: { installed?: boolean; available?: boolean; unavailable?: boolean }): {
  i: boolean;
  a: boolean;
  u: boolean;
} {
  const anyFilter =
    params.installed === true || params.available === true || params.unavailable === true;
  if (!anyFilter) {
    return { i: true, a: true, u: true };
  }

  return {
    i: params.installed === true,
    a: params.available === true,
    u: params.unavailable === true,
  };
}

function statusKey(status: ToolPluginStatus): "i" | "a" | "u" {
  switch (status) {
    case "installed":
      return "i";
    case "available":
      return "a";
    case "unavailable":
      return "u";
  }
}

async function marketplaceExists(params: {
  marketplace: string;
  scope?: "user" | "project";
  cwd: string;
}): Promise<boolean> {
  const visible = await loadVisibleMarketplaces({
    cwd: params.cwd,
    ...(params.scope !== undefined && { scope: params.scope }),
  });
  return visible.some((m) => m.record.name === params.marketplace);
}

/**
 * The tool's `pi` reference is required for the orchestrator's
 * `SoftDepProbe` construction; we pass the ExtensionContext's pi seed at
 * call time. The probe is only consulted when a PluginListRow carries
 * `declares*` predicates, which never affects the orchestrator's
 * bucketing -- so the probe choice does not change the structured tool
 * output (it only suppresses the `{requires pi-*}` reason injection on
 * the renderer side, which this tool does not call).
 */
async function loadToolPluginPayload(
  pi: ExtensionAPI,
  params: {
    marketplace?: string;
    scope?: "user" | "project";
    installed?: boolean;
    available?: boolean;
    unavailable?: boolean;
  },
  ctx: ExtensionContext,
  buckets: { i: boolean; a: boolean; u: boolean },
): Promise<Awaited<ReturnType<typeof loadPluginListPayload>>> {
  return loadPluginListPayload({
    ctx,
    pi,
    cwd: ctx.cwd,
    ...(params.scope !== undefined && { scope: params.scope }),
    ...(params.marketplace !== undefined && { marketplace: params.marketplace }),
    ...(buckets.i && { installed: true }),
    ...(buckets.a && { available: true }),
    ...(buckets.u && { unavailable: true }),
  });
}

/**
 * Read `p.scope` defensively from the PluginNotificationMessage union.
 * The `available` / `unavailable` variants OMIT the `scope` field by
 * construction (SNM-11); the other list-surface variants carry an OPTIONAL
 * `scope` that is present only when the plugin's install scope differs
 * from the marketplace block's scope (orphan-fold rule, D-13-18). When
 * absent, fall back to the marketplace scope so the structured tool
 * surface always carries a stable `scope` field for the agent.
 *
 * The list-surface variant subset for this projection is narrowed by
 * `projectRowStatus` (the only callers come from inside the rendering
 * loop after the status switch). For `installed` / `upgradable` the
 * `scope` field exists structurally; for `available` / `unavailable`
 * it does not -- the `status`-narrowed switch handles both arms.
 */
function pluginScopeOrFallback(
  p: PluginNotificationMessage,
  marketplaceScope: "user" | "project",
): "user" | "project" {
  switch (p.status) {
    // UAT G-21-01: list-only `present` joins `upgradable` as a
    // scope-bearing list-surface variant.
    case "present":
    case "installed":
    case "upgradable":
    case "disabled":
      // D-54-01 / ENBL-04: disabled rows carry an explicit `scope?` (the
      // SNM-11 carve-out applies only to `available` / `unavailable`).
      return p.scope ?? marketplaceScope;
    case "available":
    case "unavailable":
      return marketplaceScope;
    case "updated":
    case "reinstalled":
    case "uninstalled":
    case "failed":
    case "skipped":
    case "manual recovery":
    case "will install":
    case "will uninstall":
    case "will enable":
    case "will disable":
      // Unreachable on the list surface; renderer-as-spec guard. The DIFF-02
      // will-* variants are emitted only by `/claude:plugin preview`, which
      // does not project through this list-tool surface.
      return marketplaceScope;
  }
}

/**
 * Read `p.reasons` defensively. Only a subset of plugin variants carry the
 * field (D-15-01); for list-surface variants `available` / `installed`
 * omit `reasons` entirely (omit when undefined or empty).
 */
function pluginReasons(p: PluginNotificationMessage): readonly string[] | undefined {
  if (p.status === "unavailable" || p.status === "upgradable") {
    return p.reasons.length > 0 ? p.reasons : undefined;
  }

  return undefined;
}

/**
 * Read `p.version` defensively. The `updated` variant has REQUIRED
 * `from`/`to` instead of `version`; every other variant carries an
 * OPTIONAL `version` (D-15-04). On the list surface only the
 * installed / upgradable / available / unavailable subset is reachable.
 */
function pluginVersion(p: PluginNotificationMessage): string | undefined {
  switch (p.status) {
    // UAT G-21-01: `present` carries `version?: string` like the other
    // optional-version variants.
    case "present":
    case "installed":
    case "upgradable":
    case "available":
    case "unavailable":
    case "reinstalled":
    case "uninstalled":
    case "failed":
    case "skipped":
    case "manual recovery":
    case "disabled":
      // D-54-01 / ENBL-04: disabled row carries optional `version?` -- the
      // recorded state record preserves the pinned version (ENBL-02).
      return p.version;
    case "updated":
      // The updated variant has `from`/`to` instead of a single `version`;
      // synthesize the post-update version for downstream callers.
      return p.to;
    case "will install":
    case "will uninstall":
    case "will enable":
    case "will disable":
      // DIFF-02 preview rows carry no version slot (the variant has no
      // `version` field). Unreachable on the list surface.
      return undefined;
  }
}

function renderPluginPayload(
  payload: Awaited<ReturnType<typeof loadPluginListPayload>>,
  buckets: { i: boolean; a: boolean; u: boolean },
): { lines: string[]; rows: PluginRow[] } {
  const lines: string[] = [];
  const rows: PluginRow[] = [];
  for (const mp of payload) {
    const mpName = mp.name;
    const mpScope = mp.scope;
    lines.push(`Marketplace ${mpName} (${mpScope})`);

    // Unparseable-manifest marketplace block (status: "failed", plugins: [])
    // and zero-plugin manifest blocks both render as the bare-header form
    // followed by the "(no plugins)" body line for shape stability.
    if (mp.plugins.length === 0) {
      lines.push("  (no plugins)");
      continue;
    }

    for (const p of mp.plugins) {
      const status = projectRowStatus(p.status);
      if (!buckets[statusKey(status)]) {
        continue;
      }

      const reasons = pluginReasons(p);
      const version = pluginVersion(p);
      const row: PluginRow = {
        marketplace: mpName,
        scope: pluginScopeOrFallback(p, mpScope),
        name: p.name,
        status,
        ...(version !== undefined && { version }),
        ...(reasons !== undefined && { reasons }),
      };
      lines.push(renderPluginRow(row));
      rows.push(row);
    }
  }

  return { lines, rows };
}

export function registerListPluginsTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "pi_claude_marketplace_plugin_list",
    label: "Marketplace Plugin List",
    description: "List plugins in a Claude marketplace, showing compatibility and install status.",
    promptSnippet: "Use pi_claude_marketplace_plugin_list to inspect plugins in a marketplace.",
    parameters: LIST_PLUGINS_PARAMS,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      // PL-1 filter union: build the filter set ONCE so the orchestrator
      // payload's per-status entries can be projected without re-deriving.
      // The orchestrator already applies these filters internally, but we
      // ALSO apply them again at the tool layer so the marketplace-not-found
      // branch (which short-circuits the payload load) still respects the
      // filter contract.
      const buckets = applyFilter(params);

      // Marketplace-existence check for the marketplace-not-found surface.
      // Loaded VIA loadVisibleMarketplaces so the BLOCK C import boundary
      // is preserved.
      if (params.marketplace !== undefined) {
        const exists = await marketplaceExists({
          marketplace: params.marketplace,
          cwd: ctx.cwd,
          ...(params.scope !== undefined && { scope: params.scope }),
        });
        if (!exists) {
          return {
            content: [{ type: "text", text: `Marketplace "${params.marketplace}" not found.` }],
            details: { plugins: [] },
          };
        }
      }

      // Delegate to the payload loader for the data layer; we render text
      // ourselves in the LLM-tool line format. The orchestrator's
      // PluginListPayload carries enough structure to support both this
      // line format AND `details.plugins`.
      let payload;
      try {
        payload = await loadToolPluginPayload(pi, params, ctx, buckets);
      } catch (err) {
        // TC-9: state.json error propagates as a tool error surface (the
        // agent should see a clear failure rather than an empty list).
        return {
          content: [
            {
              type: "text",
              text: `Failed to load plugin list: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
          details: { plugins: [] },
        };
      }

      const { lines, rows } = renderPluginPayload(payload, buckets);

      if (rows.length === 0 && payload.length === 0) {
        return {
          content: [{ type: "text", text: "No marketplaces configured." }],
          details: { plugins: [] },
        };
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { plugins: rows },
      };
    },
  });
}
