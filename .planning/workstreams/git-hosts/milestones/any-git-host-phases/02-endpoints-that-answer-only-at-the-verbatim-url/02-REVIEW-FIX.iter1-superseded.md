---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
fixed_at: 2026-09-27T02:03:00Z
review_path: .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-09-27T02:03:00Z
**Source review:** .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (CR-01, CR-02, WR-01..WR-06)
- Fixed: 8
- Skipped: 0
- Deferred (out of `fix_scope: critical_warning`): IN-01, IN-02, IN-03 -- not attempted, per the workflow's Info-tier exclusion. See "Deferred findings" below.

## Fixed Issues

### CR-01: the `url` arm leaves a trailing slash on the wire URL when the slash precedes the `#<ref>` fragment

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`, `tests/domain/source.test.ts`
**Commits:** `d42f7625`, `4be1c19a`
**Applied fix:** Reordered `stripSlashAndFragment` to split off the `#<ref>` fragment first and strip trailing slashes from both the fragment and the remaining base afterward, so a slash sitting before the fragment (`https://host/repo/#v1.0`) no longer survives onto the wire URL. Added the missing `/#ref` test row from the review's suggested fix. A follow-up commit (`4be1c19a`) replaced the fragment's trailing-slash regex with a plain `while` loop after `npm run check` caught a `sonarjs/super-linear-regex` lint violation the regex introduced -- the loop form matches the file's existing style (`ensureGitSuffix`, and the base's own trailing-slash strip two lines below). All 7 pre-existing `stripSlashAndFragment` cases plus the new one pass; `networkCloneUrl`'s consuming tests are unaffected.

### CR-02: the `git-subdir` arm applies no decoration stripping, so a trailing slash or `#<ref>` reaches the remote verbatim

**Files modified:** `extensions/pi-claude-marketplace/domain/clone-key.ts`, `tests/domain/clone-key.test.ts`
**Commit:** `cc7891a5`
**Applied fix:** Routed the `git-subdir` arm of `networkCloneUrl` through `stripSlashAndFragment(source.url).base`, matching the `url` arm. Added the review's suggested test case (`drops a trailing slash and a #<ref> fragment from a git-subdir url`). Verified the pre-existing "verbatim `.git` suffix" case still passes unchanged (the `.git` suffix is untouched by `stripSlashAndFragment`), and that `canonicalCloneUrl` (the D-2-03 cache-key identity) is unmodified.

### WR-01: the `info --fetch` arm of this change is unverifiable -- its fixture admits both URL forms and never asserts one

**File modified:** `tests/orchestrators/plugin/info.test.ts`
**Commit:** `170943f6`
**Applied fix:** Narrowed `ALLOWED_INFO_REMOTES` to the exact wire form `networkCloneUrl` produces for each fixture source (dropped the three `.git` duplicates for `example.com` remotes; kept only the `.git`-suffixed `github.com` form, since the github arm always appends the suffix). Tightened the two `example.com/repo` fetch-hook cases (pinned and unpinned) from `cloneCalls.length >= 1` to `assert.equal(gitState.cloneCalls.length, 1)` plus `assert.equal(gitState.cloneCalls[0]?.url, "https://example.com/repo")`. All 150 cases in the file pass.

### WR-02: no flow-level test discriminates `source.raw` from `source.url`, so the change's central claim is proven only in the pure unit

**Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`, `tests/orchestrators/plugin/reinstall-flow.test.ts`, `tests/orchestrators/plugin/update-flow.test.ts`, `tests/orchestrators/plugin/reinstall-clone-probe.test.ts`
**Commit:** `45791aa7`
**Applied fix:** Gave one existing fixture per flow a manifest `url` field carrying a `.git` suffix (`https://example.com/org/repo.git`, or `https://example.com/cold-mirror.git` for the probe test) so the parser strips it into the parse-time identity (`source.url`, used unchanged for cache-key computations) while `source.raw` keeps the suffix. Added a by-value assertion on the wire URL (`cloneCalls[0]?.url` / the recorded `networkUrl`) at each site, and added the new `.git`-suffixed remote to each file's `allowedRemoteUrls` list.

