// tests/lint-rules/msg-lc-2-eslint-discipline.js
//
// MSG-LC-2 (docs/messaging-style-guide.md §14.1 -- IL-3 console.warn):
// the single sanctioned `eslint-disable-next-line` comment that
// mentions `no-restricted-syntax` and/or `no-console` lives at
// `persistence/migrate.ts` (the IL-3 callsite). Any OTHER
// `eslint-disable*` comment that mentions those rule names is a
// drift -- engineers MUST NOT silently re-introduce a console
// callsite by adding a fresh disable comment elsewhere.
//
// AST visitor: visits the program scope to access
// `sourceCode.getAllComments()`; flags every comment (line or block)
// whose normalised text contains both `eslint-disable` AND one of
// `no-restricted-syntax` / `no-console`. The single sanctioned
// callsite at `persistence/migrate.ts` is excluded via Plan 06's
// `ignores:` block.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const DISABLE_RE = /eslint-disable(?:-next-line|-line)?/;
const RULE_RE = /(no-restricted-syntax|no-console)/;

export default createRule({
  name: "msg-lc-2-eslint-discipline",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-LC-2: `eslint-disable*` comments touching `no-restricted-syntax` / `no-console` are forbidden outside the single sanctioned IL-3 callsite at `persistence/migrate.ts`. Re-introducing a console callsite by adding a fresh disable comment is a drift.",
    },
    messages: {
      extraEslintDisable:
        "MSG-LC-2: `eslint-disable*` comment touching `no-restricted-syntax` / `no-console` outside the sanctioned `persistence/migrate.ts` callsite. The single sanctioned disable comment is the IL-3 mechanism per docs/messaging-style-guide.md §14.1.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Program(node) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const comments = sourceCode.getAllComments();
        for (const comment of comments) {
          const text = comment.value;
          if (DISABLE_RE.test(text) && RULE_RE.test(text)) {
            context.report({ node: comment, messageId: "extraEslintDisable" });
          }
        }

        // Reference the Program node for ESLint visitor parity (silences
        // the "rule has no selectors" nag and gives a stable node for
        // any future per-program reporting).
        void node;
      },
    };
  },
});
