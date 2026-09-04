---
name: typescript-unit-testing-review
description: Review TypeScript unit tests against the project's unit testing rules — pairing, coverage, structure, assertions, test doubles, hermeticity, and testable production design. Use when reviewing or revising test/**/*.ts or the src modules they pair with.
---

# TypeScript unit testing review

Review checks derived from the TypeScript Unit Testing Guidelines. This skill is the review-time counterpart of the `typescript-unit-testing-rule.md` Claude Code rule; the two state the same rules and must not disagree. When revising, produce the rule file's **Good** form.

The central question for every case: **would a plausible wrong implementation still pass it?** Every case must discriminate the behavior named in its title — a wrong implementation makes the assertion fail. A test with weak assertions costs all the maintenance of a test and gives none of the protection; that is the highest-value finding this review can produce.

## Verify with the toolchain

Run `node --test <test-path>` for the module under review, `npm run test:coverage:direct -- <path>` for the source–test pair (`:all` after a shared contract, fake, or harness change), and `npm run check` for the whole gate. A red command, or a review that never ran them, is itself a finding.

## Tools

- Runner, lifecycle, and context doubles come from `node:test`; assertions from `node:assert/strict`; strict interaction mocks from `strong-mock`; coverage from `--experimental-test-coverage`.
- Any other runner, assertion library, or mocking library is a finding. So is importing the process-wide `mock` from `node:test` — doubles use the context's `t.mock`.

## Pairing and coverage

- Every production `.ts` module under `src/` has exactly one `.test.ts` module under `test/` at the mirrored path (`src/orders/order-service.ts` → `test/orders/order-service.test.ts`), and that module owns the source module's exported behavior.
- No exclusions: type-only modules, `index.ts` barrels, and one-function modules all pair. A module not worth a test gets folded into its consumer, not skipped.
- No tests co-located under `src/`, no `.spec.ts`, no source module tested from another module's test. Test support (fakes, seeds, contracts) needs no meta-tests.
- Each source–test pair reaches 100% function, line, and branch coverage **run alone**; aggregate coverage does not count. No coverage exceptions or `/* node:coverage ignore */` — dead code is removed or covered through public behavior.

## Case structure

- Independent `test()` cases — `test()`, not `it()`. No committed `test.only()`, `test.skip()`, or `test.todo()`.
- `describe()` only one level deep, one per exported entrypoint, and only when the module has several; no nesting, no grouping by private helpers, no `describe()` sharing mutable setup.
- Fresh state and dependencies per case, preferably constructed inside the case. `beforeEach()` only creates new per-case instances; no `before()` shared state; only a stateless stub (a fixed `clock`) lives at module scope.
- Titles state public behavior in a short sentence (`'rejects an unknown order'`), never `'works'`, `'happy path'`, or plan/phase/ticket references (a durable requirement ID may appear).
- Phases marked with lowercase `// arrange`, `// act`, `// assert` in order, separated by blank lines — `// act & assert` when they are one expression. No other comments unless setup is not obvious.

## Naming

- Values named after their production role: `orderService`, `order`, `expectedOrder`, `putSpy`, row fields `{ lines, total }`.
- `result`, `data`, `value`, `instance`, `subject`, `sut`, or a bare `actual` is a finding.
- A double is named for its role only (`orders`, `payments`, `clock`) — no `mock`/`fake`/`stub` in the name; how it is created shows the kind.

## Assertions

- The public result and public state are asserted before any interaction check; a call assertion never replaces a result assertion. A relocated case keeps its assertions unless the contract changed — a revision that weakens assertions is a finding even when the tests still pass.
- Whole values compared with `assert.deepStrictEqual()`; asserting existence, length, or one property at a time when the whole value is the promise is a finding. A standalone negative assertion (`assert.notStrictEqual()`, `assert.ok(x !== undefined)`) passes for any value; the test must assert what the value *is*.
- Errors asserted by class and structured fields (`instanceof`, `error.code`, `error.orderId`), not by message substring.
- When bytes are the contract (file, packet, archive, encoded value), the complete bytes are compared, with no decoding or normalizing consumers do not perform.
- Expected values are built independently: no calling the production formatter or serializer, no transforming the adapter result, no asking a harness for the answer, no snapshot assertions.
- Every promise and asynchronous assertion is awaited, including `assert.rejects()` — an unawaited one passes vacuously.

## Test doubles

Check the tool matches the role:

| Role | Use | Assert |
| --- | --- | --- |
| Fake | A working, simplified, stateful implementation | The public result and resulting state |
| Stub | A canned value or error that drives one path | The module's result, not the stub's call count |
| Spy | Real behavior with recorded calls | Public behavior first; calls only when the observation is the promise |
| Mock | A prescribed interaction | The promised calls, arguments, and order |

- A stub with call-count assertions has been turned into a mock — a finding. Incidental spy calls are not verified.
- **Fakes** stand in for stateful boundaries, one fresh per case, seeded through their public contract, `structuredClone()` at ingress and egress; not a graph of mock functions, not a second real implementation.
- **Stubs** are plain typed objects (`{ next: () => 'order-123' } satisfies OrderIds`); `t.mock.fn()` only when a plain function is not enough.
- **Spies** are `t.mock.method(obj, 'name')` with no replacement, only when real behavior must run and the observation is the promise; with a replacement it is a stub.
- **Mocks** are `strong-mock`, only where the interaction is public behavior (charging, publishing, notifying, transaction control, callbacks, commands):
  - created inside the case as `mock<Port>({ exactParams: true, name: '<role>' })` — missing `exactParams` accepts extra arguments;
  - every allowed call stated with exact arguments; `It.isAny()` never; `It.matches()`/`It.containsObject()` only for values that cannot be compared structurally, matching every meaningful property;
  - no `anyTimes()` — a call without a definite count is not a promise; that dependency is a stub;
  - `verify(mock)` for every mock, at the end of the case, after result and state assertions — never hidden in a hook or shared cleanup; no `verifyAll()`, `resetAll()`, `setDefaults()`, or process-wide registry;
  - a mock with no expectations is a legitimate proof that the module does not touch that port.
