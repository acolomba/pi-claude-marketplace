# Functions, control flow, and errors

Part of the `typescript-style` skill: `.agents/skills/typescript-style/SKILL.md`.

## Functions

- A named function is a function declaration; an arrow assigned to `const` only for an explicit function type or a nested function needing the outer `this`. No `function` expressions except a generator or a deliberate `this` rebinder.
- Concise arrow body only when the return value is used; a discarded value gets a block body or `void`.
- `this` only in constructors, methods, functions with a `this:` parameter, and arrows inside those; never for the global object or an event target.
- Callbacks are arrows forwarding their arguments explicitly (`.map((text) => Number(text))`) unless both signatures are stable; no named function with optional parameters passed to a higher-order function.
- Default initializers have no side effects and no shared mutable value; several optional parameters without a natural order become a destructured options object.
- Rest parameter, never `arguments`; spread, never `apply`; no `bind`/`call`/`apply` where an arrow or an explicit parameter works.
- Parentheses around a single arrow parameter: `(record) => record.name`.

## Control flow

- Arrays iterate with `for (const x of xs)`; an index loop or `entries()` only when the index is needed; never `for-in` on an array; `for-in` on a dictionary object only with a `hasOwnProperty` guard; `for-of` preferred over `Object.keys()`/`values()`/`entries()`.
- No assignment inside a condition unless wrapped in a second pair of parentheses.
- Grouping parentheses wherever precedence could be misread; none around the whole operand of `return`, `throw`, `typeof`, `void`, `delete`, `case`, `in`, `of`, or `yield`.
- Every `switch` has a `default` group, last, even if empty; every non-empty group ends with `break`, `return`, or `throw`; only an empty group falls through.

## Errors

- Throwing preferred over returning an error object or filling an error parameter; an `Error` subclass when the native `Error` cannot carry the information.
- Only `Error` instances, created with `new`, are thrown or rejected.
- Catches read `catch (error: unknown)` and assume an `Error`; defensive non-`Error` handling only for an API known to throw them, with a comment saying so.
- An empty catch block without a comment stating why is a finding.
- A `try` block covers only the statements that can throw (a whole loop is fine); the rest sits outside.
