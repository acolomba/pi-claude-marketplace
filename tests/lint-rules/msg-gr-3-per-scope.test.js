// tests/lint-rules/msg-gr-3-per-scope.test.js
//
// RuleTester companion for `msg-gr-3-per-scope`. Phase 14.2 (D-14-2-08
// supersedes D-14-09): the rule is now an ACTIVE two-axis AST check
// scoped (via `eslint.config.js`) to
// `extensions/pi-claude-marketplace/orchestrators/**/*.ts`. It detects:
//
//   (a) local user-first `function scopeOrder(scope) { return scope ===
//       "user" ? <low> : <high>; }` helpers -- a structural drift from
//       the canonical `compareByNameThenScope` (project-first
//       tie-break) in `presentation/sort.ts`. The audit CR-01 surfaced
//       three such helpers in `reinstall.ts` / `update.ts` /
//       `import/execute.ts` that 14.2-01 cleaned up.
//
//   (b) the iteration literal `["user", "project"]` -- when combined
//       with V8 stable sort on same-name ties this yields user-first
//       output, again contradicting the project-first contract. The
//       audit CR-01 corroborating drift in `autoupdate.ts:114` is the
//       canonical example.
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
    // Non-`scopeOrder`-named helpers are not the rule's target; only
    // the named structural drift is flagged.
    {
      code: 'function someOther(scope) { return scope === "user" ? 0 : 1; }',
    },
  ],
  invalid: [
    // Pattern (a): local user-first comparator helper.
    {
      code: `function scopeOrder(scope) { return scope === "user" ? 0 : 1; }`,
      errors: [{ messageId: "userFirstScopeOrder" }],
    },
    // Pattern (b): user-first iteration literal in orchestrator
    // contexts. The per-rule `files:` block in `eslint.config.js`
    // restricts detection to orchestrators/.
    {
      code: `const scopes = ["user", "project"];`,
      errors: [{ messageId: "userFirstScopeIteration" }],
    },
  ],
});
