// tests/lint-rules/msg-rh-1-reload-hint.test.js
//
// RuleTester companion for `msg-rh-1-reload-hint`. Asserts the rule
// fires on hand-composed `Run /reload` / `/reload to <verb>`
// literals outside the canonical composer
// `presentation/reload-hint.ts::reloadHint` (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-rh-1-reload-hint.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-rh-1-reload-hint", rule, {
  valid: [
    // Canonical: route through reloadHint (no literal).
    {
      code: `const trailer = reloadHint("refresh extensions");`,
    },
    // Plain unrelated string is fine.
    {
      code: `const msg = "operation succeeded";`,
    },
  ],
  invalid: [
    // Planted violation: hand-composed `Run /reload to <verb>` in a Literal.
    {
      code: `const trailer = "Run /reload to refresh extensions";`,
      errors: [{ messageId: "handComposedReloadHint" }],
    },
    // Planted violation: hand-composed `/reload` in a TemplateLiteral quasi.
    {
      code: "const trailer = `please /reload now`;",
      errors: [{ messageId: "handComposedReloadHint" }],
    },
  ],
});
