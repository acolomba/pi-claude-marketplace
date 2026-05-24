// tests/lint-rules/msg-pl-4-upgradable-listonly.test.js
//
// RuleTester companion for `msg-pl-4-upgradable-listonly`. The rule is
// a meta-assertion (D-14-09 LOCKED) -- its `create()` returns a no-op
// `Program: () => {}` visitor. The structural enforcement lives in
// `PluginListRow.status` being the only `RowSpec` variant whose
// `Extract<StatusToken, ...>` constraint includes `"upgradable"`, plus
// a `@ts-expect-error` lock in `tests/presentation/compact-line.test.ts`.
//
// SMOKE-level test: asserts the rule loads, RuleTester wires under
// node:test (RESEARCH.md Pitfall 1), and valid code lints clean. No
// `invalid:` cases -- meta-assertion rules can't fail.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-pl-4-upgradable-listonly.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-pl-4-upgradable-listonly", rule, {
  valid: [
    // Smoke: any code is valid because the rule does no AST work.
    {
      code: "const _x = 1;",
    },
  ],
  invalid: [],
});
