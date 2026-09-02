---
paths:
  - "test/**/*.ts"
---

# TypeScript unit testing rules

Rule form of the TypeScript Unit Testing Guidelines; that document holds the complete sample and rationale. "Do" and "Do not" are hard rules. "Prefer" states the default and allows a justified exception. "May" grants a permission. Copy the **Good** form.

Every case must discriminate the behavior named in its title: a wrong implementation makes the assertion fail. A test with weak assertions costs all the maintenance of a test and gives none of the protection.

## Tools

Use `node:test` for the runner, lifecycle, and the context's `t.mock` (stubs, spies, fake timers); `node:assert/strict` for assertions; `strong-mock` for strict interaction mocks; `--experimental-test-coverage` for coverage.

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { mock, verify, when } from 'strong-mock'
```

Do not add another runner, assertion library, or mocking library. Do not import the process-wide `mock` from `node:test`; use the context's `t.mock`.

## Pairing and coverage

- Every production `.ts` module under `src/` has exactly one `.test.ts` module under `test/` at the mirrored path: `src/orders/order-service.ts` -> `test/orders/order-service.test.ts`. That test module owns the source module's exported behavior.
- No exclusions. Type-only modules, `index.ts` barrels, and one-function modules all need a test module. If a module is not worth a test, fold it into its consumer.
- Do not co-locate tests under `src/`, use `.spec.ts`, or test one source module from another module's test.
- Test modules and test support (fakes, seeds, contracts) need no meta-tests; a fake is verified through its shared contract.
- Each source-test pair reaches 100% function, line, and branch coverage when run alone. Aggregate coverage does not count.
- Do not add coverage exceptions or `/* node:coverage ignore */` directives. Remove dead code or cover it through a public-behavior case.
- Run `node --test <test-path>` while developing, `npm run test:coverage:direct -- <path>` for the pair (`:all` after a shared contract, fake, or harness change), and `npm run check` before completion.

## Case structure

- Write independent `test()` cases. Use `test()`, not `it()`.
- When a module has several exported entrypoints, use one top-level `describe()` per entrypoint (`describe('place')`, `describe('cancel')`). A single-entrypoint module keeps cases at the top level. Do not nest `describe()`.
- Do not group by private helpers or use `describe()` to share mutable setup.
- Each case gets fresh state and dependencies. Prefer construction inside the case. `beforeEach()` may create new per-case instances; do not use `before()` for shared state. Only a stateless stub (a fixed `clock`) may live at module scope.
- Do not commit `test.only()`, `test.skip()`, or `test.todo()`.
- Title each case with a short sentence stating public behavior: `'rejects an unknown order'`, not `'works'`, `'happy path'`, or `'cancel test'`. A durable requirement ID may appear; plan, phase, or ticket references may not.
- Mark phases with lowercase `// arrange`, `// act`, `// assert` comments, in that order, separated by a blank line. Use `// act & assert` only when one `assert.rejects()` or `assert.throws()` expression performs both the action and assertion. Data rows still use separate phases. Add no other comments unless setup is not obvious.

## Naming values

Name values after their production role. Do not use `result`, `data`, `value`, `instance`, `subject`, `sut`, or a bare `actual`.

- Module under test: `orderService`. Its returned value: `order`.
- Expected value: `expectedOrder`. That is `node:assert`'s own vocabulary; its signature is `(actual, expected)`. Prefer an inline literal when it is short and used once.
- Test double: the production role only, `orders`, `payments`, `clock`. Do not add `mock`, `fake`, or `stub` to the name; how it is created shows the kind.
- Spy handle: the observed method with a `Spy` suffix, `putSpy`.
- Data-row fields: the parameter and the promised outcome, `{ lines, total }`.

## Reference case

`createOrderService({ clock, events, ids, orders, payments })` takes every collaborator explicitly. `clock` and `ids` are stubs, `orders` is a stateful fake, `payments` and `events` are strict mocks, and `cart()` / `placedOrder()` are seed functions.

**Good**

