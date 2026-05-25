// tests/lint-rules/msg-gr-3-per-scope.test.js
//
// RuleTester companion for `msg-gr-3-per-scope`. Phase 14.2 (D-14-2-08
// supersedes D-14-09): the rule is an ACTIVE two-axis AST check scoped
// (via `eslint.config.js`) to
// `extensions/pi-claude-marketplace/orchestrators/**/*.ts` AND
// `extensions/pi-claude-marketplace/edge/handlers/**/*.ts` (the latter
// added in Phase 14.2-fix CR-01). It detects:
//
//   (a) ANY function (declaration, expression, or arrow) whose body
//       returns `<lhs> === "user" ? <low> : <high>` -- a structural
//       drift from the canonical `compareByNameThenScope`
//       (project-first tie-break) in `presentation/sort.ts`. The audit
//       CR-01 surfaced three such helpers in `reinstall.ts` /
//       `update.ts` / `import/execute.ts` that 14.2-01 cleaned up.
//       Phase 14.2-fix WR-06 widened detection from
//       `FunctionDeclaration`-named-`scopeOrder` only to ANY function
//       form / ANY name -- the user-first numeric encoding is the
//       smell, not the function name.
//
//   (b) the iteration literal `["user", "project"]` -- when combined
//       with V8 stable sort on same-name ties this yields user-first
//       output, again contradicting the project-first contract. The
//       audit CR-01 corroborating drift in `autoupdate.ts:114` was the
//       canonical orchestrator example; Phase 14.2-fix CR-01 surfaced
//       a sibling in `edge/handlers/plugin/import.ts:45`.
//
// MSG-SD-2 is the FULL-IMPL analog template (active-class rule under
// the `tests/lint-rules/` plugin).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-gr-3-per-scope.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-gr-3-per-scope", rule, {
  valid: [
    // Smoke: trivial code lints clean.
    {
      code: "const _x = 1;",
    },
    // Canonical iteration order (project-first per MSG-GR-3) is
    // explicitly allowed; only the inverse literal trips the rule.
    {
      code: 'const scopes = ["project", "user"];',
    },
    // Bodies that do NOT match the user-first numeric encoding lint
    // clean regardless of function shape -- structural deviations
    // (inverted comparator, project-first numerics, non-numeric
    // branches, multi-statement bodies) all slip through by design
    // (see `isUserFirstScopeOrderBody` JSDoc).
    {
      code: 'function inverted(scope) { return scope === "project" ? 0 : 1; }',
    },
    {
      code: 'const projectFirst = (s) => s === "user" ? 1 : 0;',
    },
  ],
  invalid: [
    // Pattern (a.1): canonical historical drift -- FunctionDeclaration
    // named `scopeOrder` with the user-first numeric encoding. This
    // case is the one the original (pre-WR-06) rule shape caught.
    {
      code: `function scopeOrder(scope) { return scope === "user" ? 0 : 1; }`,
      errors: [{ messageId: "userFirstScopeOrder" }],
    },
    // Pattern (a.2) -- Phase 14.2-fix WR-06: renamed FunctionDeclaration.
    // The pre-WR-06 rule shape would have MISSED this (it only fired
    // on the literal name `scopeOrder`). Now flagged because the
    // user-first numeric encoding is the smell, not the name.
    {
      code: `function scopeRank(scope) { return scope === "user" ? 0 : 1; }`,
      errors: [{ messageId: "userFirstScopeOrder" }],
    },
    // Pattern (a.3) -- Phase 14.2-fix WR-06: arrow function with
    // expression body (no BlockStatement). The pre-WR-06 rule shape
    // would have MISSED this entirely (no visitor for
    // `ArrowFunctionExpression`). Now flagged.
    {
      code: `const cmp = (s) => s === "user" ? 0 : 1;`,
      errors: [{ messageId: "userFirstScopeOrder" }],
    },
    // Pattern (a.4) -- Phase 14.2-fix WR-06: arrow function with
    // block body returning the user-first conditional. Also missed
    // pre-WR-06.
    {
      code: `const cmp = (s) => { return s === "user" ? 0 : 1; };`,
      errors: [{ messageId: "userFirstScopeOrder" }],
    },
    // Pattern (a.5) -- Phase 14.2-fix WR-06: assigned function
    // expression with the user-first body. Also missed pre-WR-06.
    {
      code: `const cmp = function (s) { return s === "user" ? 0 : 1; };`,
      errors: [{ messageId: "userFirstScopeOrder" }],
    },
    // Pattern (b): user-first iteration literal in orchestrator/edge
    // contexts. The per-rule `files:` block in `eslint.config.js`
    // restricts detection to orchestrators/ and edge/handlers/.
    {
      code: `const scopes = ["user", "project"];`,
      errors: [{ messageId: "userFirstScopeIteration" }],
    },
  ],
});
