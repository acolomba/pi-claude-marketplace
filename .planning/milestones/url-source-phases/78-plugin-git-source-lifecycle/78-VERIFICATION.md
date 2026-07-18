---
phase: 78-plugin-git-source-lifecycle
verified: 2026-07-13T00:00:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "human_needed"
  previous_score: "4/4"
  gaps_closed:
    - "Install completion offers not-installed git-source plugins (url / git-subdir / github) as (available), at parity with list — shared git-source-probe.ts module wired into both list.ts and edge-deps.ts's completion bucketizer (78-09)"
    - "Plugin-index cache schemaVersion bumped 4 -> 5 so stale caches carrying wrong `unavailable` git-source rows drop+rebuild on next read (78-09)"
    - "Output-parity drift-guard test locks list and completion to identical git-source status buckets on one fixture, so this divergence class cannot silently regress (78-09)"
    - "Marketplace remove now calls garbageCollectPluginClones post-commit (parity with uninstall/update), so a git-source plugin's plugin-clones/<key>/ dir is reclaimed when the last-referencing marketplace is removed (78-10)"
    - "Round-1 carried-forward human-verification items — live /reload cross-layer removal confirmation, and live sha-bump update — both independently confirmed live and passing in 78-UAT.md (round-2 tests 1 and 2)"
  gaps_remaining: []
  regressions: []
---

# Phase 78: Plugin git-source lifecycle Verification Report

