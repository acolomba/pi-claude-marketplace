// edge/handlers/tools.ts
//
// D-02: two read-only LLM tools exposed via `pi.registerTool`.
//
//   1. pi_claude_marketplace_list -- empty params; returns one line per
//      marketplace in `[<scope>] <name> -- <N> plugin(s) -- <source.logical>`
//      format, plus `details.marketplaces`, the wire marketplace blocks of the
//      blocks `/claude:plugin marketplace list` emits (LLMT-01).
//
//   2. pi_claude_marketplace_plugin_list -- D-02 extended params: optional
//      marketplace + scope + installed/available/unavailable filter booleans
//      (PL-1 union semantics). Returns rendered text + structured
//      `details.marketplaces`, the wire marketplace blocks of the JSON strategy.
//
// BLOCK C: this file imports only from domain/ (source.ts), orchestrators/,
// shared/, and platform/ (types), plus the typebox runtime. The structured
// loaders `loadVisibleMarketplaces` and `loadPluginListPayload` were added
// to their respective orchestrators in this plan precisely to keep the tool
// execute bodies on the right side of the import boundary.
//
// IL-2: the tools never notify. LLM tools return `AgentToolResult` -- the
// agent surfaces results via its own UI channel, not the slash-command notify
// channel. Each tool opens one notification run per invocation on its
// non-empty path, so the details equal what the matching slash command
// composes for each block and row (LLMT-01, D-09).
//
// Status semantics (D-09): state.json has NO plugin.installed
// boolean. Presence of `mp.plugins[name]` === installed. Per-marketplace
// plugin count for the list tool is `Object.keys(mp.plugins).length`.
//
// The plugin tool's content lines keep the three-bucket projection: the
// `(upgradable)` plugin variant shows as `[installed]` there (the plugin IS
// installed; the upgrade status is for the slash-command surface per
// MSG-PL-4). Its details carry each row's verbatim status (LLMT-01).
//
// PMOD-04: tool `content` reaches the model without a presentation, so
// `textContent` passes every content string through `redactCredentials`. The
// `details` are wire blocks that `presentCascade` already redacts.
//
// TC-9: each execute catches every failure of its body and returns
// `loadFailure`'s error result, because Pi relays a thrown error's message to
// the model unredacted.

import Type from "typebox";

import { sourceLogical } from "../../domain/source.ts";
import { MARKETPLACE_LIST_CONTEXT } from "../../orchestrators/marketplace/list.messaging.ts";
import { loadMarketplaceListEntries } from "../../orchestrators/marketplace/list.ts";
import { loadVisibleMarketplaces } from "../../orchestrators/marketplace/shared.ts";
import { loadPluginListPayload } from "../../orchestrators/plugin/list-flow.ts";
import { LIST_CONTEXT as PLUGIN_LIST_CONTEXT } from "../../orchestrators/plugin/list.messaging.ts";
import { errorMessage } from "../../shared/errors.ts";
import { toWireMarketplaces } from "../../shared/notification-json.ts";
import { presentCascade } from "../../shared/notification-present.ts";
import { openNotificationSnapshot } from "../../shared/notification-run.ts";
import { pluginVersion } from "../../shared/notification-types.ts";
import { redactCredentials } from "../../shared/redact-credentials.ts";

import type { ParsedSource } from "../../domain/source.ts";
import type { ExtensionAPI, ExtensionContext, PiTextContentBlock } from "../../platform/pi-api.ts";
import type { CascadeNotificationMessage } from "../../shared/notification-types.ts";

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

/** The result both tools return. */
interface ListToolResult {
  content: PiTextContentBlock[];
  details: { marketplaces: ReturnType<typeof toWireMarketplaces> };
  /** Set on the load-failure result only. */
  isError?: true;
}

/**
 * Builds every content block both tools return. Tool text reaches the model
 * without a presentation, so the credential redaction runs here (PMOD-04).
 * Text without a credential keeps its bytes.
 */
function textContent(text: string): PiTextContentBlock[] {
  return [{ type: "text", text: redactCredentials(text) }];
}

/**
 * Builds the error result for a failed tool body (TC-9). A failure becomes the
 * tool's result instead of a throw, because Pi relays a thrown error's raw
 * message to the model. The message goes through `textContent`, so a
 * credential in it is redacted (PMOD-04). `errorMessage` from
 * `shared/errors.ts` does the non-Error narrowing: no load this module calls
 * throws a non-Error, so a local branch for one would stay uncovered.
 */
