---
phase: 114-degradation-and-documentation
verified: 2026-09-21T15:45:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - ".planning/spikes/027-workflow-engine-3-10-1-recheck/README.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-01-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-01-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-02-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-02-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-03-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-03-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-04-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-04-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-05-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-05-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-CONTEXT.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-REVIEW-FIX.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-REVIEW.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/deferred-items.md"
  - "README.es.md"
  - "README.md"
  - "docs/messaging-style-guide.md"
  - "docs/output-catalog.md"
  - "docs/workflows-compatibility.md"
  - "extensions/pi-claude-marketplace/domain/plugin-resolver.ts"
  - "extensions/pi-claude-marketplace/orchestrators/import/execute.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts"
  - "extensions/pi-claude-marketplace/orchestrators/types.ts"
  - "extensions/pi-claude-marketplace/platform/pi-api.ts"
  - "extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts"
  - "extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
  - "extensions/pi-claude-marketplace/shared/notification-grammar.ts"
  - "extensions/pi-claude-marketplace/shared/notification-summary.ts"
  - "extensions/pi-claude-marketplace/shared/notification-types.ts"
  - "extensions/pi-claude-marketplace/shared/notify-reasons.ts"
  - "tests/architecture/catalog-uat/catalog-contract.test.ts"
  - "tests/architecture/messaging-guide-doc-pins.test.ts"
  - "tests/architecture/no-probe-in-workflows-bridge.test.ts"
  - "tests/architecture/workflows-doc-pins.test.ts"
  - "tests/architecture/workflows-marker-coverage.test.ts"
  - "tests/domain/plugin-resolver.test.ts"
  - "tests/orchestrators/plugin/install-flow.test.ts"
  - "tests/platform/pi-api.test.ts"
  - "tests/shared/concerns/soft-dep.test.ts"
  - "tests/shared/notification-dispatch.test.ts"
covered_digest: "v1:sha256:3a16ae61a5fa90a556c73b7fede2cd4a94ea09e50aa407b89572cf449245f1c6"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  pass: 4
  previous_status: passed
  previous_score: 7/7
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  stale_cause: "three merges of main (#181 test-suite refinement, #196 hermetic test environment, #202 argument rejection + test gates) touched README.md, README.es.md, tests/domain/resolver.test.ts, tests/orchestrators/plugin/install.test.ts and docs/messaging-style-guide.md; today's close renamed a catalog state in docs/output-catalog.md and its fixture, and turned deferred-items.md statuses to resolved"
  head_at_verification: "18327876"
  substantive: true
---

## Re-verification, 2026-09-21 (fourth pass, run in INITIAL mode)

The previous report (`re_verification.pass: 3`, `verified: 2026-09-10T03:40:00Z`)
carried no `gaps:` section, so per the run instructions this pass re-derives
every must-have from the plans, summaries and roadmap criteria against HEAD
(`18327876`) rather than replaying the prior report's readings, and records the
result as `pass: 4`.

**The staleness understates what actually happened.** The trigger list named
five touched files, but three of the four intervening merges (`553513a5` /
PR #181 "test: refine the unit test suite", `5f11166a` / PR #196, `feb04658` /
PR #202, folded into the branch by merge commits `285ad6fb`, `064b8ffa` and
`9e48255a`) carried out a project-wide test and source reorganization that
**renamed or split every one of this phase's covered files that lives under
`extensions/pi-claude-marketplace/shared/notify*.ts` or
`tests/{domain,orchestrators,architecture}/`**:

