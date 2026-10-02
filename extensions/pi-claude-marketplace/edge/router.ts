// edge/router.ts
//
// AP-3 dispatch + Usage emission.
//
// Direct Pi notify calls are replaced with notifyUsageError(ctx, message,
// usageBlock) from shared/notification-dispatch.ts. ESLint BLOCK A (eslint.config.js)
// forbids direct notify on the Pi context outside of shared/notification-dispatch.ts; the
// notify-discipline grep gate further enforces zero direct calls in this
// file by asserting the literal Pi-context notify expression does not
// appear.
//
// `TOP_LEVEL_USAGE` and `MARKETPLACE_USAGE` are PRD-stable strings.
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
  // Interactive SelectList browser (TUI-only). Falls back to `list` in
  // non-TUI modes.
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
  "enable",
  "disable",
  "import",
  "browse",
  "marketplace",
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

export const TOP_LEVEL_USAGE =
  "Usage: /claude:plugin <bootstrap|install|uninstall|prune|update|fetch|reinstall|list|ls|info|pending|enable|disable|import|browse|marketplace|help> ...\n" +
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
  "  enable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  disable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  import [--scope user|project]\n" +
  "  browse\n" +
  "  marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...\n" +
  "  help [marketplace]";

export const MARKETPLACE_USAGE =
  "Usage: /claude:plugin marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...\n" +
  "  add <source> [--scope user|project]\n" +
  "  remove <name> [--scope user|project]   (alias: rm)\n" +
  "  list [--scope user|project]            (alias: ls)\n" +
  "  info <name> [--scope user|project]\n" +
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
  run: NotificationRun,
): Promise<void> {
  const [head, rest] = peelToken(args);

  if (head === "") {
    // Bare `/claude:plugin` opens the interactive browser (TUI) or falls
    // back to the inventory list (non-TUI), matching Claude Code's
    // `/plugin` UX. `rest` is "" here (peelToken of empty input).
    return handlers.browse(rest, ctx, run);
  }

  switch (head) {
    case "bootstrap":
      return handlers.bootstrap(rest, ctx, run);
    case "install":
      return handlers.install(rest, ctx, run);
    case "uninstall":
      return handlers.uninstall(rest, ctx, run);
    case "prune":
      return handlers.prune(rest, ctx, run);
    case "update":
      return handlers.update(rest, ctx, run);
    case "fetch":
      return handlers.fetch(rest, ctx, run);
    case "reinstall":
      return handlers.reinstall(rest, ctx, run);
    case "list":
    case "ls":
      return handlers.list(rest, ctx, run);
    case "info":
      return handlers.pluginInfo(rest, ctx, run);
    case "pending":
      return handlers.pending(rest, ctx, run);
    case "enable":
      return handlers.enable(rest, ctx, run);
    case "disable":
      return handlers.disable(rest, ctx, run);
    case "import":
      return handlers.import(rest, ctx, run);
    case "marketplace":
      return routeMarketplace(rest, handlers, ctx, run);
    case "browse":
      return handlers.browse(rest, ctx, run);
    case "help":
      return handlers.help(rest, ctx, run);
    default:
      notifyUsageError(ctx, { message: `Unknown subcommand: "${head}".`, usage: TOP_LEVEL_USAGE });
      return;
  }
}

const MARKETPLACE_HELP_USAGE = "Usage: /claude:plugin marketplace help";

async function routeMarketplace(
  args: string,
  handlers: SubcommandHandlers,
  ctx: ExtensionCommandContext,
  run: NotificationRun,
): Promise<void> {
  const [head, rest] = peelToken(args);

  if (head === "") {
    notifyUsageError(ctx, {
      message: "marketplace requires a subcommand.",
      usage: MARKETPLACE_USAGE,
    });
    return;
  }

  switch (head) {
    case "add":
      return handlers.marketplaceAdd(rest, ctx, run);
    case "remove":
    case "rm":
      return handlers.marketplaceRemove(rest, ctx, run);
    case "list":
    case "ls":
      return handlers.marketplaceList(rest, ctx, run);
    case "info":
      return handlers.marketplaceInfo(rest, ctx, run);
    case "update":
      return handlers.marketplaceUpdate(rest, ctx, run);
    case "autoupdate":
      return handlers.marketplaceAutoupdate(rest, ctx, run);
    case "noautoupdate":
      return handlers.marketplaceNoautoupdate(rest, ctx, run);
    case "help":
      // The topic is fixed by the spelling, so there is nothing left to
      // consume. Every sibling verb rejects what it cannot use; silently
      // discarding `rest` here would make this the one spelling where a
      // mistyped argument reads as success.
      if (rest.trim() !== "") {
        notifyUsageError(ctx, {
          message: "marketplace help takes no arguments.",
          usage: MARKETPLACE_HELP_USAGE,
        });
        return;
      }

      return handlers.help("marketplace", ctx, run);
    default:
      notifyUsageError(ctx, {
        message: `Unknown marketplace subcommand: "${head}".`,
        usage: MARKETPLACE_USAGE,
      });
      return;
  }
}
