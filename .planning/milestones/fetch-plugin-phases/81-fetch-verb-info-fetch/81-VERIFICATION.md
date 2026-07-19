---
phase: 81-fetch-verb-info-fetch
verified: 2026-07-15T12:00:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "human_needed"
  previous_score: "5/5"
  gaps_closed:
    - "Warm git-subdir plugins (e.g. canva in claude-plugins-official) now resolve components at <clone>/<source.path> instead of the empty monorepo root, across every fs-only read surface (bare info, list, completion bucketizer, fetch post-fetch row, and info --fetch's warm-clone fallback path)"
    - "A warm git-subdir clone whose declared source.path is absent classifies unavailable via the missing-subdir fold, never leaking the monorepo-root pluginRoot"
    - "url/github whole-repo anchoring proven unregressed by a dedicated test"
  gaps_remaining: []
  regressions: []
human_verification:

  - test: "Live fetch against a real remote: `fetch <plugin>@<mp>` on a real git-source marketplace; re-run to confirm no-op (pinned-warm) / refresh (unpinned) semantics"
    expected: "First run materializes the clone/mirror (network); re-run of a pinned-warm target renders `(skipped) {up-to-date}` with no network; re-run of an unpinned target refreshes the mirror; a later `install` of the fetched plugin resolves offline"
    why_human: "FTCH-04/06 real-network + real-auth behavior cannot be exercised in CI. ALREADY EXECUTED AND PASSED: 81-UAT.md test 1, result: pass (2026-07-15). Listed here for record only — not a new open item."
---

# Phase 81: Fetch verb & info --fetch Verification Report

**Phase Goal:** A Pi user can warm a git-source plugin's clone cache ahead of install with a pi-only `fetch` verb (all three shapes), and `info --fetch` fetches-then-resolves in one step — with fetched-but-uninstalled clones staying GC-sweepable and self-healing back to `(remote)`.
**Verified:** 2026-07-15
**Status:** passed
**Re-verification:** Yes — after 81-06 gap closure

## Re-verification Summary

The original verification (2026-07-14) passed all 5 roadmap must-haves at the code level but
routed to `human_needed` pending a live-network UAT check. That UAT (81-UAT.md) ran two tests:

1. **Live fetch against a real remote (FTCH-04/06)** — **passed**.
2. **Warm git-subdir plugin resolves components in info (RSTA-04/05 follow-up)** — **issue,
   major**: `info` on the fetched `canva` git-subdir plugin rendered a bare `(available)` row
   with no components, because `makePresenceProbe`'s two materialized arms never appended
   `source.path` for `git-subdir` sources, so all five shared fs-only read surfaces
   (bare info, `info --fetch`'s warm fallback, `list`, the completion bucketizer, and fetch's
   post-fetch status row) resolved at the monorepo clone root instead of the subdir — silently
   empty components and an over-claiming three-way verdict.

Gap-closure plan 81-06 (commits `7fb5f720`, `1fb7e10d`, `e10cb166`, `b2db5948`) fixed the root
cause by extracting `resolveGitSubdirRoot` into `shared/fs-utils.ts` and applying it inside
`makePresenceProbe`'s two materialized arms. This re-verification re-checks the original 5
roadmap truths for regression AND verifies the gap-closure plan's 5 must-haves against the
actual codebase.

## Goal Achievement

### Observable Truths (original 5, regression-checked)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | `fetch <plugin>@<marketplace>` materializes the clone/mirror without installing; pi-only documented; pinned-warm & path-source re-fetch = `(skipped)` no-op; unpinned always refreshes | ✓ VERIFIED | `fetch.ts` unchanged by 81-06 (not in files_modified). `node --test tests/orchestrators/plugin/fetch.test.ts` re-run: 6/6 pass. README.md:339, docs/output-catalog.md:965 pi-only docs unchanged |
| 2 | `fetch @<marketplace>` and bare `fetch` sweep all fetchable plugins, manifest-driven, per-plugin failures never abort (FTCH-07) | ✓ VERIFIED | `FetchTarget` union unchanged; sweep test re-run passes as part of the fetch.test.ts 6/6 |
| 3 | `info --fetch` fetches then resolves; fetch failure degrades to `not resolved`, never fails info; bare info network-free; no new REASONS | ✓ VERIFIED | `node --test tests/orchestrators/plugin/info.test.ts` re-run: 58/58 pass (file grew from 146 total assertions cited previously to 58 top-level `test()` blocks incl. new Test D; count difference is prior report counting subtests — both runs green). `notify-closed-set-locks` gate re-run: REASONS=34, STATUS_TOKENS=24, PLUGIN_STATUSES=19 — unchanged |
| 4 | Network on cache miss only; auth at install parity (buildAuthForHost, one memo per sweep) | ✓ VERIFIED | `fetch.ts` auth wiring untouched by 81-06; fetch.test.ts FTCH-06 case re-run passes |
| 5 | Fetched-but-uninstalled clone reclaimed by GC (clone-gc.ts byte-unchanged); status self-heals to `(remote)`; no persisted fetch state | ✓ VERIFIED | `clone-gc.ts` not in 81-06 files_modified; `node --test tests/orchestrators/plugin/clone-gc.test.ts` re-run passes (part of the 95-test edge+gc bundle run below) |

