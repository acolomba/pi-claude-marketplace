// tests/lint-rules/msg-er-1-empty-token.test.js
//
// RuleTester companion for `msg-er-1-empty-token`. The rule is a
// meta-assertion (D-14-09 LOCKED) -- its `create()` returns a no-op
// `Program: () => {}` visitor. The structural enforcement lives in
// `EmptyToken.token: Extract<StatusToken, "no marketplaces" | "no plugins">`
// at `presentation/compact-line.ts:200-204` (the interface declares no
// icon/name/scope/reasons fields) and in
// `tests/architecture/catalog-uat.test.ts` byte-equality.
//
// SMOKE-level test: asserts the rule loads, RuleTester wires under
// node:test (RESEARCH.md Pitfall 1), and valid code lints clean. No
// `invalid:` cases -- meta-assertion rules can't fail.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-er-1-empty-token.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-er-1-empty-token", rule, {
  valid: [
    // Smoke: any code is valid because the rule does no AST work.
    {
      code: "const _x = 1;",
    },
  ],
  invalid: [],
});
