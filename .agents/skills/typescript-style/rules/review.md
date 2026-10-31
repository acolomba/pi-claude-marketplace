# Reviewing

Part of the `typescript-style` skill: `.agents/skills/typescript-style/SKILL.md`.

## Gate on the toolchain first

Require passing type checking and lint at the scope defined in `.agents/skills/local-verification/SKILL.md`. Reuse the writer's or commit hook's valid evidence for the reviewed inputs; do not automatically repeat whole-project commands for an ordinary task review. A failure of either check is itself a finding; do not hand-review what the tools report. The toolchain gates: compilation, indentation, quotes, semicolons, trailing commas, brace placement and spacing, `case` indentation, line length, mandatory braces on control-flow bodies, `===` with the `== null` exception, dot notation, declare-before-use for variables (a function declaration may follow its caller), unused variables, `namespace`, `require()`, `@ts-ignore`, and bare `any`. Do not open findings for these when the gate is green.

Where a rule overlaps the linter, review the part the linter cannot judge: every `eslint-disable` directive names one rule, carries a `-- <reason>`, and the reason holds for that line.

## Quick scan

Grep the changed files for these tokens; every hit needs a stated justification or becomes a finding:

`var` · `export default` outside a loader-required entry point · `export let` · `public` · `#` private fields · `const enum` · `debugger` · `with` · `eval` / `new Function` · `new String` / `new Number` / `new Boolean` / `new Object` / `new Array` / `Array(` · `parseInt` / `parseFloat` · `@ts-ignore` / `@ts-nocheck` · `@ts-expect-error` outside a unit test · `arguments` · `.bind(` · `<Type>value` assertions · `Object.defineProperty` · prototype or global modification.
