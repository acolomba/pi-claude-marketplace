// tests/lint-rules/msg-lc-1-console-warn-form.js
//
// MSG-LC-1 (docs/messaging-style-guide.md §14.1 -- IL-3 console.warn):
// the single sanctioned `console.warn` at `persistence/migrate.ts`
// is the ONLY permitted callsite (per PRD §6.13 IL-3). Any other
// `console.warn` invocation in extension code is a drift and bypasses
// the four-wrapper `ctx.ui.notify` channel.
//
// AST visitor: visits `CallExpression` nodes whose callee is the
// `MemberExpression` shape `console.warn` (Identifier `console` +
// Identifier `warn`). Reports every match; Plan 06's `files:` scope
// narrows the rule to the entire extension surface (the
// `persistence/migrate.ts` sanctioned callsite is excluded via the
// per-file `ignores:` entry in the config block).
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-lc-1-console-warn-form",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-LC-1: `console.warn` is forbidden outside the single sanctioned callsite at `persistence/migrate.ts` (PRD §6.13 IL-3, preserved per §14.1). All other user-visible messages MUST flow through the four `ctx.ui.notify` wrappers in `shared/notify.ts`.",
    },
    messages: {
      extraConsoleWarn:
        "MSG-LC-1: `console.warn` is forbidden outside the sanctioned callsite at `persistence/migrate.ts`. Use one of the four `ctx.ui.notify` wrappers in `shared/notify.ts` per docs/messaging-style-guide.md §14.1.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression") {
          return;
        }

        if (
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "console" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "warn"
        ) {
          context.report({ node, messageId: "extraConsoleWarn" });
        }
      },
    };
  },
});
