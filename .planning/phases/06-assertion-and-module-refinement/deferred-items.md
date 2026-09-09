# Phase 06 Deferred Items

## 1. Stale notification hub reference outside Plan 06-19 callers

- **Found during:** Plan 06-19 sole-dispatch census
- **File:** `extensions/pi-claude-marketplace/shared/README.md:7`
- **Issue:** The README still names `shared/notify.ts` as the sole direct notification owner, although production TypeScript correctly routes all eight direct calls through `shared/notification-dispatch.ts`.
- **Disposition:** Deferred to the planned final notification-hub cleanup. Plan 06-19 owns only its seven listed callers and does not broaden an import-only migration into unrelated documentation.

## 2. Node 26 direct-coverage negative-control subprocess capture

- **Found during:** Plan 06-39 repository verification
- **File:** `scripts/test-coverage-direct.negative.mjs:134`
- **Issue:** `npm run test:coverage:direct:negative` expects the child process error on `stderr`, but under Node 26 the spawned child returns a non-zero status with an empty captured `stderr`. Running the same child command directly emits the expected `Path is outside the project` error.
- **Disposition:** Pre-existing test-harness/runtime incompatibility outside the update-owner extraction. The positive direct-coverage gates for both new owners pass at 100%, and the negative-control source was unchanged by Plan 06-39.
