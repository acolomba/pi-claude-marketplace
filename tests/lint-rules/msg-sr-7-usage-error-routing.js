// tests/lint-rules/msg-sr-7-usage-error-routing.js
//
// MSG-SR-7 (docs/messaging-style-guide.md §10 -- Severity Routing +
// §12 -- Usage Errors): argument-parsing and usage-validation
// failures MUST route via `notifyUsageError(ctx, message, usage)` --
// NOT `notifyError(ctx, message + "\n" + USAGE)`. The
// `notifyUsageError` wrapper composes the `\n\n` blank-line separator
// between the sentence message and the USAGE block per MSG-NC-2; the
// hand-composed concatenation drifts the separator (a single `\n`
// instead of two) and dilutes severity-routing observability.
//
// AST visitor: `CallExpression` whose callee is `notifyError`; check
// whether the message argument (BinaryExpression / TemplateLiteral)
// references a `USAGE` identifier. The `sourceReferencesUsage`
// recursive helper handles Identifier / TemplateLiteral /
// BinaryExpression node shapes per RESEARCH.md Pattern 1.
//
// D-14-09 LOCKED: this is the canonical FULL-IMPL rule shape
// (RESEARCH.md Pattern 1's worked example).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

function sourceReferencesUsage(node) {
  if (node === null || node === undefined) {
    return false;
  }

  if (node.type === "Identifier" && node.name === "USAGE") {
    return true;
  }

  if (node.type === "TemplateLiteral") {
    return node.expressions.some(sourceReferencesUsage);
  }

  if (node.type === "BinaryExpression") {
    return sourceReferencesUsage(node.left) || sourceReferencesUsage(node.right);
  }

  return false;
}

export default createRule({
  name: "msg-sr-7-usage-error-routing",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SR-7: argument-validation failures must use `notifyUsageError(ctx, message, usageBlock)` instead of `notifyError` with USAGE concatenated into the message. The wrapper enforces the MSG-NC-2 blank-line separator.",
    },
    messages: {
      useNotifyUsageError:
        "MSG-SR-7: use `notifyUsageError(ctx, message, usageBlock)` instead of `notifyError` with USAGE concatenated into the message. The wrapper enforces the MSG-NC-2 `\\n\\n` blank-line separator (per docs/messaging-style-guide.md §10 + §12).",
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

        if (sourceReferencesUsage(messageArg)) {
          context.report({ node, messageId: "useNotifyUsageError" });
        }
      },
    };
  },
});
