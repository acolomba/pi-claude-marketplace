// tests/lint-rules/msg-rp-1-rollback-partial.test.js
//
// RuleTester companion for `msg-rp-1-rollback-partial`. Asserts the
// rule fires on hand-composed `(failed) {rollback partial}` literals
// outside the canonical composer (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-rp-1-rollback-partial.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-rp-1-rollback-partial", rule, {
  valid: [
    // Canonical: row spec routes through renderRollbackPartial (no literal).
    {
      code: `const spec = { kind: "plugin-cascade", status: "failed", reasons: ["rollback partial"] };`,
    },
    // Other failure messages are fine.
    {
      code: `const body = "(failed) {not found}";`,
    },
  ],
  invalid: [
    // Planted violation: hand-composed parent literal in a Literal.
    {
      code: `const body = "(failed) {rollback partial}";`,
      errors: [{ messageId: "handComposedRollbackPartial" }],
    },
    // Planted violation: hand-composed parent literal in a TemplateLiteral.
    {
      code: "const body = `prefix (failed) {rollback partial} suffix`;",
      errors: [{ messageId: "handComposedRollbackPartial" }],
    },
  ],
});