```ts
const clock = { now: () => new Date('2026-08-28T10:00:00Z') } satisfies Clock
const ids = { next: () => 'order-123' } satisfies OrderIds

describe('place', () => {
  test('charges the customer, stores the order, and publishes order.placed', async () => {
    // arrange
    const expectedOrder = placedOrder()
    const orders = createFakeOrderStore()
    const payments = mock<Payments>({ exactParams: true, name: 'payments' })
    const events = mock<OrderEvents>({ exactParams: true, name: 'order events' })
    when(() => payments.charge('customer-1', 25)).thenResolve(undefined)
    when(() => events.publish({ type: 'order.placed', orderId: 'order-123', total: 25 })).thenResolve(undefined)
    const orderService = createOrderService({ clock, events, ids, orders, payments })

    // act
    const order = await orderService.place(cart())

    // assert
    assert.deepStrictEqual(order, expectedOrder)
    assert.deepStrictEqual(await orders.get('order-123'), expectedOrder)
    verify(payments)
    verify(events)
  })
})
```

A mock with no expectations proves that the module does not touch that port: any call throws immediately.

## Assertions

- Assert the public result and public state before any interaction. Do not replace a result assertion with a call assertion. When relocating a case, preserve its assertions unless the contract changed.
- Compare whole values with `assert.deepStrictEqual()`. Do not assert existence, length, or one property at a time when the whole value is the promise. A standalone negative assertion (`assert.notStrictEqual()`, `assert.ok(order !== undefined)`) passes for any value; assert what the value is.
- Assert errors by class and structured fields, not by message substring:

```ts
await assert.rejects(
  () => orderService.cancel('order-999'),
  (error: unknown) => {
    assert.ok(error instanceof OrderNotFoundError)
    assert.strictEqual(error.code, 'ORDER_NOT_FOUND')
    assert.strictEqual(error.orderId, 'order-999')
    return true
  },
)
```

- When bytes are the contract (a file, packet, archive, encoded value), compare the complete bytes. Do not decode or normalize the output unless consumers do.
- Build expected values independently. Do not call the production formatter or serializer, transform the adapter result, ask a harness for the answer, or use a snapshot assertion.
- Await every promise and asynchronous assertion, including `assert.rejects()`.

## Test doubles

| Role | Use | Assert |
| --- | --- | --- |
| Fake | A working, simplified, stateful implementation | The public result and resulting state |
| Stub | A canned value or error that drives one path | The module's result, not the stub's call count |
| Spy | Real behavior with recorded calls | Public behavior first; calls only when the observation is the promise |
| Mock | A prescribed interaction | The promised calls, arguments, and order |

Use the tool that matches the role. Do not turn a stub into a mock by asserting its call count. Do not verify incidental spy calls.

**Fakes.** `createFakeThing()` stands in for a stateful boundary (store, repository, remote). Create a fresh one per case. Seed it through its public contract: `await orders.put(placedOrder())`. `structuredClone()` values at ingress and egress. Do not simulate a database or filesystem with a graph of mock functions. Do not let a fake grow into a second real implementation.

**Stubs.** A plain typed object (`{ next: () => 'order-123' } satisfies OrderIds`) for a fixed clock, ID, one-shot failure, remote response, or capability flag. Use `t.mock.fn()` only when a plain function is not enough, such as a `mockImplementationOnce()` sequence. Assert the module's result, not the stub's calls.

**Spies.** `t.mock.method(orders, 'put')` with no replacement, only when real behavior must run and the observation is the promise ("writes exactly once", "does not rewrite"). Read `putSpy.mock.callCount()` and `putSpy.mock.calls[i].arguments` after the result assertions. With a replacement implementation it is a stub.

**Mocks.** `strong-mock`, only when the interaction is public behavior: charging, publishing, notifying, transaction control, invoking a callback, issuing a command.

- Create `mock<Port>({ exactParams: true, name: '<role>' })` inside the case. Without `exactParams` the mock accepts extra arguments.
- State every allowed call with exact arguments: `when(() => payments.charge('customer-1', 25)).thenResolve(undefined)`.
- Do not use `It.isAny()`. Use `It.matches()` or `It.containsObject()` only for a value that cannot be compared structurally (a function, a stream), and match every meaningful property.
- Do not use `anyTimes()`. A call without a definite count is not a promise; that dependency is a stub.
- Call `verify(mock)` for every mock, at the end of the case, after result and state assertions. Do not hide verification in a hook or shared cleanup.
- Do not use `verifyAll()`, `resetAll()`, `setDefaults()`, or any process-wide registry.

`strong-mock` does not check order across mocks. When order is the promise, replace each promised method with a recorder that pushes the meaningful arguments into one shared log, compare the whole log, and still `verify()` every mock:

