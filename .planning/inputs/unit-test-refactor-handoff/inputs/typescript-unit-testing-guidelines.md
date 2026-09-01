# TypeScript Unit Testing Guidelines

These rules apply to production TypeScript modules and their tests. They use the built-in Node.js test runner and one focused third-party library for strict interaction mocks.

Every rule is written as an instruction. "Do" and "Do not" are hard rules. "Prefer" states the default and allows a justified exception. "May" grants an explicit permission. Examples are labelled **Good** and **Bad**; copy the **Good** form.

## General

### Unit testing philosophy

Unit tests:

- **Are simple.** A complicated test points at a module that does too much. Split the module; do not elaborate the test.
- **Are fast.** Do not use sleeps, real network waits, or retries to make a case pass.
- **Cover the paired module completely.** Each source-test pair reaches 100% function, line, and branch coverage when run by itself. Code that is hard to cover is refactored, not excluded.
- **Are repeatable.** A case leaves no state behind, locally or remotely, and passes in any order and in isolation.
- **Are hermetic.** A case runs offline, without live services, developer credentials, shared mutable state, or developer setup.
- **Are meaningful.** A case fails when the behavior named in its title changes:
  - The module stops invoking a collaborator it promised to invoke, or starts invoking one it promised not to.
  - The contract changes. Input that was accepted is now rejected, or a result changes shape.
  - The implementation changes what it promises. The module discards an input instead of forwarding it, or forwards a different value.
- **Exercise the exported surface only.** A test sees the same public surface as any other consumer. A module that is hard to test through its exports is refactored; the test is not given a back door.
- **Control every collaborator that reaches outside the module.** Each such dependency is a test double or a temporary local boundary owned by the case. Pure production modules may be composed for real.
- **Survive unrelated changes.** A case keeps passing when a collaborator's implementation changes behind an unchanged contract, or when a value type gains a field the module does not use.

A test with weak assertions requires all the maintenance of a test and none of the protection. It is code to read, update, and run, and it does not fail when it should. Every case must discriminate the behavior named in its title: a wrong implementation makes the assertion fail.

### Tools

Use:

- Runner and lifecycle: `node:test`.
- Assertions: `node:assert/strict`.
- Stubs, spies, and fake timers: the current test context's `t.mock`.
- Strict interaction mocks: `strong-mock`.
- Coverage: Node's `--experimental-test-coverage`.

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { mock, verify, when } from 'strong-mock'
```

Do not add another test runner, assertion library, or mocking library. Do not import the process-wide Node mock tracker (`mock` from `node:test`); use the context's `t.mock`.

### Which modules need a test module

Every production `.ts` module under `src/` has one corresponding `.test.ts` module under `test/`. That test module owns the exported production behavior of its source module. A generic integration suite does not replace that ownership.

There are no exclusions for small or "trivial" production modules:

- A type-only production module needs a test module. That test module owns the compile-time contract. See [Type-only modules](#type-only-modules).
- A re-export-only module (an `index.ts` barrel) is a production module and needs a test module. Prefer importing concrete modules so that such barrels are rare. See [Barrel modules](#barrel-modules).
- A module with one exported constant or one small function still needs a test module. If it is not worth a test, it is not worth a module: fold it into the module that uses it.

Test modules and test-support modules (fakes, seeds, contracts, harnesses) do not require recursive meta-tests. A shared fake is verified through the contract it shares with the real adapter. See [Real and fake adapters sharing a contract](#real-and-fake-adapters-sharing-a-contract).

### Direct coverage

Each source-test pair must reach 100% function, line, and branch coverage in isolation.

Direct coverage means:

1. Run only the corresponding test module.
2. Measure the paired source module.
3. Inspect only that source module's LCOV record.
4. Require 100% functions, lines, and branches for the pair decision.

Aggregate coverage is not direct coverage. Another test module may execute the source by accident and hide missing ownership.

Do not add coverage exceptions, ignore directives, or blanket exclusions. Do not use `/* node:coverage ignore next */` or `/* node:coverage disable */` to suppress an uncovered branch. Remove dead code or write a public-behavior case that covers it.

Use these commands:

```sh
npm run test:coverage:direct -- <source-or-test-path>
npm run test:coverage:direct
npm run test:coverage:direct:all
```

- Use the path form for one focused pair.
- Use `npm run test:coverage:direct` to select changed pairs automatically.
- Use `npm run test:coverage:direct:all` after shared contract, fake, harness, or coverage-infrastructure changes.

During development, run the focused pair directly:

```sh
node --test <corresponding-test-path>
```

Before completion, run:

```sh
npm run check
```

The direct-coverage gate must fail when a source path, test path, mapping, or LCOV record is missing or ambiguous. It must not silently fall back to aggregate coverage. A type-only module produces no LCOV record; the gate must recognize a module with no runtime statements explicitly rather than treat the missing record as a pass.

### Fail-closed enforcement

A structural gate must reject invalid input. Missing, ambiguous, or unmapped input is a failure, not a pass.

When a structural gate is added or changed:

1. Plant one clear violation.
2. Run the gate and prove it rejects that violation.
3. Remove the violation.
4. Run the gate and prove it accepts the clean tree.

Keep the negative control small. It should fail for the exact rule being proved.

Do not suppress production dead code as a migration shortcut.

Configure production-mode Fallow as follows:

```json
{
  "production": {
    "deadCode": true,
    "health": false,
    "dupes": false
  }
}
```

Treat production dead-code findings as migration work. Do not turn them into automatic `ignoreExports` entries.

If static analysis cannot observe an intentional runtime API, use one narrow documented suppression. Name the intentional API and explain why analysis cannot see it. Remove the suppression when that reason no longer applies.

Keep local and CI gates aligned. They must enforce the same failure classes, pair mapping, coverage rules, and dead-code policy.

## Unit test coding standards

### Sample

The examples in this section are based on one small order module. It takes every collaborator as an explicit dependency, so its tests can use every kind of test double without touching production code.

```ts
// src/orders/cart-total.ts
export interface CartLine {
  sku: string
  quantity: number
  unitPrice: number
}