| Old path (Phase 114 close / pass 3) | New path (HEAD) |
|---|---|
| `extensions/pi-claude-marketplace/shared/notify.ts` | split into `shared/notification-types.ts` (REASONS, the discriminated union), `shared/notification-grammar.ts`, `shared/notification-summary.ts`, `shared/notification-dispatch.ts` |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | `extensions/pi-claude-marketplace/domain/plugin-resolver.ts` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | split into `list-flow.ts`, `list-installed-row.ts`, `list-candidate-row.ts`, `list-orphan-fold.ts`, `list.messaging.ts` (the `Dependency[]` derivation site lives in `list-installed-row.ts`) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | split into `update-flow.ts`, `update-cascade.ts` (the `companionSeverity` call site), `update-preflight.ts`, `update-swap.ts`, `update.messaging.ts` |
| `tests/domain/resolver.test.ts` | `tests/domain/plugin-resolver.test.ts` (the citation paragraph and the pinned `WINV-01 strict` case) |
| `tests/orchestrators/plugin/install.test.ts` | `tests/orchestrators/plugin/install-flow.test.ts` (the `WDEP-02 / WDEP-03` byte-equality case) |
| `tests/architecture/catalog-uat.test.ts` | `tests/architecture/catalog-uat/catalog-contract.test.ts` + `catalog-uat/catalog-parser.test.ts` (fixtures moved to `catalog-uat/fixtures/`) |
| `tests/shared/notify.test.ts` | `tests/shared/notification-dispatch.test.ts` (the second, independent `piWithAllLoaded()` definition) |

Every one of these renames was checked at HEAD: the symbol or case named by the
must-have was found at its new location, its content read in full where the
must-have is prose-sensitive, and the gate or test that proves it was **run
directly by this verifier**, not inferred from the rename alone. This is a
mechanical relocation, not a content regression — no must-have's wording,
evidence, or byte contract changed; only the filename holding it did.

### Truth-by-truth re-derivation against HEAD

1. **`Dependency` / `REASONS` third member and marker.** `soft-dep.ts:31`:
   `export type Dependency = "agents" | "mcp" | "workflows"` — still exactly 3
   members. `shared/notification-types.ts:91`: `"requires pi-dynamic-workflows"`
   still a `REASONS` member. `tests/shared/concerns/soft-dep.test.ts` (50 cases,
   4 suites) run directly: all pass, including the three-companion ordering
   case. `OUT-08: Reason is the closed 46-entry reason set` (part of
   `catalog-uat/catalog-contract.test.ts`) run directly: passes — the REASONS
   count is now 46 (up from 45 at Phase 114 close; PR #196/#202-era work added
   one unrelated member), confirmed against source, not asserted from prose.
2. **Envelope bytes independent of engine presence.** The relocated case
   `tests/orchestrators/plugin/install-flow.test.ts:9637` — `"WDEP-02 / WDEP-03:
   the envelope bytes do not depend on whether the host engine is loaded"` — run
   directly: 1/1 pass.
3. **Coverage gate, not a grep.** `tests/architecture/workflows-marker-coverage.test.ts`
   run directly against the post-reorg tree: both tests pass
   (`WDEP-04 / SNM-06: every Dependency[] derivation site renders the
   host-engine marker` and `WDEP-04: the case list covers every Dependency[]
   derivation site`), confirming the 7-site tree-bound enumeration (now
   pointing at `list-installed-row.ts` in place of the old `list.ts`) still
   equals the discovered derivation-site set on the current tree.
4. **`docs/workflows-compatibility.md` states engine, sandbox, script-shape
   divergence, and evidence grades; cites 3.10.1 and Spike 027.** File re-read
   in full (258 lines, unchanged from pass 3 — `git log` shows its only
   post-pass-3 touch is `285ad6fb`, a merge that remapped its `tests/...`
   citations to the renamed paths, e.g. line 206 now cites
   `install-flow.test.ts` and `catalog-uat/catalog-contract.test.ts`). All
   content claims (nine checks, two replicated, sandbox comparison, evidence
   grading discipline, 3.10.1 / Spike 027 citations) re-read and unchanged.
   `tests/architecture/no-stale-test-citations.test.ts` run directly: 5/5
   pass, confirming every renamed `tests/...` citation in the doc resolves on
   disk. `tests/architecture/workflows-doc-pins.test.ts` run directly: 4/4
   pass (`WDEP-04`, two `WDOC-01` cases, one `WGATE-05` case unrelated to this
   phase but sharing the file).
