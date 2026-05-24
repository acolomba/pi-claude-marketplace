// tests/lint-rules/msg-nc-2-usage-separator.js
//
// MSG-NC-2 (docs/messaging-style-guide.md §12 -- Non-Cascade Errors):
// the blank-line separator between the sentence message and the
// USAGE block is `\n\n` (TWO newlines). The canonical wrapper
// `notifyUsageError` composes this separator atomically. A
// hand-composed `notifyError(ctx, msg + "\n" + USAGE)` form (a
// SINGLE newline) drifts the separator -- the result has the USAGE
// block flush against the message rather than separated by a blank
// line.
//
// AST visitor: `CallExpression` whose callee is `notifyError`;
// inspect the message argument for a BinaryExpression `+` chain
// where one operand is a string literal `"\n"` (single newline) AND
// the chain references a `USAGE` identifier; OR a TemplateLiteral
// whose quasis contain `\n` (single, not `\n\n`) adjacent to a
// `${USAGE}` expression. Overlaps MSG-SR-7's detection -- both rules
// flag the same callsite shape with different messageIds; Plan 06's
// per-rule `files:` scopes make the overlap acceptable.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

function referencesUsage(node) {
  if (node === null || node === undefined) {
    return false;
  }

  if (node.type === "Identifier" && node.name === "USAGE") {
    return true;
  }

  if (node.type === "BinaryExpression") {
    return referencesUsage(node.left) || referencesUsage(node.right);
  }

  if (node.type === "TemplateLiteral") {
    return node.expressions.some(referencesUsage);
  }

  return false;
}

function hasSingleNewlineLiteralInChain(node) {
  if (node === null || node === undefined) {
    return false;
  }

  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value === "\n";
  }

  if (node.type === "TemplateLiteral") {
    // Detect single-newline gap adjacent to a USAGE interpolation.
    for (const quasi of node.quasis) {
      const text = quasi.value.cooked ?? quasi.value.raw ?? "";
      if (/(^|[^\n])\n(?!\n)/.test(text)) {
        return true;
      }
    }

    return false;
  }

  if (node.type === "BinaryExpression") {
    return hasSingleNewlineLiteralInChain(node.left) || hasSingleNewlineLiteralInChain(node.right);
  }

  return false;
}

export default createRule({
  name: "msg-nc-2-usage-separator",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-NC-2: the blank-line separator between sentence message and USAGE block is `\\n\\n` (two newlines). Use `notifyUsageError(ctx, message, usageBlock)` so the wrapper composes the separator atomically.",
    },
    messages: {
      missingBlankLineSeparator:
        "MSG-NC-2: USAGE block adjoined to message with a single `\\n` instead of a `\\n\\n` blank-line separator; use `notifyUsageError(ctx, message, usageBlock)` per docs/messaging-style-guide.md §12.",
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

        if (!referencesUsage(messageArg)) {
          return;
        }

        if (!hasSingleNewlineLiteralInChain(messageArg)) {
          return;
        }

        context.report({ node, messageId: "missingBlankLineSeparator" });
      },
    };
  },
});
