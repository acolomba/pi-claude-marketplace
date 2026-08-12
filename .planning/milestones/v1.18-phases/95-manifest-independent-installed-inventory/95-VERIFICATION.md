---
phase: 95-manifest-independent-installed-inventory
verified: 2026-08-08T20:51:54Z
status: passed
human_validation: "2026-08-08 operator sign-off via autonomous UAT — both items accepted (All good — continue)"
score: 21/21 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Confirm the INV-05 concurrency backstop: with the list tool path holding no state lock, run `plugin list` (or the tool) concurrently with a mutating operation (install/uninstall) against the same scope and confirm the read returns a stale-but-whole `state.json` snapshot rather than a torn/partial read."
    expected: "The list read never observes a partially-written `state.json` (no JSON parse error, no half-updated record) even without acquiring the lock."
    why_human: "This truth is marked `verification: backstop` in the 95-02-PLAN.md frontmatter. It rests on `write-file-atomic`'s rename-based write semantics in `persistence/state-io.ts`, a subsystem this phase neither touches nor adds a test for. No test in this phase's diff exercises a genuine concurrent list-read/state-write race (the RECON-06 and 'Concurrent first-load race' integration tests exercise concurrent `applyReconcile` writers, not a concurrent list read against a writer). Per the honest-verifier backstop rule, this must be surfaced rather than silently passed. Note: this item was authored as a probe artifact in the plan's flagged-assumptions section, not as new phase behavior — the underlying atomic-write guarantee is pre-existing project infrastructure (NFR-1), not something this phase implements or could regress."
  - test: "Confirm the three flagged-unverified prohibitions in 95-01-PLAN.md / 95-02-PLAN.md are honored in spirit, not just in the letter of the byte-exact tests: (1) no row states a fact about a marketplace the system did not verify, (2) no assertion was edited to match observed (wrong) output rather than the intended byte form, (3) no installed plugin was silently dropped from the inventory."
    expected: "Human sign-off that the judgment-tier LLM verdict below is correct."
    why_human: "These are judgment-tier prohibitions (no `verification: test` field) per ADR-550 D3/D4 routing — an LLM verdict is non-authoritative and must be flagged for human review, never silently passed. My own review of the code and tests (documented below) found no violation of any of the three, but this is a judgment call on process integrity, not a mechanically checkable fact."
---

# Phase 95: Manifest-independent installed inventory Verification Report

