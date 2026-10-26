# Pairing and production design

Part of the `typescript-unit-tests` skill: `.agents/skills/typescript-unit-tests/SKILL.md`.

These rules decide which test modules exist, where they live, what they may reach, and how production code is shaped so its tests can reach it.

## Pairing and coverage

- Every production `.ts` module under `extensions/pi-claude-marketplace/` has exactly one `.test.ts` module under `test/` at the mirrored path: `extensions/pi-claude-marketplace/orders/order-service.ts` -> `test/orders/order-service.test.ts`. That test module owns the source module's exported behavior.
- No exclusions. Type-only modules, `index.ts` barrels, and one-function modules all need a test module. If a module is not worth a test, fold it into its consumer.
- Do not co-locate tests under `extensions/pi-claude-marketplace/`, use `.spec.ts`, or test one source module from another module's test.
- Test modules and test support (fakes, seeds, contracts) need no meta-tests; a fake is verified through its shared contract.
- Each source-test pair reaches 100% function, line, and branch coverage when run alone. Aggregate coverage does not count.
- Do not add coverage exceptions or `/* node:coverage ignore */` directives. Remove dead code or cover it through a public-behavior case.
- How to run one test module or one pair's coverage, and which checks a task or gate needs, is in `.agents/skills/local-verification/SKILL.md`.

## Hermetic boundaries

- Cases run offline, in any order, with no credentials or developer setup. Fake HTTP APIs, brokers, cloud services, identity providers, and remote repositories. Do not fall back to a live service.
- Run a real adapter only against a temporary local boundary or loopback-only service owned by the case.

## Test support organization

Keep fakes, seeds, contracts, and fixtures next to the tests of the concern they serve: `test/orders/create-fake-order-store.ts`, `test/orders/order-seeds.ts`, `test/orders/order-store-contract.ts`. Do not create `test/helpers/`, `test/utils/`, or `test/mocks/`. Use a `fixtures/` directory only when a concern has enough static files to need one.

## Design production code for its tests

A test uses only the module's exports. When a module resists testing, change the production design, never the test's access.

Do not export a symbol for a test, add a reset hook, global mutator, state reader, or test mode, or reach a private member through bracket access or `as any`. Assert a private rule through the public export that uses it.

Make dependencies explicit as a function parameter, a dependencies object on a factory (`createOrderService({ clock, events, ids, orders, payments })`), or a constructor parameter. An imported `db` or `broker` singleton, an inline `new Date()`, `Date.now()`, `randomUUID()`, or a `process.env` read inside logic is a hidden dependency that makes the module untestable through its exports.

Make exactly one of these changes when a module resists testing:

1. Extract a coherent concern into a production module with a real name and API; it gets its own test module.
2. Make an existing hidden dependency an explicit parameter or dependencies-object member.
3. Inject a side-effecting port through a narrow interface declared in the consumer module.
4. Replace module-level mutable state with state owned by a factory-created instance.

Do not default a parameter to a live boundary. Wire real adapters in one composition module. Constructing a service or adapter must not open a connection, read a file, or start a timer; only its operations do.

## What not to test

**Do not test what a gate already enforces.** Before writing a case, name the failure it catches and the gate that would miss it. If the compiler, lint, `fallow`, or direct coverage already catches it, the case cannot fail and is a maintenance cost that proves nothing.

**Usage is not a property of a type.** Never enumerate a type's members to detect an unused one. A test observes shape from outside; whether a member is read belongs to the call graph, which no test of the type can reach. Coverage does not reach it either: an unused member has no read site, so there is no line, and absent code produces no coverage record. Rely on the compiler for required members, since every object literal that builds the type stops compiling, and on the consumer's own direct coverage for members it reads. A member nothing reads is a dead-code question for static analysis, not a case.

```ts
// wrong: pins the member list so a new member "cannot be added silently"
void ({ clock, events, ids, orders, payments } satisfies Required<OrderServiceDeps>);
// right: pin the contract that carries meaning -- which members are optional
void ({ clock, ids, orders, payments } satisfies OrderServiceDeps);
```
