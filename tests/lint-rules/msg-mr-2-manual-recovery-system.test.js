// tests/lint-rules/msg-mr-2-manual-recovery-system.test.js
//
// RuleTester companion for `msg-mr-2-manual-recovery-system`.
// Asserts the rule fires on planted ManualRecoveryLine literals
// whose resource slot contains `@` or `[` (per SC #1 + SC #2).
// System-level manual-recovery lines live in the name slot ONLY.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-mr-2-manual-recovery-system.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-mr-2-manual-recovery-system", rule, {
  valid: [
    // Canonical: system-level resource without @ or [.
    {
      code: `const line = { kind: "manual-recovery", resource: "agent index", reasons: ["unreadable"] };`,
    },
    // Non-manual-recovery object with @ in a resource-ish field is fine.
    {
      code: `const line = { kind: "plugin-cascade", resource: "name@mp" };`,
    },
  ],
  invalid: [
    // Planted violation: resource contains @<marketplace>.
    {
      code: `const line = { kind: "manual-recovery", resource: "name@mp", reasons: [] };`,
      errors: [{ messageId: "manualRecoverySystemHasMarketplace" }],
    },
    // Planted violation: resource contains [<scope>].
    {
      code: `const line = { kind: "manual-recovery", resource: "agent index [user]", reasons: [] };`,
      errors: [{ messageId: "manualRecoverySystemHasMarketplace" }],
    },
  ],
});