function loadFailure(subject: string, error: unknown): ListToolResult {
  return {
    content: textContent(`Failed to load ${subject}: ${errorMessage(error)}`),
    isError: true,
    details: { marketplaces: [] },
  };
}

// ─── Tool 1: pi_claude_marketplace_list ──────────────────────────────────────

/** Builds the marketplace list tool's result from both scopes' records. */
async function buildMarketplaceListResult(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<ListToolResult> {
  // BLOCK C boundary: loadMarketplaceListEntries is the
  // orchestrators/marketplace/list.ts loader. One read returns each
  // record with its scope and its list block across both scopes (no
  // scope filter on this tool), so the content lines and the details
  // below come from the same state (LLMT-01).
  const { cwd } = ctx;
  const entries = await loadMarketplaceListEntries({ cwd });

  if (entries.length === 0) {
    return {
      content: textContent("No marketplaces configured."),
      details: { marketplaces: [] },
    };
  }

  const lines: string[] = [];
  for (const { scope, record } of entries) {
    const source = record.source as ParsedSource;
    const pluginCount = Object.keys(record.plugins).length;
    const logical = sourceLogical(source);
    // Line shape (D-02):
    //   [<scope>] <name> -- <N> plugin(s) -- <source.logical>
    lines.push(`[${scope}] ${record.name} -- ${pluginCount.toString()} plugin(s) -- ${logical}`);
  }

  // LLMT-01 / D-09: the details are the wire blocks of the blocks
  // `/claude:plugin marketplace list` emits, under its row policies.
  const run = openNotificationSnapshot(pi);
  const listMessage: CascadeNotificationMessage = {
    marketplaces: entries.map((entry) => entry.block),
    label: MARKETPLACE_LIST_CONTEXT.Messaging.label,
    cardinality: "plural",
  };
  const { rowPolicies } = MARKETPLACE_LIST_CONTEXT;
  const payloadDetails = toWireMarketplaces(
    presentCascade(run, listMessage, rowPolicies).marketplaces,
  );
  return {
    content: textContent(lines.join("\n")),
    details: { marketplaces: payloadDetails },
  };
}

export function registerListMarketplacesTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "pi_claude_marketplace_list",
    label: "Claude Marketplace List",
    description: "List configured Claude plugin marketplaces.",
    promptSnippet:
      "Use pi_claude_marketplace_list to inspect configured Claude plugin marketplaces.",
    parameters: LIST_MARKETPLACES_PARAMS,
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      try {
        return await buildMarketplaceListResult(pi, ctx);
      } catch (error: unknown) {
        return loadFailure("marketplace list", error);
      }
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
  name: string;
  status: ToolPluginStatus;
  version?: string;
  reasons?: readonly string[];
}