5. **Engine peer floor documented distinct from this project's.** Doc lines
   181-188 re-read: `>=0.80.5` (this project) vs. `>=0.80.8`
   (`@quintinshaw/pi-dynamic-workflows`), both labelled. `package.json:56`:
   `"@earendil-works/pi-coding-agent": ">=0.80.5"` — unchanged, untouched by
   the ten-plus renamed files. `workflows-doc-pins.test.ts`'s
   `WDEP-04: the compatibility doc states this project's peer floor as
   package.json declares it` case, run directly, passes.
6. **Path-bearing premise confirmed / behavior changed accordingly.** The
   citation paragraph and the pinned `WINV-01 strict: a non-string workflows
   declaration resolves unavailable` case now live in
   `tests/domain/plugin-resolver.test.ts:1794-1829` (renamed from
   `resolver.test.ts`; content read in full — citation to Claude Code 2.1.251's
   manifest schema and the plugins reference page unchanged). Run directly:
   1/1 pass. `SUPPORTED_COMPONENT_PATH_KINDS` behavior unchanged.
7. **`npm run check` is green.** Per this run's constraints, the full suite was
   not re-run by this verifier; it was already run in this session at HEAD
   (7178 unit / 36 integration, exit 0; log at
   `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace-workflows/639aabd4-c5ed-4160-a2d0-1782f63c181d/scratchpad/check.log`).
   `git log -1` confirms HEAD is `18327876` with no source changes since that
   run (the only uncommitted change in the tree, `REQUIREMENTS.md`'s WNAM-03
   row, belongs to Phase 110/111 and is outside this phase's covered files).
   This verifier additionally ran every test named in items 1-6 above plus
   `messaging-guide-doc-pins.test.ts` and `no-probe-in-workflows-bridge.test.ts`
   directly, targeted by name — 0 failures across all of them.

### Two items re-checked for regression, neither found

- **`docs/messaging-style-guide.md`'s three WDEP-related conjuncts** (no
  `DEPENDENCIES` runtime tuple, three probe targets not two, no `present`
  variant) — the file was touched by two of the three intervening merges
  (`553513a5`, `9e48255a`) as part of the same `notify.ts` -> four-file split
  reflected in its prose. Re-read: line 39 states "the closed set of 3
  soft-dependency probe targets" (not two); no `DEPENDENCIES` match anywhere
  in the file; no `present` reference. All three conjuncts still hold, now
  updated to point at `notification-types.ts` rather than the retired
  `notify.ts`. `messaging-guide-doc-pins.test.ts` (5 cases) run directly: all
  pass, mechanically re-tying the guide's status-by-field table to the live
  `PLUGIN_STATUSES` tuple.
- **The two Phase 114 catalog states** (`success-with-workflow-engine-absent`,
  `success-with-agents-and-workflows-soft-dep`) — `docs/output-catalog.md` and
  `catalog-uat/fixtures/plugin-install.ts` both still carry them, unaffected
  by today's unrelated rename of `backfill-partially-installed-no-reasons` ->
  `backfill-partially-installed-marker-only` (a different, WCONV-03 state).
  `catalog-uat/catalog-contract.test.ts`'s corpus-lock case now reads
  `"matches all 20 fixture modules to 205 exact documented states"` (up from
  197 at pass 3, purely additive from intervening work), run directly: passes.

### `deferred-items.md` status flip

Today's close commit (`18327876`) turned the file's three `open` rows to
`resolved` in its inline table (they were already narrated `Closed, 2026-09-09`
in prose beneath the table — the table cells had lagged the prose since
Phase 114 closed). No content changed beyond the status word; not a must-have
artifact for any of this phase's roadmap criteria, and not itself checked by
any gate.

### No debt markers, no anti-patterns

`grep -n -E "TBD|FIXME|XXX"` run over every file in `covered_files` above: no
matches.

---