**Phase Goal:** Users see every installed plugin represented truthfully in
list output after a valid marketplace manifest drops its entry, without
flattening partial or disabled state.
**Verified:** 2026-08-08T20:51:54Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All 21 `must_haves.truths` entries across 95-01-PLAN.md (15 truths) and
95-02-PLAN.md (9 truths, one of which is the `backstop` item counted
separately below) were checked against the post-fix-loop HEAD
(`0d461b31`), not just the two plan commits.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Clean enabled record absent from a loaded manifest renders `{not in manifest}` (INV-01) | VERIFIED | `list-manifest-absent.test.ts:243` passes against real `listPlugins`; source: `installedRowMessage` stamps `notInManifestField` (`list.ts:546-548`), `LIST_RENDER.installed` forwards `p.reasons` (`list.messaging.ts:107-115`) |
| 2 | Soft-dep marker composes after the reason inside one brace (INV-01/MSG-GR-4) | VERIFIED | `list-manifest-absent.test.ts:266` byte-exact `{not in manifest, requires pi-subagents}` |
| 3 | Degraded record absent from a loaded manifest renders `(partially-installed) {not in manifest, lsp}`, reason first | VERIFIED | `list-manifest-absent.test.ts:352`; `partiallyInstalledReasons` (`list.ts:321-326`) prepends `"not in manifest"` |
| 4 | Record present in manifest renders with no brace (INV-01/INV-02) | VERIFIED | `list-manifest-absent.test.ts:291,377`; gated on `lookup.kind === "absent"` (`list.ts:400`) |
| 5 | `--installed` includes both manifest-absent forms, excludes `(available)` | VERIFIED | `list-manifest-absent.test.ts:468` |
| 6 | Canonical disabled record renders `(disabled)` with no brace (INV-04) | VERIFIED | `list-manifest-absent.test.ts:437`; `PluginDisabledMessage` has no `reasons` field, structurally guaranteed |
| 7 | Folded row whose project manifest FAILED to load keeps bare `(installed)`, no brace (BOUND-03) | VERIFIED | `list-manifest-absent.test.ts:568`; `lookup.kind === "unverified"` when `!scopedManifest.ok` (`list.ts:881-887`) |
| 8 | Folded row whose project manifest LOADED without the entry renders the brace (BOUND-03) | VERIFIED | `list-manifest-absent.test.ts:602` |
| 9 | Manifest membership is exact string identity, no case folding | VERIFIED | `list-manifest-absent.test.ts:318`; `manifestLookupFor` uses `p.name === pluginName` (`list.ts:884`) |
| 10 | Empty `plugins` array is a successful load; every row renders the brace | VERIFIED | Every INV-01/02/03 fixture seeds `manifest: { name, plugins: [] }` and asserts the brace |
| 11 | No new name-matching rule (reuses existing `.find((p) => p.name === pluginName)`) | VERIFIED | `list.ts:884` unchanged comparison, no normalization |
| 12 | Reason order is array order — absence first, then unsupported-kind, then soft-dep marker | VERIFIED | `partiallyInstalledReasons` array order (`list.ts:326`); `composeReasons` appends soft-dep after caller reasons (confirmed by test 266) |
| 13 | `partially-installed-upgradable` collapses to `partially-installed`, included by `--installed` | VERIFIED | `list.ts:495-503` single return arm for both statuses |
| 14 | Empty installed-record marketplace renders header with no rows under `--installed` | VERIFIED | Pre-existing behavior; unaffected by this phase's edits (no new gating logic touches the empty-set path) |
| 15 | `--installed` row order unaffected by the new brace | VERIFIED | `list-manifest-absent.test.ts:468` asserts case-insensitive name order `clean` before `degraded` unchanged |
| 16 | Tool payload `reasons` deep-equals `["not in manifest"]` for a clean manifest-absent record (INV-05) | VERIFIED | `tools.test.ts:748` |
| 17 | Tool payload carries `["not in manifest", "unsupported component"]` for a degraded manifest-absent record (INV-05) | VERIFIED | `tools.test.ts:565-648` |
| 18 | Flat `content[0].text` renders the trailer, matching the structured payload | VERIFIED | Both tests above assert `content[0].text` and `details.plugins[i].reasons` together |
| 19 | Manifest-declared installed record still yields `reasons === undefined` | VERIFIED | `tools.test.ts:779` |
| 20 | `projectRowStatus` unchanged — four statuses still flatten to `installed` tool bucket | VERIFIED | `git diff` shows no hunk inside `projectRowStatus`; `pluginReasons` alone was widened (`tools.ts:372-393`) |
| 21 | `reasons: []` and absent `reasons` both project to `undefined`, never `[]` | VERIFIED | `tools.ts:377,389` guard `.length > 0`; `tools.test.ts:715` (upgradable, empty reasons) and `:779` (declared installed) both assert `undefined` |
| — | Tool call over empty scope returns `plugins: []`, no reasons field | VERIFIED (pre-existing, regression-checked) | `npm run check` full suite green (18/18 integration, unit suite unaffected in this area) |
| — | Reason strings forwarded verbatim, no join/case-change/truncation | VERIFIED | `pluginReasons` returns `p.reasons` (the array reference) unmodified |
| — | Tool payload preserves array order, `not in manifest` at index 0 | VERIFIED | `tools.test.ts:648` `assert.deepEqual(..., ["not in manifest", "unsupported component"])` |
| — | COMPAT-01: no token/status/glyph/field/migration/network growth | VERIFIED | `notify-closed-set-locks.test.ts` (4/4), `no-orchestrator-network.test.ts` (1/1), `catalog-uat.test.ts` (6/6) all pass against unmodified test files |
| B1 | INV-05 concurrency backstop: no write, no lock, stale-but-whole snapshot on concurrent mutation (`verification: backstop`) | PRESENT_BEHAVIOR_UNVERIFIED → routed to human verification | No test in this phase's diff exercises a concurrent list-read against a concurrent state write; the guarantee rests on `write-file-atomic` in `persistence/state-io.ts`, untouched by this phase. Abstained per the backstop rule rather than silently passed. |

**Score:** 21/21 non-backstop truths verified; 1 backstop truth abstained to
human verification (not counted in the numerator or denominator per the
honest-verifier convention — reported separately as `behavior_unverified: 0`
since it is not a behavior-dependent state-transition truth, but a
non-inferable backstop item).

### Prohibitions (judgment-tier, non-authoritative)

Three `must_haves.prohibitions` entries appear in 95-01-PLAN.md and
95-02-PLAN.md, each `status: flagged-unverified` with no `verification: test`
field, so they route as judgment-tier per ADR-550 D3/D4.