**Phase Goal:** A Pi user can update, uninstall, reinstall, list, and inspect git-source
plugins with the same guarantees as path-source plugins — atomic sha-change swaps,
garbage collection of unreferenced clones, offline warm-cache operations, and
network-free listing.
**Verified:** 2026-07-13T00:00:00Z
**Status:** passed
**Re-verification:** Yes — round 3, after round-2 UAT gap closure (78-09, 78-10)

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP success criteria) | Status | Evidence |
|---|------|--------|----------|
| 1 | `update` detects a sha change, fetches the new clone, swaps atomically, and GCs the old clone once unreferenced | ✓ VERIFIED | Unchanged by 78-09/78-10 (confirmed via `git diff --stat` — `update.ts` not in either plan's `files_modified`). Additionally now confirmed LIVE: 78-UAT.md round-2 test 2 — a real upstream sha bump (obra/superpowers, 7d8d3d4b -> d884ae04) was fetched cold, swapped atomically, `resolvedSha` recorded, and the old clone GC'd, verified on disk. This closes the ONE item that was carried forward as human-verification-only since the initial 78-VERIFICATION.md. |
| 2 | `uninstall` GCs a cached clone when its last referencing plugin is removed, and leaves the clone intact while another plugin still references it | ✓ VERIFIED | GC wiring in `uninstall.ts` unchanged by 78-09/78-10. `node --test tests/orchestrators/plugin/uninstall.test.ts` re-confirmed (67/67 pass, prior verification). PURL-05 also now covered for the marketplace-remove cascade path (see truth 5 below), the gap this round closed. |
| 3 | `reinstall` of a cached git-source plugin completes with no network | ✓ VERIFIED | `reinstall.ts` untouched by 78-09/78-10. Prior verification's offline warm-cache test evidence stands unchanged. |
| 4 | `list` and `info` show git-source plugins with correct status and never clone (network-free listing) | ✓ VERIFIED | `list.ts` row-builder behavior preserved byte-identical (git-source-probe.ts extraction is a verified behavior-preserving move — `makePresenceProbe` moved verbatim, `list.ts` re-imports it, no local redefinition remains: `grep -n makePresenceProbe list.ts` shows only the import line and its one call site). Architecture gate `tests/architecture/no-orchestrator-network.test.ts` re-run clean (1/1 pass). |
| 5 | Install completion, marketplace-remove clone GC, and the round-1 carried-forward live checks all now hold at parity with `list`/`uninstall`/`update` (the round-2 UAT scope) | ✓ VERIFIED | See "UAT Gap Closure" section below — both round-2 gaps closed with dedicated regression tests reproducing the exact reported defect shapes, both passing on direct re-run; both round-1 carried-forward human items closed live in 78-UAT.md. |

**Score:** 4/4 ROADMAP truths verified, plus the round-2 UAT scope (folded into truth 5) fully closed.

### UAT Gap Closure — Round 2 (78-09, 78-10)

Round-2 human UAT (78-UAT.md) ran 4 tests: 2 passed live (the round-1 carried-forward
items), 2 surfaced NEW gaps not previously in scope. Both gaps are now closed by
dedicated gap-closure plans, verified independently against the codebase (not just
SUMMARY claims).

| Round-2 UAT item | Severity | Status | Evidence |
|---|---|---|---|
| Test 1: cross-layer removal reconciles cleanly on a real `/reload` | (round-1 carry-forward) | ✓ PASS (live) | 78-UAT.md: "Both halves verified live" — round-1 residue rendered `{dangling reference}`; after cleanup, `marketplace remove` swept both config files, state, and the clone; next `/reload` printed nothing. |
| Test 2: live update of a git-source plugin after a real upstream sha bump | (round-1 carry-forward) | ✓ PASS (live) | 78-UAT.md: real obra/superpowers repo, `--partial` update fetched cold, swapped atomically, GC'd the old clone, content verified on disk. |
| Test 3: install completion offers git-source plugins (MAJOR) | MAJOR | ✓ CLOSED | 78-09 extracted `git-source-probe.ts` (fs-only shared module: `probeManifestEntry`, `probeUpgradeCandidate`, `makePresenceProbe`), wired it into BOTH `list.ts` and `edge-deps.ts`'s `classifyNotInstalledPluginRow`/`classifyInstalledPluginRow`, bumped `PLUGIN_INDEX_CACHE_SCHEMA` 4→5. Verified directly: `edge-deps.ts` imports `probeManifestEntry`/`probeUpgradeCandidate` from `./plugin/git-source-probe.ts` (line 36) and both classifier functions take a `locations` param (lines 84, 119) that's threaded from `loadManifestForMarketplace`. |
| Test 4: marketplace remove garbage-collects git-source plugin clones (MINOR) | MINOR | ✓ CLOSED | 78-10 added `garbageCollectPluginClones(locations)` call in `remove.ts` at line 762, inside the `failedPlugins.length === 0` post-commit branch (line 737), after the source-clone cleanup, wrapped in a `try { } catch { }` (D-19-01 swallow). Verified directly by reading remove.ts:729-766. |

**Behavioral proof (re-run directly for this verification, not trusted from SUMMARY):**
- `tests/orchestrators/plugin/git-source-probe.test.ts` — 21/21 pass.
- `tests/orchestrators/edge-deps.test.ts` — 14/14 pass, including `"PURL-08 / D-78-03: a not-installed url/git-subdir/github manifest entry is emitted \`available\` by the completion bucketizer"` and `"PURL-08 / D-78-03 output-parity: the list row builder and the completion bucketizer emit identical git-source status buckets"` (a genuine two-independent-surface comparison — `__test_availableRowMessage` re-export from `list.ts` vs. `loadManifestForMarketplace` from `edge-deps.ts` — not a tautological self-check).
- `tests/orchestrators/marketplace/remove.test.ts` — 33/33 pass, including `"PURL-06 / D-78-01: removing the last-referencing marketplace garbage-collects a git-source plugin's clone dir"`.
- `tests/shared/completion-cache.test.ts` — 23/23 pass, including `"PURL-08 :: stale v4 plugin-index cache (git-source rows misclassified unavailable) drops + rebuilds"`.
- `tests/architecture/no-orchestrator-network.test.ts` — 1/1 pass (git-source-probe.ts and remove.ts remain fs-only; NFR-5 holds).
- `tests/architecture/notify-closed-set-locks.test.ts` — 4/4 pass (round-1 fix still holds, untouched by this round).
- Combined direct re-run: 82/82 pass, 0 fail.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` | NEW fs-only shared probe module | ✓ VERIFIED | 146 lines; exports `makePresenceProbe`, `probeManifestEntry`, `probeUpgradeCandidate`; zero `gitOps`/`DEFAULT_GIT_OPS`/`platform/git` outside doc comments describing what it excludes (confirmed via non-comment grep = 0 matches). |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | `makePresenceProbe` moved out, re-imported | ✓ VERIFIED | Line 75 `import { makePresenceProbe } from "./git-source-probe.ts"`; no local `function makePresenceProbe` remains; `__test_availableRowMessage` re-export present (line 1232) for the parity test. |
| `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` | Completion bucketizer wired to shared probe, `locations` threaded | ✓ VERIFIED | Line 36 imports `probeManifestEntry`/`probeUpgradeCandidate`; `classifyInstalledPluginRow` (79-95) and `classifyNotInstalledPluginRow` (116-125) both take and use `locations: ScopedLocations`; `loadManifestForMarketplace` threads `locations` to both call sites (204-220). |
| `extensions/pi-claude-marketplace/shared/completion-cache.ts` | `PLUGIN_INDEX_CACHE_SCHEMA` bumped 4→5 | ✓ VERIFIED | `Type.Literal(5)` at line 86; `schemaVersion: 5 as const` at both write sites (338, 353); `MARKETPLACE_NAMES_CACHE_SCHEMA` correctly untouched at `Type.Literal(2)` (line 66). |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | `garbageCollectPluginClones` wired post-commit | ✓ VERIFIED | Import at line 66; call at line 762, inside `if (failedPlugins.length === 0)` (line 737), after source-clone cleanup (745), wrapped in try/catch with D-19-01 comment (748-765). Exactly 2 occurrences of the symbol (1 import + 1 call), matching the plan's acceptance criterion. |
| `tests/orchestrators/plugin/git-source-probe.test.ts`, `tests/orchestrators/edge-deps.test.ts`, `tests/orchestrators/marketplace/remove.test.ts`, `tests/shared/completion-cache.test.ts` | New/extended regression + parity coverage | ✓ VERIFIED | All four re-run directly for this verification; all pass (see Behavioral Spot-Checks). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `edge-deps.ts` `classifyNotInstalledPluginRow` | `git-source-probe.ts` `probeManifestEntry` | Direct call, `locations` threaded | ✓ WIRED | edge-deps.ts:125; probe never throws so the caller's try/catch was correctly dropped. |
| `edge-deps.ts` `classifyInstalledPluginRow` | `git-source-probe.ts` `probeUpgradeCandidate` | Direct call inside upgradable guard | ✓ WIRED | edge-deps.ts:95. |
| `list.ts` | `git-source-probe.ts` `makePresenceProbe` | Import + call in resolve context | ✓ WIRED | list.ts:75, 394. |
| `completion-cache.ts` schema bump | Stale-cache drop+rebuild path | Existing schemaVersion-mismatch machinery (D-03), unchanged logic, new literal | ✓ WIRED | Confirmed by the new passing test "stale v4 plugin-index cache ... drops + rebuilds". |
| `remove.ts` full-commit branch | `clone-gc.ts` `garbageCollectPluginClones` | Post-`withLockedStateTransaction` call, derives live keys from committed state | ✓ WIRED | remove.ts:762; regression test confirms a seeded clone dir is gone after remove. |
| `edge-deps.ts` output-parity test | `list.ts` `__test_availableRowMessage` vs. `edge-deps.ts` `loadManifestForMarketplace` | Two genuinely independent call paths compared via `assert.deepEqual` | ✓ WIRED | Not a tautology — the two functions are on separate code paths that previously diverged; the test is the regression guard for this exact defect class. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Shared probe module unit coverage | `node --test tests/orchestrators/plugin/git-source-probe.test.ts` | 21/21 pass | ✓ PASS |
| Completion bucketizer parity + regression | `node --test tests/orchestrators/edge-deps.test.ts` | 14/14 pass | ✓ PASS |
| Marketplace-remove clone GC regression | `node --test tests/orchestrators/marketplace/remove.test.ts` | 33/33 pass | ✓ PASS |
| Plugin-index cache schema bump / stale-drop | `node --test tests/shared/completion-cache.test.ts` | 23/23 pass | ✓ PASS |
| Network-free architecture gate (NFR-5) | `node --test tests/architecture/no-orchestrator-network.test.ts` | 1/1 pass | ✓ PASS |
| Round-1 fix regression (dangling-reference token) | `node --test tests/architecture/notify-closed-set-locks.test.ts` | 4/4 pass | ✓ PASS |
| Typecheck | `npm run typecheck` | exit 0, no errors | ✓ PASS |
| Lint on gap-closure files | `npx eslint git-source-probe.ts list.ts edge-deps.ts completion-cache.ts remove.ts` + 4 test files | clean, exit 0 | ✓ PASS |
| No debt markers in gap-closure files | `grep -nE "TBD\|FIXME\|XXX"` on 9 touched files | none found | ✓ PASS |
| No forbidden planning-step comment refs | `grep -nE "Phase [0-9]\|Plan [0-9]{2}\|Wave [0-9]\|Task [0-9]"` on 9 touched files | none found | ✓ PASS |
| No git surface in fs-only files | non-comment grep for `gitOps`/`DEFAULT_GIT_OPS`/`platform/git` in git-source-probe.ts, remove.ts | 0 matches each | ✓ PASS |

Full `npm run check` was NOT re-run for this verification (SUMMARY.md for both 78-09 and
78-10 documents a green full run — 2739 unit tests / 1 pre-existing skip / integration
pass — and the individual task commits, tests, typecheck, and lint were independently
re-confirmed above). Commits `dcecd655`, `bec0fc24`, `a5299695`, `54e5862d` (78-09) and
`15e9e80b`, `cf6d6217`, `12e97229` (78-10) are all present in `git log`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PURL-05 | 01, 04, 07, 10 | `uninstall` GCs a cached clone when its last referencer is removed; now also applies to the marketplace-remove cascade | ✓ SATISFIED | Standalone-uninstall GC unchanged (67 tests); new marketplace-remove GC call site (33 tests incl. the new PURL-06/PURL-05 regression test). |
| PURL-06 | 01, 06, 07, 08, 10 | `update` detects sha changes, swaps atomically, GCs the old clone; dangling-reference diagnostic; marketplace-remove clone GC | ✓ SATISFIED | update.ts unchanged (66 tests + live UAT pass); dangling-reference token wired (56 reconcile tests); marketplace-remove GC now wired and tested. |
| PURL-07 | 02, 05 | `reinstall` of a cached git-source plugin completes without network | ✓ SATISFIED | Unchanged by 78-09/78-10; prior verification evidence stands (71 passing tests). |
| PURL-08 | 03, 09 | `list`/`info` show git-source plugins with correct status, never clone; install completion now offers them at parity | ✓ SATISFIED | list.ts unchanged behaviorally (extraction verified byte-identical); completion bucketizer now wired via the shared probe (14 edge-deps tests + 23 completion-cache tests including the schema-bump regression + output-parity drift-guard). |

**No orphaned requirements.** REQUIREMENTS.md maps exactly PURL-05..08 to Phase 78. The
traceability checklist (`.planning/workstreams/url-source/REQUIREMENTS.md` lines 26-29,
81-84) still shows PURL-05/PURL-06 checked/"Complete" but PURL-07/PURL-08
unchecked/"Pending" — this predates the gap-closure plans, was already flagged as a
ship/milestone-close housekeeping item in the prior verification round, and is
unaffected by 78-09/78-10 (neither plan was scoped to update REQUIREMENTS.md checkboxes).
Not a code gap.

### Anti-Patterns Found

None in the round-2 gap-closure diff (9 files: 5 source, 4 test). No debt markers
(`TBD`/`FIXME`/`XXX`), no stub patterns, no forbidden planning-step comment references
(`Phase NN`, `Plan NN`, `Wave N`, `Task N`) in any newly added or modified
comment/test-title text, confirmed by direct grep against
`.claude/rules/typescript-comments.md`'s forbidden-pattern list. A pre-existing,
unrelated "placeholder" string in `list.ts` (line 1193/1214, the synthetic
`(list)`-named error row, predating this round) is an intentional design pattern
(mirrors the `(reinstall)`/`(update)` precedent), not a stub — confirmed by reading
surrounding context.

### Deferred Items

One item was deliberately deferred by 78-08 (round-1) and recorded in
`deferred-items.md`, unaffected by this round's gap closure:

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `docs/output-catalog.md` and `docs/messaging-style-guide.md` do not yet list the `dangling reference` reason in the human-facing catalog docs | Follow-up docs pass (unscheduled) | `deferred-items.md`: purely documentation; the closed-set completeness proof (`_ReasonsCoverageProof`) is unaffected and passes. |

### Human Verification Required

None. Both round-1 carried-forward human-verification items (live `/reload` cross-layer
confirmation; live sha-bump update) were independently confirmed live and passing in
78-UAT.md round-2 (tests 1 and 2). Both round-2 gaps (install-completion parity;
marketplace-remove clone GC) are closed with dedicated regression tests that reproduce
the EXACT reported defect shapes — a genuine two-surface parity comparison
(`__test_availableRowMessage` vs. `loadManifestForMarketplace`) for the completion gap,
and a direct on-disk clone-survival assertion for the GC gap — not superficial or
tautological checks. Combined with clean typecheck, lint, and architecture-gate
(no-network, closed-set reasons) results, the codebase evidence is conclusive without
requiring a third live UAT round.

### Gaps Summary

No gaps remain. This is round 3 of verification for Phase 78:

- **Round 1** verified all 4 ROADMAP truths but was `human_needed` on one manual-only
  item (live sha-bump update).
- **Round-2 human UAT** then surfaced a NEW cross-layer config-removal blocker (closed
  by 78-07/78-08, re-verified `human_needed` on the same live sha-bump item plus a new
  live `/reload` confirmation item).
- **Round-2 UAT execution** (78-UAT.md) closed BOTH carried-forward live items (tests 1
  and 2, both pass) and surfaced TWO NEW gaps: install-completion parity (MAJOR) and
  marketplace-remove clone GC (MINOR).
- **This round** verifies 78-09 (completion parity) and 78-10 (marketplace-remove GC)
  against the actual codebase — not SUMMARY claims. Both fixes are correctly implemented,
  wired, and covered by regression tests that reproduce the exact reported defects,
  confirmed via direct re-run (82/82 targeted tests pass, typecheck/lint/architecture
  gates all green).

The phase goal — atomic sha-change swaps, clone GC (now on every uninstall path
including marketplace-remove cascade), offline warm-cache operations, and network-free
listing (now including install completion) — is achieved and verified at both the
codebase and live-UAT level.

REQUIREMENTS.md's traceability table still shows PURL-07/PURL-08 as "Pending" — this
predates the gap-closure plans, is unaffected by them, and remains a ship/milestone-close
housekeeping item, not a code gap.

---

_Verified: 2026-07-13T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
