# Test doubles

Part of the `typescript-unit-tests` skill: `.agents/skills/typescript-unit-tests/SKILL.md`.

| Role | Use                                            | Assert                                                                |
| ---- | ---------------------------------------------- | --------------------------------------------------------------------- |
| Fake | A working, simplified, stateful implementation | The public result and resulting state                                 |
| Stub | A canned value or error that drives one path   | The module's result, not the stub's call count                        |
| Spy  | Real behavior with recorded calls              | Public behavior first; calls only when the observation is the promise |
| Mock | A prescribed interaction                       | The promised calls, arguments, and order                              |

Use the tool that matches the role. Do not turn a stub into a mock by asserting its call count. Do not verify incidental spy calls.

**Fakes.** `createFakeThing()` stands in for a stateful boundary (store, repository, remote). Create a fresh one per case. Seed it through its public contract: `await orders.put(placedOrder())`. `structuredClone()` values at ingress and egress. Do not simulate a database or filesystem with a graph of mock functions. Do not let a fake grow into a second real implementation.

**Stubs.** A plain typed object (`{ next: () => "order-123" } satisfies OrderIds`) for a fixed clock, ID, one-shot failure, remote response, or capability flag. Use `t.mock.fn()` only when a plain function is not enough, such as a `mockImplementationOnce()` sequence. Assert the module's result, not the stub's calls.

**Spies.** `t.mock.method(orders, "put")` with no replacement, only when real behavior must run and the observation is the promise ("writes exactly once", "does not rewrite"). Read `putSpy.mock.callCount()` and `putSpy.mock.calls[i].arguments` after the result assertions. With a replacement implementation it is a stub.

**Mocks.** `strong-mock`, only when the interaction is public behavior: charging, publishing, notifying, transaction control, invoking a callback, issuing a command.

- Create `mock<Port>({ exactParams: true, name: "<role>" })` inside the case. Without `exactParams` the mock accepts extra arguments.
- State every allowed call with exact arguments: `when(() => payments.charge("customer-1", 25)).thenResolve(undefined)`.
- Do not use `It.isAny()`. Use `It.matches()` or `It.containsObject()` only for a value that cannot be compared structurally (a function, a stream), and match every meaningful property.
- Do not use `anyTimes()`. A call without a definite count is not a promise; that dependency is a stub.
- Call `verify(mock)` for every mock, at the end of the case, after result and state assertions. Do not hide verification in a hook or shared cleanup.
- Do not use `verifyAll()`, `resetAll()`, `setDefaults()`, or any process-wide registry.

`strong-mock` does not check order across mocks. When order is the promise, replace each promised method with a recorder that pushes the meaningful arguments into one shared log, compare the whole log, and still `verify()` every mock:

```ts
const log: string[] = [];
when(() => payments.charge).thenReturn((customerId, amount) => {
  log.push(`charge ${customerId} ${amount}`);
  return Promise.resolve();
});
when(() => events.publish).thenReturn((event) => {
  log.push(`publish ${event.type}`);
  return Promise.resolve();
});
// ...
assert.deepStrictEqual(log, ["charge customer-1 25", "publish order.placed"]);
verify(payments);
verify(events);
```

**Not doubles.** Plain data (`Cart`, `Order`, `OrderEvent`) is a literal. Logging gets a silent stub; assert log calls only in a module whose job is logging.

**Scope.** Every double comes from the current test context (`t.mock.fn()`, `t.mock.method()`, `t.mock.timers`), which restores it after the case, or from `strong-mock` inside the case. Register other cleanup with `t.after()`. Do not replace modules with `t.mock.module()` or a custom loader; inject the dependency instead.
