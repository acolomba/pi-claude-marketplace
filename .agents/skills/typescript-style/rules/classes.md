# Classes

Part of the `typescript-style` skill: `.agents/skills/typescript-style/SKILL.md`.

- No empty or `super()`-only constructor, unless it is `private`.
- Constructors called with parentheses: `new Map()`.
- Injected values are `readonly` fields assigned in the constructor, since `erasableSyntaxOnly` rejects parameter properties *(project)*; every other field initializes at its declaration; no properties added or deleted after construction; an optional field initializes to `undefined`.
- Every property never reassigned outside the constructor is `readonly`.
- No `#private`; `private` instead. No `public` modifier.
- No private member read through `obj['name']`. *(project)*
- Getters are pure; no pass-through getter/setter pair over a field; no `Object.defineProperty` accessors.
- Computed member names only for symbols; `[Symbol.iterator]()` only on logically iterable classes.
- Module-local function over private static method; no `this` in a static context; statics called on the declaring class.
- No arrow-function property to bind `this` -- the call site wraps the method in an arrow function. Exception: an event handler that must later be removed. `.bind(this)` when installing a handler is always a finding; it cannot be removed.
- Private helpers live as non-exported module functions. No prototype manipulation, mixins, or modification of built-ins or the global object.
