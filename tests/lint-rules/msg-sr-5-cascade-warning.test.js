// tests/lint-rules/msg-sr-5-cascade-warning.test.js
//
// RuleTester companion for `msg-sr-5-cascade-warning`. Asserts the
// rule fires on planted violations where a warning-tagged cascade
// summary is routed through `notifySuccess` (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sr-5-cascade-warning.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sr-5-cascade-warning", rule, {
  valid: [
    // Canonical: warning-tagged cascade routed via notifyWarning.
    {
      code: `notifyWarning(ctx, composeCascadeSummary(rows, "warning"));`,
    },
    // notifySuccess carrying a non-cascade success line is fine.
    {
      code: `notifySuccess(ctx, "● commit-commands (installed)");`,
    },
  ],
  invalid: [
    // Planted violation: composeCascadeSummary("warning") routed through notifySuccess.
    {
      code: `notifySuccess(ctx, composeCascadeSummary(rows, "warning"));`,
      errors: [{ messageId: "useNotifyWarningForCascadeWarning" }],
    },
    // Planted violation: identifier-name heuristic catches indirected helper.
    {
      code: `notifySuccess(ctx, warningSummary);`,
      errors: [{ messageId: "useNotifyWarningForCascadeWarning" }],
    },
  ],
});