# Phase 114: Degradation and documentation Verification Report

**Phase Goal:** The host engine becomes the third soft dependency, and the
contract of the one bridge that installs executable code is written down.
**Verified:** 2026-09-21T15:45:00Z
**Status:** passed
**Re-verification:** Yes — fourth pass, run in INITIAL mode per the prior
report carrying no `gaps:` section. HEAD is `18327876`.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|---|---|---|
| 1 | `Dependency` carries a third member and every surface that can render a soft-dependency marker renders `requires pi-dynamic-workflows` | ✓ VERIFIED | `soft-dep.ts:31` — 3-member union. `notification-types.ts:91` — marker present. `soft-dep.test.ts` (50/50) and `catalog-contract.test.ts`'s `OUT-08` (46-entry REASONS) run directly, both pass. |
| 2 | The envelopes are written whether or not the engine is loaded, and two installs differing only in the session's tool list write the same bytes | ✓ VERIFIED | `install-flow.test.ts:9637` "WDEP-02 / WDEP-03: the envelope bytes do not depend on whether the host engine is loaded" run directly: 1/1 pass. |
| 3 | A gate, not a grep, proves the marker coverage: reverting any one `Dependency[]` derivation turns exactly one case red | ✓ VERIFIED | `workflows-marker-coverage.test.ts` run directly: 2/2 pass, tree-bound enumeration re-derived against the post-reorg site set (`list-installed-row.ts` in place of `list.ts`). |
| 4 | `docs/workflows-compatibility.md` states which engine runs third-party JavaScript, how it is sandboxed, which script shapes install and then refuse to run, and which claims were measured versus read. Engine claims cite 3.10.1 and Spike 027 | ✓ VERIFIED | Doc re-read in full (258 lines, unchanged since pass 3 except citation remapping). `workflows-doc-pins.test.ts` (4/4) and `no-stale-test-citations.test.ts` (5/5) run directly, both pass — the latter confirms the doc's remapped `tests/...` citations resolve on disk. |
| 5 | The engine's own peer floor (`pi-coding-agent >=0.80.8`) is documented as distinct from this project's (`>=0.80.5`) | ✓ VERIFIED | Doc lines 181-188 re-read; `package.json:56` cross-checked (`>=0.80.5`, unchanged). `workflows-doc-pins.test.ts`'s matching case passes. |
| 6 | The path-bearing premise is confirmed against Claude Code's own documentation, or the behavior resting on it is changed | ✓ VERIFIED | Citation and pinned case relocated to `tests/domain/plugin-resolver.test.ts:1794-1829`, content unchanged, run directly: 1/1 pass. |
| 7 | `npm run check` is green | ✓ VERIFIED (by measurement plus targeted re-runs) | Session-run `npm run check`: 7178 unit / 36 integration, exit 0, log on disk. HEAD unchanged since. This verifier additionally ran all 6 tests above plus `messaging-guide-doc-pins.test.ts` and `no-probe-in-workflows-bridge.test.ts` directly: 0 failures across ~90 individual cases. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `platform/pi-api.ts::hasLoadedWorkflowEngine` | Probes `workflow_control` exactly, catch → false | ✓ VERIFIED | Unchanged path and content; untouched by the intervening merges. |
| `shared/concerns/soft-dep.ts::Dependency` | 3-member literal union, no runtime tuple | ✓ VERIFIED | Re-read at HEAD: `"agents" \| "mcp" \| "workflows"`. |
| `shared/notification-types.ts::REASONS` (was `shared/notify.ts::REASONS`) | Closed set, `requires pi-dynamic-workflows` present | ✓ VERIFIED | 46 members; relocated by the `notify.ts` four-way split, content and position unaffected. `OUT-08` case run directly, passes. |
| `tests/architecture/workflows-marker-coverage.test.ts` | Coverage gate over 7 derivation sites, bound to tree | ✓ VERIFIED | Run directly against the reorganized tree (sites now include `list-installed-row.ts`, `update-cascade.ts`); both tests pass. |
| `tests/architecture/no-probe-in-workflows-bridge.test.ts` | Bridge files carry zero probe surface | ✓ VERIFIED | Run directly, 1/1 pass. |
| `docs/workflows-compatibility.md` | Executable-code contract, evidence-graded | ✓ VERIFIED | Re-read in full; internally consistent; citations remapped and gate-confirmed. |
| `README.md` / `README.es.md` | Workflows in Features, host engine in Prerequisites, tagline updated, doc linked | ✓ VERIFIED | Both files re-read directly (not via a gate): Features bullet at line 30, Prerequisites entry at line 41, both linking `docs/workflows-compatibility.md`; Spanish file line-for-line parallel. `workflows-doc-pins.test.ts` case corroborates. |
| `tests/domain/plugin-resolver.test.ts` (was `resolver.test.ts`) | Upstream citation replaces open-premise paragraph | ✓ VERIFIED | Relocated by the domain-file rename; content read in full, unchanged; case run directly, passes. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `platform/pi-api.ts::hasLoadedWorkflowEngine` | `notification-*.ts` row rendering | `softDepStatus` → `softDepMarkers` → `composeReasons` → `notify()` | ✓ WIRED | Re-confirmed: exactly 3 production `companionSeverity(` call sites at HEAD — `install-flow.ts:399`, `update-cascade.ts:99`, `enable-disable.ts:1446` — matching the doc's "three surfaces raise" claim after the `install.ts`/`update.ts` splits. |
| 7 `Dependency[]` derivation sites | Rendered plugin row | `orchestrators/*` → notification dispatch | ✓ WIRED | `workflows-marker-coverage.test.ts` drives all 7 (including the renamed `list-installed-row.ts` and `update-cascade.ts`) through their public surfaces; passed. |
| `bridges/workflows/*` | Envelope write | no probe import | ✓ WIRED (isolated from the probe) | `no-probe-in-workflows-bridge.test.ts` re-run at HEAD, passed. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| `Dependency` union still exactly 3 members | `grep -n "^export type Dependency"` | `"agents" \| "mcp" \| "workflows"` | ✓ PASS |
| Envelope byte-equality (engine loaded vs. absent) | `node --test --experimental-strip-types --test-name-pattern="WDEP-02 / WDEP-03..." tests/orchestrators/plugin/install-flow.test.ts` | 1/1 pass | ✓ PASS |
| 7-site marker-coverage gate on the post-reorg tree | direct test run: `workflows-marker-coverage.test.ts` | 2/2 pass | ✓ PASS |
| Bridge probe-isolation gate | direct test run: `no-probe-in-workflows-bridge.test.ts` | 1/1 pass | ✓ PASS |
| Catalog corpus lock and Phase 114's two catalog states | direct test run: `catalog-uat/catalog-contract.test.ts` + `catalog-parser.test.ts` | 16/16 pass, 205-example lock holds, both Phase 114 states present | ✓ PASS |
| Compatibility-doc figures re-checked against source | direct test run: `workflows-doc-pins.test.ts` | 4/4 pass | ✓ PASS |
| Doc test-citation resolution after the reorg | direct test run: `no-stale-test-citations.test.ts` | 5/5 pass | ✓ PASS |
| Messaging guide's status table vs. live `PLUGIN_STATUSES` | direct test run: `messaging-guide-doc-pins.test.ts` | 5/5 pass | ✓ PASS |
| Path-bearing premise citation, pinned case | direct test run: `plugin-resolver.test.ts -t "WINV-01 strict..."` | 1/1 pass | ✓ PASS |
| Soft-dep probe truth table | direct test run: `soft-dep.test.ts` + `pi-api.test.ts` | 50/50 pass | ✓ PASS |
| No debt markers (`TBD`/`FIXME`/`XXX`) in any covered file | `grep -n -E "TBD\|FIXME\|XXX"` over all 48 covered files | no matches | ✓ PASS |
| Working tree source state since the session's `npm run check` run | `git status --short` / `git log -1` | HEAD `18327876`, no covered-file uncommitted changes (one unrelated `REQUIREMENTS.md` row from Phase 110/111) | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| WDEP-01 | Probe via `workflow_control`, not bare `workflow` | ✓ SATISFIED | Unchanged file; re-confirmed via `soft-dep.test.ts` + `pi-api.test.ts`, run directly. |
| WDEP-02 | Workflow artifacts written with engine absent, install still succeeds, degradation reason carried | ✓ SATISFIED | Byte-equality test re-run at HEAD (relocated path), passed. |
| WDEP-03 | Install-engine-and-reload recovers with no reinstall | ✓ SATISFIED (mechanical proof) | Same bridge-isolation + byte-equality mechanism, re-run at HEAD. |
| WDEP-04 | `workflows` becomes 3rd `Dependency` member with marker, new REASONS token | ✓ SATISFIED | Truth #1; `Dependency` still 3 members, marker present in a now-46-member set. |
| WDOC-01 | Docs state executable-code framing, engine name/trust grounds, guaranteed-vs-divergent semantics, evidence grading | ✓ SATISFIED | Truth #4; figures mechanically re-verified against source, citations remapped and gate-confirmed. |
| WDOC-02 | `docs/output-catalog.md` carries new token and rendered states under the byte gate | ✓ SATISFIED | Two Phase 114 states re-confirmed present and byte-pinned under the now-205-example corpus. |
| WDOC-03 | `acorn` declared as a runtime dependency | ✓ SATISFIED | `package.json:9`: `"acorn": "^8.16.0"` under `dependencies`, exactly once; untouched by the reorg. |

