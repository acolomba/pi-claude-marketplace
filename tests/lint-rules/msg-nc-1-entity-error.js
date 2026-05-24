// tests/lint-rules/msg-nc-1-entity-error.js
//
// MSG-NC-1 (docs/messaging-style-guide.md §12 -- Non-Cascade Errors):
// entity-shaped non-cascade error lines (e.g. `⊘ name@marketplace
// [scope] (failed) {reason}`) are emitted via the `EntityErrorRow`
// variant of `RowSpec` through `presentation/compact-line.ts`'s
// `renderRow`. Hand-composed entity-error strings outside the
// renderer drift the icon spacing, the `@<marketplace>` token, or the
// scope-bracket form.
//
// AST visitor: visits string Literal nodes and TemplateLiteral
// quasis; flags any text matching the entity-error icon + name + `@`
// pattern `/(?:⊘|●|○)\s+\S+@/`. The icons are the three Phase 12
// status icons (`⊘` blocked, `●` filled, `○` open) per §2; the `@`
// requires a marketplace anchor, which is the entity-shape
// discriminator. The renderer file is excluded via Plan 06's
// `ignores:` block.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const ENTITY_ERROR_RE = /[⊘●○]\s+\S+@/;

export default createRule({
  name: "msg-nc-1-entity-error",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-NC-1: entity-shaped non-cascade errors render via the `EntityErrorRow` variant of `RowSpec` through `presentation/compact-line.ts`'s `renderRow`. Hand-composed `<icon> <name>@<marketplace>` literals outside the renderer are forbidden.",
    },
    messages: {
      handComposedEntityError:
        "MSG-NC-1: hand-composed entity-error compact line (`<icon> <name>@<marketplace>`) detected; route through `renderRow` with an `EntityErrorRow` spec per docs/messaging-style-guide.md §12.",
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

        if (ENTITY_ERROR_RE.test(node.value)) {
          context.report({ node, messageId: "handComposedEntityError" });
        }
      },
      TemplateLiteral(node) {
        const text = node.quasis.map((q) => q.value.cooked ?? q.value.raw ?? "").join("");
        if (ENTITY_ERROR_RE.test(text)) {
          context.report({ node, messageId: "handComposedEntityError" });
        }
      },
    };
  },
});
