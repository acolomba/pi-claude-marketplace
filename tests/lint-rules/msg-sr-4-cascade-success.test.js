// tests/lint-rules/msg-sr-4-cascade-success.test.js
//
// RuleTester companion for `msg-sr-4-cascade-success`. Asserts the
// rule fires on planted violations where a success-tagged cascade
// summary is routed through `notifyWarning` (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sr-4-cascade-success.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sr-4-cascade-success", rule, {
  valid: [
    // Canonical: success-tagged cascade routed via notifySuccess.
    {
      code: `notifySuccess(ctx, composeCascadeSummary(rows, "success"));`,
    },
    // notifyWarning carrying a non-cascade message is fine.
    {
      code: `notifyWarning(ctx, "operation produced no rows");`,
    },
  ],
  invalid: [
    // Planted violation: composeCascadeSummary("success") routed through notifyWarning.
    {
      code: `notifyWarning(ctx, composeCascadeSummary(rows, "success"));`,
      errors: [{ messageId: "useNotifySuccessForCascadeSuccess" }],
    },
    // Planted violation: identifier-name heuristic catches indirected helper.
    {
      code: `notifyWarning(ctx, successSummary);`,
      errors: [{ messageId: "useNotifySuccessForCascadeSuccess" }],
    },
  ],
});
