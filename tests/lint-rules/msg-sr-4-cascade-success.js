// tests/lint-rules/msg-sr-4-cascade-success.js
//
// MSG-SR-4 (docs/messaging-style-guide.md §10 -- Severity Routing):
// cascade summaries whose overall outcome is success MUST route via
// `notifySuccess`. A cascade-summary body whose severity tag is
// `success` MUST NOT route through `notifyWarning` -- demoting a
// successful cascade to warning severity is a routing drift.
//
// AST visitor: `CallExpression` whose callee is `notifyWarning` and
// whose message argument either references an identifier whose name
// suggests a success-tagged cascade summary (e.g. `successSummary`,
// `okSummary`, `cascadeSuccess*`), OR is a call to a cascade-summary
// composer with a literal `success` severity argument.
//
// The detection is intentionally narrow: the canonical pattern is
// `notifySuccess(ctx, composeCascadeSummary(rows, "success"))`; this
// rule fires only when a literal `"success"` severity tag is paired
// with `notifyWarning`. Routes through identifier-name heuristics for
// the looser case of indirected helpers.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

function isLiteralSuccessSeverity(node) {
  return (
    node !== undefined &&
    node !== null &&
    node.type === "Literal" &&
    typeof node.value === "string" &&
    node.value === "success"
  );
}

function refersToSuccessCascade(node) {
  if (node === null || node === undefined) {
    return false;
  }

  if (node.type === "Identifier") {
    return /(?:successSummary|cascadeSuccess|okSummary)/i.test(node.name);
  }

  if (node.type === "CallExpression") {
    if (
      node.callee.type === "Identifier" &&
      /cascadeSummary|composeCascade/i.test(node.callee.name)
    ) {
      return node.arguments.some(isLiteralSuccessSeverity);
    }

    if (
      node.callee.type === "MemberExpression" &&
      node.callee.property.type === "Identifier" &&
      /cascadeSummary|composeCascade/i.test(node.callee.property.name)
    ) {
      return node.arguments.some(isLiteralSuccessSeverity);
    }
  }

  if (node.type === "TemplateLiteral") {
    return node.expressions.some(refersToSuccessCascade);
  }

  if (node.type === "BinaryExpression") {
    return refersToSuccessCascade(node.left) || refersToSuccessCascade(node.right);
  }

  return false;
}

export default createRule({
  name: "msg-sr-4-cascade-success",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SR-4: cascade summaries whose severity tag is `success` MUST route via `notifySuccess`, not `notifyWarning` (per docs/messaging-style-guide.md §10).",
    },
    messages: {
      useNotifySuccessForCascadeSuccess:
        "MSG-SR-4: success-tagged cascade summary routed through `notifyWarning`; use `notifySuccess`.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "notifyWarning") {
          return;
        }

        const messageArg = node.arguments[1];
        if (messageArg === undefined) {
          return;
        }

        if (!refersToSuccessCascade(messageArg)) {
          return;
        }

        context.report({ node, messageId: "useNotifySuccessForCascadeSuccess" });
      },
    };
  },
});