export function cartTotal(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0)
}
```

```ts
// src/orders/order-service.ts
import { cartTotal, type CartLine } from './cart-total.js'

export interface Cart {
  customerId: string
  lines: readonly CartLine[]
}

export interface Order {
  id: string
  customerId: string
  lines: readonly CartLine[]
  total: number
  status: 'placed' | 'cancelled'
  placedAt: Date
}

export type OrderEvent =
  | { type: 'order.placed'; orderId: string; total: number }
  | { type: 'order.cancelled'; orderId: string }

export interface OrderStore {
  get(orderId: string): Promise<Order | undefined>
  put(order: Order): Promise<void>
}

export interface Payments {
  charge(customerId: string, amount: number): Promise<void>
}

export interface OrderEvents {
  publish(event: OrderEvent): Promise<void>
}

export interface Clock {
  now(): Date
}

export interface OrderIds {
  next(): string
}

export interface OrderServiceDependencies {
  clock: Clock
  events: OrderEvents
  ids: OrderIds
  orders: OrderStore
  payments: Payments
}

export class OrderNotFoundError extends Error {
  readonly code = 'ORDER_NOT_FOUND'

  constructor(readonly orderId: string) {
    super(`Order ${orderId} not found`)
    this.name = 'OrderNotFoundError'
  }
}

export function createOrderService({ clock, events, ids, orders, payments }: OrderServiceDependencies) {
  return {
    async place(cart: Cart): Promise<Order> {
      const order: Order = {
        id: ids.next(),
        customerId: cart.customerId,
        lines: cart.lines,
        total: cartTotal(cart.lines),
        status: 'placed',
        placedAt: clock.now(),
      }

      await payments.charge(order.customerId, order.total)
      await orders.put(order)
      await events.publish({ type: 'order.placed', orderId: order.id, total: order.total })

      return order
    },

    async cancel(orderId: string): Promise<Order> {
      const order = await orders.get(orderId)

      if (order === undefined) {
        throw new OrderNotFoundError(orderId)
      }

      if (order.status === 'cancelled') {
        return order
      }

      const cancelled: Order = { ...order, status: 'cancelled' }

      await orders.put(cancelled)
      await events.publish({ type: 'order.cancelled', orderId })

      return cancelled
    },
  }
}

export type OrderService = ReturnType<typeof createOrderService>
```

The test support for this concern lives next to its test modules: a fake for the stateful store and a seed module for shared values.

```ts
// test/orders/create-fake-order-store.ts
import type { Order, OrderStore } from '../../src/orders/order-service.js'

export function createFakeOrderStore(): OrderStore {
  const orders = new Map<string, Order>()

  return {
    async get(orderId) {
      const order = orders.get(orderId)

      return order === undefined ? undefined : structuredClone(order)
    },

    async put(order) {
      orders.set(order.id, structuredClone(order))
    },
  }
}
```

```ts
// test/orders/order-seeds.ts
import type { Cart, Order } from '../../src/orders/order-service.js'

export function cart(): Cart {
  return {
    customerId: 'customer-1',
    lines: [
      { sku: 'sku-a', quantity: 2, unitPrice: 10 },
      { sku: 'sku-b', quantity: 1, unitPrice: 5 },
    ],
  }
}

export function placedOrder(): Order {
  return {
    id: 'order-123',
    customerId: 'customer-1',
    lines: [
      { sku: 'sku-a', quantity: 2, unitPrice: 10 },
      { sku: 'sku-b', quantity: 1, unitPrice: 5 },
    ],
    total: 25,
    status: 'placed',
    placedAt: new Date('2026-08-28T10:00:00Z'),
  }
}
```

The test module uses a stub for the clock and the ID source, a fake for the store, strict mocks for payments and events, and a spy on the fake where the number of writes is the promise.

#### Complete sample

```ts
// test/orders/order-service.test.ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { mock, verify, when } from 'strong-mock'
import {
  type Clock,
  createOrderService,
  type Order,
  type OrderEvents,
  type OrderIds,
  OrderNotFoundError,
  type Payments,
} from '../../src/orders/order-service.js'
import { createFakeOrderStore } from './create-fake-order-store.js'
import { cart, placedOrder } from './order-seeds.js'

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

