// tests/lint-rules/msg-cc-1-cause-chain.js
//
// MSG-CC-1 (docs/messaging-style-guide.md §9 -- Cause Chain): the
// `cause: <link1> -> <link2> -> ...` trailer is composed via
// `presentation/cause-chain.ts` (canonical body composer) and
// `shared/errors.ts::causeChainTrailer` (canonical Error-walker).
// Manual `cause:` / `Cause:` string composition outside those files
// drifts the spacing / arrow / casing.
//
// AST visitor: visits string Literal nodes and TemplateLiteral
// quasis; flags any text matching `/\bcause:\s/i`. Case-insensitive
// to catch both `cause:` and `Cause:` forms. The canonical composers
// are excluded via Plan 06's `ignores:` block.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const CAUSE_PREFIX_RE = /\bcause:\s/i;

export default createRule({
  name: "msg-cc-1-cause-chain",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-CC-1: cause-chain trailer is composed via `presentation/cause-chain.ts` + `shared/errors.ts::causeChainTrailer`. Hand-composed `cause:` literals outside those files are forbidden.",
    },
    messages: {
      handComposedCauseChain:
        "MSG-CC-1: hand-composed `cause:` chain literal detected; route through `causeChainTrailer` (shared/errors.ts) or `renderCauseChain` (presentation/cause-chain.ts) per docs/messaging-style-guide.md §9.",
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

        if (CAUSE_PREFIX_RE.test(node.value)) {
          context.report({ node, messageId: "handComposedCauseChain" });
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          const text = quasi.value.cooked ?? quasi.value.raw ?? "";
          if (CAUSE_PREFIX_RE.test(text)) {
            context.report({ node: quasi, messageId: "handComposedCauseChain" });
            return;
          }
        }
      },
    };
  },
});