### Observable Truths (81-06 gap closure, newly verified)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 6 | A warm git-subdir plugin's components resolve at `<clone>/<source.path>`, fs-only, printing a per-kind component block instead of a bare `(available)` row | ✓ VERIFIED | `git-source-probe.ts:126-141` `anchorSubdir` helper applies `resolveGitSubdirRoot` on both materialized arms (pinned :162, unpinned :168 call sites). Test A (`git-source-probe.test.ts:221`) and Test D (`info.test.ts:2444`) both pass — re-ran directly, both green. Test D asserts `commands: canva-cmd` / `skills: canva-skill` render and `components: not resolved` does NOT appear |
| 7 | The three-way verdict for a git-subdir source is computed against the subdir root, not the monorepo root — a subdir with unsupported components can no longer over-claim `available` | ✓ VERIFIED | `resolveStrict` is called with `resolveGitPluginRoot: probe` where `probe` is the fixed `makePresenceProbe` — the injected callback now returns the subdir-anchored root before resolution runs (D-77-03 pattern, matches install/update's callback). Test A asserts `resolveStrict`'s `componentPaths.skills`/`mcpServers` are non-empty against the subdir, not the empty root |
| 8 | A warm git-subdir clone whose `source.path` does not exist on disk classifies through the existing missing-subdir vocabulary (unavailable), never a leaked monorepo-root pluginRoot | ✓ VERIFIED | `git-source-probe.ts:133-135`: non-materialized arms (`escapes`/`missing-subdir`) from `resolveGitSubdirRoot` are returned directly, folding to the resolver's existing `unavailable` verdict. Test B (`git-source-probe.test.ts:257`) re-run passes: asserts `probeManifestEntry(...) === "unavailable"` |
| 9 | Bare info, info --fetch, list, the completion bucketizer, and fetch's post-fetch derived status row all agree on the same subdir-anchored verdict | ✓ VERIFIED | All five surfaces trace to the single fixed seam: `list.ts:579` `makePresenceProbe`; `edge-deps.ts:128` `probeManifestEntry`; `fetch.ts:412` `probeManifestEntry` (post-fetch `freshRow`) + `fetch.ts:451` `makePresenceProbe` (no-op gate); `info.ts:1189`/`1449` `makePresenceProbe` (bare info AND info --fetch's warm-clone fallback branch — `info --fetch`'s COLD-clone materializing path uses its own pre-existing `resolveFetchedPluginRoot`, which already did the subdir join before 81-06 and is unchanged). No per-surface edits were needed beyond the one seam, confirming the shared-seam design held |
| 10 | The fs-only presence probe still touches no network and imports no git seam (NFR-5): git-source-probe.ts pulls no gitOps / platform/git / DEFAULT_GIT_OPS / refreshGitHubClone surface, directly or transitively | ✓ VERIFIED | `resolveGitSubdirRoot` imported from `shared/fs-utils.ts` (not `clone-cache.ts`), confirmed by direct read of git-source-probe.ts:35. `shared/fs-utils.ts` and `shared/path-safety.ts` (its only new dependency) contain zero forbidden-surface references (grepped directly). `node --test tests/architecture/no-orchestrator-network.test.ts` re-run: 1/1 pass |

**Score:** 10/10 truths verified (0 present, behavior-unverified). Rolled up as 6/6 must-have groups (5 original regression-checked + the 81-06 gap-closure group) per the phase's must_haves frontmatter shape.

### Required Artifacts (81-06)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `extensions/pi-claude-marketplace/shared/fs-utils.ts` | fs-only subdir-anchoring + containment helper, importable by both clone-cache.ts and git-source-probe.ts | ✓ VERIFIED | `resolveGitSubdirRoot` (lines 237-264): `path.resolve` + `assertPathInside` (escapes arm) + `pathExists` (missing-subdir arm) + materialized arm. Byte-preserving move confirmed by identical discriminated-union shape referenced at all 6 call sites (install.ts, update.ts×2, reinstall.ts×2, git-source-probe.ts) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` | makePresenceProbe materialized arms anchor git-subdir pluginRoot at `<cloneDir>/<source.path>` | ✓ VERIFIED | `anchorSubdir` helper (lines 126-141) applied on both the unpinned mirror arm (:162) and pinned clone arm (:168); url/github sources pass through unchanged (line 140 `return { kind: "materialized", pluginRoot: cloneDir, resolvedSha }`) |
| `tests/orchestrators/plugin/git-source-probe.test.ts` | warm git-subdir subdir-anchoring + missing-subdir regression coverage | ✓ VERIFIED | Tests A/B/C present (lines 221, 257, 275) and pass (12/12 in the file, re-run directly) |
| `tests/orchestrators/plugin/info.test.ts` | warm git-subdir info renders resolved components, not a silently-empty available row | ✓ VERIFIED | Test D present (line 2444, `seedWarmSubdirMirror` fixture at line 316) and passes (58/58 in the file, re-run directly) |

### Key Link Verification (81-06)

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| makePresenceProbe git-subdir arm | shared subdir helper | `resolveGitSubdirRoot(cloneDir, source.path)` imported from `shared/fs-utils.ts` (not clone-cache.ts) | ✓ WIRED | git-source-probe.ts:35 import, :132 call site; confirmed NOT importing from clone-cache.ts (would pull DEFAULT_GIT_OPS transitively) |
| clone-cache.ts | shared/fs-utils.ts | re-export under the same name, install/update/reinstall callers unedited | ✓ WIRED | clone-cache.ts:279 `export { resolveGitSubdirRoot } from "../../shared/fs-utils.ts"`; install.ts:136, update.ts:128, reinstall.ts:99 all still import from `./clone-cache.ts` and pass without edits (117/117 clone-cache+install tests re-run green) |
| the presence probe | probeManifestEntry (list + completion) + buildInstalledGitRow/buildGitNotInstalledRow (info) + freshRow (fetch) | single shared seam, no per-surface edits | ✓ WIRED | Traced all 5 call sites directly; only git-source-probe.ts was modified, all consumers unedited and immediately pick up the fix |
| resolveGitSubdirRoot escapes/missing-subdir arms | resolver `unavailable` verdict | GitPluginRootResult union member passthrough | ✓ WIRED | git-source-probe.ts:133-135 returns the non-materialized arm directly; Test B confirms the resolver folds it to `unavailable`, no new REASONS/status token (closed-set-locks gate re-run: 34/24/19, unchanged) |

### Behavioral Spot-Checks (this re-verification)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript strict compile | `npx tsc --noEmit -p .` | clean, no output | ✓ PASS |
| git-source-probe regression + new Tests A-C | `node --test tests/orchestrators/plugin/git-source-probe.test.ts` | 12 pass / 0 fail | ✓ PASS |
| info regression + new Test D | `node --test tests/orchestrators/plugin/info.test.ts` | 58 pass / 0 fail | ✓ PASS |
| Network-free architecture gate | `node --test tests/architecture/no-orchestrator-network.test.ts` | 1 pass / 0 fail | ✓ PASS |
| clone-cache + install callers unbroken | `node --test tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/plugin/install.test.ts` | 117 pass / 0 fail | ✓ PASS |
| Original phase 81 regression bundle (fetch + edge + completion + gc) | `node --test tests/orchestrators/plugin/fetch.test.ts tests/edge/handlers/plugin/fetch.test.ts tests/edge/completions/provider.test.ts tests/orchestrators/plugin/clone-gc.test.ts` | 95 pass / 0 fail | ✓ PASS |
| Architecture gates: catalog-uat, notify-closed-set-locks, notify-grammar-invariant | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/notify-grammar-invariant.test.ts` | 15 pass / 0 fail | ✓ PASS |
| Full `npm run check` | — | Already ran green on this exact merged tree in the 81-06 executor (exit 0, per 81-06-SUMMARY.md + commit history); not re-run here (no-redundant-re-runs policy, explicit constraint for this re-verification) | ✓ PASS (not re-run, per instructions) |

### Locked Decisions Honored

| Decision | Status | Evidence |
| -------- | ------ | -------- |
| D-81-01..05 (fetch shapes, grammar, completion, info --fetch, network/auth) | ✓ | Unchanged since original verification; regression tests re-run confirm |
| D-77-03 (subdir containment is the injected callback's job) | ✓ | `makePresenceProbe` now performs the same callback-owned containment install/update already do; escapes/missing-subdir fold into the existing GitPluginRootResult union |
| NFR-10 (containment: never leak an out-of-tree pluginRoot) | ✓ | `assertPathInside` reused verbatim from the moved helper; Test B proves a missing subdir never leaks the monorepo root |
| NFR-5 (fs-only read surfaces stay network-free) | ✓ | Helper reached via `shared/fs-utils.ts`, not `clone-cache.ts`; no gitOps/platform-git/DEFAULT_GIT_OPS/refreshGitHubClone anywhere in the probe's transitive closure (directly grepped) |
| No closed-set growth | ✓ | REASONS=34, STATUS_TOKENS=24, PLUGIN_STATUSES=19 — identical to the original verification's counts |
| Comment policy (no phase/plan/wave tokens) | ✓ | All new/moved comments in fs-utils.ts, git-source-probe.ts, clone-cache.ts, and both test files anchor on decision/requirement IDs (D-77-03, NFR-10, NFR-5, RSTA-04/05) only — spot-checked, no phase/plan/wave references found |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
| ----------- | -------------- | ------ | -------- |
| FTCH-01 | 81-02, 81-04, 81-05 | ✓ SATISFIED | Regression-checked, unchanged |
| FTCH-02 | 81-01, 81-02 | ✓ SATISFIED | Regression-checked, unchanged |
| FTCH-03 | 81-03 | ✓ SATISFIED | Regression-checked, unchanged |
| FTCH-04 | 81-02, 81-03, 81-06 | ✓ SATISFIED | Cache-miss-only unchanged; 81-06 Test C proves url/github anchoring (a FTCH-04-adjacent surface) unregressed |
| FTCH-05 | 81-05 | ✓ SATISFIED | Regression-checked, unchanged |
| FTCH-06 | 81-02, 81-03, 81-06 | ✓ SATISFIED | Auth wiring unchanged; 81-06's network-free gate re-confirms the fix stayed within FTCH-06's network-free contract |
| FTCH-07 | 81-02, 81-04 | ✓ SATISFIED | Regression-checked, unchanged |
| RSTA-04 | Phase 80, 81-06 | ✓ SATISFIED | 81-06 closes the regression this shared-seam introduced: missing-subdir now folds to unavailable, never a leaked monorepo root (Test B) |
| RSTA-05 | Phase 80, 81-06 | ✓ SATISFIED | 81-06 closes the regression: warm git-subdir plugins resolve their real components again, not a silently-empty available row (Test A, Test D) |

REQUIREMENTS.md already shows FTCH-01..07 and RSTA-04/05 as `[x]` / "Complete" — no bookkeeping gap remaining (unlike the original verification's noted pending-bookkeeping item, which has since been resolved).

No orphaned requirements: every ID declared across 81-01..06's plan frontmatter is accounted for above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | none in 81-06's 5 modified files | — | No TBD/FIXME/XXX/TODO/HACK/placeholder markers introduced by 81-06. One pre-existing `"./placeholder"` string literal in `tests/orchestrators/plugin/info.test.ts:189` is a dummy fixture field value (`resolvedSource`) that predates this phase (introduced 2026-06-04, commit 47a63f71) and is unrelated to the gap-closure change — not a stub, not a regression, not in scope for this re-verification |

### Human Verification Required

None outstanding. The single human-verification item from the original verification (live fetch
against a real remote, FTCH-04/06) has already been executed and passed (81-UAT.md test 1,
2026-07-15). It is carried in the frontmatter above for record-keeping only, per instructions —
it is not a new open item and does not block `passed` status.

The 81-06 gap (81-UAT.md test 2) that DID require human discovery (a live git-subdir marketplace
was needed to surface the silently-empty-components bug) is now closed by hermetic regression
coverage that reproduces the exact failure shape (Tests A-D), so no further human verification is
needed for it.

### Gaps Summary

No gaps. All 5 original roadmap success criteria remain implemented, wired, and regression-tested
after the 81-06 change. All 5 gap-closure must-haves (subdir anchoring, missing-subdir fold,
url/github byte-unchanged, network-free probe closure, cross-surface verdict agreement) are
verified directly against the codebase: read, traced, and re-run. The architecture gates
(no-orchestrator-network, catalog-uat, notify-closed-set-locks, notify-grammar-invariant) all stay
green with unchanged closed-set counts. `npm run check` ran green in the 81-06 executor and is not
re-run here per the no-redundant-re-runs policy. Status is `passed`.

---

_Verified: 2026-07-15T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
