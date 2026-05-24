// tests/lint-rules/msg-sd-1-soft-dep-reason.js
//
// MSG-SD-1 (docs/messaging-style-guide.md §6 -- Soft-Dependency
// Markers): the closed REASONS enum contains `requires pi-subagents`
// and `requires pi-mcp`, emitted exclusively via
// `presentation/compact-line.ts::composeReasons` based on each row's
// `declaresAgents` / `declaresMcp` predicate. Any hand-composed
// string literal containing `{requires pi-subagents}` or `{requires
// pi-mcp}` outside the renderer is a drift -- the renderer owns
// emission, not callers.
//
// AST visitor: visits string Literal nodes and TemplateLiteral
// quasis; flags any text matching `/\{requires pi-(?:subagents|mcp)\}/`.
// The renderer file is excluded via Plan 06's `ignores:` block.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const SOFT_DEP_REASON_RE = /\{requires pi-(?:subagents|mcp)\}/;

export default createRule({
  name: "msg-sd-1-soft-dep-reason",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SD-1: `{requires pi-subagents}` / `{requires pi-mcp}` reasons are emitted exclusively via `presentation/compact-line.ts::composeReasons`. Hand-composed occurrences outside the renderer are forbidden.",
    },
    messages: {
      handComposedSoftDepReason:
        "MSG-SD-1: hand-composed `{requires pi-subagents}` / `{requires pi-mcp}` reason literal detected; route through `composeReasons` (presentation/compact-line.ts) per docs/messaging-style-guide.md §6.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") {
          return;
        }

        if (SOFT_DEP_REASON_RE.test(node.value)) {
          context.report({ node, messageId: "handComposedSoftDepReason" });
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          const text = quasi.value.cooked ?? quasi.value.raw ?? "";
          if (SOFT_DEP_REASON_RE.test(text)) {
            context.report({ node: quasi, messageId: "handComposedSoftDepReason" });
            return;
          }
        }
      },
    };
  },
});
