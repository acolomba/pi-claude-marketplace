# Deferred items — phase 07 (plan 07-01)

Out-of-scope discoveries logged during execution. Each names the plan that found
it and why that plan could not resolve it.

## 1. `.planning/HANDOFF.json` fails `npm run check`'s `format:check` step

- **Found during:** 07-01 Task 2/3, final `npm run check` verification
- **File:** `.planning/HANDOFF.json`
- **Issue:** `prettier --check "**/*.{js,json,ts}"` (the `format:check` script)
  matches this file repo-wide and reports it as not prettier-formatted. The
  file was committed in an earlier, unrelated `wip: phase-07 paused at discuss`
  commit and has nothing to do with TAGS-01/TAGS-03 marketplace tag resolution.
  `git status --short` shows it unmodified relative to HEAD, confirming it
  predates this plan's changes.
- **Why not fixed here:** this plan's `files_modified` list and scope are the
  TAGS-01/TAGS-03 tag-resolution seam; a `.planning/` handoff artifact is
  unrelated. Per the executor's scope-boundary rule, a pre-existing issue in an
  unrelated file is not this plan's to fix.
- **Suggested owner:** whichever plan or cleanup pass next touches
  `.planning/HANDOFF.json`, or a repo-wide `prettier --write` sweep scoped to
  `.planning/`.
- **Impact:** `npm run check`'s composed script exits non-zero solely because of
  this one pre-existing file. Every other step in the pipeline — typecheck,
  lint, lint:workflows(:negative), fallow, test:corresponding(:negative),
  test:coverage:direct:negative, test:coverage:direct:commit,
  `npm test`, `npm run test:integration` — passes cleanly against this plan's
  own changes. Running `npx prettier --check` scoped to only the files this
  plan touched confirms all of them are already correctly formatted.
  status: acknowledged
