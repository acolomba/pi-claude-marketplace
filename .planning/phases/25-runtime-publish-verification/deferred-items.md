# Phase 25 -- Deferred Items (out-of-scope discoveries)

Logged during plan 25-01 execution. These are NOT fixed by this plan (SCOPE
BOUNDARY: only auto-fix issues directly caused by the current task's changes).

| Item | Discovered | Scope | Notes |
|------|-----------|-------|-------|
| `tests/e2e/import-command.test.ts` 3 failures (`import imports enabled Claude settings across both scopes`, `import --scope project narrows writes to project scope`, `import reports source mismatches and skips dependent plugins`) | Task 1 (`npm run test:e2e`) | pre-existing on the gsd/v1.3-replan-catalog baseline; unrelated to SNM-37 | The `import` summary regex expects a `Claude plugin import summary` header that the current `import` output no longer emits (it renders the v2 marketplace block grammar instead). This is the `import` command surface, not the source-load runtime smoke. The SNM-37-relevant test 13 (`real Pi runtime package bin loads the extension under isolated HOME and cwd`) PASSES. Track for a separate `/gsd-debug` of the `import` command summary contract. `tests/e2e/**` is excluded from `npm run check`, so this does not gate Phase 26's GREEN bar. |
