---
phase: 10-github-source-kind-and-suite-close
reviewed: 2026-10-21T16:59:12Z
depth: standard
files_reviewed: 40
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
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
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

**Reviewed:** 2026-10-21T16:59:12Z
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This re-review covers the diff from `f495d387` to `175d590c`. It focuses on the seven fix commits for IN-01..IN-07 (442eb7c5, 0df7e3fc, 3a2610ed, 4a4f70b9, 9214555c, 13fd212c, 175d590c). Outside `.planning/`, those commits touch only nine files: `CHANGELOG.md`, `domain/source.ts`, `marketplace/update.ts`, `plugin/fetch.ts`, `plugin/install.messaging.ts`, `shared/git-failure-classifiers.ts`, `features/lib/git-marketplace.ts`, `features/lib/https-git-host/server.ts`, and `features/marketplace/url-source.feature`. No source logic changed. The fixer's `npm run check` log at 175d590c shows every gate passing and 433 of 433 scenarios passing.

What I checked for each fix:

- **IN-01 (fixed).** The new `url-source.feature` scenario follows the github "at a ref" scenario. `main` gets "Tools for formatting". `pushGitBranch` then gives `stable` its own commit with "Stable tools", and the scenario checks `description | Stable tools` in `marketplace info`. A clone of the default branch would now show the `main` description and fail the scenario.
- **IN-02 (fixed).** `pushGitRepository` now pushes with `--atomic`, and its doc comment says so. The bare repository is a local clone, so receive-pack supports atomic pushes. The two single-ref pushes do not need the flag.
- **IN-03 (fixed).** The `answer()` comment wraps within the width. The only line in `server.ts` over 100 columns is the template literal at line 75, which Prettier does not break and which predates this round.
- **IN-04 (partly fixed, the rest declined as intended).** The blank line now separates the SRC-03 and D-76-04 paragraphs. The parser change was not made because it moves away from upstream, so I do not report it again.
- **IN-05 (fixed).** The empty-`#` sub-bullet matches `parseShorthandHashRef` (`source.ts:437-445`): an empty ref returns the bare `github` source.
- **IN-06 (moved, but the new text is wrong in two ways).** See IN-08.
- **IN-07 (fixed, with one small gap).** I checked each new comment against `git-auth-callbacks.ts:202-266` and isomorphic-git's `discover` loop (`node_modules/isomorphic-git/index.js:9458-9484`). A cancel from either callback throws `UserCanceledError`. A 401 or 203 with no callback, or any other non-200 status, throws `HttpError`. The `StoredCredentialRejectedError` throw goes through unchanged. The classifier, fetch, and install comments are now correct. The `update.ts` comment leaves out one source of the cancel. See IN-09.

Recorded decisions D-MF-07, D-01..D-14, and D-76-04, the carry-overs WINDOWS #100-109 and ROWID-01, and the documented 403-after-credential gap are not re-reported.

## Info

### IN-08: The rejected-credential CHANGELOG line says "any git host" and "the cause reads", but github.com and two verbs do not behave that way

**File:** `CHANGELOG.md:11`
**Issue:** The new line reads: "When any git host rejects your stored credential, the cause reads `<host> rejected the stored credential`, and `marketplace update` no longer asks you to store one." It is wrong in two ways:

1. **Not any host.** Only a `stored-credential` bundle throws `StoredCredentialRejectedError` (`git-auth-callbacks.ts:236-247`). `buildAuthForHost` gives that bundle only to a host the provider registry does not claim, to the `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` host, and to every host in the autoupdate cascade (`auth-host.ts:128-141`, `:214-221`). github.com in an interactive command gets a `device-flow` bundle instead. There, a rejected keychain token is evicted and the operation cancels, so the user still sees `The operation was canceled.`. github.com is the most common host, so "any git host" misleads the most readers.
2. **Not every verb shows a cause.** A plugin `install` that fails on auth shows the bare `(failed) {authentication required}` row with no cause (`install.messaging.ts:249-264`, amended D-79-03). A url-source `marketplace add` with no override also shows a bare row with no cause (`add.ts:758-773`, as in the first url scenario of `git-source.feature:125-140`). The new text shows up only in `marketplace update`, in plugin `fetch`, and in an add whose URL the override rewrote.

The line also sits under the parent bullet "…and a failed add gives a clearer reason and JSON row". The fixer pointed this out. But a url add, the main case the parent bullet describes, does not show this text at all.
**Fix:** Name where the change applies, and move the line out from under the add entry, for example to its own bullet:

```markdown
- When a git host without a GitHub sign-in rejects your stored credential, `marketplace update` and plugin `fetch` now say `<host> rejected the stored credential`, and `marketplace update` no longer asks you to store one. This includes the host that `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` names.
```

### IN-09: The `transportReason` ladder comment still leaves out a refused device-flow credential as a source of `UserCanceledError`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:685-687`
**Issue:** The fixed comment calls `UserCanceledError` "a helper miss or a declined or failed Device Flow". On a github.com update, the most common cancel is different: the keychain token is filled, the host returns 401, and `onAuthFailure` evicts the token and cancels (`git-auth-callbacks.ts:249-265`). No Device Flow ran, so neither phrase covers this case. The three sibling comments fixed in the same commit do name it: "a device-flow credential the host refuses" (`git-failure-classifiers.ts:48-53`), "whose credential the host refused" (`fetch.ts:564-565`), and "a device-flow credential it rejects" (`install.messaging.ts:150-152`). So the update ladder, the one most likely to see this case, is now the only comment that leaves it out. This error comes from my own iter3 fix text. Behavior is correct.
**Fix:** Change the parenthetical to "(a helper miss, a declined or failed Device Flow, or a device-flow credential the host refused)".

---

_Reviewed: 2026-10-21T16:59:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
