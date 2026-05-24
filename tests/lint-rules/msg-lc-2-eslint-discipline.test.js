// tests/lint-rules/msg-lc-2-eslint-discipline.test.js
//
// RuleTester companion for `msg-lc-2-eslint-discipline`. Asserts the
// rule fires on any `eslint-disable*` comment that mentions
// `no-restricted-syntax` or `no-console`. Plan 06's `files:` scope
// excludes the single sanctioned `persistence/migrate.ts` callsite;
// under RuleTester the planted comment IS the violation regardless
// of file path (per SC #1 + SC #2).

import * as test from "node:test";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./msg-lc-2-eslint-discipline.js";

RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;

// `reportUnusedDisableDirectives: false` keeps ESLint from auto-flagging
// the planted `// eslint-disable-next-line ...` comments as "unused"
// (which would also apply a fix that strips the comment). The drift
// guard cares about the comment EXISTING, not about whether ESLint
// considers the directive active.
const ruleTester = new RuleTester({
  linterOptions: { reportUnusedDisableDirectives: false },
});

ruleTester.run("msg-lc-2-eslint-discipline", rule, {
  valid: [
    // Plain code without any disable comments is fine.
    {
      code: `const x = 1;`,
    },
    // A comment mentioning `no-console` but NOT as an eslint-disable
    // directive is fine (the rule discriminator requires both
    // `eslint-disable*` AND the rule name).
    {
      code: `// note: avoid no-console in this module\nconst x = 1;`,
    },
  ],
  invalid: [
    // Planted violation: extra eslint-disable touching no-restricted-syntax.
    {
      code: `// eslint-disable-next-line no-restricted-syntax\nconsole.log("hi");`,
      errors: [{ messageId: "extraEslintDisable" }],
    },
    // Planted violation: block-comment disable touching no-console.
    {
      code: `/* eslint-disable no-console */\nconsole.warn("hi");`,
      errors: [{ messageId: "extraEslintDisable" }],
    },
  ],
});
