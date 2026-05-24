// tests/lint-rules/msg-sr-6-no-cascade-error.js
//
// MSG-SR-6 (docs/messaging-style-guide.md §10 -- Severity Routing):
// cascade summaries NEVER route via `notifyError`. The cascade
// composer (`presentation/cascade-summary.ts`) returns a string +
// severity tag (`success` | `warning`); orchestrators dispatch via
// `notifySuccess` (success) or `notifyWarning` (warning), never
// `notifyError`. The MSG-SR-6 rule is the broadest of the cascade
// rules: it fires on ANY cascade summary routed through
// `notifyError`, regardless of severity tag.
//
// AST visitor: `CallExpression` whose callee is `notifyError` and
// whose message argument refers to a cascade-summary composer
// identifier (any of `cascadeSummary`, `composeCascade*`,
// `cascadeBody`, or any identifier whose name matches
// `/cascade.*summary|cascade.*body/i`).
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const CASCADE_PATTERN = /cascade(?:Summary|Body)|composeCascade/i;

function refersToCascade(node) {
  if (node === null || node === undefined) {
    return false;
  }

  if (node.type === "Identifier") {
    return CASCADE_PATTERN.test(node.name);
  }

  if (node.type === "CallExpression") {
    if (node.callee.type === "Identifier" && CASCADE_PATTERN.test(node.callee.name)) {
      return true;
    }

    if (
      node.callee.type === "MemberExpression" &&
      node.callee.property.type === "Identifier" &&
      CASCADE_PATTERN.test(node.callee.property.name)
    ) {
      return true;
    }
  }

  if (node.type === "MemberExpression") {
    if (node.property.type === "Identifier" && CASCADE_PATTERN.test(node.property.name)) {
      return true;
    }
  }

  if (node.type === "TemplateLiteral") {
    return node.expressions.some(refersToCascade);
  }

  if (node.type === "BinaryExpression") {
    return refersToCascade(node.left) || refersToCascade(node.right);
  }

  return false;
}

export default createRule({
  name: "msg-sr-6-no-cascade-error",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SR-6: cascade summaries NEVER route via `notifyError`; use `notifySuccess` (success tag) or `notifyWarning` (warning tag) per docs/messaging-style-guide.md §10.",
    },
    messages: {
      noNotifyErrorForCascade:
        "MSG-SR-6: cascade summary routed through `notifyError`; use `notifySuccess` or `notifyWarning` per §10.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "notifyError") {
          return;
        }

        const messageArg = node.arguments[1];
        if (messageArg === undefined) {
          return;
        }

        if (!refersToCascade(messageArg)) {
          return;
        }

        context.report({ node, messageId: "noNotifyErrorForCascade" });
      },
    };
  },
});
