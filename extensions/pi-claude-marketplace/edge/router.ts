// edge/router.ts
//
// AP-3 dispatch + Usage emission.
//
// Direct Pi notify calls are replaced with notifyUsageError(ctx, message,
// usageBlock) from shared/notification-dispatch.ts. The fallow rule
// `architecture/notify-chokepoint` forbids direct notify on the Pi context
// outside of shared/notification-dispatch.ts.
//
// `TOP_LEVEL_USAGE` is a PRD-stable string. `MARKETPLACE_USAGE` is built from
// one signature row per marketplace verb (USE-01). The same row also builds
// that verb's own usage line through `marketplaceUsage`, and the rows supply
// the marketplace spelling list in both help texts and the `MarketplaceVerb`
// type.
//
// `routeClaudePlugin` accepts `ls` as an alias for `list`; `routeMarketplace`
// accepts `rm` and `ls` as aliases for `remove` and `list`.
//
// Router signature is pure-functional
// (`routeClaudePlugin(args, handlers, ctx, run)`) so handlers, ctx, and the
// notification run can be mocked without an `ExtensionAPI` instance.
// `register.ts` builds the `SubcommandHandlers` record from `EdgeDeps`, opens
// one notification run per command invocation (D-05, D-07), and passes both
// in. The router hands that run to whichever handler it dispatches.

import { notifyUsageError } from "../shared/notification-dispatch.ts";

import { tokenizeArgs } from "./args.ts";

import type { ExtensionCommandContext } from "../platform/pi-api.ts";
import type { NotificationRun } from "../shared/notification-run.ts";

/**
 * One subcommand handler: the argument text after the subcommand, the Pi
 * command context, and the command's notification run.
 */
export type SubcommandHandler = (
  args: string,
  ctx: ExtensionCommandContext,
  run: NotificationRun,
) => Promise<void>;

export interface SubcommandHandlers {
  bootstrap: SubcommandHandler;
  install: SubcommandHandler;
  uninstall: SubcommandHandler;
  prune: SubcommandHandler;
  update: SubcommandHandler;
  // FTCH-01: pi-only `fetch` verb (upstream `/plugin` has no fetch). Warms a
  // git-source plugin's clone/mirror cache without installing.
  fetch: SubcommandHandler;
  reinstall: SubcommandHandler;
  list: SubcommandHandler;
  // Named `pluginInfo` (NOT `info`) to disambiguate from
  // `marketplaceInfo`. The router dispatches `"info"` here.
  pluginInfo: SubcommandHandler;
  // DIFF-01 SC #2 / D-53-01: `/claude:plugin pending` read-only diff command.
  pending: SubcommandHandler;
  // APL-01 / D-07: `/claude:plugin apply` makes the changes `pending` lists.
  // Named `pluginApply` (NOT `apply`): strong-mock reserves `apply`, `call`
  // and `bind` on every mock, so a `SubcommandHandlers` mock could not state
  // an `apply` member.
  pluginApply: SubcommandHandler;
  // AAP-04: `/claude:plugin autoapply` shows or sets the autoapply setting.
  autoapply: SubcommandHandler;
  // D-54-01 / ENBL-01..04: enable/disable commands.
  enable: SubcommandHandler;
  disable: SubcommandHandler;
  import: SubcommandHandler;
  marketplaceAdd: SubcommandHandler;
  marketplaceRemove: SubcommandHandler;
  marketplaceList: SubcommandHandler;
  marketplaceInfo: SubcommandHandler;
  marketplaceUpdate: SubcommandHandler;
  marketplaceAutoupdate: SubcommandHandler;
  marketplaceNoautoupdate: SubcommandHandler;
  // Interactive SelectList browser; non-TUI modes receive a refusal.
  browse: SubcommandHandler;
  help: SubcommandHandler;
}

/**
 * All top-level subcommands accepted by routeClaudePlugin, including
 * aliases. Imported by the completion provider so both systems stay in sync.
 */
export const TOP_LEVEL_SUBCOMMANDS = [
  "bootstrap",
  "install",
  "uninstall",
  "prune",
  "update",
  "fetch",
  "reinstall",
  "list",
  "ls",
  "info",
  "pending",
  "apply",
  "autoapply",
  "enable",
  "disable",
  "import",
  "browse",
  "marketplace",
  "market",
  "help",
] as const;

/**
 * All subcommands accepted by routeMarketplace, including aliases.
 * Imported by the completion provider so both systems stay in sync.
 */
export const MARKETPLACE_SUBCOMMANDS = [
  "add",
  "remove",
  "rm",
  "list",
  "ls",
  "info",
  "update",
  "autoupdate",
  "noautoupdate",
  "help",
] as const;

interface MarketplaceVerbSignature {
  readonly alias?: string;
  readonly args: string;
}

