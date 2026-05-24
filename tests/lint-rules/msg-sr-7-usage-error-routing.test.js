// tests/lint-rules/msg-sr-7-usage-error-routing.test.js
//
// RuleTester companion for `msg-sr-7-usage-error-routing` -- the
// canonical FULL-IMPL worked example per RESEARCH.md Pattern 5.
// Two planted violations cover BinaryExpression `+` concatenation
// AND TemplateLiteral interpolation; both assert the messageId
// byte-exactly (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sr-7-usage-error-routing.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sr-7-usage-error-routing", rule, {
  valid: [
    // Canonical: notifyUsageError is the correct routing.
    {
      code: `notifyUsageError(ctx, "missing argument", "Usage: /claude:plugin install <plugin>");`,
    },
    // notifyError without USAGE is fine -- it is a non-usage error.
    {
      code: `notifyError(ctx, "unexpected failure");`,
    },
  ],
  invalid: [
    // Planted violation #1: notifyError + manual USAGE composition (BinaryExpression).
    {
      code: `const USAGE = "Usage: ..."; notifyError(ctx, msg + "\\n" + USAGE);`,
      errors: [{ messageId: "useNotifyUsageError" }],
    },
    // Planted violation #2: notifyError + USAGE via TemplateLiteral.
    {
      code: "const USAGE = 'Usage: ...'; notifyError(ctx, `${msg}\\n${USAGE}`);",
      errors: [{ messageId: "useNotifyUsageError" }],
    },
  ],
});
