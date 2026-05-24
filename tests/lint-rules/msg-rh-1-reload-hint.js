// tests/lint-rules/msg-rh-1-reload-hint.js
//
// MSG-RH-1 (docs/messaging-style-guide.md §5 -- Reload Hint): the
// `Run /reload to <verb> <subject>` trailer is composed via
// `presentation/reload-hint.ts::reloadHint`. Hand-composed `Run
// /reload` or `/reload to <verb>` literal strings outside the
// canonical composer drift the wording, the verb agreement, and the
// trailing-blank-line treatment.
//
// AST visitor: visits string Literal nodes and TemplateLiteral
// quasis; flags any text matching `/\/reload(?:\s+to\b)?/` -- the
// `/reload` slash command optionally followed by ` to `. The
// composer file `presentation/reload-hint.ts` is excluded via Plan
// 06's `ignores:` block.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const RELOAD_HINT_RE = /\/reload(?:\s+to\b)?/;

export default createRule({
  name: "msg-rh-1-reload-hint",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-RH-1: reload-hint trailer is composed via `presentation/reload-hint.ts::reloadHint`. Hand-composed `Run /reload` or `/reload to <verb>` literals outside the composer are forbidden.",
    },
    messages: {
      handComposedReloadHint:
        "MSG-RH-1: hand-composed reload-hint literal detected; route through `reloadHint` (presentation/reload-hint.ts) per docs/messaging-style-guide.md §5.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    // Skip import/export source strings -- `presentation/reload-hint.ts`
    // path segments match `/reload` substring but are NEVER user-visible
    // strings. The rule targets emitted message literals, not module
    // specifiers.
    function isModuleSpecifier(node) {
      const p = node.parent;
      if (p === undefined || p === null) {
        return false;
      }

      const t = p.type;
      return (
        t === "ImportDeclaration" ||
        t === "ExportNamedDeclaration" ||
        t === "ExportAllDeclaration" ||
        t === "ImportExpression"
      );
    }

    return {
      Literal(node) {
        if (typeof node.value !== "string") {
          return;
        }

        if (isModuleSpecifier(node)) {
          return;
        }

        if (RELOAD_HINT_RE.test(node.value)) {
          context.report({ node, messageId: "handComposedReloadHint" });
        }
      },
      TemplateLiteral(node) {
        if (isModuleSpecifier(node)) {
          return;
        }

        for (const quasi of node.quasis) {
          const text = quasi.value.cooked ?? quasi.value.raw ?? "";
          if (RELOAD_HINT_RE.test(text)) {
            context.report({ node: quasi, messageId: "handComposedReloadHint" });
            return;
          }
        }
      },
    };
  },
});
