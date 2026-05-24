// tests/lint-rules/msg-sr-2-warning-routing.test.js
//
// RuleTester companion for `msg-sr-2-warning-routing`. Asserts the
// rule fires on planted violations where an INFO-class status token
// is routed through `notifyWarning` / `notifyError` (per SC #1 +
// SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sr-2-warning-routing.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sr-2-warning-routing", rule, {
  valid: [
    // Canonical: INFO-class token routed via notifySuccess per §10.
    {
      code: `notifySuccess(ctx, "● commit-commands [user] (skipped) {up-to-date}");`,
    },
    // notifyError carrying no status token at all is fine for MSG-SR-2.
    {
      code: `notifyError(ctx, "operation aborted by user");`,
    },
  ],
  invalid: [
    // Planted violation: INFO-class (skipped) routed through notifyError.
    {
      code: `notifyError(ctx, "● commit-commands [user] (skipped) {up-to-date}");`,
      errors: [{ messageId: "useNotifyInfoOrSuccess" }],
    },
    // Planted violation: INFO-class (no marketplaces) routed through notifyWarning.
    {
      code: `notifyWarning(ctx, "(no marketplaces)");`,
      errors: [{ messageId: "useNotifyInfoOrSuccess" }],
    },
  ],
});
