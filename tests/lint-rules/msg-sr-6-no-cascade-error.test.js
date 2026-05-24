// tests/lint-rules/msg-sr-6-no-cascade-error.test.js
//
// RuleTester companion for `msg-sr-6-no-cascade-error`. Asserts the
// rule fires on planted violations where any cascade-summary is
// routed through `notifyError` (per SC #1 + SC #2). Cascade summaries
// route success → notifySuccess, warning → notifyWarning -- never
// notifyError.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sr-6-no-cascade-error.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sr-6-no-cascade-error", rule, {
  valid: [
    // Canonical: cascade summary routed via notifySuccess.
    {
      code: `notifySuccess(ctx, composeCascadeSummary(rows, "success"));`,
    },
    // Canonical: cascade summary routed via notifyWarning.
    {
      code: `notifyWarning(ctx, composeCascadeSummary(rows, "warning"));`,
    },
    // notifyError with a non-cascade message is fine.
    {
      code: `notifyError(ctx, "operation aborted");`,
    },
  ],
  invalid: [
    // Planted violation: composeCascadeSummary routed through notifyError.
    {
      code: `notifyError(ctx, composeCascadeSummary(rows, "success"));`,
      errors: [{ messageId: "noNotifyErrorForCascade" }],
    },
    // Planted violation: identifier-name heuristic catches indirected cascade.
    {
      code: `notifyError(ctx, cascadeSummary);`,
      errors: [{ messageId: "noNotifyErrorForCascade" }],
    },
  ],
});
