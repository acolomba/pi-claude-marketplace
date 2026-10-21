---
phase: 09-url-source-kind-and-https-git-stand-in
fixed_at: 2026-10-21T01:25:00Z
review_path: .planning/phases/09-url-source-kind-and-https-git-stand-in/09-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 09: Code Review Fix Report

**Fixed at:** 2026-10-21T01:25:00Z
**Source review:** .planning/phases/09-url-source-kind-and-https-git-stand-in/09-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 3 (fix scope `critical_warning`; the 8 Info findings are out of scope)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: The `@github` info row still adds at `#stable`, so lifting `@github` turns it red because of D-16

**Files modified:** `features/marketplace/info.feature`
**Commit:** 37da6163
**Applied fix:** The `@github` Examples row of "Info shows the source identity and description" now adds `acme/tools#main` and expects `source ref` = `main`, the same ref as the `@url` row (D-17). Lifting `@github` no longer needs a feature edit.

### WR-02: Six feature descriptions still say "local marketplaces in place of published ones" though their `@url` rows now run against the https git host

**Files modified:** `features/marketplace/add.feature`, `features/marketplace/autoupdate.feature`, `features/marketplace/info.feature`, `features/marketplace/remove.feature`, `features/marketplace/update.feature`, `features/plugin/cross-scope-install.feature`
**Commit:** 962f57b1
**Applied fix:** Each description now says the scenarios "use local marketplaces and a loopback https git host in place of published ones". Line counts stayed the same: three lines each, and four for `cross-scope-install.feature`, which already had four. I checked every feature with an `@url` block. `git-source.feature` already names only the git host, and it has no local rows.

### WR-03: The `answer()` promise in the stand-in is `void`ed, and `writeResponse` and the parsed status sit outside its `try`

**Files modified:** `features/lib/https-git-host/cgi.ts`, `features/lib/https-git-host/server.ts`, `tests/architecture/https-git-host-cgi.test.ts`
**Commit:** 5acaac75
**Applied fix:**

- `parseCgiResponse` reads the `Status` line through a new `statusCode` helper. The helper throws `Error('the CGI response status "<value>" is not an HTTP status')` when the value does not parse to an integer from 100 to 999.
- `answer()` now runs the URL build, `cgiEnvironment` (and so its `decodeURIComponent`), the CGI run, the parse, and `writeResponse` inside one `try`. This also closes the security audit's informational note about `cgiEnvironment` running before the `try`.
- A new `answerServerError` helper handles the catch. It logs 500. If headers have not gone out, it removes any header the CGI response had already appended, then answers 500. If headers did go out, it destroys the response.
- `answer()` can no longer reject, so the `void` in `receive()` stays. I did not add a second `.catch` there, because it would guard a path that cannot happen.
- New whole-value unit cases in `tests/architecture/https-git-host-cgi.test.ts`:
  - `assert.throws` with `{ name, message }` for the statuses `Not Found`, `99 Low`, and `1000 High`.
  - Edge cases `100` and `999`, compared with `deepStrictEqual` against the whole response.

## Verification

All checks ran in the **main checkout** (`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests`, branch `features/cucumber-behavioral-tests`). No isolated worktree was used (see the note below), so these results can be reproduced from the tree as committed. I captured every exit status directly.

- `npm run check:features`: exit 0 after WR-01 and after WR-02. It dry-runs the excluded `@github` row.
- `node --test tests/architecture/https-git-host-cgi.test.ts`: exit 0, 14 of 14 pass (9 existing cases and 5 new).
- `npm run typecheck`: exit 0. `npx eslint --max-warnings 0` on the three WR-03 files: exit 0.
- `npm run test:cucumber -- features/marketplace/url-source.feature features/marketplace/url-source-update.feature features/marketplace/git-source.feature features/marketplace/info.feature --parallel 1`: exit 0, 34 of 34 scenarios and 274 of 274 steps pass.
- Live probe (a scratch script, not committed): I started `HttpsGitHost` on a temp root and sent `GET /acme/%zz.git/info/refs`. The response was `500`, and the log recorded `{"method":"GET","path":"/acme/%zz.git/info/refs","status":500}`. The process exited 0. Before the fix, this request rejected the voided promise.
- Each commit's hook passed: `npm run check:commit` and gitlint. `git status` was clean after each commit, so prettier rewrote nothing.
- I did not run the full `npm run check`. The phase gate owns that run.

**Isolation note:** `workflow.use_worktrees` is `true`, but I edited and committed in this checkout on purpose, for three reasons:

1. `$main_repo` (the first line of `git worktree list`) is `/home/acolomba/pi-claude-marketplace`, which has `main` checked out. The prescribed cleanup step, `git -C "$main_repo" merge --ff-only`, would have fast-forwarded `main`, and AGENTS.md forbids commits to `main`.
2. A fresh worktree has no `node_modules`. The commit hook (`check:commit`) and the cucumber and typecheck runs the orchestrator asked for all need it.
3. `.claude/worktrees/` is not gitignored in this repository.

The tree was clean at the start. I staged only explicit paths and committed with the pathspec form (`git commit -F <msg> -- <paths>`).

---

_Fixed: 2026-10-21T01:25:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
