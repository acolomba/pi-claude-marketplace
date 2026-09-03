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
import { errorMessage } from "../../shared/errors.ts";
import { isScopeBearingListRow } from "../../shared/notify.ts";

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
export type ToolPluginStatus = "installed" | "available" | "unavailable";

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
 * three-bucket projection.
 *
 * NINE list-surface variants are reachable here: the five installed-inventory
 * ones (`installed` / `upgradable` / `partially-installed` /
 * `partially-upgradable` / `disabled`) and the four not-installed candidate
 * ones (`available` / `remote` / `partially-available` / `unavailable`). The
 * last two of those are reachable only because `loadToolPluginPayload` carries
 * `remote` with `available` and `partial` with `unavailable` -- the tool
 * exposes no parameter of its own for either, and the list orchestrator gates
 * both behind one (`orchestrators/plugin/list.ts::shouldShow`). Fold a
 * fine-grained bucket into a coarse one here without carrying its filter over
 * there and the arm goes dead on the execute path.
 *
 * `failed` is the tenth member of the row union and is NOT reachable: the
 * synthetic `(list)` failure row is built in `listPlugins`'s own catch, never
 * inside `loadPluginListPayload`, so no payload this tool loads carries one.
 * `ToolPluginRow` admits it because that alias is derived from the producer's
 * declared type, not because the producer emits it on this path.
 *
 * The throw is the `assertNever`-style guard for `failed` and for every
 * non-list variant (`updated` / `reinstalled` / `uninstalled` / `skipped` /
 * `manual recovery` and the four pending rows). `execute` calls the render
 * loop INSIDE its try, so the throw lands on the tool's `isError: true`
 * surface rather than escaping as an unhandled rejection.
 */
