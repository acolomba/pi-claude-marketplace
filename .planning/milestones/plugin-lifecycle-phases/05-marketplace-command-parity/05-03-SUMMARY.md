---
phase: 05-marketplace-command-parity
plan: 03
subsystem: domain/source
status: complete
requirements-completed: [MKT-05]
tags: [source-parsing, marketplace, hosted-catalog, parity]
requires: []
provides:
  - "HostedManifestSource (`kind: \"hosted\"`, raw, url) in ParsedSource"
  - "first-`@`-or-`#` owner/repo shorthand split (D-PL5-13)"
  - "state.json revalidation of a stored hosted marketplace source"
affects: [05-07, 05-09, phase-6-import]
tech-stack:
  added: []
  patterns: ["new ParsedSource kind threaded through every compile-forced switch beside npm"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/source.ts
    - test/domain/source.test.ts
    - features/marketplace/github-source.feature
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - test/domain/plugin-resolver.test.ts
    - extensions/pi-claude-marketplace/domain/version.ts
    - test/domain/version.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
    - test/orchestrators/plugin/dependency-declaration-read.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - test/orchestrators/plugin/info.test.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - test/persistence/state-io.test.ts
decisions:
  - "The hosted arm finds the authority end at the first `/`, `?` or `#`, so `https://h.example?x=/m.json` stays a url source"
  - "plugin-resolver rejects npm and hosted in one arm with `unsupported source kind: ${kind}`; npm's reason text is unchanged"
  - "A stored hosted object whose raw does not re-parse as hosted is an unknown object source (raw = the JSON object), mirroring unknownObjectSource"
metrics:
  duration: "about 75 min (much of it waiting out sibling pre-commit stashes)"
  completed: 2026-10-27
requirements: [MKT-05, MKT-02]
actuals:
  tokens: 14000
  tasks: 3
  commits: 3
plan_head_before: 3843c0f1bde9ed2094eddfacdbbad5b877756ac4
plan_head_after: 41a2747f8d45e6fa0f8ff817e320b1e3ea9644dc
---

# Phase 05 Plan 03: Shorthand first-delimiter split and the hosted source kind Summary

The `owner/repo` shorthand now splits at the first `@` or `#` as Claude Code does. The shared source funnel also gains a `hosted` kind (an https URL to a `.json` catalog), which persists, reloads from state.json, compares by its fragment-free url, and is an unsupported plugin source everywhere `npm` is.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 1 | b60354d1 | fix(source): split the owner/repo shorthand at the first @ or # |
| 2 | 42417022 | feat(source): classify an https URL to a .json file as a hosted catalog |
| 3 | 41a2747f | fix(state): load a stored hosted marketplace source |

`commits: 3` counts this plan's own commits. The shared tree also holds sibling commits between `plan_head_before` and `plan_head_after` (05-01, 05-02, 05-04), so `git rev-list --count` over that range (10) overcounts this plan.

## What changed

- **Task 1 (MKT-05, D-PL5-13):** `parseShorthandSourceForm` uses one first-delimiter split (`raw.search(/[@#]/)`). `parseShorthandHashRef` and the last-`@` rule are gone. An empty `#` ref still reads as no ref (D-MF-07), and an empty `@` ref is still unknown. New unit rows: `acme/tools@a@b`, `acme/tools@release@2026`, `a@b/c@d` (unknown). New scenario "Adding a github marketplace at a ref that contains an @ clones that ref". I confirmed it fails against the HEAD parser and passes with the change.
- **Task 2 (MKT-02 domain, D-PL5-04/05):** `HostedManifestSource` and the private `parseHostedManifestForm`. Arm order is path -> hosted -> url -> shorthand. Also added `hostedObjectSource` for `{ kind: "hosted", raw }`, plus the `samePlannedSource` arm (url equality) and the `sourceLogical` arm (url). The four compile-forced consumer arms are one case label each in `version.ts`, `dependency-declaration-read.ts` and `info.ts`. In `plugin-resolver.ts` the change is a case label plus a templated reason. `gatedUrlField` and `parseUrlSourceForm` are untouched.
- **Task 3 (D-PL5-05, ST-6):** `revalidateStoredHostedSource`, plus the `obj.kind === "hosted"` arm in `normalizeStoredSource`.

## Verification

- `node --test` over source, plugin-resolver, version, dependency-declaration-read, info and state-io tests: 724 pass, 0 fail.
- `npx cucumber-js features/marketplace/github-source.feature`: 10 scenarios pass.
- `npm run typecheck`: clean.
- `npm run test:coverage:direct` reports 100% for source.ts, plugin-resolver.ts, version.ts, dependency-declaration-read.ts, plugin/info.ts and state-io.ts.
- `test/architecture/no-credential-leak.test.ts`: passes.
- Every commit's hook ran `npm run check:commit`, and each passed.
- Acceptance greps: `lastIndexOf("@")` = 0, `acme/tools@release@2026` in the feature = 2, `D-PL5-13` = 2, `obj.kind === "hosted"` = 1. info.ts and dependency-declaration-read.ts each changed by `1 +` in 42417022.

## Deviations from Plan

None in behavior.

- **[Rule 3 - Blocking] plugin-resolver reason text.** The plan says to add `hosted` "beside npm" with npm's reason byte-identical. I folded both into one arm with `unsupported source kind: ${parsedSource.kind}`. That is two changed lines, not one, and npm's emitted text is unchanged. Commit 42417022.
- **Shorthand simplification.** With no delimiter, the parser calls `parseOwnerRepo(raw, raw)` directly. The old separate slash-count check gave the same result as `parseOwnerRepo`'s own check, so behavior is unchanged.
- **Hosted authority edge case.** The hosted arm ends the authority at the first `/`, `?` or `#`, not only at `/`. Without this, `https://h.example?x=/m.json` would have parsed as hosted. A unit row pins it as a `url` source.
- **Extra test rows** beyond the plan list: `https://h.example?x=/m.json` (url), and a hosted save-then-load round trip in state-io.test.ts as a separate test.

## Shared-tree incident (process, not code)

Sibling commits in this same tree repeatedly stashed every unstaged edit for the length of their pre-commit hook (minutes each). My edits vanished three times during this plan and came back each time. Before every test run and every commit, I waited until no `git commit` for this worktree was running. Before each commit I also confirmed that all my edits were present (`git diff --stat` on my paths). Backups were kept in the scratchpad. No edits were lost.

## Files outside the ROADMAP Files line

- `extensions/pi-claude-marketplace/domain/plugin-resolver.ts`: compile-forced `hosted` case label (unsupported, beside npm).
- `extensions/pi-claude-marketplace/domain/version.ts`: compile-forced `hosted` case label in `sourcePin`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts` (Phase 2's file): one compile-forced `hosted` case label.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (Phases 3 and 7): one compile-forced `hosted` case label.
- `extensions/pi-claude-marketplace/persistence/state-io.ts`: hosted revalidation on state load.

## Notes for later plans

- **Phase 6:** `orchestrators/import/marketplaces.ts:52` still cites D-76-04 (the retired last-`@` split). It was left untouched as the plan directed. A `{source:"url"}` import declaration whose URL ends in `.json` now parses as hosted through the funnel.
- **Until 05-07:** `marketplace add` refuses a hosted URL as `{unsupported source}` (parseAddableSource S5b). No scenario pins this interim refusal.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-03 is pinned by source.test.ts: a github.com `.json` URL is never hosted, a manifest url object stays `url`, and `http://` is refused. T-05-04 is pinned by state-io.test.ts: a hosted record whose raw is a git URL fails to load.

## Self-Check: PASSED

- All 13 modified files exist.
- Commits b60354d1, 42417022 and 41a2747f are ancestors of HEAD.
