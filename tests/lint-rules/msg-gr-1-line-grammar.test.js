// tests/lint-rules/msg-gr-1-line-grammar.test.js
//
// RuleTester companion for `msg-gr-1-line-grammar`. The rule is a
// meta-assertion (D-14-09 LOCKED) -- its `create()` returns a no-op
// `Program: () => {}` visitor that does no AST work. The structural
// enforcement lives in `presentation/compact-line.ts` (RowSpec union +
// renderRow) and in `tests/architecture/catalog-uat.test.ts`
// byte-equality.
//
// This SMOKE-level test asserts that the rule loads, RuleTester wires
// correctly under node:test (RESEARCH.md Pitfall 1: the 4-line shim is
// REQUIRED), and that valid code lints clean. There are NO `invalid:`
// cases -- meta-assertion rules can't fail.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-gr-1-line-grammar.js";

// RESEARCH.md Pitfall 1: RuleTester defaults to Mocha-style globals;
// under `node --test` these are not globals. The 4-line shim binds the
// test runner per-file.
RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-gr-1-line-grammar", rule, {
  valid: [
    // Smoke: any code is valid because the rule does no AST work.
    {
      code: "const _x = 1;",
    },
  ],
  invalid: [],
});