- `strong-mock` does not check order across mocks; when order is the promise, each promised method is replaced by a recorder pushing into one shared log, the whole log is compared, and every mock is still verified.
- Plain data (`Cart`, `Order`) is a literal, not a double. Logging gets a silent stub; log calls are asserted only in a module whose job is logging.
- Every double comes from the current test context (`t.mock.fn()`, `t.mock.method()`, `t.mock.timers`) or from `strong-mock` inside the case; other cleanup registers with `t.after()`. `t.mock.module()` or a custom loader is a finding — the dependency gets injected instead.

## Test data

- Short self-describing literals (`'order-123'`, `'customer-1'`); no realistic prose, random generators, or long fixture blobs.
- Literals typed, `satisfies`-checked when standing in for a production type, setting only what the case is about: `{ ...placedOrder(), status: 'cancelled' }`.
- Cross-case seeds live in the concern's seed module as functions returning fresh values — never shared mutable constants. No test data computed with production code.

## Data-driven cases

- One sibling `test()` per row via a `for` loop over typed rows, title interpolating the row.
- Rows looped inside one case (stops at first failure) or a conditional in the loop body (different branches belong in separate named cases) are findings.

## Types and hermeticity

- Tests run under the same module model as production with strict type-checking; no `any`, double assertion, or broad `Partial<T>` cast hiding an invalid double — the production contract gets narrowed instead (a consumer-declared port, doubles checked with `satisfies`).
- Cases run offline, in any order, with no credentials or developer setup. HTTP APIs, brokers, cloud services, identity providers, and remote repositories are faked, with no live-service fallback; a real adapter runs only against a temporary local boundary or loopback-only service owned by the case.
- Cases mutating the same process global do not run concurrently. No production reset function added to clean up after a test.

## Test support organization

- Fakes, seeds, contracts, and fixtures sit next to the tests of their concern (`test/orders/create-fake-order-store.ts`). `test/helpers/`, `test/utils/`, `test/mocks/`, or `test/shared/` is a finding. A `fixtures/` directory only where a concern has enough static files to need one.

## Production design for tests

- A test uses only the module's exports. An export, reset hook, global mutator, state reader, test mode, bracket access, or `as any` added for a test is a finding — the production design changes, never the test's access.
- Hidden dependencies (an imported `db`/`broker` singleton, inline `new Date()`, `Date.now()`, `randomUUID()`, a `process.env` read inside logic) are design findings. The fix is exactly one of: extract a coherent concern into a named production module; make the hidden dependency an explicit parameter or dependencies-object member; inject a side-effecting port through a narrow consumer-declared interface; replace module-level mutable state with factory-owned state.
- No parameter defaults to a live boundary; real adapters wire up in one composition module; constructing a service or adapter opens no connection, reads no file, starts no timer — only its operations do.

## Patterns

- **Type-only modules:** the paired test holds `satisfies` checks and `@ts-expect-error` negatives; zero runtime cases is correct — added runtime assertions to look active are a finding.
- **Barrels:** an existing `index.ts` gets a test asserting each runtime re-export is the same binding as its source with `assert.strictEqual()`.
- **Filesystem:** real filesystem when files are the behavior; one `mkdtemp` per case, removed with `rm(..., { recursive: true, force: true })` in `finally` or `t.after()`; no shared directories, no writes into the repository, home directory, or a fixed path.
- **HTTP adapters:** `fetch` replaced with `t.mock.method(globalThis, 'fetch', ...)` returning a **fresh** `Response` per call; when the request is the promise, its method, URL, headers, and body are asserted from the recorded `Request`.
- **Time:** an injected `Clock` preferred; `t.mock.timers.enable({ apis: [...] })` plus `tick()` only when scheduling itself is the behavior; faking `Date` when a clock would do, awaiting a real timer, or polling is a finding.
- **Environment:** configuration passed as a parameter; a mutated `process.env` or global saves the previous value and registers restoration with `t.after()` before acting.
- **Shared adapter contracts:** a real adapter and its fake pass one contract function invoked from both test modules; every contract case gets a fresh instance; the categories (missing values, aliasing, overwrite, ordering, deletion, validation) are covered or their absence recorded; the contract is proven against a deliberately broken fake with an independently written expectation; participants appear in the concern's typed inventory.

## Classifying findings

- **BLOCKER** — the suite lies or breaks: a case a wrong implementation would pass (weak, missing, or replaced assertions; expected values computed by production code; an unawaited async assertion), a changed source module with no paired test module, direct pair coverage below 100%, a hermeticity break (live network, shared global state, leaked filesystem writes), a committed `only`/`skip`/`todo`, or a test-only hook added to production code.
- **WARNING** — structure and readability: naming, AAA comments, `describe()` shape, data style, support organization, double named after its kind.
