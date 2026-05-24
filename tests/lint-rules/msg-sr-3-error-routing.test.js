// tests/lint-rules/msg-sr-3-error-routing.test.js
//
// RuleTester companion for `msg-sr-3-error-routing`. Asserts the
// rule fires on planted violations where a WARNING-class status
// token is routed through `notifySuccess` (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sr-3-error-routing.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sr-3-error-routing", rule, {
  valid: [
    // Canonical: WARNING-class token routed via notifyError.
    {
      code: `notifyError(ctx, "⊘ commit-commands (failed) {rollback partial}");`,
    },
    // Canonical: WARNING-class token routed via notifyWarning.
    {
      code: `notifyWarning(ctx, "⊘ agent index (manual recovery) {unreadable}");`,
    },
  ],
  invalid: [
    // Planted violation: WARNING-class (failed) routed through notifySuccess.
    {
      code: `notifySuccess(ctx, "⊘ commit-commands [user] (failed) {rollback partial}");`,
      errors: [{ messageId: "useNotifyWarningOrError" }],
    },
    // Planted violation: WARNING-class (manual recovery) routed through notifySuccess.
    {
      code: `notifySuccess(ctx, "⊘ agent index (manual recovery)");`,
      errors: [{ messageId: "useNotifyWarningOrError" }],
    },
  ],
});
