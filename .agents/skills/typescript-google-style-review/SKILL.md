---
name: typescript-google-style-review
description: Review TypeScript source against the Google Style Guide as this project adopts it — the rules the toolchain does not enforce. Use when reviewing or revising .ts files.
---

# Google style review

Review checks derived from the Google Style Guide. Points this project decides for itself, rather than taking from the guide, are marked *(project)*.

Review the files in the change under review. New files follow the rules completely; in an existing file, new code follows the file's conventions where the rules are silent but never violates a rule. Do not demand cleanups of unchanged code. Flag style-only churn mixed into a functional change; style-only edits go in their own change.

## Gate on the toolchain first

Confirm `npx tsc --noEmit` and `npx eslint . --max-warnings=0` pass. A failure of either is itself a finding; do not hand-review what the tools report. The toolchain gates: compilation, indentation, quotes, semicolons, trailing commas, brace placement and spacing, `case` indentation, line length, mandatory braces on control-flow bodies, `===` with the `== null` exception, dot notation, declare-before-use, unused variables, `namespace`, `require()`, `@ts-ignore`, and bare `any`. Do not open findings for these when the gate is green.

Where a rule overlaps the linter, review the part the linter cannot judge: every `eslint-disable` directive names one rule, carries a `-- <reason>`, and the reason holds for that line.

## Quick scan

Grep the changed files for these tokens; every hit needs a stated justification or becomes a finding:

`var` · `export default` outside the extension entry point · `export let` · `public` · `#` private fields · `const enum` · `debugger` · `with` · `eval` / `new Function` · `new String` / `new Number` / `new Boolean` / `new Object` / `new Array` / `Array(` · `parseInt` / `parseFloat` · `@ts-ignore` / `@ts-nocheck` · `@ts-expect-error` outside a unit test · `arguments` · `.bind(` · `<Type>value` assertions · `Object.defineProperty` · prototype or global modification.

## Formatting the linter does not check

- Bodies do not begin or end with a blank line; one blank line separates methods and the constructor; blank lines inside a body only group statements.
- Multi-line comments are consecutive `//` lines, not `/* */` blocks; no boxes around comments.
- Strings use the special escapes (`\n`, `\t`, `\'`), not numeric ones; a printable non-ASCII character appears as itself (`'μs'`); only non-printables are escaped, with a comment; the only whitespace character is the ASCII space.
- No space after `...`; the star is attached in `function*` and `yield*`.
- No semicolon after a class declaration or method body; a statement containing a class expression keeps its semicolon.

## Files and modules

- File order: copyright JSDoc, `@fileoverview` JSDoc, imports, implementation — each present section separated by exactly one blank line.
- File names are `kebab-case`: `atomic-json.ts`. *(project)*
- Same-project imports are relative and carry the `.ts` extension, because Node runs the sources directly with no build step; flag long `../` chains. *(project)*
- Import form matches usage: named imports for symbols used often or with clear names; a namespace import for many symbols from one large API or common names such as `defaultGit`; a rename only to avoid a collision, name a generated symbol, or clarify an unclear name.
- Default imports only for external code that offers nothing else; side-effect imports (`import 'x';`) only to load for side effects.
- Imports used only as types are marked `import type` (or inline `type`); type re-exports use `export type`.
- Exports are named. The one permitted default export is the extension factory in `extensions/pi-claude-marketplace/index.ts`, a function declaration, because Pi's loader calls the module's default export; any other default export is a finding. *(project)*
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
- No `!!value` inside an `if`/`for`/`while` condition; an enum value is never coerced to boolean — it is compared (`level !== SupportLevel.NONE`).

## Classes

- No empty or `super()`-only constructor, unless it holds parameter properties or is `private`.
- Constructors called with parentheses: `new Map()`.
- Injected values are parameter properties; every other field initializes at its declaration; no properties added or deleted after construction; an optional field initializes to `undefined`.
- Every property never reassigned outside the constructor is `readonly`.
- No `#private`; `private` instead. `public` appears only on a non-readonly public parameter property.
- No private member read through `obj['name']`. *(project)*
- Getters are pure; no pass-through getter/setter pair over a field; no `Object.defineProperty` accessors.
- Computed member names only for symbols; `[Symbol.iterator]()` only on logically iterable classes.
- Module-local function over private static method; no `this` in a static context; statics called on the declaring class.
- No arrow-function property to bind `this` — the call site wraps the method in an arrow function. Exception: an event handler that must later be removed. `.bind(this)` when installing a handler is always a finding; it cannot be removed.
- Private helpers live as non-exported module functions. No prototype manipulation, mixins, or modification of built-ins or the global object.

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