`.planning/workstreams/workflows/REQUIREMENTS.md` lines 131-137 (unchanged by
the one uncommitted, unrelated WNAM-03 edit in the working tree) confirm all 7
IDs (WDEP-01..04, WDOC-01..03) mapped to Phase 114 and marked `Complete`. No
orphaned requirements found for this phase.

### Anti-Patterns Found

None blocking. Debt-marker scan (`TBD`/`FIXME`/`XXX`) on all 48 covered files
at HEAD: no matches.

### Carried-forward flag (unchanged since pass 1)

`114-03-PLAN.md` holds one `verification: backstop` truth — "a real host engine
started after an engine-absent install lists and runs the envelope with no
reinstall." Its evidence is Spike 027
(`.planning/spikes/027-workflow-engine-3-10-1-recheck/README.md`), re-read at
HEAD: still intact, still records the hand-planted-envelope-found-by-`storage.list()`
result across all three tiers with a negative control. This is directly
observed behavior from an out-of-band live measurement, not presence-plus-wiring,
so it clears the bar for a non-inferable truth and is graded rather than
routed to human verification — consistent with all three prior passes'
treatment of this same item. File content unchanged in this window.

## Gaps Summary

None. The staleness trigger understated the scope of what changed underneath
this phase — three merges carried out a project-wide test and source file
reorganization touching nearly every file this phase's must-haves name — but
every relocated symbol, test case, and prose claim was traced to its new
location, read in full where content-sensitive, and proven by a directly-run
test rather than by re-reading a SUMMARY or trusting the rename alone. No
must-have's substance changed: the `Dependency` union is still exactly 3
members, the host-engine marker still renders correctly and only on the
engine-absent path, the coverage gate still proves 7 sites (relocated but
otherwise identical), the compatibility document's content is unchanged and
its citations were mechanically remapped rather than left to rot, and both
READMEs remain linked and parallel. `docs/messaging-style-guide.md`'s three
Phase-114-relevant conjuncts and the two Phase 114 catalog states in
`docs/output-catalog.md` both survived the intervening merges unharmed,
confirmed by direct re-derivation rather than by trusting that "nothing in
the diff touched them."

---

_Verified: 2026-09-21T15:45:00Z_
_Verifier: Claude (gsd-verifier, re-verification, fourth pass)_
