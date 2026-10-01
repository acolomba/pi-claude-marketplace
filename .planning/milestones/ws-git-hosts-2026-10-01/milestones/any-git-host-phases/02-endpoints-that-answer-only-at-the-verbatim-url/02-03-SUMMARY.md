---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
plan: 03
subsystem: plugin-clone-cache
tags: [git, clone-url, isomorphic-git, plugin-install, plugin-update, plugin-reinstall, marketplace-add, url-source]

requires:
  - phase: 02-endpoints-that-answer-only-at-the-verbatim-url
    provides: "networkCloneUrl(source) landed by plan 01, threaded through all clone-cache seams by plan 02"
provides:
  - "The three plugin flow suites (install/update/reinstall) drive the real clone-cache seams against remote allowlists that admit exactly the URL forms D-2-01 sends"
  - "RESEARCH.md assumption A1 discharged: every remaining suffix literal in the test tree classified by inspection and proven by a full run, not left as an assumption"
  - "domain/source.ts::ensureGitSuffix and platform/git.ts's CloneOptions.url docstrings state the shipped D-2-01/D-2-02 rule instead of its retired inverse"
  - "npm run check green at the phase boundary: CHECK_EXIT=0, 100% lines/functions/branches over extensions/**"
affects: [03-marketplace-add-recovers-from-its-own-leftover-clone]

actuals:
  tokens: 2600
  tasks: 3
  commits: 3
  plan_head_before: 9ff4860bfef4149500f5fdcdee609ce869541d8f
  plan_head_after: d06b6325c93593b688c9d94658c6182187adcad1

tech-stack:
  added: []
  patterns:
    - "Remote-allowlist narrowing keyed on parsed source.kind (not hostname text): every url-kind allowlist entry sheds its .git suffix, every github-kind entry (shorthand or an object-form url funneled through the github.com prefix check) keeps it."
    - "A remote allowlist that admits both a URL and its .git-suffixed twin is itself a defect: it cannot fail either way, so the deterministic fix is narrowing to exactly the form the code sends, never widening."

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/integration/marketplace-add-seed-mirrors.test.ts
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/platform/git.ts

key-decisions:
  - "Every failing case in the three plugin flow suites and the seed-mirrors integration suite was a blocked-remote artifact, not a stale value expectation: createGitOpsFake's requireRemote() runs before cloneError is thrown, so an allowlist still admitting only the suffixed form silently produced downstream sha/version mismatches (fallback-to-recorded-state) rather than a visible 'blocked unplanned remote' line in most cases. Narrowing the allowlist alone brought all four suites to green with zero additional by-value assertion edits beyond the two template-built expectations in install-flow.test.ts and the five in marketplace-add-seed-mirrors.test.ts the plan already named."
  - "A github.com URL declared with source: \"url\" in a manifest (not source: \"github\") still parses to github kind: domain/source.ts::urlObjectSource funnels any url starting with https://github.com/ through the github parser (D-76-02). This is why install-flow.test.ts's github.com/org/repo and github.com/org/private allowlist entries keep their suffix despite being declared as url-kind manifest entries -- classification followed the PARSED kind, never the declared kind or the hostname text."
  - "The bootstrap/register family (plugin bootstrap, edge bootstrap, edge register) and reconcile/apply.test.ts's two non-empty allowlists all resolve their remotes through an owner/repo shorthand string (anthropics/claude-plugins-official, acme/remote, acme/proj, acme/user), which always parses to github kind regardless of context -- confirmed green with no edit, not assumed."
  - "ensureGitSuffix's docstring rewrite drops the gitlab.com 422-redirect anecdote and the trailing-slash-trim-via-git-subdir rationale: neither describes a live path after this phase (git-subdir no longer routes through this helper at all), and the accepted trade-off is stated in its shipped direction (D-2-02) rather than its retired inverse."

requirements-completed: [MURL-08, MURL-09]

