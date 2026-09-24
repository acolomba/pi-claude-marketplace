## Deferred Items

- `tests/orchestrators/plugin/install-flow.test.ts:11732` fails
  `@typescript-eslint/require-await` (`npm run lint`): the
  `marketplaceTagProbe: async () => ({ kind: "no-matching-tag", range:
  "^1.0.0" })` fixture callback introduced by plan 09-03's commit
  `71dcea21` (`test(09-03): prove the reload-driven install end to end`) is
  `async` but contains no `await` expression.
  status: resolved (orchestrator commit `14ff68e3`, wave-3 post-merge gate; WINDOWS.md entry #60 marked fixed)
  **What:** `npm run lint` (ESLint) reports one error:
  `Async method 'marketplaceTagProbe' has no 'await' expression`. This is
  the only ESLint finding on the tree; it is not caused by plan 09-04's own
  changes (docs, the catalog fixture, and the type-member contract remap),
  and the file is outside 09-04's declared `files_modified` scope. Fixing
  it here would touch a file plan 09-04 was never scoped to edit and would
  paper over a genuine defect in the plan that introduced it, contrary to
  09-04 Task 3's explicit instruction: "a red step here is a defect of an
  earlier plan and goes back to it, never a pin or an exception added
  here."
  **Resolution:** The callback now returns `Promise.resolve(...)` without an
  `async` keyword. The current typecheck and test suite pass.
