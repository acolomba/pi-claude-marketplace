// tests/lint-rules/msg-rp-1-rollback-partial.js
//
// MSG-RP-1 (docs/messaging-style-guide.md §8 -- Rollback Partial):
// the `(failed) {rollback partial}` parent-with-indented-children
// composite is emitted via `presentation/rollback-partial.ts`
// (consumed by orchestrators after Plan 06's `transaction/rollback.ts`
// refactor). Any hand-composed string literal containing the
// substring `(failed) {rollback partial}` outside the canonical
// composer is a drift -- the composer owns the parent line + child
// indentation form.
//
// AST visitor: visits string Literal nodes and TemplateLiteral
// quasis; flags any value containing the literal substring `(failed)
// {rollback partial}`. The composer file is excluded via Plan 06's
// `ignores:` block.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const ROLLBACK_PARTIAL_LITERAL = "(failed) {rollback partial}";

export default createRule({
  name: "msg-rp-1-rollback-partial",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-RP-1: the `(failed) {rollback partial}` parent-with-indented-children composite is emitted via `presentation/rollback-partial.ts`. Hand-composed occurrences outside the composer are forbidden.",
    },
    messages: {
      handComposedRollbackPartial:
        "MSG-RP-1: hand-composed `(failed) {rollback partial}` body detected; route through `renderRollbackPartial` (presentation/rollback-partial.ts) per docs/messaging-style-guide.md §8.",
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

        if (node.value.includes(ROLLBACK_PARTIAL_LITERAL)) {
          context.report({ node, messageId: "handComposedRollbackPartial" });
        }
      },
      TemplateLiteral(node) {
        const text = node.quasis.map((q) => q.value.cooked ?? q.value.raw ?? "").join("");
        if (text.includes(ROLLBACK_PARTIAL_LITERAL)) {
          context.report({ node, messageId: "handComposedRollbackPartial" });
        }
      },
    };
  },
});
