# Common boundaries

Part of the `typescript-unit-tests` skill: `.agents/skills/typescript-unit-tests/SKILL.md`.

**Type-only modules.** The paired test module holds `satisfies` checks and `@ts-expect-error` negatives; `node --test` runs it with zero cases. Do not add runtime assertions to make it look active.

```ts
void ({ type: "order.placed", orderId: "order-123", total: 25 } satisfies OrderEvent);
// @ts-expect-error an event carries its discriminant
void ({ orderId: "order-123" } satisfies OrderEvent);
```

**Barrels.** Prefer importing concrete modules. An existing `index.ts` gets a test module that asserts each runtime re-export is the same binding as its source with `assert.strictEqual()`.

**Filesystem.** Use the real filesystem when stored files, paths, permissions, encoding, or rendered bytes are the behavior. Create one `mkdtemp(join(tmpdir(), "file-order-store-"))` per case and remove it with `rm(directory, { recursive: true, force: true })` in `finally` or `t.after()`. Do not share a directory across cases or write into the repository, the home directory, or a fixed path.

**HTTP adapters.** Replace `fetch` with `t.mock.method(globalThis, "fetch", async () => new Response(body, { status, headers }))`, returning a fresh `Response` on every call. When the request is the promise, assert its method, URL, headers, and body from the recorded `Request` in `mock.calls`.

**Time.** Prefer an injected `Clock`. When scheduling itself is the behavior (timeout, retry, debounce), enable only the APIs the module uses with `t.mock.timers.enable({ apis: ["setTimeout"] })`, then `t.mock.timers.tick(ms)`. Do not fake `Date` when a clock would do. Do not await a real timer or poll.

**Environment.** Prefer configuration passed as a parameter: `loadOrdersConfig({ ORDERS_DIR: "/srv/orders" })`. When `process.env` or a global must change, save the previous value and register restoration with `t.after()` before acting.

**Shared adapter contracts.** A real adapter and its fake pass one contract function (`orderStoreContract(createOrderStore)`) exported from `test/<concern>/<thing>-contract.ts` and invoked from both test modules; adapter-specific cases stay in each adapter's own test module. Give every contract case a fresh instance. Cover missing values, aliasing, overwrite, ordering, deletion, and validation, or record why a category does not apply. Prove the contract fails against a deliberately broken fake kept private to that negative-control test, with its expectation written independently of the contract. Record each real and fake participant in the concern's typed inventory.
