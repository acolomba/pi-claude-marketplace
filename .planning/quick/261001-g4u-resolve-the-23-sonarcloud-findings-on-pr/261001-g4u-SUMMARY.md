---
phase: 261001-g4u
plan: 01
status: complete
subsystem: orchestrators/plugin, platform/git, shared/notification-grammar, lint hygiene
tags: [sonarcloud, S9382, S7780, S7758, S7778, performance, eslint-directives]
requires: []
provides:
  - "ResolveTagOidOptions.cache forwarded to isomorphic-git readTag and readCommit"
  - "Concurrent, order-preserving marketplace tag peel over one shared object cache per listing"
  - "String.raw / codePointAt allowlist escape in renderAllowedMarketplaces"
  - "Single phases.push in runEnableCascadeWithRoot"
  - "19 rule-specific no-await-in-loop directives with code-verified reasons"
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/platform/git.ts
tech-stack:
  added: []
  patterns:
    - "Promise.all over independent local git reads, sharing one isomorphic-git cache object"
    - "eslint-disable-next-line <core rule> -- <reason> as the SonarJS-honored S9382 suppression"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
    - tests/platform/git.test.ts
    - tests/orchestrators/plugin/marketplace-tag-probe.test.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/bridges/skills/discover.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - scripts/check-unused-type-members.contracts.json
decisions:
  - "The tag probe shares one isomorphic-git object cache per listing (user-confirmed: Promise.all plus the cache, no fallback)"
  - "ResolveTagOidOptions.cache is required, not optional, so forwarding needs no conditional spread"
  - "All 19 directive reasons used verbatim from the plan table; each was re-checked against the code"
metrics:
  duration: "~90 min"
  completed: 2026-10-01
actuals:
  tokens: 8320
  tasks: 3
  commits: 3
plan_head_before: 7d60afbdb092d71b4a178fff687969b1f109a082
plan_head_after: 4455c76f52ca9e94f458687d19a2930272b5edc4
---

# Quick Task 261001-g4u: Resolve the 23 SonarCloud findings on PR #198 Summary

The marketplace tag probe now peels tags concurrently through one shared isomorphic-git
object cache. On a 12 MB packfile with 150 tags it went from 11.6 s / 204 MB to
1.2 s / 145 MB. The allowlist escape now uses `String.raw` and `codePointAt`, and two
`phases.push` calls are now one. The 19 loops that are sequential by design carry
`no-await-in-loop` directives with reasons.

## Commits

| Task | Commit     | Title                                                    | Files |
| ---- | ---------- | -------------------------------------------------------- | ----- |
| 1    | `6021b23f` | perf: resolve marketplace tag oids concurrently          | 4     |
| 2    | `9f1059f4` | refactor: use String.raw, codePointAt, and one push      | 3     |
| 3    | `4455c76f` | chore: suppress Sonar await-in-loop on sequential loops  | 10    |

Nothing was pushed. `git log @{upstream}..HEAD` also lists `7d60afbd` (the merge of
origin/main). That commit was already unpushed before this task.

## Findings resolved (locally; SonarCloud confirmation is the orchestrator's after push)

- **S9382 (1 real fix):** `listMarketplaceCandidateTags` now uses `Promise.all`. It keeps
  the listing's tag order, the WR-06 undefined-oid drop, the per-root memo, and the
  `tag-listing-failed` arm.
- **S7780 + S7758:** `renderAllowedMarketplaces` builds the escape with
  ``String.raw`\u${Number(character.codePointAt(0))...}` ``. `git diff` shows exactly one
  changed line, and the hostile-allowlist byte case passes unchanged.
- **S7778:** `runEnableCascadeWithRoot` makes one `phases.push(root, config)` call. The
  CR-03 / WR-08 order is unchanged.
- **S9382 (19 suppressions):** each site has
  `// eslint-disable-next-line no-await-in-loop -- <reason>` directly above the flagged
  await. All 19 reasons match the plan's table word for word. I re-read every site and
  each reason holds, so none was rewritten.

## Benchmark (Task 1 step 5; evidence only, not committed)

Recipe: a 12 MB random blob, 1 commit, 150 lightweight tags `formatter--v1.0.1..150`, then
`git gc`. The real probe ran with range `^1.0.0`.

| Tree                | Result                          | ms     | maxRssMB |
| ------------------- | ------------------------------- | ------ | -------- |
| HEAD `7d60afbd`     | `pinned` `formatter--v1.0.150`  | 11 551 | 204      |
| This change, run 1  | `pinned` `formatter--v1.0.150`  | 1 170  | 145      |
| This change, run 2  | `pinned` `formatter--v1.0.150`  | 1 151  | 143      |

Both runs are under the limits (400 MB, 6 s). The HEAD row ran from a `git archive HEAD` copy
in the scratchpad that used the same `node_modules`.

## Deviations from Plan

### Deviation from the brief, pre-authorized by the plan and confirmed by the user

