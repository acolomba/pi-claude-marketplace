// tests/lint-rules/msg-sr-2-warning-routing.js
//
// MSG-SR-2 (docs/messaging-style-guide.md §10 -- Severity Routing):
// INFO-class status tokens (`(skipped)`, `(no marketplaces)`,
// `(no plugins)`) route via `notifySuccess` per the four-wrapper
// minimalism in `shared/notify.ts` (D-CMC-11..D-CMC-13). They MUST
// NOT route through `notifyWarning` or `notifyError` -- a routine
// no-op is not a warning, and an empty result is not an error.
//
// AST visitor: `CallExpression` whose callee is `notifyWarning` or
// `notifyError`; inspect the message argument for any
// `(<info-class-token>)` literal substring via `collectLiteralText`.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

import { INFO_CLASS_TOKENS, collectLiteralText, findStatusTokenIn } from "./lib/sr-tokens.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const WRONG_WRAPPERS = new Set(["notifyWarning", "notifyError"]);

export default createRule({
  name: "msg-sr-2-warning-routing",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SR-2: INFO-class status tokens (`(skipped)`, `(no marketplaces)`, `(no plugins)`) route via `notifySuccess` per §10 + four-wrapper minimalism; routing them through `notifyWarning` / `notifyError` is a drift.",
    },
    messages: {
      useNotifyInfoOrSuccess:
        "MSG-SR-2: info-class status token routed through `{{wrapper}}`; use `notifySuccess` (per docs/messaging-style-guide.md §10 + shared/notify.ts four-wrapper minimalism).",
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

        const token = findStatusTokenIn(text, INFO_CLASS_TOKENS);
        if (token === null) {
          return;
        }

        context.report({
          node,
          messageId: "useNotifyInfoOrSuccess",
          data: { wrapper: node.callee.name },
        });
      },
    };
  },
});