export function projectRowStatus(status: PluginNotificationMessage["status"]): ToolPluginStatus {
  switch (status) {
    // The list orchestrator emits the steady-state inventory row as
    // `installed`; it projects to the same `installed` tool surface as the
    // cascade transition and the `upgradable` list row.
    // FSTAT-02 / FSTAT-04 / D-66-03: both derived partial states flatten to the
    // `installed` tool surface -- a partially-installed plugin is recorded-installed
    // (degraded, but present), and a partially-upgradable plugin is currently a
    // clean install, so the LLM-tool projection treats both as installed.
    case "installed":
    case "upgradable":
    case "partially-installed":
    case "partially-upgradable":
      return "installed";
    case "available":
      return "available";
    case "remote":
      // RSTA-01 / D-80-05: a not-installed git-source `remote` plugin projects
      // onto the `available` tool bucket -- install still offers it (install
      // performs the fetch), so the LLM-tool surface treats it as installable.
      return "available";
    case "unavailable":
      return "unavailable";
    case "partially-available":
      // USTAT-02 / D-64-01: a not-installed, partially-available plugin projects
      // onto the coarse `unavailable` tool bucket -- the LLM-tool surface has no
      // distinct `partially-available` bucket (mirrors `disabled` -> `unavailable`).
      return "unavailable";
    case "disabled":
      // D-54-01 / ENBL-04: a disabled plugin is recorded but its artifacts
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

/**
 * The tool-side view of the PL-1 filter union: one flag per tool bucket, plus
 * whether the caller narrowed at all.
 *
 * `narrowed` is not a convenience. `orchestrators/plugin/list.ts::filtersPassive`
 * shows every bucket only when NO filter reaches it, so an all-true bag is a
 * different request from an empty one: it takes the union arms instead, and
 * those admit `remote` and `partially-available` only behind filters this tool
 * has no parameter for. The flag is what lets `loadToolPluginPayload` forward
 * nothing at all on the passive path.
 */
interface ToolFilterBuckets {
  readonly i: boolean;
  readonly a: boolean;
  readonly u: boolean;
  readonly narrowed: boolean;
}

function applyFilter(params: {
  installed?: boolean;
  available?: boolean;
  unavailable?: boolean;
}): ToolFilterBuckets {
  const anyFilter =
    params.installed === true || params.available === true || params.unavailable === true;
  if (!anyFilter) {
    return { i: true, a: true, u: true, narrowed: false };
  }

  return {
    i: params.installed === true,
    a: params.available === true,
    u: params.unavailable === true,
    narrowed: true,
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
  buckets: ToolFilterBuckets,
): Promise<Awaited<ReturnType<typeof loadPluginListPayload>>> {
  return loadPluginListPayload({
    ctx,
    pi,
    cwd: ctx.cwd,
    ...(params.scope !== undefined && { scope: params.scope }),
    ...(params.marketplace !== undefined && { marketplace: params.marketplace }),
    // PL-1: narrow only when the caller narrowed, and carry each tool bucket's
    // fine-grained members with it. `available` is the tool's coarse name for
    // `available` PLUS the cold git-source `remote` bucket (RSTA-01 /
    // D-80-05), and `unavailable` for structural `unavailable` PLUS
    // `partially-available` (USTAT-02 / D-64-01) -- the same folds
    // `projectRowStatus` performs on the way back. Sending an all-true bag
    // instead of nothing would make `filtersPassive` false and strand both
    // fine-grained buckets, which have no tool parameter to turn them on.
    ...(buckets.narrowed && {
      ...(buckets.i && { installed: true }),
      ...(buckets.a && { available: true, remote: true }),
      ...(buckets.u && { unavailable: true, partial: true }),
    }),
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
  return isScopeBearingListRow(p) ? (p.scope ?? marketplaceScope) : marketplaceScope;
}

/**
 * Read `p.reasons` defensively. Only a subset of plugin variants carry the
 * field (D-15-01). INV-05 / D-95-06: every one of the nine list-surface
 * variants `projectRowStatus` admits forwards its typed reasons here, and the
 * field is omitted when the array is absent or empty -- an agent reading the
 * tool payload sees the same facts a human reading the rendered row sees.
 *
 * The two arm groups differ only in whether `reasons` is declared optional on
 * the variant, not in whether the row may carry one. Every optional arm has a
 * producer: `disabled` takes `{not in manifest}` from `disabledReasonsField`
 * (ENBL-16 / D-100-07), and `available` and `remote` take `{installs disabled}`
 * from `installsDisabledField` (OUT-02 / OUT-05).
 *
 * D-116-14: a value-returning switch over the derived row union, for the same
 * reason `pluginVersion` carries one. The groups are total over that union, so
 * there is no trailing fall-through -- a status added to the producer's union
 * is a compile error here rather than a row that silently loses its reasons.
 * `failed` is named for the gate's sake and never arrives: the render loop runs
 * `projectRowStatus` first, and that refuses it.
 */
function pluginReasons(p: ToolPluginRow): readonly string[] | undefined {
  switch (p.status) {
    case "installed":
    case "disabled":
    case "available":
    case "remote":
      // INV-05: these four declare `reasons` OPTIONAL, so they need an
      // undefined guard the required arms below do not. Returning `[]` here
      // would put an empty array on a clean row's payload.
      return p.reasons !== undefined && p.reasons.length > 0 ? p.reasons : undefined;
    case "unavailable":
    case "partially-available":
    case "upgradable":
    case "partially-installed":
    case "partially-upgradable":
    case "failed":
      // USTAT-01: the `partially-available` row carries the same per-kind reason
      // braces as the `unavailable` row, so surface them on the tool details too.
      return p.reasons.length > 0 ? p.reasons : undefined;
  }
}

/**
 * One plugin row of the payload `loadPluginListPayload` returns: its awaited
 * result, that array's element, the element's `plugins` slot, and that slot's
 * element. Deriving the row union from the producer rather than naming it means
 * a change to what the list surface can emit arrives here as a compile error
 * instead of silent drift.
 */
type ToolPluginRow = Awaited<ReturnType<typeof loadPluginListPayload>>[number]["plugins"][number];

/**
 * Read `p.version` off a list-surface row. D-15-04: every list-surface variant
 * carries the same optional `version?` slot, so every arm returns the same field
 * and the switch computes nothing.
 *
 * D-116-14: the switch stays anyway, and must not be collapsed into a single
 * expression. Its job is the missing-arm gate -- `noImplicitReturns` makes the
 * end of this function reachable the moment a list-surface status goes unnamed,
 * so a status added to the row union is a compile error here rather than a row
 * that silently loses its version.
 *
 * `failed` is named here and refused by `projectRowStatus`, which is one answer
 * rather than two: the arm exists because `ToolPluginRow` declares the status
 * and the gate must stay total over that union, while the payload this tool
 * loads never carries such a row (see `projectRowStatus`). The render loop
 * calls the projection first, so no `failed` row reaches this function.
 */
function pluginVersion(p: ToolPluginRow): string | undefined {
  switch (p.status) {
    case "installed":
    case "upgradable":
    case "available":
    case "remote":
    case "unavailable":
    case "partially-available":
    case "failed":
    case "disabled":
    case "partially-installed":
    case "partially-upgradable":
      return p.version;
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
      let rendered;
      try {
        payload = await loadToolPluginPayload(pi, params, ctx, buckets);
        // The projection runs INSIDE the guard. `projectRowStatus` throws on a
        // status the list payload must never carry, and that diagnostic belongs
        // on the `isError: true` surface below rather than escaping `execute`
        // as an unhandled rejection.
        rendered = renderPluginPayload(payload, buckets);
      } catch (err) {
        // TC-9: state.json error propagates as a tool error surface (the
        // agent should see a clear failure rather than an empty list). The
        // non-Error narrowing is `shared/errors.ts`'s, not a second copy here:
        // no seeded payload load can throw a non-Error, so a local copy would
        // be a branch this module's own surface cannot reach.
        return {
          content: [
            {
              type: "text",
              text: `Failed to load plugin list: ${errorMessage(err)}`,
            },
          ],
          isError: true,
          details: { plugins: [] },
        };
      }

      const { lines, rows } = rendered;

      // `rows` is populated only from inside `renderPluginPayload`'s loop over
      // `payload`, so an empty payload already implies no rows; testing both
      // would be one condition asked twice.
      if (payload.length === 0) {
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