describe('cancel', () => {
  test('stores the cancelled order and publishes order.cancelled', async () => {
    // arrange
    const expectedOrder: Order = { ...placedOrder(), status: 'cancelled' }
    const orders = createFakeOrderStore()
    await orders.put(placedOrder())
    const payments = mock<Payments>({ exactParams: true, name: 'payments' })
    const events = mock<OrderEvents>({ exactParams: true, name: 'order events' })
    when(() => events.publish({ type: 'order.cancelled', orderId: 'order-123' })).thenResolve(undefined)
    const orderService = createOrderService({ clock, events, ids, orders, payments })

    // act
    const order = await orderService.cancel('order-123')

    // assert
    assert.deepStrictEqual(order, expectedOrder)
    assert.deepStrictEqual(await orders.get('order-123'), expectedOrder)
    verify(payments)
    verify(events)
  })

  test('returns an already cancelled order without rewriting it', async (t) => {
    // arrange
    const expectedOrder: Order = { ...placedOrder(), status: 'cancelled' }
    const orders = createFakeOrderStore()
    await orders.put(expectedOrder)
    const putSpy = t.mock.method(orders, 'put')
    const payments = mock<Payments>({ exactParams: true, name: 'payments' })
    const events = mock<OrderEvents>({ exactParams: true, name: 'order events' })
    const orderService = createOrderService({ clock, events, ids, orders, payments })

    // act
    const order = await orderService.cancel('order-123')

    // assert
    assert.deepStrictEqual(order, expectedOrder)
    assert.strictEqual(putSpy.mock.callCount(), 0)
    verify(payments)
    verify(events)
  })

  test('rejects an unknown order', async () => {
    // arrange
    const orders = createFakeOrderStore()
    const payments = mock<Payments>({ exactParams: true, name: 'payments' })
    const events = mock<OrderEvents>({ exactParams: true, name: 'order events' })
    const orderService = createOrderService({ clock, events, ids, orders, payments })

    // act & assert
    await assert.rejects(
      () => orderService.cancel('order-999'),
      (error: unknown) => {
        assert.ok(error instanceof OrderNotFoundError)
        assert.strictEqual(error.code, 'ORDER_NOT_FOUND')
        assert.strictEqual(error.orderId, 'order-999')
        return true
      },
    )
    verify(payments)
    verify(events)
  })
})
```

A mock with no expectations, such as `payments` in the `cancel` cases, proves that the module does not touch that port: any call throws immediately. The remainder of this section details the guidelines adopted by this sample.

### Files and pairing

Keep production modules under `src/` and tests under `test/`. Mirror the source path beneath the test root, then add `.test` before the extension:

```text
src/orders/order-service.ts      -> test/orders/order-service.test.ts
src/orders/cart-total.ts         -> test/orders/cart-total.test.ts
src/auth/credential.ts           -> test/auth/credential.test.ts
```

The mapping must be direct and unambiguous:

- Do not co-locate tests under `src/`.
- Do not use `.spec.ts`, `OrderServiceTest.ts`-style class names, or multiple primary test modules for one source module.
- Do not test one source module from a test module paired with another.

When a source module becomes too large for one clear test module, split the source by production responsibility. `cartTotal` is its own module with its own test module for that reason. Do not split tests around private implementation details.

### Grouping cases

Write independent `test()` cases. Use `test()`, not `it()`.

When a module has several exported entrypoints, use one top-level `describe()` block for each entrypoint. The `describe()` name must identify an exported function, an exported class, or a public operation reached through an export, such as `place` and `cancel` in the sample. A module with one exported entrypoint may keep its cases directly at the top level.

- Do not nest `describe()` blocks.
- Do not group cases by private helpers, internal steps, or implementation details.
- Do not use a `describe()` block to share mutable setup.

Each case must receive fresh state and dependencies:

- Prefer construction inside the case, or a factory that returns a new fixture.
- A `beforeEach()` hook may create new per-case instances, but it must not reuse mutable state.
- Do not use `before()` to create state shared by the group.
- Do not keep a mutable fake, store, or production graph in module scope. A stateless stub such as `clock` in the sample may live at module scope.
- If a case needs graph state, use a test harness to construct a fresh real production graph. The harness may assemble production objects, but it must not require test-only hooks in those objects.

Do not commit `test.only()`, `test.skip()`, or `test.todo()`. A skipped or pending case hides a coverage gap.

### Naming cases

Use a short sentence that states the public behavior.

#### Good case names

```ts
test('returns an already cancelled order without rewriting it', async (t) => {
  // ...
})

test('rejects an unknown order', async () => {
  // ...
})
```

#### Bad case names

```ts
test('works', () => {})
test('happy path', () => {})
test('cancel test', () => {})
```

If traceability helps, include a durable requirement or decision ID in the title. Do not put plan, phase, task, or ticket-workflow references in a title. Those labels describe a work session, not lasting behavior.

### Naming values

Name a value after what it is in the production vocabulary. Do not use placeholders such as `result`, `data`, `value`, `instance`, `subject`, `sut`, or a bare `actual`.

- Name the module under test after its production name: `orderService`, `credentialStore`.
- Name the value returned by the module under test after its role: `order`, not `actualOrder` or `result`.
- Name an expected value after the same role with the `expected` prefix when it needs a name: `expectedOrder`. That is the vocabulary of `node:assert`, whose signature is `(actual, expected)` and whose failure output is labelled the same way. Prefer an inline literal when the expected value is short and used once.
- Name a test double after the production role it plays: `orders`, `payments`, `clock`. The kind of double is visible from how it is created (`createFakeOrderStore()`, `mock<Payments>()`, `t.mock.method()`). Do not add `mock`, `fake`, or `stub` to the variable name.
- Name a spy handle after the observed method with the `Spy` suffix: `putSpy`. The handle records calls; it is not the dependency.
- Name the fields of a data row after the parameter and the promised outcome: `{ lines, total }`.

#### Good value names

```ts
// act
const order = await orderService.place(cart())

// assert
assert.deepStrictEqual(order, expectedOrder)
```

#### Bad value names

```ts
// act
const result = await sut.place(data)

// assert
assert.deepStrictEqual(result, expected)
```

### Test layout

Structure every case as arrange, act, assert, and mark each phase with a comment:

- `// arrange`: build values, create doubles, state promised interactions, create the module under test.
- `// act`: invoke the exported behavior and keep its result.
- `// assert`: assert the public result and state, then verify every mock.

Write the comments in lowercase, in that order, and separate the phases with a blank line. Use `// act & assert` only when one `assert.rejects()` or `assert.throws()` expression performs both the action and assertion. Data rows still use separate phases. Do not add other comments to a case unless the setup is not obvious.

```ts
test('stores the cancelled order and publishes order.cancelled', async () => {
  // arrange
  // ...

  // act
  // ...

  // assert
  // ...
})
```

### Assertions

Use assertions from `node:assert/strict`.

#### Assert results and state first

Assert the public result and public state before inspecting an interaction. Do not replace a result assertion with an internal call assertion. If you relocate or rewrite a case, preserve its existing assertions unless the public contract itself changed.

#### Assert whole values

Compare the whole value with `assert.deepStrictEqual()`. Do not assert existence, length, or one property at a time when the complete value is the promise.

#### Good assertions

