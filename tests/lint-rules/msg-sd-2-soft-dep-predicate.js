// tests/lint-rules/msg-sd-2-soft-dep-predicate.js
//
// MSG-SD-2 (docs/messaging-style-guide.md §6 -- Soft-Dependency
// Markers): soft-dep emission is governed by per-row `declaresAgents`
// / `declaresMcp` boolean predicates on the row spec. The renderer's
// `composeReasons` consults these predicates to decide whether to
// emit `{requires pi-subagents}` / `{requires pi-mcp}`. Hand-composed
// strings containing the bare predicate label (e.g. `"requires
// pi-subagents"` without the surrounding `{}`) outside the renderer
// indicate an alternative emission path that bypasses the predicate
// check.
//
// AST visitor: visits string Literal nodes and TemplateLiteral
// quasis; flags any text matching `/requires pi-(?:subagents|mcp)/`
// that does NOT already trip MSG-SD-1 (i.e. the surrounding `{}` is
// absent). The renderer file is excluded via Plan 06's `ignores:`
// block.
//
// D-14-09 LOCKED: FULL-IMPL rule (RESEARCH.md Pattern 1).

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

const PREDICATE_RE = /requires pi-(?:subagents|mcp)/;
const BRACED_RE = /\{requires pi-(?:subagents|mcp)\}/;

function containsBarePredicate(text) {
  if (!PREDICATE_RE.test(text)) {
    return false;
  }

  // If every predicate occurrence is already braced (MSG-SD-1's scope),
  // do not double-report here; MSG-SD-2 is the bare-predicate detector.
  const stripped = text.replace(new RegExp(BRACED_RE.source, "g"), "");
  return PREDICATE_RE.test(stripped);
}

export default createRule({
  name: "msg-sd-2-soft-dep-predicate",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-SD-2: soft-dep emission is gated by per-row `declaresAgents` / `declaresMcp` predicates in `composeReasons`. Hand-composed bare-predicate `requires pi-subagents` / `requires pi-mcp` literals outside the renderer indicate an emission path that bypasses the predicate.",
    },
    messages: {
      handComposedSoftDepPredicate:
        "MSG-SD-2: hand-composed bare `requires pi-subagents` / `requires pi-mcp` predicate literal detected; route via the row spec's `declaresAgents` / `declaresMcp` predicate consumed by `composeReasons` per docs/messaging-style-guide.md §6.",
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

        if (containsBarePredicate(node.value)) {
          context.report({ node, messageId: "handComposedSoftDepPredicate" });
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          const text = quasi.value.cooked ?? quasi.value.raw ?? "";
          if (containsBarePredicate(text)) {
            context.report({ node: quasi, messageId: "handComposedSoftDepPredicate" });
            return;
          }
        }
      },
    };
  },
});