**Shared object cache in `platform/git.ts`.** The brief named only `Promise.all`. I also added
a required `cache: object` member to `ResolveTagOidOptions` and forward it to both
`git.readTag` and `git.readCommit`. Each probe listing makes one `{}` and passes it to every
peel. Without the cache, every concurrent peel loads and checksums its own copy of the
packfile. Planning measured 859 MB peak for that version (threat T-g4u-01). The user's
decision in the orchestrating session was to follow the plan as written: `Promise.all` plus
the cache.

### Gate result that differs from the plan

**1. The fallow audit verdict before the Task 3 commit was `warn`, not `pass`.**
- **Found during:** Task 3, gate h.
- **What:** the audit uses the new-only gate against the merge-base with
  `origin/features/manifest`. It reported one duplication clone group as introduced:
  `enable-disable.ts` 1698-1718 (`hydrateReEnabledMemberHooks`) against `install-flow.ts`
  385-405 (`hydrateInstalledHooks`).
- **Why:** the two functions were already near-identical. The audit at the Task 2 head
  reported the same pair as inherited (`dup:6f87acd9`, verdict `pass`). Directives #14 and
  #15 add the same comment line inside both copies, so the clone range now touches added
  lines and the pair is counted as introduced.
- **Disposition:** I left it as is.
  - The audit exited 0. AGENTS.md's fallow local gate blocks only on `fail`.
  - `npm run fallow`, which includes `fallow dupes --fail-on-issues`, passed inside both
    `npm run check` and pre-commit.
  - Merging the two hydrate functions would be a refactor outside this task.
- **Risk to flag:** the CI `fallow-audit` job (`lint.yml`) may annotate this clone on the PR.
  The orchestrator should check it after the push.

**2. Process note, no code impact.** I ran `pre-commit run gitlint --hook-stage commit-msg`
while the Task 3 edits were still unstaged. That briefly stashed and then restored them while
the background `test:coverage:direct:commit` / `npm run check` run was in progress. The
working tree came back intact: all 19 directives and the 32 pin rewrites were still there.
The direct-coverage line counts include the added lines (for example, `enable-disable.ts`
2961). The pre-commit run on the staged Task 3 files re-ran the direct-coverage, fallow,
lint, typecheck and type-member hooks, and all passed.

Otherwise the plan ran exactly as written.

## Pins moved (type-member contracts; line numbers only, columns unchanged)

- **Task 1:** none.
- **Task 2:** 20 unique lines, `22 pin references moved`, all in `enable-disable.ts` and all
  +2: 1232, 1564, 1565, 1670, 1752, 1844, 2379, 2389, 2547, 2822. This matches the plan.
- **Task 3:** 28 unique lines, `32 pin references moved`. This matches the plan.
  - `install-flow.ts`: 657, 1116, 2176, each +1.
  - `uninstall.ts`: 1369, 1380, each +2.
  - `apply.ts`: 838, +2.
  - `enable-disable.ts`: 1754, 1846, 2381, 2391, 2549, 2824, each +1.
- `.exceptions.json`: unchanged.
- Gate result: `Unused type member gate passed with 4 recorded exception(s).`

## Verification

- **Task 1:**
  - The focused tests passed: probe, platform git, update-constraint-gate, install-cascade,
    and the offline architecture gate.
  - Direct coverage:
    - `marketplace-tag-probe.ts`: 19/19 branches, 3/3 functions, 150/150 lines.
    - `platform/git.ts`: 105/105 branches, 21/21 functions, 773/773 lines.
  - Lint was clean, the type-member gate passed, the audit verdict was `pass`, and the
    placement check printed `errors=34 unused=0` (expected at this stage).
- **Task 2:**
  - Grammar tests: 104/104. Enable-disable tests: 118/118.
  - Direct coverage:
    - `notification-grammar.ts`: 209/209 branches.
    - `enable-disable.ts`: 296/296 branches.
  - The type-member gate, typecheck and lint passed, and the audit verdict was `pass`.
- **Task 3:**
  - The placement check printed `errors=15 unused=0` (exit 0).
  - `npm run lint` printed `✖ 19 problems (0 errors, 19 warnings)`. There are exactly 19
    `Unused eslint-disable directive (no problems were reported from 'no-await-in-loop')`
    lines, and the exit code was 0.
  - `git diff --quiet HEAD -- eslint.config.js` exited 0.
  - No Sonar-specific suppression comment exists under `extensions/` or `tests/`.
  - `git grep` finds exactly 19 directives.
  - Typecheck passed.
  - `test:coverage:direct:commit` held all 9 changed pairs at 100%.
- **`npm run check`:** `CHECK_EXIT=0` in **1381 s (about 23 min)**, written to a log and not
  piped. Unit coverage: 8531 tests pass, 0 fail. Integration: 67 pass, 0 fail. No ENOSPC
  happened, so the default TMPDIR worked.
- **pre-commit** (`SKIP=trufflehog`) passed on each task's paths. No hook rewrote a file, and
  `git status` stayed clean after each commit.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
T-g4u-01 is mitigated: one shared cache per listing, 145 MB peak against the 400 MB limit.

## Self-Check: PASSED

- All 15 modified files exist and are in commits `6021b23f`, `9f1059f4` and `4455c76f`.
- `git rev-list --count 7d60afbd..HEAD` = 3.
