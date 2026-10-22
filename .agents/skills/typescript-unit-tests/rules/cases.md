# Writing cases

Part of the `typescript-unit-tests` skill: `.agents/skills/typescript-unit-tests/SKILL.md`.

Copy the **Good** form of the reference case below.

## Case structure

- Write independent `test()` cases. Use `test()`, not `it()`.
- When a module has several exported entrypoints, use one top-level `describe()` per entrypoint (`describe("place")`, `describe("cancel")`). A single-entrypoint module keeps cases at the top level. Do not nest `describe()`.
- Do not group by private helpers or use `describe()` to share mutable setup.
- Each case gets fresh state and dependencies. Prefer construction inside the case. `beforeEach()` may create new per-case instances; do not use `before()` for shared state. Only a stateless stub (a fixed `clock`) may live at module scope.
- Do not commit `test.only()`, `test.skip()`, or `test.todo()`.
- Title each case with a short sentence stating public behavior: `"rejects an unknown order"`, not `"works"`, `"happy path"`, or `"cancel test"`. A durable requirement ID may appear; plan, phase, or ticket references may not.
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

### Good

```ts
const clock = { now: () => new Date("2026-08-28T10:00:00Z") } satisfies Clock;
const ids = { next: () => "order-123" } satisfies OrderIds;

describe("place", () => {
  test("charges the customer, stores the order, and publishes order.placed", async () => {
    // arrange
    const expectedOrder = placedOrder();
    const orders = createFakeOrderStore();
    const payments = mock<Payments>({ exactParams: true, name: "payments" });
    const events = mock<OrderEvents>({ exactParams: true, name: "order events" });
    when(() => payments.charge("customer-1", 25)).thenResolve(undefined);
    when(() =>
      events.publish({ type: "order.placed", orderId: "order-123", total: 25 }),
    ).thenResolve(undefined);
    const orderService = createOrderService({ clock, events, ids, orders, payments });

    // act
    const order = await orderService.place(cart());

    // assert
    assert.deepStrictEqual(order, expectedOrder);
    assert.deepStrictEqual(await orders.get("order-123"), expectedOrder);
    verify(payments);
    verify(events);
  });
});
```

A mock with no expectations proves that the module does not touch that port: any call throws immediately.

## Assertions

- Assert the public result and public state before any interaction. Do not replace a result assertion with a call assertion. When relocating a case, preserve its assertions unless the contract changed.
- Compare whole values with `assert.deepStrictEqual()`. Do not assert existence, length, or one property at a time when the whole value is the promise. A standalone negative assertion (`assert.notStrictEqual()`, `assert.ok(order !== undefined)`) passes for any value; assert what the value is.
- Assert errors by class and structured fields, not by message substring:

```ts
await assert.rejects(
  () => orderService.cancel("order-999"),
  (error: unknown) => {
    assert.ok(error instanceof OrderNotFoundError);
    assert.strictEqual(error.code, "ORDER_NOT_FOUND");
    assert.strictEqual(error.orderId, "order-999");
    return true;
  },
);
```

- When bytes are the contract (a file, packet, archive, encoded value), compare the complete bytes. Do not decode or normalize the output unless consumers do.
- Build expected values independently. Do not call the production formatter or serializer, transform the adapter result, ask a harness for the answer, or use a snapshot assertion.
- Await every promise and asynchronous assertion, including `assert.rejects()`.

## Test data

- Short self-describing literals: `"order-123"`, `"customer-1"`, `"sku-a"`. No realistic prose, random generators, or long fixture blobs.
- Typed literals, checked with `satisfies` when they stand in for a production type. Set only what the case is about: `{ ...placedOrder(), status: "cancelled" }`.
- Seeds reused across cases live in the concern's seed module (`test/orders/order-seeds.ts`) as functions that return fresh values, never shared mutable constants.
- Do not compute test data with production code.

## Data-driven cases

Create one sibling `test()` per row with a `for` loop over typed rows and a title that interpolates the row. Do not loop rows inside one case; it stops at the first failure. Do not put a conditional in the loop body; different branches, dependencies, or expectations are separate named cases.

```ts
for (const { lines, total } of [
  { lines: [], total: 0 },
  { lines: [{ sku: "sku-a", quantity: 2, unitPrice: 10 }], total: 20 },
]) {
  test(`totals ${lines.length} line(s) as ${total}`, () => {
    // arrange
    const expectedTotal = total;

    // act
    const calculatedTotal = cartTotal(lines);

    // assert
    assert.strictEqual(calculatedTotal, expectedTotal);
  });
}
```

## Types and isolation

- Run tests under the same module model (ESM or CJS) as production, with strict type-checking. Do not use `any`, a double assertion, or a broad `Partial<T>` cast to hide an invalid double; narrow the production contract instead.
- Prefer a small port declared by the consumer (`interface Payments { charge: (customerId: string, amount: number) => Promise<void> }`) and check hand-built doubles with `satisfies`. Declare its members as properties, not methods: a test reads `payments.charge` as a value, and lint's `unbound-method` rejects that for a method.
- Do not run cases that mutate the same process global concurrently. Do not add a production reset function to clean up after a test.