```ts
assert.deepStrictEqual(order, expectedOrder)
assert.deepStrictEqual(await orders.get('order-123'), expectedOrder)
```

**Bad** (passes for the wrong reasons)

```ts
assert.ok(order)
assert.strictEqual(order.lines.length, 2)
```

**Bad** (brittle and incomplete)

```ts
assert.strictEqual(order.id, expectedOrder.id)
assert.strictEqual(order.total, expectedOrder.total)
assert.strictEqual(order.status, expectedOrder.status)
```

An existence or length assertion is enough only when existence or length is the complete public promise. A standalone negative assertion such as `assert.notStrictEqual()` or `assert.ok(order !== undefined)` keeps passing no matter what the value actually is; assert what the value is instead.

#### Assert errors by type and fields

Assert a typed error class and its structured fields. Do not match a message substring when the error has a stable type and data.

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

Use `assert.throws()` in the same way for synchronous behavior.

#### Assert exact bytes when bytes are the contract

When the public output is a file, packet, archive, encoded value, or rendered bytes, compare the complete bytes. Do not decode or normalize the module's output unless the public contract says consumers do so.

#### Write expected values independently

Build expected values independently from the implementation, adapter result, and test harness under examination.

Do not:

- Call the production formatter to build the expected formatted value.
- Read the adapter result and transform it into the expected result.
- Reuse the module's serializer on both sides of an assertion.
- Ask a harness to compute the answer the module should produce.
- Record the expected value from the implementation with a snapshot assertion.

A case must discriminate the behavior named in its title. A wrong implementation should make the assertion fail.

### Test doubles

Use these terms by their role in the case:

| Term | Use                                                    | Assert                                                      |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Fake | A working, simplified, usually stateful implementation | The public result and resulting state                       |
| Stub | A canned value or error that drives one path           | The module's result, not the stub call count                |
| Spy  | Real behavior with recorded calls                      | Public behavior first. Calls only for explicit observation. |
| Mock | A prescribed interaction                               | The promised calls, order, or arguments                     |

The API name does not decide the role, but use the tool that matches the role. A plain typed object or a function created with `t.mock.fn()` is commonly a stub. A method wrapped with `t.mock.method()` is a spy when it keeps and records real behavior. Use `strong-mock` only when the case prescribes an interaction and will verify it.

Apply strict interaction verification to mocks only. Do not turn a stub into a mock by asserting its call count when the call is not part of the public promise. Do not verify incidental spy calls.

#### Fakes

A fake stands in for a stateful boundary such as a store, a repository, or a remote. `createFakeOrderStore()` in the sample is a fake.

