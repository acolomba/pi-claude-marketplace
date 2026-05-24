// tests/lint-rules/msg-gr-3-per-scope.test.js
//
// RuleTester companion for `msg-gr-3-per-scope`. The rule is a
// meta-assertion (D-14-09 LOCKED) -- its `create()` returns a no-op
// `Program: () => {}` visitor. The structural enforcement lives in
// the sort-key + renderer logic in `presentation/marketplace-list.ts`
// + parallel plugin-list renderer + `tests/architecture/catalog-uat.test.ts`.
//
// SMOKE-level test: asserts the rule loads, RuleTester wires under
// node:test (RESEARCH.md Pitfall 1), and valid code lints clean. No
// `invalid:` cases -- meta-assertion rules can't fail.

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
    // Smoke: any code is valid because the rule does no AST work.
    {
      code: "const _x = 1;",
    },
  ],
  invalid: [],
});