## Types

- `as` and `!` only with an obvious or commented reason; a runtime check (`instanceof`, `if (value)`) preferred. Assertions read `value as Type`, never `<Type>value`; double assertions go through `unknown`.
- An object literal takes an annotation (`const order: Order = { ... }`), not `as Order`.
- No annotation on a variable initialized with a string, number, boolean, RegExp, or `new` expression; an empty generic gets type arguments (`new Set<string>()`); an expression whose type a reader cannot see gets an annotation. Return types annotated when not obvious from name and body.
- No `| null` or `| undefined` inside a type alias; optionals (`name?: string`) over `| undefined`; class fields initialized rather than optional.
- Object types declared with `interface`, not a `type` alias of an object literal and not a class.
- `T[]`/`readonly T[]` for simple element types, `Array<...>`/`ReadonlyArray<...>` otherwise.
- Index signatures carry a meaningful label (`{ [marketplaceName: string]: MarketplaceRecord }`); `Map`/`Set` over an object as a map; `Record<Keys, Value>` for statically known keys.
- The simplest construct that expresses the code; mapped and conditional types sparingly; interface extension over `Pick` and friends.
- `any` avoided in favor of a specific type, generic, or narrowed `unknown`; an unavoidable `any` carries `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>` and the reason holds.
- No `{}` as a type; `unknown`, `Record<string, T>`, or `object`. Never `String`, `Number`, `Boolean`, or `Object` as types.
- A pair returns a tuple or an inline object type, not a named `Pair` type.
- No API whose only generic is the return type; calls to one pass the type argument explicitly.
- `@ts-expect-error` only in a unit test, with a description; `@ts-ignore` and `@ts-nocheck` never.

## Naming

| Style | Used for |
| --- | --- |
| `UpperCamelCase` | class, interface, type alias, enum, type parameter |
| `lowerCamelCase` | variable, parameter, function, method, property, module alias |
| `CONSTANT_CASE` | module-level constant, `static readonly` field, enum member |

- Names are descriptive to a new reader; no ambiguous or project-private abbreviations, no dropped letters; short names only in scopes of ten lines or fewer.
- Acronyms read as words: `loadHttpUrl`, `deviceId`.
- No type encoding: no `_` prefix or suffix, `opt_`, `I` prefix, `Interface` suffix, or Hungarian notation; no parameter named `_`; `$` only where a framework requires it.
- `CONSTANT_CASE` only for a value that exists once per program; a function-local is `lowerCamelCase`.
- Aliases keep the source's casing, bound with `const` or a `readonly` field.

## Comments and documentation

- `/** JSDoc */` for what a user of the code reads, `//` for implementation notes.
- Every top-level export is documented, plus any member whose purpose its name and type do not make obvious; a class comment says how and when to use it.
- Method descriptions begin with a third-person verb phrase: `Registers the plugin ...`.
- `@param`/`@return` only when they add information beyond the name and type; parameter properties documented with `@param` on the constructor; no types repeated in JSDoc; no `@private`/`@override`/`@implements`/`@enum` where the keyword is used.
- A literal argument whose meaning is unclear carries a parameter-name comment (`/* delayMs= */ 5000`) — or the API should take an options object.
- Deprecations carry `@deprecated` with directions for fixing call sites.
- No decorators; the codebase defines none and `tsconfig.json` enables none. *(project)*

## Classifying findings

- **BLOCKER** when the violation can produce incorrect behavior or hide a defect: an assertion or `!` without a valid reason, an `eslint-disable` whose reason does not hold, spreading a possibly-nullish value, a non-empty `switch` group that falls through, an empty catch without a comment, throwing or rejecting a non-`Error`, `.bind(this)` on a handler that must be removed, modifying built-ins or globals.
- **WARNING** otherwise: naming, documentation, import form, visibility, and structure findings degrade maintainability, not behavior.
