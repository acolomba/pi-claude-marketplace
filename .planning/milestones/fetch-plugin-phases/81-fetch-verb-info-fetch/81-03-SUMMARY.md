---
phase: 81-fetch-verb-info-fetch
plan: 03
subsystem: api
tags: [info-verb, fetch, clone-cache, git-source, degrade, network-free]

# Dependency graph
requires:
  - phase: 80-git-source-resolution
    provides: makePresenceProbe (fs-only git-source presence probe) + the three-way warm-tree resolution info reuses
  - phase: 79-git-source-install
    provides: clone-cache seam (resolvePluginPin / materializePluginClone / materializeOrRefreshPluginMirror) + auth-host buildAuthForHost the fetch hook reuses
provides:
  - "info --fetch: fetch-then-resolve in one step for git-source plugins"
  - "safe fetch-failure degrade to components: not resolved + an existing closed-set reason (never fails info)"
  - "InfoCloneCacheSeam injection point for network-free info --fetch tests"
affects: [fetch-verb, plugin-info, url-source]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Materializing git probe (makeFetchProbe) mirrors install's makeInstallCloneProbe but lives in a FORBIDDEN_TARGET orchestrator — reaches git only through the clone-cache seam + auth-host re-exports, naming zero git surface"
    - "Fetch-failure degrade: classifyFetchFailure (duck-typed HttpError 401/403 + errno ladder) folds to existing network unreachable / authentication required REASONS, else narrowProbeError — no new REASONS member"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/edge/handlers/plugin/info.test.ts

key-decisions:
  - "The fetch hook is threaded as an optional InfoFetchContext down buildBlock -> buildInstalledRow/buildNotInstalledRow -> the git-row builders; when present the row builders swap makePresenceProbe (fs-only) for makeFetchProbe (materializing). Bare info leaves fetchCtx undefined and stays byte-identical to before."
  - "The not-installed git-row builder wraps the fetch probe call in its own try/catch so a materialize throw degrades in-place (D-81-04) rather than rejecting getPluginInfo; the installed git-row builder's existing D-78-04 catch already covers the fetch throw."
  - "Success test uses a PINNED git source (per-sha immutable clone path: clone + checkout) rather than an unpinned mirror (which calls resolveRef HEAD on the fixture-copied non-git tree) — matches the proven install-auth mock pattern."

patterns-established:
  - "Pattern: a network-gated read verb opts into a fetch by injecting a materializing probe at the same seam the fs-only probe uses, so warm/cold classification is identical across bare and --fetch."

requirements-completed: [FTCH-03, FTCH-04, FTCH-06]

coverage:
  - id: D1
    description: "info --fetch on a cold git plugin materializes the clone (network on cache miss) then resolves and lists components (available)"
    requirement: "FTCH-03"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#FTCH-03: info --fetch on a COLD pinned git plugin materializes the clone then resolves and lists components (available)"
        status: pass
    human_judgment: false
  - id: D2
    description: "a fetch throw degrades to components: not resolved + an existing closed-set reason (network unreachable) and never rejects getPluginInfo"
    requirement: "FTCH-04"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#D-81-04: info --fetch degrades to `components: not resolved` + an existing reason when the fetch THROWS, never failing info"
        status: pass
    human_judgment: false
  - id: D3
    description: "bare info (no --fetch) makes zero git-seam calls and renders (remote) for a cold git plugin — the fetch hook runs only when --fetch is passed"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#NFR-5: bare info (no --fetch) on a COLD git plugin makes ZERO git-seam calls and renders `(remote)`"
        status: pass
    human_judgment: false
  - id: D4
    description: "the edge handler accepts the --fetch boolean flag, threads fetch: true, and still rejects every other unknown flag"
    requirement: "FTCH-06"
    verification:
      - kind: integration
        ref: "tests/edge/handlers/plugin/info.test.ts#FTCH-03 :: `info foo@mp --fetch` is accepted and delegates (reaches the absent-marketplace path)"
        status: pass
      - kind: integration
        ref: "tests/edge/handlers/plugin/info.test.ts#FTCH-03 :: `--fetch` does not open the flag gate -- another unknown flag is still rejected"
        status: pass
    human_judgment: false
  - id: D5
    description: "info.ts stays a clean FORBIDDEN_TARGET — zero git surface (gitOps / DEFAULT_GIT_OPS / platform/git) in non-comment source; the no-orchestrator-network gate passes"
    verification:
      - kind: integration
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-07-14
status: complete
---

# Phase 81 Plan 03: info --fetch Summary

