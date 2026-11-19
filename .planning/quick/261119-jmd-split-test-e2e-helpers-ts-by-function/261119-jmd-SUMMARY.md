---
quick_id: 261119-jmd
status: complete
commit: bcbea72
---

# Quick task 261119-jmd summary

Split the catch-all `test/e2e/_helpers.ts` into modules named for one function
each, at the maintainer's request in review of PR #329.

## Changes

- `test/platform/mock-pi.ts`: `makeMockPi`, `makeCtx`, `NotifyRecord`,
  `RegisteredCommand`, `ResourceDiscoverResult`, `MockPiHarness`. Unit and
  integration tests import it, so it left `test/e2e/`.
- `test/e2e/upstream-marketplace.ts`: `E2EEnvironment`, `withE2EEnvironment`,
  `installTargetWithMockPi`, and the private upstream checkout and rename.
- `test/e2e/nightly-classification.ts`: `classifyNightlyFailure`.
- `test/e2e/pi-runtime-smoke.ts`: `runPiRuntimeSmoke`.
- `test/e2e/_rpc-session.ts` -> `test/e2e/rpc-session.ts`.
- Importers and the `features/lib/pi-runtime.ts` header comment follow.

## Verification

- `npm run typecheck`, `npm run fallow`, `npm run test:corresponding`, ESLint on
  the touched files: pass.
- The importing unit, integration, and e2e tests (102 cases, e2e against the
  pinned upstream): pass.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
