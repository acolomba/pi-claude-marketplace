// tests/lint-rules/msg-sr-1-success-routing.test.js
//
// RuleTester companion for `msg-sr-1-success-routing`. Asserts the
// rule fires on planted violations (SC #1 -- "intentional planted
// violation makes npm run check fail with a clear, locatable error")
// and that the messageId is asserted byte-exactly (SC #2 -- "failure
// includes MSG-* rule ID"). Invalid cases plant a SUCCESS-class
// status token inside a `notifyWarning` / `notifyError` callsite.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sr-1-success-routing.js";

// RESEARCH.md Pitfall 1: 4-line shim binds RuleTester to node:test.
RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sr-1-success-routing", rule, {
  valid: [
    // Canonical: SUCCESS-class token routed via notifySuccess.
    {
      code: `notifySuccess(ctx, "● commit-commands [user] (installed)");`,
    },
    // notifyWarning carrying a WARNING-class token is fine for MSG-SR-1.
    {
      code: `notifyWarning(ctx, "⊘ commit-commands (failed) {not found}");`,
    },
  ],
  invalid: [
    // Planted violation: SUCCESS-class (installed) routed through notifyWarning.
    {
      code: `notifyWarning(ctx, "● commit-commands [user] (installed)");`,
      errors: [{ messageId: "useNotifySuccess" }],
    },
    // Planted violation: SUCCESS-class (added) routed through notifyError.
    {
      code: `notifyError(ctx, "● claude-plugins-official [user] (added)");`,
      errors: [{ messageId: "useNotifySuccess" }],
    },
  ],
});