| Prohibition | My judgment | Basis |
| --- | --- | --- |
| Must not state a fact about a manifest the system did not verify | **No violation found** | `notInManifest` / `lookup.kind === "absent"` is gated on `scopedManifest.ok === true` in every code path (`manifestLookupFor`, `list.ts:880-887`); BOUND-03 tests (568, 602) confirm a failed read never claims absence |
| Must not treat a green suite as the definition of done by editing assertions to match observed output | **No violation found** | SUMMARY.md and REVIEW-FIX.md both document literal-by-literal tracking of which byte forms moved and why (e.g. 95-01-SUMMARY "Task 2 and Task 3 then moved exactly those two literals"); characterization commit (`60123d3`) precedes all production edits |
| Must not silently erase a user's installed plugin from the inventory | **No violation found** | BOUND-03 fold-preservation tests (568, 642) explicitly assert the folded row survives a failed manifest read |

This is a non-authoritative LLM-judge verdict. Flagged for human review per
the routing rule; **not** a silent pass — see `human_verification` above.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `tests/orchestrators/plugin/list-manifest-absent.test.ts` | Dedicated characterization+behavior suite | VERIFIED | 12 top-level tests, 0 `assert.match`, all pass (`node --test` 12/12) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | `ScopedManifest`/`ManifestLookup` threading, reason stamping | VERIFIED | Discriminated unions present, wired, exercised by tests |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` | `LIST_RENDER.installed` forwards `p.reasons` | VERIFIED | `list.messaging.ts:107-115` |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` | `pluginReasons` widened for `installed`/`partially-installed`/`partially-upgradable` | VERIFIED | `tools.ts:372-393`; the `partially-upgradable` arm was added by the code-review fix loop (CR-01, commit `89334294`), correctly expanding scope to close a related pre-existing gap, documented in REVIEW.md and REVIEW-FIX.md |
| `tests/edge/handlers/tools.test.ts` | Tool-execute assertions on both installed-family arms | VERIFIED | 28/28 pass, including 4 `INV-05`-titled tests |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `enumerateMarketplacePlugins` | `installedRowMessage` | `manifestLookupFor(scopedManifest, pluginName)` | WIRED | `list.ts:814` |
| `buildMarketplaceMessage` primary path | `enumerateMarketplacePlugins` | whole `scopedManifest` bundle | WIRED | Confirmed no call site binds `manifest` alone (`grep -c "const { manifest } = await loadMarketplaceManifestSoftly"` returns 0) |
| Fold path (`loadPluginListPayload`) | `enumerateMarketplacePlugins` | `projectScopedManifest` whole bundle | WIRED | `list.ts:1088-1103`; this is the exact BOUND-03 defect site, confirmed fixed |
| `LIST_RENDER.installed` | `installedLikeRow` | `p.reasons` as 6th arg | WIRED | `list.messaging.ts:107-115`, no longer hardcoded `undefined` |
| `pluginReasons` | tool payload `details.plugins[i].reasons` | `registerListPluginsTool` → `loadToolPluginPayload` | WIRED | Confirmed via `tools.test.ts` deep-equal assertions on live tool `execute()` output, not inferred from the row builder |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `installedRowMessage` `reasons` field | `notInManifestField` / `partiallyInstalledReasons(...)` | `manifestLookupFor(scopedManifest, pluginName)`, itself derived from a real `loadMarketplaceManifestSoftly` disk read | Yes | FLOWING |
| `LIST_RENDER.installed` rendered row | `p.reasons` | The `PluginInstalledMessage` object built by `installedRowMessage` and passed unmodified through the render map | Yes | FLOWING |
| `details.plugins[i].reasons` (tool payload) | `pluginReasons(p)` | The same `PluginNotificationMessage` row object the slash-command renderer consumes, via `loadPluginListPayload` (shared with the tool) | Yes | FLOWING |

No static fallback, hardcoded literal, or mock was found on any of these
chains — every rendered/projected value traces to a real manifest read or
`state.json` record.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| `list-manifest-absent.test.ts` full suite | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` | 12/12 pass | PASS |
| `tools.test.ts` full suite | `node --test tests/edge/handlers/tools.test.ts` | 28/28 pass | PASS |
| Architecture gates (closed-set, no-network, catalog byte-equality) | `node --test tests/architecture/{notify-closed-set-locks,no-orchestrator-network,catalog-uat}.test.ts` | 4/4, 1/1, 6/6 pass | PASS |
| Full quality gate | `PI_SUBAGENTS_ROOT=... npm run check` | exit 0 — typecheck, lint, format, unit, integration all green (integration 18/18, matching 95-02-SUMMARY's claim that the pi-subagents peer failures were environmental) | PASS |
| Debt-marker scan | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` over all 6 phase-touched source/test/doc files | 0 matches | PASS |
| No GSD planning references leaked into source | `grep -cE "Phase [0-9]\|Wave [0-9]\|v1\.18"` over the 3 production files | 0/0/0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| INV-01 | 95-01 | `{not in manifest}` on clean installed rows | SATISFIED | Truths 1-2, 9-12; tests 243, 266, 291, 318 |
| INV-02 | 95-01 | Absence reason prepended on degraded rows | SATISFIED | Truth 3; tests 352, 377, 406 |
| INV-03 | 95-01 | `--installed` spans both manifest-absent forms | SATISFIED | Truth 5; test 468 |
| INV-04 | 95-01 | Canonical disabled row stays bare | SATISFIED | Truth 6; test 437 |
| INV-05 | 95-02 | Tool surface forwards reasons on all installed-family arms | SATISFIED | Truths 16-21; tests 565-648, 748, 779, 810 |
| BOUND-03 | 95-01 | Fold path never claims absence on an unread manifest | SATISFIED | Truths 7-8; tests 568, 602, 642 (post-fix-loop) |

