// tests/lint-rules/msg-sr-3-error-routing.js
//
// MSG-SR-3 (docs/messaging-style-guide.md §10 -- Severity Routing):
// WARNING-class status tokens (`(failed)`, `(rollback failed)`,
// `(manual recovery)`, `(unavailable)`) MUST route via
// `notifyWarning` (soft failure / cascade-warning) or `notifyError`
// (hard failure). Routing a WARNING-class token through
// `notifySuccess` falsely brands a failure as a success at the host
// UI.
//
// AST visitor: `CallExpression` whose callee is `notifySuccess`;
// inspect the message argument for any `(<warning-class-token>)`
// literal substring.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

import { WARNING_CLASS_TOKENS, collectLiteralText, findStatusTokenIn } from "./lib/sr-tokens.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-sr-3-error-routing",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SR-3: WARNING-class status tokens (`(failed)`, `(rollback failed)`, `(manual recovery)`, `(unavailable)`) MUST route via `notifyWarning` or `notifyError`, not `notifySuccess`.",
    },
    messages: {
      useNotifyWarningOrError:
        "MSG-SR-3: warning-class status token routed through `notifySuccess`; use `notifyWarning` or `notifyError` (per docs/messaging-style-guide.md §10).",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "notifySuccess") {
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

        const token = findStatusTokenIn(text, WARNING_CLASS_TOKENS);
        if (token === null) {
          return;
        }

        context.report({ node, messageId: "useNotifyWarningOrError" });
      },
    };
  },
});
