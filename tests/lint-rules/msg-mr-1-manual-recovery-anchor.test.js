// tests/lint-rules/msg-mr-1-manual-recovery-anchor.test.js
//
// RuleTester companion for `msg-mr-1-manual-recovery-anchor`.
// Asserts the rule fires on the legacy `MANUAL RECOVERY REQUIRED:`
// sentence prefix (per SC #1 + SC #2). The canonical composer
// `presentation/manual-recovery.ts::renderManualRecovery` IS the
// emission path.

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-mr-1-manual-recovery-anchor.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-mr-1-manual-recovery-anchor", rule, {
  valid: [
    // Canonical: ManualRecoveryLine row spec (no legacy prefix).
    {
      code: `const line = { kind: "manual-recovery", resource: "agent index", reasons: ["unreadable"] };`,
    },
    // Plain text without the legacy prefix is fine.
    {
      code: `const msg = "operation succeeded";`,
    },
  ],
  invalid: [
    // Planted violation: legacy MANUAL RECOVERY REQUIRED: prefix in a Literal.
    {
      code: `const msg = "MANUAL RECOVERY REQUIRED: /home/user/.pi/state.json";`,
      errors: [{ messageId: "legacyManualRecoveryPrefix" }],
    },
    // Planted violation: legacy prefix in a TemplateLiteral quasi.
    {
      code: "const msg = `MANUAL RECOVERY REQUIRED: ${path}`;",
      errors: [{ messageId: "legacyManualRecoveryPrefix" }],
    },
  ],
});