- Name a stateful helper `FakeThing` or `createFakeThing()`.
- Create a fresh fake for each stateful port and each test case.
- Seed the fake through its public contract, as `orders.put(placedOrder())` does in the sample.
- Assert the module's public result and the fake's resulting public state.
- Clone mutable values at fake ingress and egress boundaries with `structuredClone()`.
- Clone values before placing them in a fake's call log.
- Keep the fake faithful to the shared public contract. See [Real and fake adapters sharing a contract](#real-and-fake-adapters-sharing-a-contract).
- Do not let a fake become a second full implementation of the real system.

Do not simulate a database, filesystem, or other stateful system with a graph of mock functions. Use a small stateful fake when the boundary is external. Use the real filesystem in a private temporary directory when filesystem behavior is the contract.

#### Stubs

Use a stub for:

- A fixed clock value.
- A fixed ID.
- A one-shot failure.
- A fixed remote response.
- A controlled feature or capability value.

A stub is usually a plain typed object; `clock` and `ids` in the sample are stubs. Use `t.mock.fn()` when a plain function is not enough, for example to return a sequence of values through `mock.mockImplementationOnce()`.

Assert the module's result. Do not assert a stub's call count unless the call itself is a public promise. A stub exists to drive the path.

#### Good stub

```ts
test('stamps the order with the issued ID', async () => {
  // arrange
  const ids = { next: () => 'order-123' } satisfies OrderIds
  const orderService = createOrderService({ clock, events, ids, orders, payments })

  // act
  const order = await orderService.place(cart())

  // assert
  assert.strictEqual(order.id, 'order-123')
})
```

**Bad** (asserts the stub instead of the behavior)

```ts
test('stamps the order with the issued ID', async (t) => {
  // arrange
  const next = t.mock.fn(() => 'order-123')
  const orderService = createOrderService({ clock, events, ids: { next }, orders, payments })

  // act
  await orderService.place(cart())

  // assert
  assert.strictEqual(next.mock.callCount(), 1)
})
```

#### Spies

Use a spy only when real behavior should still run and the observation itself is the promise: "writes exactly once", "does not rewrite", "invokes the callback for each item". Wrap the real method with `t.mock.method()` and give it no replacement implementation; with a replacement, it is a stub.

```ts
test('returns an already cancelled order without rewriting it', async (t) => {
  // arrange
  const expectedOrder: Order = { ...placedOrder(), status: 'cancelled' }
  const orders = createFakeOrderStore()
  await orders.put(expectedOrder)
  const putSpy = t.mock.method(orders, 'put')
  const orderService = createOrderService({ clock, events, ids, orders, payments })

  // act
  const order = await orderService.cancel('order-123')

  // assert
  assert.deepStrictEqual(order, expectedOrder)
  assert.strictEqual(putSpy.mock.callCount(), 0)
})
```

Call assertions come after public result and state assertions. Read arguments from `putSpy.mock.calls[i].arguments` when the arguments are part of the promise. If the call is not an explicit promise, leave it unasserted.

#### Mocks

Use a mock when the interaction is observable public behavior. Examples include:

- Sending a notification.
- Charging a payment.
- Starting, committing, or rolling back a transaction.
- Invoking a callback.
- Publishing an event.
- Issuing a promised external command.

Assert the promised calls, arguments, and order. Do not use broad argument checks when the module is responsible for the exact value.

##### Make interaction expectations strict

Create interaction mocks with `strong-mock`. Its expectations fail immediately on an unpromised call and are expected once unless the case specifies another count.

Every mock must define its complete promised interaction and be verified explicitly:

- Create a fresh mock inside the case.
- Set `exactParams: true` on the mock. Without it, the mock accepts extra arguments.
- Give the mock a production-role name when that improves a failure message.
- State every allowed call with exact meaningful arguments.
- State a different invocation count only when the public promise requires it. Do not use `anyTimes()`; a call without a definite count is not a promise, and the dependency is a stub.
- Call `verify(mock)` for every mock used by the case.
- Put each `verify()` call at the end of the case, after assertions about public results and state.
- Do not use `verifyAll()`, `resetAll()`, `setDefaults()`, or another process-wide mock registry or configuration.

#### Good interaction mock

```ts
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
```

This pattern fails verification when `charge` or `publish` is omitted. It fails immediately when either is repeated, receives different arguments, or when an unpromised operation is called. `verify()` also reports an unexpected call that production code caught.

**Bad** (passes when the amount or the event is wrong)

```ts
when(() => payments.charge(It.isAny(), It.isAny())).thenResolve(undefined)
when(() => events.publish(It.isAny())).thenResolve(undefined)
```

Do not use `It.isAny()`. Use `It.matches()` or `It.containsObject()` only when an argument cannot be compared structurally, such as a function or a stream, and match every meaningful property of it.

When a case uses several mocks, verify every one explicitly:

```ts
assert.deepStrictEqual(order, expectedOrder)
verify(payments)
verify(events)
```

Do not hide verification in a test hook, shared registry, or generic cleanup function. The verification calls belong in the case that states the promises.

##### Assert order across mocks

If order is part of the promise, record every relevant operation in one shared order log. Replace each promised method with a function that records its call, and record the meaningful arguments too, because the replacement function is no longer checked by `exactParams`:

```ts
test('charges the customer before publishing order.placed', async () => {
  // arrange
  const log: string[] = []
  const orders = createFakeOrderStore()
  const payments = mock<Payments>({ exactParams: true, name: 'payments' })
  const events = mock<OrderEvents>({ exactParams: true, name: 'order events' })
  when(() => payments.charge).thenReturn(async (customerId, amount) => {
    log.push(`charge ${customerId} ${amount}`)
  })
  when(() => events.publish).thenReturn(async (event) => {
    log.push(`publish ${event.type}`)
  })
  const orderService = createOrderService({ clock, events, ids, orders, payments })

  // act
  await orderService.place(cart())

  // assert
  assert.deepStrictEqual(log, ['charge customer-1 25', 'publish order.placed'])
  verify(payments)
  verify(events)
})
```

Compare the shared log with the complete expected order and explicitly verify both mocks. Do not use separate per-method logs to prove order across methods. `strong-mock` does not verify cross-mock order for you.

#### Plain data and loggers

Do not create a double for plain data. A `Cart`, an `Order`, or an `OrderEvent` is a literal; doubles stand in for behavior.

Do not verify logging unless logging is the module's behavior. If a module logs through a `Logger` port, pass a silent stub. Assert log calls only in the module whose job is logging, such as a log formatter or sink.

#### Keep doubles scoped to the case

- Create stubs as plain typed objects, or with the current test context's `t.mock.fn()` when a plain function is not enough.
- Create spies with the current test context's `t.mock.method()`.
- Let the test context restore its tracked methods and timers after the case.
- Create strict interaction mocks with `strong-mock` inside the case.
- Verify each strict interaction mock explicitly at the end of the case.
- Do not import the process-wide Node mock tracker.
- Do not use `strong-mock`'s process-wide verification, reset, or default configuration APIs.
- Register manual resource cleanup with the current `node:test` context through `t.after()`.

Do not use module replacement to isolate a production module. Do not use `t.mock.module()` or a custom loader. Extract or inject the dependency instead. See [Design production code for its tests](#design-production-code-for-its-tests).

### Test data

- Use short placeholder literals whose text says what they are: `'order-123'`, `'customer-1'`, `'sku-a'`. A failure that prints them explains itself.
- Do not use realistic prose, random generators, or long fixture blobs when a placeholder discriminates the behavior.
- Build values as typed literals. Check a hand-built value with `satisfies` when it stands in for a production type.
- Set only what the case is about. Start from a seed and spread the fields that matter: `{ ...placedOrder(), status: 'cancelled' }`.
- Put seeds reused across cases in a seed module for the concern, such as `test/orders/order-seeds.ts`. Export functions that return fresh values, not shared mutable constants.
- Do not compute test data with production code.
- Put static files under the concern they describe, in a `fixtures/` directory only when that concern has enough of them to need one.

#### Good test data

```ts
const orders = createFakeOrderStore()
await orders.put({ ...placedOrder(), status: 'cancelled' })
```

**Bad** (obscures what matters to the case)

```ts
const orders = createFakeOrderStore()
await orders.put({
  id: 'a3f1c9e2-7b44-4d0e-9c21-5e8f0a6b1d77',
  customerId: 'jane.doe+orders@example.com',
  lines: [{ sku: 'ISBN-978-0-13-468599-1', quantity: 1, unitPrice: 42.99 }],
  total: 42.99,
  status: 'cancelled',
  placedAt: new Date(),
})
```

### Data-driven cases

Keep cases as siblings, either at the file's top level or within one exported-entrypoint group. If several data rows follow the same path, create one sibling case for each row:

#### Good data-driven cases

```ts
// test/orders/cart-total.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cartTotal } from '../../src/orders/cart-total.js'

for (const { lines, total } of [
  { lines: [], total: 0 },
  { lines: [{ sku: 'sku-a', quantity: 2, unitPrice: 10 }], total: 20 },
  {
    lines: [
      { sku: 'sku-a', quantity: 2, unitPrice: 10 },
      { sku: 'sku-b', quantity: 1, unitPrice: 5 },
    ],
    total: 25,
  },
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

**Bad** (one case, stops at the first failing row)

```ts
test('totals the lines', () => {
  for (const { lines, total } of rows) {
    // arrange
    const expectedTotal = total

    // act
    const calculatedTotal = cartTotal(lines)

    // assert
    assert.strictEqual(calculatedTotal, expectedTotal)
  }
})
```

Do not put conditional setup in a data loop. Different branches, dependencies, or expected interactions deserve separate named cases.

**Bad** (a conditional hides two behaviors in one case)

```ts
for (const status of ['placed', 'cancelled'] as const) {
  test(`cancels a ${status} order`, async () => {
    // ...
    if (status === 'placed') {
      when(() => events.publish({ type: 'order.cancelled', orderId: 'order-123' })).thenResolve(undefined)
    }
    // ...
  })
}
```

### Type discipline

Run tests under the same module model as production. Do not compile or load tests as CommonJS when production runs as ESM, or the reverse.

Type-check production and test code with strict settings. Do not use `any`, double assertions, or a broad `Partial<T>` cast to hide an invalid test double.

Prefer a small contract owned by the production consumer:

```ts
interface Payments {
  charge(customerId: string, amount: number): Promise<void>
}
```

Use structural typing and `satisfies` to check a hand-built dependency:

```ts
const clock = { now: () => new Date('2026-08-28T10:00:00Z') } satisfies Clock
```

If that object is painful to build, narrow the production contract. Do not silence the compiler.

Interfaces and type aliases do not exist at runtime. Check type-only contracts with the TypeScript compiler in the corresponding test module. Runtime tests still cover all exported runtime behavior.

Await every promise and asynchronous assertion, including `assert.rejects()`. An unawaited operation may outlive the case and make the result unreliable.

### Hermetic tests

A hermetic test controls everything outside the module under test. It can run offline, in any order, and without developer setup.

- Fake external transports: HTTP APIs, message brokers, cloud services, credential or identity providers, remote repositories.
- Do not use live network services or developer credentials.
- Do not fall back to a live service when a fake or local boundary is unavailable.
- Run a real adapter only against a temporary local boundary or a loopback-only service owned by the case.
- Use the real filesystem only in a temporary directory private to the case. See [Filesystem-backed modules](#filesystem-backed-modules).
- Prefer injected configuration over changes to `process.env` or globals. Restore any change through the test context. See [Environment-dependent modules](#environment-dependent-modules).
- Prefer an injected clock over the system clock. Drive timers with the test context, never with real waits. See [Time-dependent modules](#time-dependent-modules).
- Do not run cases that mutate the same process global concurrently.
- Do not add a production reset function to clean up a test mutation.

### Test support organization

Keep test support next to the test modules of the concern it serves, under the mirrored directory. Name each support module for what it does.

Do not create generic dumping grounds such as a root `test/helpers/` full of unrelated modules. Do not group support code only because it helps tests. Group modules only when they serve the same concern.

#### Good support layout

```text
test/
  orders/
    order-service.test.ts
    cart-total.test.ts
    create-fake-order-store.ts
    create-fake-order-store.test.ts
    order-store-contract.ts
    order-seeds.ts
  git-transport/
    create-fake-git-transport.ts
    git-command-log.ts
    fixtures/
      empty-repository.bundle
```

#### Bad support layout

```text
test/
  helpers/
  utils/
  mocks/
  shared/
```

Put static fixture data under the concern it describes. Use a `fixtures/` directory only when that concern has enough static files to need one. Put a single fixture in a clearly named module or file near its consumer.

## Unit testing patterns

### Design production code for its tests

A test may use only what any other consumer can use: the module's exports. It may not replace modules, reach private members, or ask for a hook. This is deliberate. When a module cannot be tested through its exports, the test is not made cleverer; the production design changes, and the only permitted changes are modularity improvements.

Do not:

- Export a symbol specifically for a test.
- Add a private export, reset hook, global mutator, or state reader for a test.
- Use bracket access, `as any`, or another bypass to reach a private member.
- Expose production state only to help a test harness inspect it.
- Change production results, add test modes, or weaken encapsulation.

Assert a private rule through the public export that uses it.

TypeScript has no ubiquitous injection mechanism, so a dependency is explicit only when the code makes it so. Make dependencies explicit in one of these forms:

- A parameter on a function: `deferPublish(events, event, 500)`.
- A dependencies object on a factory function, captured by closure: `createOrderService({ clock, events, ids, orders, payments })`.
- A constructor parameter, when the codebase uses classes.

These are hidden dependencies, and each makes the module untestable through its exports:

**Bad** (nothing here can be controlled from a test)

```ts
import { randomUUID } from 'node:crypto'
import { broker } from '../broker.js'
import { db } from '../db.js'

export async function placeOrder(cart: Cart): Promise<Order> {
  const order = { id: randomUUID(), placedAt: new Date(), /* ... */ }

  await db.orders.insert(order)
  await broker.publish({ type: 'order.placed', orderId: order.id })

  return order
}
```

**Good** (the sample's `createOrderService`)

```ts
export function createOrderService({ clock, events, ids, orders, payments }: OrderServiceDependencies) {
  // ...
}
```

Make exactly one of these changes when a module resists testing:

1. **Extract a coherent concern.** If an inner concern produces a separate result, move it into a production module with a real production name and API. It then gets its own corresponding test module. `cartTotal` in the sample is such an extraction.
2. **Make an existing dependency explicit.** Turn an imported singleton, an inline `new Date()`, `Date.now()`, `randomUUID()`, or a `process.env` read inside logic into a parameter or a dependency-object member.
3. **Inject a side-effecting port through a narrow production contract.** Declare the interface in the consumer module (`Payments`, `OrderEvents`) and describe the production role, not the needs of a mock library. Adapters satisfy it structurally.
4. **Remove hidden global state from the production design.** Replace a module-level `let` cache or registry with state owned by an instance that a factory creates.

Do not hide a dependency behind a default parameter that reaches a live boundary. Wire real adapters in one composition module. Constructing a service or adapter must not open a connection, read a file, or start a timer; only its operations do. Otherwise the composition module cannot have a hermetic test of its own.

### Type-only modules

A type-only production module still needs a corresponding test module. That test module owns the compile-time contract and is checked by `npm run check`; `node --test` runs it as a module with no cases. Do not add runtime exports or meaningless runtime assertions to make the pair look active.

```ts
// test/orders/order-event.test.ts
import type { OrderEvent } from '../../src/orders/order-event.js'

void ({ type: 'order.placed', orderId: 'order-123', total: 25 } satisfies OrderEvent)
void ({ type: 'order.cancelled', orderId: 'order-123' } satisfies OrderEvent)

// @ts-expect-error an event carries its discriminant
void ({ orderId: 'order-123' } satisfies OrderEvent)
```

### Barrel modules

Prefer importing concrete modules over an `index.ts` that only re-exports them. When a barrel exists, it is a production module with a paired test module. That test module imports through the barrel and asserts that each runtime re-export is the same binding as its source export with `assert.strictEqual()`. The compiler checks re-exported types when the test module imports them.

### Filesystem-backed modules

Use the real filesystem when the module's public behavior includes stored files, paths, configuration discovery, permissions, encoding, or rendered bytes.

Create one temporary directory for each case with `mkdtemp`. Remove it when the case ends, in a `finally` block or through `t.after()`.

```ts
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('returns an order stored by a previous instance', async () => {
  // arrange
  const directory = await mkdtemp(join(tmpdir(), 'file-order-store-'))

  try {
    await createFileOrderStore(directory).put(placedOrder())

    // act
    const order = await createFileOrderStore(directory).get('order-123')

    // assert
    assert.deepStrictEqual(order, placedOrder())
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
```

Do not share a temporary directory across cases. Do not write into the repository, the user's home directory, or a fixed system path.

### HTTP adapters

If a production HTTP adapter must be isolated at the `fetch` boundary, replace `fetch` with `t.mock.method()`.

Return a fresh `Response` for every call. A response body is consumable state and must not be reused.

```ts
test('rejects a declined charge with the decline reason', async (t) => {
  // arrange
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ status: 'declined', reason: 'insufficient_funds' }), {
      headers: { 'content-type': 'application/json' },
      status: 402,
    }))
  const payments = createHttpPayments('http://payments.local')

  // act & assert
  await assert.rejects(
    () => payments.charge('customer-1', 25),
    (error: unknown) => {
      assert.ok(error instanceof PaymentDeclinedError)
      assert.strictEqual(error.reason, 'insufficient_funds')
      return true
    },
  )
})
```

The context restores `fetch` after the case. When the request the adapter sends is itself the promise, read the recorded `Request` from the replaced function's `mock.calls` and assert its method, URL, headers, and body.

### Time-dependent modules

Prefer an injected `Clock` when the module needs the current time; `clock` in the sample is a stub for it.

When the module's behavior is scheduling itself, such as a timeout, a retry delay, or a debounce, enable the context's fake timers and advance time explicitly:

```ts
test('publishes once the delay has elapsed', async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const event = { type: 'order.placed', orderId: 'order-123', total: 25 } as const
  const events = mock<OrderEvents>({ exactParams: true, name: 'order events' })
  when(() => events.publish(event)).thenResolve(undefined)

  // act
  const published = deferPublish(events, event, 500)
  t.mock.timers.tick(500)
  await published

  // assert
  verify(events)
})
```

Enable only the timer APIs the module uses. Do not fake `Date` to fix the current time when an injected clock would do. The context resets the timers after the case. Do not `await` a real timer or poll in a test.

### Environment-dependent modules

Prefer a module that takes its configuration as a parameter, so no case needs to touch `process.env`:

#### Good environment boundary

```ts
assert.deepStrictEqual(loadOrdersConfig({ ORDERS_DIR: '/srv/orders' }), { directory: '/srv/orders' })
```

When a case must change `process.env` or a global, save the old value and register restoration with `t.after()` before acting:

```ts
test('reads the orders directory from ORDERS_DIR', async (t) => {
  // arrange
  const previous = process.env.ORDERS_DIR
  t.after(() => {
    if (previous === undefined) {
      delete process.env.ORDERS_DIR
    } else {
      process.env.ORDERS_DIR = previous
    }
  })
  process.env.ORDERS_DIR = '/srv/orders'

  // act
  const config = loadOrdersConfig()

  // assert
  assert.deepStrictEqual(config, { directory: '/srv/orders' })
})
```

Do not run cases that mutate the same process global concurrently. Do not add a production reset function to clean up a test mutation.

### Real and fake adapters sharing a contract

A real adapter and its fake must promise the same public behavior. Verify that promise with one shared contract.

Place the contract in a module named for the concern, next to the fake and the adapter tests:

```text
src/orders/file-order-store.ts            -> test/orders/file-order-store.test.ts
test/orders/create-fake-order-store.ts    -> test/orders/create-fake-order-store.test.ts
test/orders/order-store-contract.ts
```

Do not place contracts in a generic `test/helpers/` directory.

```ts
// test/orders/order-store-contract.ts
import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import type { OrderStore } from '../../src/orders/order-service.js'
import { placedOrder } from './order-seeds.js'

