// tests/lint-rules/msg-nc-2-usage-separator.test.js
//
// RuleTester companion for `msg-nc-2-usage-separator`. Asserts the
// rule fires on `notifyError(ctx, msg + "\n" + USAGE)` patterns
// (single newline separator instead of `\n\n`) per SC #1 + SC #2.
// Overlaps MSG-SR-7's detection -- both rules fire on the same
// callsite shape with different messageIds; Plan 06's per-rule
// `files:` scopes the overlap.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-nc-2-usage-separator.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-nc-2-usage-separator", rule, {
  valid: [
    // Canonical: notifyUsageError composes the \n\n separator atomically.
    {
      code: `notifyUsageError(ctx, "missing argument", "Usage: ...");`,
    },
    // notifyError without USAGE concatenation is fine.
    {
      code: `notifyError(ctx, "operation aborted");`,
    },
  ],
  invalid: [
    // Planted violation: BinaryExpression `msg + "\n" + USAGE` -- single newline.
    {
      code: `const USAGE = "Usage: ..."; notifyError(ctx, msg + "\\n" + USAGE);`,
      errors: [{ messageId: "missingBlankLineSeparator" }],
    },
    // Planted violation: TemplateLiteral with single-newline quasi adjacent to USAGE.
    {
      code: "const USAGE = 'Usage: ...'; notifyError(ctx, `${msg}\\n${USAGE}`);",
      errors: [{ messageId: "missingBlankLineSeparator" }],
    },
  ],
});
