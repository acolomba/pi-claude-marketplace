---
paths:
  - "extensions/pi-claude-marketplace/**/*.ts"
  - "tests/**/*.ts"
  - ".fallowrc.json"
  - ".github/workflows/ci.yml"
  - "eslint.config.js"
  - "package.json"
  - "sonar-project.properties"
---

# Unit-test architecture

When you change production code, tests, or test configuration, apply these rules.

## Place each test with its owner

- Mirror `extensions/pi-claude-marketplace/<path>.ts` at `tests/<path>.test.ts`.
- Give each module with an own runtime-value export one corresponding test module.
- Include compiled validators and message catalogs in this rule.
- If the audit reports no own runtime-value export, exempt a barrel or pure type module.
- Do not infer an exemption from a file name such as `types.ts` or `schema.ts`.
- Put each case beside the exported function whose result the case asserts.
- Treat an import-only relationship as a review lead, not as proof of ownership.
- Call the target module export directly from its corresponding test.
- If a direct export exists, do not claim direct coverage through an entry point.
- If one source module needs several test modules, partition the source by coherent API.
- Do not partition a coherent source module because its test file is large.
- Do not create topic shards such as `<module>.<topic>.test.ts`.
- Put source-tree and configuration invariants in `tests/architecture/`.
- Put cross-module behavior in `tests/integration/`.

## Preserve the production surface

- Exercise exported production behavior only.
- Do not add a private export, reset hook, or global mutator for a test.
- Do not add a name such as `_setXForTest`, `_resetForTest`, or `__test_*`.
- Assert a private rule through the public export that uses it.
- If an inner concern produces a separate result, extract a coherent production module.
- Inject a side-effecting collaborator through a narrow typed production interface.
- Give each stateful case a fresh dependency instance.
- If a case needs graph state, use a test harness to construct a real production graph.
- Do not add production state inspection only to help a test harness.

## Preserve composed behavior

- If a case asserts a real composition, keep the case at the entry test.
- Use composition for joined output, ordered stages, transactions, rollback, locks, or cascade folds.
- Put `COMPOSED-GRAMMAR:` on the comment line immediately before that case.
- Name the stages and explain why no single stage owns the assertion.
- If a direct assertion can own the claim, do not use the marker.
- If a stage claim can be direct, add a case in the corresponding stage test.
- Keep the original entry case without weaker assertions.
- Add reciprocal `DECOMPOSED:` comments to the entry case and the stage case.
- Do not delete the entry case after you add its direct stage pair.

Example:

```ts
// COMPOSED-GRAMMAR: This case spans row rendering and emission because neither stage owns the joined output.
test("the public output keeps the row and trailer together", () => {
  // ...
});
```

## Use accurate test doubles

| Term | Use | Assert |
| --- | --- | --- |
| Fake | A working, simplified, usually stateful implementation | The public result and resulting state |
| Stub | A canned value or error that drives one path | The subject result, not the stub call count |
| Spy | Real behavior with recorded calls | Public behavior first. Calls only for explicit observation. |
| Mock | A prescribed interaction | The promised calls, order, or arguments |

- Name stateful helpers `FakeThing` or `createFakeThing()`.
- Create a fresh fake for each stateful port and each test case.
- Do not simulate a database, filesystem, or Git repository with a graph of mock functions.
- Use a stub for a clock, ID, one-shot failure, or fixed remote response.
- Use a spy only to observe behavior that still runs.
- If an internal call count is not a promise, do not assert it.
- If the interaction is observable public behavior, use a mock.
- Examples include a notification, transaction, callback, or promised external command.
- Use `t.mock.fn()` and `t.mock.method()` from the current `node:test` context.
- Do not import or use a process-wide mock tracker.
- Do not use experimental module replacement to isolate a production module.
- If order is a promise, record all relevant operations in one shared order log.
- Do not use separate per-method logs to prove cross-method order.

## Keep tests hermetic

- Use the real filesystem for state and configuration behavior.
- Create one temporary directory for each case with `mkdtemp`.
- Remove the temporary directory in a `finally` block.
- Fake external transport ports such as Git, credentials, and device-flow HTTP.
- Do not use live network services or developer credentials.
- If a production HTTP adapter needs isolation, replace `fetch` with `t.mock.method()`.
- Return a fresh `Response` for each replaced fetch call.
- Register environment and global restoration with the test context.
- Put static data in `tests/fixtures/`.
- Put reusable fakes, seed builders, and contract definitions in `tests/helpers/`.

## Assert public contracts

- Use flat `test()` cases from `node:test` and assertions from `node:assert/strict`.
- Do not use `describe()` nesting.
- Assert public results and state before you inspect interactions.
- Assert typed error classes and structured fields instead of message substrings.
- If rendered bytes are the public contract, use byte-exact assertions.
- Write expected values independently from the implementation and its harness.
- Do not compute an expected value from the adapter result under examination.
- Make each case discriminate the behavior stated in its title.
- If a structural gate is new, add a planted violation that proves the gate fails.
- If you relocate or rewrite a case, preserve its existing assertions.
- Do not replace a result assertion with an internal call assertion.
- If traceability helps, use durable requirement or decision IDs in titles.
- Do not use GSD phase, plan, wave, task, or pitfall references in titles.

## Meet direct coverage

- Give each source-test pair 100% function, line, and branch coverage in isolation.
- When you measure a source module, run only the corresponding test.
- Inspect only the LCOV record of that source module for the pair decision.
- Do not use aggregate coverage as direct coverage.
- Do not add coverage exceptions, directives, or blanket exclusions.
- Run `npm run test:coverage:direct -- <source-or-test-path>` for a focused pair.
- Run `npm run test:coverage:direct` to select changed pairs automatically.
- Run `npm run test:coverage:direct:all` after shared helper or coverage-infrastructure changes.
- Run the focused `node --test <corresponding-test-path>` command during development.
- Run `npm run check` before completion.

## Keep enforcement fail-closed

- Make a structural gate reject its planted violation and accept the clean tree.
- Do not make invalid, ambiguous, missing, or unmapped input pass silently.
- Do not suppress production dead code as a migration shortcut.
- Configure production-mode Fallow with `deadCode: true`, `health: false`, and `dupes: false`.
- Treat production dead-code findings as migration work, not automatic `ignoreExports` entries.
- If static analysis cannot observe an intentional runtime API, use a narrow documented suppression.
- Name the intentional API and the reason in each suppression.
- If its stated reason no longer applies, remove the suppression.
- Keep the required local and CI gates aligned across all enforced failure classes.

## Share real and fake adapter contracts

- Define shared adapter contracts under `tests/helpers/`.
- Invoke the same contract from the real adapter test and the fake test.
- Keep adapter-specific cases in their corresponding test modules.
- Give every contract case a fresh adapter instance.
- Limit the shared contract to public behavior that both implementations promise.
- Cover missing values, aliasing, overwrite, ordering, deletion, and validation.
- If a category does not apply, record its reason in the capability table.
- Do not share mutable objects across stored, returned, or call-log boundaries.
- Clone mutable values at fake ingress and egress boundaries.
- Configure scenarios through controlled inputs, not through expected outputs.
- Run real adapters against temporary or loopback-only local boundaries.
- Add no live fallback for a hermetic contract.
- Run each contract against a deliberately broken fake.
- Require the broken fake to fail the exact intended case.
- Write the negative-control expectation independently from the contract implementation.
- Record required contract participants in the typed inventory.
- Do not replace corresponding-test ownership with a generic adapter integration suite.