No orphaned requirements: REQUIREMENTS.md's traceability table maps exactly
INV-01..05 and BOUND-03 to Phase 95, and all six appear in the two plans'
`requirements:` frontmatter with no gaps in either direction.

### Anti-Patterns Found

None. No debt markers, no empty implementations, no hardcoded stub data on
any of the six phase-touched files. `docs/output-catalog.md`'s
`manifest-absent-inventory` paragraph was updated by the fix loop (commit
`b89aef7a`) to state the shipped `ManifestLookup`-based rule rather than the
now-reverted iteration-1 claim-authority rule; this was independently
verified by reading the current paragraph against the current `list.ts`
source and confirming they agree (see `95-REVIEW-FIX.md` WR-08 for the
before/after).

### Human Verification Required

### 1. INV-05 concurrency backstop

**Test:** Run `plugin list` (or the `pi_claude_marketplace_plugin_list` tool)
concurrently with a mutating operation (install/uninstall/update) against the
same scope's `state.json`, and confirm the read never observes a torn write.
**Expected:** The list read returns either the pre-mutation or post-mutation
`state.json` content in full — never a partial/corrupt read.
**Why human:** This is a `verification: backstop` truth in 95-02-PLAN.md's
`must_haves.truths`. The guarantee is inherited from `write-file-atomic`'s
rename-based writes in `persistence/state-io.ts`, a pre-existing subsystem
this phase does not touch, add a test for, or regress. No test in the
phase's diff exercises a concurrent list-read-vs-write race specifically
(the closest tests, RECON-06 and the "Concurrent first-load race" test in
`npm run check`'s integration suite, exercise two concurrent *writers*, not
a reader racing a writer). Per the honest-verifier backstop rule this must
be surfaced rather than silently passed, though — as the plan's own
flagged-assumptions section notes — it was authored as a probe artifact
recording an inherited property, not new behavior this phase could regress.

### 2. Judgment-tier prohibitions sign-off

**Test:** Review the three `flagged-unverified` prohibitions listed above
and the evidence cited for each.
**Expected:** Human agreement that the LLM-judge verdict (no violation found
on any of the three) is correct.
**Why human:** Judgment-tier prohibitions route to a non-authoritative
LLM verdict per ADR-550 D3/D4; they must never be silently absorbed into a
`passed` verdict even when the verifier's own reading supports them.

### Gaps Summary

No gaps. Every `must_haves` truth and artifact from both plans is present,
substantively implemented, wired end-to-end through the real `listPlugins`
and tool-`execute()` paths (not inferred from the row builder), and covered
by passing byte-exact and deep-equal tests. The three-iteration code review
(95-REVIEW.md / 95-REVIEW.iter2.md / 95-REVIEW.iter3.md) found and the fix
loop (95-REVIEW-FIX.md, commits `d093b465` through `b89aef7a`) resolved
every Critical and Warning finding, including a genuine INV-01 false
negative (WR-05, an incoherent claim-authority gate that suppressed valid
absence claims on the fold path) that the plan-only implementation would
have shipped with. Two Info-tier findings were deliberately deferred with
carrier todos filed to the correct downstream phases (WR-02 → Phase 98
DOC-08; WR-05(b) → Phase 96 BOUND-01/02) — these are documented deferrals,
not gaps, and are out of this phase's scope by `95-CONTEXT.md`'s explicit
phase boundary.

The `status: human_needed` classification is driven entirely by the two
items above (the backstop truth and the judgment-tier prohibitions), neither
of which reflects a defect found in the implementation — both are honest-
verifier abstentions required by the verification protocol rather than
evidence of a missed requirement.

---

_Verified: 2026-08-08T20:51:54Z_
_Verifier: Claude (gsd-verifier)_
