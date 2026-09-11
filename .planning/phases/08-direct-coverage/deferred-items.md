# Deferred items — phase 08

Out-of-scope discoveries logged during execution. Each names the plan that should absorb it.

## `.planning/WINDOWS.md` table/JSON desync blocks every `windows` verb

**Found during:** 08-02, closing the ledger entries this plan resolved.

`node .claude/gsd-core/bin/gsd-tools.cjs windows fixed <id>` refuses with:

```
Error: Ledger table in .planning/WINDOWS.md disagrees with the fenced JSON entries
(the sole source of truth) for row id(s): 30, 9.
```

Rows 9 and 30 are unrelated to this plan (`orchestrators/reconcile/apply.ts` and
`scripts/test-coverage-direct.mjs`); `git log -- .planning/WINDOWS.md` shows the file was
last written by `697d6812`, so the desync predates phase 08. Both rows read `open` in the
JSON, so the disagreement is in the rendered description text, not in status. The fix is to
edit the fenced JSON block for those two rows and let the verb regenerate the table — never
to hand-edit the table.

**Consequence for 08-02:** entries 19, 21, and 22 are now false. Each records one of the
three unreachable arms this plan deleted, each says "closes only by a production rewrite",
and the rewrite has landed. They remain `open` because the verb that would close them is
blocked.

**Who should absorb it:** whichever plan next writes `.planning/WINDOWS.md`. 08-08 is the
natural home — it already owns the stale `CONTRIBUTING.md` shortfall rows for the same three
modules, so one plan can retire both records of the same removed defect.
