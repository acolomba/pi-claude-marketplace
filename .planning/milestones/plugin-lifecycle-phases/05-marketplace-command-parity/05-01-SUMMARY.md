---
phase: 05-marketplace-command-parity
plan: 01
subsystem: edge
tags: [router, completions, help, cucumber]
status: complete

requires: []
provides:
  - "`/claude:plugin market <verb>` routes, rejects, and helps exactly as `marketplace <verb>`"
  - "`help market` shows the marketplace usage"
  - "plugin usage lists `market` and ends the marketplace line with `(alias: market)`"
  - "tab completion after a leading `market` matches completion after `marketplace`, and keeps the typed `market`"
affects: [05-marketplace-command-parity]

actuals:
  tokens: 17406
  tasks: 2
  commits: 3
  # The shared tree also carries sibling commits (b60354d1, 12e472fe) inside
  # plan_head_before..plan_head_after, so `git rev-list --count` gives 4 there.
  # This plan's own commits are 358699ff and 47f891f0, plus the SUMMARY commit.
plan_head_before: 3843c0f1
plan_head_after: 47f891f0

tech-stack:
  added: []
  patterns:
    - "Top-level alias: an empty case label stacked on the canonical arm keeps one command identity"
    - "Completion alias: rewrite the head once in readCompletionInput and keep the typed text for values"

key-files:
  created:
    - features/marketplace/market-alias.feature
  modified:
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - test/edge/router.test.ts
    - test/edge/handlers/plugin/help.test.ts
    - test/edge/register.test.ts
    - test/edge/completions/provider.test.ts
    - test/architecture/flag-catalog-drift.test.ts
    - features/plugin/help.feature

key-decisions:
  - "`market` stays a router spelling only; every route it selects carries the `marketplace ...` command identity and the `marketplace` usage text"
  - "The completion provider rewrites a leading `market` once (readCompletionInput) instead of adding a `market` test at each of the four marketplace-position sites"

requirements-completed: [MKT-03]

duration: ~35min
completed: 2026-10-26
---

# Phase 5 Plan 01: Marketplace `market` Alias Summary

`/claude:plugin market` now works as `/claude:plugin marketplace` does: dispatch, usage errors, both help forms, the plugin usage text, and tab completion (MKT-03, D-PL5-11, D-PL5-24).

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | 358699ff | feat(marketplace): accept market as an alias of marketplace |
| 2 | 47f891f0 | feat(completions): complete after market as after marketplace |

## What changed

- `edge/router.ts`: `"market"` follows `"marketplace"` in `TOP_LEVEL_SUBCOMMANDS`. `selectClaudePluginRoute` stacks `case "market":` on the marketplace arm. `isMarketplaceHelpTopic` accepts `market`, so `help market` carries the identity `marketplace help`. The usage header lists `market`, and the marketplace line ends with `   (alias: market)`.
- `edge/handlers/plugin/help.ts`: the topic `market` shows `MARKETPLACE_USAGE`. The `help [marketplace]` usage line is unchanged.
- `edge/completions/provider.ts`: the new `readCompletionInput` runs the existing exact-token promotion. When the head is `market`, it promotes again with `marketplace` as the head. It returns those tokens with the argument text as typed, so `market ad` completes to `market add `. First-token completion offers `market` through `TOP_LEVEL_SUBCOMMANDS`.
- Tests: the router, help, and register suites check every `market <verb>` spelling against its `marketplace` twin: route, handler, arguments, identity, argument rejections, and empty-scope rejections. The bare `market` and `market bogus` are checked too. The provider suite checks the subcommand, flag, and name positions under `market`, plus the `m` first-token case. The drift gate has one `market <verb>` completion head for each marketplace subcommand, and its router inventory lists both heads.
- Features: the three usage cells of `features/plugin/help.feature` are updated, and `features/marketplace/market-alias.feature` adds 5 scenarios.

## Verification

- `node --test test/edge/router.test.ts test/edge/handlers/plugin/help.test.ts test/edge/register.test.ts test/edge/completions/provider.test.ts test/architecture/flag-catalog-drift.test.ts`: 710 pass, 0 fail.
- `npx cucumber-js features/marketplace/market-alias.feature features/plugin/help.feature features/marketplace/help.feature`: 16 scenarios pass. Before the router change, all 5 new scenarios and the 3 help.feature usage scenarios failed (`Unknown subcommand: "market"`, `Unknown help topic: "market"`, and the old usage text).
- `npm run check:features`: exit 0.
- `npm run test:coverage:direct` for router.ts, help.ts, and provider.ts: passed (100% direct).
- ESLint on the changed files, `npx fallow health --fail-on-issues`, and `npx fallow dupes --fail-on-issues`: clean.
- The pre-commit hook (`npm run check:commit`) passed on both task commits.
- `npm run check` was not run. The wave gate owns it.

## Deviations from Plan

None in the delivered code.

One process issue. In the shared tree, a sibling's `git commit` hook (pre-commit stash patch `~/.cache/pre-commit/patch1793070817-316851`) took this plan's unstaged edits while it ran, and they did not come back right away. I restored only this plan's files from that patch with `git apply --include` and re-applied the `features/plugin/help.feature` edit from a backup. A later sibling hook run did restore the whole patch. That run also put back the sibling files from the same patch (`domain/name.ts`, `domain/source.ts`, `domain/unsupported-components.ts`, `orchestrators/marketplace/add.ts`, `features/marketplace/github-source.feature`, `test/domain/source.test.ts`, and `.planning/STATE.md`). The siblings' later edits made during that window may have been rolled back. Sibling plans should check their own files. After this, I made each commit wait until no other git process was running in the tree.

## Uncertain choices

- An exact `market` with no trailing space is promoted to the marketplace subcommand list, as an exact `marketplace` is. So typing `market` and pressing tab offers `market add ` and the other subcommands, not `marketplace`. This matches how an exact top-level token behaves today.
- The usage cells keep the `marketplace` spelling for `market` routes (for example `Usage: /claude:plugin marketplace <remove|rm> ...`), because each route reuses the marketplace handler and its usage text.

## Files outside the ROADMAP Files line

None. Only test and feature files were added outside the edge sources.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: features/marketplace/market-alias.feature
- FOUND: 358699ff, 47f891f0 (ancestors of HEAD)