```ts
const log: string[] = []
when(() => payments.charge).thenReturn(async (customerId, amount) => { log.push(`charge ${customerId} ${amount}`) })
when(() => events.publish).thenReturn(async (event) => { log.push(`publish ${event.type}`) })
// ...
assert.deepStrictEqual(log, ['charge customer-1 25', 'publish order.placed'])
verify(payments)
verify(events)
```

**Not doubles.** Plain data (`Cart`, `Order`, `OrderEvent`) is a literal. Logging gets a silent stub; assert log calls only in a module whose job is logging.

**Scope.** Every double comes from the current test context (`t.mock.fn()`, `t.mock.method()`, `t.mock.timers`), which restores it after the case, or from `strong-mock` inside the case. Register other cleanup with `t.after()`. Do not replace modules with `t.mock.module()` or a custom loader; inject the dependency instead.

## Test data

- Short self-describing literals: `'order-123'`, `'customer-1'`, `'sku-a'`. No realistic prose, random generators, or long fixture blobs.
- Typed literals, checked with `satisfies` when they stand in for a production type. Set only what the case is about: `{ ...placedOrder(), status: 'cancelled' }`.
- Seeds reused across cases live in the concern's seed module (`test/orders/order-seeds.ts`) as functions that return fresh values, never shared mutable constants.
- Do not compute test data with production code.

## Data-driven cases

Create one sibling `test()` per row with a `for` loop over typed rows and a title that interpolates the row. Do not loop rows inside one case; it stops at the first failure. Do not put a conditional in the loop body; different branches, dependencies, or expectations are separate named cases.

```ts
for (const { lines, total } of [
  { lines: [], total: 0 },
  { lines: [{ sku: 'sku-a', quantity: 2, unitPrice: 10 }], total: 20 },
]) {
  test(`totals ${lines.length} line(s) as ${total}`, () => {
    // arrange
    const expectedTotal = total

    // act
    const calculatedTotal = cartTotal(lines)

    // assert
    assert.strictEqual(calculatedTotal, expectedTotal)
  })
}
```

## Types and hermeticity

- Run tests under the same module model (ESM or CJS) as production, with strict type-checking. Do not use `any`, a double assertion, or a broad `Partial<T>` cast to hide an invalid double; narrow the production contract instead.
- Prefer a small port declared by the consumer (`interface Payments { charge(customerId: string, amount: number): Promise<void> }`) and check hand-built doubles with `satisfies`.
- Cases run offline, in any order, with no credentials or developer setup. Fake HTTP APIs, brokers, cloud services, identity providers, and remote repositories. Do not fall back to a live service.
- Run a real adapter only against a temporary local boundary or loopback-only service owned by the case.
- Do not run cases that mutate the same process global concurrently. Do not add a production reset function to clean up after a test.

## Test support organization

Keep fakes, seeds, contracts, and fixtures next to the tests of the concern they serve: `test/orders/create-fake-order-store.ts`, `test/orders/order-seeds.ts`, `test/orders/order-store-contract.ts`. Do not create `test/helpers/`, `test/utils/`, `test/mocks/`, or `test/shared/`. Use a `fixtures/` directory only when a concern has enough static files to need one.

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

## Patterns

**Type-only modules.** The paired test module holds `satisfies` checks and `@ts-expect-error` negatives; `node --test` runs it with zero cases. Do not add runtime assertions to make it look active.

```ts
void ({ type: 'order.placed', orderId: 'order-123', total: 25 } satisfies OrderEvent)
// @ts-expect-error an event carries its discriminant
void ({ orderId: 'order-123' } satisfies OrderEvent)
```

**Do not test what a gate already enforces.** Before writing a case, name the failure it catches and the gate that would miss it. If the compiler, lint, `fallow`, or direct coverage already catches it, the case cannot fail and is a maintenance cost that proves nothing.

**Usage is not a property of a type.** Never enumerate a type's members to detect an unused one. A test observes shape from outside; whether a member is read belongs to the call graph, which no test of the type can reach. Coverage does not reach it either: an unused member has no read site, so there is no line, and absent code produces no coverage record. Rely on the compiler for required members, since every object literal that builds the type stops compiling, and on the consumer's own direct coverage for members it reads. A member nothing reads is a dead-code question for static analysis, not a case.

