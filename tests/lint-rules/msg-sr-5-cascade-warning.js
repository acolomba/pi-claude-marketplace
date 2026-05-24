// tests/lint-rules/msg-sr-5-cascade-warning.js
//
// MSG-SR-5 (docs/messaging-style-guide.md §10 -- Severity Routing):
// cascade summaries whose overall outcome is partial (warning) MUST
// route via `notifyWarning`. Routing a warning-tagged cascade through
// `notifySuccess` is a routing drift -- a partial cascade is not a
// success.
//
// AST visitor: symmetrical to MSG-SR-4. Visits `notifySuccess`
// callsites whose message argument references a warning-tagged
// cascade summary -- detection via identifier-name heuristics
// (`warningSummary`, `cascadeWarning*`, `partialSummary`) and via
// cascade-summary composers called with a literal `"warning"`
// severity argument.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

function isLiteralWarningSeverity(node) {
  return (
    node !== undefined &&
    node !== null &&
    node.type === "Literal" &&
    typeof node.value === "string" &&
    node.value === "warning"
  );
}

function refersToWarningCascade(node) {
  if (node === null || node === undefined) {
    return false;
  }

  if (node.type === "Identifier") {
    return /(?:warningSummary|cascadeWarning|partialSummary)/i.test(node.name);
  }

  if (node.type === "CallExpression") {
    if (
      node.callee.type === "Identifier" &&
      /cascadeSummary|composeCascade/i.test(node.callee.name)
    ) {
      return node.arguments.some(isLiteralWarningSeverity);
    }

    if (
      node.callee.type === "MemberExpression" &&
      node.callee.property.type === "Identifier" &&
      /cascadeSummary|composeCascade/i.test(node.callee.property.name)
    ) {
      return node.arguments.some(isLiteralWarningSeverity);
    }
  }

  if (node.type === "TemplateLiteral") {
    return node.expressions.some(refersToWarningCascade);
  }

  if (node.type === "BinaryExpression") {
    return refersToWarningCascade(node.left) || refersToWarningCascade(node.right);
  }

  return false;
}

export default createRule({
  name: "msg-sr-5-cascade-warning",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SR-5: cascade summaries whose severity tag is `warning` MUST route via `notifyWarning`, not `notifySuccess` (per docs/messaging-style-guide.md §10).",
    },
    messages: {
      useNotifyWarningForCascadeWarning:
        "MSG-SR-5: warning-tagged cascade summary routed through `notifySuccess`; use `notifyWarning`.",
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

        if (!refersToWarningCascade(messageArg)) {
          return;
        }

        context.report({ node, messageId: "useNotifyWarningForCascadeWarning" });
      },
    };
  },
});
