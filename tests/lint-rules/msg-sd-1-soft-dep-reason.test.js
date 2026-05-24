// tests/lint-rules/msg-sd-1-soft-dep-reason.test.js
//
// RuleTester companion for `msg-sd-1-soft-dep-reason`. Asserts the
// rule fires on hand-composed `{requires pi-subagents}` / `{requires
// pi-mcp}` literals outside `presentation/compact-line.ts::composeReasons`
// (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sd-1-soft-dep-reason.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sd-1-soft-dep-reason", rule, {
  valid: [
    // Canonical: row spec carries declaresAgents / declaresMcp predicates.
    {
      code: `const spec = { kind: "plugin-list", name: "x", declaresAgents: true };`,
    },
    // Reason strings without the {requires pi-...} braced form are fine.
    {
      code: `const r = "{up-to-date}";`,
    },
  ],
  invalid: [
    // Planted violation: braced soft-dep reason in a Literal.
    {
      code: `const r = "{requires pi-subagents}";`,
      errors: [{ messageId: "handComposedSoftDepReason" }],
    },
    // Planted violation: braced soft-dep reason in a TemplateLiteral.
    {
      code: "const r = `prefix {requires pi-mcp} suffix`;",
      errors: [{ messageId: "handComposedSoftDepReason" }],
    },
  ],
});