```ts
// wrong: pins the member list so a fourth member "cannot be added silently"
void ({ gitOps, pluginUpdate, importClaudeSettings } satisfies Required<EdgeDeps>)
// right: pin the contract that carries meaning — which members are optional
void ({ gitOps, pluginUpdate } satisfies EdgeDeps)
```

**Barrels.** Prefer importing concrete modules. An existing `index.ts` gets a test module that asserts each runtime re-export is the same binding as its source with `assert.strictEqual()`.

**Filesystem.** Use the real filesystem when stored files, paths, permissions, encoding, or rendered bytes are the behavior. Create one `mkdtemp(join(tmpdir(), 'file-order-store-'))` per case and remove it with `rm(directory, { recursive: true, force: true })` in `finally` or `t.after()`. Do not share a directory across cases or write into the repository, the home directory, or a fixed path.

**HTTP adapters.** Replace `fetch` with `t.mock.method(globalThis, 'fetch', async () => new Response(body, { status, headers }))`, returning a fresh `Response` on every call. When the request is the promise, assert its method, URL, headers, and body from the recorded `Request` in `mock.calls`.

**Time.** Prefer an injected `Clock`. When scheduling itself is the behavior (timeout, retry, debounce), enable only the APIs the module uses with `t.mock.timers.enable({ apis: ['setTimeout'] })`, then `t.mock.timers.tick(ms)`. Do not fake `Date` when a clock would do. Do not await a real timer or poll.

**Environment.** Prefer configuration passed as a parameter: `loadOrdersConfig({ ORDERS_DIR: '/srv/orders' })`. When `process.env` or a global must change, save the previous value and register restoration with `t.after()` before acting.

**Shared adapter contracts.** A real adapter and its fake pass one contract function (`orderStoreContract(createOrderStore)`) exported from `test/<concern>/<thing>-contract.ts` and invoked from both test modules; adapter-specific cases stay in each adapter's own test module. Give every contract case a fresh instance. Cover missing values, aliasing, overwrite, ordering, deletion, and validation, or record why a category does not apply. Prove the contract fails against a deliberately broken fake kept private to that negative-control test, with its expectation written independently of the contract. Record each real and fake participant in the concern's typed inventory.

## Completion checklist

A unit-test change is complete when:

- [ ] Every changed production `.ts` module, including type-only and barrel modules, has one corresponding `.test.ts` module.
- [ ] Each test uses exported production behavior only; no export, reset hook, mutator, or state reader was added for testing.
- [ ] Any production refactor created a coherent module, an explicit dependency, a narrow port, or removed hidden global state.
- [ ] Tests use independent `node:test` cases and `node:assert/strict`, with no `only`, `skip`, or `todo`.
- [ ] Every case marks its phases with `// arrange`, `// act`, and `// assert`; `// act & assert` appears only for one throwing/rejection expression.
- [ ] Any `describe()` is top-level, names an exported entrypoint, and owns no shared mutable state; each stateful case gets fresh dependencies.
- [ ] Case titles state public behavior; values and doubles are named after their production role.
- [ ] Fakes, stubs, spies, and mocks are chosen and asserted by role; plain data is a literal; logging is not verified outside a logging module.
- [ ] Every mock is a `strong-mock` with `exactParams: true`, states its complete promised interaction, uses no `It.isAny()` or `anyTimes()`, and has an explicit `verify(mock)` at the end of its case.
- [ ] Every `t.mock` function, method, or timer comes from the current test context; no module replacement or process-wide tracker is used.
- [ ] Test data is small, self-describing, and built from seeds that return fresh values.
- [ ] Filesystem behavior uses one temporary directory per case, cleaned up through `finally` or `t.after()`.
- [ ] External transports are fake, local, or loopback-only; every replaced `fetch` returns a fresh `Response`.
- [ ] Time comes from an injected clock or the context's fake timers; environment and global changes are restored through the test context.
- [ ] Public results and state are asserted before promised interactions; whole values are compared; typed errors are asserted by class and fields.
- [ ] Expected values are independent from production and harness computations.
- [ ] No case restates a fact the compiler, lint, `fallow`, or direct coverage already enforces.
- [ ] Shared support is organized by concern, with no generic helper directory.
- [ ] Real and fake adapters pass the same contract, and the contract has a proven negative control.
- [ ] The focused source-test pair has 100% direct function, line, and branch coverage, with no coverage exception added.
- [ ] Focused `node --test`, direct coverage, and `npm run check` pass.
