# Formatting, modules, and data

Part of the `typescript-style` skill: `.agents/skills/typescript-style/SKILL.md`.

## Formatting the linter does not check

- Bodies do not begin or end with a blank line; one blank line separates methods and the constructor; blank lines inside a body only group statements.
- Multi-line comments are consecutive `//` lines, not `/* */` blocks; no boxes around comments.
- Strings use the special escapes (`\n`, `\t`, `\'`), not numeric ones; a printable non-ASCII character appears as itself (`'μs'`); only non-printables are escaped, with a comment; the only whitespace character is the ASCII space.
- No space after `...`; the star is attached in `function*` and `yield*`.
- No semicolon after a class declaration or method body; a statement containing a class expression keeps its semicolon.

## Files and modules

- File order: copyright JSDoc, `@fileoverview` JSDoc, imports, implementation -- each present section separated by exactly one blank line.
- File names are `kebab-case`: `atomic-json.ts`. *(project)*
- Same-project imports are relative and carry the `.ts` extension, because Node runs the sources directly; flag long `../` chains. *(project)*
- Import form matches usage: named imports for symbols used often or with clear names; a namespace import for many symbols from one large API or common names such as `defaultGit`; a rename only to avoid a collision, name a generated symbol, or clarify an unclear name.
- Default imports only for external code that offers nothing else; side-effect imports (`import 'x';`) only to load for side effects.
- Imports used only as types are marked `import type` (or inline `type`); type re-exports use `export type`.
- Exports are named. A default export is permitted only where a loader requires it of the entry point (Pi calls the default export of `extensions/pi-claude-marketplace/index.ts`); any other default export is a finding. *(project)*
- Every export is used outside its module. No `export let`; a getter function over a module-local binding. Conditionals run before `export const`.
- No class of static members as a namespace; constants and functions are exported directly. Code is namespaced with separate files, not `namespace` or `module {}`.

## Variables, literals, and data

- `const` unless reassigned, then `let`; never `var`; one variable per declaration.
- Arrays built with `[]`, objects with a literal; no non-numeric properties on an array.
- Spread only an iterable into an array and an object into an object; never a primitive, `null`, `undefined`, a class instance, or a function. `[...(show && line)]` is a finding.
- Destructuring defaults sit on the left-hand side; parameter destructuring stays one level of unquoted shorthand; an optional destructured object defaults to `{}`, an array to `[]`.
- No mixing of computed or quoted keys with unquoted keys unless the computed key is a symbol.
- No line continuations inside a string; number prefixes lowercase, no other leading zero.
- Coercion via `String(value)`, `Boolean(value)`, `!!value`, or a template literal; parsing via `Number(text)` checked with `Number.isNaN()`/`Number.isFinite()` unless failure is impossible; no unary `+`; `parseInt`/`parseFloat` only for a non-decimal radix after validating digits.
- No `!!value` inside an `if`/`for`/`while` condition; an enum value is never coerced to boolean -- it is compared (`level !== SupportLevel.NONE`).