export function orderStoreContract(createOrderStore: (t: TestContext) => Promise<OrderStore>): void {
  test('returns undefined for an unknown order', async (t) => {
    // arrange
    const orders = await createOrderStore(t)

    // act
    const order = await orders.get('order-999')

    // assert
    assert.strictEqual(order, undefined)
  })

  test('returns a stored order', async (t) => {
    // arrange
    const orders = await createOrderStore(t)
    await orders.put(placedOrder())

    // act
    const order = await orders.get('order-123')

    // assert
    assert.deepStrictEqual(order, placedOrder())
  })

  test('overwrites an order with the same ID', async (t) => {
    // arrange
    const orders = await createOrderStore(t)
    await orders.put(placedOrder())
    await orders.put({ ...placedOrder(), status: 'cancelled' })

    // act
    const order = await orders.get('order-123')

    // assert
    assert.deepStrictEqual(order, { ...placedOrder(), status: 'cancelled' })
  })

  test('does not share a stored order with the caller', async (t) => {
    // arrange
    const orders = await createOrderStore(t)
    const stored = placedOrder()
    await orders.put(stored)
    stored.status = 'cancelled'

    // act
    const order = await orders.get('order-123')

    // assert
    assert.deepStrictEqual(order, placedOrder())
  })
}
```

```ts
// test/orders/create-fake-order-store.test.ts
import { describe } from 'node:test'
import { createFakeOrderStore } from './create-fake-order-store.js'
import { orderStoreContract } from './order-store-contract.js'

