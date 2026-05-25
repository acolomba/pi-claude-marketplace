// tests/lint-rules/msg-gr-3-per-scope.js
//
// MSG-GR-3 (docs/messaging-style-guide.md § 1): scope rendering is
// PER-SCOPE on every surface (marketplaces AND plugins). When a plugin
// is installed in both scopes it appears on two separate lines (one per
// scope). Row order is name-primary (case-insensitive `localeCompare`
// with `sensitivity: "base"`), scope-secondary (project before user) as
// a tie-breaker -- NOT a lexicographic compare of the full
// `<name> [<scope>]` label.
//
// Active enforcement (D-14-2-08 supersedes D-14-09 -- active AST class):
//
//   The canonical comparator `compareByNameThenScope` in
//   `extensions/pi-claude-marketplace/presentation/sort.ts` is the
//   single source of truth for project-first tie-break. Phase 14.2
//   (audit CR-01) surfaced three orchestrator drift sites that defined
//   local user-first `function scopeOrder` helpers, plus an iteration
//   literal `["user", "project"]` in `autoupdate.ts` whose stable-sort
//   ties produced user-first output. 14.2-01 cleaned the source; this
//   rule prevents the drift from returning.
//
//   This rule visits orchestrator AST and flags:
//
//   (a) `FunctionDeclaration` named `scopeOrder` whose body is the
//       structural pattern `return scope === "user" ? <low> : <high>`
//       (i.e. user-first numeric encoding) -- `userFirstScopeOrder`.
//
//   (b) two-element `ArrayExpression` of literal `"user"` then literal
//       `"project"` -- iteration order whose stable-sort ties yield
//       user-first output -- `userFirstScopeIteration`.
//
//   False-positive containment: the per-rule `files:` block in
//   `eslint.config.js` scopes detection to
//   `extensions/pi-claude-marketplace/orchestrators/**/*.ts`. The
//   canonical comparator in `presentation/sort.ts` is outside that
//   glob and cannot trip the rule.

import { ESLintUtils } from "@typescript-eslint/utils";

// The MSG-* rule names follow the `msg-<family>-<n>-<slug>` shape
// (e.g. `msg-gr-3-per-scope`). The messaging-style-guide.md anchors are
// family-level (`#msg-gr-3`), so strip the trailing slug before
// composing the docs URL. Anchor resolution still leaves rule-name
// drift undetected (a typo here will land on a non-existent anchor),
// but it's a strict improvement over the prior no-op
// `name.replace(/^msg-/, "msg-")` which produced `#msg-gr-3-per-scope`.
const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-([a-z]+-\d+).*$/, "msg-$1")}`,
);

/**
 * Detect the user-first `scopeOrder` body pattern:
 *   { return scope === "user" ? <lowerNumeric> : <higherNumeric>; }
 *
 * Only the canonical user-first encoding trips; any structural
 * deviation (more than one statement, non-conditional return, swapped
 * comparison side, non-numeric branches, equal or project-first
 * numerics) is treated as "not the drift pattern" and left alone.
 *
 * @param {import("estree").Node} body
 * @returns {boolean}
 */
function isUserFirstScopeOrder(body) {
  if (body.type !== "BlockStatement" || body.body.length !== 1) {
    return false;
  }

  const ret = body.body[0];
  if (ret.type !== "ReturnStatement" || ret.argument === null || ret.argument === undefined) {
    return false;
  }

  const cond = ret.argument;
  if (cond.type !== "ConditionalExpression") {
    return false;
  }

  const test = cond.test;
  if (
    test.type !== "BinaryExpression" ||
    test.operator !== "===" ||
    test.right.type !== "Literal" ||
    test.right.value !== "user"
  ) {
    return false;
  }

  const cons = cond.consequent;
  const alt = cond.alternate;
  if (cons.type !== "Literal" || alt.type !== "Literal") {
    return false;
  }

  return typeof cons.value === "number" && typeof alt.value === "number" && cons.value < alt.value;
}

export default createRule({
  name: "msg-gr-3-per-scope",
  meta: {
    type: "problem",
    docs: {
      description:
        'MSG-GR-3: per-scope rendering on every surface; one row per scope, name-primary then project-before-user as tie-breaker. Active AST lint check detecting (a) local user-first `function scopeOrder` helpers and (b) `["user", "project"]` iteration literals in orchestrator files. The canonical comparator is `compareByNameThenScope` in `presentation/sort.ts`; use it directly for sort, and iterate `["project", "user"]` when scope-iteration order affects user-visible ties.',
    },
    messages: {
      userFirstScopeOrder:
        "MSG-GR-3: local `scopeOrder` helper orders user-before-project; replace with `compareByNameThenScope` from presentation/sort.ts (project-first tie-break per docs/messaging-style-guide.md §1).",
      userFirstScopeIteration:
        'MSG-GR-3: `["user", "project"]` iteration in an orchestrator yields user-first stable-sort ties; flip to `["project", "user"]` so same-name cross-scope output matches the canonical project-first ordering (docs/messaging-style-guide.md §1).',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      // Pattern (a): local user-first comparator helper.
      //   function scopeOrder(scope: Scope): number {
      //     return scope === "user" ? 0 : 1;
      //   }
      FunctionDeclaration(node) {
        if (node.id?.name !== "scopeOrder") {
          return;
        }

        if (isUserFirstScopeOrder(node.body)) {
          context.report({ node, messageId: "userFirstScopeOrder" });
        }
      },
      // Pattern (b): ["user", "project"] iteration literal. The per-rule
      // `files:` block in eslint.config.js already scopes this visitor
      // to orchestrators/, so the canonical comparator in
      // presentation/sort.ts cannot trip.
      ArrayExpression(node) {
        if (node.elements.length !== 2) {
          return;
        }

        const [first, second] = node.elements;
        if (
          first?.type === "Literal" &&
          second?.type === "Literal" &&
          first.value === "user" &&
          second.value === "project"
        ) {
          context.report({ node, messageId: "userFirstScopeIteration" });
        }
      },
    };
  },
});
