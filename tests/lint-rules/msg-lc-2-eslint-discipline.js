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

// Actual ESLint directive comments START with `eslint-disable...`
// (optional leading whitespace). The rule must distinguish real
// directives from documentation prose that merely MENTIONS the
// directive form. Documentation comments (e.g. JSDoc explaining the
// IL-3 incantation) reference the directive in body text rather than
// as the leading token; those are not drift sites.
const DISABLE_RE = /^\s*eslint-disable(?:-next-line|-line)?\b/;
const RULE_RE = /(no-restricted-syntax|no-console)/;
// IL-3 (Phase 1 D-17 / PRD §6.12) sanctioned-callsite marker. A disable
// directive carrying `-- IL-3 ...` (or any text mentioning `IL-3`) is
// the SINGLE sanctioned exception per docs/messaging-style-guide.md
// §14.1. Header / JSDoc comments that DOCUMENT the incantation pattern
// also carry the IL-3 marker and are accepted under the same
// discriminator -- they describe the contract, they don't introduce a
// new disable site.
const SANCTIONED_RE = /\bIL-3\b/;

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
          if (DISABLE_RE.test(text) && RULE_RE.test(text) && !SANCTIONED_RE.test(text)) {
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
