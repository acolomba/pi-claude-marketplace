// tests/lint-rules/msg-nc-1-entity-error.test.js
//
// RuleTester companion for `msg-nc-1-entity-error`. Asserts the
// rule fires on hand-composed entity-error compact lines (icon +
// `name@marketplace`) outside the renderer (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-nc-1-entity-error.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

const ruleTester = new RuleTester();

ruleTester.run("msg-nc-1-entity-error", rule, {
  valid: [
    // Canonical: route through renderRow with an EntityErrorRow spec.
    {
      code: `const spec = { kind: "entity-error", name: "unknown", marketplace: "mp" };`,
    },
    // Unrelated message without the icon+name@ pattern is fine.
    {
      code: `const msg = "operation succeeded";`,
    },
  ],
  invalid: [
    // Planted violation: hand-composed compact-line literal with blocked icon.
    {
      code: `const line = "⊘ unknown@claude-plugins-official [user] (failed) {not found}";`,
      errors: [{ messageId: "handComposedEntityError" }],
    },
    // Planted violation: hand-composed open-icon entity error in a TemplateLiteral.
    {
      code: "const line = `○ serena@official ${suffix}`;",
      errors: [{ messageId: "handComposedEntityError" }],
    },
  ],
});
