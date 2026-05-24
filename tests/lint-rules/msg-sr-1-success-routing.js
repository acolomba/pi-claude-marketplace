// tests/lint-rules/msg-sr-1-success-routing.js
//
// MSG-SR-1 (docs/messaging-style-guide.md §10 -- Severity Routing):
// SUCCESS-class status tokens (`(installed)`, `(updated)`,
// `(reinstalled)`, `(uninstalled)`, `(added)`, `(removed)`,
// `(available)`, `(upgradable)`) MUST route via `notifySuccess`.
// Routing a SUCCESS-class token through `notifyWarning` or
// `notifyError` is a routing drift and demotes a successful outcome to
// a non-success severity at the host UI.
//
// AST visitor: `CallExpression` whose callee is `notifyWarning` or
// `notifyError`; inspect the second argument (the message) for any
// `(<success-class-token>)` literal substring. The detector consumes
// literal text from Literal nodes, TemplateLiteral quasis, and
// BinaryExpression `+` chains via the shared `collectLiteralText`
// helper.
//
// D-14-09 LOCKED: this is a FULL-IMPL rule (real AST visitor) per
// RESEARCH.md Pattern 1.

import { ESLintUtils } from "@typescript-eslint/utils";

import { SUCCESS_CLASS_TOKENS, collectLiteralText, findStatusTokenIn } from "./lib/sr-tokens.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const WRONG_WRAPPERS = new Set(["notifyWarning", "notifyError"]);

export default createRule({
  name: "msg-sr-1-success-routing",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SR-1: SUCCESS-class status tokens (`(installed)`, `(updated)`, `(reinstalled)`, `(uninstalled)`, `(added)`, `(removed)`, `(available)`, `(upgradable)`) MUST route via `notifySuccess`, not `notifyWarning` / `notifyError`.",
    },
    messages: {
      useNotifySuccess:
        "MSG-SR-1: success-class status token routed through `{{wrapper}}`; use `notifySuccess` (per docs/messaging-style-guide.md §10).",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || !WRONG_WRAPPERS.has(node.callee.name)) {
          return;
        }

        const messageArg = node.arguments[1];
        if (messageArg === undefined) {
          return;
        }

        const text = collectLiteralText(messageArg);
        if (text === "") {
          return;
        }

        const token = findStatusTokenIn(text, SUCCESS_CLASS_TOKENS);
        if (token === null) {
          return;
        }

        context.report({
          node,
          messageId: "useNotifySuccess",
          data: { wrapper: node.callee.name },
        });
      },
    };
  },
});