**`info --fetch` fetches a git-source plugin's clone/mirror through the clone-cache seam, then resolves and lists components in one step, degrading a fetch failure to `components: not resolved` + an existing closed-set reason without ever failing info — while info.ts names zero git surface.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-14T16:20:13Z
- **Completed:** 2026-07-14T16:38:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `info --fetch <plugin>@<marketplace>` materializes a cold git-source clone (pinned) or mirror (unpinned) via the clone-cache seam with install-parity host auth, then runs the same warm-tree three-way resolution info already uses — resolving components in one step (FTCH-03).
- A fetch throw is caught inside `getPluginInfo` and folded to the existing `components: not resolved` arm with an existing closed-set reason (`network unreachable` / `authentication required` via duck-typed classification, else the `narrowProbeError` ladder) — info never fails (FTCH-04 / D-81-04).
- Bare `info` (no `--fetch`) is unchanged and network-free: the fetch hook only runs when `--fetch` is passed, proven by a zero-git-seam-call control test.
- The edge handler recognizes the single boolean `--fetch`, threads `fetch: true`, and still rejects every other unknown flag; info.ts remains a clean FORBIDDEN_TARGET (the no-orchestrator-network gate passes).

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests for info --fetch (success + failure-degrade + network-free control)** - `a4c27e74` (test)
2. **Task 2: thread the --fetch hook through info.ts + edge info handler (GREEN)** - `3a070f67` (feat)

_Note: this TDD plan committed RED (test) then GREEN (feat). Task 2 also adjusted the success test's fixture (pinned source) and added two edge-handler acceptance tests._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - `GetPluginInfoOptions` gains `fetch?` + test-only seam/auth injection; `InfoCloneCacheSeam` + `InfoFetchContext` + `makeFetchProbe` + `classifyFetchFailure`/`foldFetchOrProbeError` added; the fetch context is threaded through `buildBlock` -> the git-source row builders, which swap the fs-only presence probe for the materializing fetch probe when `--fetch` is passed.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts` - recognizes the `--fetch` boolean, threads `...(fetch && { fetch: true })`, updates USAGE, keeps rejecting all other flags.
- `tests/orchestrators/plugin/info.test.ts` - three cases: fetch success (pinned clone materialize + resolve), fetch-failure degrade, bare-info network-free control.
- `tests/edge/handlers/plugin/info.test.ts` - two cases: `--fetch` accepted/delegated, `--fetch` does not open the flag gate.

## Decisions Made
- **Probe-swap at the shared seam.** Rather than a parallel fetch code path, the fetch context swaps `makePresenceProbe` for `makeFetchProbe` at the exact site the row builders already inject a probe. Warm/cold classification, component enumeration, and the reason braces stay byte-identical between bare info and `info --fetch` — the only difference is whether a cold clone materializes first.
- **Degrade classifier reuses existing REASONS.** `classifyFetchFailure` duck-types the isomorphic-git `HttpError` (401/403) + the errno ladder to `authentication required` / `network unreachable` (mirroring `update.ts::classifyGitProbeFailure`, no isomorphic-git import), falling back to `narrowProbeError`. No new REASONS member is defined in info.ts.
- **Pinned fixture for the success test.** The unpinned mirror path calls `resolveRef HEAD` on a mock-fixture-copied (non-git) tree; the pinned per-sha clone path only calls `clone` + `checkout`, which the mock git ops handle cleanly. The success test uses a pinned source to match the proven `install-auth` pattern.

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task-1 verify command greps for a literal `network unreachable` reason from `narrowProbeError`; that token actually lives in the git-fetch-failure classifier (`network unreachable` / `authentication required`), not the fs-error `narrowProbeError` ladder. The implementation reuses those existing REASONS via a duck-typed classifier exactly as D-81-04 intends ("an existing closed-set reason, e.g. network unreachable"), so no plan deviation was required — the reason surfaced is the one the decision named.

## Issues Encountered
- **cwd drift between the worktree and the shared checkout.** Early edits landed in the worktree copy while `Bash` `cd`'d to the shared checkout, so `node --test` initially read the un-edited file (54 tests, new tests absent). Resolved by running every command against the absolute worktree path (`git rev-parse --show-toplevel`).
- **Unpinned-mirror mock materialize threw `{unreadable}`.** The mirror path's `resolveRef HEAD` fails on a fixture-copied non-git tree. Switched the success test to a pinned source (clone + checkout only).
- **Lint after implementation:** import ordering (auth-host placement) and a cognitive-complexity bump on `getPluginInfo` (16 > 15) — fixed by reordering imports and extracting `buildInfoFetchContext`. `npm run` typecheck/eslint/prettier all green on the four changed files.

## Next Phase Readiness
- `info --fetch` is complete and independent of the `fetch.ts` orchestrator (Wave-1 parallel). No blockers for the remaining phase-81 plans.

---
*Phase: 81-fetch-verb-info-fetch*
*Completed: 2026-07-14*

## Self-Check: PASSED

- All modified files present on disk.
- Both task commits (`a4c27e74` test, `3a070f67` feat) exist in git history.
- 69 relevant tests green (57 info + 11 edge + 1 no-orchestrator-network gate); typecheck, eslint, prettier clean on the four changed files.
