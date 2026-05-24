// tests/lint-rules/msg-cc-1-cause-chain.test.js
//
// RuleTester companion for `msg-cc-1-cause-chain`. Asserts the rule
// fires on hand-composed `cause:` / `Cause:` literals outside the
// canonical composers `causeChainTrailer` (shared/errors.ts) and
// `renderCauseChain` (presentation/cause-chain.ts), per SC #1 +
// SC #2.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-cc-1-cause-chain.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-cc-1-cause-chain", rule, {
  valid: [
    // Canonical: route through causeChainTrailer (no literal).
    {
      code: `const trailer = causeChainTrailer(err);`,
    },
    // Unrelated string is fine.
    {
      code: `const msg = "operation aborted";`,
    },
  ],
  invalid: [
    // Planted violation: hand-composed `cause:` prefix in a BinaryExpression.
    {
      code: `const trailer = "cause: " + err.message;`,
      errors: [{ messageId: "handComposedCauseChain" }],
    },
    // Planted violation: hand-composed `Cause:` prefix (case-insensitive) in a TemplateLiteral.
    {
      code: "const trailer = `Cause: ${err.message}`;",
      errors: [{ messageId: "handComposedCauseChain" }],
    },
  ],
});
