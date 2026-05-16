// edge/router.ts
//
// AP-3 dispatch + Usage emission. Ported from V1
// (`extensions/pi-claude-marketplace/commands/router.ts`) with two refinements:
//
//   1. Direct Pi notify calls are replaced with notifyUsageError(ctx,
//      message, usageBlock) from shared/notify.ts. ESLint BLOCK A
//      (eslint.config.js) forbids direct notify on the Pi context outside
//      of shared/notify.ts; the notify-discipline grep gate (Plan 06-02
//      Task 2 verify) further enforces zero direct calls in this file by
//      asserting the literal Pi-context notify expression does not appear.
//
//   2. Imports re-anchored to the new structure: `notifyUsageError` from
//      `../shared/notify.ts`; `ExtensionCommandContext` from the Pi host pkg.
//
// `TOP_LEVEL_USAGE` and `MARKETPLACE_USAGE` are PRD-stable strings carried
// verbatim from V1.
//
// `routeClaudePlugin` accepts `ls` as an alias for `list`; `routeMarketplace`
// accepts `rm` and `ls` as aliases for `remove` and `list`.
//
// Router signature is pure-functional (`routeClaudePlugin(args, handlers, ctx)`)
// so handlers + ctx can be mocked without an `ExtensionAPI` instance.
// `register.ts` (Plan 06-05) builds the `SubcommandHandlers` record from
// `EdgeDeps` and passes it in.

import { notifyUsageError } from "../shared/notify.ts";

import type { ExtensionCommandContext } from "../platform/pi-api.ts";

export interface SubcommandHandlers {
  bootstrap: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  install: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  uninstall: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  update: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  reinstall: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  list: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  import: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceAdd: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceRemove: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceList: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceUpdate: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceAutoupdate: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceNoautoupdate: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}

/**
 * All top-level subcommands accepted by routeClaudePlugin, including
 * aliases. Imported by the completion provider so both systems stay in sync.
 */
export const TOP_LEVEL_SUBCOMMANDS = [
  "bootstrap",
  "install",
  "uninstall",
  "update",
  "reinstall",
  "list",
  "ls",
  "import",
  "marketplace",
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
  "update",
  "autoupdate",
  "noautoupdate",
] as const;

export const TOP_LEVEL_USAGE =
  "Usage: /claude:plugin <bootstrap|install|uninstall|update|reinstall|list|ls|import|marketplace> ...\n" +
  "  bootstrap                                          add anthropics/claude-plugins-official to user scope and enable autoupdate\n" +
  "  install <plugin>@<marketplace> [--scope user|project]\n" +
  "  uninstall <plugin>@<marketplace> [--scope user|project]\n" +
  "  update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--force]\n" +
  "  list [<marketplace>] [--scope user|project]   (alias: ls)\n" +
  "  import [--scope user|project]\n" +
  "  marketplace <add|remove|rm|list|ls|update|autoupdate|noautoupdate> ...";

export const MARKETPLACE_USAGE =
  "Usage: /claude:plugin marketplace <add|remove|rm|list|ls|update|autoupdate|noautoupdate> ...\n" +
  "  add <source> [--scope user|project]\n" +
  "  remove <name> [--scope user|project]   (alias: rm)\n" +
  "  list [--scope user|project]            (alias: ls)\n" +
  "  update [<name>] [--scope user|project]\n" +
  "  autoupdate [<name>] [--scope user|project]\n" +
  "  noautoupdate [<name>] [--scope user|project]";

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

export async function routeClaudePlugin(
  args: string,
  handlers: SubcommandHandlers,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const [head, rest] = peelToken(args);

  if (head === "") {
    notifyUsageError(ctx, "Usage error.", TOP_LEVEL_USAGE);
    return;
  }

  switch (head) {
    case "bootstrap":
      return handlers.bootstrap(rest, ctx);
    case "install":
      return handlers.install(rest, ctx);
    case "uninstall":
      return handlers.uninstall(rest, ctx);
    case "update":
      return handlers.update(rest, ctx);
    case "reinstall":
      return handlers.reinstall(rest, ctx);
    case "list":
    case "ls":
      return handlers.list(rest, ctx);
    case "import":
      return handlers.import(rest, ctx);
    case "marketplace":
      return routeMarketplace(rest, handlers, ctx);
    default:
      notifyUsageError(ctx, `Unknown subcommand: "${head}".`, TOP_LEVEL_USAGE);
      return;
  }
}

export async function routeMarketplace(
  args: string,
  handlers: SubcommandHandlers,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const [head, rest] = peelToken(args);

  if (head === "") {
    notifyUsageError(ctx, "marketplace requires a subcommand.", MARKETPLACE_USAGE);
    return;
  }

  switch (head) {
    case "add":
      return handlers.marketplaceAdd(rest, ctx);
    case "remove":
    case "rm":
      return handlers.marketplaceRemove(rest, ctx);
    case "list":
    case "ls":
      return handlers.marketplaceList(rest, ctx);
    case "update":
      return handlers.marketplaceUpdate(rest, ctx);
    case "autoupdate":
      return handlers.marketplaceAutoupdate(rest, ctx);
    case "noautoupdate":
      return handlers.marketplaceNoautoupdate(rest, ctx);
    default:
      notifyUsageError(ctx, `Unknown marketplace subcommand: "${head}".`, MARKETPLACE_USAGE);
      return;
  }
}
