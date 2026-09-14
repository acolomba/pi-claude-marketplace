# Phase 25 -- Deferred Items (out-of-scope discoveries)

Logged during plan 25-01 execution. These are NOT fixed by this plan (SCOPE
BOUNDARY: only auto-fix issues directly caused by the current task's changes).

## 1. `tests/e2e/import-command.test.ts` -- 3 failures

Converted from a one-row table to this bullet shape on 2026-09-13. The text of
every cell is preserved verbatim below. The conversion was needed because the
`audit-open` scanner can READ a table-shaped deferred item but its `acknowledge`
writer matches on literal bullet text, so a table row can be reported open
forever and never acknowledged.

- **Item:** `tests/e2e/import-command.test.ts` 3 failures (`import imports enabled Claude settings across both scopes`, `import --scope project narrows writes to project scope`, `import reports source mismatches and skips dependent plugins`)
- **Discovered:** Task 1 (`npm run test:e2e`)
- **Scope:** pre-existing on the gsd/v1.3-replan-catalog baseline; unrelated to SNM-37
- **Notes:** The `import` summary regex expects a `Claude plugin import summary` header that the current `import` output no longer emits (it renders the v2 marketplace block grammar instead). This is the `import` command surface, not the source-load runtime smoke. The SNM-37-relevant test 13 (`real Pi runtime package bin loads the extension under isolated HOME and cwd`) PASSES. Track for a separate `/gsd-debug` of the `import` command summary contract. `tests/e2e/**` is excluded from `npm run check`, so this does not gate Phase 26's GREEN bar.

> **PROMOTED TO BACKLOG 2026-09-13**, at the `refine-unit-tests` milestone close.
> The `import` e2e failures above are tracked as `E2EIMP-01` in `.planning/BACKLOG.md`.
> Diagnosis unchanged: the three cases assert a `Claude plugin import summary`
> header the command no longer emits, so this is drift in the assertions rather
> than a regression in `import`.
  status: acknowledged