const MARKETPLACE_VERB_SIGNATURES = {
  add: { args: "<source> [--scope user|project] [--local]" },
  remove: { alias: "rm", args: "<name> [--scope user|project] [--local]" },
  list: { alias: "ls", args: "[--scope user|project]" },
  info: { args: "<name> [--scope user|project]" },
  update: { args: "[<name>] [--scope user|project]" },
  autoupdate: { args: "[<name>] [--scope user|project] [--local]" },
  noautoupdate: { args: "[<name>] [--scope user|project] [--local]" },
} as const satisfies Record<string, MarketplaceVerbSignature>;

export type MarketplaceVerb = keyof typeof MARKETPLACE_VERB_SIGNATURES;

const MARKETPLACE_VERB_ROWS = Object.entries<MarketplaceVerbSignature>(MARKETPLACE_VERB_SIGNATURES);

const MARKETPLACE_SPELLINGS = MARKETPLACE_VERB_ROWS.flatMap(([verb, { alias }]) =>
  alias === undefined ? [verb] : [verb, alias],
).join("|");

export const TOP_LEVEL_USAGE =
  "Usage: /claude:plugin <bootstrap|install|uninstall|prune|update|fetch|reinstall|list|ls|info|pending|apply|autoapply|enable|disable|import|browse|marketplace|market|help> ...\n" +
  "  bootstrap                                          add anthropics/claude-plugins-official to user scope and enable autoupdate\n" +
  "  install <plugin>@<marketplace> [--scope user|project]\n" +
  "  uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local] [--prune]\n" +
  "  prune [--scope user|project] [--dry-run]\n" +
  "  update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  list [<marketplace>] [--scope user|project]   (alias: ls)\n" +
  "  info <plugin>@<marketplace> [--scope user|project]\n" +
  "  pending [--scope user|project]\n" +
  "  apply [--scope user|project]\n" +
  "  autoapply [on|off] [--scope user|project] [--local]\n" +
  "  enable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  disable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  import [--scope user|project]\n" +
  "  browse\n" +
  `  marketplace <${MARKETPLACE_SPELLINGS}> ...   (alias: market)\n` +
  "  help [marketplace]";

/** The usage line of one marketplace verb, built from its signature row. */
export function marketplaceUsage(verb: MarketplaceVerb): string {
  const { alias, args }: MarketplaceVerbSignature = MARKETPLACE_VERB_SIGNATURES[verb];
  const spelling = alias === undefined ? verb : `<${verb}|${alias}>`;
  return `Usage: /claude:plugin marketplace ${spelling} ${args}`;
}

// The alias notes share one column, three spaces past the longest line that
// carries one.
function marketplaceHelp(): string {
  const rows = MARKETPLACE_VERB_ROWS.map(([verb, { alias, args }]) => ({
    line: `  ${verb} ${args}`,
    alias,
  }));
  const aliasColumn =
    Math.max(...rows.filter((row) => row.alias !== undefined).map((row) => row.line.length)) + 3;
  return [
    `Usage: /claude:plugin marketplace <${MARKETPLACE_SPELLINGS}> ...`,
    ...rows.map(({ line, alias }) =>
      alias === undefined ? line : `${line.padEnd(aliasColumn)}(alias: ${alias})`,
    ),
  ].join("\n");
}

export const MARKETPLACE_USAGE = marketplaceHelp();

/**
 * Peel off the first whitespace-delimited token from `args`. Returns
 * `[head, rest]` where `rest` is the remainder with leading whitespace
 * stripped. If `args` has no non-whitespace content, returns `["", ""]`.
 */
function peelToken(args: string): [string, string] {
  const trimmed = args.trimStart();
  if (trimmed === "") {
    return ["", ""];
  }

  const match = /\s+/.exec(trimmed);
  if (match === null) {
    return [trimmed, ""];
  }

  return [trimmed.slice(0, match.index), trimmed.slice(match.index + match[0].length)];
}

/** One canonical identity and the executable route selected from command text. */
export type SelectedCommandRoute =
  | { readonly commandId: string; readonly handler: SubcommandHandler; readonly args: string }
  | { readonly commandId: string; readonly message: string; readonly usage: string };

/** Executes a selected route, or selects command text for callers with a run. */
export async function routeClaudePlugin(
  args: string | SelectedCommandRoute,
  handlers: SubcommandHandlers,
  ctx: ExtensionCommandContext,
  run: NotificationRun,
): Promise<void> {
  const route = typeof args === "string" ? selectClaudePluginRoute(args, handlers) : args;
  if ("handler" in route) {
    return route.handler(route.args, ctx, run);
  }

  notifyUsageError(ctx, run, { message: route.message, usage: route.usage });
}

interface VerbRoute {
  readonly commandId: string;
  readonly handler: keyof SubcommandHandlers;
}