/** Projects the producer's nine list-row variants into the tool's three buckets. */
function projectRowStatus(status: ToolPluginRow["status"]): ToolPluginStatus {
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
 * `narrowed` is not a convenience. `orchestrators/plugin/list-flow.ts::filtersPassive`
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
 * Builds the tool's list payload. The payload builder takes no notification
 * run; the tool resolves the rows it keeps afterwards, under its own run.
 */
async function loadToolPluginPayload(
  params: {
    marketplace?: string;
    scope?: "user" | "project";
  },
  ctx: ExtensionContext,
  buckets: ToolFilterBuckets,
): Promise<Awaited<ReturnType<typeof loadPluginListPayload>>> {
  return loadPluginListPayload({
    ctx,
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
 * Read `p.reasons` defensively. Only a subset of plugin variants carry the
 * field (D-15-01). INV-05 / D-95-06: every one of the nine list-surface
 * variants `projectRowStatus` admits forwards its typed reasons here, and the
 * field is omitted when the array is absent or empty -- an agent reading the
 * tool payload sees the same facts a human reading the rendered row sees.
 *
 * The two arm groups differ only in whether `reasons` is declared optional on
 * the variant, not in whether the row may carry one. Every optional arm has a
 * producer: `disabled` takes `{not in manifest}` from `composeInstalledListRow`
 * (ENBL-16 / D-100-07), and `available` and `remote` take `{installs disabled}`
 * from `installsDisabledField` (OUT-02 / OUT-05).
 *
 * D-116-14: a value-returning switch over the derived row union, for the same
 * reason `pluginVersion` carries one. The groups are total over that union, so
 * there is no trailing fall-through -- a status added to the producer's union
 * is a compile error here rather than a row that silently loses its reasons.
 * Failed notification rows are excluded by the payload producer's return type.
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

/** One marketplace block of the payload `loadPluginListPayload` returns. */
type ToolPluginBlock = Awaited<ReturnType<typeof loadPluginListPayload>>[number];

/**
 * Renders the content lines and keeps, per block, the rows the bucket filter
 * admits. Each kept block is the payload block with only those rows, in
 * order; a block whose rows the filter empties stays as a block with none.
 */
function renderPluginPayload(
  payload: Awaited<ReturnType<typeof loadPluginListPayload>>,
  buckets: { i: boolean; a: boolean; u: boolean },
): { lines: string[]; marketplaces: ToolPluginBlock[] } {
  const lines: string[] = [];
  const marketplaces: ToolPluginBlock[] = [];
  for (const mp of payload) {
    lines.push(`Marketplace ${mp.name} (${mp.scope})`);

    // Unparseable-manifest marketplace block (status: "failed", plugins: [])
    // and zero-plugin manifest blocks both render as the bare-header form
    // followed by the "(no plugins)" body line for shape stability.
    if (mp.plugins.length === 0) {
      lines.push("  (no plugins)");
      marketplaces.push(mp);
      continue;
    }

    const kept: ToolPluginRow[] = [];
    for (const p of mp.plugins) {
      const status = projectRowStatus(p.status);
      if (!buckets[statusKey(status)]) {
        continue;
      }

      const reasons = pluginReasons(p);
      const version = pluginVersion(p);
      const row: PluginRow = {
        name: p.name,
        status,
        ...(version !== undefined && { version }),
        ...(reasons !== undefined && { reasons }),
      };
      lines.push(renderPluginRow(row));
      kept.push(p);
    }

    marketplaces.push({ ...mp, plugins: kept });
  }

  return { lines, marketplaces };
}

/** Builds the plugin list tool's result for the requested marketplaces and buckets. */
async function buildPluginListResult(
  pi: ExtensionAPI,
  params: Type.Static<typeof LIST_PLUGINS_PARAMS>,
  ctx: ExtensionContext,
): Promise<ListToolResult> {
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
        content: textContent(`Marketplace "${params.marketplace}" not found.`),
        details: { marketplaces: [] },
      };
    }
  }

  // Delegate to the payload loader for the data layer; we render text
  // ourselves in the LLM-tool line format. The orchestrator's
  // PluginListPayload carries enough structure to support both this
  // line format AND `details.marketplaces`.
  const payload = await loadToolPluginPayload(params, ctx, buckets);
  const { lines, marketplaces } = renderPluginPayload(payload, buckets);

  // `marketplaces` is populated only from inside `renderPluginPayload`'s
  // loop over `payload`, so an empty payload already implies no blocks;
  // testing both would be one condition asked twice.
  if (payload.length === 0) {
    return {
      content: textContent("No marketplaces configured."),
      details: { marketplaces: [] },
    };
  }

  // LLMT-01 / D-09: the details are the wire blocks of the kept rows,
  // resolved under the list command's row policies and this invocation's
  // soft-dependency snapshot, so each row keeps its verbatim status.
  const run = openNotificationSnapshot(pi);
  const listMessage: CascadeNotificationMessage = {
    marketplaces,
    label: PLUGIN_LIST_CONTEXT.Messaging.label,
    cardinality: "plural",
  };
  const { rowPolicies } = PLUGIN_LIST_CONTEXT;
  const payloadDetails = toWireMarketplaces(
    presentCascade(run, listMessage, rowPolicies).marketplaces,
  );
  return {
    content: textContent(lines.join("\n")),
    details: { marketplaces: payloadDetails },
  };
}

export function registerListPluginsTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "pi_claude_marketplace_plugin_list",
    label: "Marketplace Plugin List",
    description: "List plugins in a Claude marketplace, showing compatibility and install status.",
    promptSnippet: "Use pi_claude_marketplace_plugin_list to inspect plugins in a marketplace.",
    parameters: LIST_PLUGINS_PARAMS,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        return await buildPluginListResult(pi, params, ctx);
      } catch (error: unknown) {
        return loadFailure("plugin list", error);
      }
    },
  });
}
