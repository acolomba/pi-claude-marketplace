---
quick_id: 261119-jmd
mode: quick
---

# Quick task 261119-jmd: split test/e2e/_helpers.ts by function

The maintainer asked, in review of PR #329, to replace the catch-all
`test/e2e/_helpers.ts` with modules named for one function each.

## Task 1: split the module

- files: `test/e2e/_helpers.ts` (removed) ->
  - `test/platform/mock-pi.ts`: `makeMockPi`, `makeCtx`, and their types. Unit and
    integration tests use it too, so it leaves `test/e2e/`.
  - `test/e2e/upstream-marketplace.ts`: `withE2EEnvironment`, `installTargetWithMockPi`,
    and the upstream checkout.
  - `test/e2e/nightly-classification.ts`: `classifyNightlyFailure`.
  - `test/e2e/pi-runtime-smoke.ts`: `runPiRuntimeSmoke`.
- `test/e2e/_rpc-session.ts` -> `test/e2e/rpc-session.ts`.
- Update every importer and comment that names the old paths.
- verify: `npm run typecheck`, `npm run lint`, `npm run fallow`,
  `npm run test:corresponding`, the moved modules' tests.
