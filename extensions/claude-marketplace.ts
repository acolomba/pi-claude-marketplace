import { Type } from "typebox";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const LIST_MARKETPLACES_PARAMS = Type.Object({});

export default function claudeMarketplaceExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "claude_marketplace_list",
    label: "Claude Marketplace List",
    description: "List configured Claude plugin marketplaces.",
    promptSnippet: "Use claude_marketplace_list to inspect configured Claude plugin marketplaces.",
    parameters: LIST_MARKETPLACES_PARAMS,
    // eslint-disable-next-line @typescript-eslint/require-await
    async execute() {
      return {
        content: [
          {
            type: "text",
            text: "Claude marketplace access is not implemented yet.",
          },
        ],
        details: {
          marketplaces: [],
          implemented: false,
        },
      };
    },
  });

  pi.registerCommand("claude-marketplace:list", {
    description: "List configured Claude plugin marketplaces.",
    // eslint-disable-next-line @typescript-eslint/require-await
    handler: async (_args, ctx) => {
      ctx.ui.notify("Claude marketplace access is not implemented yet.", "warning");
    },
  });
}
