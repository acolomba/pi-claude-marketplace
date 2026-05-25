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
//   This rule visits orchestrator + edge-handler AST and flags:
//
//   (a) ANY function (declaration, expression, or arrow) whose body
//       (block-with-single-return OR arrow-expression) returns the
//       structural pattern `<lhs> === "user" ? <low> : <high>` (i.e.
//       user-first numeric encoding) -- `userFirstScopeOrder`. The
//       function NAME is incidental (`scopeOrder`, `scopeRank`,
//       `compareScope`, etc. all trip equivalently); the user-first
//       numeric encoding is the smell. Widened in Phase 14.2-fix
//       WR-06 from the historical `FunctionDeclaration`-named-
//       `scopeOrder`-only shape.
//
//   (b) two-element `ArrayExpression` of literal `"user"` then literal
//       `"project"` -- iteration order whose stable-sort ties yield
//       user-first output -- `userFirstScopeIteration`.
//
//   False-positive containment: the per-rule `files:` block in
//   `eslint.config.js` scopes detection to
//   `extensions/pi-claude-marketplace/orchestrators/**/*.ts` AND
//   `extensions/pi-claude-marketplace/edge/handlers/**/*.ts` (the
//   latter added in Phase 14.2-fix CR-01). The canonical comparator
//   in `presentation/sort.ts` is outside both globs and cannot trip
//   the rule.

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
 * Detect the user-first scope-order body pattern (regardless of the
 * containing function's name or syntactic form):
 *
 *   { return scope === "user" ? <lowerNumeric> : <higherNumeric>; }
 *
 * The widened detection (Phase 14.2-fix WR-06) treats the user-first
 * numeric encoding as the actual smell -- the function NAME (`scopeOrder`,
 * `scopeRank`, `compareScope`, ...) is incidental. Visitors fire on
 * `FunctionDeclaration`, `FunctionExpression`, and
 * `ArrowFunctionExpression`. Arrow functions may have either an
 * expression body (`(s) => s === "user" ? 0 : 1`) or a block body
 * (`(s) => { return s === "user" ? 0 : 1; }`) -- this helper accepts
 * either.
 *
 * Intentional limits (still NOT detected; document for future
 * maintainers):
 *   - Multi-statement bodies (`const u = "user"; return s === u ? 0 : 1`)
 *   - Inverted comparator (`return s === "project" ? 1 : 0`)
 *   - Symbol on the RHS (`return s === USER ? 0 : 1`)
 *   - Comparison subject other than the parameter (`scope === "user"`
 *     literal matching is by RHS-literal; LHS identifier is ignored)
 *
 * These all slip through because the rule is a structural quick-check,
 * not full semantic analysis. The canonical defense is the
 * `compareByNameThenScope` comparator in `presentation/sort.ts`;
 * the rule exists to deter the most-likely drift shapes, not to
 * enforce semantic equivalence.
 *
 * @param {import("estree").Node} body -- function body (block or expression)
 * @returns {boolean}
 */
function isUserFirstScopeOrderBody(body) {
  // Accept either an arrow-function expression body or a single-return
  // block body. Anything else is treated as "not the drift pattern".
  let returned;
  if (body.type === "BlockStatement") {
    if (body.body.length !== 1) {
      return false;
    }

    const ret = body.body[0];
    if (ret.type !== "ReturnStatement" || ret.argument === null || ret.argument === undefined) {
      return false;
    }

    returned = ret.argument;
  } else {
    // Arrow expression body -- the expression IS the returned value.
    returned = body;
  }

  if (returned.type !== "ConditionalExpression") {
    return false;
  }

  const test = returned.test;
  if (
    test.type !== "BinaryExpression" ||
    test.operator !== "===" ||
    test.right.type !== "Literal" ||
    test.right.value !== "user"
  ) {
    return false;
  }

  const cons = returned.consequent;
  const alt = returned.alternate;
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
        'MSG-GR-3: per-scope rendering on every surface; one row per scope, name-primary then project-before-user as tie-breaker. Active AST lint check detecting (a) any local function (declaration, expression, or arrow) whose body returns the user-first numeric encoding `scope === "user" ? <low> : <high>` and (b) `["user", "project"]` iteration literals. The canonical comparator is `compareByNameThenScope` in `presentation/sort.ts`; use it directly for sort, and iterate `["project", "user"]` when scope-iteration order affects user-visible ties.',
    },
    messages: {
      userFirstScopeOrder:
        'MSG-GR-3: function body returns the user-first numeric encoding (`scope === "user" ? <low> : <high>`); replace with `compareByNameThenScope` from presentation/sort.ts (project-first tie-break per docs/messaging-style-guide.md §1).',
      userFirstScopeIteration:
        'MSG-GR-3: `["user", "project"]` iteration in an orchestrator or edge handler yields user-first stable-sort ties; flip to `["project", "user"]` so same-name cross-scope output matches the canonical project-first ordering (docs/messaging-style-guide.md §1).',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    // Phase 14.2-fix WR-06: widened from `FunctionDeclaration` only to
    // also cover `FunctionExpression` and `ArrowFunctionExpression`,
    // and the rule no longer requires the function to be named
    // `scopeOrder`. The user-first numeric encoding (returning a lower
    // number on `scope === "user"`) is the smell regardless of the
    // enclosing function's name or syntactic form. See
    // `isUserFirstScopeOrderBody` JSDoc for the intentional limits
    // (multi-statement bodies, inverted comparators, RHS-symbol
    // comparisons, etc. still slip through -- canonical defense is
    // `compareByNameThenScope` in `presentation/sort.ts`).
    function checkFunctionBody(node) {
      if (isUserFirstScopeOrderBody(node.body)) {
        context.report({ node, messageId: "userFirstScopeOrder" });
      }
    }

    return {
      // Pattern (a): local user-first comparator helper, in any
      // function form. Matches:
      //   function scopeOrder(s) { return s === "user" ? 0 : 1; }
      //   function scopeRank(s)  { return s === "user" ? 0 : 1; }   // renamed
      //   const f = function (s) { return s === "user" ? 0 : 1; };  // expression
      //   const g = (s) => s === "user" ? 0 : 1;                    // arrow-expr body
      //   const h = (s) => { return s === "user" ? 0 : 1; };        // arrow-block body
      FunctionDeclaration: checkFunctionBody,
      FunctionExpression: checkFunctionBody,
      ArrowFunctionExpression: checkFunctionBody,
      // Pattern (b): ["user", "project"] iteration literal. The per-rule
      // `files:` block in eslint.config.js already scopes this visitor
      // to orchestrators/ and edge/handlers/ (the latter added by
      // Phase 14.2-fix CR-01), so the canonical comparator in
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
