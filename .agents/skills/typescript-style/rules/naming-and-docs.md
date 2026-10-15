# Naming and documentation

Part of the `typescript-style` skill: `.agents/skills/typescript-style/SKILL.md`.

## Naming

| Style            | Used for                                                      |
| ---------------- | ------------------------------------------------------------- |
| `UpperCamelCase` | class, interface, type alias, enum, type parameter            |
| `lowerCamelCase` | variable, parameter, function, method, property, module alias |
| `CONSTANT_CASE`  | module-level constant, `static readonly` field, enum member   |

- Names are descriptive to a new reader; no ambiguous or project-private abbreviations, no dropped letters; short names only in scopes of ten lines or fewer.
- Acronyms read as words: `loadHttpUrl`, `deviceId`.
- No type encoding: no `_` prefix or suffix, `opt_`, `I` prefix, `Interface` suffix, or Hungarian notation; no parameter named `_`; `$` only where a framework requires it.
- `CONSTANT_CASE` only for a value that exists once per program; a function-local is `lowerCamelCase`.
- Aliases keep the source's casing, bound with `const` or a `readonly` field.

## Comments and documentation

- `/** JSDoc */` for what a user of the code reads, `//` for implementation notes.
- Every top-level export is documented, plus any member whose purpose its name and type do not make obvious; a class comment says how and when to use it.
- Method descriptions begin with a third-person verb phrase: `Registers the plugin ...`.
- `@param`/`@return` only when they add information beyond the name and type; no types repeated in JSDoc; no `@private`/`@override`/`@implements`/`@enum` where the keyword is used.
- A literal argument whose meaning is unclear carries a parameter-name comment (`/* delayMs= */ 5000`) -- or the API should take an options object.
- Deprecations carry `@deprecated` with directions for fixing call sites.
- No decorators; the codebase defines none and `tsconfig.json` enables none. *(project)*