**Negative-control verification (per the finding's own caution):** for the `install-flow.test.ts` fixture, I temporarily reverted the two `networkCloneUrl(source)` call sites in `install-clone-probe.ts` to `canonicalCloneUrl(source)` and reran the specific test -- the new assertion failed as expected (`actual: 'https://example.com/org/repo'`, `expected: 'https://example.com/org/repo.git'`), then restored the file (confirmed byte-identical via `diff`) and reran the full file to confirm 157/157 green again. This confirms the fixture now discriminates the regression the finding named. The other three sites follow the identical raw/url-splitting mechanism (verified by reading `resolvePluginPin`, `probeReinstallClone`, and `seedGitPluginMarketplace`/`resolveRemoteRef` call sites before editing).

### WR-03: forbidden GSD phase reference in a production comment, narrating code that does not exist

**File modified:** `extensions/pi-claude-marketplace/domain/source.ts`
**Commit:** `f8f25aaf`
**Applied fix:** Deleted the trailing clause naming "Phase 3's same-origin comparison" from `ensureGitSuffix`'s JSDoc, per `skills/typescript-comments/SKILL.md`'s ban on GSD planning-step references and on narrating a consumer not in the tree. The preceding sentence already carries the D-2-01 rule and its decision ID.

### WR-04: the `kind: "url"` object arm reads the identity field as `raw`, silently discarding the typed `.git` the phase set out to preserve

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`, `tests/domain/source.test.ts`
**Commit:** `7649f26e`
**Applied fix:** `urlObjectSource` now prefers `optionalString(obj, "raw") ?? optionalString(obj, "url")`, so re-parsing a persisted `kind: "url"` source (which carries both fields) is idempotent instead of rebuilding `raw` from the already-stripped `url`. Added a data-table row for the stored-object shape and a dedicated round-trip test (`parsePluginSource(parsePluginSource("https://h/r.git")).raw === "https://h/r.git"`) per the review's suggestion.

**Negative-control verification:** temporarily reverted the `urlObjectSource` line back to reading only `obj.url`, reran `tests/domain/source.test.ts` -- both new cases failed with the exact `.git`-dropped value (`actual: 'https://example.com/p'` vs `expected: 'https://example.com/p.git'`), then restored the file (confirmed byte-identical via `diff`) and reran the full suite (108/108 green) plus the broader clone-cache/persistence suites (241/241 green) to rule out any dependency on the old behavior.

### WR-05: the D-2-02 add case asserts the test fake's own message as evidence of a product-facing property

**File modified:** `tests/orchestrators/marketplace/add.test.ts`
**Commit:** `69e8bdbd`
**Applied fix:** Replaced the exact-string assertion against `createGitOpsFake`'s literal wording (`"createGitOpsFake blocked unplanned remote ..."`) with `assert.match(err.message, /https:\/\/gitlab\.example\.com\/team\/git-only-mp/)`. The case still asserts the property the comment promises -- the surfaced failure names the URL actually sent -- without pinning the fixture's own internal message text. The comment above the test needed no change; it already states only the claim now verified. All 66 cases in the file pass.

### WR-06: the github wire URL is still hand-built in `add.ts`, in parallel with the arm that now owns it

**File modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`
**Commit:** `3aceccc0`
**Applied fix:** Removed the hand-built `` `https://github.com/${source.owner}/${source.repo}.git` `` literal in `addGithubInGuard` (it was used only to feed `hostFromCloneUrl` for host extraction) and derived the host from `hostFromCloneUrl(canonicalCloneUrl(source), "github")` instead, matching the pattern already used at `install-clone-probe.ts:56-57`, `fetch.ts:387-388`, and `info.ts:1627-1628`. Added `canonicalCloneUrl` to the existing `clone-key.ts` import. Confirmed `contracts.json`'s pin at `add.ts:540` is unaffected (the edit is below that line, so no line-number shift crosses it) and `npm run lint:type-members` still passes with the expected 4 exceptions.

## Deferred findings (out of scope)

Per `fix_scope: critical_warning`, the following Info-tier findings from 02-REVIEW.md were **not attempted** and remain open for a separate pass:

- **IN-01**: redundant local alias (`const networkUrl = args.networkUrl;`) in `clone-cache.ts:191-193,277-280`.
- **IN-02**: tautological purity case in `tests/domain/clone-key.test.ts:280-296` ("returns the identical string for two consecutive calls with the same source").
- **IN-03**: `CloneOptions.url` docstring in `platform/git.ts:47-51` overstates "verbatim" for `git-subdir` and is now also stale relative to the CR-02 fix landed in this pass (the git-subdir arm now strips decorations too).

## Verification

Verification ran in this worktree (`/home/acolomba/src/pi-claude-marketplace-pr-153`, branch `features/git-hosts`), the same tree the fixes were committed to -- per the task's explicit `git_branch_invariant`, no separate isolation worktree was created (the caller had already placed this agent in an isolated worktree checkout and forbade creating another branch/worktree).

```
npm run check; echo "CHECK_EXIT=$?"
```

First run: **CHECK_EXIT=1** -- `eslint` failed with `sonarjs/super-linear-regex` on the regex introduced by the CR-01 fix (`source.ts:423:50`), which short-circuited the rest of the `&&`-chained gate (lint:workflows, fallow, format:check, all test tiers, and lint:type-members never ran). Fixed by replacing the regex with a `while` loop (commit `4be1c19a`) and re-verified `eslint`, `prettier --check`, and `tsc --noEmit` clean on the file before re-running the full gate.

Second (final) run: **CHECK_EXIT=0**. Full chain passed: `typecheck`, `lint`, `lint:workflows`, `lint:workflows:negative`, `fallow`, `format:check`, `test:corresponding`, `test:corresponding:negative`, `test:coverage:direct:negative`, `test:coverage:unit`, `test:integration` (36/36), `lint:type-members` (108 entries, 4 recorded exceptions, all pre-existing), `lint:type-members:negative` (7/7 negative controls).

---

_Fixed: 2026-09-27T02:03:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