// The top-level spellings whose identity and handler depend on the spelling
// alone. `marketplace` and `help` read the rest of the text, so they stay in
// `selectClaudePluginRoute`'s switch.
const TOP_LEVEL_VERB_ROUTES: ReadonlyMap<string, VerbRoute> = new Map([
  ["bootstrap", { commandId: "plugin bootstrap", handler: "bootstrap" }],
  ["install", { commandId: "plugin install", handler: "install" }],
  ["uninstall", { commandId: "plugin uninstall", handler: "uninstall" }],
  ["prune", { commandId: "plugin prune", handler: "prune" }],
  ["update", { commandId: "plugin update", handler: "update" }],
  ["fetch", { commandId: "plugin fetch", handler: "fetch" }],
  ["reinstall", { commandId: "plugin reinstall", handler: "reinstall" }],
  ["list", { commandId: "plugin list", handler: "list" }],
  ["ls", { commandId: "plugin list", handler: "list" }],
  ["info", { commandId: "plugin info", handler: "pluginInfo" }],
  ["pending", { commandId: "plugin pending", handler: "pending" }],
  ["apply", { commandId: "plugin apply", handler: "pluginApply" }],
  ["autoapply", { commandId: "plugin autoapply", handler: "autoapply" }],
  ["enable", { commandId: "plugin enable", handler: "enable" }],
  ["disable", { commandId: "plugin disable", handler: "disable" }],
  ["import", { commandId: "plugin import", handler: "import" }],
  ["browse", { commandId: "plugin browse", handler: "browse" }],
]);

/** Selects canonical identity and dispatch together, preserving handler arguments. */
export function selectClaudePluginRoute(
  args: string,
  handlers: SubcommandHandlers,
): SelectedCommandRoute {
  const [head, rest] = peelToken(args);

  if (head === "") {
    // Bare `/claude:plugin` selects browse, including its mode admission.
    // `rest` is "" here (peelToken of empty input).
    return { commandId: "plugin browse", handler: handlers.browse, args: rest };
  }

  const verbRoute = TOP_LEVEL_VERB_ROUTES.get(head);
  if (verbRoute !== undefined) {
    return { commandId: verbRoute.commandId, handler: handlers[verbRoute.handler], args: rest };
  }

  switch (head) {
    case "marketplace":
    case "market":
      return selectMarketplaceRoute(rest, handlers);
    case "help":
      return {
        commandId: isMarketplaceHelpTopic(rest) ? "marketplace help" : "plugin help",
        handler: handlers.help,
        args: rest,
      };
    default:
      return {
        commandId: "plugin",
        message: `Unknown subcommand: "${head}".`,
        usage: TOP_LEVEL_USAGE,
      };
  }
}

// The help handler tokenizes its topic, so the identity reads the same tokens:
// `help "marketplace"` is the marketplace topic too, and so is `help market`.
function isMarketplaceHelpTopic(args: string): boolean {
  const tokens = tokenizeArgs(args);
  const topic = tokens.length === 1 ? tokens[0]?.value : undefined;
  return topic === "marketplace" || topic === "market";
}

const MARKETPLACE_HELP_USAGE = "Usage: /claude:plugin marketplace help";

function selectMarketplaceRoute(args: string, handlers: SubcommandHandlers): SelectedCommandRoute {
  const [head, rest] = peelToken(args);

  if (head === "") {
    return {
      commandId: "marketplace",
      message: "marketplace requires a subcommand.",
      usage: MARKETPLACE_USAGE,
    };
  }

  switch (head) {
    case "add":
      return { commandId: "marketplace add", handler: handlers.marketplaceAdd, args: rest };
    case "remove":
    case "rm":
      return { commandId: "marketplace remove", handler: handlers.marketplaceRemove, args: rest };
    case "list":
    case "ls":
      return { commandId: "marketplace list", handler: handlers.marketplaceList, args: rest };
    case "info":
      return { commandId: "marketplace info", handler: handlers.marketplaceInfo, args: rest };
    case "update":
      return { commandId: "marketplace update", handler: handlers.marketplaceUpdate, args: rest };
    case "autoupdate":
      return {
        commandId: "marketplace autoupdate",
        handler: handlers.marketplaceAutoupdate,
        args: rest,
      };
    case "noautoupdate":
      return {
        commandId: "marketplace noautoupdate",
        handler: handlers.marketplaceNoautoupdate,
        args: rest,
      };
    case "help":
      // The topic is fixed by the spelling, so there is nothing left to
      // consume. Every sibling verb rejects what it cannot use; silently
      // discarding `rest` here would make this the one spelling where a
      // mistyped argument reads as success. MPA-03: a flag is named first, as
      // `help marketplace` and `bootstrap` name it.
      if (rest.trim() !== "") {
        const flag = tokenizeArgs(rest).find((token) => token.value.startsWith("--"));
        return {
          commandId: "marketplace help",
          message:
            flag === undefined
              ? "marketplace help takes no arguments."
              : `Unknown flag: "${flag.value}".`,
          usage: MARKETPLACE_HELP_USAGE,
        };
      }

      return { commandId: "marketplace help", handler: handlers.help, args: "marketplace" };
    default:
      return {
        commandId: "marketplace",
        message: `Unknown marketplace subcommand: "${head}".`,
        usage: MARKETPLACE_USAGE,
      };
  }
}
