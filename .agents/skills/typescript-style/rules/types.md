# Types

Part of the `typescript-style` skill: `.agents/skills/typescript-style/SKILL.md`.

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
