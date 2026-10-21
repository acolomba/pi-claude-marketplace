---
phase: 10-github-source-kind-and-suite-close
reviewed: 2026-10-21T17:30:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - .agents/skills/cucumber/rules/features.md
  - .agents/skills/cucumber/rules/steps.md
  - .agents/skills/cucumber/SKILL.md
  - CHANGELOG.md
  - cucumber.json
  - docs/json-output.md
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - features/lib/git-marketplace.ts
  - features/lib/https-git-host/cgi.ts
  - features/lib/https-git-host/server.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/add.feature
  - features/marketplace/github-source.feature
  - features/marketplace/git-source.feature
  - features/marketplace/info.feature
  - features/marketplace/remove.feature
  - features/marketplace/unsupported-source.feature
  - features/marketplace/url-source.feature
  - features/plugin/install.feature
  - features/step_definitions/marketplace/git-host.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/support/pi-process.ts
  - tests/architecture/hermetic-git-environment.test.ts
  - tests/architecture/https-git-host-cgi.test.ts
  - tests/architecture/https-git-host-server.test.ts
  - tests/domain/source.test.ts
  - tests/e2e/_rpc.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/platform/git-auth-callbacks.test.ts
  - tests/shared/errors.test.ts
  - tests/shared/git-failure-classifiers.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-21T17:30:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This is a re-review of the diff from `f495d387` to `b25d84c6`. It focuses on the four fix commits for WR-01..WR-04 of `10-REVIEW.iter2.md`. I also re-checked the rest of the phase diff for anything new.

All four warnings are fixed:

- **WR-01 (fixed, 51a1937a).** The `stored-credential` arm of `onAuthFailure` now throws `StoredCredentialRejectedError(host)` and no longer cancels. I traced the throw through isomorphic-git's `discover` loop (`node_modules/isomorphic-git/index.js:9458-9475`). The throw propagates unchanged, and `withFetchedUrlCause` adds the fetched-URL link only on a rewritten github URL. Every consumer that classifies a git failure goes through `classifyGitTransportFailure`, which maps the new class to `authentication required`: `transportReason` in update, `narrowFetchFailure`, `classifyGitAuthFailure` in install, `classifyGitSourceAccessFailure` in add, the update preflight, the tag probes, and info. No code keys on the old `UserCanceledError` name or message for this path, so no row's reason changes. A helper miss still cancels in `onAuth` and still gets the "no credential was obtained" line. The new `git-source.feature` Outline (stored password `expired` against an armed `s3cret`) checks the whole cause chain and the 401, 401 request log for url and both github spellings.
- **WR-02 (fixed, 7e0c0dae).** `lacksStoredCredential` now lives once, in `orchestrators/marketplace/shared.ts:399-407`. Both sites call it, and `shared.test.ts` covers it with a six-row table. `update.ts` has no leftover imports.
- **WR-03 (fixed, 4d21d34c).** Every step after `mkdtemp` in `BeforeAll` now runs in one `try`, and the `catch` closes a started host and removes the root. The `AfterAll` comment is now true. The only remaining gap is a `realpath` failure right after `mkdtemp`, which is not worth handling.
- **WR-04 (fixed, b25d84c6).** The `git-source.feature` description now names the update fetch and stays within three lines.

The six affected unit suites pass when run alone at HEAD (451 tests, 0 failures).

The 403-after-credential gap that the fixer documented stays a carry-over. A host that accepts the challenge and then answers 403 is rare on the hosts this targets, and the url arm already had the gap before this phase. It does not need to be fixed in this phase.

The Info findings IN-01..IN-05 of `10-REVIEW.iter2.md` were outside the fix scope, and all five are still open in the current tree. They keep their original IDs and are not repeated here: the url ref is still proven only by echo, the two pushes are still not `--atomic`, `server.ts:455` is still 117 columns, `parseOwnerRepo` still accepts `#` and `@` in the repo half, and the CHANGELOG still does not mention the empty `#` divergence.

Recorded decisions D-MF-07 and D-01..D-14, and the carry-overs WINDOWS #100-109 and ROWID-01, are not re-reported.

## Info

### IN-06: The CHANGELOG puts the rejected-credential change under the GitHub base override, but the change reaches every stored-credential host

**File:** `CHANGELOG.md:55`
**Issue:** The new sub-bullet "When a git host rejects your stored credential, the cause now reads `<host> rejected the stored credential` and no longer tells you to store one" sits under the `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` entry. A reader takes that to mean the change needs the setting. But `StoredCredentialRejectedError` comes from the `stored-credential` arm of `onAuthFailure`, and every url source on a host the provider registry does not claim (a GitLab or Gitea host, for example) uses that arm with no setting at all. The change also reaches `marketplace add`, `install`, and `fetch`, where the depth-0 cause was "The operation was canceled." "No longer tells you to store one" is true only of `marketplace update`. The other verbs never showed that line.
**Fix:** Move the line out from under the override entry. For example, add it as a sub-bullet of a git-credential entry, or as its own line: "When a git host rejects your stored credential, the error now says `<host> rejected the stored credential`. `marketplace update` no longer tells you to store a credential you already have."

### IN-07: Doc comments still say a rejected credential reaches the classifiers as an `HttpError`

**File:** `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts:44-46`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:684-687`
**Issue:** The WR-01 fix added a `StoredCredentialRejectedError` bullet to the classifier's doc block. The `HttpError` bullet next to it still says a 401/403 `HttpError` covers "a still-401 after a fresh credential". When a bundle is wired, a second 401 always goes to `onAuthFailure`. Now that call throws `StoredCredentialRejectedError` for a stored-credential bundle and cancels (`UserCanceledError`) for a Device Flow bundle, so no `HttpError` 401 comes out of that case. The `transportReason` doc in `update.ts` lists the ladder as `HttpError`, `UserCanceledError` "(a declined or failed Device Flow)", and network errno. It leaves out the new class and the stored-credential helper miss, which also cancels. The same stale claim appears outside this review's scope, in `orchestrators/plugin/install.messaging.ts:147-150` ("A credential the server rejects ... throws the isomorphic-git `HttpError`") and `orchestrators/plugin/fetch.ts:560-563`. The behavior is correct. Only the comments mislead the next person who changes the auth ladder.
**Fix:** In `git-failure-classifiers.ts`, change the `HttpError` bullet to "a 401/403 that no auth callback answered, such as a 403, or a 401 with no bundle". In `update.ts:684-687`, list `StoredCredentialRejectedError` (a stored credential the host refused) and widen the `UserCanceledError` note to "a helper miss or a declined or failed Device Flow". Make the same change in the two plugin-orchestrator comments when those files are next touched.

---

_Reviewed: 2026-10-21T17:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
