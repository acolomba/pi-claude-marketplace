// tests/lint-rules/msg-sd-2-soft-dep-predicate.test.js
//
// RuleTester companion for `msg-sd-2-soft-dep-predicate`. Asserts
// the rule fires on hand-composed BARE `requires pi-subagents` /
// `requires pi-mcp` predicate literals (no surrounding `{}`) outside
// the renderer. MSG-SD-1 owns the braced form; MSG-SD-2 owns the
// bare-predicate form -- the two rules avoid double-reporting via
// `containsBarePredicate`'s strip-braced logic (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-sd-2-soft-dep-predicate.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-sd-2-soft-dep-predicate", rule, {
  valid: [
    // Canonical: predicate is a boolean field on the row spec.
    {
      code: `const spec = { declaresAgents: true, declaresMcp: false };`,
    },
    // Braced form trips MSG-SD-1, not MSG-SD-2; bare-predicate stripper avoids overlap.
    {
      code: `const r = "{requires pi-subagents}";`,
    },
  ],
  invalid: [
    // Planted violation: bare predicate literal in a Literal.
    {
      code: `const r = "requires pi-subagents";`,
      errors: [{ messageId: "handComposedSoftDepPredicate" }],
    },
    // Planted violation: bare predicate in a TemplateLiteral quasi.
    {
      code: "const r = `note: requires pi-mcp here`;",
      errors: [{ messageId: "handComposedSoftDepPredicate" }],
    },
  ],
});