describe('createFakeOrderStore', () => {
  orderStoreContract(async () => createFakeOrderStore())
})
```

```ts
// test/orders/file-order-store.test.ts
describe('createFileOrderStore', () => {
  orderStoreContract(async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'file-order-store-'))
    t.after(() => rm(directory, { recursive: true, force: true }))

    return createFileOrderStore(directory)
  })

  test('stores each order as a JSON file named by ID', async () => {
    // adapter-specific case
  })
})
```

#### Contract rules

- Invoke the same contract from the real adapter test and the fake test.
- Keep adapter-specific cases in each adapter's corresponding test module.
- Give every contract case a fresh adapter instance.
- Limit the contract to public behavior promised by both implementations.
- Configure scenarios through controlled inputs, not expected outputs.
- Do not share mutable objects across stored, returned, or call-log boundaries.
- Clone mutable values at fake ingress and egress boundaries.
- Run real adapters only against temporary or loopback-only local boundaries.
- Do not fall back to a live service in a contract case.
- Do not replace corresponding-test ownership with a generic adapter integration suite.

The contract should cover every applicable behavior, including:

- Missing values.
- Aliasing.
- Overwrite behavior.
- Ordering.
- Deletion.
- Validation.

If a category does not apply, record the reason in the concern's capability table. Do not omit it silently.

#### Prove the contract can fail

Run each shared contract against a deliberately broken fake. Require the broken fake to fail the exact intended case.

Write the negative-control expectation independently from the contract implementation. A copied condition can repeat the same mistake and create a false proof.

Keep the broken fake private to the negative-control test. Do not let it become a supported fake.

Record every required real and fake contract participant in a typed inventory. A missing participant must fail type checking or the structural gate.

## Completion checklist

A unit-test change is complete when:

- [ ] Every changed production `.ts` module, including type-only and barrel modules, has one corresponding `.test.ts` module.
- [ ] Each test uses exported production behavior only.
- [ ] No production export, reset hook, mutator, or state reader was added for testing.
- [ ] Any production refactor created a coherent module, an explicit dependency, a narrow port, or removed hidden global state.
- [ ] Tests use independent `node:test` cases and `node:assert/strict`, with no `only`, `skip`, or `todo`.
- [ ] Every case marks its phases with `// arrange`, `// act`, and `// assert`; `// act & assert` appears only for one throwing/rejection expression.
- [ ] Any `describe()` block is top-level, names an exported entrypoint, and owns no shared mutable state.
- [ ] Each stateful case gets fresh dependencies and fresh graph state.
- [ ] Case titles state public behavior; values and doubles are named after their production role.
- [ ] Fakes, stubs, spies, and mocks are chosen and asserted according to their roles.
- [ ] Plain data is a literal, not a double; logging is not verified outside a logging module.
- [ ] Every mock is created with `strong-mock`, uses exact parameters, states its complete promised interaction, and uses no `It.isAny()` or `anyTimes()`.
- [ ] Every mock has an explicit `verify(mock)` call at the end of its case.
- [ ] Every `t.mock` function, method, or timer double comes from the current test context.
- [ ] No module replacement or process-wide mock tracker is used.
- [ ] Test data is small, named after what it is, and built from seeds that return fresh values.
- [ ] Filesystem behavior uses one temporary directory per case and cleans it up through `finally` or `t.after()`.
- [ ] External transports are fake, local, or loopback-only.
- [ ] Every replaced `fetch` call returns a fresh `Response`.
- [ ] Time comes from an injected clock or the context's fake timers, never from a real wait.
- [ ] Environment and global changes are restored through the test context.
- [ ] Public results and state are asserted before promised interactions.
- [ ] Whole values are compared; typed errors are asserted by class and structured fields.
- [ ] Expected values are independent from production and harness computations.
- [ ] Shared support is organized by concern, with no generic helper dumping ground.
- [ ] Real and fake adapters pass the same public contract.
- [ ] Contract and structural gates have a proven negative control.
- [ ] The focused source-test pair has 100% direct function, line, and branch coverage.
- [ ] No coverage exception, ignore directive, or blanket exclusion was added.
- [ ] Focused `node --test`, direct coverage, and `npm run check` pass.

## References

- [Node.js test runner](https://nodejs.org/api/test.html)
- [Node.js mock timers](https://nodejs.org/api/test.html#class-mocktimers)
- [Node.js strict assertions](https://nodejs.org/api/assert.html#strict-assertion-mode)
- [Node.js filesystem APIs](https://nodejs.org/api/fs.html)
- [`strong-mock`](https://github.com/NiGhTTraX/strong-mock)
- [TypeScript strictness](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#strictness)
- [TypeScript structural type compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)
- [TypeScript `satisfies`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)
- [Fallow configuration](https://fallow.tools/docs/configuration/overview/)
