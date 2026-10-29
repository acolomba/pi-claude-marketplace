---
phase: 05-marketplace-command-parity
plan: 05
subsystem: cucumber-stand-ins
tags: [cucumber, git-host, hosted-marketplace, test-infrastructure]
status: complete

requires:
  - "05-04: publishAnthropicsMarketplace and the publication switches as 05-04 left them"
provides:
  - "HttpsGitHost.serveFile(directory, file, bytes, owner?) and fileUrl(directory, file, owner?)"
  - "GitHostSnapshot.files; the empty-run check asserts files: []"
  - "SourceKind `hosted` and HostedPublication in features/lib/published-marketplace.ts"
  - "`source kind` parameter type admits `hosted`; servedRepository resolves a hosted marketplace"
affects: [05-07, 05-09, cucumber suite]

actuals:
  tokens: 7360
  tasks: 2
  commits: 2
plan_head_before: e41cf496
plan_head_after: db2a11df

tech-stack:
  added: []
  patterns:
    - "A hosted publication re-serves its work-tree manifest through the git host after every change (changePublication hosted arm)"

key-files:
  created: []
  modified:
    - features/lib/https-git-host/server.ts
    - test/architecture/https-git-host-server.test.ts
    - features/support/pi-process.ts
    - features/lib/published-marketplace.ts
    - features/support/source-kind.ts
    - features/step_definitions/git-host.steps.ts
    - .agents/skills/cucumber/rules/features.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md

key-decisions:
  - "Served files live in memory, keyed by the decoded path /<owner>/<directory>/<file>; only GET answers a served file, every other request still reaches the CGI"
  - "The file route runs after the arm check, so status, drop, and credential arms of owner/directory apply to served files; a credential arm with the right credential falls through to the file"
  - "HostedPublication.host is narrowed to Pick<GitRepositoryHost, \"serveFile\">; GitRepositoryHost gains serveFile and fileUrl, which HttpsGitHost satisfies structurally"

requirements-completed: []

duration: ~45min
completed: 2026-10-27
---

# Phase 5 Plan 05: Hosted marketplace stand-in Summary

The run's loopback https git host now serves static catalog files from memory (`serveFile`, `fileUrl`), arms and resets them like repositories, and a cucumber step can publish a marketplace as a `hosted` source whose `marketplace.json` the host serves at `https://{git host}/acme/<name>/marketplace.json` and re-serves after every change.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 1 | efa4fe44 | test(git-host): serve static catalog files from the https git host |
| 2 | db2a11df | test(marketplace): publish a marketplace as a hosted source |

`plan_head_before` is the parent of the first task commit: sibling plan 05-06 committed 2810fe22 and e41cf496 in the shared tree after this plan started at 91042493, so `e41cf496..db2a11df` measures only this plan's two commits.

## What changed

- `HttpsGitHost`: a private `files` map; `serveFile` serves or replaces bytes; `fileUrl` names them. `receive` answers a GET of a served path with 200, `content-type: application/json`, `content-length`, and the bytes, and logs it as `GET <path> 200`. `arm` accepts a directory that serves at least one file. `reset()` clears the files; `snapshot()` reports them sorted. The @fileoverview says the host also serves catalog files.
- `features/support/pi-process.ts`: the empty-run check expects `files: []`.
- `features/lib/published-marketplace.ts`: `hosted` in `SourceKind`/`SOURCE_KINDS`, `HostedPublication`, and a hosted arm in `changePublication` (write, then re-serve the work-tree manifest), `requireFreeRoot` (refuse an existing work tree), `publishMarketplaceIn` (write the work tree, serve, source = `fileUrl(directory, "marketplace.json")`), and refusals in `removePublishedSource`, `makeManifestUnreadable`, `unreadableSkillFile`, `describeMarketplaceBranch`.
- `features/support/source-kind.ts`: the regexp admits `hosted`.
- `features/step_definitions/git-host.steps.ts`: `servedRepository` resolves a hosted publication to its owner and directory.
- Skill rules: `features.md` § Source kinds names the hosted kind and its own-feature-file rule; `world-and-stand-ins.md` says the git host serves and resets hosted catalog files.

## Verification

- `node --test test/architecture/https-git-host-server.test.ts`: 7/7 pass (4 new cases: served bytes and log plus a git `info/refs` on the same host; replaced bytes; arming a files-only directory to 404; reset empties `files` and the path stops answering 200).
- `npx cucumber-js features/marketplace/url-source.feature features/marketplace/github-source.feature`: 19/19 scenarios pass (after Task 1).
- `npx cucumber-js features/marketplace/`: 396/396 scenarios pass (after Task 2).
- `npm run typecheck`, `npm run lint`, `npx eslint features --max-warnings 0`, `npm run check:features`: exit 0.
- Both commits ran the pre-commit hook; `npm run check:commit` passed on each.
- A throwaway scenario (not committed) published a hosted marketplace and armed the git host for it, and both steps passed. Pi made no request to the host on `marketplace add` of the hosted URL in that scenario, so production does not fetch a hosted catalog yet; plans 05-06/05-07 own that.
- Acceptance greps: `serveFile(` 1+, `files: []` 1, `"hosted"` 10, `hosted` in source-kind 1, git-host.steps 3, features.md 1.

## Deviations from Plan

None in behavior. Minor choices:

- `features/step_definitions/git-host.steps.ts`: the failure message for a marketplace not on the git host now reads "is not published on the git host" (was "as a git source"), since a hosted catalog is on the host but not a git source. No test or feature matches the old text.
- The test helper `get` now delegates to a new `send` that also returns the body, so the new cases can compare bytes without a second near-copy of the request code.

## Files outside the ROADMAP Files line

Every file of this plan, all test infrastructure for the hosted kind (D-PL5-06):

- `features/lib/https-git-host/server.ts`, `features/support/pi-process.ts`, `test/architecture/https-git-host-server.test.ts`: the stand-in, its empty-run check, and its architecture test.
- `features/lib/published-marketplace.ts`, `features/support/source-kind.ts`, `features/step_definitions/git-host.steps.ts`: the fixture, parameter type, and arming step support for the hosted kind.
- `.agents/skills/cucumber/rules/features.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`: the skill rules that name the kind (Phase 10 also edits these after the merge).

## Known Stubs

None. No feature uses the hosted kind yet by design; plan 05-07 adds those scenarios.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-07 is mitigated as planned: the route serves only paths registered through `serveFile`, from memory, on the loopback-bound host, and `reset()` plus the empty-run check clear and assert them between scenarios.

## Self-Check: PASSED

- All 8 modified files exist; commits efa4fe44 and db2a11df are ancestors of HEAD.