coverage:
  - id: D1
    description: "The three plugin flow suites (install/update/reinstall) drive the real clone-cache seams against remote allowlists narrowed to admit exactly the D-2-01 wire form per source.kind, closing the mid-phase red plans 01/02 deliberately left."
    requirement: "MURL-08"
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/install-flow.test.ts (157/157 pass)"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/update-flow.test.ts (171/171 pass)"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/reinstall-flow.test.ts (139/139 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RESEARCH.md assumption A1 is discharged: every remaining suffix literal in the test tree (bootstrap/register family, reconcile/apply and backfill, marketplace/update's onAuth argument, list-flow's manifest fixtures, import/execute's empty allowlist, tools.test.ts's preserved-suffix fixture, platform/git.test.ts and git-auth-callbacks.test.ts's raw port/callback constants) is classified by inspection and proven unaffected by a full run, and the one allowlist admitting both URL forms (marketplace-add-seed-mirrors.test.ts) is narrowed to exactly one."
    requirement: "MURL-08, MURL-09"
    verification:
      - kind: integration
        ref: "node --test tests/integration/marketplace-add-seed-mirrors.test.ts (6/6 pass)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:unit (7286/7286 pass, 100.00/100.00/100.00 lines/functions/branches over extensions/**)"
        status: pass
      - kind: integration
        ref: "npm run test:integration (36/36 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "domain/source.ts::ensureGitSuffix's docstring and platform/git.ts's CloneOptions.url docstring state the shipped D-2-01/D-2-02 rule (suffix applied only on the github arm; a suffix-less URL against a suffix-only host no longer resolves) instead of the retired host-agnostic rationale and its gitlab.com 422 anecdote."
    requirement: "MURL-08"
    verification:
      - kind: other
        ref: "grep -c '422' extensions/pi-claude-marketplace/domain/source.ts == 0; grep -c 'networkCloneUrl' extensions/pi-claude-marketplace/platform/git.ts >= 1; grep -c 'from \"../domain/' extensions/pi-claude-marketplace/platform/git.ts == 0"
        status: pass
      - kind: unit
        ref: "node --test tests/domain/source.test.ts tests/domain/clone-key.test.ts tests/platform/git.test.ts tests/architecture/no-stale-test-citations.test.ts tests/architecture/import-boundaries.test.ts (169/169 pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run check exits 0 at the phase's final HEAD: 100% lines/functions/branches over extensions/**, lint:type-members clean with the same 4 pre-existing exceptions and 108 contract entries, and both coverage-pin files unchanged (empty rows list; no new pin)."
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "npm run check; echo CHECK_EXIT=$? -> CHECK_EXIT=0"
        status: pass
    human_judgment: false

duration: 51min
completed: 2026-09-27
status: complete
---

# Phase 2 Plan 3: Residual suite audit closes the phase, and the phase boundary is green Summary

**The three plugin flow suites and the seed-mirrors integration suite now drive real seams against remote allowlists narrowed to the D-2-01 verbatim wire form; assumption A1 is discharged by classifying every remaining suffix literal in the tree; the suffix helper's docstring states the shipped rule instead of its retired inverse; and `npm run check` exits 0 at the phase's final HEAD.**

## Performance

- **Duration:** 51 min
- **Started:** 2026-09-27T03:56:00Z
- **Completed:** 2026-09-27T04:47:08Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Narrowed the remote allowlists in `install-flow.test.ts` (7 entries), `update-flow.test.ts` (6 entries), and `reinstall-flow.test.ts` (6 entries) to admit exactly the D-2-01 wire form per fixture's PARSED `source.kind`: every `example.com` / `gitlab.com` / `gitlab.example.com` entry lost its `.git` suffix (url kind — our parser holds no gitlab.com literal), every `github.com` entry kept it (github kind, including two `install-flow.test.ts` entries declared `source: "url"` that still parse to `github` because `urlObjectSource` funnels any `https://github.com/...` URL through the github parser per D-76-02). Fixed the two template-built wire expectations in `install-flow.test.ts` (lines 7207/7277, invisible to a `.git"` grep) to read the local `cloneUrl` directly instead of appending a suffix. All three suites went from 12/157, 16/171, and 5/139 failing to fully green with zero value-expectation edits beyond the allowlist narrowing and the two template literals — every failure was a `createGitOpsFake.requireRemote()` block, not a stale recorded value.
- Discharged RESEARCH.md's assumption A1 by classifying every remaining suffix literal in the test tree and proving each verdict by running, not by reasoning: `tests/integration/marketplace-add-seed-mirrors.test.ts`'s allowlist admitted BOTH `REPO_URL` and its suffixed twin (a fixture that cannot fail either way) — narrowed to `[REPO_URL]` alone and its five by-value recorded-clone-url expectations changed to `REPO_URL` directly, the phase's sole integration-tier proof that the verbatim URL survives the real clone stack. The bootstrap/register family and `reconcile/apply.test.ts`'s two non-empty allowlists all resolve through an `owner/repo` shorthand string, which always parses to `github` kind — confirmed green, no edit. `reconcile/apply.test.ts`'s remaining cases, all of `backfill.test.ts`, and `import/execute.test.ts` build their fake with an empty allowlist, so no wire expectation can hide there. `marketplace/update.test.ts`'s url literal is an `onAuth` callback argument, not a derived wire URL. `list-flow.test.ts`'s seven hits are manifest `source:` strings feeding list rendering with no git port in the loop. `tools.test.ts`'s fixture declares its own trailing `.git`, which the `url` arm preserves unchanged. `platform/git.test.ts` and `git-auth-callbacks.test.ts` hand their `REMOTE_URL` constants straight to the port or a callback with no derivation in the loop.
- Rewrote `domain/source.ts::ensureGitSuffix`'s docstring: it argued the suffix is host-agnostic on purpose and cited a gitlab.com `422`-redirect observation as the reason -- the exact inverse of D-2-02 after this phase. The new text names `domain/clone-key.ts::networkCloneUrl` as the only caller (the `github` arm only, appending `.git` where Claude Code appends it), states D-2-01's rule that a `url` source's wire form preserves the user's own suffix decision, and states D-2-02's accepted trade-off in its shipped direction. Dropped the redirect anecdote and the trailing-slash-trim rationale tied to `git-subdir`, which no longer routes through this helper at all (`networkCloneUrl`'s `git-subdir` arm returns `source.url` verbatim).
- Rewrote `platform/git.ts`'s `CloneOptions.url` field docstring: it told the reader that url sources supply their canonical `source.url` passed through `ensureGitSuffix` directly -- stale since plan 01 moved that derivation into `networkCloneUrl`. The new text names the derivation in prose only (`platform/` may not import `domain/`, so no import was added) and states which kinds reconstruct the suffixed form versus which supply the URL verbatim.
- Swept `extensions/` for surviving prose stating the retired rule beyond the two files above; every site plans 01 and 02 already corrected (`orchestrators/marketplace/add.ts`'s four `MURL-01 / D-2-0x` comments, `domain/clone-key.ts::networkCloneUrl`'s docstring, `orchestrators/plugin/clone-cache.ts`'s `cloneUrl`/`networkUrl` comment) reads correctly today and needed no further edit.
- Ran the whole phase-boundary gate and read the echoed exit code: `npm run check; echo "CHECK_EXIT=$?"` printed `CHECK_EXIT=0`. `npm run test:coverage:unit` reports 7286/7286 pass with `all files | 100.00 | 100.00 | 100.00` over `extensions/**`; `npm run test:integration` reports 36/36 pass; `npm run lint:type-members` passed with the same 4 pre-existing exceptions and the contracts file still holds 108 entries; `scripts/test-coverage-direct.pin.json` still holds `"rows": []`. A `fallow dupes` step in the log prints a `✗ 0 above threshold` line -- the known red-glyph/green-exit mismatch this repo has hit before (dupe-count summary line, not a gate verdict) -- and the actual `&&`-chained command completed to the final `CHECK_EXIT=0`, so this is not a failure.

## Task Commits

1. **Task 1: the three plugin flow suites** - `3f416a46` (test)
2. **Task 2: classify and settle every remaining candidate** - `78fe180c` (test)
3. **Task 3: the prose says what the code does, and the phase boundary is green** - `d06b6325` (docs)

**Plan metadata:** (this commit, pending)

## Files Created/Modified

- `tests/orchestrators/plugin/install-flow.test.ts` - remote allowlist narrowed (5 of 7 entries lose `.git`), two template-built wire expectations (7207, 7277) read `cloneUrl` directly, one by-value clone expectation (8287) loses its suffix
- `tests/orchestrators/plugin/update-flow.test.ts` - remote allowlist narrowed (3 of 6 entries lose `.git`)
- `tests/orchestrators/plugin/reinstall-flow.test.ts` - remote allowlist narrowed (3 of 6 entries lose `.git`)
- `tests/integration/marketplace-add-seed-mirrors.test.ts` - allowlist narrowed from `[REPO_URL, \`${REPO_URL}.git\`]` to `[REPO_URL]`; five by-value recorded-clone-url expectations changed from the suffixed template to `REPO_URL`
- `extensions/pi-claude-marketplace/domain/source.ts` - `ensureGitSuffix`'s docstring rewritten to state the shipped D-2-01/D-2-02 rule; function body unchanged
- `extensions/pi-claude-marketplace/platform/git.ts` - `CloneOptions.url`'s docstring rewritten to name the `networkCloneUrl` derivation in prose; no import added

## Decisions Made

See `key-decisions` in the frontmatter above. In short: every flow-suite failure was a blocked-remote artifact from an allowlist still admitting only the suffixed form, not a stale value expectation; classification followed the PARSED source kind (a `github.com` URL declared `source: "url"` still parses to `github` per D-76-02), never the declared kind or the hostname text; the bootstrap/register/reconcile candidates all resolve through an `owner/repo` shorthand and needed no edit, confirmed rather than assumed; and the docstring rewrite drops the now-inapplicable 422 anecdote and trailing-slash rationale.

## Deviations from Plan

None - plan executed exactly as written. Every failure encountered (12/157 in install-flow, 16/171 in update-flow, 5/139 in reinstall-flow -- reinstall-flow's count was not separately reported in `02-02-SUMMARY.md` but was explicitly in this plan's Task 1 file list) resolved via the allowlist narrowing and wire-expectation edits the plan itself specified; no case required a fix the plan did not already anticipate.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 is complete: `MURL-08` and `MURL-09` are both fully implemented and proven at the phase boundary (`npm run check` exits 0), with RESEARCH.md's assumption A1 discharged by inspection rather than left open.
- Phase 3 (`marketplace add` recovers from its own leftover clone) depends on Phase 2 per ROADMAP: both phases extend the same `GitOps` seam in `orchestrators/marketplace/shared.ts` and its `platform/git.ts` implementation, and the `scripts/check-unused-type-members.contracts.json` pins are line:col, so Phase 3 planning should re-verify current pin coordinates rather than trust any number recorded before Phase 3's own edits.
- Phase 1's live-canary verification item (`01-VERIFICATION.md`, `status: human_needed`) remains open and blocks milestone close, not Phase 3 planning or execution.
- No blockers for Phase 3.

---
*Phase: 02-endpoints-that-answer-only-at-the-verbatim-url*
*Completed: 2026-09-27*

## Self-Check: PASSED

All 6 modified files verified present on disk; all 3 task commits (`3f416a46`, `78fe180c`, `d06b6325`) verified present in git log. Final re-run at HEAD `d06b6325`: `npm run check` -> `CHECK_EXIT=0`; `npm run test:coverage:unit` 7286/7286 pass, 100.00/100.00/100.00 over `extensions/**`; `npm run test:integration` 36/36 pass; `npm run lint:type-members` 4 pre-existing exceptions, contract count 108; `scripts/test-coverage-direct.pin.json` unchanged (`"rows": []`).
