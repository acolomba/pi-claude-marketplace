---
phase: 260619-9ul
plan: 01
type: execute
status: complete
branch: features/v1.13-hook-bridge
---

# 260619-9ul Summary: Apply PR #60 review findings

One-liner: 9 of 10 PR-#60 review findings landed across 6 atomic
commits on `features/v1.13-hook-bridge`; Finding #7
(lenient-arm `supported: boolean` split) deliberately deferred --
splitting it would force a `BUCKET_A_EVENTS_SET` import from
`domain/components/hook-events.ts` into `shared/notify.ts` and
break the `shared/` -> `domain/` layering fence that
`import-x/no-restricted-paths` enforces.

## Commits

| # | Hash      | Title                                                                                  |
|---|-----------|----------------------------------------------------------------------------------------|
| A | `49349c5` | refactor(info): re-assert NFR-10 containment in info path-helper                       |
| B | `315b903` | fix(info): narrow lenient hooks reader catches + skip empty event keys                 |
| C | `18762ab` | refactor(info): drop dead groupCount from HookSummaryEntry lenient arm                 |
| D | `806368d` | docs(info): enumerate both buildNotInstallablePathRowFields call sites                 |
| E | `b7a9075` | docs(catalog): strip planning tokens from `(will enable)` row                          |
| F | `3097a1d` | test(info,enable-disable): symmetric EACCES + byte-lock skipped tests                  |

## Findings mapping

| Finding | Disposition  | Commit |
|---------|--------------|--------|
| #1 NFR-10 containment in `derivePluginRootForInfo`           | applied  | A |
| #2 `(will enable)` planning-token cleanup (output-catalog)   | applied  | E |
| #3 Narrow `readLenientHookSummary` catches                   | applied  | B |
| #4 Drop `groupCount` from HookSummaryEntry lenient arm        | applied  | C |
| #5 Lenient reader docblock scope rewrite                      | applied  | B (rolled into the catch-narrowing commit; both edits the same docblock) |
| #6 Narrow `buildNotInstallablePathRowFields` try-block        | applied  | A |
| #7 Lenient-arm `supported: boolean` split                     | deferred | (rationale below) |
| #8 Enumerate `buildNotInstallablePathRowFields` call sites    | applied  | D |
| #9 Skip empty-string event keys                                | applied  | B |
| #10a Symmetric EACCES test on the `(installed)` arm           | applied  | F |
| #10b Byte-lock test for `⊘ foo (skipped) {already disabled}` | applied  | F |

## Finding #7 (deferred)

Status: deliberate defer.

Finding #7 asked whether `HookSummaryEntry`'s lenient arm should split
into `kind: "lenient-supported"` / `kind: "lenient-unsupported"` rather
than carrying a `supported: boolean` discriminator-payload.

Rejected because the split forces one of two equally costly options
and both break the project's import layering:

1. Recompute `supported` at render time in `appendHooksBlock`
   (`shared/notify.ts`). This requires importing
   `BUCKET_A_EVENTS_SET` -- defined in
   `extensions/pi-claude-marketplace/domain/components/hook-events.ts`
   -- from a `shared/` module. The ESLint `import-x/no-restricted-paths`
   rule explicitly fences `shared/ -> domain/`; the renderer would
   either have to re-define the bucket-A list (drift risk) or break
   the layering fence (forbidden).
2. Split the union into two `kind` arms emitted by the reader. The
   reader would still compute `supported` (it owns the bucket-A
   membership check); the type churn would propagate into every
   consumer of `HookSummaryEntry` (the renderer's switch, the test
   fixtures, the doc block). The cost-to-benefit is poor: the field
   is read exactly once, in the renderer's lenient-arm branch.

The `supported: boolean` payload is the simplest expression of "the
reader knows this fact and the renderer needs it." Document and move
on; if the layering fence is ever relaxed for legitimate reasons, the
split becomes cheap and can be done then.

## Pre-existing edits preserved unstaged

Confirmed: `git diff c4d1a4b..HEAD -- README.md docs/hooks.md` returns
zero bytes. The pre-existing uncommitted edits to `README.md` and
`docs/hooks.md` were NOT staged and remain in the working tree.

## Verification

- `npm run check` green for every commit. The single pre-existing
  failing test (`docs/hooks.md ships all 6 worked-example sections`)
  is caused by the unstaged `docs/hooks.md` edits and is out of scope
  for this dispatch.
- `sed -n '144,145p' docs/output-catalog.md | grep -E 'Phase 5[0-9]|Pitfall 5[0-9]'`
  returns no hits -- L144 (`(will enable)`) cleaned, L145
  (`(will disable)`) was already clean.
- `grep -rn 'groupCount' extensions/pi-claude-marketplace/shared/
  extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
  returns only the two local-variable references inside the
  lenient reader's empty-groups gate (not stored on emitted entries).
- Both new tests pass individually under `node --test`.

## Self-Check: PASSED

- All 6 commits present on `features/v1.13-hook-bridge`:
  `49349c5`, `315b903`, `18762ab`, `806368d`, `b7a9075`, `3097a1d`.
- Touched files match the plan: `info.ts`, `notify.ts`,
  `docs/output-catalog.md`, `info.test.ts`, `enable-disable.test.ts`,
  plus the test-fixture cleanup in `tests/shared/notify-v2.test.ts`
  forced by the `HookSummaryEntry` shape change.
- No `Phase NN` / `Pitfall N` / `Plan NN` tokens introduced in any
  NEW or EDITED comment, test title, or doc row in this stack.
