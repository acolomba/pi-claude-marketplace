// tests/lint-rules/msg-lc-1-console-warn-form.test.js
//
// RuleTester companion for `msg-lc-1-console-warn-form`. Asserts the
// rule fires on ANY `console.warn` callsite. Plan 06's `files:`
// scope narrows the rule to the extension surface with the single
// sanctioned `persistence/migrate.ts` callsite excluded; under
// RuleTester the planted code IS the violation regardless of file
// path (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-lc-1-console-warn-form.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-lc-1-console-warn-form", rule, {
  valid: [
    // Canonical: route through the four ctx.ui.notify wrappers.
    {
      code: `notifyWarning(ctx, "(failed) {not found}");`,
    },
    // console.log / console.error are not in scope for MSG-LC-1.
    {
      code: `console.log("debug output");`,
    },
  ],
  invalid: [
    // Planted violation: bare console.warn.
    {
      code: `console.warn("some warning");`,
      errors: [{ messageId: "extraConsoleWarn" }],
    },
    // Planted violation: console.warn with multiple args.
    {
      code: `console.warn("legacy save failed", err);`,
      errors: [{ messageId: "extraConsoleWarn" }],
    },
  ],
});
