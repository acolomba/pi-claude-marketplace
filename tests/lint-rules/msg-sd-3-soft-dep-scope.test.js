// tests/lint-rules/msg-sd-3-soft-dep-scope.test.js
//
// RuleTester companion for `msg-sd-3-soft-dep-scope`. The rule is a
// meta-assertion (D-14-09 LOCKED) -- its `create()` returns a no-op
// `Program: () => {}` visitor. The structural enforcement lives in
// `PluginInlineUninstalledRow` at `presentation/compact-line.ts:114-120`
// (no `declaresAgents` / `declaresMcp` fields) and in
// `tests/architecture/catalog-uat.test.ts` byte-equality.
//
// SMOKE-level test: asserts the rule loads, RuleTester wires under
// node:test (RESEARCH.md Pitfall 1), and valid code lints clean. No
// `invalid:` cases -- meta-assertion rules can't fail.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sd-3-soft-dep-scope.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sd-3-soft-dep-scope", rule, {
  valid: [
    // Smoke: any code is valid because the rule does no AST work.
    {
      code: "const _x = 1;",
    },
  ],
  invalid: [],
});
