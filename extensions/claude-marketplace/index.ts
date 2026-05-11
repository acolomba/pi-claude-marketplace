import { notifyWarning } from "./shared/notify.ts";

import type { ExtensionAPI } from "./platform/pi-api.ts";

/**
 * pi-claude-marketplace -- thin Pi extension entrypoint (D-13).
 *
 * Phase 1 ships a working extension shell that:
 *   - registers the `/claude:plugin` slash command (handler stubs to a
 *     "not implemented yet" warning -- Phase 6 lands the real router)
 *   - registers the `resources_discover` event handler (returns empty arrays
 *     -- Phase 3 lands the real walk over `<scope>/claude-marketplace/resources/skills`
 *     and `.../prompts`)
 *
 * Phase 1 deliberately does NOT register any LLM tools. The legacy stub at
 * `extensions/claude-marketplace.ts` registered `claude_marketplace_list`,
 * but per the 9-folder layout (D-10) tool registration belongs in
 * `edge/handlers/list.ts` -- which Phase 6 will populate. The Phase 1
 * `edge/` folder is empty; this file imports only from `shared/`.
 *
 * The `pi.registerCommand` body MUST go through `notifyWarning` from
 * `shared/notify.ts` -- direct `ctx.ui.notify(` is forbidden by the
 * `no-restricted-syntax` rule everywhere except the notify wrapper itself.
 */
export default function claudeMarketplaceExtension(pi: ExtensionAPI): void {
  pi.on("resources_discover", () => {
    // Phase 3 will enumerate `<scope>/claude-marketplace/resources/{skills,prompts}/`
    // for both user and project scopes via persistence/locations.
    return Promise.resolve({ skillPaths: [], promptPaths: [] });
  });

  pi.registerCommand("claude:plugin", {
    description:
      "Manage Claude plugin marketplaces and plugins. Usage: /claude:plugin <install|uninstall|update|list|marketplace> ...",
    handler: (_args, ctx) => {
      notifyWarning(
        ctx,
        "Claude marketplace access is not implemented yet (Phase 6 lands the edge layer).",
      );
      return Promise.resolve();
    },
  });
}
